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

## Actual phase 1 provider evidence — VERIFIED 27 Oct 2026

One-shot E085 GitHub Actions: first [run 40545524670](https://github.com/tamnv2/supra-inventory/actions/runs/40545524670), hourly/type refinement [run 40546545595](https://github.com/tamnv2/supra-inventory/actions/runs/40546545595) both **provider-read-only + offline-source-check SUCCESS**. Artifact: `d173-e085-do-phase1-readonly` (sanitized aggregated, 7 days). Cloudflare GraphQL: DO periodic 66 groups, invocation 249 groups, Worker 66 groups, all <1000 limit, **COMPARABLE_WINDOW**.

Exact matched 22 complete clock-hours (01:00–22:59 VN) 26 Oct versus 27 Oct. E055 Worker went live around 00:38 VN 27th. Providers are sampled/account-wide DO aggregates, not a billable invoice or strict same-volume A/B test.

| Metric | 26 Oct | 27 Oct | Change |
|---|---:|---:|---:|
| DO SQL Rows Read | 644,427,820 | 131,187,849 | -79.64% |
| DO SQL Rows Written | 149,078 | 177,144 | +18.83% |
| DO Requests | 42,461 | 56,359 | +32.73% |
| DO Errors (all nonsuccess statuses) | 1,633 | 2,684 | +64.36% |
| DO Duration GB-s | 358.79 | 473.50 | +31.97% |
| DO CPU Time (provider units) | 329,510,952 | 272,738,460 | -17.23% |
| Workers Requests (official script-filtered) | 34,222 | 46,140 | +34.83% |
| HTTP DO invocations | 40,947 | 53,771 | +31.32% |
| Hibernation DO invocations | 1,495 | 2,559 | +71.17% |
| WebSocket outbound messages | 7,314 | 16,613 | +127.14% |

Normalized: Rows Read/DO request 15,176.9 -> 2,327.7 (-84.66%); Duration/request 0.0084499 -> 0.0084015 GB-s (-0.57%); DO Requests/Workers Requests 1.2408 -> 1.2215 (-1.55%). Overall Duration growth **tracks request volume**, not evidence of an account-wide duration-efficiency regression; however the 19–20h local anomaly deserves specific inspection.

### Error mix: DO Errors is not the same as real exceptions

| DO invocation class | 26 Oct | 27 Oct | Change |
|---|---:|---:|---:|
| clientDisconnected (HTTP) | 847 | 2,093 | +1,246 |
| clientDisconnected (alarm) | 2 | 2 | 0 |
| scriptThrewException (hibernation) | 69 | 27 | -42 |
| scriptThrewException (HTTP) | 3 | 0 | -3 |
| other non-success HTTP statuses | 712 | 562 | -150 |

Thus the whole +1,051 total DO Errors delta equals +1,246 disconnections -45 exceptions -150 other statuses. The HTTP disconnect increase is not proof of WMS/ACK or business failure. All 27 Oct unhandled DO exceptions are **hibernation-type**, concentrated in 08:00–08:59 VN (27). Hibernation WebSocket active source in `service/src/read-model-core.ts`: `state.acceptWebSocket(server,...)`, `state.setWebSocketAutoResponse(ping,pong)`; `InventoryCore` in `service/src/core.ts` defines `webSocketClose` and `webSocketError` but has **no `webSocketMessage` handler**. Cloudflare documents incoming application messages are delivered to `webSocketMessage` for accepted hibernatable sockets. This is a **source defect candidate**; exact exception stack and client message triggering remain unproven. Do not implement a blind no-op or change message protocol without checking clients.

### Hot hours
- 27 Oct clientDisconnected peaks: 13h=456, 14h=360; combined 816/2,095=38.95%. 11h=221, 19h=207.
- 27 Oct 19h+20h Duration = 66.25+113.78 = **180.03 GB-s** vs 26 Oct same hours 12.06+10.29=**22.35 GB-s** (+705.5%), while DO Requests = 5,014 vs 4,072 (+23.1%). Isolated lifetime/hibernation or long-in-flight investigation required; no proof of one particular root cause.
- 27 Oct 08h: 27 hibernation exceptions; 26 Oct 16h: 71 hibernation exceptions. Correlate with deployments/WS messages and safe observability before modifying.
- DO Requests increase nearly matches official Worker traffic (+32.73% vs +34.83%); **no measured request amplification regression**. No blanket throttling or caching.

## Proposed stage 2 scope for Owner approval — not yet authorized

**P1 — WebSocket/hybrid transport correctness, source-supported candidate:** Audit application-frame contract and implement missing/necessary `webSocketMessage` handler only if reproduction confirms errors. Preserve automatic ping/pong, serialized attachment, original RBAC/session-generation, primary/standby, reconnect idempotency and actual Android/Web realtime. Verify 08h hibernation exception reproducer plus regression test. Separately test 13–14h HTTP client cancellation; do not assume same cause.

**P2 — Conditional HTTP disconnect mitigation:** Only after read-only diagnostic route/cancel correlation establishes aborted long requests/reconnect races, add bounded operation cancellation handling or deduplication at proven path; preserve authoritative mutation fence/ACK and do not short-circuit WMS work. A blanket HTTP retry, timeout reduction or suppression would be unsafe.

**P3 — Selective DO double-hop reduction:** `requireUser` path in `business-api.ts` fetches identity from Core before a separate mutation. Build exact callgraph + post-E055 route-family counts and stage a single-Core-operation variant with identical authorization/session checks. **Do not change `authorizedGet` which already uses one Core operation**. Measure requests/operation, latency, deny/expired generation, Android/Web and D172 isolation before deploy.

**HOLD** broad DO request reduction because DO/Worker ratio improves -1.55%, E049 telemetry batching because Rows Written per DO request decreased and durable lossless guarantee is critical, further SQL E055 query changes because -79.64% provider improvement and no remaining identified query cause after E055. Reserve these unless new source attribution supports them.

Stage 1 **PROVIDER COMPARISON PASS, SOURCE INVESTIGATION PASS**. Exact client cause/stack traces & installed FIELD acceptance remain **PENDING**, so `E055 FIELD/OWNER PASS` cannot be inferred from Cloudflare graphs alone. Stage 2 source implementation **PENDING EXPLICIT OWNER APPROVAL**; no Worker, provider or D172 mutations took place.
