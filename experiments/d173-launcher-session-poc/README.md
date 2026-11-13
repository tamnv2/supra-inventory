# D173 — Launcher tự đăng nhập app test bằng Firebase Báo hàng

- Hai APK kiểm thử độc lập: Launcher `vn.supra.pdalauncher.identitytest` và app test `vn.supra.identitytest`; không ghi đè ứng dụng Báo hàng thật.
- Dùng Firebase/Worker hiện hữu. CI lấy API key đã dùng trong build Báo hàng ở GitHub environment `beta`; **không tạo user QA, không nhập tài khoản trong GitHub**.
- Đăng nhập **một lần** tại Launcher bằng tài khoản/mật khẩu Báo hàng hiện có. Mở app test: tự nhận custom token được Worker phát hành, xác minh UID, role và generation. App test không cần nhập tài khoản/mật khẩu.
- `force=false`: không tự đẩy phiên PDA hiện đang sử dụng ra ngoài; nếu có phiên khác sẽ từ chối. Token chỉ trong RAM của Launcher, IPC kiểm tra package/chữ ký, không ghi password.
- Đăng xuất ở một app khóa cả hai, Worker chịu trách nhiệm thu hồi phiên. Cần kiểm thử PDA thực trước khi xác nhận FIELD PASS.
