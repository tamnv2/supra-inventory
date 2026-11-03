# D173-E130 — Tách lịch tự động ba lượt và lịch sử cập nhật SKU thủ công
Ngày 03/11/2026 (VN), trên base Worker Production E128 `f64386bc37659a69cc26c646a2e1da03456f2d3f`.

## Lỗi được xác định
- Log Agent VPS 21:25–21:26 đã lấy được workbook WMS 2.436 SKU, nhưng lỗi `D167_SCHEDULE_INVALID` xảy ra ở bước `SERVICE_UPLOAD_BEGIN`.
- Agent `D167SkuServiceClient.Schedule()` chỉ chấp nhận đúng 3 slot `INITIAL_05, DELTA_12, DELTA_19`.
- Worker `ensureSchedule()` chọn tất cả `d167_sku_jobs` trong ngày. Khi có slot `MANUAL_DELTA_<runId>` (sau FULL DONE), phản hồi `slots` có 4+ dòng; Agent không thể lên lịch và báo lỗi.
- API đã có trường `recent_manual` để trả lịch sử thủ công riêng. Đây là lỗi hợp đồng API, không phải lỗi tải WMS.

## Sửa đúng phạm vi
- Chỉ thêm `slot IN ('INITIAL_05','DELTA_12','DELTA_19')` vào SQL trả ba slot chuẩn. `recent_manual` và endpoint `status` của manual slot không đổi.
- Không xóa/migrate/update bảng SQL hiện hữu, không thay công thức FULL/DELTA, HA lease/ACK, người thao tác, hoặc tự upload lại.
- Không thêm API/DO request hoặc timer; không thay Web, Agent165, Android124, Firestore Rules, Gateway, D172 OBPP hay Stable.
- Kiểm thử SQLite thực với 0, 1, 2 công việc thủ công; ba slot chuẩn vẫn đúng; manual history/status vẫn truy xuất được.
- Gắn cổng CODE/CI source-pin riêng; Production release Worker chỉ bằng đúng marker E130, sau CI và D172 regression.

## Trạng thái
Owner cho phép triển khai toàn bộ backlog sau E128. E130 CODE ứng viên; CI, RELEASE, FIELD, OWNER PASS chưa xác minh tại thời điểm tạo PR.

## Exact-source CI

- Source tested: `041f29a182788b742dbcc18bfb74846c70208483`; **33 SUCCESS, 0 FAILED, 11 SKIPPED**.
- SQLite actual manual-history and three-slot test PASS: [run #41674104234](https://github.com/tamnv2/supra-inventory/actions/runs/41674104234).
- Agent Win64 schedule self-test PASS: [run #41674104232](https://github.com/tamnv2/supra-inventory/actions/runs/41674104232).
- E123 SQL/shift + D172 isolation PASS: [run #41674104328](https://github.com/tamnv2/supra-inventory/actions/runs/41674104328).
- Worker core/hibernation/D172 regression PASS: [run #41674104946](https://github.com/tamnv2/supra-inventory/actions/runs/41674104946).
- Production release remains PENDING until exact-source guarded main merge/deploy; FIELD/OWNER not asserted.
