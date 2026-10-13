using System;
using System.Drawing;
using System.Threading;
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
            container.Controls.Add(label);
            container.Controls.Add(profile);
            container.Controls.Add(save);
        }

        // Called from the SKU worker thread. The window is modeless: WMS
        // confirmations and Agent UI must not block on a modal dialog.
        // Timeout permits a NETWORK transition only, never password approval,
        // admin operations, or bypassing the caller's idle/HA safety checks.
        private bool RequestD168NetworkSwitchPermission()
        {
            if(!InvokeRequired || IsDisposed || !IsHandleCreated)return false;
            using(var completed=new ManualResetEventSlim(false))
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
