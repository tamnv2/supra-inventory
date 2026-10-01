using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Web.Script.Serialization;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly object _d160WorkerRevokeGate = new object();
        private long _d160WorkerRevokeCircuitUntilMs;

        private bool TryRevokePickerWorkerSessionD160(AgentSession session, PickerPresenceView picker)
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            lock (_d160WorkerRevokeGate)
            {
                if (_d160WorkerRevokeCircuitUntilMs > now)
                {
                    Log("PICKER_SESSION server_revoke=DEFERRED reason=D160_401_CIRCUIT_OPEN remaining_ms=" +
                        Math.Max(0L, _d160WorkerRevokeCircuitUntilMs - now));
                    return false;
                }
            }

            int status;
            string code;
            if (TryD160WorkerRevokeOnce(session, picker, out status, out code))
                return true;

            if (status == 401)
            {
                try
                {
                    EnsureFreshToken();
                    session = SnapshotSession();
                }
                catch (Exception ex)
                {
                    Log("PICKER_SESSION server_revoke=DEFERRED reason=D160_TOKEN_REFRESH_" + ex.GetType().Name);
                    return false;
                }

                if (TryD160WorkerRevokeOnce(session, picker, out status, out code))
                {
                    Log("PICKER_SESSION server_revoke=RECOVERED after=TOKEN_REFRESH");
                    return true;
                }

                if (status == 401)
                {
                    lock (_d160WorkerRevokeGate)
                        _d160WorkerRevokeCircuitUntilMs =
                            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 60000L;
                    Log("PICKER_SESSION server_revoke=DEFERRED reason=D160_401_AFTER_REFRESH circuit_ms=60000 code=" +
                        AgentDiagnostics.Sanitize(code));
                    return false;
                }
            }

            Log("PICKER_SESSION server_revoke=DEFERRED status=" + status.ToString(CultureInfo.InvariantCulture) +
                " code=" + AgentDiagnostics.Sanitize(code));
            return false;
        }

        private bool TryD160WorkerRevokeOnce(
            AgentSession session,
            PickerPresenceView picker,
            out int status,
            out string code)
        {
            status = 0;
            code = "";
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(
                    AgentConfig.ApiBaseUrl.TrimEnd('/') + "/api/agent/picker-session/revoke");
                request.Method = "POST";
                request.Accept = "application/json";
                request.ContentType = "application/json; charset=utf-8";
                request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D160";
                request.Timeout = 5000;
                request.ReadWriteTimeout = 5000;
                request.KeepAlive = false;
                request.Headers[HttpRequestHeader.Authorization] = "Bearer " + (session == null ? "" : session.IdToken);
                var body = new JavaScriptSerializer().Serialize(new Dictionary<string, object>
                {
                    { "user_id", picker == null ? "" : (picker.UserId ?? "") },
                    { "firebase_uid", picker == null ? "" : (picker.FirebaseUid ?? "") },
                    { "revoked_generation", picker == null ? 1L : Math.Max(1L, picker.SessionGeneration) }
                });
                var bytes = Encoding.UTF8.GetBytes(body);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
                using (var response = (HttpWebResponse)request.GetResponse())
                using (var input = response.GetResponseStream())
                using (var reader = input == null ? null : new StreamReader(input))
                {
                    status = (int)response.StatusCode;
                    if (reader != null) reader.ReadToEnd();
                    return status >= 200 && status < 300;
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                status = response == null ? 0 : (int)response.StatusCode;
                try
                {
                    if (response != null)
                    {
                        using (response)
                        using (var input = response.GetResponseStream())
                        using (var reader = input == null ? null : new StreamReader(input))
                        {
                            var raw = reader == null ? "" : reader.ReadToEnd();
                            code = D160SafeServiceErrorCode(raw);
                        }
                    }
                }
                catch { code = ""; }
                if (string.IsNullOrWhiteSpace(code))
                    code = status == 0 ? ex.GetType().Name : "HTTP_" + status.ToString(CultureInfo.InvariantCulture);
                return false;
            }
            catch (Exception ex)
            {
                code = ex.GetType().Name;
                return false;
            }
        }

        private static string D160SafeServiceErrorCode(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";
            try
            {
                var map = new JavaScriptSerializer().DeserializeObject(raw) as Dictionary<string, object>;
                object value;
                if (map != null && map.TryGetValue("error", out value) && value != null)
                {
                    var code = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
                    var safe = new StringBuilder();
                    foreach (var ch in code)
                        if (char.IsLetterOrDigit(ch) || ch == '_' || ch == '-' || ch == '.')
                            safe.Append(ch);
                    return safe.ToString().Substring(0, Math.Min(80, safe.Length));
                }
            }
            catch { }
            return "";
        }
    }
}
