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
