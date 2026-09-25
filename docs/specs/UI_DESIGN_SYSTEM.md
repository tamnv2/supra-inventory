# UI_DESIGN_SYSTEM — Legacy Operational UI V2

Status: **CANONICAL OWNER-SELECTED DESIGN DIRECTION**.

## Authority

Owner approved **direct legacy presentation transplant** on 2026-09-18. This supersedes any earlier instruction to reinterpret or merely imitate the previous product.

Visual/layout source-of-truth:
- read-only UI source: `tam95supra-source/bao-hang-1291`;
- Owner-provided screenshots of the running prior Web/APK;
- presentation structure only.

The goal is not "similar" styling. Preserve the previous product's presentation geometry and interaction shell as directly as practical: DOM/layout hierarchy, topbar/sidebar/workspace composition, spacing, density, cards/tables/actions, responsive behavior on Web, and XML/drawable/color/style/layout structure on Android/PDA.

Forbidden imports remain unchanged: legacy backend/provider/auth/storage/database/credentials/resource assumptions and out-of-scope business fields are never transplanted.

## UI-first parity gate

The current implementation order is Owner-mandated:

1. Inventory the complete prior Web/APK presentation source before editing the new product.
2. **Transplant presentation instead of redesigning it.**
   - Web: preserve the old topbar, health/status chips, role-test strip where applicable, left grouped sidebar for Admin/Root, workspace/content composition, cards/tables/actions, empty states and responsive breakpoints.
   - Android/PDA: preserve the old native resource hierarchy using XML layouts, drawables, colors, styles/themes and row/overlay resources. Do not rebuild the accepted shell as approximate programmatic `LinearLayout` geometry.
3. Remove/ignore legacy backend/provider/auth/storage calls. Bind the transplanted UI only to current SUPRA Inventory adapters/data later.
4. During the UI phase, fixture/sample data may be used to render every required state. Business mutation completeness is not the UI acceptance criterion.
5. Validate screen-by-screen and viewport-by-viewport. CI/build PASS means only technical validity; it must never be labeled Owner UI PASS.
6. Stop the UI phase only at explicit Owner UI/layout acceptance.
7. Only after Owner UI acceptance may canonical logic/scenarios/business rules be rebuilt/wired into the accepted shell.

Any intentional visual divergence from the prior product requires explicit Owner approval.

## Core principles

- Picker/Reporter business work receives maximum useful screen area.
- SKU and product name are visually stronger than decorative headings.
- Use light neutral surfaces, restrained borders and minimal shadow.
- Green = positive/primary; amber = waiting/SLA attention; red/pink = Skip/destructive/error; gray = withdrawn/non-current.
- Status always includes text; never depend on color alone.
- Use system/Roboto/Noto-style typography without a remote font dependency.
- Remove design rationale, implementation commentary and unnecessary explanatory prose from the product.
- **No offline business mode.** No offline-business affordance exists.

## Android/PDA shared header

After login:
- clearly readable `BÁO HÀNG 1291`;
- concise `MNV · Họ tên` identity;
- secondary role/build marker;
- utility actions in a compact overflow/menu when that preserves narrow-screen width;
- no long version text competing with the product title.

The title must never collapse into a vertical character stack on narrow PDA screens.

## Picker PDA

Canonical vertical composition:
1. compact header/identity/tools;
2. large SKU input (`Nhập / quét SKU` or equivalent concise hint);
3. compact suggestions when needed;
4. prominent selected SKU + product name block;
5. full-width `BÁO HẾT HÀNG`;
6. `BÁO HÔM NAY` / today history;
7. readable status cards and conditional `Thu hồi`.

Rules:
- Do **not** restore the former one-row SKU input + report button layout.
- Report action is enabled only for a valid selected SKU while online.
- Pending = amber/yellow; has-stock = green; skip = red/pink; withdrawn = gray.
- Critical final result is shown in a high-priority result surface with `XÁC NHẬN ĐÃ NHẬN`.
- Multiple unacknowledged results are presented deterministically and none is silently lost.

## Reporter PDA

- Four filters remain: `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`.
- Pending cards prioritize SKU, product name, affected Picker count, first report/waiting duration and SLA/recurrence context.
- Two large actions remain visually dominant: `CÓ HÀNG` and `CHO SKIP HÀNG`.
- Picker detail expands separately without squeezing those actions.
- Skip opens explicit impact confirmation before commit.
- Resolved cards may show acknowledgement progress such as `3/5 Picker đã xác nhận`; ACK is not a new batch status.
- `Picker thu hồi` uses real withdrawal-closed data.
- Five-minute Skip→Có hàng correction appears only while server allows it.

## Admin/Root PDA

Admin/Root must not be rendered as only Reporter. After login show a concise launcher grouped into:

### Vận hành
- Hàng chờ xử lý
- Kết quả gần đây

### Quản trị
Role-allowed concise entry points for Picker/personnel status, accounts, Master SKU status and SLA/settings overview.

### Hệ thống
- Trạng thái dịch vụ
- Log / Chẩn đoán
- Cập nhật
- account/logout utilities as appropriate

Deep HR source editing, 10k–50k SKU import, detailed reporting and bulk administration remain Web-first. ROOT sees Root-allowed entries while normal subordinate controls still cannot manage ROOT.

## Web

Web is operational-first.

### Reporter landing/focus

Show a dense live operational list/table before analytics:
- SKU;
- product name;
- affected Picker count;
- first report/wait duration;
- SLA/recurrence context;
- `CÓ HÀNG` / `CHO SKIP HÀNG`;
- expandable Picker detail.

Compact state filters/counts may sit above the list. Do not place large KPI cards or explanatory paragraphs before the live queue.

### Admin/Root information architecture

Group functions conceptually as:
- **Vận hành** — live queue, results/history;
- **Dữ liệu** — Master SKU, HR source;
- **Quản trị** — accounts, Picker lifecycle, SLA/business settings;
- **Báo cáo** — overview, detailed reporting, SLA/recurrence;
- **Hệ thống** — service state, archive/sync, diagnostics/version where implemented.

Dashboard is an Admin/Root analysis module, not the Reporter landing surface.



### Owner three-group navigation refinement (D065)

D065 overrides prior five-/four-group navigation grouping where they conflict, while preserving the approved business functions:

- Admin/Root left navigation has **exactly three large groups** and each large group has at most **five visible child items**.
- Proposed composition pending Owner implementation approval:
  - **VẬN HÀNH** → `Xử lý báo hàng`, `Tổng quan & báo cáo`;
  - **QUẢN LÝ** → `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`;
  - **HỆ THỐNG** → `Trạng thái hệ thống`, `Nhật ký`.
- `Kết quả gần đây` is an internal view of `Xử lý báo hàng`, not a sidebar child.
- `Nguồn nhân sự` and Picker provisioning/synchronization are internal sections of `Nhân sự & tài khoản`, not a separate large-group child.
- `Thiết lập nghiệp vụ` is renamed to the concrete `Thời gian xử lý` surface because only warning/escalation timing is currently approved there.
- `Tài khoản & mật khẩu` is a personal identity action and moves to the pinned identity/user control instead of the business sidebar.
- Reporter shows only its allowed VẬN HÀNH projection and no empty unauthorized groups. Picker Web keeps a single Picker operational workspace rather than inheriting the Admin information architecture.
- D065 is a navigation/workspace composition decision only; it does not change business APIs, state transitions, realtime semantics, data scope or RBAC.
- Android/PDA is unchanged unless separately authorized. Stable remains OWNER-GATED.



### Owner-approved three-group navigation implementation (D066)

The Owner approved the exact D065 composition for Beta Web implementation:

- **VẬN HÀNH** has two visible children: `Xử lý báo hàng`, `Tổng quan & báo cáo`.
- **QUẢN LÝ** has three visible children: `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`.
- **HỆ THỐNG** has two visible children: `Trạng thái hệ thống`, `Nhật ký`.
- No large group may exceed five visible children.
- `Kết quả gần đây` remains an internal workspace tab under `Xử lý báo hàng`.
- `Nguồn nhân sự` and `Đồng bộ Picker` remain internal tabs/sections under `Nhân sự & tài khoản`; they are not standalone left-nav children.
- Personal `Tài khoản & mật khẩu` is removed from the business sidebar and exposed from the pinned top identity controls.
- Reporter renders only the permitted VẬN HÀNH projection; Picker Web keeps its single `Báo thiếu hàng` workspace.
- This is a Web composition change only. It must not change server RBAC, business transitions, realtime semantics, data scope, Android/PDA navigation or Stable runtime.


### Detailed operational system-status console (D064)

- `Trạng thái hệ thống` is an Admin/Root service console, not a raw JSON diagnostics page. The primary layout is summary cards followed by service cards and data-footprint/load-test sections; raw sanitized technical JSON is secondary inside an expandable detail.
- The service console must represent every active runtime/support service in the Beta model: Cloudflare Worker, InventoryCore Durable Object/SQLite, Firebase Authentication, Firebase Cloud Messaging, Google Drive, Google Sheets, GitHub release/CI channel and foreground realtime.
- Every service card distinguishes **actual observed usage/state** from **reference limits**. The UI must not label an account Free/Paid/Spark/Blaze unless the entitlement is authoritatively readable. Where entitlement is unknown, show both relevant reference envelopes and state that the plan was not detected.
- Actual low-cost metrics include SQLite database bytes/table row counts, current business row counts, active authenticated realtime users/sessions, FCM registered devices/delivery attempts, configured HR-source rows, archived batch count, Drive account storage and project-folder file counts where available, and latest GitHub Beta release metadata.
- InventoryCore metrics may refresh every 60 seconds only while this page is visible. Google Drive/GitHub provider metrics are cached for at least five minutes; the explicit `Cập nhật số liệu` diagnostic action may request a fresh provider read.
- Capacity meters and thresholds use plain Vietnamese labels. Technical provider terms may be shown where they are the actual service/product names, but unexplained internal acronyms/percentile notation must not be the primary user-facing wording.
- The last controlled Beta load test is shown as measured evidence: successful/target reports, Picker count, unique SKU count, duration, average response and `95% yêu cầu dưới ... ms`; the raw internal field may remain `p95_ms` in machine data.
- Dark theme covers every D064 service card, usage meter, limit box, data grid, status pill and technical detail surface with no light-only islands.
- D064 does not change the navigation grouping yet. After the load test, the AI must provide an IA critique/proposal to the Owner; navigation changes require subsequent Owner approval.

### Owner-reviewed consolidated operations, logs, reporting and people UI (D063)

D063 refines D062 without changing the product boundary:

- each Admin/Root left-navigation group exposes **no more than three child entries**; related implemented screens are presented as tabs/sections inside one business workspace rather than as fragmented navigation items;
- Admin/Root navigation is: **VẬN HÀNH** → `Vận hành báo hàng`; **DỮ LIỆU** → `Danh mục SKU`, `Nguồn nhân sự`; **QUẢN TRỊ** → `Nhân sự & tài khoản`, `Thiết lập nghiệp vụ`; **BÁO CÁO** → `Tổng quan & báo cáo`; **HỆ THỐNG** → `Trạng thái hệ thống`, `Nhật ký`, `Tài khoản & mật khẩu`;
- `Vận hành báo hàng` contains two internal views: `Đang xử lý` and `Kết quả gần đây`. Status summary, affected Picker count, elapsed time, recurrence and Picker result-receipt progress are presented together with the live queue/results instead of as separate tiny modules;
- `Tổng quan & báo cáo` contains `Tổng quan` and `Báo cáo chi tiết`. Use clear Vietnamese business terms such as `Thời gian xử lý bình quân`, `SKU phát sinh lại`, `Picker đã nhận kết quả`, `Sắp quá thời gian`, `Đã quá thời gian`; do not expose unexplained `P95`, `median/trung vị`, `ACK`, raw `SLA` or placeholder metrics;
- the overview includes authenticated online-user totals and counts by effective role. Online means an authenticated realtime connection is currently active; logout/session closure removes the connection. Multiple concurrent connections of the same user under the same effective role count as one online user for that role;
- `Nhân sự & tài khoản` uses a professional two-panel create/filter layout, a distinct bulk-Picker action bar and a full-width account table. Visible role/status labels are business Vietnamese labels rather than raw enums;
- `Trạng thái hệ thống` consolidates network/service/realtime/version/diagnostic information that was previously split into device/service/version entries;
- `Nhật ký` separates `Log Web` and `Log Android`, supports manual Web upload and sanitized detail inspection for Admin/Root, and shows the fixed periodic schedule `06:00 · 12:00 · 18:00 · 24:00`;
- dark theme must cover all D063 workspaces, tabs, summary cards, filter forms, people panels, log list/detail/status badges and remaining legacy fragments. A light-only card/pill/input/table inside dark mode is a defect;
- presentation remains compact, local-font, icon-led and realtime-first; generic refresh buttons are still prohibited on realtime-backed business views. An explicit service diagnostic probe is not a generic refresh;
- Android/PDA keeps its approved native structure; D063 only adds sanitized log behavior and clearer Vietnamese operational labels. Stable is unchanged.

### Owner-reviewed completion audit and canonical navigation IA (D062)

D062 closes the remaining Web review gaps without reworking surfaces that already passed D061 technical/runtime checks:

- Admin/Root desktop navigation uses five business areas and exposes only already-approved implemented modules: **VẬN HÀNH** (`Xử lý báo thiếu`, `Kết quả gần đây`), **DỮ LIỆU** (`Danh mục SKU`, `Nguồn nhân sự`), **QUẢN TRỊ** (`Nhân sự & tài khoản`, `Thời gian nghiệp vụ`), **BÁO CÁO** (`Tổng quan hôm nay`, `Báo cáo vận hành`) and **HỆ THỐNG** (`Thiết bị & thông báo`, `Trạng thái dịch vụ`, `Nhật ký hệ thống`, `Phiên bản ứng dụng`, `Tài khoản & mật khẩu`);
- Admin/Root default landing is the live `Xử lý báo thiếu` queue. `Tổng quan hôm nay` remains available under Báo cáo as the secondary analysis surface required by D025/D054;
- existing `Kết quả gần đây`, configurable HR source and account/password surfaces must be directly reachable instead of existing only as hidden routable sections;
- Reporter keeps the live queue as landing and can reach `Kết quả gần đây` plus its account/password surface; Picker keeps the report workflow as landing and can reach its account/password surface;
- do not add placeholder navigation, new backend behavior, stock/location scope, offline behavior or any module that is not already approved/implemented;
- dark theme coverage explicitly includes expanded Picker detail/chips, neutral and semantic badges, notice/message states, realtime toast, diagnostic/status fragments and remaining legacy report/table fragments. These surfaces must use dark-native backgrounds/borders/text rather than light cards pasted onto a dark shell;
- sidebar group headings remain icon-led, left aligned and stronger than item labels, while the fixed sidebar may scroll independently when viewport height is insufficient;
- D061 realtime rule remains: no generic refresh control on realtime-backed business views; the service diagnostic probe is a distinct action and remains allowed;
- Android/PDA and Stable remain unchanged.

### Owner-reviewed dark/realtime/sidebar cleanup (D061)

D061 refines the current Web review shell without changing Android/PDA:

- dark theme must be coherent on all reachable Web routes, including Reporter master/detail queue, results, Master SKU, HR/user administration, SLA settings, detailed reporting, device/service surfaces, logs, versions, forms, tables, modals and support diagnostics;
- dark mode must not leave white workspace/list/detail/table/form islands or low-contrast hard-coded light-theme text;
- Admin/Root left-sidebar group headings are visually stronger than before and business/group entries use small monochrome inline icons that inherit current text color; do not add a remote icon/font dependency;
- page content shows one clear business title. Remove duplicated category eyebrow + identical/near-identical title combinations where the sidebar already communicates the group;
- explanatory copy is retained only when it changes how the user must operate or interpret state; remove decorative/repeated copy;
- generic `Làm mới`/refresh buttons are absent on realtime-backed Web business views. WebSocket sequence/delta, dirty recovery and authoritative reconcile own freshness;
- semantic actions remain allowed when they perform a distinct task rather than reload state, including filters/date presets, CSV export, support-log creation and an explicit service diagnostic probe;
- realtime patches must continue preserving focused input, caret, scroll and active route/filter state.

### Owner-reviewed Root test-role and theme refinement (D060)

D060 overrides D059 where the Owner explicitly refined the header again:

- make `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` the stronger/larger header line and reduce `Website nghiệp vụ Inventory 1291` to the secondary line;
- top-right identity is two clean lines only: display name, then mapped permission label. Do not show literal `Tên:`, `User:`, `Quyền:` labels and do not display username/user id;
- remove the redundant Dashboard head group containing date, duplicate update clock and `Mở xử lý báo thiếu`; the pinned header already carries current service/update context and navigation already exposes processing;
- when immutable `base_role=ROOT`, show a compact `Kiểm tra quyền` selector with ROOT / ADMIN / REPORTER / PICKER. The selected value is a server-authoritative effective role, not cosmetic UI simulation;
- when ROOT is operating under a lower effective role, normal navigation/content/actions must match that role. The Root role selector remains visible solely because immutable base identity is ROOT, allowing recovery to ROOT;
- provide a compact `Giao diện` selector with `Tự động`, `Sáng`, `Tối`. Persist the preference locally;
- automatic Web theme uses Asia/Ho_Chi_Minh time: dark from 18:00–05:59, light from 06:00–17:59;
- dark mode must restyle the actual shell, content, cards, tables, forms, controls, dialogs, diagnostics, navigation and footer with readable contrast; changing only the page background is not acceptable;
- the theme choice is presentation-only and never changes business state;
- Android visual redesign remains pending; D060 only requires Android to refresh and render the server-authoritative effective role when the Root test role changes.

### Owner-reviewed header and identity refinement (D059)

For Web, D059 further refines the D058 desktop shell:

- top-left product identity is corporate and operational: `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` then `Website nghiệp vụ Inventory 1291`;
- replace the former status-chip cluster with one compact runtime line: `Service: Cloudflare ON/OFF | Cập nhật: HH:mm MM/DD/YYYY`;
- `Service` reflects whether the Web client can currently reach/maintain its Cloudflare service channel; an unavailable/reconnecting/offline service surface is shown as OFF until service connectivity is re-established;
- `Cập nhật` is the latest time this Web client receives authoritative information from the service, including realtime business events and successful role-page data loads; it is not a decorative clock;
- top-right identity shows `Tên`, `User`, `Quyền` and `Đăng xuất`; do not keep a topbar `Đổi mật khẩu` button;
- visible role names are business labels, not implementation enums: ADMIN/ROOT = `Quản trị hệ thống`, REPORTER = `Người báo hàng`, PICKER = `Người lấy hàng`;
- all Admin/Root left-navigation group labels and items align left;
- typography uses the local/system stack `Segoe UI Variable Text`, `Aptos`, `Segoe UI`, `Roboto`, `Noto Sans`, Arial/sans-serif fallback. Do not add a remote font dependency;
- keep the D058 pinned top/left shell and full-width central workspace;
- Android/APK is unchanged by D059 and remains pending separate Owner review.

### Owner-reviewed desktop shell refinement (D058)

For Web, D058 takes precedence over literal legacy geometry where the Owner explicitly rejected the old/current behavior:

- remove the `Kiểm thử giao diện + quyền server` strip until the Owner explicitly reintroduces an appropriate test surface;
- on desktop, the topbar remains pinned and Admin/Root left navigation remains pinned below it; the central workspace is the normal scrolling region;
- the workspace uses the full remaining browser area and must not be centered inside an arbitrary page-level `max-width` that creates unused side gutters;
- page-level dashboard/report wrappers also expand to the available workspace; narrow width limits are reserved only for controls whose task genuinely benefits from them, such as dialogs or password forms;
- visible copy is limited to operational labels, user-required guidance, validation and actionable state. Do not display AI/Owner discussion, design rationale, migration notes, backend implementation commentary or technical assurances that are not required to perform the task;
- Android/APK remains pending separate Owner review and is unchanged by this Web-only refinement.



### Owner-accepted Web refinement baseline (D067)

D066 is accepted as the current Web navigation baseline. D067 changes only the requested Web operational ergonomics and must not restyle or reorganize already accepted areas without a new Owner instruction.

- The pinned header adds a persisted `Cỡ chữ` control with decrease/reset/increase actions.
- The three operational summary cards are interactive filters for all pending, warning and overdue SKU lists; pending counts/list must reflect the complete authoritative queue rather than a fixed 200-row client sample.
- Selected SKU and all other long-list interactions preserve the current scroll/form context instead of rebuilding back to the top.
- Affected Picker detail is fetched/cached independently of expansion and displays one Picker per row.
- The detail fact formerly shown as `Lần xử lý` is replaced by the operationally useful latest report time.
- Both `ĐÃ CÓ HÀNG` and `CHO PHÉP BỎ QUA` use explicit confirmation surfaces. Skip confirmation has a default 5-second disabled final action; the signed-in user may disable/re-enable that delay from Account settings.
- Runtime log scheduling is single-flight/idempotent for an exact generated filename; the journal does not display exact duplicate filenames.
- Product-facing copy is concise end-user language. Do not expose AI/Owner discussion, decision IDs, migration/implementation rationale, or internal environment/privilege labels such as `Beta`/`Root` in normal visible UI.
- Android/PDA remains unchanged. Stable remains OWNER-GATED.

## Realtime visual behavior

- WebSocket updates must not reset scroll, selected filter/tab, focused SKU input or unrelated forms.
- Patch affected rows/cards/counts when possible.
- Sequence-gap recovery applies ordered deltas.
- Authoritative reconcile is fallback and preserves user context where possible.
- Full page reload is not synchronization logic.

## Online-only visual behavior

When service connectivity is unavailable:
- show concise connection state;
- disable/block business mutation actions;
- retain safe read-only context where practical;
- never display offline queue/outbox or `chờ đồng bộ` business states.

## Android mandatory update gate

- Verify canonical signed Beta release before login.
- Older or unverifiable build cannot log in.
- Downloaded APK is SHA-256 verified before installer handoff.
- Where supported by the current release pipeline, additionally verify expected package/signing identity.
- Do not weaken Android installation security.

## Native rendering rule

The Android/PDA visual shell must use the transplanted native resource structure from the prior product wherever an equivalent screen exists: XML layouts + drawables + colors + styles/themes + row/overlay resources. Controller code binds current data/actions to those views.

Do not replace an existing accepted legacy XML screen with an approximate programmatic `LinearLayout` reconstruction. Do not use a global post-layout view-tree rewriter to alter business UI after render.

## Product credit

Web: `Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291` — fixed at the bottom-right in small secondary text so it remains visible while the central workspace scrolls.

Android/PDA: `Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291`

Keep credit visually secondary.

## Scope guard

Reference material never authorizes bin/location/pickface, stock quantity, maps, delivery orders, incident photos, offline reporting or unrelated features.

## Android lifecycle rendering

- Realtime refresh of Picker history and Reporter queue/results uses keyed in-place row replacement rather than rebuilding the whole operational screen.
- Stable rows remain attached where their business signature is unchanged so scroll/touch context is not reset unnecessarily.
- Picker `Thu hồi` is a normal visible tap action followed by an explicit confirmation; do not hide the action behind a long-press gesture.
- Admin/Root launcher Web-first entries deep-link to their exact allowed module; direct links remain role-checked by the Web client before rendering.

## Support diagnostics surface

- Web and Android expose a support-log action using bounded technical snapshots only.
- Allowed context includes app/build, platform/device class, network/service reachability, realtime state/cursor/epoch, catalog count/version and a bounded recent technical-error list.
- Credentials, authorization headers, ID/refresh tokens, passwords, API keys, private/signing material and raw session stores are never included.
- Diagnostic objects/strings/arrays are depth/count/length bounded and credential-like keys/values are redacted.
- Generating a support log is read-only and never triggers business mutation.


### Owner Web interaction refinement (D068)

D067 items 1–8 and 10 are Owner-accepted and frozen. D068 reopens only D067 item 9 and adds requirements 11–15.

- Normal product copy must be end-user language. Remove visible development/environment/implementation wording such as Beta labels, source/build identifiers, raw internal storage/event vocabulary, raw diagnostic panels, AI/Owner discussion and migration rationale. Service names that are useful in the dedicated system-status page may remain, but their descriptions/metrics must use plain operational wording.
- Action feedback uses a bottom-left toast stack rather than banners at the top of the workspace. Toast background is translucent, each toast expires after 5 seconds, at most five are visible, and a sixth removes the oldest.
- Selected navigation items, internal tabs, filter states and selected list rows use a distinct active background in both light and dark themes.
- Large sidebar groups `VẬN HÀNH / QUẢN LÝ / HỆ THỐNG` use visibly larger typography than their child items.
- Section navigation is optimistic: update the selected item and section content immediately, then load fresh data asynchronously. Do not make a network round-trip a prerequisite for showing the selected section.
- Selecting a Reporter SKU updates only the selected row/detail surface and must not rebuild the entire pending queue. Affected Picker detail may continue loading asynchronously.
- Each user-driven section/workspace transition pushes a same-document history entry. Initial login/bootstrap and forced role reroute replace the current entry. Browser Back/Forward restores the permitted section and then refreshes its data.
- Runtime logs may record interaction/load timings for diagnosis; those timing labels are not normal visible product copy.
- Android/PDA remains unchanged. Stable remains OWNER-GATED.


### Owner-accepted D068 baseline and D069 unified Web refinement

The Owner has accepted the complete D068 Web review. D067/D068 accepted behavior is now frozen unless explicitly reopened.

D069 changes Beta Web only:

- Use one final presentation layer across all reachable Web modules so headings, page spacing, panels, forms, buttons, tabs, tables, selected states and light/dark surfaces share the same visual grammar.
- Preserve the Owner-approved three-group navigation and all role/business semantics. Visual unification must not rename or move business functions unless separately approved.
- `Thời gian xử lý` uses the common page heading, contained settings panel, two aligned threshold cards, one clear save footer and two concise current-state cards; warning/escalation values and validation remain unchanged.
- Normal async actions should patch the current workspace rather than rebuild the whole header/sidebar/shell. A full-shell rebuild is reserved for actual shell/role/session changes.
- Large Reporter queues may use browser rendering containment such as `content-visibility` so off-screen rows do not consume paint/layout work while the complete authoritative queue remains available.
- Runtime diagnostics may record bounded API latency, render duration, realtime recovery timing, long tasks, DOM/resource counts and safe interaction descriptors. Never record passwords, credentials, tokens, cookies, secret values or typed form-field values.
- Android/PDA is unchanged. Stable remains OWNER-GATED.


### D070 three-stage timing UI

The accepted unified Web presentation is extended, not replaced.

- `Thời gian xử lý` shows three equal-priority threshold cards numbered 01/02/03: Cảnh báo, Quá hạn, Tự động cho phép bỏ qua.
- Below the thresholds, show the auto-Skip enable switch and two mutually exclusive timing modes in one coherent policy area.
- Visual copy must make the strict ordering `Cảnh báo < Quá hạn < Tự động cho phép bỏ qua` obvious without internal implementation jargon.
- Reporter pending detail may show the next automatic deadline; in `PER_PICKER`, expanded Picker detail may show each Picker deadline/result state.
- Picker history/result copy distinguishes a service timeout result in plain Vietnamese.
- Warning uses the existing warning/yellow language; escalation/timeout uses the stronger danger/attention language. No additional sound requirement.
- Background browser notification permission is user-controlled by the browser; denial must not block authoritative realtime/business state.
- Android/PDA surfaces preserve the current accepted layout while adding concise deadline/source text only where operationally necessary.


### D071 Web density and logical text baseline

D071 refines the accepted Web presentation without changing navigation or business semantics.

- Every Web checkbox uses one compact fixed geometry; generic text-input sizing rules must never inflate a checkbox.
- The existing text-size control remains expressed as logical percentages. D071 raises the physical baseline by about 5%, so the new logical `100%` renders at the old `105%` scale while `A− / A+` continue to move the logical percentage.
- Reporter final confirmation closes immediately and the selected SKU shows a concise in-progress state while the authoritative online request runs. Do not show committed-success copy before the service confirms success.
- Dashboard/reporting date selection is a compact inline control: from/to dates and quick presets share one dense group and must not consume a separate full-width second row on desktop.
- Compact controls remain responsive and may wrap on narrow screens; dark-mode variables apply to the same surfaces.
- Android/PDA is unchanged. Stable remains OWNER-GATED.


### D072 quota guard — system-status excluded

D072 supersedes the visible/runtime system-status requirements from D064–D066 where they conflict.

- Admin/Root keeps exactly three large sidebar groups.
- `VẬN HÀNH` stays `Xử lý báo hàng` + `Tổng quan & báo cáo`.
- `QUẢN LÝ` stays `Danh mục SKU` + `Nhân sự & tài khoản` + `Thời gian xử lý`.
- `HỆ THỐNG` now exposes **only `Nhật ký`**.
- `Trạng thái hệ thống`, legacy `devices` and `versions` aliases are not routable and must not be reachable through hash/history navigation.
- Header-level network/realtime/service connectivity feedback may remain because it is lightweight and directly operational; it must not reintroduce provider-usage polling.
- Existing historical D064 presentation/source may remain in source history, but no normal product route may execute it.
- Android/PDA is unchanged. Stable remains OWNER-GATED.


## D074 — Picker dense split-operation navigation

- Picker uses a bottom-pinned two-way operation bar: **Báo hết hàng** and **Xác nhận đơn**.
- The operation bar stays visible while the active panel changes; it is not a scrolling card inside Báo hàng content.
- Default panel remains **Báo hết hàng**.
- Picker content density is intentionally increased for PDA: compact margins, headings around 14–16sp, inputs/actions around 48–52dp instead of oversized first-pass controls, and selected-SKU typography reduced while retaining clear state contrast.
- The active operation tab has a distinct filled background; inactive tab uses the secondary surface.

## D086 — Windows Agent presentation baseline

The Windows Relay Agent is a professional utility surface, not a diagnostic control dump.

- Use a compact `Tổng quan / Cài đặt` hierarchy.
- `Tổng quan`: one strong product identity, one primary Supra login/ready card, one connection-status card and one concise current-model card.
- `Cài đặt`: separate tabs/sections for ADMIN authentication, connectivity tests, overlay and logs.
- Do not expose transport/debug buttons as the visual focus of the main screen.
- Remove the normal title-bar close affordance because Agent is intended to run for the full Windows session; explicit protected shutdown remains available through the Agent menu.
- Overlay locked state must use a real Windows click-through extended style so the overlay is visually present but mouse input targets the application beneath it. Unlocked state remains draggable.
- Background status presentation must not justify high-frequency polling. Local machine metrics and SSID refresh are deliberately coarse while ACTIVE/STANDBY failover heartbeat remains governed by D085.



## D087 — Agent v12 overlay/minimize refinement

- The Windows Agent uses a compact custom top chrome with product title and a single minimize action; no normal close/X action is rendered.
- Manual minimize remains on the Windows taskbar. Auto-start may remain tray-hidden.
- The overlay is a compact two-row panel: Laptop metrics first and Agent operational counters second.
- Locked overlay remains true click-through; unlocked overlay remains draggable.
- An initialization error must not permanently gray out overlay settings; the settings action remains available for retry.
- Laptop metrics are local/coarse. GPU sampling is less frequent than the normal local status tick and no provider-usage monitoring loop is introduced.

## D088 — unified product naming, tools entry, tray lifecycle and configurable overlay

Product-facing names are:
- Web: **Website nghiệp vụ Inventory**.
- Android Beta: **1291 Beta**.
- Windows utility: **Agent Auto Confirm Pick Pack**.

The selected D088 icon motif is shared across Web, Android launcher and Windows Agent: dark navy base, cyan/blue upper transfer arrow with scanner, green lower transfer arrow with warehouse/boxes. Platform-native rendering may simplify geometry but must keep the same recognizable motif.

Admin/Root Web adds **HỆ THỐNG → Công cụ**. The first tool card is Agent Auto Confirm Pick Pack and provides its current Beta version, Windows/user-level requirements, direct official GitHub download and concise operating instructions. The tools page is an operational surface; it must not re-enable the quota-heavy system-status polling removed by D072.

Agent main-window minimize is **tray-only**: minimize hides the window from the Windows taskbar while the process remains visible in System Tray; tray restore returns the normal window. The titlebar still has no close/X action and protected shutdown remains unchanged.

Overlay behavior:
- locked: true cross-process click-through/no-activate;
- unlocked: draggable and resizable from edges/corners;
- settings expose numeric width/height plus full Windows color selection for background and text, in addition to opacity/lock;
- position, size, colors, opacity, visibility and lock are local non-secret persisted settings.

## D089 field-review repair

### Shared identity asset
- The exact Owner-selected icon #4 image is the canonical visual source.
- Outer canvas is square, opaque, full-bleed dark navy with no artificial rounded outer container.
- The internal motif is the selected PDA/scanner ↔ warehouse/boxes exchange graphic.
- Web favicon and Tools icon, Android launcher icon and Windows EXE/taskbar/System Tray icon must derive from the same committed asset.
- Placeholder arrows, generic application icons and hand-redrawn approximations are forbidden.

### Web service status
Header status separates **Dịch vụ** from **Đồng bộ**. HTTP/API reachability and realtime transport are independent visible states.

### Tools dark theme
`HỆ THỐNG → Công cụ` must use the same dark surfaces, borders, muted text, action buttons and contrast rules as the rest of the accepted dark Web shell. No light fact cards remain in dark mode.

### Agent overlay
Unlocked overlay retains drag/resize and complete background/text color selection. Settings include a master visibility switch and granular Laptop/Agent display controls; locked overlay stays true click-through.


### D089 released visual checkpoint

- The exact approved icon #4 is committed as a verified PNG binary and shared by Web favicon/Tools, Android launcher and Windows Agent icon generation.
- Main UI Design Guard run `35528647554` PASS on source `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Signed Android `beta-vc54` and Windows `relay-agent-v15` are the released D089 visual targets for Owner field comparison.
- Tools dark-theme completion and separate `Dịch vụ` / `Đồng bộ` header states are technically released; final physical/visual acceptance remains Owner field-dependent.


### D089 Owner visual acceptance — PASS

Owner accepted the D089 visual/runtime presentation on 2026-09-21. The approved icon #4, Web Service/Sync status presentation, Tools dark-theme completion, and Agent Overlay configuration are the current accepted Beta UI baseline. Future changes must preserve these behaviors unless superseded by a later explicit Owner requirement.


## D098 — Agent information architecture

Agent keeps the D089 approved visual baseline and shared branding but restructures content:

- `Tổng quan`: Hệ thống Supra; Xác minh Agent; Xử lý PickList trực tiếp tại bàn chuyên viên.
- Remove the old `Mô hình hiện tại` explanatory card.
- Agent login is part of the Xác minh Agent Overview region, not a Settings page.
- `Cài đặt` direct tabs:
  - Kết nối
  - Bảng nổi
  - Nhật ký vận hành
  - Chẩn đoán kỹ thuật
- Bảng nổi controls are embedded directly in the tab; users must not need a second “open settings” action merely to reach them.
- Operational and technical logs are peer tabs, not nested under an intermediate Logs tab.
- Existing Overlay persistence, true locked click-through, color/size/checklist controls and single-instance/tray behavior remain frozen.


## D099 — Agent auth hierarchy and Overlay sizing

Agent Overview visually establishes authority in this order: **Xác minh Agent first**, then **Hệ thống Supra**, then specialist PickList handling. Supra appears disabled while Agent auth is unavailable; this is a functional disabled state, not merely explanatory copy.

Overlay sizing must not retain the old 420×64 floor. Settings and runtime clamp must agree on 120×32 practical minimum and 7680×4320 configurable maximum. Existing colors, opacity, persistence, lock/click-through and per-field visibility remain unchanged.


## D100 — System Reset presentation

- ROOT-only System Reset is a first-class `HỆ THỐNG` child beside Nhật ký and Công cụ.
- Use the existing light/dark design tokens, cards, notices and danger-button hierarchy.
- Every destructive group must show a plain-language scope description and current count where available.
- High-risk groups (Admin, active reports/history, confirmation relay) receive warning/danger visual treatment without introducing a separate visual style.
- The two-factor panel is visually separated from scope selection.
- Never hide the preserved-resource statement: ROOT and external Google Sheet/Drive are not reset.
- Web Tools Agent version/download metadata is generated from `relay-agent/VERSION`; user-visible historical hard-coded Agent versions are forbidden.

## D101 — Agent v26 layout and status presentation

- Remove the top-level `Cài đặt` tab. Agent top-level tabs are: **Hệ thống Agent**, **Hệ thống Supra**, **Xử lý PickList**, **Kết nối**, **Bảng nổi**, **Nhật ký vận hành**, **Chẩn đoán kỹ thuật**.
- Rename the former `Xác minh Agent` region to **Hệ thống Agent**. It shows authentication, machine, Wi-Fi SSID, current PRIMARY/STANDBY/FROZEN role, fleet role counts, Firestore state, version and auto-update state.
- `Hệ thống Supra` shows HY1, Supra API host, WMS session readiness, current PickList cache count and last cache time. Supra controls remain disabled until Agent ADMIN auth is valid.
- Direct PickList search renders a row per full PickListCode with its own **Xác nhận** button. There is no detached shared confirmation button.
- Logout requires a Yes/No confirmation dialog before local Agent/Supra sessions are cleared.
- The Agent preserves the approved D089 icon, tray-only minimize, protected shutdown and Overlay behavior.
## D102 — Agent v27 Overview correction

- Top-level tabs are **Tổng quan / Kết nối / Bảng nổi / Nhật ký vận hành / Chẩn đoán kỹ thuật**.
- **Tổng quan** contains three stacked operational sections: **Hệ thống Agent**, **Hệ thống Supra**, **Xử lý PickList**. Do not split these three sections into separate top-level tabs.
- Hệ thống Agent includes login/state, real SSID, current role, fleet summary, compact per-Agent table, software update state and a **Kiểm tra cập nhật** button.
- Fleet table columns are limited to operational basics: account, machine, PRIMARY/STANDBY/FROZEN role, Supra readiness, Agent version and last-seen age. Do not synchronize remote hardware telemetry.
- The 21:30 decision banner appears only when a decision is required. It offers **Tiếp tục sau 22:00** and **Ngừng từ 22:00**. Tray warnings repeat every 5 minutes until a decision.
- Remove user-facing copy such as “cho AI”, Owner/AI handoff wording, D-number explanations and long internal-model guidance. Technical details remain in sanitized logs where appropriate.

## D103 — Agent v28 dense Overview

- Agent launches and restores from tray in maximized state.
- Tổng quan uses a non-scrolling three-row layout: Hệ thống Agent fixed/bounded, Hệ thống Supra compact fixed/bounded, Xử lý PickList consumes the remaining height.
- The Overview must keep PickList search/results visible in the initial maximized viewport on a normal company laptop; the user should not need to scroll the page to reach PickList.
- Agent fleet DataGridView is height-bounded to five visible Agent rows plus header. More Agents use the grid's own vertical scrollbar.
- Hệ thống Agent keeps login/logout/manual update, compact identity/relay/Wi-Fi state, fleet summary and fleet table. Do not show persistent prose explaining Agent version, Firestore internals, failover timing or background-update cadence.
- Hệ thống Supra keeps only compact operational status plus required buttons. Do not show explanatory prose about DPAPI/local WMS protection or cache-refresh implementation.
- PickList results use a full-width table whose rightmost fixed-width action column contains Xác nhận on every result row.
- Status copy is concise: result counts/errors/actions only. Internal AI/Owner/D-number/handoff wording remains forbidden.

## D104 — Taskbar-safe maximum and PickList bulk action

- Use the active `Screen.WorkingArea` as the Agent maximized bounds so Windows taskbar space is respected on launch and tray restore.
- Keep D103 dense non-scrolling Overview unchanged.
- Expand the PickList search input enough for comma-separated values without expanding the card height.
- Place **Tìm kiếm** and the conditional **Xác nhận tất cả** on the same action row. Do not remove the row-level Xác nhận buttons.
- Hide **Xác nhận tất cả** unless at least two result rows are visible. More results continue to scroll inside the existing result grid.
- Keep status copy concise: search result count, missing-term count and batch confirmation counts only.

## D105 — Picker confirmation emphasis

- The confirmation action visibly dims whenever it is unavailable, especially while a request is waiting for Agent/WMS result.
- Terminal result copy is substantially more prominent than helper text: bold, larger size and semantic success/error color.
- Helper input/progress text must not visually compete with the returned business result.
- Picker instructions and hint use 4 digits. Agent manual specialist copy uses 3–4 digits.
## D107 — Professional Web presentation refinement

D107 is the Owner-authorized Web visual refinement over the accepted D089 baseline.

- Login uses the exact shared D089 icon asset and a two-line identity lockup: `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` then `Website nghiệp vụ Inventory`. Do not render the old numeric `1291` brand tile or `Web nghiệp vụ / Đăng nhập bằng tài khoản Báo hàng 1291` copy.
- Preserve the D066 three-group navigation, D068 optimistic navigation/history/toasts, D069 scoped rendering, D071 density controls and all current role/RBAC behavior.
- The final Web visual layer applies coherent hierarchy across login, topbar/sidebar, workspaces, filters, cards, tables, dialogs and support surfaces. Use restrained corporate blue/neutral surfaces, semantic green/amber/red only for business state, small-radius geometry, subtle borders/shadows and local/system fonts.
- Desktop information density is deliberate: important values are visually strong, explanatory text is secondary, tables use sticky headings where useful, and dashboard/report panels use available width without turning into an ornamental BI wall.
- Dark mode is a first-class presentation, not an inversion afterthought. No bright light-only panels, controls or report fragments may remain.
- Admin/Root reporting receives a richer but still operational composition: current-status KPI strip, period metrics, role-online distribution, outcome mix, recurrence, time trend and top-SKU drill-down. Detailed reporting exposes richer summary/attention panels before the bounded result table.
- New visual reporting must reuse existing authoritative API data. No presentation element may imply an unavailable stock quantity/location, employee score, provider billing status or other unapproved metric.
- Responsive layouts may reduce columns and allow horizontal report-table scrolling, but must retain readable business hierarchy and touch-safe actions.
- Android and Windows Agent presentation are unchanged by D107. Stable remains OWNER-GATED.

## D108 — Dense Picker shortage UI and Web recovery/result clarity

### Web

- Password recovery detail is a true disclosure surface: `.login-reset-form[hidden]` must remain `display:none` until **Lấy lại mật khẩu** is pressed.
- Result tables use two distinct audit concepts: **Nguồn xử lý** and **Người xử lý**. `SYSTEM_TIMEOUT` uses a clear automatic-timeout treatment; `REPORTER` / `REPORTER_CORRECTION` use a human-resolution treatment.
- Automatic timeout must not be visually merged into a generic Skip total where a source breakdown is available.

### Picker Android

- Shortage search/action is one compact row: numeric SKU input (minimum three digits for suggestions) + **Xác nhận** action.
- Do not show the redundant **Quét hoặc nhập SKU** heading.
- A selected SKU gets a distinct selected surface; suggestion dropdown closes after selection and stays closed until the SKU input is edited away from that selected value.
- Disabled/unready **Xác nhận** is visibly dimmed; valid selected SKU + existing online/mutation readiness uses full emphasis.
- Picker history heading is **Danh sách SKU đã báo hết hàng**.
- History status surfaces: light green = Đã có hàng; light yellow = Đang xử lý; light red = Được phép bỏ qua; light grey = Picker thu hồi.
- Automatic-Skip deadline time is not shown to Picker. Completed automatic results may say **Hệ thống tự động do quá hạn** without showing the configured clock/deadline.
- A− / A+ controls sit beside Log for Picker only. The scale preference is bounded 80–140%, stored locally per user id, and restored on later login on the same device. It scales Picker text and primary input/action control height without changing business data.
- Keep both bottom Picker business tabs and D105 four-digit confirmation UX unchanged.

## D109 Web audit/PDA tools and Android compact tabs

### Web
- `Nhật ký` uses separate tabs for Web logs, Android logs and **Lịch sử thao tác**. The audit surface is a dense bounded table, not raw JSON.
- `Công cụ` includes a professional **App PDA** card with current release metadata, a QR code and a stable same-origin download URL. The QR/link must resolve dynamically to the latest published Beta APK and must not hard-code a `beta-vcN` version.
- The App PDA card follows the existing light/dark professional visual system and remains responsive on narrow screens.

### Android Picker
- The top header is compact (`wrap_content` with a small minimum height) and long identity copy may auto-size/wrap instead of forcing the old fixed 76dp header.
- Picker header display controls are ordered **A−, A+, Log, Thoát** so size controls are adjacent.
- `Báo hết hàng` / `Xác nhận đơn` are a compact bottom tab bar with selected underline/surface treatment, not primary/secondary action buttons.
- The soft keyboard must not resize/push the bottom tab bar into the content area; the activity uses a stationary layout policy for IME display.
- Shortage history uses time-only operational labels: `Báo hết lúc: HH:mm`, `Invent phản hồi lúc: HH:mm`; no date is shown in those lines.
- D108 numeric input, semantic status cards and per-user 80–140% Picker scale remain authoritative.

## D110 Android Reporter visual baseline

- Reporter uses the D109 compact Android shell. The four-tab strip is pinned immediately under the identity/header and uses the same restrained selected-tab language as Picker.
- Every Reporter tab carries a small red/white count badge at the top-right. Badge size must not expand the tab height.
- Pending cards: normal white; warning light yellow; overdue light red. Use readable dark semantic text/borders rather than saturated card fills.
- Primary actions sit immediately under the SKU: **Đã có hàng** uses success treatment; **Cho phép skip** uses danger/exception treatment. Both remain touch-safe and visually disable only while that batch is submitting.
- Login, launcher/header and shared operational brand surfaces use the canonical committed App icon; do not mix the legacy alert glyph into product identity.
- Login footer copy is **Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291**.

## D111 Android daily compact workflow

D111 supersedes only the conflicting D110 Reporter interaction/presentation details.

1. Reporter A−/A+ is visible beside the shared header controls, persists locally per authenticated Reporter, is bounded to 80–140%, and preserves the active Reporter tab when applied.
2. Four Reporter tabs remain pinned. Pending badge = red background + white text. The other three badges = light neutral grey background + dark text.
3. Badges are the sole tab-count presentation. Remove the summary line below tabs and do not render empty-state count/explanation cards.
4. Recent/result cards do not repeat the state already named by their tab and do not show affected-Picker/acknowledgement totals. Show report time and Invent response time where applicable.
5. **Đã có hàng** and **Cho phép skip** remain directly accessible below the pending SKU but now open a concise confirmation dialog before mutation.
6. SLA background semantics, calibrated minute ticker, canonical icon/footer, compact header, and D109 Picker bottom-tab behavior remain unchanged.

## D112 — Tools, Android safe areas and Agent window/overlay

- Web Tools uses two balanced operator cards only: App PDA and Agent Windows, plus one concise install guide. Version/platform/size/release/channel and primary download/copy actions are the visible information hierarchy.
- Date/log-range active controls use the accepted semantic brand emphasis and remain readable in light/dark themes.
- Android root surfaces respect runtime status/navigation/display-cutout insets rather than fixed device-specific top padding.
- Android password fields expose an explicit show/hide control while defaulting hidden. The developer line remains one line with bounded auto-size.
- Android confirmation action text remains one line/readable independently of the user A−/A+ content scale.
- Agent is a normal resizable Windows application with standard Minimize/Restore/Maximize controls. Protected exit is a post-auth business guard, not a replacement for normal window chrome.
- Agent overlay is split conceptually into **Vận hành** and **Tải Agent & cụm**. It prioritizes role/Firestore/WMS/version/business state, Agent process CPU/RAM/uptime, pending/result counters and bounded fleet role counts/update time.

## D113 — Cross-surface reference refinement

- Web login uses the shared project SUPRA icon and a centered identity lockup above a focused sign-in card. Primary identity is **CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN** with **Website nghiệp vụ Inventory** as secondary copy. All visible sign-in copy is Vietnamese.
- Login controls include a clear password visibility action and **Lưu thông tin đăng nhập**. Password persistence belongs to the browser credential manager only; the Web application never stores plaintext passwords.
- The **Xử lý báo hàng** navigation item may carry a red/white, compact, capped-count badge aligned to the right of the label. It communicates the current pending queue count and must not duplicate internal implementation state.
- SLA cards place the enable control in each threshold card and keep policy controls in a separate compact section. Skip-correction control states explicitly that its window is counted from the first shortage report.
- Web Tools uses balanced App PDA and Agent Windows cards, consistent fact cells, primary/secondary actions, QR block and restrained borders/shadows in both light and dark modes.
- Android Picker does not render an empty selected-SKU placeholder card. A−, A+, **100%**, Log and Thoát stay compact and touch-safe; action text auto-sizes rather than clipping.
- Android Reporter action buttons appear after product/time metadata. Result metadata keeps the responder identity on the response-time line where available.
- Agent adds a visible **Chuyển xuống nền** control without replacing native Windows window controls.

## D116 — Result persistence and admin workspace refinement

- Android **Xác nhận đơn** keeps the terminal result visible after a successful request even though the input is cleared for the next entry. The initial empty-input hint must not overwrite CONFIRMED/terminal feedback.
- Web operations shows **Picker ảnh hưởng** immediately for the selected SKU using the already-prefetched batch detail. The redundant reveal/hide action is removed for that selected detail panel.
- **Danh mục SKU** uses the same professional hierarchy as other management workspaces: summary cards, current-data search/table, then controlled Excel update/conflict handling.
- **Nhân sự & tài khoản** uses a clear custom Picker selection control. Non-Picker rows show protected/not-applicable state rather than misleading checked/disabled boxes.
- All-Picker mode keeps individual Picker controls interactive so exclusions are understandable before a destructive action. Selection status states whether all Picker or all-except-N are targeted.
- Light/dark themes and narrow-screen layouts must remain coherent; no internal AI/Owner implementation copy is exposed to operators.

## D118 — SLA, pagination, Agent footer and Android IME

- SLA page must visibly state that configuration is whole-system/server-authoritative, show revision/update metadata, and group controls as ordered thresholds plus policy cards. It must not render substitute threshold values while loading.
- Pagination controls use one consistent `Hiển thị X–Y / Tổng` + `Trang trước / Trang sau` pattern where total-count pagination exists; token-paged logs show page number with the same navigation actions.
- Agent bottom-right product credit is muted secondary text: `Phát triển hệ thống · tamnv2 | Pick Pack 1291`.
- Android Picker tabs are persistent navigation controls below the weighted operation content. MainActivity must use `adjustResize` so the IME reduces content height rather than covering these tabs.

## D119 — Dense Windows Agent operational layout

- Authenticated Agent overview hides login inputs and uses standard Windows minimize/maximize/close chrome rather than duplicate window-control buttons inside content.
- Layout is responsive to the current working-area/window size and prioritizes dense operational information over explanatory prose.
- Agent fleet shows at most five visible rows before internal vertical scrolling.
- Supra status uses a reduced-height compact strip/card.
- PickList results show at most five visible rows before internal vertical scrolling.
- Online Picker list uses compact rows sized to show materially more users than card-style layouts; buttons must not expand row height unnecessarily.
- Picker list contains only currently operational Android/PDA users under the D119 presence definition.
- Visible Vietnamese copy uses full Unicode/diacritics and the established product terminology.

## D120 — Agent two-pane workspace, metric tiles and Web SLA/viewport repair

### Windows Agent
- Overview is a responsive two-column workspace: Agent/fleet, Supra and PickList on the left; online-Picker tools on the right.
- Online Picker rows show **Mã nhân viên**, full name, PDA state and the approved specialist/Pack/close actions. Search matches employee code or full name. Data refresh preserves the visible scroll anchor instead of returning to row 1.
- Hovering any cell or action in a Picker row highlights the whole row. Refresh must not clear the user's search text or create scroll jitter.
- Authenticated Agent keeps **Đăng xuất** and **Chuyển xuống nền** visible. The redundant normal-surface `PRIMARY / STANDBY / FROZEN` cluster summary is removed; HA state remains available to the runtime/diagnostics where required.
- Supra shows the current captured company user where available and exposes protected **Đăng xuất Supra** beside normal login/test controls.
- Overlay renders selected metrics as independent compact tiles. Tile groups/settings use **Trạng thái hệ thống** and **Hiệu năng & lưu lượng**; lock/click-through, color, opacity, size and persisted visibility remain unchanged.

### Android
- The canonical `overlay_alert` red/blue business-result surface is reused for cross-app Picker results. A separate generic full-screen result card is forbidden.
- A valid saved session uses a neutral restore surface while update/profile validation completes. The login form is rendered only when no usable session remains.

### Web
- SLA radio/checkbox geometry is native-sized and compact; selected state is visually explicit and the current server value is shown in text.
- SLA secondary statistics update must not rebuild the editable policy form.
- Pages use dynamic viewport height where supported and reserve bottom scrolling space so the last controls remain reachable above browser/OS chrome.

### D120 hotfix — Picker grid rendering stability

- A one-second operational timer must never clear/re-add Picker rows when authentication/layout state is unchanged.
- The Picker DataGridView is double-buffered and skips no-op redraws when search text, visible Picker data and command state are unchanged.
- Real data changes may update rows, but the current search text, scroll anchor and selected row are retained where the row still exists.
- An empty result is shown only when the authoritative online projection is actually empty; no alternating empty/non-empty placeholder is permitted.
