using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Button _d161BulkKickAllButton = new Button();
        private int _d161BulkKickAllRunning;

        private sealed class D161BulkRevokeResult
        {
            internal string Status = "";
            internal string RequestId = "";
            internal int Affected;
            internal bool IdempotentReplay;
        }

        private void InitializeD161BulkPickerRevoke(Control pickerCard)
        {
            if (pickerCard == null) return;
            _d161BulkKickAllButton.Text = "Kích toàn bộ user";
            _d161BulkKickAllButton.SetBounds(850, 5, 172, 29);
            _d161BulkKickAllButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _d161BulkKickAllButton.Visible = false;
            _d161BulkKickAllButton.Click += (s, e) => BeginD161BulkPickerRevoke();
            pickerCard.Controls.Add(_d161BulkKickAllButton);
            _d161BulkKickAllButton.BringToFront();
            UpdateD161BulkPickerRevokeVisibility();
        }

        private bool IsD161PrivilegedAgentLogin(AgentSession session)
        {
            if (session == null) return false;
            var login = DisplayAgentUsername(session).Trim().ToLowerInvariant();
            return login == "admin" || login == "tamnv2";
        }

        private void UpdateD161BulkPickerRevokeVisibility()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }
            var privileged = HasAgentSession() && IsD161PrivilegedAgentLogin(session);
            Ui(() =>
            {
                _d161BulkKickAllButton.Visible = privileged;
                _d161BulkKickAllButton.Enabled =
                    privileged && Interlocked.CompareExchange(ref _d161BulkKickAllRunning, 0, 0) == 0;
            });
        }

        private void BeginD161BulkPickerRevoke()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }
            if (!IsD161PrivilegedAgentLogin(session))
            {
                MessageBox.Show(
                    "Chức năng này chỉ dành cho user Agent admin hoặc tamnv2.",
                    "Kích toàn bộ user",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }
            if (Interlocked.CompareExchange(ref _d161BulkKickAllRunning, 1, 0) != 0) return;
            UpdateD161BulkPickerRevokeVisibility();
            _pickerOnlineStatus.Text = "Đang kiểm tra số Picker đang đăng nhập...";

            Task.Run(() =>
            {
                try
                {
                    var targetCount = GetD161AuthoritativeBulkTargetCount();
                    if (targetCount <= 0)
                    {
                        Ui(() =>
                        {
                            _pickerOnlineStatus.Text = "Không có Picker Android đang đăng nhập.";
                            MessageBox.Show(
                                "Hiện không có Picker Android đang đăng nhập để thu hồi.",
                                "Kích toàn bộ user",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Information);
                        });
                        return;
                    }

                    var confirmed = (bool)Invoke(new Func<int, bool>(ConfirmD161BulkPickerRevokeOnUi), targetCount);
                    if (!confirmed)
                    {
                        Ui(() => _pickerOnlineStatus.Text = "Đã hủy Kích toàn bộ user · không có thay đổi.");
                        return;
                    }

                    var requestId = "bulk-" + Guid.NewGuid().ToString("N");
                    var localGenerations = CapturePickerSessionGenerations();
                    Ui(() => _pickerOnlineStatus.Text =
                        "Đang thu hồi " + targetCount + " phiên Picker Android...");
                    var result = ExecuteD161BulkPickerRevoke(requestId);

                    // D161 v111: the server bulk revoke is authoritative. Remove only
                    // sessions that were present when the command was issued; a Picker
                    // that legitimately logs in again with a newer generation while
                    // the response is in flight is preserved.
                    ApplyLocalPickerSessionRemovals(
                        localGenerations,
                        "BULK_KICK_SERVER_AUTHORITY");

                    Ui(() => _pickerOnlineStatus.Text =
                        "Kích toàn bộ user hoàn tất · " +
                        result.Affected.ToString(CultureInfo.InvariantCulture) +
                        " phiên Picker Android đã bị thu hồi" +
                        (result.IdempotentReplay ? " · yêu cầu trùng đã được xử lý idempotent." : "."));
                    Log(
                        "D161 BULK_REVOKE result=PASS affected=" +
                        result.Affected.ToString(CultureInfo.InvariantCulture) +
                        " replay=" + (result.IdempotentReplay ? "true" : "false"));
                }
                catch (Exception ex)
                {
                    Log("D161 BULK_REVOKE result=FAIL type=" + ex.GetType().Name + " detail=" + AgentDiagnostics.Sanitize(ex.Message));
                    Ui(() => _pickerOnlineStatus.Text =
                        "Kích toàn bộ user thất bại · " + SafeMessage(ex));
                }
                finally
                {
                    Interlocked.Exchange(ref _d161BulkKickAllRunning, 0);
                    UpdateD161BulkPickerRevokeVisibility();
                }
            });
        }

        private bool ConfirmD161BulkPickerRevokeOnUi(int targetCount)
        {
            if (InvokeRequired)
                return (bool)Invoke(new Func<int, bool>(ConfirmD161BulkPickerRevokeOnUi), targetCount);

            if (MessageBox.Show(
                "Thao tác này sẽ thu hồi toàn bộ " +
                targetCount.ToString(CultureInfo.InvariantCulture) +
                " phiên Picker Android đang đăng nhập trên hệ thống.\r\n\r\n" +
                "Tất cả Picker bị ảnh hưởng sẽ phải đăng nhập lại. Search/filter hiện tại không giới hạn phạm vi này.\r\n\r\nTiếp tục?",
                "Cảnh báo · Kích toàn bộ user",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning) != DialogResult.Yes)
                return false;

            return VerifyCurrentAgentPasswordForAction(
                "Xác nhận Kích toàn bộ user",
                "Nhập mật khẩu Agent hiện tại để xác nhận thao tác phá huỷ này.",
                "Xác nhận",
                "Mật khẩu Agent không đúng. Không có phiên Picker nào bị thu hồi.");
        }

        private int GetD161AuthoritativeBulkTargetCount()
        {
            EnsureFreshToken();
            var session = SnapshotSession();
            if (!IsD161PrivilegedAgentLogin(session))
                throw new InvalidOperationException("User Agent hiện tại không được phép thực hiện thao tác này.");

            int status;
            string body;
            if (!TryD161WorkerRequest(
                    "GET",
                    "/api/agent/picker-session/revoke-all-preview",
                    session,
                    null,
                    out status,
                    out body) && status == 401)
            {
                ForceRefreshAgentTokenD160();
                session = SnapshotSession();
                TryD161WorkerRequest(
                    "GET",
                    "/api/agent/picker-session/revoke-all-preview",
                    session,
                    null,
                    out status,
                    out body);
            }
            if (status != 200)
                throw new InvalidOperationException("Không lấy được số Picker hiện tại. HTTP " + status.ToString(CultureInfo.InvariantCulture));

            var root = new JavaScriptSerializer().DeserializeObject(body) as Dictionary<string, object>;
            return Math.Max(0, D161MapInt(root, "authenticated_picker_android_sessions"));
        }

        private D161BulkRevokeResult ExecuteD161BulkPickerRevoke(string requestId)
        {
            var payload = new JavaScriptSerializer().Serialize(
                new Dictionary<string, object> { { "request_id", requestId } });

            EnsureFreshToken();
            var session = SnapshotSession();
            int status;
            string body;
            var ok = TryD161WorkerRequest(
                "POST",
                "/api/agent/picker-session/revoke-all",
                session,
                payload,
                out status,
                out body);

            if (!ok && status == 401)
            {
                ForceRefreshAgentTokenD160();
                session = SnapshotSession();
                ok = TryD161WorkerRequest(
                    "POST",
                    "/api/agent/picker-session/revoke-all",
                    session,
                    payload,
                    out status,
                    out body);
            }

            if (!ok || status != 200)
            {
                var error = D161MapString(
                    new JavaScriptSerializer().DeserializeObject(body) as Dictionary<string, object>,
                    "error");
                throw new InvalidOperationException(
                    string.IsNullOrWhiteSpace(error)
                        ? "Máy chủ không hoàn tất Kích toàn bộ user. HTTP " + status.ToString(CultureInfo.InvariantCulture)
                        : error);
            }

            var root = new JavaScriptSerializer().DeserializeObject(body) as Dictionary<string, object>;
            return new D161BulkRevokeResult
            {
                Status = D161MapString(root, "status"),
                RequestId = D161MapString(root, "request_id"),
                Affected = Math.Max(0, D161MapInt(root, "affected")),
                IdempotentReplay = D161MapBool(root, "idempotent_replay")
            };
        }

        private bool TryD161WorkerRequest(
            string method,
            string path,
            AgentSession session,
            string jsonBody,
            out int status,
            out string responseBody)
        {
            status = 0;
            responseBody = "";
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(
                    AgentConfig.ApiBaseUrl.TrimEnd('/') + path);
                request.Method = method;
                request.Accept = "application/json";
                request.UserAgent = "Agent-Auto-Confirm-Pick-Pack/D161";
                request.Timeout = 7000;
                request.ReadWriteTimeout = 7000;
                request.KeepAlive = false;
                request.Headers[HttpRequestHeader.Authorization] =
                    "Bearer " + (session == null ? "" : session.IdToken);

                if (!string.IsNullOrEmpty(jsonBody))
                {
                    var bytes = Encoding.UTF8.GetBytes(jsonBody);
                    request.ContentType = "application/json; charset=utf-8";
                    request.ContentLength = bytes.Length;
                    using (var output = request.GetRequestStream())
                        output.Write(bytes, 0, bytes.Length);
                }

                using (var response = (HttpWebResponse)request.GetResponse())
                using (var input = response.GetResponseStream())
                using (var reader = input == null ? null : new StreamReader(input))
                {
                    status = (int)response.StatusCode;
                    responseBody = reader == null ? "" : reader.ReadToEnd();
                    return status >= 200 && status < 300;
                }
            }
            catch (WebException ex)
            {
                var response = ex.Response as HttpWebResponse;
                if (response != null)
                {
                    status = (int)response.StatusCode;
                    try
                    {
                        using (response)
                        using (var input = response.GetResponseStream())
                        using (var reader = input == null ? null : new StreamReader(input))
                            responseBody = reader == null ? "" : reader.ReadToEnd();
                    }
                    catch { }
                    return false;
                }
                throw;
            }
        }

        private static string D161MapString(Dictionary<string, object> map, string key)
        {
            if (map == null) return "";
            object value;
            return map.TryGetValue(key, out value) ? Convert.ToString(value) ?? "" : "";
        }

        private static int D161MapInt(Dictionary<string, object> map, string key)
        {
            if (map == null) return 0;
            object value;
            int parsed;
            return map.TryGetValue(key, out value) &&
                   int.TryParse(Convert.ToString(value), NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed)
                ? parsed
                : 0;
        }

        private static bool D161MapBool(Dictionary<string, object> map, string key)
        {
            if (map == null) return false;
            object value;
            if (!map.TryGetValue(key, out value) || value == null) return false;
            if (value is bool) return (bool)value;
            bool parsed;
            return bool.TryParse(Convert.ToString(value), out parsed) && parsed;
        }
    }
}
