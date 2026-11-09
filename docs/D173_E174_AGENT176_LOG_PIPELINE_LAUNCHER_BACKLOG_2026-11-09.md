# D173-E174 — Agent176 focus remediation; thống nhất log pipeline; Launcher backlog (09/11/2026)

## Owner instructions, scope and release boundaries
1. **Launcher migration** (khóa biểu tượng app cho tới khi xác nhận MNV, liên kết MNV ↔ DeviceKey/serial, danh sách PDA theo phiên Launcher, Agent gọi/chat tại Launcher): **D173 BACKLOG / HOLD, NOT CODE**. Không sửa repo độc lập `tamnv2/supra-pda-launcher`, không thêm Firebase rules/collections hoặc chuyển nguồn presence hiện hành.
2. **Inventory scheduled logging**: Owner yêu cầu rà soát tất cả Agent/Android/Web/Worker, loại bỏ logic cũ và thống nhất pipeline 10 slots. Phần dưới là **đề xuất thiết kế chuẩn để Owner review**; không đánh dấu `CODE_DONE`/production cho thay đổi logging khi chưa có bản code/test đã kiểm tra. Đợt này không thay Worker/Web/Android đang chạy.
3. **Windows Agent focus**: Owner phê duyệt sửa và yêu cầu chạy CI/phát hành Agent mới (176). Phạm vi duy nhất `relay-agent/`, workflow phát hành, gate, tests và authority docs. Không đổi Host13, WMS automation, xác nhận PickList, FCM, business state, Worker/DO, Web, Android, D172, Stable.

## Chứng cứ thực địa — Drive 08/09/11
- Thư mục `2026-11-09`: **54** file Android Báo hàng vc127, trong đó 28 `reason=session_end_logout`, 26 `reason=global_support_request`, không có file `reason=scheduled_*` trong mẫu Drive; 32 device identifiers khác nhau. Hai file `obpp1291` tách biệt; **không đưa D172 vào chỉ tiêu Báo hàng**.
- Tên file `scheduled_android_*` không có nghĩa là lịch định kỳ thực thi: `runtimeLogKind()` trong `service/src/runtime-logs.ts` trả `scheduled` cho mọi INFO trừ reason có từ `manual`, kể cả logout và hỗ trợ.
- Các mẫu Android có `journal.dropped_events > 0`, cao nhất 1.913; không tuyên bố toàn bộ lịch sử còn nguyên.
- Nguồn: Drive ngày 08/11 `19Aju_MbfXTIziAZitNW3g2eXGGo6D-Hq`; ngày 09/11 `1SoOTALKCnbmJsp1WiKyYevbt0idST0Mm`. Đây là **Drive receipts**, không phải dump toàn bộ Core pending/hàng chờ thiết bị.
- Agent: luồng `Program.cs` timer 1s → `RefreshSupraBrowserStatus` → `SizeEmbeddedWmsViewport` → `TryEmbedAgentWindow` có `MoveWindow` và `ShowWindow(SW_SHOW)` mỗi vòng. Kết luận tương quan mạnh, chưa có OS foreground hooks để xác nhận nguyên nhân FIELD.

## Rà soát mã nguồn ghi log hiện tại (đang vận hành)
| Surface | Hiện trạng | Điểm cần làm sạch |
| --- | --- | --- |
| Android | `D171DailyLogWorker.kt` WorkManager 10 slots, network-required, retry tối đa 3 rồi `success`; nếu không còn InteractiveSession thì `success` | Không được đánh dấu slot hoàn tất khi không tạo/đẩy bundle; không phụ thuộc session sống để bảo toàn bằng chứng đã seal; retry xuyên phiên và qua ngày |
| Android | `AndroidSupportLogResponder.kt`: `d171_daily_payload_${userId}_${slot}`, retry logout queue riêng | Hợp nhất pending sealed scheduled/logout/support, giữ immutable IDs; drain theo FIFO/bounded, ACK `DRIVE_SYNCED` thực; lỗi có reason code |
| Web | `web/src/runtime-logger.ts`: 10 slots; `CORE_STAGED` là ACK bền đủ để Web dọn journal | Giữ phân biệt `CORE_STAGED` và `DRIVE_SYNCED`; không mô tả `CORE_STAGED` là đã lưu Drive; browser đóng không cam kết chụp log |
| Agent | `AgentLogUploadBridge.cs`: 10 slots, local pending files, 15m backoff, `DRIVE_SYNCED` purge | Chỉ một queue chung cho tự động/thủ công/lỗi, tránh bundle trùng; không tăng nhịp upload hoặc tạo chuỗi phụ |
| Service | `runtime-logs.ts` đưa trước vào InventoryCore và thử Drive; `runtime-logs-core.ts` buffer idempotent; `d173-background-worker.ts` giữ nhịp cron 5m, drain 30m | Sửa phân loại reason, trạng thái server ack, chống duplicate, retention và kiểm kê tồn đọng theo thiết bị/slot |
| D172 | OBPP1291 dùng chung hạ tầng | Không đổi code/metadata business và vòng đời D172; chạy regression shared handler nếu chạm Worker |

## Thiết kế log pipeline mới — PROPOSED, CHƯA OWNER DUYỆT CHI TIẾT

### 1. Scheduler là nguồn lịch duy nhất
10 mốc Việt Nam mỗi ngày: `00:00, 06:00, 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00`. Deterministic jitter 0–10 phút theo `device/session + business day + slot`, không thay đổi nghiệp vụ realtime. Một slot trên một thiết bị chỉ tạo tối đa một **checkpoint logic**; hai login trên một PDA không được biến cùng slot thành hai bản ghi trái phép. Android Doze/offline: ghi `DUE/DEFERRED`, không tuyên bố đã gửi tại chính xác thời gian.

### 2. Unified seal / outbox
Một `LogCheckpoint` gồm `source, device_key, session_ref (redacted), local_day_vn, slot_id, generated_at, sequence_first/last, reason, bundle_id, payload_hash, archive_state, retry_after`. Ghi journal liên tục ở local, phân đoạn bounded lưu đến khi đã ACK; quá ngưỡng phải ghi rõ `dropped_events`/truncated, không im lặng mất lịch sử. `bundle_id` tạo một lần, không đổi nội dung khi retry. Duy nhất một sender/queue mỗi thiết bị, ưu tiên critical/manual trước scheduled, không tạo thêm timer/network request per event.

### 3. Chính sách trước logout/kick
Ngay trước revoke session: seal checkpoint cho phiên cũ và lưu auth-scoped evidence; không đợi scheduler chạy sau logout. Retry cần thông qua API xác thực hợp lệ/đúng actor và quyền, không cho user mới đọc/gửi payload user cũ một cách trái phép. Nếu phiên cũ đã hết và chưa được server stage, giữ encrypted local pending đến khi có đường recovery được ủy quyền; không giả thành công.

### 4. State machine và idempotency
`LOCAL_SEALED → SUBMITTING → CORE_STAGED → DRIVE_SYNCED → PRUNED`.
- `CORE_STAGED` = đã bền trong InventoryCore. Web có thể dọn local theo quyết định E167; Android giữ local theo E167 tới `DRIVE_SYNCED` nếu không thay đổi Owner contract.
- `DEFERRED`/timeout = giữ pending, retry sau 15 phút với jitter, backoff có giới hạn; quá số lần thử trong slot vẫn pending sang slot/phiên/ngày tiếp theo, không `Result.success()` theo nghĩa đã hoàn tất.
- Service dùng `bundle_id` + content digest để chống duplicate; cùng ID nhưng khác payload phải reject; khi Drive đã lưu thì trả đúng receipt, không upload file lần hai.
- Phân loại sự kiện theo **reason thật**: `scheduled_slot`, `manual`, `global_support_request`, `session_end_logout`, `critical_error`, `server_housekeeping`. Filename category và dashboard phân biệt; dữ liệu cũ giữ truy xuất.

### 5. Điều phối và usage
- Agent/Android/Web vẫn upload qua API có sẵn; Web đã `CORE_STAGED` thì Worker drain Drive 30 phút theo cron 5 phút hiện hữu, bounded 20 items/run. Không tạo Durable Object/Firestore listener/read/write trên mỗi event. 40 PDA+5 Agent+5 Web ×10 = tối đa 500 **slot attempts**/ngày khi toàn bộ đều hoạt động ở mọi mốc (chưa tính retries/logout/critical).
- Android backfill **không** tự fanout 10 request ngay khi khởi động; drain theo thứ tự có nhịp, retry bounded và idempotent. Core buffer có retention/alert khi queue gần tràn.
- Agent diagnostics ghi safe reason codes `DUE/SEALED/STAGED/DRIVE_SYNCED/RETRY/EXPIRED`, không ghi token, MNV, PID/HWND/raw WMS session vào repo public.

### 6. Kiểm chứng trước phát hành log model
- Test cả 10 mốc đúng VN/cross midnight; ở 14:00/22:00 logout trước/sau WorkManager; mất Wi-Fi, Doze, kill app, reboot, mất phiên, đổi user/thiết bị, crash giữa stage/ACK; tiếp tục sau 24h, content digest idempotency.
- Web đóng/offline; Agent tray/restart, manual log + scheduled cùng lúc; Service Drive quota 429/503 và 30m drain; không xóa local trước đúng ACK.
- Đối soát mỗi `device×day×slot` theo 4 cấp `DUE/SEALED/CORE_STAGED/DRIVE_SYNCED` với real Drive file IDs; đánh dấu `PARTIAL/UNATTRIBUTED` nếu chưa đủ. Chạy D172 shared Worker/API negative regression.
- Release Android/Web/Worker/Agent theo thực tế các component có code thay đổi, signed OTA và source-pinned CI; **không gộp vào Agent176 focus-only**.

## Agent176 code change scope / regression
- `Program.cs` chỉ gọi embed khi Form đang hiển thị, không minimized, tab WMS thực sự selected và viewport visible.
- `SupraConfirmBrowser.cs` bỏ `MoveWindow/ShowWindow(SW_SHOW)` mỗi status tick; chỉ resize/reveal khi cần bằng `SetWindowPos(NOACTIVATE, NOZORDER, SHOWWINDOW)`. Show chủ động của Host cũng không kích hoạt foreground.
- Browser Host13, authenticated WMS profile, 1-instance, tray preserve, confirm/ACK, quota counters không thay. Signed release phải qua Agent native CI, source tests, D172 isolation, exact Owner+SHA gate. **CODE ≠ CI ≠ RELEASE ≠ FIELD ≠ OWNER PASS.**
