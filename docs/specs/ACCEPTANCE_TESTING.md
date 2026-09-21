# ACCEPTANCE_TESTING — Canonical verification and Owner acceptance rules

Status: **CANONICAL PRODUCT SPEC**.

## Evidence levels

1. Source/build PASS — compilation/static checks only.
2. Deploy/runtime smoke PASS — target Beta runtime responded as expected.
3. Signed APK/release PASS — signed artifact was produced/published.
4. Field/device PASS — physical PDA/Web user flow verified in real conditions.
5. Owner business acceptance — only explicit Owner confirmation.

Never collapse these levels into one generic “done”.

## UI-first acceptance gate

Before further business-logic rebuild/wiring work becomes the active implementation frontier:

- D057 direct presentation transplant is the visual/layout authority;
- Web is checked against the running prior product plus its read-only source for login, full-width topbar, health/status chips, permission-test strip where applicable, grouped left sidebar, workspace composition, cards/tables, spacing, density and responsive behavior;
- Android/PDA is checked against the prior native resources for login, 76dp main header, role views, drawables, colors, widget styling, row/list treatment and alert surfaces;
- equivalent-looking programmatic reconstruction does **not** satisfy parity when a prior native XML/layout resource exists;
- fixture/sample content may be used to expose visual states while canonical mutation wiring remains intentionally deferred;
- source/build/deploy/signed-release PASS proves only technical validity and must never be called UI PASS;
- only explicit Owner screen-by-screen confirmation marks the UI/layout gate PASS;
- after that gate, canonical business rules are wired/rebuilt and accepted separately by scenario;
- this gate authorizes presentation resources/structure only; legacy backend/provider/auth/storage/database/credentials and out-of-scope fields remain forbidden.

## Rebaseline frontier

The current implementation frontier is the D057 direct legacy presentation transplant. Previous UI candidates remain technical history only and are not visual baselines.

The next UI review candidate is eligible for Owner review only after authority/state guards, presentation guard, Web production build and Android build/release gates pass. Owner visual acceptance remains separate from every automated gate.

## Authority/spec acceptance

Verify:
- D036/D042 are superseded, not silently deleted;
- D043 online-only rule is consistent across context/scope/spec/state/source;
- O006 is closed;
- Legacy Operational UI V2 is the active design authority;
- Stable remains Owner-gated;
- resource IDs/scopes remain canonical and no legacy project resource was imported.

## Backend regression and new-contract acceptance

Preserve existing rules:
- Picker+SKU unresolved dedupe;
- same-SKU multi-Picker batch grouping with separate tickets;
- Reporter queue ordering: affected Picker count DESC, then first report ASC;
- server-time 60-second withdrawal;
- `HAS_STOCK` / `SKIP_ALLOWED` resolution;
- five-minute `SKIP_ALLOWED → HAS_STOCK` correction;
- request idempotency;
- ticket/batch/audit separation;
- 10k–50k bounded SKU import contract;
- online-only mutations.

New contract must prove:
- batch version increments on affected-state mutations;
- a later same-SKU episode creates a new batch linked to prior resolved episode rather than reopening it;
- sequenced realtime events are strictly increasing for new events;
- bounded delta after `last_seq` is ordered and role-safe;
- sequence gaps trigger delta recovery and incomplete delta triggers reconcile;
- critical result target rows are created for affected Pickers;
- receipt/display/ACK transitions are idempotent and cannot regress;
- explicit Picker ACK cannot target another user’s result;
- ACK failure does not change resolved batch status;
- SLA configuration validates warning < escalation and no hidden default is inferred;
- SLA state never auto-resolves or auto-Skips.

## Web acceptance

Reporter:
- lands/focuses on the live operational queue, not a dashboard;
- no large KPI wall or explanatory design text precedes the queue;
- dense list/table exposes SKU, product, affected Picker count, wait time, SLA/recurrence and primary actions;
- Skip uses the required impact confirmation;
- Picker detail expands without displacing primary actions;
- normal WebSocket updates do not programmatically click refresh/full reload;
- event/delta updates preserve current filter, scroll and unrelated form context.

Admin/Root:
- Vận hành / Dữ liệu / Quản trị / Báo cáo / Hệ thống grouping is understandable and role-safe;
- existing HR, account, Picker lifecycle, Master SKU and reporting functions remain available;
- SLA configuration and recurrence/SLA reporting appear only within allowed roles;
- no stock quantity/bin/location or employee scoring is introduced.

D067 Web refinement:
- header text-size controls persist the selected scale and provide decrease / reset / increase without changing server state;
- pending queue loads every authoritative pending batch through bounded 200-row pages and summary/counts are not capped at 200;
- clicking pending / warning / overdue summary cards shows the corresponding SKU list;
- the detail facts show latest report time instead of `Lần xử lý`;
- affected Picker expansion responds immediately (cached/prefetched when available, otherwise shows a loading state) and renders one Picker per row;
- selecting an item or applying normal in-section updates preserves the scroll position of the central workspace and nested long lists;
- `HAS_STOCK` cannot commit from the first click; an explicit confirmation is required;
- Skip final confirmation is disabled for 5 seconds by default, then becomes active; the per-user Account setting can disable/re-enable this delay;
- overlapping scheduled Web-log triggers cannot create duplicate same-filename uploads; exact duplicate filenames are suppressed from the journal list;
- visible Web copy contains no AI/Owner discussion, internal decision IDs, or normal-product labels exposing Beta/Root jargon; the specific log-policy/infrastructure text rejected by Owner is absent.


D058 desktop shell review:
- `Kiểm thử giao diện + quyền server` is absent from the product shell until Owner explicitly reintroduces it;
- at desktop width the topbar and Admin/Root left navigation remain pinned while normal vertical page movement occurs inside the central workspace;
- the central workspace and page-level dashboard/report wrappers use the full available browser width rather than a centered fixed-width canvas;
- no visible AI/Owner discussion, design rationale, migration/backend implementation prose or the specifically rejected explanatory strings remain;
- Web credit reads `Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291`, is visually secondary, fixed bottom-right and does not disappear when workspace content scrolls;
- Android/PDA is outside this D058 repair and remains pending separate Owner review.


D062 Web completion review:
- Admin/Root sidebar shows the five canonical groups `VẬN HÀNH / DỮ LIỆU / QUẢN TRỊ / BÁO CÁO / HỆ THỐNG` with consistent monochrome icons and left alignment;
- Admin/Root default landing is `Xử lý báo thiếu`; `Tổng quan hôm nay` remains under Báo cáo and directly reachable;
- `Kết quả gần đây`, `Nguồn nhân sự` and `Tài khoản & mật khẩu` are reachable from navigation for roles that already have access; implemented business surfaces are not stranded behind hidden routes;
- misleading `Hạ tầng & chi phí` navigation copy is absent unless a real cost module is implemented; the existing diagnostic route is labeled `Trạng thái dịch vụ`;
- in dark mode, expanded Picker detail/chips, realtime toast, notices/messages, neutral/semantic badges and remaining dashboard/report fragments contain no light-theme card/pill/table islands and retain readable contrast;
- D061 generic-refresh removal still passes and the explicit `Kiểm tra dịch vụ` diagnostic probe remains allowed;
- this review changes presentation/navigation only; business state semantics, Android/PDA and Stable remain unchanged.

D061 Web dark/realtime/sidebar review:
- every reachable Web route renders coherent dark surfaces when dark theme is selected; Reporter queue/detail, tables, forms and management panels contain no white content islands;
- text, labels, table cells, form fields and status information remain clearly readable in dark mode;
- Admin/Root sidebar group headings are visibly larger/stronger, remain left-aligned, and group/business entries show consistent monochrome icons;
- page heads do not repeat the same context as both category eyebrow and business title;
- no generic `Làm mới`/refresh button remains on realtime-backed Picker/Reporter/results/user views;
- filters, export, support-log creation and the explicit service diagnostic action remain available because they are distinct operations rather than refresh substitutes;
- realtime still preserves active input/focus/caret/scroll and uses sequence/delta/reconcile rather than page reload;
- Android/PDA and Stable are unchanged by D061.

D060 Root role/theme review:
- corporate company line is visually stronger/larger than the secondary `Website nghiệp vụ Inventory 1291` line;
- header identity shows display name + mapped permission only; literal `Tên:`, `User:`, `Quyền:` and username/user id are absent;
- Dashboard `Tổng quan hôm nay` does not duplicate date/update/shortcut controls in its page head;
- only immutable base ROOT sees the `Kiểm tra quyền` selector; ADMIN/REPORTER/PICKER do not;
- switching ROOT → ADMIN/REPORTER/PICKER changes the server-authoritative effective role: routes outside that role return forbidden, realtime reconnects under the lower projection, and role-target notification selection honors the lower role;
- while effective role is lower, the Web displays that role's normal navigation/landing surface but keeps the Root selector available so base ROOT can select ROOT again;
- Android refreshes the effective role from `/api/auth/me` on resume and rerenders when the role changes;
- Web theme selector persists `Tự động / Sáng / Tối`; automatic mode resolves dark at 18:00–05:59 Asia/Ho_Chi_Minh and light at 06:00–17:59;
- dark mode covers shell, sidebar, content, cards, tables, forms, controls, dialogs, diagnostics and footer with readable contrast;
- Stable remains untouched.

D059 Web header/identity review:
- top-left shows exactly the corporate/product identity `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` and `Website nghiệp vụ Inventory 1291`;
- the old four status chips are absent; one compact line shows `Service: Cloudflare ON/OFF | Cập nhật: HH:mm MM/DD/YYYY`;
- `Cập nhật` changes when the client receives new authoritative data/realtime events and is not a continuously ticking local clock;
- top-right displays `Tên`, `User`, mapped `Quyền`, and `Đăng xuất`; the topbar contains no `Đổi mật khẩu` action;
- role labels are `Quản trị hệ thống`, `Người báo hàng`, and `Người lấy hàng` for ADMIN/ROOT, REPORTER and PICKER respectively;
- every Admin/Root left-navigation group heading and item is left-aligned;
- the Web font stack is local/system only and starts with Segoe UI Variable/Aptos/Segoe UI fallbacks;
- D058 pinned shell/full workspace remains intact; Android/PDA is unchanged.

D063 consolidated Web/log/presence review:
- every Admin/Root left-nav group contains no more than three child entries; no related implemented route is exposed as a needless extra sidebar item;
- `Vận hành báo hàng` contains `Đang xử lý` and `Kết quả gần đây` internally and preserves realtime queue/result behavior, result correction and Picker receipt progress;
- `Tổng quan & báo cáo` contains overview + detailed report, uses real current data, clear Vietnamese business labels and contains no visible `P95`, `trung vị`, raw `ACK` or raw `SLA` jargon;
- overview shows total online users and per-role online counts from authenticated active realtime sockets; logout/socket closure removes presence and multiple same-role sessions for one user do not inflate the user count;
- `Nhân sự & tài khoản` has distinct professional create/filter/manage areas, friendly role/status labels and keeps existing RBAC/bulk-Picker behavior;
- `Trạng thái hệ thống` consolidates service/device/version diagnostic information; `Nhật ký` separates Web/Android logs and supports sanitized detail inspection;
- Beta Drive `Inventory/Beta/Logs` is registered in scope/registry and runtime configuration; log names distinguish source/device/time and `error_` files are visually identifiable;
- Web attempts periodic sanitized logs in the 00/06/12/18 local slots, error events immediately, and manual Web send. Android does the same while authenticated/running and persists an uncaught crash envelope for next authenticated retry if immediate crash upload cannot complete;
- secret-pattern guards and runtime sanitizers must prevent passwords/tokens/credential/signing material from being persisted to runtime logs;
- dark mode covers D063 tabs, summary cards, people forms/tables, logs/statuses and all previously reachable routes without bright light-theme islands;
- Stable remains untouched and Owner UI acceptance is still distinct from technical PASS.


D064 system-status and Beta load-test acceptance:
- `Trạng thái hệ thống` renders distinct cards for Cloudflare Worker, InventoryCore/SQLite, Firebase Auth, FCM, Google Drive, Google Sheets, GitHub and realtime plus actual data-footprint and last-load-test sections;
- SQLite database bytes and table-row counters come from InventoryCore runtime, not hard-coded estimates; Drive storage/folder usage and latest GitHub Beta release are provider reads cached for at least five minutes;
- public quota/limit figures are labeled as reference limits; UI never invents the current billing plan/entitlement;
- default system-page background refresh is no more frequent than once per 60 seconds for core metrics and does not force a provider refresh; explicit refresh may bypass the provider cache;
- the Beta-only load-test helper is inaccessible unless `APP_ENV=beta` and a temporary masked `LOAD_TEST_TOKEN` matches; it is closed after the workflow and never exists on Stable;
- the test uses existing active Picker users and existing Master SKU rows, authenticates each Picker through the Firebase custom-token exchange, and sends the normal `POST /api/picker/reports` route with request IDs rather than inserting report rows directly;
- target acceptance is 1,000 successful reports, 100 existing Picker identities and at least about 400 selected/covered SKU within the requested <=10 minute traffic window; bounded retry may recover network/5xx/duplicate-pair conflicts without changing business rules;
- the load-test artifact and persisted summary contain no Firebase ID token, load-test token, password, private key or other credential material;
- before/after evidence includes SQLite database size and key report/event/audit row deltas plus response timing/status/error counts; the system page shows the bounded latest-test summary;
- after measured PASS/failure evidence, navigation IA is analyzed and proposed separately; D064 itself must not silently replace D063 navigation grouping;
- Stable remains untouched.

## Android/PDA acceptance

Shared:
- narrow-screen `BÁO HÀNG 1291` header remains readable;
- utility actions do not squeeze core content;
- mandatory update gate remains fail-closed;
- no AI/design-discussion/non-operational prose;
- no offline queue/outbox/business-success UI;
- launcher icon remains adaptive/full brand without added white wrapper.

Picker:
- vertical composition: SKU input → selected SKU/product → full-width `BÁO HẾT HÀNG` → today history;
- former one-row input+button layout is absent;
- report action is disabled until valid SKU and online state;
- status cards remain explicit;
- server-authoritative 60-second withdrawal remains correct;
- critical result surface shows exact result and requires `XÁC NHẬN ĐÃ NHẬN`;
- multiple pending result ACKs are not lost.

Reporter:
- four filters remain exactly `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`;
- pending card hierarchy prioritizes SKU/product/affected count/wait-SLA context;
- `CÓ HÀNG` / `CHO SKIP HÀNG` are large operational actions;
- Picker detail does not squeeze those actions;
- Skip impact confirmation names SKU/product/affected count;
- real withdrawal-closed batches back the withdrawn view;
- five-minute correction remains correct;
- ACK progress may be shown but never treated as batch status.

Admin/Root:
- after login sees a concise launcher/menu, not automatic Reporter-only rendering;
- Vận hành entry opens the same Reporter workflow;
- management/system entries respect RBAC;
- deep management remains Web-first.

## Realtime/notification acceptance

- foreground Web and Android maintain `last_seq`;
- duplicate sequence is harmless;
- ordered event patch works for report create/withdraw/resolve/correct/ACK-visible changes;
- artificial or test sequence gap recovers through delta;
- reconnect uses delta/reconcile, not page reload;
- FCM critical payload includes event/batch/version correlation metadata;
- client reports received/displayed/acknowledged stages while online;
- invalid notification telemetry cannot mutate business resolution.

## Diagnostics acceptance

Support diagnostics are bounded/redacted and include only approved technical state. Automated secret-pattern guard must reject/logically prevent exposing credential/session/signing values.

## Beta runtime acceptance

After merge/deploy:
- `/health` reports expected schema and healthy core;
- authenticated role/business smoke passes;
- Web production build/deploy smoke passes;
- realtime ticket/connect/delta smoke passes;
- ACK/SLA/recurrence endpoint smoke passes with isolated/non-destructive test data where available;
- signed Beta APK is produced with monotonic versionCode and checksum/release evidence;
- Stable is untouched.

## Field acceptance

Physical logged-in PDA verification is still required for:
- actual narrow-screen layout;
- background FCM display;
- foreground critical result presentation;
- explicit ACK interaction;
- Android installer/update UX where applicable.

Only Owner confirmation marks business/UI acceptance.

## Load acceptance

Non-destructive CI tests may use declared synthetic tiers. Destructive/mutation load acceptance requires an isolated workload boundary and an Owner-defined operational scale target; do not invent production forecasts.
## Result-event/privacy/count regression acceptance

- Resolve Skip at event/version A, leave it unacknowledged, then correct to Có hàng at event/version B: event A still reads `SKIP_ALLOWED` with its original time/version; event B reads `HAS_STOCK`.
- Two Pickers sharing one batch: a ticket event owned only by Picker B is absent from Picker A delta/socket projection.
- A batch-level result event is delivered only to Picker principals targeted by that exact result event.
- A Picker withdrawn before resolution remains visible in withdrawal history but is excluded from result targets, FCM targets and resolved affected-Picker denominator.
- Fixture with 3 tickets, 2 result targets and 1 ACK must report total tickets=3, result targets=2 and acknowledged=1; no join fanout is permitted.
- Picker realtime payload contains no other Picker employee code/display name/ticket/ACK state or Reporter-only aggregates.
## Realtime cursor/application regression acceptance

- Interleave global events for Picker P1 and P2. If P1 has applied seq 10 and the next P1-authorized event is seq 13 while 11–12 belong only to P2, P1 delta advances the server scan cursor across 11–12 and applies 13 without a recovery loop or cross-Picker payload.
- A delta page may contain zero authorized Picker events yet still advance `cursor_seq` and `has_more` correctly; the next page must remain reachable.
- `stream_epoch` change and client cursor greater than server latest require explicit resync; neither Web nor Android may silently keep the stale cursor.
- A cursor older than `retained_from_seq - 1` requires explicit authoritative reconcile before the replacement cursor is committed.
- If applying a socket/delta event triggers one failed authoritative read-model fetch and no later event arrives, the applied cursor remains at the previous value and dirty recovery retries automatically until state is applied or the session ends.
- If an Android/Web refresh is already in flight when another relevant event arrives, mark it dirty and run another authoritative refresh after the first completes; do not discard the second invalidation.
- Realtime callbacks for one session are serialized so an older response cannot acknowledge a newer cursor out of order.

## Web operational P1 regression acceptance

- While Picker is typing/scanning SKU, a realtime reconcile must preserve the focused input, value, caret and surrounding scroll context.
- Two SKU searches finishing out of order must apply only the newest query result; a stale response must never replace current suggestions.
- Logout/login to a different principal while an old request is in flight must not allow the old response to repopulate the new session view.
- Web uses one authorized session/refresh manager; operational APIs must not maintain a second token/refresh store.
- Managed-user edit uses explicit Save/Cancel and explicit ACTIVE/DISABLED selection; Cancel performs no mutation.
- Managed password change uses a masked password input; no browser prompt is used.
- Picker critical-result `RECEIVED` may be recorded after authoritative fetch, but `DISPLAYED` is recorded only after that result surface is actually rendered for the Picker.
- User administration supports server-side filtering, total count and bounded pagination; Select All applies to all Picker accounts rather than only the current browser page.
- Admin dashboard exposes shared bounded date presets, report/resolution trend, outcome breakdown and drill-down to detailed reporting.
- Detailed reporting supports bounded paged `.xlsx` export using the current safe Beta columns without claiming those columns as the final Stable export contract.
- Web timing validation mirrors the server: warning 1–1440; escalation > warning and <=2880; auto-Skip > escalation and <=10080.

## Android operational P1 regression acceptance

- Picker history and Reporter operational lists use keyed rendering; realtime refresh must not rebuild the whole operational root.
- Picker withdrawal is reachable by one visible tap followed by confirmation and still obeys the server 60-second/open-ticket rule.
- Critical result fetch may record `RECEIVED`; `DISPLAYED` is recorded only after the blocking result dialog is actually shown.
- Local SKU catalog uses SQLite staging + authoritative version/count recheck + transactional promotion; an interrupted or inconsistent sync must leave the previous valid catalog intact.
- Firebase background operational messages are data-only/high-priority and are handled by `FirebaseMessagingService`; notification tap/resume triggers authoritative reconciliation.
- FCM token rotation is retained and registered against the next/current authenticated device session.
- Provider delivery attempts are recorded separately from client receipt/display/ACK; invalid/unregistered tokens are disabled.
- Mandatory update verification checks canonical HTTPS source, Beta tag/channel, SHA-256, package ID, exact versionCode/versionName and trusted signing certificate before installer handoff.
- Login is allowed only when installed versionCode exactly matches the currently verified Beta release; unexpected ahead-of-channel builds also fail closed.
- Admin/Root launcher operations/results are distinct, and Web-first launcher entries open the exact role-authorized module instead of the generic root page.

## SLA archive insights diagnostics regression acceptance

- A pending Reporter row crosses warning/escalation thresholds on Web/PDA from the server-calibrated clock without an API polling loop; a later queue fetch recalibrates it.
- Operational insights reject a range over 60 days and compute pending SLA counts in SQL rather than loading every pending row into application memory.
- Archived finalized batches preserve version/recurrence/result-event/ACK lifecycle evidence in the existing archive surfaces.
- Retention cleanup of an archived finalized batch leaves no orphan result acknowledgements, result snapshots, batch realtime rows or correlated notification-attempt rows.
- Web support log is bounded JSON and Android support log is bounded text/JSON share content; neither includes session tokens, password/secret/private-key material or raw credential stores.


D068 Web interaction acceptance:
- D067 items 1–8 and 10 remain unchanged from their accepted behavior;
- no normal visible Web copy exposes Beta/Root jargon, source/build identifiers, raw internal database/realtime terminology, development decision IDs, AI/Owner discussion or raw technical-details dumps;
- success/warning/error action feedback appears only as bottom-left toast notifications, never as a workspace-top banner; toast background is translucent, auto-hide is 5 seconds and stack size never exceeds five;
- current sidebar item, workspace tab, filter/list selection has a visibly different background in light and dark modes;
- `VẬN HÀNH / QUẢN LÝ / HỆ THỐNG` are visually larger than child items;
- changing a Web section immediately changes active styling/content before its data request finishes;
- selecting a pending SKU updates selected-row/detail DOM without rebuilding the full pending list;
- latest runtime log evidence is consistent with healthy connectivity/realtime; UI delay is not attributed to memory or network without evidence;
- section/workspace navigation creates browser history; Back/Forward returns through previously selected allowed sections and does not immediately leave the application while internal history entries remain;
- dashboard drill-down to detailed reporting participates in the same browser history model.


D069 Web diagnostics / Excel / consistency / responsiveness acceptance:
- complete D068 behavior remains unchanged and is treated as Owner-accepted baseline;
- manual/scheduled/error Web logs contain broad bounded browser/network/performance/API/render/realtime/UI diagnostic context while secret-like fields and credential material are redacted and typed form values are not captured;
- API telemetry contains method/path/status/timing without authorization values or query-value leakage;
- detailed-report export downloads `.xlsx`, preserves the current filters, uses bounded paged retrieval and no longer presents CSV as the current export;
- `Thời gian xử lý` uses the common Web layout; D070 extends it to three ordered thresholds plus auto-Skip switch/mode with the same server bounds;
- a final Web override layer normalizes page headings, panels, controls, tabs, tables and active states across reachable modules in both light and dark themes;
- normal asynchronous business actions do not force a full shell rebuild; full-shell rebuild remains available for role/session/shell changes;
- the complete Reporter queue remains authoritative while off-screen row painting may be contained for browser performance;
- runtime logs expose enough API/render/long-task/realtime timing to distinguish network latency from client rendering delay;
- D069 items 1/2/4/5 remain accepted baseline; its item-3 proposal-only gate is superseded by D070.


D070 three-stage timing / automatic-Skip acceptance:
- server rejects any configuration not satisfying integer `warning < escalation < auto_skip` and the documented bounds;
- legacy two-threshold configuration never enables auto-Skip by inference;
- first D070 activation/re-enable/mode switch does not assign automatic deadlines to pre-existing pending work;
- disabling auto-Skip cancels not-yet-fired automatic deadlines while preserving already-fired result history;
- `FIRST_REPORT`: new batch deadline is anchored to first report; a later Picker joining that eligible batch inherits the same deadline; due service transition targets all still-active Pickers and finalizes the batch as `SKIP_ALLOWED / SYSTEM_TIMEOUT`;
- `PER_PICKER`: each new ticket deadline is anchored to its own report; the first timed-out Picker receives its own critical Skip result while batch remains pending for other active Pickers; affected-active count decreases; duplicate Picker+SKU remains blocked during the same episode; final active timeout finalizes the batch;
- Reporter manual resolution racing an alarm is serialized/rechecked so only an authoritative valid transition wins;
- final automatic `SKIP_ALLOWED` remains correctable to `HAS_STOCK` within five minutes server time;
- warning and escalation are emitted once/idempotently; warning is not replayed after the item is already overdue;
- Reporter/Admin/Root deadline background alerts may be grouped; exact Picker automatic-result/ACK identity is never grouped;
- Web foreground toasts are deduplicated across replay/reconnect and browser background notices are optional permission-controlled;
- Android receives the same deadline/automatic-result semantics through realtime/FCM and displays service-timeout source concisely;
- D007 queue ordering is unchanged;
- no processing-extension action is implemented;
- Stable remains untouched/OWNER-GATED.


D071 Web density / immediate-action acceptance:
- all rendered Web checkboxes resolve to the same compact size and are not enlarged by generic input min-height rules;
- logical text size `100%` applies the D071 ~5% larger baseline while the persisted A−/A+ control still reports logical percentages;
- Overview and Detailed report date controls keep both date inputs plus all four existing quick presets in one compact desktop group and remain usable when wrapped on narrow screens;
- clicking the final Reporter `Có hàng` or `Bỏ qua` confirmation closes the modal and shows an in-progress state before the network request completes;
- service success is not claimed optimistically: success toast appears only after the authoritative mutation resolves, while failure restores an actionable state and shows an error toast;
- Reporter resolve handlers do not synchronously await a complete queue/recent reload after the POST;
- concurrent Reporter operations refreshes are coalesced; realtime authoritative reconciliation remains the source of background freshness;
- support-log evidence used for this issue must distinguish API/reload latency from render/CPU jank; no conclusion of client jank is made when long-task/memory evidence is absent;
- Android/PDA and Stable are unchanged.


D070 alarm availability repair acceptance:
- a batch that reaches escalation before its warning event was emitted receives the escalation event once and its warning deadline is consumed without a late warning;
- the same batch does not cause a past-due warning alarm to re-arm repeatedly;
- due-work catch-up is bounded to 50 rows per category per alarm and re-arms no faster than one second;
- authoritative deadline state is committed and the next alarm is scheduled before best-effort realtime/FCM delivery;
- realtime/FCM delivery failure does not fail/retry the authoritative alarm;
- D070 FIRST_REPORT/PER_PICKER result semantics, exact Picker targeting, five-minute correction, D007 ordering, Android projection and Stable OWNER-GATE remain unchanged.


D072 system-status quota exclusion acceptance:
- Admin/Root sidebar keeps three large groups and `HỆ THỐNG` contains only `Nhật ký`;
- `system`, `devices` and `versions` are absent from routable Web sections and cannot be reached via hash/history;
- Web source contains no `getSystemStatus(...)` call, manual system-status refresh binding or 60-second system-status polling loop;
- `GET /api/admin/system-status` returns the quota-guard disabled response without invoking `collectSystemStatus`;
- gated Beta load-test snapshots call system collection with provider reads disabled;
- Google Drive/GitHub provider metrics are therefore never read by normal user navigation;
- lightweight header connectivity/realtime and runtime-log diagnostics continue to work;
- D071 Web interaction changes, D070 timing semantics, Android/PDA and Stable are unchanged.


## D073 — Relay transport POC acceptance

D073 is PASS only when all of the following are demonstrated on Beta without touching WMS:

1. Signed Beta APK exposes **Xác nhận lấy hàng**, rejects anything except exactly five numeric Picklist-suffix digits, and labels the action as a transport test until the real WMS workflow is approved.
2. The Windows Agent builds as a portable normal-user executable and can pair/login on a network that reaches the Beta Worker without requiring Administrator rights.
3. After pairing, switching the laptop to Office still allows direct Google token refresh plus authenticated RTDB SSE receive/write.
4. A PDA request reaches the Office Agent, the Agent returns ACK, and the APK shows the receiving machine/network label plus measured round-trip milliseconds.
5. Timeout/error is explicit; no fake success is shown.
6. RTDB Rules prevent unauthenticated access and isolate each POC path to the matching Firebase UID.
7. No WMS request, browser automation, order lookup or order mutation exists in the D073 POC build.
8. Stable is untouched.

A field timing target may be observed, but transport POC PASS does not yet establish the final <5s WMS-confirmation SLA.


## D074 — Relay field repair acceptance

D074 is field-ready only when all of the following are true:

1. On `.Office@MSN`, the Agent can refresh the Firebase session and classify RTDB access separately from network reachability; a 403 is shown/logged as permission/auth/rules failure, not network failure.
2. Both Android and Agent build the RTDB path from Firebase ID-token `sub`; no relay path uses application `session.userId`.
3. Agent diagnostic logs are persisted locally and contain no password, bearer token, Firebase ID/refresh token, API key, cookie or private key value.
4. Picker shows a bottom-pinned two-tab bar `Báo hết hàng` / `Xác nhận đơn`; switching tabs preserves the Báo hàng state.
5. `Xác nhận đơn` accepts only numeric input, maximum five digits; the send button enables exactly at five digits, Done/Enter may submit, and the field receives focus when the tab opens.
6. Successful test displays Agent identity/network plus end-to-end milliseconds; timeout/403/transport errors are explicit and never reported as business confirmation success.
7. Existing Báo hết hàng behavior and Worker/InventoryCore transaction path remain unchanged.
8. No WMS mutation exists and Stable remains untouched.


## D075 — ADMIN shared relay and Agent update acceptance

1. Picker account A can submit a five-digit test while the Agent is logged in with a different ADMIN account; ACK returns without requiring matching Firebase UID.
2. EXE rejects PICKER, REPORTER and ROOT accounts and accepts only real base-role ADMIN.
3. ACK exposes ADMIN user id + machine + persistent Agent instance id + network + RTT to the PDA/log without exposing credentials.
4. Two Agents receiving the same PENDING request cannot both own ACK; the first valid ADMIN ACK wins.
5. RTDB Rules deny unauthenticated/shared Picker collection reads and deny non-ADMIN Agent ACK.
6. Agent automatically checks dedicated `relay-agent-vN` GitHub prereleases; a newer executable is installed only after SHA-256 verification and the app relaunches automatically when the executable directory is writable.
7. Agent update prereleases do not replace Android Beta `/releases/latest`.
8. No WMS lookup/confirmation/mutation exists; Stable is untouched.

## D076 — Automated Beta RTDB Rules deployment

1. Pull-request workflow fails closed when `FIREBASE_RULES_SA_JSON_BETA` is missing, malformed, or belongs to a project other than `supra-inventory-beta`.
2. Pull-request validation authenticates and proves read access without publishing/mutating Rules.
3. Only a push to merged `main` may PUT the canonical Rules to the scoped Beta RTDB `/.settings/rules.json` endpoint using a short-lived OAuth access token, then GET/readback-verify the deployed JSON.
4. Deployment uses `firebase/database.rules.json` through canonical `firebase.json`.
5. Workflow never echoes service-account JSON/private key/access token and never targets Stable.
6. A successful main workflow is required before D075 Rules are marked deployed.

## D078 — Office transport probe matrix

1. Agent exposes read-only probe actions for Firebase Auth, RTDB, Firestore, Apps Script, Sheets, Drive and Test tất cả.
2. Probe classification distinguishes at least `PASS`/Google reachable, `AUTH_REQUIRED`, `PROXY_BLOCK`, and transport failure.
3. Wincommerce block pages must be recognized as corporate proxy blocks and not mislabeled as Firebase Rules 403.
4. Probe logs contain endpoint labels, safe host/final-host, HTTP status, content type and elapsed milliseconds, but never passwords/tokens/query credentials or raw five-digit Picklist values.
5. Firestore probe uses the current Firebase ADMIN ID token only as a read-only compatibility test; D078 does not create/provision a Firestore database.
6. Apps Script/Sheets/Drive probes are reachability tests only and do not create or mutate Google resources.
7. Agent build/release must PASS before Owner Office field testing. No APK or WMS mutation change is included.

## D080 — Agent ↔ Supra WMS read-only acceptance

D080 is technically PASS only when:

1. Relay Agent builds/publishes as the existing normal-user portable EXE channel without adding a manual local dependency/install step.
2. A real ADMIN Agent can press `TEST SUPRA` without F12/DevTools/cURL copying.
3. Agent launches a dedicated Edge WMS context with DevTools bound to `127.0.0.1` only and never attaches to/decrypts the user's normal browser profile.
4. After authorized WMS login when required, Agent captures the HY1 session fields automatically and keeps raw values only in RAM; sanitized logs contain no session/header values.
5. WMS UI reachability is classified separately from the signed API result.
6. The signed `GET /sft3-hy1/api/v1/warehouse/zones` uses a new signature/nonce per request and returns a classified result through Windows/system, environment, direct or registered corporate-proxy routing.
7. Corporate block pages/HTTP 407/transport errors are distinguishable from WMS 401/403/business/server responses; no corporate filtering bypass exists.
8. Source/guards contain no Picklist lookup, order confirmation/click automation, POST/PUT/PATCH/DELETE WMS request or other WMS mutation.
9. D078 physical PDA ↔ Agent Office acceptance remains separately pending; D080 PASS must not be misreported as full confirmation-workflow PASS.
10. Stable remains untouched.

## D081 — Agent login reliability/security/taskbar acceptance

D081 is technically PASS only when:
1. With no WMS request for more than five seconds, the DevTools WebSocket remains usable; the first capture does not fail with `WebSocket ... Aborted` solely because the user has not logged in yet.
2. User has up to five minutes to complete official WMS login and trigger an allowlisted Supra API request.
3. Edge is preferred and Chrome is a working fallback using a separate Agent browser profile. No Edge+Chrome case fails clearly.
4. WMS credential fields do not exist in Agent UI/source; WMS password is never persisted/logged by Agent.
5. SUPRA Inventory ADMIN password input is masked, cleared immediately after capture, sent only through the existing HTTPS auth path, and is absent from logs/session files.
6. Tray tooltip/menu refreshes CPU utilization, current/approximate MHz and RAM used/total without Administrator rights and degrades safely if a metric is unavailable.
7. Taskbar monitoring does not poll Cloudflare/Firebase/WMS and therefore adds no service quota consumption.
8. D080 signed zones probe remains GET-only; no Picklist lookup/confirmation/WMS mutation is added.
9. Stable remains untouched.

## D082 — Read-only Picklist/overlay acceptance

D082 technical/release PASS requires:
1. Agent overlay is visible without hovering the tray icon, stays topmost, persists position/opacity/visibility/lock state, can be dragged only while unlocked, and locked mode uses click-through/no-activate behavior so underlying applications receive pointer input.
2. Overlay sampling remains local-only and adds no Cloudflare/Firebase/WMS quota reads.
3. With a valid HY1 session in RAM, Agent disables the manual WMS browser/login capture action; `TEST SUPRA` may still test the session.
4. A PDA request when session is missing/expired returns a session-required result and never auto-launches a WMS login browser.
5. PDA sends exactly five digits through the existing D075 RTDB path; Office/LAN transport is unchanged.
6. Agent signs and sends only `GET /sft3-hy1/api/v1/autopp/pickListConfirms` with the approved HY1/WIN/current-month-to-today filter and `Content` equal to the five-digit input.
7. `FOUND` is emitted only when an identified Picklist identity field ends in the exact five digits. `NOT_FOUND` is emitted only when the response schema is understood enough to support that conclusion; unknown schema returns `SCHEMA_UNSUPPORTED`.
8. APK renders `CÓ PICKLIST` / `KHÔNG CÓ PICKLIST` distinctly from transport/session/schema errors.
9. Logs may contain schema field names/classifications/timing but no Picklist values, WMS response values, Authorization/Token/APISID/SID/SCID/USID, signature/nonce or passwords.
10. Source/guards contain no WMS Picklist POST/PUT/PATCH/DELETE, no confirmation API, and no code that navigates/clicks/submits the confirm-page reference.
11. RTDB Rules validate the new optional lookup ACK metadata while remaining backward compatible during rollout.
12. Agent v7 and signed Android Beta release pass their normal CI/release gates; Stable remains untouched.

Field acceptance then requires Owner to use an authorized WMS session and known last-five values to demonstrate at least one real lookup response. Confirmation remains explicitly untested/deferred.

## D083 — Agent startup regression acceptance

D083 is technically PASS only when:
1. The built Agent EXE is executed on the Windows CI runner after compilation using `--startup-smoke`; the process must create the main form, initialize the overlay through the fail-safe path, and exit with code 0 within 15 seconds.
2. Agent startup no longer constructs the D082 overlay before the main form is shown.
3. Overlay initialization failure is caught and logged as a sanitized classification; the main Agent UI remains usable with overlay controls disabled rather than the process terminating.
4. Initial overlay show/lock must not call `RecreateHandle()`.
5. An unexpected top-level startup exception is written to the local sanitized Agent log and produces a visible startup-error dialog during normal launch; silent exit is forbidden.
6. D082 Picklist read-only lookup, session suppression, RTDB transport and no-mutation guards remain unchanged.
7. Agent build increments to v8 and releases only after the executable startup gate plus existing authority/state/UI/Agent build guards PASS.
8. Stable remains untouched.

## D084 — overlay and all-date PickListCode acceptance

D084 technical PASS requires:
1. Agent build channel increments to v9 and Windows executable startup-smoke remains PASS.
2. Overlay settings dialog is reachable from Agent/tray and controls opacity plus lock state.
3. Unlocked overlay can be dragged; locked overlay applies Windows click-through style without `RecreateHandle()` and cannot intercept underlying application mouse input.
4. WMS lookup sends `FromDate=""`, `ToDate=""`, `Content=""`, `limit=100`, matching `PageIndex/page` pagination.
5. Lookup accepts identity only from exact `PickListCode`; expected code is `PL` + digits and comparison uses exactly its final five digits.
6. Agent paginates until FOUND or truthful exhaustion. Missing `PickListCode`, malformed values, repeated/stalled pages, or unrecognized response structure fail closed as schema error rather than false NOT_FOUND.
7. Android relay call timeout is 120 seconds for this all-date scan.
8. Existing signed-GET-only/no-WMS-mutation guards remain PASS; Stable remains untouched.

## D085 acceptance — Agent HA/cache/anti-spam/session/autostart

Technical/source acceptance requires:
- Agent v10 builds and executable startup smoke PASS.
- v8 overlay interaction engine is restored while main-window overlay settings remain accessible.
- current-user Windows autostart registration is present and requires no elevation.
- exact D084 WMS GET-only/no-date/`Content=""`/100-row/`PickListCode` rules remain guarded.
- one WMS-ready active Agent lease, 3-second heartbeat, 10-second failover and conditional lease writes are present.
- standby Agent cannot process WMS jobs while another healthy active Agent exists.
- pending job can be resumed after takeover and exposes `SWITCHING` to the PDA.
- Picklist preload, 10-second fresh-miss guard and single-flight refresh are present.
- 3 final NOT_FOUND/60s => 5m, 30m, 60m lock progression; errors do not add strikes; 24h without a new lock resets escalation.
- no-Agent PDA warning and locked-Picker UI are present.
- RTDB Rules preserve Picker-own-job boundaries and real-ADMIN-only leader/rate/ACK writes.
- no WMS mutation method is introduced.

Owner physical acceptance after release requires at least two Agents with valid authorized WMS sessions: verify sticky ownership, kill/exit active Agent, observe approximately 10-second takeover + PDA switching message, verify no-Agent specialist-desk warning when all Agents are unavailable, verify lock progression with controlled nonexistent values, verify Agent starts on Windows login as normal user, and verify browser-profile WMS session reuse when still valid.

D078 Office transport selection remains a separate pending field decision and must not be inferred from D085 acceptance.

## D086 acceptance — Agent v11 session/UI/lifecycle hardening

Technical/source acceptance requires:
1. Agent v11 builds and the existing Windows startup-smoke test PASS.
2. WMS session persistence uses DPAPI `CurrentUser`; no raw Authorization/Token/APISID/SID/SCID/USID value is written to logs/repo/RTDB.
3. Startup tries the encrypted WMS session file before any browser capture. A valid saved session must validate and preload Picklist without launching a browser; unusable state is cleared and only then may local browser reacquisition run.
4. Successful Picklist preload/real refresh renews the encrypted session file. Session-expired classification clears it.
5. Main UI has `Tổng quan` and `Cài đặt`; overview is limited to Supra login/ready, connection status and concise model info. ADMIN login, network probes, overlay settings and logs are under settings.
6. Locked overlay applies `WS_EX_TRANSPARENT`/no-activate behavior dynamically without `RecreateHandle()`; clicking a desktop/app object underneath the overlay reaches that underlying object. Unlocking restores drag behavior.
7. Main form has no normal title-bar close control. Deliberate exit requires the current ADMIN password verifier; plaintext password is never persisted/logged.
8. Current-user autostart remains. A sleep-only watchdog relaunches the Agent after unexpected main-process exit and is suppressed for authorized exit/update/Windows shutdown. Acceptance must not claim same-user Task Manager can be cryptographically prevented from killing both processes.
9. Continuous `netsh` polling at the old ~4-second cadence is absent; SSID UI refresh is coarse and local machine overlay sampling is no faster than needed for human visibility.
10. D085 3-second heartbeat/10-second failover, all-date exact PickListCode GET-only lookup, anti-spam and RTDB temporary carrier remain unchanged; no WMS mutation exists.
11. Stable remains untouched.

Owner field review after release covers the actual UI layout, saved-session reuse on the company laptop, browser fallback when the saved session is invalid, click-through over a real desktop/application object, protected exit, kill/restart behavior and idle CPU/RAM footprint.



## D087 acceptance — Agent v12 logs/overlay/minimize/presence

Technical/source acceptance requires:
1. Agent v12 builds and Windows startup-smoke PASS.
2. Overlay construction is null-safe during base Form initialization; v11-style NullReferenceException does not disable the main Agent.
3. Overlay settings stays reachable/retryable after a transient overlay failure.
4. Main shell renders no close/X action and has an explicit minimize-to-taskbar control; manual minimize does not hide the process from taskbar.
5. Local logs are physically split into PDA-Agent audit and technical-AI diagnostics and both use common secret redaction.
6. PDA-Agent audit contains bounded request/user/device/five-digit Picklist/result correlation but no password/token/cookie/WMS session/header/signature/full WMS payload.
7. Overlay Laptop row displays CPU/Memory/Disk/network+Internet/GPU with graceful -- degradation where unavailable.
8. Overlay Agent row displays total online Agents plus current-process local APK received/response counts.
9. Per-machine APK/response counters are not written to RTDB. Agent online presence alone uses 30s write / 60s read / 90s freshness.
10. D085 3s leadership heartbeat/10s failover, D086 file-first DPAPI session, read-only WMS GET-only guard and temporary D078 transport status remain unchanged.
11. Stable remains untouched.

Owner field acceptance checks the repaired overlay/settings on the company laptop, click-through, taskbar minimize, both log files and realistic idle CPU/RAM/GPU overhead.

12. Agent-only RTDB Rules/support changes may verify Android compatibility but do not advance the signed Android release unless android/** source changed; D087 keeps beta-vc52.

## D088 acceptance — naming, single session, tools, tray, overlay and icon

Technical/source acceptance requires all of the following:
1. Web user-facing product title/header is **Website nghiệp vụ Inventory**; Android application label is **1291 Beta**; Agent executable/product title is **Agent Auto Confirm Pick Pack**.
2. Web, Android and Agent use the same selected D088 icon motif.
3. Web and Android persist the current session across normal close/reopen without storing a plaintext password.
4. A fresh Web or Android login advances server session generation; older Web/Android sessions are rejected on authenticated API and refresh. Existing pre-D088 tokens fail closed and require one migration login.
5. Agent sends an explicit `AGENT` auth channel, remains real-base-ADMIN only, and multiple Agent logins do not revoke one another or break D085 HA.
6. Admin/Root Web exposes **HỆ THỐNG → Công cụ** with a professional Agent card, direct official `relay-agent-v14` download and concise usage instructions. D072 provider/status polling remains disabled.
7. Agent v14 canonical executable is named **Agent Auto Confirm Pick Pack.exe**. A one-release legacy asset alias may exist solely so v12 can self-update to v13.
8. Minimize removes the Agent main window from the taskbar and leaves it in System Tray; tray restore returns it. No normal close/X is introduced; protected exit remains.
9. Locked overlay remains true click-through. Unlocked overlay can drag and resize from edges/corners. Settings expose width, height, opacity, background color and text color, and persist them locally.
10. D085 3-second leadership heartbeat/10-second failover, D086 DPAPI WMS session, D087 split logs/presence, temporary D078 RTDB carrier and GET-only WMS boundary remain unchanged.
11. Beta Worker/Web deploy, service typecheck, Web production build, Android build/sign/release, Agent Windows build/startup-smoke/release, authority guard and project-state guard all PASS before D088 is called technically released.
12. Stable remains untouched and OWNER-GATED.

Owner field acceptance then checks the visible names/icons, reopen-without-login behavior, cross-Web/Android session replacement, direct tool download, tray-only minimize/restore, and real overlay resize/color/click-through on the company Windows laptop.

## D089 acceptance

D089 is PASS only after automated source/build/runtime gates and Owner field re-test.

Automated checks:
- Web uses the committed approved icon asset and contains separate service/realtime header states.
- Tools dark-theme completion is present.
- Android manifest uses the approved icon asset and the signed release gate remains monotonic.
- Agent v15 startup-smoke passes.
- Agent source contains per-user single-instance mutex plus activation event; startup-smoke remains exempt.
- Overlay master visibility plus granular Laptop/Agent options persist locally.
- WMS POST/PUT/PATCH/DELETE remains forbidden.

Owner field re-test:
1. Compare Web, Android and EXE/tray icon to the selected icon #4.
2. With API reachable but realtime interrupted, Web keeps `Dịch vụ: Hoạt động` and independently shows realtime loss.
3. In dark mode, Tools contains no light/white fact tiles and all text/controls remain readable.
4. Toggle Overlay off/on; select/deselect individual Laptop/Agent metrics; restart Agent and verify persistence.
5. With Agent already running/tray-hidden, open EXE again; no second tray/overlay/runtime is created and the existing instance restores.
6. Stable remains untouched; D078 remains pending; WMS stays read-only.


### D089 automated release evidence — PASS

The automated portion of D089 acceptance is complete:

- PR #99 final gates all PASS: Repo Authority `35528500471`, Project State `35528500466`, RTDB Rules `35528500468`, UI Design `35528500465`, Relay Agent `35528500524`, Android `35528500467`.
- Main `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee` gates all PASS: Beta Worker `35528647549`, UI Design `35528647554`, Repo Authority `35528647571`, Project State `35528647574`, Relay Agent `35528647534`, Android `35528647526`.
- `relay-agent-v15` was published and its canonical EXE digest verified: `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- Signed `beta-vc54` was published and its APK digest verified: `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.
- Verified PNG icon binary is shared by Web/Android/Agent.
- Agent Windows build and startup-smoke PASS with the single-instance source guard and granular overlay settings.
- WMS mutation guards remain PASS.

D089 is therefore technical/runtime/release PASS. The six Owner field re-test checks listed above remain the only D089 acceptance items not automatable by connected tooling.


### D089 Owner field acceptance — PASS

Owner field acceptance completed on **2026-09-21**. The Owner explicitly confirmed the D089 result had achieved the requested requirements.

Accepted field items:
1. approved icon #4 identity;
2. independent Service and realtime status;
3. complete dark-theme Tools page;
4. Overlay ON/OFF plus granular persisted Laptop/Agent checklist behavior;
5. single-instance Agent duplicate-launch restore.

D089 is therefore **fully PASS: source/build/runtime/release + Owner field acceptance**. `OA011` is closed.

This does not close D078 transport selection, does not authorize WMS mutation, and does not change Stable OWNER-GATED status.

## D090 Office transport evidence and next candidate gate

Accepted field evidence from the company Office network:
- Supra WMS UI/API read-only checks succeed.
- Firebase Secure Token authentication succeeds.
- Firebase RTDB repeatedly returns corporate-proxy HTTP 403 and is rejected as the Office carrier.
- Firestore, Apps Script, Sheets and Drive API hosts are reachable at the transport layer; these responses prove host reachability only.

No further Cloudflare Worker/custom-host Office probe is required for this workstream because Owner explicitly confirms that route is blocked/unavailable.

Before any Google-hosted replacement is called transport PASS, Beta must prove the actual authenticated relay semantics rather than only a host probe. For the preferred Firestore candidate this includes request/result correlation, one sticky ACTIVE Agent, standby takeover at the approved failover threshold, no-Agent behavior, idempotency, sanitized logging and a quota-safe design. No WMS mutation and no Stable action are part of this gate.

## D091 Firestore round-trip gate

Source/build PASS requires:
- locked Firestore Rules for `relay_poc_jobs`;
- main-only Beta Firestore provisioning/readback workflow;
- Agent v16 source using Firestore REST for the D091 listener;
- signed next Beta APK source using Firestore REST for the D091 Picker test;
- no RTDB fallback in the D091 Android client;
- WMS mutation guard remains clean.

Runtime/release PASS requires the Beta Firestore database/rules deployment, Agent prerelease and signed Beta APK pipelines to complete successfully.

**Field PASS is separate and mandatory.** On the company Office network, one Picker request must complete:
`PDA CREATE → Firestore → Agent READ → Agent ACK → Firestore → PDA GET → cleanup`.
The PDA must render `KẾT NỐI PDA ↔ AGENT OK`, and sanitized Agent/PDA logs must correlate the request. A Firestore host 404/403/reachability probe is not PASS.

This D091 field gate does not approve final HA or WMS mutation. After E2E PASS, validate quota-safe D085 multi-Agent/failover before selecting Firestore as final. If authenticated E2E transport fails, move to Apps Script.

## D092 Firestore Picklist confirmation acceptance

Automated source/build PASS requires:
- Agent v17 and Android compile successfully; Windows startup-smoke remains PASS.
- Firestore Rules accept Picker `ANDROID_CONFIRM_V1` create/get/delete ownership and real-base ADMIN conditional `PENDING → PROCESSING → ACK` updates.
- Firestore sticky leader uses conditional writes, keeps the 10-second failure threshold, and only ACTIVE Agent polls confirmation jobs.
- D085 anti-spam semantics are preserved in Firestore: final NOT_FOUND only, 3 within 60 seconds, 5/30/60-minute lock escalation, 24-hour escalation reset.
- Existing D084 primary lookup remains all-date with empty `FromDate`, `ToDate`, `Content`, 100-row paging, exact `PickListCode` trailing-five comparison and fail-closed schema handling.
- Full PickListCode resolver returns exactly one code before mutation; zero or multiple matches cannot call the WMS POST.
- The only WMS mutation in source is the bounded `POST .../pickListConfirms/confirmSkipItem` adapter with one PickListCode, `IsAllowSkipped=true`, `RemainSkip=1`, `WarehouseCode=HY1`, `EnableDCSite=false`.
- Cross-Agent confirmation guard prevents automatic duplicate POST after retry/failover and holds uncertain mutation outcomes fail-closed.
- Android does not unconditionally delete PROCESSING work on timeout and renders the exact success sentence required by D092.
- Secret-value heuristic guard remains PASS; no Owner-provided cURL/session/header/signature value is committed.

Owner field functional PASS remains separate because connected CI cannot execute an authorized company-WMS mutation. On released Beta artifacts:
1. Ensure one or more Agent instances are authenticated and at least one has a valid WMS session.
2. Use a real PickList known to be eligible for the authorized confirmation action; enter its exact final five digits on PDA.
3. Verify one Agent becomes/continues ACTIVE, the request reaches PROCESSING, and WMS confirmation is performed once.
4. PDA must show exactly: `Đã xác nhận lấy lại đơn. Hãy quay lại app SFT / SFT 3 để tiếp tục`.
5. Verify the expected state in SFT / SFT 3.
6. Repeat/retry protection must not issue a second WMS mutation for an already confirmed full PickListCode.
7. Controlled NOT_FOUND tests must preserve 3-in-60s and 5/30/60-minute anti-spam behavior; transport/session/schema errors must not increment strikes.
8. Stable remains untouched.

If a confirmation result is uncertain, the expected behavior is **not** an automatic retry. The PDA instructs the user not to press again and to have the specialist verify SFT / SFT 3.

## D093 Firestore regression acceptance

Automated/source PASS requires:
- Windows Agent build/version is v18 or later for this repair and startup-smoke passes.
- Firestore REST requests resolve the current Windows system proxy per request with Windows credentials; the Firestore transport source must not reference the WMS corporate fallback proxy.
- Only safe Firestore GET/read operations have one bounded retry for transient DNS/connect/timeout classes; conditional claims, ACK writes, leader writes and WMS mutation are not blindly replayed by the transport helper.
- D085/D092 failover threshold remains 10 seconds. A transient coordination error inside that bounded window does not immediately revoke current ownership; an outage beyond the threshold may demote/elect normally.
- Online Agent count is never synthetically forced to one. Failed/stale Firestore coordination or ACTIVE relay polling renders `Online 0` / `FIRESTORE OFFLINE`.
- ACTIVE status becomes healthy only after a real confirmation-collection poll succeeds. Standby still cannot process WMS work.
- Android still-`PENDING` cancellation grace is 30 seconds, total wait remains 120 seconds, and `PROCESSING` work is not deleted/retried.
- D092 exact PickListCode, confirmation guard, anti-spam and only-authorized `confirmSkipItem` mutation guards remain PASS. Stable remains untouched.

Physical regression PASS is separate from CI:
1. Run the D093 released Agent and signed Beta APK.
2. Keep the Agent running while the laptop is on/switches to the company Office network; a process restart must not be required merely to pick up the current Windows proxy.
3. Verify the overlay is truthful during any Firestore outage: `Online 0` / `FIRESTORE OFFLINE`, then returns to ACTIVE only after Firestore relay polling succeeds.
4. Send one controlled PDA request and confirm PDA → Firestore → Office Agent → Firestore → PDA succeeds.
5. Only after this transport regression PASS may OA013 resume the real authorized D092 Picklist confirmation field test.
