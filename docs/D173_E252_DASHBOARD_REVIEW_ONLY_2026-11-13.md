# D173-E252 — Web 3.3.17 Tổng quan Inventory: redesign REVIEW ONLY (13/11/2026)

## Authority / scope
- Owner requests a complete **design review** of the D173 Inventory overview, operational root-cause cues, by-hour/by-day last-seven-days comparisons, minimal Cloudflare usage, and a source-buildable layout. **No code implementation, Production rollout, or Owner PASS authorized in this instruction.**
- Verified published source: Web 3.3.17, PR #968 MERGED at source main `d8aa54cfbff78b5480f7fb17c4489ae06f6d9181`; Deploy Beta Worker 43362731384 SUCCESS. PR #969 docs receipt MERGED; field/Owner acceptance of the release remains separate.
- Sources inspected at that exact source ref: `web/src/operational-app.ts#renderDashboard/loadDashboard/refreshDashboardPresence`, `web/src/api.ts#AdminDashboard/OperationalInsights/D167AreaSummary`, `service/src/business-api.ts`, `service/src/core.ts`, `service/src/d167-area-report-core.ts`, `docs/specs/REPORTING_DASHBOARD.md`, `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`.
- D172 OBPP independent HOLD, shared service/Core changes must preserve isolation tests. Stable OWNER-GATED.
- No personal/operational case contents or uploaded screenshot in public source.

## Verified existing data/behavior
- `loadDashboard` retrieves **three separately authorized reads** `/api/admin/dashboard`, `/api/admin/operational-insights`, `/api/admin/d167/report/summary`; presence via `/api/realtime/presence` on opening and while visible (30s timer). Do not assume exact DO-billed invocation count without current route measurements.
- `AdminDashboard`: period `hour|day` bucket, `reports_count`, `unique_sku_count`, affected/current Picker, pending/resolved batch, average duration, timeline, results/source breakdown, recent resolutions, top SKUs.
- `OperationalInsights`: SLA configured/warning/escalated and recurrence top SKUs (count/latest report); no proven physical inventory root cause.
- `D167AreaSummary`: LTA/SHELVING/UNKNOWN assigned **as of first report** from historical area evidence, counts by batch, ticket, distinct SKU and final status.
- `d167-area-report-core.ts` currently obtains area-as-of and per-batch ticket counts using correlated SQL subqueries; simply running 168 independent hourly scans over seven days could amplify Rows Read. Existing `/d167/report/timeline` is **SKU-area history**, NOT the 7-day operations chart.
- Current UI places full area table, five current KPI, presence-by-role grid, period grid, outcomes, recurrence and recently processed list before a small time trend. The data-meaning and top-of-page priority should change, not just card styling.

## Proposed user-facing information architecture — not approved yet
A. Compact overview/report tab plus Today / last 7 VN calendar days / hourly vs daily / area selector and clear data freshness.
B. Highest priority live alerts: pending open batches, affected Pickers, warning/overdue if configured, oldest wait. The live snapshot is **not** narrowed by a history period.
C. Period core KPI: new batches (cohort by first_report_at), picker report tickets, unique SKU, processed outcomes (HAS_STOCK + SKIP_ALLOWED), picker withdrawals (CLOSED), latency. Keep denominators and current-vs-cohort meanings explicit.
D. Hourly trend (selected day) and 7-day daily trend, optional 7×24 heatmap only with source-proven server buckets. Differentiate **created-in-bucket** from **terminal-event-in-bucket** and do not infer historical backlog by naive subtraction.
E. Area LTA/Shelving/Unknown comparison: batches, tickets, affected Pickers as supported, resolved/Skip/withdrawal and latency where source exists; annotate count-only comparison cannot establish area error rate without workload denominator.
F. Triage panel: currently open/overdue, repeated shortly after previous resolution, unusual hourly surge, system-timeout vs human Skip, unknown area; drill into existing authorized detailed reporting.
G. Recurrence evidence: same SKU separate batch episodes, previous terminal timestamp, next first report, recurrence interval and former outcome where available; never rewrite historical batch identity.
H. Result composition: HAS_STOCK, human Skip, SYSTEM_TIMEOUT, SYSTEM_DAY_END, CLOSED. Use honest `—` for missing provenance and avoid percentage denominator mixing.
I. Replace oversized full recent-resolution wall with compact 5-row evidence/drill-down list; online Web/PDA presence moves to minimal status/header, no fabricated agent online count or device operating status.

## Data semantics and investigation guards
- Treat `SKU phát sinh lại`, `có hàng rồi lại thiếu`, `tăng đột biến theo giờ`, `Skip do hệ thống` as **data-supported signals** only; physical shortage / incorrect bin stock / replenishment failure / personnel fault require independent evidence not present in these API contracts.
- Last 7 VN calendar days includes current incomplete day. Compare current day to previous day's **same elapsed local clock interval**, never full previous day.
- Distinguish hourly creation vs hourly resolution by each event's own timestamp; corrected/reopened batches need event-history proof before historical end-of-hour open-state metrics.
- `reports_count`, `affected_picker_count`, distinct SKU, closed tickets and completed batches use distinct grains and may not be added interchangeably.
- When SLA is unconfigured, show 'Chưa cấu hình', not zero overdue.
- Preserve existing role policy (ADMIN, ROOT, PICKPACK_ADMIN), history/drilldown bounds, no new cross-module data access or unapproved WMS integration.

## Candidate data/usage architecture — proposed, not measured
1. **Reuse immediately**: existing three endpoint response contracts and realtime updates for today's KPI and charts; no demand for 7 separate hourly/day API calls from UI.
2. **If approved after baseline**: one bounded, read-only, authenticated D173 overview-aggregate response for live summary + 7-day grouped-by-day (7 buckets) + grouped-by-hour (max 168 buckets) + area and recurrence evidence; max 7 VN-day scope, server SQL work bounded/index verified. Same DO/core authority; avoid introducing D1/KV/Queues or per-hour request fanout.
3. Client cache only aggregate snapshots in authenticated RAM scoped to principal, role, filter/day/timezone; reuse while switching hour/day/area, update through existing realtime delta/invalidation, one bounded reconcile on sequence gap; no raw personal/batch lists persisted on disk and no new 30-second analytics polling.
4. Presence can be reduced only if existing realtime membership updates prove accurate equivalent; never silently remove accuracy. An explicit 'as-of' timestamp and refresh action for historical analytics is preferable to constant polling.
5. DO Requests, DO Rows Read, SQL query plan, Worker CPU, payload size, browser render p50/p95, permission matrix and stale-window are tradeoffs; cannot claim zero-usage or guaranteed reduction until measured against published source and comparable production-like test workload. Current D167 correlated area/ticket subqueries require special Rows Read guard.

## Proposed acceptance gates before any code/release
- Visual layout matches existing Tabler/CSS, responsive 1280×720, 1920×1080 and 100/125/150% scaling, no overlapping text, works in light/dark modes.
- Compare existing KPI and category/area data bit-for-bit for 1-day scope; 7-day daily/hourly bins total correctly, inclusive boundaries/timezone DST-neutral VN, incomplete day, missing data and area UNKNOWN.
- Dataset fixtures include same SKU new batches, multi-Picker one batch, withdrawal, human/system auto Skip, correction/reopen, SLA configured/unconfigured, delayed resolutions across midnight, seven-day range boundary.
- No increased Cloudflare DO Request/Rows Read at matched operational traffic baseline, or explicitly Owner-reviewed acceptable tradeoff with forecast and rollback; no more realtime lag/errors.
- Separate D172 independent auth/API/SQL/isolation regressions and Worker/DO shared guards; CODE, CI, RELEASE, FIELD and OWNER PASS remain individually gated.

## Decision pending
Owner review of layout + business definitions + 7-day aggregation/usage tradeoff. Design only; **NO Web/Worker implementation or release permission**. HTML static prototype delivered in chat, not authoritative runtime source.
