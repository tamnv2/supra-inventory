# D166 — Inventory Usage & Reliability Reset

Status: **IMPLEMENTATION OPEN — Owner explicit start 2026-10-08**  
Accepted Inventory base: **D163 Owner PASS**  
Predecessor: **D165 closed/superseded without Owner PASS after field/usage review**  
Stable: **OWNER-GATED — untouched**

## Purpose

D166 preserves or improves business correctness, PickList confirmation speed, realtime UI, failover safety, acknowledgement reliability and authorization while removing abnormal request/read amplification. Usage reduction is not allowed to trade away those invariants.

The 2026-10-07 field/usage review identified these primary defect classes:

- stale Picker result receipt IDs can be retried after the acknowledgement row is already gone, creating repeated 404 traffic;
- Android support/crash JSON was truncated after serialization, which can make persisted JSON invalid;
- asynchronous update checks can attempt to show a dialog after Activity teardown;
- some Worker/internal fetch responses have no explicit body owner, matching the Cloudflare stalled-response warning class;
- hot Picker reads include an unused total COUNT and repeated correlated acknowledgement lookups;
- normal realtime events still cause broader list reconciliation than necessary in some Android paths.

## D166 contracts

### Terminal result receipt

A valid authenticated receipt for a result already absent/retired is a terminal idempotent no-op. It returns 2xx with an explicit terminal marker. It must not emit a false reporter acknowledgement event. New clients must keep receipt delivery bounded/single-flight.

### Valid diagnostic JSON

Serialized JSON must never be truncated mid-token. Runtime/support/crash persistence must keep syntactically valid JSON.

### HTTP response lifecycle

Every fetch response has one explicit owner: parsed/consumed, returned to the caller, or explicitly cancelled/discarded.

### Realtime/read target

Normal path is authoritative transaction -> bounded realtime event/snapshot -> exact local patch -> repaint. Full reconcile is reserved for initial load, manual refresh, real cursor gap, epoch mismatch, incompatible payload or integrity uncertainty.


## Shared-account budget policy

The Owner plans three product umbrellas: Inventory, Pick Pack, and Alpha. Alpha may later contain multiple projects, but its allocation is subdivided only inside Alpha unless the Owner explicitly rebalances the global policy.

Internal planning allocation:
- Inventory: **30%**
- Pick Pack: **30%**
- Alpha: **30%**
- shared/resilience reserve: **10%**

The 10% reserve covers common Inventory/Pick Pack data, provider variance, recovery and bursts. It is not normal operating capacity.

Provider meters are independent. Unused Worker CPU cannot literally become Durable Object requests, and unused Firebase quota cannot become Cloudflare quota. D166 therefore balances **architecture**, not quota units:
- bounded extra DO writes/index storage may eliminate much larger repeated reads;
- RTDB may carry tiny Agent HA liveness while Firestore remains authority/fallback;
- realtime/in-memory projections may replace repeated Worker/DO list requests;
- last-good monitoring snapshots may replace advisory monitoring retries.

Using the included limits visible in the Owner's Cloudflare billing evidence, the 30% Inventory planning envelope is:
- Workers Standard requests: <= 3.0M/month;
- Workers CPU: <= 9.0M ms/month;
- Durable Object requests: <= 300k/month;
- Durable Object compute duration: <= 120k GB-s/month;
- DO SQL rows read: <= 7.5B/month;
- DO SQL rows written: <= 15M/month.

These are internal planning values tied to the displayed plan and must be revalidated when provider limits change.

## Agent / Firebase policy

Firestore remains business and HA authority where already defined. Existing Beta RTDB may carry tiny liveness only; takeover/WMS mutation still requires Firestore generation/PRIMARY fences. RTDB failure falls back to Firestore. No business payload, password, token or WMS session material may be stored in RTDB.

Healthy-listener REST watchdogs are not slowed merely to save reads if doing so can threaten the 20-second PDA terminal window. The Usage/Monitoring UI is advisory and its failure must never affect business health.

## Acceptance gates

Under comparable load:
- no stale result receipt can create an unbounded retry loop;
- no Android crash from invalid truncated diagnostic JSON;
- no update-dialog BadToken crash in representative field testing;
- zero new D166-attributable stalled-response/deadlock warning in a representative full shift;
- PickList speed, realtime behavior and failover are not materially worse;
- measure receipt requests per delivered result, edge 4xx by route, Worker requests per business transaction, DO requests/rows read per transaction, Firestore reads/writes per PickList transaction, and RTDB load if liveness is enabled;
- materially reduce Worker/DO request/read amplification enough to make the Inventory planning envelope feasible without consuming the shared reserve in normal operation.

D166 changes only scoped Beta resources, follows branch -> PR -> authority/continuity/component PASS -> merge, and cannot become accepted base until explicit Owner field + usage PASS.
