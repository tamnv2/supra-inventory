# D173-E195 — Agent188 khôi phục source Agent185 và chẩn đoán FIELD (11/11/2026)

## Lệnh Owner mới nhất
1. Phát hành **Agent188** từ đúng runtime source đã ký **Agent185** (`relay-agent-v185`), không dùng trình duyệt WebView2 nhúng mới Agent187.
2. Thêm log chẩn đoán tab Web trắng **sau khi đăng nhập**, cùng nguyên nhân nút giao diện chồng/che nhau.
3. Năm nút Agent theo thứ tự trái→phải: **Chọn Agent chính | Cập nhật | Chạy nền | Đăng xuất Agent | Tắt Agent**. Giữ nguyên click handler, RBAC và OTP.
4. Ẩn tiêu đề **Danh sách phiên hoạt động** và dòng **Phiên ghi nhận · Web/PDA mẫu 5 phút/lần** trên giao diện (không xóa nguồn dữ liệu).
5. Đưa ô tìm kiếm ngắn lên **đầu tiên** trong cùng hàng với các bộ lọc/nút; bỏ nhãn tìm kiếm.
6. Các nút roster chung **một hàng**, chiều rộng đo theo `TextRenderer`, không chồng/che chữ. Khi viewport vật lý không đủ tổng kích thước tối thiểu, chỉ riêng thanh nút có cuộn ngang để không cắt/đè thông tin hoặc làm mất thao tác; không giả định tất cả nút cùng hiện đủ ở mọi độ rộng.

## Căn cứ nguồn và phạm vi
- Main lúc mở nhánh: `3983e9e2e6fbf724e82c60c05ea5aaac5c13cdc8`; Agent187 đã phát hành nhưng **FIELD FAIL**.
- Agent185 tag `relay-agent-v185` trỏ commit `ca14deee4999f5f31066208c0baa957bec923de7`, Host14 giữ nguyên. Chỉ những file `relay-agent/` trong whitelist thay đổi so với v185; hai file E190 tạo riêng ở v187 được xóa khỏi source Candidate.
- Evidence từ log Agent (không đưa lên public repo): v185 gửi log Apps Script PASS; v186/v187 Firestore fallback HTTP403, Firebase refresh HTTP400, v187 WebView2 COMException/timeout. Release workflow v186/v187 trước đó không inject hai biến build; đây là lỗi build độc lập với nguyên nhân Web trắng.
- Workflow v188 chỉ Agent (không chạm Worker, Web, Android, Firebase Rules, Host14, D172, Stable), yêu cầu cấu hình Firebase và Google Apps Script HTTPS hợp lệ từ beta Environment trước build; thiếu cấu hình ⇒ FAIL CLOSED, không phát hành EXE lỗi mới.
- Telemetry v188 chỉ ghi trạng thái DOM/loaded/hydrated, host/window/parent/visible/viewport, DPI, giới hạn log khi chuyển trạng thái hoặc sau 2 phút; **không ghi URL, nội dung WMS, tài khoản, token, screenshot hoặc secret**. `visual_proof=UNVERIFIED` không được gọi là chứng cứ màn hình đã hiển thị.

## Mốc xác minh
- Pin Agent188 runtime source: `57c408ba25542ba61612d3ed38b0e9e485cce767`.
- Protected PR: [#922](https://github.com/tamnv2/supra-inventory/pull/922).
- Yêu cầu kiểm thử: source-native Windows x64 build, startup + auth/HA/Confirm smoke, 5 nút đúng, roster 1 dòng + fallback quá hẹp không chồng, không tràn ở HD/HD+, D172 source isolation, release workflow Firebase/Apps Script config validation.
- Mốc **RELEASE PASS**: tag `relay-agent-v188`, exact EXE SHA-256, inventory-channel `agent-latest.json` và EXE/SHA đọc lại đồng nhất, Host14 SHA unchanged.
- Mốc **FIELD PASS** chưa đạt: đăng nhập 3 Agent; xem Web Confirm bằng mắt sau login và khi chuyển tab/RDP; kiểm tra button ở 1280×720, 1366×768, 1600×900, 1920×1080, DPI 100/125/150%; thử đăng nhập/Confirm và xác nhận log thật lên Drive.
- **OWNER PASS** chỉ khi Owner xác nhận. D172 độc lập HOLD; Stable OWNER-GATED.

## Trạng thái tại checkpoint code
CODE CANDIDATE trong PR, CI đang kiểm thử. Chưa phát hành Agent188; chưa có FIELD/OWNER PASS.
