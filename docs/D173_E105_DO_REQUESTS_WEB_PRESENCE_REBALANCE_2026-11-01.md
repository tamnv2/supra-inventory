# D173-E105 — DO Requests rebalance: Web background Presence (2026-11-01)

## Authority, isolation and screenshot
Owner asked to reduce Cloudflare DO Compute Requests without changing business response, realtime, speed or stability, and avoid overage beyond Workers Paid $5 base fee. Existing inventory Worker and InventoryCore only; separate historical Stable remains OWNER-GATED; D172 remains independent PENDING/HOLD. Do not touch D172 business implementation or shared Worker/auth/core without cross-regression and scoped authorization.

Screenshot of Cloudflare **shared account** Billing (cycle 2026-10-19 to 2026-11-18, snapshot Nov 1): DO Compute Requests 530.26k / 1M included, DO Rows Read 4.11B / 25B, Rows Written 1.36M / 50M, Workers requests 411.91k / 10M; all showed $0 billable at capture. Account-level usage is not proven Inventory-only. Simple 14/31-day extrapolation yields about 1.17M raw DO requests if unchanged; this is not a billable projection, because DO WebSocket inbound messages have 20:1 billing treatment. $5 is a base subscription, not an enforceable spending cap; no overage guarantee is possible from a source patch alone.

## Verified repository findings
- Web uses WebSocket push and bounded cursor/epoch recovery. A 5-second Web realtime interval returns without network when the socket is connected.
- Android uses WebSocket push / delta recovery already. Reporter/Picker snapshots are recovered on demand; do not remove event-sequence safety.
- Agent-PDA WMS confirm / HA remains on Firestore; not a suitable DO request migration.
- Business shortage mutations and common read API paths already combine authorized Worker request and one DO invocation. Historical E055 optimized SQL Rows Read; E086 already implemented Hibernation handler. Do not count such work as new saving.
- The Web dashboard called GET /api/realtime/presence every 30 seconds with no browser visibility check. The backend currently does one DO user lookup then another DO presence read, both for a valid admin session. This is an identified avoidable *conditional* hidden-tab source.

## Implemented CODE candidate
Change only web/src/operational-app.ts: suppress this 30-second Presence polling while document visibility is hidden, fetch immediately upon foreground resume, keep visible dashboard's cadence unchanged, and coalesce overlapping same-tick requests. No API payload, session authorization, WebSocket, server, Worker, SQL, Android, Agent, D172 or provider change. Browser foreground refresh does not claim stale cached data as current.

Tests in tests/d173-e105-web-presence.test.mjs simulate hidden/visible, immediate foreground refresh, in-flight coalescing, inactive/dashboard and no-session cases. .github/workflows/d173-e105-web-presence.yml runs fixture plus Web build on PR only. No deployment from this workflow.

Approximate conditional impact: existing Web presence path accounts for two DO hops per otherwise-scheduled hidden dashboard request, if route is reached with valid admin session. Savings can be zero without hidden dashboard clients. No measured provider-wide reduction or claim of 50% saved. Compare matched shifts by session count, per-route DO invocations, billable usage, latency and error rate; rollback is source-only Web revert.

## Deferred, evidence-gated options
1. Refactor remaining two-hop authenticated low-volume DO APIs only after normalized per-route counters prove relevant volume; session-generation fencing/RBAC and 401/403 exact parity mandatory.
2. Combine only jointly consumed initial and recovery Queue, Counters, and related snapshots, preserving current fields, pagination, timestamps, seq, subscriptions and older APK/Web compatibility.
3. Deduplicate confirmed duplicate client refresh/recovery calls, but never suppress new seq, dirty state, authoritative refresh, ACK, receipt, FCM, idempotency or failover.
No speculative SQL migration to D1, Cloudflare resource creation, or new usage-heavy polling simply to utilize spare quota.

## Status and gates
CODE CANDIDATE; CI pending independent verification; merge/release/field/Owner PASS not claimed. D172 PENDING/HOLD and Stable OWNER-GATED. Branch -> Draft PR -> exact CI and Web compatibility -> Owner-controlled release (separately authorized) -> physical field validation; no Production mutation from this record.
