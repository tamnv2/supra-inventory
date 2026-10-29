# D173-E097 — Rà soát logic Báo hàng và phương án giảm DO request

Ngày: 29/10/2026, giờ Việt Nam. **ANALYSIS / PROPOSED — CHỜ OWNER REVIEW.**

Nguồn mã được cố định tại `15fe01f90466629ad6351cf32b72ba6f6a443b44` (main khi bắt đầu rà soát). Đây là tài liệu phân tích; không sửa mã vận hành, không triển khai, không thay database hoặc dữ liệu nghiệp vụ. Các phương án dưới đây chưa được Owner phê duyệt thực hiện.

## 1. Kết luận và ranh giới

Có cơ sở để giảm DO request bằng cách **bỏ những lần quay lại DO để đọc thông tin đã có thể trả cùng giao dịch hoặc đẩy qua realtime**. Không cần đổi nguồn dữ liệu giao dịch để thực hiện nhóm tối ưu đầu tiên.

Ưu tiên đề xuất:

1. Trả snapshot/delta đủ trong kết quả giao dịch; bỏ full refresh sau thao tác thành công và áp dụng chung event qua HTTP/WebSocket.
2. Gom snapshot khởi tạo/khôi phục theo màn hình, đọc nhất quán trong một lần DO.
3. Làm rõ sự kiện không có sequence và khoảng trống global sequence; tránh biến cập nhật hợp lệ thành HTTP delta recovery.
4. Gom bước chuẩn bị FCM và ghi kết quả gửi; giữ chúng ngoài đường trả kết quả quan trọng.
5. Sau đó mới cân nhắc bản đọc D1 cho dữ liệu đã khóa, hoặc giao thức WebSocket hai chiều nếu mục tiêu billing còn cần.

Phạm vi bao gồm Web, phần Báo hàng Android, Worker/InventoryCore SQLite, SKU, xác thực/quyền, SLA/nghỉ ăn/đóng ngày, realtime, FCM, báo cáo/nhân sự, log/archive, Usage và cập nhật phần mềm liên quan. **Không phân tích hoặc đề xuất thay đổi D172; không tối ưu luồng Agent ↔ PDA, PickList, gọi/nhắn/kích Picker hay HA của luồng đó.** Agent chỉ được xét ở đầu giao tiếp SKU/Usage/log với cloud. Tác vụ dùng chung được nhận diện để tránh quy nhầm chi phí; không lấy quyền tối ưu chung để đổi phần bị loại trừ.

SQLite hiện tại tiếp tục là nguồn quyết định giao dịch. Không thêm chế độ báo hàng offline; retry biên nhận hiển thị là khôi phục metadata đã phát sinh, không phải hàng đợi tạo giao dịch offline.

## 2. Đọc đúng ảnh usage ngày 29/10

Ảnh do Owner cung cấp có thời điểm cập nhật 11:35:19, mẫu Cloudflare chính ở 11:30. Dấu chấm dưới đây là phân cách hàng nghìn.

| Metric | Từ 06:00 đến mẫu nguồn | Trong ngày theo dashboard | Target ngày | Dự kiến ca đến 22:00 |
|---|---:|---:|---:|---:|
| DO Compute Requests | 10.869 | 12.282 | 16.129 | 31.106 |
| DO Rows Read | 40.565.490 | 47.746.152 | 403.225.806 | 116.095.937 |
| DO Rows Written | 43.316 | 51.182 | 806.452 | 123.968 |
| Workers Requests | 8.222 | 9.104 | 161.290 | 23.531 |
| DO Duration | 55 | 67 | 6.452 | 158 |
| Workers CPU | 26.189 ms | 33.809 ms | 483.871 ms | 74.951 ms |
| D1 Rows Read | 168 | 348 | 403.225.806 | 481 |

DO/D1 trong ảnh là **CF_ACCOUNT_SHARED**; Workers được lọc script riêng. Do đó chưa được coi 12.282 hoặc 31.106 là request riêng của Báo hàng, càng không được quy hết cho các luồng nằm trong phạm vi rà soát này. Namespace InventoryCore cũng dùng chung vật lý với D172; lọc namespace đơn thuần vẫn chưa loại được D172.

Target 500.000 DO request/tháng là phân bổ nội bộ 50% phần bao gồm 1 triệu của gói Paid; target ngày tháng 10 là 500.000 / 31 ≈ 16.129. Đây không phải giới hạn cứng mà Cloudflare áp theo ngày. 12.282 / 16.129 = 76,1%: tại mẫu này lượng đã dùng chưa vượt target ngày; cảnh báo vượt được kích bởi dự báo.

Dự kiến 31.106 ở card hiện tại là dự báo từ 06:00 đến hết ca. Mã `E089Render` cộng phần trước ca khi tính cảnh báo tỷ lệ cả ngày. Nếu cùng bộ mẫu trong ảnh, phần trước 06:00 là 12.282 − 10.869 = 1.413; cộng minh họa thành khoảng 32.519 đến 22:00. Vì là ngoại suy nửa ca, không coi đây là tổng cuối ngày đã xảy ra. Tỷ lệ giảm cần thiết theo phép tính minh họa là khoảng 48,1% nếu so riêng 31.106 với 16.129, hoặc khoảng 50,4% nếu cộng phần trước ca. Chưa đủ căn cứ cam kết các phương án dưới đây đạt tỷ lệ đó trên toàn tài khoản.

Nguồn: [quota governance](../docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md); `relay-agent/D173E089UsageCards.cs` (E089Render/E089Target/E089Forecast); `service/src/d173-vps-usage.ts` (scope và dataset).

### Phải phân biệt ba bộ đếm

- **DO HTTP fetch/RPC/alarm thực tế:** các sự kiện làm việc đi vào DO; mỗi lần Worker gọi `stub.fetch` là một request khác, dù cùng một thao tác người dùng.
- **Analytics invocation:** dashboard đang dùng `durableObjectsInvocationsAdaptiveGroups.sum.requests`. Đây không phải bản hóa đơn đã chốt; cần đối soát loại invocation, phạm vi và độ trễ nguồn.
- **Đơn vị tính phí:** Cloudflare áp tỷ lệ 20:1 cho incoming WebSocket application messages ở phần tính phí compute request; analytics không tự đồng nhất theo phép chia đó. Không được tự chia tổng analytics cho 20.

Outgoing WebSocket messages và protocol ping không tính như incoming application messages. Hibernation chủ yếu giảm duration. Đổi HTTP sang WebSocket có thể giảm đơn vị tính phí nhưng chưa đủ để hứa giảm cùng tỷ lệ chỉ số request đang hiển thị.

Nguồn chính thức: [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## 3. Logic đang vận hành theo mã nguồn

| Nhóm | Cách xử lý hiện tại | Quy tắc phải giữ |
|---|---|---|
| Đăng nhập/khôi phục | Worker kiểm tra Firebase JWT; user, trạng thái, role và session generation được đối chiếu với SQLite. Kênh Web/Android và Agent phân biệt. Một số API xác thực rồi gọi DO lần hai để lấy dữ liệu. | Kích/đổi phiên/đổi quyền có hiệu lực đúng hiện tại; không dùng cache role có TTL để lách kiểm tra live. |
| Báo SKU | Kiểm tra quyền bật Báo hàng, ca, SKU đã FULL trong ngày và đang active. Transaction chống request trùng; một Picker/SKU/ngày không có hai ticket OPEN. Gộp SKU/ngày vào batch PENDING. | SKU chuẩn server, ngày VN, idempotency và uniqueness nguyên vẹn. |
| Thu hồi | Chỉ ticket của đúng Picker, còn OPEN và còn cửa sổ 60 giây. Cập nhật ticket, xem còn người chờ/quá hạn để quyết định batch, ghi event/audit. | Không đóng nhầm batch còn người liên quan; không reset cửa sổ. |
| Reporter xử lý | Chốt HAS_STOCK hoặc SKIP_ALLOWED, giải quyết ticket theo quy tắc đang chờ/quá hạn; tạo kết quả, event, đối tượng nhận, audit. | Không gộp HAS_STOCK và Skip thành cùng một tập người nhận. |
| Sửa kết quả | Kiểm tra trạng thái, phiên bản và hạn sửa; tạo kết quả điều chỉnh có identity/version riêng, chỉ đúng người có ticket. | Không kéo dài hạn sửa, không gửi sai người, không ghi đè thao tác mới bằng response cũ. |
| SLA/Quá hạn | Deadline lưu server; alarm chọn thời điểm gần nhất, xử lý lô có giới hạn; warning/escalation/auto-skip, nhắc quá hạn. | Không thay deadline chính xác bằng cron 5 phút; không trì hoãn cảnh báo để gom usage. |
| Nghỉ ăn/đóng ngày | Lựa chọn nghỉ có kiểm soát một người thắng; deadline điều chỉnh theo luật. Đóng ngày N lúc 03:00 N+1; batch/ticket theo ngày VN, tái phát cùng ngày. | 00:00/03:00/qua ca/tăng ca phải giữ nguyên ý nghĩa. |
| Realtime | Ticket một lần TTL 60 giây, sau đó mở socket hibernation có role/user tags. Event có seq/epoch; client chỉ tiến applied cursor sau khi apply thành công. Gap hoặc thiếu metadata thì GET delta/resync. | Giữ phát hiện mất sự kiện thật và lọc người nhận, không nhảy cursor qua sự kiện chưa áp dụng. |
| Danh sách/counter | Web Reporter và Android đã patch snapshot nhiều trường hợp. Android fallback đọc queue + recent + counters, overdue lazy. Web Picker còn gọi loadPicker sau sự kiện. | Badge, thứ tự, phân trang, chi tiết và vùng cuộn phải khớp dữ liệu. |
| Kết quả Picker | FCM và socket đều có đường đưa kết quả tới UI. Client hiện tại chỉ báo DISPLAYED sau khi dialog/overlay thật sự hiển thị; nút đóng là local. | Không khôi phục RECEIVED/ACKNOWLEDGED như một bước bắt buộc mới; không coi nhận FCM là đã hiển thị. |
| FCM | Worker gửi nền; tạo báo hàng có prepared targets trong DO. Resolve/correct giữ tra targets ngoài đường trả kết quả vì có thể nhiều Picker. Ghi attempts và vô hiệu token lỗi. | FCM/socket là hai cơ chế bổ trợ; không bỏ FCM chỉ vì socket đang nối. |
| SKU | Agent staging/preview/publish có grant và kiểm tra xung đột; batch 500 SKU. FULL đầu ngày, DELTA sau đó; SKU vắng bị ẩn. Android lưu SQLite, search local, delta có staged full fallback khi đổi membership. | Giữ active roster, xác nhận xung đột, atomic publish và cache cũ nếu tải lỗi. |
| Báo cáo/nhân sự | Web/Excel quản lý nhân sự; nguồn Sheet intake đã retire. Dashboard/reporting/audit tra SQL, có lọc khoảng ngày/khu vực theo thời điểm. | Không xem lịch sử khu vực bằng vị trí hiện tại; không tự coi ngày cũ là bất biến. |
| Log/archive | Web/Android buffer trong core, archive Drive; receipt và bundle identity phục vụ retry. Folder ngày có authority/lease để tránh trùng. Cron 5 phút có các kiểm tra bảo trì. | Không xóa log local khi mới được chấp nhận mà chưa đạt receipt yêu cầu; giữ lịch, retry và bảo mật. |
| Usage | Agent hỏi một endpoint 5 phút; Worker cache theo metric và gom các truy vấn provider. Auth của request đó vẫn chạm DO. | Không quy 36 metric thành 36 DO call; giữ scope, đơn vị, mẫu thiếu, ngày ca và kỳ billing. |
| OTA/CI | Manifest/checksum/kênh ký được giữ; cập nhật client phải tương thích source Worker. Download phần mềm chủ yếu qua GitHub/Worker route. | Không đổi chữ ký/package/database để tiết kiệm; phân biệt code/CI/release/field. |

Nguồn triển khai chính: `service/src/{index,core,business-api,business-core,operational-v2-core,read-api,read-model-core,notifications-core,sla-automation,meal-break-core,d167-overdue-core,d167-sku-sync-core,runtime-logs,archive,d173-vps-usage}.ts`; Web/Android ở danh mục cuối tài liệu.

## 4. Những tối ưu đã có — không tính lại thành tiết kiệm mới

1. Create/withdraw/resolve/correct đã đi vào `/authorized/business/shortage/*`: JWT ở Worker, kiểm tra session/role + transaction + broadcast trong cùng một lần DO.
2. Đọc queue/overdue/recent/counters, Picker reports/results, catalog và realtime ticket/delta thuộc đường nóng đã có kiểm tra live authority trong cùng lần DO.
3. Broadcast gọi trực tiếp handler trong object **không phải** một `stub.fetch` mới; nhiều SELECT trong một invocation cũng không tự sinh DO compute request mới.
4. E055 đã tối ưu các truy vấn trang, ACK aggregate và MIN/MAX sequence. Giảm Rows Read không đồng nghĩa giảm số invocation.
5. Android tìm SKU local; không gọi cloud cho từng ký tự như Web Picker.
6. Badge Reporter nhiều trường hợp cập nhật từ delta; overdue lazy load. Không có cơ sở nói mọi event đều tải lại cả bốn tab.
7. Receipt DISPLAYED trùng không phát lại thông báo ở core khi `displayed_new` không đúng. Client không gửi RECEIVED chỉ vì FCM tới, không gửi ACKNOWLEDGED khi bấm đóng.
8. Web `ensureRealtime` chạy local 5 giây nhưng return khi socket OPEN/CONNECTING. Android protocol ping 20 giây khác với HTTP polling.
9. E049 telemetry ghi SQLite trong invocation hiện có, không tạo một DO request cho mỗi dòng đo. Không bỏ durability chỉ để làm số SQL nhỏ đi.
10. Usage collector đã batch/cached. Timer vẽ CPU/RAM hay đồng hồ của Agent là local, không tự phát sinh cloud traffic.

## 5. Các điểm cần tối ưu, theo ưu tiên

### P1-01 — Full refresh ngay sau giao dịch thành công

**Đã thấy trong source:** Android Picker create thành công gọi `refresh()`, đọc reports + results. Android Reporter resolve/correct thành công gọi `refresh()`, đọc queue + recent + counters, có thể thêm overdue. Web Picker create/withdraw thành công cũng gọi `loadPicker()`.

Trong khi đó cùng giao dịch đã broadcast snapshot. Ở Android, snapshot có thể đã được áp dụng trước HTTP response; ở Web Picker còn có một lần loadPicker do socket. Vì thế một thay đổi có thể gây cả tải sau nút bấm lẫn tải sau socket.

**Đề xuất:** trả thêm read-model snapshot/transition được server xác thực cùng event_id, batch_version, receipt_revision nếu có, cursor/epoch. HTTP response và socket đi vào cùng một reducer. Event trùng chỉ áp dụng một lần; response cũ không ghi đè snapshot mới. Full fetch chỉ dùng khi thiếu contract, lỗi version, phân trang chưa có dữ liệu hoặc mất sự kiện thật.

**Đánh đổi:** tăng SQL đọc và ít payload trong DO invocation đang có; giảm HTTP/Worker/DO lượt đọc tiếp theo. Không chờ một khoảng batch mới, không optimistic success trước commit.

**Giảm trên nhánh tương ứng:** Android Picker thường bớt 2 DO read mỗi success; Android Reporter bớt 3, hoặc 4 khi overdue đang mở. Đây là số đường gọi trong mã, không phải thống kê số lần/ngày.

Nguồn: `PickerController.kt:893`, `ReporterController.kt:819,860`; `web/src/operational-app.ts:4999–5016`; `service/src/core.ts:802`.

### P1-02 — Web Picker chưa dùng snapshot để cập nhật UI trực tiếp

**Đã thấy:** `registerRealtimeApplier` có reducer dành Reporter, còn Picker có `pickerRelevant` rồi về `reconcileActive()` → `loadPicker()` → reports và results. Catalog info chỉ thêm nếu chưa có ngày hiện tại. Vì vậy không được mô tả Web và Android đã tối ưu giống nhau.

**Đề xuất:** dùng projection riêng Picker đã có trong frame, lọc đúng ticket/result của người hiện tại, áp dụng local như Android. Tách trang lịch sử chưa tải khỏi kết quả đang hiện; thiếu trang thì gọi một lần có mục tiêu. Dedupe theo event identity và thứ tự server, không chỉ batch_version vì DISPLAYED có thể thay metadata mà không đổi version batch.

**Đánh đổi:** CPU/RAM client tăng nhẹ; có thể thêm dữ liệu trong snapshot server. Thường loại 2 DO read cho mỗi event Picker liên quan khi frame đầy đủ. Không cộng số này máy móc với P1-01 nếu cùng một request đã được cả hai phương án loại bỏ.

Nguồn: `web/src/operational-app.ts:3756,5598–5701`; `PickerController.kt:309–417`.

### P1-03 — Snapshot của một màn hình bị tách thành 2–4 request

**Đã thấy:** Android Reporter `refresh` đọc ba API liên tiếp và API overdue khi cần; nếu realtimeRevision đổi trong lúc đọc thì có một bounded retry. Mã đã ghi nhận khả năng queue_total và counters khác nhau vì hai request khác thời điểm. Picker đọc reports/results riêng. Startup ban đầu và `initial_authoritative_sync` cũng có thể cùng yêu cầu snapshot.

**Đề xuất:** endpoint snapshot theo vai trò/màn hình. Reporter trả queue, recent, counters, SLA/clock và overdue nếu đang cần; Picker trả reports + pending result + clock/capability. Cùng read_model_seq/epoch, cùng một ảnh dữ liệu logic. Không gọi lại các endpoint qua HTTP từ endpoint mới; phải SELECT trực tiếp trong một DO invocation và chốt watermark đúng, không có await cho external I/O xen giữa các read tạo snapshot.

Đăng nhập vẫn giữ bước xác thực cần thiết; có thể mang bootstrap data trong kết quả session hoặc ticket mới nếu cùng contract. Một snapshot đúng watermark đủ cho UI ban đầu, socket chỉ bắt phần sau watermark. Dedupe request đang bay theo user/channel/generation/filter.

**Giảm:** Picker 2 → 1; Reporter 3 → 1, overdue 4 → 1 cho một lần reconcile phù hợp. Giảm race khiến phải đọc lại. SQL rows tổng không nhất thiết giảm cùng tỷ lệ; có thể tăng chút để trả thêm metadata nguyên vẹn.

Nguồn: `ReporterController.kt:362–440`; `PickerController.kt:901`; `web/src/operational-app.ts:3718–3783`; `AndroidRealtimeClient.kt:184–204`.

### P1-04 — Sự kiện DISPLAYED gửi không có seq, client lại chạy delta

**Đã thấy:** `/authorized/operational/picker/result-stage` ghi DISPLAYED, rồi broadcast `result_displayed` với `event_id: null`. `realtimeBroadcast` trả frame `type: invalidate, seq: null` khi không tìm được eventRow. Cả Web và Android, trừ một số control đặc biệt ở Android, gặp seq không hợp lệ đều lên lịch dirty recovery 1,5 giây.

Như vậy một biên nhận hiển thị hợp lệ có thể làm mỗi Reporter đang nối gọi một GET delta dù không có event DISPLAYED tương ứng trong stream. Delta trống không mang chính frame này tới reducer. Chưa có log ngày 29/10 để định lượng mức phát sinh hay kết luận toàn bộ giao diện thực tế sai.

**Đề xuất:** ghi một sự kiện DISPLAYED có identity/sequence và `receipt_revision` trong chính giao dịch hiện tại, chỉ khi chuyển trạng thái thật. Trigger scopes là reporter_recent. Broadcast snapshot/counter đúng revision. Sự kiện điều khiển khác như SKU/meal/schedule phải có hợp đồng rõ: hoặc event bền có seq, hoặc loại control versioned xử lý trực tiếp, độc lập cursor giao dịch. Không dùng chung `invalidate` không-seq rồi ép delta.

**Đánh đổi hợp lý:** thêm event row/index/write trong DO SQLite và payload outgoing; bỏ recovery request không hữu ích. Không thêm một DO HTTP call để ghi event. Giữ yêu cầu chỉ tính DISPLAYED sau UI thật.

Nguồn: `service/src/core.ts:1185–1227`; `read-model-core.ts:603–702`; `web/src/realtime-client.ts:356–361`; `AndroidRealtimeClient.kt:215–224`; trigger stream `operational-v2-core.ts:634–664`.

### P1-05 — Khoảng trống global seq hợp lệ vẫn gây HTTP recovery

**Đã thấy:** server chỉ gửi sự kiện đúng người nhận. Global seq có thể tăng do người khác. Client gặp seq lớn hơn appliedSeq + 1 thì GET delta; server delta scan global window rồi bỏ sự kiện không được phép xem. Đúng an toàn hiện tại, nhưng tạo lượt đọc dù bản thân người đó không mất sự kiện được phép nhận.

Ví dụ minh họa, không phải log đo: Picker A đã áp dụng seq 100; seq 101–103 chỉ thuộc người khác; frame tiếp theo cho A là 104. Client vẫn phải hỏi DO một lần để biết khoảng trống hợp lệ.

**Đề xuất giao thức v2:** giữ global seq/epoch cho audit và replay; thêm chuỗi giao nhận/ordinal riêng cho mỗi connection hoặc audience có kiểm chứng. Server cho biết predecessor thuộc stream được phép nhận; client chỉ recovery khi mất phần tử trong chuỗi giao nhận, reconnect, epoch đổi hoặc retention gap. Không broadcast dữ liệu người khác cho toàn bộ PDA để làm số seq liền nhau.

Không được đơn giản bỏ câu kiểm tra `seq > appliedSeq + 1`: trường hợp mất thật một event của A vẫn phải phát hiện. Giao thức mới phải xử lý race giữa bootstrap/catch-up/live frames, đóng socket, hibernate và phiên cũ; cần cập nhật Web + APK và giữ v1 đến khi có evidence fleet tương thích.

**Đánh đổi:** thêm attachment/metadata, SQL cho replay được phân quyền nếu thiết kế cần; giảm GET delta do khoảng trống không liên quan. Mức giảm tổng phụ thuộc số gap và tỷ trọng DELTA thực tế, chưa đo.

Nguồn: `web/src/realtime-client.ts:363–370`; `AndroidRealtimeClient.kt:225–230`; `operational-v2-core.ts:1745–1848`.

### P1-06 — FCM resolve/correct có nhiều lượt DO chuẩn bị riêng

**Đã thấy:** create/resolve/correct đã có transaction + broadcast 1 DO. Nhưng `scheduleFcm` khi không có prepared còn gọi reconcile alert window, lấy event metadata, lấy targets, ghi delivery-attempts, có thể disable token. Resolve/correct chủ động không tra hàng trăm token trên đường trả kết quả.

| Trường hợp có token và gửi khỏe | Số DO HTTP theo nhánh source hiện tại | Đề xuất |
|---|---:|---:|
| Create, prepared đầy đủ | 1 mutation + 1 attempts = 2 | Giữ khoảng 2; ưu tiên dedupe side effect |
| Resolve/correct có event_id | 1 mutation + 1 window + 1 event + 1 targets + 1 attempts = 5 | 1 mutation + 1 prepare + 1 complete = 3 |
| Resolve/correct có thêm invalid token | Có thể 6 | Complete vừa ghi attempts vừa disable token: 3 |
| Withdraw | 1, không chạy nhánh FCM này | Giữ 1 |

Số 5 không phải cam kết mọi resolve đều phát sinh 5: thiếu token, ngoài ca, lỗi provider hoặc đường return sớm có số khác.

**Đề xuất:** sau commit, Worker gọi một `/notifications/prepare-delivery` nội bộ để đọc window + event + batch + targets bằng SQL local; gửi Google từ Worker `waitUntil`; gọi một complete cập nhật attempts + invalid tokens trong cùng transaction. Chỉ đóng gói thao tác backend, giữ kết quả trả ngay và không kéo fan-out token lên đường đáp ứng người dùng. Phương án nâng cao dùng durable effect/outbox cùng transaction để retry mất send, nhưng phải giữ dispatch ngay và kiểm thử riêng.

**Đánh đổi:** cùng SQL nghiệp vụ, thêm ít cấu trúc/ledger nếu chọn outbox; giảm 2–3 lượt DO mỗi lần resolve/correct đủ điều kiện. Không lấy việc Google gửi thành công làm bằng chứng overlay đã hiển thị.

Nguồn: `business-api.ts:241–384,448–511`; `core.ts:802–933`.

### P1-07 — Idempotent transaction chưa đồng nghĩa side effect idempotent

**Đã thấy:** transaction replay trả `idempotent_replay: true`, nhưng sau đó `d171ShortageMutation` vẫn có đường broadcast và chuẩn bị targets; `handleBusinessApi` vẫn gọi scheduleFcm cho response OK. Client đã có nhiều lớp dedupe hiển thị, nhưng chưa đủ cơ sở nói lần retry giao dịch không gửi FCM lần nữa.

**Đề xuất:** event_id + loại effect + channel làm key ledger. Khi HTTP replay, tái trả response ổn định; chỉ tiếp tục effect chưa hoàn tất hoặc trạng thái gửi không chắc chắn. Không bỏ tất cả FCM trên replay vì lần gửi trước có thể chưa xảy ra. Gửi giữa hai hệ thống không thể được hứa exactly-once tuyệt đối chỉ bằng một cờ; giữ at-least-once phù hợp và dedupe client theo event/result identity.

**Đánh đổi:** thêm vài SQL writes trong invocation hoặc bước complete đã gom; giảm lặp broadcast/send/attempts và recovery do tác dụng phụ trùng. Cần quan sát tỷ lệ replay để biết lợi ích thật.

Nguồn: `business-core.ts:107–140,389–393,728–732`; `core.ts:844–933`; `business-api.ts:448–511`.

### P1-08 — Auth lookup tách riêng ở một số API còn lại

Đường nóng Báo hàng đã làm tốt, nhưng API management/reporting/config, notification device và SKU Agent còn mẫu `requireUser/requireAgentUser → user lookup DO → operation DO`. Một số thao tác còn broadcast riêng. `/api/realtime/presence` cũng kiểm tra manager rồi gọi DO đọc presence.

**Đề xuất:** mở rộng envelope đã tồn tại: Worker verify JWT, DO kiểm tra live user/session/role và xử lý action trong cùng invocation. Chỉ chọn các route có volume có nghĩa. Với thao tác cần proof hoặc external identity không cố ép thành một transaction dài; vẫn giữ thứ tự kiểm tra an toàn.

**Giảm:** điển hình 2 → 1 ở một endpoint được gom. Không dùng Firebase custom claims hoặc cache role vài phút để thay authority live. Phần notification device liên quan projection chung phải giữ nguyên contract phía ngoài phạm vi.

Nguồn: `business-api.ts:566`; `read-api.ts:116`; `notification-api.ts:48`; `index.ts:1730–1789`; `user-management-api.ts`.

### P2-09 — SKU tải phân trang riêng, membership đổi buộc FULL

**Đã thấy:** Android sync kiểm tra info, tải delta hoặc FULL từng trang 2.000, kiểm tra info lần cuối trước commit. Membership đổi trả 409 FULL_REQUIRED vì delta cũ không có tombstone; đây là guard cần thiết. MainActivity và PickerController có các đường kiểm tra info riêng. Agent upload stage theo lô 500, từng lô còn kiểm tra user và operation DO riêng.

**Đề xuất gần:** một snapshot catalog nhất quán có version/hash/count, trả theo một response nén hoặc số chunk được benchmark; gộp info sẵn trong bootstrap và thông báo đổi catalog. Giữ xác nhận version thích hợp trước swap cache; không vô hiệu guard chỉ để bớt một request. Catalog v2 có tombstone và membership_revision để cập nhật cả SKU bị ẩn, không phải FULL lại tất cả.

Có N SKU thì một FULL hiện tại xấp xỉ `ceil(N/2000) + 2` request catalog; lúc N chia hết page size có thể thêm trang rỗng để biết kết thúc. Đích payload nguyên khối phù hợp thường 2 lượt (snapshot + xác minh cuối) thay vì nhiều trang. Không đặt chunk rất lớn trước khi đo RAM PDA, response size, CPU và timeout.

**Đề xuất sâu:** snapshot immutable theo version có thể phục vụ qua Worker cache/D1, nhưng không hứa 0 DO nếu vẫn phải gọi DO kiểm tra live session từng download. Quyền/revocation không được yếu đi; đường báo hàng vẫn kiểm tra SKU hiện tại tại DO. Không thay đổi cơ chế chọn Agent/primary dành SKU trong đợt này.

Nguồn: `SkuCatalogCache.kt:66–151`; `MainActivity.kt:136`; `read-model-core.ts:197–253`; `D167SkuServiceClient.cs:158–175`; `index.ts:1730`.

### P2-10 — Chi tiết batch và phân trang gây read bổ sung khi snapshot chưa đủ

Web Reporter đã dùng snapshot nhưng vẫn prefetch chi tiết batch được chọn; recent offset > 0 phải reload vì một thay đổi có thể dịch trang. Chỉ bỏ reload sẽ cho kết quả thiếu hoặc sai thứ tự.

**Đề xuất:** subscription gắn view/filter/page-watermark. Server có thể tính một snapshot trang/chi tiết theo phiên bản và đẩy cho những view đang mở, gom những viewer dùng cùng filter. Thêm SQL Rows Read hoặc bảng projection/counter trong DO là đánh đổi trực tiếp để loại nhiều request client đọc lại. Không đẩy danh sách nhân sự chi tiết cho người không có quyền; view không mở không phải trả thêm dữ liệu.

Cách nhỏ hơn: trả chi tiết cần cho selection cùng bootstrap, dùng cache keyed batch + version + receipt_revision và chỉ làm mới khi thay đổi đúng batch. Giữ fallback khi chuyển trang, thiếu phần tử biên hoặc view không đủ dữ liệu.

Nguồn: `web/src/operational-app.ts:1667,3242–3291,3555–3667`; `operational-v2-core.ts:961–1154`.

### P2-11 — Nhiều tab Web có thể mở nhiều socket và tải trùng

Realtime client là module theo từng tab; applied state nằm sessionStorage. Không có SharedWorker/BroadcastChannel trong client hiện tại. Nếu cùng một phiên mở nhiều tab, mỗi tab có thể nhận event và gọi reads riêng. Chưa biết số tab thực tế.

**Đề xuất có điều kiện:** một transport owner cho cùng user + session generation + origin bằng SharedWorker hoặc leader tab và BroadcastChannel; các tab vẫn áp dụng state riêng, đóng/mất leader thì takeover ngay. Chỉ làm nếu log cho thấy đa tab đáng kể. Không gộp hai người hoặc hai generation, không coi browser leader là authority giao dịch.

**Giảm:** các socket handshake/recovery/fetch thật sự trùng; không giảm transaction độc lập. Cần kiểm thử tab bị suspend, crash, logout và môi trường browser hỗ trợ.

### P2-12 — Recovery lỗi kéo dài có thể lặp mỗi 1,5 giây

Web markDirty và Android scheduleDirtyRecovery đặt 1.500 ms; fetch/apply thất bại tiếp có thể lên lịch lại. Có recovering/in-flight guard nhưng chưa phải backoff đầy đủ cho mọi trạng thái lỗi kéo dài. Reconnect socket riêng có backoff; không được gọi hai cơ chế này là một.

**Đề xuất:** phân loại terminal auth/version errors, transient network/provider và apply/schema errors; gộp recovery chung, jitter/backoff khi lỗi dai dẳng, trigger khôi phục ngay khi mạng/socket/phiên hoạt động lại. Đừng giữ retry liên tục cho lỗi không tự hết. Không dùng việc kéo thời gian poll bình thường để đạt quota.

**Lợi ích:** tránh bão request trong sự cố; chưa định lượng vì không có log recovery lý do của ngày 29/10. Bắt buộc chứng minh phục hồi và dữ liệu realtime không kém baseline.

Nguồn: `realtime-client.ts:162–171,256–325`; `AndroidRealtimeClient.kt:236–292,330–359`.

### P3-13 — GET /health thực hiện nhiều kiểm tra migration riêng

**Đã thấy:** public health gọi core health, đọc launcher folder rồi `migrateActiveAdminFirebaseCredentials`. Trong nhánh khỏe, không có migration thực sự, tối thiểu khoảng **11 DO fetch**: health 1 + folder 1 + lookup ba account 3 + sáu query candidate/remaining 6. Nếu phát hiện migration thì còn thêm thao tác provider/DO. Không có bằng chứng đây là nguồn chiếm nhiều request hiện nay; getServiceHealth ở Web có import nhưng không chứng minh đang poll.

**Đề xuất:** liveness thuần Worker/commit không chạm DO; readiness cần dữ liệu live gom vào một DO request. Migration thuộc workflow/maintenance có explicit state/checkpoint, không chạy lại chuỗi kiểm tra trong mỗi probe. Contract các release gate dùng readiness phải giữ đầy đủ, không biến lỗi auth/schema thành healthy.

**Giảm:** khoảng 11 → 1 đối với một readiness khỏe đã refactor đúng; hoặc 0 DO cho liveness mới. Tổng ngày bằng số probe thực tế, không lấy 11 nhân một chu kỳ chưa biết.

Nguồn: `index.ts:514–584,1492–1528`; `web/src/operational-api.ts:232`.

### P3-14 — Cron vẫn đọc trạng thái nguồn nhân sự đã retire

**Đã thấy:** cron 5 phút gọi `retryIncompleteHrSnapshotIfDue`. Hàm này vẫn readSync từ DO khi APP_ENV=beta. Nhưng `processHrSnapshot` và `ensureHrDriveWatch` đều return ngay là nguồn Sheet đã retire. Kiểm tra status này không thể phục hồi intake đã bị tắt theo thiết kế hiện tại.

**Đề xuất:** chặn đường retry legacy cùng điều kiện retire, giữ audit/history và Web/Excel import. Có thể bỏ một DO read mỗi tick 5 phút: **288/ngày** nếu cron chạy đủ 24 giờ. Đây là suy ra lịch mã, chưa phải provider saving đã đo.

Những kiểm tra nền log pending còn giá trị có thể gom thành một maintenance-plan read, rồi chỉ chạy tác vụ due. Không kéo lịch gửi log, không gộp D172 hoặc tác vụ Agent ↔ PDA vào một release, không đụng dữ liệu phía đó. Agent log drainer đọc Firestore nên không được tính một GET đó thành DO request.

Nguồn: `index.ts:2739–2760`; `hr-event-sync.ts:312–316,455–470`; `runtime-logs.ts:932`.

### P3-15 — Constructor/wake còn chạy SQL schema và backfill

InventoryCore constructor chạy initializeSchema khi object tái tạo. Một số one-time update ngày VN, DDL/index và schema_meta write vẫn nằm đường khởi tạo; audit-retention next-run chỉ ở RAM và reset khi object tái tạo. Hibernation API tái chạy constructor khi wake, nên cần kiểm tra SQL scan cost theo số lần wake.

**Đề xuất:** migration/version checkpoint bền, fast readiness khi version đúng, backfill chỉ một lần; retention có mốc due bền hoặc gom vào maintenance đang chạy. Không cache cả business state ở RAM làm authority. Vì core shared, chỉ xem đây là candidate cần đo Rows Read/CPU/wake; không xóa logic migration D172.

**Giới hạn:** chủ yếu giảm Rows Read/Written/duration và cold latency, **không tự giảm số DO request đầu vào**. Đừng ưu tiên hơn P1 chỉ vì nhìn thấy nhiều SQL.

Nguồn: `core.ts:91–108,424–456,666–673`; [hibernation lifecycle](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

### P3-16 — SQL projection/telemetry có thể làm thêm việc, nhưng không phải DO hop

Một batch snapshot đang đọc nhiều count/subquery; delta có thể tính lại current snapshot nhiều lần cho cùng batch trong một trang. Có thể memo theo batch + version + receipt_revision **trong cùng invocation**, hoặc duy trì projection đầy đủ bằng transaction. Không cache theo batch_version đơn lẻ khi receipt thay đổi.

E049 ghi metric ROUTE trong finally và metric SQL cho một tập query; số telemetry upsert không phải toàn bộ provider rows_written. Giữ counters bền; chỉ thay bằng lossless aggregate nếu chứng minh durability. Các số SQL cũ ngày 26/10 là subset, không dùng để kết luận nguồn của 40,6 triệu Rows Read sáng 29/10.

**Đánh đổi:** tăng có kiểm soát SQL write/index cho projection để giảm truy vấn và các lần client cần hỏi lại. Memo SQL riêng lẻ chỉ giảm rows/CPU, chưa giảm invocation trừ khi giúp bỏ một HTTP fetch.

Nguồn: `operational-v2-core.ts:209–309,1745–1848`; `d173-persistent-usage.ts`; `d166-sql-usage.ts`; [E055](D173_E055_USAGE_OPTIMIZATION_2026-10-27.md).

### P3-17 — Log/folder/archive: chỉ gom bước liên quan, giữ receipt

Log hiện có auth, buffer upsert, folder lookup/lease/commit khi cache miss và mark-drive; có bước là cần thiết để chống folder trùng và không mất log. Cache folder ngày đã có nên không mô tả mỗi upload đều tạo lại folder. Có thể mang folder metadata trong response buffer/upsert và gom complete của nhiều bundle đã xác thực; parse/hash/nén/log redaction thích hợp có thể làm ở Worker.

Không bỏ lease, không chuyển trạng thái thành ARCHIVED trước Drive receipt, không giảm thông tin chẩn đoán đã được duyệt. Lợi ích DO thực tế phụ thuộc số bundle và cache miss; hiện không có thống kê để xếp ưu tiên cao hơn P1. Tác vụ log dành phần luồng bị loại trừ chỉ giữ nguyên.

Nguồn: `runtime-logs.ts:55–169,677–755,932–971`; `agent-log-drain.ts`.

### P3-18 — Usage collector không phải 36 DO request mỗi lần xem

`/api/agent/vps-usage` gọi `requireAgentUser`, tức một user lookup DO, sau đó collector gọi provider trực tiếp từ Worker, dùng cache theo metric/isolate. Ba account được cấp quyền có thể mỗi nơi hỏi một lần/5 phút; không có căn cứ coi mỗi metric là một lượt DO. Cache provider đang có không chia sẻ xuyên mọi isolate, nên có thể dư provider queries nhưng không tương đương DO queries.

**Đề xuất:** giữ freshness nguồn và cadence đã duyệt. Có thể dùng cache chung cho metric tổng hợp cùng scope/window nếu thực tế nhiều người xem làm tăng upstream cost; auth vẫn phải live hoặc có mô hình revocation tương đương. Nếu cache được mà vẫn gọi DO auth một lần/request thì DO tiết kiệm bằng 0. Không đưa 36 metric về DO lưu liên tục chỉ để cache, vì có thể tăng đúng loại request cần giảm.

Nguồn: `index.ts:1833–1847`; `d173-vps-usage.ts:23–64,383–480`; `D173VpsUsage.cs:106–117`.

## 6. Phương án đổi loại usage

| Hướng | DO request giảm bằng cách nào | Usage tăng | Bảo toàn kết quả/realtime | Đánh giá |
|---|---|---|---|---|
| **A. Một giao dịch trả đủ dữ liệu + server push + snapshot gộp** | Bỏ client fetch lại và các backend hop độc lập | SQL đọc/write projection, Worker/DO xử lý payload, RAM client | Cùng SQLite authority; không thêm thời gian chờ; cần seq/revision và test race | **Khuyến nghị chính, không cần provider mới** |
| **B. D1 read model cho dữ liệu đã khóa** | Request báo cáo/lookup thích hợp đi Worker → D1, không đi DO lấy cùng dữ liệu | D1 read/write/storage, Worker CPU; outbox/projection DO writes | Chỉ dùng dữ liệu có watermark/version được xác minh; auth live vẫn phải xử lý | **Ứng viên giai đoạn sau, có điều kiện** |
| **C. WebSocket hai chiều cho command/read** | Thay một số HTTP request bằng incoming WS application messages, gộp nhiều operation liên quan trong một envelope | DO duration/SQL/CPU khi xử lý messages; client protocol mới | Cần kiểm tra user/session trong DO mỗi command, request_id/replay/timeout/backpressure và fallback HTTP cùng id | **Có lợi billing tiềm năng; chưa bảo đảm giảm raw analytics** |
| **D. Cache Worker theo version, không theo thời gian tùy tiện** | Hit thật sự không gọi DO; version snapshot tái dùng | Worker CPU, cache bytes, có thể storage phụ | Dữ liệu bất biến/version biết trước; auth/generation không stale | **Tốt cho asset/catalog thích hợp; không thay live authority** |

### A — Phương án phù hợp nhất với điều kiện giữ database và giao diện

Kiến trúc đề xuất: client gửi command → Worker xác minh JWT → **một DO invocation** kiểm tra live quyền/phiên và transaction, tạo event/projection → trả result + delta cho người thao tác, đồng thời server push đúng người. Worker gửi FCM ngoài đường đáp ứng bằng prepare/complete đã gom. Client dùng reducer chung, chỉ đọc snapshot khi mở view hoặc cần khôi phục thật.

Giao diện các tab, nút, màu, workflow giữ nguyên; thay cách lấy và áp dụng dữ liệu. Không thêm debounce vài giây cho kết quả critical. Việc dùng nhiều Rows Written hơn để giữ event/projection/counter giúp bỏ hàng loạt round trip là đánh đổi có thực, thay vì sửa định nghĩa target.

### B — D1: có thể hữu ích, chưa phải thay thế trực tiếp SQLite DO

`service/wrangler.beta.toml` hiện **không có D1 binding**; scope chưa đăng ký D1 riêng cho Inventory. D1 usage nhỏ trên account không chứng minh database dùng được cho dự án này. Muốn dùng phải có phê duyệt resource/binding/quyền và isolation trước.

Chỉ ưu tiên báo cáo hoặc snapshot đã được khóa thật theo luật sửa/hậu kiểm, không coi “hôm qua” tự động bất biến. DO ghi outbox cùng transaction; projector upsert idempotent theo version/watermark vào D1. Đọc D1 chỉ khi đáp ứng watermark cần; thiếu/lỗi/quá chậm dùng nguồn DO đúng quyền. Theo dõi chi phí fallback để không biến một lượt DO thành D1 + DO vô ích.

Không khuyến nghị D1 cho badge/live queue/kết quả critical ở đợt đầu. Secondary projection bất đồng bộ không thể được hứa đồng bộ tức thì mà không thêm barrier/latency. D1 Sessions/bookmark chỉ bảo đảm thứ tự trong D1; không tự khiến D1 đồng bộ với SQLite của DO. Nếu mỗi D1 read vẫn xác thực bằng DO thì vẫn ít nhất một DO request, chưa đạt mục tiêu loại hop; không che phần auth bằng TTL cache.

D1 Paid hiện có mức bao gồm 25 tỷ rows read, 50 triệu rows written/tháng và 5 GB storage; cần lấy đúng quota account và phần phân bổ được Owner chốt. Row scan/index/write đều phải đo, không coi một query là một row. Thêm database là tăng vận hành/durability/rollback, không chỉ đổi chuỗi kết nối.

Nguồn: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

### C — WebSocket command: thử riêng sau khi đã bỏ thao tác thừa

Client hiện tại và E086 định nghĩa socket server → client; handler DO chủ ý không thực thi business frame. Chỉ bật protocol v2 sau review, không sửa handler E086 thành chấp nhận JSON tùy ý.

Đối tượng gắn socket phải giữ principal, channel, generation và hạn identity thích hợp; mỗi command đọc live authority trong invocation đó. Payload không được quyết định actor/role. HTTP fallback dùng đúng request_id cũ nếu mất response; không chạy cả hai transport không kiểm soát. Outgoing response phải có correlation id, result/event version, giới hạn payload và backpressure. Mạng mất vẫn không cho tạo báo hàng offline.

Theo quy tắc 20:1, 1.000 HTTP operations so với 1.000 WS app messages có thể tương ứng 1.000 so với 50 đơn vị billed incoming-message request, chưa tính connect/alarm/các HTTP khác. **Đây là minh họa tariff, không phải dự báo giảm 95% toàn hệ thống hoặc chỉ số dashboard.** Không chuyển công việc sang WS chỉ để làm dashboard đổi tên metric.

### D — Cache: cache trong DO và cache ngoài DO có tác dụng khác nhau

- Cache SQL/snapshot trong DO: invocation vẫn đã vào DO, nên chủ yếu giảm rows/CPU.
- Cache ngoài DO: chỉ giảm invocation nếu cache hit được phục vụ mà không gọi DO lại cho data/auth/version. Cache private phải phân quyền đúng; local Cache API không phải một cache đồng bộ toàn cầu.
- Với dữ liệu nóng, TTL 1–5 giây làm kết quả có thể cũ; không đạt yêu cầu giữ tương đương realtime chỉ nhờ TTL nhỏ. Dùng event/version fence hoặc dữ liệu bất biến được chứng minh.

Nguồn: [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## 7. Cách ước tính để không bịa tỷ lệ tiết kiệm

Các ví dụ sau mô tả một đường gọi có điều kiện, không phải số đo vận hành:

| Đơn vị so sánh | Hiện tại | Sau phương án phù hợp | Giới hạn |
|---|---:|---:|---|
| Một Android Picker create có FCM khỏe và refresh sau success | 2 backend + 2 reads = 4 DO | Khoảng 2 | Không tính bootstrap/receipt/sự kiện khác; không phải mọi create đều gửi FCM |
| Một Android Reporter resolve, FCM có token và refresh 3 API | 5 backend + 3 reads = 8 DO | Khoảng 3 | Nếu đang mở overdue hoặc có retry sẽ khác |
| Một Reporter reconcile | 3 hoặc 4 DO | 1 | Dữ liệu cần trả phải có cùng watermark |
| Một Picker reconcile | 2 DO | 1 | Catalog/info có thể được gộp thêm |
| Một readiness khỏe qua /health | Ít nhất khoảng 11 DO | 1 | Chỉ khi đã tách migration và gom readiness; volume chưa biết |
| Retired HR check cả ngày | Tối đa lịch chuẩn 288 reads/ngày | 0 | Chỉ loại đường retry đã vô hiệu về nghiệp vụ |

Các tiết kiệm có thể trùng nhau: khi đã bỏ refresh thì không được lại tính lợi ích gộp chính refresh đó. Khi event mới không còn gây gap, không được cộng toàn bộ DELTA với toàn bộ read fallback như hai khoản độc lập.

Mô hình cần đo:

`R_account = R_other_projects + R_excluded_features + R_in_scope`

`R_after_in_scope = R_unchanged + R_mutation + R_required_recovery + R_handshake + R_batched_reads + R_notification_prepare_complete + R_maintenance`

Chỉ chốt tổng tiết kiệm sau khi có lượt gọi theo family/feature/cause ở cùng khoảng mẫu. Dataset hiện tại gộp REALTIME và AUTH_SESSION khá rộng; D172 và luồng ngoài phạm vi còn dùng auth chung. Có thể mở rộng fixed categories trong chính counter đang ghi, không thêm request/timer và không ghi uid/token/raw URL/payload. Dedupe chỉ số client phải phân biệt “gọi API”, “attempt”, “replay”, “apply event” và “render UI”.

## 8. Kế hoạch kiểm chứng đề xuất

### Bước 0 — Baseline cùng điều kiện

Tái dùng durable route/SQL counters và log có sẵn để lấy ít nhất: create/withdraw/resolve/correct, snapshot/read, recovery vì filtered gap, recovery vì seq null, lỗi apply/epoch/retention, retry/reconnect, FCM prepare/delivery, auth và maintenance. Tách actor-role/channel-feature bằng enum, không dùng định danh cá nhân. Lấy một snapshot batch theo ca hoặc gắn vào lần xuất log đã có, không poll thêm mỗi vài giây.

Báo riêng provider analytics/account và phần source-attributed Inventory; với phần không tách được ghi UNATTRIBUTED. Đối soát billing theo kỳ đúng, không tự coi 31 ngày tháng lịch là kỳ đã xác minh. Ảnh 29/10 là baseline nửa ca, chưa dùng làm A/B trọn ngày.

### Bước 1 — Candidate không cần dịch dữ liệu

Nhóm ưu tiên P1-01/02/03/04/06/07, cộng retired-HR/readiness khi volume hợp lý. Làm nhỏ theo hợp đồng và bộ kiểm thử riêng trong cùng D173. P1-05 thay protocol có rủi ro cao hơn, kiểm thử rõ trước rollout. Giữ endpoint và v1 cho client còn dùng; số phiên/version thực tế quyết định khả năng bỏ fallback.

### Bước 2 — Replay/canary tương đương

So sánh cùng bộ đầu vào/đồng thời bằng harness local trước. Sau Owner duyệt triển khai, canary có giới hạn trên các client thử nhưng cùng authority database; không mirror ghi hai lần hay chạy giao dịch thật hai backend. Replay tách dữ liệu thử khỏi production. Snapshot/state/event/receipt sau cùng phải bằng nhau theo luật, chênh timestamp chỉ trong các trường được thiết kế không ảnh hưởng nghiệp vụ.

Đo hai ca đại diện tương đương, chuẩn hóa theo 1.000 báo hàng/resolve, PDA giờ và số người thực sử dụng. So DO HTTP/WS/alarm riêng, SQL rows, Worker CPU/request, network, lỗi, reconnect và latency. Không chạy A/B bằng chia ngẫu nhiên hai luồng ghi trên cùng batch rồi gọi đó là test an toàn.

### Bước 3 — Chọn D1 hoặc WS nếu còn cần

Nếu A đã đạt target và vận hành ngang/tốt hơn, dừng ở kiến trúc đơn giản hơn. Nếu còn vượt, phân bổ phần còn lại theo route volume; chọn cold reporting D1 hay WS based billing đúng vấn đề còn lại. Không migrate nóng toàn bộ hệ thống chỉ vì D1 đang dư.

## 9. Ma trận yêu cầu → thành phần → hợp đồng → kiểm thử → chứng cứ

| Yêu cầu | Thành phần/hợp đồng | Trường hợp phải kiểm tra | Chứng cứ để chấp nhận |
|---|---|---|---|
| Kết quả giống cũ | DO business transaction, triggers, read models | Report mới, trùng report, thu hồi hết hạn, nhiều Picker cùng SKU, hai Reporter chốt đồng thời | So exact business fields, ticket/batch version, event identity, audit và idempotency |
| Không mất realtime | socket v1/v2, reducer, delta | Event lọc người khác, mất thật một frame, out-of-order, duplicate, apply fail, reconnect giữa bootstrap/live | Applied cursor chỉ tiến sau apply; thiếu event phải replay hoặc resync đúng |
| DISPLAYED đúng nghĩa | Overlay/dialog + result-stage + receipt revision | FCM tới nhưng UI chưa hiện; socket/FCM cùng tới; cùng receipt retry; đóng local; đổi user khi retry | Không gửi RECEIVED/ACK mới; displayed counter/recipient đúng, không tạo duplicate event |
| Snapshot thống nhất | Bootstrap endpoint + SQL snapshot | Giao dịch xen giữa queue/counter; đổi filter khi request đang bay; lỗi từng phần | Một watermark logic, response cũ không ghi đè, lỗi không trả success giả |
| Session/quyền nguyên vẹn | JWT + user status + generation | Logout, login nơi khác, đổi role, disable, token giả/hết hạn, client type sai | 401/403 đúng, không lộ payload/private prepared tokens |
| SLA/ngày nguyên vẹn | Alarm, meals, overdue, date scopes | 00:00, 03:00, 05:00, 06:00, 22:00, tăng ca, clock skew, chọn nghỉ cạnh tranh | Deadline/counter/đóng batch đúng, không batch-delay cảnh báo |
| SKU nguyên vẹn | Import/stage/publish, catalog cache | Rename, active/hidden, tombstone, no-change FULL, mất mạng, source đổi trong download | Hash/count/version, cache swap atomic, conflict rule và daily FULL gate đúng |
| Tốc độ/ổn định | Worker/DO/client | Burst 20 PDA/5 giây và tải ca đại diện, provider FCM/Drive lỗi | P95/P99 không xấu hơn baseline chấp nhận; mục tiêu nghiệp vụ <5 giây; không tăng lỗi hoặc mất kết quả |
| Tiết kiệm thật | Route ledger + provider analytics/billing | Ít nhất hai ca so sánh phù hợp, cùng scope/đơn vị | DO giảm thật sau loại double-count; không vượt target khác/đẩy phí ngoài ngân sách |
| Resource chung an toàn | Shared Worker/Core/auth, D172 isolation | Hồi quy D172 API/auth/private table dù không sửa D172-owned code | D172 regression PASS; luồng ngoài phạm vi không bị đổi contract |
| Rollback an toàn | Additive endpoint/event, client feature gate | V1 cũ/v2 mới cùng tồn tại; rollback Worker hoặc APK riêng | Giữ SQLite/signature/session/idempotency; không drop dữ liệu/bảng; endpoint cũ còn dùng được |

Không thay đổi nguồn Agent ↔ PDA nên không thiết kế lại HA/confirm ở đây; nếu shared auth/core diff có thể tác động chúng thì chạy hồi quy bảo toàn, không lấy test hồi quy làm quyền thay đổi nghiệp vụ bị loại trừ.

## 10. Những phương án không nên duyệt ở trạng thái hiện tại

- Kéo tần suất đồng bộ realtime xuống để đẹp target: giảm chất lượng mà Owner yêu cầu giữ.
- Bỏ FCM khi socket online, bỏ displayed receipt hoặc idempotency: tiết kiệm bằng mất cơ chế tin cậy.
- Chuyển live queue sang D1/KV cache TTL rồi tuyên bố kết quả tức thời tương đương: chưa có consistency barrier và kiểm thử.
- Cache quyền/session vài phút để cắt DO lookup: làm yếu revocation.
- Mỗi HTTP đổi thành một RPC method rồi coi miễn DO request: mỗi stub RPC call vẫn là session/request theo tài liệu provider, trừ thiết kế RPC session đặc biệt đã kiểm chứng.
- Giữ DO thức lâu hơn hoặc tăng Duration để hy vọng request tự giảm: hai meter độc lập, muốn giảm phải giảm số operation đi vào.
- Bỏ E049 durable counters hoặc xóa log để giảm DO compute: metrics/log SQL trong invocation không bằng một invocation mới.
- Xóa code legacy không tới được rồi hứa giảm usage: thường chỉ giảm độ phức tạp bảo trì, không giảm request thực.
- Tăng target 50% hoặc đổi nhãn cảnh báo để coi tối ưu xong: không giảm tiêu thụ.
- Áp dụng tỷ lệ 20:1 WebSocket lên toàn bộ analytics hoặc hứa giảm 95% cả hệ thống.

## 11. Bằng chứng hiện có và giới hạn xác minh

**Đã xác minh:** main source SHA nêu trên; authority/scope/state/spec và bootstrap evidence được dùng theo phạm vi; public source call paths. GitHub run [40689962637](https://github.com/tamnv2/supra-inventory/actions/runs/40689962637) `Deploy Beta Worker` ở source `6824de94ac99183f8a3d4bd2120bc729ed8f7638` có kết luận SUCCESS ngày 28/10. Các commit sau trong snapshot chủ yếu Agent/docs; không suy từ đó ra version đã cài trên từng thiết bị.

Ba fixture hiện hữu được chạy local trong lần rà soát này đều PASS:

- `python tools/realtime_cursor_regression.py` → REALTIME_CURSOR_REGRESSION_PASS.
- `python tools/d173_e055_usage_regression.py` → SQL_EQUIVALENCE_PASS / ACK_VERSION_FILTER / PAGINATION / NO_EXTRA_TELEMETRY_CALLS.
- `python tools/d173_e049_sqlite_fixture.py` → SQLITE_RESTART_DURABILITY_PASS.

Đây là kiểm tra hợp đồng/baseline hiện tại; **không phải** kiểm thử hay CODE PASS của các phương án mới, không phải latency/provider billing/physical PDA test. Không gọi `/health` live trong lần audit để tránh chủ động chạy migration nằm trong GET đó.

**Còn thiếu để chốt mức tiết kiệm:** route/cause/feature attribution đúng ngày 29/10, lượng resolve/report/replay, số tab/version/client thật, same-scope provider billing và thử candidate. Chưa có cơ sở gán phần trăm tổng cho từng nguyên nhân hay khẳng định DO đã giảm.

**Trạng thái:** SOURCE AUDIT + PROPOSAL; IMPLEMENTATION NOT STARTED; NEW CODE/RELEASE/FIELD/OWNER PASS NONE. D173 vẫn mở, D172 independent PENDING/HOLD, historical Stable OWNER-GATED. Quyền triển khai cũ cho E096 không được dùng phát hành tối ưu mới.

## 12. Mục lục nguồn chính để review

Mọi tham chiếu dòng ở phần trên dựa trên SHA `15fe01f90466629ad6351cf32b72ba6f6a443b44`, không phải HEAD tương lai.

| Phần | Source |
|---|---|
| Resource, quota, trạng thái | `ops/authority-manifest.json`, `ops/project-scope.json`, `ops/project-state.json`, `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`, `service/wrangler.beta.toml` |
| Worker ingress/auth và FCM | `service/src/index.ts`, `service/src/auth.ts`, `service/src/business-api.ts`, `service/src/notification-api.ts` |
| Transaction, realtime, SQL | `service/src/core.ts`, `service/src/business-core.ts`, `service/src/operational-v2-core.ts`, `service/src/read-model-core.ts` |
| SLA/ngày/nghỉ | `service/src/sla-automation.ts`, `service/src/meal-break-core.ts`, `service/src/d167-overdue-core.ts`, `service/src/alert-window-core.ts` |
| Web | `web/src/realtime-client.ts`, `web/src/operational-app.ts`, `web/src/api.ts` |
| Android | `android/app/src/main/java/cd/cc/supra/inventory/beta/{AndroidRealtimeClient,ReporterController,PickerController,MainActivity,InventoryApi,SkuCatalogCache,StockMessagingService,NotificationSignalStore,CriticalOverlayService}.kt` |
| SKU Agent/cloud | `relay-agent/D167SkuServiceClient.cs`, `service/src/d167-sku-sync-core.ts`, `service/src/sku-import-core.ts` |
| Usage | `service/src/d173-vps-usage.ts`, `service/src/d167-route-usage.ts`, `service/src/d166-sql-usage.ts`, `service/src/d173-persistent-usage.ts`, `relay-agent/D173VpsUsage.cs`, `relay-agent/D173E089UsageCards.cs` |
| Log/nhân sự/báo cáo | `service/src/runtime-logs.ts`, `service/src/runtime-logs-core.ts`, `service/src/archive.ts`, `service/src/hr-event-sync.ts`, `service/src/user-management-api.ts`, `service/src/business-core.ts` |

Tài liệu giá/consistency kiểm tra ngày 29/10/2026: Cloudflare [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [hibernation/WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).
