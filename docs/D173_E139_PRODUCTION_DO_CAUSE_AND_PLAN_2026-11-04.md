# D173-E139 — Phân tích DO Requests dài hạn dựa trên Cloudflare + Production + logs (04/11/2026)

## Cấp độ chứng cứ và ranh giới

- Báo cáo phân tích **READ ONLY**. Chưa có thay đổi Worker/Web/Android/Agent/SQLite/schema/provider runtime; **không coi đề xuất là Owner duyệt code**.
- Billing account Cloudflare cycle: 19/10 00:00 UTC–19/11 00:00 UTC (màn hình 19/10–18/11); API Billing có ngày 19/10–03/11 UTC, chưa có charge final cho 04/11.
- GraphQL DO/D1 là **account-shared**, còn Workers invocations lọc `scriptName=supra-inventory-beta`, dữ liệu Adaptive Groups có thể lấy mẫu/khác ranh giới ngày và billing.
- Production source thật xác nhận qua `/health/routine`: `464be7af73c4896637ec309ebc498306eafe1ee1`, HTTP 200; last successful Worker deployment run 41684855570. `main` newer khác Android but **service/web/relay-agent unchanged** qua compare.
- Cloudflare read-only runner: https://github.com/tamnv2/supra-inventory/actions/runs/41859015421, artifact `d173-e139-cloudflare-billing-cycle-hourly`, chứa `cloudflare-7day.json` (tên file kế thừa; dữ liệu 19/10–04/11 theo giờ và 5-phút 30/10,02/11,03/11,04/11) và `core-route-36h.json`; HMAC readback đúng Production, dữ liệu cố định chỉ aggregate route/query ID (không raw secret/SQL/ID cá nhân).
- Logs ngày 04/11 trong `Inventory/Beta/Logs/2026-11-04` khi đọc có 185 files: 146 Android Inventory, 34 Agent, 3 WEB (chỉ server scheduled, có bản trùng), 2 OBPP. Android chỉ đọc **mẫu tại các khung** 05–07,13–14,19–21, không coi là toàn bộ fleet. Các log Web server không có tương quan click/chuyển tab người dùng.

## Billing tính đến 03/11 UTC (tổng 16 ngày quan sát, không phải toàn bộ chu kỳ)

| Meter (ACCOUNT SHARED) | Tổng ghi nhận | Allowance | Tỷ lệ |
|---|---:|---:|---:|
| DO Compute Requests | 652,248 | 1,000,000 | 65.2% |
| DO SQLite Rows Read | 4,731,729,080 | 25,000,000,000 | 18.9% |
| DO Rows Written | 2,152,951 | 50,000,000 | 4.3% |
| DO Duration | 8,411.10 GB-s | 400,000 GB-s | 2.1% |
| Workers Requests | 504,115 | 10,000,000 | 5.0% |
| Workers CPU | 1,794,151 ms | 30,000,000 ms | 6.0% |

- Chủ dự án đặt mục tiêu DO requests **<20k/ngày với workload chuẩn tương đương**, không chặn hệ thống hoặc làm chậm API để đạt mục tiêu billing. Mức ngày thường 29–31/10 36,696–41,564; cần giảm khoảng 46–52% với workload cùng loại.
- GraphQL local day 03/11 64,468 DO, 33,297 Workers (ratio 1.94); 04/11 gần 22:30 là khoảng 36.9k DO/28.9k Workers (ratio 1.28); thời điểm 03 trước E128 rollback, 04 sau E128. **Tương quan không chứng minh causality** vì traffic/phiên/backend chung khác.
- 01/11 lượng traffic thấp bất thường, không dùng làm ca tiêu chuẩn.

## Hot windows (VN timezone) — GraphQL evidence

| Window | DO Req | Worker Req |
|---|---:|---:|
| 30/10 05:55–06:00 | 993 | 873 |
| 02/11 14:10–14:15 | 936 | 511 |
| 03/11 14:00–15:00 | 8,439 | 4,341 |
| 03/11 14:10–14:15 | 1,384 | 788 |
| 04/11 13:55–14:00 | 933 | 816 |
| 04/11 14:00–14:05 | 1,117 | 1,005 |

- Trong route core E139 36h, 03/11 14h ghi 8,477 route hits, 04/11 14h ghi 2,978. Không so trực tiếp với GraphQL để kết luận phát sinh/tiết kiệm từng giao dịch.
- Báo cáo tồn tại route `OTHER_OPERATIONAL` quá rộng; cần phân bổ thành chính xác snapshot/queue/picker/reporter/reporting để khẳng định tác nhân.

## InventoryCore Production route — 04/11 partial to ~22:34 VN

| Fixed family | Counts |
|---|---:|
| OTHER_OPERATIONAL | 12,941 |
| AUTH_SESSION | 9,179 |
| NOTIFICATIONS | 4,737 |
| REALTIME | 3,531 |
| SKU_CATALOG | 1,428 |
| Other groups | 3,680 |
| **TOTAL** | **35,496** |

- GET **26,987** (**76.0%**). Các route nóng này là một DO InventoryCore **not account provider billing**. Việc đạt <20k cần loại ~15.5k invocations trên cùng loại ngày (khoảng 44%). Không tự giả định có thể tiết kiệm tất cả GET.
- GET subset: OTHER_OPERATIONAL 12,941; AUTH_SESSION 7,366; NOTIFICATIONS 1,864; REALTIME 1,405; SKU_CATALOG 1,399.
- SQL Query ID sample chỉ theo allowlist, hàng triệu SQL rowsRead; không dùng để thay thế mục tiêu DO Requests và không giả định tổng bộ đếm bằng provider.

## Đối chiếu mã nguồn và log

- Production `service/src/core.ts` đặt `D173_E128_LEGACY_HTTP_OPERATIONS=true`, HTTP cho business command, realtime WS push tiếp tục hoạt động; E110 trước đó WS command + HTTP hedge ~50ms có nguy cơ gửi song song. E128 khôi phục một đường ngày 03/11 nhưng savings cần matched workload chứng minh.
- Các đường `service/src/read-api.ts` và `service/src/business-api.ts` đang gom Firebase verification và DO-authoritative session/role + business GET/mutation **một DO** cho rất nhiều hot path; không đề xuất “gom auth” một cách chung chung khi source đã làm.
- DO `authorized/operational` vẫn trả snapshot/picker/reporter/delta riêng; phân loại route hiện gom chung vào OTHER_OPERATIONAL, không chứng minh chính xác endpoint nào tạo 12,941 GET.
- `service/src/business-api.ts`: notification create có prepared FCM, resolve/correct có background `/notifications/prepare` và `/notifications/delivery-complete`; không được lược bỏ ACK/delivery retry để tạo saving giả.
- `service/src/index.ts` cron 5 phút chạy các nhánh độc lập; `d173-background-worker.ts` đã gom hai initial reads vào `/maintenance/plan`, nên tuyệt đối tránh coi mỗi 5phút cron là nguồn ~15k DO/ngày hoặc giãn lịch.
- `web/src/realtime-client.ts` local 5s `ensureRealtime()` không đồng nghĩa cứ 5s là request; `web/src/operational-app.ts` presence 30s chỉ dashboard visible + roleManage. Android realtime reconnect/ticket/delta là nhánh cần phân tích retry, không dừng realtime/gap detection.
- Android log mẫu 04/11 quanh 14h có session transition, socket failure/reconnect, HTTP refresh, nhưng không có server request ID xuyên route để kết luận nguyên nhân riêng từng peak. Agent VPS/WMS/Firestore ghi nhận hoạt động quanh giao ca, không được tự quy là Cloudflare DO invocation. Web log 13:15/21:15 là server Cron checkpoint không phải người dùng Web.
- D172 độc lập, **PENDING/HOLD**; số account-wide có thể bao gồm D172 DO trên cùng Worker. Phải cô lập ảnh hưởng và test hồi quy bắt buộc nếu sửa shared Worker.

## Phương án thực hiện để xem xét — không triển khai ngay

### P0 — phân loại route đúng và đo workload tương đồng
- Tách coarse `OTHER_OPERATIONAL` thành allowlisted `PICKER_SNAPSHOT`, `REPORTER_SNAPSHOT`, `PICKER_REPORTS`, `REPORTER_QUEUE`, `REPORTER_COUNTERS`, `DELTA`, `ADMIN_READ`; phân loại `AUTH_SESSION` theo tình huống login/logout/refresh/lookup. Dùng **cùng per-invocation counters hiện hữu** để không tạo thêm SQL writes/timers/API calls hoặc bí mật trong log. Test số lượng route exact-sum và fallback.
- Đo inbound per-device cohort theo ca, logical report/resolve/ACK, session reconnect, Web screens visible; source timestamp VN, p50/p95/p99 end-to-end. Tránh quét lại toàn hệ thống bằng “phương án sáng tạo” khi chưa có proof.
### P1 — ưu tiên loại GET lặp
- Giữ SQLite DO authority và một đường HTTP cho mutation. Client dùng snapshot đã có kèm revision/session generation, áp dụng server-push delta/target patch; chỉ reconcile khi cursor gap/epoch đổi/đứt kết nối hoặc đúng thao tác yêu cầu. Coalesce cùng-key in-flight loads trong Web/PDA, cancel stale response theo generation; không dùng TTL làm sai bảo mật, không cache mutation response để giả thành confirmed.
- Đồng bộ AUTH/profile/window/catalog trong existing authorized snapshot khi các bộ dữ liệu được cập nhật bởi cùng event+version; tránh `requireUser` hoặc registration lặp trên client khi status không đổi, nhưng live auth/role/session vẫn server kiểm tra ở mutation/privileged GET.
- Notification device token chỉ upsert khi token/đăng nhập/permission thay đổi, không upload lại theo mỗi refresh. Không làm chậm giao nhận FCM/ACK, bảo vệ retries và idempotency.
### P2 — chống burst ca
- 05:55 và 14:00 đặc biệt: cho tick UI local tiếp tục, **coalesce** pending ticket/connect/delta per session, de-duplicate reconnect + refresh, jitter chỉ cho **noncritical bulk read** sau login/shift, không lùi giờ logout 14:00/22:00, không chậm báo hàng/ACK.
- Bảo vệ single in-flight + event horizon, correct retry backoff. Không tắt realtime; không kéo dài 30s/5s bảo vệ bằng suy đoán.
### P3 — kiểm soát và kiểm thử
- Chạy 2 ca tương đồng, log real ingress, CL actual plus route counters; kịch bản worker outage/WS reconnect, auth revoke, FCM/token stale, Web visible/hidden, Picker/Reporter, Agent HA/ACK (Firestore unchanged), D172 regression, errors <=baseline, p50/p95/p99 latency <=baseline.
- Mục tiêu **<20,000 DO Requests/ngày** là nghiệm thu FIELD chứ không phải commit test; giảm tối thiểu 15.5k từ 35.5k partial đòi bằng chứng thật. Báo usage theo 1,000 logic operations / PDA-hour / Web session-hour và total account. Giữ rollback chỉ lớp caching/read dedup, không schema migrate/provider or secrets.
- Phải Owner duyệt cụ thể sau khi xem impact và số đo. PR #842 chỉ là evidence read-only, **Draft**, không merge/Production deploy.

## State
- E139 API/CI Collector PASS; Analytics/Billing read PASS; Production HMAC readback PASS; code analysis complete with attribution limitation; **CODE CHANGE NOT AUTHORIZED**, RELEASE/FIELD/OWNER PENDING. D172 HOLD, Stable OWNER-GATED.
