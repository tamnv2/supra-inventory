using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
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
        private readonly HashSet<string> _firestoreStagedBundles =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, ErrorBurstState> _errorBursts =
            new Dictionary<string, ErrorBurstState>(StringComparer.Ordinal);
        private readonly DateTime _processStartedLocal = DateTime.Now;
        private long _lastSealWrittenBytes;
        private DateTime _nextUploadAttemptUtc = DateTime.MinValue;
        private int _uploadInFlight;
        private int _uploadFailureStreak;
        private DateTime _lastUploadSuccessLocal = DateTime.MinValue;
        private DateTime _last2145BoundaryLocal = DateTime.MinValue;
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
            internal bool IncidentOpen;
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
            if (ReadCheckpoint() == DateTime.MinValue) WriteCheckpoint(FloorToLogMillisecond(_processStartedLocal));
            _lastSealWrittenBytes = AgentDiagnostics.TotalBytesWritten;
        }

        // D168: local diagnostics are retained between explicit delivery boundaries.
        // The one daily automatic upload is 21:45 local VN time. There is no
        // size/6-hour/incident flush and no retry timer after a failed send.
        internal void TryQueueScheduledSnapshot()
        {
            try
            {
                var now=DateTime.Now;
                if(now.Hour<21 || (now.Hour==21 && now.Minute<45) ||
                    _last2145BoundaryLocal==now.Date)return;
                _last2145BoundaryLocal=now.Date; // one attempt, even on failure
                var path=SealFromCheckpoint("checkpoint","SCHEDULE_BOUNDARY=21:45 BOUNDARY_2145");
                var session=SafeSession();
                if(UsableSession(session))TryFlushPending(session);
                _log("AGENT LOG daily_2145="+(string.IsNullOrWhiteSpace(path)?"EMPTY":"SEALED")+
                    " upload="+(UsableSession(session)?"ATTEMPT_ONCE":"LOCAL_PENDING"));
            }
            catch(Exception ex){_log("AGENT LOG daily_2145=LOCAL_PENDING type="+ex.GetType().Name);}
        }

        internal void TryQueueManualSnapshot()
        {
            try
            {
                var path = SealFromCheckpoint("manual", "MANUAL_SEND=true");
                var session = SafeSession();
                if (UsableSession(session)) TryFlushPending(session);
                _log(string.IsNullOrWhiteSpace(path)
                    ? "AGENT LOG manual=SKIP_EMPTY"
                    : "AGENT LOG manual=SEALED upload=" + (UsableSession(session) ? "TRY" : "LOCAL_PENDING"));
            }
            catch (Exception ex)
            {
                _log("AGENT LOG manual=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        internal void TryQueueGlobalSupportSnapshot(string requestId, string traceId)
        {
            try
            {
                var safeRequest = AgentDiagnostics.Sanitize(requestId ?? "");
                var safeTrace = AgentDiagnostics.Sanitize(traceId ?? "");
                var marker =
                    "GLOBAL_SUPPORT_REQUEST_ID=" + safeRequest + Environment.NewLine +
                    "TRACE_ID=" + safeTrace;
                var path = SealFromCheckpoint("manual", marker);
                var session = SafeSession();
                if (UsableSession(session)) TryFlushPending(session);
                _log(string.IsNullOrWhiteSpace(path)
                    ? "AGENT LOG global_support=SKIP_EMPTY request=" + safeRequest
                    : "AGENT LOG global_support=SEALED request=" + safeRequest +
                      " upload=" + (UsableSession(session) ? "TRY" : "LOCAL_PENDING"));
            }
            catch (Exception ex)
            {
                _log("AGENT LOG global_support=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        internal void TryQueueBoundarySnapshot(string reason)
        {
            try
            {
                var marker = "BOUNDARY_EVENT=" + AgentDiagnostics.Sanitize(reason ?? "UNKNOWN");
                var path = SealFromCheckpoint("checkpoint", marker);
                var session = SafeSession();
                _log(string.IsNullOrWhiteSpace(path)
                    ? "AGENT LOG boundary=SKIP_EMPTY reason=" + AgentDiagnostics.Sanitize(reason ?? "UNKNOWN")
                    : "AGENT LOG boundary=SEALED reason=" + AgentDiagnostics.Sanitize(reason ?? "UNKNOWN"));
            }
            catch (Exception ex)
            {
                _log("AGENT LOG boundary=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        internal void ConfirmFallbackDriveSynced(string uploadId, string agentInstanceId)
        {
            var safeUpload = (uploadId ?? "").Trim();
            if (safeUpload.Length < 12 || safeUpload.Length > 64) return;
            if (!string.Equals((agentInstanceId ?? "").Trim(), _instanceId, StringComparison.Ordinal)) return;

            try
            {
                Directory.CreateDirectory(_pendingDir);
                var matches = Directory.GetFiles(_pendingDir, safeUpload + "*.json")
                    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                foreach (var path in matches)
                {
                    var raw = File.ReadAllText(path, Encoding.UTF8);
                    var bundle = _json.DeserializeObject(raw) as Dictionary<string, object>;
                    var bundleId = Value(bundle, "bundle_id");
                    if (string.IsNullOrWhiteSpace(bundleId) ||
                        !bundleId.StartsWith(safeUpload, StringComparison.OrdinalIgnoreCase))
                        continue;

                    var uploadedThroughMs = LongValue(bundle, "last_at_ms");
                    File.Delete(path);
                    lock (_sealGate) _firestoreStagedBundles.Remove(bundleId);
                    if (uploadedThroughMs > 0)
                    {
                        var cutoff = DateTimeOffset.FromUnixTimeMilliseconds(uploadedThroughMs).LocalDateTime;
                        var removed = AgentDiagnostics.PruneUploadedThrough(cutoff);
                        _lastUploadSuccessLocal = DateTime.Now;
                        _lastSealWrittenBytes = AgentDiagnostics.TotalBytesWritten;
                        _log("AGENT LOG local_prune=PASS drive_confirmed=true transport=FIRESTORE_FALLBACK removed_lines=" +
                             removed.ToString(CultureInfo.InvariantCulture));
                    }
                    _log("AGENT LOG fallback_receipt=DRIVE_SYNCED upload=" + Short(safeUpload));
                    break;
                }
            }
            catch (Exception ex)
            {
                _log("AGENT LOG fallback_receipt=DEFER type=" + ex.GetType().Name);
            }
        }

        internal string StatusSummary()
        {
            var pending = 0;
            try
            {
                if (Directory.Exists(_pendingDir))
                    pending = Directory.GetFiles(_pendingDir, "*.json").Length;
            }
            catch { }
            var last = _lastUploadSuccessLocal == DateTime.MinValue
                ? "chưa có trong phiên"
                : _lastUploadSuccessLocal.ToString("HH:mm:ss dd/MM", CultureInfo.GetCultureInfo("vi-VN"));
            return "File: agent-complete.log · gói chờ: " +
                pending.ToString(CultureInfo.InvariantCulture) +
                " · gửi Drive gần nhất: " + last;
        }

        internal void TryQueueCrashSnapshot(string crashType)
        {
            try
            {
                TryDeleteCleanExitMarker();
                var marker = "CRASH_MARKER=" + AgentDiagnostics.Sanitize(crashType ?? "UNKNOWN");
                var path = SealFromCheckpoint("crash", marker);
                var session = SafeSession();
                // Crash is persisted locally; next 21:45/manual/global delivery owns network I/O.
                if (!string.IsNullOrWhiteSpace(path)) _log("AGENT LOG seal=PASS type=crash local_only=true");
            }
            catch (Exception ex)
            {
                _log("AGENT LOG crash=LOCAL_PENDING type=" + ex.GetType().Name);
            }
        }

        internal void TryQueueErrorSnapshot(string errorType)
        {
            // Original diagnostic event already exists in agent-complete.log.
            // Do not create an upload bundle or trigger provider I/O on an error.
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

                // Recovery is local-only until the next explicit send boundary.
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
                // Agent logout does not upload; the daily/manual/global request does.
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
                // Local log lines are timestamped to millisecond precision. Use an
                // exact millisecond boundary and a half-open [since, until) range so
                // concurrent writes cannot be captured by two sealed bundles or lost
                // between the snapshot and checkpoint update.
                var now = FloorToLogMillisecond(DateTime.Now);
                var since = ReadCheckpoint();
                if (since == DateTime.MinValue) since = FloorToLogMillisecond(_processStartedLocal);

                var content = AgentDiagnostics.BuildUploadSnapshot(
                    since,
                    now,
                    string.Equals(kind, "crash", StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrWhiteSpace(prefix))
                    content = prefix + Environment.NewLine + content;
                content = AgentDiagnostics.SanitizeBundle(content);
                // D166 log-only audit: attach local estimates to an already-sealed upload.
                // No extra logging timer, Firestore operation or Drive artifact is created.
                if (!string.IsNullOrWhiteSpace(content))
                {
                    try { content = FirestoreQuotaGuard.SnapshotUsageAudit() + Environment.NewLine + content; }
                    catch { /* never block or change normal log sealing */ }
                }
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
                        { "schema_version", 2 },
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
                _lastSealWrittenBytes = AgentDiagnostics.TotalBytesWritten;
                return pendingPath;
            }
        }

        private long PendingBoundary(string path, string field)
        {
            try
            {
                var raw = File.ReadAllText(path, Encoding.UTF8);
                var bundle = _json.DeserializeObject(raw) as Dictionary<string, object>;
                return LongValue(bundle, field);
            }
            catch
            {
                return 0L;
            }
        }

        private void TryFlushPending(AgentSession session)
        {
            if (!UsableSession(session)) return;
            if (Interlocked.CompareExchange(ref _uploadInFlight,1,0)!=0) return;
            try
            {
            // No timed retry: callers invoke this only at a permitted delivery event.
            string[] files;
            try
            {
                Directory.CreateDirectory(_pendingDir);
                files = Directory.GetFiles(_pendingDir, "*.json")
                    .Select(path => new
                    {
                        Path = path,
                        FirstAtMs = PendingBoundary(path, "first_at_ms"),
                        LastAtMs = PendingBoundary(path, "last_at_ms")
                    })
                    .OrderBy(item => item.FirstAtMs <= 0 ? 0L : item.FirstAtMs)
                    .ThenBy(item => item.LastAtMs <= 0 ? long.MaxValue : item.LastAtMs)
                    .ThenBy(item => item.Path, StringComparer.OrdinalIgnoreCase)
                    .Take(24)
                    .Select(item => item.Path)
                    .ToArray();
            }
            catch { return; }

            foreach (var path in files)
            {
                try
                {
                    var raw = File.ReadAllText(path, Encoding.UTF8);
                    var bundle = _json.DeserializeObject(raw) as Dictionary<string, object>;
                    var firstMs = LongValue(bundle, "first_at_ms");
                    var lastMs = LongValue(bundle, "last_at_ms");
                    if (bundle == null || firstMs <= 0 || lastMs <= 0 || lastMs < firstMs)
                    {
                        RegisterUploadFailure();
                        _log("AGENT LOG upload=BLOCKED_INVALID_PENDING_METADATA retry_after=" +
                             _nextUploadAttemptUtc.ToString("O", CultureInfo.InvariantCulture));
                        break;
                    }
                    var gateway = GatewayEnabled();
                    if (!gateway)
                    {
                        var bundleId = Value(bundle, "bundle_id");
                        var staged = false;
                        lock (_sealGate) staged = _firestoreStagedBundles.Contains(bundleId);
                        if (!staged)
                        {
                            if (!UploadLegacyFirestore(session, bundle))
                            {
                                RegisterUploadFailure();
                                break;
                            }
                            lock (_sealGate) _firestoreStagedBundles.Add(bundleId);
                            _log("AGENT LOG upload=STAGED transport=FIRESTORE_D157_FALLBACK drive_confirmed=false bundle=" +
                                 Short(bundleId));
                        }
                        // Firestore acceptance is staging only. Keep the local pending
                        // bundle until the existing handoff listener receives a
                        // DRIVE_SYNCED receipt from Google Function/Worker.
                        continue;
                    }

                    if (!UploadGateway(session, bundle))
                    {
                        RegisterUploadFailure();
                        break;
                    }
                    _uploadFailureStreak = 0;
                    _nextUploadAttemptUtc = DateTime.MinValue;
                    File.Delete(path);
                    try
                    {
                        var uploadedThroughMs = LongValue(bundle, "last_at_ms");
                        if (uploadedThroughMs > 0)
                        {
                            var cutoff = DateTimeOffset.FromUnixTimeMilliseconds(uploadedThroughMs).LocalDateTime;
                            var removed = AgentDiagnostics.PruneUploadedThrough(cutoff);
                            _lastUploadSuccessLocal = DateTime.Now;
                            _lastSealWrittenBytes = AgentDiagnostics.TotalBytesWritten;
                            _log("AGENT LOG local_prune=PASS drive_confirmed=true removed_lines=" +
                                 removed.ToString(CultureInfo.InvariantCulture));
                        }
                    }
                    catch (Exception pruneEx)
                    {
                        _log("AGENT LOG local_prune=DEFER type=" + pruneEx.GetType().Name);
                    }
                    _log("AGENT LOG upload=PASS transport=GOOGLE_APPS_SCRIPT bundle=" +
                         Short(Value(bundle, "bundle_id")));
                }
                catch (Exception ex)
                {
                    RegisterUploadFailure();
                    _log("AGENT LOG upload=DEFER transport=" +
                         (GatewayEnabled() ? "GOOGLE_APPS_SCRIPT" : "FIRESTORE_D157_FALLBACK") +
                         " type=" + ex.GetType().Name +
                         " detail=" + AgentDiagnostics.Sanitize(ex.Message) +
                         " retry_after=" + _nextUploadAttemptUtc.ToString("O", CultureInfo.InvariantCulture));
                    break;
                }
            }
            }
            finally { Interlocked.Exchange(ref _uploadInFlight,0); }
        }

        private void RegisterUploadFailure()
        {
            // Failure remains on disk until the next 21:45/manual/support request.
            _uploadFailureStreak=Math.Min(8,_uploadFailureStreak+1);
            _nextUploadAttemptUtc=DateTime.MinValue;
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
            request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D161";
            // Apps Script may wait up to 15s for its Drive lock before writing.
            request.Timeout = 35000;
            request.ReadWriteTimeout = 35000;
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
                object driveSynced;
                var accepted = result != null &&
                    result.TryGetValue("ok", out ok) &&
                    Convert.ToBoolean(ok);
                var confirmed = accepted &&
                    result.TryGetValue("drive_synced", out driveSynced) &&
                    Convert.ToBoolean(driveSynced);
                if (accepted && !confirmed)
                    _log("AGENT LOG upload=DEFER reason=DRIVE_CONFIRMATION_MISSING");
                return confirmed;
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

        internal void ObserveDiagnostic(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            var upper = AgentDiagnostics.Sanitize(message).ToUpperInvariant();
            var recovered =
                upper.Contains("FIRESTORE CONFIRM POLL=PASS") ||
                upper.Contains("D157 FAST_PATH LISTEN=CONNECTED") ||
                upper.Contains("FIRESTORE ACK PASS") ||
                upper.Contains("AGENT LOG UPLOAD=PASS TRANSPORT=GOOGLE_APPS_SCRIPT");
            if (!recovered) return;

            var closed = false;
            var suppressed = 0;
            lock (_errorGate)
            {
                ErrorBurstState state;
                if (_errorBursts.TryGetValue("GOOGLE_CONNECTIVITY", out state) && state.IncidentOpen)
                {
                    state.IncidentOpen = false;
                    suppressed = state.Suppressed;
                    state.Suppressed = 0;
                    // Recovery explicitly ends the incident. A later outage is a
                    // new incident even inside the normal 10-minute fingerprint window.
                    state.LastSentUtc = DateTime.MinValue;
                    closed = true;
                }
            }
            if (closed)
                _log("AGENT LOG incident=RECOVERED kind=GOOGLE_CONNECTIVITY suppressed=" +
                     suppressed.ToString(CultureInfo.InvariantCulture));
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
            if (next.Contains("NAMERESOLUTIONFAILURE") ||
                next.Contains("REMOTE NAME COULD NOT BE RESOLVED") ||
                next.Contains("WEB_EXCEPTION=TIMEOUT") ||
                next.Contains("OPERATION HAS TIMED OUT") ||
                next.Contains("WEB_EXCEPTION=RECEIVEFAILURE"))
                return "GOOGLE_CONNECTIVITY";

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

        private static DateTime FloorToLogMillisecond(DateTime value)
        {
            var ticks = value.Ticks - (value.Ticks % TimeSpan.TicksPerMillisecond);
            return new DateTime(ticks, value.Kind);
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
