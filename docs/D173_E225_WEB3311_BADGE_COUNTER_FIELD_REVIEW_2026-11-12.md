# D173-E225 — Web 3.3.11: badge khác nhau giữa Tổng quan và Xử lý (FIELD review, 12/11/2026)

## Chứng cứ Owner
- Ảnh Owner từ Web 3.3.11 cùng ngày hiển thị badge thanh bên `Xử lý báo hàng` **7** khi đứng ở trang `Tổng quan & báo cáo`, sau đó **6** ở trang `Xử lý báo hàng`; tab `Đang xử lý` = **6**, `Quá hạn` = **1**, thẻ `SKU đang chờ xử lý` = **6**.
- Không lưu ảnh, SKU, thông tin nhân sự hay dữ liệu Production vào repo công khai. Không có timestamp chung chính xác hoặc log realtime tương ứng để kết luận số 7 là lỗi tại thời điểm chụp.

## Đối chiếu source main
- `web/src/operational-app.ts` — `navButton` và `syncOperationsNavBadge` chỉ dùng `queueBadgeCount`, **không cộng** `overdueBadgeCount`.
- `loadReporterTabCounters` gán `queueBadgeCount = counters.queue_total`; `loadReporterQueueSnapshot` gán lại từ `queue.total`. Realtime `applyReporterQueueBadgeEvents` còn áp `queue_delta`. Hai đường HTTP có generation độc lập, không có server revision thống nhất để loại bỏ response ngược thứ tự giữa các đường trên.
- `service/src/operational-v2-core.ts`: `COUNTER_QUEUE_TOTAL` và `REPORTER_QUEUE_COUNT` cùng lọc `b.status='PENDING' AND s.waiting_picker_count>0`. `COUNTER_OVERDUE_TOTAL` lọc `b.status='PENDING' AND s.overdue_picker_count>0`. Quá hạn là **tập con** của đang xử lý (ở trạng thái dữ liệu bình thường); **6+1 không phải 7**.
- Việc badge 7 rồi 6 có thể do một đợt được xử lý giữa hai ảnh, cập nhật realtime/tổng số không cùng thời điểm, hoặc snapshot cũ ghi đè; **chưa đủ bằng chứng để chốt nguyên nhân thực tế**.
- Không có chứng cứ cho lỗi UI khác từ 4 ảnh; `Sắp quá thời gian = 0` không mâu thuẫn `Quá hạn = 1` vì là hai mốc khác nhau.

## Trạng thái và kiểm tra đề xuất (không duyệt code)
- **FIELD REPORT: số badge giữa hai trang không đồng nhất trong ảnh; ROOT CAUSE: CHƯA XÁC MINH.**
- Khi Owner yêu cầu sửa, kiểm thử tái hiện với queue/counters + websocket cùng một revision/timestamp; bảo đảm badge thống nhất trong mọi tab, overdue không được cộng lặp, không tăng request thừa; chỉ can thiệp D173 Web/Worker theo quyền và D172 independent guard.
- **CODE: không sửa. CI/RELEASE: Web3.3.11 technical PASS trước đó không bị phủ định. FIELD: PENDING/REVIEW; OWNER PASS: false.** D172 độc lập HOLD, Stable OWNER-GATED.
