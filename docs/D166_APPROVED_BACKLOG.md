# D166 — Owner-approved backlog: Android mandatory update và trùng thư mục Logs hằng ngày

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


---

## D166-LOG-FOLDER-DUPLICATE — Tìm nguyên nhân và xử lý dứt điểm hai thư mục log trùng ngày

**Owner bổ sung:** 09/10/2026 (giờ Việt Nam). **Trạng thái:** BACKLOG ĐÃ GHI NHẬN — điều tra nguyên nhân, chưa sửa runtime, chưa xác nhận hiện trường. **Ưu tiên đề nghị: P1 (bảo toàn chứng cứ/log), tăng P0 nếu phát hiện log mất hoặc tự xóa sai.**

### Hiện tượng và phạm vi

- Google Drive `Inventory/Beta/Logs` đôi lúc xuất hiện **hai thư mục con khác ID nhưng cùng tên ngày `YYYY-MM-DD`**; log Web / Android / Agent có nguy cơ bị phân tán. Không coi hai folder có tên khác nhau hoặc nằm ở hai parent khác nhau là cùng một lỗi; đối chiếu chính xác Drive folder ID, parent ID, `createdTime`, chủ sở hữu/actor, và toàn bộ file bên trong.
- Yêu cầu có **duy nhất một ID thư mục chuẩn cho từng ngày Việt Nam dưới đúng một parent Beta Logs**, toàn bộ luồng gửi log phải trỏ tới đó. Không tạo hai nhánh lưu song song; không đổi sang ngày phát sinh event nếu archive thực tế diễn ra ngày khác.

### Kiểm tra source ban đầu — chưa xác nhận root cause thực địa

1. `service/src/runtime-logs.ts#resolveRuntimeLogDailyFolder` (Worker) gọi Drive LIST → nếu chưa thấy thì CREATE → LIST lại → cố xóa thư mục vừa tạo khi đã có thư mục khác; dùng cache cục bộ 6 giờ.
2. `ops/apps-script/agent-log-gateway/Code.gs#resolveDailyLogFolder_` (Apps Script) cũng LIST → CREATE → LIST lại / đưa vào Trash nếu tạo dư; dùng Script Cache 6 giờ và Script Lock. **Script Lock không khóa các Worker instances.**
3. Hai đường trên có điểm kiểm tra–tạo không nguyên tử trên toàn hệ thống. Nếu chạy đồng thời, hoặc Drive list chậm hiển thị / delete-trashing thất bại / cache đang giữ ID khác nhau, vẫn có khả năng xuất hiện hai folder cùng ngày. Đây là **rủi ro nhìn thấy trong code**, không được khẳng định chính là nguyên nhân của các folder quan sát nếu chưa có Drive metadata/log xác nhận.
4. Đối chiếu thêm luồng Firestore fallback/Agent drain, Web/Android upload, quyền OAuth/service identity, khác biệt parent config, deploy phiên bản cũ, retry cùng thời điểm và trường hợp biên 00:00 Asia/Ho_Chi_Minh. Kiểm tra liệu bản sửa D165 trước đây đã được triển khai đầy đủ trong cả hai đường hay chưa.

### Mục tiêu sửa (chỉ triển khai sau đánh giá tác động và Owner phê duyệt)

- Có **một authority duy nhất** cho ánh xạ `(Beta Logs parent ID, ngày Việt Nam) -> canonical folder ID`; cơ chế tạo-if-absent phải chống đua xuyên Worker / Apps Script / nhiều request song song, không chỉ Script Lock hay cache trong một process. Worker/Apps Script dùng chung hoặc tra ID chuẩn; không cho hai dịch vụ cùng tự quyết tạo khi chưa có khóa/authority đáng tin cậy.
- Tăng khả năng tự phát hiện xung đột và hội tụ về canonical ID, có kiểm soát retry/backoff, bounded list/cache, phân biệt Drive `LIST/CREATE/DELETE` thất bại; không lặp request liên tục gây tăng Usage.
- Idempotency dựa trên `bundle_id` / logical archive identity, không chỉ file name. Mọi lần upload/retry chỉ tạo tối đa một artifact, hỗ trợ nhận `DRIVE_SYNCED` **chỉ khi Drive đã xác minh thành công**; Agent/PDA giữ local pending cho tới xác nhận, không mất log nếu có lỗi.
- Đối với hai folder tồn tại sẵn: trước hết điều tra và lập bản kê `folder_id, parent_id, createdTime, file_count, file_ids, bundle_ids, duplicate/conflict counts`; chọn ID chuẩn dựa trên bằng chứng. Lập phương án di chuyển/hợp nhất **không mất bản gốc, không đè tệp trùng tên nhưng khác nội dung**; KHÔNG tự xóa/trash folder cũ có dữ liệu khi chưa được Owner duyệt xử lý lịch sử.
- Log chẩn đoán đã khử nhạy cảm: thao tác `LIST / CACHE_HIT / CREATE / CONVERGE / REUSE / CONFLICT / CLEANUP`, source `worker / apps_script`, day, canonical folder short ID/hash, request/bundle correlation, result/status, retry/latency; chỉ sử dụng cơ chế log/thu thập sẵn, không tạo log storm, không đưa secret, Picker/SKU/PL hay nội dung file lên GitHub.

### Kiểm thử chấp nhận

1. Upload đồng thời từ Web, nhiều PDA và nhiều Agent vào **cùng ngày**, bao gồm trùng request, retry lỗi, hai dịch vụ tạo thư mục từ trạng thái chưa có folder: đúng một canonical folder ID; tất cả log xác nhận Drive đều nằm bên trong.
2. Kiểm thử chuyển ngày VN lúc 23:59 → 00:01, delay upload hôm trước, restart Worker/Script, cache hết hạn, Drive LIST trả kết quả trễ, 403/429/5xx/timeout, orphan folder và Google Drive eventual consistency (nếu có).
3. Đối chiếu số bundle sinh, bundle chờ và bundle đã archive; không mất log, không ghi trùng, không xóa local khi chưa `DRIVE_SYNCED`; không chuyển nhầm Logs parent, không làm thay đổi Launcher / dự án khác / Stable.
4. Chỉ kết luận **ROOT CAUSE CONFIRMED** khi có Drive folder metadata/actor + tương quan log request và chứng minh được điều kiện tạo trùng. Kiểm thử CI đơn thuần không được coi là lỗi hiện trường đã hết.
5. So sánh Drive API calls, Cloudflare requests, thời gian lưu file trước/sau; không thêm periodic polling/heartbeat, không giảm tốc độ xử lý nghiệp vụ/realtime/ACK.

**Gate:** Hạng mục này chỉ là ghi nhận backlog trong D166; không thay đổi runtime, không dọn thư mục lịch sử, không deploy. Chỉ triển khai sau khi Owner duyệt riêng phương án tác động (Worker, Apps Script, Drive OAuth, quota, rollback, kiểm thử). Stable vẫn OWNER-GATED. Tham chiếu `docs/specs/OBSERVABILITY_LOGGING.md` và `docs/specs/ACCEPTANCE_TESTING.md`.
