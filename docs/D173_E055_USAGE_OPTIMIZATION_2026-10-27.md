# D173-E055 — Usage SQL optimization (2026-10-27)

Owner approved group 1 fixes followed by group 2 source investigation and code repair. Scope: existing D173 Worker/InventoryCore only. D172 remains independently PENDING/HOLD, Stable OWNER-GATED.

## Evidence from Owner Data Studio CSV
Vietnam 2026-10-26: 41,244 DO route recordings and 21,155 measured SQL executions; 7,513,801 measured rows_read vs ~645M provider-level rows read. The measurement subset cannot account for the discrepancy. Top: RECENT_RESULTS_PAGE 3,154,784 / 1240; RECENT_ACK_TOTALS 1,475,484 / 1240; PICKER_REPORTS_PAGE 851,629 / 1446; PICKER_REPORTS_COUNT 770,622 / 1446; RECENT_RESULTS_COUNT 360,093 / 1240. OTHER_OPERATIONAL GET = 16,157.

## Group 1 source candidate
- Page batch IDs using a materialized sorted/limited CTE before costly detail subqueries; keep exact fields, order, and offset.
- Aggregate ACK by batch/version and distinct target once, with existing batch_summaries authoritative fallbacks.
- Remove redundant RECENT_RESULTS_COUNT by reusing three terminal status counts from the same time window. Eliminates 1240 SQL executions and 1240 E049 per-query writes at observed cadence.
- Picker reports: one indexed latest-target ACK lookup instead of repeated lookups for event ID and four receipt timestamps.
- Keep E049 durable metrics unchanged until a proven lossless aggregation design is tested. Do not replace durable counters with RAM or sampling. 62,399 UPSERT executions are not equal to provider billed rows_written.

## Group 2 source candidate
- Replace simultaneous MIN(seq), MAX(seq) full-table scan in realtimeStreamMetadata with independent indexed scalar probes. Local SQLite benchmark, 100k rows / 10 runs: 6.231ms to 0.011ms; values unchanged. Local test only, NOT a Cloudflare provider billing result.
- Refine OTHER_OPERATIONAL categories to REPORTER_COUNTERS, REPORTER_BATCH_TICKETS and SLA_CONFIG within existing counter write; no new query or telemetry timer.
- The unmatched provider/account rows_read remains UNATTRIBUTED. No fabricated percent reduction or exact source attribution.

## Gates
Source fixture compares SQL results including empty ranges, offset and ACK version fences; guard verifies indexed plan. Run existing E049 restart durability, Worker TypeScript and independent D172 API/auth/Sheet/SQLite regression. Then source-pinned protected PR/release and same-window Cloudflare Rows Read/Written, DO request, latency and error-rate comparison. No new Worker, DB, cron or app/network request; no D172 source modification. CODE_CANDIDATE; CI, RELEASE, FIELD and OWNER acceptance NOT YET PASS.
