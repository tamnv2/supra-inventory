# D173-E213 — Web 3.3.8: sáu lỗi FIELD và source repair (12/11/2026)

## Bằng chứng và quyết định Owner
- Web 3.3.8 đã có technical Production release: source merge `b913f86bff209905f2d2dab3bf7a1ffa88c4a279`, release run `43159857445` (D173-E211). FIELD/OWNER chưa PASS.
- Owner kiểm tra Web 3.3.8 và báo FIELD NOT PASS bằng hai ảnh. Các mục giao:
  1. Tên công ty là tiêu đề chính, tăng cỡ chữ lên 150%.
  2. Tìm kiếm SKU không lọc kết quả đúng.
  3. Tab Picker đã thu hồi hiển thị sai/thiếu Picker thực hiện thu hồi.
  4. Đổi nhãn dài của Skip thành `Cho phép skip xx`.
  5. Thu ô SKU còn 50% chiều rộng trước.
  6. Rút ngắn ngày và gom tabs/ngày/SKU thành một dòng desktop.
- Tên SKU, người dùng và hàng hóa trong ảnh vận hành không được đưa vào public repo.

## Nguyên nhân/giới hạn
- CSS `web/src/d173-tabler.css` có breakpoint `max-width:1550px` ép khu vực ngày + tìm kiếm xuống hàng mới; các width cứng làm lãng phí diện tích.
- UI Web 3.3.8 có đường tìm SKU suffix trong API/SQL, nhưng kết quả cũ còn hiển thị trong lúc debounce/fetch; cần buộc danh sách khớp chính xác khóa lọc. **Không khẳng định đây là nguyên nhân duy nhất** khi chưa có browser network trace thực tế.
- Worker hiện nối `latest_withdrawal.picker_user_id` với user; mã employee của phiếu có thể trống. Source thêm fallback sang mã user gốc, vẫn phải kiểm tra trên dữ liệu thực tế. Nếu API trả thiếu cả identity lịch sử, không đoán người thu hồi và không thay bằng người xử lý batch.

## Thay đổi tối thiểu — PR #946 (CODE ONLY)
- `web/src/d173-e036-unified-design.css`: tiêu đề 11px → 16.5px.
- `web/src/operational-app.ts`: Skip chỉ hiện tổng, chi tiết ở tooltip; ngày/SKU ngắn; dùng key `(tab,from,to,suffix,offset)` để ẩn kết quả cũ trong khi chờ response cho đúng bộ lọc.
- `web/src/d173-tabler.css`: SKU 206→103px, ngày 120→100px; một dòng desktop, khi không đủ chỗ cho phép cuộn ngang thay vì che nội dung; mobile ≤780px vẫn thích ứng.
- `service/src/operational-v2-core.ts`: fallback read-only cho mã/họ tên Picker từ phiên thu hồi, không đổi schema/đường ghi/API calls.
- Ca tái hiện `tests/d173-e213-web338-field-six-issues.test.mjs`; SQLite `tools/d173_e210_withdrawn_identity_sql.py`; CI source-only `.github/workflows/d173-e213-web338-field.yml`; đồng bộ assertion test E209.

## Ranh giới và tiêu chí PASS
- Chỉ D173 Web + Worker read-only, giữ nguyên Firebase/Agent/APK/D172 business, Worker D172 routes, Storage schema, Stable. D172 vẫn PENDING/HOLD.
- SOURCE PASS khi Web build, Worker typecheck, E209/E210/E213 tests và D172 isolation regression đều xanh trên HEAD PR chính xác.
- Production không đổi trong PR này. Không có lệnh phát hành Production mới từ Owner trong yêu cầu này; **RELEASE PENDING**, không tự merge. FIELD/OWNER PASS chỉ sau khi Web thật cho đúng kết quả tìm kiếm, người thu hồi và bố cục ở màn hình thực.
- Chi phí: không thêm API request hoặc SQL write; tác động row-read do read fallback cần quan sát trước khi có thể tuyên bố tương đương; không có chứng cứ billing ngoài test.
