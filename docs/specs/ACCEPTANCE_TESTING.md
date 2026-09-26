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
