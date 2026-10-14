using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SupraInventoryRelayAgent
{
    // Local-only translations. Keep technical D167 reason codes solely in support logs.
    internal static class D167SkuVietnamese
    {
        internal static string State(string value)
        {
            switch(value ?? "")
            {
                case "READY": return "Chưa đến lượt";
                case "RESERVED": return "Đã cấp quyền cho máy cập nhật";
                case "CLAIMED": return "Đang chuẩn bị cập nhật";
                case "STAGING": return "Đang gửi danh sách SKU";
                case "DONE": return "Đã cập nhật";
                case "SKIPPED": return "Đã gộp vào lượt tối";
                case "FAILED": return "Cập nhật chưa thành công";
                default: return "Đang kiểm tra";
            }
        }

        internal static string Error(string code)
        {
            switch(code ?? "")
            {
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_LEASE_STALE":
                    return "Phiên xác nhận của Agent chính với máy chủ đã hết hạn. Dữ liệu chưa được lưu.";
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_ROLES_MISMATCH":
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_LEASE_MISMATCH":
                case "D167_SKU_PRIMARY_CHANGED":
                case "D167_NOT_PRIMARY":
                case "D167_LOST_PRIMARY":
                    return "Máy này không còn giữ quyền Agent chính. Vui lòng kiểm tra máy đang xử lý.";
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_ROLES_READ_FAILED":
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_LEASE_READ_FAILED":
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_FIRESTORE_VERIFIER_UNAVAILABLE":
                    return "Máy chủ chưa xác minh được quyền Agent chính. Danh sách chưa được lưu.";
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_VERIFIER_CONFIG_MISSING":
                    return "Máy chủ chưa được cấu hình đầy đủ để xác minh Agent chính.";
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY_INVALID_IDENTITY":
                case "D167_WORKER_NOT_CURRENT_FIREBASE_PRIMARY":
                    return "Máy chủ chưa chấp nhận quyền Agent chính. Danh sách chưa được lưu.";
                case "D167_WORKER_CURRENT_PASSWORD_INVALID":
                    return "Mật khẩu hoặc mã xác nhận không đúng.";
                case "D167_WORKER_TIMEOUT":
                case "D167_WORKER_CONNECTFAILURE":
                case "D167_WORKER_NAMERESOLUTIONFAILURE":
                case "D167_WORKER_HTTP_502":
                case "D167_WORKER_HTTP_503":
                case "D167_WORKER_HTTP_504":
                    return "Không kết nối được máy chủ cập nhật SKU. Vui lòng kiểm tra mạng.";
                case "D167_WORKER_HTTP_403":
                case "D167_WORKER_HTTP_409":
                case "D167_WORKER_REJECTED":
                    return "Máy chủ không chấp nhận quyền cập nhật hoặc đang có lượt xử lý khác. Vui lòng kiểm tra nhật ký.";
                case "D167_SKU_JOB_ALREADY_RUNNING":
                case "D167_NETWORK_SWITCH_ALREADY_RUNNING":
                    return "Đang có một lượt cập nhật SKU khác.";
                case "D167_NETWORK_PROFILES_NOT_APPROVED":
                    return "Chưa chọn được Wi-Fi Internet đã lưu hoặc chưa xác định được mạng để khôi phục. Hãy kiểm tra Cài đặt.";
                case "D167_NETWORK_SWITCH_DEFERRED":
                    return "Đã hoãn chuyển mạng. Hệ thống sẽ thử cập nhật lại sau 15 phút.";
                case "D167_NETWORK_SWITCH_BUSY":
                    return "Agent đang xử lý xác nhận đơn hoặc thay đổi vai trò. Sẽ thử cập nhật khi an toàn.";
                case "D167_NETWORK_SWITCH_FAILED":
                case "D167_NETWORK_WORKER_NOT_READY":
                case "D167_WORKER_UNAVAILABLE_NO_SAFE_SWITCH":
                    return "Chưa kết nối được Worker qua mạng được phép. Danh sách SKU chưa được cập nhật.";
                case "D167_NETWORK_RESTORE_FAILED":
                    return "Không khôi phục được Wi-Fi ban đầu. Vui lòng kiểm tra kết nối Windows ngay.";
                case "D167_MANUAL_PRIMARY_OR_CONFIRM_NOT_READY":
                    return "Máy Agent chính hoặc trang xác nhận đơn chưa sẵn sàng.";
                case "D167_SKU_CONFLICT_AWAITING_APPROVAL":
                    return "Chưa xác nhận cách xử lý dữ liệu SKU bị trùng hoặc mâu thuẫn.";
                default:
                    return "Cập nhật chưa hoàn tất. Hãy gửi nhật ký Agent để xác định nguyên nhân.";
            }
        }
    }

    // Local-first operation tab: no Firebase listener, provider polling or
    // per-SKU server reads. Data arrives through the existing SKU coordinator.
    internal sealed partial class AgentForm
    {
        private readonly TabPage _d167SkuPage=new TabPage("Cập nhật SKU");
        private readonly Label _d167SkuHeadline=new Label();
        private readonly Label _d167SkuMetrics=new Label();
        private readonly Label _d167SkuDetailNote=new Label();
        private readonly Button _d167SkuRefresh=new Button();
        private readonly Button _d167SkuRun=new Button();
        private readonly TextBox _d167SkuOpsStatus=new TextBox();
        private readonly DataGridView _d167SkuSlots=new DataGridView();
        private readonly DataGridView _d167SkuManualHistory=new DataGridView();

        private bool _d167SkuManualActive;
        private D167SkuWorkbook _d167SkuLastWorkbook;
        private List<D167SkuSlotStatus> _d167SkuLastSlots=new List<D167SkuSlotStatus>();
        private List<D167SkuSlotStatus> _d167SkuLastManual=new List<D167SkuSlotStatus>();

        private static DataGridView NewD167Grid(params string[] headers)
        {
            var grid=new DataGridView {
                Dock=DockStyle.Fill, ReadOnly=true,
                AllowUserToAddRows=false,AllowUserToDeleteRows=false,
                RowHeadersVisible=false,MultiSelect=false,
                SelectionMode=DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,
                BackgroundColor=Color.White,BorderStyle=BorderStyle.FixedSingle,
                Font=new Font("Segoe UI",9F)
            };
            foreach(var name in headers) grid.Columns.Add(name,name);
            return grid;
        }

        private static string D167Time(string iso)
        {
            DateTimeOffset date;
            if(!DateTimeOffset.TryParse(iso,out date)) return "—";
            var vn=TimeZoneInfo.ConvertTime(date,TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time"));
            return vn.ToString("dd/MM HH:mm:ss");
        }

        private static string D167Scheduled(long ms)
        {
            if(ms<=0) return "—";
            return D167Time(DateTimeOffset.FromUnixTimeMilliseconds(ms).ToString("o"));
        }

        private static string D167ReceiptNumber(string receipt,string key)
        {
            if(string.IsNullOrEmpty(receipt)) return "—";
            try
            {
                var root=new JavaScriptSerializer().DeserializeObject(receipt) as Dictionary<string,object>;
                object value;
                return root!=null && root.TryGetValue(key,out value) && value!=null
                    ?Convert.ToString(value):"—";
            }
            catch { return "—"; }
        }

        private static string D167ReceiptLine(D167SkuSlotStatus status)
        {
            var receipt=status.ReceiptJson;
            if(status.State!="DONE") return status.State=="SKIPPED"?"Gộp vào lượt tối":"Chưa có biên nhận";
            return "SKU "+D167ReceiptNumber(receipt,"source_rows")+
                " · mới "+D167ReceiptNumber(receipt,"created")+
                " · sửa "+D167ReceiptNumber(receipt,"updated")+
                " · ẩn "+D167ReceiptNumber(receipt,"hidden")+
                " · giữ nguyên "+D167ReceiptNumber(receipt,"unchanged");
        }

        private void InitD167SkuTab()
        {
            _d167SkuPage.BackColor=Color.FromArgb(243,246,248);
            var panel=new TableLayoutPanel {
                Dock=DockStyle.Fill,Padding=new Padding(12),
                ColumnCount=1,RowCount=6,BackColor=_d167SkuPage.BackColor
            };
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100F));
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute,83F));
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute,159F));
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute,113F));
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute,53F));
            panel.RowStyles.Add(new RowStyle(SizeType.Percent,100F));
            panel.RowStyles.Add(new RowStyle(SizeType.Absolute,24F));

            var heading=new TableLayoutPanel {Dock=DockStyle.Fill,ColumnCount=2};
            heading.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,70F));
            heading.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,30F));
            _d167SkuHeadline.Dock=DockStyle.Fill;
            _d167SkuHeadline.Font=new Font("Segoe UI",10F,FontStyle.Bold);
            _d167SkuHeadline.Text="Hôm nay · Chưa xác minh trạng thái SKU";
            _d167SkuHeadline.AutoEllipsis=true;
            var controls=new FlowLayoutPanel {Dock=DockStyle.Fill,FlowDirection=FlowDirection.RightToLeft,WrapContents=false};
            _d167SkuRun.Text="Cập nhật ngay";
            _d167SkuRun.Width=125;_d167SkuRun.Height=32;
            _d167SkuRun.Click+=(s,e)=>D167SkuRunManual();
            _d167SkuRefresh.Text="Kiểm tra trạng thái";
            _d167SkuRefresh.Width=138;_d167SkuRefresh.Height=32;
            _d167SkuRefresh.Click+=(s,e)=>_d167SkuCoordinator.RequestStatus();
            controls.Controls.Add(_d167SkuRun);
            controls.Controls.Add(_d167SkuRefresh);
            heading.Controls.Add(_d167SkuHeadline,0,0);
            heading.Controls.Add(controls,1,0);

            var scheduleGroup=new GroupBox {Dock=DockStyle.Fill,Text="Ba lượt cập nhật tự động · giờ Việt Nam"};
            _d167SkuSlots.Dock=DockStyle.Fill;
            foreach(var name in new[]{"Lượt","Giờ dự kiến","Trạng thái","Hoàn thành","Người cập nhật","Kết quả"})
                _d167SkuSlots.Columns.Add(name,name);
            D167ApplyGridStyle(_d167SkuSlots);
            scheduleGroup.Controls.Add(_d167SkuSlots);

            var historyGroup=new GroupBox {Dock=DockStyle.Fill,Text="Lượt thủ công gần nhất (tối đa 5)"};
            D167ApplyGridStyle(_d167SkuManualHistory);
            foreach(var name in new[]{"Bắt đầu lúc","Trạng thái","Hoàn thành","Người cập nhật","Kết quả"})
                _d167SkuManualHistory.Columns.Add(name,name);
            historyGroup.Controls.Add(_d167SkuManualHistory);

            _d167SkuMetrics.Dock=DockStyle.Fill;
            _d167SkuMetrics.Font=new Font("Segoe UI",9F);
            _d167SkuMetrics.Text="Thống kê LTA / Shelving / Chưa xác định sẽ xuất hiện sau khi tải thành công.";
            var detailGroup=new GroupBox {Dock=DockStyle.Fill,
                Text="Tình trạng vận hành · không tải danh sách SKU"};
            _d167SkuOpsStatus.Multiline=true;
            _d167SkuOpsStatus.ReadOnly=true;
            _d167SkuOpsStatus.ScrollBars=ScrollBars.Vertical;
            _d167SkuOpsStatus.Dock=DockStyle.Fill;
            _d167SkuOpsStatus.BorderStyle=BorderStyle.None;
            _d167SkuOpsStatus.BackColor=Color.White;
            _d167SkuOpsStatus.Font=new Font("Segoe UI",9.5F);
            _d167SkuOpsStatus.Text="Chưa nhận thông tin SKU từ InventoryCore.";
            detailGroup.Controls.Add(_d167SkuOpsStatus);
            _d167SkuDetailNote.Dock=DockStyle.Fill;
            _d167SkuDetailNote.Text="Nguồn kết quả: biên nhận Worker / InventoryCore. Không phát sinh tìm kiếm SKU hoặc Firebase poll.";
            _d167SkuDetailNote.ForeColor=Color.DimGray;
            panel.Controls.Add(heading,0,0);
            panel.Controls.Add(scheduleGroup,0,1);
            panel.Controls.Add(historyGroup,0,2);
            var stats=new Panel {Dock=DockStyle.Fill};
            _d167SkuMetrics.Dock=DockStyle.Fill;
            stats.Controls.Add(_d167SkuMetrics);
            panel.Controls.Add(stats,0,3);
            panel.Controls.Add(detailGroup,0,4);
            panel.Controls.Add(_d167SkuDetailNote,0,5);
            _d167SkuPage.Controls.Add(panel);
            _d167SkuSlots.Rows.Add("Đầu ca · Danh sách đầy đủ","05:00 trở đi","Chưa kiểm tra","—","—","—");
            _d167SkuSlots.Rows.Add("Giữa ca · Kiểm tra thay đổi","12:00–12:15","Chưa kiểm tra","—","—","—");
            _d167SkuSlots.Rows.Add("Cuối ca · Kiểm tra thay đổi","19:00–19:15","Chưa kiểm tra","—","—","—");
        }

        private static void D167ApplyGridStyle(DataGridView grid)
        {
            grid.ReadOnly=true;grid.AllowUserToAddRows=false;grid.AllowUserToDeleteRows=false;
            grid.RowHeadersVisible=false;grid.SelectionMode=DataGridViewSelectionMode.FullRowSelect;
            grid.MultiSelect=false;grid.AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill;
            grid.BackgroundColor=Color.White;grid.Dock=DockStyle.Fill;
        }

        private void RenderD167SkuStatus(List<D167SkuSlotStatus> slots,
            List<D167SkuSlotStatus> recent,D167SkuWorkbook workbook,string message)
        {
            Ui(()=>{
                if(IsDisposed) return;
                if(slots!=null && slots.Count>0) _d167SkuLastSlots=slots;
                if(recent!=null) _d167SkuLastManual=recent;
                if(workbook!=null && !ReferenceEquals(_d167SkuLastWorkbook,workbook))
                {
                    _d167SkuLastWorkbook=workbook;
                }
                _d167SkuSlots.Rows.Clear();
                foreach(var key in new[]{"INITIAL_05","DELTA_12","DELTA_19"})
                {
                    var state=_d167SkuLastSlots.FirstOrDefault(x=>x.Slot==key);
                    var caption=key=="INITIAL_05"?"Đầu ca · Danh sách đầy đủ":key=="DELTA_12"?"Giữa ca · Kiểm tra thay đổi":"Cuối ca · Kiểm tra thay đổi";
                    _d167SkuSlots.Rows.Add(caption,state==null?"—":D167Scheduled(state.ScheduledAtMs),
                        state==null?"Chưa kiểm tra":D167SkuVietnamese.State(state.State),
                        state==null?"—":D167Time(state.CompleteAt),
                        state==null?"—":D167ReceiptNumber(state.ReceiptJson,"actor_display"),
                        state==null?"—":D167ReceiptLine(state));
                }
                _d167SkuManualHistory.Rows.Clear();
                foreach(var item in _d167SkuLastManual.Take(5))
                    _d167SkuManualHistory.Rows.Add(D167Scheduled(item.ScheduledAtMs),
                        D167SkuVietnamese.State(item.State),D167Time(item.CompleteAt),
                        D167ReceiptNumber(item.ReceiptJson,"actor_display"),D167ReceiptLine(item));
                var today=D167SkuSchedule.VNNow().ToString("yyyy-MM-dd");
                var first=_d167SkuLastSlots.FirstOrDefault(x=>x.Slot=="INITIAL_05");
                var primary=_leaderCoordinator!=null && _leaderCoordinator.IsLeader;
                _d167SkuHeadline.Text=today+" · "+(first!=null&&first.State=="DONE"?"Danh sách SKU hôm nay đã cập nhật":"Danh sách SKU hôm nay chưa được xác nhận") +
                    " · "+(primary?"Máy Agent chính":"Máy Agent dự phòng")+" · Hệ thống kho "+(_supraBrowserReady?"sẵn sàng":"chưa sẵn sàng")+
                    (string.IsNullOrEmpty(message)?"":"\n"+message);
                _d167SkuRun.Enabled=!_d167SkuManualActive && primary && _supraBrowserReady && HasAgentSession();
                _d167SkuOpsStatus.Text="Ngày "+today+" · cập nhật FULL: "+
                    (first==null?"Chưa xác minh":D167SkuVietnamese.State(first.State))+
                    Environment.NewLine+"Đường gửi SKU: Agent → Cloudflare Worker → InventoryCore (không dùng Google Script)"+
                    Environment.NewLine+"Máy thực hiện: "+(primary?"PRIMARY":"STANDBY / đang theo dõi")+
                    Environment.NewLine+"WMS: "+(_supraBrowserReady?"Sẵn sàng":"Chưa sẵn sàng")+
                    Environment.NewLine+"Biên nhận FULL: "+(first==null?"—":D167ReceiptLine(first))+
                    Environment.NewLine+"Hoàn thành FULL: "+(first==null?"—":D167Time(first.CompleteAt))+
                    Environment.NewLine+"Người cập nhật FULL: "+(first==null?"—":D167ReceiptNumber(first.ReceiptJson,"actor_display"))+
                    Environment.NewLine+"Lưu ý: Trạng thái DONE chỉ xác nhận từ Worker, không dùng dữ liệu máy cục bộ.";
                if(_d167SkuLastWorkbook!=null)
                {
                    var items=_d167SkuLastWorkbook.Items;
                    _d167SkuMetrics.Text="Từ hệ thống kho: "+_d167SkuLastWorkbook.SourceRows+
                        " dòng · "+items.Count+" SKU · LTA "+items.Count(x=>x.Area=="LTA")+
                        " · Shelving "+items.Count(x=>x.Area=="SHELVING")+
                        " · Chưa xác định "+items.Count(x=>x.Area=="UNKNOWN")+
                        " · Danh sách tải gần nhất trên máy này (không phải số lượng tồn kho).";
                }
            });
        }

        private void D167SkuRunManual()
        {
            if(_d167SkuCoordinator==null || _leaderCoordinator==null ||
               !_leaderCoordinator.IsLeader || !_supraBrowserReady)
            {
                MessageBox.Show("Chỉ máy Agent chính đã đăng nhập hệ thống kho mới được cập nhật SKU.","Cập nhật SKU");
                return;
            }
            AgentSession actor=null;
            try { actor=SnapshotSession(); } catch { }
            if(actor==null) return;
            using(var dialog=new AgentPasswordVerificationDialog(DisplayAgentUsername(actor),
                "Xác nhận cập nhật SKU",
                "Nhập mật khẩu Agent hiện tại. Tài khoản quản trị đặc quyền có thể dùng mã một lần hoặc mã khẩn cấp. Hệ thống sẽ xác minh trước khi cập nhật.",
                "Xác nhận cập nhật"))
            {
                if(ShowProtectedInputDialog(dialog)!=DialogResult.OK) return;
                var proof=dialog.PasswordValue;
                if(string.IsNullOrWhiteSpace(proof)) return;
                _d167SkuManualActive=true;
                _d167SkuRun.Enabled=false;
                _d167SkuHeadline.Text="Đang xác minh yêu cầu cập nhật SKU của "+DisplayAgentUsername(actor)+"...";
                Task.Run(()=>{
                    try { _d167SkuCoordinator.RunManual(proof); }
                    catch(Exception e)
                    {
                        Ui(()=>MessageBox.Show("Chưa cập nhật được SKU: "+D167SkuVietnamese.Error(
                            D167SkuCoordinator.SafeErrorCode(e))+
                            " Nếu lỗi tiếp tục, hãy gửi nhật ký Agent.",
                            "Cập nhật SKU",MessageBoxButtons.OK,MessageBoxIcon.Warning));
                    }
                    finally
                    {
                        proof=null;
                        Ui(()=>{ if(!IsDisposed) { _d167SkuManualActive=false;
                            _d167SkuRun.Enabled=_leaderCoordinator!=null &&
                                _leaderCoordinator.IsLeader && _supraBrowserReady; }});
                    }
                });
            }
        }
    }
}
