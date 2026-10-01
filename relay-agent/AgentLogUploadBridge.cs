using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class AgentLogUploadBridge
    {
        private const int MaxChunkChars = 320000;
        private const long DirtyCheckpointMs = 6L * 60L * 60L * 1000L;
        private const long SizeCheckpointBytes = 2L * 1024L * 1024L;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer { MaxJsonLength = 8 * 1024 * 1024 };
        private readonly Func<AgentSession> _sessionProvider;
        private readonly string _instanceId;
        private readonly string _checkpointFile;
        private readonly string _pendingDir;
        private readonly string _cleanExitFile;
        private readonly Action<string> _log;
        private readonly object _sealGate = new object();
        private readonly object _errorGate = new object();
        private readonly Dictionary<string, ErrorBurstState> _errorBursts =
            new Dictionary<string, ErrorBurstState>(StringComparer.Ordinal);
        private readonly DateTime _processStartedLocal = DateTime.Now;
        private DateTime _lastSizeSealLocal = DateTime.MinValue;
        private DateTime _errorWindowStartedUtc = DateTime.MinValue;
        private int _errorWindowSent;
        private const int MaxImmediateErrorsPerWindow = 6;
        private static readonly TimeSpan ErrorFingerprintWindow = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan ErrorGlobalWindow = TimeSpan.FromMinutes(10);
        private static readonly Regex ErrorGuidPattern = new Regex(@"(?i)\b[0-9a-f]{8}-[0-9a-f-]{20,}\b", RegexOptions.Compiled);
        private static readonly Regex ErrorHexPattern = new Regex(@"(?i)\b[0-9a-f]{12,}\b", RegexOptions.Compiled);
        private static readonly Regex ErrorNumberPattern = new Regex(@"\b\d{2,}\b", RegexOptions.Compiled);
        private static readonly Regex ErrorSpacePattern = new Regex(@"\s+", RegexOptions.Compiled);

        private sealed class ErrorBurstState
        {
            internal DateTime LastSentUtc = DateTime.MinValue;
            internal int Suppressed;
        }

        internal AgentLogUploadBridge(
            Func<AgentSession> sessionProvider,
            string instanceId,
            string checkpointFile,
            Action<string> log)
        {
            _sessionProvider = sessionProvider;
            _instanceId = instanceId ?? "";
            _checkpointFile = checkpointFile ?? "";
            _log = log ?? delegate { };
            var root = Path.GetDirectoryName(_checkpointFile);
            if (string.IsNullOrWhiteSpace(root)) root = AppDomain.CurrentDomain.BaseDirectory;
            _pendingDir = Path.Combine(root, "agent-log-pending");
            _cleanExitFile = Path.Combine(root, "agent-log-clean-exit.marker");
            try { Directory.CreateDirectory(_pendingDir); } catch { }
            if (ReadCheckpoint() == DateTime.MinValue) WriteCheckpoint(_processStartedLocal);
        }

        internal void TryQueueScheduledSnapshot()
        {
            try
            {
                var session = _sessionProvider();
                if (!UsableSession(session)) return;

                TryFlushPending(session);

                var now = DateTime.Now;
                var checkpoint = ReadCheckpoint();
                if (checkpoint == DateTime.MinValue)
                {
                    WriteCheckpoint(now);
                    return;
                }

                var dueByTime = now - checkpoint >= TimeSpan.FromMilliseconds(DirtyCheckpointMs);
                var dueBySize = now - _lastSizeSealLocal >= TimeSpan.FromMinutes(30) &&
                                CurrentOpenLogBytes() >= SizeCheckpointBytes;
                if (!dueByTime && !dueBySize) return;

                var path = SealFromCheckpoint("checkpoint", "");
                if (!string.IsNullOrWhiteSpace(path))
                {
                    if (dueBySize) _lastSizeSealLocal = now;
                    TryFlushPending(session);
                    _log("AGENT LOG seal=PASS type=checkpoint reason=" +
                         (dueBySize ? "SIZE_2MB" : "DIRTY_6H"));
                }
            }
            catch (Exception ex)
            {
                _log("AGENT LOG checkpoint=DEFER type=" + ex.GetType().Name +
                     " detail=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }

        internal void TryQueueCrashSnapshot(string crashType)
        {
            try
            {
                TryDeleteCleanExitMarker();
                var marker = "CRASH_MARKER=" + AgentDiagnostics.Sanitize(crashType ?? "UNKNOWN");
                var path = SealFromCheckpoint("crash", marker);
                var session = SafeSession();
                if (UsableSession(session)) TryFlushPending(session);
                if (!string.IsNullOrWhiteSpace(path)) _log("AGENT LOG seal=PASS type=crash");
            }
            catch (Exception ex)
            {
                _log("AGENT LOG crash=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        internal void TryQueueErrorSnapshot(string errorType)
        {
            var fingerprint = ErrorFingerprint(errorType);
            var suppressed = 0;
            lock (_errorGate)
            {
                var now = DateTime.UtcNow;
                if (_errorWindowStartedUtc == DateTime.MinValue || now - _errorWindowStartedUtc >= ErrorGlobalWindow)
                {
                    _errorWindowStartedUtc = now;
                    _errorWindowSent = 0;
                }

                ErrorBurstState state;
                if (!_errorBursts.TryGetValue(fingerprint, out state))
                {
                    state = new ErrorBurstState();
                    _errorBursts[fingerprint] = state;
                }
                if (state.LastSentUtc != DateTime.MinValue && now - state.LastSentUtc < ErrorFingerprintWindow)
                {
                    state.Suppressed++;
                    _log("AGENT LOG error_upload=SUPPRESSED reason=SAME_FINGERPRINT window=10m count=" + state.Suppressed);
                    return;
                }
                if (_errorWindowSent >= MaxImmediateErrorsPerWindow)
                {
                    state.Suppressed++;
                    _log("AGENT LOG error_upload=SUPPRESSED reason=GLOBAL_FUSE max=6 window=10m");
                    return;
                }

                suppressed = state.Suppressed;
                state.Suppressed = 0;
                state.LastSentUtc = now;
                _errorWindowSent++;
            }

            try
            {
                var marker =
                    "ERROR_MARKER=" + AgentDiagnostics.Sanitize(errorType ?? "UNKNOWN") + Environment.NewLine +
                    "ERROR_FINGERPRINT=" + fingerprint + Environment.NewLine +
                    "REPEAT_SUPPRESSED_SINCE_LAST_SEND=" + suppressed.ToString(CultureInfo.InvariantCulture);
                var path = SealFromCheckpoint("error", marker);
                var session = SafeSession();
                if (UsableSession(session)) TryFlushPending(session);
                if (!string.IsNullOrWhiteSpace(path))
                    _log("AGENT LOG seal=PASS type=error suppressed=" + suppressed);
            }
            catch (Exception ex)
            {
                _log("AGENT LOG error=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        // Kept under the existing method name so login/DPAPI restore call sites stay
        // compatible. D158 expands it to recover any unclosed local segment and then
        // flush all sealed bundles.
        internal void TryFlushPendingCrash()
        {
            try
            {
                var session = _sessionProvider();
                if (!UsableSession(session)) return;

                var clean = File.Exists(_cleanExitFile);
                TryDeleteCleanExitMarker();
                var checkpoint = ReadCheckpoint();
                if (!clean &&
                    checkpoint != DateTime.MinValue &&
                    _processStartedLocal - checkpoint > TimeSpan.FromSeconds(15))
                {
                    var recovered = SealFromCheckpoint("recovery", "RECOVERY_PREVIOUS_UNCLEAN=true");
                    if (!string.IsNullOrWhiteSpace(recovered))
                        _log("AGENT LOG recovery=SEALED previous_session_unclean=true");
                }

                TryFlushPending(session);
            }
            catch (Exception ex)
            {
                _log("AGENT LOG pending=DEFER type=" + ex.GetType().Name);
            }
        }

        internal void SealLogoutAndFlush(AgentSession session)
        {
            try
            {
                SealFromCheckpoint("session", "AGENT_SESSION_FINAL=true");
                if (UsableSession(session))
                    Task.Run(() => TryFlushPending(session));
            }
            catch (Exception ex)
            {
                _log("AGENT LOG logout_seal=DEFER type=" + ex.GetType().Name);
            }
        }

        internal void SealPlannedExit(string exitKind)
        {
            try
            {
                SealFromCheckpoint(
                    string.Equals(exitKind, "windows_shutdown", StringComparison.OrdinalIgnoreCase)
                        ? "session"
                        : "session",
                    "PROCESS_EXIT=" + AgentDiagnostics.Sanitize(exitKind ?? "planned"));
                var dir = Path.GetDirectoryName(_cleanExitFile);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(_cleanExitFile, DateTime.Now.ToString("O", CultureInfo.InvariantCulture), Encoding.ASCII);
            }
            catch { }
        }

        private string SealFromCheckpoint(string kind, string prefix)
        {
            lock (_sealGate)
            {
                var now = DateTime.Now;
                var since = ReadCheckpoint();
                if (since == DateTime.MinValue) since = _processStartedLocal;

                var content = AgentDiagnostics.BuildUploadSnapshot(since, string.Equals(kind, "crash", StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(prefix))
                    content = prefix + Environment.NewLine + content;
                content = AgentDiagnostics.SanitizeBundle(content);
                if (string.IsNullOrWhiteSpace(content))
                {
                    WriteCheckpoint(now);
                    return "";
                }

                Directory.CreateDirectory(_pendingDir);
                var normalizedKind = NormalizeKind(kind);
                var contentHash = Sha256Hex(content);
                var firstMs = new DateTimeOffset(since).ToUnixTimeMilliseconds();
                var lastMs = new DateTimeOffset(now).ToUnixTimeMilliseconds();
                var bundleId = Sha256Hex(
                    "AGENT|" + _instanceId + "|" + Environment.MachineName + "|" +
                    firstMs.ToString(CultureInfo.InvariantCulture) + "|" +
                    lastMs.ToString(CultureInfo.InvariantCulture) + "|" + contentHash);
                var filename = normalizedKind + "_agent_" + SafeSlug(Environment.MachineName) + "_" +
                               now.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture) + ".log";
                var pendingPath = Path.Combine(_pendingDir, bundleId + ".json");

                if (!File.Exists(pendingPath))
                {
                    var payload = new Dictionary<string, object>
                    {
                        { "schema_version", 1 },
                        { "bundle_id", bundleId },
                        { "source", "AGENT" },
                        { "kind", normalizedKind },
                        { "file_name", filename },
                        { "machine", Environment.MachineName },
                        { "agent_instance_id", _instanceId },
                        { "first_at_ms", firstMs },
                        { "last_at_ms", lastMs },
                        { "content_hash", contentHash },
                        { "content", content }
                    };
                    var temp = pendingPath + ".tmp";
                    File.WriteAllText(temp, _json.Serialize(payload), Encoding.UTF8);
                    if (File.Exists(pendingPath)) File.Delete(temp);
                    else File.Move(temp, pendingPath);
                }

                WriteCheckpoint(now);
                return pendingPath;
            }
        }

        private void TryFlushPending(AgentSession session)
        {
            if (!UsableSession(session)) return;
            string[] files;
            try
            {
                Directory.CreateDirectory(_pendingDir);
                files = Directory.GetFiles(_pendingDir, "*.json")
                    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                    .Take(24)
                    .ToArray();
            }
            catch { return; }

            foreach (var path in files)
            {
                try
                {
                    var raw = File.ReadAllText(path, Encoding.UTF8);
                    var bundle = _json.DeserializeObject(raw) as Dictionary<string, object>;
                    if (bundle == null) continue;
                    var uploaded = GatewayEnabled()
                        ? UploadGateway(session, bundle)
                        : UploadLegacyFirestore(session, bundle);
                    if (!uploaded) break;
                    File.Delete(path);
                    _log("AGENT LOG upload=PASS transport=" +
                         (GatewayEnabled() ? "GOOGLE_APPS_SCRIPT" : "FIRESTORE_D157_FALLBACK") +
                         " bundle=" + Short(Value(bundle, "bundle_id")));
                }
                catch (Exception ex)
                {
                    _log("AGENT LOG upload=DEFER transport=" +
                         (GatewayEnabled() ? "GOOGLE_APPS_SCRIPT" : "FIRESTORE_D157_FALLBACK") +
                         " type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                    break;
                }
            }
        }

        private bool UploadGateway(AgentSession session, Dictionary<string, object> bundle)
        {
            var url = (AgentConfig.AgentLogGatewayUrl ?? "").Trim();
            Uri parsed;
            if (!Uri.TryCreate(url, UriKind.Absolute, out parsed) ||
                !string.Equals(parsed.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
                return false;

            var body = new Dictionary<string, object>
            {
                { "action", "upload_agent_log" },
                { "id_token", session.IdToken ?? "" },
                { "bundle_id", Value(bundle, "bundle_id") },
                { "source", "AGENT" },
                { "kind", Value(bundle, "kind") },
                { "file_name", Value(bundle, "file_name") },
                { "machine", Value(bundle, "machine") },
                { "agent_instance_id", Value(bundle, "agent_instance_id") },
                { "first_at_ms", LongValue(bundle, "first_at_ms") },
                { "last_at_ms", LongValue(bundle, "last_at_ms") },
                { "content_hash", Value(bundle, "content_hash") },
                { "payload", Value(bundle, "content") }
            };
            var bytes = Encoding.UTF8.GetBytes(_json.Serialize(body));
            var request = (HttpWebRequest)WebRequest.Create(parsed);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D158";
            request.Timeout = 10000;
            request.ReadWriteTimeout = 10000;
            request.AllowAutoRedirect = true;
            request.ContentLength = bytes.Length;
            using (var stream = request.GetRequestStream())
                stream.Write(bytes, 0, bytes.Length);
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream(), Encoding.UTF8))
            {
                var text = reader.ReadToEnd();
                if ((int)response.StatusCode < 200 || (int)response.StatusCode >= 300) return false;
                var result = _json.DeserializeObject(text) as Dictionary<string, object>;
                object ok;
                return result != null && result.TryGetValue("ok", out ok) && Convert.ToBoolean(ok);
            }
        }

        private bool UploadLegacyFirestore(AgentSession session, Dictionary<string, object> bundle)
        {
            var safe = AgentDiagnostics.SanitizeBundle(Value(bundle, "content"));
            if (string.IsNullOrWhiteSpace(safe)) return true;

            var bundleId = Value(bundle, "bundle_id");
            var uploadId = string.IsNullOrWhiteSpace(bundleId)
                ? Guid.NewGuid().ToString("N")
                : bundleId.Substring(0, Math.Min(32, bundleId.Length));
            var chunks = Split(safe, MaxChunkChars);
            var kind = Value(bundle, "kind");
            var filename = Value(bundle, "file_name");
            var generatedAtMs = LongValue(bundle, "last_at_ms");
            var crash = string.Equals(kind, "crash", StringComparison.OrdinalIgnoreCase);

            for (var index = 0; index < chunks.Count; index++)
            {
                var docId = uploadId + "-" + index.ToString("D3", CultureInfo.InvariantCulture);
                var fields = new Dictionary<string, object>
                {
                    { "upload_id", StringField(uploadId) },
                    { "part_index", IntField(index) },
                    { "part_count", IntField(chunks.Count) },
                    { "status", StringField(index == chunks.Count - 1 ? "DIRECT_PENDING" : "DIRECT_PART") },
                    { "source", StringField("AGENT") },
                    { "admin_user_id", StringField(session.AppUserId ?? "") },
                    { "agent_instance_id", StringField(_instanceId) },
                    { "machine", StringField(Environment.MachineName) },
                    { "generated_at_ms", IntField(generatedAtMs) },
                    { "crash", BoolField(crash) },
                    { "filename", StringField(filename) },
                    { "content", StringField(chunks[index]) }
                };

                var firestoreUrl = AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                                   "/relay_agent_log_uploads/" + Uri.EscapeDataString(docId);
                FirestoreHttpTransport.SendJson(
                    "PATCH",
                    firestoreUrl,
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    "Agent-Auto-Confirm-Pick-Pack/D158",
                    10000,
                    false,
                    _log,
                    "AGENT_LOG_UPLOAD");
            }
            return true;
        }

        private bool GatewayEnabled()
        {
            var value = (AgentConfig.AgentLogGatewayUrl ?? "").Trim();
            Uri uri;
            return value.Length > 0 &&
                   value.IndexOf("__", StringComparison.Ordinal) < 0 &&
                   Uri.TryCreate(value, UriKind.Absolute, out uri) &&
                   string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
        }

        private long CurrentOpenLogBytes()
        {
            long total = 0L;
            try
            {
                foreach (var path in new[] { AgentDiagnostics.DiagnosticLogFile, AgentDiagnostics.RelayAuditLogFile })
                    if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
                        total += Math.Max(0L, new FileInfo(path).Length);
            }
            catch { }
            return total;
        }

        private AgentSession SafeSession()
        {
            try { return _sessionProvider(); } catch { return null; }
        }

        private static bool UsableSession(AgentSession session)
        {
            return session != null &&
                   !string.IsNullOrWhiteSpace(session.IdToken) &&
                   !string.IsNullOrWhiteSpace(session.AppUserId);
        }

        private void TryDeleteCleanExitMarker()
        {
            try { if (File.Exists(_cleanExitFile)) File.Delete(_cleanExitFile); } catch { }
        }

        private static string NormalizeKind(string kind)
        {
            var value = (kind ?? "").Trim().ToLowerInvariant();
            if (value == "crash" || value == "error" || value == "recovery" ||
                value == "manual" || value == "session" || value == "checkpoint")
                return value;
            return "checkpoint";
        }

        private static string ErrorFingerprint(string value)
        {
            var next = AgentDiagnostics.Sanitize(value ?? "UNKNOWN").ToUpperInvariant();
            next = ErrorGuidPattern.Replace(next, "{GUID}");
            next = ErrorHexPattern.Replace(next, "{HEX}");
            next = ErrorNumberPattern.Replace(next, "{N}");
            next = ErrorSpacePattern.Replace(next, " ").Trim();
            if (next.Length == 0) next = "UNKNOWN";
            return next.Length <= 320 ? next : next.Substring(0, 320);
        }

        private DateTime ReadCheckpoint()
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_checkpointFile) || !File.Exists(_checkpointFile)) return DateTime.MinValue;
                DateTime value;
                return DateTime.TryParseExact(
                    File.ReadAllText(_checkpointFile).Trim(),
                    "O",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out value) ? value : DateTime.MinValue;
            }
            catch { return DateTime.MinValue; }
        }

        private void WriteCheckpoint(DateTime value)
        {
            try
            {
                var dir = Path.GetDirectoryName(_checkpointFile);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                var temp = _checkpointFile + ".tmp";
                File.WriteAllText(temp, value.ToString("O", CultureInfo.InvariantCulture), Encoding.ASCII);
                if (File.Exists(_checkpointFile)) File.Delete(_checkpointFile);
                File.Move(temp, _checkpointFile);
            }
            catch { }
        }

        private static List<string> Split(string value, int size)
        {
            var result = new List<string>();
            if (string.IsNullOrEmpty(value))
            {
                result.Add("");
                return result;
            }
            for (var offset = 0; offset < value.Length; offset += size)
                result.Add(value.Substring(offset, Math.Min(size, value.Length - offset)));
            return result;
        }

        private static string Sha256Hex(string value)
        {
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? ""));
                var builder = new StringBuilder(hash.Length * 2);
                foreach (var b in hash) builder.Append(b.ToString("x2", CultureInfo.InvariantCulture));
                return builder.ToString();
            }
        }

        private static string Value(Dictionary<string, object> map, string key)
        {
            object value;
            return map != null && map.TryGetValue(key, out value) ? Convert.ToString(value, CultureInfo.InvariantCulture) ?? "" : "";
        }

        private static long LongValue(Dictionary<string, object> map, string key)
        {
            long value;
            return long.TryParse(Value(map, key), NumberStyles.Integer, CultureInfo.InvariantCulture, out value) ? value : 0L;
        }

        private static string SafeSlug(string value)
        {
            var next = new StringBuilder();
            foreach (var ch in value ?? "")
                next.Append(char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-');
            var result = next.ToString().Trim('-');
            return string.IsNullOrWhiteSpace(result) ? "agent" : result.Substring(0, Math.Min(48, result.Length));
        }

        private static string Short(string value)
        {
            var next = value ?? "";
            return next.Length <= 12 ? next : next.Substring(0, 12);
        }

        private static Dictionary<string, object> StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString(CultureInfo.InvariantCulture) } };
        }

        private static Dictionary<string, object> BoolField(bool value)
        {
            return new Dictionary<string, object> { { "booleanValue", value } };
        }
    }
}
