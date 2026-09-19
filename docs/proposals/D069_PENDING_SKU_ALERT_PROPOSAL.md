# D069 — Đề xuất cảnh báo SKU đang xử lý

Status: **APPROVED AND SUPERSEDED BY D070 IMPLEMENTATION**

Owner requested analysis before any change. Existing D007 queue ordering and D050 warning/escalation semantics remain authoritative until explicit Owner approval.

## Mục tiêu

Cảnh báo đúng người, đúng mức, không làm phiền liên tục và không biến cảnh báo thành thao tác nghiệp vụ tự động.

## Đề xuất mặc định

### 1. Người báo hàng / Picker

- Khi vừa báo: trạng thái bình thường, không phát thêm thông báo gây nhiễu.
- Khi đạt mốc **Cảnh báo**: dòng/card của chính SKU đổi sang mức vàng và hiển thị thời gian chờ rõ hơn. Không phát toast lặp lại.
- Khi đạt mốc **Quá hạn**: card chuyển đỏ và phát **một toast duy nhất** cho Picker đang có báo mở của SKU đó: `SKU <mã> đang chờ xử lý quá lâu`.
- Không phát âm thanh mặc định.
- Kết quả `Đã có hàng / Được phép bỏ qua` tiếp tục dùng cơ chế thông báo + ACK hiện có; cảnh báo thời gian không thay thế kết quả.

### 2. Reporter / Admin / Root đang vận hành

- Mốc **Cảnh báo**:
  - SKU chuyển vàng;
  - tăng badge số lượng cảnh báo tại `Xử lý báo hàng`;
  - một toast chuyển trạng thái, không lặp lại khi refresh/realtime.
- Mốc **Quá hạn**:
  - SKU chuyển đỏ;
  - badge quá hạn nổi bật;
  - một toast mức cao;
  - khi Web đang ẩn/background có thể gửi thông báo nền cho Reporter/Admin/Root nếu Owner duyệt kênh này.
- Khi nhiều SKU cùng vượt mốc trong thời gian ngắn: gộp thông báo, ví dụ `5 SKU vừa chuyển sang quá hạn`, thay vì bắn 5–20 toast riêng.

### 3. Chống spam / chống cảnh báo lặp

Khóa duy nhất đề xuất: `batch_id + batch_version + alert_level + target_user`.

Một mức cảnh báo chỉ được phát một lần cho cùng shortage episode/phiên bản/người nhận. Reconnect, reload, WebSocket recovery hoặc nhiều tab không được tạo lại cùng cảnh báo.

### 4. Thứ tự danh sách

**Không đổi ở bước đầu.** D007 vẫn giữ:
1. nhiều Picker đang bị ảnh hưởng hơn trước;
2. nếu bằng nhau, báo đầu sớm hơn trước.

Warning/overdue chỉ tăng độ nổi bật trực quan. Nếu Owner muốn quá hạn luôn nhảy lên đầu thì cần một quyết định riêng về công thức ưu tiên, vì việc đó sẽ thay đổi D007.

### 5. Kênh cảnh báo đề xuất

| Mức | Picker | Reporter/Admin/Root |
|---|---|---|
| Bình thường | trạng thái thường | trạng thái thường |
| Cảnh báo | vàng, không toast lặp | vàng + badge + 1 toast |
| Quá hạn | đỏ + 1 toast | đỏ + badge + 1 toast; thông báo nền là tùy chọn Owner |
| Có kết quả | giữ cơ chế kết quả/ACK hiện tại | kết thúc trạng thái cảnh báo |

## Điểm Owner cần chốt trước khi triển khai

1. Picker có nhận toast ở mốc **Quá hạn** hay chỉ đổi màu trạng thái?
2. Reporter/Admin/Root có nhận **thông báo nền** khi Web không active hay chỉ toast trong Web?
3. Có giữ D007 ordering như đề xuất, hay muốn `Quá hạn` được đưa lên đầu danh sách?
4. Có cần âm thanh ở mức Quá hạn không? Đề xuất mặc định: **không** để tránh nhiễu trong vận hành.

Không thay đổi nghiệp vụ cho tới khi Owner chốt các điểm trên.


## D070 approval update — 2026-09-19

Owner approved the alert direction and added the third automatic-Skip threshold. D070 canonical decision/specs now govern implementation: three entered minute thresholds with strict ordering, enable/disable auto-Skip, and selectable `FIRST_REPORT` / `PER_PICKER` timing. No processing-extension feature is included.
