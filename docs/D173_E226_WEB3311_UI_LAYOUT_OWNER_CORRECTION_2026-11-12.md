# D173-E226 — Owner đính chính: Web 3.3.11 vấn đề GIAO DIỆN, không phải badge (12/11/2026)

## Owner correction
Owner: **“Không phải em, cái anh nói là giao diện nhé.”**
Điều này phủ định việc D173-E225 gán vấn đề trọng tâm cho chênh lệch badge. E225 chỉ còn là lịch sử phân tích sai trọng tâm, **không phải yêu cầu sửa badge đã được Owner chấp thuận**.

## Bằng chứng trực quan từ 4 ảnh Owner cung cấp (không đưa ảnh vào repo công khai)
- Trang **Tổng quan & báo cáo** có tiêu đề cấp trang lớn, bên dưới là hai tab nội dung.
- Trang **Xử lý báo hàng** mở thẳng vào hàng năm tab trạng thái, không có tiêu đề cấp trang tương ứng, nên cấp bậc thông tin và khoảng đệm phía trên khác trang Tổng quan.
- Header chung có biểu tượng menu, tên công ty, dòng phiên bản Web, trạng thái dịch vụ/đồng bộ; dạng nhiều dòng chiếm chiều cao đáng kể. Các ảnh là phần cắt khác nhau nên không thể chỉ từ ảnh kết luận header bị nhảy vị trí hoặc mất khi chuyển trang.
- Điều đã xác minh là **sự không nhất quán cách bố trí tiêu đề/tab và phân cấp không gian giữa hai khu vực**. Mục tiêu UX cụ thể cần Owner chốt trước khi code.

## Source đối chiếu
- `web/src/operational-app.ts` `renderOperationalTabs()` xuất trực tiếp dải năm tab vận hành; nút điều hướng trang Tổng quan được render với cấu trúc riêng.
- Chưa có đủ bằng chứng để kết luận lỗi responsive ở từng kích thước màn hình, CSS clipping hay lỗi scroll header.

## Trạng thái
**UI FIELD OBSERVATION; REVIEW ONLY. Không thay source, chưa được Owner duyệt thiết kế chi tiết hoặc triển khai.** Web 3.3.11 Production technical PASS vẫn đúng; FIELD UI/OWNER PASS chưa đạt. D172 độc lập HOLD, Stable OWNER-GATED.
