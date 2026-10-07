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
