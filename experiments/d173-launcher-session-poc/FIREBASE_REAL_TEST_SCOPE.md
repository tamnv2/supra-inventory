# D173 — SSO từ Launcher sang app test với user Firebase Báo hàng hiện hữu

Owner yêu cầu: đăng nhập Launcher một lần, app test **tự đăng nhập cùng Firebase user**, không có login lần hai, không tạo tài khoản thử hay bổ sung GitHub variables. App test là một client độc lập cho kiểm chứng kỹ thuật và mô phỏng hợp đồng Báo hàng; không sửa APK Báo hàng Production.

- Dùng Firebase `supra-inventory-beta` + Worker `inventory.supra.cc.cd`; Firebase web API key từ biến/secret `FIREBASE_WEB_API_KEY_BETA` đã có trong GitHub environment `beta`.
- Launcher gọi `POST /api/auth/login` với username/mật khẩu hợp lệ, Android `force=false`, chỉ cho role Android được Worker cấp. Đây là login thật, tăng `android_session_generation` và ghi login/audit cho tài khoản được dùng; nếu có phiên khác Worker trả 409 và không đẩy người đang làm việc.
- Launcher nhận `firebase_custom_token` của Worker. App test tự lấy qua explicit Activity ký cùng certificate; `signInWithCustomToken` và so khớp UID, role, user_id, generation qua `GET /api/auth/me`. Không truyền password sang app test.
- Khi logout từ Launcher hoặc app test: cả hai khóa phiên local; yêu cầu Worker thu hồi phiên. Offline có thể trì hoãn xác minh server; phải thử PDA.
- Tất cả thay đổi giới hạn tại `experiments/d173-launcher-session-poc/` và CI build test; không Worker, Firebase Rules/Schema, Android Production/OTA, D172/Stable.

Thử trên PDA: cài **hai APK test**, đăng nhập Launcher đúng một lần bằng tài khoản không có phiên PDA khác, mở app test → tự hiện user/UID/generation. Thử logout cả hai hướng, mở lại, xung đột phiên và mất mạng. FIELD/OWNER PASS chỉ sau kiểm chứng thực tế.
