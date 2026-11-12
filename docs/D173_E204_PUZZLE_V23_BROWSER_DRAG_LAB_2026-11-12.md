# D173-E204 — V2.3 WebView2 real-mouse drag lab (offline only)

Ngày: 12/11/2026. Owner yêu cầu bản V2.3 kiểm thử kéo thật và xuất log đầy đủ. PR #940 (Draft, stack trên PR #938) là nguồn làm việc; Agent Production không thay đổi.

## Căn cứ và ranh giới

- V2.2 Owner FIELD ghi nhận vùng chọn giữ đúng qua resize/Scale/Display Resolution; đúng phạm vi ROI-only. V2.1: một lượt kéo FAIL, bảy lượt IMAGE_AMBIGUOUS. Không đủ bằng chứng kết luận thuật toán WMS đã đúng.
- Phòng thử V2.3 sử dụng WebView2 thật và lệnh CDP `Input.dispatchMouseEvent` thật, nhưng chỉ điều khiển **trang HTML mẫu tích hợp trong ứng dụng** (`NavigateToString`/about:blank). Không mở WMS, không giải xác minh đăng nhập, không tự đăng nhập/chuyển Confirm và không dùng thông tin tài khoản.
- Browser thử nghiệm biệt lập, InPrivate; chặn mở cửa sổ khác và từ chối điều hướng tới bất kỳ địa chỉ ngoài `about:blank`. Không phát sinh request WMS/Cloud. Các trang WMS trong phần chính của V2.2 giữ nguyên trạng thái đọc/duyệt ROI; nút Test tự kéo cũ vẫn bị ẩn.

## Luồng test một lần

1. Mở V2.3; chọn **Phòng thử kéo thật (offline)**.
2. Trên hình mẫu (ô xanh di chuyển, khung cam đích), bấm **Chọn vùng** để khoanh phần có đủ nguồn và đích. Vùng có thể lệch nhỏ; thuật toán mở rộng ROI thêm 16 px và cắt theo giới hạn viewport.
3. Bấm **Kéo thật 1 lần**: ảnh WebView2 -> OpenCV ngưỡng màu trên ROI được mở rộng -> xác nhận đúng một nguồn và một đích -> tính delta. Không đủ căn cứ thì không gửi chuột.
4. Khi nhận diện được, CDP gửi chuỗi mouseMoved -> mousePressed -> 24 mouseMoved -> mouseReleased vào chính trang mẫu đã dựng. Sau đó chụp ảnh mới và đo tâm ô xanh thực tế.
5. Xem trạng thái `LOCAL_DRAG_PASS`/`LOCAL_DRAG_FAIL` hoặc lý do từ chối. Bấm **Mẫu mới** để tạo hình mẫu khác và lặp lại; tối đa 8 mẫu/phiên; mỗi mẫu tối đa 1 lượt kéo.
6. Bấm **Lưu ZIP chẩn đoán** để lưu `puzzle-browser-drag-v23.zip` gồm JSON và các ảnh `attempt-NN-before.png` / `attempt-NN-after.png` (chỉ là trang mẫu offline). Gửi ZIP để phân tích, không gửi tự động.

## Bằng chứng và cách đọc

JSON lưu schema, từng lượt `sequence`, ROI chọn, padding, kích thước screenshot, nguồn/đích do OpenCV nhận diện, khoảng kéo dự đoán, khoảng tham chiếu từ chính test fixture, sai lệch dự đoán, mảng sự kiện chuột CDP đã ACK (loại sự kiện, X/Y CSS, thời gian tương đối), vị trí quan sát sau kéo, độ lệch so với đích, kết quả và lý do. ACK là xác nhận lệnh WebView2, còn ảnh SAU mới là bằng chứng vị trí thực tế.

Dữ liệu chỉ chứa hình mẫu cục bộ, không lưu URL, credentials, cookies, session, DOM, người dùng hoặc challenge của WMS.

## Điều kiện PASS

- Source tests phải chứng minh cô lập trang thử nghiệm; một mẫu một lần kéo; nhận diện từ ảnh đã chụp, có ROI padding; có cặp ảnh và trace; không thử lại hoặc truy cập WMS.
- Windows x64 native build + startup smoke phải qua OpenCV synthetic fixture cùng 3 mức lệch ROI -15/0/+15 px.
- `CODE/CI PASS` chỉ đánh giá chất lượng build và synthetic fixture; `FIELD PASS` phải chờ Owner thực hiện trực tiếp một hoặc vài mẫu trên Windows rồi gửi ZIP. Không suy diễn kết quả này sang CAPTCHA/WMS Production.
