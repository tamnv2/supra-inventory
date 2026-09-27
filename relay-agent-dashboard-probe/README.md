# D127 Dashboard Probe v2

Mục tiêu: so sánh **thao tác tự động** với **thao tác người dùng thật** trên Supra Dashboard mà không đọc hoặc xuất dữ liệu đăng nhập/phiên.

## Cách dùng

1. Giải nén toàn bộ ZIP và chạy `SUPRA.Dashboard.Probe.exe`.
2. Nhập URL cần kiểm tra vào ô **URL**. Probe chỉ cho phép HTTPS trên đúng `auth-supra.winmart.vn` hoặc `wms-supra.winmart.vn`; URL có user/password bị từ chối.
3. Bấm **Đi tới**. Nếu Supra yêu cầu đăng nhập, đăng nhập trực tiếp như trình duyệt bình thường.
4. Khi trang cần kiểm tra đã tải xong, bấm **Tự động kiểm tra**. Probe thử hữu hạn: DOM click → synthetic pointer → CDP `userGesture=true` → browser-level mouse → Enter → Space. Dừng ngay khi có navigation/new-window.
5. Với new-window hợp lệ, v2 **không ép cùng tab**; để WebView2 xử lý popup mặc định nhằm giữ hành vi gần trình duyệt thường hơn.
6. Nếu tự động không chuyển trang hoặc target chưa đủ duy nhất, bấm **Theo dõi thao tác người dùng**, sau đó tự bấm đúng nút **Truy cập** một lần.
7. Bấm **Mở thư mục log** và gửi file `dashboard-probe-v2-*.log` mới nhất vào project chat.

## Log được phép ghi

- Navigation/Source/NewWindow với URL đã bỏ toàn bộ query và fragment.
- Event trên đúng phần tử mũi tên truy cập: `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `click`, Enter/Space.
- `isTrusted`, `defaultPrevented`, thứ tự mũi tên, tổng số mũi tên, vị trí/kích thước và các cờ semantic dạng boolean.
- Runtime/host build và trạng thái probe.

## Tuyệt đối không ghi/đọc

- password hoặc nội dung ô nhập;
- cookie, token, header, request body;
- localStorage/sessionStorage;
- browser profile;
- DevTools Network;
- thông tin query/fragment của URL.

Probe không gửi log đi đâu; log chỉ nằm local tại `%LOCALAPPDATA%\SUPRA Inventory\DashboardProbeV2\Logs`.

Không có stealth, user-agent spoofing, bypass `AutomationControlled`, giả header/referrer hoặc cơ chế né giám sát. Đây là công cụ Beta diagnostic; Stable không bị thay đổi.
