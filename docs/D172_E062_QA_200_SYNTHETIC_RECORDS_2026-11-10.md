# D172-E062 — kiểm thử 200 bản ghi tổng hợp, 10/11/2026

## Lệnh Owner
"Em tự thêm vào khoảng 200 thông tin ngẫu nhiên như anh thêm từ app để test khả năng ghi, xoá, hiển thị. Sau đó anh phản hồi tiếp các lỗi phát sinh."

## Ranh giới đã xác minh trước thao tác
- App OBPP v11 ghi duy nhất qua `POST /api/obpp1291/records` có OBPP Bearer session hợp lệ → Worker → InventoryCore SQLite transaction → durable outbox → Google Sheet `Ghi nhận Rớt` A:K; app đọc lịch sử từ Core qua phân trang và thiết bị hydrate local cache. Google Sheet là **mirror một chiều**, không được ghi trực tiếp để giả lập app.
- Kết nối công cụ hiện tại **không cấp phiên đăng nhập OBPP đã xác thực**, không có một đường API hợp lệ để giả lập tài khoản Owner trên Production. Không tạo tài khoản/tắt kiểm tra auth, không dùng OTP của người khác, không commit hoặc truyền session secret lên GitHub, và không đưa 200 dòng vào Sheet làm lệch Core.
- Thao tác yêu cầu **200 bản ghi Production trong app** là mục tiêu Owner, **chưa được thực hiện**. Không báo FIELD PASS. Không tự chèn dữ liệu giả vào danh sách nghiệp vụ thật.
- Kiểm thử gần nhất ở bản ký `obpp1291-v11` được phát hành thành công; D172 vẫn PENDING/HOLD theo Owner.

## Kiểm thử kỹ thuật có thể chạy tự động không cần Production credential
Source CI isolated, bằng SQLite memory thật và hàm xử lý `handleObppCoreRequest` hiện hành, cùng Google Sheet mock dùng `drainObppSheets` hiện hành:
1. Tạo 3 vị trí thử `QA200-A/B/C` (chỉ trong SQLite memory), phát sinh đúng **200 bản ghi giả tổng hợp** có DO duy nhất, QR hoặc nhập thủ công, số kiện/ngăn/vị trí/ghi chú đa dạng, không trùng dữ liệu thật; dùng đường POST API Core như Worker khi đã xác thực.
2. Thử lại operation ID cố định để xác nhận idempotent; kiểm tra 200 bản ghi vật lý; **2 trang × 100** trên API, tìm kiếm toàn bộ và trả đúng vùng vị trí.
3. Sửa 20 bản ghi và kiểm tra revision/note; xoá **hai lô × 100 bản ghi** qua API bulk-delete, kiểm tra Core không còn bản ghi, 200 tombstone + audit + delta đọc bởi app.
4. Với Google Sheets API **giả lập (không gửi lên Google)**: 200 ghi A:K, 200 ghi audit, 200 xoá A:K thành 20 batch × 10, audit tăng thành 400, phụ trợ L:N giữ nguyên. Google ACK được xác minh trong mock trước khi kết luận đã xoá.
5. Giữ test trong `tests/` và `.github/workflows/d172-obpp1291-backend.yml`; không sửa Worker/Android/Web/Agent/provider/Firebase/Sheet thật, không chạy release workflow và không sinh chi phí Production cho test.

## Yêu cầu kết luận
- CI PASS chỉ là **kiểm thử isolated source**, **không phải** 200 record đã được thêm vào ứng dụng người dùng.
- Production 200 inserts + đọc trên PDA + đối chiếu Sheet + xoá phải có session OBPP hợp lệ và chứng cứ bản ghi/ACK; chưa có thì FIELD vẫn **NOT EXECUTED**.
- Chỉ ghi lại số đếm, kết quả và reference CI vào repo; không ghi credential/OTP, tên nhân sự, DO/SO thật, hoặc Sheet ID.

## Trạng thái
`CODE_TEST_CANDIDATE — CI_PENDING — PRODUCTION_SEED_NOT_EXECUTED — FIELD_NOT_VERIFIED — OWNER_PASS_FALSE — D172_PENDING_HOLD`.
