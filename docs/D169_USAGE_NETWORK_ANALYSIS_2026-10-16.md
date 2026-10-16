# D169 — Usage Firebase và mô hình Agent hai mạng, 16/10/2026

**Trạng thái: phân tích / đề xuất, chưa được Owner duyệt triển khai.** Không đổi source chạy thật, Firebase rules, tài nguyên, phiên bản APK/EXE hoặc Stable. Giữ PR #606 Draft, không merge. Hồ sơ này bổ sung E010–E014 bằng ảnh provider và log gốc mới; không coi các phương án cũ là quyết định đã duyệt.

## Phạm vi và cách đối chiếu

- Authority: main `7ec91a75048441b419a20f0a20be7f0021e6cdbe`; working PR #606 `66b6435a415b1dbb39064a76e33e99e4d7891597`. Bootstrap manifest, scope/state/decisions/specs/operating/resource và source liên quan; checks của HEAD trước checkpoint đều completed/success. CI không chứng minh usage hoặc failover thực địa.
- Đọc 4 ảnh Owner gửi: Firebase Firestore Usage, Firestore Operations theo collection, RTDB Usage, Billing Overview. Chỉ số ảnh là số làm tròn hoặc số console, chưa phải export hóa đơn theo SKU.
- Đọc hai thư mục con ngày 15–16 của resource đã đăng ký `logs-folder-beta`. Có 159 mục liệt kê; một bundle Android trùng tên và cùng kích thước được gộp khi phân tích: 135 bundle Android, 21 file Agent, 2 file Web. Android ghi nhận 40 device ID khác nhau và toàn bộ 135 bundle có vc110. Đây là quần thể có log, không chứng minh toàn bộ fleet đều vc110. Agent có v130 và v132.
- Ngày thư mục là ngày archive, không phải toàn bộ thời gian phát sinh. Có log phiên 14/10 được gửi ngày 15 và phiên 15/10 gửi ngày 16. Log Agent sáng 16 kết thúc khoảng 08:38; bundle Android đến khoảng 08:41. Các snapshot Agent/counter tích lũy không được cộng thẳng với nhau. Nhật ký Android có giới hạn và mất sự kiện cũ.
- Counter `D166_USAGE_AUDIT` là số ước tính cục bộ theo lần thử; retry/mất mạng/reset process, giới hạn key và việc chỉ ghi ở boundary khiến chúng khác billable provider. Trong phân tích HTTP Android, dùng MAX theo device + giờ UTC + route/method/status giữa các snapshot để tránh cộng trùng; đây là **cận dưới**, không phải tổng chính xác qua các lần restart.
- Không công khai raw log, tên nhân viên/máy, SSID, device/user ID, SKU, thông tin phiên hoặc URL mang credential. Chỉ giữ số tổng hợp và đường dẫn source.

## 1. Những gì ảnh thực sự thể hiện

| Màn hình | Chỉ số đọc được | Giới hạn diễn giải |
|---|---|---|
| Firestore Usage / current quota period | ~24k read; ~4,2k write; 564 delete; listener peak 58; connection peak 32; ~34k rule allow, 446 deny | Cửa sổ quota khác rolling 1 day; không cộng hai ảnh |
| Firestore Operations / 1 day | 30.860 read; 5.834 write; TTL delete 0 | Số console, có độ trễ; bảng write ghi including deletions; operation và written-document là cột khác nhau |
| RTDB | Peak 3 connection; storage 1,63 KB; download 25,31 MB; load peak 1%; ~24k allow, ~37k deny | Selector ghi current billing period; không mặc định 25,31 MB là download đúng một ngày; REST không nằm trong connection peak |
| Billing Overview | 1–16/10: khoảng 679 đ trước savings, 678 đ savings, còn 1 đ hiển thị | Không phải hóa đơn cuối cùng, không phải tiền Firestore trong 24h; phần dịch vụ phía dưới còn dùng phạm vi ngày khác |

Firestore Operations phân theo collection:

| Collection | Read operations | % trên 30.860 | Write operations trong bảng |
|---|---:|---:|---:|
| picker_alerts | 16.800 | 54,44% | 42 |
| relay_poc_coordination | 7.208 | 23,36% | 2.237 |
| relay_poc_jobs | 934 | 3,03% | 1.393; written documents 1.893 |
| relay_poc_agents | 221 | 0,72% | 213 |
| picker_presence_projection | 168 | 0,54% | 213 |
| relay_poc_agent_sessions | 12 | 0,04% | 4 |
| relay_poc_rate_limits | 2 | 0,01% | 47 |
| picker_active_calls | 1 | <0,01% | không hiện hàng tương ứng trong phần ảnh |
| Phần chênh chưa gán được từ các hàng nhìn thấy | 5.514 | 17,87% | Không suy ngược tổng write từ bảng bị thiếu hàng |

Hai collection đầu chiếm **77,80% read operations nhìn trên tổng ảnh**. Không gọi 5.514 còn lại là một nguyên nhân cụ thể: ảnh chưa đủ hàng/phân rã và meter có khác biệt. Không dùng số index entries analyzed làm số billable reads.

Theo tài liệu Firebase hiện hành, Standard có 50k document reads, 20k writes, 20k deletes miễn phí mỗi ngày cho một database đủ điều kiện/project, reset quanh nửa đêm Pacific; giai đoạn UTC−7 tương ứng khoảng 14:00 VN. 30.860 rolling 24h không phải số quota đã dùng của quota-day. RTDB có 1 GB lưu và 10 GB download/tháng miễn phí; không tính phí theo số read/write kiểu Firestore. Không thể cộng các meter này hoặc suy tiền từ rule evaluations.

## 2. Nguyên nhân theo mức bằng chứng

### A. Đọc cảnh báo legacy không dùng kết quả — SOURCE CONFIRMED, ưu tiên cao nhất

Đường gọi duy nhất hiện tìm thấy:

`D119AgentFeatures.ReconcileD134AgentSync → FirestorePickerContact.LoadOpen → LoadActiveCalls + LoadLegacyAlerts → FirestoreAgentSyncClient.Reconcile`.

`LoadLegacyAlerts` query `picker_alerts`, `status IN (PENDING,SENT)`, LIMIT 100; sau khi tải mới loại CHAT_MESSAGE/hết hạn. Kết quả legacy còn lại gắn `IsActiveCall=false`. Consumer `Reconcile` tiếp tục bỏ mọi phần tử `!command.IsActiveCall`. Vì thế **nhánh legacy không đóng góp vào trạng thái active-call của consumer hiện tại**, dù vẫn tải và trả tiền đọc document. Không được suy diễn thành quyền xóa toàn bộ picker_alerts hoặc bỏ FCM.

Bằng chứng counter của hai phiên PRIMARY khác nhau ngày 15:

| Mẫu | Query | READ_EXTRA_DOCS | Ước tính document reads nhánh này |
|---|---:|---:|---:|
| PRIMARY dùng RTDB heartbeat thành công trong phần phiên | 32 | 3.168 | 3.200 |
| PRIMARY chiều/tối, lease Firestore | 53 | 5.247 | 5.300 |

Mỗi query chạm đúng 100 document theo counter. 8.500 là tổng riêng hai mẫu không trùng; không cộng với 16.800 provider. Con số provider 16.800 đọc trong khi chỉ 42 write của collection củng cố nguyên nhân đọc lặp dữ liệu cũ, không phải 16.800 nghiệp vụ chat mới. Chưa có billing export/callsite trace để gán chính xác toàn bộ 16.800.

**Đề xuất:** bỏ lượt gọi legacy không được consumer sử dụng trong reconciliation; giữ LoadActiveCalls, chat trực tiếp, FCM, xử lý legacy thực sự còn có người dùng. Đây là thay đổi Agent, không cần đổi nghiệp vụ/App để thực hiện riêng điểm này. Kiểm thử đầu ra snapshot/call lock tương đương trước–sau, có cảnh báo cũ/mới/hết hạn/trùng target, và FCM/chat nền. Nếu còn consumer khác được phát hiện khi triển khai, phải giữ và thiết kế query phía server thay vì bỏ tùy tiện.

**Ước lượng:** trần cơ hội của cả collection là 54,44% tổng read hiển thị, không phải cam kết tiết kiệm 54,44%. Một query 100 document không dùng có thể bỏ toàn bộ 100 reads cục bộ; tổng billed saving phải đo cùng ca và giữ các read thật của Functions/FCM. Chưa chuyển tải sang provider khác, không thêm write.

### B. HA fallback + thử RTDB liên tục — FIELD SYMPTOM CONFIRMED, chi tiết căn nguyên còn thiếu

| Mẫu | Chứng cứ |
|---|---|
| NEXT_A 15/10 khoảng 16:57–21:45 | 3.258 PRIMARY_LEASE_READ attempts; 3.255 fallback; 531 RTDB SSE timeout; 541 stream CONNECTED; 52 HTTP 403 |
| PRIMARY chiều/tối ngày 15, gửi archive ngày 16 | 1.624 PRIMARY_LEASE_WRITE attempts; RTDB heartbeat 212 HTTP 401, 1.408 HTTP 403, 2 timeout |
| NEXT_A sáng 16 đến 08:38 | 1.745 PRIMARY_LEASE_READ attempts; 8.589 RTDB SSE HTTP 403; 1.743 takeover probes UNAVAILABLE; vẫn có 79 agent_sync và 107 picker_presence listener events |

Source `RtdbHaLiveness.ObserveLoop` reconnect sau lỗi chỉ 1 giây. PRIMARY thử RTDB heartbeat khoảng 10 giây, chỉ ghi Firestore lease khi RTDB write thất bại. NEXT_A mất RTDB đọc Firestore lease; khi lease cũ lại probe RTDB, rồi defer nếu UNAVAILABLE. Do đó PRIMARY dùng RTDB bình thường nhưng NEXT_A Office không dùng RTDB có thể thấy lease Firestore mãi cũ và không đủ bằng chứng takeover. Kéo dài polling không sửa được quan hệ bất nhất này.

Quan trọng: HTTP 403 trong log chưa phân biệt proxy với Firebase permission denied. **37k deny ở Rules console chứng minh có những request đến Firebase và bị rules từ chối**, không thể quy tất cả cho firewall Office. 401/403 cần kiểm tra token refresh/claim/rules theo path và mã lỗi an toàn; không mở rules rộng. RTDB stream CONNECTED chưa chứng minh nhận heartbeat đúng PRIMARY/generation. Chưa xác định nguyên nhân mọi timeout; cần đối chiếu stream lifetime/keepalive/read timeout khi kiểm thử.

Mức tải RTDB 1% và data 1,63 KB loại trừ nhận định hiện đang quá tải dung lượng; network reconnect, từ chối và trạng thái HA mới là điểm cần xử lý. Provider download bao gồm overhead/TLS và traffic bị rules từ chối; không thể gán 25,31 MB chỉ cho dữ liệu heartbeat.

### C. Nghiệp vụ Picklist/ACK/guard — phần lớn có mục đích, không cắt thô

`relay_poc_jobs` có 934 read operations, 1.393 write operations; confirm guards 437 write operations. Request tạo mới, PRIMARY nhận, xác minh vai trò, khóa trùng, WMS UI, kết quả durable ACK, listener PDA và archive đều có thể phát sinh thao tác. Không diễn giải một Picklist chỉ cần một read/write.

Một PRIMARY mẫu có 1.645 CONFIRM_QUERY attempts cạnh 357 pending-listener events: watchdog vẫn phát sinh query dù listener hoạt động. Các query rỗng có thể bị tính tối thiểu một billed read dù không hiện trong Usage dashboard. Source đã có listener payload fast path và watchdog 10s active/30s inactive; không đề nghị bỏ watchdog hay kéo thời gian tùy tiện. Chỉ giảm đọc trùng khi có bằng chứng đồng bộ stream/cursor, giữ fallback và hạn chờ PDA.

564 delete và đỉnh buổi sáng phù hợp source `service/src/relay-audit.ts`: sau export Drive được xác nhận, xóa terminal jobs của ngày đóng và cleanup giới hạn. Functions log upload cũng có delete parts sau thành công. **Đây là suy đoán có căn cứ, chưa có receipt/provider trace để chia chính xác 564**. TTL 0 là không có TTL delete trong ảnh đó, không phải database không có delete.

### D. Listener và snapshot fan-out — có thể tối ưu cấu trúc, không cắt listener thiết yếu

58 listener/32 connections không tự chứng minh leak. Picker Android hiện listen exact document active-call và session-control; riêng hai listener/PDA đã giải thích được quy mô này. Agent listen agent_sync + picker_presence, PRIMARY listen pending jobs, Agent listen handoff. Kết nối server và mobile có cách đếm khác nhau.

Một thay đổi document có nhiều subscriber có thể tạo nhiều reads. Không đưa heartbeat 10s vào agent_sync mà mọi Agent đều nghe, vì sẽ làm tăng fan-out và truyền lại history/presence. Source Mutate đã có SKIP_NO_CHANGE; không đề xuất lại như thể chưa có. Có thể tách hot lease/cold role/UI snapshots, chỉ subscribe phần cần theo vai trò; multiplex gRPC giảm overhead kết nối nhưng **không miễn phí document reads**.

### E. HTTP result-stage lặp — bằng chứng rõ, thuộc Worker/DO và pin PDA

Sau gộp MAX theo device-hour-route/error giữa 135 bundle: ít nhất **2.447 RESULT_ACK_NOT_FOUND / HTTP 404** trên 29 PDA trong phần giờ của ngày 15–sáng 16 (1.454 ngày 15, 993 sáng 16). Không cộng snapshot tích lũy và không coi là billed totals. Các giờ trước cửa sổ ảnh có thể nằm trong số này.

`service/src/operational-v2-core.ts:updateResultStage` trả lỗi khi không có acknowledgement row đúng event/user. Cả RECEIVED, DISPLAYED, ACKNOWLEDGED dùng endpoint này nên tên lỗi không chứng minh người dùng đã bấm ACK 2.447 lần.

Source đã quarantine lỗi ACKNOTFOUND cho **overlay acknowledgement**, nhưng `MainActivity.drainNotificationReceipts` dùng pendingResultEvents không gắn user, catch mọi lỗi và giữ lại để thử sau, cũng chưa có single-flight giống overlay drain. Đây là **ứng viên source mạnh** cho retry lặp/cross-session, chưa đủ trace stage/event an toàn để gán toàn bộ 2.447 request. Cần scope receipt theo chủ phiên, xử lý lỗi vĩnh viễn có giữ bằng chứng, single-flight/dedupe; không giả ACK và không bỏ transient retry. Phần này cần Android update và test Core/notification contract, không phải tiết kiệm Firestore trực tiếp.

### F. Chat, log, Apps Script và các meter chưa đủ chứng cứ

- Mẫu Agent có 42 picker-chat-direct và 42 picker-chat-fcm-fallback write. Source chủ động giữ hai đường tương thích/background; tổng write của picker_alerts trong ảnh là 42. Đây không phải điểm đọc 16.800 nghiệp vụ. Không bỏ FCM hoặc khả năng đánh thức nền chỉ vì mẫu Android đều mới; có thể nghiên cứu gộp publication sau khi kiểm chứng toàn fleet/OS/process-death.
- 31 bundle Android sáng 16 có reason global_support_request, phù hợp lệnh yêu cầu toàn thiết bị gửi log; không gọi đó là tự gửi mỗi khi có lỗi. File error_agent có thể thuộc phiên cũ/lưu bù. Hai ngày archive không thể quy thành UrlFetchApp executions hoặc log Firestore parts.
- Gateway Apps Script vẫn có các nhánh xác thực/proxy Worker, log/Drive và Monitoring; Usage UI Agent hiện còn lịch quarter-hour, cache chung 15 phút. Timer local 30s không tương đương một UrlFetch mỗi 30s. Bỏ cơ chế tự lấy Usage như hướng đã bàn có thể giảm Apps Script/Monitoring, **không** trực tiếp giải thích collection read. SKU D168 dùng Worker trực tiếp; không áp hệ số UrlFetch của mô hình SKU cũ.
- Thiếu usage export Cloudflare Worker requests/CPU, DO duration/SQLite rows, Cloud Run/Functions invocations/GB-seconds, Auth quota, egress theo SKU và Apps Script shared-account executions. Không khẳng định tiền hoặc phần trăm tiết kiệm các meter này. Billing hiện rất thấp; chưa có lý do đổi provider chỉ để giảm tiền bằng suy đoán.

## 3. Phương án Agent đề nghị

### So sánh ba hướng

| Phương án | Usage | Realtime / ổn định | Kết luận |
|---|---|---|---|
| Giữ nguyên, chỉ đo | Không thêm migration | Giữ điểm lỗi mixed-network hiện tại và các vòng lặp | Làm baseline, không phải đích cuối |
| Sửa điểm nóng trên provider hiện có | Bỏ query legacy không dùng; dừng RTDB retries vô ích; giảm snapshot/retry trùng | Ít đổi contract, phù hợp ưu tiên trước | Làm trước |
| Phân bổ liveness theo cặp HA trên RTDB/Firestore hiện có | RTDB cho cặp dùng được; Firestore listener cho cặp cần Office; không nhân heartbeat theo toàn fleet | Cần phối hợp mode/generation/lease và kiểm thử partition | Đích đề nghị, sau bước sửa điểm nóng |

Chưa chọn Pub/Sub/Ably/Supabase/Cloudflare làm kênh Office: chưa có chứng cứ mạng Office truy cập được và resource ngoài scope chưa được duyệt. Không mặc định thêm server/proxy/LAN bridge hay bypass mạng công ty.

### Tách phần nghiệp vụ, quyền lãnh đạo và tín hiệu sống

1. **Nghiệp vụ giữ nguyên:** Báo hàng Web/PDA → Worker/InventoryCore; Picklist PDA ↔ Firestore ↔ PRIMARY ↔ WMS browser UI; Auth, FCM, ACK, guard/idempotency, audit/Drive tiếp tục đúng contract. Không offline business, không WMS API mới, không quyền Stable.
2. **Lãnh đạo chung:** Firestore roles/generation/CAS là authority cho mọi mạng. Mỗi job và trước thao tác WMS quan trọng vẫn xác minh quyền; heartbeat và SSID không cấp quyền mutate.
3. **Liveness chọn theo cặp PRIMARY–NEXT_A đang chịu trách nhiệm tiếp quản**, không tự chọn riêng mỗi máy rồi bỏ mặc peer:

| PRIMARY | NEXT_A | Kênh liveness đề nghị |
|---|---|---|
| PDA/Internet có RTDB | PDA/Internet có RTDB | RTDB, không heartbeat Firestore liên tục |
| Office chỉ Firestore | Office chỉ Firestore | Firestore exact lease listener, không thử RTDB mỗi vòng |
| PDA/Internet | Office | Firestore chung cho cặp; không để PRIMARY chỉ phát RTDB |
| Office | PDA/Internet | Firestore chung cho cặp; NEXT_A không tự đòi RTDB |
| Cặp HA dùng RTDB, Agent Office chỉ DEEP không thuộc standby đang bảo đảm SLO | tùy fleet | Không thêm heartbeat Firestore chỉ vì có máy Office; khi đổi cặp phải thỏa thuận mode trước |

Nếu Office NEXT_B được yêu cầu tiếp quản nóng với cùng SLO thì phải đưa nó vào quyết định kênh chung; không xếp như DEEP chỉ để tránh write. NEXT_B và DEEP không tự chạy cùng vòng lease/pending query của NEXT_A/PRIMARY. Lựa chọn cặp cùng mạng có thể tối ưu thêm nhưng không được làm Office mất khả năng tiếp quản khi không còn peer phù hợp.

### SSID, mode và chuyển mạng an toàn

- Lưu danh sách SSID/profile Office/PDA tại máy theo cấu hình được phép; dùng sự kiện WLAN/network thay đổi. Không poll netsh nhanh, không ghi danh sách riêng vào repo/log public.
- SSID là gợi ý policy, không phải bằng chứng endpoint thông hay người dùng có quyền. Ethernet/VPN/multiple NIC/SSID không biết phải có trạng thái UNKNOWN và chọn kênh chung an toàn; lỗi nghiệp vụ thật quyết định degrade. Không dùng ping liên tục để nhận diện Office.
- Lưu heartbeat_transport/mode epoch gắn generation trên coordination metadata được kiểm soát; PRIMARY và NEXT_A xác nhận đã áp mode. Khi đổi mạng/mode, dùng make-before-break **trong cửa sổ giới hạn**, chỉ bỏ kênh cũ khi peer có tín hiệu mới. Không phát hai heartbeat vĩnh viễn. Old Agent không biết mode phải giữ đường tương thích cho đến khi được thay; chưa đủ điều kiện thì không bật tối ưu mới.
- Firestore mode: chỉ NEXT_A nghe exact lease; server updateTime/heartbeat sequence kết hợp monotonic receive-time và deadline cục bộ, không GET theo chu kỳ khi stream đang đồng bộ. Phải kiểm tra CURRENT/reset/cursor, token refresh, offline/half-open; không coi snapshot cache cũ là heartbeat mới. Khi mất stream, fallback REST có deadline và retry budget tương ứng SLO, không polling nền cho cả fleet.
- Giữ threshold nghi ngờ 15s để so sánh, không gọi đó là cam kết takeover hoàn thành 15s. CAS + local WMS readiness/probe + freshness/generation và xử lý thao tác WMS đang chạy/không rõ kết quả là bắt buộc. Primary mất Firestore thì không được tiếp tục nghiệp vụ chỉ vì RTDB khỏe. Uncertain final-click/ACK phải giữ guard và đối soát, không cho hai Agent xác nhận lặp.
- Trong RTDB mode, quyền transition/fallback cũng phải được Firestore-authorized. Không cho NEXT_A tự kết luận PRIMARY chết từ một timeout hoặc nhảy sang lease cũ chưa được PRIMARY cam kết xuất bản.

### Ước lượng meter của liveness (không phải kết quả đo)

Với heartbeat 10s, một PRIMARY và một NEXT_A, không tính reconnect/rules/roles/confirmation traffic:

| Thời gian | Firestore heartbeat writes khi cần Firestore mode | NEXT_A document reads khi nghe mỗi heartbeat |
|---|---:|---:|
| 1 giờ | 360 | 360 |
| 16 giờ hoạt động | 5.760 | 5.760 |
| 24 giờ | 8.640 | 8.640 |

So với NEXT_A mẫu ngày 15 ~679 lease attempts/giờ, listener lý tưởng ~360 events/giờ có thể giảm khoảng 47% **phần lease-read attempts của riêng mẫu**. Hai giờ trọn 06–07 sáng 16 trung bình 638 attempts/giờ → tiềm năng gần 44%. Không coi đây là giảm tổng Firestore 44–47%; ràng buộc billing/rules/reconnect và cửa sổ mẫu vẫn còn.

Nếu PRIMARY đang Office và đã ghi lease ~10s, đổi consumer sang listener không cần thêm một luồng writes tương tự. Nếu PRIMARY đang PDA và NEXT_A Office, phải thêm Firestore heartbeat để có bằng chứng sống chung; đó là **đổi read/waste lấy write/correctness**, không được gọi là giảm tất cả usage. Chỉ bật mode này cho cặp cần nó. Trong cùng mạng RTDB, giữ heartbeat ở RTDB tiếp tục tiết kiệm document operations; bytes/tải RTDB phải đo riêng.

Không chọn heartbeat 30–60s rồi hứa giữ nguyên HA 15s. Không chuyển heartbeat sang agent_sync cho toàn bộ subscriber. Không tắt FCM/listener kick/session hay bỏ kết quả ACK để đạt quota mềm.

## 4. Lộ trình và ma trận chấp nhận

Khuyến nghị chốt theo hai gói: **(1) Agent hot-path: query legacy + RTDB error classification/backoff/SSID policy; (2) HA mode chung và exact lease listener**, kèm sửa receipt Android như luồng riêng có liên quan. Bước (1) backoff RTDB đơn thuần không được coi đã sửa HA Office; mode cần hoàn tất để bảo toàn failover.

| Yêu cầu | Component/contract | Test/evidence trước phát hành |
|---|---|---|
| Bỏ read không dùng, không đổi cuộc gọi | Agent LoadOpen/Reconcile/call lock | Cùng inputs → cùng snapshot/call state; legacy/new/expired/chat/duplicate target; foreground/background delivery giữ nguyên |
| Realtime nhận Picklist không chậm | PRIMARY listener + REST watchdog + PDA ACK | Burst/idle/reconnect, cùng request ID qua 2 đường, latency p50/p95/p99 và terminal ACK; không giảm watchdog trước proof |
| HA mọi mạng | RTDB/Firestore roles/lease | PDA–PDA, Office–Office, hai chiều mixed; abrupt kill, proxy 403, token expiry, lost stream, stale snapshot, clock skew, split connectivity, simultaneous candidates |
| Không xác nhận WMS hai lần | generation/CAS/guard/WMS UI | Primary bị treo/mất mạng giữa final-click và ACK; old leader quay lại; uncertain terminal quarantine; no false success |
| Chuyển mạng/mode | SSID + event + mode epoch | SSID sai/unknown/Ethernet/VPN/multi NIC; chuyển khi đang có job; bounded handover; giữ kênh cũ đến khi peer xác nhận |
| Tương thích | Agent v130/v132 + candidate, Android vc110 | Không bật protocol mới cho peer cũ; rollout theo capability; rollback không đọc lease stale như authority mới |
| Presence/chat/kick/permissions | Agent/Android/Firestore/FCM | Logout/kick/disconnect, App process death, token refresh, version/session generation; giữ role separation |
| Hạn chế receipt lặp | Android/Core result-stage | Đổi tài khoản, event không thuộc user, RECEIVED vs DISPLAYED vs ACKNOWLEDGED, permanent 404 vs transient lỗi; không giả ACK |
| Ngày/ca và archive | Agent/Core/Drive/Apps Script | 00:00/03:00/05:00/14:00/21:45 theo đúng loại boundary; archive receipt trước cleanup; không bỏ log chưa upload |
| Usage thực | Provider billing/operations + counter cục bộ | So cùng ca/số giờ Agent/số nghiệp vụ; read/write/delete, query-empty/index/rule reads; RTDB bytes/rejects; Worker CPU/SQL rows; Functions/UrlFetch riêng |

Chấp nhận khi latency/failover/terminal correctness không xấu hơn baseline tương đương, không lost/duplicate WMS confirmation, không false ACK, CPU/pin/network không tăng, và saving được provider xác nhận. Rollback theo protocol/version đã tương thích; không đổi domain/provider/Stable. Không đánh dấu field/Owner PASS từ source tests hoặc CI.

## Nguồn trực tiếp

- Repo: `relay-agent/FirestorePickerContact.cs`, `relay-agent/D119AgentFeatures.cs`, `relay-agent/FirestoreAgentSync.cs`, `relay-agent/FirestoreAgentLeaderCoordinator.cs`, `relay-agent/RtdbHaLiveness.cs`, `relay-agent/FirestoreConfirmationTransport.cs`, `relay-agent/FirestoreD157Realtime.cs`, `relay-agent/FirestoreQuotaGuard.cs`, `relay-agent/D160Usage.cs`, `relay-agent/AgentLogUploadBridge.cs`.
- Android: `PickerActiveCallWatcher.kt`, `RelayPocClient.kt`, `MainActivity.kt`, `InventoryApi.kt`, `NotificationSignalStore.kt`, `CriticalOverlayService.kt`, `PickerController.kt`, `D166UsageAudit.kt` trong package Beta.
- Service/Google: `service/src/operational-v2-core.ts`, `service/src/relay-audit.ts`, `functions/src/index.ts`, `firebase/database.rules.json`, `firebase/firestore.rules`, `ops/apps-script/agent-log-gateway/Code.gs`.
- Bốn ảnh Owner gửi và các bundle trong Beta Logs ngày 15–16/10; raw evidence chỉ đọc riêng tư. D169-E010–E014 là lịch sử phân tích, số mới ở hồ sơ này được đối soát lại với raw.
- Official Firebase: https://firebase.google.com/docs/firestore/pricing ; https://firebase.google.com/docs/firestore/monitor-usage ; https://firebase.google.com/docs/database/usage/billing . Đã kiểm tra ngày 16/10/2026. Console estimate không thay thế billing report; listener/empty query/rules/index và RTDB overhead có cách tính khác nhau.

**Bước được phép hiện tại:** lưu phân tích D169 và trình Owner chọn thiết kế. Chưa có quyền chạy code hoặc triển khai các tối ưu mới từ yêu cầu phân tích này.
