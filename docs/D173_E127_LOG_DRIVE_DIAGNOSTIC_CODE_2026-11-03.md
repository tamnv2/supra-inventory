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
