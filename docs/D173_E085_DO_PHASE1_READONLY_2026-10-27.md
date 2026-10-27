# D173-E085 — Giai đoạn 1 kiểm chứng DO Usage (READ ONLY, 27/10/2026)

## Owner command / release boundary
Owner ordered: **run phase 1 only** to (A) verify D173-E055 usage reduction, (B) investigate Durable Objects Errors/Compute Duration, and (C) identify DO Requests that might be redundant; **after phase 1, propose evidence-supported phase 2 repair items for separate Owner approval**. Agent Usage/UI optimization proceeds independently and is OUT OF SCOPE. No Worker/InventoryCore/Web/Android/Agent, auth, WMS, D172, Firebase, billing, production configuration, secrets, or Stable mutations in this stage. Branch and Draft PR contain diagnostic-only source, workflow and authority checkpoint. No stage-2 implementation authorization.

## Exact E055 production release boundary
Official Worker main source `36a87805d66e9356915b47303ac7fa2597697b09`; E055 release workflow run `40370323444`, job `121738996010` emits `D173_E055_EXISTING_WORKER_RELEASE_PASS` at **2026-10-26 17:37:25 UTC = 2026-10-27 00:37:25 VN**. Production health verified after deployment, so safe post-rollout comparison excludes 00:00–00:59 VN and uses hour 01:00 onwards. Historical E056 proves CODE/CI/RELEASE; FIELD/BILLING savings not automatically PASS.

## First-pass evidence already available
- User Cloudflare 24-hour dashboard Oct 27: DO SQL Rows Read around **133 million**, Requests around **57,000**, Errors **~3,000**, Billable Duration **~475 GB-s**, DO Errors +63.29% and Duration +311.6%; compared to historical Oct 26 24h Rows Read ~645M. These are **rolling windows**, cannot constitute a normalized causal estimate.
- E055 Oct 26 internal allowlisted SQL cursor only **7,513,801 rows read** versus provider ~645M. Unattributed gap ~637M, or 98.8%, remains unproven.
- E055 deployed optimized RECENT_RESULTS_PAGE/COUNT, RECENT_ACK_TOTALS, PICKER_REPORTS_PAGE, indexed realtimeStreamMetadata MIN/MAX; no proven post-release matched 24h field billable result yet.
- Existing E049 SQLite hourly `d173_usage_counters` logs allowlisted SQL and route-family data for 35d and adds one SQL UPSERT per measured event. Never equate local cursor metrics with provider billed rows read, and never add telemetry write/poll for phase 1.
- E083 authenticated provider read-only GraphQL grouped status and freshness tests succeeded (PR #771). Provider measures shared-account DO namespaces, not InventoryCore-specific billing without verified namespace attribution.
- Cloudflare DO invocation status may include **clientDisconnected**. Such disconnect is not equivalent to WMS/ACK failure; distinguish `scriptThrewException`, `exceededResources`, `internalError` before prioritizing fixes.

## E085 read-only methodology
- PR-only GitHub Actions, pre-existing beta Cloudflare read token. Query one bounded GraphQL HTTP request combining: DO periodic hourly Rows Read/Written, Duration, ActiveTime, CPU and WS messages; DO invocations by hour/status/script; inventory Worker requests/errors/CPU by hour.
- Compare **matched Vietnam clock hours 01:00–last complete hour** between 26 and 27 October. Flag incomplete dataset, GraphQL schema/permission errors, row truncation, missing hourly coverage. Data sampled/provider analytics, not exact invoice, and partial current day can be highly workload-dependent.
- No SQL readback of DO business tables because authenticated privileged diagnostic access is not available in CI; do not circumvent RBAC or use service identity for user impersonation. Exact *post-release route-family* counter needs separately authorized actual diagnostic export with privacy guard; without it route-level savings remain NOT VERIFIED.
- Aggregated artifact contains no usernames, employee IDs, account/namespace IDs, tokens, raw errors, business payloads or paths; retained 7 days. Only fixed metric totals and allowed status categories.
- Do not infer Worker exception rate from DO Errors, nor a Durable Object's WallTime P99 from DB query latency.

## Source-derived possible stage 2 candidates — PROPOSE ONLY
1. **Auth double DO hop on selected mutations**: `service/src/business-api.ts` `requireUser()` verifies Firebase ID token then `coreUserByFirebaseUid()` calls `/auth/user-by-firebase-uid`, followed by a second Core call for the business transaction. `authorizedGet()` already handles interactive auth+RBAC inside one Core call and is NOT subject to the same blanket redundancy claim. Candidate: consolidate *only provably duplicate* identity fetch plus business write within the same DO operation while preserving sessionGeneration / channel / role check and deny tests. Must measure affected route volumes before any implementation.
2. **High-frequency GET / operational reads**: correlate post E055 hourly route diagnostics for REPORTER_COUNTERS/REPORTER_BATCH_TICKETS, PICKER_RESULTS, REALTIME, OTHER_OPERATIONAL, AUTH_SESSION. Optimize calls only when source proves redundant and client-result equality is tested; no blind caching, no timing compromise.
3. **E049 telemetry UPSERT overhead**: review write volume / latency. Separate from DO Requests (SQL writes are not automatically DO compute request counts). Lossless batching requires restart/crash durability guarantee; don't replace counters with RAM/sampling.
4. **Errors/Duration**: only scope fixes after provider DO invocation statuses and error timing versus release, alarm, WebSocket, server request waiting. The source `InventoryCore` has alarm and WebSocketClose/Error handlers but does not itself prove a reconnect or hibernation defect.

## Gates/status
- Source code audit: PASS for candidate detection; actual post-release provider comparison: PENDING one-shot CI evidence.
- No fixed absolute cost saving or route-level contribution claimed without matched provider+internal data and workload.
- Phase 2 scope and release remain OWNER APPROVAL REQUIRED. D172 PENDING/HOLD independent; any later shared Worker/DO changes require D172 cross-regression. Historical Stable OWNER-GATED.
