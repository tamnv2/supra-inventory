# D169 — Rà soát log 12–18/10, xung đột và kế hoạch phát hành hợp nhất

**Trạng thái 18/10/2026:** SOURCE + DRIVE CHECKPOINT EVIDENCE REVIEW; **CONFLICTS CONFIRMED — AWAIT OWNER INTEGRATED DESIGN PASS**. Chưa CODE READY, chưa Field PASS, chưa được triển khai EXE/APK mới. Thuộc D169 còn mở; không tạo Dxxx mới. Stable OWNER-GATED.

## 1. Authority và phạm vi
- Main canonical: `ops/authority-manifest.json`, complete bootstrap_order, `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, relevant specs, scope + registry. Accepted base D168 limited Owner PASS; D169 chưa Owner PASS.
- Main đã phát hành Agent Beta v135 (PR610) để sửa v134 giao diện tab, CI 18/18 PASS nhưng thiếu field nghiệm thu. Web/Worker Beta đã triển khai một số thay đổi D169; không mặc định lại phát hành Worker.
- PR606 đang **Draft**, head trước phân tích `48a11e23c185afd85e85604f0aff1d83c066a3ff`, GitHub báo `mergeable=false`; compare với main `1a2bbae7...` là `diverged`, **53 ahead / 61 behind**. PR606 chứa Android `CriticalOverlayService` / `MainActivity`, Agent `D167SkuCoordinator`, CI + docs/spec/state; **không có mã implement** VPS-priority/HA 15s/new PDA reason-code/SSID-wide controller. Không merge/release PR606 trực tiếp.
- Scope dữ liệu 7 ngày: `Inventory/Beta/Logs/YYYY-MM-DD` cho 12–18/10, danh sách folder truy vấn; ngày 12 có 76, 15 có 18, 16 có 7, 17 có 12, 18 có 6 tệp; ngày 13/14 có >=100, API listing legacy may truncate. Đã đọc các log checkpoint/manual trọng điểm từng ngày và đối chiếu bản tổng hợp D169 15–16/10; **không được gọi đây là phân tích nội dung toàn bộ hàng trăm file**. Trong thư mục daily Agent này không tìm thấy tên file Android/Web. Một số checkpoint/session là cumulative/chồng ngày, không cộng như tệp độc lập.
- Mọi bộ đếm `D166_USAGE_AUDIT` là **AGENT_ESTIMATE_NOT_BILLING**, có reset theo process; không thể coi là Firebase billed-by-collection hay tổng một ngày.

## 2. Chứng cứ định lượng từ từng file kiểm tra
| Ngày/file đại diện | Agent estimate Reads/Writes | Chỉ số nổi bật | Kết luận giới hạn |
|---|---:|---|---|
| 12/10 checkpoint Agent | 5.525 / 1.552 | 1.360 extra legacy alert docs, 985 PRIMARY lease writes, 2.234 CONFIRM_QUERY | Nền HA + query kể cả ít Picklist |
| 14/10 checkpoint Agent | 13.504 / 3.222 | 8.279 extra legacy docs, 2.153 lease writes, 2.590 CONFIRM_QUERY; SKU defer nhiều | Legacy alert query và chu kỳ điều phối rất nặng |
| 15/10 checkpoint Agent phụ | 3.751 / 126 | 3.258 PRIMARY_LEASE_READ, còn takeover DEFER khi primary different | Theo dõi PRIMARY qua fallback không nhẹ |
| 16/10 checkpoint Agent | 12.621 / 2.864 | 7.524 extra legacy docs, 2.203 lease writes, 784 lease reads, 2.245 CONFIRM_QUERY | Mixed network và legacy cùng góp chi phí |
| 17/10 manual Agent | 3.125 / 241 | 2.079 extra legacy docs, 540 CONFIRM_QUERY, 34 terminal ACK writes | Nhiều read không tương ứng số ACK |
| 18/10 VPS đến ~07:53 | 4.531 / 1.070 | 3.168 extra legacy docs, 999 PRIMARY lease writes, 974 CONFIRM_QUERY, 7 ACK writes; 997 RTDB_HEARTBEAT HTTP401 | VPS lỗi RTDB gây fallback Firestore, tải nền rõ |
| 18/10 ADMIN-PC đến ~07:53 | 1.605 / 25 | 1.438 PRIMARY_LEASE_READ, 309 RTDB SSE timeout, 314 connected | NEXT_A quét lease liên tục dù rất ít writes |

Các file trên có các ID Drive của Beta nội bộ, không chép raw nhật ký, UID, Wi-Fi SSID, thông tin Picker hay credentials vào public GitHub. Các file logs lớn là snapshot tích lũy, không cộng bảng này thành tổng 7 ngày. Ngoài ra 16/10 Agent liên tục `takeover=DEFER evidence=UNVERIFIED_PRIMARY_LIVENESS` (3.112 dòng trong một checkpoint), 14/10 cũng có 509 DEFER trong checkpoint được đọc. Đây là tín hiệu **không tự chuyển được** khi RTDB Office không khả dụng; không đồng nghĩa 3.112 lần server CAS thất bại.

Log SKU: 17/10 DELTA_12 12:02 DEFER vì WMS export timeout, 12:17 DONE (receipt); 16/10 nhiều `D167_WORKER_UNAVAILABLE_NO_SAFE_SWITCH` mỗi 15 phút, và `D167_NETWORK_PROFILES_NOT_APPROVED`, `D167_WORKER_TIMEOUT`, `D167_LOST_PRIMARY`; 18/10 VPS INITIAL_05 DONE, 2.548 SKU. Không viết lại luồng SKU đã DONE: vá chỉ nhánh lỗi cùng network/HA.

D169 backlog phân tích 15/10 có 491 job terminal đã ACK tại checkpoint, 444 CONFIRMED/ALREADY_CONFIRMED, 47 outcome khác; 47 không đồng nghĩa lỗi và việc này không chứng minh mọi PDA đều đọc được ACK. `RESULT_ACK_NOT_FOUND` của overlay *Báo hàng* là luồng khác PDA↔Worker/DO, không lẫn vào phạm vi nghiên cứu Picklist PDA↔Agent; nhưng cùng APK nên phải kiểm thử hồi quy khi đóng gói.

## 3. Các xung đột bắt buộc giải quyết trước code+deploy toàn hệ
1. **HA cross-network**: Source current PRIMARY RTDB heartbeat 10s, NEXT_A Office RTDB SSE/GET thất bại nên lặp Firestore GET và khi lease stale lại `RTDBPrimaryProbeStatus.UNAVAILABLE` => **DEFER takeover**, không đạt mục tiêu Owner 15s. Một network partition không cho phép chứng minh death tuyệt đối. Yêu cầu nguồn liveness/firestore authority thống nhất có CAS + generation/fencing; single standby active và không giả định Office Firestore gRPC listener hoạt động khi V3 mới PASS REST read.
2. **Job deadline xung đột**: `FirestoreAgentLeaderCoordinator.FailoverAfterMs=15000`, `D160CanStartMutation` chặn WMS mutation sau khoảng 12s, `FirestoreConfirmationTransport.MaxPendingAgeMs=20000`, Android `RelayPocClient.TOTAL_WAIT_MS=20000`. Nếu VPS chết sau PDA gửi, cùng request có thể hết quyền mutation **trước khi takeover**. Phải thiết kế tuổi request/phân kỳ normal-vs-confirmed-failover và guard chống double confirmation, không tự tăng timeout UI riêng lẻ.
3. **Sai/thiếu ACK reason**: Agent `WMS_SESSION_REQUIRED` terminal ngay, checkbox recovery `CONFIRM_CONFLICT` generic; ACK gửi lookup_status nhưng không có stable reason-code, PDA `PickerController` coi chỉ `CONFIRMED` thành công (thiếu `ALREADY_CONFIRMED`), thiếu UI `WMS_DATA_UNAVAILABLE`/`LOOKUP_ERROR`. WMS button `Xác nhận lấy lại hàng` là nút hành động chứ không phải business-proof. Không kết luận đã xác nhận từ nút/checkbox disabled/row disappearance. Cần WMS/guard positive evidence và UNCERTAIN nonretry sau final-click.
4. **Office/Internet policy**: `D168NetworkRoute` hiện chỉ lưu Internet approved WLAN, local test/probe Worker; không có classifier Office/NORMAL thống nhất cho HA/chat/call/kick/log/SKU. `D168SkuNetworkUi` có timeout consent 60s nhưng popup chỉ sau `NETWORK_UNREACHABLE`, preexport và PRIMARY/Confirm-ready guard. Auto switch PRIMARY đang xử lý Picklist tạo mất ACK; cần handoff hoặc postpone. Kick user hiện Worker endpoint Office không khả dụng trong V3; phải cảnh báo và xử lý auth/busy/restore, không fake success.
5. **PR và release overlap**: PR606 **không mergeable**, 53 ahead/61 behind so với main mới; Android code-only gồm bắt buộc update Beta, overlay scroll/orphan, Agent SKU retry. Main v135 WinForms tab runtime chưa Owner Field PASS; cập nhật tất cả Agent cùng lúc gây mất dự phòng. Không bỏ hoặc ghi đè hạng mục code done khi chuyển nền. D169 hàng đã triển khai Web/Worker và Agent v135 phải giữ, tránh regression.
6. **Scope boundary**: PDA↔Agent Confirm/chat/call/kick/presence/HA là phạm vi code business này, còn báo hàng PDA↔Worker/Service là regression-only, không âm thầm đổi giao dịch/lifecycle/overlay. `PR606 CriticalOverlayService` ảnh hưởng reporter result/chat cùng APK nên test cần thiết nhưng không phải thay đổi thiết kế nghiệp vụ báo hàng.
7. **Quyền và manual override**: Existing `PromoteManualPrimary` kiểm tra login admin/tamnv2; chưa có persistent manual holder lock, 15-minute VPS return consent/snooze. Không auto preempt quyền thủ công bằng logic số ưu tiên đơn giản.

## 4. Thiết kế tích hợp đề xuất chờ Owner chốt
- Agent VPS là preferred PRIMARY khi Firebase + thực trạng WMS Confirm healthy, không tự login/vượt CAPTCHA. Firestore `roles + generation CAS` vẫn là trọng tài duy nhất. NEXT_A liveness duy nhất trên đường Office đã chứng minh REST; NEXT_B và deeper standby ngủ hoặc nghe sự kiện role. Không ping Worker/RTDB vô ích khi SSID known Office. Điều kiện 15s là mục tiêu đo được trong tình huống đường điều phối hoạt động; không bảo đảm tuyệt đối khi mất mọi kết nối.
- VPS trả quyền sau cửa sổ stable 30s **đề xuất**, chỉ safe handoff/drain. Nếu PRIMARY do admin/tamnv2 chọn thủ công, VPS gửi notice tối đa 15 phút/lần; không auto takeover khi holder còn tốt. Khi manual holder hỏng, đề xuất failover khẩn cấp với audit mà không xóa lý do manual; cần Owner chốt.
- Giữ PDA exact same request_id, một durable terminal ACK, không dùng outbox offline; khi failover có server evidence, cho phép một khoảng recovery budget riêng (đề xuất 35s PDA wait **chỉ khi server đã xác nhận takeover**, chưa chốt), cập nhật cả WMS mutation fence/MaxPendingAge/ACK retain; không mở cửa duplicate WMS mutation; trạng thái PDA trung thực và có mã reason rõ.
- Wi-Fi known SSID Office/NORMAL qua cấu hình local (VPS Ethernet/Unknown riêng). Chọn lộ trình theo tính năng và thời điểm hành động, không do chủng loại Wi-Fi tự quyết định quyền PRIMARY. Revoke/Kick cần Worker Internet, show consent trước khi chuyển; scheduled SKU chỉ có thể auto-switch sau 60s khi đã approved profile và không có confirm/inflight/critical HA; nếu busy defer, không giật Wifi PRIMARY. Sau complete restore profile + verified reachability; không giả DONE nếu không có receipt.
- Usage first: loại query `picker_alerts` legacy không có consumer trong reconciliation nhưng giữ chat/FCM path; dừng retry RTDB Office/401 storm; normalize HA liveness path; bỏ lặp query no-op/cooldown có bằng chứng; đo reads/writes by collection + p95/p99 và WMS failover. Không hứa % tiết kiệm khi chưa có provider meter.

## 5. Phân tầng triển khai an toàn nếu Owner đồng ý
A. **Nền/hợp nhất PR:** từ main v135 tạo nền D169 tích hợp mới, cherry-pick/vet đúng thay đổi đã code trong PR606; giải quyết CI, release version và docs/state, không rewrite v135 Beta assets. Không merge PR606 stale.
B. **HA/transport:** repair VPS preferred + Office Firestore liveness + manual override; unit/simulation crash, split-brain, generation competition, old/new peer fencing, verified standby.
C. **PDA/ACK:** Android Picker ↔ Agent schema compatibility/STALE/UNCERTAIN/ALREADY_CONFIRMED, live failover same job, 12/15/20s mismatch, user-visible localized reasons; test release mix.
D. **Wi-Fi/router + usage:** local SSID classification, route matrix, non-blocking kick prompt, SKU safe 60s switch, remove unused picker_alert query, bounded retry and measured quota.
E. **CI+staged release:** authority/continuity PASS and Windows Agent/Android tests before merge; Beta rollout staged standby -> VPS/PRIMARY -> PDA, rollback per component, only once field verify both network types/cross-network and v135 browser tabs. Do not mass switch all Agents before verifying mixed-version negotiation. Stable untouched.

## 6. Chưa có cơ sở / không tự triển khai
- Office gRPC Listen/Write/peer ACK/FCM physical proof: V3 only authenticated Firestore REST reads, so listener as core Office HA awaits field proof. Fall back to measured REST watcher if necessary; server side CAS remains mandatory.
- 15-second **hard** guarantee when Firestore itself partitioned: mathematically unprovable without additional independent, registered, verified reliable channel. Keep safe uncertainty and notify.
- WMS exact 'already confirmed' indicator for checkbox-disabled scenario: need specific semantic DOM/WMS positive signal captured safely; action button text alone not proof. Do not false CONFIRMED.
- Attribution of all Firestore billed operations/Cloudflare/Drive/Apps Script and precise savings: provider per-collection meter at comparable volume not in these logs.
- Web/Service Báo hàng overlay/Result ACK, Admin RBAC, unrelated HR, broader provider migration, captcha automation explicitly cancelled: remain separate D169 backlog/evidence or defer, do not silently absorb in PDA↔Agent.

## 7. Owner quyết định cần có trước khi triển khai đồng loạt
1. Chấp nhận target **≤15s detection on healthy authority network**, not impossible guarantee across every physical partition, with generation/CAS safety prioritized.
2. Chấp nhận recovery-only wait candidate **35s** (or nominate ceiling) aligned Agent/PDA job/ACK, while normal confirmation targets unchanged.
3. Chấp nhận VPS emergency return on manual PRIMARY truly dead, but respect manual lock while healthy and 15-minute prompt/snooze.
4. Quy trình phát hành theo giai đoạn thay vì cùng lúc (đồng nhất **cuối cùng**, không đồng loạt cắt dịch vụ), Field PASS before advancing, Beta only.
