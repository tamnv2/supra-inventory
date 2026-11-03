# D173-E126 — Reporter badge cursor-fence repair (04/11/2026)

## Source authority và scope
Owner 04/11 yêu cầu hoàn thiện backlog và Production. E126-01 là lỗi P0 của Reporter vc124 đã ghi tại `docs/D173_E126_REPORTER_BADGE_DRIVE_LOG_BACKLOG_2026-11-03.md`. D172 standalone PENDING/HOLD, Stable OWNER-GATED. E127 Worker log archive đã technical RELEASE PASS tại main `464be7af73c4896637ec309ebc498306eafe1ee1`; E127 FIELD chưa đạt do signed Drive readback HTTP403, không trộn E126 với Worker sửa log.

## CODE candidate — không phát hành
- `InventoryApi.parseReporterReadModel` giữ lại `revision.latest_seq` và `stream_epoch` từ combined snapshot đã xác thực, thay vì loại bỏ. Không thay đổi global WebSocket ACK `AndroidRealtimeClient`; snapshot `coverage.cursor_authority=false`.
- `ReporterController` dùng snapshot làm baseline nguyên khối cho bốn badge, chỉ cộng delta có seq mới hơn. Duplicate, hồi phục event cũ, đổi epoch đều không cộng sai. Fallback per-endpoint không có nguồn cursor chuẩn => dùng bounded reconcile hiện có thay vì bịa tổng.
- Model sau mutation tăng `realtimeRevision` để phản hồi fetch cũ không ghi đè. Lazy Overdue ghi nhận revision/seq/epoch lúc bắt đầu; nếu thay đổi trong khi bay thì bỏ phản hồi cũ và dùng `refresh()` đang coalesce. Không thêm timer, polling per-tab, Worker/Core/DB query.
- Kiểm tra thứ tự sự kiện replay, gap, đổi epoch, mutation/snapshot in-flight, lazy page in-flight, 00:00/03:00 quy tắc cũ, scroll/tab không reset. Đo FIELD trên PDA thật sau bản vc125 signed.

## Release boundary
CODE/CI candidate; không tự suy luận Android125 RELEASE PASS. Bắt buộc native Gradle build, 39+ repo checks, signer SHA, checksum OTA, exact-source Android gate và FIELD/OWNER nghiệm thu trước khi tuyên bố DONE. Chưa đổi APK OTA, Agent, Worker, Web, Firebase, Stable hoặc D172. E127 phải có Drive receipt trước khi đóng log backlog.
