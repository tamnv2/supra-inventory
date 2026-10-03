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

## D094 Agent auth and Firestore receive acceptance

Automated/source PASS requires:
- Agent build/version is v19 or later and Windows startup-smoke passes.
- ADMIN session save/restore remains DPAPI CurrentUser; no plaintext password is written to the saved payload or logs.
- Successful ADMIN verification disables login inputs/action, enables Logout and renders a dedicated verification-login state on Overview.
- Logout stops relay participation, clears the saved application session, and permits a different real ADMIN to log in and become the newly saved identity.
- Firestore transport uses the process/default Windows proxy path first, with a fresh system-proxy snapshot only as a bounded retry for safe read operations; it never references the WMS corporate fallback proxy.
- ACTIVE Agent directly queries for `status=PENDING` + `source=ANDROID_CONFIRM_V1` with bounded results. A bounded newest-first list fallback exists for query incompatibility and sanitized poll telemetry reports mode/pending count.
- PDA exposes a short request ID after Firestore CREATE, and Agent logs the same short ID when a pending job is observed before conditional claim.
- D092 conditional `PENDING → PROCESSING → ACK`, exact PickListCode, idempotency, anti-spam and only-authorized `confirmSkipItem` mutation guards remain PASS.
- Stable remains untouched.

Physical field PASS is separate:
1. Install the released D094 Agent and signed Beta APK.
2. Restart Agent and verify it restores the previously verified ADMIN automatically without password entry; login controls are dimmed and Overview says Agent verification is logged in.
3. Logout, verify relay stops and login controls re-enable; log in with the intended ADMIN and restart once to verify that new identity is now restored.
4. On a normal network and on Office where practical, send one controlled PDA request and note the displayed short request ID.
5. Agent technical/audit logs must show the same ID reaching `pending-found`, conditional claim and response/ACK. If CREATE succeeds on PDA but the Agent never logs that ID, the receive path is not PASS.
6. OA013 real WMS confirmation remains blocked until this D094 relay field gate passes.

## D095 Firestore job visibility and dual-network acceptance

Automated/source PASS requires:
- Windows Agent is v20 or later and startup-smoke passes.
- Firestore `runQuery` root and list fallback document arrays are consumed through `IEnumerable` semantics; source must not cast `DeserializeObject(raw)` or Firestore `documents` arrays to `ArrayList`.
- Structured query remains bounded and returns current `PENDING` work; client-side validation still requires `source=ANDROID_CONFIRM_V1`, exact request ID, five numeric suffix, Picker UID and Picker application user ID.
- Firestore polling telemetry reports response-row count and validated pending count, so an empty result can be distinguished from parser loss.
- Safe Firestore reads use three bounded attempts across default/fresh Windows proxy routes; WMS corporate fallback proxy remains forbidden for Firestore.
- Agent refreshes the process default Windows proxy when Windows network addressing changes.
- Android retains a created PENDING confirmation job for the full 120-second wait. Thirty seconds is notification-only; it is not a deletion boundary.
- Terminal conditional cleanup may delete only PENDING. PROCESSING remains no-delete/no-auto-retry.
- Báo hàng source remains `InventoryApi.createPickerReport(...)`; confirmation remains `RelayPocClient.sendProbe(...)` and the confirmation client contains no Báo hàng report mutation route.
- D092 claim/idempotency/anti-spam/exact PickListCode/only-authorized WMS mutation guards remain PASS.
- Stable remains untouched.

Physical field PASS is separate and requires released D095 artifacts:
1. With PDA on its normal Internet network and Agent on a normal Internet network, send one controlled Xác nhận đơn request. The short PDA request ID must appear in Agent `pending-found`, `CLAIM PASS`, and final ACK/response.
2. Put the Agent on the company Office network without changing the PDA's normal network. Repeat with a new request ID; the same correlation must complete through Firestore.
3. If the Agent network is switched while a PENDING job exists, the job must remain available through the bounded reconnect window rather than disappearing at 30 seconds.
4. Separately submit one normal Báo hàng item from the PDA and confirm it still succeeds through the existing Worker/InventoryCore path independently of Agent state.
5. Only after both Agent-network cases and path separation PASS may OA013 real WMS confirmation resume.

## D096 exact PickListCode and confirm acceptance

Automated/source PASS requires:
- Agent build/version is v21 or later and Windows startup-smoke passes.
- `WmsPicklistExactResolver` traverses JSON arrays through non-string `IEnumerable`; it must not rely on `node as ArrayList` as its array path.
- An executable CI regression deserializes a synthetic WMS response containing a full PickListCode inside a JSON array and proves the resolver extracts it.
- The exact resolver still scans only exact `PickListCode` fields, accepts only `PL` + digits, matches the submitted trailing five digits, and fails closed on zero or multiple full-code matches.
- Existing confirmation endpoint and payload contract remain unchanged: one full code, allow skipped true, remain skip 1, warehouse HY1, DC-site false.
- WMS HTTP 2xx classifies `CONFIRMED` only when response business `Status=true`; `Status=false` is `CONFIRM_REJECTED`; missing/unparseable Status on 2xx is `CONFIRM_IN_PROGRESS_OR_UNCERTAIN`.
- CI executes all three confirm-response classifications with synthetic bodies.
- No Owner-supplied Authorization/Token/APISID/SID/SCID/USID/signature/nonce or other secret/session value appears in source, tests, logs or docs.
- D095 Firestore transport/job-visibility guards and D092 idempotency/anti-spam/single-mutation guards remain PASS.
- Android remains beta-vc59; Stable remains untouched.

Physical field PASS:
1. Use released Agent v21 with the already-released signed beta-vc59 PDA app.
2. Choose one real eligible Picklist whose last five digits are known to match exactly one full PickListCode in the current WMS list.
3. Send once from PDA. Agent log must show: Firestore pending-found → CLAIM PASS → exact-resolve HTTP PASS → exact-resolve parse reports non-zero codes → authorized picklist-confirm attempt.
4. WMS confirm must return transport success plus business `Status=true`; Agent then reports `CONFIRMED` and Firestore ACK; PDA shows the approved success sentence.
5. Verify in SFT / SFT 3 that the Picklist reached the expected confirmed state.
6. Repeat of an already-confirmed request must not issue a second WMS POST because the confirmation guard remains authoritative.
7. Any uncertain result must remain fail-closed: do not press again; verify in SFT / SFT 3.


## D097 quota-safe HA and network-transition acceptance

Automated/source PASS requires:

1. Agent build is v22 or later; Android source uses Firebase Auth + Firestore SDK snapshot listener for exactly one request document with persistence disabled.
2. PRIMARY poll interval is 5 seconds, STANDBY 10 seconds, failover/request-age threshold 10 seconds, terminal job age 30 seconds and bounded concurrency is 12.
3. Firestore 4-second leader heartbeat is absent; presence writes are hourly and FROZEN business polling is absent.
4. Firestore Rules authorize direct real-ADMIN `PENDING → ACK`; `PROCESSING` is absent.
5. Queue query is bounded and ordered oldest-first by `status + created_at`; the required composite index is source-controlled and main deploy creates it when missing.
6. Network-address changes call the Firestore transition marker and staged Windows proxy refresh through the 15-second transition period; Firestore transport never uses the WMS corporate fallback proxy.
7. A transport failure preserves role and forces role revalidation before recovered Agent takes new work.
8. Standby takeover is conditional, excludes the failed prior PRIMARY from immediate replacement selection, and can select a WMS-ready replacement STANDBY from bounded presence metadata.
9. The confirmation guard uses one create write, has no second `MarkConfirmed` Firestore write, and can prove confirmed idempotency from the originating ACK.
10. Final NOT_FOUND anti-spam remains 3/60s with 5/30/60-minute locks and is idempotent by request id. FOUND clears persisted wrong-input state.
11. D096 exact resolver, WMS payload/endpoint, business `Status=true` success requirement and secret guards remain unchanged.
12. Báo hàng Worker/InventoryCore path remains unchanged. Stable remains untouched.

Physical acceptance after release:

- Normal network: a valid request should normally complete within 10 seconds.
- Switch Agent laptop between normal Internet and Office without restarting Agent: temporary DNS/proxy transition must not falsely erase role; Firestore must recover on the Windows route.
- With PRIMARY unavailable, a request still pending at 10 seconds must be eligible for STANDBY takeover; after promotion, replacement STANDBY selection is best-effort from live WMS-ready Agents.
- If neither processing path completes by 30 seconds, PDA must direct the Picker to the specialist desk.
- Burst test up to 30 simultaneous requests must not produce duplicate WMS mutation; tail latency and WMS throttling are measured before Stable consideration.


## D098 acceptance matrix

Technical PASS requires all existing authority/continuity/build/deploy guards plus:

1. **Credential migration/auth**: an existing account can authenticate after Firebase migration without a forced mass password reset; Firebase UID remains stable.
2. **Role/client matrix**: PICKER App-only; REPORTER/ROOT App+Web; ADMIN App+Web+Agent. Disallowed clients fail server-side.
3. **Session isolation**: same user can hold Web + App + Agent simultaneously. A forced second Web replaces only Web; second App only App; second Agent only Agent. Old same-channel tokens fail on authenticated business API, not only realtime.
4. **Recovery**: ROOT/ADMIN registered-email reset flow is enumeration-safe and produces a Firebase password-reset link when matched.
5. **Realtime**: Web uses shared V2 session, establishes WebSocket, applies events immediately, survives bounded reconnect/delta recovery, and does not reconnect-storm.
6. **Cloudflare budget**: design-max stress/projection keeps every relevant Workers Paid included metric <=35%; one metric over 35% fails even if total/average is below 35%.
7. **Agent direct auth**: Agent ADMIN login and refresh use Firebase/Google directly and do not require the Inventory Cloudflare Worker; normal and Office network paths remain supported.
8. **Specialist search**: 2 digits cannot search; 3–5 digits search anywhere in full cached PickListCode; result list shows full codes; Confirm requires explicit selection.
9. **Specialist confirm**: uses exact selected full code, cross-Agent guard and WMS HTTP 2xx + `Status=true`; safe failure may release guard; uncertain result fails closed; no APK ACK is produced.
10. **Regression**: D097 PRIMARY 5s / STANDBY 10s / FROZEN no business polling, PENDING→ACK, D096 WMS response semantics, D089 UI/tray/overlay baseline, and Báo hàng business rules remain intact.
11. **Stable**: no Stable deploy/release/resource mutation.

Owner physical acceptance follows technical Beta release and covers cross-device replacement, Office direct Firebase Agent auth, realtime behavior and one controlled specialist direct-confirm scenario.


## D099 acceptance matrix

Technical/runtime PASS requires:

1. Identity Toolkit Beta config readback shows Email/Password enabled and password-required.
2. Ephemeral synthetic PBKDF2-SHA256 (100,000 rounds) user import signs in successfully with `signInWithPassword`, then is deleted.
3. Web and Android real legacy accounts can authenticate with their existing password; wrong password remains rejected.
4. Migration self-heal runs only after canonical InventoryCore hash verification; it never accepts an unverified password or logs plaintext/hash/salt.
5. Agent direct login uses registered ADMIN email, verifies ADMIN/base ADMIN claims, and does not call Inventory Worker.
6. Before Agent auth, Supra region and WMS restore/capture are unavailable. After auth PASS, existing WMS restore/preload/capture resumes.
7. Enter on Agent email/password invokes Login; Enter on eligible PickList input invokes Search; Android Enter/Done invokes Login; Web Enter continues form submit.
8. Overlay can be configured smaller than 420×64, including 120×32, and persists/reloads without being clamped back to legacy dimensions.
9. D097 PRIMARY/STANDBY/FROZEN, D096 confirmation success semantics, Báo hàng Worker path and Stable guard regressions all remain PASS.


## D100 acceptance

Technical PASS requires:
1. Agent v25 accepts an ADMIN username/MNV, derives the same deterministic Firebase sign-in identifier used by the shared logical identity, obtains ADMIN claims on the **same Firebase UID** used by Web/App, and never requires a registered email on the Agent UI.
2. Agent login/refresh remains Worker-independent; auth-first Supra gating, Enter Login, Enter PickList search, D097 HA and D099 expanded Overlay remain unchanged.
3. Every ACTIVE ADMIN has primary Firebase readiness + direct Agent-username readiness before Beta health returns OK; `firebase_agent_ready` does not correspond to another Firebase account.
4. ADMIN create/password/status changes keep the single shared Firebase identity usable from Web/App/Agent; no secondary Agent UID/account is created.
5. Web Tools generated version/tag/download URL exactly match `relay-agent/VERSION`; no old hard-coded tag survives.
6. System Reset navigation/API is denied to ADMIN/REPORTER/PICKER and to ROOT while simulating a lower effective role.
7. Challenge requires correct ROOT password, registered ROOT email, 6-digit code, 10-minute expiry, <=5 attempts and send throttling.
   - The 60-second send throttle is committed only for a successfully sent challenge. If the Gmail provider fails before delivery acceptance, the reserved challenge/throttle is rolled back so a provider failure does not create a false user rate-limit.
   - Gmail provider failures must be classified into bounded non-secret causes (OAuth/scope, Gmail API disabled, domain policy, provider quota/rate, or generic HTTP class) rather than always reporting a missing scope.
8. Reset of any scope preserves ROOT identity/password/recovery email and external Google Sheet/Drive contents.
9. Account reset removes corresponding InventoryCore users and their single Firebase identities; ROOT identity is never included.
10. Firestore reset refuses to run while any confirmation job is PENDING.
11. Reset changes data only; schema/versioned source/logic/UI definitions remain intact after execution.
    - After resetting Runtime Settings, Operational V2 must remain or immediately return to READY in the same runtime: realtime ticket, Reporter queue, Dashboard, SKU import and other business APIs must not require a Worker redeploy/restart.
    - Structural runtime metadata such as the realtime stream epoch is not counted as user-resettable configuration; it may be regenerated automatically during reset to force a clean client resync.
    - A full reset followed by recreating an Admin with a valid email must succeed through validation and Firebase provisioning; valid email syntax must never be rejected by an escaped-regex defect.

12. ROOT/ADMIN recovery request is enumeration-safe; Gmail link token is stored only as a hash, expires after 15 minutes, is single-use, and the resulting password works on Web/App/eligible Agent for the same UID.
13. Stable is untouched.

## D101 acceptance — Agent v26 operations

1. PDA lookup cache miss refreshes WMS once before final NOT_FOUND; manual 3–5 digit search behaves the same. Concurrent misses share the single-flight refresh.
2. A PickList created after the previous preload is found after miss-triggered refresh without restarting Agent.
3. Agent checks GitHub at startup and again in the background while running at a bounded 30-minute cadence; trusted release and SHA-256 guards remain required.
4. Manual PickList results show one row per full code with an inline Xác nhận button; no shared external confirm button remains.
5. Hệ thống Agent shows current machine role and bounded fleet counts for online/PRIMARY/STANDBY/FROZEN; Hệ thống Supra shows WMS/cache basics.
6. Wi-Fi displays the Windows SSID when connected, while diagnostics sanitizer still redacts SID/token/credential values and does not redact `ssid=` by substring collision.
7. Agent local logs rotate by size and remain bounded. Scheduled bundles reach Beta Drive at the four daily slots; crash upload uses `crash_` and retries from a pending marker if necessary.
8. Web online count remains WEB + ANDROID/PDA only and never includes Agent.
9. Clicking Agent logout requires explicit confirmation.
10. No top-level Cài đặt tab remains; operational child pages are promoted to direct tabs.
11. D097 5s PRIMARY / 10s STANDBY / FROZEN-no-business-poll semantics, D096 confirmation semantics, normal Báo hàng flow, and Stable OWNER-GATED status remain unchanged.
## D102 acceptance — Agent v27 Overview, HA convergence and night gate

1. Top-level tabs are exactly the D102 operational set; Hệ thống Agent, Hệ thống Supra and Xử lý PickList are sections inside one Tổng quan page, not separate tabs.
2. Manual **Kiểm tra cập nhật** uses the existing trusted prerelease + checksum path, while startup and 30-minute background checks remain.
3. User-facing Agent UI contains no “cho AI”, Owner handoff or D-number implementation guidance.
4. With >=2 WMS-ready Agents starting together, the four 5-second startup convergence cycles settle one PRIMARY, at most one STANDBY and remaining Agents FROZEN; normal role refresh is 60s for PRIMARY/STANDBY and 5m for FROZEN.
5. D097 business behavior remains PRIMARY 5s / STANDBY 10s / pending-job takeover >=10s / FROZEN no business poll. No duplicate WMS mutation may occur.
6. Fleet table shows account, machine, authoritative effective role, Supra readiness, Agent version and last-seen age. Presence cadence remains 15m write / 30m read / 40m freshness; remote CPU/RAM/Disk are absent.
7. At 21:30 HCM with no decision, warning appears and repeats every 5 minutes. Choosing CONTINUE or STOP suppresses further warnings for that night.
8. If undecided at 22:00, pending-job polling and manual PickList business actions are paused. CONTINUE after 22:00 resumes within the bounded local gate interval. STOP stays paused through 05:00.
9. EXE, tray, updater, logging and watchdog continue while business processing is paused. At 05:00 business processing resumes automatically without restarting Agent.
10. Android/Web business flows and Stable remain unchanged.

## D103 acceptance — Agent v28 dense Overview

1. Fresh launch and restore from tray both open the Agent maximized.
2. Tổng quan has no page-level scrolling at the normal maximized laptop viewport. Hệ thống Agent, Hệ thống Supra and Xử lý PickList are all reachable in the initial viewport, with PickList occupying the remaining lower area.
3. Agent fleet grid shows at most five visible Agent data rows plus its header. A sixth Agent does not increase page height and is accessible using the grid's vertical scrollbar.
4. Searching a suffix that returns multiple PickLists renders one result row per full PickListCode and a visible Xác nhận button on every row. Clicking a row button passes that exact row's code to ConfirmManualPicklist.
5. There is no shared/global PickList confirm button.
6. Visible Overview does not show persistent prose such as Agent version + Firestore/failover explanation, background-update cadence explanation, or local WMS-protection/cache implementation explanation.
7. Compact Agent/Supra operational state, real Wi-Fi, manual update button and after-hours decision banner continue to work.
8. D102 HA/night schedule, D096/D097 confirmation/idempotency/fail-closed guards, Android/Web behavior and Stable OWNER-GATED state remain unchanged.

## D104 acceptance — Agent v29 multi-search and batched confirmation

1. Fresh launch and tray restore are maximized inside the Windows working area; the Windows taskbar remains visible.
2. Input `0404, 39050, 403` is accepted as three normalized search terms. Invalid terms outside 3–5 digits are rejected; duplicate terms do not cause duplicate work.
3. Multi-search evaluates all terms from one cache snapshot. If any term misses, source/telemetry proves at most one shared single-flight WMS snapshot refresh for that user action, not one refresh per term.
4. Search results are deduplicated full PickListCodes, bounded to 50 visible rows. Every row retains its Xác nhận button.
5. With one result, Xác nhận tất cả is hidden. With >=2 results it is visible and targets exactly all displayed full PickListCodes.
6. The WMS adapter accepts 1–10 exact full PickListCodes in `PickListCodes` while preserving `IsAllowSkipped=true`, `RemainSkip=1`, `WarehouseCode=HY1`, `EnableDCSite=false` and D096 HTTP 2xx + business `Status=true` success semantics.
7. Manual confirm-all acquires one existing Firestore confirmation guard per exact PickListCode before mutation. Already-confirmed/uncertain candidates are not re-mutated.
8. A Firestore poll with multiple eligible PDA jobs processes at most 12 jobs as one logical batch; it does not add a faster poll or an extra coalescing query. Shared lookup/exact resolution and WMS chunks <=10 are used.
9. Every PDA job still receives an independent conditional ACK; there is no batch-global ACK and no PROCESSING write.
10. Existing D097 5s/10s/failover/FROZEN rules, D102 night schedule, D103 Overview, anti-spam, secret redaction and Stable OWNER-GATED state remain unchanged.
11. Source/repo contains none of the raw Authorization/APISID/SID/Token/signature/session values supplied in the Owner curl reference.

## D105 acceptance — Android beta-vc63 + Agent v30

1. Picker confirmation input accepts at most 4 digits and submit becomes eligible only at exactly 4 digits. The new APK contains no five-digit readiness requirement.
2. After submit and before terminal result, the button is disabled and visibly dimmed. Editing input while the request is in flight does not re-enable the button or create another request.
3. On terminal result, message text is bold and visibly larger than progress/helper text. CONFIRMED is success-emphasized; failure/lock/error results are error-emphasized.
4. Firestore job from beta-vc63 contains exactly a 4-digit suffix. Rules accept it; legacy 5-digit beta-vc62 jobs remain temporarily accepted during rollout.
5. Agent v30 cache/exact resolver finds full codes using the supplied suffix length. A unique 4-digit suffix may confirm; zero/multiple matches fail closed and do not mutate WMS.
6. Agent specialist manual search accepts 3 or 4 digits per comma-separated term and rejects 5-digit terms.
7. D104 comma multi-search, row-level Xác nhận, Xác nhận tất cả, batch WMS <=10, max12 logical PDA jobs, per-code guard and per-job ACK remain PASS.
8. D097 HA cadence, D102 night schedule, D103 layout, D096 business Status=true semantics, Android Báo hàng path and Stable OWNER-GATED state remain unchanged.

## D106 acceptance — managed account create/reset and Agent direct auth

Technical/runtime PASS requires:

1. Creating ADMIN/REPORTER returns success only after native Firebase password write plus direct signInWithPassword proves the expected Firebase UID.
2. ADMIN password reset/update performs the same native write and direct verification before Firebase/Agent readiness is marked.
3. A forced Firebase provisioning failure after InventoryCore create is compensated; after reload there is no ACTIVE ghost account when external cleanup succeeds.
4. Create rollback is internal, role-bounded, request-id validated, limited to ADMIN/REPORTER and refused once firebase_password_ready=1.
5. Existing Web/App D099 legacy-hash self-heal remains intact; D100 one-UID deterministic username/MNV Agent identity remains intact.
6. Password plaintext, password hash/salt, Firebase ID/refresh tokens and service-account material remain absent from repo/logs/public responses.
7. Beta deployment and health remain PASS; Stable remains untouched.
8. Field proof uses one freshly created ADMIN or one ADMIN password set after D106 deploy, then the unchanged Agent v30 direct Firebase login. The Agent must authenticate without Worker dependency.
## D107 acceptance — professional Web identity and reporting

Technical/runtime PASS requires:

1. Normal login and password-recovery login branding use the committed shared `/app-icon.png`; the legacy numeric `1291` login tile and old `Web nghiệp vụ / Đăng nhập bằng tài khoản Báo hàng 1291` copy are absent.
2. Login visibly shows `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` and `Website nghiệp vụ Inventory` with no credential prefill.
3. The D066 three-group navigation, role routing, D068 toast/history behavior, D071 controls and existing Web business mutations remain unchanged.
4. Light and dark themes cover login, authenticated shell, summary cards, reporting panels, filters, tables and dialogs without light-only islands.
5. Overview renders current pending SKU/Picker, warning/overdue, online users and selected-period report/SKU/affected-Picker/resolved/average-time data from existing authoritative responses.
6. The time chart uses the service-returned timeline buckets and distinguishes reports from resolved work; top SKU rows show report/Picker counts and drill down through the existing detailed-report route.
7. Detailed reporting shows the richer KPI/attention/outcome surfaces, current record range and `Đang mở` + `Tổng lượt báo` columns while preserving filters, 100-row bounded paging and XLSX export.
8. Source/network review proves D107 adds no new backend/provider polling, stock/bin/quantity metrics, employee scoring or quota-heavy system-status route.
9. Web production build, UI Design Guard, authority/continuity guards and Beta deployment smoke pass. Stable remains untouched.
10. Automated PASS is technical only. Final D107 visual acceptance still requires explicit Owner review on live Beta.

## D108 acceptance — Web provenance + Picker dense UI

Technical/runtime acceptance requires:

1. Fresh Web login shows no password-reset account/email form until **Lấy lại mật khẩu** is pressed; clicking again may collapse it.
2. Recent operational results distinguish human Skip from `SYSTEM_TIMEOUT`; human results show resolving account identity and automatic timeout shows actor **Hệ thống**.
3. Admin dashboard/reporting splits automatic-timeout Skip from human Skip using existing `resolution_source`, and detailed rows expose **Nguồn xử lý** + **Người xử lý** without new polling.
4. Picker shortage screen has no **Quét hoặc nhập SKU** heading. Numeric-only SKU input and **Xác nhận** share one row; the hint is exactly **Nhập tối thiểu 3 chữ số SKU**.
5. Typing fewer than three digits shows no SKU suggestions. Choosing a suggestion leaves exactly the selected SKU in the field and no dropdown remains until the field is edited.
6. Selected SKU has a distinct background. Shortage **Xác nhận** is dim while no valid SKU is selected and fully emphasized when selection + existing online readiness are true.
7. Picker contains no automatic-Skip deadline clock/time copy. Completed timeout result may state **Hệ thống tự động do quá hạn**.
8. History title is **Danh sách SKU đã báo hết hàng**; status cards render green/yellow/red/grey for Có hàng/Đang xử lý/Skip/Picker thu hồi.
9. A− / A+ is visible beside Log for Picker. Changing scale persists by authenticated user id; logout/login on the same device restores it, while another user keeps their own value. Scale remains bounded 80–140%.
10. Existing D105 Xác nhận đơn four-digit behavior, withdrawal, realtime result acknowledgement, Android update gate and Stable invariants remain PASS.
11. PR authority/state/UI/Web/Android/build guards, Beta deployment and next signed monotonic Android release must pass before technical release PASS is claimed. Final visual/device acceptance remains Owner field review.

## D109 acceptance — Web audit/preferences/PDA tools + Android compact UI

Technical/runtime acceptance requires:

1. A user with no saved dashboard preference opens `Tổng quan` on **Hôm nay**. After explicitly selecting another valid range, logout/login or another device/session for that same account restores it; a different account keeps its own independent range.
2. `Thời gian xử lý` visibly identifies itself as a global system setting. Saving from one authorized user is reflected to another active authorized Web client through realtime reconciliation; there is no per-user SLA storage or polling loop.
3. `Nhật ký → Lịch sử thao tác` shows bounded/paged actions only for REPORTER, ADMIN and ROOT. Picker actions are excluded from this management view and secret-like metadata is redacted.
4. Human `Đã có hàng` / `Cho phép bỏ qua` recent resolutions show the resolving user; `SYSTEM_TIMEOUT` shows **Hệ thống**.
5. `Công cụ → App PDA` shows release metadata plus a QR and fixed project download URL. The URL contains no hard-coded Beta version and redirects to the highest published numeric `beta-vcN` APK asset.
6. App-PDA release discovery is explicit-page/API driven with bounded cache; no background GitHub/provider polling is introduced.
7. Android Picker header is shorter than the prior fixed 76dp baseline and long identity text remains readable through bounded auto-size/wrap.
8. Header controls appear in order A−, A+, Log, Thoát; A− and A+ are adjacent.
9. `Báo hết hàng` / `Xác nhận đơn` render as a bottom tab bar. Opening the keyboard does not push that tab bar upward or shrink the app content layout.
10. Picker shortage history contains no `dd/MM/yyyy`; it shows `Báo hết lúc: HH:mm` and, for a human resolution, `Invent phản hồi lúc: HH:mm`.
11. SQLite migration to schema 11 is additive and preserves existing business rows while adding audit actor role/display-name projection.
12. Existing D105/D108 confirmation, SKU, withdrawal, result-ACK, per-user scale, quota, Agent/WMS and Stable OWNER-GATED guards remain PASS.
13. Repo Authority, Project State, UI/Web/Service/Android guards, Beta schema-11 deployment and the next monotonic signed Android release must pass before D109 technical/runtime/release PASS is claimed.

## D110 acceptance — Android Reporter pinned workflow

Technical/runtime/release PASS requires:

1. Android Reporter shows four pinned tabs directly below the user/header: Đang xử lý, Đã có hàng, Cho phép skip, Picker đã thu hồi.
2. All four tabs show correct authoritative counts; pending uses queue total and history states use service totals rather than only the rendered 200-row slice.
3. Pending rows show direct Đã có hàng / Cho phép skip buttons below SKU. Pressing either causes no pre-resolution confirmation dialog; repeated taps on the same in-flight batch cannot create a second mutation.
4. Warning pending rows use light yellow; overdue rows use light red; normal rows remain neutral.
5. Waiting minutes advance at calibrated minute boundaries without any network call from the timer. Realtime reconciliation still updates authoritative data and no manual Reporter refresh button exists.
6. App header/login/shared Android identity uses the canonical app icon and login shows the exact requested developer line.
7. Fresh Android login for base ADMIN or ROOT returns CLIENT_ROLE_NOT_ALLOWED; PICKER and REPORTER continue to authenticate. Existing Web ADMIN/ROOT and real ADMIN Agent paths remain allowed.
8. Existing Reporter queue ordering, batch detail, Skip correction, realtime, notifications, Picker D105/D108/D109 behavior, Agent/WMS and Stable OWNER-GATED guards remain PASS.
9. Repo Authority, Project State, UI/Service/Android build guards, Beta Worker deployment and the next monotonic signed Android release all pass before technical release PASS is claimed.
10. Final physical visual/interaction acceptance remains Owner field review on Beta.

## D111 — Android compact daily workflow acceptance

1. D110/OA030 is recorded as Owner PASS before D111 validation begins.
2. Reporter A−/A+ changes the Reporter list/tab typography and relevant controls within 80–140%, persists per user on the same PDA, and keeps the selected tab after resizing.
3. Pending badge is red/white. HAS_STOCK, SKIP_ALLOWED and withdrawn badges are light-grey/dark. All counts still match authoritative scoped totals.
4. Reporter recent rows contain no repeated outcome name, affected-Picker count, or Picker acknowledgement count. They show **Báo lúc** and **Invent phản hồi lúc** when a resolution timestamp exists.
5. Tapping pending **Đã có hàng** or **Cho phép skip** opens a confirmation. Cancelling performs no mutation. Confirming performs one mutation, and repeated taps cannot create a second in-flight mutation.
6. No Reporter summary/empty text duplicates the badge count.
7. Picker App shows all of today's rows plus an older unresolved row; an older completed row is absent.
8. Reporter pending shows an older unresolved batch; Reporter result/withdrawn tabs show only rows first reported today.
9. Scoped Android reads are applied server-side before LIMIT; Web history/reporting remains unchanged.
10. Local minute ticking still performs no API call. Existing realtime, role gate, update gate, D105 confirmation-order flow and Agent/WMS behavior remain PASS.
11. Repo Authority, Project State, UI/Service/Android guards, exact Beta runtime and the next monotonic signed Android release must PASS before OA031 is field-ready.
12. Stable remains OWNER-GATED and untouched.

## D112 acceptance matrix

D112 automated/source gates must verify at minimum:

- Web App/Agent Tools use stable version-independent service URLs; operator runtime no longer enumerates GitHub Releases REST.
- Date presets and 30/60/90 log windows expose correct active state.
- Dashboard/report primary content is not blocked by presence/noncritical summaries and no new polling loop is introduced.
- `REPORT_CREATED` produces bounded/coalesced Web notice logic.
- Drive support logs and hot management audit use the 90-day retention boundary.
- Android update manifest/service trust, SHA/signer checks, safe-area insets, password eye, footer/action auto-size and successful-confirm input clear compile in the signed Beta build.
- Agent v31 builds with normal Windows chrome, post-auth watchdog/protected exit, 3–20 exact-suffix manual lookup, ambiguity fail-close, left-side row confirm and operational/process overlay.
- D104/D105/D097 quota, batching, Firestore and WMS confirmation regressions remain PASS; Stable remains untouched.

After technical/runtime/release PASS, Owner field review must verify final Web Tools/layout/speed/notice behavior, physical Android insets/update/input UX and Windows Agent resize/overlay/watchdog/manual-search interaction.

## D113 — OA033 field acceptance

Automated gates must verify source/build/security contracts before OA033 becomes field-ready. Field acceptance then covers:

1. Web login visual hierarchy, Vietnamese labels, password show/hide, remembered-login behavior without application plaintext-password storage.
2. **Xử lý báo hàng** pending-count badge and existing realtime/hidden-tab new-shortage notice.
3. SLA values remain visible after reload; warning/overdue/auto-Skip switches operate independently; exactly one auto-Skip mode is selected; Skip→Đã có hàng switch/window is enforced from first report time.
4. Web Công cụ has a clean responsive App PDA / Agent Windows layout and stable latest links remain functional.
5. Android Picker hides empty selection copy, keeps Xác nhận readable at scale, and **100%** resets display size.
6. Android login shows **Tài khoản / Mã nhân viên**, aligned password text, friendly invalid-credential copy and exact developer footer.
7. Android Reporter actions sit below timing; completed human resolutions show the responder after **Invent phản hồi lúc**.
8. Agent v32 exposes **Chuyển xuống nền** while native Minimize/Restore/Maximize/X and D112 watchdog semantics still work.
9. D097/D104/D105 quota/Firestore/WMS/no-offline guards remain PASS; Stable is untouched.


## D114 acceptance

1. Enter a 3+ digit suffix on PDA and Agent that appears only in the middle of a PickList; verify it is NOT_FOUND. Enter a true trailing suffix; verify matching works.
2. Agent accepts comma-separated multi-search; PDA input strips/non-accepts separators and submits only one term.
3. Force a suffix with >=2 full PickList matches. Verify Agent performs no WMS mutation and PDA shows the matching full codes as separate rows with row-level **Xác nhận**.
4. On PDA candidate row, press **Xác nhận**, then **Huỷ**; verify no new request. Repeat and approve; verify exactly the selected PickList is re-resolved uniquely and confirmed.
5. Exercise CONFIRMED, NOT_FOUND, AMBIGUOUS_PICKLIST plus at least one infrastructure/session failure and verify Agent/PDA show specific aligned professional messages rather than generic failure text.
6. Agent manual search visibly shows full PickList code, action and per-row result; PDA-originated result remains visibly meaningful on Agent after ACK.
7. Verify Agent runtime reports v33 consistently with release metadata.
8. Web **Công cụ** shows two equal compact cards side-by-side on desktop and one-column stack on narrow width.
9. While Web is on another section, create a controlled shortage. Verify toast/notification still appears and the **Xử lý báo hàng** badge count changes without navigating to that section.
10. Confirm no faster polling/provider cadence, SQLite remains 11 and Stable is untouched.


## D115 acceptance

Technical gates must verify:

1. Agent build/version parity is v34 and PRIMARY confirmation polling is exactly 2,000 ms; STANDBY remains 10,000 ms; failover/takeover remains 10,000 ms.
2. Android confirmation send path does not call cleanup synchronously. Cleanup is single-worker/background, UID-scoped and legacy/foreign denied entries cannot repeatedly block later requests.
3. Android retains listener-driven ACK handling and adds one bounded Source.SERVER final read only when the listener reaches the terminal timeout path.
4. Agent ACK handling has bounded retry + read-after-write verification markers and does not call the WMS business handler again from ACK recovery.
5. Existing conditional PENDING→ACK, per-PickList confirmation guard, D104 batching/chunking, 30-second stale-job guard and D114 suffix/ambiguity rules remain.
6. No new Android polling, no new Firestore PROCESSING write, no new provider/resource and no SQLite migration are introduced.
7. Secrets and PickList values remain redacted from technical latency telemetry.

Owner field acceptance after signed **beta-vc71** + **relay-agent-v34**:

1. Use one healthy PRIMARY, WMS ready, normal network and no failover. Run at least 10 sequential controlled confirmations. For every run without an identified external WMS/network anomaly, Android create→terminal ACK/result RTT must be **<5,000 ms**.
2. Confirm the user-visible send starts immediately; old cleanup entries must not add multi-second delay before Firestore CREATE.
3. Confirm normal successful requests do not show a false “PRIMARY inactive” statement.
4. Confirm a deliberately unresolved request still keeps the 10-second standby takeover rule and 30-second final fallback semantics.
5. Confirm WMS-confirmed work cannot become a false Android timeout merely because the first ACK write/listener delivery was uncertain; ACK recovery must not duplicate WMS mutation.
6. Confirm Stable is untouched.

## D116 acceptance

Technical/source gates must verify:

1. Agent build/version parity is **v35** and PRIMARY confirmation polling is exactly **3,000 ms**; STANDBY and failover/takeover remain 10,000 ms; FROZEN has no business polling.
2. D115 ACK retry/read-after-write, conditional PENDING→ACK, no WMS replay, D104 batching/chunking, D114 suffix/ambiguity rules, 30-second stale-job guard and quiet-hours business gate remain.
3. Android programmatic clearing of the successful PickList input cannot overwrite terminal feedback; the terminal result is rendered after the reset and all existing specific terminal statuses remain.
4. Web operations automatically renders selected-batch Picker detail using the existing prefetch/cache path; no added interval/provider polling is introduced.
5. Web **Danh mục SKU** shows catalog metadata, bounded current-data search/list and the existing validated Excel import/conflict flow.
6. Web **Nhân sự & tài khoản** renders bulk checkboxes only for Picker. All-Picker mode permits individual exclusions and the API/core enforces excluded_user_ids while still targeting only PICKER.
7. SQLite remains 11; no new provider/resource/Firestore PROCESSING state or Android polling is introduced; Stable remains untouched.

Owner field acceptance after the D116 signed Android + relay-agent-v35 release must verify:

1. With one healthy PRIMARY, WMS ready, normal network and no failover, run at least 10 controlled confirmations. Healthy Android create→terminal result must remain **<5,000 ms**.
2. On CONFIRMED, the input may clear for the next entry but the success result must remain clearly visible. Exercise at least NOT_FOUND/AMBIGUOUS plus one transport/session failure and confirm their specific results also remain visible.
3. Confirm the PRIMARY 3-second release materially reduces Firestore background-read consumption versus D115 2-second operation while STANDBY remains 10 seconds and FROZEN remains no-poll.
4. Web Operations shows selected-SKU affected Picker rows without a reveal click and without duplicate/repeating detail loads.
5. Web SKU page shows current metadata/search/list and still completes a controlled Excel import/conflict check.
6. Web Users: ROOT/ADMIN/REPORTER cannot be bulk-selected; select all Picker, deselect at least one Picker, perform a non-destructive status action on a safe test set, and verify the excluded Picker is untouched.
7. Stable remains OWNER-GATED and untouched.

## D117 acceptance — proactive Firestore HA and scheduled relay freeze

Technical/source gates must verify:

1. Agent build/version parity is **v37**. PRIMARY queue polling is exactly 4,000 ms idle and 2,000 ms hot; hot mode is bounded. STANDBY/FROZEN execute zero business-queue polling.
2. PRIMARY generation lease cadence is 7,000 ms and hard failover threshold is 10,000 ms. Killing an idle PRIMARY causes STANDBY promotion without creating a PDA job.
3. Each takeover creates a new generation; a stale prior PRIMARY fails the pre-mutation role/generation fence and performs no WMS mutation.
4. WMS has no periodic health timer. Startup validation remains; a real request may prove/expire the session; STANDBY→PRIMARY performs one read-only takeover probe.
5. Android Beta candidate is **beta-vc73** with terminal relay wait 20,000 ms. Agent skips automatic jobs older than 20,000 ms. Existing conditional ACK, D104 guard/batching and no-replay-on-uncertain semantics remain.
6. Normal relay is enabled 06:00–22:00 Asia/Ho_Chi_Minh. At 21:30 PRIMARY starts warnings every 5m for the 22:00 boundary.
7. CONTINUE at 21:30 keeps relay active through 23:00. At 22:30 the next five-minute warning cycle asks about continuing beyond 23:00. Equivalent hourly behavior continues after midnight until regular 06:00 resumes.
8. STOP or no answer freezes PDA relay at the upcoming boundary. While frozen, all Agents perform no automatic PDA business processing and PRIMARY lease stops.
9. During relay freeze, direct/manual PickList search and confirmation on the Windows Agent remain enabled and continue using existing WMS safeguards.
10. Before 06:00, **Khởi động relay đến 06:00** succeeds only with a usable WMS session. The confirming machine becomes PRIMARY; another online eligible Agent becomes STANDBY best-effort; remaining Agents stay FROZEN.
11. At 06:00, normal relay resumes automatically without an Owner action. At 22:00 the next evening, the new decision cycle applies.
12. No new provider, Firestore collection, SQLite migration, PROCESSING job write, Android polling or Stable change is introduced.
13. Repo Authority, Project State, UI/Android/Relay Agent/Firestore guards and Beta release gates must PASS before D117 is recorded as technical/runtime/release PASS.

Owner field acceptance:

- Verify normal healthy PDA→terminal result remains under 10s.
- Kill PRIMARY while idle; verify STANDBY becomes PRIMARY within 10s from PRIMARY loss, then the next PDA request completes normally.
- Kill PRIMARY during a controlled request; with Firestore/WMS still responsive, verify terminal result target is <=20s and no duplicate WMS mutation occurs.
- Verify 21:30 warning cadence, 22:00 default freeze, one-hour overtime extension, 22:30 next-hour warning and an additional post-midnight extension.
- Verify frozen mode rejects/does not consume PDA relay work while manual Agent confirmation still works.
- Verify early-start before 06:00 makes the confirming Agent PRIMARY and restores the full relay model.
- Stable remains untouched.

### D117 final hardening additions

- Final Windows artifact target is **relay-agent-v37**; Android remains **beta-vc73**.
- Source/CI must prove `FrozenRoleRefreshMs = 30000`, while FROZEN still cannot business-poll.
- PRIMARY lease payload must contain schedule key/decision/boundary/override fields and a schedule decision must trigger an immediate lease write.
- STANDBY must read schedule fields from the generation lease even if its local schedule view has just become disabled; no takeover is allowed unless the resulting shared schedule permits relay.
- After lookup/guard work, request age must be rechecked at 20s. Expired work performs no WMS POST.
- Immediately before every WMS POST chunk, the Agent must revalidate current PRIMARY generation. A lost fence stops remaining mutation, safely releases untouched guards and leaves affected jobs without terminal ACK so the valid PRIMARY may continue.
- Early-start field acceptance requires another online Agent to converge to STANDBY/FROZEN within the bounded 30s control refresh, without PDA business polling on FROZEN.

## D118 acceptance — fleet overtime, pagination, SLA, export, Agent footer and Android keyboard

Technical gates must verify:

1. Agent build target is v38. Overtime submission has no PRIMARY-only guard; every authenticated Agent can submit, while Firestore schedule write uses document update-time CAS and does not change role.
2. Two Agents submitting conflicting decisions for the same boundary cannot overwrite the first authoritative decision; the loser refreshes current schedule state.
3. D117 PRIMARY lease/failover/generation/WMS fences remain intact.
4. SKU search, Reporter result history, Picker report history and runtime logs expose real server pagination; runtime Drive logs include nextPageToken. Existing Users/Audit/Reporting pagination remains.
5. Reporter active pending queue still loads all server pages and is not replaced by a partial UI page.
6. SLA save carries expected policy revision; server rejects stale revision with `SLA_CONFIG_STALE`; policy revision increments on successful writes. Web does not render fake/default values while configuration is loading.
7. SLA professional layout exposes authority, revision, last update, thresholds and policies.
8. Export uses the selected range/filter and produces the six D118 workbook sheets, including per-Picker lifecycle and SKU aggregation.
9. Agent displays the approved bottom-right product credit.
10. Android manifest uses `adjustResize` and the Picker tabs remain outside the weighted content FrameLayout so they resize above IME.
11. Web/Worker/Android/Agent builds and existing regression guards pass; SQLite remains schema 11; Stable remains untouched.

Owner field acceptance after release:

- On an office STANDBY/FROZEN Agent while another machine is PRIMARY, confirm overtime and verify the fleet—including the remote PRIMARY—shows/obeys the same decision without changing which machine is PRIMARY.
- Verify a conflicting click on another Agent cannot overwrite the first decision.
- Navigate multiple pages for SKU, result history, Picker history, Web/Android logs and existing Audit/Reports; verify next/previous returns the expected records with no silent cut-off.
- Change SLA on one browser, reload/open another browser, verify identical values; attempt a stale save from an older tab and verify it is rejected/reloaded instead of overwriting.
- Export a controlled date range and verify all six sheets contain useful detailed data matching the selected range/filter.
- Verify Agent footer visually.
- On Android confirmation tab, open numeric keyboard and verify `Báo hết hàng` / `Xác nhận đơn` tabs remain visible immediately above the keyboard.

## D119 — Protected-baseline and new-feature acceptance

D119 cannot be called PASS unless all of the following hold:

1. D118 protected regression suite remains PASS: Firestore confirmation PENDING→ACK semantics, one-write confirmation guard, PRIMARY generation fence, 7s lease/10s failover, zero STANDBY/FROZEN business polling, WMS bounded confirmation adapter, schedule authority and no-offline business guard are unchanged.
2. Reporter/Quản trị Invent pending queue is oldest-first and no longer sorted primarily by affected-Picker count; Picker and resolved histories remain newest-first.
3. ADMIN Android session is server-authorized only for Reporter-equivalent operations; Root Android remains denied.
4. PICKPACK_ADMIN attempts to resolve/correct Báo hàng, modify SLA/auto-skip, reset system or manage Invent/Root are server-denied; the same PICKPACK_ADMIN account must be able to authenticate on Windows Agent and use guarded PickList lookup/confirmation plus D119 Agent SKU sync/update. WMS mutation still requires the existing exact-code, generation-fence, confirmation-guard and fail-closed checks.
5. Login + Android notification registration makes a Picker visible in Agent presence without any prior Xác nhận đơn. Logout/session replacement/disable/expiry removes it.
6. Presence implementation contains no periodic PDA heartbeat and stays within the approved bounded Agent refresh cadence.
7. Critical FCM alert without overlay permission still falls back to an accepted visible notification; overlay permission must never be required for ordinary existing Báo hàng correctness.
8. Picker-contact command data contains no FCM token/credential and stale commands expire/clear safely.
9. WMS SKU sync persists only SKU + product name; changed names require confirmation and missing rows never delete catalog entries.
10. Agent authenticated layout hides login controls, uses standard window chrome, max-five Agent/PickList viewports with scroll, compact Supra and compact Picker rows.
11. Fleet metrics do not alter D117/D118 lease document shape/cadence; failover reconstruction preserves accepted/processed totals.
12. Stable resources remain untouched. Beta Functions/Firestore resources are the only new billed Google runtime surface.
13. Full-update release channel is advanced only after Web/Worker, Functions/Rules, Android and Agent gates all pass together.
14. At a closed 23:00–05:00 App/PDA window, server rejects new Android business mutation and Android Xác nhận đơn cannot create a Firestore request. A one-hour Invent/Root Web overtime extension reopens the same server-authoritative window; repeated explicit extensions add one hour each without adding a PDA heartbeat/poll loop.

## D120 — Field-repair acceptance

### Agent
1. With >1 visible page of Pickers, scroll to the middle; allow multiple automatic refreshes and trigger one manual/state refresh. PASS only if the visible anchor remains in place and no jump-to-top occurs.
2. Search by employee-code substring and Vietnamese/full-name substring. Verify **Mã nhân viên** header and whole-row hover on text/action cells.
3. Verify two-column Overview: Agent/Supra/PickList left, online Picker right. Verify **Đăng xuất** and **Chuyển xuống nền** remain usable and tray restore works.
4. Verify no redundant normal-surface `PRIMARY / STANDBY / FROZEN` summary line.
5. With an authenticated Supra session, verify the displayed Supra user. Press **Đăng xuất Supra**: wrong Agent password rejects; correct password clears Supra session and returns the normal login button. Next login opens the browser and permits a different authorized Supra account.
6. Verify Agent logout restores Agent username/password fields and no old local WMS session remains.
7. Overlay settings show separate metric groups/tiles; lock/click-through, resize, opacity/color and persisted selections still pass.
8. Quota regression: startup/UI refresh must not write/read fleet-metrics checkpoints every few seconds. Durable fleet-metrics attempt cadence is bounded to approximately 30 minutes; D117 PRIMARY business queue/lease cadences are unchanged. Inspect sanitized logs for absence of repeated `FLEET_METRICS checkpoint` storms.

### Android
9. With overlay permission granted, receive HAS_STOCK and SKIP_ALLOWED while another app is foreground. PASS only if the canonical blue/red Picker result UI appears directly over that app.
10. A result must have one full-screen UI only: no generic **Đã xem / Mở ứng dụng** result surface followed by a second blue/red screen. ACK once and verify the same event does not reopen in-app.
11. Deny overlay permission and verify the accepted notification → in-app result fallback still works.
12. Kill/relaunch or switch away/back while the interactive session is valid. PASS only if login form never flashes; restore screen/home is used. True invalid/expired session still reaches login.
13. Force temporary network failure during result ACK; verify retry remains bounded to ACK only and later authenticated resume completes it without duplicate business resolution.

### Web
14. Save `FIRST_REPORT`, reload/reopen and verify it remains authoritative. Repeat for `PER_PICKER`.
15. While editing SLA, allow secondary statistics/realtime activity; selected radio/checkbox/input values must not reset. A concurrent newer policy revision must return `SLA_CONFIG_STALE` rather than overwrite.
16. Radio/checkbox geometry is compact/readable and current server mode is explicitly shown.
17. At 100% browser zoom on a Windows display with visible taskbar, scroll to the final controls/footer on long routes; nothing is permanently covered.
18. As ROOT, change a managed account REPORTER ↔ ADMIN ↔ PICKPACK_ADMIN and verify new permissions/claims after re-login. As ADMIN/PICKPACK_ADMIN, the role-change control is absent and server rejects a crafted role change. PICKER cannot be converted manually.

### Release gates
- Repo Authority Guard, Project State Guard/continuity, UI Design Guard, Worker typecheck/Web build, Android build, Relay Agent build and all affected regression suites must PASS before merge.
- Main Beta runtime health must report the exact merged source and all applicable deploy/release workflows must PASS.
- Publish the next monotonic signed Android Beta and `relay-agent-v40`, refresh `inventory-channel`, and keep Stable OWNER-GATED/untouched.

### D120 hotfix — Picker presence regression

1. Keep Agent Overview open for at least two minutes during normal operating hours. PASS only if the Picker list never disappears/reappears on the one-second schedule timer.
2. Log in exactly one Picker PDA, then a second. PASS only if Agent shows exactly those active Picker users after projection convergence; historical logged-in/registered-but-disconnected devices must not appear.
3. Disconnect/terminate one active Picker realtime session without relying on a clean UI logout. PASS only if its socket lifecycle removes it from the projected online set; no per-PDA heartbeat is required.
4. Scroll to the middle of a multi-row list and use employee/name search while refreshes occur. PASS only if no-op refreshes do not rebuild the grid and genuine updates preserve the closest valid scroll/selection anchor.
5. Verify Agent v41 rejects a legacy schema-v1 Picker presence projection instead of treating it as current online truth.
6. D117/D118 confirmation HA/generation/WMS mutation fences and Stable must remain unchanged.

## D121 — Agent responsiveness and balanced-layout acceptance

D121 passes only when all of the following are true:

1. Keep Agent visible during normal work and during a temporary Firestore/network interruption. Drag/resize, switch tabs, scroll Picker/Agent grids and type in PickList while background schedule refresh occurs. The window must remain responsive and must not enter a repeated Windows **Not Responding** state.
2. Static/source guard confirms `RefreshSharedScheduleNow()` is queued off the WinForms timer thread with a single-flight fence; the one-second schedule timer itself performs no synchronous Firestore request.
3. System-monitor sampling (`_systemMonitor.Sample()`) is queued off the UI thread and overlapping 5-second tray-monitor ticks are coalesced.
4. On Overview, the left column visibly contains three equal-height responsive regions: **Hệ thống Agent**, **Hệ thống Supra**, **Xử lý PickList**. Resizing preserves the three-way balance.
5. In **Hệ thống Agent**, Agent / Relay / Wi‑Fi appear on one line. Long machine/user/network text may ellipsize but must not overlap adjacent labels.
6. Agent fleet content uses the remaining height of its card with internal scrolling; PickList remains usable and no longer monopolizes left-column height.
7. Existing D120 Picker search/scroll/no-flicker behavior remains PASS, and D117/D118 confirmation HA/generation/WMS mutation fences are unchanged.
8. No new provider, database, heartbeat, polling loop or Stable change is introduced. Candidate release is `relay-agent-v42`.

## D122 — Agent stability, recovery and operational UX acceptance

D122 technical/release PASS requires:

1. Agent target is **relay-agent-v43**. D117/D118 PRIMARY/STANDBY/FROZEN business polling, 7-second lease, 10-second failover, generation fence and guarded WMS mutation semantics remain unchanged.
2. WinForms network-status and watchdog timer callbacks queue their blocking work off the UI thread with single-flight protection. Startup does not synchronously create the overlay before the main window becomes interactive.
3. Keep Agent visible through normal use and temporary network/Firestore disruption; resize, move, switch tabs, scroll grids and type/search. PASS only if the main window remains interactive and no repeatable Windows **Not Responding** condition is produced by the corrected paths.
4. Overview left column renders approximately 50% Agent / 25% Supra / 25% PickList at multiple window sizes. Agent fleet fills its card and scrolls internally after visible capacity is exhausted.
5. Agent / Relay / Wi-Fi remain on one responsive line.
6. Manual **Cập nhật SKU** displays explicit success/failure. Run a controlled all-unchanged synchronization and verify Agent reports success with unchanged count, while Web **Danh mục SKU** advances **Đồng bộ Agent gần nhất** but does not falsely advance **Dữ liệu thay đổi gần nhất**.
7. **Ca vận hành** appears under Vận hành for the existing authorized management roles; +1h/stop controls use the existing D118 shared schedule endpoint. Công cụ no longer contains overtime controls.
8. Expire/revoke Agent credentials in a controlled test: login inputs must return without requiring process restart. Expire the Supra/WMS session: normal Supra login/capture action must return and open the existing browser capture flow.
9. Bảng nổi opens reliably. Change background opacity from opaque to translucent: background changes opacity while all metric text remains crisp/fully opaque. Lock/click-through, move/resize and persisted visibility remain functional.
10. With **Tự căn cột theo nội dung** checked, resize the Agent window and verify Agent/Picker/PickList grids recalculate. Uncheck it, manually resize columns, restart/re-login the same Agent user and verify widths restore. Another Agent user must not inherit those manual widths.
11. Existing D120 Picker search/scroll/no-flicker behavior stays PASS. No new provider, database, heartbeat or business polling loop is introduced. Stable remains OWNER-GATED and untouched.

Owner field acceptance remains required after release before D122 is called Owner-PASS.

## D123 — Agent UI-thread affinity / v44 acceptance

D123 technical/release PASS requires:

1. Target Agent is **relay-agent-v44** and source guards reject the v43 pattern where `ApplyD119AuthenticatedLayout(authenticated)` executes after/outside the UI-dispatch block in `SetAgentAuthUi`.
2. Authenticated layout, column preference application, DataGridView auto-sizing, Picker rendering and fleet metric rendering contain WinForms thread-affinity guards and marshal to the owning UI thread before touching controls.
3. Existing network/system-monitor/watchdog/schedule background protections from D121/D122 remain intact. No polling, heartbeat, Firestore checkpoint, WMS probe or mutation cadence is increased.
4. Physical OA049 repeats the exact v43 failure path: open/restart with saved Agent + Supra sessions at least three times, keep Overview active for several minutes, resize/move, switch tabs, scroll and type/search. PASS requires no immediate or repeatable Windows **Not Responding** state.
5. Recheck the accepted D122 presentation/flows: 50/25/25 left layout, Picker stability, explicit SKU result/Web checkpoint, Ca vận hành, session-login recovery, Bảng nổi and per-user column sizing.
6. Execute one controlled normal PickList confirmation to verify D117/D118 HA/generation/WMS mutation fences remain unchanged. Stable remains OWNER-GATED.
## D124 — Agent v45 / SKU daily lock acceptance

- **Overlay absence:** Agent has no Bảng nổi/Overlay top-level tab, tray action, settings control or runtime overlay window. Agent starts/restores without loading Overlay code.
- **Agent metrics layout:** while confirmation requests arrive, Hệ thống Agent updates Nhận, Đã xử lý, Thành công, Lỗi and Chờ without requiring a tab switch. The compact state/counter region is approximately 30% of the Agent card and the fleet grid fills the remainder with internal scrolling.
- **SKU progress:** a manual synchronization visibly advances through daily check → Supra read → chunk X/Y → Service wait/RUNNING → terminal result. Automatic synchronization uses the same concise status path without a modal success requirement.
- **Single-daily send:** after one Agent reaches Service submission, a second Agent and a repeated manual click on the first Agent must be refused for that Asia/Ho_Chi_Minh day and must not create another daily operation. Restarting Agent must not bypass the persisted daily lock.
- **Pre-submit retry:** a failure before any Service job is submitted may expire/release the preparation lease and retry safely.
- **Uncertain Service timeout:** after Service submission, timeout/failure must retain the daily lock and show that the operation is held to prevent duplicate send; it must not shorten the lease to 15 seconds.
- **Service progress contract:** `skuSyncCreated` writes `RUNNING` before invoking the internal SKU import Worker path; Agent accepts PENDING/RUNNING as non-terminal and waits up to the bounded 180-second limit.
- **Regression:** D117/D118 confirmation, generation/failover/WMS fences, D120 Picker online rendering, D123 WinForms UI-thread affinity and Stable OWNER-GATED policy remain unchanged.

## D125 — Operating-model acceptance

D125 implementation cannot PASS until all applicable checks below pass:

1. Android Picker contains no `Xác nhận đơn` tab, PickList input, PickList Firestore request or PickList result UI; Báo hàng opens directly and existing Báo hàng behavior still passes.
2. Source/runtime audit finds no active path that captures, persists, refreshes or uses Supra/WMS session cookies, headers, tokens, signatures, browser-profile session material or derived auth.
3. No active Agent/Web/Function path performs PickList lookup/confirmation or WMS/Tồn Bin SKU synchronization.
4. Web exposes no obsolete Supra-session/PickList/WMS-SKU controls; unrelated accepted Web functions are regression-tested.
5. Manual SKU file import remains functional with the canonical validation/dedupe/additive/conflict rules.
6. Windows client runs in dormant/lightweight non-Office mode and activates Office Inventory UI on the approved Office network without treating SSID as authorization.
7. Office UI exposes only role-authorized Inventory capabilities and contains no Supra/WMS session, PickList or Tồn Bin surface.
8. Office bridge traffic through Firebase/Google is bounded and contains no WMS/Supra secrets. Authoritative business transitions remain enforced by InventoryCore/Worker.
9. Legacy PickList relay/WMS resources are disabled from runtime use or removed according to the implementation migration plan without deleting unrelated Báo hàng data.
10. Stable remains untouched unless separately Owner-authorized.

## D126 — Browser-UI PickList acceptance

D126 supersedes the D125 operating-model acceptance before D125 implementation.

D126 cannot PASS until all applicable checks below pass:

1. Current Android/PDA `Xác nhận đơn` remains available and its existing Firestore request/result/ACK behavior regresses cleanly.
2. Source/runtime audit finds no active programmatic capture, storage, decryption, refresh, replay or API attachment of Supra/WMS cookies, headers, tokens, signatures or browser-profile authentication material.
3. Direct WMS PickList lookup and `confirmSkipItem` API mutation paths are removed/disabled from runtime.
4. **Truy cập Confirm PickList** opens the registered page in the managed browser; user can log in normally; Agent becomes **Web Confirm sẵn sàng** only on the expected page with a uniquely recognized DOM.
5. Browser can be hidden from desktop/taskbar and restored while remaining usable for DOM automation.
6. Resolver accepts only visible full codes matching `^PL[0-9]+$` and exact submitted numeric suffix. Zero and multiple matches never become a unique result.
7. An initial zero-match may trigger exactly one semantic **Tìm kiếm** click and one re-resolution. A second miss returns not found without mutation.
8. Manual Agent flow displays the unique full code and waits for the Agent operator confirmation action. Immediately before mutation it re-resolves the exact row.
9. PDA flow skips that extra human Agent confirmation only after the same unique DOM resolution and existing HA/guard/rate-limit checks.
10. Mutation selects only the checkbox contained in the re-resolved full-code row, verifies checked state, then clicks exactly one enabled button whose normalized visible text is **Xác nhận lấy lại hàng**. It must then require exactly one visible second-step dialog with exact title **XÁC NHẬN LẤY LẠI HÀNG**, exact question **Bạn có chắc chắn cho phép lấy hàng lại không?**, exactly one scoped **Xác nhận** action and exactly one scoped **Đóng** action; only **Xác nhận** may be clicked.
11. Any missing/multiple/changed row, checkbox, primary confirmation button, dialog, dialog title/body or dialog action aborts. Tests prove Agent never chooses **Xác nhận hoàn thành lấy hàng**, **Xuất File**, dialog **Đóng**, or a page-global generic **Xác nhận** control.
12. No coordinate-only mouse automation is used for the confirmation mutation.
13. Uncertain post-click state is not reported as success and is not blindly retried.
14. D117/D118 HA/generation/freshness semantics, D120 Picker presence, D123 UI-thread safety, D124 Agent counters/no-overlay behavior and Báo hàng remain functional except where explicitly superseded by D126.
15. WMS/Tồn Bin SKU catalog sync, automatic daily SKU sync and Agent WMS SKU update are inactive. Existing Web manual SKU file import still passes canonical validation/dedupe/additive/conflict rules.
16. Stable remains untouched unless separately authorized.

### D126-H2 field-repair acceptance

- Real-page readiness must recognize exactly one non-mutating **Tìm kiếm** action when its exact normalized label is provided by visible text/value, `aria-label`, `title`, or one unique exact-text leaf that dispatches through the page DOM. Zero/multiple matches remain not-ready/fail-closed.
- A dropped DevTools page WebSocket must be recoverable without starting competing browser instances against the same profile: reattach to the existing loopback DevTools target first, otherwise close/restart only the managed browser and reopen the registered Confirm page.
- Recovery must not enable Network inspection, extract/replay browser authentication material, add direct WMS API calls, weaken the one-search limit, or broaden the exact confirmation mutation selector.
- Physical OA051 field PASS still requires the real page to reach **Web Confirm sẵn sàng** and then pass unique lookup, miss/ambiguity and guarded confirmation scenarios.




### D126-H3 decorative search-label acceptance

- On the real Confirm PickList page, one unique visible search action may be accepted when its normalized label is **Tìm kiếm** plus only decorative icon/glyph material. Unicode NFC and zero-width formatting differences may be normalized.
- Decorative compatibility is limited to the non-mutating search action. Zero or multiple resolved controls remain not-ready and fail closed.
- Readiness diagnostics may expose only exact/decorated match counts.
- **Xác nhận lấy lại hàng** remains exact-label-only and all D126 row, checkbox, checked-state and wrong-button guards remain unchanged.
- Physical OA051 PASS requires `relay-agent-v49` to reach **Web Confirm sẵn sàng** on the real page before the remaining lookup and confirmation field checks continue.


### D126-H4 second-step modal acceptance

- The primary **Xác nhận lấy lại hàng** click is not terminal success; Agent must observe the exact second-step confirmation dialog and activate only its uniquely scoped **Xác nhận** action.
- Missing dialog, duplicate dialog, title/body mismatch, duplicate/missing/disabled dialog confirm, or missing/duplicate **Đóng** shape guard must fail closed without a fallback click.
- The generic word **Xác nhận** is permitted only inside the uniquely identified exact dialog. No page-global generic confirmation search is allowed.
- After the modal click, existing terminal DOM success/error or stable row-removal evidence is still required. Modal click alone is never reported as success.
- Physical OA051 PASS requires the real v50 flow to complete checkbox → **Xác nhận lấy lại hàng** → dialog **Xác nhận** → trusted terminal result.

## D127 — Quota, page-readiness and owned-browser acceptance

1. Seed dozens of historical `PENDING` relay jobs older than 20 seconds. PRIMARY polls for at least five minutes. PASS only if query results do not contain those stale documents and no broad list fallback is used.
2. Create a fresh PDA request and verify normal D126 processing still occurs within the existing terminal window.
3. Log in/connect exactly one Picker Android session. PASS when PRIMARY Picker list updates without a 15-second/one-minute presence poll. Disconnect unexpectedly: row remains in temporary-disconnect state for about 180 seconds; reconnect before expiry restores it. Explicit logout removes immediately.
4. Keep all Picker sessions unchanged for at least ten minutes. PASS only if logs show no periodic Picker projection/contact reads caused by the UI timer.
5. Cross 14:00 with a valid Android session and verify it remains present. At a closed 23:00 window the local list clears; entering the 05:00 window performs at most one initial snapshot.
6. Populate historical resolved Picker alerts plus one open command. PASS only if Agent query returns open `PENDING/SENT` commands without scanning the historical resolved set.
7. On real Supra Confirm PickList with paginator not 100, verify Agent selects exact **100**, waits for reload and then resolves up to the visible maximum. Already-100 must produce no redundant selection.
8. Use a PickList row that is visible but whose checkbox is initially disabled. PASS only if Agent spends at most one exact **Tìm kiếm** refresh for the whole batch, then proceeds if the checkbox becomes enabled. If it remains disabled, it reports Supra rejection and performs zero confirmation click.
9. Run a burst with multiple PDA suffixes, including missing/disabled rows. PASS only if the batch produces at most one Search refresh.
10. Install/publish the Agent-owned browser bundle. On a capable x64 machine, PASS when Agent starts the Fixed WebView2 host/profile, normal user Edge can be closed/terminated without killing Agent Web Confirm, and login/profile persistence works without Agent logging/reading credentials.
11. Remove/corrupt/block the owned bundle on another test. PASS when Agent automatically falls back to dedicated-profile Edge or Chrome and D126 DOM confirmation still works.
12. Source guards must prove Runtime/Page-only browser control, no Network/cookie/token/session extraction, checksum verification for the browser bundle, v51 build alignment, D117/D118 HA invariants, and Stable untouched.

## D127-v64 — login-aware direct Confirm route acceptance

1. **Logged-out path:** open the Agent-owned browser. It must target the canonical Confirm PickList URL. After the login page fully loads and exact visible text **Lưu thông tin đăng nhập** is present, PASS only if Agent shows **Cần đăng nhập Supra trên trình duyệt** and performs no automatic Confirm reload while that marker remains.
2. Complete Supra login manually in the browser. If Supra lands on Dashboard, PASS only if Agent directly navigates the same tab to the canonical Confirm URL exactly once and then reaches normal D126/D127 readiness without clicking any Dashboard card/action.
3. **Already-authenticated path:** with the saved browser profile already logged in, open the Agent browser. If the first canonical Confirm navigation is redirected to Dashboard, PASS only if the fully loaded non-login page triggers exactly one direct Confirm retry and reaches Confirm.
4. Force the retry target to remain on a loaded non-login, non-Confirm page. PASS only if Agent stops after one retry, shows **Chưa vào được Confirm sau khi thử lại**, and produces no navigation loop.
5. Source guards must fail if Agent-owned host/controller contains Dashboard warehouse/SFT3 selector/click automation. They must require exact login marker detection, `document.readyState === 'complete'`, one bounded direct Confirm retry, Agent build 64 and host build 9.
6. Existing D126 Confirm semantic DOM, paginator 100, checkbox/search/modal mutation guards, Firestore HA/idempotency/quota rules and Android `beta-vc76` remain unchanged. Desktop browser fallback remains explicit; Stable remains OWNER-GATED.

## D127-v65 — cross-host Dashboard retry acceptance

1. Start with an already-authenticated Agent WebView2 profile. Open the Agent browser and let the canonical Confirm request redirect to Dashboard. PASS only if Agent retries the canonical Confirm URL once even when the Dashboard/SSO current host is not `wms-supra.winmart.vn`.
2. The first loaded non-login/non-Confirm URL must remain stable for at least 750 ms before that retry. PASS only if transient SPA/redirect states do not consume the single retry.
3. After retry issuance, Agent must show retry-in-progress during a 3-second navigation grace. It must not immediately report retry exhausted while navigation is still committing.
4. If the retry settles again on a loaded non-login/non-Confirm page, PASS only if Agent stops after that single retry and shows **Chưa vào được Confirm sau khi thử lại**.
5. Logged-out regression: exact visible **Lưu thông tin đăng nhập** still blocks retry; after successful login and marker removal, a non-Confirm destination receives one direct Confirm retry.
6. Source guard must reject reintroduction of the v64 current-page host-prefix gate. Agent target is v65; WebView2 host remains build 9 and must not be republished solely for this controller fix.
7. Existing D126 semantic row/checkbox/search/modal guards, D127 quota/presence guards, Android `beta-vc76`, and Stable OWNER-GATED remain unchanged.

## D127 Dashboard Probe v1 — field diagnosis acceptance

1. Windows x64 build and self-test PASS. The packaged probe reuses the installed Agent Fixed WebView2 runtime and uses its own probe profile; it does not bundle or read authentication material from the normal Agent browser profile.
2. Initial navigation is exactly `https://auth-supra.winmart.vn/dashboard`. If Supra requires login, credentials remain browser-only and the probe waits for the Dashboard.
3. Target scan records only structural counts. Automatic activation proceeds only when the intended right-arrow target is unique by **Kho Hưng Yên 1 + SFT3**, or when there is exactly one right-arrow candidate on the whole accessible document/frame tree.
4. Same-origin iframe traversal must accumulate each frame's viewport offset before browser-level CDP mouse input. PASS only if the logged CDP mouse coordinates refer to the target center in the top-level viewport.
5. Trial order is bounded: DOM click → synthetic pointer/mouse → CDP user-gesture evaluation → CDP trusted mouse → focused target + CDP Enter. Each method gets one observation window; probing stops after navigation/new-window evidence.
6. Target-event diagnostics record event type plus `isTrusted`/default-prevented state only. No field values, page text dump, credential values or session material are logged.
7. `NavigationStarting`, `SourceChanged`, `NavigationCompleted`, and `NewWindowRequested` logs reduce URLs to scheme + host + path, removing query strings and fragments.
8. New-window routing is fail-closed: exact HTTPS `auth-supra.winmart.vn` and `wms-supra.winmart.vn` may remain in the same probe tab; every other host is blocked after sanitized logging.
9. If all automatic methods fail, one Owner manual click on the intended arrow is allowed while instrumentation stays active. PASS diagnostic evidence identifies whether that manual trusted click emits the missing event/new-window/navigation behavior.
10. Source guard rejects DevTools Network use, cookie APIs, token/header/storage capture and direct `api-supra.winmart.vn` use.
11. Probe success is **diagnostic evidence only**. Normal Agent logic must not adopt a newly discovered activation method until a separate source change preserves D126/D127 fail-closed confirmation guards.
12. Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.

## D127-v66 — SFT3 session-bootstrap acceptance

1. Already-authenticated case: initial Confirm navigation may land on exact `https://auth-supra.winmart.vn/dashboard`. PASS only if Agent performs one same-tab browser navigation to exact `https://wms-supra.winmart.vn/sft3/session`; it must not click Dashboard DOM.
2. During bootstrap, observed WMS transitions such as `/sft3/session` and `/sft3/` are treated as in-progress. PASS only if the flow remains bounded to 10 seconds.
3. When exact `https://wms-supra.winmart.vn/sft3/app/dashboard` is fully loaded, Agent must navigate once to the canonical Confirm PickList URL and then rely on the existing D126 readiness DOM.
4. If the bootstrap window expires before WMS app Dashboard is reached, Agent must stop and expose **Không khởi tạo được phiên SFT3**. It must not restart bootstrap or loop Confirm navigation automatically.
5. Logged-out regression: exact visible **Lưu thông tin đăng nhập** pauses recovery. After login, if auth Dashboard is the loaded destination, the same one-time session bootstrap applies.
6. A stable loaded wrong page other than the exact auth Dashboard may still use the existing one direct Confirm retry. That retry remains bounded with the existing navigation grace.
7. Source guards require the exact fixed session URL, auth Dashboard host/path detection, WMS app Dashboard path, 10-second bootstrap bound, and the two UI states `SFT3_SESSION_BOOTSTRAP` / `SFT3_SESSION_BOOTSTRAP_EXHAUSTED`.
8. Source guards continue to reject Dashboard DOM click automation, DevTools Network/cookie/session extraction, direct WMS API, cursor/screen automation, and any weakening of D126 row/checkbox/modal fail-closed confirmation semantics.
9. Agent target is v66; WebView2 host build 9 is reused. Android remains `beta-vc76`; Stable remains OWNER-GATED.

## D127 Dashboard Probe v2 — acceptance

1. Probe v2 builds x64 and self-test PASS using the installed Fixed WebView2 runtime with a dedicated `dashboard-probe-v2-profile`.
2. UI contains editable URL plus **Đi tới**, **Tự động kiểm tra**, **Theo dõi thao tác người dùng / Dừng theo dõi**, and **Mở thư mục log**.
3. Navigation is fail-closed to HTTPS on exact `auth-supra.winmart.vn` or `wms-supra.winmart.vn`; URL credentials are rejected.
4. Login remains manual. No input values, passwords, cookies, tokens, headers, request bodies, web storage or profile files may be read or logged.
5. Auto testing begins only after the explicit button and is bounded: DOM click → synthetic pointer → CDP userGesture → CDP mouse → Enter → Space.
6. Target selection fails closed unless unique. If multiple HY1/SFT3 semantic matches exist, only a unique smallest semantic-card candidate within the defined tolerance may be selected.
7. Approved Supra new-window requests are logged but not forced into the current tab. Unapproved hosts are blocked.
8. User monitoring starts only after the explicit monitor button and records only events resolving to the known right-arrow clickable control.
9. Monitoring logs event type, `isTrusted`, default-prevented, arrow index/count, geometry, boolean semantic flags and sanitized browser navigation evidence.
10. Logged URLs are scheme + host + path only; query and fragment are stripped.
11. CI rejects Network/cookie/storage capture, direct WMS API access, browser-identification spoofing and regression to forced same-tab popup handling.
12. Probe v2 output is diagnostic evidence only; Agent behavior is not changed by this change set.
13. Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.

## D127-v67 — Dashboard click + real child popup acceptance

1. Agent build is 67 and owned WebView2 host build is 10.
2. Login-required case preserves the exact **Lưu thông tin đăng nhập** pause and one post-login canonical Confirm retry; no Dashboard click occurs while the login marker is visible.
3. Stored-session case: when canonical Confirm settles on exact auth Dashboard, Agent waits at least 750 ms and performs at most one Dashboard access attempt.
4. Dashboard target selection uses the Probe-v2 field-proven right-arrow selector and HY1/SFT3 semantic-card disambiguation. Ambiguous or missing targets fail closed.
5. The automatic action is only `button.click()`. No CDP mouse, keyboard simulation, userGesture injection, cursor movement or stealth/browser-identity modification is permitted.
6. The WebView2 host must not convert validated Dashboard `NewWindowRequested` into same-tab `Navigate()`. It must create a child WebView2 with the same environment/profile, assign `e.NewWindow`, and keep the opener context alive.
7. Agent must reattach DevTools to an HTTPS WMS child page target. The auth Dashboard target must not be used for post-popup Confirm operations.
8. Direct Agent navigation to `/sft3/session` is forbidden. That path may appear only as a page-generated popup/navigation target.
9. While the attached child is on `/sft3/session` or `/sft3/`, recovery remains bounded. When exact `/sft3/app/dashboard` loads, Agent performs exactly one canonical Confirm navigation.
10. Missing popup target, child attach failure, ambiguous Dashboard target or SFT3 flow timeout produces a terminal Dashboard-access failure; no click/navigation loop.
11. D126 page-size 100, search retry, exact row resolution, checkbox uniqueness/verification, exact confirmation modal and uncertain-terminal fail-closed guards remain unchanged.
12. Existing HA, idempotency, Firestore cadence, quota and schedule guards remain unchanged.
13. No Network/cookie/token/header/storage/request/profile extraction or direct WMS API is introduced.
14. Android remains beta-vc76; Stable remains OWNER-GATED and untouched.

## D128 — background browser, readiness barrier, resource observability and Picklist overlay

D128 v68 PASS requires all applicable checks below:

1. With valid restored/new Agent authentication and reusable Supra session, Agent-owned WebView2 starts/continues toward canonical Confirm while hidden/background.
2. Exact visible **Lưu thông tin đăng nhập** causes owned WebView2 to become visible for manual login; Agent does not read/log credential form values.
3. After login clears and canonical Confirm becomes READY, owned WebView2 hides automatically.
4. Explicit Desktop Edge/Chrome may satisfy browser READY only after operator selects **Mở trình duyệt Desktop**; no automatic Agent-owned → Desktop fallback is introduced.
5. Before **Agent login valid + Web Confirm READY**, Confirm-dependent relay/HA/manual PickList processing must not start or mutate business state.
6. Losing either prerequisite after startup pauses/fails closed those Confirm-dependent paths; restoration re-enables them without requiring Agent restart.
7. **Hệ thống Agent** displays process CPU %, RAM MB and **Thời gian chạy** while the main Agent window is visible.
8. **Đăng nhập Supra** displays browser mode/name plus aggregate process-tree CPU %, RAM MB, process count and **Thời gian chạy** while the main Agent window is visible.
9. Hiding/minimizing the main Agent window stops resource sampling; no SystemMonitor/browser-process resource sampling continues in background. Normal business/readiness/HA/schedule logic continues.
10. Tray hover/status contains no CPU/RAM/resource telemetry.
11. Overlay can show exactly **Picklist nhận: xx | Picklist xác nhận: xx | Picklist lỗi: xx** from existing local counters.
12. Overlay settings persist show/hide, lock state, position/size, background color, text color and background opacity.
13. Locked overlay is click-through; unlocked overlay can be moved.
14. Overlay remains lightweight and must not add CPU/RAM/GPU/disk/network monitoring or Firebase/Drive traffic.
15. All D126/D127 page-size/search/row/checkbox/modal/terminal/browser-security guards remain PASS.
16. Android remains unchanged; Stable remains OWNER-GATED and untouched.



## D129 — compact Agent UX, PDA state and quota hardening

D129 v69 cannot be technical/release PASS unless all applicable checks below pass:

1. Agent build/version is **69** and Android remains beta-vc76.
2. Logged out title is **Hệ thống Agent | Chưa đăng nhập**. After ADMIN/PICKPACK_ADMIN login, title contains **Hệ thống Agent | Sẵn sàng | <login> | <role label>**.
3. Authenticated Agent card shows one PDA-mode/Wi-Fi line, one CPU/RAM/**Thời gian chạy** line and the Agent fleet table; the old visible confirmation-counter line is absent.
4. Supra card has no build suffix and exposes truthful **Chưa sẵn sàng / Cần đăng nhập / Đang chuẩn bị / Sẵn sàng / Lỗi** state with **Web Agent/Web Desktop** mode where applicable.
5. At no time are Agent-managed Web Agent and Web Desktop both active. Stop and mode-switch actions require current Agent password verification and leave the existing Web untouched on cancel/wrong password.
6. Active Web exposes **Chuyển Web chạy nền** when visible and **Hiện Web** when hidden. Agent-owned automatic startup stays background-first; exact login marker can still foreground for manual login.
7. Verified runtime/download UI reports **Web Agent đang khả dụng**; downloading shows bounded progress and does not enable the Agent mode prematurely.
8. **Xử lý PickList | Sẵn sàng** requires Agent auth + Web Confirm READY only. FROZEN relay with those prerequisites still permits direct/manual PickList. Losing auth/readiness disables input/search and reports **Chưa sẵn sàng**.
9. Picker row renders PDA_READY as **Đang hoạt động** and PDA_GRACE as **Mất kết nối tạm thời**. Reconnect restores active immediately; grace expires near 180 seconds; refresh/search preserves scroll and selection without flicker.
10. First-run overlay is visible and auto-fits counter content. User-customized size persists; minimum is 120×24 rather than the prior 430-class minimum. Lock/click-through, move, colors and opacity remain functional.
11. Source/runtime guard proves fresh-only PENDING query remains and D117 cadences remain exactly PRIMARY idle 4s, hot 2s, lease 7s, failover 10s.
12. Normal schedule/UI timer source contains no QueueSharedScheduleRefresh parallel read loop; explicit schedule-conflict refresh remains bounded.
13. After a 30-minute fleet-metrics interval with no local request/response delta and a current snapshot, no provider fleet checkpoint is attempted. After tail reconciliation with no durable change, no metrics PATCH is sent.
14. Every Firestore REST attempt feeds the local quota guard. The guard contains 70/85/95 reference warnings, makes no provider request itself and does not expose secrets/session material.
15. No Firestore streaming listener/provider switch is introduced in v69.
16. D126/D127 semantic Confirm guards, D128 readiness/browser-security behavior and Stable OWNER-GATED policy remain PASS.


## D130 — live metrics and PDA↔Agent recovery acceptance

D130 cannot be technical/release PASS unless all applicable checks pass:

1. Agent build/version is **70**; Android source change produces the next monotonic signed Beta release.
2. Keep Agent main window foreground for at least 15 seconds. Agent and managed-Web **Thời gian chạy** change every second without switching windows; CPU/RAM refresh when the bounded sample completes.
3. Minimize Agent to tray and verify resource monitoring remains paused; restore and verify display resumes without stale focus-dependent rendering.
4. Source guard proves .NET Firestore connection limit floor 16 and no proxy/filter bypass.
5. D117 cadence remains exactly PRIMARY idle 4s / hot 2s, lease 7s, failover 10s; STANDBY/FROZEN business-poll rules are unchanged.
6. Force/observe one transient confirmation-query transport failure. Agent reports temporary offline state, the confirmation transport loop remains alive or is automatically supervised/restarted, and a later PDA request is consumed without manually toggling relay.
7. Confirmation queue safe-read outage is bounded to two 4-second attempts; no 3×12-second blocking path remains for `CONFIRM_QUERY`.
8. Simulate an uncertain Android Firestore create. The same request id is server-verified and at most one same-id retry occurs; no duplicate logical request is created.
9. Android terminal timeout copy states **20 giây**, matching `TOTAL_WAIT_MS = 20_000L`.
10. Hold a realtime WebSocket handshake without open/failure completion. Near 12 seconds the attempt is cancelled and reconnect begins automatically; the client may not remain indefinitely in `connecting`.
11. After realtime recovers, event-driven Picker presence appears on Agent without app restart. Login alone still does not count as online.
12. D127 fresh-only PENDING, D129 quota safeguards, managed-browser security and Stable OWNER-GATED policy remain PASS.


## D131 — Firestore-only HA / quota / latency acceptance

D131 implementation is not technical PASS until all applicable checks pass:

1. Up to 20 Agents converge to exactly one PRIMARY; every non-primary role performs zero PENDING business queue queries.
2. PRIMARY heartbeat target is 10s and lease expiry target is 15s. Killing PRIMARY while there is no PDA traffic still promotes NEXT_A without requiring a new job.
3. If NEXT_A is unavailable, NEXT_B can become the bounded fallback candidate; no two Agents may hold a valid current generation simultaneously.
4. Relay business work is enabled from 05:00 through 23:00 Asia/Ho_Chi_Minh and is frozen outside that window unless the shared overtime extension is active. No overnight business poll loop remains.
5. 50-PDA shift load, 75-PDA overlap load and a 40-simultaneous-request burst all remain bounded. The 40-request query is collected with limit >=100 rather than 40 separate queue queries.
6. Under good network and ready browser, normal/small-burst end-to-end terminal result target is <=6s. A 40-request burst is separately measured; if the rendered Confirm page cannot safely batch the browser mutation, CI/field notes must not claim an impossible 6s guarantee.
7. PRIMARY death/transport failure must return either the business terminal result or a specific failover/error terminal result before 20s; indefinite spinner/wait is failure.
8. Daily shared received / confirmed / error counters survive PRIMARY kill. Promoted PRIMARY reads the latest checkpoint, reconciles only the bounded newer tail and produces the exact expected totals with no double count.
9. All registered Agents up to the 20-Agent design envelope can display fleet readiness and freshness age. PRIMARY/next candidate readiness is sufficiently fresh for failover; deep hibernators may be coarse but must not be mislabeled realtime.
10. Android login/realtime connection adds PDA presence, explicit logout/session/device replacement removes immediately, unexpected disconnect removes after bounded grace, and an already-read PickList job refreshes PRIMARY-local activity with zero extra Firestore write.
11. Synthetic worst-day quota accounting for 18h operation, 1,200 requests and specified Agent/PDA scale remains <=42k reads, <=15k writes and <=3k deletes. Quota guard day boundary uses America/Los_Angeles.
12. Firestore storage remains <=0.75 GiB and outbound <=8 GiB/month under the measured retained-document size and configured retention.
13. No Cloudflare confirmation relay, RTDB fallback, periodic PDA heartbeat, direct WMS API or new Stable runtime resource is introduced.
14. Stable remains OWNER-GATED.


### D131 refinement acceptance — warm browser, 20 Agents, durable accounting

1. With 10 and then 20 registered Agents, exactly one PRIMARY queries PENDING jobs; NEXT_A/NEXT_B/deep Agents produce zero business queue queries.
2. A non-primary Agent keeps its managed Web Confirm page/profile ready for manual local PickList operation without being promoted to PRIMARY.
3. Background hibernating Agent performs no periodic DOM search/resource sampling solely to prove readiness; navigation/readiness events and explicit local actions are sufficient.
4. Daily received/confirmed/error totals survive process kill and machine change without RAM state. Kill PRIMARY after a known set of mixed results; promoted PRIMARY reconstructs exactly from durable state with no missing/double counts.
5. Every Agent that is foregrounded or explicitly refreshed displays the current durable daily counters. Background refresh is no faster than 10 minutes.
6. A 20-Agent 18-hour synthetic quota model, including adaptive PRIMARY 3s active-PDA / 15s inactive-PDA business polling, 10s lease writes, NEXT_A/NEXT_B coarse liveness reads, 10-minute fleet/counter snapshots, 1,200 request create/ACK/result-listen operations and one daily 1,200-row export, remains below D131 soft ceilings.
7. Export for one business day contains request id, user/employee identity, send time, submitted suffix, result/status, sanitized result/error code, Agent identity, completion time and elapsed duration; no browser/WMS secret/session material appears.
8. Firestore count aggregation is used for exact rebuild/verification when appropriate instead of full-document scans; query/index cost is included in the quota simulation.


### D131 daily export acceptance

1. Stop every Windows Agent before the scheduled export time. PASS only if the server-side runtime still generates the just-closed business-day Drive export.
2. Include at least one authorized post-23:00 overtime request and verify it appears in the preceding business-day file generated after the 05:00 boundary.
3. Force one temporary Drive/export failure. PASS only if the retry remains the same logical business-day export and no duplicate file is created.
4. Verify row count and received/confirmed/error totals reconcile with durable Firestore state for that business day.
5. Verify the file contains no credential, cookie, token, auth header, signature or browser-session material.


### D131 persistent Picker call and Usage acceptance

1. Two Agents attempt Gọi về bàn CV for the same Picker at the same time. Exactly one active call document is created; the losing Agent receives an already-active result and does not deliver a second logical call.
2. The called Picker receives the specialist role-specific message, and the overlay does not self-dismiss on a timer.
3. Restart the PDA/app while the call remains ACTIVE. The overlay is restored from the active-call document even if the original FCM delivery is no longer available.
4. Only the originating Agent can end the active call. After that Agent resolves it, FCM provides the fast close signal and the Picker snapshot listener also converges to closed state.
5. Usage tab reads provider metrics through the authenticated Beta service gateway at no faster than the configured cache cadence except explicit refresh. No Google/Cloudflare credential is persisted in Agent.
6. If provider Monitoring permission is unavailable, the Usage tab must state that provider usage is unavailable; it must not scan Firestore documents to estimate provider usage.


### D132 Agent presence/status/layout acceptance

1. Leave Agent running as PRIMARY and verify the Hệ thống Agent row does not blink between receive-mode text and Relay text; both remain visible on the same line while Relay state changes.
2. Login one beta-vc78 Picker. The PRIMARY list must receive the event-driven snapshot without a new polling loop. Logout must remove that Picker (subject only to the explicitly allowed disconnect grace for unexpected socket loss; explicit LOGOUT is immediate).
3. Submit a PickList from a Picker whose projection signal was delayed. The PRIMARY must immediately add/refresh that Picker from the request identity snapshot with `provider_write=false`.
4. On a non-primary Agent, foreground the window after a Picker login/logout and verify one bounded projection refresh reconciles the list; repeated focus changes inside the local throttle do not create repeated reads.
5. Toggle `Auto size cột: Tắt`, resize columns, switch away/reopen/re-authenticate the same Agent account and verify widths persist. Toggle ON and verify displayed-content sizing is restored.
6. In normal window state, manually resize/move the Agent, maximize it, then restore. Verify the exact saved normal bounds return. Restart/re-authenticate with the same Agent account and verify the saved normal bounds remain available.
7. Verify a different Agent account receives its own column/window profile rather than the previous account's profile.
8. D131 PickList counters must not change when only Picker presence control events are processed. Stable remains untouched.

## D133 six-field Beta acceptance

D133 is acceptable only when all of the following pass:

1. Toggle Auto size cột from either Hệ thống Agent or Picker area; Agent fleet, Picker and manual PickList grids follow the same state. With Auto size off, manual widths persist for the Agent account.
2. With a real Agent ADMIN/PICKPACK_ADMIN login, **Làm mới Usage** returns a non-401 response. Web/Android interactive tokens remain outside the Agent Usage auth path.
3. Create terminal PickList outcomes, note the three overlay totals, update/restart Agent, and verify received / confirmed / error restore from the same Firestore business-day summary. New ACKs refresh the overlay from that durable summary without waiting ten minutes.
4. Login Picker, including one restored-session case and one account-switch case, then press **Gọi về bàn CV**. The current Picker receives the full-screen command; no stale-account PERMISSION_DENIED listener is accepted. FCM active-call Functions are deployed.
5. While a HAS_STOCK/SKIP_ALLOWED overlay is visible, disconnect network and acknowledge it. The overlay closes immediately, the event remains pending locally, and the server acknowledgement is retried later. A Gọi về bàn CV overlay disappears automatically by 60 seconds even if network/account connectivity is lost, and can be closed earlier from the originating Agent.
6. Launch Android with notifications disabled and/or **Hiển thị trên ứng dụng khác** disabled. The app blocks operational use, routes to the relevant Android permission/settings page, and only continues after both permissions are granted.

Regression: no new offline Báo hàng path, no new provider resource, D117/D131 HA and Firestore cadence remain unchanged, and Stable stays OWNER-GATED.

## D134 field-reliability Beta acceptance

D134 is acceptable only when all of the following pass:

1. On normal Internet and Office, open Usage under a valid Agent operator. Provider Usage loads from the Firestore snapshot without requiring laptop access to `inventory-beta.supra.cc.cd`. If one Monitoring metric is unavailable, that metric shows `N/A` while available metrics remain visible.
2. Confirm there is exactly one Auto size control and it is under Hệ thống Agent. Test narrow/normal/maximized widths: columns remain proportionally balanced, action columns stay bounded and long text does not force a single huge column. Auto off restores per-account manual widths and normal window bounds.
3. Verify Hệ thống Agent, Đăng nhập Supra and Xử lý PickList title colors: green when ready, red when definitely unavailable/error, neutral only during preparation.
4. Process normal PickLists and a burst. No `UriFormatException` or other local processing fault may surface as Firestore offline. Interrupt real connectivity once and verify transport-offline/recovery remains truthful.
5. Login and logout a Picker. Login adds it, logout removes it, and socket disconnect alone does neither. Delay a projection and submit one valid PickList; the Picker appears with source PICKLIST without any heartbeat.
6. With multiple open Agents including a Replay/deep-hibernate Agent, press Liên hệ picker. All Agents disable that action for the same Picker immediately for 60 seconds. Only the originating Agent can end an active call. After the lock expires, a second call succeeds.
7. Kích User requires two confirmations. After success, all open Agents remove the Picker promptly, the PDA returns to login, and the stale generation is denied if it attempts a new PickList. A subsequent legitimate login with a newer generation works.
8. Restart/update an Agent and verify received/confirmed/error counters converge from the durable Firestore daily summary on the five-minute compact reconciliation; per-job immediate summary reads do not occur.
9. Verify the fleet never presents more than 10 Agent entries in the D134 model and Call/Kick sync continues while non-primary Agents are Replay/deep-hibernate.
10. Verify Hiện/ẩn Web Confirm and Agent logout require the Agent password; visible account text is the clean username only.
11. Existing D133 Android permission gate and local-first shortage-result acknowledgement remain intact.
12. Stable remains OWNER-GATED and untouched.

## D135 post-D134 field-refinement acceptance

D135 Beta acceptance must prove all of the following:

- On the originating Agent, confirming **Liên hệ picker** immediately disables/dims the call action before the network operation completes. Repeated clicks cannot create duplicate calls. A failed write restores the action; a successful write remains locked for the full 60 seconds on all Agents.
- **Liên hệ picker** and **Kết thúc** each show exactly one confirmation dialog. Cancelling performs no mutation.
- The Picker specialist-call alert contains no visible automatic-60-second-close explanation while the internal safety TTL still expires the alert.
- Android launcher/header/permission/update copy uses **1291 Báo hàng Beta** and the Beta package/signing/update channel remains unchanged.
- `admin:admin` and `admin:tamnv2` are never visible as Agent usernames; display is `admin` and `tamnv2`.
- For a PDA request processed by PRIMARY, the three PickList overlay totals change immediately after the durable ACK commit without waiting for the five-minute compact reconciliation. Restart/failover still restores exact durable totals.
- Counter immediacy introduces zero additional Firestore reads/writes/listeners/polls compared with the same confirmation transaction. Non-processing/deep-hibernate Agents retain D134 synchronization cadence.
- A NOT_FOUND browser lookup normally terminates after stable local DOM observation rather than waiting the former eight-second loop; only one search-button click is allowed and fail-closed uniqueness/checkbox/dialog guards remain.
- With a Báo hàng full-screen result visible, disconnect network or revoke/logout the current session and press **XÁC NHẬN ĐÃ NHẬN**. The full-screen surface closes immediately; the PDA is usable/login-capable; pending ACK is retained for later authenticated retry.
- Existing D134 generation fencing, single-PRIMARY mutation fencing, anti-spam escalation, no-offline-business guard, 45,000/day soft read target and Stable OWNER-GATE remain PASS.

## D136 manual PickList / Usage retirement / Web-background acceptance

D136 cannot be called Owner field PASS until all applicable checks below pass:

- Search one valid manual PickList at normal window size and maximized size. The same result row must show the PickList code, row-specific **Xác nhận** button and **Trạng thái** simultaneously.
- Toggle **Auto size cột** off/on, resize the Agent, relaunch with saved widths and repeat the search. Critical columns remain visible/reachable; a narrow viewport gets horizontal scrolling rather than a silently missing button/status.
- Confirm a row. A successful/already-confirmed row cannot send confirmation again; an uncertain row is also non-repeatable; a retryable failure may expose **Xác nhận** again.
- The Agent contains no visible **Usage** tab. Opening/running Agent must not schedule provider Usage Monitoring polling or periodic `usage_current` publication.
- Local quota protection remains a reference guard and must not be presented as exact Firebase/provider usage.
- With Web Confirm visible, **Chuyển Web chạy nền** hides immediately without password. **Hiện Web Confirm**, stop, Agent logout and managed-browser mode switch remain protected.
- D135 HA/generation/idempotency/security guards stay PASS; Android stays `beta-vc82`; Stable is untouched.

## D137 normal-window PickList / post-Confirm reload acceptance

D137 cannot be called Owner field PASS until all applicable checks below pass:

- At the Owner-reported normal/restored window size, search a valid PickList. The grid header and at least one result row are visible, including **PickList**, **Xác nhận** and **Trạng thái**. The result must not degrade to only the bottom green status sentence.
- Maximize the Agent, restore to the saved normal size, toggle **Auto size cột** off/on and repeat. The result surface remains operational; D136 horizontal critical-column behavior remains PASS.
- From logged-out Supra, open Web Agent, complete login, and let Agent reach Confirm. Verify one normal reload occurs before **Web Confirm sẵn sàng**. A known PickList is searchable without the operator pressing F5.
- Repeat from an already-authenticated auth Dashboard route. The same one-reload-before-READY barrier applies and the first operational search returns live Confirm data.
- During the reload and post-reload settle period, manual search and Confirm-dependent relay readiness are disabled/fail closed.
- After READY, verify no repeated reload loop, no extra search-button clicks, and no periodic provider/browser polling is introduced.
- Source regression must prove DevTools **Network** remains disabled/absent and no cookie/token/header/storage/session extraction or direct WMS API path is added.
- Android remains `beta-vc82`; WebView2 host build remains 10; Stable remains OWNER-GATED and untouched.

### D137 v79 hydration hotfix acceptance

In addition to the D137 UI checks:

- Reproduce the v78 path from an authenticated Dashboard and from a fresh login. The Agent must not reload within the first transient Confirm-shell moment; it waits for the final Confirm route to remain stable before reloading.
- A known PickList that previously required manual F5 must be found on v79 without operator F5.
- If the first search encounters a truly empty table, logs may show exactly one `empty_data_self_heal=START` sequence. A second automatic empty-table recovery in the same Confirm navigation is a FAIL.
- Post-reload READY requires the reload document to remain DOM-ready for the bounded stable interval; the previous v78 `600ms` proof is no longer sufficient.
- No DevTools Network domain, cookie/token/header/storage/session extraction, direct WMS API, new Firestore call, Worker call or provider poll may be introduced by the hotfix.
- Android remains `beta-vc82`; Stable remains OWNER-GATED.


### D138 — SLA FIRST_REPORT realtime persistence

1. Open Beta Web **Thời gian xử lý** with the current server mode `PER_PICKER`.
2. Select **Theo báo đầu tiên của SKU** and keep the form open while normal realtime/reconcile activity occurs.
   - PASS: the radio remains `FIRST_REPORT`; no generic section rerender restores the prior server snapshot.
3. Save the form.
   - PASS: request sends `auto_skip_mode=FIRST_REPORT`.
   - PASS: save response returns `FIRST_REPORT`.
   - PASS: the immediate authoritative reload also returns `FIRST_REPORT` before success is shown.
4. Reload the browser.
   - PASS: selected radio and **Đang áp dụng** both remain **Theo báo đầu tiên của SKU**.
5. Repeat `PER_PICKER → FIRST_REPORT → PER_PICKER` once.
   - PASS: both supported modes persist exactly and optimistic policy-version protection remains active.
6. Regression: no schema/provider/Android/Agent change; D137 OA063 remains open; Stable remains untouched.


### D139 — Global dirty SLA persistence

1. Load Beta Web **Thời gian xử lý** and wait until current server state is visible.
2. Select **Theo báo đầu tiên của SKU**.
3. Trigger or wait through ordinary realtime/network/header activity and delayed background loads.
   - PASS: the selected radio does not revert.
4. Save.
   - PASS: submit reads the checked radio as `FIRST_REPORT`.
   - PASS: server save response and immediate authoritative GET both return `FIRST_REPORT`.
5. Refresh the browser.
   - PASS: radio and **Đang áp dụng** both show **Theo báo đầu tiên của SKU**.
6. Confirm no schema/provider/Android/Agent changes and Stable remains untouched.

### D140 — Agent Firestore listener storm / quota regression

1. Build Agent v80 and run the packaged gRPC native smoke test plus `--d140-sync-safety-self-test`.
   - PASS: routing metadata, retry classification and circuit policy self-test exit 0.
2. Start at least PRIMARY + NEXT_A + NEXT_B + one DEEP_HIBERNATE Agent.
   - PASS: PRIMARY/NEXT_A/NEXT_B may log one compact `AGENT_SYNC listen=CONNECTED`; DEEP_HIBERNATE logs listener disabled and creates no compact listener connection.
3. Validate a normal compact listener session.
   - PASS: no repeating `InvalidArgument`; the first accepted server response is required before retry backoff resets.
4. Simulate a permanent listener failure.
   - PASS: one error includes sanitized `Status.Detail`, `circuit=OPEN`, and the next probe is delayed at least five minutes; no one-second reconnect loop exists.
5. Simulate a transient transport failure.
   - PASS: retry grows from at least 2s toward 60s and resets only after a valid Firestore response.
6. Leave PRIMARY steady for at least 15 minutes with no Picker/fleet/call/counter changes.
   - PASS: reconcile cadence stays at five minutes and unchanged `agent_sync` state logs `write=SKIP_NO_CHANGE` instead of PATCH.
7. Send normal PDA PickList requests and verify confirmation result/ACK latency and failover behavior remain within the already accepted transport envelope.
   - PASS: no Android/APK update is required.
8. Compare Firestore usage before/after the field run.
   - PASS: reads track actual listener events/bounded reconciliation rather than thousands of reconnect attempts per hour.
9. Stable remains untouched.



### D141 — SLA end-to-end persistence and false-success prevention

1. Open Beta Web **Thời gian xử lý** and press F5.
   - PASS: selected Deadline radio equals **Đang áp dụng**.
2. Change the radio from the current server mode to `FIRST_REPORT`.
   - PASS: **Đang áp dụng** remains the current server mode.
   - PASS: **Thay đổi chưa lưu: Theo báo đầu tiên của SKU** is visible.
3. Save once while normal realtime/network activity is present.
   - PASS: the Save action is not silently discarded by the generic busy state.
   - PASS: the button shows `Đang lưu…` during the dedicated single-flight mutation.
4. Server mutation:
   - PASS: request carries a correlation id and expected policy version.
   - PASS: SQLite is read back after the write using the same SLA parser used by GET.
   - PASS: all persisted policy fields, `auto_skip_mode` and the incremented policy version match the requested write before HTTP success.
5. Web verification:
   - PASS: the save response contains `sqlite_readback=PASS`, matching request id/mode/version.
   - PASS: a fresh `cache: no-store` GET returns the same mode/version.
   - PASS: success notice names the committed mode and version.
6. Press F5 again.
   - PASS: radio and **Đang áp dụng** both remain `FIRST_REPORT`.
7. Negative cases: stale version, network failure, readback mismatch or a second concurrent save.
   - PASS: no false success; requested/current server modes remain diagnosable and Stable is untouched.

## D142 Android 11 MT90 / DT50 critical-alert acceptance

Automated/source/build acceptance:

- manifest declares `USE_FULL_SCREEN_INTENT`, `ACCESS_NOTIFICATION_POLICY` and `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` while preserving existing notification/overlay/foreground-service declarations;
- readiness evaluates `NotificationManager.areNotificationsEnabled()`, `Settings.canDrawOverlays()`, `NotificationManager.isNotificationPolicyAccessGranted`, `PowerManager.isIgnoringBatteryOptimizations()` and the critical channel's high importance + `canBypassDnd()`;
- the permission gate remains before login/restored business startup, lists missing requirements with concise guidance, provides Settings actions, and has **no manual KIỂM TRA LẠI button**;
- returning through `onResume()` automatically re-evaluates readiness and continues the pre-existing login/restored-session path only when all required conditions pass;
- critical channel uses `inventory_critical_alert_v2`, high importance and DND bypass; app/channel Settings routes target the current package/channel where Android supports that;
- critical overlay notification and its fallback may use `setFullScreenIntent(..., true)`; the bounded wake Activity uses `setShowWhenLocked(true)` / `setTurnScreenOn(true)` on Android 11-compatible API and self-finishes;
- the D133/D135 cross-app overlay, 60-second specialist-call safety TTL, result presentation ownership and local-first pending ACK behavior remain unchanged;
- server FCM remains data-only Android `priority: "high"`; no system notification payload bypass is introduced;
- no alert-permission polling loop, persistent WakeLock or new always-running service is introduced;
- normal Android/Agent/Web business regressions and signed Beta build must remain PASS; Stable is untouched.

OA068 physical acceptance after signed release:

- install on one normal Newland MT90 Android 11 and one Urovo DT50 Android 11;
- opening the app with any missing required item must show the exact missing list before login;
- each available Settings action must reach the relevant Android control (or safe App-details fallback), and Android Back must automatically recheck without a manual test/check button;
- once all items are ready, app automatically enters the existing login/restored-session flow and normal Báo hàng/PickList behavior is unchanged;
- a normal real critical warehouse alert on each device preserves the existing full-screen overlay/ACK experience. Setup acceptance does not require a separate deliberate DND/Battery Saver toggle-and-test ceremony.

## D143 cross-client acceptance

### Automated/source gates
1. Android permission gate contains separated readiness cards, **Kiểm tra cấp quyền** and **Đặt lại mặc định**, while automatic on-resume readiness remains.
2. Signed Android release receives the Picker default password only from protected build configuration; source/logs contain no plaintext default password.
3. Android company heading/footer/confirmation copy/SKU suggestion width changes compile without changing Báo hàng or PickList authority.
4. Web `PICKPACK_ADMIN` can access Ca vận hành; ROOT role review includes PICKPACK_ADMIN; ROOT list rows are excluded; managed Admin/PickPack Admin/Reporter deletion is real-ROOT-only server-side.
5. Web zero badge/date preset/custom range/audit-top paging behavior passes build/UI guards.
6. Agent v81 self-tests preserve D140 listener/quota safeguards and prove 05:00–22:00 schedule transitions with first prompt at 21:30 and hourly extension boundaries.
7. Agent ignores older compact-sync versions, does not auto-size hidden/minimized grids, and restores sizing only after visible layout settles.
8. Agent chat is <=200 chars end-to-end, direct call remains separately locked/resolveable, and Android chat confirmation performs no network ACK.
9. WebView2 host build remains x64 and D126/D127 forbidden Network/cookie/token/session extraction guards remain PASS while obsolete hidden child views are bounded/disposed.
10. Stable resources remain untouched and no new provider resource is introduced.

### Owner field gate
- Update to released v81 Agent and next signed D143 Android Beta.
- Verify one permission-setting round trip where **Kiểm tra cấp quyền** successfully advances if the OEM screen did not auto-advance; verify **Đặt lại mặc định** returns the operator to Android app settings without claiming system permission revocation.
- Confirm masked default password is present for normal Picker login and can be erased/replaced.
- Check full-width SKU suggestions and concise Xác nhận đơn guidance on warehouse PDA.
- On Web, check Pick Pack Admin Ca vận hành, ROOT permission review/deletion, hidden ROOT, zero badge, date selected states and top audit paging.
- On Agent, verify tray/visible 21:30 prompt appears once, overtime extends one hour, no five-minute spam, auto-size survives tray restore, Picker list does not jump to an older snapshot, direct call still works and chat dismisses locally with no Kết thúc.
- Leave managed Web Confirm/Agent running through an extended work session and verify browser RAM does not grow from an unbounded hidden child-window chain.

## D144 — Logs, Picker chat and legacy kick field repair

- With the configured Google OAuth refresh token revoked/unavailable, Web → Nhật ký still lists newly buffered Web/Android runtime logs from InventoryCore without `LOGS_OAUTH_FAILED`.
- Android scheduled/error log upload returns success after bounded InventoryCore persistence even when Drive archival is deferred; no Drive folder permission change is required.
- SQLite schema target is 14 and `SERVICE_LOGS` reset includes the bounded runtime-log buffer.
- Agent chat editor accepts a normal 20–100 character sentence continuously without losing focus while periodic Agent UI refresh timers are isolated from the open modal.
- Sending chat produces the direct full-screen PDA alert; FCM remains a compatibility path using the same alert identity; local **Xác nhận** closes it without any remote acknowledgement and a late duplicate is ignored.
- Existing direct-call behavior remains unchanged.
- Kích User removes the Picker from Agent state and revokes the Worker-authoritative Android session. Supported builds receive the Firestore revocation immediately; older command-capable APKs receive a best-effort re-login alert before their notification target is disabled. Previous business requests from the revoked generation are rejected until a fresh login.
- An arbitrary older APK that never implemented any compatible revocation/command receiver may keep its stale local screen while idle; this must never restore server business authority.
- D140 quota/listener protections, D142 critical-alert readiness and Stable OWNER-GATED behavior remain unchanged.
## D145 — OAuth public-page acceptance

### Automated/source gates
- Worker exposes unauthenticated GET/HEAD for `/about`, `/privacy` and `/terms`; trailing-slash variants resolve to the same public content.
- All three pages identify **SUPRA Inventory Beta** and cross-link the public policy surfaces.
- About contains the exact approved scopes `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/gmail.send` plus their user-facing purposes.
- Privacy states access/use/storage/sharing boundaries, revocation, Google API Services User Data Policy and Limited Use; it does not claim Gmail inbox-read capability.
- Web login/password-reset/authenticated footer contains public links to About, Privacy and Terms.
- Service typecheck, Web build, authority/continuity guards and public-repository secret guard pass.
- Stable remains untouched and no new provider resource is introduced.

### Beta runtime gate
- `https://inventory-beta.supra.cc.cd/about`, `/privacy` and `/terms` each return HTTP 200 without authentication.
- About runtime HTML contains the exact `drive.file` and `gmail.send` scope strings.
- Privacy runtime HTML contains the Google API Services User Data Policy and Limited Use disclosure.
- Existing `/health`, Web login, API routing and D144 business/runtime behavior remain available after the deploy.
- Only after this runtime gate passes may OA073 move to READY for the Owner's Google Auth Platform publish/re-consent and protected refresh-token replacement.
## D146 — Acceptance gates

### Source/CI
- Web, Android and Agent scheduled-log source contains only 06/12/18/21 HCM slots; the old 00:00 scheduled slot is absent.
- Web/Android log filenames classify scheduled/manual/error/crash; Agent filenames classify scheduled/error/crash.
- Web/Android error/crash paths attempt immediate upload and InventoryCore deferred Drive rows have a bounded retry path.
- Agent v83 writes `DIRECT_PENDING` parts to the existing Firestore log collection; the Google Function claims complete parts, requests a protected short-lived Drive resumable upload session, uploads payload Google Function → Drive and changes failures to `WORKER_FALLBACK`.
- Agent source contains no Google OAuth refresh token/client secret/Drive credential.
- The protected D146 Worker session-broker endpoint rejects unauthenticated requests.
- Web SKU import emits `sku_catalog_updated`; Android contains realtime + silent-FCM cache-refresh paths.
- Managed-user deletion requires effective ROOT and base ROOT in UI, Worker API and InventoryCore.
- Agent v83 protected password dialogs use timer isolation/input-focus guard.
- Service typecheck, Web build, Android build, Agent build, Firebase Functions build, Firestore rules, authority/state/continuity and secret guards pass.

### Beta runtime/release
- Renewed Beta OAuth remains In production and Gmail transactional send remains working; no Gmail-read permission is introduced.
- A new Web/Android support log reaches InventoryCore and the Logs Drive folder, including bounded retry if the first archive attempt is deferred.
- An Agent v83 log reaches Firestore directly from the Agent and then the Logs Drive folder through the Google-side function path; Worker fallback remains available if the direct Google-side upload fails.
- Updating/importing an SKU from Web causes a logged-in PDA to sync the catalog without logout/login.
- ROOT effective PICKPACK_ADMIN and real PICKPACK_ADMIN cannot select/delete ADMIN; true ROOT in ROOT mode retains its existing authority.
- Password entry for protected Agent actions remains focused through continuous typing.
- Stable is untouched.


## D147 — Serial Owner-PASS governance acceptance

### Authority/source gates
- Canonical authority files encode the same serial Owner-PASS rule.
- Project state distinguishes the accepted base from the current candidate change.
- Technical/CI/runtime/release PASS does not unlock the next change ID.
- NOT PASS / FAIL keeps repair and retest under the same change ID until explicit Owner PASS.
- Base-affecting requests require pre-implementation impact/risk/affected-component analysis and explicit Owner approval.
- D147 adds no runtime/provider/resource/schema/quota mutation; Stable remains untouched.

### Owner acceptance gate
- D146 remains the accepted base while D147 is pending.
- D147 may be promoted only after the Owner explicitly records D147 PASS or equivalent unambiguous PASS wording.
- Until that acceptance is recorded in canonical GitHub state, no D148 or unrelated project mutation is allowed.
- If Owner reports D147 NOT PASS, repair D147 itself; do not open D148.

D147 Owner result: **PASS** on 2026-09-29. OA075 is closed. D147 is promoted to the accepted governance base; runtime remains the D146 Owner-accepted baseline and Stable remains untouched.

## D148 — Web/Android alert, reporting and log acceptance

### Automated/source gates
- Web pending navigation badge is removed only at queue count zero and is recreated on a zero→positive realtime transition.
- Excel export contains `So sánh ca`, Ca 1/Ca 2/outside-overtime mapping and **Ca phát sinh** columns while retaining existing bounded page collection.
- Android `report_created` uses the existing FCM payload and `MODE_REPORT_CREATED`; no polling path is added.
- Android overlay service contains a priority/FIFO queue, id de-duplication and one-active-item acknowledgement semantics. Specialist command priority is greater than result/report information.
- Android scheduled INFO-log sender is absent; session-end, deferred-same-user, ERROR/CRASH and manual log paths remain.
- PickList source retains the existing backend-derived strike/lock fields and exposes the approved 1/3, 2/3, 3/3 lock wording.
- No Agent/overtime-unification resource or code path changes in D148; Stable remains untouched.

### Owner field gate — OA076
1. Start Web with pending=0, then create a shortage without reloading. Badge must appear immediately and remain while pending>0; after processing to zero it disappears.
2. On Reporter/Admin Android with overlay permission, create a shortage while another app is visible. The alert must show **THÔNG TIN BÁO HẾT HÀNG**, SKU, full readable product name and **OK** with adaptive card height.
3. Export a filtered report. Verify `So sánh ca` and **Ca phát sinh** mapping at 06:00/14:00/22:00 boundaries; export must not trigger a new provider/polling cadence.
4. Enter wrong PickList suffixes and verify 1/3, 2/3 and temporary-lock copy; existing 5/30/60-minute behavior must remain.
5. Keep a PDA logged in across scheduled times and confirm no scheduled Android INFO upload occurs. Logout must attempt one session-end log; crash/error/manual paths remain available.
6. Deliver multiple alerts close together. Specialist-call information takes priority. Three SKU/result alerts require three individual acknowledgements; acknowledging one must not dismiss the others.

Only explicit Owner PASS promotes D148 to the accepted base and unlocks the next change.

D148 technical result: **PASS** on 2026-09-29. PR #300 is merged and live Beta Web/Worker plus signed `beta-vc87` passed the automated/runtime/release gates. OA076 is READY_FOR_OWNER_FIELD_TEST. Technical PASS does not promote the accepted base: D147 remains accepted and D149 remains blocked until the Owner explicitly records D148 PASS.

D148 Owner result: **PASS** on 2026-09-29. OA076 is closed after the Owner explicitly confirmed field acceptance of live Beta Web and signed `beta-vc87`. D148 is promoted to the accepted base. The overtime Web/App/Agent unification request remains excluded from D148 and has not started.

## D149 — Unified schedule and operational refinements acceptance

### Automated/source gates
- Agent schedule self-test proves: 05:00 is closed by default; 05:00–<06:00 supports early start only; 06:00 opens automatically; 22:00 closes automatically; 21:30 prompts for 22→23; active overtime prompts at HH:30; 03:30 may extend 04→05; 04:30 cannot extend beyond 05.
- A scheduled boundary has first-writer-wins CAS semantics. A losing conflicting Agent refreshes/shared-renders the winner.
- Manual **Điều chỉnh tăng ca** while sleeping writes at most one bounded state change to the next whole-hour boundary and does not consume the future HH:30 decision boundary.
- No Function trigger targets hot roles/lease/agent_sync documents. No Android/Web schedule polling and no new Agent schedule listener exist.
- Android normal schedule recovery uses Worker state; Firestore exact-current-state GET exists only as Worker-outage fallback and cannot list/listen.
- Android closed-window handling does not automatically logout solely because time crossed the operating boundary.
- Worker/InventoryCore rejects schedule-governed Android mutations when its mirrored effective state is closed and accepts them when the same shared state is open.
- Result notification/recovery payload exposes product plus resolver display/role/source with system-timeout distinction.
- Web recent results applies one bounded date range consistently to summary and paged rows.
- Agent managed browser path is centralized; migration rejects removable/network destinations, closes active managed Web, verifies copy/switch, and has rollback.
- PickList presentation no longer renders the Hôm nay aggregate cluster; durable daily counters are not deleted.
- Stable is untouched.

### Owner field gate — OA077
1. With multiple Agents online, click conflicting overtime decisions nearly together. Exactly one boundary decision wins and all Agents converge to it.
2. Do nothing at 21:30/22:00. At 22:00 replay must sleep without a synthetic schedule write. Use **Điều chỉnh tăng ca** and verify fleet/PDA reopen only to the next hour.
3. Verify 22:30/23:30/etc prompts occur only while the previous extension remains active; verify no extension past 05:00.
4. At 05:00 verify replay remains asleep and **Bật sớm trước 06:00** opens only until 06:00; at 06:00 normal replay starts automatically.
5. Keep a PDA offline/powered off through an overtime decision, then restore it. It must obtain the current state once and operate consistently without polling.
6. Verify Báo hàng and PickList follow the same open/closed schedule when Worker is healthy.
7. Verify Web recent-result ranges, result resolver copy, Agent Web storage move/rollback, and removal of the PickList Hôm nay cluster.

D149 Owner result: **PASS** on 2026-09-29. OA077 is closed after the Owner explicitly confirmed field acceptance of the released D149 Beta set. D149 is promoted to the accepted base. Technical/release evidence remains main `c03f54861e5fbb6ff093b129e9b76e303475c358`, signed `beta-vc88` and `relay-agent-v84`; Stable remains OWNER-GATED and untouched.

## D150 acceptance gates — quota-safe coordination and manual PRIMARY

D150 is not accepted merely because the Agent compiles or provider deploys succeed.

Technical/CI gates:
- preserve exact accepted queue/HA constants: active 3000 ms, inactive 15000 ms, HOT 1000 ms, lease 10000 ms, failover 15000 ms;
- reject restoration of collection-wide `relay_poc_agents?pageSize=100` and `picker_active_calls?pageSize=100` reads;
- require server-filtered fresh presence and unexpired active-call queries;
- require DEEP to remain listener-free and use only bounded exact compact-state recovery;
- require document-aware local read accounting without provider Usage polling;
- require Agent error fingerprint suppression/global fuse while crash remains immediate;
- require multipart logs to use non-triggering intermediate parts and one final commit part;
- require Worker fallback to query bounded fallback statuses rather than list the entire log collection;
- require manual PRIMARY to be username-gated to `tamnv2`/`admin`, Web-Confirm/schedule readiness-gated, CAS-based and generation-fenced;
- Agent release/version must advance to v85; Android beta-vc88 remains unchanged unless separately justified;
- Stable must remain untouched.

Owner field gate after technical/runtime/release PASS:
1. Log in to a non-PRIMARY Agent as `tamnv2` or `admin`; confirm **Chuyển Agent chính** appears at the far right.
2. Confirm the action is disabled when Web Confirm is not ready or replay is sleeping.
3. With replay open and Web Confirm ready, confirm once and verify this machine becomes PRIMARY, the button disappears and PDA confirmation continues normally.
4. Confirm the former PRIMARY cannot produce a duplicate WMS mutation and the fleet settles into PRIMARY/NEXT-A/NEXT-B/DEEP roles.
5. Log in using another valid Agent operator account and confirm the manual-primary button is absent.
6. Observe normal field operation long enough to ensure Picker contact/fleet lists still update while no rapid reconnect/read storm returns.

Only explicit Owner PASS closes the D150 field gate and promotes D150 over the D149 accepted base.

D150 Owner result: **PASS** on 2026-09-29. OA078 is closed after the Owner explicitly confirmed field acceptance. D150 is promoted to the accepted base. Technical/runtime/release evidence remains main `c9d42c701f66283f447aad4f24c8f9043db17e37`, Agent `relay-agent-v85`, and signed Android `beta-vc88` unchanged; Stable remains OWNER-GATED and untouched.

## D151 DND diagnostic acceptance

D151 is a diagnostic-only Beta field workstream. Technical PASS requires:
- the standalone `cd.cc.supra.inventory.dnddiag` APK builds independently from the production `android/` application and therefore does not increment or republish the production Beta APK;
- source contains no login, Firebase, realtime, shortage, PickList, WMS or embedded credential path;
- the APK reads Android 11 DND authority and comparison signals from the device, including firmware/build fingerprint, security patch, user/profile restrictions, secure policy-access package membership, `NotificationManager.isNotificationPolicyAccessGranted()`, and dedicated-channel `canBypassDnd()`;
- the Beta diagnostic intake accepts only the fixed DND schema/package, is payload-bounded and throttled, performs no business mutation, and archives with the existing sanitized Beta runtime-log/Drive path;
- Repo Authority, Project State, Worker build/deploy and dedicated diagnostic APK build gates pass; Stable is untouched.

Field evidence is Owner-only and is not implied by CI. Use the same built APK on:
1. one MT90 where DND special access behaves normally;
2. one MT90 where Android Settings appears stuck at `Cho phép` while the production app does not pass readiness.

On each device, return from the DND settings surface, refresh if needed, then press `GỬI LOG VỀ BETA` once. PASS for the diagnostic collection step requires two separate `manual_dnd_diagnostic` logs in the Beta logs folder with distinct device hashes and sufficient fields to compare policy API, secure-settings projection, channel bypass, firmware/build and profile state. D151 remains open until those field logs are analyzed and the Owner accepts the resulting root-cause conclusion/repair direction.



### D151 repair-probe acceptance

The revised standalone diagnostic APK must satisfy all of the following before field use:
- production `android/`, Agent, Web and Stable runtime source are unchanged;
- package-specific DND detail intent uses the literal Android action `android.settings.NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS` with a `package:` URI and safely falls back to the normal DND access list when unresolved;
- the diagnostic manifest alone adds `SYSTEM_ALERT_WINDOW` and `FOREGROUND_SERVICE`; the overlay probe uses `TYPE_APPLICATION_OVERLAY` only after `Settings.canDrawOverlays()` is true;
- pressing the overlay test starts a bounded 15-second local probe, returns the user to Home, remains visible above normal app windows when supported, and stops/removes itself without a retry loop;
- the existing manual Beta diagnostic upload remains the only network action and keeps the existing bounded schema/throttle/archive path;
- CI checks the detail-action, overlay permission and `TYPE_APPLICATION_OVERLAY` source boundary;
- field result distinguishes: real DND backend repaired by per-app detail settings vs DND still denied but overlay path operational. Neither result silently weakens the production readiness gate.


### D151 adaptive production acceptance

Technical/source PASS requires:
- `AlertReadiness.ready` depends only on notifications + overlay + battery exemption; DND policy/channel bypass is not a hard login predicate;
- mode selection is capability-based: `NATIVE_DND` only when real policy + bypass channel are ready, otherwise `OVERLAY_COMPAT`;
- production Android alert-selection source contains no MT90/DT50/firmware allowlist;
- existing high-priority FCM and `CriticalOverlayService` remain the critical event path;
- screen-off/keyguard handling uses a bounded local wake coordinator plus the existing `CriticalWakeActivity`; no WakeLock is introduced;
- notification full-screen intent is emitted only when Android reports it usable on versions that expose that capability;
- D148 overlay priority/FIFO/de-duplication/local-first ACK contracts remain unchanged;
- no new provider, Worker request, Firestore read/write/listener, polling loop, cron or schema is introduced;
- signed Beta Android advances monotonically after `beta-vc88`; Agent/Web/Stable are unchanged.

OA079 field PASS requires testing the signed D151 Beta on:
1. one MT90 with the known broken DND backend family (currently V8.01.002);
2. one MT90 where native DND works (currently V8.04.006);
3. one Urovo DT50;
4. one other Android 11+ device when readily available.

On each device, Notification + Overlay + battery exemption must remain mandatory. A critical alert must appear over another app with DND enabled. At least one screen-off/keyguard run must wake/present the alert. Native-capable devices should report full mode; unsupported/broken DND devices should report Overlay Compatibility mode without a false grant. No duplicate business ACK or unexpected provider-usage amplification is accepted.

D151 Owner result: **PASS** on 2026-09-29. OA079 is closed after explicit Owner field acceptance of signed `beta-vc89`. D151 is promoted to the accepted base; existing D151 technical/runtime/release evidence remains authoritative and Stable remains OWNER-GATED.

## D152 bounded PickList recovery acceptance

Technical PASS requires all of the following:
- normal unique-row + usable-checkbox confirmation continues without recovery reload or added provider operation;
- a unique unselectable row receives at most the existing Search retry plus one bounded top-level reload/recheck, with no loop;
- row disappearance/change during checkbox recovery is not counted as NOT_FOUND and does not add a Picker strike;
- persistent checkbox-not-ready is not surfaced as a false Supra rejection;
- after the confirmation dialog was clicked, any additional recovery is read-only Search/DOM verification and never a second Confirm mutation;
- an existing uncertain guard permits verify-only state proof but never reacquires the mutation path;
- exact-row stable disappearance is required before verify-only returns CONFIRMED;
- PRIMARY/generation/request-age/confirmation-guard fences remain intact;
- no direct WMS API/session extraction/DevTools Network path is introduced;
- no new Firestore/Worker/provider polling/listener/write cadence, Android build or Stable mutation is introduced;
- Agent version advances monotonically to `relay-agent-v86`.

OA080 Owner field PASS additionally requires normal real PickList confirmation to remain prompt, any naturally occurring checkbox-stale/uncertain case to self-recover truthfully without duplicate mutation, and no unexpected Firestore usage amplification.

D152 Owner result: **PASS** on 2026-09-29. OA080 is closed after the Owner explicitly confirmed field acceptance of released `relay-agent-v86`. D152 is promoted to the accepted base. Technical/release evidence remains PR #316 → main `a418de7e852ff9c1bc8b37309b65cdfc75fe3f24`, Agent release id `399178131`, EXE SHA-256 `098d8cc6c51bdf58e0ef9bd662b9b7bfaf8a0f12b749318d44c194e89eb0c430`. Android `beta-vc89` and Stable remain unchanged.


## D153 quota-safe Picker presence acceptance

Technical PASS requires all of the following:
- Agent version advances to `relay-agent-v87`; Android remains signed `beta-vc89`;
- a Picker already present from LOGIN can submit repeated PickLists without changing shared Picker presence or writing `agent_sync` for those submissions;
- a Picker absent from LOGIN is added once by PickList fallback, and subsequent PickLists from the same session produce no additional fallback write;
- a newer LOGIN/session supersedes fallback, while delayed older-session activity cannot downgrade it;
- explicit logout/revoke removes matching/older fallback, while unrelated Picker login/device events do not erase another Picker's fallback;
- repeated identical Android device registration excludes volatile timestamps from semantic membership and produces zero Firestore presence/control write after successful projection acknowledgement;
- notification-target mirror writes only on desired-state change or retry after an unacknowledged failure;
- Picker-only no-op gates do not apply to call locks, kicks, fleet/PRIMARY takeover, durable counters or HA fencing;
- 3s/15s/1s confirmation query cadence, 10s PRIMARY lease and 15s failover remain exact;
- no new provider, collection, SQLite/Firestore schema, listener, polling loop, cron, secret, Android release or Stable mutation is introduced.

OA081 Owner field PASS should verify one already-LOGIN Picker sends several real PickLists with no repeated Picker-list churn, one fallback-only Picker appears once then remains until matching logout/revoke, and Firebase Usage shows materially lower Write growth without slower PickList results or degraded Agent/PDA communication.


D153 Owner result: **PASS** on 2026-09-29. OA081 is closed after explicit Owner field acceptance of released `relay-agent-v87` with Android `beta-vc89` unchanged. D153 is promoted to the accepted base; technical/release evidence remains PR #321 → main `d69566ee0ae6294573ec91f9eb649764e91561ee`, Agent release id `399311941`, EXE SHA-256 `0f863dea6a9841cb237be48ab83f17ff9443654c298ea9db6bc5c8a79c597070`. Deferred streaming redesign D remains outside accepted scope; Stable remains OWNER-GATED.


## D154 unified schedule and synchronization acceptance

Technical PASS requires all of the following:
- accepted base remains D153 until Owner field PASS; Stable remains untouched;
- Agent version advances to `relay-agent-v88`; Android advances monotonically after `beta-vc89`;
- Agent, Function payload, Worker, Android and Web all use normal start 05:45, normal end 22:30 and overtime cutoff 05:00;
- boundary tests cover 04:59, 05:00, 05:44, 05:45, 22:29 and 22:30;
- overtime cadence follows 22:30 → 23:30 → 00:30 ... and cannot pass 05:00;
- active overtime shows the shared-until state in Agent; **Huỷ tăng ca** creates `CANCEL_OVERTIME` and closes Android/Web state immediately;
- `operatingScheduleChanged` is included in the Beta Functions deployment list and CI guard;
- an Agent schedule action produces a nonzero Worker schedule version after Function mirror and Web receives the existing realtime `operating_schedule` invalidation;
- Android blocked PickList reconciliation performs at most one exact Firestore schedule GET after a successful-but-closed Worker response, under the existing 60-second attempt gate and with no background polling;
- login footer version comes from the running BuildConfig; the DND+Overlay setup group is visually first while Notification/Overlay/battery hard readiness remains intact;
- D150 queue/lease/failover timings, D152 confirmation fences and D153 quota dedupe remain unchanged;
- no new provider, collection/schema, listener, polling loop, cron or secret is introduced.

Owner field PASS verifies Agent overtime after 22:30, Android/Web convergence, Huỷ tăng ca convergence, 05:45/22:30 boundaries, and Android permission/version presentation on warehouse devices.

## D155 contractor and quota-safe shortage-capability acceptance

Technical PASS requires all of the following:
- accepted base remains D154 until explicit Owner D155 field PASS; Stable remains untouched;
- InventoryCore schema advances additively to 15; existing Pickers default Báo hàng enabled after migration unless explicitly changed under D155;
- HR source validates three configurable headers, accepts blank contractor cells, updates contractor/name by MNV, creates new Picker reporting-enabled, and never resets an existing explicit reporting toggle;
- managed-user search finds Picker by contractor and server-side filter distinguishes reporting enabled/disabled;
- ADMIN, PICKPACK_ADMIN and ROOT can enable/disable shortage reporting for one/many/all Picker selections; PICKPACK_ADMIN gains no unrelated account lifecycle authority;
- disabled Picker login and Xác nhận đơn continue, Báo hàng is visibly locked, stale/modified PDA shortage POST is rejected server-side, and new Có hàng/Skip shortage result targeting is suppressed;
- toggle convergence uses only Worker/InventoryCore + existing Cloudflare WebSocket. No Firestore/RTDB capability read/write/listener, FCM capability push, polling loop or cron exists;
- online target applies the unsequenced capability frame without delta recovery/realtime reconnect; a missed frame is repaired by normal /api/auth/me resume;
- disabled Picker performs no shortage catalog/history/result refresh solely for the disabled UI;
- Agent v89 shows/searches contractor using existing Picker projection/sync; contractor-only HR sync does not force a Firestore presence/agent_sync write and no new Firestore cadence exists;
- D153 presence dedupe, D150/D152 confirmation/HA timings and D154 shared schedule behavior remain unchanged;
- Android advances monotonically after beta-vc90; Agent advances to relay-agent-v89; no new provider resource/collection/secret is introduced.

Owner field PASS should verify bulk toggle immediately changes a logged-in PDA, Xác nhận đơn remains usable while Báo hàng is off, direct SKU submission is blocked, enabling restores normal Báo hàng, contractor appears correctly on Web/PDA/Agent, and Cloudflare/Firebase usage shows no new idle/background cadence.

## D156 schedule convergence and default-off acceptance

Technical PASS requires all of the following:
- accepted base remains D155 until explicit Owner D156 field PASS; Stable remains untouched;
- InventoryCore advances to schema 16 and applies the existing-Picker reporting-default migration once only;
- all existing Picker rows are reporting-disabled immediately after migration; new HR Picker creation uses reporting-disabled; later explicit enable/disable survives subsequent HR sync;
- missing/null Picker reporting capability is fail-closed across Worker mutation checks, FCM target selection, realtime result eligibility and Android parsing;
- Agent remains relay-agent-v90 unchanged; Android advances monotonically after beta-vc91;
- the normal Agent → operatingScheduleChanged → Worker + FCM path remains unchanged and event-driven;
- when Worker is closed, exact recovery reads only relay_poc_coordination/operating_schedule, is single-flight and throttled globally to one read per 10 seconds, with no collection query/listener/poll/cron;
- a newer recovered schedule version updates InventoryCore and emits the existing operating_schedule WebSocket invalidation;
- Web Ca vận hành reloads on that scope and on realtime reconcile;
- foreground Android consumes ACTION_OPERATING_SCHEDULE_CHANGED and reapplies the local operating window without polling;
- Báo hàng send is disabled locally when the shared window is closed, and the server recovers schedule authority before returning ANDROID_WINDOW_CLOSED;
- result FCM delivery uses the reconciled window so overtime resolution is not suppressed by stale Worker state;
- D154 PickList exact-read fallback, D153 presence dedupe and D150/D152 confirmation/HA timings remain unchanged;
- no new provider resource, Firestore collection/write cadence, secret, listener, polling loop or cron is introduced.

Owner field PASS should verify: current Pickers start with Báo hàng off; an Admin enables one test Picker and the choice persists through HR sync; after 22:30 Agent enables overtime and Agent/PickList, Web Ca vận hành and Android Báo hàng converge; Báo hàng submits and receives Có hàng/Skip during overtime; closing/cancelling overtime disables send again; Firebase usage shows no new periodic cadence.

## D157 acceptance — Agent v91

D157 technical and field acceptance must prove all of the following while Android remains the already-signed `beta-vc92`:

- A normal vc92 PickList completes end-to-end with the same request/ACK/result contract as D156.
- With the optional fast path connected, a new PENDING event wakes the existing REST queue path; disabling/exhausting the fast-path read guard leaves the exact 3s/15s/1s REST behavior operational.
- A burst up to the accepted bounded batch/concurrency limit cannot create a second WMS mutation path or duplicate terminal ACK.
- Terminal ACK is committed immediately without a per-job daily-summary write. After 50 ACKs or five minutes, the daily summary is corrected to absolute authoritative totals by one checkpoint; restart/PRIMARY transfer triggers recovery and cannot double-count.
- `tamnv2` and `admin` can choose a different ready Agent from the fleet even if the initiating machine is PRIMARY. The target must real-reload/validate its own Confirm page before role CAS; failed target validation leaves the old PRIMARY unchanged.
- A non-authorized login cannot open/execute the targeted transfer flow.
- Non-PRIMARY session check is due every two hours, defers while busy and requires 30 seconds idle. PRIMARY is due only after 60 minutes without strong WMS proof and 60 seconds idle. Incoming PickList outranks scheduled reload.
- Every D157 active session check uses the existing real `Page.reload(ignoreCache=false)`; D137 three-second pre-reload settle, `navigationType=reload` proof, 1.2-second post-reload stability and one-shot recoveries remain intact.
- Windows network-address change refreshes proxy at 0/750/3000/8000/15000 ms, safe reads prefer fresh system proxy during the transition, and there is no corporate-filter bypass.
- Call Picker, Kích User, HA lease/generation/guard rules, Web/Worker business functions, Stable and Android vc92 are regression-clean.


### D157 repair acceptance — secondary operational lists

- Log into Agent v92 on a machine assigned NEXT_A or NEXT_B; without promoting it to PRIMARY, the Agent/User fleet must render and the active Picker list must render when the operational window is active.
- If the secondary receives an AGENT_SYNC snapshot before UI paint, the UI must repaint from that in-memory snapshot without requiring a new Firestore read/write.
- Exercise logout→login and CLOSED→ACTIVE transitions; lists must reappear without manual PRIMARY transfer.
- Promote another machine to PRIMARY and confirm the secondary continues to display lists while remaining non-PRIMARY.
- Confirm normal PickList mutation remains PRIMARY-fenced, Android stays beta-vc92, browser/F5 behavior is unchanged, and no new provider cadence/resource is introduced.

## D158 acceptance — Agent v94 hotfix efficiency, health, counter and support-log lifecycle

Android remains the already-signed **beta-vc92** and must not be rebuilt for D158.

Technical/runtime gates must prove:
- Agent v94 builds with the D157 confirmation guard, generation fence, 10s lease, 15s failover, 3s/1s/15s REST fallback and D137 real Page.reload protections intact.
- Firestore gRPC listeners no longer use a project_id/database_id routing pair; the routing header carries the same full database resource as ListenRequest.Database.
- On PRIMARY, a full PENDING DocumentChange enters the existing confirmation pipeline without waiting behind a due REST query. REST fallback still runs on the accepted independent cadence. Queue, transport ingress, business input and final browser mutation must all preserve one RequestId = at most one business job/mutation; different RequestIds sharing a suffix remain independent.
- Normal connected-listener operation does not add a new polling cadence. The 2s degraded REST path is active only while the listener is disconnected and stops when connected or when the D158 local read reserve reaches 2,000.
- NEXT_A/NEXT_B do not show "Mất kết nối" solely because they do not own PRIMARY business polling. Role changes repaint consistent role/health information.
- AgentSync mutations reuse listener RAM + updateTime CAS on the uncontended path and exact-read/retry on conflict, preserving no-lost-update semantics.
- Successful pre-WMS roles/generation proof refreshes the role-read freshness timestamp; no safety fence is removed.
- At the 05:00 Asia/Ho_Chi_Minh boundary, local Agent counters and overlay reset before new-day display/increment. Suspend/resume over 05:00 has the same result. Shared counter snapshots from a different day are ignored.
- Durable fleet-counter read is bounded to business-day or PRIMARY-generation recovery rather than every five-minute AgentSync reconcile.
- Agent logging continuously writes sanitized local streams, seals immutable pending bundles, preserves failed uploads across restart, and performs bounded retry without blocking PickList/WMS/ACK.
- Login/DPAPI restore flushes pending sealed bundles; logout records/seals before auth clear; process kill/power loss yields one recovery bundle on next authenticated start.
- Repeated errors are fully retained in local technical logs. One active Google connectivity incident produces at most one immediate support bundle; a positive recovery signal closes the incident and a later outage is eligible for a new bundle. Firebase role-probe 400 responses are diagnostic-only unless both allowed roles fail.
- With the Apps Script gateway unconfigured, D157 Firestore support-log delivery remains available as a safe compatibility path. With the scoped gateway configured, Agent uses Apps Script → Drive and does not dual-write the same bundle to Firestore.
- Gateway retry of the same bundle id produces one Drive file, verifies content hash, requires valid Firebase ADMIN/PICKPACK_ADMIN authority, and never writes outside Inventory/Beta/Logs.
- No secrets, Firebase tokens, passwords, WMS session/cookie/signature material or signing material appear in repo or archived logs.
- Stable remains untouched.

Before Owner field acceptance after the v93 field defect, the D158 hotfix must pass the normal branch → PR → authority/continuity PASS → merge path, and the existing main Agent workflow must publish official `relay-agent-v94` plus update the Agent distribution channel. A PR-only artifact and the superseded v93 runtime are not acceptable field-release substitutes. Owner field acceptance must use released v94 on real Office networking and verify: no duplicate RequestId/WMS mutation under listener+REST overlap, normal vc92 PickList latency, REST fallback when listener is unavailable, role-health/failover, final-only auth errors, connectivity incident coalescing/recovery, 05:00 rollover, Apps Script reachability and duplicate-safe Drive upload. D158 remains open until explicit Owner PASS.



## D159 isolated Firestore Usage test acceptance

D159 is field-accepted only after all of the following pass:

1. **Isolation:** Agent v94, D158 log gateway, Android vc92, Web/Worker, WMS, Firestore relay/HA and Stable files/resources remain unchanged by the D159 implementation.
2. **Standalone startup:** D159 EXE opens directly to one **Thông tin** tab with no login prompt and immediately starts a Usage refresh.
3. **Read-only local auth:** on a Windows user with an existing saved Agent session, D159 obtains an ID token without modifying/deleting `session.bin`; on a user without that session it fails clearly and creates no credential file.
4. **Gateway auth:** missing/invalid/non-ADMIN/PICKPACK_ADMIN tokens are rejected. The endpoint never serves Usage merely because the Web App URL is known.
5. **Metrics:** Reads/Writes/Deletes, realtime current/peak, rules ALLOW/DENY/ERROR and 24 hourly rows are returned where Cloud Monitoring exposes them; partial metric failure remains explicit.
6. **Quota safety:** one Apps Script collection miss performs only bounded Cloud Monitoring queries, then a shared 900-second Script Cache serves repeated Agent refreshes. The D159 feature creates zero Firestore document reads/writes/deletes.
7. **Comparison:** provider-day totals and representative hourly points are plausibly aligned with Firebase/Cloud Monitoring after allowing for documented provider delay.
8. **No side channels:** no WMS, Cloudflare business API, Drive, Sheet, Firestore REST/gRPC business operation, Android push or D158 support-log request is made by D159.
9. **Security:** no password, refresh token, Firebase ID token, API-key value or Google credential appears in source, console output, support logs or release notes.
10. **Release:** only a configured D159 prerelease built with the dedicated `D159_USAGE_GATEWAY_URL_BETA` may be handed to Owner for field testing. CI placeholder builds are technical artifacts only.
11. Stable remains OWNER-GATED and untouched.

## D159 v3 — multi-service Usage acceptance

D159-v3 remains under the same Owner gate OA087. PASS requires all of the following:
1. D158 Agent v94, Android vc92 and all accepted business paths remain unchanged.
2. The standalone executable title identifies D159-v3 and opens one **Thông tin Usage** tab without a login form.
3. It reads the existing Agent DPAPI session read-only and does not write/delete `session.bin`.
4. Firestore provider-day Đọc/Ghi/Xóa, reset countdown, storage, realtime, Security Rules, 24-hour totals/peaks and hourly rows render real or truthful N/A values.
5. Firebase Auth / Secure Token, FCM and `inventory-beta-picker-alerts` Cloud Run metrics render without document scans or business Firestore operations.
6. Automatic refresh remains exactly 15 minutes; Apps Script uses one shared 900-second cache and performs at most the registered 13 Monitoring queries per cache miss.
7. CI probes the Firestore storage, FCM consumed-api, Identity Toolkit consumed-api, Secure Token consumed-api and picker-alert Cloud Run metric filters with HTTP 200 before release.
8. The usage feature itself creates **0 Firestore document reads, 0 writes and 0 deletes**; no WMS, Worker, Drive or RTDB business traffic is introduced.
9. Future Agent integration acceptance must additionally prove exact login `tamnv2` and `admin` see the Usage tab while another valid Agent user has no tab, no Usage timer and no Usage gateway request.
10. D159 is not Owner-PASS until the Owner tests the published v3 field executable and explicitly says PASS. Stable remains untouched.
## D160 acceptance — Agent v95 bulk, Usage, Logs, history and provider consolidation

D160 remains behind OA090 until the released Agent v95 is field-tested with the unchanged beta-vc92 PDA.

Technical gates must prove:
1. Agent build/version is 95 while Android beta-vc92 source/release/channel are unchanged.
2. Firestore micro-batch maximum is 15; READY fast-wave outcomes can ACK before deferred checkbox recovery.
3. Fast mixed-batch search does not enter the long empty-table F5 path. Zero table produces technical unavailable and no Picker strike.
4. Bulk WMS mutation freezes exact targets, rejects stale/foreign selection, retains PRIMARY generation and per-target confirmation guards, and uses at most one final dialog click per wave.
5. Post-final `CONFIRMED` requires a new or content-changed success surface observed after the click. A fresh error surface remains guarded/uncertain for multi-row safety. Row presence/disappearance and navigation/reload are absent from terminal success logic.
6. Every non-success post-final guard is never released/reconfirmed merely because an error surface, row visibility change or reload occurs.
7. Cross-cycle stale PENDING replay of a recently terminal RequestId is skipped locally without provider operations.
8. gRPC UNAUTHENTICATED is not classified as the five-minute permanent circuit. Worker revoke 401 performs at most one refresh/retry before a 60-second local circuit.
9. Usage tab/timer/gateway calls are exact-login `tamnv2`/`admin` only and use the consolidated gateway with shared 15-minute Monitoring cache and zero Firestore document ops for Usage.
10. Old operation/technical log tabs are absent; log presentation no longer performs realtime list rendering; one sanitized complete local log remains and manual upload uses the accepted log path.
11. History table is populated from existing in-memory business/sync data and introduces no Firestore read/write/listener/poll cadence.
12. Existing ACK write count is unchanged while contractor/full PickList fields are available for history/export.
13. Closed-day Excel includes the new history fields. Terminal ACK deletion happens only after Drive upload PASS and uses the already-read export list; unresolved documents survive.
14. Provider migration keeps the existing Agent gateway URL, moves/renames the existing script, proves unified D160 GET identity **and an authenticated Monitoring-backed Usage POST**, cleans the temporary Firebase Auth canary user, then deletes the redundant D159 script.
15. Stable remains untouched and no secret/session/password/WMS material is committed or logged.

Owner field acceptance must additionally validate single and burst/mixed real WMS behavior, fresh-success recognition despite page reload/row persistence, Usage visibility under allowed/disallowed Agent accounts, manual Logs upload, History presentation and unchanged beta-vc92 result flow.



## D160 v96 Owner-field repair acceptance

1. Start/update Agent on the Confirm route with a rendered table shell but no real `PL...` data. It must remain not-ready, issue at most one bounded normal `Page.reload(ignoreCache=false)` recovery, and only become ready after real PickList data appears.
2. With one exact PickList and one visible enabled row checkbox, confirmation must not fail because of hidden duplicate checkbox controls or a checked header/framework checkbox. A checked different real PickList row must still fail closed before final mutation.
3. Cài đặt must show both Bảng nổi PickList and Logs without overlap. Manual send must use the existing Agent Operations Gateway.
4. Run Agent across 21:45; verify one delta checkpoint attempt. After each successful overtime continue/stop/cancel/manual-adjust decision, verify one additional delta checkpoint attempt without periodic spam.
5. For a Drive-confirmed Apps Script upload, verify local log lines older than the uploaded cutoff are pruned while newer lines and sealed unsent bundles remain.
6. For exact Agent login tamnv2/admin, automatic Usage refresh must occur only at local `:00/:15/:30/:45` boundaries. Manual refresh remains available. Other Agent accounts have no Usage timer/call.
7. Generate confirmation, NOT_FOUND strikes and a lock. PRIMARY/NEXT_A/NEXT_B must converge on the current business-day history through the existing `agent_sync` stream, including wrong-count and lock level/minutes/until.
8. Provider evidence must show no new history listener/poll/read and no history-only `agent_sync` write; the history payload may change only when the existing aggregate-counter change already requires reconcile mutation.
9. Re-run original D160 batch/fresh-terminal/no-second-mutation/ACK/daily-export/provider regressions. Android beta-vc92 and Stable remain unchanged.

## D161 — Approved backlog acceptance plan (implementation not started)

When the Owner later authorizes implementation, D161 acceptance must prove at minimum:

1. Reporting capability: DB/server ON logs in as ON and OFF as OFF; boolean, numeric and accepted legacy string forms converge correctly; missing/null/unknown fails closed; logout/login, reconnect and missed realtime converge to server authority; runtime-settings reset cannot re-run D156 default-OFF migration.
2. Web version: header shows **Website nghiệp vụ Inventory | Version 1** for the current Web baseline and runtime logs include the same canonical version. A Web-source release increments it; non-Web-only releases do not.
3. Date presets: Hôm nay/7/30/60-day selections update both visible Từ/Đến fields and actual requests on every applicable Web date-range surface; a subsequent Xem/Áp dụng cannot revert to stale restored values.
4. HR event path: verified Sheet change reaches Worker without Apps Script or Web polling; +1 new Picker auto-applies; >1 new Picker requires confirmation; thresholded information changes follow policy; missing Picker does not auto-disable/delete; duplicates/header/tab/access/empty/>20%-loss hard-block without destructive mutation.
5. Reporter correction: Web and Android agree on server-authoritative eligibility; Android displays **Sửa thành Đã có hàng · MM:SS**, uses one zero-network visible-screen ticker, removes the button at expiry, pauses when not visible, rechecks on server at POST, and logs bounded correction diagnostics.
6. Authenticated Web footer contains only the product credit while `/about`, `/privacy`, and `/terms` remain publicly routable for OAuth/legal purposes.
7. No D161 countdown or HR change path adds Firestore polling/listeners, no secret is committed/logged, Agent behavior is unchanged unless separately added under D161, and Stable remains untouched.

## D161 log, Agent UI and overtime acceptance addendum

Status: Owner-approved acceptance requirements; implementation deferred.

Later D161 implementation is not acceptable unless tests prove all of the following:

### Logs
- Android confirmed logout immediately shows progress, ignores duplicate logout triggers, and completes without duplicate session-end uploads for one logout transaction.
- A session-end Android bundle is typed/classified as logout/session rather than scheduled.
- Web/Android/Agent archives for a successful upload land under the correct trusted `YYYY-MM-DD` Drive child by archive time.
- Simulated Drive failure leaves Android/Agent pending evidence intact; only positive Drive confirmation permits local prune.
- Global request rejects non-`admin`/`tamnv2`, dedupes repeated same request-id, ignores expired/logged-out clients, does not re-upload Drive-synced history, and demonstrates bounded responder jitter without per-device Firestore ACK writes.
- Agent repeated boundary callbacks for the same event produce one logical sealed boundary, not multiple near-identical checkpoints.

### Agent History/Usage
- Loading a full operating-day History does not visibly add rows one at a time and remains responsive while data is prepared.
- One fleet-history row change does not require a visible full-grid clear/rebuild.
- History tab entry order is full `SentAtMs` descending. Manual alternate sort works during the current tab visit; leave/re-enter resets to newest first.
- Usage applies one completed snapshot without progressive label/grid wave. Hidden-tab refresh does not repaint metric-by-metric.
- UI optimization adds zero Firestore document operations/listeners/polling and does not delay protected PickList relay processing.

### Overtime
- At 22:14:59 with no override, normal relay remains active; at 22:15:00 it becomes SLEEP and no pre-end Continue/Stop prompt exists.
- Sleep panel is red/white and offers **Gia hạn +1 giờ**. No action leaves relay asleep with no periodic write.
- Extension from sleep is now+1h capped at 05:00; extension while active is current `override_until`+1h capped at 05:00.
- A deadline 01:30 produces exactly one T-15 warning at/after 01:15 for that boundary. Yes/extend changes the authoritative end; No keeps 01:30 as end and suppresses repeat prompt; no response also sleeps at 01:30.
- Multiple Agents racing extension converge through shared schedule authority and do not double-add hours.
- Android/Web/Worker enforcement agrees with Agent SLEEP/ACTIVE state at the changed 22:15 normal boundary.
- 05:00 cutoff and inherited 05:00–05:45 early-start behavior remain correct.

### Business shift / Replay guard separation
- Web `Ca vận hành` and every outward normal-shift label show **06:00–22:00**, not 05:45–22:15.
- Replay state tests still prove technical ACTIVE from 05:45 until 22:14:59 and SLEEP at 22:15 without override.
- If 05:45–22:15 appears anywhere user-visible, it is explicitly labelled as the Replay technical window and never as the normal shift.
- Reporting/shift comparison behavior continues to use the established 06:00–22:00 business definition.

### D161 bulk Picker revoke / update lifecycle acceptance

**Bulk Kích toàn bộ user**
- Exact Agent login `admin` and `tamnv2` see the bulk button; other Agent logins do not.
- Button is in the active-Picker card header/tool area, not a grid row.
- Search/filter applied → warning count/scope still targets all authenticated Picker/PDA sessions.
- Cancel at warning → zero mutation.
- Wrong/cancelled Agent password → zero mutation and no password in diagnostics/logs.
- Success invalidates all targeted Picker Android session generations with one idempotent bulk command; no Agent-side N-per-user kick request loop.
- A PDA that receives acceleration signal returns to login promptly.
- A PDA that misses the signal cannot continue using the old generation on the next authenticated authority check.
- Web/Agent/Reporter sessions remain unaffected.
- Repeat same command/request id is idempotent.

**Agent update**
- Startup with update channel online/offline produces no Agent update-channel request.
- Running Agent for more than 30 minutes produces no periodic update check.
- Manual current/new/failure cases behave as specified; failure does not disrupt relay/PickList runtime.
- New-version Yes follows trusted download/checksum/replace/restart; No does not download.

**Android login/update**
- Login screen visibly shows current **Beta vcXX** plus **Kiểm tra cập nhật** before authentication.
- Automatic check success/current → login stays usable and no intrusive current-version dialog.
- Automatic check finds newer version → **Cập nhật / Để sau**; no APK download before Cập nhật.
- Automatic check DNS/timeout/HTTP/manifest failure → visible non-blocking warning; Login remains enabled.
- Manual login-screen check works after an automatic failure and is single-flight with it.
- Installed-current-APK signer/integrity failure remains fail-closed.
- Authenticated version tap first asks **Tìm kiếm bản cập nhật?**; No sends no request; Yes checks once.
- Authenticated Yes + newer trusted version proceeds to download/verify/install without a second download confirmation.
- Missing package-install permission is guided once and pending install resumes/opens installer after permission is available.
- No claim/test expects fully silent Android 11 installation unless a later separately authorized Device Owner/MDM/OEM path exists.
- Update failure diagnostics contain sanitized stage/category but no secret, token, password, signer material or raw sensitive payload.

### D161 Phase 0A Permission / Provider Preflight acceptance

**Hard gate before Safety release and backlog code**
- Phase 0A starts only after the exact Owner command `bắt đầu D161 tiến hành`.
- No D161 business/runtime source mutation is present before Phase 0A PASS.
- GitHub branch/PR/merge and existing Android/Agent release-channel write paths are proven available.
- Cloudflare Beta deploy credential is active for the existing Worker/Web/Durable Object path; Stable is not touched.
- Protected Android Beta signing material is present, trusted signer identity is derivable and monotonic version resolution is available without exposing signing secrets.
- Existing Beta Firebase Auth, Firestore Rules, Functions/Eventarc/FCM and session-control paths required by the selected D161 design pass bounded capability checks.
- Existing Apps Script Agent operations gateway, Script API/clasp lifecycle and Monitoring access pass where reused by D161.
- Current Google OAuth/runtime credentials required by D161 pass scoped capability checks without broadening scope by default.
- Current verified HR Google Sheet remains readable.
- HR Drive watch hard gate passes: exact verified HR file resolves; `files.watch` channel creation succeeds; Beta Worker receives initial `sync`; replacement/renewal is proven without duplicate business application; superseded channel stops; probe cleanup succeeds; HR rows remain unchanged.
- Logs daily-folder hard gate passes: trusted archive layer creates/resolves one disposable child under the scoped Logs parent, uploads and reads back one sanitized tiny probe file, then removes/trashes probe artifacts and verifies cleanup.
- Global-log control-plane capability is proven with one bounded authenticated canary and without per-device acknowledgement-write cadence.
- Current Android/Agent manifests/assets/checksums are readable before Safety numbering/publication.
- No secret, credential, signer material, refresh token, Firebase token or WMS/session material appears in source, Actions output, support logs or public artifacts.

**Failure behavior**
- Any missing scope/IAM/provider permission/signing/release capability makes Phase 0A FAIL-CLOSED.
- No Safety release or D161 backlog source mutation begins after a Phase 0A failure.
- If an Owner-only consent/grant is unavoidable, all known missing grants are batched into one shortest official UI action where possible.
- After repair/grant, the affected capability and the relevant Phase 0A matrix are rerun to terminal PASS.

### D161 Phase 0 Safety Baseline / rescue acceptance

**Phase 0 before backlog code**
- Exact current main/source/component identities are captured.
- Current Beta Worker health source, SQLite schema and Operational V2 schema are recorded and PASS.
- Current release-channel manifests are fetched and validated.
- Existing accepted Android/Agent artifacts have resolved release identity and SHA-256 where available.
- A machine-readable safety manifest contains only non-secret metadata and can reconstruct which source/artifacts/config references form the safe model.
- A next-monotonic Android safety APK is signed/published from Safety behavior and installs over the prior accepted APK.
- A next-monotonic Agent safety EXE is published from Safety behavior and replaces/starts over the prior accepted Agent.
- Safety channel manifests/checksums match the published artifacts.
- Safety Android reaches login and passes critical pre-D161 smoke.
- Safety Agent starts, restores/authenticates as applicable and passes critical relay/browser/runtime smoke.
- Safety Web build/source identity is reproducible and critical shell/auth checks PASS.
- No D161 backlog business behavior is introduced before all Phase 0 gates PASS.

**Migration guards during D161**
- CI/source review fails a destructive required-field/table drop/rename or incompatible Safety contract removal before Owner acceptance unless a separately approved recovery plan exists.
- Additive newer fields/tables do not break the Safety-compatible rescue runtime.
- Rescue does not require database version-number downgrade.

**Owner-triggered rescue drill/real rescue**
- Given failed D161 Agent vN, rescue publishes vN+1 or greater from Safety-compatible behavior and channel manifest resolves to it.
- Given failed Android vcN, rescue publishes vcN+1 or greater, signed with the trusted Beta signer, and installs over vcN.
- Safety Web behavior can be deployed while the current schema-compatible backend remains forward-deployed.
- Worker rescue health reports the current supported schema and critical auth/business API checks PASS.
- Firebase rules/functions/schedule/log paths changed by D161 are forward-deployed to Safety-compatible behavior without deleting data.
- A client that cannot self-update has a valid trusted manual installation path.
- After rescue, normal safe operations pass the critical smoke matrix before D161 repair resumes.
- Canonical state records `D161_RESCUE_TO_SAFETY_BASELINE`; no D162 is created for the rescue.

**Acceptance routing**
- Technical/runtime/release PASS alone does not promote D161.
- Only while state is explicitly waiting for D161 Owner field test, Owner phrase `ghi nhận ok` or explicit `D161 PASS` promotes D161 to accepted base.


## D160 post-PASS diagnostic Agent candidate acceptance — 2026-10-03
This is a diagnostic-only field candidate; D160 relay-agent-v97 remains accepted until explicit Owner PASS.
1. Build/version identity is monotonic and clearly diagnostic; Android beta-vc92, Web, backend schema and Stable are unchanged.
2. Dedicated Agent prerelease/artifact exists, checksum is verified, and **inventory-channel remains byte-for-byte/version-identical to accepted relay-agent-v97**.
3. D160 v97 protected confirmation regression remains PASS: exact row matching, max-15 micro-batch, one confirm dialog per ready wave, no second mutation after final-click uncertainty, confirmation guard and 12-second mutation fence.
4. Logging captures structured bounded evidence for page reload epoch/reason/duration, page-size 10/100 state, hydration/row count, search/recovery timing, DOM-change hash, row/checkbox classification, batch/confirm timing, terminal-surface lifecycle summary, post-confirm same-row marker classification, Firestore canonical/HTTP error class and HA refresh reason where available.
5. Diagnostic telemetry emits no raw PickList, suffix, token, password, cookie, session, authorization header, raw HTML, screenshot, credential or signing material.
6. No diagnostic timer/poll/listener/provider write is added; request/WMS/Firestore cadence remains the accepted v97 cadence.
7. Local logging stays bounded by the accepted rotation/seal/upload lifecycle and does not create a new Drive/Firestore/Apps Script resource.
8. Field evidence must show no material latency regression on successful confirmation and must provide enough evidence to distinguish stale checkbox, hard-refresh hydration, reused terminal UI and presence/control-plane Firestore failures.
