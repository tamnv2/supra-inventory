# D169 — Tiếp nhận các vấn đề mới, phân tích đồng nhất theo đợt

**Mở:** 14/10/2026 (giờ Việt Nam) · **Trạng thái:** OPEN — INTAKE / RECORD ONLY.
**Owner:** xác nhận D168 **PASS giới hạn trên phương diện code/phiên bản đang dùng, chưa ghi nhận thêm vấn đề tại thời điểm xác nhận**; yêu cầu mở D169, tập hợp các phát hiện trước khi phân tích đồng bộ.
**Accepted base:** D168 — OWNER LIMITED CODE/AS-DEPLOYED PASS; **không** đồng nghĩa toàn bộ FIELD PASS, đo usage, hay các vấn đề tồn tại trước đó đã khắc phục.
**Nguồn chính:** `ops/change-continuity/D169.json`, `ops/project-state.json`, `docs/OWNER_DECISIONS.md`; hồ sơ lịch sử D168 giữ nguyên.

## Nguyên tắc D169
- Chỉ **nhận yêu cầu / triệu chứng / thời gian / phiên bản / log, lưu vết và phân nhóm**. Chưa chạy code, đổi Worker/Agent/Web/PDA, cập nhật ứng dụng, bật/tắt dịch vụ hoặc phát hành.
- Owner cung cấp nhiều mục; gom đủ mới kiểm tra repo/source/log và phân tích **một đợt**, giải quyết quan hệ nhân quả/ảnh hưởng chéo để không vá từng lỗi độc lập.
- Trước đề xuất cuối: so sánh phương án giữ nguyên, sửa điểm nóng, tối ưu phân bổ tải an toàn; lập ma trận Windows Agent–WMS–HA, Android Picker/Reporter/overlay/ACK, Web, Worker/InventoryCore, Firebase, Apps Script/Drive/Sheets, CI/release, Wifi và quyền; phân biệt code/CI, runtime, thiết bị, Usage và Owner nghiệm thu.
- Mỗi mục phải có: mã `D169-REQ-###`, kênh/phiên bản, hiện tượng thực tế, điều kiện tái hiện, mốc giờ VN, nguồn log/bằng chứng **đã khử nhạy cảm**, mức độ, rủi ro ảnh hưởng, trạng thái `REPORTED / SOURCE_CONFIRMED / PROPOSED / OWNER_APPROVED / CODE_READY / BETA_RELEASED / FIELD_PASS`; chưa có chứng cứ thì ghi `UNVERIFIED`.
- Mọi cập nhật thảo luận phải ghi vào journal D169 trên nhánh/PR đang làm; Owner duyệt thiết kế trước khi được thay đổi code/triển khai. Stable riêng và luôn OWNER-GATED. Không lưu bí mật, thông tin nhân viên, raw log hay SKU nội bộ trong repo public.

## Danh sách gốc, chưa tự nhận là đã sửa

| ID | Nhóm | Đầu việc/hiện trạng | Trạng thái D169 |
|---|---|---|---|
| D169-REQ-001 | Android cập nhật | Chuyển tiếp D168-E050: cơ chế **cập nhật bắt buộc mọi APK Beta đã ký** có đường cho `Để sau` do floor `minimum_version_code`; cần đối soát bản cài và thiết kế chặn đúng thời điểm an toàn | **KNOWN OPEN / ANALYSIS PENDING** — không có code fix |
| D169-REQ-002 | Android popup/Agent chat | Chuyển tiếp D168-E050: nội dung nhắn/gọi quá dài có thể đẩy nút `XÁC NHẬN` ra ngoài vùng nhìn của PDA; cần cơ chế scroll + giữ nút thao tác luôn tới được | **KNOWN OPEN / ANALYSIS PENDING** — không có code fix |
| D169-REQ-003 | Chứng cứ vận hành | Đối chiếu các phép thử thực địa/usage/Drive/Office/Wi-Fi/SKU/HA/ACK của D168 khi có log mới; **không** khẳng định FIELD PASS từ CI hoặc release | **MEASUREMENT PENDING / ONLY IF EVIDENCE RECEIVED** |

Không tự đổi số vấn đề trên thành lỗi mới phát sinh trong D169. Mọi backlog D168 đã hoàn tất/đã chốt vẫn truy vết tại `docs/D168_BACKLOG.md`; các trường ghi lỗi lịch sử trong D168 không bị xoá.

## Cách xử lý tiếp

1. Mỗi vấn đề anh báo sẽ được **ghi nguyên ý nghĩa, kèm mốc giờ và phạm vi** vào D169, không tự code.
2. Khi anh yêu cầu `phân tích D169`: đọc toàn bộ backlog/journal, kết hợp source, CI và log; gom lỗi trùng nguồn, phân tích nguyên nhân đã chứng minh và nghi ngờ, đề xuất **một kế hoạch đồng nhất** có độ ưu tiên, tác động/chỉ tiêu usage, kiểm thử hồi quy và rollback.
3. Chỉ khi anh **duyệt phương án** rồi lệnh `chạy code` / `triển khai` mới chuyển sang triển khai theo cổng repo hiện hành. `chạy code` dừng tại CODE READY; `chạy code và triển khai` bao gồm triển khai Beta trong phạm vi cho phép sau khi CI PASS. Không tự phát hành Stable.
