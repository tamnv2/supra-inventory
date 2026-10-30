# D173-E106 — Rà soát bản đã phát hành: DO Requests và DO Rows Read

Ngày 31/10/2026, giờ Việt Nam. **ANALYSIS / PROPOSED — CHƯA DUYỆT CODE HOẶC TRIỂN KHAI.**

## 1. Kết luận để Owner quyết định

Ưu tiên giảm **công việc làm lại**, không kéo giãn thời gian đồng bộ. Có căn cứ nguồn và log để đề xuất bốn nhóm đầu:

- **A — Kết quả giao dịch đủ để cập nhật màn hình:** dùng chung bộ áp dụng event cho HTTP và WebSocket; bỏ tải lại toàn bộ sau thao tác đã có kết quả đầy đủ.
- **B — Một snapshot cho một lần khởi tạo/khôi phục:** gom các phần thực sự cần của cùng màn hình, kiểm tra quyền một lần trong DO, cùng mốc dữ liệu.
- **C — Đọc ít hơn trong SQLite:** bỏ truy vấn không ảnh hưởng kết quả; xử lý quyền người nhận theo lô; mở rộng bảng tổng hợp đang có, cập nhật ngay cùng giao dịch. Đây là hướng đổi một phần Rows Read sang Rows Written và CPU có kiểm soát.
- **D — Realtime biết đúng phạm vi người nhận:** phân biệt sự kiện của người khác với sự kiện của mình bị mất; giảm delta recovery và quét toàn luồng. Cần sửa hợp đồng và kiểm thử mất gói thực sự trước khi bật.

**E — Gom tác vụ phụ** như metadata Agent, FCM và đăng ký thiết bị theo đúng ranh giới xác nhận ngoài hệ thống. Không thay transport hoặc thông số HA của PickList để đạt mục tiêu DO.

**F — WebSocket hai chiều** và **G — D1 đọc lịch sử** là phương án sau, chỉ thử khi A–E chưa đạt mục tiêu. F có lợi về đơn vị tính phí nhưng không tự làm chỉ số invocation trên dashboard giảm 20 lần. G cần phê duyệt resource; hiện Báo hàng không có D1 binding được cấu hình.

Không có số liệu provider cùng cửa sổ ngày 30/10 đủ để cam kết tỷ lệ tiết kiệm toàn tài khoản. Các tỷ lệ bên dưới chỉ mô tả số lần gọi trong đường xử lý cụ thể. CODE/CI/RELEASE/FIELD/OWNER của phương án mới đều chưa PASS.

## 2. Snapshot nguồn và phạm vi thực sự

Main authority cố định: `1ccb12a55a3104729881714953735a7654f9231b`. Bootstrap manifest và 86 tài liệu/file khai báo được đọc/parse theo thứ tự; tổng khoảng 4,37 MB. Phần lịch sử không được coi là quyền triển khai hiện tại.

| Thành phần | Bản đã phát hành được xác minh | Đối chiếu nguồn |
|---|---|---|
| Agent Windows | `relay-agent-v162`, phát hành 15:25:09 ngày 30/10 VN | Tag/main `d7dab62bf482b8a080eb75c8e18ba328e287a7fe`; `relay-agent/` không có diff với snapshot main. Receipt E104 ghi EXE và channel cùng SHA-256. |
| APK Báo hàng | `beta-vc121`, phát hành 01:20:16 ngày 26/10 VN | Tag `e45eafd8fbc69edf6a75c750f61ad9808237394f`; `android/` không có diff với snapshot main. 87 log Android đã đọc đều ghi vc121. |
| Web | `3.3.2` | Nguồn Web đi cùng E052/e45eafd; `web/` không có diff với snapshot main. Log trình duyệt ngày 30/10 xác nhận 3.3.2. |
| Worker/InventoryCore | E103 đã deploy | Main `f15b9675b7de33194dbb43980fd5934ee09958fc`; run **41002569184 — Deploy Beta Worker — SUCCESS**. `service/` không có diff với snapshot main. |

Đã kiểm tra PR đang mở: PR794 chứa E097–E099 phân tích usage/Agent-PDA trước đó; E098 chỉ chấp nhận lưu thiết kế vào backlog, không phải lệnh code. PR803/E105 chứa FIELD FAIL Agent162 về hoạt động gần nhất và điều tra gián đoạn xác nhận; không coi Agent162 đã FIELD/OWNER PASS. Rà soát này bổ sung bằng chứng mới, không tự đóng các lỗi ấy.

Phạm vi: Web, Agent, APK **Báo hàng**, Worker/DO, SQL, realtime, notification/FCM, SKU, log, Usage và tác động lên Agent–PDA. D172 độc lập PENDING/HOLD, không thay nghiệp vụ, bảng riêng, APK hay channel riêng. Shared Worker/Core/auth có thay đổi sau này phải hồi quy cả D172.

GET production `/health` và PDA manifest từ môi trường rà soát trả HTTP403; vì vậy không có xác minh live độc lập tại thời điểm audit. Không suy ra hệ thống đang lỗi từ 403 này. Căn cứ phát hành là tag/source diff, GitHub run và log thực tế; không suy ra toàn bộ fleet đã nâng cấp.

## 3. Log ngày 30/10: bằng chứng và giới hạn

Đọc metadata 113 mục trong thư mục log ngày 30/10; tải và phân tích 87 log Android từ **40 thiết bị**, 22 log Agent và ba nội dung JSON Web/server khác nhau. Bốn mục Web có hai bản cùng tên/bundle của checkpoint server 13:15; không cộng chúng như hai phiên sử dụng. Không đưa log thô, tên nhân sự, mã thiết bị hay ID nghiệp vụ lên repo public.

| Alias bằng chứng riêng | Quan sát trực tiếp | Điều chứng minh được |
|---|---|---|
| L1 — log Picker gửi 16:20:42 VN | **1.359** lượt GET delta: 1.358 OK, một network error; **4** POST báo hàng. Delta thuộc hai bucket 15:00–16:59 VN. Không drop/omit bucket HTTP trong mẫu này. | Có tải đọc lại realtime rất lớn trong một mẫu thực; không thể coi đây là 1.359 giao dịch mới. Chưa có cause-level trace để gán toàn bộ cho một nguyên nhân. |
| L2 — log Reporter gửi 13:53:32 VN | Queue GET **263**, recent GET **262**, counters GET **260**; resolve POST **197**. Có cả refresh và realtime apply trong chẩn đoán UI. | Tải lại ba phần màn hình là đường có lượng gọi đáng kể. Không khẳng định tất cả GET đều do resolve; có vào màn hình/reconcile/mạng lỗi. |
| L3 — log Picker gửi 23:57:39 VN | Delta GET **210**, POST báo hàng **10**. | Hiện tượng delta nhiều không chỉ có ở L1. Không cộng chồng snapshot cùng process/thiết bị để suy tổng ngày. |
| L4 — log trình duyệt 15:54:42 VN | Web **3.3.2**, uptime khoảng **10,5 giây**, có lỗi auth/realtime ở cửa sổ này. | Xác nhận phiên bản và một cửa sổ ngắn; không đủ mô tả tải hoặc độ ổn định Web cả ngày. |
| L5 — 22 log Agent | Có chuỗi nâng v159→160→161→162; nhiều mẫu reporter roster UNAVAILABLE/HTTP403; một số snapshot cùng version được áp dụng lặp. | Cần phân loại quyền/mạng/callback; HTTP403 không tự chứng minh request đã tới Worker/DO. Callback lặp không đồng nghĩa một billed read mới. |

Counter HTTP là **attempt phía client**, counter SDK là callback, counter SQL/route là phần đã instrument; cả ba khác provider billing. Các log có thời gian gửi, tuổi process, giới hạn RAM/journal và khả năng reset khác nhau. Không cộng tất cả snapshot để bịa tổng request/ngày hoặc chia phần trăm của cả tài khoản.

## 4. Những tối ưu đã có — không đề xuất lại như việc mới

Đã có trong nguồn phát hành:

- Các hot route queue/recent/counters/Picker report/result, ticket/delta, SKU và shortage mutation dùng đường **authorized một lần DO**. Không còn căn cứ nói mọi API đều xác thực DO rồi lấy dữ liệu DO lần hai.
- Shortage mutation đã gom transaction + broadcast + chuẩn bị FCM trong invocation đang xử lý; terminal displayed receipt cũng broadcast tại DO đó.
- `batch_summaries` và trigger đã giữ nhiều counter; recent query phân trang trước rồi mới lấy chi tiết; E055 đã sửa MIN/MAX realtime thành hai scalar probe có index.
- Web/Android đã có incremental patch, epoch/cursor, dedupe và delta recovery. Phần còn dư là các đường vẫn full refresh hoặc recovery bị kích hoạt nhiều.
- WebSocket đã dùng Hibernation API và auto-response; E086 đã bổ sung handler frame ngoài dự kiến. OkHttp `.pingInterval(20s)` là protocol ping; không được gán toàn bộ ping này thành billed DO request.
- E097 đã có fast path tránh chạy lại toàn bộ DDL/backfill khi schema sẵn sàng. `SQLITE_NOMEM` chưa được chứng minh hết nguyên nhân gốc; không đổi DB hoặc chạy migration mạnh để thử tối ưu.
- Agent đã có gRPC/listener chính, watchdog và checkpoint/projection skip-no-change. Không cắt fallback hoặc HA fence vì thấy callback nhiều.

## 5. A — Giao dịch trả đủ patch; không tải lại cả màn hình

**Code hiện tại:** `ReporterController.kt` sau `resolveBatch()` và `correctResolvedBatch()` gọi `refresh()`. `refresh()` lấy queue, recent, counters, thêm overdue khi cần. `PickerController.kt` sau create/withdraw lấy lại reports + results. Một số Web create/withdraw/correct cũng load lại; Web resolve thường đã patch local nên không được áp tỷ lệ của Android cho toàn Web.

**Đề xuất:** response thành công mang event public đã commit, snapshot theo đúng quyền, thay đổi counter đúng filter, thời gian server và version. Tái sử dụng snapshot/event đã tạo khi broadcast, không query toàn bộ lần nữa. HTTP và WebSocket/FCM dùng cùng quy tắc apply/dedupe để sự kiện về hai đường không bị áp hai lần.

Ví dụ Reporter bấm “Đã có hàng” cho SKU A:

1. Hiện nay: ghi kết quả → tải lại Đang xử lý → tải lại Đã xử lý → tải lại số đếm.
2. Đề xuất: ghi kết quả → nhận đúng dòng A và counter đã đổi → cập nhật ngay; WebSocket đồng bộ cùng event tới máy khác.

| Đường xử lý, không tính FCM/hop phụ | Hiện tại | Đề xuất | Giảm số DO call trong đoạn này |
|---|---:|---:|---:|
| Một resolve Android + refresh ba API | 4 | 1 | 75% |
| Một report/withdraw Picker + hai GET refresh | 3 | 1 | khoảng 67% |

Với 100 resolve thuộc trường hợp đầu, bỏ được **300 GET**, không phải “giảm 75% toàn hệ thống”. Delivery-result FCM, handshake, auth refresh, log và yêu cầu khác vẫn tồn tại. Nếu tính thêm một delivery-result call cho mỗi resolve thì ví dụ 5→2, không phải 4→1.

**Bất biến:** request ID/idempotency, session generation, correction deadline, user target, batch/event version và DISPLAYED giữ nguyên. HTTP response về chậm không ghi đè event mới hơn. Áp một patch mutation không có nghĩa tự nâng global cursor qua những sự kiện chưa áp dụng. Thiếu snapshot/version hoặc kết quả mạng chưa chắc chắn thì reconcile đúng phạm vi, không báo thành công giả và không tự gửi mutation mới.

**Đánh đổi:** payload, parse CPU và RAM cục bộ tăng nhẹ; có thể giảm cả SQL lẫn request nếu reuse snapshot. Không chờ tích đủ một lô giao dịch rồi mới trả kết quả.

## 6. B — Một lần lấy trạng thái cho một màn hình

**Code:** refresh Reporter có ba API độc lập; Picker có hai; foreground Android gọi profile và meal qua các đường riêng. Meal GET, Agent reporter-online và notification registration vẫn có auth lookup rồi operation fetch riêng.

**Đề xuất:** snapshot endpoint theo role/màn hình: xác thực Firebase signature ở Worker, kiểm tra quyền/phiên hiện tại trong DO một lần; đọc các phần cần thiết ở cùng revision/cursor/server time. Có thể trả kèm catalog-info, trạng thái ca/nghỉ hoặc realtime ticket khi đúng lần khởi tạo cần chúng. Không tải cả catalog, mọi tab hoặc lịch sử 60 ngày chỉ để gọi đó là “một đường”.

| Trường hợp | Số DO call trước → sau, cùng phạm vi |
|---|---|
| Reporter refresh queue/recent/counters | 3 → 1 |
| Picker refresh reports/results | 2 → 1 |
| GET meal hiện có | 2 → 1 khi chuyển sang authorized handler |
| Agent lấy roster + Usage đúng cùng nhịp | 3 → 1 nếu gom auth và roster trong DO; Usage provider được Worker lấy bên ngoài |

Giữ nguyên phân trang, giới hạn dữ liệu, tìm kiếm và khả năng đọc tất cả dòng theo hợp đồng cũ. Snapshot lớn vẫn phân trang; các trang mang revision/coverage phù hợp, không giả vờ một request luôn đủ mọi quy mô. Không tự kéo giãn tần suất auth, roster hoặc Usage.

**Đánh đổi:** ít round trip và ít auth query lặp; SQL nghiệp vụ chỉ giảm thật nếu dùng chung kết quả hoặc bỏ truy vấn trùng, không phải chỉ bọc nguyên ba query trong một JSON. Read snapshot phải có mốc nhất quán, không ghép những phần lấy trước/sau một mutation cạnh tranh mà không có revision.

## 7. C — Giảm Rows Read bằng xử lý theo lô và bảng tổng hợp

### C1. Bỏ truy vấn không thay đổi đầu ra

`operational-v2-core.ts::pickerRealtimeMetadata()` có nhánh query `actorOwnsEvent`, sau đó `return actorOwnsEvent ? {} : {}`. Trong đường caller đã qua kiểm tra người nhận, truy vấn này không thay đổi metadata trả ra. Có thể bỏ chính truy vấn ấy, vẫn giữ toàn bộ kiểm tra quyền trước đó. Không gán khoản tiết kiệm lớn trước khi đo số lần nhánh này chạy.

### C2. Một lần kiểm tra quyền theo lô, không N lần đọc lại cùng user

`delta()` lấy tối đa 100 sự kiện chung rồi gọi `pickerCanReceiveRealtimeEvent()` cho từng sự kiện. Hàm này kiểm tra lại users và các quan hệ ticket/recipient, dù authorized route đã đọc user hiện tại. Các event được chọn tiếp tục đọc batch/ticket/result/metadata riêng.

Đề xuất dùng user đã được xác thực **trong invocation này**, một truy vấn theo lô để xác định những event được phép, sau đó lấy projection theo tập ID. Không cache quyền có TTL ở Worker. Cursor vẫn phải tiến theo **cửa sổ global đã kiểm tra**, kể cả trang không có event cho Picker; không thay cursor bằng MAX của riêng tập selected.

Trong `realtimeBroadcast()`, reporter snapshot chung đã tính một lần. Có thể reuse projection Picker trong invocation theo khóa user + role/session generation + event/version cho nhiều socket cùng người; không dùng snapshot người này cho người khác, không cache băng qua mutation không kiểm soát.

Ví dụ một trang có 100 event, chỉ hai event thuộc Picker A: hiện tại làm kiểm tra theo từng event; đề xuất lọc quyền theo lô rồi chỉ dựng hai projection cần gửi. Kết quả và quyền phải giống hoàn toàn, không được bỏ kiểm tra recipient để giảm SQL.

### C3. Mở rộng `batch_summaries`, không dựng một nguồn dữ liệu cạnh tranh

`currentBatchSnapshot()` đã dùng một số field từ summary nhưng vẫn đọc COUNT/MIN/MAX của resolved, withdrawn, displayed, các mốc chờ/quá hạn. Queue/overdue/counters có những lần quét cùng nhóm batch; counters lịch sử còn COUNT theo khoảng ngày.

Đề xuất theo thứ tự:

1. Gom hai phép đếm queue/overdue thành một phép đọc với điều kiện tương đương; reuse counts của recent khi cùng snapshot và filter.
2. Xác minh index bằng query plan và `cursor.rowsRead`, bao gồm index entries. Không mặc định `LIMIT 1` hoặc trả một dòng là chỉ đọc một dòng.
3. Bổ sung những field summary có lợi nhất, cùng transaction/trigger với thay đổi nguồn. Cân nhắc tổng hợp theo ngày cho badge/lịch sử; ngày dựa đúng `first_report_at`/business-day của hợp đồng hiện tại, không tự đổi sang ngày resolved. Khoảng thời gian không tròn ngày phải xử lý chính xác hai biên.
4. Giữ fallback/rebuild kiểm chứng khi summary thiếu; lỗi hoặc rollback không được để summary và dữ liệu nguồn lệch nhau.

Ví dụ minh họa: 1.000 lần mở một tổng gồm 5.000 dòng có thể quét khoảng 5 triệu dòng; đọc một tổng đã duy trì có thể chỉ cần khoảng 1.000 lần đọc giá trị, đổi lại thêm writes khi trạng thái thực thay đổi. **Đây là ví dụ cấu trúc**, không phải kết quả billing hoặc benchmark của hệ thống này; số index/row thực phải đo.

**Meter tăng:** DO Rows Written, một ít CPU, storage/index. Từ bảng giá hiện hành, overage một row write có đơn giá xấp xỉ 1.000 row reads; vì vậy không đổi bừa 100 reads thành một write rồi gọi là rẻ hơn. Ưu tiên vẫn nằm trong headroom đã xác minh và tính cả index writes, triggers, backfill, correction và rollback.

## 8. D — Sửa nguyên nhân đọc lại realtime

`AndroidRealtimeClient.kt` và `web/src/realtime-client.ts` đều xem `seq > applied + 1` là lý do gọi delta. Nhưng `seq` là luồng chung và server chỉ gửi event đúng người nhận. Khoảng trống có thể do người khác hoạt động. Server delta hiện quét cửa sổ chung rồi lọc theo quyền; điều này đúng về an toàn nhưng có thể tốn rất nhiều request/row khi recovery lặp.

Ví dụ A nhận event 100; event 101–105 thuộc các Picker khác; event tiếp theo của A là 106. Máy A hiện phải hỏi lại để chứng minh 101–105 không bị bỏ sót. Đề xuất server cung cấp **chuỗi/cursor theo tập người nhận hoặc bằng chứng coverage đáng tin cậy**, để máy biết đây là khoảng trống hợp lệ.

Không được chỉ sửa client thành “cứ thấy 106 là nhận” hoặc bỏ điều kiện +1. Nếu 104 cũng thuộc A nhưng đã mất, cách ấy bỏ sót dữ liệu. Thiết kế phải:

- Gắn epoch, principal/role/session generation và phạm vi coverage; không tiết lộ event của người khác.
- Có thể dùng projection recipient cùng giao dịch/event đã commit; nếu cần bảng/index phụ thì ghi rõ chi phí Rows Written theo số người nhận thực tế.
- Giữ replay bền vững, pagination, true-gap recovery, reconnect, retention gap, reset stream, đổi quyền và đổi phiên.
- Sau hibernation/restart không dựa vào RAM “lần cuối đã gửi” để tự kết luận máy đã nhận; gửi socket thành công không phải ACK.
- Control frame không sequence phải được phân loại rõ, xử lý idempotent với identity riêng; không mặc định tất cả đều là mất nghiệp vụ. Frame không hiểu hoặc thiếu bằng chứng vẫn reconcile.

Hướng D ưu tiên cao theo bằng chứng L1/L3 nhưng độ phức tạp hơn A/B. Trước triển khai cần ghi reason recovery vào counter RAM có sẵn, kèm scanned/returned/pages/no-progress ở dạng tổng hợp, gửi theo lịch log cũ. Không thêm polling hoặc write DB cho từng chẩn đoán. Mẫu L1 chưa chứng minh 100% trong 1.359 delta đều do global-seq gap.

## 9. E — Gom việc phụ; bảo toàn đường Agent–PDA

| Đường còn có thể giảm | Đề xuất giới hạn | Điều phải giữ |
|---|---|---|
| FCM delivery-result + disable invalid tokens | Một callback DO chứa cả hai phần khi cùng kết quả gửi. Nếu không có token lỗi, hiện đã chỉ một callback; không tính tiết kiệm ở trường hợp đó. | Event/result identity, audit từng attempt và token invalidation; không chờ đủ N kết quả mới xử lý. |
| Notification device auth + upsert + đọc lại presence | Auth/upsert và chuẩn bị projection/signature trong invocation; Worker sử dụng payload nội bộ đã chuẩn bị. | Token không ra response public/log. Mirror ACK chỉ ghi **sau** khi Firebase mirror thành công; không gộp mất bước xác nhận ngoài hệ thống. |
| Agent roster + Usage cùng nhịp | Bundle metadata theo quyền, reuse auth. Coalesce provider request đang bay trong cùng isolate nếu trùng. | Cache Worker hiện là isolate-local; không tuyên bố đã thành cache chung mọi máy/POP. Giữ source timestamp, N/A và cadence. |
| SKU client nhiều máy tải cùng bản | Đánh giá bản catalog bất biến theo revision/hash và cache dữ liệu đọc phù hợp. | Live authorization, FULL-day gate, tên/vị trí/active/tombstone đúng; publish revision và cache swap atomic. Không dùng TTL để trả danh mục sai sau cập nhật. |
| Agent/PDA lỗi mạng và retry nhiều tầng | Một ngân sách retry/deadline cho một operation; same-ID recovery và single-flight refresh/listener lifecycle. | Kết quả WMS đã commit không bị đổi thành thất bại vì ACK gửi lỗi; không tạo job mới hoặc bấm lại khi chưa biết kết quả. |

Ba tài khoản được phép Usage, nếu cùng hoạt động đủ 16 giờ và mỗi máy gọi 5 phút/lần, riêng request Usage là khoảng **576 lần xác thực DO/ca** trước các cửa sổ phụ. Đây là **mô hình theo cấu hình**, không phải số usage đo từ log. Gom với roster khi lịch trùng có thể giảm một phần; không giải quyết toàn bộ DO vượt target.

Agent ↔ PDA PickList tiếp tục Firestore; PRIMARY/generation/guard/CAS, listener, watchdog và ACK giữ nguyên. Common lease hiện có nhịp 10 giây/stale 15 giây; không nới để giảm usage. Không chuyển Office sang Cloudflare vì yêu cầu “một đường”: có thể làm hỏng khả năng đi mạng hiện tại và tăng DO Requests. Các đề xuất AP01–AP16 của PR794 còn là backlog kiểm chứng/duyệt, không được ghi là đã sửa.

Các log Agent được áp dụng cùng version nhiều lần có thể xử lý local một lần theo version/semantic signature. Đây chủ yếu là CPU/UI; không mặc định là DO Rows Read hoặc Firestore billed reads. Lỗi 403/401 phải phân loại permission/session/mạng rồi có retry đúng loại; không backoff làm chậm cứu việc khi lỗi mạng phục hồi.

## 10. F/G — Đổi meter ở mức kiến trúc

### F. WebSocket hai chiều có kiểm soát

Hiện socket chỉ server→client; `InventoryCore.webSocketMessage()` cố ý không thực thi business frame. Đổi sang gửi mutation/read/receipt qua socket là **giao thức mới**, không phải bật một option.

Cloudflare tính incoming application messages theo tỷ lệ **20:1 cho compute-request billing**; outgoing và protocol ping không có request charge tương ứng. Ví dụ 1.000 HTTP operations đủ điều kiện đổi thành 1.000 incoming business messages có khoảng 50 đơn vị billed request, cộng handshake/ticket/recovery và callback HTTP còn lại. **Analytics vẫn thể hiện invocation/message thực**, không tự giảm 95% chỉ số đang hiển thị.

Phải có request ID, current session/role/capability check cho mỗi operation, timeout, idempotency, result receipt và HTTP fallback cùng contract. Token refresh, revoke, business proof và mạng Office giữ nguyên. Hibernation, duration, CPU, RAM và pin PDA phải đo. Không giữ DO thức chỉ để hy vọng request giảm. Chỉ thử có giới hạn sau A–E và đo cả raw analytics lẫn billed units.

### G. D1 chỉ cho bản đọc có ranh giới rõ

`service/wrangler.beta.toml` không có `d1_databases`; scope registry không đăng ký D1 riêng cho Báo hàng. D1 trên dashboard tài khoản dùng chung không chứng minh Báo hàng có DB sẵn hoặc được phép dùng DB của dự án khác.

Nếu Owner muốn thêm resource sau này: cân nhắc mirror lịch sử đã khóa/báo cáo/SKU revision bất biến sang D1 bằng outbox và watermark; live mutations, quyền/phiên và realtime vẫn thuộc DO. Khi cần kết quả mới hơn watermark, phải chờ barrier hoặc đọc DO theo contract; không trả stale rồi gọi là tương đương. Dữ liệu lịch sử cũng có correction/retention nên không chỉ nói “đã qua 03:00 là bất biến” mà bỏ kiểm tra chính sách khóa.

G giảm **DO Rows Read**, tăng D1 Reads/Writes, Worker CPU và chi phí đồng bộ/đối soát. Nếu vẫn phải kiểm tra quyền hiện tại qua DO, số DO Requests có thể không giảm; các hot GET hiện vốn đã gộp auth+read thành một DO call. Không dùng D1 làm đường xử lý giao dịch song song hoặc fallback báo hàng offline.

## 11. “Một đường” nên hiểu và triển khai thế nào

Thiết kế nên hướng tới **một payload/event chuẩn**, một bộ apply/dedupe cho cùng kết quả và một snapshot cho cùng màn hình. Web/APK: snapshot khởi tạo → event push → delta chỉ khi thật sự thiếu. HTTP mutation và socket không được tạo hai lần cập nhật hoặc hai nguồn quyết định khác nhau.

Giữ các đường cần thiết theo năng lực mạng: Báo hàng qua Worker/DO; Agent–PDA/HA qua Firestore theo hợp đồng hiện tại; FCM để đánh thức/hiển thị nền; Drive để lưu log. Không gom bằng cách bỏ FCM, bỏ DISPLAYED, bỏ watchdog, hoặc lấy Drive/Sheet làm database nghiệp vụ. Thông tin được gộp khi đã cùng thao tác, không đợi gom lô làm chậm cảnh báo hay xác nhận.

## 12. Meter, quota và cách đo đúng

Nguồn Cloudflare chính thức đã đọc ngày 31/10 qua repo tài liệu của nhà cung cấp:

- [Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), bản nguồn [durable-objects-pricing.mdx](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx).
- [SQL API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), bản nguồn [sqlite-storage-api.mdx](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/durable-objects/api/sqlite-storage-api.mdx).

| Meter | Phần bao gồm Paid/tháng | Target nội bộ 50% Cloudflare hiện hành | Mức tăng có thể chấp nhận để đổi công việc |
|---|---:|---:|---|
| DO Requests | 1 triệu | 500.000 | Không phải nguồn bù; cần giảm actual hop/operation |
| DO Rows Read | 25 tỷ | 12,5 tỷ | Không phải nguồn bù |
| DO Rows Written | 50 triệu | 25 triệu | Tổng hợp/index/recipient projection nếu đo được lợi ích |
| DO Duration | 400.000 GB-s | 200.000 GB-s | Có thể tăng do xử lý nhiều hơn trong invocation; không tự thay thế request |

Target ngày nếu chia đều tháng 10: request khoảng **16.129/ngày**, Rows Read khoảng **403,23 triệu/ngày**. Đây là kế hoạch nội bộ theo tháng, không phải quota cứng mỗi ngày của gói Paid. Không dùng số ngày này để suy provider đang vượt nếu chưa có numerator đúng scope/cửa sổ.

Các quota không đổi đơn vị cho nhau. SQL output count khác billed rows examined. Index update/deletes/alarm và KV trên SQLite cũng có meter; đổi tên SQL thành `storage.get()` không miễn Rows Read. E049 durable telemetry có SQL UPSERT thật; bỏ một HTTP/query thừa có thể giảm cả telemetry gắn với nó, nhưng không được tự thay số liệu bền vững bằng RAM hoặc hứa batching không mất số khi crash.

Đối chiếu ba lớp: (1) HTTP/hop/SQL trong đường code, (2) provider invocation/RowsRead đúng namespace/script và thời gian, (3) billed units/invoice. Namespace hiện chia sẻ vật lý với D172; account-wide còn các dự án khác. Không coi toàn bộ account là riêng Báo hàng, không tự lấy analytics request chia 20 cho mọi loại invocation.

## 13. Ma trận yêu cầu → hợp đồng → kiểm chứng

| Yêu cầu | Thành phần/hợp đồng | Bài kiểm tra cần có trước code/release PASS |
|---|---|---|
| Cùng kết quả sau A/B | Worker/Core + Web/Android snapshot/apply | So API body, hàng/counter, filter/date/queue order trước–sau; hai Picker cùng SKU; resolve/correct/withdraw cạnh tranh; response về đảo thứ tự; event HTTP+WS lặp; phân trang >200 dòng. |
| Không mất realtime sau D | Epoch, user/role cursor, replay | Event của người khác; mất event của mình; event đến trễ/lặp; drop socket giữa commit và send; 0 matched event/100 scanned; reconnect; reset/retention; hibernation; client cũ/mới; thiếu coverage phải fail closed/reconcile. |
| Summary đúng C | Transaction, trigger, version | Tạo/rút/resolve/correct/auto-skip/DISPLAYED; batch còn người chờ và quá hạn; rollback; summary thiếu/rebuild; không nhân đôi counter khi retry; khoảng ngày và biên không tròn ngày. |
| Quyền/phiên không yếu | Firebase signature + DO current authority | Kích/replace session, disable, đổi role/capability, JWT hết hạn, mixed-version Worker/Core, Android/Web/Agent sai kênh; không cache token/role với TTL để bỏ revocation. |
| FCM/log đáng tin | Recipient/event/stage/mirror receipt | Provider timeout, token invalid, duplicate callback, mirror thành công ACK lỗi, retry same signature; không lộ private prepared fields; giữ 13:15/21:15 và cleanup sau xác nhận thành công. |
| Agent–PDA ổn định | PRIMARY/lease/generation/CAS/WMS | Office/Internet, failover trong khi confirm/ACK, WMS success nhưng ACK lỗi, update/restart PRIMARY, token refresh/listener lỗi; không double-confirm, không đổi deadline/fencing. |
| Giữ lịch nghiệp vụ | Server time/VN day/SLA/meal | 00:00, 03:00, 05:00, 06:00, 22:00, tăng ca; clock skew; meal một người thắng; không thay alarm chính xác bằng cron/poll chậm. |
| Shared resource an toàn | Worker/Core/Auth cùng D172 | D172 API/auth/SQLite/Sheet và release-isolation PASS khi có diff shared; không sửa source/bảng/channel riêng. |
| Tốc độ/usage thật | Provider + test tải cùng điều kiện | Burst 20 PDA/5 giây; so P50/P95/P99 end-to-end với baseline chấp nhận; mục tiêu nghiệp vụ <5 giây và HA <20 giây; không tăng lỗi, CPU, RAM, pin hay phí ngoài headroom. |

Ba fixture baseline đã chạy local trên snapshot hiện tại đều PASS: `realtime_cursor_regression.py`, `d173_e055_usage_regression.py`, `d173_e049_sqlite_fixture.py`. Đây là kiểm tra **nguồn hiện tại**, không phải kiểm thử ứng viên A–G, cloud latency/billing hoặc thiết bị thật.

Đo ít nhất hai ca có tải so sánh được: PDA-hours/Agent-hours, số report/resolve/receipt/confirm, số client và reconnect; normalize trên 1.000 nghiệp vụ. Thu cùng window và scope cho DO Requests/RowsRead/RowsWritten/Duration, Worker Requests/CPU, Firestore, FCM/Drive. Dùng counter/log đang có; nếu thêm attribution thì RAM bounded, không có vòng polling/write mới. Không ngoại suy từ riêng L1 thành cả fleet.

## 14. Thứ tự thực hiện được đề nghị, chưa được duyệt

1. **Không đổi code/đo baseline:** chốt request attribution và cause recovery bằng log đang có; giữ E105 FIELD FAIL mở. Đây là đối chứng no-change, không được coi là đã tối ưu.
2. **A+B, rồi C1/C2:** bỏ refresh thừa và hop thừa, cùng DTO/apply contract; có fallback và rollback riêng Worker/Web/APK. Worker hỗ trợ additive contract trước, client mới dùng sau; không phá client cũ.
3. **C3+D:** mở rộng tổng hợp và cursor recipient với bằng chứng parity, quota và true-gap test. Không triển khai D bằng cách chỉ bỏ kiểm tra khoảng trống.
4. **E:** bundle metadata/FCM cần thiết; tối ưu retry Agent–PDA theo backlog đã kiểm chứng, không đổi carrier hoặc các ngưỡng hiện hành.
5. **F/G:** giữ riêng để Owner cân nhắc nếu chưa đạt target; R&D/provision thêm resource phải có phê duyệt cụ thể.

Rollback: endpoint/event mới additive, capability/version-gated; có thể quay về đường cũ khi parity/latency lỗi. Giữ schema/bảng cũ, epoch và business data; không rollback dữ liệu hoặc drop bảng để quay bản. Lưu ý rollback làm usage tăng lại là tình huống phải đo trước, không tắt giao dịch để giữ target. Không tự tái dùng lệnh deploy E052/E096/E103 cho tối ưu mới.

**Đề nghị duyệt:** A+B+C+D theo thứ tự trên, E trong cùng phạm vi khi có chứng cứ; chuẩn bị code và kiểm thử trước. Chưa duyệt F/G hoặc triển khai production từ bản phân tích này. Không hứa một tỷ lệ tiết kiệm toàn hệ thống trước khi có candidate và đối soát provider.

## 15. Mục lục nguồn chính

Các dòng tham chiếu dựa trên snapshot main nêu ở mục 2:

- `android/.../ReporterController.kt`: `onRealtime`, `refresh` (362–440), resolve/correct (815–866).
- `android/.../PickerController.kt`: `applyRealtimeEvents` (383–410), create/refresh (888–942), withdraw (1215), DISPLAYED (1070).
- `android/.../AndroidRealtimeClient.kt`: protocol ping (31), gap/recovery (225–280), apply/commit (287–325).
- `android/.../MainActivity.kt`: foreground profile/meal (332–357); local minute tick (168–183) không phải polling auth mỗi phút.
- `web/src/operational-app.ts`: queue/counters (3242–3316), correction (4893), create/withdraw (5004–5014), reconcile (5576 trở đi).
- `web/src/realtime-client.ts`: `handleFrame`, `recoverDelta`; setInterval 5 giây kiểm tra socket hiện có, không mặc định là HTTP poll mỗi 5 giây.
- `service/src/business-api.ts`: authorized hot routes; FCM completion (348–359).
- `service/src/core.ts`: schema fast path; authorized routes (1141–1366), in-invocation broadcast/FCM, WS handler (754).
- `service/src/operational-v2-core.ts`: summary snapshot (209), counters (769), recipient filter/projection (1578–1743), delta (1745).
- `service/src/read-model-core.ts`: ticket/connect (303–399), authenticated roster (506), broadcast (648 trở đi).
- `service/src/notification-api.ts` và `firestore-projection.ts`: auth/upsert/mirror ACK và projection read/ACK.
- `service/src/index.ts`: current-authority auth (629/704), Usage (1836), roster (2565), meal (2688).
- `service/src/d173-vps-usage.ts`, `relay-agent/D173VpsUsage.cs`, `D173ReporterPresence.cs`: cadence/cache/bundle opportunities.
- `service/src/d173-persistent-usage.ts`: crash-durable counters và chi phí thực.
- `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`; E052/E055/E086/E097/E103/E104; PR794 E097–E099; PR803 E105.

Trạng thái kết thúc audit: **PROPOSAL READY, IMPLEMENTATION NOT STARTED; SAVINGS UNMEASURED; RELEASE/FIELD/OWNER PASS NOT CLAIMED.**
