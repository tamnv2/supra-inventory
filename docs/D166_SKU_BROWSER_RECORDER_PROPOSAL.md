# D166 — Đề xuất trình duyệt ghi log thao tác đồng bộ / tải SKU (09/10/2026)

**Authority:** Owner yêu cầu build một trình duyệt nhẹ sử dụng phiên Agent hiện có, trước mắt tập trung ghi log thao tác thủ công trên Supra khi Owner đồng bộ và tải file SKU để phân tích tự động hóa sau này.

**Trạng thái:** `IMPACT_REVIEW_COMPLETE__OWNER_IMPLEMENTATION_APPROVAL_PENDING`. Đây là tài liệu nghiên cứu/phân tích trong **cùng D166**, **chưa** phê duyệt source/build/release/chạy thao tác trên WMS/Supra. D126 vẫn ràng buộc runtime: SKU master chỉ nhập bằng file thủ công; tuyệt đối không bật tác vụ đồng bộ SKU từ WMS hay tự upload Inventory. Stable OWNER-GATED.

## 1. Kết quả kiểm tra live source

- `relay-agent-webview2-host/Program.cs`: Agent dùng WebView2 Fixed Runtime, một `CoreWebView2Environment` với `--profile` (Agent-owned dedicated user-data folder), chứa `_web` và child `WebView2` dùng chung environment.
- `relay-agent/SupraConfirmBrowser.cs`: Agent giao tiếp DevTools loopback bằng `Page/Runtime` (không Network, cookie, token hoặc request capture); `StartOwnedWebView2NoLock` dùng profile `webview2-fixed-profile`. `WaitForPageTarget` hiện chọn **trang đầu tiên** khớp host WMS, tạo nguy cơ gắn nhầm target nếu xuất hiện tab SKU.
- `relay-agent-webview2-host/Program.cs` đang chủ động quản lý `NewWindowRequested`, chính sách URL chỉ dành cho WMS host, và `ProcessFailed`. Trình duyệt phụ phải tuân thủ chính sách điều hướng/authorization sẵn có, không bypass login/2FA.
- `docs/specs/SKU_MASTER.md`: D125/D126 đã hủy WMS SKU read+auto sync, chỉ cho phép Web manual file import; D166 chỉ cho phép nghiên cứu phương án sau khi có quyết định riêng.
- Microsoft WebView2 cho phép nhiều control cùng environment/user-data folder; các environment chia sẻ folder phải tương thích tùy chọn và quản lý vòng đời cẩn thận. `CoreWebView2.DownloadStarting` có khả năng phát hiện sự kiện tải tệp mà không cần Network/CDP request capture.

## 2. Pre-implementation impact review

| Trục | Phân tích và ranh giới |
| --- | --- |
| Accepted base | **Có khả năng ảnh hưởng** Agent Browser host, vì thêm WebView2 và thay target discovery; không sửa runtime hiện tại trước Owner duyệt riêng. |
| Thành phần | `relay-agent-webview2-host/Program.cs`, `relay-agent/SupraConfirmBrowser.cs` (đúng target), Agent UI button/lifecycle và local diagnostic export; không thay service/Worker/Firestore/RTDB/Web/Android trong bản POC đầu tiên. |
| Hồi quy | Nguy cơ Agent attach nhầm SKU tab, WMS login/session thay đổi, Browser ProcessFailed kéo theo Confirm, tiêu tốn RAM/CPU, download ảnh hưởng xác nhận, close/reload/failover. |
| Usage | **Không** thêm Firebase/Firestore/Cloudflare reads, timer, listener, log upload, WMS API polling. Khi Owner thao tác, WMS tải trang/file sẽ tiêu thụ network WMS; local log/zip tiêu thụ ổ đĩa/CPU. |
| Security | Không sao chép profile, không trích xuất cookie/session/token, không bật CDP Network, không ghi URL query/body/headers/credentials/nội dung form, không log file contents/path thực tế hay số SKU sản phẩm. |
| Thẩm quyền | Owner/operator tự nhấn các nút trên trang Supra; công cụ chỉ quan sát thao tác được chọn lọc. Không tự click, gọi endpoint, xác nhận giao dịch, upload vào Inventory, hay tăng quyền WMS. |
| Release | D166 Beta-only, thử trên **standby**/máy không xử lý primary trước; không tự rollout PRIMARY/fleet; Stable không chạm tới. |

## 3. Phương án an toàn khuyến nghị: recorder trong host hiện có

1. Mục `Ghi nhận thao tác SKU` **chỉ mở khi Owner chọn** từ Agent sau khi xác nhận browser/Agent sẵn sàng; không chạy theo khởi động, không chạy định kỳ.
2. WebView2 phụ được tạo **trong cùng host, cùng CoreWebView2Environment và profile Agent** để trình duyệt quản lý phiên như bình thường; **không đọc/copy/serialize** cookies/tokens/session. Phiên dùng được hay phải đăng nhập lại được xác định bởi website, không được đảm bảo cưỡng ép.
3. Tách cửa sổ/form hoặc vùng tab có định danh ổn định `SKU_RECORDER`, không làm thay đổi confirm WebView. Nếu website mở popup, chỉ xử lý an toàn trong khung SKU, không ảnh hưởng `_activeWeb` Confirm.
4. Sửa DevTools target affinity: Agent chỉ attach vào target Confirm đã nhận diện/đăng ký; nếu không xác định duy nhất thì **fail closed**, không chọn tab WMS đầu tiên ngẫu nhiên. Trình duyệt phụ không được sửa `_targetUrl`, `_socket`, navigation, reload hoặc page size của Confirm.
5. Ghi dữ liệu từ sự kiện điều hướng/lifecycle/click **metadata whitelist**, không capture mọi phím gõ hoặc mọi network request. Dùng DOM click observer giới hạn tag/role/label **không phải nội dung nhập**, không log `outerHTML`, input values, text content tự do hoặc path+query. Nếu không xác thực được selector/screen, ghi `UNKNOWN_STEP`.
6. Download: `DownloadStarting` → `DownloadOperation.StateChanged`, trạng thái `STARTED/IN_PROGRESS/COMPLETE/INTERRUPTED`, elapsed/bytes, loại file/extension chuẩn hóa, kích thước và SHA-256 file sau khi tải xong nếu được phép đọc tệp đã tải (không lưu nội dung). `COMPLETE` chỉ có nghĩa tệp tải xong, **không** đồng nghĩa SKU nhập hệ thống.
7. Nhật ký riêng theo phiên thao tác, bounded/rotated tại máy: VN timestamp + monotonic elapsed + random run ID; không ghi browser user-data/cookie, không đưa bí mật vào GitHub. Button `Dừng ghi & Xuất ZIP` có manifest, JSONL event timeline, thống kê latency/error, sanitization report; không bắt buộc tự upload Drive.
8. Thu thập tối thiểu: `RECORDER_START`, `BROWSER_READY/LOGIN_REQUIRED`, `NAVIGATE_PAGE_ALIAS`, `UI_CLICK_ALIAS`, `SYNC_STEP_STARTED/RESULT_UNKNOWN` (chỉ theo bằng chứng UI), `DOWNLOAD_START/COMPLETE/FAIL`, `RECORDER_END`. Kết quả dữ liệu/file chỉ được xác minh bằng bằng chứng download thực và kiểm tra định dạng file ngoại tuyến ở giai đoạn sau.
9. Đóng recorder không đóng Confirm hay Agent; ngược lại Agent refresh/restart browser phải khép recorder an toàn, flush log, tránh kill shared process vì một tab bị lỗi. Không tự điều hướng sang URL chỉ dựa trên suy đoán từ source.
10. V1 không tự bấm `Đồng bộ`, không tự tải file, không tự nhập Inventory, không lập lịch 1 lần/ngày, không dùng SKU data để điều khiển hệ thống.

## 4. Tiêu chí nghiệm thu POC

- Test cùng phiên: mở recorder khi Confirm login/ready; UI SKU phải mở thành công hoặc yêu cầu login hợp lệ; không xác nhận đã dùng chung session nếu thực tế website buộc đăng nhập lại.
- Test đính kèm DevTools 20 lần (startup, reload, đóng/mở tab, popup) không attach nhầm recorder; Confirm tìm và xác nhận picklist/ACK vẫn hoạt động đúng.
- Test primary/standby: chạy trên standby trước, quay về Confirm mọi lúc; không đổi PRIMARY, HA lease hay agent owner.
- Log đúng thứ tự các click/điều hướng/tải file, sự kiện thất bại, elapsed, lỗi; log hoàn toàn vắng mặt password/token/cookie, URL query, raw SKU/PL, raw path và response body.
- Test file: tải thành công, hủy, 403, gián đoạn mạng, download thiếu/0 byte, timeout, retry; không đánh dấu DONE khi thất bại, không tự xóa tệp người dùng.
- Test đóng/restart/crash: confirm còn hoạt động; log được flush best effort, chưa hoàn tất ghi `INTERRUPTED`, không báo thành công giả.
- So sánh baseline vs recorder idle/active (RAM/CPU, latency Confirm, WMS errors, Firestore read/write, CF request); không có request Cloudflare/Firebase mới phát sinh vì bản ghi log.
- Chỉ sau ZIP/field evidence mới phân tích thiết kế tự động hóa ngày: selector/nguồn file chuẩn, một Agent/ngày, readiness, xác nhận file, import conflict/chunk/idempotency/ACK/rollback.

## 5. Owner implementation gate

**Đang chờ Owner duyệt phương án tác động này trước khi chỉnh code.** Owner có thể chốt giới hạn `POC ghi log thủ công; Beta standby; không upload/cron/auto-click`. Sau khi duyệt: branch mới từ current main → PR → authority/continuity/Windows host+Agent build/security/regression PASS → merge → Agent prerelease Beta, thử standby và field review; KHÔNG promote primary hoặc Stable tự động.

Chỉ một change ID **D166**, không mở D167 và không coi technical PASS là Owner PASS.
