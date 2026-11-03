# D173-E126 — Backlog Reporter: badge sai số và log chưa xác nhận Drive (03/11/2026)

## Authority, phạm vi, trạng thái

Owner yêu cầu **ghi nhận đầy đủ hai lỗi vào backlog D173**, chưa ra lệnh sửa code hoặc phát hành. Đây là **docs/state-only intake**, không phải CODE PASS, CI PASS, RELEASE PASS, FIELD PASS hay OWNER PASS. Phạm vi phân tích: Android **1291 Báo hàng vc124** (Reporter/Admin), các API Reporter và hệ thống runtime logs đang đăng ký. Agent165 đã có kỹ thuật release riêng ở E125, không bị thay đổi bởi backlog này. D172 OBPP1291 giữ độc lập **PENDING/HOLD**; Stable **OWNER-GATED**.

Hai lỗi mới được Owner báo lại ngày 03/11 sau nhóm sự cố lịch sử được Owner attested PASS tại E115 ngày 02/11. **Không sửa lại E115 hoặc suy diễn attestation lịch sử là sai**; mở bug/reproduction mới, cần FIELD xác minh sau khi sửa.

## D173-E126-01 — Badge bốn tab Reporter hiển thị sai/dao động

**Ưu tiên đề xuất:** P0 độ chính xác giao diện nghiệp vụ; **trạng thái:** BACKLOG / FIELD_FAIL_REPORTED / CODE_NOT_STARTED.

### Dấu hiệu thực tế (log được Owner chia sẻ, ngày 03/11)

- Video thực tế: số hiển thị ở góc tab Reporter nhảy không phù hợp danh sách/trạng thái thao tác theo phản ánh Owner.
- Reporter vc124 trên PDA Android: trong mẫu telemetry bounded có **105 `REFRESH_APPLIED`**, **46 `REALTIME_APPLIED`**, **68 `PENDING_BADGE_CHANGE`**, **10 `OVERDUE_BADGE_CHANGE`**, **3 `REFRESH_ERROR`**. Đây là **số lần ghi nhận callback UI**, không phải số liệu billing/định lượng sai lệch nghiệp vụ.
- Hai trạng thái được ghi gần nhau cùng **server_seq 42949**: frame REALTIME cho pending **4**, frame SNAPSHOT cho pending **2**. Chứng minh hai đường dữ liệu không đồng nhất ở cùng sequence quan sát; chưa đủ để tuyên bố một giá trị là dữ liệu nghiệp vụ thật.
- Trong bản log ngắn: `REPORTER_SNAPSHOT GET OK` 108 lần, `REALTIME_DELTA GET OK` 174 lần. Không coi mẫu ngắn này là usage provider; chỉ dùng khi khoanh vùng nguyên nhân. `compared_pending=-1` ở các frame không cung cấp đối soát chuẩn.

### Đọc source, cơ chế nghi vấn cần kiểm chứng

- `android/.../ReporterController.kt`: `refresh()` nạp dữ liệu `tryReporterSnapshot`, nhưng dùng `realtimeRevision` cục bộ để chặn một số snapshot đến muộn; không lưu/so sánh trực tiếp `revision.latest_seq` của snapshot với cursor sự kiện realtime đã áp dụng.
- `android/.../InventoryApi.kt`: `parseReporterReadModel()` chỉ giữ queue/recent/counters/overdue và **loại bỏ `revision.latest_seq`, `stream_epoch`, `view_revision`** sau bước validate; chưa có fence chung cho badge.
- `ReporterController.applyRealtimeEvents()`: cộng/trừ `queue_delta`, `overdue_delta`, `recent_counter` trực tiếp vào total cục bộ; `lastReporterEventSeq` được cập nhật theo delta nhưng không đồng bộ từ response snapshot. Khi áp delta có mốc khác snapshot hoặc replay/recover, tổng có thể trôi mặc dù danh sách được cập nhật bằng snapshot hiện tại của batch.
- `loadOverdue()` có fetch bất đồng bộ riêng và ghi đè `overdueTotal` khi hoàn tất; cần kiểm tra race với realtime/snapshot đến trong lúc mở tab.
- `recent` được lọc `APP_TODAY_OPEN` và theo `first_report_at` ngày VN; cần kiểm tra `recentCounts` và delta giữ đúng phạm vi ngày, đặc biệt quanh 00:00 và sự kiện từ ngày N-1.
- Phía Core `service/src/d173-snapshot-core.ts` tạo combined snapshot từ cùng một lượt lấy projection, có `revision.latest_seq`; `service/src/operational-v2-core.ts` trả delta global với snapshot batch trạng thái tại thời điểm đọc. Phải kiểm chứng khả năng **event cũ + batch snapshot mới + additive delta** gây lệch đếm; không được mặc định kết luận duy nhất tại thời điểm backlog.

### Hợp đồng xử lý đề xuất để Owner duyệt ở giai đoạn CODE

1. Chốt một **authoritative count baseline** theo cùng `stream_epoch`, `latest_seq`, timestamp ngày VN và view/scope; áp dụng snapshot nguyên khối cho bốn badge và các list/counter tương ứng; không lấy count từ số dòng đã phân trang 200.
2. Chỉ áp event `seq` thực sự mới hơn baseline; idempotent theo event/seq và version batch; cấm replay delta cũ sau snapshot/reconnect. Nếu thiếu coverage/cursor mismatch, gọi **bounded reconcile hiện hữu** chứ không cộng delta phỏng đoán.
3. Chặn response lazy Overdue cũ ghi đè `overdueTotal` mới; ưu tiên count chuẩn server và bảo toàn danh sách/scroll; hide badge khi nguồn chưa tin cậy thay vì hiển thị con số bịa.
4. Xác định rõ bốn badge: Đang xử lý = số batch pending hợp lệ; Quá hạn = số batch quá hạn theo chính sách hiện hành; Đã có hàng = HAS_STOCK ngày VN; Cho phép Skip = SKIP_ALLOWED ngày VN. Preserve OPEN tồn cũ/đóng batch 03:00 và chuyển ngày 00:00 hiện hành; không thay đổi nghiệp vụ.
5. **Không bổ sung per-tab polling, request/timer/Firestore write**; tái sử dụng realtime và combined snapshot; đo DO Requests/SQL Rows Read/latency thực tế trước/sau nếu phải sửa Worker.

### Test nghiệm thu đề xuất

- So cùng thời điểm, cùng `stream_epoch/latest_seq` giữa bốn badge và Core SQL projection; nhiều kết quả chuyển trạng thái liên tiếp phải cho đúng tổng (bao gồm 0), không có chớp số sai.
- Snapshot đến trước/sau delta, duplicate/event out-of-order, delta page, reconnect WS, epoch change, snapshot 200-row truncation, user mở/đóng Quá hạn trong lúc response còn bay, chính sách auto-skip bật/tắt.
- Chuyển 23:59:59→00:00 VN; batch N-1 pending vẫn hiện đúng, recent hôm trước không xuất hiện lại, 03:00 đóng batch đúng business rule.
- Tab và vị trí scroll không bị reset; không thêm request chỉ do đổi tab; đối soát video/field trên Newland NLS-MT90 và thiết bị khác nếu có.
- Regression Reporter/Picker/Web/Agent qua API và D172 isolation nếu thực sự thay đổi shared Worker/Core.

## D173-E126-02 — Reporter bấm Gửi log nhưng không xác nhận lên Google Drive

**Ưu tiên đề xuất:** P1 khôi phục observability; **trạng thái:** BACKLOG / FIELD_FAIL_REPORTED / ROOT_CAUSE_UNCONFIRMED / CODE_NOT_STARTED.

### Bằng chứng và mức chắc chắn

- Owner phải dùng **Chia sẻ** để trích log, thay vì nhận được log mong muốn trên Drive.
- Diagnostic trên PDA cho `validated_internet=true`, có **6 HTTP `LOG_UPLOAD|POST|OK`** trong cửa sổ đo; **không có `archive_status` tương ứng trong HTTP audit**, nên chưa biết 6 lần đó là `DRIVE_SYNCED` hay `DEFERRED`.
- Kiểm tra thư mục Drive Logs ngày 03/11 phát hiện các file Android scheduled từ những thiết bị khác. **Không đủ bằng chứng kết luận toàn bộ Google Drive hỏng hoặc Reporter đã upload thành công.** Không lưu user/device ID, Drive folder ID hoặc log nguyên văn lên repo public.
- `MainActivity.showSupportDiagnostics()` có hai nút riêng: **Gửi log** gọi `sendAndroidRuntimeLog` và **Chia sẻ** xuất văn bản Android qua ACTION_SEND; Chia sẻ không phải upload thành công.
- `MainActivity.uploadAndroidRuntimeLog()` chỉ prune journal nếu `archive_status=DRIVE_SYNCED`; với `DEFERRED`, UI thông báo “Đã lưu log hệ thống; Drive sẽ tự tiếp tục gửi”. Điều này chưa phân biệt tiến trình đang retry thực tế với log chỉ đang chờ archive.
- `service/src/runtime-logs.ts`: ghi dữ liệu vệ sinh vào InventoryCore `runtime-logs/upsert` trước; nếu thiếu cấu hình thư mục, OAuth/Drive hoặc upload Google lỗi thì có thể trả **HTTP 200 + `archive_status=DEFERRED`** sau khi mark `last_drive_error`. Cron `retryBufferedRuntimeLogArchives` cố gắng archive sau; phải kiểm tra trạng thái runtime từng log/bundle để xác nhận root cause.
- `AndroidSupportLogResponder.sendDaily` giữ payload theo slot và chỉ xóa sau Drive receipt; `D171DailyLogWorker` có tối đa ba retry 15 phút rồi chuyển cho slot tiếp theo. Không mặc định các retry đã thực thi khi thiết bị bị Doze/offline.

### Phương án điều tra và sửa đề xuất (chưa được duyệt CODE)

1. Đối soát theo **bundle_id/log_id** đã ẩn danh tại Core: `buffered`, `DRIVE_SYNCED`, `DEFERRED`, `last_drive_error` (mã đã allowlist); phân biệt lỗi cấu hình thư mục, OAuth token bị thu hồi, quyền folder, Google API 401/403/429/5xx, timeout và API nội bộ. Chỉ tổng hợp mã lỗi; tuyệt đối không đưa access/refresh token, payload nghiệp vụ, user/device ID vào repo/log.
2. Với nút Gửi log: phản hồi UI 4 trạng thái **Đang gửi / Đã lưu trên Drive / Đã lưu tạm chờ Drive / Gửi thất bại còn giữ log**. Chỉ báo hoàn tất khi receipt `DRIVE_SYNCED`, không coi HTTP 200 là Drive PASS.
3. Dùng **bundle_id idempotent** và retry theo lịch/bounded job đang tồn tại; không thêm vòng lặp riêng gây DO Requests. Không xóa journal hoặc pending bundle khi chỉ `DEFERRED`; tránh ghi trùng vô hạn. Xem xét ranh giới việc không mất dữ liệu sau logout, WorkManager/doze và restart.
4. Nếu lỗi hoàn toàn phía Provider/Cloud phải sửa chính xác đường archive/config đã đăng ký, không tạo Drive/Worker/secret mới hoặc lưu OAuth bí mật vào code. Tách rõ `InventoryCore buffered` và `Drive archived` khi hiển thị Web Nhật ký.
5. Giữ nút Chia sẻ như kênh hỗ trợ khi cần; không coi là luồng lưu trữ chính.

### Nghiệm thu đề xuất

- Từ một Reporter thiết bị thật, manual và scheduled log được lưu InventoryCore, sau đó xác minh file Drive thực + receipt `DRIVE_SYNCED` đúng bundle, không trùng.
- Lỗi mạng/timeout, expired OAuth/403, 429/5xx, Drive folder thiếu cấu hình: không báo thành công sai, không mất journal, retry hữu hạn, có mã lỗi đủ khoanh vùng nhưng không lộ thông tin nhạy cảm.
- Logout/kick/đổi phiên/thiết bị ngủ: không tự prune khi không có receipt; hoàn tất sau phục hồi có thể đối soát chính xác.
- Không phát sinh request thường trực; so sánh usage trước/sau. Chỉ tác động Worker/Core nếu có root cause và phải chạy full D172 regression.

## Ưu tiên, phụ thuộc và release gate

| Hạng mục | Severity | Next action | CODE | CI | RELEASE | FIELD | OWNER PASS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E126-01 Badge | P0 đề xuất | Thiết kế sequence-fence & test fixture đối soát Core | NOT_STARTED | NOT_RUN | NOT_AUTHORIZED | FAIL_REPORTED | PENDING |
| E126-02 Drive log | P1 đề xuất | Truy dấu archive_status/last_drive_error không tiết lộ secrets | NOT_STARTED | NOT_RUN | NOT_AUTHORIZED | FAIL_REPORTED | PENDING |

**Chưa phê duyệt code hay phát hành:** Owner mới yêu cầu **đưa vào backlog D173**. Khi cần thực thi: trình Owner phạm vi tác động, fixture parity, regression/usage/security, lấy lệnh CODE riêng; sau đó PR + exact-source CI; release riêng theo lệnh Owner, kiểm tra FIELD/OWNER thực tế. Không trộn thay đổi này với E125 Agent165 hay D172 standalone, không mở Dxxx mới.
