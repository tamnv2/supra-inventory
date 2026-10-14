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
                Text="Wi-Fi ưu tiên đã lưu trong Windows:",
                ForeColor=Color.FromArgb(55,65,81)
            };
            var summary=new Label {
                Left=244,Top=258,Width=294,Height=24,
                Text=D168NetworkRoute.ApprovedProfiles().Length+" mạng đã chọn",
                ForeColor=Color.FromArgb(55,65,81)
            };
            var edit=new Button {
                Left=538,Top=255,Width=152,Height=29,
                Text="Chọn mạng / Ưu tiên"
            };
            edit.Click+=(sender,args)=>{
                if(ConfigureD168WorkerWifiProfiles())
                    summary.Text=D168NetworkRoute.ApprovedProfiles().Length+" mạng đã chọn";
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
            container.Controls.Add(summary);
            container.Controls.Add(edit);
            container.Controls.Add(check);
        }

        // All device names stay on this local dialog, never in remote logs.
        // Profiles are already saved in Windows; this form cannot create/join
        // an arbitrary network or request credentials.
        private bool ConfigureD168WorkerWifiProfiles()
        {
            var saved=D168NetworkRoute.SavedProfiles();
            if(saved.Length==0)
            {
                MessageBox.Show(this,
                    "Windows không trả về Wi-Fi đã lưu. Kết nối và lưu mạng bằng thiết lập Windows trước.",
                    "Mạng Internet ưu tiên",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                return false;
            }
            var ordered=new System.Collections.Generic.List<string>(
                D168NetworkRoute.ApprovedProfiles());
            using(var dialog=new Form {
                Text="Chọn Wi-Fi đã lưu · thứ tự ưu tiên",
                Width=730,Height=430,MinimumSize=new Size(730,430),
                StartPosition=FormStartPosition.CenterParent,
                FormBorderStyle=FormBorderStyle.FixedDialog,
                MinimizeBox=false,MaximizeBox=false,ShowInTaskbar=false
            })
            {
                var info=new Label {
                    Left=16,Top=12,Width=682,Height=38,
                    Text="Chỉ chọn Wi-Fi đã lưu trên máy. Thứ tự từ trên xuống là ưu tiên thử kết nối Worker. Không lưu mật khẩu."
                };
                var available=new ListBox {Left=16,Top=60,Width=260,Height=230};
                available.Items.AddRange(saved);
                var chosen=new ListBox {Left=398,Top=60,Width=292,Height=230};
                var add=new Button {Left=286,Top=86,Width=102,Height=32,Text="Thêm →"};
                var remove=new Button {Left=286,Top=128,Width=102,Height=32,Text="← Xóa"};
                var up=new Button {Left=286,Top=180,Width=102,Height=32,Text="↑ Ưu tiên"};
                var down=new Button {Left=286,Top=222,Width=102,Height=32,Text="↓ Ưu tiên"};
                Action<int> redraw=select=>{
                    chosen.Items.Clear();
                    for(var i=0;i<ordered.Count;i++)
                        chosen.Items.Add((i+1)+". "+ordered[i]);
                    if(select>=0 && select<chosen.Items.Count)
                        chosen.SelectedIndex=select;
                };
                redraw(-1);
                add.Click+=(sender,args)=>{
                    var entry=available.SelectedItem as string;
                    if(string.IsNullOrWhiteSpace(entry) ||
                       ordered.Exists(x=>string.Equals(x,entry,StringComparison.OrdinalIgnoreCase)))
                        return;
                    if(ordered.Count>=6)
                    {
                        MessageBox.Show(dialog,"Chọn tối đa 6 mạng đã lưu.","Ưu tiên Wi-Fi");
                        return;
                    }
                    ordered.Add(entry);
                    redraw(ordered.Count-1);
                };
                remove.Click+=(sender,args)=>{
                    var index=chosen.SelectedIndex;
                    if(index<0)return;
                    ordered.RemoveAt(index);
                    redraw(Math.Min(index,ordered.Count-1));
                };
                up.Click+=(sender,args)=>{
                    var index=chosen.SelectedIndex;
                    if(index<=0)return;
                    var name=ordered[index];
                    ordered.RemoveAt(index);
                    ordered.Insert(index-1,name);
                    redraw(index-1);
                };
                down.Click+=(sender,args)=>{
                    var index=chosen.SelectedIndex;
                    if(index<0 || index>=ordered.Count-1)return;
                    var name=ordered[index];
                    ordered.RemoveAt(index);
                    ordered.Insert(index+1,name);
                    redraw(index+1);
                };
                var save=new Button {
                    Left=472,Top=315,Width=104,Height=32,
                    Text="Lưu",DialogResult=DialogResult.None
                };
                var cancel=new Button {
                    Left=586,Top=315,Width=104,Height=32,
                    Text="Hủy",DialogResult=DialogResult.Cancel
                };
                save.Click+=(sender,args)=>{
                    if(!D168NetworkRoute.SaveApprovedProfiles(ordered))
                    {
                        MessageBox.Show(dialog,
                            "Không lưu được danh sách: hãy kiểm tra mạng có còn được Windows lưu không.",
                            "Ưu tiên Wi-Fi",MessageBoxButtons.OK,MessageBoxIcon.Warning);
                        return;
                    }
                    dialog.DialogResult=DialogResult.OK;
                    dialog.Close();
                };
                dialog.Controls.AddRange(new Control[]{
                    info,available,chosen,add,remove,up,down,save,cancel
                });
                dialog.CancelButton=cancel;
                return dialog.ShowDialog(this)==DialogResult.OK;
            }
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
