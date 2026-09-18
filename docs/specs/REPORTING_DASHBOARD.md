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

SLA reporting must not imply automatic Skip/resolution and must not rank employees.

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

Final CSV column set remains an open Owner decision; implementation may expose current safe columns but must not claim that layout as the final Stable export contract.

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

## Open item

Final export columns and any expanded Reporter analytics beyond the core operational queue remain Owner-open. Do not invent employee scoring or stock/location analytics.

## Operational insights query bounds

- Operational insights use the same maximum reporting window as the dashboard/reporting module: at most 60 days.
- SLA warning/escalated counts are computed as a bounded SQL aggregate over pending batches; the service must not materialize every pending batch into application memory just to classify SLA state.
- Recurrence insight remains range-bounded and top-N bounded.
- Time-progress presentation on the live queue does not require analytics polling.
