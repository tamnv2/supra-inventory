# D162 — Usage Efficiency Without Latency Regression

Status: TECHNICAL RUNTIME RELEASE PASS — FIELD USAGE VALIDATION PENDING  
Accepted base: D161 / main c3791eeae1295020d75be32002e52dc448a5d23e  
Environment: Beta only  
Android: beta-vc97 hard-locked unchanged  
Stable: OWNER-GATED, untouched

## Objective

Reduce abnormal Cloudflare Durable Objects and Firestore operations while preserving or improving current business latency, realtime delivery, availability and D161 behavior.

Observed 2026-10-05 baseline under the current operating day:
- Cloudflare external requests: about 39.76k / 24h.
- Durable Objects requests: about 119k / 24h, approximately 2.99 DO requests per external request.
- Durable Objects storage rows read: about 68M / 24h.
- Firestore: about 17k reads and 8.5k writes / 24h.
- High-volume HTTP routes include picker result receipt, reporter queue/recent, picker reports/results and realtime delta.

These are comparison baselines, not fixed daily quotas; D162 acceptance uses comparable-load ratios and no-regression behavior.

## Authorized implementation

### A. Service / InventoryCore

1. Remove per-request `/operational/init` probes from ordinary authenticated API traffic. InventoryCore already initializes Operational V2 schema inside Durable Object construction; explicit readiness remains available through health/startup diagnostics.
2. For high-volume routes, combine authoritative user/session/role validation and the business read or result-stage operation inside one InventoryCore invocation where contract-equivalent.
3. Do not cache user/session authority at the edge in a way that delays account disable, role change or session-generation revoke.
4. Preserve exact response/error semantics needed by Web/Android clients.
5. Add bounded aggregate telemetry by route/status/error code. No per-request provider log write.

### B. Web

1. Split Reporter queue and recent-result refresh.
2. Realtime `reporter_queue` refreshes queue only; `reporter_recent` refreshes recent only; both scopes may refresh both.
3. Off-section badge refresh must not load recent results merely to update queue state.
4. Full snapshot remains on initial load, manual reconciliation, realtime gap/reconnect and integrity recovery.
5. No new polling cadence.

### C. Windows Agent

1. Existing Firestore pending listener is the normal fast path.
2. While the listener is healthy, suppress the 3-second REST pending query and use only a bounded watchdog exact read.
3. On listener disconnect/unhealthy state, immediately resume the existing fast degraded fallback; listener-delivered requests always wake the canonical D160/D161 pipeline immediately.
4. Preserve HOT/burst behavior and all pre-WMS-mutation safety fences.
5. Presence ACK writes may be removed only after source-wide proof that no producer/consumer requires them. Otherwise coalesce/dedupe without increasing cadence.
6. Android/PDA is unchanged.

## Acceptance targets

Under comparable active-PDA/reporter workload:
- DO request amplification for D162-covered hot paths should approach one business DO invocation per external request; overall DO requests should fall materially, target at least 40% versus comparable D161 traffic.
- Repeated Operational V2 readiness SQL reads must disappear from normal request traffic.
- Firestore reads should fall at least 70% in steady listener-healthy periods; listener failure fallback must preserve current response safety and latency.
- Firestore writes must not increase; presence-control writes should decrease if the no-consumer proof permits removal.
- Reporter queue/recent API calls must no longer refresh as an inseparable pair for single-scope realtime events.
- p50/p90 normal business latency must not regress materially; request loss, duplicate WMS mutation or stale session authorization is a hard failure.
- Android beta-vc97 binary/source/release identity remains unchanged.
- Authority and Continuity checks PASS before merge.

## Fail-closed rules

Any ambiguity about session authority, realtime sequence gap, WMS readiness, PRIMARY/generation ownership or data integrity must reconcile from authoritative state before business mutation. Usage reduction never overrides correctness.


## Technical runtime release checkpoint

D162 implementation PR #447 was merged to `main` at `9ac67180c310fe56324608e3118671d278f311c6`.

- Beta Worker/Web deploy run `37344066134`: PASS, including post-deploy health/source/schema/Operational V2 checks.
- Repo Authority Guard `37344066156` and Project State Guard `37344066136`: PASS on the merged main commit.
- Verify Beta Relay Agent `37344066196`: PASS.
- Agent release: `relay-agent-v114`, release id `403935863`; canonical EXE asset id `613144745`, size `7298048` bytes, SHA-256 `dabf4b5e4918f741e6b4d806362d8700d507cc8ee045ea632d63f122581eacfe`.
- Runtime channel Agent asset id `613144942` now resolves to v114.
- Android remains `beta-vc97` unchanged; inventory-channel APK asset remains `609733318`.
- Stable remains OWNER-GATED and untouched.
- D162 is not Owner-PASS yet. Comparable active-load usage/latency evidence and explicit Owner acceptance remain required; any failure is repaired under D162.

## Realtime badge lazy-queue repair — Owner approved 2026-10-06

The same D162 change is repaired to preserve realtime feel while reducing off-screen reads:

- `reporter_queue` realtime events carry a bounded `queue_delta` in existing event metadata for queue-changing mutations.
- Web maintains a dedicated realtime queue badge count independent of the full queue rows.
- Full Reporter queue data is fetched only when **Xử lý báo hàng / Operations** is visible.
- **Kết quả gần đây / Results** fetches recent-result data only; it does not refresh the queue.
- A fresh non-Operations surface establishes the badge with a lightweight `getReporterQueue(1, 0)` total read. Normal subsequent queue events update the badge from realtime metadata with no queue fetch.
- Missing/legacy delta metadata and dirty/gap/reconnect states perform one authoritative lightweight count reconciliation rather than a full off-screen queue snapshot.
- No new resource, polling, listener, heartbeat or provider-write cadence. Agent v114, Android vc97 and Stable are unchanged.
