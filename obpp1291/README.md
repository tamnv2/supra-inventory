# D172 OB × PP 1291 — Android app (CODE ONLY)

Android app này là sản phẩm độc lập, package cd.cc.supra.obpp1291, KHÔNG dùng chung session hoặc release channel của Inventory/Confirm Picklist.

## Đã có
- Hai tab Nghiệp vụ / Danh sách vị trí, scanner dạng bàn phím/PDA Enter và nhập tay.
- Parse QR sáu thành phần; tổng kiện ở mẫu 1/4 là 4, số thứ tự kiện là 1.
- Uppercase store/position; DO/số kiện số nguyên; không tự ghi khi QR kết thúc Enter.
- Giao diện danh sách 50 bản ghi từ service; ấn giữ cho Sửa/Xóa; tạo operation_id mới và expected_revision để server kiểm soát sửa đè.
- Online-only, không outbox offline, không lưu token/mật khẩu vào file.
- Đăng nhập qua endpoint OBPP scoped riêng, chỉ nhận vai trò ADMIN/PICKPACK_ADMIN/ROOT; phía server BẮT BUỘC kiểm tra độc lập, không dựa vào UI.

## Chưa có / release gate
- Endpoints /api/obpp1291/session/login, /records, /locations CHƯA triển khai. App code KHÔNG HOẠT ĐỘNG NGHIỆP VỤ cho tới khi service xác thực và kho lưu dữ liệu + Google Sheet outbox hoàn tất và được Owner duyệt riêng.
- Session mới tuyệt đối không được tăng generation Web/ANDROID/AGENT sẵn có. Thực thi bằng session namespace OBPP1291 do backend quản lý; chỉ verify trên service.
- Backend lưu trước, Sheet sync sau; không nhúng Sheet ID/service account/password trong APK. Biến private D172_OBPP_SHEET_ID chỉ đi vào runtime được phép truy cập.
- App còn cần QA thực địa với MT90/DT50 và APK ký riêng; không đưa lên inventory OTA/channel.

## Test
Ở thư mục obpp1291/android: gradle :app:testDebugUnitTest :app:assembleDebug (nếu có Android SDK, Gradle phù hợp).
CI nên giới hạn workflow D172 riêng; không sử dụng workflow ký APK Inventory.
