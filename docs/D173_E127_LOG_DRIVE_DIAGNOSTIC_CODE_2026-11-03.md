# D173-E127 — Khôi phục đường gửi log Agent/Web/PDA (03/11/2026)

## Owner command và phạm vi
Owner cho phép xử lý sự cố mất log liên nền tảng sau khi báo cáo ngày 03/11. Giữ nguyên D173; E126-01 Reporter badge vẫn là backlog riêng. D172 OBPP1291 độc lập PENDING/HOLD, không sửa code nghiệp vụ hay app D172; Stable OWNER-GATED.

## Chứng cứ trước sửa
- Agent log 02/11 21:43:51 có `upload=PASS`; 03/11 13:22–14:26 thử gửi theo lịch, 16:31 có manual TRY nhưng không có Drive receipt PASS trong các file được giao.
- Production Worker E123 release khoảng 05:45 VN 03/11, Owner phản ánh thư mục log không có cập nhật từ khoảng 06:20. Trùng thời gian **không chứng minh** lỗi do E123.
- Android/Web đi qua Worker → InventoryCore buffer → Google Drive OAuth; có thể HTTP 200 + `archive_status=DEFERRED`, retry mỗi 5 phút. Agent đi qua Apps Script → Worker/InventoryCore canonical day folder → DriveApp, nên Agent và Web/PDA có thể cùng bị ảnh hưởng bởi day folder, nhưng không thể khẳng định cùng root cause khi chưa có runtime receipt.
- Agent gateway trả HTTP 200 nhưng `ok:false` khiến `UploadGateway` trả false mà không ghi mã nguyên nhân, vẫn giữ pending bundle.
- Chưa có truy cập runtime Cloudflare/GAS cần thiết để xem lỗi OAuth, permission, canonical day và buffered backlog. Không tự nhận đã xác định root cause.

## CODE candidate
1. InventoryCore: thêm đọc chẩn đoán `/runtime-logs/archive-diagnostics` gồm tổng số buffered, synced, pending, failed theo nguồn trong 7 ngày; nhóm lỗi chỉ theo mã cho phép, không trả raw error, log payload, bundle/Drive/user/device ID.
2. Worker: trên API Admin/Root đã tồn tại `GET /api/admin/logs?source=DIAGNOSTICS`, chỉ khi yêu cầu thủ công mới đọc chẩn đoán và preflight OAuth, root folder, canonical day folder. Không thêm endpoint không xác thực, job nền hay request định kỳ. Không tạo folder, không ghi file test.
3. Agent: khi Apps Script trả `ok:false`, ghi mã lỗi đã kiểm soát thay vì im lặng; không ghi credential, response thô, payload. Vẫn giữ pending và chỉ prune sau `drive_synced:true`.
4. OAuth: chuẩn hóa lỗi code; không chép error description vào trạng thái lưu trữ.

## Cổng kiểm tra
- Chạy TypeScript/native Agent và D172 regression từ CI exact-source. Tách rõ CODE/CI/RELEASE/FIELD/OWNER PASS.
- Sau khi release Worker được duyệt: Owner/Admin đọc một lần `/api/admin/logs?source=DIAGNOSTICS` trong phiên xác thực; phân biệt `oauth=UNAVAILABLE`, `root=HTTP_403`, `canonical_day=...`, cùng số pending và error_codes. Nếu do provider config, sửa đúng binding OAuth hoặc quyền folder đã đăng ký, không tạo tài nguyên mới.
- Đối soát thực tế Agent manual và scheduled, Android manual/scheduled, Web server checkpoint; chỉ PASS khi có file thực trên Drive, đúng ngày và bundle, không trùng; tồn đọng được drain qua cron hiện hữu.
- Giữ nguyên SQL/auth/OBPP nghiệp vụ, không thay APK/UX không liên quan, không tự deploy khi chưa có CI/release permission.

## Trạng thái
CODE **CANDIDATE** trên branch `fix/d173-e127-log-drive-diagnostics-20261103`; chưa xác định lỗi từ Cloudflare/GAS live, CI và RELEASE/FIELD đều PENDING. Đây là công cụ khoanh vùng nguyên nhân, **chưa phải bản vá provider đã kiểm chứng**.

## E127 — Bằng chứng mới và cổng phục hồi tự động
- CI source `bc194171943e09a54988f026f81775ec441a88c9`: **39 SUCCESS, 1 SKIPPED theo event, 0 FAILED**; kiểm tra Worker TypeScript và hồi quy D172 độc lập PASS. Chưa có RELEASE hoặc FIELD.
- GitHub Action read-only run `41618443612`: Cloudflare có cả hai secret Google Drive OAuth; lấy mẫu lỗi Worker 110 giây không có event. Đây **không** phải bằng chứng OAuth còn hiệu lực.
- Code mới dùng kênh HMAC `/api/internal/d173/sql-evidence?mode=LOG_ARCHIVE` đã đăng ký để đọc tổng số log buffered/pending/synced và tình trạng OAuth/thư mục, không đưa secret hoặc nội dung log ra response.
- Workflow hậu phát hành chỉ tự chạy trên merge marker E127 đã duyệt; cổng `tools/d173_e127_release_gate.py` đối chiếu source SHA, CI, D172 và danh sách file được phép. Không tạo Worker/resource mới, không phát hành Stable/D172/Android/Agent OTA.
- **Cần phân biệt:** release chẩn đoán nhằm đo lỗi Production; nếu vẫn thiếu receipt Drive, phải sửa nguyên nhân đã được mã lỗi xác nhận rồi kiểm tra file Drive thực tế. Không gọi nguồn `DEFERRED` là thành công.

## E127 backend remediation and Drive chronology — 03/11
- Source pin `453a2c7c700ef7243d92b45af2c282f842d37dab` passed 39 applicable workflows; 1 event-inapplicable skip. Executable E127 tests: canonical Agent folder works with Worker OAuth `invalid_grant` when Core already has the ID, no duplicate folder creation, GET core path has no insert, and old fail-closed behavior remains when day ID is absent. Separate D172 regression 48/48 PASS.
- Agent route `resolveRuntimeLogDayForAgent()` now reads the existing InventoryCore folder BEFORE any Worker OAuth refresh. This is a scoped fix to an observed source-level coupling, not yet a verified field repair.
- Core `GET /runtime-logs/day-folder` is read-only; `INSERT OR IGNORE` moved inside only the POST provisioning lease. No DB schema migration or new provider resource.
- OAuth diagnostics only return enumerated provider error codes such as `FAILED_INVALID_GRANT`, never response description, token, secret or file payload; buffered log counters also preserve enumerated OAuth subcodes without raw errors.
- Connected Google Drive readback: root `LOGS_FOLDER_ID`, per-day folders 30/10=22 Agent-only files, 31/10=20, 01/11=6, 02/11=30, 03/11=0. **No Web/Android files in the checked day folders**. This does not prove they do not exist elsewhere; do not claim that all failures began 03/11.
- Separate potential Web/PDA issue: `service/src/index.ts` requests OAuth `drive.file` (and gmail.send). Google's documentation says `drive.file` grants per-file access to app-created/opened/shared-via-Picker files; a folder originally created by another app may be inaccessible to the Worker OAuth identity. Official documentation: https://developers.google.com/workspace/drive/api/guides/api-specific-auth . This is an evidence-based **hypothesis only** pending real signed HMAC `oauth/root/canonical_day` result.
- Disposition by actual diagnostics: `FAILED_INVALID_GRANT` -> investigate expired/revoked refresh token; `root=HTTP_404` despite OAuth available -> investigate per-file scope/parent permission; `canonical_day=NOT_PROVISIONED` -> validate canonical day authority; root+day WRITABLE but pending unchanged -> inspect archive retry and mark-drive receipts. Do not bypass release gates, widen OAuth scope or create a second archive folder by guesswork.
- Owner approved proceeding with code and targeted repair; protected production release remains in the established after-22:15 VN window. D172 independent PENDING/HOLD; Agent executable and PDA are not being published by this Worker-only source candidate.

## E127 — Rà soát lỗi ngay trong ca 03/11 (source-only, chưa phát hành)

1. **Đã sửa lỗi xác định:** `markDriveState()` từng nuốt cả lỗi mạng và HTTP khi ghi trạng thái `drive_file_id` vào InventoryCore; luồng upload vẫn có thể trả `DRIVE_SYNCED` trong khi chưa có receipt bền vững. Bản sửa kiểm tra HTTP, body `status=marked` và `committed=true`; Core dùng SQLite `UPDATE ... RETURNING log_id` trong cùng câu lệnh ghi để không thêm một lượt query/read riêng. Lỗi receipt không được coi là đã đồng bộ; file log giữ để retry theo bundle id.
2. **Đã sửa logic Agent:** `resolveRuntimeLogDayForAgent()` đọc trước canonical day folder đã chốt ở InventoryCore, không ép refresh Google OAuth của Worker trên đường Apps Script khi folder đã tồn tại. Apps Script vẫn trực tiếp tạo file Drive bằng quyền `DriveApp`, không thay hạ tầng.
3. **Đã sửa DO read-only:** GET `/runtime-logs/day-folder` không còn `INSERT OR IGNORE`; tạo row chỉ khi POST lease provision hợp lệ. Giảm ghi không cần thiết và đúng preflight read-only.
4. **Đã xác nhận qua source:** đường Agent chính Agent → Apps Script `upload_agent_log` → `DriveApp.createFile`, gọi Worker duy nhất để lấy folder ID; khi gateway không có, Agent dùng Firestore `DIRECT_PENDING`, Cloud Function `agentLogUploadWritten` xử lý; thất bại mới đánh dấu `WORKER_FALLBACK` cho cron Worker lấy. Không kết luận sai rằng Worker trực tiếp nhận mọi log Agent.
5. **Chưa xác minh trên Production:** Worker dùng OAuth `drive.file`; folder Logs đã tồn tại từ 18/09 và log các ngày 30/10–02/11 chỉ thấy file Agent, không thấy Web/PDA. Quyền của Worker OAuth đối với folder gốc là nghi vấn thực tế (có thể 403/404), chưa được kiểm tra bằng chính danh tính OAuth Worker. Không tăng scope hoặc thay folder/secret theo phỏng đoán.
6. **Bài thử hồi quy mới:** mô phỏng lỗi Core network, HTTP 503, missing/false committed và ACK `true`; chỉ `true` được công nhận. D172 độc lập PENDING/HOLD; chưa sửa APK/Gateway/Stable, không thay email hoặc tài nguyên khác.

Tất cả việc rà soát và sửa code thực hiện ngay; 22:15 chỉ là mốc Owner đã đặt cho thao tác phát hành Production có kiểm soát, không phải lịch chờ phân tích lỗi.

## Agent manual/scheduled ID token review — 03/11
- `relay-agent/Program.cs` passed `_session` directly to `AgentLogUploadBridge`; `UsableSession` verified only non-empty `IdToken`/user, not `ExpiresUtc`. Apps Script `validateIdToken_()` rejects expired Firebase ID tokens with `AUTH_INVALID` or `AUTH_EXPIRED`.
- The Agent provider now calls existing `EnsureFreshToken()` before returning `SnapshotSession()` for scheduled/manual/global support sends. It refreshes only when `ExpiresUtc` is within 2 minutes, not on a new timer. On failure `SafeSession` leaves the bundle locally pending. A manual click no longer depends on an unrelated business poll to have refreshed the token.
- This is a deterministic source-level failure mode, **not** yet proof it caused the Owner's 03/11 field incident. `AgentLogUploadBridge.cs` still logs sanitized Apps Script `ok:false` reasons.
- Program-level modification is Agent **CODE ONLY** in PR834; no signed EXE or OTA permission is granted by E127 Worker receipt. Existing native Agent build, regression and scoped release gate must pass before any future signed Agent release, separately approved.

## 04/11 — Rebase tách E127 trên Production đã có E128/E130

Nhánh `fix/d173-e127-worker-drive-recovery-main-20261104` khởi tạo từ `7c9b27daed4e9d78fba191d7e125e56edfe390f8` (E130 Worker đã phát hành kỹ thuật), chỉ mang lỗi log Drive E127, không ghi đè source rollback HTTP E128, SQL SKU ba slot E130 hay E123. Những sửa Agent là CODE ONLY; Worker được xét phát hành sau exact source CI/receipt độc lập. D172 HOLD và Stable OWNER-GATED. Chưa có bằng chứng Drive file thực, FIELD/OWNER PASS vẫn PENDING. Sau phát hành cần đọc nhận diện OAuth/root/day theo API đã bảo vệ; nếu lỗi provider chưa giải quyết phải sửa tiếp trong chính E127, không kết luận triệt để khi thiếu receipt.

## 04/11 E137 — Kiểm chứng Drive và sửa riêng bước đọc chẩn đoán
- E126 Android vc125 đã ký và OTA Production Technical PASS: main `c67203a5`, run `41732053994`, checksum APK khớp `inventory-channel`. Không coi đây là FIELD/OWNER PASS.
- E127 Worker source/technical release đã PASS trước đó. Signed HMAC diagnostic dùng Python `urllib.request` gặp 403 dù SQL collector dùng `curl` đọc đường HMAC thành công. Chưa khẳng định root cause: có thể khác biệt transport/edge hoặc logic route. Nhánh mới đổi **chỉ workflow readback** sang curl, giữ cùng HMAC domain, endpoint, token môi trường được bảo vệ và không in raw response/secret. Trigger một lần từ `Project State Guard` **main-only** theo marker `D173-E127_DIAGNOSTICS_READBACK:`; không phát hành lại Worker/Android/Agent/Stable.
- Google Drive date folder 03/11 có 180 file theo tên: Android 139, Web 15, Agent 20, OBPP 6. Date folder 04/11 lúc kiểm tra có 2 Android scheduled (một thuộc OBPP). Chứng minh tệp đã nằm trên Drive; không khẳng định full-fleet/scheduled/Archive E127 hoàn tất, không đọc nội dung log nhạy cảm.
- D172 vẫn PENDING/HOLD độc lập; tiếp tục đợi kết quả signed curl probe và đối soát tệp mới trước khi kết luận E127 FIELD PASS.
