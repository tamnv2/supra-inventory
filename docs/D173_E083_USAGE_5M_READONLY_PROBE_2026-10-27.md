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


## Owner E083 thêm tiêu đề chu kỳ đồng bộ từng metric
Owner chốt: tại tiêu đề MỖI chỉ số Usage hiển thị chu kỳ đọc API nguồn hiện được cấu hình (không phải delay provider), ví dụ DO Compute Requests · Sync 5 phút/lần. Ghi phụ đề last successful query, last source point và STALE/NO_DATA tách biệt; UI refresh 5 phút không làm giả timestamps. Phương án build v153 bao gồm sửa History confirm header, bỏ floating PickList, thay tab Cài đặt bằng bottom-left global controls đã duyệt (theme 3 mức, Windows startup, Wi-Fi profiles, Logs). KHÔNG build/release ở PR test này.

## E083 deep READ-ONLY actual results — 27 Oct 2026
- CI E083 verified 4/4 workflows SUCCESS on PR #771 source `fc0d9247805ded666528aa7917e05174049c9de5`; current source test run: https://github.com/tamnv2/supra-inventory/actions/runs/40537936915 (source-check + beta provider-read-only PASS). No provider mutations, WMS or Agent builds.
- Cloudflare one GraphQL request groups 3 nodes covering **six Cloudflare metrics**: DO periodic Rows Read/Rows Written/Duration, DO Compute Requests, Worker Requests/CPU. Each tested grouped vs separated with **same account/worker filters and five-minute buckets**; six comparisons EQUIVALENT_TOL_2_5PCT with no detected bucket mismatch. Node limits now 1000 and TRUNCATION=False for all 3. 288 limit had TRUNCATION=True: never ship 288 full-day query. GraphQL Adaptive can be sampled; no exact invoice equivalence proven.
- Google one same-metric request groups 5 consumed services; paging test returned 1 page for each individual comparison; Identity Toolkit, Secure Token and active earlier Drive samples matched within tolerance when samples existed, FCM/Sheets/Drive may be BOTH_EMPTY at later probes; those are **no-data**, not success for current sample continuity. A Google Monitoring timeSeries.list cannot group different metric.type. Preserve per-metric fallback and allow pagination until complete with hard cap, otherwise TRUNCATED.
- GraphQL/Google one-shot previous E083 smoke consumed 2 HTTP calls for those targeted groups; deeper one-shot baseline comparison + billing consumed **14** total requests including 3 billable endpoints + account subscription list. No measured monthly billing savings from proposed production scheduling.
- Cloudflare Billing V1 `/billable-usage/info`, `/billable-usage` and read-only account subscription listing **HTTP200**; Workers **monthly** subscription with current_period_start & current_period_end verified as present, subscription anchor verified, Worker family V1 billed-cost numerical entry and period-start field present, DO SQL Storage V1 numeric quantity and ConsumedUnit present. Billing V2 `/billable/usage` **403** (restricted), not necessary to force-enable. Earlier `has_cycle_boundaries=false` represented canceled-subscription end_timestamp missing, **NOT absence of active monthly cycle**. Keep exact period and invoice/billed entity cross-check during build; data is shared-account and individual Worker family records cannot be relabeled Inventory-only. Charge forecast not PASS merely from presence of numeric BilledCost.
- Existing E057/E058 rerun: 30/36 direct data 24h; one Agent Log scoped 30d PASS; Cloud Run 3 project-wide only (not per-function); CF Email dedicated Zone Analytics token PASS; DO SQL billing periodic only.
- Provider recency seen in tests: CF DO/Workers latest 3–3.2min; Auth 10–25min; Drive 55–70min when present; FCM up to 60min and absent during later 75min samples; Sheets may have no recent samples. Configured polling interval does **not** guarantee source sample arrives each interval.
- Security: all CI artifacts sanitized: only boolean/source codes/age/bucket counts, no values, tokens, account IDs or billing customer identity. Existing Agent152 binary and Workers unchanged, D172 HOLD independent, historical Stable OWNER-GATED.

## v153 implementation acceptance matrix (NOT IMPLEMENTED)
- Critical: no change confirm WMS/PRIMARY/standby/ACK/Android/Web, no business DO SQL/Firestore/RTDB writes to support monitoring; only authenticated VPS can poll.
- Functional: card header shows true configured sync interval, separate successful-fetch time and source-point time, only label STALE when corresponding freshness policy breached; no false zero or fabricated usage percentage/quota.
- Correctness: full 24h local VN boundary and account/source period; DELTA SUM versus GAUGE latest/max, correct bytes/GB & microseconds→ms and caps, Cloudflare GraphQL limit/pagination and Google resource label grouping + paging.
- Billing: use V1 + subscription current period metadata if same subscription/metric provenance verified, otherwise source-gated N/A; never require inaccessible V2; account-wide shared base USD5 and internal targets separate from billable variable amount and provider tariff.
- UI: History title+sticky headers at scroll/DPI; remove floating PL UI/logic only; bottom sidebar global LIGHT/AUTO/DARK + Windows startup + saved Wi-Fi controls + log buttons without altering functionality/security.
- Workflow: separate feature branch from latest main, Owner-approved source scope, agent/Worker guarded CI including D172 and WMS/HA, signed release only after explicit v153 release command, installed Windows FIELD + Owner PASS distinct.

## Final E083 decision
**READ-ONLY E083 TEST PASS / SOURCE CAPABILITY VERIFIED. v153 SOURCE BUILD READY FOR SCOPED IMPLEMENTATION, NOT CODED OR RELEASED.** Preserve PR #771 Draft for test record, no main merge or deploy.
