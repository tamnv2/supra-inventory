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
10. When Reporter resolves a batch as `HAS_STOCK` or `SKIP_ALLOWED`, each affected Picker receives a critical result. The app must present the result clearly and require explicit acknowledgement tied to target user + notification event + batch/version.
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

- Admin/Root may configure explicit warning/escalation thresholds in minutes.
- If SLA is not configured, product must say so; do not infer hidden legacy values.
- Server computes the state from authoritative time/first report.
- Typical state vocabulary: `UNCONFIGURED`, `NORMAL`, `WARNING`, `ESCALATED`.
- SLA never performs `SKIP_ALLOWED`, `HAS_STOCK` or another business resolution automatically.

## Data lifecycle

- Operational authority: Worker + InventoryCore SQLite.
- Detailed hot retention target: about 60 days.
- Unresolved/pending data survives retention until handled.
- Long-term archive is batched to Drive/Sheets; no per-event hot write to Google.
- Realtime event sequence, critical ACK and recurrence/version records are retained/audited according to their associated operational lifecycle and archive policy.

## Open workflow decisions

Read `docs/OWNER_DECISIONS.md` open-decision table. Do not invent behavior for SKU-reset confirmation semantics, multi-device/session policy, Stable Root MFA/recovery, final Reporter dashboard/export scope or Stable password hardening.
