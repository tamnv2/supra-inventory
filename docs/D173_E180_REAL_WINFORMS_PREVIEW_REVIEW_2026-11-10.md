# D173-E180 — Bản xem trước WinForms thực (chờ Owner duyệt)

## Căn cứ
- Source đang phát hành Agent178: `relay-agent/Program.cs` (TableLayoutPanel/Panel), `relay-agent/D119AgentFeatures.cs` (DataGridView phiên và action RBAC), `relay-agent/D173DesktopResources.cs` (desktop metrics, custom sparkline), `relay-agent/D173E179OverviewNoScroll.cs` (native 50/50 và narrow TabControl).
- Chỉ dựng prototype có thể **biên dịch và chạy bởi .NET Framework WinForms trên Windows**; KHÔNG dùng HTML/WebView2 để vẽ ảnh.
- DataGridView trong bản xem trước có dữ liệu nhân sự giả lập và các button chỉ để quan sát. Không kết nối hay gọi API nội bộ/Cloudflare/Firebase.
- Scope chỉ: `relay-agent/previews/D173E180NativePreview.cs`, `.github/workflows/d173-e180-winforms-review.yml`, doc review và PNG thực do Windows CI tạo. Không sửa Agent178 Production, D172, shared Worker, Android/Web, legacy Stable.

## Bố cục xem trước

1. Sidebar giữ các tab và tiện ích tương ứng source.
2. Header riêng “Tổng quan vận hành”, tóm tắt trạng thái, không chiếm nửa vùng trên.
3. Phần trên cùng **50%** chiều cao Overview, WinForms `TableLayoutPanel`; ở nội dung rộng >=1240px chia ba cột Agent (44%), Web/PickList (35% với 54/46%) và Desktop (21%); không cuộn ngang/dọc.
4. Ở cửa sổ nhỏ, dùng `TabControl` với bốn tab Agent/Web/PickList/Tài nguyên; không cuộn ngang/dọc khu vực trên.
5. Danh sách phiên chiếm **50%** còn lại, `DataGridView.ScrollBars=Vertical`, giữ bộ lọc, tìm kiếm và các thao tác. Ẩn cột phụ khi màn hình hẹp, không tự tạo scroll ngang.
6. Kích thước xem trước: 1600×960 và 1280×720 (Agent + PickList). Windows CI biên dịch file WinForms bằng `csc.exe`, thực thi, `Form.DrawToBitmap` và lưu PNG. Đây là **kết quả Windows Forms thật**, không phải ảnh HTML hoặc ảnh AI.

## Chứng cứ & ranh giới
- Ảnh chuẩn review:
  - `docs/native-previews/d173-e180-native-1600x960.png`
  - `docs/native-previews/d173-e180-native-1280x720-agent.png`
  - `docs/native-previews/d173-e180-native-1280x720-picklist.png`
- Chỉ coi đủ điều kiện review khi Windows workflow `D173 E180 Windows Native UI Review` **SUCCESS** và sáu PNG có trong repo. Nếu chưa có ảnh, **không** gửi ảnh HTML thay thế.
- Mẫu này là WinForms demo độc lập chứa control và bố cục thi công được; **không** được ghi là đã tích hợp vào binary Agent thật. Sau khi Owner duyệt hình, mới được áp vào source Agent cùng kiểm thử on-screen 100/125/150% DPI và xác nhận không cắt nút.
- Agent178 đã phát hành nhưng Owner báo FIELD UI FAIL; không suy diễn OWNER PASS. D172 vẫn HOLD, Stable OWNER-GATED. Không phát hành bản mới khi chỉ được yêu cầu xem trước.

## Owner phản hồi mới — không chấp nhận lược bỏ Agent177 (10/11/2026)

Owner **FIELD UI FAIL Agent178** vì bản dựng và preview đầu tiên loại bỏ nút và thông tin hiển thị. Quy tắc E180 sửa lại:

- Không được lược bỏ bất kỳ thông tin/nút nào *đang hiển thị ở Agent177*; không thay bằng chữ “xem ở nơi khác”, không ẩn cột chỉ vì hẹp. Giữ nguyên đủ nút gốc và điều kiện RBAC/nghiệp vụ. Các nút có điều kiện (Tăng ca, xác nhận nhiều PickList, đăng nhập) phải có đầy đủ trong đúng trạng thái.
- Nửa trên/nhóm thao tác và nửa dưới/danh sách phiên đúng `50%/50%` của **khung Tổng quan** ở mọi kích thước hỗ trợ. Phía trên không cuộn ngang/dọc, phía dưới chỉ `DataGridView.ScrollBars=Vertical`.
- 1600×960: đầy đủ bốn nhóm cùng lúc. 1280×720: nhóm phía trên thành bốn tab native WinForms, **mỗi nhóm vẫn có đủ thông tin và nút**, khác với việc xóa/hide các control. Danh sách phiên phía dưới luôn còn nguyên.
- Phần lịch sử/bảng dài vượt chiều cao cần **phân trang** trong vùng trên. Điều này giữ khả năng truy cập toàn bộ bản ghi thay vì bỏ bớt; không được giả định mọi dữ liệu đều chỉ có 3 Agent và 2 PickList như mẫu. Cần kiểm tra kỹ logic phân trang trong bản production trước release.
- Các yêu cầu trên **chưa được Owner duyệt nghiệm thu mẫu**, không tự động phát hành Agent179 hoặc thay đổi source Agent178 Production.

## Source 177 → thành phần WinForms được bảo toàn trong review

Authority dùng tag phát hành `relay-agent-v177`, `Program.cs@73e9ec2a888af32a76506a274d2f2a7bd4f76cf5`, `D119AgentFeatures.cs@a36e183602d3a150e16bb4c1ac2fca52f33978f3`, `D173DesktopResources.cs@8b0e9ada740eb39a011c6063821a37c2bb2a7dcf`:

- **Agent:** Tài khoản quản trị, PRIMARY/NEXT, PDA/Relay, CPU/RAM/thời gian, Wi-Fi/trạng thái mạng, đăng xuất, cập nhật, xuống nền, chuyển chính, tắt Agent, làm mới phân loại mạng; toàn bộ sáu cột fleet: **Tài khoản / Máy / Vai trò / Web Confirm / Phiên bản / Cập nhật**; bốn nút tăng ca khi có trạng thái.
- **Supra Web:** Web status/info, bật/tắt Agent browser, Web Desktop, kiểm tra Web, tải trình duyệt Agent, bảo vệ Web ở đúng màn hình nghiệp vụ, thanh tiến trình bundle, trạng thái bundle + dữ liệu/cache, mở thư mục dữ liệu, đổi nơi lưu. Không gom bốn nút vào menu ẩn như E179.
- **PickList:** Mã nhập, tìm kiếm, xác nhận tất cả (khi nhiều kết quả), bảng PickList/Thao tác/Trạng thái, trạng thái và thông báo.
- **Desktop:** CPU, RAM, ổ đĩa, băng thông lên/xuống, GPU, sparkline, chọn 1/2/5/10 giây.
- **Danh sách phiên:** 5 bộ lọc và bộ đếm; cột kỹ thuật tùy chọn; tìm MNV/họ tên/nhà thầu; làm mới dữ liệu, kết thúc gọi 60s, liên hệ nhóm, kích toàn bộ; nguồn/kênh/phiên bản/thời gian/hoạt động/trạng thái, 3 nút Kích User/Liên hệ/Kết thúc. Màn hình hẹp **gộp giá trị đầy đủ thành ô nhiều dòng**, không bỏ dữ liệu để tránh cuộn ngang.

Kiểm tra source parity bằng `tests/d173-e180-native-source-parity.test.mjs`: **4/4 PASS**. Native Windows compile/screenshot `D173 E180 Windows Native UI Review` đã SUCCESS theo workflow (mẫu độc lập). Kích thước đo thực: 1600×960 có vùng trên 436px, dưới 436px; 1280×720 có vùng trên 316px, dưới 316px, cả hai `upper_scroll=False` và `roster_scroll=Vertical`.

Các ảnh thực gồm:
- `docs/native-previews/d173-e180-native-1600x960.png` — hiển thị đủ 4 nhóm
- `docs/native-previews/d173-e180-native-1600x960-overtime.png` — bốn nút tăng ca theo trạng thái
- `docs/native-previews/d173-e180-native-1280x720-agent.png`
- `docs/native-previews/d173-e180-native-1280x720-web.png`
- `docs/native-previews/d173-e180-native-1280x720-picklist.png`
- `docs/native-previews/d173-e180-native-1280x720-resources.png`

**Giới hạn vật lý:** không thể hiển thị *đồng thời* bốn khối phía trên cùng mọi nút/bản ghi trên một cửa sổ rất nhỏ, trong khi cấm mọi cuộn và bắt buộc giữ 50/50. Bố cục dùng tab để tiếp cận đầy đủ; khi chiều cao quá thấp cần đặt ngưỡng kích thước tối thiểu hoặc có thiết kế bổ sung. Không tự tuyên bố đạt ở kích thước chưa test.
