# FORMS — Approved UI input and action contracts

Status: **CANONICAL PRODUCT SPEC**. This documents business-facing form intent; source code remains implementation evidence. Fields not approved by Owner must not be invented.

## Login — Web + Android

Inputs:
- Username / Mã nhân viên
- Password

Rules:
- Do not prefill root or any credential.
- Backend is authoritative for role and account status.
- Login errors must not reveal credential secrets.

## Picker report — Android/PDA

Inputs/actions:
- One horizontal operational row: SKU input `Nhập tối thiểu 3 số SKU vào đây` + primary `BÁO HẾT HÀNG` action.
- Search/select SKU from local server-synchronized catalog; suggestions may appear compactly under the input.
- Product name is derived from selected SKU, not free-form inventory data.
- Submit `Báo SKU hết hàng` only after a valid catalog SKU is selected/resolved.
- Show `Lịch sử báo hàng hôm nay` immediately below the entry area.
- Each history item shows `SKU - Tên sản phẩm`, report time and explicit business status.
- Withdraw control appears only when server rules allow unresolved withdrawal within 60 seconds.

Do not add location/bin or quantity fields.

## Reporter queue — Web/Android where allowed

Display/actions:
- Android top filters: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`.
- SKU + product name.
- affected Picker/report count.
- report timing/priority context.
- affected Picker ticket detail.
- `CÓ HÀNG` (`HAS_STOCK`).
- `CHO SKIP HÀNG` (`SKIP_ALLOWED`).
- correction to `HAS_STOCK` only while server 5-minute correction deadline remains valid.
- `Picker thu hồi` must show actual closed batches produced by Picker withdrawal, not synthetic data.

## HR source — Admin/Root Web

Inputs:
- Google Sheet URL.
- Exact tab name.
- Source column name mapped to `Mã nhân viên`.
- Source column name mapped to `Họ và tên`.

Backend validates before save:
- readable Google Sheet;
- exact tab exists;
- both configured source columns exist together in the header area;
- both configured columns are different.

The literal source headers are not fixed to `MNV` or `Họ tên`.

UI shows human-readable source status/row metadata. Picker sync is Preview → explicit Apply. Applying a new source does not automatically disable or delete Picker accounts absent from that source.

## Managed user creation

ROOT form:
- username/Mã nhân viên;
- display name;
- role choice: ADMIN or REPORTER;
- explicit initial password.

ADMIN form:
- username/Mã nhân viên;
- display name;
- role fixed to REPORTER;
- explicit initial password.

ROOT is never manageable through subordinate controls.

## Managed password change

For authorized targets:
- input the new password directly;
- no reset-to-default action for ADMIN/REPORTER;
- successful change invalidates the target's prior session/notification authority as implemented.

Only newly provisioned PICKER accounts use the protected runtime default-password secret approved by Owner. Plaintext must not be committed/logged/rendered from repository config.

## Picker lifecycle management — Admin/Root Web

Controls must support:
- select one Picker;
- select multiple Picker accounts;
- select all Picker accounts;
- `Mở lại` / ACTIVE;
- `Ngừng hoạt động` / DISABLED;
- `Xóa Picker` with destructive confirmation.

Rules:
- HR source membership does not automatically determine the final account status after provisioning.
- Disabled Picker remains disabled until explicitly reopened.
- Deleting Picker account does not delete historical report/audit data.

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

Authenticated user may access account functions allowed by role. Password values are protected runtime data and must never be rendered from repo/config.
