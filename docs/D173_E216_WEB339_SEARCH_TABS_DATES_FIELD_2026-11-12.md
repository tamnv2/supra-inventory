# D173-E216 — Web3.3.9 FIELD NOT PASS: tìm SKU, ngày sát tìm kiếm, tab active (12/11/2026)

## Owner báo thực tế
1. Nhập SKU, có loading nhưng xong hiển thị cả danh sách (tìm kiếm chưa đạt).
2. Chuyển phần chọn ngày sang phía phải và đặt sát ô tìm SKU.
3. Mỗi tab trong Xử lý báo hàng phải luôn có nền khác biệt khi đang được chọn (không chỉ nháy khi bấm lần đầu).

## Bằng chứng nguồn và giới hạn
- Main `75cc1b812c9491bf904c37175d8cc498105e2b5b`; Web 3.3.9 Production release Worker run `43168569077` PASS kỹ thuật, nhưng FIELD tìm kiếm/tab **NOT PASS**.
- `web/src/operational-app.ts`: input event khi suffix >=3 ký tự gọi `patchActiveSection(true)` đồng bộ, thay cả vùng DOM đang chứa input trong lúc gõ. Đây là nguy cơ cụ thể có thể làm mất trạng thái/đứt mạch nhập. **Chưa có trace Network Production xác nhận nguyên nhân duy nhất của lỗi trả mọi SKU**.
- `web/src/api.ts` đã gửi `sku_suffix`; `service/src/read-api.ts` chuyển tiếp; `service/src/operational-v2-core.ts` dùng `b.sku LIKE ?` và giá trị `%suffix`. Chưa có chứng cứ để kết luận SQL Worker đã bỏ lọc; không sửa backend/DB dựa vào suy đoán.
- `web/src/d173-tabler.css`: input SKU có margin-left:auto, làm ô ngày và SKU bị tách; trạng thái `active` của các tab có CSS cũ dễ hòa vào nền.

## Sửa tối thiểu — chỉ Web
- Khi gõ SKU ở tab kết quả, thay riêng nội dung bảng bằng trạng thái chờ, không dựng lại input. Sau debounce 500ms vẫn dùng API + key kiểm tra request hiện có, không thêm request.
- Nếu server trả dòng SKU không kết thúc bằng suffix đang tìm, fail-closed báo lỗi thay vì hiển thị toàn bộ như kết quả. Bảng kết quả thêm lớp lọc khớp SKU tại bước trình bày, cả tab Quá hạn có kiểm tra response; không giả lập `total` khi thiếu dữ liệu.
- Đặt bộ chọn ngày bên phải nhóm presets, ngay trước SKU. Desktop giữ một dòng cuộn ngang khi thiếu chiều rộng; mobile giữ layout đã có.
- Thêm `aria-selected` từ state thực và nền nổi bật cho tab đang chọn (sáng/tối), không đổi trạng thái nghiệp vụ.
- Test tái hiện `tests/d173-e216-web-search-tabs-dates.test.mjs` và cập nhật test E214 đúng logic mới. CI chạy Web build, suffix SQL fixture và D172 độc lập.

## Ranh giới / PASS
- D173 Web-only. Không đổi service Worker, DB, Firebase, Android/Agent, D172, Stable, release configuration.
- SOURCE CI PASS cần tất cả regression + TypeScript/Web build + independent D172 pass theo exact PR head.
- **Không phát hành Production trong PR này**; mã version 3.3.9 giữ nguyên cho đến lúc có lệnh phát hành mới. FIELD/OWNER PASS cần kiểm chứng trình duyệt thật sau phát hành đúng gate.
