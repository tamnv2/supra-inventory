# D171-E020 — Kiểm toán kiến trúc Agent↔Agent↔PDA (19/10/2026)

> **PHÂN TÍCH/ĐỀ XUẤT, KHÔNG PHẢI OWNER CODE/DEPLOY PASS.** Accepted base: D169 limited; D170 paused without Owner PASS; D171 isolated testing active. This document does not authorize production Agent/Android, Firestore/RTDB Rules, WMS, Worker, new Google Functions, or Stable changes.

## 1. Quyết định Owner và đối chiếu source

| Quyết định nghiệp vụ | Mã/biên nhận hiện có | Mức chứng minh |
| --- | --- | --- |
| VPS là tài khoản Agent được xác thực, PRIMARY ưu tiên theo *account*, không theo checkbox/tên máy | D169-E056/E057, `FirestoreVpsReclaim.cs`, `FirestoreAgentLeaderCoordinator.cs`, Agent v138/v139 release | SOURCE/RELEASE; chưa xác minh thực địa VPS đầy đủ |
| VPS chỉ OTP email 4 số, không dùng mật khẩu cố định hay HHmm; admin/tamnv2 giữ cơ chế cũ, Office đi qua Gateway hiện hữu khi Worker không tới được | D169-E052/E054, `AUTH_RBAC.md`, Agent v137+ | SOURCE/RELEASE; không suy ra OTP/Gateway thực địa PASS |
| Admin/tamnv2 được chỉ định PRIMARY thủ công; VPS không ghi đè PRIMARY khỏe; sau 15 phút gửi lại đề nghị, một YES được xác thực/CAS mới chuyển | D169-E056/E057, `FirestoreVpsReclaim.cs`, Firestore Rules | SOURCE/RELEASE; phiên đăng nhập trực tuyến/Rules/WMS thực địa cần kiểm chứng |
| VPS fail → NEXT_A đủ điều kiện chiếm PRIMARY có generation/CAS + lease/fencing; không khẳng định phát hiện chết tuyệt đối trong phân vùng mạng | D169-E044/E046, `FirestoreAgentLeaderCoordinator.cs`, v136/v139 | SOURCE/RELEASE; mục tiêu 15s phụ thuộc đường điều phối thực sự còn hoạt động |
| PDA giữ duy nhất request_id qua failover, cùng Firestore job/ACK; 20s bình thường, 35s chỉ khi server đã cấp recovery proof; không WMS confirm trùng | D169-E044/E046, `RelayPocClient.kt`, `FirestoreConfirmationTransport.cs`, `D160ConfirmPipeline.cs` | SOURCE/RELEASE; real WMS + mixed network FIELD PASS chưa có |
| WMS chỉ xác nhận bằng trình duyệt có phiên thật; không click lại nếu sau final click outcome UNCERTAIN | D126/D169, `D160ConfirmPipeline.cs` | Thiết kế an toàn có mã; kiểm chứng positive outcome thực địa vẫn cần |
| Office/Internet dùng Firestore làm coordination authority, RTDB resource hiện chỉ HA liveness; Wi-Fi chuyển có kiểm soát, không ngắt inflight/PRIMARY | D168/D169, `D168NetworkRoute.cs`, `RtdbHaLiveness.cs` | SOURCE; Office gRPC/listener, Call/Kick và đổi mạng thật chưa chứng minh xuyên suốt |
| Owner muốn *hai chế độ*: VPS khỏe có đường PDA nhanh/tiết kiệm; VPS lỗi dùng một đường Agent↔Agent và PDA↔Agent chung, không đổi protocol thủ công theo SSID | D171-E018 | **OWNER DESIGN DIRECTION ONLY**; chưa cấp code/deploy, không đồng nghĩa đã duyệt RTDB business |
| D171 2 Agent + 1 PDA năm pha NORMAL/NORMAL, OFFICE/NORMAL, NORMAL/OFFICE, OFFICE/OFFICE, NORMAL/NORMAL | D171-E012/E013, isolated artifacts | Test binaries/emulator CI PASS; Owner field 5/5 NOT PASS |

## 2. Kiến trúc được đề xuất (không tạo provider mới)

- **Nguồn nghiệp vụ duy nhất:** Firestore job document/ACK/PDA request_id; Firestore roles/generation CAS/lease. Agent↔Agent là đồng bộ qua backend, **không** socket trực tiếp hai Windows hay chia quyền WMS qua peer network.
- **Normal VPS mode:** PDA ghi Firestore job, VPS PRIMARY đã xác thực + WMS-ready nhận qua gRPC Listen; REST exact/job query watchdog 10s lúc PDA active, 30s idle theo v139. RTDB chỉ HA liveness nếu chứng minh được và trong scope; **không** chuyển job/ACK sang RTDB.
- **Standby mode:** NEXT_A đã chiếm PRIMARY hợp lệ trên mọi mạng Office/NORMAL bằng Firestore REST + thế hệ CAS; Agent PRIMARY thay thế dùng **cùng Firestore job** và REST query có giới hạn trong cửa sổ khôi phục, không đổi Firestore/RTDB database của PDA. PDA 20/35s theo durable proof.
- **Agent universal coordination:** một API nghiệp vụ Firestore roles/lease/reclaim/audit dùng cả hai mạng. Listener gRPC được dùng tự động khi thực sự reachable; REST được dùng để điều phối ở chế độ suy giảm; không yêu cầu người dùng chọn giao thức. Không tắt kênh push urgent Call/Kick/Chat đến khi chứng minh REST phù hợp latency/usage hoặc có đường sự kiện đã được duyệt. Hành vi *tương đương* không có nghĩa mọi event phải thực hiện qua REST-poll 5s trên sáu máy.
- **Chuyển mạng:** local network-epoch, hủy/rebind listener/HTTP client/proxy khi tuyến thay đổi; fence tất cả mutation và inflight WMS/ACK, cấm tự đổi Wi-Fi khi PRIMARY có việc; không đoán tính khả dụng chỉ từ SSID; kiểm tra authenticated endpoint riêng sau reconnect. Một số item mới (network epoch lifecycle) hiện chỉ là đề xuất E015, không phải code đã triển khai.
- **Cloud Functions/Cloud Run:** chưa có tài nguyên kinh doanh/endpoint được chốt trong scope D171. Chỉ xem như phương án thay thế có đo lường nếu được duyệt đánh giá sau; thêm function **không xóa** chi phí Firestore và có thể tăng độ trễ/auth/operational complexity.

## 3. Tính khả thi và giới hạn

1. **Cao:** Tối ưu trực tiếp Agent v139 để bảo đảm network-epoch reconnect, giữ Firestore Listener VPS + REST độc lập và CAS/fencing; sửa theo evidence field.
2. **Cao có điều kiện:** Một Firestore authoritative model trên hai mạng nếu xác thực REST Office đầy đủ; nhưng Office gateway/proxy có thể lỗi riêng từng endpoint, không có cam kết tránh partition.
3. **Trung bình, bắt buộc test:** Hoạt động realtime Call/Kick/Chat và giao nhận 20/35s từ Office; REST-only polling phải cân bằng latency và read quota. Office gRPC Listen thực địa chưa PASS.
4. **Chưa đủ quyền/chứng cứ:** RTDB nghiệp vụ PickList, chuyển toàn bộ sang Cloud Function, hoặc yêu cầu mọi Agent dùng REST 5s. RTDB resource hiện bị ràng buộc HA-only; new resource/rules/security/usage cần Owner duyệt riêng.
5. **Không khả thi dưới phân vùng mạng hoàn toàn:** vừa bảo đảm failover chính xác <=15s, vừa tuyệt đối không có split-brain. Khi không chứng minh PRIMARY chết, fail-closed vẫn đúng.

## 4. Ước tính usage *không phải billing*

Theo D171-E019: 16h/ngày, 1.200 job, 6 Agent, ước tính tối thiểu 8.160 Firestore writes và 17.088–18.288 document reads (chưa tính toàn bộ overhead/số liệu nghiệp vụ khác). Một giờ fallback 3s so với VPS watchdog 10s làm tăng khoảng 840 reads trong giờ active; 16h fallback giả định 8h active/8h idle tạo 11.520 vs 3.840 minimum reads watchdog VPS (chênh 7.680). Nếu 6 Agent cùng REST-poll coordination 5s suốt 16h là 69.120 minimum reads, riêng phần này có thể vượt free quota 50.000/ngày. Các số đều giả lập; local HTTP counter và provider-billed reads không tương đương. Firestore Standard free tier chỉ trên một eligible database/project, 50k reads và 20k writes/ngày; quota chia cho tất cả dịch vụ liên quan.

## 5. Ba phương án và lựa chọn

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Giữ v139, chỉ đo số liệu | Không tác động production, có baseline | Không chữa mất listener sau đổi mạng, Office coverage chưa chắc | Bắt buộc làm baseline D171 |
| **B. Giữ Firestore, sửa lifecycle/conditional fallback có đo** | Bảo toàn request_id, WMS safety, ít thành phần và không đổi DB | Cần test Office proxy + listener, failure matrix và quota | **ĐỀ XUẤT CHỌN, chưa có code approval** |
| C. Tách RTDB business/Cloud Function trung gian | Có thể nhanh ở một số điều kiện | Ngoài scope hiện tại; thêm auth/rules, billing, đồng bộ giao dịch, failure modes | Không triển khai trước khi có chứng cứ phương án B thất bại |

## 6. Triển khai theo cổng Owner

**G0 — D171 test-only (đã có kit, FIELD FAIL/PENDING):** Hoàn thành đủ 5 pha, log sanitized từng Agent/PDA; phân biệt REST 200, gRPC stream, proxy, TLS, token refresh; thử ngắt primary thật/lỗi partition, hai ACK, false PASS và total provider billed read/write. Không sửa production từ kết quả chưa xác minh.

**G1 — Review implementation impact/Owner approval riêng:** Xác định chính xác base D169, production v139/vc114, regression: Firestore coordinator + realtime + transport + Wi-Fi lifecycle; không tự thay Worker/DO/Rules/Android/WMS khi chưa cần; chuẩn hóa success, SLA p50/p95, tối đa +2s normal-path, 15s suspect target khi coordination sống, 20/35s ACK, zero duplicate confirmation.

**G2 — Branch/PR, source tests, isolated tests:** Tạo matrix request→generation→WMS final-click→durable ACK; phiên gRPC/REST chuyển mạng, Office blocked/recovered, VPS return, manual holder consent, mixed version, night freeze, clock reset, token expiry, concurrency, quotas. CI authority + continuity PASS; source CODE READY không phải FIELD PASS.

**G3 — Canary scoped Beta sau Owner deploy approval:** Bản Agent độc lập và thứ tự compatibility hợp lệ, đo cùng khối lượng công việc trước/sau bằng Firebase billed metrics; staged standby rồi VPS, PDA chỉ khi protocol cần và đã duyệt, có rollback về release trước; Stable owner-gated.

**G4 — Nghiệm thu:** Owner xác nhận 2 Agent + PDA thật, WMS, kết quả ACK đúng và Google billing sau ca; D171 Owner PASS mới mở workstream tiếp theo theo chính sách serial; D170 vẫn paused khi chưa được Owner ra lệnh tiếp tục.

## 7. Không bị tác động nếu theo hướng B

Báo hàng PDA→Worker/InventoryCore, SQLite, Web/HR, SKU FULL/DELTA, Apps Script, Gmail OTP và Google Drive log không đổi business contract. Chúng vẫn cần regression tương thích/chia quota, không được suy ra là tách biệt hoàn toàn khỏi Android/Agent login hoặc session. Không triển khai Stable hoặc mở Firebase/RTDB business Rules.

Sources: `docs/OWNER_DECISIONS.md` D169-E044/E046/E052/E056/E057 & D171-E018; `docs/specs/AUTH_RBAC.md`, `docs/specs/ACCEPTANCE_TESTING.md`, `docs/D171_FIELD_LOG_ANALYSIS_2026-10-19.md`, `ops/change-continuity/D171.json` E019; `relay-agent/FirestoreAgentLeaderCoordinator.cs`, `FirestoreConfirmationTransport.cs`, `FirestoreD157Realtime.cs`, `FirestoreVpsReclaim.cs`, `D168NetworkRoute.cs`, `RtdbHaLiveness.cs`, `D160ConfirmPipeline.cs`, Android `RelayPocClient.kt`. CI/field release status from `ops/project-state.json`. Pricing cross-check: https://firebase.google.com/docs/firestore/pricing .
