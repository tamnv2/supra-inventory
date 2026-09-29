using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed class AgentLogUploadBridge
    {
        private const int MaxChunkChars = 320000;
        private readonly JavaScriptSerializer _json = new JavaScriptSerializer();
        private readonly Func<AgentSession> _sessionProvider;
        private readonly string _instanceId;
        private readonly string _checkpointFile;
        private readonly Action<string> _log;
        private readonly object _errorGate = new object();
        private readonly Dictionary<string, ErrorBurstState> _errorBursts =
            new Dictionary<string, ErrorBurstState>(StringComparer.Ordinal);
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

        internal AgentLogUploadBridge(Func<AgentSession> sessionProvider, string instanceId, string checkpointFile, Action<string> log)
        {
            _sessionProvider = sessionProvider;
            _instanceId = instanceId ?? "";
            _checkpointFile = checkpointFile ?? "";
            _log = log ?? delegate { };
        }

        internal void TryQueueScheduledSnapshot()
        {
            try
            {
                var session = _sessionProvider();
                if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || string.IsNullOrWhiteSpace(session.AppUserId))
                    return;

                var now = DateTime.Now;
                var slot = ResolveLatestSlot(now);
                if (slot == DateTime.MinValue) return;
                var checkpoint = ReadCheckpoint();
                if (checkpoint >= slot) return;

                var content = AgentDiagnostics.BuildUploadSnapshot(checkpoint == DateTime.MinValue ? slot.AddHours(-9) : checkpoint, false);
                if (string.IsNullOrWhiteSpace(content))
                {
                    WriteCheckpoint(slot);
                    return;
                }

                Queue(session, slot, "scheduled", content);
                WriteCheckpoint(slot);
                _log("AGENT LOG queue=PASS type=scheduled slot=" + slot.ToString("yyyyMMdd-HHmm", CultureInfo.InvariantCulture));
            }
            catch (Exception ex)
            {
                _log("AGENT LOG queue=DEFER type=scheduled error=" + ex.GetType().Name +
                     " detail=" + AgentDiagnostics.Sanitize(ex.Message));
            }
        }

        internal void TryQueueCrashSnapshot(string crashType)
        {
            try
            {
                var session = _sessionProvider();
                if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || string.IsNullOrWhiteSpace(session.AppUserId))
                {
                    PersistCrashPending(crashType);
                    return;
                }

                var content = AgentDiagnostics.BuildUploadSnapshot(DateTime.Now.AddHours(-2), true);
                if (string.IsNullOrWhiteSpace(content)) return;
                Queue(session, DateTime.Now, "crash", content);
                _log("AGENT LOG queue=PASS type=crash");
            }
            catch
            {
                PersistCrashPending(crashType);
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
                var session = _sessionProvider();
                if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || string.IsNullOrWhiteSpace(session.AppUserId))
                    return;
                var content = AgentDiagnostics.BuildUploadSnapshot(DateTime.Now.AddMinutes(-30), true);
                if (string.IsNullOrWhiteSpace(content)) return;
                content = "ERROR_MARKER=" + AgentDiagnostics.Sanitize(errorType ?? "UNKNOWN") + Environment.NewLine +
                          "ERROR_FINGERPRINT=" + fingerprint + Environment.NewLine +
                          "REPEAT_SUPPRESSED_SINCE_LAST_SEND=" + suppressed.ToString(CultureInfo.InvariantCulture) + Environment.NewLine +
                          content;
                Queue(session, DateTime.Now, "error", content);
                _log("AGENT LOG queue=PASS type=error suppressed=" + suppressed);
            }
            catch (Exception ex)
            {
                _log("AGENT LOG queue=DEFER type=error detail=" + ex.GetType().Name);
            }
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

        internal void TryFlushPendingCrash()
        {
            try
            {
                var pending = PendingCrashFile();
                if (!File.Exists(pending)) return;
                var session = _sessionProvider();
                if (session == null || string.IsNullOrWhiteSpace(session.IdToken) || string.IsNullOrWhiteSpace(session.AppUserId))
                    return;

                var marker = File.ReadAllText(pending, Encoding.UTF8);
                var content = AgentDiagnostics.BuildUploadSnapshot(DateTime.Now.AddHours(-6), true);
                if (!string.IsNullOrWhiteSpace(marker))
                    content = "CRASH_MARKER=" + AgentDiagnostics.Sanitize(marker) + Environment.NewLine + content;
                if (string.IsNullOrWhiteSpace(content)) return;

                Queue(session, DateTime.Now, "crash", content);
                File.Delete(pending);
                _log("AGENT LOG pending-crash=FLUSHED");
            }
            catch (Exception ex)
            {
                _log("AGENT LOG pending-crash=DEFER type=" + ex.GetType().Name);
            }
        }

        private void Queue(AgentSession session, DateTime generatedLocal, string kind, string content)
        {
            var safe = AgentDiagnostics.SanitizeBundle(content);
            if (string.IsNullOrWhiteSpace(safe)) return;

            var uploadId = Guid.NewGuid().ToString("N");
            var chunks = Split(safe, MaxChunkChars);
            var normalizedKind = string.Equals(kind, "crash", StringComparison.OrdinalIgnoreCase)
                ? "crash"
                : (string.Equals(kind, "error", StringComparison.OrdinalIgnoreCase) ? "error" : "scheduled");
            var filename = normalizedKind + "_agent_" + SafeSlug(Environment.MachineName) + "_" +
                           generatedLocal.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture) + ".log";
            var generatedAtMs = new DateTimeOffset(generatedLocal).ToUnixTimeMilliseconds();
            var crash = normalizedKind == "crash";

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

                var url = AgentConfig.FirestoreDocumentsBaseUrl.TrimEnd('/') +
                          "/relay_agent_log_uploads/" + Uri.EscapeDataString(docId);
                FirestoreHttpTransport.SendJson(
                    "PATCH",
                    url,
                    session.IdToken,
                    _json.Serialize(new Dictionary<string, object> { { "fields", fields } }),
                    "Agent-Auto-Confirm-Pick-Pack/D101",
                    10000,
                    false,
                    _log,
                    "AGENT_LOG_UPLOAD");
            }
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

        private static DateTime ResolveLatestSlot(DateTime now)
        {
            if (now.Hour < 6) return DateTime.MinValue;
            var slots = new[] { 6, 12, 18, 21 };
            var hour = 6;
            foreach (var candidate in slots)
                if (candidate <= now.Hour) hour = candidate;
            return new DateTime(now.Year, now.Month, now.Day, hour, 0, 0, DateTimeKind.Local);
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
                File.WriteAllText(_checkpointFile, value.ToString("O", CultureInfo.InvariantCulture), Encoding.ASCII);
            }
            catch { }
        }

        private void PersistCrashPending(string crashType)
        {
            try
            {
                var path = PendingCrashFile();
                var dir = Path.GetDirectoryName(path);
                if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(
                    path,
                    DateTime.Now.ToString("O", CultureInfo.InvariantCulture) + " " + AgentDiagnostics.Sanitize(crashType ?? "UNKNOWN"),
                    Encoding.UTF8);
            }
            catch { }
        }

        private string PendingCrashFile()
        {
            var dir = Path.GetDirectoryName(_checkpointFile);
            return Path.Combine(string.IsNullOrWhiteSpace(dir) ? AppDomain.CurrentDomain.BaseDirectory : dir, "crash-upload.pending");
        }

        private static string SafeSlug(string value)
        {
            var next = new StringBuilder();
            foreach (var ch in value ?? "")
                next.Append(char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '-');
            var result = next.ToString().Trim('-');
            return string.IsNullOrWhiteSpace(result) ? "agent" : result.Substring(0, Math.Min(48, result.Length));
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
