# D173-E109 — Hoàn thiện gói giảm DO request, CODE ONLY

Owner 01/11/2026 chốt toàn bộ đề xuất E108 và yêu cầu hoàn thiện code, dừng ở CODE READY. Không merge main, phát hành Web/APK/Agent, cập nhật OTA, deploy Worker/DO hoặc ghi provider. D172 nghiệp vụ độc lập và Stable OWNER-GATED giữ nguyên.

Base: `ops/production-analysis-base-20261101.json`; Worker/Web source f15b9675, Web 3.3.2, Agent162, Androidvc121. Code ứng viên nằm trên PR815; source mới không trở thành production chỉ vì CI xanh.

## Phần được xây dựng

- P1: authorized reads một DO cho Presence/Admin/Agent; snapshot Reporter/Picker cùng quyền, revision và clock; response mutation có bản đọc tùy chọn để bỏ tải lại khi phù hợp đúng view.
- P2: tái sử dụng tổng queue/recent/overdue giữa các projection khi predicate giống hệt; giữ nguyên summaries/index/schema hiện tại và telemetry bền. Delta có thông tin coverage từ khoảng global sequence đã thực sự scan/filter; không tự bỏ gap detection.
- P3: capability `d173-v2`, bounded request/response trên Hibernation WebSocket; cùng dispatcher với HTTP; verified UID/channel/generation/expiry, live authorization, allowlist operation, backpressure và HTTP fallback cùng request ID. Business journal hiện có chốt result cùng transaction; fingerprint bảo vệ ID tái dùng với nội dung khác. Read model sau commit là observation có version, không giả là canonical snapshot bất biến của lần replay.
- P4: FCM prepare và callback hợp nhất trong một invocation, cùng helper notification cho WS/HTTP; maintenance đọc chung nhưng giữ retry/error từng nhánh và lịch 5 phút; `/health/routine` một DO cho liveness, `/health` migration/deployment contract giữ nguyên. Asset-first chỉ `/assets/*`, API/HTML/OAuth/download/health vẫn Worker-first.
- Web/APK: transport negotiation, bounded pending map, fallback có cùng ID, projection/view/session/revision guards, snapshot và bỏ refresh đủ điều kiện. Presence chỉ poll khi visible và coalesce cùng phiên. Giữ nguyên WMS/HA/ACK, Firestore/RTDB Office carrier và version/signing channels.

## Ma trận requirement → component → contract → evidence

| Requirement | Component/contract | Evidence phải PASS trước CODE READY |
|---|---|---|
| Cùng kết quả/order/count/page/range | Core snapshots + operational queries | `tools/d173_e108_snapshot_regression.mjs`: actual SQLite projections, paging/filter/time boundaries, counter predicate parity, no extra summary schema |
| Live quyền và phiên | Worker verified identity, Core SQL fence, bound attachment | `tools/d173_e109_command_regression.mjs`: expiry/role/UID/generation, revoke during body parse, private context overwrites, no D172 capability |
| Không lặp giao dịch khi mất response | HTTP/WS same dispatcher and request ID; SQLite idempotency | Command fixture: actual create/withdraw/resolve/correct replay, changed-payload409, rollback on injected fault, no public journal metadata |
| Realtime/delta đúng | Hibernation/cursor/audience coverage | E086 legacy behavior + E109 new protocol; snapshot fixture global filtered gaps; result frames never advance event cursor |
| Notification và nền không làm chậm foreground | Shared FCM helper / maintenance envelope | `tools/d173_e108_background_regression.mjs`: provider pending/error, prepared token stripping, partial failure isolation and legacy retry |
| Security/static route parity | Existing Assets binding | `tools/d173_e108_assets_regression.mjs`: actual Worker response bytes/headers and route selection; no new binding or resource |
| Client lifecycle/fallback | Web/Android transport + reducers | `tests/d173-e108-client-transport.test.mjs`, Web typecheck/build, Android compile/assembleDebug; same-session late result, disconnect, pending bound and same ID |
| Shared runtime isolation | D172 API/auth/private SQL/Sheet | Existing D172 isolated test suite; no D172-owned source diff; authority/continuity/state/secret/isolation guards |
| Known SQL/log/HA/ACK contracts | Existing regression suites | E049 durability, E055 SQL parity, E097 startup, product/Agent/Android compatibility and session tests |

## Ranh giới chất lượng và triển khai

Code tests/build không chứng minh lợi ích billing, độ trễ Cloudflare hoặc thiết bị thực. Chưa có production/field measurement từ code ứng viên. Giữ cổng so cùng ca trên 1.000 logical operations/PDA-hour, p50/p95/p99 action→commit→display, ACK, reconnect/packet loss, SQL rows/write/duration/CPU và tỷ lệ HTTP fallback. Không quảng bá phần trăm saving toàn tài khoản chưa đo.

Snapshot chỉ hợp nhất các phần cần thiết và đủ nhanh; Web fast path đã patch local giữ nguyên, không thêm full snapshot vô ích. Response có read model tùy chọn phải vượt view/generation/revision guard trước khi thay state. Khi model thiếu hoặc lỗi, client dùng đường reconcile hiện có.

HTTP hedge giữ response có ích sớm nhất, dùng cùng request ID; khi socket nửa sống có thể tăng overhead. Tiết kiệm và latency phải được kiểm chứng trước khi mở rộng cohort production. Không có durable offline business outbox, không báo thành công giả.

Nếu Owner duyệt phát hành ở lượt sau: **Worker/DO + Web trước, sau đó APK Báo hàng** để client mới thương lượng capability. Agent desktop không có source thay đổi trong gói này, không cần phát hành Agent. Không migration/recreate SQLite, không namespace mới. Client cũ tiếp tục HTTP/push cũ. `D173_COMMAND_TRANSPORT_DISABLED=1` là cơ chế code rollback WS về HTTP cho release được phép sau này, chưa ghi cấu hình provider.

## Trạng thái

**CODE READY — SOURCE / BUILD / EXACT GITHUB CI PASS.** CODE READY chỉ được ghi khi checks của exact source đã PASS. PRODUCTION/RELEASE/FIELD/OWNER BUSINESS PASS không được suy ra. PR815 phải dừng trước merge/deploy/OTA.

Local evidence: service TypeScript, Web TypeScript/Vite, Android debug build + 13 JVM tests, 41 client Node cases, 41 independent D172 cases, actual SQLite snapshot/command/audience fault fixtures, E049/E055/E086/E097, background memory/FCM/maintenance/static routing, authority/continuity/state/secret guards PASS. No provider data writes, deployment or signed release.

## Verified CODE READY receipt

- Exact tested source: `6f1692bbb349dca3dad982368d8631727a7ed523`. GitHub: **40 SUCCESS, 0 FAILED, 12 intentionally SKIPPED**.
- [Code-only integration + Android debug/JVM CI](https://github.com/tamnv2/supra-inventory/actions/runs/41317351390) SUCCESS; independent D172, source/SQL/ACK/HA compatibility, authority/continuity/security guards PASS.
- CI compatibility fixes preserve old release denials, verify the exact approved asset-routing delta and use current Android tools. No release gate, role rule or mail/Rules/resource protection was bypassed.
- The receipt commit updates documentation/state only; executable trees must remain identical to the tested source.
- Stop point reached: **NO MAIN MERGE, NO DEPLOY, NO OTA**. Await a new explicit Owner instruction for Worker/DO+Web, then APK. Desktop Agent source unchanged. No FIELD, production latency or billing saving claimed.
