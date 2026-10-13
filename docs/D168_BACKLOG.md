# D168 — Tiếp nhận yêu cầu, log và phân tích sau D167

**Mở ngày:** 2026-10-13 (Asia/Ho_Chi_Minh).  
**Owner chốt:** D167 **PASS phạm vi Beta đã triển khai, chưa ghi nhận lỗi tại thời điểm chốt**; yêu cầu mở D168 để ghi nhận thêm việc/log, phân tích, đề xuất và chỉ xử lý code/triển khai **theo lệnh Owner**.  
**Accepted base:** D167 (limited-as-deployed Owner PASS), theo `ops/project-state.json` và hồ sơ PR #581.  
**Phạm vi tài nguyên:** chỉ những gì đã đăng ký trong `ops/project-scope.json`; Stable luôn OWNER-GATED.

## Chính sách vận hành D168

- Bắt đầu mọi phiên D168 bằng bootstrap `ops/authority-manifest.json`, toàn bộ `bootstrap_order`, journal `ops/change-continuity/D168.json`, hiện trạng GitHub/CI/source rồi mới phân tích.
- Mỗi yêu cầu, đề xuất, quyết định, phát hiện kỹ thuật, log và công việc dở dang đều ghi vào journal D168 theo `docs/CHANGE_CONTINUITY_PROTOCOL.md`; quyết định Owner đã chốt phải đồng bộ Owner Decisions, spec và project state tương ứng. Không dựa riêng vào trí nhớ chat.
- **Chỉ nhận log/phân tích/đề xuất là mặc định.** Không tự đổi code, dịch vụ, Beta/Web/PDA/Agent, workflow hay Stable khi chưa được Owner phê duyệt sau đánh giá tác động.
- `chạy code` = hoàn thiện toàn bộ code + kiểm tra/CI tới CODE READY, dừng trước triển khai. `duyệt triển khai` = phát hành mã đã PASS trong phạm vi đã chốt. `chạy code và triển khai`/`triển khai luôn` = làm cả code và phát hành Beta đã được phép, sau kiểm tra bắt buộc, không hỏi duyệt giữa chặng. Stable luôn cần cho phép riêng.
- Không bổ sung raw log chứa thông tin nhân sự, SKU riêng tư, mật khẩu, token, session, credentials, private URL vào repo public. Ghi kết luận và tham chiếu chứng cứ khử nhạy cảm. Không tự xóa, hợp nhất hoặc phát hành lại dữ liệu nguồn.
- Nghiệm thu kỹ thuật/CI, phát hành Beta, quan sát thiết bị, chỉ số billing và Owner PASS là các trạng thái riêng. Không mở D169 trước khi D168 Owner PASS.

## Các dòng công việc tiếp nhận (chưa phải lệnh code)

| Nhóm | Điểm xuất phát | Cách xử lý D168 |
| --- | --- | --- |
| Nhật ký mới | Owner cung cấp log, lỗi, giờ xảy ra hoặc hành vi mới | Đối chiếu nguồn, phân loại nguyên nhân, rủi ro, đề xuất; chờ lệnh sửa cụ thể |
| Usage/chi phí | D167 đã triển khai công cụ đo, chưa chứng minh tối ưu tổng billed Firestore/Cloudflare | So sánh ca tương đương và meter theo đơn vị thật, cân nhắc không sửa / sửa hot path / phân bổ an toàn; không tự giảm chất lượng realtime/ACK/HA |
| Agent/HA/WMS | Agent v130 phát hành Beta, chưa chứng minh đầy đủ cài đặt máy và mọi tình huống | Rà log mới, kiểm tra source/CI và đề xuất riêng; không thay đổi PRIMARY, WMS Confirm hay tự cập nhật máy |
| Web/SKU/nhân sự | Web 3.1.1 và daily FULL/DELTA đã phát hành; D167 Owner chốt hiện chưa thấy lỗi | Nếu xuất hiện lỗi mới, xử lý trong D168 với biên nhận chính xác, kiểm tra ngày Việt Nam và hợp đồng API |
| Android/PDA, log Drive | Signed vc106 phát hành, chưa chứng minh mọi PDA cài đặt và tất cả Drive bundle | Nhận bằng chứng log để phân tích, không ép OTA hay xóa log |
| Bảo vệ CI/CD | Owner đã chốt lệnh CODE READY/DEPLOY; guard hiện có nhưng chưa chứng minh toàn diện các cách kích hoạt | Kiểm tra khi được yêu cầu, không cho phép phát hành ngoài phạm vi; giữ code-only và Stable gate |
| Launcher | Ứng dụng Launcher thuộc project/repo khác | Chỉ ghi tham chiếu và chuyển về đúng project khi Owner yêu cầu, không mutate từ Inventory |

## Trạng thái đầu kỳ

- **D168:** OPEN — ghi nhận và phân tích theo lệnh; chưa có yêu cầu code/triển khai mới.
- **Đã phát hành trước D168:** Web Beta 3.1.1, Agent Beta v130, Android Beta vc106, Worker/Gateway thuộc D167; không release lại.
- **Nguồn sự thật:** `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, `ops/change-continuity/D168.json` và source/CI; không sao chép nguyên văn thông tin nhạy cảm vào tài liệu.
