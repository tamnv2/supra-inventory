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

## Owner follow-up — Agent chủ động phát trạng thái, người đang online và mới login nhận ngay (11/11/2026)
- Owner làm rõ hướng **Agent tự kiểm tra và tự phát khi đổi trạng thái**: Agent OK -> mọi user online nhận, user mới login nhận trạng thái OK đã lưu; Web Supra mất phiên -> Agent phát cảnh báo thay đổi. **Đây là ý tưởng cần review, chưa phải lệnh code/release.**
- Phương án đánh giá tốt nhất: **một tài liệu projection lưu trạng thái cuối cùng (stateful snapshot) + một realtime listener / phiên APK được phép xác nhận**; Agent PRIMARY có quyền công bố khi thay đổi, còn APK mới mở app đọc snapshot đã ghi và gắn listener, không cần Agent gửi lại riêng từng user. Khi ở background/dừng phiên, gỡ listener; khi foreground trở lại nối lại listener và chỉ chấp nhận server-fresh snapshot. Không bật listener duplicate cho mỗi tab.
- Agent giám sát trực tiếp session WMS/login marker, Confirm readiness và vai trò PRIMARY; chỉ công bố READY sau khi đủ điều kiện và generation/lease hợp lệ. Mất phiên khẳng định -> LOGIN_REQUIRED; bắt đầu/chưa hội tụ chuyển quyền -> SWITCHING; agent đang tải Web -> INITIALIZING; khi thấy PRIMARY mới READY thì công bố READY trở lại. Một Agent dự phòng chưa đủ quyền xử lý không được phát trạng thái READY toàn hệ thống.
- **Ngoại lệ bắt buộc:** khi chính Agent mất điện/mạng/treo, không thể tự gửi OFFLINE. Client phải từ chối snapshot quá cũ theo TTL; bắt đầu bằng UNKNOWN hoặc INTERRUPTED, và chỉ dùng OFFLINE khi HA/lease có bằng chứng mọi Agent không khả dụng. Một event-only write thuần túy và banner OK cố định vô thời hạn là sai về tính đúng đắn. Cần kết hợp liveness hiện có hoặc nhịp xác nhận freshness rất thưa để READY không thành false-positive sau khi mất toàn bộ Agent; cân đối Firestore reads/writes theo số người online thực tế.
- Usage: **mỗi thay đổi trạng thái được phân phối cho mỗi listener đang hoạt động**; một READY và một LOGIN_REQUIRED với 40 người đang mở APK tạo tối thiểu khoảng 80 lần nhận document (không tính đọc khi login, reconnect và metadata); nhiều user online hơn sẽ tăng tương ứng. Không thể coi 0-cost, không cam kết free nếu chưa đo. Không dùng liên tục broadcast per-user, per-PDA polling, Worker/DO request; không thay đổi WMS/Confirm transaction.
- An ninh: đối tượng nhận là **user có quyền Picker/Confirm theo hiện trạng**, không tự mở toàn bộ Reporter/Admin/Web; một sanitized status doc chỉ chứa enum, update time, generation-safe version, expiration, không tên/ID Agent, WMS content, token. Firebase Rules chỉ cấp GET riêng doc cho Picker hợp lệ và Agent write role/generation-bound; không cấp rộng trên coordination/roles.
- Tiêu chí review trước Owner approval: APK online thấy đổi trạng thái; login mới thấy trạng thái server-fresh; thiếu nguồn Agent chuyển UNKNOWN thay vì xanh mãi; hai Agent đồng thời không ghi đè sai generation; không đổi quyền hoặc business result; cân usage đo thực tế dưới budget. CODE/CI/RELEASE/FIELD/OWNER chưa thực hiện cho tính năng này.

## Tối ưu usage tiếp theo — giám sát theo sự kiện, heartbeat giới hạn (11/11/2026)

**Yêu cầu Owner:** Picker đang online vẫn biết sự thay đổi trạng thái khả dụng theo realtime; giảm Firestore/Cloudflare usage tối đa. Đây là **đề xuất phân tích**, chưa cấp quyền CODE/Rules/OTA/release.

### Thực tế source main
- Android Picker đã có `AndroidRealtimeClient.kt` WebSocket Cloudflare để nhận sự kiện Báo hàng, nhưng **chưa có nguồn Agent readiness trên kênh đó**. Đưa readiness vào đó đòi hỏi bridge Agent↔Worker/DO và thêm Cloudflare requests/shared-core risk: không chọn làm phương án mặc định.
- Agent PRIMARY hiện ghi lease Firestore mỗi **10 giây**, NEXT_A sử dụng để xác minh failover (nguồn: `FirestoreAgentLeaderCoordinator.cs`). PDA **không nên nghe lease/roles** vì sẽ nhân read theo số Picker và lộ coordination internal. Không tái sử dụng `agent_sync` chứa trạng thái lớn, nhiều thay đổi và chỉ Agent được phép đọc.
- Android Confirm `RelayPocClient.kt` chỉ nghe ACK trên request và khóa Picker lúc cần; không có listener readiness sẵn. Cần đúng **1 listener tài liệu projection riêng cho mỗi phiên Picker foreground** nếu muốn tất cả Picker online nhận cảnh báo kể cả khi đang ở tab Báo hàng.
- Firebase official billing: initial snapshot của một document listener tính một read, mỗi lần document thay đổi/được gửi là một read trên mỗi listener; reconnect có thể tính thêm. Kết nối listener không tự tính read nếu không có thay đổi. Firestore Standard free tier là chia sẻ toàn project, không cam kết còn headroom theo hóa đơn thực tế.

### Thiết kế ưu tiên
1. Khi WMS login/session/Confirm/HA đổi state, chỉ **authoritative PRIMARY theo generation** ghi **1 event update** vào tài liệu `confirm_readiness` đã được sanitize. Picker có quyền hợp lệ giữ 1 snapshot listener trên ứng dụng đang foreground (không nhân theo tab/refresh), nhận ngay bản tin mới; login mới nhận dữ liệu hiện tại từ server.
2. **Không ghi READY theo chu kỳ 10 hoặc 30 giây**; không cho Picker đọc bản lease 10 giây vì 40 picker × 17h × 360 lần/giờ ≈ 244.800 reads/ngày, chưa tính nguồn cũ. Không polling Cloudflare; không gửi FCM topic làm nguồn realtime chính vì FCM topic tối ưu throughput, không cam kết latency.
3. Khi PRIMARY chết nhưng NEXT_A còn sống, tận dụng HA/lease hiện có để NEXT_A chiếm PRIMARY và phát SWITCHING/READY theo chuyển quyền đã xác minh. Các Agent không đủ quyền không được ghi đè. Khởi tạo khi login phải đọc server-fresh snapshot; `fromCache=true` không được báo READY.
4. Nếu toàn bộ Agent chết/mất mạng đột ngột, **không Agent nào phát OFFLINE được**. Do đó cần cơ chế fail-closed local expiry. Đề xuất **renew READY tối đa 5 phút/lần**, chỉ khi không có state change gần đây và Agent PRIMARY+WMS đã kiểm chứng vẫn khỏe; trạng thái không-READY có thể giữ cảnh báo đến khi phát event mới. Nếu hết freshness, APK tự chuyển UNKNOWN (không giữ xanh). Mốc mất toàn bộ Agent phải coi là **bị chặn/trễ đến khoảng 5 phút**, không được hứa realtime 30 giây. Đây là đánh đổi bắt buộc nếu muốn giảm reads với một nguồn Firestore fanout.
5. Có thể nâng cấp **tận dụng sự kiện HA/lease hiện có để phát cảnh báo chuyển quyền ngay**; không được khởi tạo vòng poll Web/WMS khác. Firestore Rules cần cấp riêng GET Picker cho projection và WRITE Agent/PRIMARY có kiểm chứng authority/generation (đánh giá Rules-dependent reads), tuyệt đối không mở quyền `roles`, `agent_sync`, secrets, D172.
6. Khi app background/đăng xuất thì ngừng listener, khi foreground/resume kết nối lại và xác minh server-fresh. Một listener chung theo vòng đời phiên, **không listener riêng mỗi tab**, để Picker đang ở màn Báo hàng vẫn nhận cập nhật; chỉ hiển thị nhãn tại tab Xác nhận đơn trừ khi Owner yêu cầu push ra ngoài.

### Usage biên trên — 40 Picker cùng online 17h, không tính baseline/reconnect
- **Event-only**: 1 lần đọc lúc vào + 4 lần thay đổi trạng thái mỗi Picker ≈ 40 × 5 = **200 Reads/ngày**, nhưng không thể phát hiện toàn bộ Agent mất điện đột ngột một cách có giới hạn.
- **Renew READY 10 phút**: khoảng 40 × (1 + 17×6) = **4.120 Reads/ngày**, 102 writes/ngày, giả định cả 17 giờ READY.
- **Renew READY 5 phút**: khoảng 40 × (1 + 17×12) = **8.200 Reads/ngày**, 204 writes/ngày, giả định cả 17 giờ READY. Nếu thêm 4 thay đổi thực → khoảng **8.360 Reads** và 4 writes khác. Đây là **ước tính thiết kế**, chưa phải usage đo.
- **Renew READY 30 giây**: 40 × (1 + 17×120) = **81.640 Reads/ngày** và 2.040 writes/ngày, vượt mức 50k Firestore Standard daily free reads chỉ riêng feature. Không chọn.
- Khi Agent đã lỗi, có thể ngừng renew READY, chỉ phát event phục hồi. Khi nhiều Picker không thực sự foreground, reads thấp hơn; reconnect, provider Rules-dependent reads, và các listener nền khác cần đo riêng.

### Kết luận để Owner review
Ưu tiên **event-driven realtime + 1 listener/Picker foreground + HA existing + READY renewal 5 phút để fail-close**. Đo thêm usage, độ trễ Agent session expiry đến banner và kịch bản Agent mất điện; nếu đòi nhận biết **toàn bộ Agent chết trong ≤30 giây** với mọi Picker thì cần một kênh quan sát/heartbeat khác và chấp nhận usage tăng, không thể vừa zero-poll/event-only vừa bảo đảm outage detection tuyệt đối. CODE/CI/RELEASE/FIELD/OWNER PASS của E196 vẫn chưa có.
