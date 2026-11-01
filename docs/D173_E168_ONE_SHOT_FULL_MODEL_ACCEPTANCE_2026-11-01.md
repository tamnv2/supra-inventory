# D173-E168 — Một đợt tích hợp và nghiệm thu toàn mô hình Core V2 (01/11/2026)

## Quyết định Owner
Owner yêu cầu không chia nhỏ thành nhiều lần duyệt. Cho phép tiếp tục phát triển và kiểm thử **toàn bộ** Core V2 trên branch/LAB độc lập, thực hiện một vòng nghiệm thu đầy đủ rồi trình **một** quyết định GO/NO-GO cho Production. Lệnh này **không** cấp phép merge Production, deploy official Worker/Web, ký OTA APK/Agent, thay database/Firestore, thay WMS hay đóng D172.

## Phạm vi bắt buộc của một kết quả nghiệm thu
1. Source duy nhất cho nghiệp vụ Báo hàng: CREATE/REPORT, grouping, confirm/resolve, correction, withdraw, overdue, auto-skip, 03:00 closeout, DISPLAYED/ACK, FCM, overlay và role/recipient/visibility.
2. Cùng một transaction: trạng thái nghiệp vụ, event, recipient references, idempotency, projection/snapshot; không bỏ guard phiên, quyền tại thời điểm đọc hoặc replay.
3. Full fidelity của Web, native Android (Reporter/Picker) và Agent Desktop (Office/WMS, Primary/Standby, confirm); cũ và mới hoạt động tương thích khi rollout.
4. So sánh data-by-data, status/time/ordering, badge/count/filter, pagination, replay/reconnect, auth switch, lost ACK, delayed push, TTL/retention và backpressure.
5. Tải có kịch bản chính xác từ ngày vận hành 27/10, burst 20 PDA/5s, quy mô 25–60 PDA, SLA dưới 5 giây, failover dưới 20 giây trên test thực; xác minh thiết bị Newland/Urovo, Windows/Office/WMS và FCM.
6. Đo **billable DO Compute Requests**, duration, SQL Rows Read/Written, Worker requests/CPU, toàn account và chu kỳ; tính cả D172 shared usage, auth, upgrade, reconnect và fallback. Không quy đổi raw HTTP hoặc WS theo 20:1 rồi tuyên bố chi phí.
7. D172 giữ PENDING/HOLD; không sửa module D172 nhưng phải chạy hồi quy shared Worker/Core/Auth và namespace; Stable OWNER-GATED.

## Evidence gate / không được phép suy diễn
- E167 chỉ chứng minh LAB thực cho REPORT subset (92/92 local, Cloud A/B/C một run). Chưa có full production parity; số request HTTP thô không phải billable.
- CI mới E168 chạy source guard, source API/Web và native build, local E112/E167 cùng một workflow; xuất evidence phân loại CODE, CI, FIELD, FINANCIAL, OWNER độc lập.
- Build native không tương đương thiết bị thực; local Socket không tương đương Firebase+FCM+PDA/WMS. Không có kết quả chứng thực ngoài thì NO-GO, dù compile PASS.
- Chỉ bắt đầu một bài **Cloud metered end-to-end cuối cùng** khi candidate đã hoàn thiện đủ toàn nghiệp vụ và nguồn đo/giới hạn đã được đăng ký, gate CI offline PASS. Không lặp cloud các subset vô ích.

## Điều kiện cho quyết định một lần
- Full 100% semantic equivalence theo fixtures và kịch bản, không lỗi mất/đôi, không quyền sai;
- latency, độ ổn định, HA và UI/device đảm bảo bằng field evidence;
- projected whole-account cost không vượt quota gói Cloudflare $5 (cảnh báo ngân sách khi thiếu mẫu);
- exact SHA CI, D172 regression, rollback mạch lạc và Owner release gate;
- lập một GO/NO-GO tổng hợp; GO chỉ là đề xuất Owner phê duyệt, không tự deploy.

## Trạng thái khi tạo E168
**WORK IN PROGRESS / CODE-ONLY LAB.** E167 CI loại `kind=BUILD_AND_LAB_TEST` bị continuity guard chặn vì không thuộc enum; đổi sang `TEST` đúng quy định, không nới guard. E168 workflow là **CI tích hợp ban đầu**, chưa phải bản Core V2 đã hoàn thiện. Production giữ nguyên.

## Kết quả CI thực tế — 01/11/2026

- LAB Real Core: [run 41264850247](https://github.com/tamnv2/supra-inventory/actions/runs/41264850247) SUCCESS, **36/36 assertions PASS** cho REPORT, RESOLVE, CORRECT, WITHDRAW, DISPLAYED/ACK idempotency, role revocation, tương đương Picker authorization predicate cũ; 20 mutations 99,9ms và 60 socket upgrades 139,8ms **chỉ localhost CI**.
- Native/Source CI: [run 41264850315](https://github.com/tamnv2/supra-inventory/actions/runs/41264850315): 5 job PASS (authority+D172; Core local; Web build; Android debug build; Windows Agent build). One-shot readiness job cố ý FAIL/NO-GO nếu chưa có kiểm thử thiết bị thực và billable toàn tài khoản.
- Source candidate: operational-v2-core.ts gom live Picker permission trên window thành một SQL và bỏ kiểm tra SQL không ảnh hưởng output; read-model-core.ts reuse auth/snapshot theo một broadcast invocation giữa socket cùng user. Giữ hợp đồng API, không thay Provider/Production.
- Chưa có: billable DO Compute Requests trong chu kỳ thực trên mã mới; full trace 27/10; thiết bị Newland/Urovo thật; FCM/overlay, Office/WMS và Primary/HA FIELD; toàn bộ mutation/role/client parity dưới điều kiện mạng và hỗn hợp version.
- Kết luận: LAB CODE/CI trong phạm vi đo PASS; **full-model Production NO-GO**. Không dùng E167 raw DO count để khẳng định chi phí dưới $5. PR813 giữ Draft; D172 HOLD độc lập.
