# D173-E108 — Base production và phương án giảm Cloudflare DO request

Ngày 01/11/2026, giờ Việt Nam. **ĐỀ XUẤT ĐỂ OWNER CHỐT. Chưa sửa nguồn ứng dụng, chạy thử ứng dụng hay triển khai phương án.**

## 1. Base dùng cho toàn bộ phân tích

Base là tổ hợp các thành phần thực sự được phát hành, không phải mọi code có trên nhánh mới hoặc toàn bộ trạng thái lịch sử trong `project-state.json`.

| Thành phần | Base đã xác minh | Bằng chứng |
|---|---|---|
| Worker, InventoryCore SQLite và Web assets | `f15b9675b7de33194dbb43980fd5934ee09958fc` | [Deploy Worker 41002569184 SUCCESS](https://github.com/tamnv2/supra-inventory/actions/runs/41002569184); GET production `/health` lúc 10:21:56 VN ngày 01/11 trả đúng SHA, storage OK, schema 17, operational schema 7. |
| Web | 3.3.2 | `web/` tại Worker source trên; không khác executable source ở main `1ccb12a55a3104729881714953735a7654f9231b`. |
| Windows Agent | Kênh phát hành v162, source `d7dab62bf482b8a080eb75c8e18ba328e287a7fe` | [Tag v162](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v162), receipt E104; EXE tag và channel cùng SHA-256. Không suy ra mọi máy đã cài v162. |
| Android Báo hàng | vc121, source `e45eafd8fbc69edf6a75c750f61ad9808237394f` | [Tag vc121](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc121); manifest PDA đọc trực tiếp trả vc121/source này. Không suy ra toàn fleet đã cập nhật. |

Đã đối chiếu `service/`, `web/`, `android/` và `relay-agent/` với source phát hành tương ứng. Main dùng đọc authority là `1ccb12a5…`; các cây executable liên quan không có diff với base tương ứng.

PR814 là code Web Presence chưa merge/phát hành. PR803 là điều tra FIELD FAIL. PR794 và PR804/E106–E107 là lịch sử phân tích/đề xuất; PR804 đã đóng, không merge. Tất cả được loại khỏi base executable. Số đo lịch sử có nguồn riêng có thể được tham khảo với ngày và giới hạn rõ ràng; thiết kế cũ không trở thành quyết định đã duyệt.

Đây là **base production cho phân tích theo lệnh Owner hiện tại**. Không tự đổi accepted business base D171 limited PASS thành D173 Owner PASS. E097 SQLite NOMEM và các FIELD FAIL Agent vẫn là vấn đề riêng chưa được chứng minh hết nguyên nhân. Một `/health` tốt không chứng nhận cả ca vận hành.

## 2. Bill đang nói gì

Ảnh Owner cung cấp hiển thị chu kỳ 19/10–18/11, 14/31 ngày quan sát, tổng usage cost bằng 0 USD. API subscription trong bằng chứng lịch sử trả khoảng nửa mở 19/10 00:00 UTC → 19/11 00:00 UTC; hai cách ghi này cùng một chu kỳ 31 ngày.

| Meter trên ảnh | Đã dùng | Bao gồm trong gói | Tỷ lệ xấp xỉ |
|---|---:|---:|---:|
| DO Compute Requests | 530,26 nghìn | 1 triệu | **53,03%** |
| DO SQLite Rows Read | 4,11 tỷ | 25 tỷ | 16,44% |
| DO SQLite Rows Written | 1,36 triệu | 50 triệu | 2,72% |
| DO Duration | 3,66 nghìn GB-s | 400 nghìn GB-s | 0,92% |
| DO SQL Storage | 0,06 GB-month | 5 GB-month | 1,20% |
| Worker Requests | 411,91 nghìn | 10 triệu | 4,12% |
| Worker CPU | 1,41 triệu ms | 30 triệu ms | 4,70% |
| D1 Rows Read | 7,94 nghìn | 25 tỷ | Dữ liệu account; chưa xác minh thuộc Inventory |
| Email | 16 | 3.000 | 0,53% |

DO request là meter căng nhất theo tỷ lệ trên ảnh. Các meter còn dư có thể nhận thêm công việc thật, nhưng không đổi quota rows/CPU thành quota request theo phép cộng số học. Ảnh là account-wide, gồm tải dùng chung; không gán toàn bộ cho Báo hàng hoặc D172.

Nếu chỉ kéo thẳng 530.260 × 31/14, kết quả khoảng 1,174 triệu. Đây chỉ là kịch bản số học: billing có độ trễ, ngày vận hành khác nhau và các meter không cùng độ phủ. Không dùng nó làm dự báo hóa đơn chắc chắn.

Bằng chứng provider **đã lưu ngày 31/10**, không phải billing mới lấy trong lượt này: [run 41159303687](https://github.com/tamnv2/supra-inventory/actions/runs/41159303687) và [run 41159894993](https://github.com/tamnv2/supra-inventory/actions/runs/41159894993). Ngày đầy đủ 30/10 VN ghi nhận 41.564 DO raw invocation, trong đó 40.672 HTTP, khoảng **97,85%**; 850 hibernation và 42 alarm. Số này ủng hộ tập trung vào HTTP/đọc lại, nhưng vẫn chứa D172 và phần dùng chung trong cùng script; analytics không thay invoice hay attribution từng route. Không lấy các số giả định 8.000 H/ngày của đề xuất cũ làm forecast đã đo.

Quy tắc tính phí cần phân biệt: một DO HTTP/RPC invocation tính một request; incoming WebSocket application messages có tỷ lệ billing 20:1; outgoing messages và protocol ping không tính request. Bắt tay vẫn có request. Raw analytics không tự chia 20. Không được chia số 530,26 nghìn trong Billing cho 20 lần nữa. SQL, CPU, duration và storage vẫn có meter riêng. [Cloudflare DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## 3. Các dịch vụ Cloudflare trong mô hình production

| Dịch vụ | Vai trò hiện tại | Có thể tối ưu thế nào |
|---|---|---|
| Worker `supra-inventory-beta`, host chính thức `inventory.supra.cc.cd` | Ingress, xác thực Firebase signature, API, Google/FCM/Drive/Email, cron, Web | Gom các tác vụ phụ đúng quyền; CPU JSON/hash/filter ở Worker khi không cần authority. Tên beta là định danh kỹ thuật, không phải môi trường khác để chuyển dữ liệu. |
| InventoryCore, SQLite trong DO hiện có | Quyền/phiên sống, giao dịch, event, ACK, read models, deadline, log usage bền | Giữ authority; giảm số lần đi vào cùng object, giảm truy vấn và tải lại thừa. |
| WebSocket Hibernation | Push realtime, kết nối theo ticket, auto ping/pong | Đã dùng Hibernation. Phương án mới là protocol hai chiều có hợp đồng an toàn; không phải chỉ bật một cấu hình đã có. |
| Cron và DO alarm | Drain/retry/archive/log; deadline/SLA | Gom các lần đọc trạng thái phụ cùng nhịp. Giữ thời điểm deadline/ACK/auto-skip; không giãn lịch để tạo saving. |
| Workers Static Assets | Web bundle cùng release Worker; `run_worker_first=true` | Có thể cho file công khai có hash đi asset-first sau khi kiểm tra routing/header/OTA. Giảm Worker requests/CPU; không trực tiếp giảm DO requests. |
| Cloudflare Email Sending | Bốn nhóm mail đã được duyệt, sender hiện hữu | Giữ chức năng gửi thư. Usage thấp không biến Email thành realtime bus hay transaction store. |
| Workers Logs/analytics | Chẩn đoán và số liệu provider | Dùng làm bằng chứng, không thêm poller hoặc log chứa dữ liệu nhạy cảm. Không bỏ log bền E049 để làm chỉ số đẹp. |
| D1, KV, R2, Queues | Không có binding Inventory trong cấu hình production | Có thể nghiên cứu nhưng không dùng database của dự án khác. Tạo resource cần phê duyệt scope riêng; chưa cần cho phương án chính. |

Cấu hình tham chiếu: [wrangler.beta.toml tại base](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/wrangler.beta.toml). Không thao tác Stable lịch sử, host legacy đã retire hoặc resource ngoài `ops/project-scope.json`.

## 4. Mổ xẻ số lần gọi đang có

| Đường xử lý | Số DO bình thường | Căn cứ source tại f15b9675 |
|---|---:|---|
| Ticket / connect / delta realtime | 1 cho mỗi API | `read-api.ts:74,96,104`; `core.ts:1141,1355` |
| SKU search/catalog/info/delta | 1 cho mỗi API | `business-api.ts:497`; `read-api.ts:122` |
| Picker reports/results; Reporter queue/recent/counters/overdue | 1 cho mỗi API | `business-api.ts:509–547`; `read-api.ts:148` |
| Create/withdraw/resolve/correct giao dịch + broadcast | 1 foreground | `business-api.ts:438–495`; `core.ts:878–999` |
| Picker result receipt/ACK + broadcast | 1 | `business-api.ts:550–561`; `core.ts:1244` |
| Web Admin Presence | 2 | `read-api.ts:111–115`: user lookup rồi đọc socket snapshot |
| Một số API Admin dashboard/reporting/SLA/insights/preferences | 2 mỗi GET thành công | `business-api.ts:564` trở đi: requireUser rồi coreGet |
| Agent schedule/status/roster | 2 mỗi API tương ứng | `index.ts:1730–1737,2566–2568` |
| VPS Usage | 1 DO xác thực, provider calls ở ngoài | `index.ts:1833–1841`; collector có cache/batch riêng |
| Public `/health`, không còn migration pending | Thường 11 | `index.ts:1495–1502,514–583`; gồm health/folder và privileged migration checks |

Các hot path đã gom xác thực và thao tác trong DO. **Không có cơ sở nói mỗi request production đều tốn hai DO rồi hứa cắt một nửa toàn hệ thống.**

Resolve/correct còn có phần bất đồng bộ: 1 foreground; sau đó alert-window, event version, targets, delivery-attempt là 4 DO nữa khi nhánh gửi hoạt động bình thường; optional disable-invalid thêm 1. Tổng nhánh này thường 5 hoặc 6, phụ thuộc cửa sổ/target/error. `business-api.ts:270–305,327–358` giữ fanout token ngoài đường trả kết quả để bảo vệ latency.

Mỗi cron 5 phút có ít nhất hai DO đọc trạng thái không thuộc D172: pending Drive logs và HR completion-retry state, kể cả khi trống. Launcher folder đã throttle RAM khoảng 6 giờ mỗi isolate, không được đếm thành một call mỗi tick. `runtime-logs.ts:932–945,462–468`; `hr-event-sync.ts:455–467`.

Client cũng cần phân biệt timer local với cloud traffic: Web guard 5 giây không gọi lại khi socket còn OPEN/CONNECTING; Agent vẽ Usage 30 giây nhưng lấy cloud tối đa theo nhịp 5 phút; roster PRIMARY 5 phút/standby 10 phút. Android protocol ping 20 giây không phải một HTTP poll. Web Admin Presence mới là GET thật mỗi 30 giây, kể cả document hidden, trong source production.

## 5. Phương án đề nghị: một gói cải tổ nội bộ, cùng authority và kết quả

Khuyến nghị kết hợp P1–P4 dưới đây. Đây là một hướng toàn mô hình, chia cổng kiểm chứng để không đưa thay đổi chưa chứng minh vào production. Không chỉ dời một phần code sang dịch vụ khác rồi giữ nguyên lượng việc thừa.

### P1 — Một lần quyết định trong DO, response đủ để áp dụng

**Gom auth + đọc ở các API còn hai hop.** Worker vẫn xác minh Firebase signature; DO kiểm tra live user/status/effective role/channel/session generation rồi đọc trong cùng invocation. Tái sử dụng mẫu authorized đang chạy, không cache quyền bằng TTL. Presence, management và Agent giữ chính xác các điều kiện quyền khác nhau. Mỗi successful migrated call tiết kiệm đúng 1 DO; chưa có volume để tính phần trăm toàn hệ thống.

**Snapshot đúng màn hình.** Reporter lần khởi tạo/khôi phục lấy queue + trang recent + counters (+overdue khi cần) trong một DO turn cùng revision/server clock; Picker lấy reports + results tương tự. Không triển khai bằng endpoint mới gọi ngược các endpoint cũ. Snapshot bounded, giữ paging/filter và hạn chế payload; dữ liệu phụ chậm không chặn phần hiển thị chính.

**Dùng response và event đã commit để cập nhật UI.** Android sau resolve/correct đang gọi refresh các phần; Picker create/withdraw cũng tải lại lists. Response trả patch, version, server time và counter đúng filter; HTTP response và socket event đi cùng reducer/dedupe. Chỉ bỏ GET khi patch thực sự đủ; view đổi hoặc thiếu coverage vẫn reconcile. Web đã patch một số luồng, không tính lại saving đã có.

Ví dụ đường chính, chưa cộng FCM/receipt/phục hồi: Reporter resolve + ba GET là 4 DO → 1, giảm 3 call/operation; Picker create/withdraw + hai GET là 3 → 1, giảm 2. Snapshot Reporter ba GET là 3 → 1; Picker là 2 → 1. Đây là công thức theo nhánh đủ điều kiện, không phải 75% hay 67% tổng account.

### P2 — Dùng thêm SQL writes/CPU để bớt quét và bớt GET

Mở rộng read models/summaries **đang có** theo query thật còn nóng, cập nhật cùng transaction với business state/event. Không tạo một bản sao authority mới. Đọc theo chỉ mục/page; event mang đủ public patch và phạm vi coverage để giảm query dựng lại UI. Chỉ thêm index/summary khi `rowsRead/rowsWritten` đo thật và trường hợp ngày/phân trang/correction đều tương đương.

Ví dụ workload đổi từ nhiều lần quét cùng batch sang một lần cập nhật summary và nhiều lần đọc summary nhỏ. Tăng rows written/CPU một lượng có giới hạn, đổi lấy giảm rows read/requests do reload. `LIMIT` ở ngoài hay SELECT ít cột chưa chứng minh scan ít. E055 pagination/MIN-MAX probes và `batch_summaries` đã có, không bán lại như tối ưu mới.

Realtime phải phân biệt gap thật với khoảng trống do event dành cho người khác. Xem xét durable audience coverage/sequence, epoch, view revision và session generation; thiết kế đủ tombstone/retention/resync trước khi bỏ recovery GET. Không xóa đơn giản điều kiện kiểm gap. Không lấy mutation patch làm bằng chứng đã áp mọi event đến global cursor đó.

E049 vẫn giữ counter exact/bền sau restart. Giảm invocation/query thừa sẽ tự giảm telemetry writes đi kèm; không thay bộ đếm bằng RAM hoặc sampling mất sự kiện.

### P3 — WebSocket hai chiều cho các thao tác phù hợp

Đây là phần thay đổi rõ đơn vị usage: thao tác HTTP còn lại trở thành application message trên kết nối đã có. Với một thao tác hiện tốn 1 DO HTTP, một incoming frame hợp lệ tương đương 0,05 billed DO request, trước handshake/recovery/frames phụ. Đây không tự giảm SQL hoặc raw invocation.

**Production hiện chưa hỗ trợ điều này:** `core.ts:753–769` bỏ qua bounded unsolicited frames. Ticket/attachment hiện có user/role/client nhưng thiếu đầy đủ Firebase UID, current session generation và proof expiry phục vụ lệnh hai chiều (`read-model-core.ts:8–27,340–378`). Không được tin attachment.role cũ rồi cho đọc/ghi.

Thiết kế cần có:

1. Protocol/capability version mới, allowlist operation, giới hạn frame/payload/rate/backpressure. Các client cũ giữ HTTP và push như hiện tại.
2. Worker kiểm chứng ingress/proof; ticket và hibernation attachment gắn danh tính, channel, generation, expiry đã xác minh. Mỗi command kiểm live quyền/phiên trong SQL; expiry/kick/disable/role-change không được có cửa sổ chấp nhận bằng quyền cache. Không ghi token vào attachment/log public.
3. HTTP và WS dùng cùng dispatcher bằng lời gọi nội bộ. Nếu mỗi frame lại `stub.fetch()` vào chính DO thì mất lợi ích request và tăng độ phức tạp.
4. Read đầu tiên: presence/snapshot/delta phù hợp. `request_id` pending map bounded, result/error riêng; result đọc không tự đẩy realtime applied cursor. Kết quả trễ/khác session bị bỏ theo version contract.
5. Nếu chuyển mutation sau đó: request ID + entity version, cùng SQLite transaction chốt business/event/result journal. WS mất response rồi HTTP cùng ID phải trả canonical result, không tạo lần hai. Không có durable offline business queue, không báo thành công trước commit.
6. Socket nửa sống có thể khiến đợi timeout rồi HTTP **chậm hơn** hiện tại. Phải có deadline/hedge trong ngân sách latency đang có, cùng ID và đo fallback traffic. Không coi timeout→HTTP tự nó bảo đảm ngang tốc độ. Nếu không đạt, giữ route đó dùng HTTP.
7. Kết thúc handler để hibernate; không thêm timer giữ object thức. FCM/background và Office–Agent/PDA dùng carrier hiện tại, không ép tất cả qua Cloudflare WS.

Nếu 100 resolve đủ điều kiện, response patch loại ba refresh mỗi lần, và 100 command đi WS: nhánh chính từ khoảng 400 HTTP request sang 100 incoming frames, tức khoảng 5 billed-equivalent, **cộng** auth/handshake/FCM/ACK/recovery và phần dùng chung. Đây là ví dụ kiến trúc, không đo được saving 98,75% toàn hệ thống. Không giảm tiếp đồng thời ba GET đã bỏ khi tính lợi ích WS, tránh đếm hai lần.

Công thức ước lượng sau khi có attribution: `B ≈ H + M/20`, trong đó H gồm mọi HTTP/RPC/handshake/alarm/phần 1:1 còn lại; M gồm mọi incoming app frame, retry/control/chunk. Tính cả client cũ, Office fallback và reconnect. Không áp dụng 20:1 cho protocol ping hay số Billing đã điều chỉnh.

### P4 — Gom notification và maintenance, giữ thời điểm hoạt động

**FCM resolve/correct:** một private asynchronous dispatch-context trong DO thực hiện cùng thứ tự alert-window → event version → targets; 3 lần vào DO thành 1, tiết kiệm 2 mỗi nhánh gửi đủ điều kiện. Worker vẫn gửi Google ở ngoài rồi ghi delivery-attempt; có thể gom attempt và disable-invalid thành một callback sau send. Không mang token vào public result và không đưa fanout vào foreground response. Giữ ACK target, event_id/seq/batch_version, retry/receipt và failure isolation.

**Maintenance 5 phút:** một envelope đọc pending logs + HR completion-retry state + folder metadata cần thiết, xử lý lỗi/retry/lease từng nhánh như hiện tại. Hai unconditional reads thành một: tối đa lịch chuẩn giảm 288/ngày, 8.928/chu kỳ 31 ngày. Không đổi D172 drain. Không xóa HR retry chỉ vì watcher đã retired nếu còn WAITING_FOR_COMPLETION.

**Health:** `/health` đang kiêm storage/folder/migration checks, có thể gây credential migration. Đề nghị routine health fresh schema/source/storage trong 1 DO, deployment readiness/migration giữ cổng riêng và hợp đồng đầy đủ. Chỉ có lợi nếu traffic monitor thật tồn tại; không tự gán 11 call cho mọi API hoặc giả định health đang là thủ phạm chính.

**Web Presence:** gom auth+presence 2→1 trước; WS read/push có thể bỏ polling khi chứng minh membership/revocation tương đương. Riêng 1 dashboard mở 16 giờ/ngày, 30 giây/lần tương đương 1.920 GET và 3.840 DO/ngày trước gom; chỉ là ví dụ theo user-hour. Không gán tải này cho mọi người. Đề xuất dừng hidden polling của PR814 chưa thuộc base và không đủ để giải quyết toàn mô hình; chỉ dùng nếu xác nhận hidden UI không cấp dữ liệu cho chức năng cần hoạt động nền, và refresh ngay khi visible.

## 6. Các dịch vụ dư usage khác có nên dùng không

| Lựa chọn | Lợi ích thật có thể có | Kết luận cho yêu cầu này |
|---|---|---|
| Giữ nguyên và đo | Có baseline; không tạo protocol/migration risk | Cần làm đối chứng, không tạo headroom mới. Không thêm polling để đo. |
| Chỉ gom HTTP/patch | Giảm request thật, ít thay transport | Hữu ích nhưng không hứa đủ mục tiêu account trước khi biết route volume. Là một phần gói đề nghị. |
| **Gói P1–P4 cùng SQLite** | Bỏ việc thừa + đổi billing của phần phù hợp + tăng writes/CPU có kiểm soát | **Đề nghị chọn làm hướng thiết kế**, chi tiết mỗi route còn cổng kiểm chứng. |
| D1 | Phù hợp projection/lịch sử/immutable snapshot ở quy mô đủ lớn | Chưa có resource Inventory. Auth vẫn phải hỏi DO thì request floor chưa mất; live write+event+projection phân tán tạo bài toán atomicity/lag/rollback. Chưa cần cho bài toán trước mắt. |
| KV/Cache API | Tốt cho immutable versioned assets/public config không nhạy cảm | Không thay live quyền, session, queue, ACK bằng TTL cache; không bảo đảm invalidation đồng thời mọi nơi. |
| R2 | Có thể lưu export/SKU artifact lớn theo version/hash | Không thay authority; cần manifest quyền/generation/checksum và resource mới. Chỉ xét khi payload/export đo được là nút thắt, hiện chưa có bằng chứng. |
| Queues | Hợp công việc nền chấp nhận async và duplicate delivery | Thêm operation/retry/DO wake; không thay interactive realtime/ACK. Gộp maintenance trong resource hiện có trước. |
| Thêm tải Firebase/Google | Có sẵn carrier Office và FCM | Giữ đúng vai trò hiện hữu; không chuyển Báo hàng sang Firestore chỉ để bill DO đẹp khi chưa xác minh toàn quota/cost Google. |
| Asset-first | Static requests có thể được phục vụ miễn phí qua Assets | Tối ưu phụ Worker requests/CPU; giữ API/health/download/OAuth routes và security headers. Không tính vào saving DO. [Cloudflare Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). |

Được xem xét mọi loại usage không đồng nghĩa phải dùng hết mọi dịch vụ, dùng database của dự án khác, mua gói mới hay tự cho phép phát sinh chi phí. Chọn nơi có lợi tổng thể và chứng minh được tương đương.

## 7. Điều kiện bắt buộc để phương án đủ triển khai

Không có tuyên bố SOURCE/CI/RELEASE/FIELD PASS của P1–P4 vì chưa viết và chưa chạy chúng. Trước phát hành phải có ma trận chứng cứ sau:

| Hợp đồng | Điều phải chứng minh |
|---|---|
| Kết quả nghiệp vụ | Cùng input cho cùng record/order/filter/count/versions; create/withdraw/resolve/correct/meal/auto-skip/receipt, concurrency và ngày làm việc; giữ paging lớn hơn một trang. |
| Session và quyền | Token hết hạn, kick/replace/disable/đổi role giữa hai frame; attachment cũ sau hibernation; Agent identity đặc thù và Android management deny; không có stale permission cache. |
| Mạng và idempotency | Commit xong mất response, duplicate/reordered frame, HTTP fallback cùng ID, restart, unknown outcome; không lặp business mutation hoặc WMS click. |
| Realtime | Audience gap hợp lệ và mất event thật; epoch/retention/tombstone; snapshot-event race; response cũ đến sau event mới; đổi filter và biên ngày. |
| Tốc độ và ổn định | Cùng tải/PDA-hours/operation mix, đo action→durable→display và ACK p50/p95/p99, timeout/error/reconnect, burst/backpressure, CPU/RAM/pin. Không chỉ so response API trung bình. Không phát hành route kém hơn baseline. |
| WMS, HA và Office | PRIMARY fencing/generation/lease; WMS result khác transport ACK; mạng Office/Internet đổi; không thay heartbeat/stale/timeout/FCM/DISPLAYED hoặc carrier Firestore/RTDB đã có. |
| Notification/log/maintenance | Google send lỗi/token invalid/background/locked; exact receipt; cron partial failure và restart; E049 exact persistence; lịch log 13:15/21:15; không dời deadline. |
| Shared resource | D172 API/auth/private SQLite/Sheet regression; không đổi source/nghiệp vụ/channel D172. Stable vẫn OWNER-GATED. |
| Chi phí | DO raw khác billable; attribution route + business operation; SQL auth/query/index/trigger/telemetry/idempotency writes; duration do I/O; Worker CPU/requests/logs; account vs Inventory và billing-cycle coverage. |

Cách lấy bằng chứng: ưu tiên dữ liệu provider và counters/log đã có; chuẩn hóa trên 1.000 logical operations, PDA-hour và cùng ca. So ít nhất hai ca đại diện trước/sau, có error/reconnect. Đếm cả dual-support/client cũ/rollback; không chỉ đường mạng đẹp. Quan sát cost tổng từng meter, không chỉ request thấp hơn.

Triển khai nếu Owner duyệt sau này: branch → PR → source/authority/continuity và D172 PASS → Worker hỗ trợ cả cũ/mới → signed client cohort → chỉ tăng cohort khi parity/latency/usage đạt. Read-only WS trước; mutations chỉ sau transactional idempotency/fault proof. Một implementation nghiệp vụ dùng chung, route/version switch rollback về HTTP; không drop/recreate DO hay SQLite. Không canary dual-write giao dịch thật.

## 8. Phạm vi đề nghị Owner chốt

Chọn hướng **P1–P4: cùng DO/SQLite authority, response/event đủ, snapshot cùng revision, read model có kiểm soát, WS hai chiều cho phần đủ điều kiện, gom việc nền**. Không chọn D1/KV làm live authority trong đợt này. D172 độc lập bị loại khỏi nghiệp vụ tối ưu; chỉ tính ảnh hưởng tài nguyên dùng chung và hồi quy.

Chưa thể cam kết một tỷ lệ giảm tổng account hoặc phí cuối kỳ khi chưa có route attribution và code ứng viên. Có thể chốt hướng thiết kế dựa trên call graph và tariff thật, rồi nghiệm thu bằng điều kiện kết quả/realtime/tốc độ/ổn định **ít nhất như base**. Không đổi chất lượng vận hành lấy quota.

Tình trạng lượt làm việc: chỉ đọc authority/source/release/runtime metadata, phân tích, và lưu hồ sơ đề xuất. Không sửa executable source, không chạy benchmark/load test/ứng dụng, không deploy hoặc đổi resource/provider/data/OTA.

## 9. Source để kiểm tra

- [Authority main](https://github.com/tamnv2/supra-inventory/blob/1ccb12a55a3104729881714953735a7654f9231b/ops/authority-manifest.json), scope/state/specs và journal D173.
- [Read API production](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/read-api.ts#L38), [Business API production](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/business-api.ts#L270), [Core](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/core.ts#L753), [Socket ticket/attachment](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/read-model-core.ts#L8).
- [Worker health](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/index.ts#L1495), [migration calls](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/index.ts#L514), [cron](https://github.com/tamnv2/supra-inventory/blob/f15b9675b7de33194dbb43980fd5934ee09958fc/service/src/index.ts#L2763).
- [Reporter refresh](https://github.com/tamnv2/supra-inventory/blob/e45eafd8fbc69edf6a75c750f61ad9808237394f/android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt), [client source tree](https://github.com/tamnv2/supra-inventory/tree/e45eafd8fbc69edf6a75c750f61ad9808237394f/android), [Web production tree](https://github.com/tamnv2/supra-inventory/tree/f15b9675b7de33194dbb43980fd5934ee09958fc/web).
- [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Worker pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
