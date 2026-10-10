# REPORTING_DASHBOARD — Canonical Admin/Root analytics UX

Status: **CANONICAL PRODUCT SPEC**.

## Product placement

Reporter daily work is the live operational queue. Dashboard/analytics must never displace or precede that queue for Reporter users.

Admin/Root dashboard remains a compact operational decision overview, not an ornamental BI wall and not an employee scoring system.

## Dashboard purpose

Approved structure:
- one shared date filter / quick presets;
- core report KPIs;
- report/resolution trend;
- resolution outcome breakdown;
- top reported SKUs;
- pending SLA warning/escalation summary;
- recurring shortage summary/top recurring SKUs;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or individual employee-performance ranking without Owner approval.

## SLA reporting

Where SLA is configured, Admin/Root may see:
- pending `WARNING` count;
- pending `ESCALATED` count;
- resolution duration summary based on server timestamps;
- drill-down to affected batches.

When SLA is unconfigured, analytics must say so rather than infer thresholds.

Timing reporting may distinguish configured warning/escalation/automatic-Skip policy and may distinguish `SYSTEM_TIMEOUT` from Reporter resolution. It must not rank employees.

## Recurrence reporting

A recurring shortage is a new batch linked to a prior resolved same-SKU episode. Approved analysis can include:
- recurrence count;
- SKU/product;
- previous resolution time;
- new first-report time;
- elapsed recurrence interval;
- current/final result.

Do not collapse separate batch episodes into one mutable row.

## Critical result ACK reporting

Admin/Reporter operational views may show aggregate acknowledgement progress for a resolved result, such as `3/5 Picker đã xác nhận`, when useful for follow-up.

ACK telemetry is not an employee performance score and does not change resolution status.

## Detailed reporting

Approved controls:
- date range;
- business status;
- SKU/query;
- optional SLA state filter;
- optional recurrence filter;
- pagination;
- explicit CSV export in bounded pages/chunks.

Hot reporting range is bounded to protect SQLite/quota; current implementation is designed around up to 60 days. Dashboard aggregates are server-side/indexed rather than loading the entire raw dataset into the browser.

Final export column set remains an open Owner decision; implementation may expose current safe columns but must not claim that layout as the final Stable export contract.

## Refresh model

- Prefer sequenced realtime patch/delta for live operational counts and explicit refresh for analysis queries.
- Avoid aggressive auto-polling that consumes Worker/Durable Object quota.
- Full page reload is not synchronization logic.

## Web information architecture

Admin/Root groups modules under business-oriented areas:
- **Vận hành** — live queue, recent results;
- **Dữ liệu** — Master SKU, HR source;
- **Quản trị** — accounts, Picker lifecycle, SLA/business settings;
- **Báo cáo** — dashboard, detailed reporting, SLA/recurrence views;
- **Hệ thống** — service status, archive/sync, logs/diagnostics/version where implemented.

Navigation may be implemented compactly, but the conceptual grouping and live-queue priority must remain clear.

## D063 consolidated operational reporting

- Admin/Root sees one `Tổng quan & báo cáo` navigation entry with internal `Tổng quan` and `Báo cáo chi tiết` views.
- The overview prioritizes: current open SKU batches, affected Picker count, warning/overdue counts, authenticated online users, period report volume, unique SKU volume, resolved batches, average resolution time, outcome mix, recurring SKU and hourly/top-SKU patterns.
- Online-user reporting comes from live authenticated realtime connections, not account status. Counts are unique per user/effective role; logout, session invalidation or realtime disconnect removes the online presence.
- Detailed reporting reuses the same selected period and adds status/SKU/product filters, clear result labels, first-report time, resolved time, resolution duration and total report/ticket count.
- User-facing metrics use plain Vietnamese. Forbidden unexplained labels include `P95`, `median/trung vị`, `ACK`, raw `SLA` and placeholder values presented as real metrics.
- `Kết quả gần đây` remains inside the `Vận hành báo hàng` workspace and shows result distribution plus Picker result-receipt progress in plain language (`Picker đã nhận`).
- Existing bounded 60-day query and pagination/export rules remain authoritative.


## Open item

Final export columns and any expanded Reporter analytics beyond the core operational queue remain Owner-open. Do not invent employee scoring or stock/location analytics.

## Operational insights query bounds

- Operational insights use the same maximum reporting window as the dashboard/reporting module: at most 60 days.
- SLA warning/escalated counts are computed as a bounded SQL aggregate over pending batches; the service must not materialize every pending batch into application memory just to classify SLA state.
- Recurrence insight remains range-bounded and top-N bounded.
- Time-progress presentation on the live queue does not require analytics polling.


## D069 Excel export

D069 supersedes only the D025 CSV **file-format** requirement.

- Web detailed-report export is a native Excel `.xlsx` workbook; CSV is not the current Beta export surface.
- Export uses the same selected date/status/SKU-product filters as the detailed report.
- Retrieval remains bounded/chunked and may reject an excessively broad result rather than materializing an unbounded dataset.
- The workbook contains a business-data sheet plus a compact filter/export-information sheet. Date/time cells should be typed/formatted as dates where practical.
- This format change does not close the Owner-open final Stable export-column decision and does not authorize new employee scoring, stock quantity, bin/location or unrelated analytics.


## D070 automatic-Skip reporting

Operational/results surfaces should distinguish the source of a Skip result where useful:

- Reporter/manual: normal business resolution.
- `SYSTEM_TIMEOUT`: service granted Skip because the configured D070 automatic deadline expired without an authoritative Invent response.

Approved aggregate analysis may include automatic-timeout counts/rates by period or SKU, but must not become individual employee scoring. D007 live queue ordering remains unaffected.

For `PER_PICKER`, the live affected-Picker count excludes Pickers who already received their individual timeout Skip while the same batch remains pending for other Pickers. Final batch reporting still represents one shortage episode while ticket/result history preserves exact Picker-level outcomes.


## D071 compact date-range controls

- Overview and detailed reporting keep the same authoritative from/to dates and existing `Hôm nay / 7 ngày / 30 ngày / 60 ngày` presets.
- On desktop, from/to inputs and presets are grouped inline in one compact date selector rather than occupying a separate large panel row.
- Detailed reporting keeps status and SKU/product filters beside the compact date group where space permits.
- Narrow screens may wrap controls, but the date selector remains one coherent group and must not create unnecessary vertical dead space.
- Query bounds, server-side aggregation, pagination and Excel export behavior are unchanged.
## D107 professional overview and detailed-report density

D107 expands presentation depth for Admin/Root without expanding data authority or runtime polling.

### Overview

The `Tổng quan` view presents, from existing bounded APIs:
- current pending SKU count and current affected Picker count;
- current warning and overdue counts;
- authenticated Web/PDA online users;
- selected-period report volume, unique SKU count, affected-Picker volume, resolved-batch count and average resolution time;
- outcome distribution for Có hàng / Cho phép bỏ qua / Picker thu hồi;
- recurrence summary/top recurring SKUs;
- report-versus-resolved time trend using the dashboard timeline bucket returned by the service;
- top reported SKUs including report count and affected Picker count, with drill-down into detailed reporting.

### Detailed report

The `Báo cáo chi tiết` view keeps the same date/status/SKU-product filter, bounded pagination and Excel export, and adds:
- selected-period report, unique-SKU, affected-Picker and resolved-batch summary;
- current warning/overdue attention counts from the existing operational insight aggregate;
- outcome mix;
- recurrence headline count;
- average resolution time;
- explicit current page record range;
- `Đang mở` and `Tổng lượt báo` columns sourced from existing report rows.

### Guards

- No new dashboard/report polling loop is introduced. Data refresh follows the existing explicit-load/realtime model.
- No employee ranking/scoring, stock quantity, bin/location or unapproved inventory metric is added.
- The 60-day bound, indexed/server-side aggregation, bounded pagination and chunked Excel export remain authoritative.
- These additions do not settle the Owner-open final Stable export-column decision.

## D108 resolution provenance

Admin/Root operational results and reporting expose the provenance already recorded by the business model.

- `resolution_source=REPORTER`: result was explicitly chosen by an authorized human. Show the resolving user's display name plus employee/account code when available.
- `resolution_source=REPORTER_CORRECTION`: a human corrected the earlier result; label it as a human correction and show the resolver.
- `resolution_source=SYSTEM_TIMEOUT`: the configured D070 deadline expired without the required Invent/Reporter response. Show **Hệ thống tự động · quá hạn phản hồi** and actor **Hệ thống**.
- `CLOSED`: Picker withdrew the report; show the Picker-withdrawal source instead of inventing a Reporter actor.

Dashboard/result-mix may split Skip into **Bỏ qua bởi nhân sự** and **Tự động bỏ qua quá hạn**. Detailed reporting includes **Nguồn xử lý** and **Người xử lý** columns. These are server-side bounded aggregates/joins on existing fields; D108 does not add polling or a new analytics store.

## D109 dashboard range and resolver activity

- `Tổng quan` defaults to **Hôm nay** when the authenticated user has no saved dashboard range.
- A user-selected dashboard `from/to` range is persisted as a bounded server-side per-user preference and restored only for that same user. It is not a global report-range setting.
- Saving a dashboard range does not create business-audit noise; it is a presentation preference rather than an operational mutation.
- Overview may show a bounded recent-resolution list for `HAS_STOCK` / `SKIP_ALLOWED`, including the resolving display name/account code for human actions. `SYSTEM_TIMEOUT` is always shown as **Hệ thống**.
- Existing 60-day bounds, server-side aggregation, explicit-load/realtime behavior and no employee scoring remain unchanged.

## D112 — Operational hierarchy and non-blocking secondary data

- Dashboard/reporting presentation is ordered by operational need: work requiring attention, period workload/efficiency, outcome/source quality, then recurring/top-SKU/detail signals.
- Only metrics backed by existing authoritative fields/APIs may be displayed. Percentiles, age buckets or other analytics must not be invented when the service does not expose them.
- Dashboard primary data must not wait on presence when presence can be reconciled independently. Reporting rows may render before secondary summary/insight requests complete.
- Date quick presets are exact-state controls: Hôm nay = today/today, 7 = today-6 through today, 30 = today-29 through today, 60 = today-59 through today. A custom range leaves all quick presets inactive.
- These responsiveness changes must not add polling frequency or provider reads.

## D118 — Complete paged views and detailed Excel export

- Large historical/admin lists use bounded server pages with visible previous/next navigation and total/range indicators instead of silently displaying only the first N rows.
- Page sizes: SKU search 100, Reporter result history 50, Picker report history 50, runtime Web/Android logs 50, existing Users/Audit/Report detail 100. Active pending Reporter queue is not user-truncated; it is assembled from bounded 200-row server pages for correctness.
- Runtime Drive log pagination uses Google Drive `nextPageToken`; Web keeps a bounded token stack for back/forward navigation.
- Detailed Excel export uses the active report date range, result filter and SKU/name query. It fetches all matching bounded pages up to explicit 100,000-row safety ceilings.
- Workbook sheets: `Tổng quan`, `Diễn biến`, `Đợt báo hàng`, `Chi tiết Picker`, `Tổng hợp SKU`, `SKU nổi bật`.
- Export must expose operational evolution and actors/timestamps without adding a new reporting authority; all data comes from existing InventoryCore report/ticket/acknowledgement data.

## D133 Agent Usage authentication

The Agent Usage page remains server-mediated and provider-authoritative. The Windows Agent's direct Firebase password token is accepted only when the resolved application user is an active real ADMIN/ADMIN or PICKPACK_ADMIN/PICKPACK_ADMIN, and the token is either the legacy direct-Agent shape with no interactive session channel or an explicit future AGENT channel. Tokens marked WEB or ANDROID are rejected from this Agent-only path. No Google/provider credential is stored in the Agent.

## D136 Agent Usage retirement

- The Agent **Usage** dashboard is retired.
- The Beta Worker does not continue the D131/D134 Google Monitoring Usage polling solely for this UI and does not periodically publish `relay_poc_coordination/usage_current`.
- Do not infer an exact Firebase free-quota balance by counting only application-side events. Such a number is not provider-authoritative and may omit SDK/listener/provider-side operations.
- Existing local `FirestoreQuotaGuard` remains an internal reference guard only. Its soft thresholds continue to protect operational design but must not be labeled as actual provider usage or remaining free quota.

## D143 date/filter and navigation presentation

- Dashboard and detailed reporting initial range is **Hôm nay** for a fresh view; the existing per-user saved Dashboard preference remains authoritative where it already applies.
- Quick presets are exact interval indicators: Hôm nay=today/today, 7 ngày=today-6..today, 30 ngày=today-29..today, 60 ngày=today-59..today.
- If manually selected dates equal one of those exact intervals, that preset is highlighted too. Otherwise no preset is highlighted and both date inputs receive the custom-range selected treatment.
- The Xử lý báo hàng navigation badge is omitted entirely when pending count is zero; a visible numeric zero badge is not rendered.
- Audit pagination controls are placed at the top immediately below the visible `from–to / total` indicator.

## D148 shift comparison workbook

- Detailed Excel export keeps the existing date/status/query filters and bounded pagination. Shift analysis is calculated locally from already-fetched timestamps; no extra reporting API/provider query is added.
- Asia/Ho_Chi_Minh shift mapping: **Ca 1 06:00–<14:00**, **Ca 2 14:00–<22:00**, all other timestamps are **Ngoài ca / Tăng ca**.
- `Đợt báo hàng` and `Chi tiết Picker` include a visible **Ca phát sinh** column.
- Workbook includes **So sánh ca** with, at minimum, lượt báo, SKU, Picker, số đợt, Có hàng, Bỏ qua, Thu hồi, Đang chờ, tỷ lệ đợt đã xử lý, thời gian xử lý bình quân and thời gian Picker chờ bình quân, plus Ca 2 minus Ca 1 comparison.
- Existing workbook layout rules—clear sheet names, bounded column widths, date formats and filters—remain. D148 does not add a new reporting authority or change historical source data.

## D149 recent-result date navigation

- **Kết quả gần đây** remains paged and gains an explicit bounded date range instead of relying on an ambiguous all-history surface.
- Default is **Hôm nay**. Quick ranges include Hôm nay, Hôm qua, 7 ngày and 30 ngày; a custom range is allowed within the existing hot-report maximum of 60 days.
- Summary cards and the paged result table use the exact same active range and status filter.
- A visible action may open detailed reporting with the same date interval rather than requiring the operator to re-enter dates.
- Range changes are user actions; no background refresh/polling cadence is added.
- Existing report-detail pagination/export safety ceilings and historical authority remain unchanged.


## D160 Agent Usage refresh refinement

The restricted Agent **Thông tin Usage** surface keeps the accepted D159/D160 Cloud Monitoring source and shared 15-minute gateway cache. Automatic client refresh is aligned to the workstation local clock boundaries `:00 / :15 / :30 / :45` rather than starting a rolling 15-minute cadence when the process launches. **Cập nhật ngay** remains manual. This changes presentation/request timing only; it creates no Firestore document Read/Write/Delete and does not widen visibility beyond exact Agent login `tamnv2` or `admin`.

## D161 — Web version, date-range and HR confirmation requirements

D161 approved requirements are deferred until explicit implementation authorization.

- Current Web presentation is **Version 1** and displays **Website nghiệp vụ Inventory | Version 1**. Later releases that modify Web source increment this version monotonically; backend/Agent/Android-only releases do not.
- Web runtime diagnostics include the canonical `web_version`.
- Applicable date presets update both the actual query range and the visible `Từ/Đến` values. Generic context restoration must never restore stale values over a deliberate preset selection. The next Xem/Áp dụng request uses exactly the visible range.
- HR synchronization requiring confirmation surfaces a realtime Web warning plus the validated proposed employee diff. No user-account mutation occurs until an authorized user confirms that pending batch.
- The authenticated business footer contains only **Phát triển hệ thống · tamnv2 | Pick Pack 1291**. Public legal/OAuth routes remain available but their links are not duplicated in the authenticated footer.

## D161 normal-shift display clarification

Status: Owner-approved requirement; implementation deferred.

- Reporting/dashboard/business summaries use **06:00–22:00 Asia/Ho_Chi_Minh** as the outward normal-shift definition.
- D161's internal Replay guard **05:45–22:15** does not alter business shift naming, shift comparison labels or normal-shift reporting semantics.
- Technical Replay availability may be shown separately only with an explicit technical label.


## D162 Reporter refresh separation

Reporter queue and recent results are independent read models for realtime refresh. Initial page load and integrity reconciliation may load both in parallel. Normal realtime updates refresh only the changed scope. The global Xử lý báo hàng badge is queue-derived and must never require loading recent-result history merely to update the badge.

## D162 lazy Reporter queue loading

- The **Xử lý báo hàng** navigation badge is independent of full queue row data.
- When Operations is not visible, normal `reporter_queue` events update only the badge from realtime delta metadata and do not fetch the full queue.
- Opening **Xử lý báo hàng** performs the authoritative queue read and then keeps the visible list realtime.
- Opening **Kết quả gần đây** reads recent-result data only; queue rows are not fetched for that screen.
- If the badge has no trusted baseline, Web may perform one lightweight queue total read using a one-row queue request. This is count reconciliation, not background queue loading.
- Realtime continuity uncertainty forces authoritative count reconciliation; it does not justify continuous polling or background full-queue reads.

## D162 realtime workspace tab counts

- The numeric badges shown directly beside **Đang xử lý** and **Kết quả gần đây** must remain current without requiring the operator to click either tab.
- **Đang xử lý** renders the dedicated realtime queue counter, not `queueRows.length`.
- **Kết quả gần đây** renders the dedicated realtime recent counter, not the total from the last loaded result page.
- The recent counter follows the same selected date range/status filter as the Results workspace.
- Opening a tab loads its full list. Remaining on the other tab does not cause background full-list reads.
- Reload/login/reconnect may reconcile both counts in one lightweight authoritative request. No periodic count polling is allowed.

## D163 detailed-report Picker drill-down

- **Báo cáo chi tiết** exposes **Xem Picker / Ẩn Picker** for each report batch/SKU row.
- Expanding a row loads individual Picker data only for that exact `batch_id`; collapsed rows create no Picker-detail read.
- Do not eagerly fetch details for all visible report rows and do not add periodic refresh/polling for this drill-down.
- The expanded panel shows, where available: Picker employee code, display name, report time, effective result and source, Picker wait duration, and result receipt/display/acknowledgement state.
- The source is the existing reporting-detail authority used by detailed Excel export. Existing report date/status/SKU filters, pagination and export behavior remain unchanged.
- No new database schema or persistent provider resource is required.

## D165 Quá hạn and result-correction surfaces

Status: implementation complete on the D165 Beta change set; automated technical validation PASS. Field/usage acceptance remains Owner-gated.

For `PER_PICKER`, the Reporter workspace adds a pinned **Quá hạn** tab next to the existing operational tabs. A SKU may be present in both **Đang xử lý** and **Quá hạn** when different Picker tickets are at different deadline states.

Quá hạn groups only tickets with committed `auto_skip_allowed_at`; Đang xử lý groups only still-waiting tickets. Badge/list updates use realtime deltas and exact row patching; opening a tab may perform one authoritative list read.

Quá hạn actions retain the normal **Đã có hàng** and **Cho phép Skip** controls with the scoped behavior defined by D165.

The **Đã có hàng** result surface adds:
- **Sửa - Đang xử lý**
- **Sửa - Cho phép Skip**

Both require two confirmations with a high-severity warning. Historical decisions remain visible/auditable.

No D165 behavior change is authorized for `FIRST_REPORT`.


## D165 Android Reporter display parity

The existing Web PER_PICKER **Quá hạn** and HAS_STOCK correction semantics also apply to Android Reporter. The Android fifth tab is conditional on authoritative policy; list reads are lazy while count/snapshot changes follow the existing event stream. Quá hạn and Đang xử lý may show the same SKU with different subsets of affected Pickers. No change to FIRST_REPORT or the Web reporting/detailed export semantics.

## D165 Android-only Reporter badge/tab simplification

The Android Reporter operational strip shows up to four states (Đang xử lý, conditional Quá hạn, Đã có hàng, Cho phép Skip), rather than five. Only Đang xử lý and Quá hạn show count badges. Picker đã thu hồi is not displayed as an Android tab; it is **not** deleted from server history, Web reporting or exported evidence. This is a presentation-only change and must not change authoritative overdue counters, lazy list reads, correction actions, realtime delivery, or FIRST_REPORT business logic. Web remains unchanged.

## D165 always-visible overdue presentation

Quá hạn is an always-visible **navigation** tab on Web and Android Reporter; it is an actionable **data** view only when authoritative auto-skip is enabled in PER_PICKER mode. In other modes, display zero with an explanatory empty state without modifying the existing FIRST_REPORT deadline model. The existing limited overdue API read occurs only on explicit tab opening. Android counter lookups use a valid bounded Vietnam calendar-day interval derived from the preceding server timestamp, avoiding `INVALID_COUNTER_RANGE`. No new API/provider/poll family is introduced.

### 2026-10-08 — D166 restricted Agent Usage export idea (OWNER RESEARCH ONLY)

A proposed `Tải số liệu Usage để phân tích` button belongs inside the **already restricted** Agent Thông tin Usage tab, not Web/Android. Proposed windows are Today Vietnam and rolling last 24 hours; output is a local ZIP with explicit coverage, cached provider data and `N/A` when unsupported. The existing fixed 15-minute refresh remains unchanged. Owner approved **research/proposal only**; no UI/code/Gateway/Billing implementation is in this change. Exact impact/security/cost assessment lives in `docs/D166_USAGE_EVIDENCE_EXPORT_PROPOSAL.md`.

### D166 — Restricted Agent Usage ZIP download (Owner-approved scope)

The earlier D166 proposal-only entry is superseded: in v121 candidate the existing **Thông tin Usage** tab, visible solely to exact Agent login `tamnv2` or `admin`, may show **Tải số liệu Usage để phân tích**. One click provides Today in Vietnam, rolling last 24 hours or 06:00–22:00 operational shift; exports local ZIP under Windows Desktop, including hourly CSV, provider JSON, manifest, data quality, checksum and screenshot URLs. This must neither add new background Usage refresh nor change the fixed 15-minute on-tab cadence. When any provider is unconfigured, out of scope, delayed or expensive, show a human supplemental link/NOT_AVAILABLE rather than a claimed zero or failed whole ZIP. Agent and Gateway are candidates until release CI and Owner field PASS; D165 v120 continues as accepted runtime.

### D166 Cloudflare Usage ZIP candidate — not deployed/field accepted

The optional exported `providers/cloudflare_workers.json` contains scoped Beta Worker metrics; `providers/cloudflare_do_account.json` and `providers/cloudflare_billing_account.json` are explicitly shared-account, not Inventory costs. Hourly CSV columns are prefixed `cf_worker_` or `cf_do_account_` to prevent blending sources. Only manual ZIP export, independently of Agent confirmation/failover/ACK. Unknown/missing and truncated records are separate statuses. Billing data may lag and is not an invoice. GitHub Beta Environment token presence alone is not enough to activate collection until provisioned server-side.

### D166 Cloudflare Usage bridge revised

The proposed Agent v122 ZIP may now contain `providers/cloudflare_workers.json`, `providers/cloudflare_do_account.json` (explicit blocked namespace status, no unscoped DO data), and `providers/cloudflare_billing_account.json` (shared-account Workers-family metered usage, not Inventory invoice). The time-series CSV carries `cf_worker_requests`, `cf_worker_errors`, `cf_worker_subrequests`; DO account columns remain blank until scoped. The Agent still offers only manual Today VN / rolling 24h / 06–22h export. Server-only Cloudflare read access uses existing Beta Worker, never Script Properties/Agent credentials. ZIP must distinguish provider sampling, hourly boundaries, shared account, N/A and failed metrics.

### D166 field failure and UI safety — 2026-10-09

Existing v122 Agent Usage export button is correct; user experienced `D166_PROVIDER_NOT_READY` because of a server-side Gateway provider postprocessing defect. Patch Gateway only; **do not** add background export, polling, extra log traffic or alter tab UI without a separate accepted requirement. ZIP remains manually downloaded and per-provider status is explicit, even when Cloudflare API data is unavailable.


## D166 pending-analysis backlog — Web five-tab operations and as-of-location reporting (Owner 09/10/2026)

**Not implemented.** Owner requests the Web operations area to replace the `Kết quả gần đây` view with **Đang xử lý / Quá hạn / Đã có hàng / Cho phép Skip / Picker đã thu hồi**. Preserve existing business semantics, permissions, realtime/delta/badges where valid, audit and historic reporting; data/status eligibility and UI query efficiency need later design review. **Android Reporter presentation is unchanged** (its withdrawn tab remains hidden).

Owner also requests a **research plan** for showing a SKU's storage-area category **as of the report date** (e.g. LTA/Shelving) and reports of which SKUs/areas repeatedly have shortages; revisit the existing overview and detailed report structure, fields and export. Exact classification/source, historical snapshots, missing-data handling, period semantics, confidence and data retention must be evaluated; do not assert location data exist. **D002 currently forbids bin/location SKU-master management**. This proposal does not yet authorize adding location fields or external Supra/WMS reads. No Web/API/schema change until later separate Owner-approved impact review. Full requirements: `docs/D166_APPROVED_BACKLOG.md`.


### D166-WEB-DATE-RANGE — Web five-tab date filter (Owner backlog 09/10/2026; NOT IMPLEMENTED)

The prospective five-tab Web operations workspace (**Đang xử lý, Quá hạn, Đã có hàng, Cho phép Skip, Picker đã thu hồi**) must expose **one shared date-range filter**. Its default for a new screen/session is **Hôm nay** in `Asia/Ho_Chi_Minh`. Operators can select a custom inclusive **Từ ngày / Đến ngày** range and explicitly apply it. Switching tabs preserves the selected range; the displayed list, totals and applicable badges must correspond to the visible filter. Offer a way to reset to **Hôm nay**.

**Analysis gate:** define per-state timestamp semantics and whether historical interval views show as-of status or current status for older reports; do not imply that a reconstructed as-of snapshot exists without authoritative event history. Respect existing operational hot-history/range limits (currently bounded to 60 days where applicable) and pagination, and distinguish old events from present-day realtime counters. Avoid date-range resets by context restoration and avoid background loading all five tabs or new polling on every switch. Owner requested backlog registration only; no UI/API change is authorized. Source: `docs/D166_APPROVED_BACKLOG.md`.


### D166 five-tab Beta Web source candidate (#538 / integrated #541)

The Owner-approved Beta branch candidate supersedes the prior **backlog-only** statement for staged source/CI of five status tabs. Web `Đang xử lý`, `Quá hạn`, `Đã có hàng`, `Cho phép Skip`, `Picker đã thu hồi` share an authenticated counter and the existing WS event stream; tab navigation loads only its active page. All badges stay visible, even 0; `Quá hạn` is an overlapping SLA dimension of pending reports. The shared date-range selection defaults to Today Vietnam and is preserved across tabs. **Important bounded limitation:** the initial branch only applies historical selected day/range semantics to result tabs, while pending and overdue remain the truthful *current open queue*; it cannot reconstruct a past pending as-of date from today's snapshot. Do not call the date-filter requirement fully delivered until historical timestamp/as-of semantics are explicitly accepted or implemented with authoritative history. No five parallel polls or high-volume SQL fanout. D166 stays draft/field-pending, not production deployed. SKU-area LTA/Shelving analytics remain on hold.

## D167 proposed — business-day attribution for 03:00 finalization

For a shortage batch initially reported on Vietnam calendar day N and automatically closed at 03:00 on N+1, the business reporting day is N, derived from the immutable first report timestamp, while the actual terminal action time remains N+1 03:00 for audit/SLA. Ensure result tabs, KPI day buckets, detailed views and Excel use a consistent declared time basis. Current Web result read model filters by resolved_at/updated_at while detailed reporting filters by first_report_at; this discrepancy must be addressed before releasing automatic close-out. Explicitly handle new next-day Picker reports of the same SKU while the prior batch is still open. The date attribution is a proposal for Owner review, not proof historical data already conforms.
