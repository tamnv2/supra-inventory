using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private readonly Button _e196ClearBrowserSession = new Button();
        private int _e196BrowserResetRunning;

        private void InitE196BrowserSessionButton()
        {
            _e196ClearBrowserSession.Text = "Xoá phiên";
            _e196ClearBrowserSession.Height = 31;
            _e196ClearBrowserSession.Click += (s, e) => BeginE196BrowserSessionReset();
            _wmsWebToolbar.Controls.Add(_e196ClearBrowserSession);
            LayoutE143WebToolbar();
        }

        private bool E196BrowserIdle()
        {
            var transport = _d169LiveConfirmTransport;
            return (transport == null || !transport.HasActiveBatch) &&
                Interlocked.CompareExchange(ref _manualPicklistOperationRunning, 0, 0) == 0 &&
                Interlocked.CompareExchange(ref _d167AutomaticConfirmRunning, 0, 0) == 0 &&
                Interlocked.CompareExchange(ref _d157SessionValidationRunning, 0L, 0L) == 0L &&
                Interlocked.CompareExchange(ref _readinessRefreshRunning, 0L, 0L) == 0L &&
                Interlocked.CompareExchange(ref _browserStorageMigrationRunning, 0, 0) == 0 &&
                (_d167SkuCoordinator == null || !_d167SkuCoordinator.HasActiveWork);
        }

        private void BeginE196BrowserSessionReset()
        {
            if (!HasAgentSession() || _supraBrowser == null ||
                Interlocked.CompareExchange(ref _e196BrowserResetRunning, 0, 0) != 0)
                return;
            if (_supraBrowser.IsDesktopSelected())
            {
                MessageBox.Show(this, "Đang sử dụng Web Desktop. Hãy tắt Web Desktop trước khi xoá phiên Web Agent.",
                    "Xoá phiên", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            if (!E196BrowserIdle())
            {
                MessageBox.Show(this, "Đang xử lý PickList, xác nhận hoặc cập nhật SKU. Không thể xoá phiên lúc này.",
                    "Xoá phiên", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            if (MessageBox.Show(this,
                "Xoá toàn bộ dữ liệu đăng nhập và bộ nhớ đệm WMS của Web Agent trên máy này?\n\n" +
                "Agent sẽ đóng Web, tạo phiên trình duyệt mới và hiển thị trang đăng nhập WMS. " +
                "Tài khoản Agent, cấu hình mạng và dữ liệu nghiệp vụ không bị xoá.\n\nTiếp tục?",
                "Xác nhận xoá phiên Web",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
            if (!VerifyCurrentAgentPasswordForBrowserAction(
                "Xoá phiên Web", "Xác nhận mật khẩu Agent hiện tại trước khi xoá dữ liệu WMS cục bộ.",
                "Xoá phiên")) return;
            if (Interlocked.CompareExchange(ref _e196BrowserResetRunning, 1, 0) != 0) return;
            if (!E196BrowserIdle())
            {
                Interlocked.Exchange(ref _e196BrowserResetRunning, 0);
                MessageBox.Show(this, "Một tác vụ WMS vừa bắt đầu. Phiên Web được giữ nguyên.",
                    "Xoá phiên", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Block new business Confirm work before the background task closes WebView2.
            _autoAgentBrowserSuppressedByUser = true;
            _supraBrowserReady = false;
            _supraBrowserState = "NOT_OPEN";
            _e196ClearBrowserSession.Enabled = false;
            ReconcileOperationalReadiness();
            AgentDiagnostics.Write("D173_E196_WEB_RESET stage=START scope=AGENT_WMS_PROFILE_ONLY");
            Task.Run(() =>
            {
                try
                {
                    if (!E196BrowserIdle()) throw new InvalidOperationException("WMS_BUSY");
                    _supraBrowser.ResetOwnedAgentWmsProfile();
                    var state = _supraBrowser.OpenAgentBackground();
                    Ui(() =>
                    {
                        _supraBrowserReady = false;
                        _supraBrowserHidden = state.Hidden;
                        _supraBrowserState = state.State ?? "LOADING";
                        _d173E149WmsLoginPromptShown = false;
                        _autoAgentBrowserSuppressedByUser = false;
                        if (_mainTabs.SelectedTab != _wmsWebTab)
                            _mainTabs.SelectedTab = _wmsWebTab;
                        ActivateEmbeddedWmsTab();
                        AgentDiagnostics.Write("D173_E196_WEB_RESET stage=REOPENED login=REQUIRED profile=NEW");
                        MessageBox.Show(this,
                            "Đã xoá phiên Web Agent. Hãy đăng nhập WMS trên tab Web Confirm.",
                            "Xoá phiên", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    });
                }
                catch (Exception ex)
                {
                    AgentDiagnostics.Write("D173_E196_WEB_RESET stage=FAIL type=" +
                        ex.GetType().Name + " data_scope=AGENT_WMS_ONLY");
                    Ui(() => MessageBox.Show(this,
                        "Không thể hoàn tất xoá phiên Web. Agent giữ trạng thái dừng an toàn.\n" +
                        "Kiểm tra log để biết giai đoạn lỗi; không tự xoá dữ liệu khác.",
                        "Xoá phiên", MessageBoxButtons.OK, MessageBoxIcon.Error));
                }
                finally
                {
                    Interlocked.Exchange(ref _e196BrowserResetRunning, 0);
                    Ui(() =>
                    {
                        _e196ClearBrowserSession.Enabled = HasAgentSession();
                        UpdateD129SupraUi();
                        ReconcileOperationalReadiness();
                    });
                }
            });
        }
    }
}
