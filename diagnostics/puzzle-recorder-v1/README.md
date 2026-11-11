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
