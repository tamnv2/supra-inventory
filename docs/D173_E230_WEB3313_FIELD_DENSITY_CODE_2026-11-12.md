# D173-E230 — Web 3.3.12 FIELD UI feedback → Web 3.3.13 CODE ONLY (12/11/2026)

## Owner đã yêu cầu
1. Kết quả `Cho phép Skip`: các dòng xử lý bởi **nhân sự** phải sử dụng nền danh sách bình thường như `Đã có hàng`; **chỉ** `SYSTEM_TIMEOUT` / `SYSTEM_DAY_END` có nền phân biệt khi hệ thống tự động Skip. Không thay đổi nhãn nguồn hoặc hành vi Skip.
2. Đơn giản hóa riêng workspace `Xử lý báo hàng` gồm năm tab: giảm khung/viền/bo góc/gap/padding; bỏ footer `Hiển thị xx / yy kết quả`; ưu tiên tăng chiều cao và mật độ đọc của danh sách SKU. Giữ nút, điều kiện xử lý, ngày và luồng realtime.
3. Placeholder chính xác: `Tìm SKU tối thiểu 3 chữ số cuối`. Logic thực tế vẫn nhập chữ số cuối, ít nhất 3 chữ số; tìm cục bộ trên dữ liệu tab đang mở.

## Nền đã xác minh
- Web 3.3.12 đã Production technical PASS theo E229: main `8dc91e50a31c3f547b4e1b16819f492c5da1fa65`, run `43220864308` SUCCESS; source repo main thời điểm intake `b995b1f7ac6f822cd609cd499892f7dbd4fdaaed`, PR #956 đã MERGED.
- Source 3.3.12 `renderResults()` dùng `d173-skip-human` cho nhân sự và CSS ép nền xanh `#eaf3ff`/dark `#203851`; vì thế toàn bộ nhóm Skip ở ảnh FIELD có nền xanh. CSS có toolbar border/radius, panel border+padding và table-wrap border+radius kế thừa các lớp cũ. Hai footer đếm hàng nằm trực tiếp trong `renderOverdue()` và `renderResults()`.
- Đánh giá rủi ro: các CSS override toàn cục có thể ảnh hưởng quản trị; sửa phải scoped `.ops-business-workspace` và `:has(.ops-business-workspace)`. Hạn chế chiều cao theo viewport bằng `100dvh` nhưng vẫn phải kiểm tra FIELD HD/HD+, zoom và hai theme. Không sửa server query/SQLite/DO/Firebase.

## Phạm vi code và kiểm thử
- Branch `fix/d173-e230-web3313-field-density-skip-20261112`, PR #957 **Draft CODE ONLY**, base main nêu trên.
- Chỉ `web/src/operational-app.ts`, `web/src/d173-tabler.css`, version `3.3.13` tại Web/Package, các bài test Web E227/E230 và workflow E230.
- Guard: người dùng vẫn thấy tab counts; JS không phụ thuộc footer để tính API; search `endsWith` tối thiểu ba chữ số và phạm vi ngày/tab không đổi; ngoài Reporter không đổi. D172 độc lập, không sửa file nghiệp vụ riêng D172; không có resource mới hay Provider writes.
- Regression: E230 yêu cầu chỉ auto Skip tô nền, không có footer kết quả/quá hạn, compact CSS scoped, chính xác placeholder và version; E227 nhận bản thay đổi mới nhất; Web TypeScript/Vite và D172 independent tests trong scoped CI.
- **CODE:** đã tạo ứng viên; **CI:** chờ kết quả exact-head; **RELEASE:** chưa được Owner duyệt trong lượt này, giữ Production 3.3.12; **FIELD/OWNER PASS:** chưa xác nhận.
