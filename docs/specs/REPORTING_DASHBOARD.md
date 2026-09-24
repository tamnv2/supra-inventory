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

