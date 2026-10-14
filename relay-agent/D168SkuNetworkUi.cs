using System;
using System.Drawing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    internal sealed partial class AgentForm
    {
        private void InitializeD168WorkerWifiControls(Control container)
        {
            var label=new Label {
                Left=18,Top=258,Width=218,Height=24,
                Text="Wi-Fi Internet đã lưu trên máy:",
                ForeColor=Color.FromArgb(55,65,81)
            };
            var profile=new TextBox {
                Left=244,Top=257,Width=310,Height=25,
                Text=D168NetworkRoute.ApprovedProfile()
            };
            var save=new Button {
                Left=564,Top=255,Width=125,Height=29,
                Text="Lưu mạng"
            };
            save.Click+=(sender,args)=>{
                if(!D168NetworkRoute.SaveApprovedProfile(profile.Text))
                {
                    MessageBox.Show(this,
                        "Chỉ có thể chọn Wi-Fi đã lưu hợp lệ trong Windows. Không lưu mật khẩu mạng.",
                        "Thiết lập kết nối",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                    profile.Text=D168NetworkRoute.ApprovedProfile();
                }
                else MessageBox.Show(this,"Đã lưu mạng Internet được phép sử dụng khi cần.",
                    "Thiết lập kết nối",MessageBoxButtons.OK,MessageBoxIcon.Information);
            };
            var check=new Button {Left=700,Top=255,Width=170,Height=29,
                Text="Thử kết nối Worker"};
            check.Click+=(sender,args)=>{
                if(!HasAgentSession())
                {
                    MessageBox.Show(this,"Hãy đăng nhập Agent trước khi kiểm tra.",
                        "Kiểm tra Worker");return;
                }
                check.Enabled=false;
                Task.Run(()=>{
                    try
                    {
                        EnsureFreshToken();
                        var actor=SnapshotSession();
                        if(actor==null || string.IsNullOrWhiteSpace(actor.IdToken))
                            throw new InvalidOperationException("D167_AGENT_AUTH_UNAVAILABLE");
                        // Read-only capability check; if necessary use only an
                        // already-approved saved Wi-Fi with the ordinary safety gate.
                        var switched=false;
                        using(var networkSession=D168NetworkRoute.OpenWorkerSession(actor.IdToken,
                            ()=>HasAgentSession() && _leaderCoordinator!=null &&
                                _leaderCoordinator.IsLeader && _supraBrowserReady &&
                                Interlocked.CompareExchange(ref _manualPicklistOperationRunning,0,0)==0 &&
                                Interlocked.CompareExchange(ref _d167AutomaticConfirmRunning,0,0)==0,
                            RequestD168NetworkSwitchPermission,
                            msg=>Log(msg)))
                        {
                            switched=networkSession.DidSwitch;
                            if(D168NetworkRoute.ProbeWorker(actor.IdToken)!="READY")
                                throw new InvalidOperationException("D167_NETWORK_WORKER_NOT_READY");
                        }
                        Log("D168_NETWORK test=PASS route="+
                            (switched?"SWITCHED_AND_RESTORED":"DIRECT")+
                            " worker_authenticated=true");
                        Ui(()=>MessageBox.Show(this,
                            switched
                                ? "Kết nối Worker đã đạt và đã xác minh trở về Wi-Fi ban đầu. Vẫn cần kiểm tra WMS/PickList."
                                : "Worker truy cập trực tiếp được; không cần đổi Wi-Fi ở lần thử này. Vẫn cần kiểm tra WMS/PickList.",
                            "Kiểm tra Worker",MessageBoxButtons.OK,MessageBoxIcon.Information));
                    }
                    catch(Exception e)
                    {
                        Log("D168_NETWORK test=FAIL type="+e.GetType().Name+
                            " code="+D167SkuCoordinator.SafeErrorCode(e));
                        Ui(()=>MessageBox.Show(this,
                            "Kiểm tra kết nối chưa thành công: "+
                            D167SkuVietnamese.Error(D167SkuCoordinator.SafeErrorCode(e)),
                            "Kiểm tra Worker",MessageBoxButtons.OK,MessageBoxIcon.Warning));
                    }
                    finally {Ui(()=>{if(!IsDisposed)check.Enabled=true;});}
                });
            };
            container.Controls.Add(label);
            container.Controls.Add(profile);
            container.Controls.Add(save);
            container.Controls.Add(check);
        }

        // Called from the SKU worker thread. The window is modeless: WMS
        // confirmations and Agent UI must not block on a modal dialog.
        // Timeout permits a NETWORK transition only, never password approval,
        // admin operations, or bypassing the caller's idle/HA safety checks.
        private bool RequestD168NetworkSwitchPermission()
        {
            if(!InvokeRequired || IsDisposed || !IsHandleCreated)return false;
            // A delayed UI callback may still finish after the worker timeout.
            // Do not dispose the signal before FormClosed has completed Set().
            var completed=new ManualResetEventSlim(false);
            {
                var allowed=false;
                try
                {
                    BeginInvoke(new Action(()=>{
                        if(IsDisposed) {completed.Set();return;}
                        var prompt=new Form {
                            Text="Cập nhật SKU · Chuyển mạng",
                            Width=520,Height=225,TopMost=true,
                            StartPosition=FormStartPosition.CenterScreen,
                            FormBorderStyle=FormBorderStyle.FixedDialog,
                            MaximizeBox=false,MinimizeBox=false,
                            ShowInTaskbar=true
                        };
                        var explanation=new Label {
                            Left=20,Top=16,Width=468,Height=90,
                            Text="Mạng hiện tại không kết nối được hệ thống cập nhật SKU. "+
                                "Agent có thể chuyển sang mạng Internet đã được cho phép. "+
                                "Bỏ qua: thử lại sau 15 phút. Nếu không chọn trong 60 giây, "+
                                "chỉ được đổi mạng khi không có nghiệp vụ đang xử lý."
                        };
                        var agree=new Button {Text="Đồng ý",Left=200,Top=120,Width=116};
                        var skip=new Button {Text="Bỏ qua",Left=326,Top=120,Width=116};
                        var timeout=new System.Windows.Forms.Timer {Interval=60000};
                        agree.Click+=(s,e)=>{allowed=true;prompt.Close();};
                        skip.Click+=(s,e)=>{allowed=false;prompt.Close();};
                        timeout.Tick+=(s,e)=>{allowed=true;prompt.Close();};
                        prompt.FormClosed+=(s,e)=>{
                            timeout.Stop();timeout.Dispose();prompt.Dispose();completed.Set();
                        };
                        prompt.Controls.Add(explanation);
                        prompt.Controls.Add(agree);
                        prompt.Controls.Add(skip);
                        timeout.Start();
                        prompt.Show();
                    }));
                }
                catch { return false; }
                // An unresponsive UI never authorizes a network change.
                if(!completed.Wait(TimeSpan.FromSeconds(70)))return false;
                return allowed;
            }
        }
    }
}
