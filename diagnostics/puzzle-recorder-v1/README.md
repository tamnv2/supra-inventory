# SUPRA Puzzle Tester V2 — công cụ thử nghiệm độc lập

Không thay đổi Agent Production hoặc dữ liệu nghiệp vụ. Chỉ dùng để thử trò chơi ghép hình Owner đã xác nhận được phép tự động.

## Cách dùng
1. Giải nén **toàn bộ** artifact Windows x64 (không chỉ file EXE), chạy `SUPRA.Puzzle.Tester.V2.exe`. Máy cần WebView2 Runtime.
2. Nhập URL và truy cập tới màn hình trò chơi **thủ công**. V2 không tìm hoặc nhấn nút Đăng nhập.
3. Khi thấy mảnh ghép, nhấn **Test (1 lần)**: chụp ảnh viewport trong RAM, đo hình và thực hiện nhiều nhất **một lượt kéo**, không thử lại tự động.
4. Nếu chương trình thông báo không nhận diện được hoặc hình không đủ chắc chắn, chương trình **không kéo** và lưu lý do.
5. Nếu đã kéo, Owner nhấn **PASS** hoặc **FAIL** theo kết quả thực tế. Không cho phép bấm Test tiếp trước khi ghi nhận kết quả.
6. Nhấn **Lưu log** và chọn vị trí lưu `puzzle-test-v2.json`; kiểm tra file rồi gửi để phân tích các lượt thử.

## Bảo mật và giới hạn
- Log **chỉ** ghi tọa độ, viewport, khoảng kéo, độ tin cậy, trạng thái đã thử và PASS/FAIL Owner. Không lưu URL, user, password, token, cookie, nội dung form hay screenshot.
- Screenshot được xử lý trong RAM để tính vị trí. **Chụp vùng trò chơi** là lựa chọn riêng và chỉ lưu PNG đã được người dùng chọn/kiểm tra thủ công.
- Trình duyệt sử dụng profile WebView2 InPrivate độc lập, tắt password autosave/autofill. Cache tạm của subprocess có thể tồn tại ngắn hạn dù app cố xóa khi thoát.
- Độ chính xác nhận diện trên hình ngẫu nhiên và thao tác trong iframe/DPI **chưa được nghiệm thu**. Tool sẽ từ chối kéo khi không đạt ngưỡng hoặc có nhiều kết quả tương đương; không bảo đảm tất cả CAPTCHA/trò chơi đều tương thích.
- Không tự kết nối máy chủ phân tích, không upload log, không tự giải nhiều lần; một lần bấm Test = tối đa một lần kéo.
- Bản này chỉ là diagnostic CODE-only, không được hiểu là phát hành Agent Production.

## Build Windows
`dotnet build SupraPuzzleRecorder.csproj -c Release -p:PlatformTarget=x64`

Thành phần: WinForms net48, WebView2 và OpenCvSharp4.Windows 4.11.0.20250507.

## V2.1 — Chẩn đoán FIELD FAIL bằng ảnh được duyệt

V2.1 giữ nguyên nút Test của V2, **không sửa thuật toán ghép hình** và không tự đăng nhập.

1. Mở trang, tự đưa tới màn hình ghép. Nhấn **Chọn vùng trò chơi**, kéo chọn đúng ô trò chơi, tránh mọi ô đăng nhập/dữ liệu. Xem lại ảnh đã cắt và xác nhận chỉ chứa trò chơi.
2. Nhấn **Test (1 lần)**. Công cụ giữ ảnh trước và sau lần Test trong RAM; nếu không nhận diện được, vẫn ghi nhận ảnh và lý do không kéo.
3. Cửa sổ kiểm tra hiện **ảnh TRƯỚC bên trái** và **ảnh SAU bên phải**. Trên ảnh trước click lần lượt **tâm mảnh ghép bên trái** và **tâm vị trí đích**. Trên ảnh sau, nếu còn nhìn thấy mảnh ghép, click **tâm mảnh sau kéo**.
4. Kiểm tra cả hai ảnh chỉ có vùng trò chơi. Nhấn **Xác nhận ảnh an toàn** để cho phép đưa ảnh đó vào bộ log; chọn **Bỏ ảnh lượt này** nếu có thông tin nhạy cảm hoặc hình sai, khi đó cả hai ảnh bị bỏ khỏi bộ xuất.
5. Nếu phần mềm đã thực hiện kéo, quay lại màn hình chính và chọn **PASS** hoặc **FAIL** theo quan sát. Nếu phần mềm không kéo, không có nút PASS/FAIL cho lượt đó.
6. Lặp lại khoảng 10 lượt hình khác nhau; ưu tiên 3 lượt không nhận diện và 3 lượt kéo thiếu. Khi trò chơi di chuyển vị trí trong trình duyệt, **Chọn vùng trò chơi** lại.
7. Nhấn **Lưu bộ chẩn đoán** để xuất `puzzle-diagnostic-v21.zip` (JSON hình học + các ảnh PNG đã được anh duyệt), kiểm tra ZIP trước khi gửi. **Lưu log** vẫn chỉ xuất JSON, không có ảnh.

Không tự tải ảnh hoặc log lên mạng. Các tọa độ chuột được ghi là **đã gửi và được trình duyệt xác nhận**, không phải bằng chứng mảnh ghép đã thực sự di chuyển. Giao diện V2.1 giới hạn 20 lượt Test mỗi phiên để tránh lưu quá nhiều ảnh trong RAM.


## V2.2 — WebView2 cố định và kiểm tra vùng đã chọn (không tự giải CAPTCHA)

- Đây là bản **chẩn đoán thụ động**, chưa triển khai Agent, không tự động kéo mảnh ghép hoặc vượt xác minh đăng nhập.
- WebView2 được giữ cố định **1178 × 600** đơn vị điều khiển, zoom 100%; khi thay kích thước cửa sổ, khung ngoài có thanh cuộn chứ WebView2 không bị kéo giãn. Nếu màn hình quá nhỏ, cần cuộn để xem hết. Kích thước ảnh pixel có thể khác khi DPI của Windows thay đổi.
- Tại màn hình trò chơi, bấm **Chọn vùng trò chơi** và chỉ chọn vùng hình ghép. Kiểm tra trước khi duyệt. Tọa độ vùng và kích thước ảnh được lưu **cục bộ** dưới LocalApplicationData, không lưu URL, ảnh, tài khoản hay session. Lần sau chỉ tái sử dụng khi kích thước ảnh khớp chính xác; khác DPI/viewport phải chọn lại.
- Bấm **Kiểm tra vùng (không kéo)**. Công cụ chỉ chụp vùng đã chọn trong RAM để anh xác nhận. Nút **Xuất vùng đã duyệt** sẽ ghi ZIP gồm `region-v22.png` và `region-v22.json`, không có màn hình đăng nhập đầy đủ. Đọc lại ZIP trước khi gửi.
- Không bấm Test/kéo tự động; V2.2 không thử lại, không tự đăng nhập, không tự điều hướng trang Confirm. Hoàn thành thử thách phải do người dùng thực hiện hoặc qua API/SSO chính thức do WMS cho phép.
- `--startup-smoke` kiểm tra OpenCV synthetic V2 và giới hạn tọa độ ROI synthetic V2.2, không truy cập WMS hoặc mạng thật.

## V2.3 — Mô phỏng ROI lệch ±15 px và kéo cục bộ (offline)

1. Giải nén toàn bộ ZIP Windows x64, mở `SUPRA.Puzzle.Tester.V2.exe` (version 2.3.0).
2. Nhấn **Mô phỏng kéo (offline)**. Không cần đăng nhập, không truy cập WMS hoặc CAPTCHA thật.
3. Nhập độ lệch vùng chọn X/Y từ -15 đến +15 px, thử nhiều tổ hợp (-15,-15), (0,0), (+15,+15).
4. Nhấn **Mô phỏng kéo**. Hình chữ nhật màu xanh di chuyển trên hình giả lập tới ô viền xanh. Màn hình hiện `SIM PASS` nếu chuyển động mô phỏng khớp khoảng đã biết.
5. Nhấn **Lưu kết quả** để tạo JSON mô phỏng, không chứa URL, tài khoản hoặc dữ liệu từ Web.
6. V2.2 vẫn hỗ trợ **Chọn vùng trò chơi**, **Kiểm tra vùng (không kéo)** và **Xuất vùng đã duyệt**. Nút Test kéo tự động trên trang WMS không được bật.

`SIM PASS` chỉ xác minh phép toán tọa độ trong hình giả lập có nhãn cố định, **không phải** độ chính xác nhận diện hình ngẫu nhiên, không chứng minh kéo CAPTCHA qua được trang đăng nhập và không xác minh tính năng Confirm Picklist.
