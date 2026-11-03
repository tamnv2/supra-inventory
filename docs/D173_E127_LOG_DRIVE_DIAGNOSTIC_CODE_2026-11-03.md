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
