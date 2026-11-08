# D173-E169 — Owner-approved Cloudflare/Firebase root-cause attribution (08/11/2026)

## Authorization / boundary
Owner says "Ok chốt bổ sung" following a review of the *missing log and Service evidence* needed to identify Cloudflare DO Requests/Rows Read and Firebase Firestore PermissionDenied/RTDB/HA causes. Authorization covers scoped diagnostic CODE and tests in existing services only. No explicit new Production release instruction, Firebase Rules deployment, resource creation, SQL rewrite, new poller, WMS transaction or Stable cutover.

Do not reopen historical accepted/cancelled D173 tasks. The report is diagnostic CODE, not a claim that the original provider/authorization root causes are already proven.

## Existing evidence to retain
- D173-E122 authenticated SQL Query-ID collection measured 213,051,618 SQL rows read over its bounded sample; RECENT_ACK_TOTALS was 183,311,629 / 5,425 executions (~86.04% **of measured query coverage**, never of account billing).
- E049 existing per-invocation ROUTE and per-cursor SQL durable hourly counters already add one SQLite UPSERT per recorded event; adding another per-event diagnostic write would worsen Rows Written.
- E128 Production preserves a **single HTTP business command path**. Do not blame active WS hedge/fallback without evidence that a particular installed client/build negotiated the removed capability.
- D173-E140 Agent lock listener receives real PermissionDenied; subsequent cooldown 300000ms reduces retries but does not fix Rules, claims or query cause.
- D173-E141 HA proven PRIMARY lease expiry / takeover, not proven exact reason for heartbeat interruption; separate RTDB transport and Firestore lease facts.

## Implemented CODE on E169 branch
1. **Worker/InventoryCore (no extra invocation/write):** `service/src/d167-route-usage.ts` splits existing fixed ROUTE labels into REALTIME_TICKET, REALTIME_CONNECT, REALTIME_PRESENCE, REALTIME_DELTA, REALTIME_BROADCAST, REALTIME_CLOSE, HEALTH_PROBE, MAINTENANCE_PLAN, NOTIFY_TARGETS and NOTIFY_CLEANUP. Every DO invocation still has *exactly the original* `recordD173PersistedMetric` upsert; no additional DO call, network request, cron or timer. Group is allowlisted path classification, not an external caller identity or an HTTP billing receipt. Legacy REALTIME, OTHER, etc. remain.
2. **SQL root shape (no extra query/write):** existing RECENT_ACK_TOTALS SELECT now also returns `candidate_batches` and `missing_summaries` from the *same aggregation*, retaining existing ACK totals. `recordD173AckShape` emits **at most one** fixed, anonymous `D173_E169_SQL_SHAPE` log per active InventoryCore isolate/hour. Source is FIRST_PER_ISOLATE_HOUR; it is volatile/restart-dependent and **not** a complete daily count. E049 SQL Query-ID rows_read/rows_written/latency remain intact; no per-query extra SQL UPSERT.
3. **Agent Firestore:** `FirestoreD173E140PickerLocks.cs` emits `FIRESTORE_LISTEN_FAILURE` only on actual exception with gRPC code, fixed query/collection class, allowlisted role/base-role, presence of app-user claim (boolean), token expired (boolean), attempt count and duration. Recovery upon successful `Current` indicates how many failures preceded recovery. Never log session token, RPC detail, UID, PickList or raw query values. This does **not** prove whether Production Rules, token claims or an index/query mismatch caused the denial.
4. **Agent RTDB/HA:** `RtdbHaLiveness.cs` logs only a heartbeat ACK slower than 2 seconds, existing fail transition with elapsed time, exception-only HA probe failure class, and first SSE outage duration. `FirestoreAgentLeaderCoordinator.cs` appends lease ACK/coordinator ages to existing slow/fail warning branches. 10-second heartbeat and 15-second failover thresholds stay unchanged. No new Firebase read/write/listener/heartbeat frequency.
5. **Tests:** `tests/d173-e169-diagnostic-attribution.test.mjs` verifies fixed categories, no extra route writes/provider network, SQL same-query shape, role/privacy scrubbing, and HA unchanged timing. Must run source/native/SQL parity/security and isolated shared-resource regression through CI before any release discussion.

## Root-cause evidence still required
- Cloudflare: join new ROUTE hourly counts with same-window provider DO billed requests, exact operation workload, and E049 SQL IDs; Workers route event counters are **DO internal invocation estimates** and Provider billable request scope may be account-shared. HTTP path E128 means classify true HTTP work vs refresh/cron/retry using existing client/service events; no unverified WS hedge claim.
- SQL: existing heavy query plans and summarization parity must be checked against live counters, plus whether the once-hourly first shape sample represents load. A first sample alone cannot prove full-day cardinality; no general full coverage claims.
- Firestore: compare active deployed Rules hash, auth claim *classification* and exact query behavior from provider-side evaluation. E169 diagnostic only records client-side evidence and cannot by itself prove Rules drift.
- RTDB/HA: correlate heartbeat send/ACK/error, RTDB observer outage, primary coordinator age, standby takeover decision and provider metrics with clock-aligned Windows logs. Avoid equating RTDB timeout with lease expiry.
- **Daily 05:30:** existing provider collector does not yet have a verified authenticated Drive log-coverage join. Missing/late log bundles and unavailable provider data remain `PARTIAL / UNATTRIBUTED`, never 0 or PASS. Do not claim that this code alone implements complete provider-to-device-log forensic joins.

## Acceptance / safety
- No secret/token, SQL/PL/body/UID, WMS session, raw exception or PII in committed source telemetry.
- Existing Web/Android/Agent operational results, 05:30 schedule, 2-hour logs, retry fences, HA generation and DO SQLite state unchanged.
- Exact source CI: TypeScript, Node contract and operational SQL parity, Windows native compilation, existing Firebase Rules security, protected shared-resource regression, use differential latency/Rows Written checks. No manual Provider change.
- Distinguish CODE / CI / RELEASE / FIELD / OWNER. Status at creation: **CODE CANDIDATE; PR/CI pending; RELEASE NOT AUTHORIZED; FIELD/OWNER PENDING**.
