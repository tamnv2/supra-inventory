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

## D083 — Agent startup failure behavior

- Main Agent window must be the first required UI surface. The optional always-visible overlay is initialized only after the main form reaches `Shown`.
- If overlay initialization fails on a specific Windows machine, Agent remains open; overlay menu items become unavailable and local diagnostics record only sanitized exception type/message.
- If the Agent itself cannot start, show a visible `SUPRA Inventory Agent - lỗi khởi động` dialog instead of exiting silently.
- No password/token/session value may be included in startup error text or logs.

## D084 — explicit overlay settings and lookup wait

- Agent main UI and tray expose `Cài đặt bảng nổi`.
- Settings include panel opacity and `Khóa vị trí và cho chuột xuyên qua bảng nổi`.
- Unlocked: overlay receives mouse input and can be dragged to another position.
- Locked: overlay cannot be selected or moved; mouse input passes through to the application beneath it.
- Settings persist locally for the current Windows user.
- PDA has no date selector for Picklist lookup. The existing five-digit input remains unchanged.
- Because the Agent may scan multiple 100-row WMS pages without a date filter, the PDA relay wait is extended to two minutes before timeout.

## D085 — Agent/PDA confirmation-path states

### PDA
- No usable Agent: show a blocking visible warning: **Không có Agent xử lý online. Vui lòng về bàn chuyên viên xử lý trực tiếp.**
- Active-Agent failover: show **Đang chuyển người xử lý...** while the request is handed to the standby.
- Anti-spam lock: disable Picklist input/send for the authoritative remaining lock period and show that the user is locked because of repeated wrong inputs, with instruction to go to the specialist desk.
- Before lock, a final NOT_FOUND may show current `x/3` wrong count in the 60-second window.
- These messages do not expose the raw Picklist value in diagnostics.

### Windows Agent
- Main window continues to expose **Cài đặt bảng nổi** directly; tray right-click is not required.
- Overlay uses the Owner-proven v8 interaction behavior.
- WMS login/capture control is disabled/dim while a validated WMS session is usable and enabled when session restore/validation fails.
- Auto-start uses the current Windows user and normally starts minimized to tray; no Windows elevation prompt is required.
- Agent UI identifies ACTIVE/STANDBY state for multi-Agent operation.

## D086 — Windows Agent shell and shutdown form

### Tổng quan
The Agent main surface contains only:
- primary `Đăng nhập hệ thống Supra` / ready state;
- current Agent/relay/network/WMS connection status;
- concise model information for ACTIVE/STANDBY processing and read-only WMS behavior.

### Cài đặt
The settings surface contains:
- SUPRA Inventory real-ADMIN login;
- network/transport diagnostics and read-only Supra test;
- overlay settings;
- sanitized local logs.

Normal technical controls must not be scattered across the overview.

### Exit behavior
- The title-bar close control is removed; ordinary close attempts do not terminate the background Agent.
- Tray/menu deliberate shutdown opens a password prompt for the currently authenticated ADMIN.
- A successful local protected verifier check permits graceful exit. Failure leaves Agent running.
- The UI must not claim the process is impossible to terminate from Windows Task Manager; user-mode watchdog recovery is best-effort.

### WMS startup
- Startup first reads the DPAPI-encrypted WMS session file and attempts read-only validation + full Picklist preload.
- Valid session/preload: continue with no browser.
- Missing/expired/invalid session or failed session preload: clear unusable session state and locally open the dedicated WMS browser for authorized reacquisition.
- Remote PDA jobs never open the browser.



## D087 — Windows Agent logs and overlay controls

- Cài đặt > Logs separates **PDA ↔ Agent** and **Kỹ thuật AI**. Each surface can open its own sanitized local file.
- PDA ↔ Agent log records bounded operational correlation such as Picker/user identity, device/Agent identity, request id, approved five-digit Picklist suffix, result/cache/timing and lock metadata.
- Kỹ thuật AI records sanitized lifecycle/network/HTTP/error/runtime diagnostics. Neither log may contain credentials or WMS session/signature values.
- Cài đặt > Bảng nổi remains selectable even after an overlay initialization fault and may retry initialization.
- Main Agent shell has no close/X action but includes an explicit minimize-to-taskbar action. Protected tray shutdown remains the only normal exit.
- Overlay row 1 is Laptop status: CPU, Memory, Disk, WiFi/Ethernet + Internet state, GPU where available.
- Overlay row 2 is Agent status: total online Agents and current-machine runtime APK received/Agent response counts.

## D089 — Agent overlay settings

The Agent overlay settings surface contains:

- Master controls: **Bật hiển thị Overlay** and **Khóa vị trí/kích thước + click-through**.
- Appearance: width, height, background opacity, background color and text color.
- **Thông tin Laptop** checklist: Laptop row, CPU, RAM used/total, Disk, Wi-Fi/Ethernet throughput, Internet ON/OFF and GPU when Windows exposes it.
- **Thông tin Agent** checklist: Agent row, total Agent online, ACTIVE/STANDBY, APK requests accepted by this machine, responses produced by this machine and Supra WMS readiness.
- **Chọn mặc định** restores all display options to enabled.

All choices are local non-secret preferences, apply immediately and persist for the current Windows user. Turning a whole group off hides its row and disables the group's child selections until re-enabled.

## D094 — Agent ADMIN session UX

- A successful real-ADMIN Agent login stores the refreshable application session and non-secret account identity only in a Windows DPAPI CurrentUser-protected local file.
- The ADMIN plaintext password is never stored. It is cleared from the UI immediately after the login attempt.
- While a valid Agent ADMIN session is active, username/password/login controls are disabled/dimmed and the settings surface exposes **Đăng xuất**.
- **Tổng quan** includes a dedicated visible Agent verification state: logged in vs not logged in.
- On next Agent launch, a valid saved session is automatically restored and Firebase ADMIN claims are revalidated without manual password entry.
- **Đăng xuất** clears the saved Agent application session and returns the login controls to editable state. A subsequent successful login becomes the new saved identity/session.
- These controls do not alter company WMS credential handling; WMS remains a separate authorized browser/session authority.


## D098 — Login, recovery and Agent specialist forms

### Web/App login
- Web/App login keeps the existing username/MNV + password surface.
- If the same user already has the same client channel active on another device, show a clear warning before replacement. Continuing replaces only the same client channel.
- PICKER must not be offered/allowed Web access.

### ROOT/ADMIN password recovery
- Login surface includes `Lấy lại mật khẩu`.
- Recovery form requires account/user identifier + registered email.
- Result copy is enumeration-safe: do not reveal whether a specific account/email exists.
- When both values match an ACTIVE ROOT/ADMIN account, Firebase sends the password-reset email/link.
- Account settings allow ROOT/ADMIN to register/update the recovery email.

### Agent Overview
- Main regions are `Hệ thống Supra`, `Xác minh Agent`, then `Xử lý PickList trực tiếp tại bàn chuyên viên`.
- Agent verification accepts the registered ADMIN email + password and authenticates directly against Firebase.
- When a saved Firebase session validates, login fields/buttons are dimmed/disabled and authenticated status is shown. When it is invalid/absent, login input is active.
- A same-ADMIN Agent conflict warns before explicit replacement and replaces only the Agent channel.

### Specialist direct PickList
- Numeric input: 3–5 digits, maximum 5.
- Search matches the digit sequence anywhere in each cached full `PickListCode`.
- Show matching full codes; Confirm remains disabled until one full code is selected.
- Confirm runs the approved guard + WMS confirmation semantics.
- Success/error/uncertain result is rendered locally in Agent. No Android/Firestore job ACK is emitted for a manual-origin action.


## D099 — Agent auth-first form and keyboard behavior

### Agent Overview order
1. `Xác minh Agent`
2. `Hệ thống Supra`
3. `Xử lý PickList trực tiếp tại bàn chuyên viên`

The Agent login field is **Email ADMIN đăng ký**. Until Agent Firebase authentication is valid:
- the Supra region is disabled/dimmed;
- no WMS session restore/preload/browser capture starts;
- Supra status states that it is waiting for Agent verification.

After Agent auth PASS, the existing authorized Supra session logic starts normally.

### Keyboard actions
- Enter in Agent ADMIN email or password = `Đăng nhập`.
- Enter in Agent 3–5 digit PickList input = `Tìm kiếm` when the search is eligible.
- Android login keyboard Enter/Done = Login.
- Web login remains normal HTML form submit on Enter.

### Overlay size
- Legacy minimum 420×64 is removed.
- Practical configurable range is 120..7680 width and 32..4320 height.
- Locked Overlay remains non-editable/click-through; unlock before resize.


## D100 — ROOT System Reset form

Navigation: `HỆ THỐNG → Đặt lại hệ thống`, visible to ROOT only.

The page shows selectable cards with live service counts:
- **Tài khoản Picker** — service + Firebase Auth identities; external HR Sheet unchanged.
- **Tài khoản Reporter** — service + Firebase identities; business history is separate.
- **Tài khoản Admin** — service + the same shared Firebase identity used by Web/App/Agent; ROOT excluded.
- **Danh mục SKU** — service SKU Master only.
- **Báo hàng đang xử lý** — pending batches/tickets and dependent realtime/result records.
- **Lịch sử nghiệp vụ** — finalized batches/tickets/events/result/ACK/archive markers in service only.
- **Log kỹ thuật trong service** — audit/delivery telemetry only; Drive log files unchanged.
- **Phiên & thiết bị** — non-ROOT FCM/presence/Web/App session state.
- **Cấu hình runtime** — SLA/app config + saved HR-source connection metadata; external Sheet contents unchanged.
- **Dữ liệu Xác nhận đơn Firestore** — Beta relay jobs/rate-limit/coordination/Agent presence/confirm guards; blocked if any job is still PENDING.

`Chọn toàn bộ dữ liệu runtime` selects those cards; it does not widen the reset boundary.

Security flow:
1. preview selected groups and counts;
2. enter current ROOT password;
3. explicit confirmation sends 6-digit email code;
4. code expires after 10 minutes, maximum 5 attempts;
5. final destructive confirmation executes the exact scope bound into that challenge.

The page prominently states preserved resources: ROOT identity/password/email/session, Google Sheet/Drive contents, GitHub/source/schema/logic/UI, Stable and WMS.


### D100 recovery + Agent login override

D100 supersedes the D098 recovery/Agent-login wording above:
- Agent login surface is **ADMIN username/MNV + password**. The client internally derives the username-based Firebase sign-in identifier; registered email is never required on Agent.
- ROOT/ADMIN recovery email is a real delivery address stored in InventoryCore only. It is not the Firebase sign-in identifier.
- A matched recovery request sends a project-issued single-use link through Gmail send scope. The token is stored only as a SHA-256 hash, expires after 15 minutes, and is consumed after a successful password change.
- The recovery link opens a dedicated Web form for new password + confirmation. Success updates the same Firebase UID and InventoryCore password/session authority.
 
## D102 — Agent Tổng quan and night decision form

D102 supersedes the older split Agent shell wording where it conflicts.

- The Agent has one top-level **Tổng quan** page containing **Hệ thống Agent**, **Hệ thống Supra** and **Xử lý PickList** in that order.
- Hệ thống Agent keeps ADMIN username/password authentication and adds **Kiểm tra cập nhật**, a compact fleet table and the conditional after-hours decision banner.
- Fleet table shows only account, machine, effective PRIMARY/STANDBY/FROZEN role, Supra readiness, Agent version and last-seen age.
- From 21:30 Asia/Ho_Chi_Minh, the decision banner offers **Tiếp tục sau 22:00** and **Ngừng từ 22:00**. Local tray warning repeats every five minutes until either choice is confirmed.
- If no CONTINUE decision exists at 22:00, business actions are paused. The page remains available and the EXE stays alive. Normal business processing returns at 05:00.
- User-facing form copy must not expose AI/Owner/D-number handoff language.

## D103 — Agent maximized Overview and PickList result form

D103 supersedes D102 layout dimensions where they conflict.

- Agent window default/restore state is maximized.
- Tổng quan has no page-level scrollbar. It contains bounded Agent and Supra regions followed by a PickList region that fills the remaining viewport.
- Agent fleet region displays up to five rows at once; overflow scrolls inside the fleet grid.
- Manual PickList search accepts the existing 3–5 digits. Each matching full PickListCode is a separate row with its own Xác nhận button in the same row.
- No global/shared PickList confirmation button is allowed.
- Persistent verbose implementation guidance is removed from Overview. Compact state labels and action feedback remain.

## D104 — Agent multi-search and conditional confirm-all form

- Agent maximized bounds use the current Windows working area; the taskbar remains visible.
- Manual PickList input accepts up to 10 comma-separated terms. Every term must normalize to 3–5 digits. Spaces around commas are allowed and duplicate terms are ignored.
- Example input shape: `0404, 39050, 403`.
- Search returns the deduplicated union of matching full PickListCodes and remains bounded to 50 displayed rows.
- Each row retains its own Xác nhận button.
- **Xác nhận tất cả** is hidden for 0–1 result row and visible for >=2 rows. Its label may include the displayed count and it targets all currently displayed rows.
- During a manual confirm-all operation, search/grid/bulk controls are disabled until the bounded operation completes; concise aggregate success/error/uncertain counts are then shown.

## D105 — Picker confirmation visual state and input length

- `etRelayPicklistSuffix` is numeric and maxLength=4. Hint/instructions refer to `4 số cuối Picklist`.
- Submit is enabled only when exactly four digits are present, the Picker is not locked and no request is currently in flight.
- While awaiting a result, the submit button is disabled and visually dimmed (reduced alpha).
- Progress/helper copy remains compact. A terminal result is rendered at a materially larger text size and bold weight so it is clearly distinguishable from progress text.
- Confirmed success uses success emphasis; non-success terminal states use error emphasis. Lock messaging remains prominent and still opens the existing warning dialog where applicable.
- Agent specialist manual input accepts 3–4 digits per comma-separated term, maximum 10 unique terms.

## D110 Android Reporter form

- Directly below the pinned App identity/header, render four equal operational tabs: **Đang xử lý**, **Đã có hàng**, **Cho phép skip**, **Picker đã thu hồi**.
- Each tab has a compact upper-right count badge. Badge text is bounded (`99+` allowed) while the underlying count remains authoritative.
- Reporter list content scrolls independently; header and four-tab strip do not scroll away.
- A pending row order is: SKU + elapsed minutes, direct **Đã có hàng / Cho phép skip** action row, product name, then compact Picker/SLA/report metadata.
- Primary resolution buttons do not open a second confirmation form. While one batch is being submitted, only that batch's actions are disabled/dimmed.
- No Reporter **Làm mới** button is shown. Realtime changes refresh authoritative data; the elapsed-minute label advances locally.
- Skip-result correction remains a distinct later action and may keep its dedicated confirmation because it changes an already-resolved result.
