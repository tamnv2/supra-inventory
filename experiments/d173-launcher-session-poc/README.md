# D173 — Launcher v0.3.26 → SSO protocol proof of concept (isolated)

**Chỉ kiểm thử kỹ thuật, không xác thực nhân sự thật, không thay đổi Production.**

- Source Launcher gốc copy từ `tamnv2/supra-pda-launcher` tag `v0.3.26`, commit `c33a8262669f7ff33e698be86ce6d9c657686988`.
- Source gốc trong `launcher/` được sửa tại ba file để build một Launcher có package độc lập, thêm ba Java class kiểm thử.
- APK 1 `vn.supra.pdalauncher.identitytest`: giữ layout và danh sách ứng dụng Launcher; lúc chưa có phiên, tile mờ và bị chặn; nhập mã định dạng số 5–12 chữ số qua nút **Xác nhận định danh**, mở tile; logout khóa lại.
- APK 2 `vn.supra.identitytest`: app kiểm thử độc lập; khi mở tự yêu cầu phiên Launcher thông qua explicit Activity result và so chữ ký cặp APK. Logout từ một APK làm mất hiệu lực phiên demo trong APK còn lại qua signature-permission broadcast.
- Mã nhân viên chỉ được **kiểm tra định dạng cục bộ**, không kiểm tra tồn tại tài khoản, mật khẩu hay phân quyền từ backend. Chữ `định danh` trên nút là label yêu cầu của Owner, **không biểu thị đã xác minh danh tính thật**.
- **Không có mật khẩu mặc định trong source hay APK**; không thể dùng chung một mật khẩu hard-code ẩn để chứng minh đăng nhập thật, vì có nguy cơ mạo danh bất kỳ user.
- Cả hai APK không có quyền INTERNET; không đụng Firebase, Worker, Agent, Báo hàng, D172 hoặc endpoint Production. HOME/boot/accessibility bị vô hiệu hóa ở bản test để không thay thế/ảnh hưởng Launcher trên PDA đang hoạt động.
- Hai APK phải được build **cùng một CI job** để dùng cùng chữ ký debug; không cài APK một bên từ lần build/nguồn ký khác.
- Cần test trên thiết bị Android thực: (1) chưa xác nhận tile mờ và không mở; (2) nhập mã đúng định dạng tile mở; (3) mở test client tự nhận MNV/session; (4) logout Launcher làm client khóa; (5) login mới thì client nhận generation mới; (6) logout client làm Launcher khóa; (7) app Báo hàng không đổi và không đăng xuất (theo yêu cầu tách biệt).
- Vì là bản demo giao thức cục bộ, **PASS của PoC không chứng minh cơ chế Firebase SSO thật**. Muốn chuyển sang Production phải thiết kế issuer server-side, user validation, enrollment thiết bị, RBAC và one-time token exchange rồi test đúng APK/Agent/Worker có D172 guard.

## Build

Workflow PR: `.github/workflows/d173-launcher-session-poc.yml` build hai `:app:assembleDebug` từ hai Gradle project; artifact APK chỉ dùng kiểm thử nội bộ, không đẩy vào kênh cập nhật Launcher hoặc Báo hàng. Không cung cấp signing production keystore.

**Bản test dùng package khác**, không ghi đè app đang phát hành.
