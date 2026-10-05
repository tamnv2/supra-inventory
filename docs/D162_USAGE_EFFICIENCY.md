# D162 — Usage Efficiency Without Latency Regression

Status: OWNER APPROVED IMPLEMENTATION  
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
