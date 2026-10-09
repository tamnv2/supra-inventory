# D166 — Owner-approved backlog / các yêu cầu đã ghi nhận, chờ triển khai hoặc phân tích

**Ghi nhận Owner:** 09/10/2026 (Asia/Ho_Chi_Minh)  
**Trạng thái:** YÊU CẦU ĐÃ CHỐT / CHƯA TRIỂN KHAI / CHƯA FIELD PASS  
**Phạm vi chung:** Các hạng mục khác nhau trong SUPRA Inventory Beta; mỗi hạng mục quy định phạm vi riêng. Chỉ ghi nhận Owner yêu cầu không mặc nhiên cho phép triển khai code, thay đổi provider hoặc phát hành. Stable luôn OWNER-GATED.

## Yêu cầu nghiệp vụ (D166-ANDROID-FORCE-UPDATE)

**Phạm vi riêng:** Android APK Báo hàng Inventory Beta, Picker/Reporter/Admin/Root; không bao gồm Launcher, Quản lý PDA, Windows Agent, Web hoặc Stable.

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


---

## D166 backlog bổ sung ngày 09/10/2026 — BỐN ĐỀ XUẤT CHỜ PHÂN TÍCH

**Owner command:** Tạm thời ghi vào backlog D166, phân tích sau. **Trạng thái của tất cả mục dưới đây:** `REQUIREMENT_RECORDED__ANALYSIS_DEFERRED__NO_IMPLEMENTATION_APPROVAL`. Không sửa logic/UX/API/schema, không bật tính năng tự động, không phát hành APK/Agent/Web hoặc chạy tác vụ trên Supra. Đây là yêu cầu khảo sát/chốt giải pháp tương lai, **không phải Owner PASS hay triển khai D166**.

### D166-HAS-STOCK-SHARED-CORRECTION-WINDOW — Đồng nhất thời gian sửa kết quả

- Đối với SKU **Đã có hàng** (`HAS_STOCK`), cho phép thao tác **Sửa trạng thái** trong cùng số phút được cấu hình trên Web cho **Cho phép Skip** (`SKIP_ALLOWED`), không có hai cửa sổ thời gian khác nhau. Ví dụ setting là **15 phút** thì cả hai trạng thái được sửa trong 15 phút theo cùng quy tắc tính thời gian được duyệt.
- Hết cửa sổ hợp lệ phải **ẩn hoàn toàn các nút Sửa**, không chỉ disable, trên **cả Web và ứng dụng Android Reporter**. Thời hạn thực tế và quyền sửa do server xác thực; người dùng không thể dùng UI cũ, request cũ hoặc sai giờ thiết bị để sửa sau hạn.
- Giữ các hướng chuyển trạng thái đã cho phép và quy trình xác nhận/cảnh báo, audit, cập nhật realtime, Picker nhận thông báo kết quả sửa/ACK, expected-version chống ghi đè. Không tự mở thêm hướng chuyển trạng thái ngoài những hướng hiện hữu.
- **Để phân tích sau:** đối chiếu setting hiện có `skip_to_stock_minutes`, cờ cho phép sửa, mốc bắt đầu tính thời gian (hiện gắn với báo SKU đầu tiên), giao diện khi không còn quyền sửa và hành vi đối với bản ghi đã quá hạn trước khi đổi setting. Không tự thay đổi SLA/thời gian mặc định ở bước ghi backlog.

### D166-WEB-FIVE-STATUS-TABS — Thay Kết quả gần đây bằng năm tab trạng thái trên Web

- Tại khu vực vận hành Web, **thay giao diện Kết quả gần đây** bằng bộ tab: **Đang xử lý / Quá hạn / Đã có hàng / Cho phép Skip / Picker đã thu hồi**.
- Tab hiển thị đúng dữ liệu theo trạng thái, giữ nghiệp vụ đang có, thao tác hợp lệ, số đếm nếu được xác định ở giai đoạn thiết kế; bảo toàn realtime, chuyển trạng thái, quyền xem, phân trang, báo cáo lịch sử và khả năng theo dõi kết quả. Không xoá dữ liệu lịch sử hoặc ngầm bỏ báo cáo kết quả.
- **Chỉ áp dụng đề xuất Web**; không tự thêm `Picker đã thu hồi` lại trên Android Reporter (D165 hiện ẩn tab Android). Cấu trúc tab/badge, phạm vi lọc ngày, quan hệ giữa `Quá hạn` và `Đang xử lý`, và tác động API/Usage sẽ được phân tích sau.

- **D166-WEB-DATE-RANGE — Owner bổ sung 09/10/2026:** thêm **bộ lọc ngày ở khu vực vận hành Web**, áp dụng thống nhất cho **cả 5 tab**. Khi mở màn hình mới / lần truy cập mới, **mặc định Hôm nay theo múi giờ Asia/Ho_Chi_Minh**. Người dùng có thể chọn **Từ ngày – Đến ngày** khác và nhấn Xem/Áp dụng để chỉ hiển thị các kết quả thuộc khoảng ngày đã chọn. Ngày đầu và cuối đều được tính bao gồm; nội dung hiển thị và số liệu theo đúng bộ lọc, không chỉ đổi chữ trên giao diện.
- Thao tác chuyển tab phải **giữ nguyên khoảng ngày người dùng vừa chọn**; đổi ngày cập nhật đồng bộ dữ liệu, thống kê/số đếm hợp lệ của tab đang xem và các tab liên quan khi cần, không tạo vòng lặp gọi API. Có thao tác quay nhanh về **Hôm nay**; không bắt buộc Owner chốt thêm preset 7/30 ngày ở bước backlog.
- **Điểm chờ phân tích:** mốc phân loại ngày của từng tab (ngày báo thiếu đầu tiên, ngày xử lý kết quả, ngày Picker thu hồi, mốc Quá hạn), **trạng thái hiện tại hay trạng thái tại thời điểm lịch sử**, dữ liệu khả dụng khi chọn ngày quá khứ, ranh giới ngày Việt Nam, giới hạn khoảng ngày và phân trang. Phải chọn cách hiển thị trung thực, nhất quán và có chỉ dẫn nếu một trạng thái không thể dựng lại lịch sử; tuyệt đối không giả vờ có snapshot lịch sử khi chưa có.
- **Usage/realtime:** giữ dữ liệu Hôm nay theo realtime/delta như hiện tại; khi chọn khoảng ngày khác ưu tiên truy vấn có phân trang/chỉ khi người dùng đổi lọc hoặc mở tab, không tải ngầm đầy đủ 5 tab hay thêm polling liên tục. Tuân thủ trần truy vấn hot-report hiện tại hoặc trình Owner nếu cần sửa, giữ bảo toàn ACK và các chức năng đang hoạt động. **Chỉ bổ sung backlog, chưa sửa code.**

### D166-AGENT-AUTOMATIC-DAILY-SKU-BROWSER — Nghiên cứu tự đồng bộ SKU hằng ngày qua trình duyệt Supra

- Owner đề nghị **nghiên cứu phương án**: Agent sau khi khởi động và ổn định sẽ mở **một trình duyệt Supra bổ sung**, điều hướng tới màn hình xuất/cập nhật SKU, tải file SKU, đưa file qua quy trình upload danh mục SKU của Inventory; chỉ đánh dấu **DONE** sau khi toàn bộ quy trình đã xử lý và hệ thống xác nhận kết quả.
- **Chưa cho phép thực thi:** D126 hiện rút quyền tự động đồng bộ SKU từ WMS/Supra và chỉ giữ **import file thủ công**. Đề xuất mới có xung đột với quy tắc hiện hành, yêu cầu so sánh an toàn/bảo mật/quyền truy cập, tính hợp lệ cách thao tác UI, phạm vi thông tin cho phép, nguồn file, quyền nhập và tác động nghiệp vụ **trước khi Owner cho phép khôi phục một phần tính năng**.
- **Các tình huống bắt buộc đưa vào phân tích sau:** Agent vừa khởi động nhưng chưa sẵn sàng/WMS chưa đăng nhập, login/MFA/captcha, WebView2/session tách biệt, giờ ngoài ca, nhiều Agent cùng online hoặc failover, tải thiếu/file cũ/file sai định dạng, mất mạng, timeout, trùng SKU/đổi tên, import một phần, restart giữa chừng, hoàn tất nhưng mất ACK, tránh chạy lại hoặc ghi trùng; xác minh đầu-cuối bằng dữ liệu server, retry an toàn/có kiểm soát, báo lỗi rõ thay vì báo DONE giả.
- Không làm gián đoạn **WMS Confirm Picklist, PRIMARY/standby, ACK, realtime**, không ghi lại/lấy trích xuất mật khẩu/cookie/token/session WMS, không tự bật browser automation hoặc cron/điều khiển provider trong bước backlog. Chi phí Usage / tần suất 1 lần/ngày và kịch bản không có Agent ổn định cần tính toán khi phân tích.

### D166-LOCATION-AS-OF-REPORT-ANALYTICS — Khu vực chứa hàng tại ngày báo và tái thiết kế báo cáo

- Nghiên cứu khả năng Web hiển thị **khu vực chứa hàng của SKU tại thời điểm/ngày phát sinh báo hết hàng**, ví dụ nhóm **LTA** hoặc **Shelving**. Không lấy vị trí mới nhất hôm nay để gán ngược cho báo cáo lịch sử nếu SKU từng đổi khu vực.
- Bổ sung phương án báo cáo **SKU/khu vực nào thường phát sinh báo hết hàng**, phân tích xu hướng theo thời gian, lọc và phân nhóm theo khu vực; đánh giá lại cấu trúc nội dung của **Báo cáo tổng quan** và **Báo cáo chi tiết** hiện tại, đề xuất phần nên thêm, chỉnh hoặc loại bỏ để phù hợp nghiệp vụ. Không tự thiết kế thêm xếp hạng hiệu suất cá nhân Picker hoặc chỉ số không có dữ liệu hợp lệ.
- **Để phân tích sau:** xác định nguồn dữ liệu khu vực tin cậy và quyền sử dụng; mức phân loại LTA/Shelving hay chi tiết hơn; thời điểm chụp snapshot/cơ chế ghi lịch sử và xử lý SKU đổi vị trí, SKU nhiều khu vực, dữ liệu thiếu/không xác minh được; thay đổi dữ liệu/API/filter/export, quyền xem và chi phí lưu trữ/Usage. Nếu chưa có nguồn lịch sử, phải phân biệt `UNKNOWN` với dữ liệu đã xác thực; không suy đoán hoặc backfill sai.
- **Scope conflict phải rà soát trước code:** D002/D116 hiện chỉ quản lý SKU + tên sản phẩm, không quản lý bin/location/pickface. Owner mới cho phép **nghiên cứu** mở rộng góc nhìn báo hàng theo khu vực, **chưa** chấp thuận mở rộng SKU master, kho vị trí, WMS synchronization hoặc nhập trường vị trí mới. Cần trình Owner lựa chọn mô hình dữ liệu và phân quyền rồi mới cập nhật scope nghiệp vụ.

### Ranh giới chung và yêu cầu ghi nhận

- Cả bốn mục là **backlog để phân tích sau** trong đúng `D166`; chưa nghiên cứu kết luận/triển khai giải pháp, chưa chỉnh sửa source hoặc provider, chưa thêm quota calls, không thay đổi Stable. Không đánh đồng `recorded` với `implemented` hoặc `Owner field PASS`.
- Khi Owner yêu cầu mở phân tích: đánh giá tác động cơ sở D165/D166, các spec đang xung đột, UI Web/Android/Agent, dữ liệu & source authority, quyền/bảo mật, failure modes, realtime/HA/ACK, ngân sách Usage, hồi quy và phương án triển khai từng bước. Chỉ sửa code sau **phê duyệt riêng của Owner**.
- Các spec liên quan: `docs/specs/FORMS.md`, `docs/specs/REPORTING_DASHBOARD.md`, `docs/specs/UI_DESIGN_SYSTEM.md`, `docs/specs/SKU_MASTER.md`, `docs/specs/ACCEPTANCE_TESTING.md`; các quyết định lịch sử D002/D126 tiếp tục có hiệu lực **đối với runtime hiện tại**.


---

## D166-NEW-PICKER-REPORTING-DEFAULT-ON — Tự động bật Báo hàng khi tạo tài khoản Picker mới

**Owner bổ sung:** 09/10/2026 (Asia/Ho_Chi_Minh). **Trạng thái:** YÊU CẦU BACKLOG ĐÃ GHI NHẬN — CHỜ PHÂN TÍCH/CHỐT PHƯƠNG ÁN — CHƯA SỬA CODE, CHƯA TRIỂN KHAI.

- **Mục tiêu:** mọi tài khoản có vai trò nền `PICKER` **được tạo mới thành công** trong SUPRA Inventory sẽ khởi tạo quyền **Báo hàng = BẬT** (`shortage_reporting_enabled=true`) một cách tự động, thay vì cần Admin/Root bật thủ công sau khi tạo. Không thay đổi quyền của các vai trò khác.
- **Đối tượng:** cần rà soát **tất cả các luồng thực sự tạo mới Picker** thuộc phạm vi Inventory (đặc biệt tạo từ đồng bộ nhân sự/HR, áp dụng batch đã được duyệt và tạo tài khoản nếu UI/API hỗ trợ). Không nhầm đồng bộ cập nhật thông tin của một tài khoản đã tồn tại thành một lần tạo mới.
- **Tài khoản Picker hiện hữu:** không tự động bật lại, không chạy migration đổi quyền hàng loạt; giữ nguyên các lựa chọn bật/tắt mà người quản trị đã thực hiện. Sau khi Picker được tạo, thao tác tắt/bật có thẩm quyền vẫn được giữ nguyên qua lần đồng bộ HR tiếp theo.
- **Tính đúng đắn:** chỉ cấp capability sau khi giao dịch tạo tài khoản được hệ thống xác nhận thành công; tránh tạo trùng/tự bật lại do retry, HR re-sync, đổi tên/nhà thầu, cập nhật metadata, khôi phục hay login. Backend là authority của capability; UI Web/Android thể hiện ngay trạng thái thật bằng cơ chế đồng bộ hiện hữu, không thêm polling/lắng nghe mới.
- **Xung đột authority phải giải quyết ở giai đoạn phân tích:** quyết định **D156** hiện quy định tài khoản Picker mới **mặc định TẮT Báo hàng** và đã chạy migration tắt một lần cho Picker cũ. Yêu cầu Owner mới là **định hướng thay đổi mặc định cho tài khoản tạo trong tương lai**, nhưng vì Owner chỉ yêu cầu ghi backlog nên **D156 vẫn có hiệu lực với hệ thống đang chạy** cho tới khi thiết kế và code mới được phê duyệt/triển khai. Không tái chạy hoặc đảo ngược migration D156.
- **Cần phân tích sau:** xác định các entrypoint tạo Picker hiện tại; mapping capability tại DB/API/HR batch; cách xử lý tài khoản trùng, tạo lại, restore, status inactive, lỗi giữa các bước; log/audit/role permission; đồng bộ UI và tác động quota. Chốt điều kiện nghiệm thu trên Beta trước rollout và Owner field PASS.

**Gate:** Chỉ ghi yêu cầu backlog trong D166. Không thay đổi dữ liệu tài khoản, không sửa Web/Android/Worker, không update HR Sheet, không triển khai provider, không tác động Stable. Mọi thay đổi runtime phải qua đánh giá tác động, Owner duyệt riêng, branch → PR → authority/continuity + hồi quy → Beta field test → Owner PASS.


## D166 — Owner-gated signed APK minimum version: Beta code candidate (10/10/2026)

Reuse existing signed APK channel and `/downloads/pda/manifest`; optional `minimum_version_code` is computed from Owner-controlled `PDA_MIN_VERSION_CODE_BETA`, clamped to the highest **published** Beta release and inert when missing/0. Android verifies manifest channel/tag, downloads and verifies SHA256, Android package name, version and signing certificate via current updater. A verified mandatory floor blocks **new login** if installed vc is too old, retains floor in local app preferences across transient network outages, and supports Owner rollback by lowering the next verified floor. Already authenticated devices keep current runtime/ACK drain rather than aborting an in-flight WMS/Picker receipt; show update prompt to continue session then update. On foreground, recheck at most once/6 hours; no new timer or background poll. No version floor is enabled in Beta by merely merging code; Owner must approve vc and staged rollout separately. Old APK versions without this code cannot be forced by this new client gate retroactively; field rollout must establish adoption and may later add narrowly scoped backend policy only after ACK compatibility tests. CI and Owner PDA field PASS required; no Stable change or automatic mass update.
