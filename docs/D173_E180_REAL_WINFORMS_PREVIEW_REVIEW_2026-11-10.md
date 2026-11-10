# D173-E180 — Bản xem trước WinForms thực (chờ Owner duyệt)

## Căn cứ
- Source đang phát hành Agent178: `relay-agent/Program.cs` (TableLayoutPanel/Panel), `relay-agent/D119AgentFeatures.cs` (DataGridView phiên và action RBAC), `relay-agent/D173DesktopResources.cs` (desktop metrics, custom sparkline), `relay-agent/D173E179OverviewNoScroll.cs` (native 50/50 và narrow TabControl).
- Chỉ dựng prototype có thể **biên dịch và chạy bởi .NET Framework WinForms trên Windows**; KHÔNG dùng HTML/WebView2 để vẽ ảnh.
- DataGridView trong bản xem trước có dữ liệu nhân sự giả lập và các button chỉ để quan sát. Không kết nối hay gọi API nội bộ/Cloudflare/Firebase.
- Scope chỉ: `relay-agent/previews/D173E180NativePreview.cs`, `.github/workflows/d173-e180-winforms-review.yml`, doc review và PNG thực do Windows CI tạo. Không sửa Agent178 Production, D172, shared Worker, Android/Web, legacy Stable.

## Bố cục xem trước

1. Sidebar giữ các tab và tiện ích tương ứng source.
2. Header riêng “Tổng quan vận hành”, tóm tắt trạng thái, không chiếm nửa vùng trên.
3. Phần trên cùng **50%** chiều cao Overview, WinForms `TableLayoutPanel`; ở nội dung rộng >=1240px chia ba cột Agent (39%), Web/PickList (37% với 44/56%) và Desktop (24%); không cuộn ngang/dọc.
4. Ở cửa sổ nhỏ, dùng `TabControl` với bốn tab Agent/Web/PickList/Tài nguyên; không cuộn ngang/dọc khu vực trên.
5. Danh sách phiên chiếm **50%** còn lại, `DataGridView.ScrollBars=Vertical`, giữ bộ lọc, tìm kiếm và các thao tác. Ẩn cột phụ khi màn hình hẹp, không tự tạo scroll ngang.
6. Kích thước xem trước: 1600×960 và 1280×720 (Agent + PickList). Windows CI biên dịch file WinForms bằng `csc.exe`, thực thi, `Form.DrawToBitmap` và lưu PNG. Đây là **kết quả Windows Forms thật**, không phải ảnh HTML hoặc ảnh AI.

## Chứng cứ & ranh giới
- Ảnh chuẩn review:
  - `docs/native-previews/d173-e180-native-1600x960.png`
  - `docs/native-previews/d173-e180-native-1280x720-agent.png`
  - `docs/native-previews/d173-e180-native-1280x720-picklist.png`
- Chỉ coi đủ điều kiện review khi Windows workflow `D173 E180 Windows Native UI Review` **SUCCESS** và cả ba PNG có trong repo. Nếu chưa có ảnh, **không** gửi ảnh HTML thay thế.
- Mẫu này là WinForms demo độc lập chứa control và bố cục thi công được; **không** được ghi là đã tích hợp vào binary Agent thật. Sau khi Owner duyệt hình, mới được áp vào source Agent cùng kiểm thử on-screen 100/125/150% DPI và xác nhận không cắt nút.
- Agent178 đã phát hành nhưng Owner báo FIELD UI FAIL; không suy diễn OWNER PASS. D172 vẫn HOLD, Stable OWNER-GATED. Không phát hành bản mới khi chỉ được yêu cầu xem trước.
