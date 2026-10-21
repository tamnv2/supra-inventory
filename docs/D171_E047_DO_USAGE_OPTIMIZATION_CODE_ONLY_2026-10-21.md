# D171-E047 — Cloudflare DO usage hot-path optimization (A–D) — CODE ONLY

**Ngày VN:** 2026-10-21. **Owner authority:** explicit request to integrate options A/B/C/D into the continuing D171 staged source; D170 acceptance, D171 full CODE DONE, physical field and billing savings remain **UNVERIFIED**. **Working PR:** #656 Draft, no main merge or rollout.

## Purpose, measured baseline and limits

Owner screenshot from Cloudflare Billing period **19 October–18 November 2026** (two observed days, shared account):
- Durable Objects Compute Requests 59.37K / 1M = **5.937%**;
- DO SQL rows read 317.67M / 25B = **1.27068%**;
- Workers Standard Requests 43.15K / 10M = 0.4315%;
- Workers CPU 150.48K / 30M ms = 0.5016%;
- DO rows written 112.23K / 50M = 0.22446%;
- DO compute duration 256.05 / 400K GB-s = 0.06401%;
- D1 rows read 720 / 25B, negligible.

These are **account-wide**, not Inventory-attributable per-route, and not same-window provider measurements vs installed App 114, Agent 139, Web 3.1.1. Avoid treating client counters/SQL cursor counts as bill. Quota pools are not convertible. D165/D166 usage baselines are historical, and actual measured optimization/latency comparison has **not** happened.

## Implementation matrix

| Option | Source candidate in D171 | Stable legacy contract preserved | Evidence needed before release |
|---|---|---|---|
| **A** Authorized one-DO mutation | Worker Firebase JWT check then `InventoryCore.d171ShortageMutation` validates active user, channel generation, effective role, Picker reporting enabled, Android operating window and derives trusted actor; invokes existing `handleBusinessRequest` with same request-id idempotency | Same public endpoints and error bodies/status; same SQLite transaction, audit and SLA; old internal routes retained for older code | Runtime 401/403/409/201 and race replay tests, Android/Web mixed-version |
| **B** Single-invocation broadcast | After successful authoritative transaction, directly calls existing `handleReadModelCoreRequest('/realtime/broadcast')` inside InventoryCore; no second Worker→DO call | Exact event identity, sequence/delta, recipient tags, Picker ACK, reconnect gap recovery; broadcast failure never reverses commit | Concurrent Pickers, correction order, WS disconnect/reconnect, no missed result |
| **C** Reuse DO SQL for FCM preparation | Within same DO invocation on healthy open schedule: resolve existing notification targets and durable event seq/version; private `{result, prepared}` envelope to Worker; strip `prepared` from public HTTP response; Worker `waitUntil` FCM send + delivery/invalid-token audit unchanged. On unavailable/open-window uncertainty, use pre-existing bounded Worker lookup/fallback | No token exposure; same reporting notification/typed correction result fanout; no new FCM cadence or service; no Google send on critical transaction path | Real delivered/retried/failed/invalid token, 03:00, lunch/offshift, idempotent replay, duration P95 |
| **D** One-DO SKU catalog read/search | Worker authenticates Firebase JWT then `/authorized/read/skus/{catalog-info,catalog,catalog-delta,catalog-provenance}` and `/authorized/business/skus/search` check actual generation/role and read SQLite in same DO | Existing catalog fields, pagination/delta, staged Android local SQLite, Admin-only provenance Web route; no auth caching at edge | Bad token/revoked generation, cross-role, catalog recheck mid-update, delta/full compare |

No D1 migration, new Firebase/DO/Workers/GCP resource, schema change, new cron/listener/poll, SDK read/write cadence or provider configuration change. **Existing Worker and InventoryCore remain the sole business authority.** App vc115, Agent v140, Web3.1.2 and D170 OAuth same-origin/CSRF compatibility remain separately Owner-gated.

## Requirement → contract → test → status

- Write exactly one authoritative business transaction per valid `request_id` under concurrency; preserve same Picker/SKU report dedupe, server-generated sequence and notification event; `tests/d171-usage-hotpaths.test.mjs` static/source checks plus existing D165/D169 API tests. **Source checks ≠ runtime/field PASS.**
- For online Picker/Reporter: no polling, same websocket and push precedence; on disconnect, invalid sequence or version mismatch use existing authoritative cursor delta/reconcile. Existing offline report prohibition unchanged.
- UI: initial report/result ACK, queue badges, Reporter resolution/correction at least same speed; no new client action.
- Keep 15s/20s HA/confirmation invariants and 20/35s single requestId/ACK in Agent/PDA completely untouched by this source change.
- Privacy: internal FCM target tokens never in public response/error/log; fallback does not expose device identifiers or raw payload. Public repo stores no raw billing screenshots, log bundles, secrets or device/account details.
- Rollback: restore three previous source files, same backend schema/data and URLs; new Worker must be deployed only with corresponding InventoryCore implementation, otherwise fail closed on unavailable private endpoint.
- D170 reconcile gate: after official OAuth Worker main baseline, recompare PR656 vs main, preserve `configuredCallback.origin === url.origin` and CSRF guards, exact-head typecheck + Web/Android/Windows/Authority/Continuity CI; **do not merge main just to test**.

## Provider and latency acceptance, not yet proved

Capture Inventory-specific DO route diagnostics from the existing manual D166/D167 snapshots (process-local, restart-reset, not billed), provider account DO/Workers billing screenshot by same provider cycle/timezone, and App/Agent/Web sanitized day-correlated operational logs. Compare two equivalent actual operational shifts and normalize by active PDA-hours, reporter-hours, reports, resolves, corrections, catalog syncs and Worker requests. Report observed Worker→DO amplification, DO compute requests, rows read/written, CPU/duration, Worker standard requests, retries, reconnections, P50/P95/P99 event-to-render/ACK. Always distinguish actual vs estimated, shared-account other projects and missing coverage.

**Hard failure:** any regression in auth/session revocation, idempotency, FCM result/ACK, SSE/WS order, UI realtime, HA/Agent Picklist WMS, data integrity, P95/P99 or costs. No fixed percent saving is promised. No production deployment until a fresh explicit Owner post-shift authorization with source/CI and canary/rollback receipts.

## Current status

**Implementation staged on D171 #656; exact final CI, test runtime, cross-main reconciliation, billed usage, physical field and Owner PASS pending.** Existing official App 114 / Agent 139 / Web 3.1.1 and main Worker untouched by this change.

## E048 latency guard (source-only continuation)

Because resolving/correcting a batch may fan out FCM to many Picker devices, serialized device-token reads **must not be moved synchronously onto the critical Reporter mutation path without same-load P95 proof**. Candidate source uses in-object FCM preparation only for the small Reporter-facing **new-report** notification; for **resolution and correction**, the Worker still looks up targets asynchronously through existing `ctx.waitUntil` after the committed authoritative response. A/B and D remain applied across their defined hot paths. This deliberately trades some DO Compute Requests for safer customer-visible result latency; do not claim C saves requests on all FCM events. A future extension requires tested bounded target count and end-to-end latency/billing evidence.


## E049 Worker/Core envelope compatibility hardening — CODE ONLY

The one-invocation shortage mutation returns a private `{result, prepared}` envelope. The Worker **must** return only `result` to public clients and use `prepared` only inside background notification processing. If a mixed-version Worker/Core returns a malformed/missing `result` envelope, fail closed with `D171_INVENTORY_CORE_VERSION_MISMATCH` (HTTP 503), not a raw internal response that could disclose FCM target tokens. No transaction retry, new Provider/DO request or data migration is introduced. This is covered by `tests/d171-usage-hotpaths.test.mjs`; runtime/field delivery remains separately unverified until canary.
