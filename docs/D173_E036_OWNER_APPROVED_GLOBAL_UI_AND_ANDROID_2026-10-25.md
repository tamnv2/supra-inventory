# D173-E036 — Owner duyệt sửa toàn diện giao diện Web/Agent và lỗi Android (25/10/2026)

## Lệnh và mốc Production
Owner phê duyệt toàn bộ 9 mục đề xuất và yêu cầu **toàn bộ** giao diện Website, **toàn bộ** Agent Windows đồng nhất, kể cả các màn hình/tabpanel/dialog không có trong ảnh. Không sửa riêng hai màn hình mẫu rồi tự coi là hoàn thành. Yêu cầu triển khai CODE và sau CI an toàn mới phát hành qua kênh hiện hữu.

Mốc chạy trước thay đổi: Web 3.2.0; Agent v142; Android vc119, release kỹ thuật E035 PASS; FIELD/OWNER PENDING. D172 OBPP1291 độc lập PENDING/HOLD, nguồn và release riêng. Cấm chạm D172 app/data/OTA. Stable lịch sử OWNER-GATED.

## Toàn bộ bề mặt phải nghiệm thu (không giới hạn ảnh mẫu)

- Web: login/recovery, mọi role (Picker, Reporter, Admin, Root, PickPack Admin), operational queue đủ 5 trạng thái, ca nghỉ, danh mục SKU, nhân sự & tài khoản, dashboard, SLA, log, công cụ, đặt lại hệ thống, header/sidebar/footer, chọn theme/zoom, mọi confirm/modal, trạng thái loading/empty/error, bảng/xuất và responsive.
- Agent: toàn bộ Tổng quan, Cài đặt, Cập nhật SKU, lịch sử Picker xác nhận PickList, WebView2 tab, Nhật ký vận hành, Chẩn đoán kỹ thuật nếu có quyền, alert/dialog, cột dữ liệu, startup/tray, quyền PRIMARY/standby, resize/DPI và mọi control.
- Bảng Agent tên 'Danh sách phiên hoạt động'; ưu tiên >50% chiều cao trên desktop phù hợp, thao tác Picker giữ nguyên và Reporter vẫn chỉ đọc. Mở rộng Web/Agent session có scope rõ, **chỉ** Inventory Web, Agent và Android Báo hàng, không lấy D172/ứng dụng khác dùng chung Firebase.
- Hiện diện Web/Android trên Office: chỉ hiển thị ONLINE khi có nguồn phiên xác thực hợp lệ và còn tươi. Office không gọi được Worker phải có transport hồi quy thích hợp hoặc UNAVAILABLE, tuyệt đối không hiện stale ghost. Không tự tăng ping, polling/provider usage.
- Agent hiệu năng: CPU, GPU, RAM, disk, network hệ điều hành theo đồ thị 60 điểm, tách khỏi utilization Agent; chỉ lấy local sampling. Theme sáng/tối/tự động theo 06:00–18:00 VN, nhất quán mọi tab.
- Bỏ manual probes giao diện Cài đặt nhưng **giữ** Wi-Fi priority/internal Office-WMS/HA fallback; ẩn nút browser tab trùng góc phải, chỉ giữ điều khiển ở Tổng quan.
- Android: overlay owner theo event ID; FULL_SCREEN wake không vẽ bản sao khi overlay đã claim, fallback nếu chính overlay không thể sử dụng. Thông báo Picker: tiêu đề 'ĐÃ CÓ HÀNG'/'CHO PHÉP SKIP'/'SỬA TRẠNG THÁI', SKU in đậm, tên hàng, người xác nhận đáng tin cậy, dòng tình trạng sửa; màu theo **trạng thái mới**. Không mất ACK/display receipt.
- Log ngày 25/10 14:27: Picker cùng event RESULT_DRAW_CONFIRMED + FULL_SCREEN_FALLBACK_SHOWN, Reporter 24 GET trong phiên và stale snapshots. Dữ liệu log không đủ để thay đổi chu kỳ polling sâu trong E036.
- Toàn bộ app phải có kiểm thử chức năng + trực quan, không chỉ source grep/CI. Các trường backend hiện chưa cung cấp phải ghi chưa khả dụng, không tự điền tên người xác nhận.

## Matrix kiểm thử & release
- Web build/typecheck, kiểm tra screenshots 1920x1080/1366x768/1000px/tablet/mobile; light/dark, tất cả nav/role/modal/empty/dense/error, không overflow hoặc nút bị che.
- Agent net48 x64 build, startup smoke, fleet/picker/reporter quyền, WMS primary/standby, browser iframe/WebView2, all tabs/screens, window 1000/1366/1920, DPI 100/125/150/200%, theme and auto at 06:00/18:00 VN.
- Android Gradle APK build, MT90/DT50/màn hình khóa/DND/overlay permission denied/FCM duplicate/đa-SKU/role mismatches/ACK retry; no double overlay and no silent drops.
- Worker/Firebase nếu thay đổi phải kiểm thử D172 negative auth/SQLite API và D173 báo hàng, no dependency on retired hostname, no new provider secret exposure; compare Firestore/Cloudflare usage before-after.
- CI PASS ≠ RELEASE PASS ≠ FIELD PASS ≠ OWNER PASS. Mỗi bản mới phải pin đúng HEAD và dùng version/signature/OTA tăng đơn điệu. Không tái sử dụng E034 release authorization SHA cho mã mới.
- Đợt 2 tối ưu usage/realtime tồn tại riêng theo quy tắc >=3 ngày đủ log; không thay đổi polling khi chưa có chứng cứ.

## Trạng thái triển khai từ nhánh E036
Đây là nguồn làm việc **CODE CANDIDATE, chưa CI/build/visual PASS, chưa merge, chưa deploy**. Các phần đã sửa nguồn: CSS thiết kế toàn Web, Agent bảng phiên/biểu đồ/theme/toolbar/cài đặt, Android full-screen owner và nội dung thông báo. Các hạng mục backend hiện diện Web/Agent/Office và liên thông đủ tên người xác nhận, toàn bộ screenshot + DEVICE/FIELD còn **OPEN**; không tuyên bố tất cả 9 mục DONE trước khi kiểm chứng.
