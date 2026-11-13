# D173-E257 — Web3.3.18 FIELD FAIL, Tổng quan một trang phục vụ xử lý (13/11/2026)

## Owner phản hồi / quyền
- Owner xác nhận bản Web3.3.18 đã phát hành nhưng Tổng quan chưa phù hợp: số tổng hợp thiếu SKU/khu vực/mốc thời gian cụ thể; nội dung 5 kết quả gần nhất không cần; muốn xem ngay toàn bộ vấn đề quan trọng trên **một trang, không chuyển tab/nhấn Chi tiết**.
- Đây là chỉ thị **sửa code D173 Tổng quan**, không phải Owner PASS của Web3.3.18 và **không có lệnh phát hành Production mới**. Chưa cấp quyền đổi bất kỳ nghiệp vụ D172/Agent/Android/Stable.
- Ảnh thực tế là chứng cứ UI FIELD, không commit ảnh hoặc SKU/tên hàng/người dùng vào public repo.

## Nguồn đã kiểm chứng
- `main` Web3.3.18, source exact `a9dd2eb32896134b2ff00b863dce0f53ea54b126`, Worker deploy run43376201506 TECH PASS, FIELD/OWNER NOT PASS.
- `web/src/operational-app.ts#renderDashboard` cũ có 2 tầng KPI, bảng khu vực, 2 bảng top-SKU và 5 kết quả gần nhất, một số nút chuyển trang. 
- `service/src/business-core.ts#adminDashboard` chỉ cấp tổng pending, không có từng batch đang mở; `service/src/core.ts` đã có đường `GET /api/admin/overview` bảo vệ WEB ADMIN/PICKPACK_ADMIN/ROOT.
- D172 độc lập PENDING/HOLD; mọi thay đổi nằm tại đường đọc D173, không chạm schema/route/data D172.

## Ứng viên code-only
1. Tập trung đầu trang: đợt/ticket còn mở **toàn hệ thống**, thời gian chờ lâu nhất, Skip hệ thống hôm nay, SLA (không có cấu hình hiển thị “—”).
2. Bảng **6 đợt đang chờ lâu nhất** trên trang: SKU, tên hàng, LTA/Shelving *tại thời điểm báo*, giờ báo đầu, đã chờ, ticket Picker đang mở. Nếu nhiều hơn 6 hiển thị 6/tổng, không tự nhận liệt kê đủ.
3. Vấn đề cần kiểm tra: SLA vượt ngưỡng nếu có cấu hình; Skip tự động phân nguồn; SKU tái phát và lúc báo lại; khu vực chưa đủ bằng chứng. **Không suy luận nguyên nhân vật lý** từ chỉ dấu phần mềm.
4. Hai xu hướng cùng lúc, không phải bấm chọn ngày: 7 ngày VN (theo ngày) và 24 giờ của hôm nay (theo giờ); nhãn ticket báo / batch hoàn tất luôn tách biệt, hôm nay chưa kết thúc.
5. Khu vực hôm nay (đợt/ticket/chờ trong cohort) và một bảng SKU cần đối chiếu. Loại bỏ phần 5 kết quả gần nhất, nút điều hướng dashboard và dashboard date filter (báo cáo lịch sử ở tab riêng).
6. Reuse **một** `GET /api/admin/overview` và một DO invocation. Nội bộ thêm **3 SQL SELECT giới hạn**: top6 pending + 2 truy vấn grouped-by-hour trong 7 ngày; không có schema/write/API/polling mới. Loại bỏ một lượt đọc dashboard preference lúc vào Tổng quan và presence polling 30s riêng ở Tổng quan. Tăng Rows Read có thể xảy ra: không khẳng định tiết kiệm quota khi chưa đo.

## Rủi ro / kiểm thử bắt buộc
- Kiểm thử đồng nhất số pending/ticket hiện có và 6 hàng ưu tiên, ngày VN qua mốc 00:00, báo trước ngày nhưng vẫn chờ, hoàn tất qua ngày, SKU nhiều Picker, LTA/Shelving UNKNOWN, SLA chưa cấu hình.
- Hiệu suất SQL Rows Read, CPU và p95 phải được đo trên dữ liệu đại diện trước phát hành; điểm đánh đổi 2 truy vấn trên 7 ngày cần Owner xác nhận nếu quota tăng đáng kể.
- Kiểm thử Web build, RBAC WEB-only negative (Android/OBPP không truy cập), D172 regression độc lập, CSS 1280x720 và 1920x1080/125%/150%, light/dark, không che cột/chữ.
- Không tự merge, không tự deploy. Chỉ SOURCE PR/CI; CODE/CI/RELEASE/FIELD/OWNER ghi riêng.

## Trạng thái
- CODE: ứng viên trên `fix/d173-e257-overview-live-triage-20261113`.
- CI: PENDING.
- RELEASE: HOLD (Web3.3.18 Production vẫn là bản đang có).
- FIELD/OWNER PASS: PENDING. D172 HOLD độc lập.
