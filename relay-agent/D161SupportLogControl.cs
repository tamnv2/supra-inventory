using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Button _d161GlobalSupportLogButton = new Button();
        private int _d161GlobalSupportLogRunning;

        private void InitializeD161GlobalSupportLogControl(Control host)
        {
            if (host == null) return;
            _d161GlobalSupportLogButton.Text = "Yêu cầu toàn bộ log hệ thống Báo hàng & xác nhận đơn";
            _d161GlobalSupportLogButton.SetBounds(18, 140, 500, 34);
            _d161GlobalSupportLogButton.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            _d161GlobalSupportLogButton.Visible = false;
            _d161GlobalSupportLogButton.Click += (s, e) => BeginD161GlobalSupportLogRequest();
            host.Controls.Add(_d161GlobalSupportLogButton);
            _d161GlobalSupportLogButton.BringToFront();
            UpdateD161GlobalSupportLogControlVisibility();
        }

        private void UpdateD161GlobalSupportLogControlVisibility()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }
            var privileged = HasAgentSession() && IsD161PrivilegedAgentLogin(session);
            Ui(() =>
            {
                _d161GlobalSupportLogButton.Visible = privileged;
                _d161GlobalSupportLogButton.Enabled =
                    privileged && Interlocked.CompareExchange(ref _d161GlobalSupportLogRunning, 0, 0) == 0;
            });
        }

        private void BeginD161GlobalSupportLogRequest()
        {
            AgentSession session = null;
            try { session = SnapshotSession(); } catch { }
            if (!IsD161PrivilegedAgentLogin(session))
            {
                MessageBox.Show(
                    "Chức năng này chỉ dành cho user Agent admin hoặc tamnv2.",
                    "Yêu cầu log hệ thống",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            if (MessageBox.Show(
                "Yêu cầu toàn bộ log hệ thống Báo hàng & xác nhận đơn từ các phiên đang đăng nhập?\r\n\r\n" +
                "Web, Android và Agent đang hoạt động sẽ gửi một gói chẩn đoán có cùng mã truy vết. " +
                "Phiên đã đăng xuất sẽ bỏ qua.\r\n\r\nTiếp tục?",
                "Xác nhận yêu cầu log hệ thống",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2) != DialogResult.Yes)
                return;

            if (Interlocked.CompareExchange(ref _d161GlobalSupportLogRunning, 1, 0) != 0) return;
            UpdateD161GlobalSupportLogControlVisibility();

            Task.Run(() =>
            {
                try
                {
                    EnsureFreshToken();
                    session = SnapshotSession();
                    if (!IsD161PrivilegedAgentLogin(session))
                        throw new InvalidOperationException("User Agent hiện tại không được phép yêu cầu log hệ thống.");

                    var requestId = "support-" + Guid.NewGuid().ToString("N");
                    var body = new JavaScriptSerializer().Serialize(
                        new Dictionary<string, object> { { "request_id", requestId } });

                    int status;
                    string responseBody;
                    var ok = TryD161WorkerRequest(
                        "POST",
                        "/api/agent/support-log-request",
                        session,
                        body,
                        out status,
                        out responseBody);

                    if (!ok && status == 401)
                    {
                        ForceRefreshAgentTokenD160();
                        session = SnapshotSession();
                        if (!IsD161PrivilegedAgentLogin(session))
                            throw new InvalidOperationException("Phiên Agent không còn quyền yêu cầu log hệ thống.");
                        ok = TryD161WorkerRequest(
                            "POST",
                            "/api/agent/support-log-request",
                            session,
                            body,
                            out status,
                            out responseBody);
                    }

                    var root = new JavaScriptSerializer().DeserializeObject(responseBody) as Dictionary<string, object>;
                    if (!ok || status != 200)
                    {
                        var error = D161MapString(root, "error");
                        throw new InvalidOperationException(
                            string.IsNullOrWhiteSpace(error)
                                ? "Máy chủ không nhận yêu cầu log. HTTP " + status
                                : error);
                    }

                    var traceId = D161MapString(root, "trace_id");
                    var replay = D161MapBool(root, "idempotent_replay");
                    Log(
                        "D161 SUPPORT_LOG request=SUBMITTED id=" +
                        (requestId.Length <= 18 ? requestId : requestId.Substring(0, 18)) +
                        " replay=" + (replay ? "true" : "false"));
                    Ui(() => MessageBox.Show(
                        "Đã gửi yêu cầu log hệ thống.\r\n\r\n" +
                        "Mã truy vết: " + (string.IsNullOrWhiteSpace(traceId) ? requestId : traceId) +
                        "\r\nCác phiên đang đăng nhập sẽ gửi log theo cơ chế giới hạn và chống trùng.",
                        "Yêu cầu log hệ thống",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information));
                }
                catch (Exception ex)
                {
                    Log("D161 SUPPORT_LOG request=FAIL type=" + ex.GetType().Name);
                    Ui(() => MessageBox.Show(
                        "Không gửi được yêu cầu log hệ thống. " + SafeMessage(ex),
                        "Yêu cầu log hệ thống",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning));
                }
                finally
                {
                    Interlocked.Exchange(ref _d161GlobalSupportLogRunning, 0);
                    UpdateD161GlobalSupportLogControlVisibility();
                }
            });
        }
    }
}
