# D166 — Backlog: Bắt buộc cập nhật APK Báo hàng trước khi sử dụng

**Ghi nhận Owner:** 09/10/2026 (Asia/Ho_Chi_Minh)  
**Trạng thái:** YÊU CẦU ĐÃ CHỐT / CHƯA TRIỂN KHAI / CHƯA FIELD PASS  
**Phạm vi:** Android APK **Báo hàng — SUPRA Inventory Beta**, áp dụng cho các vai trò Picker, Reporter, Admin, Root. Không mặc nhiên áp dụng cho Launcher, ứng dụng Quản lý PDA, Windows Agent hay Web. Stable vẫn OWNER-GATED.

## Yêu cầu nghiệp vụ (D166-ANDROID-FORCE-UPDATE)

Khi có **phiên bản APK mới đã được phát hành chính thức, được ký số và được phê duyệt cho đúng kênh/phạm vi cập nhật**, bản APK cũ **không được tiếp tục sử dụng**. Màn hình cập nhật có hành động chính **Cập nhật ngay**; **không có** “Để sau”, “Bỏ qua”, “Tiếp tục dùng bản cũ”, đóng hộp thoại để vào nghiệp vụ, hoặc Back để lách chặn. Đây là cập nhật bắt buộc cho mọi lần phát hành hợp lệ, không phụ thuộc nhãn “critical/optional”.

- Nếu bản cài đặt cũ hơn bản phát hành hợp lệ: chặn đăng nhập và mọi thao tác nghiệp vụ; nếu đang đăng nhập, chuyển sang trạng thái khóa cập nhật tại ranh giới an toàn tiếp theo. Không tạo thao tác mới khi gate đã bật.
- Nếu phát hiện thay đổi trong lúc một xác nhận Picklist, báo SKU, chuyển trạng thái hoặc ACK đang chạy: **không huỷ/nhân đôi thao tác đang gửi**; hoàn tất hoặc phân định kết quả bằng quy trình an toàn hiện có, sau đó mới khóa các thao tác tiếp theo. Không báo thành công giả, không mất ACK.
- Kiểm tra ở các thời điểm thích hợp: khởi động, trước đăng nhập, quay lại foreground và khi có tín hiệu phiên bản từ kênh hiện hữu (nếu khả dụng). Ưu tiên một cơ chế thông báo/cache hợp lệ thay vì polling liên tục; không bổ sung Firestore reads, timer ngắn hay mỗi màn hình một request.
- Chỉ tin nguồn phiên bản chính thức/canonical của đúng kênh Beta. Đối chiếu versionCode/versionName, package ID, checksum SHA-256 và chữ ký APK hiện hành theo D039/D055; bản draft, pre-release chưa được đưa vào kênh áp dụng, APK sai chữ ký hoặc cập nhật cho ứng dụng khác không được kích hoạt cưỡng bức.
- Nút **Cập nhật ngay** mở đúng luồng tải/kiểm tra/cài đặt Android. Khi người dùng huỷ trình cài đặt, APK lỗi, không có mạng, thiếu dung lượng, thiếu quyền cài đặt hoặc kiểm tra nguồn bị lỗi: giữ màn hình chặn với thông báo nguyên nhân và **Thử lại** / hướng dẫn xử lý; **không mở lại nghiệp vụ bằng bản cũ**. Không xoá ứng dụng/dữ liệu người dùng hoặc tự cài đặt vượt cơ chế bảo mật Android.
- Sau khi cài đặt xong, xác minh lại phiên bản và nguồn tin cậy rồi mới mở khóa; giữ nguyên dữ liệu/phiên hợp lệ theo cơ chế bảo mật hiện có; không bỏ qua xác thực, không bắt buộc logout nếu không cần.
- Log tối thiểu, đã khử dữ liệu nhạy cảm: phiên bản cài đặt, phiên bản yêu cầu, trạng thái kiểm tra/tải/cài, lý do khóa/thất bại, thời điểm; dùng log hiện hữu, không tăng lịch gửi log chỉ để theo dõi cập nhật.

## Tiêu chí nghiệm thu

1. APK cũ mở lúc đã có bản hợp lệ: chỉ hiện cập nhật bắt buộc, không có “Để sau” hoặc đường vào ứng dụng.
2. APK cũ đã đăng nhập, chuyển nền rồi quay lại sau khi bản mới có hiệu lực: bị khóa trước thao tác nghiệp vụ mới.
3. Android Back, Home rồi quay lại, đóng trình cài đặt, mất mạng hoặc tải lỗi: vẫn không được dùng bản cũ; có hướng dẫn và Thử lại.
4. Cập nhật thành công, đúng package/chữ ký/hash: phiên bản mới hoạt động bình thường và không còn kẹt màn chặn.
5. Phát hành nháp, nhầm kênh, bản không đủ xác thực: không kích hoạt việc bắt buộc nâng cấp sai; trạng thái không kiểm chứng được xử lý fail-closed theo D039.
6. Đang có nghiệp vụ/ACK chưa hoàn tất lúc xuất hiện yêu cầu cập nhật: không mất, không xác nhận trùng và không tự thay đổi kết quả nghiệp vụ.
7. Không sinh vòng lặp kiểm tra phiên bản hoặc mức tăng bất thường Firestore/Cloudflare/GitHub usage; tốc độ khởi động, realtime, HA và ACK giữ nguyên trong kiểm thử hồi quy.

## Điều kiện triển khai

**Chỉ ghi vào backlog D166 ở yêu cầu này; chưa sửa source, không build, không phát hành APK, không bật cưỡng chế ngoài thực địa.** Trước khi làm code phải đánh giá tác động Android và kênh phát hành, trình Owner phương án an toàn và nhận lệnh triển khai riêng. Sau code: branch → PR → authority/continuity + Android/updater test PASS → phát hành Beta đã phê duyệt → kiểm tra PDA thực tế → Owner PASS. Stable không thay đổi.

Tham chiếu: Owner Decision **D039**, **D055**; `docs/specs/ACCEPTANCE_TESTING.md`; D166 log/Usage audit độc lập.
