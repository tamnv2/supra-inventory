using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // D168: explicit group contact reuses the existing per-Picker Firestore
    // notification and call-lock authority. No broadcast impersonation and no
    // extra background listener, polling timer or uncontrolled burst fanout.
    internal sealed partial class AgentForm
    {
        private readonly Button _d168GroupContact = new Button();
        private int _d168GroupContactRunning;
        private readonly Button _d173E140CloseAllCalls = new Button();
        private int _d173E140CloseAllRunning;

        private void InitializeD168GroupPickerContact(Control pickerCard)
        {
            _d168GroupContact.Text = "Liên hệ nhóm";
            _d168GroupContact.SetBounds(852, 36, 170, 30);
            _d168GroupContact.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _d168GroupContact.Click += (s, e) => BeginD168GroupPickerContact();
            pickerCard.Controls.Add(_d168GroupContact);
            _d173E140CloseAllCalls.Text = "Kết thúc gọi 60s";
            _d173E140CloseAllCalls.SetBounds(662, 36, 182, 30);
            _d173E140CloseAllCalls.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            _d173E140CloseAllCalls.Click += (s, e) => BeginD173E140CloseAllCalls();
            pickerCard.Controls.Add(_d173E140CloseAllCalls);
        }

        private void BeginD173E140CloseAllCalls()
        {
            if (!HasAgentSession() ||
                Interlocked.CompareExchange(ref _d173E140CloseAllRunning, 0, 0) != 0)
                return;
            if (MessageBox.Show(this,
                "Kết thúc mọi yêu cầu gọi Picker về bàn CV còn hiệu lực (tối đa 60 giây)?" +
                "\nOverlay sẽ đóng trên PDA ngay sau khi nhận đồng bộ. Không xóa khóa nhập sai PickList.",
                "Xác nhận kết thúc gọi hàng loạt",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes)
                return;
            if (Interlocked.CompareExchange(ref _d173E140CloseAllRunning, 1, 0) != 0)
                return;
            _d173E140CloseAllCalls.Enabled = false;
            Task.Run(() =>
            {
                var message = "Không thể kết thúc các yêu cầu. Vui lòng thử lại.";
                try
                {
                    EnsureFreshToken();
                    var session = SnapshotSession();
                    var result = _pickerContactClient.ResolveAllActiveCalls(session, _agentInstanceId);
                    message = "Đã kết thúc " + result[0] + " yêu cầu gọi về bàn CV." +
                        " Lỗi: " + result[1] + " · hết hạn: " + result[2] + ".";
                    if (result[0] > 0)
                        Ui(() => RecordD173LocalAgentActivity("Kết thúc gọi Picker hàng loạt"));
                }
                catch (Exception ex)
                {
                    Log("D173_E140 CALL_CLOSE_ALL result=ERROR type=" + ex.GetType().Name);
                }
                finally
                {
                    var finalMessage = message;
                    Ui(() =>
                    {
                        if (!IsDisposed)
                        {
                            _d173E140CloseAllCalls.Enabled = true;
                            ShowD165PickerOperationNotice(finalMessage, 9000);
                        }
                    });
                    Interlocked.Exchange(ref _d173E140CloseAllRunning, 0);
                }
            });
        }

        private void BeginD168GroupPickerContact()
        {
            if (!HasAgentSession() || Interlocked.CompareExchange(ref _d168GroupContactRunning,0,0)!=0)
                return;
            var active = (_pickerOnlineSnapshot ?? new List<PickerPresenceView>())
                .Where(x => x!=null && !string.IsNullOrWhiteSpace(x.UserId) &&
                    x.SessionGeneration>0 && !PickerBlockedByTombstone(x))
                .GroupBy(x => x.UserId, StringComparer.Ordinal)
                .Select(g => g.OrderByDescending(x => x.SessionGeneration).First())
                .ToList();
            if (active.Count==0)
            {
                MessageBox.Show(this,"Không có phiên Picker hợp lệ để liên hệ.","Liên hệ nhóm");
                return;
            }
            var selectedRows = _pickerOnlineGrid.SelectedRows.Cast<DataGridViewRow>().ToList();
            var selected = selectedRows
                .Select(r => r.Tag as PickerPresenceView)
                .Where(x => x != null)
                .Select(x => x.UserId)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            // D173: selecting a read-only Reporter is NOT equivalent to selecting
            // no Picker. In particular it must not silently fall through to
            // "contact ALL Pickers" when only Reporter rows were selected.
            if (selectedRows.Count > 0 && selected.Count == 0)
            {
                MessageBox.Show(this, "Reporter chỉ xem, không thuộc danh sách liên hệ Picker.",
                    "Liên hệ nhóm", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            List<PickerPresenceView> targets;
            if (selected.Count>0)
            {
                var decision=MessageBox.Show(this,
                    "Yes: Liên hệ "+selected.Count+" Picker đã chọn.\n"+
                    "No: Liên hệ tất cả "+active.Count+" Picker có phiên hợp lệ.\n"+
                    "Cancel: Hủy.", "Phạm vi liên hệ nhóm",
                    MessageBoxButtons.YesNoCancel,MessageBoxIcon.Question);
                if(decision==DialogResult.Cancel) return;
                targets=decision==DialogResult.Yes
                    ?active.Where(x=>selected.Contains(x.UserId,StringComparer.Ordinal)).ToList()
                    :active;
            }
            else
            {
                if(MessageBox.Show(this,"Chưa chọn hàng nào. Liên hệ tất cả "+active.Count+
                    " Picker đang có phiên hợp lệ?", "Xác nhận phạm vi",
                    MessageBoxButtons.YesNo,MessageBoxIcon.Question)!=DialogResult.Yes)return;
                targets=active;
            }
            if(targets.Count==0)return;
            var choice=ShowPickerContactChoice(targets.Count+" Picker");
            if(choice==0)return;
            var call=choice==1;
            var message=call?"":PromptPickerChatMessage(targets.Count+" Picker");
            if(!call && message==null)return;
            if(MessageBox.Show(this,
                (call?"GỌI VỀ BÀN":"GỬI TIN CHUNG")+" cho "+targets.Count+" Picker?\n"+
                "Mỗi Picker nhận một thông báo trên phiên riêng; thao tác dùng số ghi Firestore theo số người nhận.",
                "Xác nhận liên hệ nhóm",MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning)!=DialogResult.Yes)return;
            if(Interlocked.CompareExchange(ref _d168GroupContactRunning,1,0)!=0)return;
            _d168GroupContact.Enabled=false;
            Task.Run(()=>D168SendGroupPickerContact(targets,call,message));
        }

        private void D168SendGroupPickerContact(List<PickerPresenceView> targets,bool call,string message)
        {
            var groupId=Guid.NewGuid().ToString("N");
            int sent=0,skipped=0,failed=0;
            try
            {
                EnsureFreshToken();
                var session=SnapshotSession();
                foreach(var original in targets)
                {
                    if(original==null){skipped++;continue;}
                    PickerPresenceView active=null;
                    try
                    {
                        active=(PickerPresenceView)Invoke(new Func<PickerPresenceView>(()=>{
                            // Session generation and UID must still match the original
                            // selection after asynchronous login/logout/kick events.
                            var current=(_pickerOnlineSnapshot ?? new List<PickerPresenceView>())
                                .FirstOrDefault(x=>x!=null &&
                                    string.Equals(x.UserId,original.UserId,StringComparison.Ordinal) &&
                                    x.SessionGeneration==original.SessionGeneration &&
                                    string.Equals(x.FirebaseUid,original.FirebaseUid,StringComparison.Ordinal));
                            return current==null || PickerBlockedByTombstone(current)?null:current;
                        }));
                    }
                    catch { failed++; break; }
                    if(active==null || string.IsNullOrWhiteSpace(active.FirebaseUid))
                    {
                        skipped++;continue;
                    }
                    try
                    {
                        if(call)
                        {
                            if(IsPickerCallLocked(active.UserId) || IsPickerCallPending(active.UserId))
                            {
                                skipped++;continue;
                            }
                            var command=_pickerContactClient.Send(session,_agentInstanceId,active,"CALL_SPECIALIST");
                            var snapshot=_agentSyncClient.SetCallLock(session,active.UserId,
                                command.AlertId,command.SenderAgentId,command.SenderRole,command.LockUntilMs);
                            Ui(()=>ApplyD134AgentSyncSnapshot(snapshot));
                        }
                        else _pickerContactClient.Send(session,_agentInstanceId,active,"CHAT_MESSAGE",message);
                        sent++;
                    }
                    catch(Exception ex)
                    {
                        failed++;
                        Log("D168 GROUP_CONTACT target=FAILED kind="+(call?"CALL":"CHAT")+
                            " error_type="+ex.GetType().Name);
                    }
                    // Never fan out 500 simultaneous Firestore operations.
                    Thread.Sleep(150);
                }
            }
            catch(Exception ex)
            {
                failed++;
                Log("D168 GROUP_CONTACT batch=FAILED error_type="+ex.GetType().Name);
            }
            finally
            {
                Log("D168 GROUP_CONTACT batch=FINISHED group="+groupId.Substring(0,8)+
                    " kind="+(call?"CALL":"CHAT")+" sent="+sent+" skipped="+skipped+
                    " failed="+failed);
                if (sent > 0) Ui(() => RecordD173LocalAgentActivity(call ? "Gọi nhóm Picker" : "Gửi chat nhóm Picker"));
                var summary="Liên hệ nhóm: gửi "+sent+" · bỏ qua "+skipped+" · lỗi "+failed+
                    ". Kết quả gửi không thay thế xác nhận đã xem của từng Picker.";
                Ui(()=>{
                    if(IsDisposed)return;
                    _d168GroupContact.Enabled=true;
                    ShowD165PickerOperationNotice(summary,9000);
                });
                Interlocked.Exchange(ref _d168GroupContactRunning,0);
            }
        }
    }
}
