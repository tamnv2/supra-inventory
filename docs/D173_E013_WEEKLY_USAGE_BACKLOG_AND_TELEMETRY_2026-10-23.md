# D173-E013 — Tối ưu theo chứng cứ và telemetry tối thiểu (23/10/2026)

**Authority:** `tamnv2/supra-inventory`; D170/D171 được chốt giới hạn; Production hiện là Agent v140, Báo hàng vc117, Web 3.1.2; D172 app OBPP riêng `PENDING/HOLD`; Stable `OWNER-GATED`. Đây là **PR code-only dự thảo xếp sau D173-E012**, không phải release hoặc chứng minh FIELD PASS.

## Yêu cầu Owner (23/10)

1. Confirm PickList đang chủ yếu dùng Firebase và ổn định về nghiệp vụ: chỉ sửa phần phụ trợ nếu có chứng cứ, không động vào đường xác nhận WMS/Firestore/ACK.
2. Báo hàng tốn Cloudflare: ưu tiên các truy vấn/lặp read thực sự gây tải.
3. Rà các backlog D173 chưa có code/triển khai/field PASS theo log tuần 17–23/10.
4. Những điểm chưa đủ chứng cứ cần **bổ sung log tối thiểu** để giải quyết, không tăng battery/network/Firestore/DO.

## Evidence/limitations

- D173-E012 screenshot của Owner, `docs/usage-daily/2026-10-23.md` §6: DO Oct19→23 request 64K→54K; rows read 317M→730M; rows/request 4,953→13,519; **không chứng minh root cause của một SQL route**. DO namespace dùng chung D172, số liệu không được mặc định tính 100% cho Báo hàng.
- Drive VPS checkpoints 17/10 ~324 nhận/262 xác nhận/62 lỗi, 18/10 VPS thử nghiệm ghi 17/0/17 cùng ~1,624 `securetoken.googleapis.com HTTP 400` ở session log; **18/10 thiếu bối cảnh và có thể là phiên thử/invalid token, không đại diện lỗi production hiện nay**. Các ngày 19–23 lần lượt: 663/569/94; 626/558/68; 574/512/62; 496/452/44; 572/543/29 (checkpoint mới nhất, khung khác nhau).
- VPS `D160_DIAG TERMINAL CONFIRMED` P50/P95 của một số đoạn checkpoint (ms): Oct19 867/2315, Oct20 851/1860, Oct21 841/1348, Oct22 846/1665, Oct23 881/1948. **Không phải end-to-end PDA→WMS→ACK**; không thay đổi nghiệp vụ xác nhận khi chưa có chứng cứ.
- RTDB observer trên standby ADMIN-PC Oct21 167 timeout, Oct22 651, thiết bị dự phòng Oct23 1,026; một standby khác ngày 22 không có sự cố trong đoạn log quan sát. Không suy ra lỗi toàn fleet, không auto failover do observer timeout.
- Android Reporter vc114 19–20 có HTTP Reporter cao, nhưng không thể ngoại suy mức tiêu thụ vc117. Source vc117 `ReporterController.refresh` fetch tuần tự queue/recent/counters/lazy overdue, stale-revision retry; realtime badges dùng metadata delta; `loadOverdue` áp dụng trang riêng. Là vùng **nguy cơ race có căn cứ code**, chưa chứng minh nguyên nhân flicker.
- Mẫu Android vc117 cho thấy WS reconnect/FCM overlay có lúc DRAW_CONFIRMED, đôi lúc SUPPRESSED do foreground. Cần trace theo role/version/event/seq mới kết luận hiển thị đúng ở field.
- Các file nhật ký lớn, các thư mục Drive một số có nhiều hơn 100 mục; phân tích dựa các tập Agent/Android/Web được truy cập có chọn lọc, **không tuyên bố quét 100% mọi thiết bị/ngày**.

## Decision matrix / phân loại

| Track | Ưu tiên | Cơ sở | Sửa/đo | Bảo vệ |
|---|---|---|---|---|
| T1 Agent/PDA Confirm | P2 | Tỷ lệ VPS confirm và D160 median ổn định, RTDB standby timeout lặp | **Đề xuất** điều tra mode/observer network, de-duplicate exception logs và thống kê reconnect duration; không thay confirm | Firebase request/ACK, WMS single commit, fencing, failover, <=20s, no new poll |
| T2 Inventory DO SQL | P0 | 730M rows/day với 54K DO Requests | **Đề xuất** dùng `d166_sql_diagnostics` đã có để xếp 15 `query_id` theo total rows read/max/execs; inspect `EXPLAIN QUERY PLAN` offline; sửa query/index/cached-aggregate từng route sau attribution | Không push thêm SQL log/timer vào DO; guard D172 shared Core |
| T3 Reporter badge & scroll | P0 | vc117 Owner FIELD_FAIL, source sequential snapshots + realtime additive metadata | **Đã code-only** metric nhỏ theo event UI để phân biệt stale refresh, badge change, cross-request count difference, scroll anchor outcomes; sửa snapshot fences/renderer chỉ khi metric/field repro | Không thay UI/HTTP/WS/FCM/seq, no extra request |
| T4 Android Picker overlay | P1 | FCM→draw một số mẫu PASS, chưa đúng cho tất cả phiên | **Đề xuất** đối soát stage ID stable/hash + guaranteed draw proof trên thiết bị thực, không tự ACK; tích hợp vào log hiện có nếu trường thiếu | Doze, DND, permission, Android 11 vs 13, role security |
| T5 backlog D173 app update | P1 | PR690 cũ closed unmerged | **Đề xuất** tách APK download progress + verification/install UI; chưa có Agent EXE verified implementation | OTA signature/channel/current only, rollback, install not confused with downloaded |
| T6 recurrence day | P1 | PR690 unmerged; >200h feedback | **Đề xuất** server-authoritative date VN restriction cho UI today, không xóa historical recurrence; test 00:00 and 03:00 N+1 | history exports and SLA independent |
| T7 warm PDA resume | P2 | Owner reported delayed wake, Android recreation/realtime log | **Đề xuất** collect foreground/warm vs process start, first-usable timestamp/coarse and recover count at existing boundary | Session Kick, no extra keepalive |
| T8 Picker automatic logout VN | P2 | Backlog no accepted design/code | Design-only; preserve existing 22:00–05:00 freeze and OT | Server-authoritative, no forced active ACK loss |
| T9 no-reply | Maintain | E010 Cloudflare Worker release PASS and E011 one real OTP receipt | **KHÔNG** đánh dấu chưa deploy; 3 loại mail còn FIELD PENDING | no synthetic OTP, no sender swap |
| T10 legacy host | Separate after shift | Owner schedule 24/10 23:00 | Giữ host/resource cũ tới khi xét dependency | D172, signer/current OTA, OAuth, Worker, Stable |

## D173-E013 implementation scope: Reporter UI local counters only

**What code actually does on this PR:**
- `D166UsageAudit.recordReporterUi()` is a whitelist-only, in-memory, UTC hour bucket counter (320 keys hard bound, oldest evicted & evicted count).
- Existing support/daily Android JSON snapshot adds `reporter_ui_groups` (at most 24 compact or 64 detailed), omitted/evicted counts and label `NOT_PROVIDER_BILLING`.
- Reporter increments `REALTIME_APPLIED`, `REFRESH_APPLIED`, `REFRESH_STALE`, `REFRESH_ERROR`, `CROSS_REQUEST_COUNTER_DIFFERENCE`, `OVERDUE_PAGE_APPLIED`, `PENDING_BADGE_CHANGE`, `OVERDUE_BADGE_CHANGE`, `SCROLL_ANCHOR_RETAINED`, `SCROLL_ANCHOR_MISSING`. No count values, SKU, ticket, device, user, SQL or auth content recorded in these new metrics.
- Cross-request counter difference is an **observation of potentially different snapshots at two instants**, NOT automatic fault classification. Anchor missing can be a legitimate removed row.
- Does not change UI behavior, server/DO code, Worker settings, Firebase/RTDB/FCM behavior, retry cadence, HTTP/listeners, timers, JobScheduler, persistence or delivery slots.
- No new network/backend activity from telemetry. Extra bounded JSON bytes ride **only existing support or scheduled log delivery**; no new wakeups. The metrics persist in RAM until process restart, and ring journal overflow is still separately labelled.

**Not implemented / explicitly gated:** SQL plan captures and query rewrites, server route telemetry, Agent observer telemetry, APK progress, recurrence fix, Reporter counter repair, Android lifecycle performance changes. They need scoped source baseline/regression and a separate code gate, not silent changes in telemetry PR.

## Acceptance and rollback

- CODE PASS only after Kotlin compile and targeted D173 tests; authority + continuity + D172 isolated guard PASS required before merge.
- Runtime deployment is **NOT AUTHORIZED** by the telemetry PR; no signed APK/OTA/Worker release until exact source + Owner release gate and canary/field-check. D172 remains separate PENDING/HOLD.
- When eligible for field: on Reporter vc117-derived build, compare UTC per-hour `reporter_ui_groups` against server `d166_sql_diagnostics` and Cloudflare same-window; no sensitive log fields; measure bytes per bundle, battery impact and NO new API calls; verify badge/scroll still failing or fixed without assumption.
- Rollback by reverting telemetry commit only. No provider configuration or migration.
