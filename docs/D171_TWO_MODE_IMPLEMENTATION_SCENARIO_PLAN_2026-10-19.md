# D171-E022 — Kế hoạch thay đổi hai chế độ Agent ↔ Agent ↔ PDA (Owner duyệt phương hướng, chờ duyệt code)

Ngày: 2026-10-19 (VN). **Trạng thái: BUSINESS ARCHITECTURE SELECTED; SCENARIO DESIGN FOR OWNER REVIEW; NO PRODUCTION CODE/DEPLOY AUTHORIZATION.** D171 active isolated test, D170 paused/no Owner PASS, accepted base D169 limited, Stable OWNER-GATED.

## 1. Đầu vào Owner chốt
- 40 PDA trên mạng thường; 6 Agent tổng bao gồm VPS; 2.000 PickList/ngày; 200 Kích User, 300 Gọi chuyên viên, 500 Chat/ngày; thông tin Agent ít quan trọng đồng bộ 10 phút/lần; lịch sử/trạng thái trung gian tối đa 5 phút (không xóa durable ACK, audit, business history); SKU hiện hành không đổi.
- Mục tiêu bảo đảm tải tối đa ở <=90% free usage của từng dịch vụ đủ điều kiện, không dừng nghiệp vụ thiết yếu để ép dưới quota. Số đọc/ghi là ước tính, không phải provider-billed; muốn cam kết không quá 100% phải có billing evidence và chính sách dự phòng do Owner đồng ý.
- Hai chế độ: (A) VPS mạng thường là PRIMARY lâu dài, PDA qua Firestore exact job + realtime listener nhanh tới VPS; Agent↔Agent trên Office/Internet dùng một hợp đồng Firestore chung, HTTP qua Windows System Proxy trên Office; (B) VPS không WMS-ready/crash/mất quyền, Agent thường hoặc Office chiếm PRIMARY qua Firestore CAS, xử lý cùng Firestore job/ACK từ PDA, không đổi app/database/request ID.
- Google Cloud Functions **chỉ là ứng viên được Owner lựa chọn để bổ sung chọn lọc** cho lệnh Agent Office cần gọi Cloudflare Worker; không là phụ thuộc của PickList/HA, và cần phê duyệt tài nguyên Rules/auth/cost/release riêng trước khi tạo hay triển khai. Không chuyển PickList/ACK sang RTDB; RTDB hiện HA-liveness-only.
- Không còn điều kiện dựng lại bộ test mạng thực địa; dùng chứng cứ D171 cũ và kiểm thử mô phỏng, CI, phát lại log; chỉ sử dụng quan trắc thụ động/canary khi được duyệt triển khai. Không suy diễn Field PASS.

## 2. Hợp đồng / routing
| Hợp đồng | Chủ sở hữu và kênh | Quy tắc |
| --- | --- | --- |
| Identity/RBAC/OTP | Worker+InventoryCore là business authority; Firebase issued identity cho coordination; Gateway hiện hữu hoặc Function (chờ scope) là vận chuyển | VPS OTP-only; admin/tamnv2 giữ OTP/emergency hiện hành; HTTP 401/403 terminal, không bypass |
| PDA PickList | Firestore relay_poc_jobs/<request_id> duy nhất (PDA Internet) | 1 create, ACK duy nhất, recovery 20s bình thường / 35s chỉ khi được cấp grant hợp lệ; không tạo ID mới |
| PRIMARY | Firestore roles+generation/lease CAS và WMS readiness | lease 10s, stale 15s là tiêu chí nghi ngờ, không đủ chứng minh chết khi partition; một executor duy nhất |
| VPS fast mode | VPS PRIMARY Firestore gRPC pending LISTEN, REST watchdog độc lập | không phụ thuộc RTDB business, nếu gRPC không khỏe thì REST có giới hạn, không block WMS sau slow REST |
| Agent Office/Internet | Firestore REST HTTPS authenticated, chọn direct/proxy tự động bằng reachability/route epoch; gRPC chỉ khi thực sự hoạt động | không đổi giao thức bằng tay; no burst fleet-wide fast polling |
| Kích User | Worker authoritative session revoke; Agent Office cần server-side secure command path | Firestore command→ Function kiểm tra và chuyển Worker là **đề xuất cần cấp quyền riêng**, ACK chỉ khi Worker xác nhận |
| Gọi/Chat | Firestore/PDA control + logic hiện có, FCM nếu đã có | Giữ chính sách ACK thực của từng chức năng; không giả ACK, không yêu cầu người dùng nhận đã đọc nếu nghiệp vụ không có |
| Lịch sử | state thử/transient tối đa 5 phút theo nhu cầu; durable request/ACK/audit giữ chính sách | không xóa ACK chưa hoàn tất, guard chống trùng hay log nghiệp vụ ở 5 phút |
| Agent roster | thông tin không khẩn cấp 10 phút/lần | role revocation / PRIMARY / kick không được chờ 10 phút |
| Usage | Google billed metrics theo project và provider quota day (Pacific), local counters riêng | 45k reads / 18k writes là **mục tiêu 90%** Firestore Standard, không phải bảo đảm usage của toàn shared account |

## 3. Kịch bản ứng xử và tiêu chí xác nhận
| ID | Giả định kích hoạt | Cách xử lý bắt buộc | Kiểm thử / bằng chứng |
| --- | --- | --- | --- |
| S01 | VPS PRIMARY khỏe, PDA gửi PickList | PDA create một ID; gRPC nhanh tới VPS, một WMS executor, ACK đúng ID | p50/p95 gửi→ACK; gRPC and REST single-flight |
| S02 | VPS gRPC lỗi nhưng Firestore REST còn | REST watchdog/fallback đọc bounded, không cần PDA gửi lại | listener mất/khôi phục; exactly-once, đo latency |
| S03 | Office chỉ truy cập Firestore qua proxy | agent auto chọn Windows system proxy cho exact HTTPS REST; không đòi RTDB/gRPC | replay Office direct 0/8, proxy 8/8 từ D171; synthetic proxy |
| S04 | Office gRPC/RTDB 403 | disable đúng listener lỗi theo network epoch; vẫn REST bình thường, không 403 retry storm | per-service denial, backoff/circuit |
| S05 | VPS process chết thật | NEXT_A đánh giá lease stale + WMS ready + server CAS, đổi generation, làm tiếp job chưa terminal | crash during before/after create; một primary |
| S06 | VPS mất đường coordination nhưng WMS/RTDB vẫn có thể hoạt động | Không suy luận chết chỉ từ local timeout; fail-closed khi không fence được | asymmetric partition, CAS unavailable |
| S07 | VPS WMS-login marker hoặc captcha | không chạy WMS mutation khi WMS chưa ready; có thể handoff nếu verified; không tự vượt captcha | E014 actual WMS readiness demotion, recovery |
| S08 | Hai Agent cùng tranh chiếm PRIMARY | chỉ một CAS thành công; loser không có quyền WMS/ACK | simultaneous CAS/race/generation |
| S09 | VPS phục hồi sau failover tự động | WMS ready liên tục >=30s; drain inflight/SKU critical; CAS handback, no replay | busy/idle branch, race |
| S10 | PRIMARY hiện do admin/tamnv2 gán thủ công | VPS không auto preempt; yêu cầu 15 phút/lần; một YES hợp lệ theo request TTL, NO/silence = không | double YES, stale/offline approver, TTL |
| S11 | WMS final click rồi mạng mất, outcome UNKNOWN | không click lại tự động, guard giữ UNCERTAIN, PDA nhận trạng thái chưa chắc chắn | post-click mutation ambiguity |
| S12 | PDA gửi trùng hoặc bấm lại trong lúc chờ | app disable while pending, cùng ID retry có điều kiện; ACK terminal không nhân đôi | 20/35s recovery grant, idempotency |
| S13 | PDA mất Internet | hiển thị mất mạng, không tạo offline business request/outbox/giả thành công | reconnect and reconciliation |
| S14 | Agent đổi Office↔Internet khi không bận | cập nhật network epoch, rebind HTTP proxy/listener, fresh auth exact Firestore proof, resync; không lặp job | repeated transitions and old-stream cancellation |
| S15 | Agent chuẩn bị chuyển Wi-Fi giữa WMS confirm/SKU/PRIMARY | hoãn chuyển hoặc handoff an toàn được chứng minh; không gián đoạn inflight | mutation in-flight guard |
| S16 | Mất proxy/DNS/HTTP 401/403 | phân loại transport vs auth, 401/403 không retry qua kênh vượt quyền; UI mã lỗi trung thực | outage matrix; no credential logs |
| S17 | Office phát lệnh Kick cần Worker | giai đoạn Function được duyệt: command actor-bound→server verify→Worker revoke→result; khi không có Function vẫn dùng đường đã chứng minh, không giả Kick PASS | RBAC/replay, 401/403, worker receipt |
| S18 | Function cold start/outage/duplicate event | trạng thái QUEUED/WAIT/FAILED, retry bounded idempotent, không báo DONE khi Worker chưa xác nhận | chaos, timeout, at-least-once event |
| S19 | Gọi/Chat khi PDA online/offline | ghi lệnh đủ quyền, delivery tương ứng listener/FCM hiện hữu; offline không giả người dùng đã đọc | cross-version/FCM/duplicate |
| S20 | Kick user trùng với PDA in-flight | generation/session revoke ngăn công việc mới, job đã commit xử lý bằng WMS fence hiện tại; không fake ACK | concurrent kick/session revocation |
| S21 | 20 PDA gửi đồng thời trong 5s, 40 PDA tổng | batch bounded, single PRIMARY claim, chống trùng, công việc không quá hạn chỉ vì hàng đợi | load 20/5s, 2k/day, 35s recovery |
| S22 | 200 Kick+300 Gọi+500 Chat/ngày | event targeted/coalesced, không cập nhật toàn fleet từng action, số liệu billable tính chung | 1k operator event replay |
| S23 | Firestore 70/85/90/95% free quota | cảnh báo và giảm polling/mismatch/query thừa theo thứ tự không-critical; không chặn PickList/ACK/HA bảo mật; >100% có thể tính tiền | provider quota alarms, emergency budget |
| S24 | 22:00–05:00 freeze, tăng ca, 03:00 day change | tôn trọng server schedule và VN business day, timezone quota Pacific riêng, không rớt ACK đang xử lý | night/dst/day boundary |
| S25 | Agent cũ/v mới chạy lẫn | schema compatible hoặc từ chối an toàn; rollout standby trước; rollback nguyên ID/ACK | mixed-version regression |
| S26 | Log upload và SKU 05/12/19 | giữ business cadence; log local aggregate, không tạo remote write per-event; Worker optional fallback giữ scoped | quotas Drive/Cloudflare/Firestore |
| S27 | D171 test peer state stale sau trở lại Internet | không lấy READY cũ làm PASS; run/phase id + epoch, sync lại, không lặp ACK | replay log 19/10 vòng cuối |
| S28 | Định mức free shared project đã có usage từ dự án khác | tính trừ usage thực toàn project/account trước cấp dư địa; không tuyên bố 90% chỉ dựa trên mô hình Agent | Firebase Billing provider dashboard |

## 4. Kế hoạch triển khai phân kỳ sau Owner duyệt code
- P0 — Khóa hợp đồng, bảng đo baseline 2k PickList/40 PDA/1k operator events, quota đọc/ghi/xóa/storage/egress; không đổi production.
- P1 — Agent-only: route-evidence-based proxy/connection epoch, reconnect gRPC bounded, REST watchdog single-flight không chặn listener, giữ WMS fence và realtime controls.
- P2 — Agent-only (PDA nếu thực sự cần): HA valid lease/CAS/WMS-ready, VPS return và Office/non-Office fallback; replay race/partition/UNKNOWN.
- P3 — Office→Worker side effects: xác định chức năng thật cần Worker; chỉ nếu nguồn Google Function hiện có được Owner cho phép mở rộng và scope xác định, hoặc tạo Function mới qua update project-scope/resource-registry + auth design và phê duyệt; Function không được chiếm transaction authority.
- P4 — Quota governor chỉ tối ưu thao tác không khẩn cấp, cảnh báo 70/85/90/95%, nguồn billing có độ trễ và provider-day lệch ngày VN. Không chặn business để cưỡng ép quota.
- P5 — branch→PR→authority/continuity+source/regression PASS→Owner explicit release approval→Beta canary+passive field evidence→Owner PASS; Stable gated. D170 vẫn paused.

## 5. Dự toán và cổng quyết định
- Giữ dự toán tham khảo trước đó: VPS ổn định ~33.060 reads và ~15.180 writes/ngày; fallback 4s cả ca ~41.460 reads, 3s cả ca ~46.260 reads (không đạt mục tiêu 90%). **Đây là phép tính giả định, không được kết luận chi phí provider**. Các con số có thể bỏ sót query matching-document charges, auth rules, shared workloads, extra ACK/retry và Function-triggered documents. Mức miễn phí Standard: 50k đọc/20k ghi/ngày, một DB eligible/project; quota provider day reset Pacific, không phải 00:00 giờ VN.
- Không cam kết <=90% chỉ bằng code khi mọi workload và billed usage chưa xác minh; kiểm tra cân bằng shared project/cloud account, đặt giới hạn các đường noncritical, cảnh báo và chuyển chi phí sau Owner đồng ý khi cần; bảo vệ đúng ACK/WMS/realtime trước tiết kiệm.
- Cloud Functions Blaze miễn phí 2M invocations/tháng, 400k GB-seconds và 200k CPU-seconds (và hạn mức network/build/storage riêng), **không trừ được Firestore doc operations**; mỗi deployment/new function cần qua resource gate. RTDB tải xuống dung lượng, không chuyển PickList/ACK.
- No real-field retest is required to author this document. Any physical FIELD PASS claim remains blocked without evidence, even after CI/simulation.

## 6. Ranh giới thay đổi
Trực tiếp: relay-agent leader/transport/realtime/network route/AgentSync/contact, Android RelayPocClient compatible receipt (nếu cần), existing Firestore coordination, possible newly approved Function bridge, security Rules, tests, usage logs. Indirect regression: Worker/InventoryCore session and Kick authority, Google Gateway+OTP, RTDB HA, Web/Android Báo hàng UI/realtime, WMS browser and SKU exports, release manifest/OTA. Unaffected business rule: SKU cadence and Báo hàng Worker transaction; still regress shared package/session. No secret or private raw log in repo.

Nguồn: D171-E015..E021 journal; docs/specs/REALTIME_NOTIFICATIONS.md; docs/D171_FIELD_LOG_ANALYSIS_2026-10-19.md; live Agent v139/Android vc114 source; official Firebase pricing https://firebase.google.com/docs/firestore/pricing and https://firebase.google.com/pricing.
