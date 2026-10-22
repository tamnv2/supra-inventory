# D171 — Backlog bổ sung ngày 22/10/2026 (E080)

**Trạng thái:** `INTAKE_ONLY__PENDING_ANALYSIS_AND_RECOMMENDATION`. Đây là các yêu cầu/quan sát Owner muốn **ghi backlog trước, phân tích và đề xuất xử lý sau**; chưa chốt thiết kế, chưa cấp quyền sửa mã nguồn, tạo dịch vụ mail, thay đổi quyền/phiên, deploy/OTA hay tác động tài nguyên. D171 chưa Owner PASS; D169 vẫn là accepted base. Ưu tiên kỹ thuật bên dưới chỉ là gợi ý để xếp lịch, không thay đổi thứ tự do Owner quyết định.

## Các mục cần phân tích riêng

| ID | Nội dung Owner ghi nhận | Phạm vi cần khảo sát khi phân tích sau | Trạng thái |
| --- | --- | --- | --- |
| D171-BL-01 | Dùng địa chỉ gửi **no-reply@supra.cc.cd** (hoặc alias no-reply thuộc `@supra.cc.cd`) cho OTP và email tự động từ Web, không dùng trực tiếp tài khoản cá nhân của Owner. | Rà soát đường gửi OTP và mail hệ thống hiện có (Worker, Google Gateway, provider mail), mail sender/Reply-To, domain/DNS SPF-DKIM-DMARC, xác thực, quota/rate-limit, khả năng gửi/nhận và quản trị; tuyệt đối không giả mạo From hay provision tài nguyên ngoài scope trước khi Owner chốt. Không đưa credential/tài khoản cá nhân vào repo công khai. | Chưa phân tích/chưa chốt nhà cung cấp |
| D171-BL-02 | Cập nhật ứng dụng phải thấy **đang tải/chưa xong/đã tải xong**, tốc độ tải, phần trăm và thông tin cơ bản. | Phân biệt tải APK/EXE với kiểm tra hash, chờ cài đặt và cài đặt xong; tốc độ theo byte thực nhận, tổng byte, `%`, tốc độ, khả năng dừng/tiếp tục/khôi phục, lỗi mất mạng và hành vi Android PDA/Windows Agent; so lại signed OTA/manifest, giữ xác minh hash và chống downgrade. Không hiển thị 100% tải như đã hoàn tất cài. | Chưa phân tích/chưa chốt UI |
| D171-BL-03 | Khi có sự kiện/thông tin mới, **giữ nguyên vị trí người dùng đang xem**, không kéo về đầu trang/danh sách hoặc tự refresh chỗ. | Android Reporter/Picker, Web queue và các tab chịu tác động; phân biệt cập nhật dữ liệu incremental với rebuild adapter/screen, lọc/sắp xếp và vị trí scroll/anchor; bảo đảm không bỏ sót thay đổi quan trọng hoặc làm hiển thị sai số bản ghi. | Chưa phân tích |
| D171-BL-04 | **vc117 vẫn tái diễn lỗi badge** tại tab **Đang xử lý** và **Quá hạn**: số đếm nhấp nháy, nhảy liên tục và không phản ánh dữ liệu thực tế; có biểu hiện dữ liệu danh sách cập nhật bất thường. | Ưu tiên tái hiện/chẩn đoán chuỗi Worker event/delta/snapshot, Android state/store, 2 tab PENDING/OVERDUE, timezone, dedupe/concurrent callbacks, reorder, observer/list diff, UI renders; so số đếm với snapshot authoritative cùng thời điểm và log trình tự. Không coi vc117 đã sửa hoàn toàn chỉ vì source CI PASS. | **FIELD_FAIL_REPORTED_VC117**, chưa xác định nguyên nhân |
| D171-BL-05 | **Thời gian tái phát chỉ tính trong ngày Việt Nam**, không dùng lần phát sinh từ ngày trước; Owner thấy thời gian hiển thị **hơn 200 giờ**. | Xác định rõ quy tắc `Asia/Ho_Chi_Minh`, ranh giới 00:00, batch/episode trước đó, trường hợp cùng SKU nhiều lần trong ngày và chưa đóng lúc qua ngày; tách chỉ số thời gian tái phát hiển thị khỏi lưu trữ lịch sử nếu cần. Kiểm tra Worker tính toán + Android/Web + báo cáo không làm mất chứng cứ lịch sử. | Chưa phân tích/chưa chốt quy tắc chi tiết |
| D171-BL-06 | PDA còn đủ RAM nhưng quay lại ứng dụng vẫn thường xuất hiện **“Khôi phục phiên làm việc”** và phải chờ load/re-register, gây chậm thao tác Picker. | Đo thời gian foreground resume vs process recreation/cold start, Firebase token refresh, Worker session generation, WebSocket/FCM resubscribe, Room/SQLite cache, network/Doze/Android lifecycle. Chỉ truy cập UI nhanh nếu phiên vẫn hợp lệ; không bỏ xác thực server, không tái sử dụng phiên đã bị kick/đăng nhập ở nơi khác. | Chưa phân tích/chưa có log kết luận |
| D171-BL-07 | Picker hay quên đăng xuất; đề nghị **tự kết thúc phiên đúng 14:00 cuối ca 1 và 22:00 cuối ca 2** theo giờ Việt Nam. Khi đăng nhập hiển thị **cảnh báo ngắn, rõ giờ tự đăng xuất**; làm tăng ca phải chủ động đăng nhập lại. | Nghiên cứu session expiry server-authoritative theo shift, phân biệt vai trò Picker với Reporter/Admin/Agent/Web, login gần mốc, trường hợp tăng ca, nhiều thiết bị, session generation, timezone/clock drift, phiên hết hạn khi mất mạng, shutdown, hết pin, Doze, restart và online trở lại. Không cho dùng phiên ca trước sang ca sau hoặc khôi phục phiên vượt cutoff. Kiểm chứng Kick/FCM/REST, thao tác đang dở, ảnh hưởng log và UX. | **PROPOSAL_INTAKE_ONLY**; chưa chốt phương án kỹ thuật hay thông điệp UI |

## Ma trận tình huống bắt buộc để phân tích mục BL-07

1. **Có mạng, app ở foreground:** xác định ranh giới cutoff, hành vi UI/Worker/FCM và trạng thái thao tác đang xử lý.
2. **App nền, Doze hoặc không mở:** không được phụ thuộc vào Android timer/notification chính xác; xem xét sự kiện mở lại và mọi API xác thực.
3. **Mất mạng trước/sau cutoff:** giữ an toàn cục bộ, không cho phép nghiệp vụ offline; khi nối lại phải kiểm tra cutoff từ service trước khi cho thao tác tiếp.
4. **Tắt PDA/hết pin và mở lại sau cutoff:** phiên ca trước không được tái kích hoạt dù local storage còn token.
5. **Đổi thiết bị, bị Kick, đổi mật khẩu, mở Web/Agent:** không làm suy yếu cơ chế session generation và quyền truy cập.
6. **Đăng nhập cận 14:00/22:00 hoặc tăng ca:** khi đến cutoff vẫn kết thúc phiên; tăng ca cần đăng nhập mới theo yêu cầu Owner.
7. **Sai giờ thiết bị/đổi múi giờ, trễ mạng, 23:59/00:00 và nhiều Picker đồng thời:** service sử dụng giờ Việt Nam có thẩm quyền; kiểm thử cả trạng thái hiển thị và chi phí phát sinh.
8. **Log và usage:** không mất log chờ gửi khi phiên đã hết; không kéo dài quyền thực hiện nghiệp vụ chỉ để upload log.

## Ranh giới nghiên cứu/triển khai

- **Không sửa code hoặc triển khai từ backlog này.** Lần phân tích tiếp theo phải so source đang chạy, log thực tế, quyền, nghiệp vụ Web/Android/Agent, Worker DO/SQLite, Firebase/FCM, Google mail/gateway, updater và các rủi ro bảo mật/chi phí.
- So tối thiểu 3 phương án: giữ nguyên đo đủ log; tối ưu trực tiếp hot path; thay đổi phân bổ tài nguyên **chỉ khi không giảm độ chính xác, realtime, ACK, HA, ổn định và UX**. Chi phí các đồng hồ đo khác đơn vị không cộng/chuyển trực tiếp.
- Sau khi có nguyên nhân và đề xuất: trình Owner phương án, tác động lên accepted base, phép thử và rủi ro, chờ Owner phê duyệt rõ trước khi code/release. Tài nguyên mới cho mail no-reply phải được đăng ký `ops/project-scope.json`/`ops/resource-registry.json` khi thật sự được Owner cho phép.
- D172 OBPP tiếp tục độc lập; không thay Worker/D172 table, Android package/channels hay phiên D172 vì backlog này. Legacy Stable luôn OWNER-GATED.
