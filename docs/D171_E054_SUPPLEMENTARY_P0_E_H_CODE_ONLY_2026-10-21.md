# D171-E054: bổ sung P0 và tối ưu E/H — CODE ONLY

Owner chấp thuận bổ sung ngày 21/10/2026. Tài liệu này chỉ là quyết định triển khai mã nguồn trong PR #656 Draft. Không merge, phát hành, thay đổi provider hoặc tác động Production trong ca.

## Phạm vi

1. Agent 140: dùng thời gian `created_at` do Firestore cung cấp thay cho thời gian thiết bị để tính tuổi yêu cầu PickList. Giữ thời hạn 12 giây, cơ chế recovery 29 giây và hàng rào PRIMARY/CAS/WMS.
2. Android vc115: chặn gửi song song biên nhận `RECEIVED`; khi xác nhận lỗi 404 `RESULT_ACK_NOT_FOUND`, cách ly biên nhận theo đúng tài khoản, giới hạn 128 dấu vết; lỗi tạm thời tiếp tục được phép thử lại. Không thay đổi luồng ACK kết quả nghiệp vụ.
3. E: ưu tiên loại request lặp vô ích từ client trước khi bổ sung giao thức Worker mới.
4. H: gộp những lần đọc đồng thời cùng tham số của Reporter trong đúng phiên đăng nhập; không lưu cache lâu dài, không polling mới.
5. Giữ A–D đã phát triển; F/WebSocket hai chiều và G/D1 database bản sao chưa nằm trong lần phát hành này.

## Nghiệm thu

CI trên đúng HEAD PR, build Agent 140, Android 115, Web 3.1.2 và Worker; kiểm tra D170 single Production/OAuth/OTA và authority/continuity. Khi Owner cho phép sau ca, thử lệch giờ PDA, request quá hạn thật, chuyển PRIMARY, đổi phiên, thông báo FCM, lỗi mạng, realtime và so sánh DO requests/độ trễ cùng tải.

Production vẫn Android 114 / Agent 139 / Web 3.1.1. Dữ liệu, domain, Firestore Rules, chữ ký APK, Worker hiện hữu và kênh cập nhật giữ nguyên. Không coi source PASS là Owner release PASS.
