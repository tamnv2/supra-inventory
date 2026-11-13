# D173 — Đề xuất tích hợp Launcher / Báo hàng / Agent (13/11/2026)

**Loại:** Owner đưa ý tưởng để phân tích, **CHƯA duyệt code, triển khai, merge hoặc release**. Đây là checkpoint đề xuất, không phải quyết định kiến trúc đã chốt.

## Nguồn đã đối chiếu

- Repo canonical: `main:ops/authority-manifest.json`, `ops/project-scope.json`, `docs/specs/AUTH_RBAC.md`, `docs/specs/REALTIME_NOTIFICATIONS.md` và D173 continuity.
- Repo Launcher khác dự án, **chỉ đọc**: `tamnv2/supra-pda-launcher` (`README.md`, `AndroidManifest.xml`, `MainActivity.java`, `GuardService.java`, `DeviceRegistryClient.java`, `docs/OWNER_RELEASE_SCOPE_POLICY.md`). Repo này **không có trong project-scope.json** của SUPRA Inventory; mọi thay đổi sang repo Launcher phải có quyền/phạm vi riêng được Owner xác định.
- Đã đối chiếu PR D173 #962 thực tế **MERGED** 12/11/2026; không được coi là PR đang mở. Báo hàng hiện có Firebase Auth, RBAC, quản lý phiên và cutoff Picker 14:00/22:00.
- **Nguồn hiện tại:** Launcher `DeviceRegistryClient.API_BASE` và `LauncherPasswordClient.API_BASE` còn hard-code `inventory-beta.supra.cc.cd`, trong khi canonical `ops/project-scope.json` ghi hostname này đã tháo binding và Production dùng `inventory.supra.cc.cd`. Đây là **nguy cơ tương thích cần kiểm tra**, không tự khẳng định mọi thiết bị đang lỗi khi chưa có FIELD/log.

## Yêu cầu Owner — ý tưởng chưa phê duyệt implementation

1. Cải tiến Launcher với đăng ký chờ Admin duyệt trên Web, login mới mở khóa app, đăng nhập Launcher liên kết tự đăng nhập Báo hàng dùng chung user.
2. Agent nhận diện Picker + PDA từ phiên Launcher, không phụ thuộc việc Picker mở/đăng nhập Báo hàng.
3. Chuyển gọi CV/nhắn tin sang Launcher; kích user từ Agent/Web đồng bộ khóa cả Launcher và Báo hàng.
4. Hỗ trợ cutoff/auto logout tại Launcher, cảnh báo trước và gia hạn cho tăng ca để không ngắt việc đang chạy.

## Hướng xử lý đề xuất (không phải quyền triển khai)

- **Backend session authoritative**, Launcher chỉ là cổng vào giao diện; danh tính lấy từ Firebase UID và phiên server gắn `device_key` đã đăng ký, không tin raw serial/IMEI hoặc text do client khai báo.
- Đăng ký self-service chỉ tạo yêu cầu `PENDING` không có quyền; Admin/ROOT duyệt theo đúng RBAC/phạm vi HR, không tạo đặc quyền cho người tự khai. Kiểm tra mã nhân viên trùng, tài khoản đã khóa, cấp quyền khi chưa duyệt.
- SSO qua handoff one-time, short TTL, app đích/backend xác minh package/caller/signature và device/session; **không truyền password, Firebase refresh token qua Intent/clipboard/log**. Báo hàng vẫn phải tự chứng thực trên Backend, dùng cùng Firebase UID.
- Để chặn việc không mở Báo hàng nhưng sử dụng app nghiệp vụ khác, Launcher khóa giao diện chưa đủ; `GuardService` hiện dựa Accessibility, **không phải Android Device Owner/MDM**. Yêu cầu chống lách tuyệt đối chỉ đáp ứng nếu thiết bị hỗ trợ managed kiosk/lock task hoặc app nghiệp vụ cũng kiểm tra server-side active session. Cần xác minh firmware/quyền từng mẫu PDA.
- Agent lấy `UID + device_key + session_generation + last_seen` từ backend/real-time hiện hữu; không chỉ đọc local Launcher. Login/logout/kick/disable/expire là cập nhật trạng thái phiên trung tâm, các app nhận invalidation. Realtime notification dùng tuyến hiện hữu, không thêm heartbeat/query theo từng giây, giữ generation/ACK idempotency.
- Chuyển UI gọi CV/chat sang Launcher nhưng giữ hợp đồng nghiệp vụ, authorization và request_id/ACK cùng Agent, tránh chạy song song 2 nguồn hoặc phát request hai lần. Chỉ chuyển sau khi Launcher tham gia được luồng cũ; không phá app Báo hàng bản cũ.
- Gia hạn phải xác nhận trên backend theo lịch tăng ca/quyền admin, có giới hạn, giữ current cutoff semantics khi chưa duyệt. Cảnh báo và phiên sắp hết hạn không được tự tạo quyền gia hạn.
- Mạng lỗi/offline: không tự sinh phiên hay nghiệp vụ mới, phân biệt lỗi mạng với bị kích; không báo thành công giả. Kiểm tra tác động request/row read/fire quota trước/sau, tối đa tái dùng subscriptions/event hiện hữu.

## Ranh giới và gate

- **Không thay đổi D172** business source, data, session scope hoặc release; thay đổi Firebase Auth/Worker chung chỉ khi Owner duyệt phạm vi và kiểm thử cách ly D172 + D173.
- Stable OWNER-GATED; hai repo giữ PR, CI, signing, OTA và phát hành độc lập. Phát hành Launcher phải theo `ALL/MODEL/DEVICE` cùng phiên bản & phê duyệt Owner riêng.
- Chưa xác minh model/ROM có Device Owner, handoff kỹ thuật, quota mục tiêu và nghiệp vụ gia hạn thực tế. Không có CODE/CI/RELEASE/FIELD/OWNER PASS của đề xuất này.

## Tiêu chí nghiệm thu để Owner xem xét

1. User PENDING/REJECTED/LOCKED không thể mở luồng nghiệp vụ bằng Launcher hoặc mở trực tiếp app; chỉ thao tác cần thiết cho quản trị/khôi phục.
2. Đăng nhập Launcher một lần, Báo hàng nhận cùng UID qua exchange an toàn, không yêu cầu nhập lại mật khẩu; đổi thiết bị/đổi user không tồn tại phiên cũ.
3. Agent xác định đúng Picker và PDA khi Báo hàng chưa mở; online/offline chỉ phản ánh phiên/liveness xác thực.
4. Gọi CV/chat đủ 1 request, đúng người, ACK không lặp; kick/expire khép cả hai app, backend từ chối mọi tác vụ của phiên cũ.
5. Gia hạn chỉ hợp lệ sau server approval; không ảnh hưởng lịch cắt phiên mặc định, không khóa công việc đang được backend cho phép.
6. Đo p95 latency, realtime/HA và Cloudflare Request/Row Read, Firebase usage trước/sau theo cùng tải thực tế; không chấp nhận regressions hoặc phát sinh chi phí thiếu kiểm soát.

**Trạng thái:** REVIEW_ONLY, NO_CODE, NO_RELEASE, Owner approval pending.

## Owner bổ sung 13/11/2026 — ưu tiên chất lượng, logout đồng bộ, SSO xác nhận đơn

**Owner chốt nguyên tắc đánh đổi:** usage có thể tăng; không giảm realtime, tốc độ, độ ổn định để tiết kiệm request/row read. Tối ưu theo bằng chứng và chỉ chấp nhận khi các tiêu chí vận hành không suy giảm. **Không đồng nghĩa Owner cấp lệnh CODE/RELEASE**.

**Owner nêu yêu cầu cần phân tích kỹ thuật**:
1. Đăng xuất Launcher phải kéo Báo hàng logout đồng bộ; hỏi khả năng dọn RAM PDA.
2. Đăng nhập Launcher phải cho Báo hàng đăng nhập sẵn; mở Báo hàng vào ngay cùng user; xác nhận Picklist bằng đúng tài khoản đó.

### Source mới đã kiểm tra
- Android `InventoryApi.login(username,password,deviceId)` hiện tạo Android AppSession gồm `id_token`, `refresh_token`, `userId`, quyền, và mốc `picker_shift_logout_at_ms`; `InventoryApi.logoutInteractive()` gọi `POST /api/auth/logout` và xóa session.
- `MainActivity.logoutWithNotificationCleanup()` dọn overlay, stopOperationalClients, giữ/flush pending session-end runtime log, unregister notification, gọi logout.
- `RelayPocClient.sendProbe()` lấy session Picker và gửi `picker_uid`, `picker_user_id`, `picker_session_generation` vào Firestore; ACK xác minh UID/generation/request_id. Chỉ truyền username không đủ bảo đảm confirm đúng danh tính.
- Launcher `GuardService` là Accessibility, **không phải** Device Owner; thiết bị Android 14+ không cho app thường kill background processes của package khác (Android official ActivityManager reference). Không thể cam kết 'clear RAM toàn máy' bằng Launcher.

### Phương án chi tiết để Owner review — chưa triển khai
- Launcher xác thực Backend, tạo phiên PDA authoritative với Firebase UID, `device_key`, session generation và hạn dùng. Agent/PDA nhận thay đổi qua event/stream hiện hữu, reconnect có resync. Có thể tăng usage để giữ realtime; không thay thế event bằng polling chậm vì mục tiêu quota.
- Khi mở Báo hàng, app chủ động nhận handoff one-time mã sống rất ngắn từ Launcher, exchange với Backend sau khi xác thực UID, `device_key`, phiên hợp lệ, package/signature và one-time nonce; Backend cấp Android AppSession + Firebase custom token tương thích. Không đặt mật khẩu/refresh token trong Intent, clipboard, log. Đây là **silent SSO lúc app được mở**, không ép mở Báo hàng chạy ngầm lúc người dùng login Launcher.
- Tất cả báo hàng, hồi đáp và Confirm Picklist tiếp tục đi từ đúng `AppSession.userId` và Firebase UID/session generation; không tự đổi API/contract `ANDROID_CONFIRM_V1`, ACK/HA.
- Logout Launcher: backend revoke **phiên PDA thuộc D173** trước; báo hàng nhận revocation → dừng realtime/FCM/overlay/in-flight new request, xóa credential/temporary session state, trở về Launcher. Giữ SKU cache hợp lệ, file config, log chưa gửi và durable ACK evidence; không clear toàn RAM hay clear app data. Server vẫn reject phiên cũ nếu app bị force-stop/mất mạng. Khi đang confirm phải giữ idempotency và reconcile kết quả terminal, không tạo duplicate hoặc nhầm success/failure.
- D172 dùng chung identity nhưng **không** bị logout/kick chỉ vì revoke D173 PDA session; không revoke Firebase global user nếu không có quyền D172 liên quan.
- Nếu chi tiết sản phẩm muốn **phiên đã khởi tạo trước khi mở Báo hàng**, chỉ backend phiên launcher tồn tại trước; Android AppSession thực tế khởi tạo silent tại lần mở app. Điều này vẫn đạt kỳ vọng 'mở ra dùng ngay', cần đo độ trễ exchange trên thiết bị thực.

### Tiêu chí kiểm thử bổ sung
- Login Launcher là duy nhất; mở APK không đòi nhập user/password; `userId`, Firebase UID, `device_key`, `session_generation` đúng và có thể xác nhận đơn bằng identity đó.
- Logout/kick Launcher trong lúc Báo hàng foreground/background hoặc offline: Backend ngay lập tức từ chối tác vụ mới; APK local clear khi nhận lệnh hoặc ở lần resume/reconnect; không lộ dữ liệu user trước cho người sau.
- Dùng lại realtime/ACK hiện hữu; đo p50/p95 SSO login, request↔ACK, event→lock, RAM app, bộ nhớ trước/sau logout, Cloudflare DO Requests/Rows Read và Firebase usage. Không khẳng định PASS cho đến khi thực đo trên PDA/Agent thực.
- Trên Android 14+ không kỳ vọng Launcher kill process Báo hàng bằng `killBackgroundProcesses`; dùng self-cleanup trong Báo hàng, không giết tiến trình hệ thống.
