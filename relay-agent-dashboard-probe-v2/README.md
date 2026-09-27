# D127 Dashboard Probe v2

Mục tiêu: so sánh thao tác tự động với thao tác người dùng thật trên luồng Supra Dashboard mà không đọc hoặc xuất dữ liệu phiên/đăng nhập.

## Cách chạy

1. Giải nén toàn bộ ZIP và chạy `SUPRA.Dashboard.Probe.V2.exe`.
2. Nhập URL cần kiểm tra vào ô URL. Probe chỉ chấp nhận HTTPS trên đúng `auth-supra.winmart.vn` hoặc `wms-supra.winmart.vn`.
3. Bấm **Đi tới**. Nếu cần đăng nhập, đăng nhập trực tiếp trong cửa sổ trình duyệt như bình thường.
4. Khi trang cần kiểm tra đã tải xong, bấm **Tự động kiểm tra**. Probe chỉ thử một ma trận hữu hạn: DOM click, synthetic pointer, CDP userGesture, browser-level CDP mouse, Enter và Space.
5. Probe giữ hành vi popup/new-window bằng một WebView2 con dùng cùng environment/profile thay vì ép về cùng tab.
6. Nếu tự động không chuyển trang hoặc không xác định duy nhất target, bấm **Theo dõi thao tác người dùng**, sau đó tự bấm đúng nút **Truy cập** trên Dashboard một lần.
7. Bấm **Mở thư mục log** và gửi file `dashboard-probe-v2-*.log` mới nhất vào project chat.

## Quy tắc dữ liệu

Probe v2:
- chỉ ghi local vào `%LOCALAPPDATA%\SUPRA Inventory\DashboardProbeV2\Logs`;
- không gửi log đi bất kỳ dịch vụ nào;
- không bật DevTools Network;
- không đọc cookie, token, header, web storage, password, request body hoặc browser profile;
- không ghi nội dung ô nhập;
- URL trong log chỉ còn scheme + host + path, bỏ query và fragment;
- log thao tác chỉ gồm loại event, `isTrusted`, trạng thái preventDefault, cấu trúc phần tử không chứa text/value, tọa độ/kích thước, frame depth và fingerprint SVG/semantic dạng boolean;
- không có stealth, user-agent spoofing, `AutomationControlled` bypass hoặc cơ chế né giám sát.

Đây là công cụ Beta diagnostic; Stable không bị thay đổi.
