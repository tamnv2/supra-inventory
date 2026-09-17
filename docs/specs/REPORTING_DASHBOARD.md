# REPORTING_DASHBOARD — Canonical Admin/Root analytics UX

Status: **CANONICAL PRODUCT SPEC**.

## Dashboard purpose

Admin/Root dashboard is a compact operational decision overview, not an ornamental BI wall and not an employee scoring system.

Approved structure:
- one shared date filter / quick presets;
- core report KPIs;
- report/resolution trend;
- resolution outcome breakdown;
- top reported SKUs;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or individual employee-performance ranking without Owner approval.

## Reporting

Approved controls:
- date range;
- status;
- SKU/query;
- pagination;
- explicit CSV export in bounded pages/chunks.

Hot reporting range is bounded to protect SQLite/quota; current implementation is designed around up to 60 days. Dashboard aggregates are server-side/indexed rather than loading the entire raw dataset into the browser.

## Refresh model

Prefer authoritative realtime invalidation + explicit refresh. Avoid aggressive auto-polling that consumes Worker/Durable Object quota.

## Open item

Final export columns and any expansion of Reporter dashboard visibility beyond the operational queue remain Owner-open.
