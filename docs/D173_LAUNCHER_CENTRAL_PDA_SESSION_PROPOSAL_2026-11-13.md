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
