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
        private readonly Button _d161BulkKickAllButton = new Button();
        private int _d161BulkKickAllRunning;

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
            if (_d161BulkKickAllButton == null) return;
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

            var targetCount = 0;
            lock (_agentSyncLifecycleGate)
            {
                targetCount = _pickerOnlineSnapshot == null
                    ? 0
                    : _pickerOnlineSnapshot.FindAll(item =>
                        item != null &&
                        !string.IsNullOrWhiteSpace(item.FirebaseUid) &&
                        item.SessionGeneration > 0).Count;
            }
            if (targetCount <= 0)
            {
                MessageBox.Show(
                    "Hiện không có Picker Android đang đăng nhập để thu hồi.",
                    "Kích toàn bộ user",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            if (MessageBox.Show(
                "Thao tác này sẽ thu hồi toàn bộ " + targetCount +
                " phiên Picker Android đang đăng nhập trên hệ thống. " +
                "Tất cả Picker bị ảnh hưởng sẽ phải đăng nhập lại.\r\n\r\nTiếp tục?",
                "Cảnh báo · Kích toàn bộ user",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning) != DialogResult.Yes) return;

            if (!VerifyCurrentAgentPasswordForAction(
                    "Xác nhận Kích toàn bộ user",
                    "Nhập mật khẩu Agent hiện tại để xác nhận thao tác phá huỷ này.",
                    "Xác nhận",
                    "Mật khẩu Agent không đúng. Không có phiên Picker nào bị thu hồi."))
                return;

            if (Interlocked.CompareExchange(ref _d161BulkKickAllRunning, 1, 0) != 0) return;
            UpdateD161BulkPickerRevokeVisibility();
            _pickerOnlineStatus.Text = "Đang gửi yêu cầu Kích toàn bộ user...";
            Task.Run(() =>
            {
                try { SendD161BulkPickerRevoke(targetCount); }
                catch (Exception ex)
                {
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

        private void SendD161BulkPickerRevoke(int targetCount)
        {
            EnsureFreshToken();
            var session = SnapshotSession();
            if (!IsD161PrivilegedAgentLogin(session))
                throw new InvalidOperationException("User Agent hiện tại không được phép thực hiện thao tác này.");

            var requestId = "bulk-" + Guid.NewGuid().ToString("N");
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var fields = new Dictionary<string, object>
            {
                { "request_id", D161StringField(requestId) },
                { "command_type", D161StringField("BULK_PICKER_REVOKE") },
                { "status", D161StringField("REQUESTED") },
                { "source", D161StringField("D161_AGENT_CONTROL_V1") },
                { "issued_at_ms", D161IntField(nowMs) },
                { "expires_at_ms", D161IntField(nowMs + 120000L) },
                { "issued_by_user_id", D161StringField(session.AppUserId ?? "") },
                { "issued_by_login", D161StringField(DisplayAgentUsername(session)) },
                { "agent_instance_id", D161StringField(_agentInstanceId ?? "") },
                { "target_count", D161IntField(Math.Max(0, targetCount)) }
            };
            var payload = new JavaScriptSerializer().Serialize(
                new Dictionary<string, object> { { "fields", fields } });
            var url = AgentConfig.FirestoreDocumentsBaseUrl +
                "/relay_admin_commands/" + Uri.EscapeDataString(requestId) +
                "?currentDocument.exists=false";
            FirestoreHttpTransport.SendJson(
                "PATCH",
                url,
                session.IdToken,
                payload,
                "Agent-Auto-Confirm-Pick-Pack/D161",
                7000,
                false,
                message => Log(message),
                "D161_BULK_PICKER_REVOKE");

            Log("D161 BULK_REVOKE command=SUBMITTED request_id=" + requestId +
                " target_count=" + Math.Max(0, targetCount));
            Ui(() => _pickerOnlineStatus.Text =
                "Đã gửi yêu cầu Kích toàn bộ " + targetCount +
                " Picker · máy chủ đang thu hồi phiên.");

            // One bounded result read is diagnostic/UI feedback only, never polling
            // and never part of the revocation authority.
            Thread.Sleep(1800);
            try
            {
                EnsureFreshToken();
                session = SnapshotSession();
                var raw = FirestoreHttpTransport.SendJson(
                    "GET",
                    AgentConfig.FirestoreDocumentsBaseUrl +
                        "/relay_admin_commands/" + Uri.EscapeDataString(requestId),
                    session.IdToken,
                    null,
                    "Agent-Auto-Confirm-Pick-Pack/D161",
                    5000,
                    true,
                    message => Log(message),
                    "D161_BULK_PICKER_REVOKE_RESULT");
                var root = new JavaScriptSerializer().DeserializeObject(raw) as Dictionary<string, object>;
                var status = D161FirestoreString(root, "status");
                var affected = D161FirestoreLong(root, "affected");
                if (string.Equals(status, "COMPLETED", StringComparison.Ordinal))
                {
                    Ui(() => _pickerOnlineStatus.Text =
                        "Kích toàn bộ user hoàn tất · " + Math.Max(0L, affected) +
                        " phiên Picker Android đã bị thu hồi.");
                }
                else if (string.Equals(status, "FAILED", StringComparison.Ordinal) ||
                         string.Equals(status, "REJECTED", StringComparison.Ordinal))
                {
                    var code = D161FirestoreString(root, "result_code");
                    Ui(() => _pickerOnlineStatus.Text =
                        "Kích toàn bộ user không hoàn tất · " +
                        (string.IsNullOrWhiteSpace(code) ? status : code));
                }
            }
            catch (Exception ex)
            {
                Log("D161 BULK_REVOKE result_read=DEFERRED type=" + ex.GetType().Name);
            }
        }

        private static Dictionary<string, object> D161StringField(string value)
        {
            return new Dictionary<string, object> { { "stringValue", value ?? "" } };
        }

        private static Dictionary<string, object> D161IntField(long value)
        {
            return new Dictionary<string, object> { { "integerValue", value.ToString() } };
        }

        private static Dictionary<string, object> D161Fields(Dictionary<string, object> root)
        {
            if (root == null) return null;
            object raw;
            return root.TryGetValue("fields", out raw) ? raw as Dictionary<string, object> : null;
        }

        private static string D161FirestoreString(Dictionary<string, object> root, string key)
        {
            var fields = D161Fields(root);
            if (fields == null) return "";
            object raw;
            var field = fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            object value;
            return field != null && field.TryGetValue("stringValue", out value)
                ? Convert.ToString(value) ?? ""
                : "";
        }

        private static long D161FirestoreLong(Dictionary<string, object> root, string key)
        {
            var fields = D161Fields(root);
            if (fields == null) return 0L;
            object raw;
            var field = fields.TryGetValue(key, out raw) ? raw as Dictionary<string, object> : null;
            object value;
            long parsed;
            return field != null &&
                   field.TryGetValue("integerValue", out value) &&
                   long.TryParse(Convert.ToString(value), out parsed)
                ? parsed
                : 0L;
        }
    }
}
