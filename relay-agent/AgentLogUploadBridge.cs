using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
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

                var content = AgentDiagnostics.BuildUploadSnapshot(checkpoint == DateTime.MinValue ? slot.AddHours(-6) : checkpoint, false);
                if (string.IsNullOrWhiteSpace(content))
                {
                    WriteCheckpoint(slot);
                    return;
                }

                Queue(session, slot, false, content);
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
                Queue(session, DateTime.Now, true, content);
                _log("AGENT LOG queue=PASS type=crash");
            }
            catch
            {
                PersistCrashPending(crashType);
            }
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

                Queue(session, DateTime.Now, true, content);
                File.Delete(pending);
                _log("AGENT LOG pending-crash=FLUSHED");
            }
            catch (Exception ex)
            {
                _log("AGENT LOG pending-crash=DEFER type=" + ex.GetType().Name);
            }
        }

        private void Queue(AgentSession session, DateTime generatedLocal, bool crash, string content)
        {
            var safe = AgentDiagnostics.Sanitize(content);
            if (string.IsNullOrWhiteSpace(safe)) return;

            var uploadId = Guid.NewGuid().ToString("N");
            var chunks = Split(safe, MaxChunkChars);
            var filename = (crash ? "crash_" : "") +
                           "agent_" + SafeSlug(Environment.MachineName) + "_" +
                           generatedLocal.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture) + ".log";
            var generatedAtMs = new DateTimeOffset(generatedLocal).ToUnixTimeMilliseconds();

            for (var index = 0; index < chunks.Count; index++)
            {
                var docId = uploadId + "-" + index.ToString("D3", CultureInfo.InvariantCulture);
                var fields = new Dictionary<string, object>
                {
                    { "upload_id", StringField(uploadId) },
                    { "part_index", IntField(index) },
                    { "part_count", IntField(chunks.Count) },
                    { "status", StringField("PENDING") },
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
            var slots = new[] { 0, 6, 12, 18 };
            var hour = 0;
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
