# D169 — Tiếp nhận các vấn đề mới, phân tích đồng nhất theo đợt

**Mở:** 14/10/2026 (giờ Việt Nam) · **Trạng thái:** OPEN — INTAKE / RECORD ONLY.
**Owner:** xác nhận D168 **PASS giới hạn trên phương diện code/phiên bản đang dùng, chưa ghi nhận thêm vấn đề tại thời điểm xác nhận**; yêu cầu mở D169, tập hợp các phát hiện trước khi phân tích đồng bộ.
**Accepted base:** D168 — OWNER LIMITED CODE/AS-DEPLOYED PASS; **không** đồng nghĩa toàn bộ FIELD PASS, đo usage, hay các vấn đề tồn tại trước đó đã khắc phục.
**Nguồn chính:** `ops/change-continuity/D169.json`, `ops/project-state.json`, `docs/OWNER_DECISIONS.md`; hồ sơ lịch sử D168 giữ nguyên.

## Nguyên tắc D169
- Chỉ **nhận yêu cầu / triệu chứng / thời gian / phiên bản / log, lưu vết và phân nhóm**. Chưa chạy code, đổi Worker/Agent/Web/PDA, cập nhật ứng dụng, bật/tắt dịch vụ hoặc phát hành.
- Owner cung cấp nhiều mục; gom đủ mới kiểm tra repo/source/log và phân tích **một đợt**, giải quyết quan hệ nhân quả/ảnh hưởng chéo để không vá từng lỗi độc lập.
- Trước đề xuất cuối: so sánh phương án giữ nguyên, sửa điểm nóng, tối ưu phân bổ tải an toàn; lập ma trận Windows Agent–WMS–HA, Android Picker/Reporter/overlay/ACK, Web, Worker/InventoryCore, Firebase, Apps Script/Drive/Sheets, CI/release, Wifi và quyền; phân biệt code/CI, runtime, thiết bị, Usage và Owner nghiệm thu.
- Mỗi mục phải có: mã `D169-REQ-###`, kênh/phiên bản, hiện tượng thực tế, điều kiện tái hiện, mốc giờ VN, nguồn log/bằng chứng **đã khử nhạy cảm**, mức độ, rủi ro ảnh hưởng, trạng thái `REPORTED / SOURCE_CONFIRMED / PROPOSED / OWNER_APPROVED / CODE_READY / BETA_RELEASED / FIELD_PASS`; chưa có chứng cứ thì ghi `UNVERIFIED`.
- Mọi cập nhật thảo luận phải ghi vào journal D169 trên nhánh/PR đang làm; Owner duyệt thiết kế trước khi được thay đổi code/triển khai. Stable riêng và luôn OWNER-GATED. Không lưu bí mật, thông tin nhân viên, raw log hay SKU nội bộ trong repo public.

## Danh sách gốc, chưa tự nhận là đã sửa

| ID | Nhóm | Đầu việc/hiện trạng | Trạng thái D169 |
|---|---|---|---|
| D169-REQ-001 | Android cập nhật | Chuyển tiếp D168-E050: cơ chế **cập nhật bắt buộc mọi APK Beta đã ký** có đường cho `Để sau` do floor `minimum_version_code`; cần đối soát bản cài và thiết kế chặn đúng thời điểm an toàn | **KNOWN OPEN / ANALYSIS PENDING** — không có code fix |
| D169-REQ-002 | Android popup/Agent chat | Chuyển tiếp D168-E050: nội dung nhắn/gọi quá dài có thể đẩy nút `XÁC NHẬN` ra ngoài vùng nhìn của PDA; cần cơ chế scroll + giữ nút thao tác luôn tới được | **KNOWN OPEN / ANALYSIS PENDING** — không có code fix |
| D169-REQ-003 | Chứng cứ vận hành | Đối chiếu các phép thử thực địa/usage/Drive/Office/Wi-Fi/SKU/HA/ACK của D168 khi có log mới; **không** khẳng định FIELD PASS từ CI hoặc release | **MEASUREMENT PENDING / ONLY IF EVIDENCE RECEIVED** |

Không tự đổi số vấn đề trên thành lỗi mới phát sinh trong D169. Mọi backlog D168 đã hoàn tất/đã chốt vẫn truy vết tại `docs/D168_BACKLOG.md`; các trường ghi lỗi lịch sử trong D168 không bị xoá.

## Cách xử lý tiếp

1. Mỗi vấn đề anh báo sẽ được **ghi nguyên ý nghĩa, kèm mốc giờ và phạm vi** vào D169, không tự code.
2. Khi anh yêu cầu `phân tích D169`: đọc toàn bộ backlog/journal, kết hợp source, CI và log; gom lỗi trùng nguồn, phân tích nguyên nhân đã chứng minh và nghi ngờ, đề xuất **một kế hoạch đồng nhất** có độ ưu tiên, tác động/chỉ tiêu usage, kiểm thử hồi quy và rollback.
3. Chỉ khi anh **duyệt phương án** rồi lệnh `chạy code` / `triển khai` mới chuyển sang triển khai theo cổng repo hiện hành. `chạy code` dừng tại CODE READY; `chạy code và triển khai` bao gồm triển khai Beta trong phạm vi cho phép sau khi CI PASS. Không tự phát hành Stable.

## D169-REQ-004 — Đánh giá khả năng quy nguyên nhân Usage từ log bản mới (14/10/2026)

**Loại:** Owner hỏi đánh giá độ bao phủ log để phân tích nguyên nhân tiêu tốn Usage. **Trạng thái:** SOURCE_REVIEWED / BILLED_ATTRIBUTION_NOT_VERIFIED; không yêu cầu thay đổi code.

**Nhận định từ source hiện tại:**
- Agent `FirestoreQuotaGuard` có số lượt REST theo thành phần, giờ Việt Nam, trạng thái/độ trễ và mẫu HA; đính kèm `D166_USAGE_AUDIT` khi seal log. Các bộ đếm nằm trong RAM/process, restart hoặc quá giới hạn mẫu không bảo đảm liên tục. Ước lượng request/read documents không phải toàn bộ Firestore billable reads.
- Android `D166UsageAudit` gom HTTP method/route family/outcome/latency và lỗi nghiệp vụ ở lúc tạo support bundle; tối đa 256 khóa request/64 lỗi, có dropped counters. Không phản ánh độc lập billable document listeners hoặc traffic app không đi qua lớp ghi nhận.
- Web `runtime-logger` có API/REALTIME/PERF/network, resource timing/heap khi cho phép và audit event-boundary; RAM 420 events và tối đa 75 nhóm, trình duyệt đóng không thể gửi 21:45, nên không được giả tổng số hoạt động cả ca.
- Worker/InventoryCore `d167-route-usage` phân nhóm request tại DO và `d166-sql-usage` đo các câu SQL đã instrument; hai tập số đo là **isolate-local** (restart mất mẫu), không phải Worker account requests, CPU duration hay toàn bộ billable SQL rows.
- Google Apps Script: Agent log phân loại timeout/quota/retry nhưng không có ledger số lượt UrlFetch thực tế toàn bộ account; `D168_GATEWAY_EARLY_QUOTA_FORENSICS` chứng minh log client không thể xác định nguồn chính khi quota shared. Sau thay đổi trực tiếp Worker, không được áp công thức chi phí SKU Gateway cũ cho bản mới.
- Upload log **21:45 VN** Agent/Web đang chạy, Android logout/kick, support request theo đợt; phải đối chiếu `DRIVE_SYNCED`, khoảng trống log, duplicate bundle, logout token expiry. Không tạo request log mới hay poll nhà cung cấp để chứng minh chính logging.

**Kết luận phân tầng:** đủ tốt để tìm **ứng viên hot path/lặp/retry/lỗi** từ event thực; **chưa đủ** để gắn số lượng và tiền billable chính xác theo từng nghiệp vụ hay khẳng định tối ưu Usage đã giảm. Chỉ số bắt buộc đối chiếu: Firestore provider daily doc reads/writes/listener reconnection, Cloudflare Worker requests/CPU/DO rowsRead/rowsWritten theo đúng scope, Apps Script account executing-identity executions/UrlFetch quota, Drive archived bundle completeness; so cùng ngày/ca, số PDA/Agent giờ online và lượt báo hàng/Picklist/ACK. Tách `ZERO` với `N/A`, account shared với Inventory-only, process-reset với toàn ngày. Có log thì có thể phân tích nguồn tiêu tốn đáng nghi trước; chưa có meter thì phải ghi **attribution confidence limited**.

**Không được tự sửa nguồn / thay đổi lịch log / triển khai Beta hoặc Stable vì câu hỏi này.**


## D169 — Ghi nhận Owner bổ sung 14/10/2026

- **D169-REQ-005 — Version Android/Agent:** App lúc hiển thị đúng version, lúc chuyển thành “Chưa ghi nhận”. Trạng thái: REPORTED; chưa có log để xác định nguyên nhân.
- **D169-REQ-006 — Presence từ Picklist:** Tận dụng chính sự kiện PDA gửi Picklist để xác nhận Picker/thiết bị vẫn online, không chỉ login, ưu tiên không tạo request riêng. Trạng thái: PROPOSAL / chờ phân tích.
- **D169-REQ-007 — Danh sách online:** Agent cần hiển thị gần realtime và chính xác, loại user đã logout/bị kick; xét mất mạng và sự kiện đến trễ. Trạng thái: REPORTED / chưa xác minh.
- **D169-REQ-008 — Overlay treo:** Một số PDA nhận kết quả báo hàng rồi overlay không bấm hoặc đóng được. Owner nghi do logout/mất mạng; đây chỉ là giả thuyết. Chờ log Android/session/network/ACK, giữ đúng nghiệp vụ. Trạng thái: REPORTED / WAIT_LOG.
- **D169-REQ-009 — RBAC:** Rà soát quyền Admin Inventory và Admin Pick Pack, đặc biệt quyền cập nhật SKU và tạo tài khoản Picker cho Admin Pick Pack. Cần đánh giá UI/backend/audit và chống leo thang quyền; chưa phê duyệt thay đổi. Trạng thái: DESIGN_PENDING.
- **D169-REQ-010 — Agent chuyển Wi-Fi:** Khi nghiệp vụ cần mạng Internet bình thường mà service không truy cập được, đề xuất hộp cảnh báo và lựa chọn tự động chuyển Wi-Fi theo danh sách ưu tiên đã cài. Cần bảo vệ xác nhận Picklist, HA, WMS, SKU; phân biệt lỗi mạng với lỗi auth/quota. Trạng thái: DESIGN_PENDING.
- **Bổ sung D169-REQ-002:** Thông báo CV dài che nút xác nhận; đánh giá cuộn nội dung hoặc ghim nút phía trên. Không trùng với REQ-008 là tình huống overlay bị treo.

**Ranh giới:** Owner yêu cầu tiếp nhận để phân tích tổng thể về sau, không duyệt code, cấp quyền mới, đổi mạng hoặc phát hành. Không ghi dữ liệu nhạy cảm/log thô vào repo public.


## D169 — Source/log analysis checkpoint E005 (14/10/2026; proposal only)

**Sources:** current signed Beta vc110 release, Agent source v132, Web source 3.1.1, InventoryCore/Android/Agent/Web current main implementation and *sanitized* evidence from the scoped Beta Drive log archive for 14/10. Old event-date files may be archived on a newer Drive day; Android usage counters can overlap/restart and are NOT billing totals.

| Priority | Backlog | Findings and confidence | Proposed scope — NOT approved for code |
|---|---|---|---|
| P0 | REQ-008 plus result-stage/ACK evidence | SOURCE_CONFIRMED: clustered Android \`RESULT_ACK_NOT_FOUND\` 404; DO SQL requires result event ID **and** current actor user ID. The exact missing/mismatched stage/event/account cause and frozen-touch root cause are UNVERIFIED. | Trace bounded stage/outcome + anonymized account/session generation, correlate server row existence and overlay lifecycle; preserve local-first UI dismissal, scoped ACK quarantine, correctness of ACK; no blind retry or false success |
| P0 | REQ-002 / REQ-008 | SOURCE_CONFIRMED: separate in-app Dialog and FCM Service overlay ownership/dismiss mechanisms; long Agent chat can make action unreachable. Touch-freeze remains UNVERIFIED. | Scrollable message and persistent ACK action within display safe insets; one UI owner per event; account-safe exit/recovery when network/session expires |
| P1 | REQ-001 / REQ-005 | SOURCE_CONFIRMED: mixed vc106–vc110 archived Android versions, signed vc110 release, current minimum floor can allow optional upgrade; Agent projection carries optional app_version. Root cause of label fallback UNVERIFIED. | Signed latest-Beta floor on safe next-session boundary, protect in-flight business ACK/Picklist; use installed BuildConfig/version identity as local truth, reconcile projection by session/generation |
| P1 | REQ-006 / REQ-007 | SOURCE_CONFIRMED: existing Picklist fallback upsert, login authority, generation and kick tombstones; deferred Agent sync errors observed. Exact stale-list window UNVERIFIED. | Reuse already-committed Picklist event, listener/delta and tombstones; converge one authoritative presence state with generation fencing, freshness TTL and bounded foreground refresh, without new per-Picker polling |
| P1 | REQ-010 / REQ-003 | SOURCE_CONFIRMED: DNS/RTDB/network failure signatures and safe D168 network helper; HA/Worker reachability can diverge from Wi-Fi link state. | Prompt + explicit consent for saved approved Wi-Fi priority only on proved reachability failure; deny fallback for auth/quota/403; do not switch during WMS commit/ACK/HA unsafe state; verify restore |
| P1 | REQ-004 | SOURCE_CONFIRMED: current privileged D160 Usage still calls a gateway at quarter-hour boundary and Apps Script quota errors occur; legacy picker-contact query can scan many open alert docs. Billable attribution UNVERIFIED. | Decouple common usage snapshot collection from every Agent, eliminate duplicate queries through existing events/cache where safe, no additional telemetry poll; compare provider meters normalized by hours and business operations |
| P2 | REQ-009 | SOURCE_CONFIRMED: PICKPACK_ADMIN already has scoped Picker management and SKU import/job permissions; Inventory ADMIN-only conflict approval and ROOT-only privileged rights remain. UI/end-to-end operation coverage unverified. | Capability matrix per action/channel and Web UI, fix presentation/endpoint mismatches without blanket role promotion; preserve base_role and audit checks |
| P2 | REQ-003 | SOURCE_CONFIRMED: current Web logger only schedules after 21:45 VN, yet one archived bundle has a 06:00 scheduled reason. Actual served/cached build unknown. | Add/reconcile build identity and archive source boundary; validate Web cache/version and Agent archive sequence before treating missing logs as zero |

**Recommended integrated sequence (not authorized):** (A) establish event/stage and version evidence without network polling; (B) implement source-confirmed hot paths and lifecycle reliability with regression tests; (C) coordinate Wi-Fi/HA/SKU + role capabilities; (D) normalize provider billing and replay acceptance across Android/Web/Agent/Worker/Firebase/Apps Script; (E) signed Beta canary with field tests and rollback. Gate each on Owner design approval, source checks, PR CI/authority/continuity PASS. Stable OWNER-GATED.

**Explicit exclusions:** No source mutation, live service change, APK/Agent/Web release, Studio/Workspace permission change, Stable or domain cutover. Do not publish raw logs, employee/device identifiers, SKU, bearer token, secret or individual account/activity trace.


## D169-E006 — Đối soát log ngày 14–15/10 và đề xuất đồng bộ (15/10/2026)

**Phạm vi chứng cứ:** đọc 59 bản Agent có tên phiên 14/10 thuộc thư mục Drive Beta/Logs/2026-10-14, 9 bản Agent tại Beta/Logs/2026-10-15 và một phần log lưu bù 14/10 trong thư mục 15. Thư mục 14 có 209 tệp nhưng nhiều tệp chứa sự kiện 13/10; tuyệt đối không cộng các snapshot chồng lặp. Tại thời điểm rà soát, hai thư mục không còn tệp Android/Web có thể đọc trực tiếp; kết quả Android 404, client vc106–vc110 và Web 06:00 từ D169-E005 là *chứng cứ lưu hồ sơ phiên trước*, không được tự nhận là vừa đọc lại toàn bộ raw log. Ngày 15 mới có log đến khoảng 06:37 giờ Việt Nam. Không có ảnh/số đo billable từ provider để xác nhận chi phí.

**Các phát hiện kiểm chứng mới (khử danh tính):**
- **P1 / QUERY HOT PATH, SOURCE_CONFIRMED:** checkpoint Agent v132 14/10 13:58–21:45 ghi `D166_USAGE_AUDIT` ~13.504 READ, 3.222 WRITE, 16 DELETE ước tính; trong đó `picker-contact-open-query` 85 lần với 8.279 `READ_EXTRA_DOCS`. Source `FirestorePickerContact.LoadLegacyAlerts` lọc `picker_alerts` `status IN (PENDING,SENT)` LIMIT 100 rồi mới loại chat/hết hạn/khác người nhận ở client. Rủi ro lãng phí document reads và che mất alert hữu ích vì LIMIT 100; phải đo provider, thiết kế query server-side phù hợp/chỉ số hoặc tận dụng event hiện có trước khi sửa.
- **P1 / CONFIRM-HA BUDGET, MEASURE_FIRST:** cùng checkpoint 2.590 `CONFIRM_QUERY`, 2.153 `PRIMARY_LEASE_WRITE`, 871 `ROLE_READ`, 646 pending listen events. Những luồng này bảo vệ nghiệp vụ và HA; không được giảm cadence/lease tùy tiện, chỉ loại truy vấn trùng, dữ liệu không đổi và đo latency/failover trước–sau.
- **P1 / DUPLICATE LEGACY CHAT, SOURCE_CONFIRMED:** 74 `picker-chat-direct` và 74 `picker-chat-fcm-fallback` write trong cùng checkpoint. Source hiện ghi 2 đường vì Android đời cũ. Cần xác thực tỷ lệ thiết bị client cũ rồi mới rút đường phụ; không cắt FCM/ACK cho phiên bản chưa tương thích.
- **P0 / WIFI-HA AND CONNECTIVITY, FIELD_CONFIRMED_SYMPTOMS:** Agent 14/10 có RTDB SSE HTTP_401/HTTP_403, DNS Firestore/Apps Script và upload Google Gateway bị timeout; 15/10 có RTDB HTTP_401, một số `CONFIRM_QUERY` lỗi mạng và `PRESENCE_ACK_CONTROL` contention. Source dùng Firestore lease fallback; chưa có bằng chứng split-brain hay Confirm business loss. Phân loại AUTH/403, DNS, timeout, 429, service error độc lập, đổi mạng chỉ theo reachability đã chứng minh và an toàn WMS/HA/ACK.
- **P1 / SKU RETRY AND SUCCESS, SOURCE+LOG:** Agent đời cũ 14/10 log `D167_SKU sync=DEFER` liên tiếp ~11 giây, kèm `D160 USAGE` UrlFetch quota; source scheduler có Arm(15m) khi lỗi nhưng cổng Queue() thiếu kiểm tra nextWake tại chính điểm vào, cần chứng minh luồng kích hoạt trùng trước vá. Phiên v132 14/10 cũng có WORKER_UNAVAILABLE_NO_SAFE_SWITCH, nhưng bản ghi 21:12 xác minh `DELTA_19 DONE` với 2.516 SKU; không kết luận cả ngày thất bại.
- **P1 / MIXED AGENT FLEET, PROVEN:** nhật ký 14/10 xác nhận một Agent khởi động v132; nhật ký 15/10 xác nhận Agent khác vẫn v130. Trước thay đổi semantics phải đối soát phiên bản cài thực và năng lực áp chính sách cập nhật, không đồng nhất phát hành với fleet installed.
- **P1 / BROWSER UI, REPORTED IN LOG:** WebView2 DevTools loopback không kết nối được, Browser readiness WebSocketException, Browser bundle HTTP 403; Agent DataGridView lỗi chưa có columns. Phải kiểm tra đường runtime/phiên/tải bundle, UI-thread initialization và lỗi xác thực, không gộp thành lỗi Wi-Fi.
- **P1 / PRESENCE INVARIANT, SOURCE_CONFIRMED:** `FirestoreAgentSync` đã cho PickList làm fallback nhưng còn bảo lưu Picker nguồn PICKLIST trong lần reconcile dù LOGIN source không có; chỉ kick/session generation chặn trường hợp cụ thể. Nguy cơ list online giữ người không còn hiện diện nếu không có tombstone/TTL rõ. Cần phân biệt online có xác nhận nghiệp vụ gần đây với trạng thái login, điều kiện hết hạn/tombstone và idempotent event.
- **P0 / ANDROID OVERLAY/ACK, E005 EVIDENCE_ONLY:** giữ phân biệt hai triệu chứng REQ-002 (text che nút) và REQ-008 (không bấm được); hồ sơ E005 đã thấy `RESULT_ACK_NOT_FOUND` 404 nhưng chưa chứng minh đó là nguyên nhân overlay kẹt. Thiết kế một owner per event, scroll body + fixed button, dismiss local-first + pending ACK theo session; kiểm tra 404 source, generation và rotation/mất mạng.
- **P1 / RELEASE/RBAC, SOURCE_CONFIRMED:** update mandatory phụ thuộc manifest `minimum_version_code` chứ không chỉ latest signed; vai trò `PICKPACK_ADMIN` đã có quyền quản lý Picker trong `user-management-core`, cần kiểm chứng UI/Web/SKU và ràng buộc ROOT/Admin Invent trước khi cấp quyền mới. Không mở rộng cấp ROOT hay bỏ audit.
- **P2 / LOG COVERAGE:** hiện Drive không cung cấp được toàn bộ Android/Web cho ngày đã hỏi; record E005 có phát hiện lịch sử, nhưng đếm lại end-to-end cần bộ bundle đúng phiên/logout, Web active 21:45, log Worker/DO và ảnh meter của Firebase/Cloudflare/Apps Script. Không đồng nhất không có bundle với không có lỗi.

**Phương án khuyến nghị (chưa được Owner duyệt code):** A giữ nguyên sẽ duy trì lỗi và tải đang thấy. B ưu tiên sửa dựa trên bằng chứng: overlay/ACK, presence tombstone/session, Browser/RTDB phân loại, truy vấn alert và tránh nhân đôi call; giữ nguyên HA lease và Confirm guard cho đến khi field-proven. C chuyển tải Firestore→Worker chỉ ở nghiệp vụ không bắt buộc Firestore/Office, có đường truy cập và tính đúng realtime, WMS, ACK, idempotency, latency, security, chi phí; không chuyển quota bằng phép cộng đơn vị khác nhau. Đề xuất **B kết hợp khảo sát có điều kiện C**, với canary phiên bản thực, CI/authority/continuity PASS và rollback; Stable vẫn OWNER-GATED. Cần so provider meter theo Agent/PDA giờ online và đơn nghiệp vụ, không áp trực tiếp ước tính nội bộ thành billable.


## D169-E007 — Phân tuyến thi hành theo Owner (15/10/2026)

**A — WEB/WORKER BETA ALLOWED AFTER CI:** quyền PICKPACK_ADMIN nhập Picker trực tiếp/Excel, preview, apply trên Web, Worker và InventoryCore, giữ kiểm tra trùng mã với non-Picker, bảo vệ disabled/không tự xóa Picker ngoài file, giữ confirm_changed/audit. SKU import thường vốn đã cho phép PICKPACK_ADMIN; FULL REPLACE vẫn ADMIN/ROOT. Source candidate trong PR D169 riêng, chỉ deploy qua SHA-approved D169 Worker-only gate; Stable, Agent, Android, Firebase network routes không deploy.

**B — CODE-ONLY HOLD:** Android overlay dài có cuộn + xác nhận luôn dùng được, result ACK orphan/logout recovery, version/mandatory update đúng session; Agent chống stale presence, giảm legacy query waste, bảo vệ SKU retry cooldown, mạng profile consent. Chỉ merge khi Owner cho phép bản phát hành tương ứng; code branch không có nghĩa runtime version đã tăng.

**C — WAIT-EVIDENCE với điều kiện kết luận rõ ràng:**
1. **ACK 404/frozen overlay:** 2–3 bundle Android picker/reporter cùng event_id hash, session generation, foreground/background, login/logout/kick timestamp, overlay displayed/ACK HTTP/status, kết quả InventoryCore cùng lúc. Nếu xác định ownerUserId trống hoặc ACK mismatch, phân biệt UI deadlock với server 404, không chuyển 404 thành success.
2. **HA/RTDB AUTH:** Agent log đầy đủ 10 phút trước/sau RTDB 401/403, token expiry/renewal status đã khử danh tính, PRIMARY lease generation, role, listener retry, WMS/Office vs Internet. Đối chiếu rules và Fallback; chỉ đổi nếu chứng minh mất HA/duplicate primary và có test primary failover.
3. **Presence Picker:** chuỗi session login, gửi Picklist, logout hoặc bị kick, thời điểm Agent nhận tombstone và màn hình list online trên cùng/khác Agent; so generation, delta snapshot và clock drift, tránh TTL suy đoán.
4. **Usage billed:** ảnh/export Firestore doc read/write, Cloudflare Worker/DO usage, Apps Script UrlFetch/executions cùng ngày; ghi số Agent/PDA online theo giờ, số đơn báo hàng/Picklist/ACK, client version và bộ đếm process có reset. Không quy meter từ riêng client estimate.
5. **Phiên bản fleet:** danh sách thiết bị theo version thực cài v130/v132, vc106–vc110 và cập nhật gần nhất; xác minh cached Web build vs source, khả năng old client nhận FCM/ACK trước khi bỏ fallback.
6. **WebView2 & mạng:** log tiến trình browser bundle/DevTools 403/readiness và endpoint thử qua Office/Internet (chỉ code HTTP, latency, loại lỗi, không log URL nhạy cảm hay Wi-Fi SSID), kiểm tra lỗi quyền/401/403 riêng với DNS/timeouts. Không đổi Wi-Fi với lỗi auth/quota/ACL.
7. **SKU scheduled:** Timeline FULL đầu ngày, DELTA 12/19, job claim/grant/lease, Worker reachability trước/sau switch, nextWake, event Queue, stage/publish receipt và bản Agent thực tế. Cần một Office-only thực địa với tiếp tục Confirm Picklist và restore mạng.

**Ranh giới bất biến:** Firebase critical Office-capable remains; no cross-service migration; no WMS mutation or direct unsupported endpoints; no Stable; do not put raw logs, credentials or employee data in public repo.


## D169-E008 — Web Picker enrollment candidate kiểm thử và phát hành có điều kiện

PR #605 sửa quyền Picker-only Admin Pick Pack qua Web/Worker/Core; 18 checks của candidate `d9f350f73e32cd46a04d93de7f7f9ef26dab15b6` PASS gồm Authority/Continuity/Web types. Kèm receipt Beta Worker-only, giữ Full Replace ADMIN/ROOT, giữ no-auto-disable Picker, chống non-Picker collision. **Tại điểm này chưa deploy**; cần checks receipt SHA mới PASS, merge giữ ancestry và xác nhận health/source SHA từ runtime. Client code-only và backlog WAIT-EVIDENCE vẫn giữ nguyên.


## D169-E009 — Kết quả triển khai Web Beta và các sửa code-only (15/10/2026)

**WEB BETA VERIFIED:** PR #605 merge bằng merge commit `6089bdfd64f49aad71a47d74ad5f4fc9cd9a003a`; Actions `Deploy Beta Worker` run 38674840706 SUCCESS (Owner gate, build Web, typecheck Core, Cloudflare Worker/Web assets deployment, Beta health, schema, auth routes, Web shell). Đây là CI/source health, chưa phải kiểm thử giao diện với tài khoản Admin Pick Pack thật.

**ANDROID/AGENT CODE ONLY — PR #606 DRAFT, KHÔNG MERGE:** Android `CriticalOverlayService.kt` đã ghim nút xác nhận ngoài vùng nội dung cuộn, nhả overlay khi session mất mà không giả xác nhận server; `MainActivity.kt` nâng latest signed verified Beta làm floor bắt buộc ở ngưỡng phiên an toàn; Agent `D167SkuCoordinator.cs` tôn trọng bounded nextWake cho mọi Queue path. Android build và Relay Agent build ở PR đã PASS; có test source riêng. KHÔNG thay version file/Gradle, không release APK/EXE; giữ nguyên Firebase critical network.

**Chờ nghiệm thu/thu thập:** ảnh thao tác Pick Pack Admin thêm một Picker manual, thử Excel preview/apply vào Beta với dữ liệu thử đã được Owner cho phép; test tài khoản Reporter không được quyền Picker HR, Admin Invent vẫn dùng bình thường, Full Replace vẫn khóa. Ghi lại thời điểm và ảnh (ẩn danh tính/nhạy cảm). Các điều kiện nguồn log gốc, HA, Overlay, Usage, phiên bản cũ và WMS đã được chi tiết trong D169-E007, không suy đoán root cause hoặc billed saving khi chưa đủ chứng cứ.

## D169-E010 — Rà soát log Agent cả ngày 15/10 (phân tích mới, chưa duyệt thay đổi)

**Phạm vi:** 18 tệp Agent trong Beta/Logs/2026-10-15 (3 máy, một phần lịch sử từ 14/10), log nghiệp vụ 15/10 đến 23:10; chưa có raw Android/Web trong đúng thư mục. Không cộng các checkpoint trùng, không quy số nội bộ thành billed provider.

**Các điểm mới cần đối soát, không trùng các sửa code D169 đã có:**

1. **Kết quả Picklist (P0/P1, FIELD_LOG_CONFIRMED):** D157 ở 21:42 có 491 job terminal đã ACK, 444 CONFIRMED/ALREADY_CONFIRMED, 47 trạng thái khác. 337 phản hồi Agent chi tiết: 297 CONFIRMED, 24 NOT_FOUND, 9 CONFIRM_CONFLICT, 3 CONFIRM_IN_PROGRESS_OR_UNCERTAIN, 2 WMS_SESSION_REQUIRED, 1 CONFIRM_ERROR, 1 AMBIGUOUS_PICKLIST. Không đồng nghĩa 47 lỗi kỹ thuật hay mất đơn. Yêu cầu đối chiếu WMS trạng thái cuối với idempotency và ACK theo correlation đã ẩn danh; không tự động gửi lại lệnh Confirm khi chưa chắc chắn.
2. **RTDB SSE → Firestore fallback (P1, SOURCE/LOG_CONFIRMED):** một phiên NEXT_A 16:57–21:45 đo 3.258 PRIMARY_LEASE_READ process-local, 3.255 RTDB_NOT_FRESH_FIRESTORE_FALLBACK, 531 SSE NETWORK_Timeout, 52 SSE HTTP_403 và 541 CONNECTED. 19:00–19:59 có 868 đọc lease. Phải phân loại nguyên nhân timeout/stream/proxy/permission, coalesce log lặp và đối chiếu billing; KHÔNG giảm lease/HA failover/fencing vì quota hay chuyển Office Firebase sang Cloudflare.
3. **SKU và shared projection (P1, LOG_CONFIRMED_WITH_RECEIPT_GAP):** INITIAL_05 DONE 2.516 và DELTA_12 DONE 2.518 có receipt; DELTA_19 xuất 2.536 SKU nhưng Worker upload DEFER D167_WORKER_KEEPALIVEFAILURE lúc 21:43, chưa thấy DONE trước checkpoint 21:45. Đây là khoảng trống chứng cứ, không phải kết luận thất bại cả ngày. Bốn lần D168_SKU_SHARED WebException cần xác định ảnh hưởng đến việc chia sẻ tình trạng Agent.
4. **Redaction của bundle Agent (P1, SECURITY_CONCERN_SOURCE+RAW_VERIFIED):** một số AUDIT/SESSION trong bundle Drive còn mã Picker/nhân sự, tên đăng nhập Admin, định danh máy đọc được dù luồng upload áp SanitizeBundle. Không đưa giá trị thô vào GitHub. Kiểm tra bộ lọc hỗ trợ/log bao gồm filename, chọn mã tương quan không định danh và test negative-PII; không xóa lịch sử/các log chưa Drive-confirmed.
5. **Tải ghi log cục bộ (P2):** phiên Agent 16:57–21:45 có 1.066 dòng RTDB realtime và 534 dòng sự kiện recovered, chiếm phần lớn 2.039 dòng thời gian thực; khuyến nghị giữ first/last/count/recovery nhưng gộp những lần lặp, không tăng ghi provider hoặc giảm tín hiệu chẩn đoán.

**Đã loại khỏi danh sách sửa mới:** D169 PR606 (Android body scroll/nút cố định, session-orphan overlay, update floor, Agent nextWake SKU retry) đã CODE PASS nhưng chưa phát hành; PR605 Picker HR Beta đã triển khai. D169 REQ 004/006/007/008/010 vẫn là đầu việc đang mở, không nhân bản chỉ vì có thêm số đo. Kiểm thử Android/Web, xác nhận WMS, billing và fleet remain FIELD_PENDING.

**Giới hạn:** chỉ checkpoint điều tra, không sửa executable, không merge PR606, không phát hành Client, không thay Firebase critical Office route hoặc Stable. Mọi đề xuất ảnh hưởng nguồn bắt buộc Owner duyệt thiết kế/rủi ro trước.

## D169-E011 — Cơ chế HA khi Agent dùng mạng PDA và Office (16/10/2026)

**Rà soát code, không cấp phép triển khai:** bầu PRIMARY qua Firestore roles/generation CAS; primary gửi RTDB heartbeat ~10s, hỏng RTDB thì fallback Firestore lease; NEXT_A phát hiện nghi ngờ sau 15s nhưng chỉ chuyển quyền khi kiểm chứng liveness, WMS/browser ready và CAS thành công. Không tồn tại luật ưu tiên PRIMARY theo nhãn Wi-Fi PDA/Office. NEXT_B đứng sau NEXT_A.

**Cần đặc biệt lưu ý với mô hình hai mạng:** nếu Office chỉ truy cập Firestore nhưng RTDB probe của NEXT_A bị chặn/timeout, code `VerifyPrimaryDownBeforeTakeover` coi liveness là UNAVAILABLE và hoãn chuyển quyền ngay cả khi Firestore lease đã cũ. Đây là rào an toàn chống split-brain, nhưng có nguy cơ failover tự động không đạt được khi PRIMARY chết. Mạng PDA cũng chỉ là ứng viên PRIMARY bình thường nếu cả Firebase điều phối và phiên WMS trên chính Agent truy cập được; Agent chỉ có Worker/Internet nhưng WMS không sẵn sàng không thể Confirm.

**Phân biệt trạng thái degraded:** PRIMARY thiếu WMS có thể giữ vai trò để trả ACK `WMS_SESSION_REQUIRED` khi không có standby sẵn sàng; khi có standby, hai lần kiểm tra thiếu WMS cách nhau >=15s sẽ cố bàn giao. Khởi tạo trống roles cũng cho phép degraded receiver trước khi WMS sẵn sàng. Không khẳng định nhận yêu cầu là xác nhận Picklist thành công.

**Điểm code nên đánh giá khi thiết kế:** `RtdbHaLiveness.WriteHeartbeat` đang điền `wms_ready=true` cố định; kiểm tra WMS trước mutation vẫn nằm ở luồng local + Firestore. Đây là sự không nhất quán về chỉ báo chẩn đoán, chưa chứng minh gây sai kết quả. Không đổi HA theo suy đoán.

**Phạm vi chờ quyết định:** đo thực địa Office Firestore PASS/RTDB 401-403, Internet/PDA WMS READY/NOT_READY, tắt PRIMARY, mất WMS, mất RTDB, mất Firestore, trùng generation và độ trễ Confirm/ACK. Giữ Firebase Office critical path, fail-closed khi không có bằng chứng PRIMARY đã chết, không chuyển sang Cloudflare để giảm quota. Không tạo code/PR khác, không merge PR #606, không phát hành Agent/Android, Stable vẫn OWNER-GATED.

## D169-E012 — Tối ưu HA/Firestore khi Office không truy cập RTDB (16/10/2026)

**Nguồn hiện hành:** PRIMARY heartbeat ~10s vào RTDB; lỗi ghi RTDB thì fallback Firestore lease. NEXT_A nhận SSE khi hoạt động và đọc Firestore lease khi RTDB không mới. Retry SSE thất bại sau 1s; fallback `CheckPrimaryLease` có thể GET Firestore tới ~1s/lần. Khi Office không thể RTDB, một PRIMARY mạng PDA vẫn RTDB khỏe có thể không ghi lease Firestore liên tục; Office NEXT_A không thể probe RTDB sau khi lease stale, vì vậy hiện fail-closed, không tự takeover được.

**Bằng chứng:** D169-E010 Agent v132 NEXT_A trong cửa sổ ~16:57–21:45 ghi 3.258 `PRIMARY_LEASE_READ` attempts, 3.255 RTDB-fallback, 531 SSE timeout, 52 HTTP 403; counters là local/proxy diagnostics, không thay thế Firestore provider Billing.

**Ứng viên tối ưu** (chưa được duyệt triển khai):
1. RTDB retry bounded exponential backoff/jitter/circuit-breaker theo trạng thái thực; re-probe khi đổi network/auth. Giảm retry vô ích trên Office nhưng tự nó không giảm GET lease bắt buộc.
2. Nếu NEXT_A không RTDB: PRIMARY publish thêm Firestore heartbeat có điều kiện, kể cả khi chính PRIMARY RTDB vẫn khỏe; NEXT_A đọc Firestore theo hạn heartbeat + bộ đệm và giới hạn số lần, hoặc thử listener Firestore chỉ khi Office thông được transport và đã đo billing. Giữ nguyên roles/generation CAS, WMS readiness và business mutation fence. Không đổi ngưỡng 15s hay quyền takeover đơn phương khi thiếu evidence.
3. Ưu tiên nhóm PRIMARY+NEXT_A cùng mạng có RTDB chỉ là cách giảm usage vận hành, không thay thế bảo đảm failover xuyên mạng khi Office trở thành phương án dự phòng duy nhất.

**Ràng buộc:** Firestore listener vẫn có billed reads cho tài liệu thay đổi; không giả định listener giảm chi phí nếu cùng nhịp heartbeat. So sánh GET/read + PATCH/write trên toàn fleet và thực tế Firestore provider Billing. Test PDA-PDA, PDA-Office, Office-Office, PRIMARY mất RTDB, mất Firestore, mất WMS, split-brain, old/new Agent tương tác; bảo toàn xác nhận Picklist và ACK. Không có sửa code, merge hoặc release từ checkpoint nghiên cứu này.

## D169-E013 — SSID-classified Agent network policies (2026-10-16)

Owner proposal, no code approval: configure known Office and PDA/Internet SSIDs locally in Agent and select HA transport policy without repeated RTDB checks on known Office networks. Program.cs already reads real Windows SSID; D168NetworkRoute.cs saves permitted Wi-Fi profiles for SKU, not yet HA classification. Unknown SSID / VPN / wired or ambiguous adapter is UNKNOWN, fail-closed. Mixed PDA PRIMARY and Office NEXT_A requires conditional Firestore heartbeat, because Office cannot observe RTDB; reverse pairing similarly needs Firestore evidence. Preserve Firestore roles generation CAS, WMS readiness, ACK and 15s suspicion safety. Consider Windows Wi-Fi change events rather than frequent netsh/provider polling. Compare actual Firebase billing and split-brain tests before implementation.

## D169-E014 — Office RTDB unavailable: compare HA liveness alternatives (16/10/2026)

Research only, no release approval. Current v132 NEXT_A 15/10 archived sample: 3,258 Firestore PRIMARY_LEASE_READ attempts in ~4h48; 1-second RTDB SSE failures repeatedly; local attempts are not provider billing. SSID classification may skip these failed Office RTDB connections but cannot eliminate required shared HA state or generation/CAS/strict WMS fencing.

Verified official Free limits: Firestore Standard 50k reads/day and 20k writes/day; RTDB 1GB stored and 10GB downloaded per month, not metered as individual reads/writes; Google Cloud Pub/Sub first 10 GiB throughput/month free; Ably Free 6M messages/month, 200 connections; Supabase Free 2M Realtime messages/month and 200 connections (idle project pause risk); Cloudflare Durable Objects Free 100k requests/day plus SQLite quotas. Alternative network services are NOT verified Office-accessible and are NOT registered D169 resources. A proposed Pub/Sub streaming heartbeat on Google API would require an authorized physical Office reachability trial, IAM and delivery/ordering review; Firestore remains primary authority for generation-fenced claim and business mutation.

Cost-aware order: prioritize two RTDB-capable Agents for PRIMARY/NEXT_A when present; on known Office SSIDs avoid futile RTDB retries; optimize Firestore-only mixed-network heartbeat and observation only after provider read/write measurements and failover/split-brain tests. Do not assume Firestore realtime listener is free per update or that extra Firestore writes reduce total quota. No new service, source edit, merge or release.


## D169-E015 — Đối chiếu ảnh Usage và log 15–16/10/2026

Phân tích chi tiết, số liệu, giới hạn chứng cứ và ma trận phương án/kiểm thử: [D169_USAGE_NETWORK_ANALYSIS_2026-10-16.md](D169_USAGE_NETWORK_ANALYSIS_2026-10-16.md).

Điểm mới đã kiểm tra: nhánh LoadLegacyAlerts của reconciliation tải tối đa 100 document/query nhưng trả IsActiveCall=false, còn consumer bỏ qua loại này; đây là ứng viên giảm read ưu tiên nhất. Hai mẫu PRIMARY có 8.500 estimated document reads của nhánh này, không cộng với provider picker_alerts 16.800. Log sáng 16 có 8.589 RTDB SSE403 và 1.745 lease-read attempts; 37k Rules deny không thể quy toàn bộ cho firewall. Existing Firestore listener có hoạt động thật; đề nghị dùng kênh liveness chung RTDB hoặc Firestore cho cặp HA và warm standby cần bảo đảm, không publish hai kênh thường trực.

Android có cận dưới 2.447 result-stage404 trên 29 PDA ở phần giờ 15–sáng16; RECEIVED queue unscoped và retry-all-errors là ứng viên cần phân tích tiếp, không nhầm với overlay ACK quarantine đã tồn tại. Các ảnh dùng cửa sổ quota/rolling/billing khác nhau; chưa xác minh billed saving, Cloudflare/Functions/Apps Script totals hoặc physical HA PASS.

**Đề xuất chờ Owner duyệt; không có code/deploy mới.** Giữ PR606 Draft unmerged, Agent/Android code-only và Stable OWNER-GATED.


## D169-E016 — Toàn bộ Agent–PDA và nâng cấp tự chọn cơ chế theo mạng

Hồ sơ chi tiết: [D169_AGENT_PDA_ADAPTIVE_MODEL_2026-10-16.md](D169_AGENT_PDA_ADAPTIVE_MODEL_2026-10-16.md). Owner yêu cầu phân tích Picklist/ACK hai chiều, gọi/chat/kick/online và đích Agent tự đổi cơ chế khi PRIMARY chuyển mạng. **Đây là yêu cầu phân tích thiết kế, chưa cấp quyền code/deploy phương án chưa được duyệt.**

Phát hiện mới: RTDB hiện chỉ phục vụ HA, Picklist vẫn Firestore trên mạng thường; Kích User callsite chỉ gọi Worker và chưa có fallback Office, không được dùng logout signal thay server revoke; online-list là phiên hợp lệ+FCM registration, chưa là bằng chứng kết nối. Có nhiều projection presence trùng chức năng, nhưng D153 semantic hash/one-shot Picklist/tombstone đã tồn tại. Request mutation<12s, HA suspect15s và ACK wait20s sau create là các giới hạn khác nhau, không hứa tự takeover cứu được mọi request ngay lượt đầu.

Đề nghị Adaptive Agent theo network_epoch+capability+role+operation; giữ critical Firestore business, dùng common RTDB/Firestore liveness cho nhóm HA; thêm đường Google tin cậy cho Office server-only command sau duyệt resource; một nguồn chat+FCM/presence có kiểm thử tương thích; sửa receipt Android theo đúng user/stage. Đổi toàn bộ carrier RTDB/Worker WS cần cả App/Service, chưa chọn cho nâng cấp đầu. Xem các góiA–D, lựa chọnE và ma trận impact/test/usage/rollback trong hồ sơ. PR606 vẫn Draft/unmerged, không resource/rules/APK/EXE/runtime mới, Stable OWNER-GATED.
