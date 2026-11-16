# D173-E278 — Agent194 Web Confirm functional recovery, safe HA and failure-only Owner mail

## Explicit Owner code and Production authority, 16/11/2026
Owner has approved the E276 incident-alert subject/body and explicitly ordered **code implementation, finish code, then deploy Production**. Applies only to D173 Báo hàng source on existing official Production Worker and existing Agent signed OTA channel. D172 business source/data/release remain independent PENDING/HOLD; Stable, WMS backend, Android/APK, Web UI source and Browser Host14 are excluded. No raw log, PickList ID, employee identity, credentials, private mail recipient or secrets may enter the public repo. The approved recipient comes from the existing protected project mail subsystem.

## Source diagnosis
2026-11-16 VPS sample shows WMS page reported `READY_EMPTY ready=1` with zero PickList rows while PDA confirmation requests returned `WMS_DATA_UNAVAILABLE`. Existing PDA fast search disabled empty-table browser self-heal and delivered terminal ACK rather than PENDING, and HA consulted DOM `ready` not functional confirm health. No evidence the WMS session expired during the main 16:15–17:10 malfunction. Upstream WMS data/filter/network origin remains unverified, so changes must remain safe and local without direct WMS API access.

## D173 code scope
- Agent194: when real PDA search yields repeated zero-row results after a previously populated table, keep distinct functional degraded state; do not classify naturally empty queue from startup as failure. Re-enable existing local one-shot empty-table recovery with bounded ~4s wait. Only after repeat event request established HA role refresh; preserve CAS generation, current lease, in-flight fences, no replay after uncertain final WMS click. Deferred ACK only for pre-click technical `WMS_DATA_UNAVAILABLE` when an independently ready standby is known.
- Agent alert: current PRIMARY reports a single incident-onset event to existing D173 Worker by authenticated HTTPS, asynchronous to business work. Session-required case is separate from functional data availability. Re-arm once after sustained healthy WMS confirmation and Worker acknowledgment; no routine recovery mail.
- Existing Worker: authenticate exact Agent operator, verify that the Agent instance/generation recently held the authoritative PRIMARY lease, allow only scoped incident schema, one global claim in the existing InventoryCore `app_config` SQL (no new database/resource), send one Owner mail using existing `sendProjectEmail` and existing project mail recipient, record one receipt; fail closed on ambiguous duplicate send outcomes.
- Production release: Worker must pass same-sha original deploy-beta production workflow before Agent194 OTA changes the existing inventory-channel manifest; Browser Host14 not updated. Existing Web Worker shell repack remains unchanged Web UI logic; no new WMS/provider traffic on routine healthy confirm.

## Risk and targeted verification
- Positive: two repeated pre-click real search failures with prior nonempty WMS table; healthy NEXT_A/NEXT_B; bounded generation CAS and PENDING retention; one event notification.
- Negative: naturally empty WMS queue, stale/expired Agent lease, secondary not WMS-ready, forged incident/body, duplicate mail after restart/HA, per-PickList retries, post-final-click missing success (never blindly click again).
- CI PASS required: TypeScript typecheck; pure incident reducer + approved subject/body tests; existing E140 safety regression; Windows net48 Agent194 and unchanged Host14 compile/native smoke; all D172 isolated regressions, authority/continuity and exact project-scope checks; Worker release follows pinned same-sha CI and existing beta deployment guard.
- Usage: no new scheduled polls; only incident-time Worker request, Firestore lease read, DO row claim and email, plus bounded exception-only local Page.reload. Confirm Cloudflare provider quota from available existing usage before describing cost certainty.
- Runtime/FIELD still require actual multi-Agent failover and one real Owner email receipt plus safe recovery after release. CI/technical release do not imply FIELD/OWNER PASS.

## Authority and status
`D173-E278_OWNER_CODE_AND_PRODUCTION_APPROVED__SOURCE_IN_PROGRESS__PR_CI_NOT_YET_VERIFIED__NO_RELEASE_CLAIM__D172_HOLD`.

Prior diagnosis and approved mail copy are in draft PR #983 and D173-E274–E277 working history. This implementation branch is based on accepted main SHA `910bbeb400eebcd499a356d392ae500e2320d885`. The public documentation deliberately omits private recipient address. 

## CI và bảo vệ phát hành cuối (16/11/2026)
- Mã nguồn được pin tại `255a4b52d1fcad356d008433506228459162fbd3`; source/job Windows build Agent194, Host14 smoke, Worker TypeScript, E278 incident tests và hồi quy D172 đều PASS trong workflow `43865018302`.
- Cùng SHA: Repo authority `43865018216`, project-state `43865018153`, D172 isolation `43865018130`, D172 backend `43865021712`, E123/shared regression `43865018121` đều PASS. Đây là sáu workflow CI **trong phạm vi**; không suy diễn toàn bộ CI lịch sử hoặc FIELD PASS.
- Quy trình phát hành loại trừ marker E278 khỏi **legacy** `verify-relay-agent.yml` (tránh tự phát hành Agent/Browser khác); bỏ qua job `deploy-beta-firestore.yml` cho marker E278 (không ghi Firestore Rules); chỉ phát hành Worker hiện hữu trước, sau khi cùng SHA PASS mới phát hành Agent194 bằng workflow riêng. Host14/Firestore/APK/Stable/D172 business không đổi.
- Release kỹ thuật còn chờ protected merge và readback Worker/Agent OTA thực tế. FIELD/OWNER PASS không đồng nhất với CI/release.
