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

## 04/11 — Owner yêu cầu PASS/triển khai; gate vc125 đang ở nhánh PR838
- Owner ra lệnh hoàn tất và phát hành toàn bộ backlog trong phạm vi D173. E126 P0 đã có **30/30 GitHub check SUCCESS** trước cập nhật release-gate, bao gồm native Android và D172 safety; mã Reporter Android không chỉnh sửa sau source pin `3fbc3b69130064528f4734c2dcd07e9f76d2103b`.
- Bổ sung cổng chỉ ký **Android vc125** theo marker `D173-E126_ANDROID125_ONLY_RELEASE:`, không phát hành lại Worker, Agent, Firestore, Web, D172 hay Stable. Cổng so SHA, mã nguồn, source diff, trạng thái Worker Production và signed Agent165/Android124.
- Điều kiện: exact CI mới của PR838 phải PASS, merge protected đúng marker, workflow `Verify Beta Android` SIGNED, tag `beta-vc125` và `inventory-channel` checksum khớp. FIELD Reporter badge thật và Owner PASS vẫn là gate riêng.
- E127 Worker đã technical release nhưng signed Drive readback HTTP403; không quy nguyên nhân cho OAuth khi chưa có xác nhận và không đánh dấu log FIELD PASS.
