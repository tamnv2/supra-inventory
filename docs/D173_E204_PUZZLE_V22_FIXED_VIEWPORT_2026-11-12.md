# D173-E204 — V2.2 fixed viewport / ROI passive diagnostic (12/11/2026)

## Yêu cầu Owner và ranh giới

- Owner muốn Web login có kích thước nhất quán trên màn HD/HD+/DPI khác nhau, chọn vùng hình ghép một lần, sau đó nhận diện chính xác và kéo tự động rồi truy cập Confirm Picklist.
- Cơ chế hình ghép xảy ra trong bước xác minh chống tự động hóa của hệ thống đăng nhập. Công cụ này **không triển khai việc tự giải/vượt xác minh, không tự thử lại, không đăng nhập hoặc điều hướng Confirm**, không mở quyền Agent Production.
- Phạm vi triển khai có thể kiểm thử an toàn: WebView2 cố định trong phần mềm chẩn đoán độc lập, lưu tọa độ ROI cục bộ, kiểm tra/duyệt ảnh puzzle-only, xuất ZIP cục bộ, không gửi chuột hay dữ liệu ra hệ thống.
- Bản V2.1 PR935/PR931 và sản phẩm Agent đã phát hành giữ nguyên. PR V2.2 là CODE ONLY, test artifact, không merge main/OTA; D172 giữ PENDING/HOLD, Stable Owner-gated.

## Source kiểm chứng được

- V2.1 dùng `PuzzleVision.Analyze(picture)` với ảnh *toàn bộ WebView2*, ROI chỉ dùng ghi ảnh; 35 lượt V2 trước: 0 PASS, và ZIP V2.1 Owner cung cấp có 8 Test / 1 drag FAIL / 7 IMAGE_AMBIGUOUS. Một mẫu kéo có tham chiếu 122px, lệnh 120px và quan sát 114px, chưa chứng minh một hệ số hiệu chỉnh ổn định.
- V2.2 không thay thuật toán, không nối automation vào WMS. Khung browser fixed control size 1178×600, zoom=1, outer panel AutoScroll, WinForms AutoScaleMode.None; đây là kích thước điều khiển cố định, *không bảo đảm kích thước pixel ảnh hoàn toàn giống nhau nếu Windows DPI khác*. ROI reuse phải khớp screenshot width/height, còn trang tự thay đổi bố cục phải duyệt lại.
- Lưu `region-v22.json` dưới LocalApplicationData: chỉ 6 số nguyên (kích thước screenshot và hình chữ nhật); không URL, user, password, cookie, session hay ảnh.
- Nút `Kiểm tra vùng (không kéo)` chỉ capture preview trong RAM, tái tạo crop đúng ROI và yêu cầu xác nhận; nút `Xuất vùng đã duyệt` tạo ZIP `region-v22.png` + `region-v22.json` sau khi người dùng đã xem. Nút cũ thực hiện kéo V2.1 không hiển thị trong V2.2. Không gửi request xác minh mới hoặc chuột trong luồng V2.2.

## Guard và PASS

1. Node source checks: fixed WebView2 dimensions, no new mouse/solve code, image-only local export, matched-dimension persistence.
2. Windows x64: native build + startup smoke synthetic ROI boundaries and existing OpenCV synthetic test.
3. Chỉ gọi CODE/CI PASS khi exact SHA và workflow thành công. FIELD, OWNER PASS luôn pending nếu chưa kiểm chứng trên máy thật.
4. Không gửi thử thách lặp lại: với rủi ro khóa tài khoản do anti-spam, kiểm thử ROI bằng ảnh/nguồn synthetic hoặc một trang được cho phép thay vì thao tác xác minh tự động.

## Phần không thực hiện

- Tự động nhận diện/giải hình xác minh, suy luận khoảng kéo để qua CAPTCHA, tự kích hoạt đăng nhập hoặc truy cập Confirm sau khi vượt hình ghép. Nếu WMS có API/SSO hoặc cơ chế tích hợp được ủy quyền, đó là một scope độc lập cần thẩm định hợp đồng, bảo mật và Owner phê duyệt.
