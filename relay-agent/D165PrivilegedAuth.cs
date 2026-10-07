using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Button _d165SendAuthCode = new Button();

        private static bool IsD165OneTimeAgentLogin(string value)
        {
            var login = CleanAgentUsername(value).Trim().ToLowerInvariant();
            return login == "admin" || login == "tamnv2";
        }

        private bool D165GatewayConfigured()
        {
            var url = AgentConfig.AgentLogGatewayUrl ?? "";
            return url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
                   url.IndexOf("__", StringComparison.Ordinal) < 0;
        }

        private Dictionary<string, object> D165PostJson(
            string url,
            Dictionary<string, object> payload,
            string bearerToken,
            out int status)
        {
            status = 0;
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "POST";
                request.Accept = "application/json";
                request.ContentType = "application/json; charset=utf-8";
                request.UserAgent = "SUPRA-Inventory-Agent/D165";
                request.Timeout = 10000;
                request.ReadWriteTimeout = 10000;
                request.KeepAlive = false;
                if (!string.IsNullOrWhiteSpace(bearerToken))
                    request.Headers[HttpRequestHeader.Authorization] = "Bearer " + bearerToken;

                var json = _json.Serialize(payload ?? new Dictionary<string, object>());
                var bytes = Encoding.UTF8.GetBytes(json);
                request.ContentLength = bytes.Length;
                using (var output = request.GetRequestStream())
                    output.Write(bytes, 0, bytes.Length);

                using (var response = (HttpWebResponse)request.GetResponse())
                using (var input = response.GetResponseStream())
                using (var reader = input == null ? null : new StreamReader(input))
                {
                    status = (int)response.StatusCode;
                    var body = reader == null ? "{}" : reader.ReadToEnd();
                    return Map(_json.DeserializeObject(body));
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response == null) throw;
                status = (int)response.StatusCode;
                try
                {
                    using (response)
                    using (var input = response.GetResponseStream())
                    using (var reader = input == null ? null : new StreamReader(input))
                    {
                        var body = reader == null ? "{}" : reader.ReadToEnd();
                        return Map(_json.DeserializeObject(body));
                    }
                }
                catch
                {
                    return new Dictionary<string, object>(StringComparer.Ordinal);
                }
            }
        }

        private Dictionary<string, object> D165PostThroughGateway(
            string action,
            Dictionary<string, object> fields,
            out int status)
        {
            if (!D165GatewayConfigured()) throw new InvalidOperationException("Agent Operations Gateway chưa sẵn sàng.");
            var payload = new Dictionary<string, object>(StringComparer.Ordinal)
            {
                { "action", action }
            };
            if (fields != null)
            {
                foreach (var row in fields) payload[row.Key] = row.Value;
            }
            return D165PostJson(AgentConfig.AgentLogGatewayUrl, payload, "", out status);
        }

        private Dictionary<string, object> D165GatewayFirst(
            string action,
            string workerPath,
            Dictionary<string, object> fields,
            string bearerToken,
            out int status)
        {
            Exception gatewayError = null;
            if (D165GatewayConfigured())
            {
                try
                {
                    var gatewayFields = new Dictionary<string, object>(fields ?? new Dictionary<string, object>());
                    if (!string.IsNullOrWhiteSpace(bearerToken)) gatewayFields["id_token"] = bearerToken;
                    var gateway = D165PostThroughGateway(action, gatewayFields, out status);
                    object ok;
                    if (gateway.TryGetValue("ok", out ok) && Convert.ToBoolean(ok)) return gateway;
                    object workerStatus;
                    if (gateway.TryGetValue("worker_status", out workerStatus))
                    {
                        int parsed;
                        if (int.TryParse(Convert.ToString(workerStatus), out parsed)) status = parsed;
                    }
                    return gateway;
                }
                catch (Exception ex)
                {
                    gatewayError = ex;
                }
            }

            try
            {
                return D165PostJson(
                    AgentConfig.ApiBaseUrl.TrimEnd('/') + workerPath,
                    fields,
                    bearerToken,
                    out status);
            }
            catch
            {
                if (gatewayError != null) throw gatewayError;
                throw;
            }
        }

        private void RequestD165OneTimeCode()
        {
            string username = "";
            UiSync(() => username = _username.Text.Trim());
            if (!IsD165OneTimeAgentLogin(username))
            {
                Ui(() => MessageBox.Show(
                    "Gửi mã một lần chỉ áp dụng cho user admin hoặc tamnv2.",
                    "Mật khẩu một lần",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information));
                return;
            }

            try
            {
                int status;
                var root = D165GatewayFirst(
                    "request_privileged_auth_code",
                    "/api/auth/privileged-code",
                    new Dictionary<string, object> { { "username", username.ToLowerInvariant() } },
                    "",
                    out status);
                var ok = status >= 200 && status < 300;
                object gatewayOk;
                if (root.TryGetValue("ok", out gatewayOk)) ok = Convert.ToBoolean(gatewayOk);
                if (!ok)
                {
                    var message = MapString(root, "message");
                    if (string.IsNullOrWhiteSpace(message)) message = "Không gửi được mã một lần.";
                    throw new InvalidOperationException(message);
                }
                Ui(() => MessageBox.Show(
                    "Đã gửi mật khẩu một lần tới email quản trị. Hãy dùng mã mới nhất.",
                    "Mật khẩu một lần",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information));
                Log("D165 PRIVILEGED_AUTH code_request=PASS user=" + CleanAgentUsername(username));
            }
            catch (Exception ex)
            {
                Log("D165 PRIVILEGED_AUTH code_request=FAIL type=" + ex.GetType().Name);
                Ui(() => MessageBox.Show(
                    "Không gửi được mật khẩu một lần: " + SafeMessage(ex),
                    "Mật khẩu một lần",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error));
            }
        }

        private AgentSession D165PrivilegedAgentLogin(string username, string proof)
        {
            int status;
            var root = D165GatewayFirst(
                "privileged_agent_login",
                "/api/auth/privileged-agent-login",
                new Dictionary<string, object>
                {
                    { "username", username.Trim().ToLowerInvariant() },
                    { "password", proof }
                },
                "",
                out status);

            var ok = status >= 200 && status < 300;
            object gatewayOk;
            if (root.TryGetValue("ok", out gatewayOk)) ok = Convert.ToBoolean(gatewayOk);
            if (!ok)
            {
                var message = MapString(root, "message");
                if (string.IsNullOrWhiteSpace(message)) message = MapString(root, "error");
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(message) ? "Mật khẩu xác nhận không đúng." : message);
            }

            var idToken = MapString(root, "id_token");
            var refreshToken = MapString(root, "refresh_token");
            var firebaseUid = FirebaseUidFromIdToken(idToken);
            var audience = FirebaseAudienceFromIdToken(idToken);
            var role = FirebaseClaimFromIdToken(idToken, "app_role");
            var baseRole = FirebaseClaimFromIdToken(idToken, "app_base_role");
            var appUserId = FirebaseClaimFromIdToken(idToken, "app_user_id");
            if (!string.Equals(audience, AgentConfig.FirebaseProjectId, StringComparison.Ordinal) ||
                !string.Equals(role, "ADMIN", StringComparison.Ordinal) ||
                !string.Equals(baseRole, "ADMIN", StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(appUserId) ||
                string.IsNullOrWhiteSpace(refreshToken))
                throw new InvalidOperationException("Phiên Agent đặc quyền không hợp lệ.");

            return new AgentSession
            {
                IdToken = idToken,
                RefreshToken = refreshToken,
                UserId = firebaseUid,
                AppUserId = appUserId,
                LoginName = username.Trim(),
                Role = role,
                BaseRole = baseRole,
                ExpiresUtc = DateTime.UtcNow.AddSeconds(Math.Max(60, ParseInt(root, "expires_in", 3600)))
            };
        }

        private bool VerifyD165PrivilegedAgentProof(AgentSession session, string proof)
        {
            EnsureFreshToken();
            session = SnapshotSession();
            int status;
            var root = D165GatewayFirst(
                "privileged_agent_reauth",
                "/api/agent/reauth",
                new Dictionary<string, object> { { "proof", proof } },
                session.IdToken,
                out status);
            var ok = status >= 200 && status < 300 &&
                     string.Equals(MapString(root, "status"), "verified", StringComparison.OrdinalIgnoreCase);
            object gatewayOk;
            if (root.TryGetValue("ok", out gatewayOk)) ok = ok && Convert.ToBoolean(gatewayOk);
            return ok;
        }
    }
}
