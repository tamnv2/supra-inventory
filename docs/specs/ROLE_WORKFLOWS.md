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


## D075 — Shared Picker queue and ADMIN Agent identity

- All Picker accounts use one Beta relay queue: `relay_poc/jobs/{request_id}`.
- A Picker may create/read/delete only its own request. The request stores immutable `picker_uid` and `picker_user_id` for correlation.
- Windows Relay Agent login accepts only a real application account whose `base_role=ADMIN` and effective `role=ADMIN`. ROOT, REPORTER and PICKER logins are rejected.
- The Agent listens to the shared queue and returns POC ACK metadata: ADMIN user id, Windows machine name, persistent local Agent instance id, SSID and timestamps.
- For the POC, ACK is first-writer-wins: once a job is ACK, later Agents may not overwrite ownership.
- This identity becomes the audit basis for the future real confirmation workflow; D075 itself still performs no WMS action.
- Agent auto-update uses dedicated GitHub prereleases `relay-agent-vN`; successful download must pass SHA-256 verification before the portable EXE self-replaces and relaunches.

## D078 — ADMIN Agent transport diagnostics

- Relay Agent keeps real ADMIN authentication.
- Diagnostics are read-only and available after ADMIN session restoration/login.
- Buttons: Firebase Auth, RTDB, Firestore, Apps Script, Sheets, Drive, Test tất cả.
- Test tất cả runs the same probes sequentially and writes one compact summary line for field handoff.
- Diagnostic probes never confirm an order, never mutate WMS and never bypass corporate network policy.

## D080 — Agent ↔ Supra WMS read-only POC

D080 is a separate readiness step inside the Picker confirmation workstream while the physical PDA ↔ Agent Office test is paused.

- Windows Agent remains a real base-role ADMIN workstation identity.
- The normal session-refresh flow does **not** require F12 or manual Copy as cURL. Agent opens a dedicated Microsoft Edge WMS window with loopback-only DevTools, and observes only outgoing requests to the allowlisted Supra API host from that Agent-owned browser context.
- When WMS itself requires login, the user completes that login interactively. Agent does not scrape/decrypt the normal Chrome/Edge profile and does not store the WMS password.
- Required HY1 request-session values are captured into Agent RAM only. The dedicated browser profile may retain ordinary browser login state under Edge's own storage/security behavior, but Agent never serializes raw WMS request headers/session values into its config/log/GitHub.
- Agent tests WMS UI reachability independently from project Internet/Google/GitHub status.
- The only D080 API business probe is signed read-only `GET /sft3-hy1/api/v1/warehouse/zones`.
- Network route discovery may use Windows/system proxy, environment proxy, direct route and the registered corporate proxy fallback. A corporate filter response is reported, never bypassed.
- Transport errors/HTTP 407 may advance to another route. A real HTTP response such as 400/401/403/429/5xx proves the server/proxy path was reached and is classified rather than hidden by arbitrary route switching.
- If the API returns an expired-session response, Agent may automatically reopen its dedicated WMS browser and recapture once.
- D080 does not load/search Picklists, confirm/click orders, or call any WMS mutation endpoint. Real confirmation logic remains deferred.
- D078 PDA ↔ Agent Office transport testing stays pending until Owner is physically back on the company network.
- Stable remains untouched and OWNER-GATED.

## D082 — Read-only Picklist existence check

Current home-test workflow:
1. Picker/PDA remains on the already implemented Internet/RTDB relay; no Office/LAN transport change is made in D082.
2. Picker opens `Xác nhận đơn`, enters exactly five numeric trailing Picklist digits and presses `KIỂM TRA PICKLIST`.
3. Agent receives the bounded relay job. A real SUPRA Inventory base-role ADMIN session is still required.
4. If no valid HY1 WMS session exists in Agent RAM, Agent does **not** open a browser from the remote PDA request. It returns `WMS_SESSION_REQUIRED` (or `SESSION_EXPIRED`) so the workstation operator can authorize login explicitly.
5. With a valid HY1 session, Agent sends only the signed read-only Picklist-list GET and compares the trailing five digits against Picklist identity fields.
6. PDA renders `CÓ PICKLIST` for `FOUND`, `KHÔNG CÓ PICKLIST` for a supported schema with no match, and a distinct error/session/schema message otherwise.
7. D082 never confirms, skips, edits, clicks or mutates a Picklist. The supplied WMS confirm page is reference-only.

Office sequencing is unchanged: D078 remains paused until Owner is physically at company; D082 success over the home Internet relay is not evidence that Office transport works.

## D084 — all-date PickListCode lookup

- PDA still sends exactly five numeric trailing digits.
- Agent performs only the registered signed read-only Picklist-list GET.
- WMS filter has no date restriction: `FromDate`, `ToDate`, and `Content` are empty.
- Agent requests 100 records per page and continues through pages until an exact match is found or the complete result set is exhausted.
- Only exact field `PickListCode` is authoritative. Expected code shape is `PL` followed by digits; compare only its final five digits with the PDA input.
- A malformed/unknown schema or stalled pagination fails closed; it must never be converted into `KHÔNG CÓ PICKLIST`.
- No confirmation/mutation is added.

## D085 — Picker lookup, sticky Agent ownership and failover

For `Xác nhận đơn`, transport selection remains pending D078; the currently deployed Beta relay is only the temporary carrier.

1. A real ADMIN Windows Agent restores its SUPRA Inventory session and tries to restore/validate an authorized WMS session from the dedicated browser profile.
2. WMS-ready Agents participate in one sticky active-Agent lease. One active Agent owns all lookup work; standby Agents remain idle for WMS work.
3. The active Agent preloads the complete D084 all-date exact-`PickListCode` list into RAM.
4. PDA submits exactly five digits only when a healthy processing Agent exists. If none exists, lookup stops and the Picker is instructed to go to the specialist desk.
5. Cache hit returns FOUND without a WMS request.
6. Cache miss with cache age <=10 seconds returns final NOT_FOUND from the fresh cache. Older cache triggers one shared refresh; concurrent misses join the same in-flight refresh.
7. A final NOT_FOUND increments the Picker account strike state. Three within 60 seconds lock lookup for 5 minutes, then 30 minutes, then 60 minutes for third/subsequent lock episodes. FOUND clears the current strike count; non-business errors never count.
8. If active Agent heartbeat disappears for 10 seconds, one standby becomes active, PDA displays `Đang chuyển người xử lý...`, and the new active Agent resumes pending/switching jobs.
9. No WMS-ready Agent after failover means the Picker is instructed to go to the specialist desk.

A future confirmation adapter may only be added after a separate explicit Owner authorization of the exact mutation endpoint/contract. Until then the flow ends at read-only existence result.

## D086 Windows Agent local workflow

1. Restore/validate the real SUPRA Inventory ADMIN application session.
2. Read the current Windows user's DPAPI-encrypted WMS session file.
3. Validate it through the approved read-only WMS path and preload the complete all-date Picklist cache.
4. If validation/preload succeeds, become WMS-ready without opening the browser and renew the encrypted file.
5. If the saved session is absent/unusable, clear it and locally open the dedicated WMS browser so the authorized operator can re-establish WMS access; then preload/renew.
6. Remote PDA lookup never opens the WMS browser.
7. Normal operation stays background/tray-first. Deliberate shutdown requires current ADMIN password verification; unexpected main-process exit may be restarted by the user-mode watchdog.
8. D085 sticky ACTIVE/STANDBY ownership and 10-second failover remain unchanged. D078 transport selection remains pending and no WMS mutation is authorized.



## D087 Agent observability workflow

1. Agent restores its approved ADMIN/WMS state as defined by D086.
2. Main window may be minimized to the Windows taskbar without exiting; deliberate exit still uses protected ADMIN authorization.
3. Local overlay presents Laptop health and Agent operational state without provider monitoring.
4. Agent publishes only lightweight online-presence metadata globally. Per-machine PDA request/response counters remain local.
5. Support review uses the separate PDA-Agent audit log for operational correlation and the technical-AI log for fault/performance diagnosis.
6. D085 sticky ownership/failover and read-only Picklist lookup remain authoritative; no WMS mutation is added.

## D088 — Admin/Root tools and session workflow

Admin/Root Web:
1. Open **HỆ THỐNG → Công cụ**.
2. Review the current **Agent Auto Confirm Pick Pack** release information.
3. Download the official Agent executable directly from the project GitHub release.
4. Use a real ADMIN application account inside Agent; ROOT/REPORTER/PICKER are not valid Agent identities.

Web/Android account session:
1. A valid saved session is restored on reopen.
2. A new Web or Android login for the same account becomes the only current interactive session.
3. Any older Web/Android session fails closed and returns to login when it next uses authenticated API/refresh.
4. Agent logins are excluded from this single-interactive-session replacement because multi-Agent standby/ACTIVE operation is separately authorized by D085.

## D092 — Picker `Xác nhận lấy lại đơn` workflow

1. Picker opens `Xác nhận đơn` and enters exactly five numeric trailing digits of the Picklist.
2. Android creates one authenticated Firestore request. If no Agent claims a still-`PENDING` job within the bounded wait, the request is cancelled conditionally and Picker is instructed to go to the specialist desk.
3. Only the sticky WMS-ready ACTIVE Agent processes jobs. Standby Agents do not touch WMS work; a leader failure may elect another Agent after the D085 10-second threshold.
4. Agent checks the persisted account anti-spam state. A locked Picker receives `PICKER_LOCKED` without WMS work.
5. Agent reuses the D084/D085 exact trailing-five lookup/cache. Only a final truthful NOT_FOUND increments strikes. FOUND resets the current strike window.
6. After FOUND, Agent resolves the **full exact `PickListCode`** using the same D084 all-date, `Content=""`, 100-row paging rules. Zero/multiple/malformed candidates fail closed.
7. Before WMS mutation, Agent claims a cross-Agent Firestore confirmation guard for the full code fingerprint. An existing confirmed guard returns idempotent success without sending another WMS POST. An uncertain/in-progress guard stops automatic retry.
8. Only then Agent calls the authorized `confirmSkipItem` POST contract. No other WMS mutation is allowed.
9. WMS success returns: `Đã xác nhận lấy lại đơn. Hãy quay lại app SFT / SFT 3 để tiếp tục`.
10. Session/network/schema/permission/uncertain-confirmation errors never count as wrong Picklist input and are returned as bounded business-safe messages.

While a request is `PROCESSING`, Android must not delete it merely because the local wait expires. A timeout after processing begins is fail-closed: instruct the user not to press again and to verify on SFT / SFT 3 through the specialist desk.

## D095 — Split Picker network paths

The Picker application contains two independent online operational paths:

### Báo hàng
- PDA uses its normal Internet connection.
- Submission remains `InventoryApi.createPickerReport(...)` to the authoritative Cloudflare Worker + InventoryCore SQLite service.
- Báo hàng does not wait for, discover, or depend on any Windows Agent.
- Existing realtime/result/acknowledgement behavior remains unchanged.

### Xác nhận đơn
- PDA also uses its normal Internet connection, but the request carrier is authenticated Cloud Firestore rather than the Báo hàng Worker mutation path.
- Picker creates one `ANDROID_CONFIRM_V1` job and polls only its own document.
- The single ACTIVE Agent polls/claims Firestore work. The Agent may be connected through normal Internet or through the company Office network.
- Windows default/system proxy handling belongs only to the Agent's outbound Firestore transport; the PDA never needs Office-network access.
- A still-`PENDING` request is retained for the full 120-second bounded wait. At 30 seconds the UI may report that Agent has not yet received it, but must continue waiting instead of deleting it.
- At terminal timeout, conditional cleanup may delete only a still-`PENDING` document. `PROCESSING` is never deleted or automatically resent.
- Confirmation transport must not call `/api/picker/reports`; normal Báo hàng continues independently if confirmation transport is unavailable.

This separation is a product invariant. A failure of Xác nhận đơn/Firestore must not break or reroute Báo hàng.


## D097 — Xác nhận đơn request-driven HA

D097 supersedes the D085/D092 heartbeat wording for the Firestore confirmation carrier only.

- Agent roles are PRIMARY, STANDBY and FROZEN.
- PRIMARY polls pending confirmation work every 5 seconds.
- STANDBY polls every 10 seconds and may promote only for a request aged at least 10 seconds.
- FROZEN Agents do not poll the business queue.
- Normal PDA → Agent → PDA target is within 10 seconds.
- PDA shows failover guidance from 10 seconds and gives terminal specialist-desk guidance at 30 seconds.
- Firestore transport/network failure alone does not demote an Agent role; network recovery revalidates role before new work.
- Jobs older than 30 seconds are not started as new automatic WMS work.
- Firestore job state is PENDING → ACK. There is no PROCESSING write.
- Conditional ACK plus the full-PickListCode confirmation guard prevents duplicate mutation across Agent races.
- The authorized WMS endpoint, exact resolver, Status=true success rule, anti-spam business thresholds and fail-closed uncertain behavior remain unchanged.
- Báo hàng remains completely independent on Worker/InventoryCore.
- Stable remains untouched.

## D101 — Specialist PickList search cache semantics

- For PDA five-digit confirmation lookup and Agent specialist 3–5 digit search, a cache HIT may return immediately.
- A cache MISS is provisional. Before the system may return final `NOT_FOUND`, exactly one WMS snapshot refresh must be attempted through the existing single-flight coordinator, then the query is evaluated against the refreshed snapshot.
- Only final post-refresh `NOT_FOUND` may feed wrong-input/strike handling. WMS/session/network/permission/refresh uncertainty is not a wrong PickList input.
- Manual specialist search still requires explicit full PickListCode selection and uses the existing one-write confirmation guard; it never ACKs an Android job.
## D102 — Agent daily operating window and role convergence

- Agent top-level workflow starts at **Tổng quan**, where Hệ thống Agent, Hệ thống Supra and specialist PickList handling remain on one page.
- At 21:30 Asia/Ho_Chi_Minh, an undecided Agent starts a five-minute repeating warning cycle asking whether operations continue after 22:00.
- CONTINUE keeps Agent business processing enabled through the night; STOP schedules business pause from 22:00 and stops further warnings for that night.
- If no answer exists by 22:00, business processing pauses by default but the Agent process remains alive. A later CONTINUE resumes business processing; 05:00 always returns to normal daytime behavior.
- D097 confirmation flow is preserved. PRIMARY handles immediately, STANDBY remains the 10-second request failover path, and FROZEN never polls business jobs.
- Multi-Agent role metadata performs a bounded startup convergence burst and then low-frequency role refresh. This improves role-display convergence without turning presence into a fast liveness heartbeat.

## D104 — Multi-PickList specialist and PDA batch workflow

- Manual specialist input may contain 1–10 comma-separated 3–5 digit fragments. Normalize whitespace and duplicates before lookup.
- Search all normalized fragments against one PickList cache snapshot. If one or more fragments miss, perform at most one shared single-flight WMS snapshot refresh, then repeat the whole multi-search once.
- Render the deduplicated union of full PickListCodes, bounded to 50 rows. Every row keeps its own Xác nhận action.
- Show **Xác nhận tất cả** only when >=2 result rows are visible. The action targets exactly those visible full codes; a single-row result does not show the bulk action.
- Before any manual batch mutation, acquire the existing per-code Firestore confirmation guard for every candidate. Exclude already-confirmed or uncertain candidates. Send acquired codes to WMS in chunks of at most 10.
- For PDA work, use only jobs already returned by the existing poll. The PRIMARY/STANDBY cadence is unchanged. Group up to 12 eligible jobs for shared cache lookup, one multi-suffix exact-resolve scan and WMS confirmation chunks of at most 10 exact codes.
- Each PDA job still receives its own conditional ACK. An uncertain WMS batch result leaves affected guards fail-closed and is not replayed automatically.

## D105 — Four-digit Picker confirmation workflow

- Picker opens `Xác nhận đơn`, enters exactly four numeric trailing PickList digits and submits once.
- After submit, the action remains disabled/dim until a terminal result or exception is returned. Text edits during the in-flight request do not create another request.
- New four-digit jobs reuse the existing Firestore request/listener path, anti-spam and per-job ACK.
- Agent treats the suffix length as authoritative for exact trailing comparison. A 4-digit job matches only full PickListCodes ending in those 4 digits. Multiple candidates return ambiguity and cannot call WMS confirmation.
- For rollout safety only, Agent/Firestore may continue accepting old 5-digit jobs from beta-vc62 while beta-vc63 is being installed.
- Specialist Agent manual search terms are 3–4 digits. D104 comma multi-search, row-specific Xác nhận and conditional Xác nhận tất cả are preserved.

## D108 Picker shortage interaction

For Picker shortage reporting:

1. The SKU field accepts digits only. Suggestions begin at three digits.
2. Selecting an exact/suggested SKU commits that SKU, clears the suggestion list and visually marks the selected-SKU block.
3. Suggestions remain suppressed while the input still equals the committed SKU. Editing the input clears the committed selection and starts a new bounded search when at least three digits remain.
4. The shortage action is labeled **Xác nhận** and is ready only with a committed valid SKU plus existing online/mutation readiness.
5. The report-history list is titled **Danh sách SKU đã báo hết hàng** and uses semantic status backgrounds. Do not expose the configured automatic timeout clock/deadline to Picker.
6. A− / A+ modifies presentation only. The locally persisted per-user scale must never change SKU values, business timers, API behavior, realtime subscriptions or server quota.

## D110 Android Reporter operational flow

D110 supersedes the older Android-only confirmation wording where it conflicts; Web behavior is unchanged.

- Android Reporter opens directly into a pinned four-tab operational view: **Đang xử lý**, **Đã có hàng**, **Cho phép skip**, **Picker đã thu hồi**.
- **Đang xử lý** keeps the existing authoritative queue priority/order. Each row shows SKU, elapsed minutes, product, affected Picker count, SLA state and report time.
- **Đã có hàng** and **Cho phép skip** are direct row actions immediately below the SKU. No intermediate Android confirmation dialog is shown for these two primary resolutions. A batch currently being submitted is locally locked against duplicate taps.
- Tapping a pending row outside the two primary buttons may still open Picker/batch detail. The existing Skip→Có hàng correction flow and correction window remain unchanged.
- Warning and overdue presentation is local only: warning = light yellow, overdue = light red. Business authority remains service-side.
- The Reporter minute clock is derived from `server_now`, `first_report_at`, `warning_at` and `escalation_at`; it advances locally and does not poll the service.
- Android accepts only PICKER and REPORTER identities. ADMIN/ROOT remain Web-only for application UI until a later Owner decision; ADMIN Agent remains a separate authorized client channel.

## D111 — Android daily compact Reporter/Picker workflow

D111 applies only to Android App/PDA presentation and scoped read projections.

- Reporter exposes per-user A−/A+ scaling and keeps the selected operational tab while rerendering.
- A pending Reporter resolution is a two-step human action: tap **Đã có hàng** or **Cho phép skip**, then explicitly confirm. No service mutation may occur before that confirmation. The existing per-batch mutation lock remains.
- Reporter result rows rely on the selected tab for outcome context and therefore do not repeat the outcome or Picker acknowledgement counts.
- Android Picker history = reports from the current Asia/Ho_Chi_Minh business day plus any older ticket that is still open and unresolved.
- Android Reporter pending = all unresolved batches regardless of report date. Reporter HAS_STOCK / SKIP_ALLOWED / CLOSED history tabs = batches first reported during the current Asia/Ho_Chi_Minh business day.
- Realtime remains authoritative. The local Reporter minute clock remains presentation-only and performs no API/provider call.
- Web workflows and Stable remain unchanged; Stable is OWNER-GATED.

## D112 — Agent specialist manual lookup and authenticated persistence

- Manual specialist lookup accepts 1–10 comma-separated numeric terms; each term is 3–20 digits.
- A term matches only full PickListCodes whose trailing digits exactly equal the entered term. One match is actionable; zero is NOT_FOUND; more than one is AMBIGUOUS and cannot be confirmed until the user enters more digits.
- The manual rule is independent of the Android confirmation carrier. Android remains current four-digit input and Firestore keeps the accepted four/five-digit rollout guard.
- Before ADMIN login, the Windows Agent may close normally. Once a valid ADMIN runtime is active, protected exit and the user-mode watchdog are armed. Explicit logout/authorized exit/update/shutdown suppress restart.

## D113 — Reporter correction and presentation refinement

- REPORTER/ADMIN/ROOT resolution authority is unchanged.
- A `SKIP_ALLOWED` batch may be corrected to `HAS_STOCK` only when the global D113 correction switch is enabled and current server time is not later than `first_report_at + skip_to_stock_minutes`.
- The correction window is not restarted by pressing Skip. Repeated reports in the same pending batch keep the original batch `first_report_at`.
- Reporter result history exposes the authoritative resolver identity when available so Android can render **Invent phản hồi lúc HH:mm bởi <người xử lý>**. `SYSTEM_TIMEOUT` is represented as **Hệ thống** rather than inventing a user.
- Picker/Reporter Android display-scale reset is presentation-only; it does not change role, business state or server data.


## D114 — Unified PickList confirmation workflow

D114 supersedes the D105/D112 suffix-length carrier details where they conflict.

- PDA submits one numeric suffix at a time, 3–20 digits. Agent manual search may submit 1–10 comma-separated terms, each 3–20 digits.
- All search/resolve stages compare only the exact trailing digits of the full PickListCode. Middle-substring matching is forbidden.
- PDA 0 matches = NOT_FOUND. PDA 1 match = existing guarded WMS confirmation path. PDA 2+ matches = AMBIGUOUS_PICKLIST, no WMS mutation, and a bounded list of matching full PickList codes is returned.
- Android displays ambiguous full PickLists as separate rows with a row-specific confirmation button. Only one selected PickList can be sent at once. Selection requires an explicit warning confirmation; cancel performs no send.
- A selected full PickList is re-submitted through the same Firestore → PRIMARY Agent → exact-resolution → confirmation-guard → WMS path using its full numeric tail, so the final mutation remains uniquely resolved and server/Agent guarded.
- Agent keeps multi-term/multi-row specialist capability and conditional **Xác nhận tất cả**. PDA never receives a multi-confirm action.
- Result codes are rendered through aligned professional copy on Android and Agent; do not expose a generic success/failure sentence when a specific terminal reason is known.


## D115 — Fast confirmation UX

- Picker confirmation keeps the D114 exact trailing-suffix and ambiguity-selection workflow.
- Cleanup/retention work is never allowed to delay the Picker’s new confirmation send.
- While a healthy PRIMARY is available, the intended round trip from send to terminal result is under 5 seconds.
- At 10 seconds without terminal result, Android uses neutral waiting/failover copy rather than declaring the PRIMARY inactive without evidence.
- At 30 seconds, Android performs one final authoritative server read before showing the specialist-desk fallback.
- ACK-delivery recovery is transport-only: it must never cause the Agent to repeat a WMS confirmation mutation.

## D116 — Admin/Root catalog and account workflow

- Opening **Danh mục SKU** loads current catalog metadata plus a bounded first page. Search is explicit by SKU/product name; import remains a separate controlled mutation.
- Opening **Nhân sự & tài khoản** does not imply every account is bulk-manageable. Bulk selection is Picker-only and can span the full Picker set while carrying explicit per-Picker exclusions.
- Selecting all Picker does not lock individual Picker checkboxes. Unchecking one Picker removes that Picker from the eventual all-set mutation even across the backend boundary.
- ROOT/ADMIN/REPORTER are never swept into Picker bulk actions. ROOT protection is visible and server-enforced.
- Reporter/Root/Admin operations detail shows affected Picker rows automatically for the selected shortage batch from the existing cached/prefetched detail request; no additional polling loop is introduced.

## D117 — Agent relay availability and HA workflow

### Automatic PDA confirmation relay

- Carrier remains authenticated Firestore. Office-provider research is closed unless Owner explicitly reopens it.
- One Agent is PRIMARY, at most one is STANDBY, all others are FROZEN.
- PRIMARY business queue cadence is 4s idle and 2s hot for a bounded 15s period after work is found.
- STANDBY/FROZEN never poll the business queue. STANDBY watches only the current generation PRIMARY lease.
- PRIMARY renews its generation lease every 7s. Missing/stale lease for 10s triggers proactive STANDBY takeover even with zero queued requests.
- Takeover performs one read-only WMS session probe, creates a new generation, starts a new generation lease and selects a replacement STANDBY best-effort.
- Before any automatic WMS mutation, PRIMARY verifies the current role + generation. Stale generations fail closed.
- Automatic relay ignores jobs older than the 20s terminal window and never replays an uncertain WMS mutation.

### Relay schedule

- Normal relay window is 06:00 inclusive through 22:00 exclusive, Asia/Ho_Chi_Minh.
- From 21:30, PRIMARY asks every 5m whether to continue beyond 22:00.
- A CONTINUE decision grants one hour past the upcoming boundary. During an active extension, the next decision cycle starts at each HH:30.
- STOP or no answer at a boundary freezes the whole PDA relay fleet.
- Frozen relay means no lease, no business queue polling and no PDA automatic processing. The Windows Agent process stays alive.
- Outside the relay window, direct/manual specialist search and confirmation remain usable when Agent auth and WMS are usable.
- A frozen Agent may start the relay early before 06:00; the confirming machine becomes PRIMARY and the shared override lasts until 06:00, when normal scheduling resumes.
- Shared decisions use the existing Firestore relay coordination resource and do not introduce a new provider/collection.

### D117 final hardening

- PRIMARY schedule decisions are copied into the generation lease immediately; STANDBY consumes the schedule fields from its existing lease read.
- FROZEN has zero PDA business polling. Outside the normal relay window it refreshes only the shared role/control document every 30s so an early-start command can rebuild standby topology without leaving HA absent for minutes.
- After exact resolution and guard acquisition, automatic work is rechecked against the 20s window.
- Immediately before each WMS confirmation POST chunk, PRIMARY revalidates role + generation. Fence loss stops remaining WMS mutation, safely releases untouched guards and leaves jobs un-ACKed for the valid PRIMARY.

## D118 — Fleet schedule decision workflow

- Overtime prompts are visible on every authenticated online Agent during an unresolved decision window; PRIMARY ownership is irrelevant to who may submit the schedule choice.
- A schedule choice from STANDBY/FROZEN changes only shared operating schedule state. It must never claim PRIMARY or mutate WMS.
- Schedule writes use optimistic compare-and-set against the existing Firestore roles document. The first authoritative decision for a schedule-key/boundary wins. A conflicting later click refreshes and displays the already-authoritative decision.
- PRIMARY remains the sole automatic PDA→WMS executor and must reconcile shared schedule state before a boundary. D117 lease/generation/failover rules remain unchanged.

## D119 — Protected additive roles and operating workflows

- Display `ADMIN` as **Quản trị Invent**. Add `PICKPACK_ADMIN` as **Quản trị Pick Pack**.
- Quản trị Pick Pack may manage Picker personnel, manual/catalog SKU workflows, read shortage operations and reporting/export, and bounded Picker-contact tools. On Windows Agent it may perform the normal PickList lookup/confirmation workflow and Agent SKU synchronization/update under the existing HA/WMS guards. It may not perform Báo hàng `HAS_STOCK`, `SKIP_ALLOWED`, correction, SLA/auto-skip timing changes, Root reset or Invent/Root account management.
- Android ADMIN renders only the Reporter operational surface; Root remains Android-denied. The service capability check is authoritative.
- Reporter/Quản trị Invent pending queue is oldest-first. Picker own history is newest-first; resolved history remains newest-first.
- Agent online-Picker list contains only users with a valid Android session plus registered Android notification device. Logout, same-channel replacement, disable and expiry remove the user.
- Online-Picker presence is independent of Xác nhận đơn history.
- Agent UI after authenticated login hides credential inputs and uses compact responsive Overview sections: Agent fleet (max five visible), Supra, PickList (max five visible), and online Picker list.
- D118 confirmation, HA, WMS guard, scheduling and no-offline semantics remain protected and unchanged unless separately approved.

## D120 — Agent/Supra session switching and Picker workspace workflow

### Agent session
1. Successful Agent authentication hides credential inputs but keeps **Đăng xuất** and **Chuyển xuống nền** available.
2. Agent logout stops local relay ownership/listening as already defined, clears the saved Agent session plus local WMS session/cache, and returns the Agent username/password/login controls.
3. Logout does not weaken D117/D118 generation/fence rules and does not modify Stable.

### Supra/WMS account
1. When a valid WMS session exists, the Overview displays the captured Supra user when available.
2. **Đăng xuất Supra** asks for the current Agent account password verifier before clearing WMS state.
3. On successful verification, Agent clears RAM/cache, the DPAPI WMS session file and the dedicated WMS browser profile. The next **Đăng nhập Supra** opens the existing browser capture/login workflow so an authorized different Supra account can sign in.
4. Password/session/header values are never logged or committed.

### Online Picker
- Search is local to the already-loaded compact projection and does not add provider reads.
- Background presence refresh updates rows in place while preserving the current visible scroll anchor and hover/search context.
