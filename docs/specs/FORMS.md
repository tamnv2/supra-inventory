# FORMS — Approved UI input and action contracts

Status: **CANONICAL PRODUCT SPEC**. This documents business-facing form intent; source code remains implementation evidence. Fields not approved by Owner must not be invented.

## Login — Web + Android

Inputs:
- Username / MNV
- Password

Rules:
- Do not prefill `root` or any credential.
- Backend is authoritative for role and account status.
- Login errors must not reveal credential secrets.

## Picker report — Android/PDA

Inputs/actions:
- Search/select SKU from local server-synchronized catalog.
- Product name is derived from selected SKU, not free-form inventory data.
- Submit out-of-stock report.
- View own current/recent reports.
- Withdraw button appears only when server rules allow unresolved withdrawal within 60 seconds.

Do not add location/bin or quantity fields.

## Reporter queue — Web/Android where allowed

Display/actions:
- SKU + product name.
- affected Picker count.
- report timing/priority context.
- affected Picker ticket detail.
- `Có hàng` (`HAS_STOCK`).
- `Cho phép bỏ qua` (`SKIP_ALLOWED`).
- correction to `HAS_STOCK` only while server 5-minute correction deadline remains valid.

## HR source — Admin/Root Web

Inputs:
- Google Sheet URL.
- Exact tab name.

Backend validates before save:
- readable Google Sheet;
- exact tab exists;
- required MNV + Họ tên columns.

UI shows human-readable source status/row metadata. Picker sync is Preview → explicit Apply.

## Managed user creation

ROOT form:
- username/MNV
- display name
- creates ADMIN only.

ADMIN form:
- username/MNV
- display name
- creates REPORTER only.

Normal subordinate controls may enable/disable/reset permitted accounts but must never manage ROOT.

## Master SKU import — Admin/Root Web

Inputs/actions:
- select `.xlsx` file;
- preview/validate;
- resolve in-file SKU/name conflicts explicitly;
- confirm existing SKU rename conflicts;
- apply in bounded chunks with progress/status.

## Admin dashboard

Shared date filter with quick presets. Compact operational overview only:
- core report KPIs;
- report/resolution trend;
- outcome breakdown;
- top reported SKUs;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or employee performance scoring without Owner approval.

## Reporting — Admin/Root Web

Approved controls:
- date range;
- status;
- SKU/query;
- pagination;
- explicit chunked CSV export.

Final export columns and any expanded Reporter dashboard visibility remain Owner-open decisions.

## Account/password

Authenticated user may access account functions allowed by role. Password reset/bootstrap values are protected runtime secrets and must never be rendered from repo/config.
