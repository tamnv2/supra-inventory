# D173-E057 — Kiểm chứng API Usage Cloudflare + Firebase, KHÔNG xây dựng Agent (27/10/2026)

## Owner chỉ đạo
Đợt 1 chỉ xây dựng bài thử quyền **READ-ONLY**, dùng API chính thức với định danh hiện có của dự án và đưa ra bằng chứng PASS/FAIL cho từng chỉ số. **Tuyệt đối không xây tab, timer, EXE, release/OTA hoặc thay đổi Production/VPS/WMS/PDA** cho đến khi Owner review và phê duyệt riêng.

## Quy mô và tiêu chí chứng minh
- 26 Google Cloud Monitoring metric theo đường truy vấn được định nghĩa trong `ops/apps-script/agent-log-gateway/Code.gs`.
- 10 Cloudflare metric theo ảnh usage của Owner (DO 5, Workers 2, D1 2, Email 1).
- `PASS_DATA`: API HTTP thành công và trả về điểm thời gian có giá trị khác 0.
- `PASS_ZERO`: API trả về điểm thời gian số 0 hợp lệ; không tự nhận có workload thực tế.
- `NO_DATA`: API thành công nhưng không có điểm thời gian.
- `NO_CREDENTIALS` / `NO_TARGET` / `PERMISSION` / `QUERY_SCHEMA_OR_PERMISSION` / `UNSUPPORTED_OR_NOT_FOUND`: KHÔNG được tính PASS.
- Probe chỉ đọc tối đa một cửa sổ 24 giờ; Cloudflare 1 request/metric; GCP 1 request/metric, không scan raw log/user/token/session hoặc nội dung Email.
- Cloudflare DO account usage **không thể gán 100% cho InventoryCore** khi namespace ID chưa được authority đăng ký. Worker scriptName có thể lọc, DO và D1 shared-account phải nêu rõ.
- D1 zero data không phải lỗi nếu không có D1 instance thuộc dự án.
- Usage analytic != chính xác phí trên hóa đơn. Chưa được hứa 5 phút realtime; độ trễ phụ thuộc provider.

## Kiểm thử và ranh giới
Bài thử độc lập qua GitHub Actions PR chỉ dùng `GET` đến Google Monitoring và `POST` GraphQL Analytics (truy vấn READ-ONLY); credential từ GitHub environment `beta` sẵn có, không log; file kết quả chỉ có status/series/point counts, không lưu số liệu hoạt động nhạy cảm. Không dùng `main` push, không gọi Worker/InventoryCore, không gửi Email, không ghi Firestore/RTDB, không tạo Cloud service, không sử dụng token trong Agent.

**Khi bài thử PASS, vẫn phải giữ HOLD trước Agent.** Owner review bảng 36 dòng, cấp quyền nếu thiếu theo bước riêng, rồi mới phê duyệt Agent cụ thể. D172 độc lập PENDING/HOLD, Stable OWNER-GATED.

## Trạng thái
- SOURCE PROBE ADDED / PR CI & ACTUAL PROVIDER RESPONSE PENDING.
- CODE VALIDATION != PROVIDER PASS. `36` là số chỉ tiêu cần kiểm chứng, chưa phải số PASS.

## Kết quả kiểm thử API thật — GitHub Actions 27/10/2026

- PR: https://github.com/tamnv2/supra-inventory/pull/755
- First successful provider run: `40429145306`, first-pass 28/36.
- Corrected GraphQL dataset: DO SQLite `rowsRead`, `rowsWritten` from `durableObjectsPeriodicGroups.sum`; DO compute duration is `duration` (GB-seconds), not `cpuTime`.
- Second successful provider run: https://github.com/tamnv2/supra-inventory/actions/runs/40429428289
- **PASS_DATA: 30/36**; **NO_DATA: 5/36**; **QUERY_SCHEMA_OR_PERMISSION: 1/36**. CI source and provider jobs both succeeded. All successful responses have numeric points, not a guessed display from screenshots.
- Cloudflare: **8/10 PASS**: DO requests, compute duration, storage rows read/written (4), Worker requests/CPU (2), D1 rows read/storage (2). DO SQL Storage returned `NO_DATA`; Cloudflare Email Sending GraphQL returned `QUERY_SCHEMA_OR_PERMISSION`.
- Google: **22/26 PASS**: Firestore 7/7, RTDB 10/10, Auth/FCM 3/3, Drive/Sheets 2/2. Four Cloud Run series (`request_count`, `container/instance_count`, `container/billable_instance_time`, `agentloguploadwritten` request count) returned `NO_DATA` in the tested 24h.
- Cloud Run absence of data is NOT API unsupported or permanently impossible; verify service identity/time range before declaring availability.
- Cloudflare DO/D1 probes tested **account-level** series: 8 PASS proves provider token/API can read those metrics, NOT that namespace-specific InventoryCore filter is available. Namespace exact ID remains unregistered in project-scope.
- This probe validates metric retrieval only, **not** 5-minute breakdown, source freshness, 5-minute scheduling, historical continuity, billing reconciliation, or full Agent presentation. No Agent implementation authorized.
- Results contain only status + series/points counts, stored in 7-day sanitized Actions artifact. No provider amounts, raw responses or credentials in public repo.

## D173-E058 — Điều tra sáu metric chưa PASS (Owner 27/10/2026, không build Agent)

Nguồn: Cloudflare Durable Objects / Email Service docs, Google Monitoring API, repo chính thức `.github/workflows/deploy-beta-functions.yml`, các lần đọc read-only PR755:

- https://github.com/tamnv2/supra-inventory/actions/runs/40431826705
- https://github.com/tamnv2/supra-inventory/actions/runs/40432264175
- **Kết quả cuối có pagination đầy đủ:** https://github.com/tamnv2/supra-inventory/actions/runs/40432864017

| 6 mục E057 pending | Bằng chứng mới | Kết luận cho Agent |
| --- | --- | --- |
| DO SQLite Storage | `durableObjectsStorageGroups.max.storedBytes` 30 ngày = `NO_DATA`; REST `/accounts/:account/billable-usage` có dòng storage với quantity numeric | **MONTHLY_ONLY:** nguồn billed storage định kỳ cấp tài khoản; **chưa** có biểu đồ 5 phút, không gán riêng InventoryCore |
| Email sent | GraphQL `emailSendingAdaptiveGroups.count` đúng cú pháp tài liệu, zoneTag đúng, **PERMISSION** với credential hiện có; Email `GET /email/sending/limits` PASS nhưng chỉ trả quota | **HOLD_PERMISSION:** cần token `Zone > Analytics > Read` giới hạn zone; không được dùng quota thay số lượng gửi, không tự gửi mail test |
| Cloud Run requests cho picker alerts | Service-filter `inventory-beta-picker-alerts` 30 ngày `NO_DATA`; Run Monitoring **toàn project** `request_count` `PASS_DATA`, 48 series đã đọc hết, `truncated=false` | **PASS_PROJECT_AGGREGATE_ONLY:** có thể vẽ biểu đồ cấp dự án, **không khẳng định chính service Picker Alerts** |
| Cloud Run instances cho picker alerts | Service-filter `NO_DATA`; Run Monitoring project-wide `container/instance_count` `PASS_DATA`, 102 series đã đọc hết | **PASS_PROJECT_AGGREGATE_ONLY**, không gán sai service |
| Cloud Run billable instance time cho picker alerts | Service-filter `NO_DATA`; Run Monitoring project-wide `container/billable_instance_time` `PASS_DATA`, 51 series đã đọc hết | **PASS_PROJECT_AGGREGATE_ONLY**, không đồng nhất thời gian tính phí với hóa đơn |
| Agent log function requests | Cửa sổ mở rộng 30 ngày, đúng name `agentloguploadwritten` trong Cloud Run metric `request_count` `PASS_DATA` | **PASS_SCOPED:** đúng chức năng `agentLogUploadWritten`, đủ nguồn thử nghiệm biểu đồ (chưa kiểm chứng 5 phút) |

Nhận diện mismatch có căn cứ: `.github/workflows/deploy-beta-functions.yml` thực tế triển khai sáu Functions tên `pickerAlertCreated`, `pickerAlertResolved`, `pickerActiveCallCreated`, `pickerActiveCallResolved`, `operatingScheduleChanged`, `agentLogUploadWritten`; source cấu hình Monitoring lịch sử dùng alias `inventory-beta-picker-alerts`. Quyền hiện có bị `DENIED` với `run.services.list`, nên không chứng minh chính xác mapping provider; hai truy vấn dự phòng `cloudfunctions.googleapis.com/function/execution_count` và `active_instances` gắn alias đó tiếp tục `NO_DATA`. **Không tự đăng ký/mutate resource mới hoặc khẳng định 3 metric có attribution theo từng Function.**

Tổng phân loại 36 mục sau E058:
- **31/36 PASS trên metric đã gắn bộ lọc được kiểm thử**, gồm 30 của E057 + 1 Agent Log Cloud Run.
- **3/36 PASS dưới dạng nguồn thay thế ở cấp toàn bộ GCP project**, không đúng bộ lọc service ban đầu và có thể chứa nguồn dùng chung (không ghi là 34 PASS tương đương).
- **1/36 DO Storage chỉ khả dụng qua Billing định kỳ** (không chứng minh biểu đồ 5 phút).
- **1/36 Email Send graph thiếu quyền Zone Analytics Read** (quota read không thay thế sending count).
- Chưa chứng minh 5 phút, sai số provider billing, namespace DO exact id, realtime delay; kết quả E058 chỉ xác thực khả năng lấy dữ liệu hiện hữu.
- GitHub 7-day sanitized artifacts chỉ lưu trạng thái/series/coverage, không raw payload, danh sách resources ngoài scope hay secret.

Khuyến nghị Owner review: Chưa loại bỏ vĩnh viễn hai mục cuối. Tạm **HOLD** Email until read-only scoped zone token, và DO Storage chỉ đề xuất thẻ Billing định kỳ; không cố tạo SQLite query định kỳ để tăng DO Rows Read. Nếu Owner muốn project-level Cloud Run, sử dụng 3 biểu đồ với nhãn rõ `GCP Project / Shared` thay vì tên Picker Alert.

**Trạng thái: READ_ONLY_API_TEST_DONE; CODE_AGENT_NOT_STARTED; CI/RELEASE_AGENT_NOT_REQUESTED; D172_PEND_HOLD; STABLE_OWNER_GATED.**
