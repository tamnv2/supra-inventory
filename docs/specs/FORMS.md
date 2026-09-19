# FORMS — Approved UI input and action contracts

Status: **CANONICAL PRODUCT SPEC**. This documents business-facing form intent; source code remains implementation evidence. Fields not approved by Owner must not be invented.

## Global online-only form rule

Business mutation controls require live authoritative service access. When disconnected, mutation actions are disabled/blocked with a concise online-required message. Do not queue a report/action for later, do not show offline success and do not offer direct-to-Sheet fallback.

## Login — Web + Android

Inputs:
- Username / Mã nhân viên
- Password

Rules:
- Do not prefill root or any credential.
- Backend is authoritative for role and account status.
- Login errors must not reveal credential secrets.
- Android mandatory latest-version verification remains a gate before login.

## Picker report — Android/PDA

Approved vertical composition:
1. large SKU input with operational hint such as `Nhập / quét SKU`;
2. synchronized suggestions/search results when needed;
3. selected SKU + product name in a prominent read-only block;
4. full-width primary `BÁO HẾT HÀNG` action;
5. `BÁO HÔM NAY` / today history directly below.

Rules:
- Search/select SKU from local server-synchronized catalog; product name is derived from selected SKU.
- Submit only after a valid catalog SKU is selected/resolved and the service is online.
- Do **not** place SKU input and primary report button into the former compressed one-row layout.
- Each history item shows SKU, product name, report time, explicit business status and critical result acknowledgement state where relevant.
- Withdraw control appears only when server rules allow unresolved withdrawal within 60 seconds.
- Do not add location/bin or quantity fields.

## Critical Picker result acknowledgement

For `HAS_STOCK` and `SKIP_ALLOWED` results, show a blocking/high-priority result surface with:
- SKU;
- product name;
- human-readable result (`ĐÃ CÓ HÀNG` or `ĐƯỢC PHÉP SKIP`);
- explicit primary action `XÁC NHẬN ĐÃ NHẬN`.

Rules:
- ACK is tied to notification event + target Picker + batch/version.
- Repeated ACK is idempotent.
- The result remains resolved on the server even when notification/ACK telemetry is delayed.
- If multiple critical results arrive, present them deterministically without losing any unacknowledged result.

## Reporter queue — Web/Android where allowed

Display/actions:
- Android filters: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`.
- SKU + product name are the strongest visual identifiers.
- affected Picker/report count;
- first report time + current waiting duration;
- server-derived SLA state (`SLA chưa cấu hình`, normal, warning or escalated);
- recurrence marker/context when the batch links to a previous resolved episode;
- affected Picker ticket detail that expands without shrinking primary actions;
- `CÓ HÀNG` (`HAS_STOCK`);
- `CHO SKIP HÀNG` (`SKIP_ALLOWED`);
- correction to `HAS_STOCK` only while server 5-minute correction deadline remains valid;
- ACK progress for resolved critical results where operationally useful;
- `Picker thu hồi` must show actual closed batches produced by Picker withdrawal, not synthetic data.

### Reporter resolution confirmation

`CÓ HÀNG` / `ĐÃ CÓ HÀNG`:
- first tap opens a confirmation containing SKU, product name, affected Picker count and the outcome to be sent;
- only the explicit final confirmation commits `HAS_STOCK`;
- `HUỶ` closes without mutation.

`CHO SKIP HÀNG` / `CHO PHÉP BỎ QUA`:
- first tap opens a deliberate confirmation containing SKU, product name, affected Picker count and clear impact wording;
- the final confirm control is disabled/visually pending for 5 seconds by default;
- each signed-in user may turn the 5-second delay off/on from personal Account settings; the preference affects only the confirmation delay and never weakens server authorization/business rules;
- `HUỶ` closes without mutation;
- only the explicit final confirmation commits `SKIP_ALLOWED`.

No password/OTP is required for normal Reporter resolution actions.

## Admin/Root PDA launcher

After login, Admin/Root must not drop directly into a Reporter-only screen. The concise launcher groups role-allowed entries:

- **Vận hành**: `Hàng chờ xử lý`, `Kết quả gần đây`;
- **Quản trị**: concise account/Picker/Master SKU entry points appropriate to role;
- **Hệ thống**: `Trạng thái dịch vụ`, `Log/Chẩn đoán`, `Cập nhật`.

Selecting `Hàng chờ xử lý` opens the same authoritative Reporter workflow. Deep forms remain Web-first.

## SLA settings — Admin/Root Web

Inputs:
- warning threshold in minutes;
- escalation threshold in minutes.

Rules:
- both thresholds are explicit values, not inferred from the old product;
- escalation must be greater than warning;
- positive bounded integers only;
- Preview/current value is visible before save;
- if no setting has been saved, UI explicitly says `SLA chưa cấu hình`;
- saving SLA never resolves/Skips a batch and never changes the canonical queue ordering rule by itself.

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

Shared date filter with quick presets. Dashboard is a secondary Admin/Root analysis area, never the Reporter landing surface. Approved overview can include:
- core report KPIs;
- report/resolution trend;
- outcome breakdown;
- top reported SKUs;
- SLA warning/escalation summaries;
- recurring shortage summaries;
- drill-down to detailed Reporting.

Do not add stock quantity/location metrics or employee performance scoring without Owner approval.

## Reporting — Admin/Root Web

Approved controls:
- date range;
- status;
- SKU/query;
- SLA/recurrence filters where implemented;
- pagination;
- explicit chunked CSV export.

Final export columns and any expanded Reporter dashboard visibility beyond the core queue remain Owner-open decisions.

## Diagnostics/support

A `Tạo log hỗ trợ` / diagnostics action may expose/export only bounded redacted technical metadata such as:
- app/version/build;
- device/platform;
- network/service reachability;
- realtime connection + last sequence;
- catalog version;
- recent bounded error messages/codes.

Never include passwords, access/session/refresh tokens, Firebase/Google credential material, signing material or private keys.

## Account/password

Authenticated user may access account functions allowed by role. Password values are protected runtime data and must never be rendered from repo/config.


## D070 — Thời gian xử lý / tự động cho phép bỏ qua

Admin/Root Web form uses one coherent settings surface with:

- `Cảnh báo (phút)` — required integer, 1..1440.
- `Quá hạn (phút)` — required integer, strictly greater than Cảnh báo and <=2880.
- `Tự động cho phép bỏ qua (phút)` — required integer, strictly greater than Quá hạn and <=10080.
- `Bật tự động cho phép Picker bỏ qua khi quá thời gian` — boolean switch/checkbox.
- Timing mode — exactly one:
  - `Tính từ người báo đầu tiên của SKU` → `FIRST_REPORT`;
  - `Tính riêng từ thời điểm từng Picker báo` → `PER_PICKER`.

Validation is server-authoritative and mirrored on Web. The three numeric values are always required and ordered even while auto-Skip is disabled so re-enabling has an explicit policy. No processing-extension field exists.

Changing the switch/mode must clearly state fail-safe behavior: disable/mode switch cancels pending automatic deadlines and later enable applies only to new eligible work rather than retroactively skipping old work.

## D080 — Windows Agent WMS controls

After a real ADMIN Agent session is active, the Windows Agent exposes two D080 actions:

- `Mở WMS + lấy phiên`: opens the dedicated WMS Edge window and waits for an authorized HY1 API request, then reports only capture PASS/failure and missing **header names** where useful. Header values are never shown.
- `TEST SUPRA`: checks WMS UI reachability, captures/refreshes the in-memory HY1 session when needed, and sends the single signed read-only zones GET. UI reports classification, route and timing without session values.

If WMS asks for login, the user signs in normally in the opened Edge window. There is no F12/cURL step. Errors distinguish transport/proxy/session/forbidden/server categories. No control for Picklist search/confirmation or WMS mutation is exposed in D080.

## D081 — WMS login and taskbar status

- `Mở WMS + lấy phiên` / `TEST SUPRA` opens Microsoft Edge when available, otherwise Google Chrome.
- The dedicated browser remains open for up to five minutes while the user completes normal WMS login. It must not fail merely because no API request arrived within a few seconds.
- If neither Edge nor Chrome is installed, show a clear unsupported-browser error; do not silently fall back to unsafe credential capture.
- WMS username/password fields are not added to the Agent.
- The Windows system-tray icon updates approximately every two seconds with compact machine status: `CPU <usage>% <MHz>MHz | RAM <used>/<total>GB`.
- The same tray/status surface is intentionally replaceable by later operational counters such as confirmed Picklists and online users without changing the tray interaction model.

## D082 — Agent overlay and PDA Picklist lookup surface

### Windows Agent persistent overlay
- Show a small always-visible, always-on-top status panel instead of relying on hover text over the tray icon.
- Default content during the POC is local machine CPU utilization, current/approximate CPU MHz and RAM used/total.
- User can show/hide the overlay, choose opacity presets, unlock it to drag, then lock the chosen position.
- Locked mode is click-through and no-activate: mouse clicks/movement target the underlying application, including full-screen operational software. The overlay itself cannot be interacted with until unlocked through the Agent tray menu.
- Position, opacity, visibility and lock state persist locally under the current Windows user; no secret or business payload is stored in overlay settings.
- The overlay content provider is replaceable later by operational counters such as confirmed Picklists and online users.

### PDA `Xác nhận đơn` read-only stage
- Input remains exactly five numeric trailing Picklist digits.
- Primary action text is `KIỂM TRA PICKLIST`.
- While waiting: `Đang kiểm tra Picklist trên WMS...`.
- Result is explicit: `CÓ PICKLIST`, `KHÔNG CÓ PICKLIST`, or a distinct session/permission/network/schema error. Do not label a transport ACK as a Picklist match.
- The surface explicitly states this stage does not confirm or change WMS.
