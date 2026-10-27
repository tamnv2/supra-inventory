# D173-E083 — Usage v152 N/A & grouped five-minute source feasibility (27/10/2026)

## Owner authorization
Owner approved **read-only testing before considering Agent v153**, including all N/A source families and opportunities to minimize upstream usage while the VPS display refreshes each five minutes. No approval to edit/release v153, production Worker, provider configuration, Firebase, D172 OBPP, old Stable, WMS/HA/confirm.

## Observed existing live read-only proof
- GitHub rerun: https://github.com/tamnv2/supra-inventory/actions/runs/40437991574 — rerun job provider-read-only completed SUCCESS on 27 Oct 2026 ~22:40 VN.
- Initial 36 entries: 30 PASS_DATA; 5 NO_DATA; 1 Cloudflare Email old-token QUERY_SCHEMA_OR_PERMISSION.
- Second pass: Agent Log function scoped 30d PASS_DATA; 3 Cloud Run broad project aggregates PASS_DATA but NOT individual picker service; DO SQL Storage only BILLING_SNAPSHOT_AVAILABLE; Cloudflare Email newer dedicated Zone Analytics token PASS_API (one group).
- Account-level Cloudflare Analytics != Inventory-specific billing. Neither latest sample freshness nor exact $ overage verified by those probes.

## E083 purpose and budget
Try **two read-only HTTP requests total** (maximum one Cloudflare GraphQL and one Google Monitoring). Cloudflare combines exactly one account's DO periodic rowsRead/rowsWritten/duration, DO invocation requests, and inventory Worker requests/CPU under one GraphQL request with 5-minute dimensions; Google reads *one* `serviceruntime.googleapis.com/api/request_count` type and splits five allowlisted consumed-API services in local CI memory. Any schema, permission, missing label or missing 75-minute bucket must be reported as unknown, not a zero.
- Do not query business Worker or DO SQL, Firestore documents or RTDB data. No writes, logging identifiers/credentials/metric values, printing API errors/responses, Agent timers, provider resource creation or release.
- `tools/d173_e083_usage_5m_batch_probe.py` runs in one-shot same-repository PR-only beta environment with existing credentials; output only statuses, series counts, age and possible truncation. Seven-day sanitized CI artifact.
- This tests **technical feasibility and freshness**, not actual billable savings or a contractual five-minute API SLA. Compare grouped read against source v152's ~36 baseline calls, but request savings are hypothetical until source code implementation, exact-scope equivalence and comparable-field billing evidence.
- Google Cloud Monitoring timeSeries.list requires exactly one metric type per API request; cross-metric merging is not authorized. Multiple services of an identical metric type may be processed from distinct resource labels if present. Cloudflare multi-dataset grouping may fail as a whole; fail closed and preserve original per-source path.
- All durable API changes, even read-only Worker handler changes, require separate source CI, D172 shared-Worker regression, owner release gate and rollback. D172 remains PENDING/HOLD.

## Stage
TEST SOURCE PR DRAFT; NO PRODUCTION MUTATION; AGENT152 technical release unchanged; FIELD/OWNER PASS not inferred.
