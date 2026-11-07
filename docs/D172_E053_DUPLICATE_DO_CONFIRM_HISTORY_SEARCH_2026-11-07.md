# D172-E053 — Xác nhận DO trùng và tìm kiếm Lịch sử (07/11/2026)

**Nguồn:** Owner yêu cầu trong phiên D172, ứng dụng Hàng rớt OB × PP1291 riêng; PR [#852](https://github.com/tamnv2/supra-inventory/pull/852). **Trạng thái:** CODE CANDIDATE; CI/FIELD/OWNER PASS chưa xác minh, chưa merge/phát hành. D172 tiếp tục PENDING/HOLD.

## Yêu cầu đã duyệt cho code

1. Khi ghi mới/sửa làm trùng **DO đang tồn tại** (không chỉ trùng tất cả trường), backend trả 409 `DUPLICATE_RECORD` cho yêu cầu chưa xác nhận. PDA hiện hộp thoại `DO đã tồn tại`: “DO này đã có trong lịch sử. Vẫn muốn lưu thêm?”; nút **Bỏ qua** không gửi mutation, **Xác nhận** gửi lại bản ghi với `allow_duplicate_do: true`. Không xóa/ghi đè bản ghi cũ. Cùng `operation_id` khi gửi lại sau 409, server atomic trên InventoryCore OBPP riêng; với client cũ không có cờ, vẫn chặn DO trùng như trước. Lưu dấu audit `CREATE_DUPLICATE_CONFIRMED` / `EDIT_DUPLICATE_CONFIRMED` (khi đổi DO).
2. Tại tab **Lịch sử**, ghim ô input `Tìm kiếm` cao 38dp ngay trên thanh 3 tab, không có nút tìm; hint tự mất khi gõ. Gõ lọc MCH (`store_code`), DO (`do_code`) và vị trí (`location`) không phân biệt chữ hoa/thường. Hiện kết quả cục bộ tức thì, sau khi ngừng gõ 350ms mới gọi API lọc **trên toàn bộ các bản ghi đang hoạt động** của Core, trả tối đa 100 dòng gần nhất khớp; không chỉ lọc trên 100 dòng tải ban đầu. Hủy yêu cầu gõ cũ, bỏ qua response không đúng query; cập nhật riêng danh sách để giữ bàn phím và ô search. Chọn tất cả/xóa đã chọn chỉ tác động bản ghi đang nhìn thấy. Không thêm polling, request preflight DO hay nguồn dữ liệu khác.

## Phạm vi và ảnh hưởng

- **Chỉ code:** `obpp1291/android/.../MainActivity.kt`, `service/src/obpp1291-core.ts`, test D172, spec và journal. `service/src/index.ts` không thay đổi; auth, Inventory Web/Agent/PDA báo hàng, D173, provider/sheet schema, signed OTA cũ không sửa.
- **Usage:** Không phát sinh GET preflight DO; một lần lưu DO trùng đã xác nhận cần tối đa một phản hồi 409 và một lần gửi lại. Mỗi chuỗi nhập tìm kiếm sinh GET sau debounce (tăng Worker/DO requests theo số lần ngừng gõ, chỉ khi tìm). Mỗi GET tìm kiếm dùng `instr(...)` với mã/vị trí chuẩn hoá Unicode uppercase trên Core SQL, không gọi Google Sheets; cần quan sát latency/usage trên thiết bị thật.
- **An toàn:** Yêu cầu phải xác thực OBPP trước khi đi Core; cờ override chỉ nhận boolean `true`; mỗi mutation vẫn qua check revision, validation, transaction, op dedupe, outbox Sheet và audit. Dữ liệu quá 100 kết quả khớp chỉ trả 100 gần nhất do giới hạn bảo vệ UI/request, không kết luận đã duyệt phân trang.
- **Release:** D172 code-only PR Draft. Trước merge/deploy cần exact-head CI, Kotlin compile/test trên Gradle + D172 regression, shared Worker/Inventory auth regression, source pin và **Owner lệnh phát hành riêng**. D172 PENDING/HOLD không bị đóng; không tự deploy Worker/APK/OTA, không chạm Stable.

## Kiểm thử bắt buộc

- DO mới lưu 1 lần không dialog; DO trùng ở vị trí/MCH khác 409 → Bỏ qua 0 write; Xác nhận → bản ghi thứ hai độc lập, bản cũ giữ nguyên; kiểm tra audit, Sheet 2 bản ghi.
- POST trùng, PATCH đổi DO trùng; PATCH DO không đổi không cảnh báo. Hai thiết bị đồng thời, request/retry cùng operation_id, 401/403/409 khác, network timeout; không được hiển thị thành công giả.
- Lọc theo từng trường, chữ hoa/thường, query rỗng, không có kết quả, kết quả nằm ngoài 100 bản ghi gần nhất; 100+ kết quả, keyboard/focus, chuyển tab, dữ liệu cập nhật, select-all/bulk-delete chỉ hiện hữu.
- Negative Auth và không rò dữ liệu; đăng nhập PDA cũ giữ hành vi 409; Worker/DO route Inventory/D173 độc lập, Sheet A:K/A:E/A:G và M:N phụ không đổi.

## Lệnh Owner phát hành 07/11/2026

Owner ra lệnh **“Triển khai apk đi”**. Do phần xác nhận DO trùng cần Core chấp nhận `allow_duplicate_do`, phạm vi kỹ thuật cần phát hành **cùng Worker hiện có rồi mới ký APK OBPP riêng**, không phải chỉ build APK trên backend cũ. Receipt mới `ops/d172-release-authorization.json#e053_duplicate_confirm_history_release`; cổng `tools/d172_release_gate.py` dùng nguồn E053 đã review SHA `7062c1189032e54177ffbca4f773ce76e8fb636b`, chặn dùng lại E048/E043. Chỉ protected main merge với marker `D172-E053_RELEASE:` mới có quyền deploy; khi ký APK cần Worker health exact same main SHA, OBPP READY, Sheet SCOPED_CONNECTED, negative-login 401. Không mở provider mới, không thay đổi Inventory APK/Agent/Web/Stable; D172 vẫn PENDING/HOLD, FIELD/OWNER PASS false.

**Trạng thái tại thời điểm cấp quyền:** Build/code CI nguồn review đã PASS; release Worker và signed OTA còn chờ protected merge + receipt run có thật. Không tự suy diễn đã deploy.
