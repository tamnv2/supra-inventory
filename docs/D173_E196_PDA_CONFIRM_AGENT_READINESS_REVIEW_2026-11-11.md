# D173-E196 — Đề xuất hiển thị trạng thái hệ thống hỗ trợ Xác nhận đơn trên APK (11/11/2026)

## Phân loại quyết định
- Owner **nêu ý tưởng để phân tích**, chưa phê duyệt CODE, Firebase Rules, Android OTA hoặc Production. Đây là **đề xuất/chốt logic đang chờ review**.
- Giới hạn D173 Picker Android ↔ Agent xác nhận đơn. D172 OBPP1291 độc lập HOLD; Stable OWNER-GATED. Không thay đổi nghiệp vụ xác nhận, HA, WMS, Worker/DO hoặc app Báo hết hàng trong giai đoạn đề xuất.

## Sự thật đã đối chiếu từ main `a8ff7fa267702655558ffcb1acd53b159ff1f2a6`
- Android `PickerController.kt` hiện hiển thị kết quả `WMS_LOGIN_REQUIRED`, `SESSION_EXPIRED`, `WMS_SESSION_REQUIRED` **sau** request; chưa có dòng trạng thái Agent sẵn sàng trên tab Xác nhận đơn.
- Android `RelayPocClient.kt` dùng Firebase Auth + Firestore `relay_poc_jobs` cho request/ACK; không có listener chuyên cho readiness trước thao tác.
- Agent `FirestoreAgentLeaderCoordinator.cs` có `WmsReady`, PRIMARY/HA generation, lease và nhánh degraded receiver, có thể PRIMARY còn online nhưng WMS không sẵn sàng. `SupraConfirmBrowser.cs` kiểm tra login marker và readiness DOM, chưa thể coi DOM READY là bằng chứng tab Web hiển thị đúng.
- Rules `firebase/firestore.rules` chỉ cho Agent operator GET `relay_poc_coordination/roles`, `relay_poc_agents`; Picker không có quyền đọc trực tiếp. Tuyệt đối không nới quyền trên tài liệu chứa danh tính nội bộ Agent để phục vụ banner.
- PR #922 đã MERGED vào main, release tag `relay-agent-v188` đã công bố 11/11; đây là **RELEASE** chứ không phải bằng chứng FIELD/OWNER PASS về UI/khả dụng. E196 không kế thừa quyền phát hành E195.

## Trạng thái đề xuất (chỉ copy hiển thị; không phải mã lỗi nghiệp vụ)
1. `READY`: PRIMARY với lease/generation hợp lệ, transport request healthy, Web Confirm đã đăng nhập và sẵn sàng tra cứu/thao tác; thông báo: “Hệ thống hỗ trợ xác nhận đơn khả dụng”.
2. `LOGIN_REQUIRED`: xác nhận được login marker/phiên Supra đã hết trên đường xử lý, **không có Agent thay thế READY**; “Hệ thống hỗ trợ xác nhận đơn đã hết phiên đăng nhập Supra. Vui lòng báo Chuyên viên xử lý.”
3. `OFFLINE`: có bằng chứng toàn bộ Agent không khả dụng, không nhầm timeout/bị chặn Firestore của riêng PDA với Agent offline; “Hệ thống hỗ trợ xác nhận đơn đang không hoạt động. Vui lòng báo Chuyên viên xử lý.”
4. `SWITCHING`: HA thế hệ đang chuyển chủ / manual handoff đang xác minh; “Hệ thống hỗ trợ xác nhận đơn đang chuyển máy chủ. Vui lòng thử lại sau ít phút.” Không cam kết phục hồi đúng 30 giây khi chưa chứng minh.
5. `INITIALIZING`: đã có Agent nhưng WMS Confirm còn tải/khởi tạo; “Hệ thống đang khởi tạo phiên xác nhận đơn. Vui lòng chờ.”
6. `UNKNOWN`: transport báo lỗi, bản tin từ cache, không có dữ liệu đủ mới hoặc không thể phân biệt nguyên nhân; “Chưa xác định được trạng thái hỗ trợ xác nhận đơn.” Không hiển thị xanh theo cache cũ.

Ưu tiên trạng thái dựa trên toàn hệ thống: ưu tiên READY nếu có Agent được công nhận đủ điều kiện, tránh báo hết phiên khi PRIMARY cũ mất phiên nhưng NEXT_A có thể tiếp quản; SWITCHING khi HA chưa hội tụ; LOGIN_REQUIRED chỉ khi có bằng chứng WMS login và không có phương án READY; UNKNOWN khi lỗi quan sát, không gán bừa thành OFFLINE.

## Cách triển khai đề nghị để Owner xem xét
- Đưa **một dòng trạng thái nhỏ, dễ đọc** ngay dưới tiêu đề “Xác nhận đơn” của `view_picker.xml`, đổi text/màu khi status thay đổi; không che input/button, không thay thế kết quả xác nhận.
- Agent xuất **sanitized readiness projection** vào tài liệu riêng (status enum, generation token không định danh, event time, freshness), chỉ khi đổi trạng thái và một nhịp kiểm tra tồn tại có giới hạn. Không để PDA đọc role/presence document nguyên gốc; không phát sinh Worker/DO request.
- APK Picker chỉ đăng ký **một listener trên một document** khi màn Xác nhận đơn hiển thị; đóng listener khi rời tab/logout. Firestore Rules: authenticated valid Picker GET-only, Agent write giới hạn schema + role/authority; không lộ hostname, WMS URL, token, tên/ID Agent; cần Owner duyệt riêng vì thay đổi Rules/transport dùng chung.
- Reconcile trạng thái với lease/generation hiện tại, không để các Agent ghi đè trái quyền khi HA chuyển. Không báo READY từ một bản tin cache/stale; tăng `UNKNOWN` thay vì tiếp tục xanh khi đã quá hạn.
- Giai đoạn đầu **chỉ hiển thị**, không thay đổi điều kiện bật/tắt nút hoặc gửi request/ACK; giữ server/Agent guard đang có. Nếu muốn tự khóa xác nhận theo readiness phải duyệt riêng vì có thể chặn đơn hợp lệ khi status trễ.
- Chỉ cập nhật trạng thái khi có thay đổi thực sự; không polling Cloudflare/DO. Không hứa realtime hoàn toàn khi toàn bộ Agent mất nguồn đột ngột: Firestore không có onDisconnect; cần stale TTL/heartbeat hữu hạn.

## Usage và tiêu chí PASS trước khi triển khai
- Cần đo số Picker thực sự **đang mở tab Xác nhận đơn** đồng thời và ngân sách Firestore còn trống. Nếu 40 listeners duy trì liên tục 17 giờ, keepalive projection 30 giây có thể gây khoảng `40 × 17 × 120 = 81.600` document deliveries/ngày; 120 giây khoảng `20.400`; 180 giây khoảng `13.600`. Đây là **ước tính biên trên cho heartbeat**, chưa cộng retry/reconnect/transition và baseline reads; không khẳng định còn trong free quota. Đổi lại keepalive thưa hơn sẽ làm chậm nhận biết khi toàn bộ Agent chết đột ngột.
- Chỉ thông qua nếu kiểm tra Firebase Rules, roles/generation guard, không báo READY sai khi login hết hạn/không agent/chuyển PRIMARY, stale/firestore offline; kiểm thử 1/3/10 Agent + 40 PDA giả lập và đo provider usage thực. Cần riêng CODE/CI/RELEASE/FIELD/OWNER PASS; không có triển khai trong E196.
