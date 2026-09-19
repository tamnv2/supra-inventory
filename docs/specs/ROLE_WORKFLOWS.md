# ROLE_WORKFLOWS — Owner-approved business scenarios

Status: **CANONICAL PRODUCT SPEC**. Derived only from active Owner decisions; open items are explicitly marked.

## Global online-only rule

All business operations require online access to the authoritative Worker + InventoryCore service. There is **no offline business mode**.

- Do not create reports offline.
- Do not queue business mutations for later offline replay.
- Do not show fake `đã gửi`/success while disconnected.
- Do not write directly to Google Sheet as a fallback transaction path.
- Reporter/Admin/Root mutations are also online-only.
- Local SKU cache exists only to make online operational search fast; it is not offline transaction authority.

## Picker workflow

1. Authenticate with provisioned username/Mã nhân viên + password while the latest-version gate permits login.
2. Search the locally cached, server-synchronized SKU catalog; catalog authority remains the server.
3. Select a valid SKU. The UI prominently shows SKU + product name before submission.
4. Submit through the full-width `BÁO HẾT HÀNG` action while online.
5. Server enforces unresolved dedupe by `Picker + SKU` and idempotent request semantics.
6. If other Pickers already reported the same SKU, each Picker keeps a separate ticket while unresolved work is grouped into one processing batch.
7. Every authoritative batch mutation increments its batch version. A new report attached to an existing pending batch changes the affected set/version.
8. Picker sees own report state through authoritative API plus event-sequence WebSocket updates/delta recovery.
9. An unresolved mistaken report may be withdrawn within **60 seconds server time**. The affected batch/version changes accordingly; a batch becomes `CLOSED` when its final open ticket is withdrawn.
10. When Reporter resolves a batch, or D070 service timeout grants `SKIP_ALLOWED`, each exact affected Picker receives a critical result. In `PER_PICKER`, only the timed-out Picker is targeted until other Pickers receive their own result/final batch result. The app presents the result clearly and requires explicit acknowledgement tied to target user + notification event + batch/version.
11. Result delivery/ACK telemetry does not redefine business resolution: the batch remains resolved even if FCM or a device receipt fails.
12. Today history remains visible immediately under the report form with clear business status and ACK state where relevant.

## Shortage recurrence / episodes

- A finalized shortage episode is immutable.
- If the same SKU is reported later after a prior `HAS_STOCK`/`SKIP_ALLOWED` episode, create a **new processing batch**.
- The new batch may carry `previous_batch_id` referencing the most recent resolved episode for that SKU.
- UI/reporting may show recurrence context such as previous resolution time and elapsed time.
- Never reopen the old finalized batch as the new shortage episode.
- A `CLOSED` batch caused only by all Picker withdrawals is not treated as a confirmed resolved shortage episode for recurrence linkage.

## Reporter workflow

1. Open/focus the operational queue, ordered by the canonical deterministic rule:
   - higher currently affected Picker count first;
   - tie → earlier `first_report_at` first.
2. Each pending item shows SKU, product name, affected Picker count, first report time, waiting duration and server-derived SLA state.
3. SLA is warning/escalation only. It does not auto-Skip, auto-resolve or silently change the canonical queue ordering without another explicit Owner decision.
4. Expand batch detail to see affected Picker tickets without shrinking/displacing the two primary actions.
5. Resolve as `HAS_STOCK` (`CÓ HÀNG`) or `SKIP_ALLOWED` (`CHO SKIP HÀNG`).
6. Both resolution actions require a deliberate UI confirmation naming SKU/product and affected Picker count before the mutation is sent.
7. `CHO SKIP HÀNG` keeps the explicit impact confirmation and, by default, holds the final confirm action disabled for 5 seconds. Each signed-in user may disable/re-enable this client-side delay from personal Account settings. The delay is an interaction guard only; it does not alter server authorization/state semantics. No password/OTP is required for the normal Reporter action.
8. `SKIP_ALLOWED` may be corrected to `HAS_STOCK` within **5 minutes server time**. Correction is a new immutable lifecycle event; the original Skip event remains auditable.
9. Resolution/correction creates event/version metadata used by realtime and critical Picker notification/ACK tracking.
10. Reporter can see result/ACK progress where operationally useful, e.g. acknowledged vs affected Picker count, without blocking the resolved state.
11. Web exposes the complete live pending queue through bounded pagination rather than silently truncating the queue at a fixed client limit; all/warning/overdue summary filters operate over that complete queue.

Web and Android both prioritize this queue. Android/PDA uses larger touch actions; Reporter Web uses a denser table/list appropriate for full-shift operation.

## Admin workflow

Admin inherits Reporter workflow and additionally:
- creates/manages Reporter accounts;
- configures flexible HR Sheet source including URL, exact tab, source column for Mã nhân viên and source column for Họ và tên;
- runs Preview → explicit Apply for Picker provisioning;
- manages Picker lifecycle independently from HR source membership: open, disable or delete one/many/all Picker accounts;
- manages Master SKU/import;
- uses Admin dashboard/reporting including SLA/recurrence operational views;
- configures approved SLA thresholds/settings;
- uses allowed system/status/diagnostics/account functions.

Admin does not manage ROOT and does not create ADMIN.

### Admin on PDA

Admin must not be rendered as only Reporter. After login it receives a concise operational launcher grouped into:
- **Vận hành** — queue/results and Reporter work;
- **Quản trị** — concise role-allowed entry points;
- **Hệ thống** — service/update/log/diagnostic entry points.

Deep HR, Master SKU and detailed reporting remain Web-first.

## Root workflow

ROOT inherits **all Admin + Reporter workflow capabilities** and additionally:
- creates/manages ADMIN;
- creates/manages REPORTER directly;
- manages Picker lifecycle with the same or higher authority than Admin;
- accesses Root-only operations;
- remains protected from normal subordinate account-management flows.

ROOT PDA uses the same launcher model with Root-allowed entries; deep management remains Web-first.


### Root permission-review workflow

For acceptance testing, the actual ROOT identity may temporarily select an effective role of ROOT, ADMIN, REPORTER or PICKER from the pinned Web header control.

1. Service verifies immutable `base_role=ROOT`.
2. Service stores the effective-role override and closes existing realtime sockets for that Root identity.
3. Web immediately clears role-scoped view state, reroutes to the selected role's normal landing surface and reconnects realtime.
4. All normal service authorization uses the selected effective role. Root-only/Admin-only operations are genuinely forbidden while the effective role is lower.
5. Android refreshes `/api/auth/me` on resume; if the effective role changed, it rerenders the corresponding Picker/Reporter/Admin/Root surface.
6. The role selector remains available to the base ROOT identity on Web even while effective permission is lower, allowing ROOT to return to ROOT.
7. No other role receives this selector or recovery route.


## D063 consolidated Admin/Root workspaces

- Left navigation has at most three child items per large business group. Related functions use internal tabs/sections instead of additional sidebar entries.
- `Vận hành báo hàng`: live pending queue + recent results.
- `Tổng quan & báo cáo`: operational overview + detailed report.
- `Trạng thái hệ thống`: network/service/realtime/version/diagnostic state.
- `Nhật ký`: Admin/Root Web separates Web and Android runtime logs and can inspect sanitized detail; Web manual send is available there. Android keeps manual log send from its native log surface.
- `Nhân sự & tài khoản`: create/filter/manage actions remain role-safe and the Picker bulk lifecycle remains unchanged.


## Account provisioning and passwords

- ROOT → creates/manages ADMIN and REPORTER with an explicit password chosen at creation/change time.
- ADMIN → creates/manages REPORTER with an explicit password chosen at creation/change time.
- PICKER → provisioned from configured HR Sheet by Mã nhân viên.
- Only newly provisioned PICKER accounts use the protected Owner-defined Picker default password runtime secret; plaintext is never stored in GitHub.
- Managed password maintenance uses direct password replacement, not reset-to-default.
- Changing HR source does not automatically disable/delete old Picker accounts.
- Existing disabled Picker stays disabled during later HR sync until explicitly reopened.
- Picker deletion removes the account identity while historical report/audit records remain.
- HR synchronization is Preview → explicit Apply.

## SKU import

- Input: Excel `.xlsx`.
- Normal supported operating range: 10,000–50,000 rows.
- Extract only SKU + product name.
- Identical duplicate SKU/name rows merge.
- Same SKU with conflicting names inside one file requires explicit resolution.
- Existing SKU with changed product name requires explicit Admin/Root confirmation.
- Old SKUs absent from a later file remain.
- Large imports use bounded idempotent chunks/retries.

## Realtime workflow

- Every realtime lifecycle event has a monotonic sequence.
- Clients remember the last applied sequence for the authenticated session.
- A normal frame patches/refreshes only the affected operational entity/view.
- If a gap is detected, client requests bounded delta events after `last_seq` and applies them in order.
- Full authoritative reconcile is fallback after reconnect/gap recovery failure, not page reload logic.
- Database remains the source of truth; WebSocket/FCM are delivery channels only.

## SLA workflow

- Admin/Root configures three integer minute thresholds with strict validation: `warning < escalation < auto_skip`.
- The automatic-Skip switch is independent from the numeric third threshold and may be enabled/disabled.
- Automatic-Skip mode is either `FIRST_REPORT` (one batch deadline from the first report) or `PER_PICKER` (each Picker deadline from that Picker's own report).
- If timing has never been configured, product says so; legacy two-threshold configuration never silently enables automatic Skip.
- Server computes timing from authoritative timestamps; client clocks are presentation-only.
- Typical pending state vocabulary remains `UNCONFIGURED`, `NORMAL`, `WARNING`, `ESCALATED`.
- On a due enabled automatic deadline, service may create `SKIP_ALLOWED` with `resolution_source=SYSTEM_TIMEOUT`. Picker does not gain Reporter/Admin resolve permission.
- In `PER_PICKER`, a timed-out Picker gets its own Skip result while the batch remains pending for other active Pickers; that Picker no longer contributes to affected-active count and cannot create a duplicate open report for the same SKU episode.
- When the final active Picker is timed out, the batch finalizes as `SKIP_ALLOWED`; the normal five-minute correction-to-`HAS_STOCK` window remains.
- First D070 activation, re-enable after disable, or mode switch is non-retroactive for pre-existing work; only newly assigned D070 deadlines are automatic.
- Disabling automatic Skip cancels not-yet-fired automatic deadlines.
- No processing-extension action exists in D070.

## Data lifecycle

- Operational authority: Worker + InventoryCore SQLite.
- Detailed hot retention target: about 60 days.
- Unresolved/pending data survives retention until handled.
- Long-term archive is batched to Drive/Sheets; no per-event hot write to Google.
- Realtime event sequence, critical ACK and recurrence/version records are retained/audited according to their associated operational lifecycle and archive policy.

## Open workflow decisions

Read `docs/OWNER_DECISIONS.md` open-decision table. Do not invent behavior for SKU-reset confirmation semantics, multi-device/session policy, Stable Root MFA/recovery, final Reporter dashboard/export scope or Stable password hardening.


## D071 immediate Web action feedback

- Reporter `Có hàng` and `Bỏ qua` keep their explicit confirmation rules.
- After the final confirmation, Web closes the modal and marks that batch as processing immediately; the authoritative service mutation continues asynchronously from the UI's perspective.
- Success is shown only after the service confirms the mutation. Failure clears the pending state and shows an error toast; no offline/fake success is allowed.
- Do not synchronously chain a complete Reporter queue reload after the mutation. Authoritative realtime refresh/reconcile updates the background state, with concurrent operations loads coalesced rather than multiplied.
- This interaction rule changes perceived responsiveness only; server RBAC, idempotency, result targeting, ACK and correction semantics remain authoritative.


## D072 — quota-first system surface exclusion

For Admin/Root Web, D072 overrides earlier navigation/workflow text that exposed `Trạng thái hệ thống`.

- `HỆ THỐNG` contains only `Nhật ký`.
- There is no normal business workflow for system/provider usage monitoring.
- Direct legacy aliases `system`, `devices` and `versions` are not routable.
- Lightweight header connectivity/realtime state remains informational and does not run provider-usage collection.
- Support diagnostics remain available through bounded/redacted runtime logs.


## D073 — Picker Xác nhận lấy hàng transport POC

This is a bounded Beta transport test, not the final WMS workflow.

- Picker keeps the existing Báo hàng workflow unchanged.
- Picker gets a second compact function named **Xác nhận lấy hàng** with exactly five numeric Picklist-suffix digits.
- During D073 POC, pressing the action creates only a relay probe and waits for an Agent ACK. It must never claim that a company order was confirmed.
- The Windows Agent runs as a normal user, may be paired while the laptop has normal Internet, and must keep working through Google/Firebase when the laptop is switched to Office if that network permits the required Google endpoints.
- No WMS page/API/session automation is allowed in D073 POC.
- Multi-Agent primary selection, lease/failover and WMS reconciliation are future work after transport PASS.
- Báo hàng remains online-only on the canonical Worker/InventoryCore path; D043 remains fully active.


## D074 — Relay field repair and Picker split tabs

- D073 remains a transport-only Beta POC; no WMS lookup, click, confirmation or mutation exists in this phase.
- Picker has two bottom-pinned operational tabs: **Báo hết hàng** and **Xác nhận đơn**. Only one panel is visible at a time.
- **Xác nhận đơn** accepts exactly five numeric Picklist-suffix digits; the send action is enabled only when five digits are present and Enter/Done may submit.
- Picker density is reduced from the D073 first pass: smaller headings, shorter inputs/buttons and tighter vertical spacing while preserving touch usability.
- Relay authorization/path identity is the Firebase ID-token subject (`sub`) on both Android and Windows; application `user_id` must not be used as the RTDB security path key.
- Windows Agent differentiates network reachability from RTDB authorization: HTTP 403 is reported as RTDB permission/auth failure, not generic Office network failure.
- Windows Agent writes a bounded local diagnostic log for each run with network/proxy/HTTP timing/state information and automatic redaction of passwords, bearer tokens, JWTs, refresh tokens, API keys and query auth values.
