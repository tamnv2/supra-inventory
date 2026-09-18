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
- Detailed reporting supports bounded paged CSV export using the current safe Beta columns without claiming those columns as the final Stable export contract.
- Web SLA validation uses the same current bounds as the server: warning 1–1440 minutes; escalation > warning and <= 2880 minutes.

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
