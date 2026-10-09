# Owner Decision Ledger — SUPRA Inventory

Purpose: preserve Owner-approved requirements across chats without relying on manual end-of-session handovers. This file records durable Owner decisions and unresolved items. It contains no secrets.

## Authority and maintenance

- Latest explicit Owner command overrides older entries.
- When a newer Owner decision replaces an older one, mark the old entry `SUPERSEDED`; do not silently delete history.
- Implementation progress belongs in `ops/project-state.json` and `ops/resource-registry.json`; this ledger is for requirement/decision authority.
- Chat/project memory can help retrieve context but is not the canonical technical authority.

## Accepted decisions

| ID | Status | Decision |
|---|---|---|
| D001 | ACTIVE | Project is `SUPRA Inventory — Báo hàng` / `supra-inventory`, canonical repo `tamnv2/supra-inventory`. Do not mix with Pick Pack 1291, Pickface Damage, SupraCore, VHDCHY or other projects. |
| D002 | ACTIVE | Inventory scope is SKU + product name only. Do not manage bin/location/pickface position. |
| D003 | ACTIVE | Roles are `PICKER`, `REPORTER`, `ADMIN`, `ROOT`. Admin/Root inherit Reporter workflow capability; Root is highest application role. |
| D004 | ACTIVE | Picker identity is based on provisioned Mã nhân viên/username. Client role is never trusted; service is authoritative for identity, role and state transitions. |
| D005 | ACTIVE | Unresolved duplicate rule is Picker + SKU. A retry/multiple press must not create another open report for the same Picker + SKU. |
| D006 | ACTIVE | Multiple Pickers reporting the same SKU are grouped into one processing batch, while each Picker retains a separate report ticket. |
| D007 | ACTIVE | Reporter queue priority remains deterministic: more currently affected Pickers first; if equal, earlier first report first. SLA adds warning/escalation visibility but does not silently replace this ordering without a later explicit formula. |
| D008 | ACTIVE | Picker can withdraw a mistaken report within 60 seconds only while unresolved. Deadline uses server time. |
| D009 | ACTIVE | Reporter resolution values are `HAS_STOCK` and `SKIP_ALLOWED`. `SKIP_ALLOWED` may be corrected to `HAS_STOCK` within 5 minutes; deadline uses server time. |
| D010 | ACTIVE | `report ticket`, `processing batch`, and lifecycle/audit `event` are separate semantics and records. Reporting must not merge them. |
| D011 | ACTIVE | Operational authority is Cloudflare Worker + `InventoryCore` SQLite. Google Sheets/Drive are source/archive/supporting systems, not a competing primary transaction store. |
| D012 | ACTIVE | Foreground realtime uses WebSocket; background delivery uses FCM. Reconnect must resync from authoritative server state; page reload is not synchronization logic. |
| D013 | SUPERSEDED | Earlier HR source rule required Google Sheet URL + exact tab and recognized MNV/Họ tên headers. Superseded by D033: column mapping is now user-configurable. |
| D014 | ACTIVE | Detailed operational retention target is about 60 days. Pending/unresolved survives retention until handled. Long-term archive/export is batched to Google Drive/Sheets; do not hot-write every event to Google. |
| D015 | ACTIVE | Beta and Stable are isolated runtime/data/credential environments. Stable never receives Beta runtime data by default. Stable remains Owner-gated until explicit release command and Owner acceptance. |
| D016 | ACTIVE | GitHub repo is Public for this project. Secrets/private keys/passwords/tokens/signing material must never be committed or exposed in repo/chat/logs. |
| D017 | ACTIVE | Finite jobs must continue automatically: trigger → poll → inspect logs → repair within scope → rerun → poll until PASS or a real Owner-only blocker/hard tool limit. Do not stop merely to ask Owner to send “tiếp tục”. |
| D018 | ACTIVE | Final network scope: Picker/Reporter use PDA on the PDA network with Internet. Admin/Root Website requires a network that can reach project services. Office network is unsupported because IT filters required runtime endpoints. Do not continue provider/fallback research unless Owner reopens the requirement. |
| D019 | ACTIVE | Stable may have source/config prepared, but no first deploy/provision, public traffic, real-user bootstrap, Stable refresh-token activation, Stable APK release, or promotion without explicit Owner command. |
| D020 | ACTIVE | Manual end-of-chat handover files are no longer the continuity mechanism. Repo-native project state + decision ledger + resource registry are canonical; `HANDOVER_CURRENT.md` is only a generated/readable view. |
| D021 | ACTIVE | SKU Excel import must support normal operational files in the 10,000–50,000 row range. Do not reject a file merely because it exceeds 5,000 rows. Import must preserve the agreed rules: extract only SKU + product name, merge repeated identical SKU/name rows, require an explicit choice when one SKU has multiple names in the same file, keep old SKUs that are absent from a new file, and require Admin/Root confirmation before changing the product name of an existing SKU. Large imports must use bounded chunks/idempotent retries rather than one oversized request. |
| D022 | ACTIVE | Web and Android/PDA must be built as usable role-specific business products according to the approved Picker/Reporter/Admin/Root workflows. Login/settings-only or diagnostic skeleton screens are not acceptable as the finished UI. Web must expose the management/operating functions allowed to Admin/Root, while PDA must expose the operational Picker/Reporter flows with Admin/Root inheriting Reporter capability where applicable. |
| D023 | SUPERSEDED | Earlier account hierarchy was ROOT→ADMIN, ADMIN→REPORTER, HR→PICKER with missing Picker automatically disabled and managed accounts reset to a shared bootstrap default. Superseded by D034, D035 and D037. |
| D024 | SUPERSEDED | Earlier unified visual direction was Concept 3. Superseded by D036, later superseded again by D044. |
| D025 | ACTIVE | Admin/Root Web uses an operational dashboard and detailed reporting flow. Dashboard is a compact decision overview with one shared date filter, core KPI cards, report/resolution trend, outcome breakdown, and top reported SKUs; detail is drilled into the Reporting view. Reporting supports date/status/SKU filters, pagination and explicit chunked CSV export. Do not add unapproved stock quantity/location metrics or individual employee performance scoring. Avoid aggressive polling/auto-refresh; authoritative realtime invalidation/delta and explicit refresh remain preferred to protect runtime quota. |
| D026 | ACTIVE | Quota/resilience design must assume the no-auto-upgrade/free-envelope worst case unless live entitlement proves otherwise. Admin reporting uses bounded indexed time-range queries; PDA SKU cache must use delta-first synchronization so a Master SKU version change does not force every PDA to reload a 10k–50k catalog. Full catalog fetch is bootstrap/fallback only. Live stress tests must be non-destructive unless an isolated test workload is explicitly available. |
| D027 | ACTIVE | GitHub is the durable project memory for SUPRA Inventory. New AI sessions must bootstrap from repo-native context/state/decision/spec/resource files before mutation; chat memory and old handovers are non-canonical retrieval aids only. |
| D028 | ACTIVE | All Owner-approved project scope, forms, design rules, business logic and scenarios must be captured in the canonical GitHub decision/spec structure in the same workstream. Superseded rules remain historically marked rather than silently deleted. |
| D029 | ACTIVE | Live work continuity is maintained in `ops/project-state.json`: meaningful implementation work records current status, completed work, pending/field work and next action in the same change set. Generated handover/readiness views are derived only and CI must detect stale key markers. |
| D030 | ACTIVE | Automation-first operating rule: use connected tools/CI for setup/build/deploy/verification wherever safely possible. If Owner action is genuinely required, give the shortest official UI path, batch setup/permissions where possible, avoid local installs/CLI unless necessary, then automatically recheck after Owner action. |
| D031 | ACTIVE | Public-repo security is fail-closed for secret values. New operational metadata exposure must be minimized: prefer aliases and runtime variables/secrets when practical; exact non-secret IDs are public only when needed for reproducible automation. Existing IDs already in public Git history are not made private by deleting them from HEAD. |
| D032 | ACTIVE | Canonical project/resource scope is `ops/project-scope.json`. Every in-scope external resource must be identified by exact known canonical ID where appropriate, otherwise canonical name plus ID source. Unlisted resources are fail-closed/out-of-scope until reconciled and Owner-approved; Stable entries remain Owner-gated. |
| D033 | ACTIVE | HR source mapping is user-configurable. Admin/Root supplies Google Sheet URL, exact tab name, the source column to use as `Mã nhân viên`, and the source column to use as `Họ và tên`; backend validates those configured headers before saving. Product logic must not require literal headers such as `MNV` or `Họ tên`. |
| D034 | ACTIVE | ROOT inherits all ADMIN + REPORTER capabilities and additionally may create/manage both ADMIN and REPORTER accounts and manage Picker lifecycle. ADMIN may create/manage REPORTER and manage Picker lifecycle. ROOT remains protected from subordinate management. |
| D035 | ACTIVE | Managed ADMIN/REPORTER account creation and maintenance use an explicit password chosen/set directly by the authorized manager; remove the reset-to-default flow. Only newly provisioned PICKER accounts use the Owner-defined default password through a protected runtime secret. No plaintext password may be committed/logged. A manager-set password change invalidates the target's prior session authority. |
| D036 | SUPERSEDED | Practical Balanced / Phương án 1 was the active unified visual direction. Superseded by D044 `Legacy Operational UI V2` after Owner approved rebaselining Web + Android from the prior Báo hàng 1291 operational product. |
| D037 | ACTIVE | HR synchronization no longer auto-disables/deletes Picker accounts absent from a newly configured source and no longer auto-reactivates a Picker deliberately disabled by Admin/Root. After provisioning, Admin/Root controls Picker lifecycle explicitly: select one, many or all Picker accounts and `Mở lại`, `Ngừng hoạt động`, or `Xóa Picker`. Deleting a Picker account must not erase historical report/audit records. |
| D038 | ACTIVE | Newly provisioned PICKER accounts use the Owner-confirmed protected runtime default password. Existing legacy PICKER accounts that have no initialized password must lazily initialize from the same protected Picker default at first login rather than failing with `PASSWORD_NOT_INITIALIZED`. The plaintext default is runtime-secret material and must not be stored in this public repo. |
| D039 | ACTIVE | Android/PDA Beta uses a mandatory latest-version gate before login. The app checks the canonical signed `beta-vcN` release; if installed `versionCode` is lower, login stays disabled while the app automatically detects/downloads/verifies the APK and opens Android package installation. If release state cannot be verified, login fails closed until verification succeeds. |
| D040 | ACTIVE | Android/PDA UI must be narrow-screen-first, consistently aligned and operationally concise. Remove long version metadata competing with the product title, remove AI/design-discussion/explanatory prose that is not needed for the current task, use an adaptive launcher icon whose green brand color fills the launcher mask without an extra white wrapper, and use footer `Phát triển bởi: tamnv2 - Chuyên viên Pick Pack 1291`. |
| D041 | ACTIVE | Android/PDA must implement the approved narrow-screen layout, labels, footer and mandatory update gate directly in the primary activity/view source. Do not use an Application-level/post-layout tree rewriter to hide, rename or restyle business UI after rendering. |
| D042 | SUPERSEDED | Earlier Android layout required one horizontal SKU-entry + `BÁO HẾT HÀNG` and a specific Practical Balanced Reporter composition. Superseded by D045–D047 under `Legacy Operational UI V2`. Business rules in that decision remain governed by D005–D009. |
| D043 | ACTIVE | **No offline mode exists in this product.** Business operations require online authoritative service access. Do not implement offline report creation, durable offline mutation outbox, fake offline success, direct-to-Sheet fallback, alternate offline primary/secondary transaction path, or offline Reporter/Admin mutation mode. |
| D044 | SUPERSEDED | Earlier rule treated the prior Báo hàng 1291 product as a business/UX reference to be reimplemented cleanly. Superseded by D057 because this wording allowed visual reinterpretation and produced a non-parity shell. |
| D045 | ACTIVE | Picker PDA uses vertical operational composition: compact header/tools, large SKU input, prominent selected SKU + product name block, full-width `BÁO HẾT HÀNG`, then today history/status cards. Do not compress SKU input and the primary report action into one narrow row. Existing server dedupe, batch grouping and 60-second withdrawal remain authoritative. |
| D046 | ACTIVE | Reporter PDA keeps the four business-state filters `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`, but pending cards prioritize SKU/product, affected Picker count, first-report/waiting/SLA context and two large actions. Picker detail expands without shrinking the primary actions. Skip uses an explicit impact confirmation. |
| D047 | ACTIVE | ADMIN/ROOT on PDA must have a concise operational launcher/menu and must not be rendered as only Reporter. It groups role-allowed entries under Vận hành / Quản trị / Hệ thống; deep HR/Master SKU/reporting administration remains Web-first. |
| D048 | ACTIVE | Foreground realtime is upgraded from refresh-style invalidation to monotonic event sequence + bounded delta recovery. Realtime frames carry sequence/event/scopes plus batch/version identity where relevant. Clients patch affected operational state, detect sequence gaps, fetch deltas after `last_seq`, and use full authoritative reconcile only as fallback. Database remains transaction authority. |
| D049 | ACTIVE | Critical Picker results `HAS_STOCK` and `SKIP_ALLOWED` require explicit user acknowledgement tracked by target Picker + notification event + batch/version. Delivery lifecycle distinguishes server event/attempt, client received, displayed and acknowledged. ACK is idempotent and audit/telemetry only; notification failure never rolls back a committed business resolution. |
| D050 | SUPERSEDED | Earlier SLA rule allowed warning/escalation only and prohibited automatic Skip. Superseded by D070, which retains server-authoritative warning/escalation and D007 ordering but explicitly allows configured timeout-based `SKIP_ALLOWED`. |
| D051 | ACTIVE | Resolved shortage episodes are immutable. A later report for the same SKU creates a new processing batch episode linked through `previous_batch_id`; recurrence context may show prior resolution time/elapsed interval. Do not reopen/mutate an old finalized batch as the new episode. |
| D052 | ACTIVE | Product support diagnostics are redacted and bounded. They may include app/build/device/platform, network/service reachability, realtime state/last sequence, catalog version and recent errors, but never passwords, session/access/refresh tokens, Firebase/Google credentials, signing material, private keys or other secrets. |
| D053 | ACTIVE | `CHO SKIP HÀNG` is a deliberate two-step business action: first tap opens a confirmation that names the SKU/product and affected Picker count; second explicit confirmation commits. No password/OTP is required for normal Reporter Skip. |
| D054 | ACTIVE | Web information architecture is operational-first. Reporter opens/focuses on the dense live queue. Admin/Root group functions into Vận hành, Dữ liệu, Quản trị, Báo cáo and Hệ thống. Dashboard/reporting remains available but must not displace the live Reporter queue. |
| D055 | ACTIVE | Android mandatory-update hardening retains versionCode + APK SHA-256 verification and should additionally verify canonical package/signing identity where supported by the current release pipeline. This hardening must not weaken Android installation security or require legacy updater architecture. |
| D056 | ACTIVE | **UI-first rebuild order is mandatory.** Complete and obtain Owner acceptance for the Web + Android/PDA visual shell before rebuilding/wiring the approved logic, scenarios and business rules. The implementation method for this UI phase is governed by D057. |
| D057 | ACTIVE | **Direct legacy presentation transplant is the visual authority.** For the UI-first phase, `tam95supra-source/bao-hang-1291` plus Owner-provided screenshots of the running old product are the visual/layout source-of-truth. Web must transplant the old presentation shell and presentation modules (topbar, status chips, role-test strip where applicable, left sidebar/navigation, workspace composition, component density, tables/cards, responsive behavior) rather than reinterpret them. Android/PDA must transplant the old native XML/drawable/color/style/layout structure rather than recreate equivalent geometry programmatically. Legacy backend/provider/auth/storage/credential code is forbidden; only presentation resources/structure may be copied and then bound to the current architecture. Any visual divergence requires explicit Owner approval. CI/build success is never UI acceptance. |
| D058 | ACTIVE | **Owner Web review overrides literal legacy shell geometry where explicitly stated.** For the Web review candidate: remove the `Kiểm thử giao diện + quyền server` strip until Owner explicitly reintroduces it; keep the top shell and Admin/Root left navigation pinned on desktop so only the central workspace scrolls; use the full remaining browser workspace instead of centering page content inside fixed `max-width` dead space; visible copy must be operationally necessary and must not expose AI/Owner discussion, design rationale, backend/implementation commentary or internal technical explanations; show the small fixed bottom-right credit `Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291`. Android/APK visual review is pending and is not changed by this Web-only decision. |
| D059 | ACTIVE | **Owner Web header/identity refinement.** Replace the legacy `BÁO HÀNG 1291 / Web nghiệp vụ` + status-chip cluster with a compact corporate header: `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN`, `Website nghiệp vụ Inventory 1291`, and one runtime line `Service: Cloudflare ON/OFF | Cập nhật: HH:mm MM/DD/YYYY`. `Cập nhật` represents the latest time this Web client received authoritative operational/service information, including realtime business events. Header identity must display `Tên`, `User`, and mapped permission label; visible permission labels are `Quản trị hệ thống` for ADMIN/ROOT, `Người báo hàng` for REPORTER, and `Người lấy hàng` for PICKER. Remove the topbar password-change action; keep only logout beside identity. Admin/Root left navigation group labels and items are left-aligned. Web typography uses a clean local/system stack (Segoe UI Variable/Aptos/Segoe UI/Roboto/Noto Sans fallback), with no remote font dependency. Android/APK remains unchanged/pending separate review. |
| D060 | ACTIVE | **Owner Web header/root-test/theme refinement.** D060 overrides D059 where they conflict. Increase the visual priority of `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` and reduce `Website nghiệp vụ Inventory 1291`. Header identity shows only display name + mapped permission label; remove literal `Tên:`, `User:`, `Quyền:` labels and do not display username/user id. Remove the redundant dashboard head metadata/date/update/`Mở xử lý báo thiếu` block. Only the actual ROOT identity may use a pinned role-test selector with values ROOT/ADMIN/REPORTER/PICKER; selecting a lower role must lower **server-authoritative effective permission**, not only the UI, across Web and Android until ROOT selects ROOT again. The immutable base role remains ROOT solely so the selector/recovery route is still available; all normal business/RBAC/realtime/role-target notification checks use the effective role. Web adds a persisted theme selector `Tự động / Sáng / Tối`; automatic mode uses Asia/Ho_Chi_Minh time with dark mode from 18:00 through 05:59 and light mode from 06:00 through 17:59. Dark mode must restyle the actual application surfaces/controls/tables/dialogs, not only the page background. |
| D061 | ACTIVE | **Owner Web dark/realtime/sidebar cleanup.** D061 refines the accepted D057–D060 shell without changing Android or business state. Dark mode must be visually coherent across every currently reachable Web operational/management/reporting/system surface: no white content islands, near-invisible labels, white table rows or controls that ignore the selected dark theme. Admin/Root left-sidebar group headings (`VẬN HÀNH`, `QUẢN LÝ`, `HẠ TẦNG`, `THIẾT LẬP`) are larger/stronger for scanability, and each group/business entry gets a concise monochrome icon without adding external font/icon dependencies. Remove redundant duplicated category-eyebrow/page-title copy and nonessential explanatory text when navigation/title already supplies the context. Realtime-backed Web pages must not show generic `Làm mới`/refresh buttons; WebSocket sequence/delta plus authoritative recovery remains the freshness mechanism. Purpose-specific actions such as filters, export, support-log creation or an explicit service diagnostic probe are not generic refresh and remain allowed. |
| D062 | ACTIVE | **Owner Web completion audit and canonical navigation IA.** Recheck the deployed D061 Web and preserve sections already correct; repair only remaining gaps. Admin/Root sidebar now follows the approved operational information architecture using existing implemented capabilities only: `VẬN HÀNH` = Xử lý báo thiếu + Kết quả gần đây; `DỮ LIỆU` = Danh mục SKU + Nguồn nhân sự; `QUẢN TRỊ` = Nhân sự & tài khoản + Thời gian nghiệp vụ; `BÁO CÁO` = Tổng quan hôm nay + Báo cáo vận hành; `HỆ THỐNG` = Thiết bị & thông báo + Trạng thái dịch vụ + Nhật ký hệ thống + Phiên bản ứng dụng + Tài khoản & mật khẩu. Admin/Root default landing is the live processing queue, while dashboard remains a secondary analysis module. Existing Reporter/Picker account access remains reachable. Complete dark mode coverage includes transient/expanded surfaces such as Picker detail chips, notices/messages, realtime toast, badges and legacy report fragments so no light-theme island remains. No new business state or out-of-scope workflow is invented; Android/PDA and Stable are unchanged. |
| D063 | ACTIVE | **Owner consolidated Web IA, runtime logs, reporting/presence and people UI.** Every large left-nav business group may expose at most three child items; related implemented routes must be consolidated rather than fragmented. Admin/Root navigation is `VẬN HÀNH` → `Vận hành báo hàng` (internal `Đang xử lý` + `Kết quả gần đây`), `DỮ LIỆU` → `Danh mục SKU` + `Nguồn nhân sự`, `QUẢN TRỊ` → `Nhân sự & tài khoản` + `Thiết lập nghiệp vụ`, `BÁO CÁO` → `Tổng quan & báo cáo` (internal overview + detailed report), `HỆ THỐNG` → `Trạng thái hệ thống` + `Nhật ký` + `Tài khoản & mật khẩu`. Dashboard/report/results copy must use clear Vietnamese business wording and remove unexplained jargon/placeholders such as P95, median/`trung vị`, ACK and raw SLA labels. Add authenticated realtime-presence counts by effective role; a user is online only while an authenticated realtime connection is actively connected, multiple same-role sessions for one user count once, and logout/session closure removes that user from the count. Create Beta Drive `Inventory/Beta/Logs`; Web and Android produce bounded, sanitized logs (passwords, tokens, credentials, signing/private material redacted), distinguish source/device/time in filenames, prefix error logs with `error_`, send on the 00:00/06:00/12:00/18:00 Asia/Ho_Chi_Minh slots while an authenticated connected client is running, send errors immediately on a best-effort basis, persist Android crash evidence for authenticated retry after restart, and allow manual send. Admin/Root Web journal separates Web and Android logs and can inspect sanitized details. Redesign `Nhân sự & tài khoản` into a consistent create/filter/manage layout. Dark mode must cover all newly introduced and remaining legacy surfaces without bright/light-theme islands. Stable remains OWNER-GATED and is not mutated by D063. |
| D064 | ACTIVE | **Owner detailed system status + controlled Beta load test + post-test IA review.** Rebuild `Trạng thái hệ thống` as the Admin/Root operational service console covering every active project service: Cloudflare Worker, InventoryCore Durable Object/SQLite, Firebase Authentication, Firebase Cloud Messaging, Google Drive, Google Sheets, GitHub release/CI channel and foreground realtime. Show live/near-live health and actual usage where the provider/runtime exposes it; show public reference limits alongside actual usage but never infer the current paid/free entitlement when it cannot be read authoritatively. Lightweight InventoryCore metrics may refresh every 60 seconds while the page is visible; external-provider usage is cached at least 5 minutes to protect quota. After the status console is deployed, run one Beta-only controlled load test targeting 1,000 successful real `/api/picker/reports` submissions over no more than 10 minutes using 100 randomly selected existing active Pickers and about 400 randomly selected existing Master SKUs; use real Firebase-authenticated Picker requests, unique idempotent request IDs, bounded retry and no Stable data/resources. Record before/after SQLite/service usage, response timing, success/error counts and the bounded test summary in Beta. Any temporary load-test authorization must be randomly generated per CI run, masked, Beta-only, disabled after the run and never committed/logged. After the measured load test, analyze and challenge the current left navigation IA and present a rebuild proposal to Owner; do **not** silently change the large/small navigation groups again until Owner approves the post-test proposal. |
| D065 | ACTIVE | **Owner three-group Web navigation constraint.** D065 supersedes the D054/D063/D064 navigation-group count/placement wherever they conflict: Admin/Root left navigation must use exactly three large groups, with no more than five visible child items in any group. The current proposed composition is `VẬN HÀNH` → `Xử lý báo hàng`, `Tổng quan & báo cáo`; `QUẢN LÝ` → `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`; `HỆ THỐNG` → `Trạng thái hệ thống`, `Nhật ký`. `Kết quả gần đây` stays inside `Xử lý báo hàng`; `Nguồn nhân sự` and Picker synchronization move inside `Nhân sự & tài khoản`; `Tài khoản & mật khẩu` moves to the pinned identity/user control rather than consuming a sidebar business item. Reporter sees only its allowed VẬN HÀNH projection; Picker Web keeps its single operational workspace. This is currently the Owner-constrained proposal structure; implementation remains Beta-only and requires the Owner to approve/refine the exact composition before the sidebar is changed. Android/PDA and Stable are unchanged unless separately authorized. |
| D066 | ACTIVE | **Owner approved and authorized the D065 three-group Web navigation composition for Beta implementation.** Admin/Root pinned-left navigation is exactly: `VẬN HÀNH` → `Xử lý báo hàng`, `Tổng quan & báo cáo`; `QUẢN LÝ` → `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`; `HỆ THỐNG` → `Trạng thái hệ thống`, `Nhật ký`. Each large group remains capped at five visible children. `Kết quả gần đây` remains inside `Xử lý báo hàng`; `Nguồn nhân sự` + Picker synchronization are internal tabs/sections of `Nhân sự & tài khoản`; personal account/password access moves to the pinned top identity area and is removed from the left business navigation. Reporter shows only its permitted VẬN HÀNH projection; Picker Web remains a single operational workspace. This approval authorizes Beta Web navigation/workspace recomposition only; business APIs/state transitions/RBAC are unchanged, Android/PDA is unchanged, and Stable remains OWNER-GATED. |
| D067 | ACTIVE | **Owner accepts D066 as the current Web visual baseline and requests a bounded Web UX refinement without reopening already accepted areas.** Add a pinned persisted text-size control; make the three pending/warning/overdue summary cards filter and expose the complete live pending-SKU list with true counts (no 200-row truncation); replace the low-value `Lần xử lý` display with a useful latest-report timestamp; affected Picker detail must open immediately/cached where possible and render one Picker per row; all long Web lists must preserve scroll/context when selecting or updating an item; `HAS_STOCK` requires an explicit confirmation; `SKIP_ALLOWED` keeps explicit confirmation and, by default, disables the final confirm action for 5 seconds with a per-user on/off preference; Web runtime-log scheduling must not create duplicate files from overlapping scheduler calls and log listing must suppress exact duplicate filenames; visible product copy must be clean end-user wording and must not expose AI/Owner discussion, internal decision IDs or environment/privilege jargon such as Beta/Root labels. Android/PDA is unchanged. Stable remains OWNER-GATED. |
| D068 | ACTIVE | **Owner accepts D067 items 1–8 and 10 and freezes them; item 9 remains open and is expanded with Web interaction requirements 11–15.** Do not modify accepted D067 items without explicit Owner permission. Re-audit all normal Web copy and remove development/internal wording from user-facing surfaces while preserving genuinely useful service/status information. Replace top-of-page action messages with bottom-left translucent notifications that auto-hide after 5 seconds, keep at most five and discard the oldest first. Every selected navigation/tab/list choice must have a clearly different background. Diagnose the reported 1–3 second interaction delay using the latest Web runtime log and source: navigation must render the selected section immediately without waiting for network loads, selected Reporter SKU detail must update without rebuilding the full long queue, and background data refresh may complete afterward. Increase the visual hierarchy of `VẬN HÀNH / QUẢN LÝ / HỆ THỐNG`. Web route changes must create same-page browser history so Back/Forward traverses previously selected business sections instead of immediately leaving the Web app. Android/PDA is unchanged. Stable remains OWNER-GATED. |

| D069 | ACTIVE | **Owner accepts the complete D068 Web review baseline and starts a new Beta-Web refinement.** D068 item 9 and requirements 11–15 are accepted and frozen together with the previously accepted D067 items. New scope: (1) Web runtime logs capture broad bounded/redacted diagnostic context. (2) Detailed-report export uses native Excel `.xlsx`; D025 CSV-format clause is superseded. (3) The original enhanced pending-SKU alert proposal-only gate is superseded by D070. (4) Web presentation is unified across modules, including `Thời gian xử lý`. (5) Web UI delay is instrumented/reduced with scoped rendering and performance telemetry. Stable remains OWNER-GATED. |

| D070 | ACTIVE | **Three-stage server-authoritative pending-SKU timing and automatic Skip policy.** Admin/Root configures three integer minute thresholds with strict ordering `warning_minutes < escalation_minutes < auto_skip_minutes`. Warning highlights/notifies Reporter/Admin/Root; escalation raises the alert and also alerts affected Picker(s); neither changes D007 queue ordering. Auto-Skip has an explicit enable/disable switch and mode: `FIRST_REPORT` computes the automatic deadline from the first Picker report for the whole SKU batch, while `PER_PICKER` computes a separate automatic deadline from each Picker's own report time. When enabled and a due target is still unresolved, InventoryCore service authority emits `SKIP_ALLOWED` with source `SYSTEM_TIMEOUT`; Picker never receives a new resolve mutation permission. `FIRST_REPORT` resolves the affected batch; `PER_PICKER` grants the timed-out Picker result while the same batch stays pending for other active Pickers, then finalizes the batch when no active Picker remains. Existing 5-minute Skip→Có hàng correction remains. Automatic timing is driven by server/Durable Object alarms, idempotent/audited/realtime/FCM-aware, does not poll clients, and does not retroactively auto-Skip existing work when the D070 policy is first activated/re-enabled or mode-switched. Disabling cancels pending automatic deadlines. No processing-extension feature is included. No sound is required. Stable remains OWNER-GATED. |
| D071 | ACTIVE | **Owner Web density and immediate-response refinement.** Preserve the accepted Web business/navigation baseline and change Beta Web only: normalize every checkbox to one consistent compact size; raise the Web typography baseline by about 5% and treat that raised baseline as logical `100%` in the existing text-size control; redesign dashboard/reporting date-range controls into a compact inline selector that does not consume a separate large panel row; and make Reporter final `Có hàng` / `Bỏ qua` confirmation give immediate local visual feedback instead of waiting 1–3 seconds for service/reload work. The authoritative online mutation still commits on the service before success is claimed—no fake/offline success is allowed—but the modal closes immediately, the affected SKU shows an in-progress state, success/error is delivered later by toast, and redundant explicit post-mutation full queue reloads are removed/coalesced with realtime authoritative refresh. Runtime evidence shows no browser long tasks or memory pressure; the observed delay is dominated by API round-trips plus full queue/recent reload orchestration. Android/PDA is unchanged. Stable remains OWNER-GATED. |
| D072 | ACTIVE | **Exclude the quota-heavy `Trạng thái hệ thống` business surface from normal runtime.** Owner explicitly removes the Web `Trạng thái hệ thống` page because its near-live InventoryCore/Google Drive/GitHub monitoring consumes unnecessary quota. D072 supersedes D064–D066 only where they require that visible system-status child/surface. Admin/Root sidebar remains three large groups, but `HỆ THỐNG` now exposes only `Nhật ký`; direct/history/hash access to `system/devices/versions` is not routable. The normal `GET /api/admin/system-status` endpoint is disabled and must not invoke provider/core metrics. Existing lightweight header connectivity/realtime indicators and sanitized runtime logs remain. The controlled Beta load-test snapshot may retain a **core-only** internal snapshot, but provider reads (Google Drive/GitHub) are disabled there too. No periodic 60-second system-status refresh remains. Android/PDA is unchanged. Stable remains OWNER-GATED. |

| D073 | ACTIVE | **Beta Picker “Xác nhận lấy hàng” transport POC; Office relay research reopened only for this capability.** PDA remains on the Internet-capable PDA network. Báo hàng remains unchanged on Cloudflare Worker → InventoryCore and still has no offline/fallback transaction path. Add a separate Picker surface that accepts exactly the last 5 numeric digits of a Picklist and, in this POC phase, sends only a test request. A lightweight Windows user-mode Agent may be installed on laptops that switch between the PDA Internet network and Office network; it pairs/authenticates while Cloudflare is reachable, stores only a rotated Firebase refresh token protected by Windows DPAPI, then communicates through Firebase Realtime Database using Firebase ID-token-authenticated REST/SSE while on Office. The POC Agent must only return ACK + diagnostic timing/network identity and must not load, search, confirm, click, or mutate WMS. RTDB access is Beta-only and UID-isolated. Multi-Agent primary election/failover and real WMS confirmation are explicitly deferred until this transport POC is field-PASS. Stable remains OWNER-GATED. |

| D074 | ACTIVE | **D073 field-repair after first Office test.** Owner confirmed the Beta Firebase RTDB has been created. Field evidence on `.Office@MSN` shows the Windows Agent reaches Firebase but authenticated RTDB read/SSE currently returns HTTP 403; this is an auth/rules/path failure, not a generic network failure. Repair the POC so both Android and Windows derive the relay path from the Firebase ID-token subject (`sub`) instead of trusting the application `user_id`, expose explicit RTDB/auth diagnostics without logging passwords/tokens/session material, add persistent local sanitized Windows Agent logs, and split Picker into two bottom-pinned operational tabs `Báo hết hàng` / `Xác nhận đơn`. The Picker screen must use denser typography/control heights, the confirmation tab must accept exactly five numeric Picklist-suffix digits and reliably enable/send the test. D074 remains transport-only: no WMS lookup/confirm/mutation; Stable remains OWNER-GATED. |

| D075 | ACTIVE | **Shared Picker→ADMIN Agent relay + ADMIN-only Agent identity + automatic Agent update.** D075 overrides D073/D074 only for relay routing and Agent authentication. Picker clients may use different Picker accounts and all submit transport-test jobs into one Beta shared relay queue. Windows Agent login must accept only a real base-role `ADMIN`; PICKER, REPORTER and ROOT accounts are rejected even if effective role is ADMIN. Each Agent has a persistent local `agent_instance_id`; ACK/audit metadata records the ADMIN application user, machine name, Agent instance and network. POC ACK is first-writer-wins so only one ADMIN Agent can own a test job. The Windows Agent checks GitHub for a newer dedicated `relay-agent-vN` prerelease, verifies SHA-256, replaces the portable EXE in-place when its folder is writable, relaunches automatically, and otherwise gives a bounded update error without weakening relay operation. Agent prereleases must not become the GitHub `latest` release used by Android Beta OTA. No WMS lookup/confirm/mutation yet; Stable remains OWNER-GATED. |

| D076 | ACTIVE | **Automate Beta Firebase RTDB Rules deployment through GitHub Actions.** Owner has provisioned `FIREBASE_RULES_SA_JSON_BETA` in GitHub Environment `beta` and granted the scoped Beta service account permission to administer Firebase Rules. Pull requests may validate credential presence/read access but must not mutate RTDB Rules; merged `main` changes to `firebase/database.rules.json`, `firebase.json`, or the deploy workflow automatically authenticate from the Environment secret and deploy only Beta Realtime Database Rules. Stable remains OWNER-GATED and is never targeted by this workflow. Secret values must never be printed, committed or copied into repo state/logs. |

| D078 | ACTIVE | **Office transport discovery matrix before replacing RTDB.** Field evidence proves Wincommerce Office proxy blocks the Beta RTDB `*.firebasedatabase.app` endpoint while Firebase Secure Token remains reachable. Do not bypass corporate filtering or mutate WMS. Before selecting a replacement relay, the Windows Agent must provide explicit read-only probe buttons for Firebase Auth baseline, RTDB, Firestore REST, Apps Script Web/API reachability, Sheets API, Drive API, plus `Test tất cả`. Probes classify Google/API reachability separately from corporate proxy block and write only sanitized diagnostics. Firestore REST is the preferred candidate if Office allows `firestore.googleapis.com` because it accepts Firebase Authentication ID tokens; no Firestore/App Script/Sheets/Drive relay resource is provisioned or adopted until Owner field evidence selects a reachable transport. |

| D079 | ACTIVE | **Persist explicit workstream routing between Báo hàng Web/APK and the paused `Xác nhận lấy lại hàng` transport work.** The confirmation workstream is paused because the Owner is away from the company Office network, not because of a technical failure. Exact resume phrase `tiếp tục build xác nhận lấy lại hàng` must restore the D078 checkpoint immediately without asking the Owner to repeat prior context: `relay-agent-v4` release PASS, RTDB blocked by Office proxy, next step is run `TEST TẤT CẢ` on `.Office@MSN`, collect the sanitized Agent log, then select a reachable transport before provisioning/replacing relay. Until that explicit phrase (or equivalent direct Owner command) is received, the active workstream returns to core **Báo hàng Web/APK**. Resuming Báo hàng must bootstrap current main and continue from canonical Web/Android state; it must not silently resume D078. Workstreams are logical continuity lanes, not long-lived Git branches: every resumed implementation still starts a fresh branch from current `main` and follows branch → PR → guards → merge. Stable remains OWNER-GATED. |

| D080 | ACTIVE | **Agent ↔ Supra WMS read-only POC while PDA ↔ Agent Office testing is paused.** Owner explicitly authorizes this confirmation workstream to proceed with Agent-to-company-WMS connectivity before the physical Office relay test. The normal user flow must not require F12 or Copy as cURL: the Windows ADMIN Agent opens a dedicated Edge WMS window, observes only requests from that Agent-owned browser session to `api-supra.winmart.vn`, captures the required HY1 session headers into Agent RAM, and automatically recaptures once if the read-only API reports an expired session. Interactive WMS login remains user-authorized when the browser session itself has expired; the Agent must not decrypt/read the user's normal browser profile. D080 may test WMS UI reachability and a signed read-only GET to `/sft3-hy1/api/v1/warehouse/zones` through normal Windows/system/env/direct/corporate-proxy routing. It must not bypass corporate filtering, search/load a Picklist, confirm/click an order, or perform any WMS mutation. Raw WMS session/header values are secret runtime material and must never be committed or logged. D078 PDA ↔ Agent Office testing remains pending until Owner is back at company; Stable remains OWNER-GATED. |

| D081 | ACTIVE | **Harden Agent WMS login UX/security and add taskbar machine-status surface.** D080 field evidence shows the first dedicated-browser capture can fail before a user has time to log in because a short per-receive WebSocket cancellation aborts the .NET Framework ClientWebSocket. Agent must wait for the full login window (up to five minutes) rather than aborting every few seconds. Browser selection is Microsoft Edge first, Google Chrome fallback; if neither supported Chromium browser exists, fail clearly without pretending success. WMS credentials remain entered only on the official WMS browser page; do not add a WMS username/password form to the EXE. The Agent may keep its dedicated browser profile for normal browser-managed login state, while captured WMS request/session values stay RAM-only and redacted from logs. Existing SUPRA Inventory ADMIN login may remain inside the EXE over HTTPS/Firebase with DPAPI-protected stored session; clear the password UI immediately after capture and never persist/log the plaintext password. Add a low-overhead Windows taskbar/system-tray status surface showing CPU utilization, approximate current CPU MHz and RAM used/total; design it as a replaceable status provider so later releases can show business counters such as confirmed Picklists and online users. No WMS mutation; Stable remains OWNER-GATED. |

| D082 | ACTIVE | **Read-only Picklist existence lookup + persistent click-through Agent overlay.** D082 extends the bounded D073–D081 confirmation POC without authorizing confirmation. While Owner is at home, keep the existing Internet/RTDB PDA ↔ Agent transport unchanged; D078 Office/LAN transport stays paused until company testing. PDA sends exactly the last five numeric Picklist digits. A real ADMIN Agent with a valid HY1 WMS session performs only the signed read-only `GET /sft3-hy1/api/v1/autopp/pickListConfirms`, filters the current month through today using HY1/WIN and `Content=<5 digits>`, compares Picklist identity fields by exact trailing five digits, and returns a bounded lookup classification such as `FOUND`/`NOT_FOUND` to the requesting PDA. Unknown response schema must fail closed as `SCHEMA_UNSUPPORTED`, never fabricate `NOT_FOUND`. The supplied WMS confirm page `/sft3/app/saleorder/auto-pickpack-confirm` is reference-only; D082 must not click/submit it or add any WMS POST/PUT/PATCH/DELETE/confirmation call. User-supplied live session/header/signature values are secret transient evidence only and must never enter repo/log/state. If the Agent already has a valid WMS session in RAM, disable the manual browser/login capture action to prevent repeated login; a remote PDA lookup must never auto-open a WMS login window when session is absent/expired, and instead returns a session-required result. Replace the tooltip-only machine monitor with an always-visible small topmost overlay: configurable opacity, draggable while unlocked, persisted position, and locked click-through/no-activate mode so mouse input reaches underlying/fullscreen applications; unlock/configure from the tray menu. Overlay is the future surface for business counters such as confirmed Picklists/online users. Stable remains OWNER-GATED. |

| D083 | ACTIVE | **Repair relay-agent-v7 silent startup regression and add executable startup gating.** Owner field evidence after D082 release: Android `beta-vc50` opens, but `relay-agent-v7` may exit immediately with no visible UI even when manually re-downloaded and launched. Treat this as an Agent startup regression, not a WMS/PDA transport failure. Agent v8 must make the main WinForms UI authoritative for startup: construct/show the main form before initializing the D082 overlay, isolate overlay initialization so overlay/PInvoke/window-style failures disable only the overlay and never terminate the Agent, and remove overlay handle recreation during initial `Shown`. Top-level startup exceptions must be redacted to the local Agent log and surfaced in a visible error dialog instead of silent exit. CI must run the built Windows EXE in an explicit bounded `--startup-smoke` mode after compilation; compile-only PASS is insufficient for future Agent releases. D082 read-only Picklist logic remains unchanged; no WMS mutation; Stable remains OWNER-GATED. |

| D084 | ACTIVE | **Refine D082 Picklist lookup and overlay controls.** D084 overrides D082 only for lookup mechanics and overlay settings. The Windows Agent must expose explicit overlay settings for background/panel opacity and lock state. Unlocked overlay is draggable; locked overlay cannot be selected/moved and must pass mouse input through to the underlying application. Picklist lookup must not use a date filter and must not send the PDA suffix in WMS `Content`: keep `FromDate=""`, `ToDate=""`, `Content=""`, request pages of 100 records, and scan pages until a match or truthful exhaustion. The authoritative Picklist identity field is exactly `PickListCode`; expected values are `PL` followed by digits, and only the last five digits are compared to the exact five digits sent by PDA. Unknown/malformed schema or stalled pagination fails closed rather than returning false `NOT_FOUND`. Because an all-date scan can exceed the prior 25-second relay window, Android relay wait is extended to two minutes. Read-only GET only; no confirmation/mutation; Stable remains OWNER-GATED. |

## Superseded historical state

- Early handovers described the project as design-only or infra-only. Those status statements are `SUPERSEDED` by live repo evidence and `ops/project-state.json`.
- Older handover v3 stated Web/Android business implementation had not started and APK signing was pending. This is `SUPERSEDED` by later Beta app/auth/signing work.
- Handover v4 recorded schema v2 and Core Business APIs as the next build frontier. This is `SUPERSEDED`: live registry is schema v5 and the business API foundation is deployed.
- Earlier exploration of Office fallback providers is `CLOSED` by D018.
- The initial 5,000-row implementation cap for SKU import was a temporary technical limit and is `SUPERSEDED` by D021.
- The fixed HR-header assumption from D013 is `SUPERSEDED` by configurable source-column mapping in D033.
- The old account hierarchy/default-reset/auto-disable behavior from D023 is `SUPERSEDED` by D034, D035 and D037.
- Concept 3 visual authority from D024 and Practical Balanced visual authority from D036/D042 are `SUPERSEDED` by D044–D047. Dashboard/reporting business structure from D025 remains active independent of visual skin.
- Offline-new-report uncertainty O006 is closed by D043: there is no offline business mode.

## Open decisions — do not invent

| ID | Status | Question |
|---|---|---|
| O001 | OPEN | SKU reset confirmation was described as random “6 chữ”; exact semantics (6 characters vs 6 words/other) are not yet Owner-confirmed. |
| O002 | CLOSED_BY_D088 | Web + Android share exactly one persistent interactive session per account; a new Web/Android login invalidates the prior interactive session. Real ADMIN Agent sessions are a separate multi-Agent channel so D085 HA remains valid. |
| O003 | OPEN | Final Root MFA/recovery design for Stable. |
| O004 | OPEN | Final reporting/export columns and exact Reporter dashboard visibility beyond the core queue. |
| O005 | OPEN | Final Stable password KDF/rate-limit/account-lock policy. |
| O006 | CLOSED | Closed by D043 on 2026-09-17: no offline business mode or offline report creation is permitted. |

## Owner acceptance rule

Technical CI PASS does not equal Owner business acceptance. Owner may accept with numbered feedback such as `1 OK, 2 chưa OK...`; only explicit Owner acceptance should be recorded as accepted behavior for release/promotion decisions.

## D085 — Sticky multi-Agent HA, Picklist cache/anti-spam, reusable WMS profile session and user-mode autostart

Status: **ACTIVE — OWNER APPROVED 2026-09-20**.

D085 supersedes only the D084 implementation details listed below. D084 all-date exact-`PickListCode` read-only lookup semantics remain authoritative.

- **Transport is deliberately NOT selected by D085.** The current Beta RTDB relay stays unchanged as the temporary transport. D078 Office transport probing remains pending; no LAN/Firestore/Apps Script/other transport becomes primary until physical Office evidence is available and the Owner explicitly selects it.
- The confirmation path supports multiple Windows Agents but has exactly **one sticky active Agent** at a time. The first WMS-ready Agent that acquires leadership keeps all work while healthy; standby Agents do not round-robin or touch WMS jobs.
- Active Agent heartbeat is 3 seconds. A leader is considered failed after **10 seconds** without a valid WMS-ready heartbeat. One standby then acquires leadership and resumes pending work. The PDA displays **“Đang chuyển người xử lý...”** for failover state.
- If no WMS-ready Agent exists, the PDA must stop the lookup and visibly instruct the Picker: **“Không có Agent xử lý online. Vui lòng về bàn chuyên viên xử lý trực tiếp.”**
- An Agent may auto-start at Windows user logon through the current-user startup registry only. Windows administrator/elevation is not required. Application identity remains a real SUPRA Inventory base-role ADMIN as required by D075.
- After a valid WMS session is established, Agent loads the all-date Picklist list into an in-memory exact trailing-five cache. Cache hit performs no WMS request. Cache miss refreshes only when the cache is older than 10 seconds; concurrent misses join one in-flight full refresh.
- Only a **final truthful `NOT_FOUND` after the applicable refresh rule** counts as a wrong lookup. FOUND resets the current strike window. Session/network/proxy/schema/transport errors never count as wrong input.
- Three final NOT_FOUND results for one Picker account within 60 seconds lock lookup: first lock 5 minutes, second lock 30 minutes, third and later locks 60 minutes. After 24 hours without a new lock, escalation resets to level 0. The lock is account-scoped/persisted so changing PDA or restarting the app does not bypass it.
- Audit records identify Picker user, request, Agent/Admin instance, cache mode, result, strike/lock state and timing. Raw five-digit values and WMS credentials/session/signature values remain excluded from diagnostics.
- WMS session longevity uses the dedicated Edge/Chrome browser profile already scoped by D080/D081. Agent startup may reopen that profile briefly, capture a still-valid authorized browser session into RAM and validate it with a read-only GET. Agent does **not** persist raw WMS headers/tokens itself. If invalid, local WMS login is enabled; remote PDA requests never auto-open the WMS login page.
- Overlay interaction engine is rolled back to the Owner-field-proven Agent v8 behavior. Overlay settings remain accessible directly from the Agent main window; tray access is only an additional shortcut.
- The future WMS confirmation/mutation adapter remains **disabled/not implemented/not authorized**. D085 is lookup + transport/HA/rate-limit foundation only. WMS POST/PUT/PATCH/DELETE remains forbidden.
- Stable remains untouched and OWNER-GATED.

## D086 — Agent session file, professional shell, true click-through and persistent background lifecycle

Status: **ACTIVE — OWNER APPROVED 2026-09-20**.

D086 refines D081–D085 only for the Windows Agent local session/lifecycle/UI mechanics. D085 sticky ACTIVE/STANDBY ownership, 10-second failover, all-date read-only PickListCode cache, anti-spam, temporary Beta RTDB carrier and the D078 transport-open boundary remain unchanged.

- The Agent may persist the captured HY1 WMS request-session snapshot in a **local Windows-user DPAPI-encrypted file**. Raw values remain forbidden in GitHub, RTDB, diagnostics, overlay settings and plaintext files.
- On Agent start after SUPRA Inventory ADMIN authority is restored, WMS startup is **file-first**: decrypt the saved session for the current Windows user, validate it with the approved read-only WMS request and preload the complete Picklist cache. If that succeeds, continue without opening a browser. If the stored session is missing/invalid/expired or cannot load the Picklist list, clear the unusable file and open the Agent-owned WMS browser locally to obtain a new authorized session. A successful preload/refresh renews the encrypted session file for the next start.
- Remote PDA requests still never authorize opening a WMS login window. No WMS credential form is added and no password is persisted by the Agent.
- Agent main UI is reorganized as a professional two-surface shell. **Tổng quan** contains only the primary `Đăng nhập hệ thống Supra` action, connection/Agent status and concise current-model information. ADMIN login, network/transport tests, overlay settings and logs live under **Cài đặt**.
- A locked overlay must be genuinely click-through across application/process boundaries: pointer input reaches the real object/window beneath the overlay. Unlocking restores drag interaction. Position/opacity/visibility/lock remain local non-secret settings.
- Normal users cannot close the main Agent through a title-bar X; deliberate graceful exit is exposed only through a protected action that requires the password verifier of the currently authenticated real ADMIN. The verifier is salted/derived and DPAPI-protected; the plaintext password is never persisted/logged.
- Because a normal user-mode Windows process cannot be made absolutely unkillable against the same user/Task Manager, D086 uses best-effort persistence: current-user autostart plus a sleep-only watchdog that relaunches the main Agent after an unexpected process exit. Deliberate authorized exit, update replacement and Windows shutdown suppress watchdog restart. Killing both Agent and watchdog remains outside what user-mode software can prevent without elevation/service installation.
- Background overhead must stay low: no fast `netsh` polling loop; SSID/UI refresh is coarse/on-demand, local CPU/RAM overlay sampling is reduced, and network/service work remains event/job/HA driven. The 3-second Agent leadership heartbeat remains because it is required for the approved 10-second failover.
- WMS remains signed **GET-only**. Confirmation/mutation is still not implemented or authorized. Stable remains untouched and OWNER-GATED.



## D087 — Agent split logs, overlay repair, minimize-only shell and low-quota status overlay

Status: **ACTIVE — OWNER APPROVED 2026-09-20**.

D087 refines the released D086 Windows Agent after Owner field evidence from v11. D085 HA/anti-spam/read-only Picklist logic, D086 DPAPI WMS file-first session, D078 transport-open boundary and Stable OWNER-GATE remain unchanged.

- Agent local logs are split into two sanitized files: **PDA ↔ Agent audit** for user/device/request/Picklist/result/correlation tracking, and **Kỹ thuật AI** for app lifecycle, network/HTTP, errors and internal diagnostic behavior.
- Both log streams use the same secret redaction boundary. Passwords, access/ID/refresh tokens, Authorization/Bearer values, cookies, API keys, WMS session/header/signature material, private/signing keys and other credentials are forbidden.
- The PDA ↔ Agent audit may record the exact five-digit Picklist suffix because it is operational correlation data explicitly approved by Owner; it must not record a full WMS response or secret session material.
- The v11 overlay initialization defect must be repaired and overlay settings must remain retryable/reachable after a transient initialization failure instead of becoming permanently disabled.
- Main window keeps no close/X action but restores an explicit **minimize to Windows taskbar** control. Auto-start may remain tray-hidden; deliberate shutdown remains ADMIN-password protected.
- Overlay has two visible information rows. **Laptop** shows local CPU, Memory, Disk, WiFi/Ethernet throughput + Windows Internet state and GPU where Windows exposes it. These are local OS metrics and must not create Cloudflare/Firebase/WMS polling.
- **Agent** shows total online Agents plus per-machine current-runtime APK received and Agent responses. The two per-machine counters stay RAM-only and are never synchronized globally.
- Total Agent online uses only bounded Beta RTDB presence: one minimal own-presence write every 30s, one bounded presence-list read every 60s and 90s freshness. Presence carries only safe Agent identity/machine/heartbeat/WMS-ready metadata. It does not select the final D078 transport.
- WMS remains signed **GET-only** with no confirmation/mutation. Stable remains untouched and OWNER-GATED.

- D087 RTDB presence-rule changes still run Android verification but must not publish/advance the signed Android channel unless files under android/** actually changed. Agent-only Rules/support changes therefore keep the current signed beta-vc52.

## D088 — Unified naming/icon, persistent single Web/Android session, Web tools, tray-only Agent and editable overlay

Status: **ACTIVE — OWNER APPROVED 2026-09-20**.

D088 records the Owner's eight-item Beta change set and supersedes D087 only where explicitly stated below. D085 HA/anti-spam, D086 DPAPI WMS session/protected exit, D087 split logs/presence, D078 transport-open boundary, GET-only WMS scope and Stable OWNER-GATE remain unchanged.

1. Web product name becomes **Website nghiệp vụ Inventory**.
2. Android Beta application name becomes **1291 Beta**.
3. Windows utility name and canonical executable become **Agent Auto Confirm Pick Pack** / **Agent Auto Confirm Pick Pack.exe**.
4. Web and Android use one persistent interactive session per account. Reopening the same valid app/browser session does not require login; a successful fresh Web/Android login becomes the only current interactive session and invalidates older Web/Android generations. Existing old tokens require one migration login after D088. Agent authentication is explicitly separate so multiple real ADMIN Agents can remain online for D085 HA.
5. Admin/Root Web adds **HỆ THỐNG → Công cụ** with Agent release/version/platform information, official direct download and concise usage guidance.
6. Agent overlay unlocked state adds edge/corner resizing, numeric width/height and full background/text color selection while preserving opacity. Locked state remains true click-through. All non-secret overlay preferences persist locally.
7. Agent manual minimize becomes **System-Tray-only**: no taskbar button while minimized; tray restore returns the main window. No normal X is added and protected ADMIN shutdown remains.
8. The Owner-selected icon #4 motif is the common identity across Web favicon, Android launcher and Agent executable/tray: dark navy base, cyan/blue transfer arrow with scanner and green transfer arrow with warehouse/boxes.

A legacy Agent asset alias is permitted during the D088 transition so released pre-D088 clients can update. GitHub normalizes spaces in release asset filenames to dots; the Windows product/assembly remains **Agent Auto Confirm Pick Pack**, while the final D088 updater/download contract uses GitHub's normalized `Agent.Auto.Confirm.Pick.Pack.exe` asset. Transitional v13 exposed the normalization mismatch before Owner field use, so final D088 Agent target is v14.

No D088 item selects the final PDA ↔ Agent transport, authorizes WMS mutation, or changes Stable.

## D089 — Field-review repair: exact shared icon, service/realtime status split, complete Tools dark UI, granular overlay and single-instance Agent

Status: **ACTIVE — OWNER ACCEPTED PASS 2026-09-21**.

D089 is a corrective field-review change set over D088. It does not reopen D078 transport selection, WMS mutation, D085 HA, D086 DPAPI/protected-exit behavior, D087 logging/presence, or Stable.

1. The exact Owner-selected **icon #4 image asset** is authoritative. Web favicon/Tools, Android launcher and Windows EXE/taskbar/System Tray must be generated from that same committed full-bleed dark-navy asset. Hand-drawn placeholder SVG/vector/PowerShell recreations are not acceptable.
2. Web HTTP/API service reachability and realtime/WebSocket state are distinct. A realtime outage may show **Đồng bộ: Mất realtime**, but successful authenticated API requests must keep **Dịch vụ: Hoạt động**. Realtime must never overwrite the HTTP service state.
3. Agent overlay settings must expose a master **Bật hiển thị Overlay** toggle plus persisted granular checklists. Laptop options are CPU, RAM, Disk, Wi-Fi/Ethernet throughput, Internet state and GPU. Agent options are total Agent online, ACTIVE/STANDBY, local APK request count, local response count and Supra WMS readiness. Existing resize, opacity, colors, lock/click-through remain.
4. Only one normal Agent runtime may exist per Windows user session. A second EXE launch must not create another Agent/tray/overlay/worker; it signals and restores/activates the already-running instance. CI startup-smoke remains exempt from the singleton mutex.
5. **HỆ THỐNG → Công cụ** must be fully coherent in dark theme: no light fact tiles, unreadable text or mismatched controls.

D089 release candidate targets `relay-agent-v15` plus the next signed 1291 Beta APK. WMS stays signed GET-only, current RTDB remains temporary pending D078, and Stable remains OWNER-GATED.


## D089 final release checkpoint

D089 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta. Owner physical field re-test remains pending under `OA011`.

- Runtime PR #99 merged to `main` at `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Final PR gates PASS: Repo Authority `35528500471`, Project State `35528500466`, RTDB Rules `35528500468`, UI Design `35528500465`, Relay Agent `35528500524`, Android `35528500467`.
- Final main gates PASS: Beta Worker `35528647549`, UI Design `35528647554`, Repo Authority `35528647571`, Project State `35528647574`, Relay Agent `35528647534`, Android `35528647526`.
- Windows Agent release: `relay-agent-v15`, release id `392528472`; canonical asset `Agent.Auto.Confirm.Pick.Pack.exe`, asset id `577316714`, size `177152` bytes, SHA-256 `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- Android release: `beta-vc54`, release id `392528497`; APK asset id `577316797`, size `9340834` bytes, SHA-256 `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.
- The approved icon #4 is now stored as verified PNG binary and is the shared visual source consumed by Web, Android and Agent.
- D078 final PDA ↔ Agent transport remains pending physical Office-network evidence. Current RTDB remains temporary. WMS remains signed GET-only. Stable remains OWNER-GATED.


## D089 Owner acceptance checkpoint

Status: **OWNER ACCEPTED PASS — 2026-09-21**.

The Owner explicitly confirmed that the D089 result **đã đạt** after field review. This closes `OA011` and makes the released D089 Beta behavior the accepted baseline:

1. The exact selected icon #4 is accepted as the shared identity across Web, Android and Windows Agent surfaces.
2. Web `Dịch vụ` and realtime `Đồng bộ` are accepted as independent statuses.
3. `HỆ THỐNG → Công cụ` dark-theme presentation is accepted.
4. Agent Overlay master visibility plus granular Laptop/Agent display options and persistence are accepted.
5. Windows Agent single-instance behavior is accepted: duplicate launch does not create a second runtime and restores/activates the existing instance.

Accepted released artifacts remain `beta-vc54` and `relay-agent-v15`. This acceptance does not select D078 final PDA ↔ Agent transport, does not authorize WMS mutation, and does not authorize Stable. Current RTDB remains temporary, WMS remains signed GET-only, and Stable remains OWNER-GATED.

## D090 — Office transport boundary from physical company-network evidence

Status: **ACTIVE — OWNER CONFIRMED 2026-09-21**.

D090 closes the remaining uncertainty about whether the confirmation workstream should spend more field time probing non-Google public project endpoints from the Office network.

- Owner confirms the Office network should be treated as an allowlisted environment that reaches **internal Supra services plus only some Google services**. Do not spend further field cycles probing the Cloudflare Worker/custom project host for PDA ↔ Agent transport on Office; it is treated as blocked/unavailable for this workstream.
- Physical Agent evidence on Office confirms Supra WMS UI/API read-only access works, Firebase Secure Token authentication remains reachable, while Firebase Realtime Database is repeatedly blocked by the corporate proxy with HTTP 403. RTDB therefore remains unsuitable as the Office carrier even though it may still work on the Internet-capable PDA network.
- The same sanitized probe matrix shows reachability to the Google-hosted Firestore, Apps Script, Sheets and Drive API hosts. Host reachability is **not** equivalent to a production relay PASS.
- D078 transport discovery is narrowed to **Google-hosted candidates only**. Firestore remains the preferred next candidate already identified by D078 because the host is reachable and the existing Firebase identity can be reused, but it is not selected as final transport until an authenticated Beta relay proof validates the required request/response, Agent coordination/failover and bounded quota behavior.
- Do not provision/adopt a new relay resource merely because its host is reachable. Any new resource must first be added to project scope/resource registry in the same approved change set.
- Current Beta RTDB remains temporary for non-Office/Internet testing only until a replacement carrier is proven. WMS remains signed GET-only with no confirmation/mutation. Stable remains OWNER-GATED.

## D091 — Build and field-test Firestore PDA ↔ Agent before trying another provider

Status: **ACTIVE — OWNER DIRECTED 2026-09-21**.

The Owner requires implementation evidence rather than more generic Office reachability probes.

- Build the preferred D090/D078 Google-hosted candidate as a real Beta end-to-end transport test: `Picker PDA → Cloud Firestore → Office Agent → Cloud Firestore ACK → originating Picker PDA`.
- D091 is deliberately a **transport-only field gate**. The Agent ACK uses `TRANSPORT_ONLY`; it does not query, confirm, click or mutate WMS. This isolates whether PDA and Office Agent can actually exchange authenticated messages through Firestore.
- The test requires both a new Windows Agent and a new signed Beta APK because the accepted D089 artifacts are hard-wired to RTDB for this workflow.
- Beta Firestore `(default)` in `supra-inventory-beta`, location `asia-southeast1`, collection `relay_poc_jobs`, is authorized for this field candidate. It must be locked by Firestore Security Rules and use Firebase Authentication ID tokens; no anonymous/open Rules.
- Provisioning and Rules deployment are main-only automation. If the existing Beta service account lacks the required Google Cloud permission, fail closed and surface the smallest Owner-only permission/setup action instead of weakening Rules.
- First field proof uses one Agent and bounded polling only. Do **not** port the D085 3-second HA heartbeat writes into Firestore at this stage because transport viability must be proven first and final HA must be quota-safe.
- Firestore becomes the final selected carrier only after the real Office round trip passes and the subsequent D085 multi-Agent/10-second failover design is proven within the quota envelope.
- If authenticated Firestore round trip fails because Office cannot carry the required Firestore operations, move directly to Apps Script as the next Google-hosted candidate. Do not repeat Cloudflare or RTDB Office tests.
- D089 accepted UI/runtime behavior remains protected. WMS remains signed GET-only; no confirmation/mutation is authorized. Stable remains OWNER-GATED.

## D092 — Firestore selected for Office confirmation path; bounded automatic Picklist confirmation

Status: **ACTIVE — OWNER DIRECTED / D091 FIELD PASS 2026-09-21**.

The Owner physically tested the D091 PDA ↔ Agent Firestore round trip on the company internal Wi-Fi and confirmed it succeeds. This closes the D091 transport uncertainty for the confirmation workstream and selects **Cloud Firestore** as the Beta PDA ↔ Agent carrier for this capability. RTDB remains rejected on Office; Cloudflare is not reintroduced.

D092 authorizes one narrowly bounded WMS mutation for **Xác nhận lấy lại đơn** only:

1. Picker/PDA submits exactly the trailing **5 numeric digits** of the target Picklist through authenticated Firestore.
2. Only the sticky WMS-ready **ACTIVE Agent** may poll work. Firestore leader coordination preserves the D085 approximately 10-second failover target; conditional document writes and per-job claim prevent two Agents from processing the same request.
3. Before mutation, Agent must reuse the approved D084/D085 lookup path: all-date signed GET, `FromDate=""`, `ToDate=""`, `Content=""`, 100-row paging, exact `PickListCode` (`PL` + digits), and exact trailing-five comparison. Cache/single-flight semantics remain authoritative.
4. A final truthful `NOT_FOUND` remains the only wrong-input strike. D085 account-scoped anti-spam remains: 3 final NOT_FOUND results inside 60 seconds → 5-minute lock, then 30 minutes, then 60 minutes; escalation resets after 24 hours without a new lock. Lookup/session/network/schema/transport/confirmation errors do not count as wrong input.
5. A WMS confirmation may run **only when exactly one full `PickListCode` is resolved**. Zero, multiple or malformed candidates fail closed and require direct specialist handling.
6. The only authorized WMS mutation endpoint is `POST /sft3-hy1/api/v1/autopp/pickListConfirms/confirmSkipItem`, with one exact full PickListCode and fixed business fields `IsAllowSkipped=true`, `RemainSkip=1`, `WarehouseCode=HY1`, `EnableDCSite=false`. No other WMS POST/PUT/PATCH/DELETE is authorized by D092.
7. WMS session/header material and signatures remain runtime secrets. Agent generates a fresh signature/nonce for the actual request. Owner-supplied bash/cURL/session/header/signature values are transient evidence and must never be committed or logged.
8. Firestore uses `PENDING → PROCESSING → ACK`. A conditional Firestore claim occurs before WMS work. Cross-Agent confirmation guard state is keyed by a non-reversible PickListCode fingerprint so the same exact PickList is not automatically POSTed twice across Agent failover/retry. Uncertain mutation outcomes fail closed; PDA must not encourage an immediate retry.
9. Success shown to Picker is exactly: **“Đã xác nhận lấy lại đơn. Hãy quay lại app SFT / SFT 3 để tiếp tục”**. Errors return a bounded business-safe message and direct the Picker to specialist handling where appropriate.
10. D091 `TRANSPORT_ONLY` is historical field-proof behavior and is superseded for the active confirmation flow by D092. D089 accepted UI/runtime baseline remains protected. Stable remains **OWNER-GATED** and is untouched.

D092 does not create offline business mode, does not change the normal Báo hàng Cloudflare/InventoryCore architecture, and does not authorize any broader company-WMS automation beyond this exact Picklist confirmation contract.

## D092 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OWNER REAL PICKLIST CONFIRMATION PENDING**.

- PR #109 merged to main `130a70ac912739e37caa98647cab60b53a6c0b06`.
- Main Repo Authority `35552139222`, Project State `35552139224`, Firestore `35552139264`, Beta Worker `35552139258`, UI `35552139223`, Relay Agent `35552139283` and Android `35552139252` all PASS.
- Released Windows Agent: `relay-agent-v17`, release id `392647942`, canonical EXE asset id `577982501`, size `216576`, SHA-256 `ccc0d499c044fb567b34cd37ff1a802293ee9cc47d082a34c4fac2778fe8cd24`.
- Released signed Android: `beta-vc56`, release id `392647903`, APK asset id `577982221`, size `9340858`, SHA-256 `fe41c136d16470d7b0fac45a4b125b8e1b29610f7b468a4e41171f68c420da80`.
- OA013 is READY_FOR_OWNER_FIELD_TEST. Final D092 business acceptance requires one controlled real Picklist confirmation and verification in SFT / SFT 3.
- Stable remains OWNER-GATED and untouched.

## D093 — Preserve D091 Firestore carrier and repair D092 field regression

Status: **ACTIVE — OWNER DIRECTED 2026-09-21**.

The Owner confirmed the D091 Firestore PDA ↔ Agent path had already passed a real Office-network field test and directed that the D092 regression be repaired without changing transport architecture.

1. Cloud Firestore remains the selected Beta carrier for this confirmation workstream. Do not switch the PDA ↔ Agent path to Cloudflare, RTDB, Apps Script or another carrier as part of this repair.
2. A long-running Windows Agent must resolve and apply the **current Windows system proxy for each Firestore request**, so a laptop that changes from another network to the company Office network does not keep a stale startup proxy. Firestore must not use the WMS corporate fallback proxy and must not bypass company filtering.
3. Safe Firestore reads may make one bounded retry on transient DNS/connect/timeout failures. Firestore writes/claims are not blindly retried because an uncertain write outcome must remain fail-closed.
4. The currently ACTIVE Agent is not demoted by one transient coordination failure. It may retain ownership only within the existing D085/D092 **10-second failover threshold**; after that threshold, normal failover/election rules apply.
5. Agent health is truthful. When Firestore coordination or the ACTIVE Agent relay poll is unhealthy, the UI/overlay must show `FIRESTORE OFFLINE` and online Agent count must be `0`; code must not force a minimum `Online 1`.
6. The ACTIVE Agent may poll/claim confirmation jobs only after a successful Firestore relay poll. Standby Agents remain prohibited from WMS processing.
7. Android keeps the total two-minute confirmation wait, but a still-`PENDING` request gets **30 seconds** before conditional cancellation so the 10-second HA failover plus reconnect/poll margin can complete. A `PROCESSING` request is never deleted or automatically resent on local timeout.
8. D092 bounded WMS mutation, exact PickListCode resolution, anti-spam, idempotency and secret boundaries are unchanged. Stable remains **OWNER-GATED** and untouched.

The D092 real-Picklist field gate is blocked until the D093 Agent/APK repair is released and the PDA → Firestore → Office Agent → Firestore → PDA path is re-verified. D091 historical field PASS remains valid evidence for carrier selection.

## D093 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA014 FIRESTORE FIELD RETEST PENDING; OA013 BLOCKED**.

- PR #111 merged to main `377159ed6722eede6b7716c9c83066b863a4e805`.
- Main Repo Authority `35554493313`, Project State `35554493314`, Beta Worker `35554493316`, UI `35554493327`, Relay Agent `35554493315` and Android `35554493317` all PASS.
- Released Windows Agent: `relay-agent-v18`, release id `392660561`, canonical EXE asset id `578049460`, size `219136`, SHA-256 `96e2cde601f41908e1af10492a4bd8b9e8a47a905ce464d33d4917038838acb7`.
- Released signed Android: `beta-vc57`, release id `392660672`, APK asset id `578050077`, size `9340858`, SHA-256 `f655844b1222787938cacf169ca2f158630ab536b0a9c252f19f56d60cc3ce19`.
- OA014 is READY_FOR_OWNER_FIELD_TEST. It re-verifies the physical PDA → Firestore → Office Agent → Firestore → PDA path and truthful Firestore health after the D093 repair.
- OA013 real Picklist confirmation remains blocked until OA014 PASS.
- Stable remains OWNER-GATED and untouched.

## D094 — Persist Agent ADMIN session UX and repair Firestore job receive path

Status: **ACTIVE — OWNER DIRECTED 2026-09-21**.

Owner requires the Windows Agent to remember the verified ADMIN session across launches, expose explicit logout/replacement behavior, and repair the remaining PDA → Agent receive failure without changing the selected Firestore carrier.

1. The Agent continues to persist only the refreshable ADMIN application session/identity under Windows DPAPI CurrentUser. The plaintext ADMIN password is never persisted or logged.
2. Successful Agent ADMIN verification disables/dims the username/password/login controls, enables **Đăng xuất**, and shows the Agent verification-login state on **Tổng quan**.
3. Startup restores the DPAPI session automatically, refreshes Firebase ADMIN claims, and starts the relay without manual re-entry while the saved session remains valid.
4. **Đăng xuất** stops relay participation, clears the saved Agent application session and local exit verifier, then re-enables login. The next successful ADMIN login replaces the saved identity/session.
5. D093 field evidence showed the manual Firestore probe using the process/default Windows proxy path could PASS while the D093 per-request helper reported DIRECT and DNS/connect failures. D094 therefore restores the D091/manual-probe-proven **Windows default proxy path first**. A fresh system-proxy snapshot is only a bounded secondary attempt for safe Firestore reads. The WMS corporate fallback proxy remains forbidden for Firestore; no corporate filtering is bypassed.
6. ACTIVE Agent job receive no longer depends on an arbitrary first page of collection documents. It queries Firestore for current `PENDING + ANDROID_CONFIRM_V1` jobs directly, with a newest-first bounded list fallback and sanitized poll telemetry.
7. PDA surfaces a short Firestore request ID after CREATE so field logs can correlate PDA CREATE → Agent pending-found → conditional claim → ACK precisely.
8. D092 exact PickListCode, anti-spam, idempotency and the only-authorized `confirmSkipItem` WMS mutation contract are unchanged. Stable remains OWNER-GATED and untouched.

D094 supersedes OA014 as the next relay field gate because the released D093 artifacts did not complete the PDA → Agent receive path in the Owner's field test.

## D095 — Fix Firestore job visibility and preserve confirmation requests across Agent network transitions

Status: **ACTIVE — OWNER DIRECTED / FIELD ROOT CAUSE CONFIRMED 2026-09-21**.

The Owner physically tested released `relay-agent-v19` + `beta-vc58` and confirmed that confirmation requests still did not reach the Agent on either a normal Internet network or the company Office network. Sanitized PDA and Agent logs establish two independent causes:

1. PDA Firestore `CREATE` succeeds and the same Picker device continues normal Báo hàng successfully through the Worker/InventoryCore path. Therefore the normal Báo hàng path is not the confirmation failure.
2. While the Agent is ACTIVE and Firestore polling itself returns HTTP success, D094 can report `pending=0` for a newly created job because `JavaScriptSerializer.DeserializeObject()` returns JSON arrays as `IEnumerable/object[]`, while D094 incorrectly cast both `runQuery` and list fallback arrays to `ArrayList`. D091's field-PASS implementation used `IEnumerable`; D095 restores that correct parsing contract.
3. A second failure mode occurs during Agent network transition/outage: Android deleted a still-`PENDING` job after 30 seconds, while the Agent recovered Firestore later. D095 makes 30 seconds informational only and retains the request for the full bounded 120-second window. At the terminal boundary, Picker deletion remains conditional and may only delete a still-`PENDING` document; `PROCESSING` work is never deleted or automatically retried.
4. Agent safe Firestore reads use three bounded attempts across the Windows default proxy and a fresh current system proxy. The Agent refreshes the process default Windows proxy automatically on network-address changes. This is to support the same Agent binary on normal Internet and on the company Office network without introducing a separate carrier.
5. The architecture remains explicitly split:
   - **Báo hàng**: PDA Internet → Cloudflare Worker → InventoryCore/SQLite, unchanged.
   - **Xác nhận đơn**: PDA Internet → authenticated Firestore → ACTIVE Agent → Firestore ACK → originating PDA.
   - The Agent may be on normal Internet or Office; both consume the same Firestore carrier using the appropriate Windows network/proxy path.
   - The confirmation path must never fall back into the Báo hàng Worker mutation API, and the Báo hàng path must not depend on the Agent.
6. Firestore remains the selected carrier from D091 field PASS. D095 does not reopen RTDB, Cloudflare-as-confirmation-carrier, Apps Script, or direct PDA↔LAN transport selection.
7. D092 exact PickListCode resolution, anti-spam, conditional claim, cross-Agent idempotency and the only-authorized `confirmSkipItem` WMS mutation boundary remain unchanged.
8. Stable remains **OWNER-GATED** and untouched.

D095 supersedes OA015. A new physical gate must use the D095 released Agent/APK and confirm the same short request ID is visible from PDA CREATE through Agent `pending-found → CLAIM → ACK` on a normal Agent network and on the Office network before OA013 real WMS confirmation resumes.

## D095 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA016 PHYSICAL DUAL-NETWORK FIELD TEST PENDING; OA013 BLOCKED**.

- PR #115 merged to main `52aabdbd3a1eedfa96c6a525dd155b370e9d9138`.
- Main Repo Authority `35558582310`, Project State `35558582318`, Beta Worker `35558582419`, UI `35558582329`, Relay Agent `35558582311` and Android `35558582307` all PASS.
- Released Windows Agent: `relay-agent-v20`, release id `392682761`, EXE asset id `578161342`, size `224768` bytes, SHA-256 `4e1daa4dc154b7fa850199f1b700819085741cfc4d0311f31827df74cf9f1096`.
- Released signed Android: `beta-vc59`, release id `392682842`, APK asset id `578161552`, size `9340858` bytes, SHA-256 `5fb4422312cf4380a158cec9d12d1730dc184ea5a468def599edc15508ec8800`.
- OA016 is READY_FOR_OWNER_FIELD_TEST. PDA remains on normal Internet; Agent must receive the same Firestore confirmation path on both normal Internet and company Office network.
- Normal Báo hàng remains Worker/InventoryCore and independent of Agent.
- OA013 real Picklist/WMS confirmation remains blocked until OA016 PASS.
- Stable remains OWNER-GATED and untouched.

## D096 — Repair exact PickListCode resolution before WMS confirm

Status: **ACTIVE — OWNER FIELD ROOT CAUSE CONFIRMED 2026-09-21**.

Released D095 artifacts restored the PDA → Firestore → Agent path: the Owner confirmed PDA ↔ Agent is now working and Agent v20 field logs show `pending-found`, conditional claim and ACK. The remaining failure is inside the Agent's WMS confirmation pipeline.

1. Field logs show the Agent reaches the WMS exact-resolve GET and receives HTTP 200, but returns `EXACT_CODE_NOT_RESOLVED`; there is no `WMS picklist-confirm result=...` entry for those requests. Therefore the mutation POST is not reached.
2. Source inspection confirms the exact resolver duplicated the earlier array-parsing defect: `WmsPicklistLookup` correctly handles `JavaScriptSerializer` JSON arrays as `object[]`, while `WmsPicklistExactResolver.CollectCodes` accepted only `ArrayList`. A valid response can therefore contain the target `PickListCode` while the resolver observes zero codes.
3. D096 changes exact-code traversal to non-string `IEnumerable`, preserving dictionary traversal, exact `PickListCode` field matching, full-code validation, unique suffix match and fail-closed ambiguity handling.
4. D096 adds redacted exact-resolve parse telemetry with page/code counts and an executable CI regression that deserializes a synthetic WMS JSON array and proves one full code is extracted. No real PickListCode or session material is committed.
5. The Owner-provided successful browser request confirms the already-authorized confirm contract remains correct: one exact full PickListCode, `IsAllowSkipped=true`, `RemainSkip=1`, `WarehouseCode=HY1`, `EnableDCSite=false`, and a successful response contains business `Status=true`. Secret/session header values from the Owner file are never copied to the public repository.
6. Confirm success is hardened: HTTP 2xx is no longer sufficient by itself. Agent reports `CONFIRMED` only when the WMS response explicitly yields `Status=true`; `Status=false` is rejected and a 2xx response without a trustworthy Status fails closed as confirmation-uncertain.
7. D092 cross-Agent idempotency, conditional Firestore claim, anti-spam, exact full-code precondition and the single authorized `confirmSkipItem` mutation remain unchanged.
8. Android/PDA code does not change in D096. Signed `beta-vc59` remains the test APK; D096 targets Windows Agent v21 only.
9. Stable remains **OWNER-GATED** and untouched.

OA017 supersedes the WMS-stage portion of OA013 until released Agent v21 proves exact resolution → one authorized confirm POST → business `Status=true` → Firestore ACK on a real eligible Picklist.


## D097 — Quota-safe request-driven Agent HA and network-transition recovery

Status: **ACTIVE — OWNER APPROVED 2026-09-21**.

Owner approved the D097 design after physical logs proved that normal Internet and the company Office network can both reach Firestore, while Windows network transitions may temporarily expose stale DIRECT/DNS/proxy state before the Office proxy is ready.

1. Scope is strictly the Picker `Xác nhận đơn` Firestore transport/HA/quota path. Existing WMS session restore, exact PickListCode resolver, `confirmSkipItem` contract, D096 business-Status semantics, Báo hàng Worker/InventoryCore path, UI baseline and Stable are frozen unless a later explicit Owner decision changes them.
2. Design maximum is **120 Picker/day × 50 confirmation attempts = 6,000 requests/day**, including wrong entries, with up to **30 simultaneous requests**.
3. Agent roles are **PRIMARY / STANDBY / FROZEN**. Exactly one PRIMARY polls normal work. One STANDBY polls only for failover eligibility. Additional Agents remain FROZEN and do not poll the business queue.
4. Normal target is PDA → Agent → PDA within **10 seconds**. A request still unresolved at 10 seconds may trigger STANDBY takeover. The terminal automatic-processing window is **30 seconds**; after that PDA instructs the Picker to return to the specialist desk.
5. PRIMARY polls the bounded pending queue every **5 seconds**. STANDBY polls every **10 seconds** and may promote only when request age is at least **10 seconds**. FROZEN Agents do not poll the business queue.
6. The old Firestore 4-second leader heartbeat/write model is removed. Role assignment is conditional and request-driven. Presence is low-frequency support metadata only; it must not be used to create quota-heavy liveness traffic.
7. A temporary Firestore/DNS/proxy failure does **not** by itself demote the current role. Windows network-change events start a bounded transition state and staged system-proxy refresh. The next healthy business cycle revalidates role authority before new work.
8. After STANDBY takeover, the new PRIMARY may select a fresh WMS-ready Agent as replacement STANDBY from low-frequency presence metadata. The prior PRIMARY is excluded from immediate reselection for that takeover.
9. Job lifecycle is quota-safe **PENDING → ACK**. The old per-job `PROCESSING` claim write is removed. Concurrent/racing Agents are bounded by conditional ACK plus the cross-Agent full-PickListCode guard before any WMS mutation.
10. The confirmation guard is one durable Firestore create for first mutation authorization; successful idempotency is proven by the retained originating ACK instead of a second guard-confirm write. Uncertain mutation remains fail-closed and must never auto-retry.
11. Anti-spam business rules remain **3 final NOT_FOUND within 60s → lock 5/30/60 minutes**. Persisted state is idempotent by request id; FOUND clears wrong-input state without adding a new Firestore write.
12. Android uses one authenticated Firestore snapshot listener only for its own request document, with Firestore offline persistence disabled for this business path. It shows failover guidance at 10 seconds and terminal specialist guidance at 30 seconds.
13. D097 source guards target a free-quota envelope at the stated maximum: business writes are bounded toward 3/request worst-case plus low-frequency control overhead; reads use PRIMARY 5s + STANDBY 10s + one-document PDA listeners; FROZEN business polling is forbidden.
14. Requests older than the terminal window are not started as new WMS work. A job already inside the guarded mutation path remains fail-closed if its final state is uncertain.
15. Stable remains **OWNER-GATED** and untouched.


## D097 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA018 PHYSICAL FIELD TEST READY**.

- PR #119 merged to main `ad9bdbe32bc9d9c342b3a98d9fbb00846d8692af`.
- Main Repo Authority `35575186486`, Project State `35575186191`, Beta Worker `35575186212`, Firestore `35575186225`, RTDB guard `35575186237`, Relay Agent `35575186389`, UI `35575186226`, Android `35575186223` all PASS.
- Released Windows Agent: `relay-agent-v22`, release id `392777064`, canonical EXE asset id `578551644`, size `235008`, SHA-256 `e986f660935bc3d24f2c493a63902fb23ca6125bb327ad87ddc9ed95dfcd5a64`.
- Released signed Android: `beta-vc60`, release id `392777480`, APK asset id `578552971`, size `18998096`, SHA-256 `0c295a55fcd5e0ab6f2a9a1b9cd1d53d1fefba90c39187e9c74c7320a96853cc`.
- Firestore Rules plus the D097 pending-queue composite index deploy gate is PASS on main.
- OA018 is READY_FOR_OWNER_FIELD_TEST for normal→Office transition, request-driven STANDBY takeover and 30-second terminal specialist fallback.
- OA017 final real-WMS confirmation acceptance remains blocked until OA018 PASS.
- Stable remains OWNER-GATED and untouched.


## D098 — Unified Firebase identity, channel-isolated sessions, realtime repair and specialist Agent flow

Status: **OWNER APPROVED — SOURCE/PR CANDIDATE; TECHNICAL RELEASE NOT YET CLAIMED**.

1. Firebase Authentication is the credential/identity authority for ROOT, ADMIN, REPORTER and PICKER. InventoryCore remains the authority for user metadata, immutable/base role, effective role, ACTIVE/DISABLED state, business history and authorization projection.
2. A user may hold one active **WEB**, one active **ANDROID/App**, and one active **AGENT** session concurrently. A new login on the same channel must first warn; explicit continuation replaces only that channel. WEB replacement never revokes ANDROID/AGENT, ANDROID replacement never revokes WEB/AGENT, and AGENT replacement never revokes WEB/ANDROID.
3. Client eligibility is fixed: PICKER = App only; REPORTER = App + Web; ROOT = App + Web; ADMIN = App + Web + Agent. Agent requires a real immutable/base ADMIN identity; ROOT role simulation never qualifies.
4. Web/App keep MNV/username login UX. Existing PBKDF2-SHA256 password material may be imported to Firebase so migration does not require mass password resets. Firebase UID is stable and must not be rotated merely to invalidate sessions.
5. Agent ADMIN login goes directly to Firebase Auth and refreshes through Google/Firebase; Cloudflare Worker is not in the Agent login/runtime dependency path. This separates PDA↔Agent from the Báo hàng Worker path.
6. ROOT/ADMIN may register a recovery email and request Firebase password-reset email/link by matching user + registered email. REPORTER/PICKER do not require self-service email recovery; authorized management password-change paths remain.
7. Web realtime remains a hibernatable InventoryCore Durable Object WebSocket. It must use the same active V2 Web session authority as HTTP API, bounded delta recovery and jittered backoff; the legacy V1 session lookup is removed.
8. Inventory is allowed to consume at most **35% of each included Workers Paid $5 metric at design maximum**; 65% is reserved for other projects. The 35% rule is per metric, not an average. Normal usage should remain materially lower. Polling/reconnect/provider reads may not be added merely because the account is Paid.
9. Agent Overview contains Hệ thống Supra, Xác minh Agent, and the direct specialist PickList workflow. Settings contains connection tests, embedded Overlay settings, Nhật ký vận hành and Chẩn đoán kỹ thuật; there is no separate ADMIN-login settings page or “Mô hình hiện tại” card.
10. Specialist direct processing accepts 3–5 digits, searches those digits anywhere in cached full PickListCode values, requires explicit selection of the full PickListCode, then reuses the approved WMS confirmation guard and Status=true success semantics. It reports locally on Agent and does not create/ACK an Android request.
11. D097 PDA confirmation HA semantics remain frozen: PRIMARY 5s, STANDBY 10s, FROZEN no business polling, direct PENDING→ACK and fail-closed uncertain mutation.
12. Stable remains **OWNER-GATED** and untouched.


## D098 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA019 PHYSICAL FIELD ACCEPTANCE READY**.

- Runtime PR #121 merged to main `bbc2127fa345879c4603a5baaa48cc566150af0f`.
- Firestore deployment idempotency hotfix PR #122 merged to final main `2a7adb7cdb46c87801e166b240ab492259e92012`.
- D098 main evidence: Repo Authority `35609150988`, Project State `35609150982`, Beta Worker `35609150820`, UI `35609150711`, Relay Agent `35609150740`, Android `35609150827` all PASS.
- The first D098 Firestore main run `35609151046` failed only because Google returned `ALREADY_EXISTS` for the already-existing D097 composite index after pre-list detection missed it. Hotfix main Firestore run `35609800016` PASSes database check, idempotent index ensure and Rules deployment. Hotfix Authority `35609799333`, State `35609799216`, UI `35609799338` also PASS.
- Beta Worker health returned HTTP 200/status ok with SQLite schema **9/9**, Operational V2 **5/5** and no missing runtime bindings. Health success also proves active ADMIN Firebase migration had `failed=0` and `remaining=0`.
- Released Windows Agent: `relay-agent-v23`, release id `393009196`, EXE asset id `579157387`, size `249344`, SHA-256 `e8a7fc4b13e32bbfb50bb74e644d94ef30982bb44dcabce2f18a80406b0356f4`.
- Released signed Android: `beta-vc61`, release id `393009008`, APK asset id `579156894`, size `18998096`, SHA-256 `a25bf6d23123e7d96b489fd1265834ae4587850e584376f7442c0494e2b664b2`.
- D098 Cloudflare budget CI PASS under the conservative approved model. Highest modeled included-metric use is Durable Object requests at **31.20%**, below the Owner ceiling of **35%**.
- OA019 consolidates D098 identity/realtime/specialist acceptance with the still-unproven physical D097 normal→Office, STANDBY takeover and 30-second fallback scenarios. OA018 is superseded by OA019; OA017 remains blocked until OA019 PASS.
- Stable remains **OWNER-GATED** and untouched.


## D099 — Repair Firebase password sign-in authority and make Agent auth-first

Status: **OWNER DIRECTED 2026-09-21 — ROOT CAUSE CONFIRMED / PR #124 ACTIVE**.

1. Physical Owner evidence showed every Web/App/Agent login returning `INVALID_CREDENTIALS` immediately after D098.
2. D099 CI readback confirmed Beta Identity Platform had `signIn.email.enabled=false` and `signIn.email.passwordRequired=false`. D098 had already moved credential verification to Firebase `signInWithPassword`, so this provider configuration mismatch is the shared outage root cause.
3. Beta main deploy must ensure Email/Password sign-in is enabled and password-required, read it back, then run an ephemeral synthetic PBKDF2-SHA256 100,000-round import → `signInWithPassword` → cleanup probe. A green health/migration marker alone is no longer sufficient authentication acceptance.
4. Web/App continue using username/MNV + password through Inventory Worker identity resolution. If a migrated Firebase hash cannot verify but the supplied password still matches the canonical InventoryCore PBKDF2 hash, the Worker may set that same password natively in Firebase once and retry. Plaintext exists only for that request and must never be persisted/logged.
5. Agent remains Cloudflare-independent. Because Firebase password sign-in is email-address based and the Agent intentionally has no Worker username→email lookup on Office, Agent login uses the **registered ADMIN email + password**. Username-only Agent login is not authoritative.
6. Agent Overview order becomes **Xác minh Agent → Hệ thống Supra → Xử lý PickList trực tiếp**. Supra controls/session restore/capture remain disabled until a valid ADMIN Agent session is restored or logged in.
7. Pressing Enter in Agent ADMIN email/password invokes Login. Pressing Enter in the Agent 3–5 digit PickList input invokes Search when valid. Android login also accepts keyboard Enter/Done as Login; Web form-submit behavior remains.
8. Overlay no longer has the legacy 420×64 minimum. D099 allows a practical minimum 120×32 and large configurable bounds up to 7680×4320; runtime and settings UI use the same range.
9. D097 HA, D096 WMS confirmation semantics, normal Báo hàng flow and Stable are otherwise unchanged. Stable remains OWNER-GATED.


## D100 — Username Agent auth + ROOT system reset

Status: **OWNER APPROVED — SOURCE/PR CANDIDATE 2026-09-21**.

1. Agent login UX is **ADMIN username/MNV + password**, never registered email. Email remains recovery/OTP metadata only.
2. Agent must remain independent from Inventory Cloudflare Worker on the Office network. D100 keeps **one Firebase UID per logical user** and uses the same deterministic username-derived Firebase password identifier for Web/App and direct Agent sign-in. Agent accepts only real ADMIN claims; ROOT/REPORTER/PICKER never gain Agent authority.
3. Web, App and Agent share the same Firebase UID and password authority. The Firebase sign-in email is an internal deterministic value derived from role + username/MNV; the registered real email is separate recovery/OTP metadata and is never required as the Agent login name.
4. Beta health must fail until all ACTIVE ADMIN users have the shared Firebase credential and direct Agent-username path ready. Schema target advances to 10 only for additive Agent-readiness state; this flag does not represent a second Firebase account.
5. Web `HỆ THỐNG → Công cụ` must derive Agent version/tag/download URL from canonical `relay-agent/VERSION`; hard-coded historical Agent tags are forbidden.
6. Only a real effective ROOT sees/uses `HỆ THỐNG → Đặt lại hệ thống`.
7. System reset means **selected runtime data goes to zero**. It never changes source code, schema/table definitions, business rules, workflows, UI design system, GitHub, Stable, company WMS, or external Google Sheet/Drive contents.
8. ROOT identity is outside reset scope: ROOT app/Firebase identity, password and recovery email remain unchanged. D100 also preserves ROOT active session/device records during reset.
9. Reset groups: Picker accounts, Reporter accounts, Admin accounts, SKU Master, open Báo hàng, business history, service logs, non-ROOT sessions/devices, runtime settings metadata, and optional confirmation-relay Firestore data. `Xóa toàn bộ` is only a UI shortcut selecting all approved groups.
10. Picker/Reporter/Admin account reset deletes corresponding InventoryCore users and their single Firebase Auth identities. Google Sheet HR source rows are never deleted.
11. History/log reset affects InventoryCore data only. Existing Drive/Sheet archive/log/export files are never deleted by System Reset.
12. Confirmation-relay reset deletes only the registered Beta Firestore relay collections and is blocked while any relay job remains `PENDING`.
13. Destructive execution requires both: (a) current ROOT password re-authentication and (b) a one-time 6-digit code sent to ROOT's registered email. Code lifetime is 10 minutes, maximum 5 attempts, and challenge sending is rate-limited.
14. OTP mail uses the existing Beta Google OAuth client with additive `gmail.send` only; no Gmail read scope is authorized. Existing Drive scope remains. If the current refresh token lacks the new scope, one Owner OAuth re-consent is required.
15. Reset is on-demand only and must not add polling/background quota consumption.
16. ROOT/ADMIN password recovery uses the registered real email: user + email request is enumeration-safe, the project sends a single-use 15-minute link through Gmail `send` scope, and the new password updates the same Firebase UID plus InventoryCore credential/session authority. Firebase synthetic sign-in addresses are never recovery destinations.
17. Stable remains **OWNER-GATED** and untouched.


## D100 release checkpoint

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA019 + OA020 OWNER FIELD ACCEPTANCE READY**.

- Implementation PR #126 merged to main `8a769808b5c8c28fe76bbb2d31c5ec013265c148`.
- Released Windows Agent: `relay-agent-v25`, canonical EXE SHA-256 `98b639eeaaa28c138cd531a1d5b062704c9552f7337a214afe6ee643dfa9d132`.
- Android remains the signed D099 `beta-vc62` because D100 did not change Android runtime/UI.
- D100 deploy-proof hardening main `2cf23d9229eb4bd5d9c45f3776bb2404ef06a68f` exposed a CI-only parser defect: the runtime itself returned HTTP 200/status ok, source commit exact, SQLite schema 10/10, Agent-auth migration 0/0 and Operational V2 5/5, but source_schema was parsed as literal `\1`.
- Parser hotfix PR #128 merged final main `dc5607a91c9b95e05344673daaa983c7d8bf5b86`.
- Final main evidence PASS: Repo Authority `35628075270`, Project State `35628075428`, UI Design Guard `35628075239`, Beta Worker `35628075330`.
- Corrected health proof PASS: attempt 2 had exact source commit `dc5607a91c9b95e05344673daaa983c7d8bf5b86`, schema `10/10`, `source_schema=10`, Agent migration `0 failed / 0 remaining`, Operational V2 `5/5`.
- Web Tools follows canonical Agent version and therefore points to Agent v25 rather than a hard-coded older release.
- Agent login is ADMIN username/MNV + password on the same Firebase UID as Web/App; registered real email is recovery/OTP metadata only.
- ROOT-only System Reset is deployed: scoped runtime/service/Firebase data-to-zero only, no source/schema/UI/logic change, ROOT identity/password/recovery email preserved, external Google Sheets/Drive untouched.
- Reset challenge requires current ROOT password + six-digit email OTP. Actual Gmail delivery and destructive reset execution are Owner-field-only under OA020. If the existing refresh token lacks `gmail.send`, exactly one bounded OAuth re-consent is required.
- OA019 physical Agent/PDA/WMS acceptance must use `relay-agent-v25` + `beta-vc62`.
- Stable remains **OWNER-GATED** and untouched.
## D101 — Agent vận hành, PickList cache, log và layout v26

Status: **OWNER APPROVED — SOURCE CANDIDATE 2026-09-22**.

1. Cả hai đường tìm PickList — PDA gửi 5 số và chuyên viên tìm 3–5 số trực tiếp trên Agent — đều dùng nguyên tắc **cache hit trả ngay; cache miss bắt buộc refresh snapshot WMS một lần rồi mới được kết luận NOT_FOUND**. Kết quả NOT_FOUND trước refresh chỉ là tạm thời và không được tính là sai đầu vào.
2. Refresh PickList tiếp tục dùng single-flight để các cache miss đồng thời dùng chung một lần GET WMS, không nhân số lần tải theo số PDA/Agent.
3. Agent đang chạy phải tự kiểm tra GitHub Release nền và tự cập nhật nếu có bản mới; không cần chờ khởi động lại để mới kiểm tra. GitHub không có kênh push trực tiếp vào EXE portable, nên D101 dùng kiểm tra nền mỗi **30 phút** cộng với kiểm tra lúc khởi động; checksum và trusted-release-origin guard hiện hữu vẫn bắt buộc.
4. Màn PickList trực tiếp hiển thị mỗi full PickListCode theo một hàng và có nút **Xác nhận** ngay trên chính hàng đó. Bỏ nút xác nhận chung bên ngoài danh sách.
5. Agent đổi tên vùng **Xác minh Agent** thành **Hệ thống Agent** và hiển thị rõ phiên bản, tài khoản, máy, vai trò máy hiện tại, trạng thái Firestore, số Agent online theo PRIMARY/STANDBY/FROZEN, cơ chế failover và trạng thái update.
6. `Hệ thống Supra` hiển thị tối thiểu kho HY1, API host, trạng thái phiên WMS, số PickList đang cache và thời điểm cache gần nhất. Auth-first gating vẫn giữ nguyên.
7. Tên mạng hiển thị trên Agent phải là SSID Wi-Fi Windows thực tế khi có. Sanitizer không được nhầm chuỗi `ssid=` với credential `sid=`; secret/token vẫn phải được redaction như cũ.
8. HA giữ nguyên D097 request-driven để bảo vệ Firestore quota: PRIMARY xử lý ngay, STANDBY chỉ takeover khi có job chờ đủ 10 giây, FROZEN không poll nghiệp vụ. Không có PDA gửi việc thì hệ thống không tạo heartbeat 10 giây chỉ để chứng minh PRIMARY sống. UI phải hiển thị rõ số PRIMARY/STANDBY/FROZEN để tránh hiểu nhầm.
9. Số Agent hiển thị dùng presence đã có với đọc bounded thấp tần suất; không được thêm polling quota-heavy. Web `Người đang online` chỉ tính **WEB + ANDROID/PDA**, tuyệt đối không cộng Agent.
10. Log Agent chuyển sang file local rolling theo dung lượng: technical và PDA-Agent audit mỗi stream tối đa khoảng **2 MiB/file**, giữ tối đa **4 file đã rotate + 1 file hiện hành**, không tạo file mới chỉ vì process restart.
11. Agent tự gửi bundle log đã sanitize vào `Inventory/Beta/Logs` theo mốc **06:00, 12:00, 18:00, 00:00** giờ Việt Nam. Agent không giữ Google OAuth secret; nó ghi spool bounded vào Beta Firestore bằng ADMIN Firebase token, Beta Worker dùng OAuth Drive hiện có để chuyển spool sang Drive rồi xóa spool thành công.
12. Crash/FATAL phải tạo upload ngay theo best effort; nếu chưa gửi được thì giữ marker pending và gửi lại ở lần Agent có phiên hợp lệ tiếp theo. Tên file crash có tiền tố `crash_`.
13. Đăng xuất Agent bắt buộc có hộp xác nhận trước khi xóa phiên Agent/Supra local.
14. Bỏ top-level tab **Cài đặt**. Các mục Kết nối, Bảng nổi, Nhật ký vận hành và Chẩn đoán kỹ thuật được đưa thành tab trực tiếp ngang hàng với Hệ thống Agent, Hệ thống Supra và Xử lý PickList.
15. D101 target Windows release là **relay-agent-v26**. Android nghiệp vụ xác nhận và Báo hàng không đổi; Stable vẫn **OWNER-GATED** và không bị chạm.

### D101 release checkpoint — 2026-09-22

D101 is technically released on Beta. PR #136 merged at `25cb7554ff7ea058aa45d72e1ba4824c744c354e`; all main authority/state/Worker/Firestore/UI/Android/Agent gates passed. Windows release `relay-agent-v26` is published with canonical EXE SHA-256 `5db50633e74247b45305a536a6caf140069626db66a7020acf32cf2d216ff79b`. Android remains `beta-vc62`. OA021 physical Owner acceptance remains open; Stable is untouched.
## D102 — Agent v27 Tổng quan, hội tụ vai trò và khung vận hành đêm

Owner approved on 2026-09-22.

1. Agent adds a visible **Kiểm tra cập nhật** action using the same trusted GitHub prerelease + SHA-256 verification path as background auto-update. Startup + 30-minute background checks remain.
2. D101 over-split the Agent shell. D102 restores one top-level **Tổng quan** page containing **Hệ thống Agent**, **Hệ thống Supra** and **Xử lý PickList** as sections. Other direct tabs remain **Kết nối / Bảng nổi / Nhật ký vận hành / Chẩn đoán kỹ thuật**. There is no top-level Cài đặt tab.
3. User-facing Agent copy must not expose AI/Owner/D-number/internal implementation wording. Instructions are concise; operational state is primary.
4. Multi-Agent authority remains one role document: at most one PRIMARY and one STANDBY; other eligible Agents are FROZEN. D097 business semantics are unchanged: PRIMARY polls 5s, STANDBY 10s, pending-job takeover at 10s, FROZEN does not poll business work, and D096/D097 idempotency/fail-closed confirmation guards remain mandatory.
5. Role convergence is accelerated without restoring quota-heavy heartbeat: PRIMARY/STANDBY role refresh = 60s, FROZEN role refresh = 5m, plus four startup convergence reads at 5s spacing. Presence write = 15m, fleet read = 30m, presence freshness = 40m; opening Tổng quan may request an immediate bounded fleet refresh. Presence is observability metadata, not a business liveness heartbeat.
6. Hệ thống Agent may show a bounded fleet table with account, machine, effective role, Supra readiness, Agent version and last-seen age. Effective PRIMARY/STANDBY labels are derived from the authoritative role snapshot; machine CPU/RAM remain local-only.
7. Daily after-hours policy uses Asia/Ho_Chi_Minh time. From **21:30**, if that night's decision is missing, Agent warns immediately and repeats every **5 minutes** until the user confirms. Choices are **continue after 22:00** or **stop business processing from 22:00**.
8. If no continue confirmation exists at 22:00, Agent pauses business polling and manual PickList business actions until confirmation or 05:00. A later continue confirmation resumes processing. A stop confirmation suppresses further prompts for that night. At 05:00 normal business processing resumes automatically.
9. “Stop” in the 22:00–05:00 policy means **pause Agent business processing**, not terminate the EXE. Logging, updater, tray UI, watchdog and local scheduling remain alive so 05:00 recovery is deterministic.
10. Target release is **relay-agent-v27**. Android/Web business flows are unchanged by D102. Stable remains OWNER-GATED and untouched.

### D102 release checkpoint — 2026-09-22

D102 is technically released on Beta. PR #138 merged at `637d7509bcc66f4b57aba4bf4a415cb05c30903d`. All PR authority/state/UI/Agent/Rules gates and all main authority/state/UI/Agent gates passed. Windows release `relay-agent-v27` is published with canonical EXE SHA-256 `322159ed214be13d5340fd2a8a826b02232627aa016711c2a46492da1cc819e4`; the release tag resolves exactly to that main commit. OA022 physical Owner acceptance remains open. Android stays `beta-vc62`; Stable is untouched.

## D103 — Agent v28 dense Overview correction

Owner approved on 2026-09-22 after field review of relay-agent-v27.

1. Agent main window opens maximized by default and restores from System Tray maximized.
2. Tổng quan must fit the normal laptop viewport without page scrolling. Hệ thống Agent and Hệ thống Supra use bounded fixed-height sections; Xử lý PickList occupies the remaining lower area and remains visible without scrolling the Overview page.
3. Agent fleet table shows at most five visible data rows at once. Additional online Agents remain in the same table and are reached by the table's own vertical scrollbar; the fleet table must not grow the Overview page.
4. Manual PickList results keep one row per full PickListCode and each row owns its own visible Xác nhận button. There is no shared confirm button.
5. Remove verbose/internal guidance from the Overview. In particular, persistent explanatory lines for Agent version/Firestore/failover/background-update internals and local WMS protection/cache implementation are not displayed. Keep only compact operational state needed by the user.
6. Hệ thống Supra is compact: current Supra/WMS state, HY1/session/cache summary and the necessary action buttons only.
7. D102 HA, 21:30/22:00/05:00 schedule, updater security, D096/D097 confirmation guards and Android/Web business behavior are unchanged.
8. Target Windows release is relay-agent-v28. Stable remains OWNER-GATED and untouched.

### D103 release checkpoint — 2026-09-22

D103 is technically released on Beta. PR #140 merged at `15aba0412e625af0f6b9ef7489b995a3e524a131`. All PR and main authority/state/UI/Agent gates passed. Windows release `relay-agent-v28` is published with canonical EXE SHA-256 `4faf8507637d61d74ac8aa34ba998a1fc04bfacd0fdc572af1cabda5f8bb8cb1`; the release tag resolves exactly to that main commit. OA023 physical Owner acceptance remains open. Android stays `beta-vc62`; Stable is untouched.

## D104 — Agent v29 taskbar-safe maximum, multi-search and batched PickList confirmation

Owner approved on 2026-09-22 after accepting the D103/v28 field layout.

1. D103/OA023 is Owner-accepted. Agent remains maximized by default and when restored from tray, but its maximum bounds must use the active Windows working area so the Windows taskbar remains visible.
2. Manual specialist search accepts one to ten comma-separated search fragments. Each normalized fragment is 3–5 digits; whitespace is ignored and duplicate fragments are removed. Example shape: `0404, 39050, 403`.
3. Multi-search is quota/WMS-safe: all fragments are evaluated against one cached PickList snapshot. If any fragment has no cached match, all fragments share at most one existing single-flight WMS snapshot refresh before the final union is returned. The visible result union remains deduplicated and bounded to 50 rows.
4. Existing row-specific Xác nhận remains. When the visible result count is at least two, a conditional **Xác nhận tất cả** action appears; it confirms exactly the full PickListCodes currently displayed.
5. The authorized WMS mutation contract is extended only for the existing `confirmSkipItem` endpoint: one POST may carry a bounded array of 1–10 already-resolved exact full PickListCodes with the existing fixed flags `IsAllowSkipped=true`, `RemainSkip=1`, `WarehouseCode=HY1`, `EnableDCSite=false`. No other WMS mutation is authorized.
6. Every exact full PickListCode still acquires its own cross-Agent Firestore confirmation guard before being included in a WMS batch. Already-confirmed, in-progress or uncertain codes are excluded from mutation. A batch with uncertain outcome remains fail-closed and must not be blindly replayed.
7. Concurrent PDA jobs are coalesced from the jobs already returned by the existing Firestore poll; do not add faster polling or an extra micro-batch query. Process at most the existing 12 eligible jobs per logical batch, share cache lookup and one exact-resolve WMS scan, then issue WMS confirmation chunks of at most 10 codes. Per-job conditional ACK remains required because each PDA owns its own document.
8. D097 PRIMARY 5s / STANDBY 10s / 10s failover, FROZEN no-business-poll, D102 night schedule, D096 `Status=true` success requirement, anti-spam, idempotency and Stable OWNER-GATED state remain unchanged.
9. The Owner-supplied curl is reference evidence for the multi-code payload shape only. Raw Authorization/APISID/SID/Token/signature/session values are runtime secrets and must never be committed or logged.
10. Target Windows release is `relay-agent-v29`. Android/Web business flows are unchanged.

### D104 release checkpoint — 2026-09-22

D104 is technically released on Beta. PR #142 merged at `e1fa990aefa47ad81b063fc0ca27516c1cace5f8`. All PR authority/state/UI/Agent/Rules gates and all main authority/state/UI/Agent gates passed. Windows release `relay-agent-v29` is published with canonical EXE SHA-256 `10304ac734218146550c6bdf3c3b8a81d979fabe5b3ee7dddc94f1b217955b2d`; the release tag resolves exactly to that main commit. OA024 physical Owner acceptance remains open. Android stays `beta-vc62`; Stable is untouched.

## D105 — Android four-digit PickList UX and Agent v30 suffix update

Owner approved on 2026-09-22 after explicitly accepting D104/OA024 as PASS.

1. Picker Android `Xác nhận đơn` now requires exactly **4 numeric trailing PickList digits** instead of 5. The current APK must not require a fifth digit before enabling submit.
2. While a confirmation request is in flight and no terminal result has returned, `XÁC NHẬN LẤY LẠI ĐƠN` is disabled and visually dimmed. Editing the input during an in-flight request must not re-enable the button or create a second request.
3. Terminal confirmation results are visually prominent: larger bold text. Confirmed success uses the approved success color; failure/exception/lock results use an error color. Helper/progress text remains smaller so the terminal result is unmistakable.
4. New Android jobs send exactly 4 digits. Firestore Rules and Agent ingress may accept 4 or 5 digits temporarily so already-installed `beta-vc62` devices do not break during rollout, but the new APK UI itself is four-digit only.
5. PDA lookup and exact resolution compare the trailing number of digits actually supplied. For new four-digit jobs, Agent compares exactly the trailing 4 digits of full `PickListCode`. If zero or multiple full codes match, existing fail-closed behavior remains; no WMS mutation is allowed.
6. Specialist Agent manual search becomes **3–4 digits** per comma-separated term. Five-digit manual search is no longer accepted. D104 multi-search, row-level confirmation and conditional `Xác nhận tất cả` remain unchanged.
7. D104 batching, D097 HA/polling, D102 night schedule, D096 `Status=true` success rule, per-code guard, per-job ACK, anti-spam and Stable OWNER-GATED state remain unchanged.
8. Target releases: Android `beta-vc63` and Windows Agent `relay-agent-v30`. Web business flow is unchanged.

### D105 release checkpoint — 2026-09-22

D105 is technically released on Beta. PR #144 merged at `e73206dea01e4c599d19abe040ffc8662b8836bf`. Main authority/state/UI/Android/Agent/Firestore/Worker gates passed. Android release `beta-vc63` has APK SHA-256 `add6716668f13e5f96a8b6b9cdfddba27db4270e990a4f3f7d92c373fadd5295`; Agent release `relay-agent-v30` has canonical EXE SHA-256 `18cf58622cde42d7ae7c58a57615139913caa9c3dbd2718bd2b1348182f765ad`. Both release tags resolve exactly to the D105 main commit. OA025 physical Owner acceptance remains open. Stable is untouched.

## D106 — managed-account creation and Agent password readiness

- A Web-managed ADMIN/REPORTER account is not considered successfully created until its same Firebase UID has a native Firebase password written and a direct Firebase Email/Password sign-in verifies that exact UID.
- InventoryCore PBKDF2 password material remains canonical migration/bootstrap material, but create/reset must not rely on imported-hash compatibility for direct Agent login when the plaintext password is already present in the authorized request.
- If InventoryCore creation succeeds but Firebase provisioning fails, the service must compensate: delete the partially provisioned Firebase UID where safe and roll back the just-created business account. A failed create must not silently leave an ACTIVE account that appears only after reload.
- ADMIN password reset/update must make the same shared Firebase UID immediately usable by Web/App/Agent before firebase_password_ready / firebase_agent_ready are marked ready.
- Password plaintext remains request-only and must never be persisted, returned, committed or logged.
- Existing accounts whose last password operation happened before D106 may require one new password set after the D106 Beta deploy because plaintext cannot be reconstructed from stored hashes. Stable remains OWNER-GATED and untouched.
## D107 — Professional Web identity, visual system and richer operational reporting

Owner approved on 2026-09-22 as a new Web requirement after the D089 baseline.

1. The Web login identity is exactly **CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN** + **Website nghiệp vụ Inventory**. The legacy `1291` square/text brand on the Web login surface is removed and replaced by the exact D089 shared `app-icon.png` asset already used by Web/Android/Agent.
2. The existing business logic, scenario flow, RBAC, three-group navigation, realtime semantics, quota guards and online-only rules are preserved. D107 is a Web presentation/reporting refinement, not a business-logic rewrite.
3. Web uses one final professional presentation layer across login and authenticated modules: restrained corporate blue/neutral hierarchy, consistent cards/panels/forms/tables, stronger selected/focus states, coherent light/dark theme, dense desktop use of space and responsive fallback.
4. Admin/Root `Tổng quan & báo cáo` becomes more information-dense using **already-authoritative data only**: current pending SKU/affected Picker/warning/overdue/online status; period report/SKU/affected-Picker/resolved/average-time metrics; result mix; recurrence; timeline comparing reports and resolved work; and top-SKU drill-down.
5. `Báo cáo chi tiết` adds a richer summary, current warning/overdue view, result mix, clearer pagination position and open-ticket/total-ticket columns while retaining current bounded filters, pagination and Excel export.
6. D107 adds no new provider monitoring, polling loop, backend datastore or analytics authority. It must not reintroduce D072 system-status polling, employee scoring, inventory quantity/bin/location metrics or unbounded reads.
7. D089 remains the accepted shared-icon and cross-product identity baseline. D107 supersedes only conflicting **Web** visual presentation details. Android/Agent are unchanged. Stable remains OWNER-GATED and untouched.

### D107 release checkpoint — 2026-09-22

D107 source and PR gates are PASS. PR #149 head `acdec3bb8e0b8a0793da6127a35952e014f58655` passed Repo Authority run `35729564644`, Project State run `35729564770`, UI Design/Web production build run `35729564681`, Beta RTDB Rules run `35729564684` and Beta Firestore Relay run `35729564631`. It was squash-merged to main `4e733535ef0abe893681afdf288097767141b115`.

The repository's existing `Deploy Beta Worker` workflow automatically applies to `main` pushes that change `web/**`, so the D107 merge enters the normal Beta deployment path without Owner action. Current connected GitHub tooling does not enumerate main push-triggered workflow runs, so this checkpoint does **not** fabricate an exact Beta runtime PASS. Final D107 visual acceptance remains OA027 on live Beta. Stable is untouched and OWNER-GATED.

## D107 Owner acceptance — 2026-09-23

Owner explicitly confirmed the D107 Web identity/professional reporting result as PASS before requesting D108. OA027 is closed PASS. D107 remains the accepted Web presentation baseline and D108 supersedes only the specific Web/App points below.

## D108 — Web resolution provenance + dense Picker shortage UI

Owner approved on 2026-09-23.

1. Password recovery on the Web login screen is collapsed by default. The email/account reset form must become visible only after the user explicitly presses **Lấy lại mật khẩu**; CSS must not override the HTML `hidden` state.
2. Operational results and Admin/Root reporting must distinguish **human resolution** from **automatic timeout resolution**. A Skip caused by D070 timeout is visibly labeled as system automatic because Invent/Reporter did not respond before the configured deadline. Human `Đã có hàng` / `Cho phép bỏ qua` results show the resolving account, preferring display name + employee/account code. System timeout shows **Hệ thống**, never fabricating a person.
3. Dashboard/reporting source breakdown reuses existing authoritative `resolution_source` and `resolved_by_user_id`; it adds no new polling, provider monitoring or unbounded analytics.
4. Picker Android shortage input is numeric-only. The redundant **Quét hoặc nhập SKU** label is removed. SKU input and shortage action share one horizontal row; hint is **Nhập tối thiểu 3 chữ số SKU** and action text is **Xác nhận**.
5. SKU suggestions start from three digits. After a suggestion/exact SKU is selected, the dropdown is cleared/dismissed and does not return until the user edits the value away from the selected SKU. The selected-SKU block uses a distinct background. The shortage confirmation action is full-emphasis only when a valid SKU is selected and the existing online/mutation gate permits submission.
6. Picker does not display automatic-Skip deadline clock/time. It may still truthfully state that a completed result was automatic due to timeout.
7. Picker history title is **Danh sách SKU đã báo hết hàng**. Status rows use light semantic backgrounds: Có hàng green, Đang xử lý yellow, Skip red, Picker thu hồi grey.
8. Picker header adds **A− / A+** controls beside Log. The setting changes Picker text/input scale within a bounded range and is persisted locally **per authenticated user on that device**, so logout/login to the same device restores that user's selected scale without adding server quota.
9. Existing Báo hàng business semantics, withdrawal window, realtime/result acknowledgement, D105 confirmation-order flow, D097 Firestore HA, Android update gate and all Stable guards are unchanged.
10. Target is the next monotonic signed Beta Android release after `beta-vc63` (expected `beta-vc64`) plus the normal Beta Web/Worker deployment. Stable remains OWNER-GATED and untouched.

### D108 release checkpoint — 2026-09-23

D108 is technically released on Beta. PR #151 merged to main `441f3c687ad2ef94ecc6017b8fa9846e9b34a7a2`. PR gates passed: Repo Authority `35800721747`, Project State `35800721763`, UI Design `35800721806`, Verify Beta Android `35800721751`, Firestore `35800721771`, RTDB `35800721768`.

Test-only PR #152 was closed unmerged after live proof run `35801069626` / job `106991287965` passed on attempt 1: HTTP 200, environment Beta, exact live source `441f3c687ad2ef94ecc6017b8fa9846e9b34a7a2`, storage ready, schema 10/10, missing bindings 0, Agent auth migration 0/0. The signed `beta-vc64` tag resolves and contains the D108 Picker source. The existing release workflow publishes an APK checksum asset, but its release-asset metadata is not exposed through the current connected GitHub surface, so no checksum is fabricated here.

OA028 is READY_FOR_OWNER_FIELD_TEST. Stable remains untouched and OWNER-GATED.

## D108 Owner acceptance — 2026-09-23

Owner explicitly confirmed the D108 Web + signed Android result as PASS before opening D109. OA028 is closed PASS. D108 remains the accepted baseline except where D109 explicitly supersedes presentation/preferences below.

## D109 — Web audit/preferences/PDA tools + Android compact tabs/header/time labels

Owner approved on 2026-09-23.

1. Web `Tổng quan` defaults to **Hôm nay** when the authenticated user has never selected another range. Once that user explicitly chooses another range, the selected `from/to` range is persisted **per user account** and restored for that user. It must not become one shared range for all users.
2. `Thời gian xử lý` remains one **global server-authoritative configuration** for the whole system. No browser/user-specific SLA copy is allowed. Saving SLA must notify/reconcile other active Web operator/admin views without adding quota-heavy polling.
3. Admin/Root Web adds a bounded **Lịch sử thao tác** view under `Nhật ký`. It records/displays meaningful actions by `REPORTER`, `ADMIN`, and `ROOT`; Picker activity is excluded from this management audit view. Audit metadata must remain sanitized and must never expose password/token/credential material.
4. Web `Tổng quan` additionally exposes recent `HAS_STOCK` / `SKIP_ALLOWED` results with the resolving account identity where a human acted. `SYSTEM_TIMEOUT` is shown as **Hệ thống**, never as a person.
5. `HỆ THỐNG → Công cụ` adds a professional **App PDA** card. It shows current release metadata and generates a QR code to one stable project URL that dynamically resolves to the latest published `beta-vcN` APK asset. The QR/link must not hard-code a version number and must not embed secrets.
6. Dynamic PDA download lookup may query only the canonical public GitHub repository release API, on explicit Tools-page/API access, with bounded in-memory caching. It must not create a background provider polling loop.
7. Android Picker header is made materially shorter/dense while preserving readable identity text; long text may auto-size/wrap rather than forcing the old fixed-height header.
8. Android Picker display controls are ordered **A−, A+** beside each other; Log remains a separate control after them.
9. `Báo hết hàng` and `Xác nhận đơn` are presented as a compact **bottom tab bar**, not button-style actions. Opening the soft keyboard must not push that bottom tab bar upward and consume additional application layout height.
10. Picker shortage-history time copy contains no date. It uses `Báo hết lúc: HH:mm`; a human Invent/Reporter resolution uses `Invent phản hồi lúc: HH:mm`. Automatic timeout and Picker withdrawal may use truthful actor-specific time labels while still remaining time-only.
11. Existing D105 four-digit confirmation, D108 numeric SKU/search/semantic cards/per-user scale, realtime acknowledgement, withdrawal, quota guards, Agent/WMS behavior and Stable OWNER-GATED state remain unchanged.
12. D109 advances the Beta SQLite source schema additively only for audit actor-role/display-name columns. Existing business data remains preserved during migration. Target Android release is the next monotonic signed Beta release after `beta-vc64`.

## D109 Owner acceptance — 2026-09-23

Owner explicitly confirmed all D109 live Beta Web and signed Android `beta-vc65` field items as **PASS** after the final main checkpoint and UI guard completed.

- OA029: **PASS_OWNER_CONFIRMED_D109**.
- Accepted Web baseline: per-user Dashboard date persistence, global shared SLA settings, Reporter/Admin/Root audit history, recent resolver identity, and dynamic latest-App-PDA QR/download tooling.
- Accepted Android baseline: signed `beta-vc65`, compact header, adjacent A−/A+ controls, stationary bottom operation tabs, and time-only shortage-history labels.
- Technical/runtime baseline remains main source `367d518d5e76ce5f7c0776ff8f6a3857ef2a9f94`, SQLite schema `11/11`, and signed APK SHA-256 `3e2b5284ac2ed5d3040c36338a5bdb21026958eda7e4d4a12b40ea9bf6c0ea48`.
- Final runtime-record checkpoint PR #155 merged at `5d3990b5a659225ecd92d4d0281ace23330fc06b`; post-merge Repo Authority and Project State guards passed, and UI Design Guard run `35811103699` passed.
- No D109 Owner field gate remains. Future work starts from this accepted Beta baseline unless the Owner explicitly supersedes it.
- Stable remains OWNER-GATED and untouched.

## D110 — Android Reporter pinned workflow, live SLA clock and App role gate

Owner approved on 2026-09-23.

1. Android Reporter reuses the accepted compact App/PDA shell and keeps its operational tabs pinned directly below the user/header area.
2. Reporter has exactly four visible tabs: **Đang xử lý**, **Đã có hàng**, **Cho phép skip**, **Picker đã thu hồi**. Every tab shows an order-count badge at its upper-right corner; values above 99 may render as `99+`.
3. Tab meaning follows the existing Web/service states: pending queue, `HAS_STOCK`, `SKIP_ALLOWED`, and `CLOSED`/Picker withdrawal. Counts are authoritative service totals, not merely the number of currently rendered rows.
4. In **Đang xử lý**, **Đã có hàng** and **Cho phép skip** are visible directly below the SKU. Pressing either button executes that resolution directly; Android must not open the old pre-resolution confirmation dialog. The selected batch is locally disabled while its mutation is in flight to prevent duplicate taps without blocking unrelated rows.
5. Reporter pending cards use a restrained semantic SLA background: normal white, warning light yellow, overdue light red. Server timestamps remain authoritative.
6. Elapsed waiting minutes advance locally on the PDA from the service-provided `server_now`/deadline timestamps, aligned to minute boundaries. This presentation timer performs no API call, Worker read, Firestore read/write or other provider request. Realtime business events remain responsible for authoritative data reconciliation. The manual Reporter refresh button is removed.
7. Android visible brand/icon surfaces use the same committed app icon asset already used by the launcher/Web identity rather than the legacy alternate alert icon.
8. Android login developer line is exactly **Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291**.
9. Android interactive login is limited to **PICKER** and **REPORTER**. Base-role **ADMIN** and **ROOT** are server-denied for the Android channel until their App/PDA experiences are explicitly designed. Existing Web authorization is unchanged; real ADMIN Agent authorization is unchanged.
10. Existing Reporter queue ordering, realtime notifications, correction window, audit/provenance, Picker flows, Agent/WMS behavior and Stable OWNER-GATED rules remain unchanged.
11. Target is the next monotonic signed Beta Android release after `beta-vc65`; Stable remains untouched.

## D110 Owner acceptance — 2026-09-23

Owner explicitly confirmed signed Android `beta-vc66` as **PASS** after physical field review. OA030 is closed as `PASS_OWNER_CONFIRMED_D110`. The accepted D110 baseline includes the four pinned Reporter tabs with authoritative badges, semantic warning/overdue backgrounds, zero-poll local minute clock, canonical Android branding/footer, and the Android channel role gate that permits PICKER/REPORTER while denying base ADMIN/ROOT. D111 below supersedes only its explicitly conflicting interaction/presentation details.

## D111 — Android Reporter compact refinement and today-plus-unresolved scope

Owner approved on 2026-09-23 immediately after D110 field PASS.

1. Reporter uses the same per-user local **A− / A+** display-scale model as Picker, bounded to 80–140%. Changing size must preserve the currently selected Reporter tab.
2. Only **Đang xử lý** uses a red badge with white text. **Đã có hàng**, **Cho phép skip**, and **Picker đã thu hồi** use a light-grey badge with dark text. Badges remain the authoritative visible tab counts.
3. Rows inside the three history/result tabs do not repeat the tab outcome name. Redundant Picker affected/acknowledgement counts are removed from the compact row. The essential time copy is **Báo lúc** and, when Invent actually resolves the batch, **Invent phản hồi lúc**.
4. D111 supersedes D110's no-preconfirm action rule: pressing **Đã có hàng** or **Cho phép skip** must show an explicit confirmation before the mutation. Per-batch in-flight/double-tap protection remains mandatory.
5. The Reporter summary/empty copy under tabs is removed; no duplicate text such as “Không có SKU đang xử lý” or “x đơn …” is shown when the badge already communicates the count.
6. Android operational history is scoped to **today plus older unresolved work**. Picker sees its reports created today plus any older still-open unresolved ticket. Reporter pending continues to include all unresolved batches, including earlier days; Reporter completed/withdrawn tabs show batches first reported today.
7. The scope is applied server-side for Android with the existing bounded APIs so older unresolved work cannot be lost behind a recent-row limit. Web historical/reporting behavior is unchanged.
8. D111 adds no polling loop, provider cadence, datastore, schema migration, or Stable change. The existing realtime reconciliation and zero-network minute ticker remain unchanged. Target is the next monotonic signed Beta Android release after `beta-vc66`; Stable remains OWNER-GATED.

### D111 release checkpoint — 2026-09-23

D111 is technically released on Beta. PR #159 passed its final head gates and squash-merged to main `8e08bead67b34f8302185d0d4ff259ddd5fae857`. Main Repo Authority `35819012567`, Project State `35819012547`, UI Design `35819012526`, Beta Worker `35819012562`, and Verify Beta Android `35819012653` are PASS.

Live Beta health converged on attempt 2 to HTTP 200 with exact source `8e08bead...`, storage ready, schema `11/11`, Operational V2 `5/5`, missing bindings 0 and Agent migration 0/0; auth API, business capability, Web shell and OAuth-start smoke checks passed.

Signed Android release `beta-vc67` targets exact source `8e08bead...`. Release id `394302425`; APK asset id `582970502`; size `19019076` bytes; SHA-256 `0ea00d861d38e6f4cdd22c76120707b9f730b2c990da0ee834e3072d81318edc`.

OA031 is now ready for Owner field review. Stable remains OWNER-GATED and untouched.

## D111 Owner acceptance — 2026-09-23

Owner explicitly confirmed signed Android `beta-vc67` as **PASS** after field review. OA031 is closed as `PASS_OWNER_CONFIRMED_D111`.

The accepted D111 Beta baseline includes Reporter per-user A−/A+ scaling, red/white badge only for **Đang xử lý**, neutral history badges, removal of redundant outcome/Picker-ack/summary copy, explicit confirmation before **Đã có hàng** or **Cho phép skip**, and Android operational display scope of today plus older unresolved work for Picker/Reporter. Existing realtime/minute-ticker behavior remains no-extra-polling. Stable remains OWNER-GATED and untouched.

Future work starts from this accepted D111 Beta baseline unless the Owner explicitly supersedes it.

## D112 — Release-channel hardening, Web operations, Android device UX and Agent resilience

Owner approved the complete D112 scope on 2026-09-23 after review of the live/runtime evidence and proposed remediation.

1. Web `HỆ THỐNG → Công cụ` is simplified to two operator-facing cards: **App PDA** and **Agent Windows**. Each shows current version, platform, size, release time and channel state. App exposes QR + stable copy/download link; Agent exposes stable copy/download link. Internal implementation prose is removed from the operator UI.
2. App/Agent distribution uses one version-independent project channel. Normal Web/App/Agent runtime must not enumerate GitHub Releases REST to discover the newest build. CI publishes fixed channel aliases/manifests/checksums, and service-owned stable URLs redirect to those verified public release assets.
3. Web date presets **Hôm nay / 7 ngày / 30 ngày / 60 ngày** visually reflect only an exact matching range; a custom range leaves all presets inactive.
4. Dashboard/reporting keep operational action first, then period efficiency, outcome quality and recurring/top-SKU signals using only data already supported by authoritative APIs. Unsupported percentile/age metrics are not fabricated.
5. Management audit and Beta support logs use a 90-day operational retention boundary. Web defaults to 30 days and allows 60/90-day retrieval. Cleanup older than 90 days is bounded and best-effort for Drive support logs; hot `audit_log` is pruned to 90 days in InventoryCore. Archive/business authority remains separate.
6. Dashboard/reporting responsiveness is improved by not blocking primary content on presence/noncritical summaries. No faster polling or extra provider cadence is introduced.
7. New `REPORT_CREATED` realtime events produce an immediate Web toast for operator roles; hidden authorized Web pages may use Browser Notification permission. Same-SKU notices are locally coalesced to avoid alert spam; no polling is added.
8. Android update discovery moves to the service-owned stable manifest, while APK/checksum assets still require HTTPS, trusted redirect targets, SHA-256 and installed-package signer verification. Android sideload installation still requires the OS installer confirmation unless devices are later managed by Device Owner/MDM.
9. Android applies system-bar/navigation/cutout insets, adds a password visibility toggle, keeps the developer footer on one line, keeps the confirmation action readable under text scaling, clears the four-digit confirmation input only after confirmed success, and deletes obsolete downloaded update APK artifacts.
10. Android remains minimal-local-data and online-authoritative: catalog/session/display state may be cached, but no full user/history mirror, offline mutation outbox or alternate transaction path is introduced.
11. Agent manual specialist search accepts 3–20 numeric suffix digits per term, max 10 comma-separated terms. Matching uses exact entered suffix length. Zero match is NOT_FOUND; multiple full-code matches are AMBIGUOUS and fail closed; only a unique match is actionable. Existing Android/Firestore 4-digit current + bounded 5-digit rollout compatibility remains unchanged.
12. Agent manual row action is shown left of PickList. Overlay is refocused on operational state, Agent process CPU/RAM/uptime, local request/result counters and bounded fleet state instead of broad laptop telemetry.
13. Agent restores normal Windows minimize/restore/maximize/resizable behavior. Before ADMIN login, normal close is allowed. After a valid ADMIN runtime is active, user close invokes protected exit and a separate user-mode watchdog restarts the Agent after an unplanned parent-process exit. Authorized logout/exit/update/Windows shutdown suppress restart. User-mode cannot guarantee recovery if both Agent and watchdog are deliberately terminated.
14. D112 targets Beta only: next monotonic signed Android release after `beta-vc67` and Agent `relay-agent-v31`. Stable remains OWNER-GATED and untouched.
15. D098/D104/D105 quota, Firestore HA, WMS confirm and no-offline invariants remain authoritative. D112 must not increase Firestore/Worker polling cadence.

## D112 technical/runtime/release checkpoint — 2026-09-23

D112 is technically released on Beta and **OA032 is field-ready**.

- PR #162 passed final head gates and squash-merged to main `92aff2fd7b617af9f8f7706e84a5232b81aab42a`.
- Final PR PASS runs: Repo Authority `35854110603`, Project State `35854110417`, UI Design `35854110354`, Android `35854110312`, Relay Agent `35854110271`, Firestore `35854110531`, RTDB `35854110275`.
- Main PASS runs: Repo Authority `35854450858`, Project State `35854450813`, UI Design `35854450769`, Beta Worker `35854451020`, Android `35854450919`, Relay Agent `35854450774`.
- Live Beta health converged on attempt 3 to HTTP 200 with exact source `92aff2fd...`, storage ready, SQLite `11/11`, Operational V2 `5/5`, missing bindings 0 and Agent auth migration `0/0`. Auth routing, business capability, Web shell and Google OAuth-start smoke checks passed.
- Signed Android `beta-vc68`: release id `394587171`, APK asset id `583631079`, size `19019504` bytes, SHA-256 `267f6ebc3230f1c5bab5d503dfafc9c71f3d8b996ad3a51d3b0c3bf12f4aab94`, exact source `92aff2fd...`.
- Agent `relay-agent-v31`: release id `394586987`, canonical EXE asset id `583630684`, size `287232` bytes, SHA-256 `9e7078d58c823ee874e80e14a8eefe3e8292604ff2e7e0b06da47a03b842c68f`. The net48 parser/confirm semantic self-test passed.
- Fixed `inventory-channel` release id `394587029` targets exact source `92aff2fd...` and now contains both PDA and Agent manifests plus version-independent binary/checksum aliases.
- D112 does not add polling cadence and preserves D097/D104/D105 Firestore/WMS/quota guards. Stable remains OWNER-GATED and untouched.
- OA032 is `READY_FOR_OWNER_FIELD_TEST`; D112 is not Owner-PASS until explicit field confirmation.

## D112 Owner acceptance — 2026-09-23

Owner explicitly confirmed live Beta Web, signed Android `beta-vc68`, and Agent `relay-agent-v31` as **PASS** after field review. OA032 is closed as `PASS_OWNER_CONFIRMED_D112`.

The accepted D112 Beta baseline includes the version-independent App/Agent distribution channel, simplified Web Tools, exact date-preset state, 30/60/90-day management log views, non-blocking dashboard/report loading, realtime shortage notice, Android insets/update/password/footer/confirmation cleanup, and Agent v31 normal window/protected watchdog/manual exact-suffix workflow/operational overlay. D097/D104/D105 quota, Firestore/WMS, no-offline and Stable guards remain unchanged.

Future work starts from this accepted D112 Beta baseline unless the Owner explicitly supersedes it. Stable remains OWNER-GATED and untouched.

## D113 — Reference-login, SLA controls, Android compact UX and Agent background action — 2026-09-24

Owner approved the uploaded cross-surface refinement after D112 Owner field PASS.

1. Web login keeps SUPRA Inventory visual identity but adopts the approved reference composition: shared SUPRA icon, centered company identity **CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN**, subtitle **Website nghiệp vụ Inventory**, Vietnamese labels, account/password card hierarchy and password show/hide control.
2. **Lưu thông tin đăng nhập** may use browser-managed credential storage/autofill only. The application may remember the username locally but must never persist a plaintext password, token or credential secret in localStorage, IndexedDB, source or logs.
3. Web **Xử lý báo hàng** shows the authoritative current pending count as a compact red/white notification badge. Existing D112 `REPORT_CREATED` realtime toast and hidden-tab Browser Notification behavior remains; D113 adds no polling.
4. **Thời gian xử lý** loads authoritative SLA configuration independently from noncritical insight/statistic calls so saved values cannot appear blank merely because secondary metrics are slow/unavailable.
5. Warning, overdue/escalation and automatic Skip each have an independent enable checkbox. The three numeric thresholds remain strictly ordered for safe re-enable. **Cách tính mốc tự động** must always resolve to exactly one of `FIRST_REPORT` or `PER_PICKER`.
6. A new global **Skip → Đã có hàng** switch and configurable minute window controls whether Invent may correct a `SKIP_ALLOWED` result to `HAS_STOCK`. The deadline is server-authoritative and is calculated from the batch's **first shortage report time**, not from the moment Skip is pressed. Legacy configuration defaults to enabled/5 minutes to preserve previous behavior until Admin/Root changes it.
7. Web **Công cụ** remains the D112 two-card App PDA / Agent Windows model but receives a cleaner professional card/fact/action/QR layout without internal AI/Owner wording.
8. Android Picker hides the redundant empty selected-SKU card, keeps **Xác nhận** readable under display scaling and adds a one-tap **100%** reset beside A−/A+.
9. Android login uses the same company/product hierarchy as Web, labels the identifier **Tài khoản / Mã nhân viên**, keeps password text vertically aligned and returns friendly Vietnamese credential errors instead of raw `INVALID_...` codes. Developer footer is exactly **Phát triển hệ thống · tamnv2 | Pick Pack 1291**.
10. Android Reporter places **Đã có hàng / Cho phép skip** below product/time information. Resolved history shows **Invent phản hồi lúc HH:mm bởi <người xử lý>** when a human resolver is known; automatic timeout may show **Hệ thống**.
11. Windows Agent keeps D112 native Minimize/Restore/Maximize/X behavior and adds an explicit **Chuyển xuống nền** action that uses the existing tray/background path.
12. D113 is Beta-only. Target artifacts are the next monotonic signed Android after `beta-vc68` and `relay-agent-v32`. D097/D104/D105 quota, Firestore/WMS batching/idempotency, no-offline and all Stable OWNER-GATED invariants remain unchanged.

## D113 technical/runtime/release checkpoint — 2026-09-24

D113 is technically released on Beta and **OA033 is field-ready**.

- PR #165 final head `424a52a7eae34587e37ddcaa68433fa26bac4ec2` passed Repo Authority `35930682960`, Project State `35930683024`, UI Design `35930682963`, Relay Agent `35930682991`, Android `35930683046`, Firestore `35930682947` and RTDB `35930683014`, then squash-merged to main `7dcc76aba6b0b2774208b151ca587aa2a2b09931`.
- Main PASS: Repo Authority `35933061054`, Project State `35933061086`, UI Design `35933061098`, Deploy Beta Worker `35933061039`, Verify Beta Android `35933061049`, Verify Beta Relay Agent `35933061088`.
- Live Beta health converged on attempt 2 to HTTP 200 with exact source `7dcc76ab...`, storage ready, SQLite `11/11`, Operational V2 `5/5`, missing bindings `0`, Agent auth migration `0/0`; auth routing, business capability, Web shell and Google OAuth-start smoke checks passed.
- Signed Android `beta-vc69`: release id `395136931`, APK asset id `584751944`, size `19019800` bytes, SHA-256 `f6b1f6e8866358b270bb5781958e6a0a05d54fbc65f446c6dc3ae5e0b9ef07c0`, exact source `7dcc76ab...`.
- Agent `relay-agent-v32`: release id `395136705`, canonical EXE asset id `584751479`, size `287744` bytes, SHA-256 `e6b838377931fd804bf4dc7de7b02577010244041867975e301fd42b9d35e80c`; tag resolves exactly to main `7dcc76ab...`.
- Fixed `inventory-channel` release id `394587029` was refreshed with Agent manifest/exe assets `584751529/584751528` and PDA manifest/apk assets `584751996/584751999`.
- D113 adds no schema migration or faster polling/provider cadence and preserves D097/D104/D105 Firestore/WMS/no-offline guards. Stable remains OWNER-GATED and untouched.
- OA033 is `READY_FOR_OWNER_FIELD_TEST`; D113 is not Owner-PASS until explicit field confirmation.


## D114 — Unified PickList suffix selection, result feedback and Web realtime/tool fixes — 2026-09-24

Owner field review of D113 accepted the previously verified baseline but reported concrete defects/new requirements that supersede the affected D105/D112/D113 details. D113 is therefore **not** recorded as Owner-PASS; OA033 remains historical field-review evidence and is superseded by D114 retest.

1. PickList search is unified to **exact trailing-digit matching only**. Entering `3444` may match `PLxxxxxx3444`; it must never match digits occurring only in the middle of a PickList.
2. Android/PDA accepts exactly one numeric search term per request, minimum 3 digits and bounded to 20 digits. Agent manual search retains up to 10 comma-separated numeric terms, each 3–20 digits.
3. A PDA search with 0 matches returns a specific NOT_FOUND result. One exact candidate follows the existing guarded confirmation path. Two or more candidates must fail closed before WMS mutation and return the bounded matching full PickList codes to the PDA.
4. For ambiguous PDA results, Android renders each full PickList on its own row with a row-specific **Xác nhận** action. PDA may confirm only one selected PickList at a time. Before sending the selected PickList, a warning dialog emphasizes that the Picker must choose their own exact PickList; **Huỷ** sends nothing.
5. Agent and Android use aligned, human-readable result semantics for success, not found, ambiguity, lock/rate limit, WMS session expiry, permission/proxy/transport, WMS rejection/conflict, uncertain/in-progress, request expiry, server/schema and unexpected failures. Raw/general-purpose failure copy is not sufficient.
6. Agent direct PickList rows must visibly show the full PickList code first, the row confirmation action, and per-row result feedback. Single/multi confirmation feedback must be prominent. PDA-originated jobs must also leave a clear outcome on the Agent instead of immediately collapsing to a generic “processed” state.
7. Agent release target is `relay-agent-v33`; assembly/file version must agree with release version.
8. Web **Công cụ** uses two balanced compact cards on wide screens and stacks them on narrow screens. Legacy full-width/span rules must not leave one card full-width and the other half-width.
9. The Web **Xử lý báo hàng** navigation badge is global realtime operational state. On existing reporter-queue realtime events it refreshes from the authoritative queue even while the user is viewing another Web section. No additional polling cadence is introduced.
10. D114 is Beta-only. SQLite schema remains 11. Existing D097/D104 batching/HA/idempotency/no-offline guards remain unless explicitly superseded above. Stable remains OWNER-GATED and untouched.


### D114 technical/runtime/release checkpoint — 2026-09-24

D114 implementation is technically complete on Beta and is now ready for OA034 Owner field review. This checkpoint does not add or supersede product behavior beyond the D114 rules above.

- PR #167 merged the D114 implementation at `8cdf941be71fcfddaf074e2016336c2f8d416608`.
- Main Repo Authority, Project State, UI Design, Beta Worker, Android and Agent runs passed. Live Beta health reached HTTP 200 on attempt 2 with exact source `8cdf941b`, SQLite `11/11`, storage ready, missing bindings `0`, Agent migration `0/0` and Operational V2 `5/5`.
- The main Firestore deployment exposed a malformed Rules source edit. PR #168 rebuilt the Rules from the accepted baseline and reapplied only the intended D114 suffix/candidate changes; main Firestore run `35943098393` passed ruleset creation and release readback from repair main `e6138dbdd72e073e2c5a88e7fd431b1d0643c180`.
- Signed Android `beta-vc70` and `relay-agent-v33` are published from D114 implementation source `8cdf941b`.
- PR #170 hardened Agent release reruns: an existing release may be reused only when the exact `relay-agent/` Git tree is unchanged; published EXE/checksum must verify. Final main Agent run `35944022982` passed and refreshed the fixed runtime channel using the already-published v33 assets.
- Stable remains OWNER-GATED and untouched. D114 Owner PASS is not recorded until explicit OA034 field confirmation.


## D114 Owner acceptance — 2026-09-24

Owner explicitly confirmed the released D114 Beta result as **PASS** after field review of live Beta Web, signed Android `beta-vc70` and `relay-agent-v33`. OA034 is closed as `PASS_OWNER_CONFIRMED_D114`.

The accepted D114 baseline includes exact trailing 3–20 digit PickList search, PDA one-at-a-time ambiguous candidate selection, Agent multi-term specialist search and specific result feedback, balanced Web Tools cards, and cross-section realtime queue-badge reconciliation without faster polling. SQLite remains 11; D097/D104 HA, batching, idempotency and fail-closed WMS guards remain authoritative; Stable remains OWNER-GATED.

In the same message, Owner reported a **separate post-pass observation** from the newest Android log: some PickList confirmations appear slower and some requests can show the 10-second Agent failover notice then reach the 30-second no-result timeout even when the PickList may already have been confirmed. This is diagnostic evidence for a later follow-up decision; it does not revoke D114 acceptance and no new relay behavior is approved by this acceptance record.


## D115 — Fast healthy-primary relay and ACK recovery — 2026-09-24

Owner approved the post-D114 relay repair and added an explicit performance target: **when network/WMS are healthy and no Agent failover occurs, PDA send → terminal result back on PDA should complete in under 5 seconds**.

1. D114 remains Owner-accepted. D115 is a separate Beta-only follow-up for relay latency/reliability.
2. PRIMARY Firestore business-job polling changes from 5 seconds to **2 seconds**. STANDBY remains **10 seconds**, FROZEN still performs no business-job polling, and request-driven failover remains **10 seconds**. This D115 cadence supersedes the older D104/D114 “PRIMARY 5s” constraint only for the PRIMARY confirmation poll.
3. The 2-second cadence is allowed only on the single elected PRIMARY and only while business processing is enabled. No Android polling, no extra coalescing query, no PROCESSING write and no new provider/resource are added.
4. Android cleanup is removed from the confirmation critical path. Cleanup runs best-effort in one background worker, is scoped to the current Firebase UID, prunes legacy/foreign/permission-denied entries, and must never delay creation of a new confirmation request.
5. Android keeps the Firestore snapshot listener as the normal response path. Before a 30-second terminal timeout it performs one bounded server read of that request to recover an ACK that may have been written but missed by the listener.
6. The 10-second Android progress copy must not claim the PRIMARY is dead merely because no result has arrived. It reports continued waiting and that automatic standby takeover will occur if required.
7. Agent v34 retries only the **Firestore ACK write/verification**, never the WMS mutation. After an uncertain ACK write, Agent performs server read-after-write; an already-visible ACK is treated as delivered. Conditional-write/idempotency guards remain authoritative.
8. Agent adds redacted latency telemetry for queue age, business-processing time and ACK time. PickList values, tokens, credentials and WMS session material remain forbidden in logs.
9. Target artifacts are signed Android **beta-vc71** and **relay-agent-v34**. SQLite remains 11; Web business behavior is unchanged; Stable remains OWNER-GATED.
10. The under-5-second objective is a healthy-path field acceptance requirement, not a promise during WMS latency, network degradation, token recovery or Agent failover.


## D115 technical/runtime/release checkpoint — 2026-09-24

D115 is technically released on Beta and **OA035 is field-ready**.

- PR #173 merged to main `bcbabc09928ae997d81f12404a49e7a8be6d971f` after Repo Authority, Project State, UI, Android, Relay Agent, Firestore and RTDB PR gates passed.
- Main PASS runs: Repo Authority `35948065198`, Project State `35948065182`, UI Design `35948065209`, Deploy Beta Worker `35948065164`, Verify Beta Android `35948065152`, Verify Beta Relay Agent `35948065389`.
- Live Beta health passed on attempt 1 with HTTP 200, exact source `bcbabc09...`, storage ready, SQLite `11/11`, missing bindings `0`, Agent migration `0/0` and Operational V2 `5/5`; auth/business/Web shell/OAuth smoke checks passed.
- Signed Android `beta-vc71`: release id `395262617`, APK asset id `585009621`, size `19019872` bytes, SHA-256 `f1137dccd460133e5fdc41836658c6bb6b41a885f41f4ba16ca908a0c96d3d1d`, exact source `bcbabc09...`.
- Agent `relay-agent-v34`: release id `395262208`, canonical EXE asset id `585008591`, size `294400` bytes, SHA-256 `eef4e6e6bbb20f7fad223ba4c7a7081200eecbe74af1e43c4335fd78034f4285`; tag resolves exactly to `bcbabc09...`.
- Fixed `inventory-channel` refreshed: PDA manifest/APK `585009672/585009671`; Agent manifest/EXE `585008719/585008720`.
- D115 source contract: PRIMARY 2s, STANDBY 10s, failover 10s; Android async UID-scoped cleanup + final server ACK read; Agent bounded ACK retry/read-after-write without WMS replay. No SQLite migration, no new provider, no Android polling and no PROCESSING write.
- OA035 is `READY_FOR_OWNER_FIELD_TEST`; under-5-second healthy-path acceptance is not recorded until explicit Owner field confirmation. Stable remains OWNER-GATED.

## D116 — Quota-balanced relay, durable App result and Web admin refinement — 2026-09-24

Owner field use of released D115 confirms the healthy-primary path is materially faster, but reports two D115 defects: Firestore free-tier consumption is too high and a successful Android confirmation is visually overwritten when the input is cleared. The same Owner command also approves the Web operations/SKU/user-management refinements below. D115 is therefore **not** recorded as Owner-PASS; OA035 is superseded by D116 retest.

1. Preserve the D115 practical healthy-path target: with one healthy PRIMARY, WMS ready, normal network and no failover, Android request creation → terminal result remains an **under-5-second field acceptance target**.
2. Reduce the single elected PRIMARY confirmation query cadence from D115 2,000 ms to **3,000 ms**. STANDBY remains **10,000 ms**, FROZEN performs no business polling, request-driven failover remains **10,000 ms**, quiet-hours gating remains, and Android adds no polling. No PROCESSING write, no new provider/resource and no new Firestore collection are introduced.
3. The 3-second PRIMARY cadence supersedes only D115's 2-second PRIMARY interval. It is a quota/latency balance: the system must not return to the older 5-second healthy path unless a later Owner decision explicitly changes the target.
4. Android terminal confirmation feedback is durable in the current screen state. Programmatic clearing of the PickList input after CONFIRMED must not trigger the input hint to overwrite the terminal result. Specific D114 result/error semantics remain.
5. Web **Xử lý báo hàng** automatically shows the affected Picker rows for the currently selected SKU. It uses the existing selected-batch prefetch/cache; removing the extra click must not introduce a new polling cadence or duplicate detail fetch.
6. Web **Danh mục SKU** becomes a complete operational workspace: current catalog count/version/update time, bounded SKU/product-name search, current rows and the existing validated Excel import/conflict flow.
7. Web **Nhân sự & tài khoản** bulk selection applies only to PICKER. ROOT/ADMIN/REPORTER rows are never bulk-selectable. ROOT is visibly protected. **Chọn tất cả Picker** may still be followed by individual Picker deselection/reselection.
8. The Picker all-selection exception list is enforced server-side, not only visually: all=true may carry explicit excluded Picker IDs; the core still targets only rows whose role is PICKER.
9. D116 target artifacts are the next monotonic signed Android after beta-vc71 and **relay-agent-v35**. SQLite remains 11. Stable remains OWNER-GATED and untouched.

## D116 technical/runtime/release checkpoint — 2026-09-24

D116 is technically released on Beta and **OA036 is field-ready**.

- PR #175 merged to main `9319eb30f55e48b3c60283ab2e9135bf0a33054d` after all PR authority, continuity, UI, Android, Agent, Firestore and RTDB gates passed.
- Main PASS runs: Repo Authority `35962512361`, Project State `35962512549`, UI Design `35962512491`, Deploy Beta Worker `35962512349`, Verify Beta Android `35962512556`, Verify Beta Relay Agent `35962512375`.
- Live Beta health passed on attempt 1 with HTTP 200, exact source `9319eb30...`, storage ready, SQLite `11/11`, missing bindings `0`, Agent migration `0/0` and Operational V2 `5/5`; auth/business/Web shell/OAuth-start smoke checks passed.
- Signed Android `beta-vc72`: release id `395378687`, APK asset id `585274995`, size `19019872` bytes; tag resolves exactly to main `9319eb30...`.
- Agent `relay-agent-v35`: release id `395378457`, canonical EXE asset id `585274568`, size `294400` bytes; tag resolves exactly to main `9319eb30...`.
- Fixed `inventory-channel` refreshed: PDA manifest/APK `585275037/585275028`; Agent manifest/EXE `585274637/585274636`.
- D116 source contract: PRIMARY 3s, STANDBY 10s, failover 10s, FROZEN no business poll; Android remains listener-driven/no-poll and terminal result survives input reset; selected-SKU affected Picker detail uses existing prefetch/cache; SKU workspace and Picker-only all-with-exclusions bulk actions are live.
- No SQLite migration, no new provider/resource, no Android polling and no PROCESSING write. Stable remains OWNER-GATED and untouched.
- OA036 is `READY_FOR_OWNER_FIELD_TEST`; D116 Owner PASS is not recorded until explicit field confirmation.

## D117 — Firestore proactive HA, quota-balanced relay and scheduled freeze — 2026-09-24

Owner approves replacing only the D116 PDA↔Agent HA/polling and D102 relay operating-window semantics below. Firestore remains the selected Office-compatible carrier; Cloudflare/RTDB/Apps Script are not reopened for this path. Stable remains OWNER-GATED and untouched.

1. **Healthy PRIMARY latency / quota balance.** PRIMARY reads the pending confirmation queue every **4 seconds while idle** and temporarily every **2 seconds for 15 seconds after actual work is found**. STANDBY and FROZEN perform **no business queue polling**.
2. **Proactive idle failover.** PRIMARY writes a generation-scoped Firestore lease every **7 seconds**. STANDBY monitors only the current generation lease and promotes after **10 seconds** without a valid PRIMARY lease, even when no PDA request exists. Failover is therefore measured from PRIMARY death, not from request age.
3. **Split-brain fence.** Every promoted PRIMARY receives a new generation. Before WMS mutation, Agent revalidates that it is still the current PRIMARY for that generation. A recovered stale PRIMARY cannot mutate WMS.
4. **WMS health without spam.** No periodic WMS health request is allowed. WMS is validated at Agent startup, by real business calls, and exactly once when STANDBY is about to become PRIMARY. A proven expired WMS session clears local readiness and relinquishes relay authority; transport uncertainty fails closed.
5. **PDA terminal window.** Android relay terminal wait becomes **20 seconds**. Agent must not begin new automatic WMS work for a job older than that terminal window. Existing per-PickList guard, conditional ACK and uncertain/no-replay rules remain.
6. **Regular relay window.** PDA relay automatically operates **06:00–22:00 Asia/Ho_Chi_Minh**. The Agent process and direct/manual specialist confirmation remain available outside this relay window.
7. **21:30 decision.** Starting **21:30**, only the current PRIMARY warns every **5 minutes** until the 22:00 boundary is decided. CONTINUE extends relay through **23:00**. STOP or no answer freezes relay at exactly the boundary.
8. **Hourly overtime continuation.** While an after-hours relay extension is active, at every **HH:30** the PRIMARY starts five-minute warnings for the next hour boundary. Example: 22:30 asks whether relay continues after 23:00; 23:30 asks whether it continues after 00:00. CONTINUE grants one more hour; STOP/no answer freezes at the upcoming boundary. No 05:30 prompt is needed because 06:00 automatically re-enters the normal window.
9. **Fleet-wide freeze.** When relay freezes, PRIMARY stops the lease and releases active relay roles; all online Agents become relay-frozen and stop receiving/processing PDA jobs. Direct/manual Agent confirmation remains available.
10. **Early start before 06:00.** A frozen Agent with a usable WMS session exposes **Khởi động relay đến 06:00**. The machine that confirms early start claims PRIMARY immediately; other online Agents rejoin as STANDBY/FROZEN through the existing Firestore coordination model. At 06:00 the normal schedule takes over automatically.
11. Schedule decisions are stored only in the existing Firestore relay coordination scope; no new provider or collection is introduced. D096/D104 confirmation mutation guards, D114 suffix/ambiguity semantics, no-offline invariant and Stable OWNER-GATED remain unchanged.

## D117 final hardening — 2026-09-24

Before recording D117 final release PASS, final logic review found two edge cases that could violate the Owner's intended behavior. The Owner-approved D117 model is therefore hardened without changing provider/resource selection:

1. The PRIMARY lease carries the shared schedule key/decision/boundary/override fields. A PRIMARY schedule decision immediately writes the lease so STANDBY can absorb a late overtime decision without waiting for the slower role refresh.
2. STANDBY continues its existing generation-lease read even when its local schedule view has just crossed an hour boundary; it may learn a valid extension from that same lease read, but it may not take over while relay is actually disabled.
3. FROZEN performs no business queue polling. Its **control-role refresh** outside relay operation is reduced to **30 seconds** so an Owner-triggered early start before 06:00 can rebuild PRIMARY/STANDBY/FROZEN topology promptly. This is control coordination only, not PDA business polling.
4. Automatic work is rechecked against the **20-second** terminal window after exact lookup/guard acquisition and immediately before WMS mutation. Expired work releases its safe guard and performs no new WMS mutation.
5. Before **every WMS confirmation POST chunk**, the Agent revalidates current PRIMARY role + generation. If the fence is lost, untouched guards are released safely, no further WMS POST occurs, and the affected Firestore job is left un-ACKed for the valid PRIMARY to handle.
6. Final hardened Agent target becomes **relay-agent-v37**. Signed Android remains **beta-vc73** because no Android source change is required.
7. Stable remains OWNER-GATED and untouched.

## D117 final v37 technical/runtime/release checkpoint — 2026-09-24

D117 final hardening is technically released and **OA037 is field-ready**.

- Base D117 implementation: PR #177 → main `bbb6c83b3f75d234f8220d8ef42b22c3105d9964`.
- Final hardening: PR #179 → main `e583d20d12f097bd7895494992408c41976b1835`.
- Final-main PASS: Repo Authority `36000749512`, Project State `36000749611`, UI Design `36000749586`, Relay Agent `36000749563`.
- Signed Android remains `beta-vc73` from D117 implementation main; Android source was not changed by v37 hardening.
- Final Agent `relay-agent-v37`: release id `395676931`, canonical EXE asset id `585941375`, size `303104` bytes, SHA-256 `28e79bf2d9e703ffc5b8ef8b074e1c2810ccb1e1dd4eecba08d9772748375a03`; tag resolves exactly to `e583d20d...`.
- Fixed inventory channel now serves Agent v37 assets `585941439/585941442`; PDA channel remains beta-vc73 assets `585884876/585884875`.
- Worker/Web runtime was intentionally unchanged by Agent-only v37 hardening; latest D117 live health proof remains exact implementation source `bbb6c83b...`, schema 11/11, storage ready, missing 0, Agent migration 0/0, Operational V2 5/5.
- Stable remains OWNER-GATED and untouched.

## D118 — Fleet-wide overtime control, complete paged Web data, authoritative SLA, detailed export and keyboard-safe PDA — 2026-09-24

Owner approves the following Beta-only change set on top of D117. Stable remains OWNER-GATED and untouched.

1. **Overtime confirmation is fleet-wide, not PRIMARY-only.** From each D117 decision window (21:30 for 22:00 and each active HH:30 thereafter), every online authenticated Agent may display and submit the decision. Submitting a schedule decision does **not** promote STANDBY/FROZEN to PRIMARY.
2. **One authoritative decision per boundary.** Schedule decisions use the existing Firestore coordination roles document with optimistic compare-and-set on document update time. The first decision recorded for a schedule key + boundary is authoritative; later conflicting decisions cannot overwrite it and must refresh/show the existing fleet decision. PRIMARY continues to execute business work and consumes the shared decision before the boundary.
3. **Bounded lists with real pagination.** Administrative/history lists must not silently truncate. Existing Users/Audit/Reporting pagination remains. SKU search is 100/page; Reporter result history 50/page; Picker report history 50/page; runtime Web/Android logs 50/page using Google Drive nextPageToken. Active pending Reporter queue remains correctness-first and is loaded completely through bounded server pages rather than shown partially.
4. **SLA is server-authoritative and revision-safe.** Web must not render substitute/default threshold values while server configuration is loading. SLA configuration exposes its revision; each save includes expected revision. A stale tab/device receives `SLA_CONFIG_STALE`, cannot overwrite newer settings, and reloads authoritative state. Revision increases after each successful save.
5. **SLA presentation is professionally restructured** into authoritative status, ordered thresholds, policy controls, current operational state, revision/update identity and explicit whole-system scope.
6. **Detailed Excel export follows the selected reporting range/filter.** Export contains separate professional sheets for overall summary, timeline/evolution, report batches, per-Picker detail, SKU aggregation and prominent SKU metrics. It includes result source/actor, report/resolve times, waiting times, auto-skip/withdraw/ack lifecycle and recurrence context where available.
7. **Agent product credit.** Windows Agent shows `Phát triển hệ thống · tamnv2 | Pick Pack 1291` at bottom-right without affecting the operational layout.
8. **Android keyboard behavior.** Picker main activity uses resize-on-IME; the bottom `Báo hết hàng` / `Xác nhận đơn` tabs remain above the soft keyboard because they stay outside the weighted content frame.
9. Final candidate targets are **relay-agent-v38** and the next monotonic signed Android release after beta-vc73 (expected beta-vc74). No new provider, database, collection or Stable resource is introduced.

## D118 technical/runtime/release checkpoint — 2026-09-25

D118 is technically released on Beta and **OA038 is field-ready**.

- PR #181 squash-merged to main `d29237c0990eb677ddef726785a88e08bce88dce`.
- Final PR gates PASS: Repo Authority `36015364305`, Project State `36015364214`, UI Design `36015364218`, Android `36015364294`, Relay Agent `36015364286`, Firestore `36015364874`, RTDB `36015364314`.
- Main PASS: Repo Authority `36064078289`, Project State `36064078114`, UI Design `36064078112`, Deploy Beta Worker `36064078233`, Verify Beta Android `36064078150`, Verify Beta Relay Agent `36064078151`.
- Live Beta health passed on attempt 1 with HTTP 200, exact source `d29237c0...`, storage ready, SQLite `11/11`, missing bindings `0`, Agent migration `0/0` and Operational V2 `5/5`; auth/business/Web shell/OAuth smoke checks passed.
- Signed Android `beta-vc74`: release id `396107357`, APK asset id `586922345`, size `19019872`, SHA-256 `c515a17456d3384a2433feb04df5b2fce8d3487a519fbb2d8522ba8a8dc756b1`; tag resolves exactly to main `d29237c0...`.
- Agent `relay-agent-v38`: release id `396107251`, canonical EXE asset id `586921932`, size `305664`, SHA-256 `24961379327c441a6d686ac4059fd9020ce91d6ee8564cab6c2c2a1893f65bf0`; tag resolves exactly to main `d29237c0...`.
- Fixed `inventory-channel` refreshed: PDA manifest/APK `586922418/586922421`; Agent manifest/EXE `586921987/586921986`.
- D118 release preserves D117 proactive lease/failover/generation/WMS fences while replacing PRIMARY-only overtime choice with fleet-wide first-CAS decision authority. Web pagination/SLA/export, Agent footer and Android IME resize are live from the same source.
- SQLite remains 11. No new provider/resource was introduced. Stable remains OWNER-GATED and untouched.
- OA037 is superseded by OA038; D118 Owner PASS is not recorded until explicit field acceptance.

## D118 Owner-accepted checkpoint — 2026-09-25

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- Owner explicitly confirmed **“ok pass hết”** after OA038 field review.
- OA038 is closed as `PASS_OWNER_CONFIRMED_D118`.
- Accepted Beta baseline: live Web source `d29237c0990eb677ddef726785a88e08bce88dce`, signed `beta-vc74`, and `relay-agent-v38`.
- Accepted D118 behavior includes fleet-wide first-CAS overtime decision without role promotion, inherited D117 proactive HA/generation/WMS fences, real bounded Web pagination, server-authoritative revision-safe SLA, detailed selected-range/filter Excel, Agent footer credit and Android tabs above IME.
- SQLite remains `11`; Operational V2 remains `5/5`.
- Stable remains OWNER-GATED and untouched.

## D119 — Protected additive operations, Picker presence and controlled full rollout — 2026-09-25

Owner approved the next Beta change set after D118 Owner PASS, with an explicit protected-baseline rule.

1. **D118 protected baseline.** Owner-accepted behavior that is already stable must not be modified merely to simplify a new feature. If a future requirement cannot be implemented without touching a protected path, the exact surface, technical risk, operational risk and billing/quota impact must be presented to Owner before that protected behavior is changed.
2. **No mixed-version rollout.** Web/backend, signed Android and Windows Agent are prepared as one compatible Beta release set and then the normal canonical update channel is promoted for the whole fleet. The unavoidable short installer/updater transition is not a deliberate mixed-version operating model.
3. **Reporter ordering.** Picker own history remains newest-first. Reporter/Quản trị Invent pending work becomes oldest-first and no longer uses affected-Picker count as the primary ordering key. Resolved/history views remain newest-first.
4. **Role presentation and capability.** Existing internal `ADMIN` remains the identifier and is displayed as **Quản trị Invent**. New internal role `PICKPACK_ADMIN` is displayed as **Quản trị Pick Pack**. On Web it may manage Picker personnel, SKU manual/import workflows, read shortage/reporting/history/export and use the bounded Picker-contact capability; it cannot resolve Có hàng/Cho phép skip, correct shortage results, change SLA/auto-skip/processing-time policy, reset system or manage Invent/Root authority. On Windows Agent, `PICKPACK_ADMIN` is explicitly authorized for the existing PickList lookup/confirmation workflow and for the D119 SKU synchronization/update workflow, with the same D117/D118 HA, generation-fence, idempotency and fail-closed WMS guards as `ADMIN`. This Agent permission does not grant Báo hàng resolution authority.
5. **Android ADMIN.** Real ADMIN may use Android only for the existing Reporter operational surface. Root remains Web-only. This supersedes D110 for ADMIN only; server authorization must enforce the reduced Android capability.
6. **Picker presence.** Agent Picker list contains only Picker users with a valid Android session and registered notification device. Presence is event-driven by login/session replacement/device registration/logout/disable/expiry; no per-PDA heartbeat loop is introduced. Logout/invalid session removes the Picker from the operational online list.
7. **Quota-safe presence projection.** InventoryCore remains identity/session authority. A compact Firestore projection may be maintained for Office-capable Agent reads. PRIMARY may refresh the single compact presence projection at a bounded near-realtime cadence; non-primary Agents use coarse refresh. Presence must not depend on whether the Picker ever used Xác nhận đơn.
8. **Agent layout.** After successful Agent login, login inputs are hidden. Overview uses normal Windows minimize/maximize/close chrome, compact responsive layout, Agent fleet max five visible rows with internal vertical scroll, reduced Supra section height, PickList max five visible rows with internal vertical scroll and a compact online-Picker table. The Picker table shows MNV + name and the approved action labels; action business wiring must follow its own approved capability and may remain disabled when not yet accepted.
9. **Fleet metrics.** Local PRIMARY request/processed counters are realtime in RAM. Durable fleet checkpoints use a separate additive document rather than changing the accepted D117/D118 HA lease format. Other Agents refresh approximately every 30 minutes; takeover reconstructs from the latest checkpoint plus durable ACK tail so counts are not lost.
10. **SKU auto-sync from Supra.** An Agent with an already-valid WMS session may read the registered HY1 Tồn Bin endpoints. Only SKU + product name may enter SUPRA Inventory; quantity/bin/location fields are discarded and never become product scope. Existing SKU+same name is ignored, new SKU is additive, changed name requires explicit confirmation, and absence from a later WMS result never deletes an existing SKU. Excel import remains manual fallback. One daily/period lease prevents duplicate fleet downloads and another Agent may take over an expired sync lease.
11. **Background/critical Android alerts.** Existing shortage business state remains InventoryCore authority. High-priority FCM is the background wake path; no all-day socket/heartbeat is added. The 05:00–23:00 operational alert window uses server-authoritative Asia/Ho_Chi_Minh time. Outside that window, new Android business mutations and Xác nhận đơn sends are refused and the App performs best-effort automatic logout at the authoritative boundary. Quản trị Invent/Root Web may explicitly extend the App/PDA window one hour at a time, including starting a late overtime hour after the normal boundary; an active extension may be extended by another hour. Shortage critical alerts may use the OS overlay permission when granted and must fall back to the accepted notification path when unavailable. Xác nhận đơn keeps its accepted in-app result model.
12. **Picker contact command.** Firestore/Cloud Functions may provide a Beta-only Agent→PDA command bridge. FCM/overlay delivery is additive and idempotent; stale commands have TTL and authorized server/Agent resolution so a PDA cannot remain locked indefinitely. No secret/token is exposed to Agent documents.
13. **Cloud billing/setup.** Owner completed Beta-only Blaze/billing, budget/spend-cap, required APIs, deploy/runtime service accounts, least-privilege IAM and GitHub environment secret setup before implementation. Stable billing/resources remain untouched and OWNER-GATED.
14. **Whole-fleet update.** After source, authority, continuity, build, runtime and release gates pass, the existing `inventory-channel` is promoted to the new signed APK and Agent release. D118 remains the rollback baseline until Owner field-accepts D119.

## D120 — D119 field-repair: Agent usability/quota, single Android result overlay, SLA stability and ROOT role control — 2026-09-26

Owner states D119 is passed and immediately opens D120 to repair concrete Beta field defects without reopening the protected D117/D118 confirmation/HA contract or Stable.

1. **Agent Picker workspace.** The active-Picker table must preserve the user's scroll position across background refreshes, support search by employee code or full name, spell out **Mã nhân viên**, highlight the whole hovered row/button target, and remain smooth while data refreshes. The Picker workspace is placed on the right side; Agent/Supra/PickList stay on the left.
2. **Agent controls.** Keep normal Windows chrome, restore **Chuyển xuống nền** and Agent **Đăng xuất**, and remove the redundant visible cluster summary line `PRIMARY / STANDBY / FROZEN` from the normal Overview. These changes do not alter D117/D118 role authority.
3. **Supra account visibility/switching.** Show the current Supra/WMS user when available. Add **Đăng xuất Supra** protected by the currently authenticated Agent user's password verifier. Explicit Supra logout clears the local WMS session/cache and dedicated browser profile so the next **Đăng nhập Supra** follows the normal browser login flow for a different authorized company account. Agent logout restores Agent username/password controls and clears the locally held Supra session.
4. **Fleet metrics quota repair.** Owner field log is authoritative evidence of a D119 regression: the durable fleet-metrics checkpoint was being refreshed roughly every 1–2 seconds after UI-forced refresh paths, despite the intended ~30-minute cadence. D120 hard-throttles metrics attempts to 30 minutes, including after failures/forced UI refresh. Confirmation queue/HA cadences remain D117/D118-authoritative and are not changed.
5. **Overlay presentation.** Windows overlay presents operational metrics as separate readable tiles instead of coupled text pairs. Existing lock/click-through, resize, opacity and color behavior remains.
6. **Android result alert.** The existing blue/red Picker result surface is the single full-screen result UI. When overlay permission is granted, that same business result is projected over other apps. Do not show a second competing full-screen design and then show the blue/red result again inside the App. If overlay permission is unavailable, retain normal notification/in-app fallback.
7. **Android result acknowledgement.** Full-screen result acknowledgement is tied to the existing authoritative result event. Failed ACK is retained for authenticated retry; no ACK path may replay a WMS mutation.
8. **Android session restore.** A valid persisted interactive session must restore through a neutral restoring screen and then the correct home/role surface; the login form must not flash for 1–2 seconds merely because profile/update validation is still running.
9. **Web SLA authority.** The server remains the only SLA authority. Background statistics/realtime refresh must not rebuild an SLA form while the operator is editing it. A save must verify the returned and reloaded `auto_skip_mode` matches the submitted `FIRST_REPORT` or `PER_PICKER`; stale revision still fails closed. Radio controls use compact normal geometry and visibly show the authoritative current choice.
10. **Web viewport.** The final page controls/footer must remain reachable above browser/OS chrome using dynamic viewport height and a real bottom scroll gutter; no content may be effectively hidden behind the Windows taskbar.
11. **ROOT role mutation.** Only ROOT may change an existing managed account between `ADMIN`, `PICKPACK_ADMIN`, and `REPORTER`. PICKER remains HR-authoritative and is not manually converted. A role change invalidates interactive sessions/presence and synchronizes Firebase claims before the account is considered ready.
12. **Release policy.** Beta only. Target Windows Agent is **relay-agent-v40** and Android is the next monotonic signed Beta after `beta-vc75`. No new provider/database/collection is introduced. Stable remains OWNER-GATED and untouched.

### D120 field hotfix — Picker online accuracy and no-flicker Agent list — 2026-09-26

Owner field-tested the released D120 Beta set (Web, signed `beta-vc76`, Agent `relay-agent-v40`) and reported the broader changes usable, but explicitly rejected the Agent online-Picker behavior: the list visibly alternates present/empty at roughly one-second cadence and reports many Pickers while only one or two PDA devices are actually online.

1. The one-second list flicker is a defect, not an accepted refresh effect. Repeated schedule/status ticks must not clear authenticated Picker rows or rebuild an unchanged grid.
2. **Online Picker** means a Picker with a currently attached Android realtime connection **and** the current valid Android session/device registration required by D119. A persisted login/FCM registration by itself is not sufficient to display the device as online.
3. Reuse the existing D098 hibernatable Android WebSocket lifecycle. Do not add a new PDA heartbeat/poll loop. Socket connect/close/error updates the single compact Firestore projection.
4. The projection advances to schema v2 with source `ACTIVE_ANDROID_REALTIME`. Agent must fail closed on legacy/stale projection schema rather than showing historical devices as online.
5. Agent rendering must be double-buffered/no-op aware, preserve search/scroll selection, and the one-second after-hours timer must not churn the authenticated Overview layout.
6. Hotfix target is `relay-agent-v41`; Android/Web source need only change where required for presence authority. Whole Beta compatibility and Stable OWNER-GATED rules remain unchanged.

## D121 — Agent responsiveness and balanced left-column layout — 2026-09-26

Owner confirms D120 and the D120 Picker-presence hotfix are released, then reports additional Windows Agent field defects. This is an Agent-only Beta repair on top of released `relay-agent-v41`; D117/D118 confirmation/HA/WMS mutation semantics and Stable remain protected.

1. **UI responsiveness is a correctness requirement.** WinForms timers must not execute Firestore/network I/O or potentially expensive Windows performance-counter sampling synchronously on the UI thread. Schedule refresh and system-monitor sampling run in bounded single-flight background work; the UI consumes the latest cached/sampled result.
2. **No cadence expansion.** Moving work off the UI thread must not add new polling, heartbeat, Firestore checkpoint writes, WMS probes or faster HA/business cadence. Existing D117/D118/D120 quota and confirmation timing remain authoritative.
3. **Balanced Agent workspace.** Because the Picker workspace already owns the right side, the left side is divided evenly between **Hệ thống Agent**, **Hệ thống Supra**, and **Xử lý PickList** using responsive equal-height rows. PickList must no longer consume the remaining left-column height by default.
4. **Compact Agent status line.** The visible **Agent**, **Relay**, and **Wi‑Fi** status labels are rendered on one responsive row with ellipsis protection instead of three stacked rows.
5. **Responsive fleet area.** The Agent fleet table uses the remaining height inside its equal-height card and keeps internal scrolling; resizing the window recalculates the compact authenticated layout without forcing network refresh.
6. Target release is **relay-agent-v42**. No Android/Web/business-resource change is required for this repair. Stable remains **OWNER-GATED** and untouched.

## D122 — Agent stability, operational UX and session recovery — 2026-09-26

Owner field testing of released `relay-agent-v42` found that D121 did not fully eliminate Agent hangs and therefore D121 field acceptance/OA047 is superseded by D122. The following Beta-only repair is approved; D117/D118 confirmation, HA, generation, WMS mutation and schedule semantics remain protected and unchanged.

1. **Agent responsiveness.** Remaining potentially blocking SSID lookup and watchdog maintenance must not execute directly on the WinForms UI timer thread. Overlay creation is deferred from the initial `Shown` path, and unchanged Agent-fleet snapshots must not clear/rebuild the grid every refresh.
2. **Overview proportion.** The D120 two-column shell remains. The left column is responsive **50% Hệ thống Agent / 25% Hệ thống Supra / 25% Xử lý PickList**. Agent fleet consumes the available Agent-card height and scrolls internally when rows exceed the visible area.
3. **SKU feedback and observability.** Manual Agent **Cập nhật SKU** always returns an explicit success/failure result. A successful all-unchanged sync is still a successful synchronization event. Web **Danh mục SKU** shows the latest successful Agent synchronization checkpoint separately from the timestamp of the last actual SKU row change, using the existing SKU import audit trail rather than a new polling/provider resource.
4. **Ca vận hành.** Existing D118 App/PDA overtime controls move from **Công cụ** to the dedicated **Ca vận hành** item under **Vận hành**. The underlying shared schedule authority, permissions and one-hour extension semantics do not change.
5. **Session recovery.** A definitively expired/revoked Agent Firebase session clears the unusable local session and restores Agent username/password/login inputs. A definitively expired Supra/WMS session clears local WMS readiness and visibly restores the normal Supra login/capture button. Temporary transport errors remain fail-closed and must not be misclassified as credential expiry.
6. **Bảng nổi.** Background transparency is separated from the foreground content layer so opacity affects the background while metric text remains fully opaque/readable. Overlay creation/rendering must not block normal Agent startup.
7. **Column sizing.** Agent exposes **Tự căn cột theo nội dung**. When enabled, operational grids size columns to visible content/window width. When disabled, users may resize columns manually; those widths are persisted locally per authenticated Agent user and restored for that user.
8. D122 introduces no new provider, database, Firestore collection, heartbeat, business polling cadence or WMS mutation route. Stable remains OWNER-GATED and untouched. Target Windows release is **relay-agent-v43**.

## D123 — Agent UI-thread affinity and startup hang repair — 2026-09-26

Owner field testing of released `relay-agent-v43` shows an immediate Windows **Not Responding** state after the Overview has already rendered/restored Agent, Supra and Picker state. D122 technical/release gates therefore remain valid, but D122 field acceptance/OA048 is **FAIL** and is superseded by D123/OA049.

1. Source review identifies a concrete WinForms thread-affinity defect: startup/session restore and login run on worker tasks, while `SetAgentAuthUi()` could enter `ApplyD119AuthenticatedLayout()` directly outside the UI dispatcher. That path includes operational grid layout and D122 automatic column sizing, so worker and UI threads could mutate the same WinForms/DataGridView controls concurrently.
2. All D119/D122 layout, grid rendering and automatic column-sizing mutations reachable from startup/login/session recovery must marshal to the owning WinForms UI thread before touching controls. Helper methods also self-guard with `InvokeRequired` so future worker callers fail safe.
3. D123 does not add polling, heartbeat, Firestore/WMS probes, provider resources, database changes or a new WMS mutation route. D117/D118 HA/generation/confirmation rules, D120 Picker-presence authority and all D122 UX/business requirements remain unchanged.
4. D123 target is **relay-agent-v44**. Stable remains OWNER-GATED and untouched.
## D124 — Agent operational cleanup and single-daily SKU synchronization — 2026-09-26

Owner field-tested released `relay-agent-v44` after D123 and approved the following Beta repair. These requirements supersede only the conflicting Agent Overlay and D119 expired-SKU-lease behavior; D117/D118 confirmation/HA/generation/WMS mutation contracts and D120 Picker-presence authority remain protected.

1. **Remove Overlay completely.** Windows Agent no longer exposes, initializes or ships the Overlay/Bảng nổi runtime or its settings surface. Tray, tabs and normal Agent startup contain no Overlay entry point.
2. **Hệ thống Agent observability.** Local confirmation counters belong in **Hệ thống Agent**: received, processed, successful, failed and pending. Basic Agent state plus these counters uses roughly the upper 30% of the Agent card; the fleet table consumes the remaining space with internal scrolling.
3. **SKU progress visibility.** Manual and automatic SKU synchronization show concise stages: daily-lock check, Supra catalog read, per-chunk progress, Service accepted/processing, conflict confirmation when required, and terminal success/failure.
4. **One fleet update per local day after Service submission.** The daily key is Asia/Ho_Chi_Minh. Once the first SKU Service job for that daily operation is submitted, the daily lease records `service_started=true` and remains locked through the day. No Agent may start another automatic or manual daily operation after that point. A failure that occurs before any Service submission may release the short preparation lease for a safe retry.
5. **Timeout/duplicate-race repair.** v44 used a 75-second Agent wait while the Firebase function itself may execute for up to 60 seconds after asynchronous trigger delivery, and the function did not mark a running state. A wait timeout then shortened the lease to 15 seconds, allowing a second Agent/attempt even though the first Service job could still complete later. D124 adds an explicit `RUNNING` Service acknowledgement, raises the bounded Agent wait to 180 seconds, distinguishes pending from running progress, and never short-releases the day lock after Service submission.
6. D124 introduces no new provider, database, Firestore collection or WMS mutation route. Existing `sku_sync_jobs`, Beta Functions and registered Supra Tồn Bin read endpoints are reused. Stable remains **OWNER-GATED** and untouched.
7. Target Windows Agent is **relay-agent-v45**. The Beta Function `skuSyncCreated` is redeployed from the same change set so Service acceptance/progress is observable by Agent.

## D125 — Retire Supra background integration and repurpose Agent as Office Inventory client — 2026-09-26

Status: **OWNER APPROVED / IMPLEMENTATION PENDING**.

D125 supersedes every earlier decision only where that earlier decision authorizes or requires background software to obtain, persist, reuse, refresh or act with a Supra/WMS user session, or to automate PickList confirmation / WMS-derived SKU synchronization.

1. **Corporate security boundary.** Team IT prohibits using a Supra user session in background software. SUPRA Inventory must not capture, read, persist, decrypt, refresh, proxy, replay or otherwise use Supra/WMS session cookies, headers, tokens, signatures, browser-profile material or derivative authentication in the Windows Agent, Web, Android, Cloud Functions or any other project component. Changing storage technique (RAM, DPAPI, browser profile, local file, etc.) does not change this prohibition.
2. **Xác nhận đơn is retired.** In this project, `Xác nhận đơn` means the Supra PickList confirmation capability. The Android Picker `Xác nhận đơn` feature, tab, Firestore request/ACK flow, PickList lookup, WMS confirmation, confirmation guards, HA scheduling that exists only for this workflow, and all Agent PickList/Supra surfaces are removed from the target model. No replacement may automate Supra without a new explicit Owner decision backed by IT authorization.
3. **Android becomes single-purpose Báo hàng.** Picker Android keeps the existing Báo hàng workflow. Remove the bottom `Báo hết hàng / Xác nhận đơn` tab switcher; with only one remaining business surface, the screen directly presents the Báo hàng UI. Existing Báo hàng state, notifications, result acknowledgement and offline prohibition remain authoritative unless separately changed.
4. **Terminology guard.** `Xác nhận SKU` means the existing Inventory Báo hàng resolution workflow (for example Có hàng / Cho phép skip as authorized by role). It is not the retired PickList `Xác nhận đơn` capability and remains in scope.
5. **SKU master becomes manual-source only.** Automatic or manual WMS/Tồn Bin reads for SKU master are retired. SKU master updates use the existing authorized manual file import supplied by the Owner/operator. Existing validation, dedupe, additive merge and explicit changed-name conflict rules remain. Absence from a later file does not delete an existing SKU unless a separately approved reset workflow is used.
6. **Web cleanup.** Remove any Web surface, guidance, state or tool that exists to support Supra session acquisition/reuse, WMS/PickList automation or WMS-driven SKU synchronization. If no such surface exists, no unrelated Web behavior is changed.
7. **Windows Agent is repurposed as the Office version of the Inventory Web experience.** The target Agent no longer has any Supra/WMS function. Outside the internal Office network it remains a lightweight dormant/background client and may observe only local network/Wi-Fi state needed to decide whether Office mode should be presented. When the approved Office network is detected and permitted Google/Firebase connectivity is available, the same process activates Office mode and opens the operational UI; process restart is not required merely for Wi-Fi switching.
8. **Office business surface.** Office mode presents the Inventory business capabilities that are valid for the authenticated role, aligned with the Web's operational model: Báo hàng processing / Xác nhận SKU, personnel/Picker visibility and approved Picker-contact actions, SKU master search and manual-file update, and other explicitly Web-authorized Inventory functions added during implementation. It must not recreate PickList confirmation, Supra login/session controls, Tồn Bin automation or hidden WMS calls.
9. **Authority and bridge model.** InventoryCore/Worker remains the transaction/business authority. Firebase Auth remains identity authority for supported client authentication. Firestore/FCM/Functions may be reused as an Office-reachable projection/command/notification bridge, but Firestore must not become an independent business source of truth and must not permit an Office client to bypass server-side RBAC or InventoryCore state transitions.
10. **Resource treatment.** Existing Firebase/GCP/Drive/GitHub resources may be retained and reused where they still serve Báo hàng, Office projection, notifications, presence, logs or manual SKU workflows. Existing WMS/Supra resources and PickList relay artifacts remain historical until implementation cleanup, but are **FORBIDDEN FOR RUNTIME USE under D125**. Do not delete production/support data or IAM/resources merely as part of this authority-only decision.
11. **D124 field gate superseded.** OA050 and any remaining field acceptance step that requires Supra session, WMS confirmation or WMS SKU synchronization are cancelled/superseded. The released v45 artifact is historical and must not be treated as the target operating model.
12. **Continuation phrase.** When the Owner later says **`tiến hành sửa đổi mô hình`**, bootstrap current `main`, start a fresh implementation branch, and execute D125 without asking the Owner to restate these requirements.
13. **Stable remains OWNER-GATED.** This decision records the target model only. No Stable deployment, promotion or mutation is authorized by D125 itself.

## D126 — Browser-UI PickList confirmation without Supra session extraction — 2026-09-26

Status: **OWNER APPROVED / IMPLEMENTATION IN PROGRESS**.

D126 supersedes D125 wherever D125 retired the released Android PickList flow or repurposed the Windows Agent as an Office Inventory client. D126 deliberately keeps the currently published Agent/PDA operating model and changes only the Supra integration boundary plus SKU source.

1. **Published operating model retained.** Android/PDA `Xác nhận đơn`, Firestore request/ACK transport, Agent authentication, Picker-contact/presence, PRIMARY/STANDBY/FROZEN coordination, anti-spam, confirmation guards, operating schedule, Agent UI structure and existing Báo hàng behavior remain the baseline unless this decision explicitly changes them.
2. **No programmatic Supra session extraction.** The Agent must not capture, inspect, export, persist, decrypt, refresh, replay or attach Supra/WMS cookies, authorization headers, tokens, signatures or browser-profile authentication material. The previous `WmsBrowserCapture`, DPAPI WMS-session file, direct WMS header replay and hidden API authentication model are retired.
3. **User-controlled browser login.** Hệ thống Supra exposes **Truy cập Confirm PickList**. It opens the registered Supra Confirm PickList page in an Agent-managed browser profile/window. If Supra requires login, the user signs in directly in that browser. Agent never receives or stores the Supra username/password.
4. **Browser readiness.** Agent reports **Web Confirm sẵn sàng** only when the managed browser is on the approved Confirm PickList page and the required DOM/table/search/confirmation controls can be uniquely identified. Login/error/unexpected pages are not ready.
5. **Hide/unhide browser.** The browser may be hidden from the desktop and taskbar while remaining alive for automation. Agent must provide a way to restore/show it. Hiding is presentation only; it must not bypass readiness or confirmation guards.
6. **DOM-only PickList resolution.** Agent reads rendered page DOM only; it must not call WMS PickList APIs, browser `fetch`/XHR endpoints or inspect network/session traffic. A candidate is valid only when the visible PickList text matches `^PL[0-9]+$` and its numeric suffix ends exactly with the PDA/manual input. Zero or multiple matches are never treated as a unique result.
7. **One bounded search retry.** Agent first checks the current rendered table. If no unique match exists because the page may not yet show the target, Agent may click exactly one uniquely identified **Tìm kiếm** button on the Confirm PickList page, wait for the table to settle, and resolve once more. A second miss returns **Không tìm thấy**. Ambiguous results remain fail-closed.
8. **Manual Agent confirmation.** A unique manual search is displayed in Agent as today. The operator must press the Agent confirmation action. Immediately before mutation, Agent re-resolves the exact full PickList row, confirms the row still contains that same full code, selects only the checkbox inside that row, verifies it is checked, then clicks exactly one enabled button whose normalized visible text is **Xác nhận lấy lại hàng**. Any selector/text/count/state mismatch aborts without clicking.
9. **PDA automatic confirmation.** A PDA request uses the same exact DOM resolution, uniqueness, row re-validation, checkbox and exact-button guards, but after a unique match it skips the extra human confirmation in Agent and executes the guarded browser action automatically. Existing Firestore ACK/result, rate-limit, idempotency and HA ownership rules remain.
10. **Wrong-button prohibition.** Agent must never click **Xác nhận hoàn thành lấy hàng**, **Xuất File**, or any other neighboring action as a fallback. Coordinate-only clicking is forbidden for the business mutation. If the approved exact confirmation button cannot be uniquely identified, the operation fails closed.
11. **No direct PickList WMS API mutation.** Previous direct GET lookup and `confirmSkipItem` POST code paths are retired from runtime. Browser UI automation is the only D126 PickList interaction with Supra.
12. **SKU master is manual-file-only.** D124 automatic/manual WMS/Tồn Bin SKU synchronization is retired. Existing Web manual file import remains the approved SKU-master update path with current validation, dedupe, additive merge and changed-name confirmation. Automatic SKU synchronization may be reconsidered only by a later Owner decision.
13. **D125 Office rewrite cancelled before implementation.** D125 remains historical authority explaining the rejected model, but its Android removal, Office-client rewrite and Firestore Office command bridge are not implementation targets.
14. **Beta first / Stable guarded.** D126 implementation and release are Beta-only. Stable remains OWNER-GATED and requires a separate explicit Owner authorization.

### D126-H1 — Browser readiness field hotfix — 2026-09-26

Status: **TECHNICAL / RELEASE PASS — OWNER FIELD RE-TEST REQUIRED**.

- Field evidence on released `relay-agent-v46` shows the managed Edge browser starts and the user can reach the registered Confirm PickList page, but Agent remains `LOGIN_OR_DOM_NOT_READY` / `ready=0`.
- The D126 security and mutation boundary is unchanged: DOM-only, no browser Network domain, no cookie/token/header/signature extraction, no direct WMS API and no coordinate-only mutation.
- Hotfix target is `relay-agent-v47`. Readiness must recognize the real rendered Confirm UI through semantic action elements (`button`, `a`, `role=button`) and same-origin frame DOM when present. The exact confirmation control may be non-visible before row selection but must still be uniquely identifiable in DOM; the actual mutation still requires exactly one visible enabled **Xác nhận lấy lại hàng** control after the exact row checkbox is selected.
- PickList rows may be semantic table rows (`tr` or `role=row`). Checkbox/confirmation framework state may settle asynchronously, so v47 may wait for a short bounded interval and must still fail closed on zero/multiple/disabled/changed controls.
- Browser diagnostics may record only sanitized page origin/path and non-sensitive DOM counts. No query string, browser session material or authentication data may be logged.
- Hotfix PR **#200** passed Repo Authority, Project State/Continuity, UI Design, Firestore, RTDB and Relay Agent gates, then merged to `main` at `3eb45c4a59564501e2b5dd95f60ee6072a79dc9a`.
- Main verification passed: Repo Authority run `36226943848`, Project State/Continuity run `36226943851`, UI/Operational regression run `36226943951`, and Relay Agent build/startup/schedule/release run `36226943832`.
- `relay-agent-v47` is published as prerelease `397141086`; canonical EXE asset `590174179`, size `288256`, SHA-256 `3f31cfc6efd2a7deacdb2ca58066852f40e126ee6255d205c51fb70da3f28cfc`. The fixed `inventory-channel` now serves v47 through manifest asset `590174265` and EXE asset `590174261`.
- This evidence closes the automated technical/release layer only. OA051 remains open because the real company Supra DOM/login and guarded business click must be re-tested physically on v47 before D126 can be field-PASS.



### D126-H2 — Search-control and DevTools recovery field hotfix — 2026-09-26

Status: **TECHNICAL / RELEASE PASS — OWNER FIELD RE-TEST REQUIRED**.

- Owner field evidence on released `relay-agent-v47` confirms the correct registered Confirm PickList page is loaded and the browser DOM is partially recognized, but readiness remains false. Sanitized diagnostics show `search=0`, `confirm=1`, `confirm_visible=1`, `table=1`, `frames=0`; therefore the current readiness blocker is the **Tìm kiếm** control recognizer rather than page URL, login state, table presence or confirmation-control presence.
- The same field run shows a later DevTools WebSocket loss followed by repeated loopback attach failure while the browser window remains open. v48 must first reattach to the existing managed-browser DevTools port/target; only if that local reattach is impossible may it close/restart the managed browser process and reopen the same registered page.
- Search recognition remains semantic DOM-only and fail-closed. For the non-mutating **Tìm kiếm** action, v48 may resolve one unique visible exact normalized label from element text/value, `aria-label`, `title`, or a unique exact-text leaf whose click bubbles to the page handler. Zero or multiple candidates block the search click.
- The one-search-retry limit is unchanged. This fallback applies only to the **Tìm kiếm** action; the business mutation still requires the exact row checkbox plus exactly one visible enabled semantic **Xác nhận lấy lại hàng** control.
- DevTools recovery must remain loopback-only and must not enable the browser Network domain, inspect requests, read cookies/storage, extract/persist/replay Supra authentication material or call WMS APIs.
- Target release is `relay-agent-v48`. Android remains `beta-vc76`; SKU remains manual-file-only; Stable remains OWNER-GATED and untouched.
- Implementation PR **#202** passed Repo Authority `36234210939`, Project State/Continuity `36234210941`, UI Design `36234210930`, Firestore `36234210953`, RTDB `36234210932` and Relay Agent `36234210980`; merged to `main` at `b130cc1d63411b05fd0aeeb5fbe7823e31c7616b`.
- Main verification passed: Repo Authority `36234305295`, Project State/Continuity `36234305282`, UI Design `36234305275`, Relay Agent `36234305340`.
- `relay-agent-v48` release id `397181209`; EXE asset `590402152`, size `292864`, SHA-256 `3808846da171791f50945bc5a086a29d2c45e0f366725933c653ce9d584d3f8d`.
- `inventory-channel` now carries v48 through manifest asset `590402203` and EXE asset `590402204`.
- Automated technical/release evidence is PASS. OA051 remains open for the real Supra field re-test on v48.


### D126-H3 — Decorative search-icon label compatibility — 2026-09-26

Status: **TECHNICAL / RELEASE PASS — OWNER FIELD RE-TEST REQUIRED**.

- Owner field re-test on released `relay-agent-v48` confirms the Agent is on the correct registered Confirm PickList page and the v48 DevTools reconnect repair works, but readiness still remains false because the real search control is rendered visually as a magnifying-glass icon plus **Tìm Kiếm**. Sanitized field diagnostics remain `search=0`, `confirm=1`, `table=1` on the correct page.
- The non-mutating **Tìm kiếm** recognizer may normalize Unicode NFC and ignore zero-width formatting characters. It may accept one unique control whose label is the exact target phrase plus only decorative search/icon material before or after that phrase, including private-use/search glyphs and the common textual icon tokens `search`, `magnify`, `magnifying`, `glass`, `find`, or `icon`.
- This compatibility is scoped only to the search action. Zero or multiple resolved search controls remain fail-closed. The one-search-retry limit remains unchanged.
- The confirmation mutation boundary is not widened: **Xác nhận lấy lại hàng** remains exact-label-only, with exact-row re-resolution, row checkbox uniqueness and checked-state verification before mutation.
- Diagnostics may add only non-sensitive counts such as exact-vs-decorated search matches. No raw page business text, query string, cookie, token, header, signature, session material, Network-domain data or WMS API request may be logged or inspected.
- Target release is `relay-agent-v49`. Android remains `beta-vc76`; SKU remains manual-file-only; Stable remains OWNER-GATED and untouched.
- Implementation PR **#204** passed Repo Authority `36236311977`, Project State/Continuity `36236311994`, UI Design `36236311984`, Firestore `36236311979`, RTDB `36236311989` and Relay Agent `36236311982`; merged to `main` at `3a45ca0ccb62aaa6e67a9f41c0f7aac1d0f2cb39`.
- Main verification passed: Repo Authority `36236408473`, Project State/Continuity `36236408470`, UI Design `36236408580`, Relay Agent build/startup/schedule/release `36236408518`.
- `relay-agent-v49` release id `397195742`; canonical EXE asset `590463163`, size `297984`, SHA-256 `9c8cc4054501871443eba905dd4bc03c1dd2c6b94590bbd318eecdb3e0899dc4`. The tag points exactly to `3a45ca0ccb62aaa6e67a9f41c0f7aac1d0f2cb39`.
- `inventory-channel` now serves v49 through manifest asset `590463228` and EXE asset `590463226`.
- Automated technical/release evidence is PASS. OA051 remains open for real-Supra field acceptance on v49.


### D126-H4 — Guarded second-step confirmation dialog — 2026-09-26

Status: **TECHNICAL / RELEASE PASS — OWNER FIELD RE-TEST REQUIRED**.

- Owner field observation confirms that selecting the exact PickList row checkbox and clicking **Xác nhận lấy lại hàng** does not complete the business action immediately. Supra opens a second confirmation dialog.
- The real dialog is identified by the exact normalized title **XÁC NHẬN LẤY LẠI HÀNG**, exact normalized body **Bạn có chắc chắn cho phép lấy hàng lại không?**, one exact **Xác nhận** action and one exact **Đóng** action inside the same visible dialog surface.
- The Agent must treat this dialog as a mandatory second step of the already-authorized mutation. After the existing exact-row/checkbox/exact-main-button guards pass, it waits a short bounded interval for exactly one matching dialog and automatically clicks only that dialog's exact **Xác nhận** action.
- A missing, ambiguous, structurally mismatched or disabled dialog/confirm action fails closed. The Agent must never use a page-global generic **Xác nhận** button and must never click the dialog's **Đóng** action as a fallback.
- Success is still not inferred from the modal click alone. Existing post-action DOM success/error/row-removal evidence remains required; uncertain state remains non-success and is not blindly retried.
- No session/network/API boundary changes are authorized. Target release is `relay-agent-v50`; Android remains `beta-vc76`; SKU remains manual-file-only; Stable remains OWNER-GATED and untouched.
- Implementation PR **#206** passed Repo Authority `36237696472`, Project State/Continuity `36237696471`, UI Design `36237696486`, Firestore `36237696438`, RTDB `36237696474` and Relay Agent `36237696469`; merged to `main` at `1a9461b8cd3ad20bbd6e93a254f46ffd4ccbee55`.
- Main verification passed: Repo Authority `36237772145`, Project State/Continuity `36237772152`, UI Design `36237772206`, Relay Agent build/startup/schedule/release `36237772139`.
- `relay-agent-v50` release id `397204407`; canonical EXE asset `590503449`, size `308736`, SHA-256 `36edb474ec6e6d01c1eb67c36c1c136bdaf5b807f980fb00ebfae56eaea9644f`. The tag points exactly to `1a9461b8cd3ad20bbd6e93a254f46ffd4ccbee55`.
- `inventory-channel` now serves v50 through manifest asset `590503527` and EXE asset `590503526`.
- Automated technical/release evidence is PASS. OA051 remains open for the real Supra field re-test of the full checkbox → primary confirm → dialog confirm → terminal-result sequence.

## D127 — Quota-safe Picker presence, Supra row readiness and Agent-owned browser fallback — 2026-09-26

Owner approves one coordinated Beta change set on top of D126. Stable remains OWNER-GATED and untouched.

1. **Quota repair is mandatory.** The D126 confirmation queue must query only fresh `PENDING` jobs inside the existing 20-second terminal window. Historical/stale PENDING documents must not be downloaded and discarded repeatedly. An unsafe broad-list fallback is forbidden.
2. **Picker presence becomes event-driven.** Android session/socket/device lifecycle updates one compact current-state projection and one bounded single-slot relay control event. Agent periodic UI timers must not read Picker presence every 15 seconds or every minute. A newly authenticated/takeover/recovered PRIMARY may load one authoritative snapshot.
3. **Picker presence lifecycle.** Login/socket connect adds or reconciles the Picker. Explicit logout, device removal, session replacement/change and role change remove immediately. Unexpected socket close/error receives a 180-second presentation grace; reconnect cancels the grace. The 05:00–23:00 Asia/Ho_Chi_Minh PDA window is authoritative for display: entering the window permits one snapshot and 23:00 without extension closes the displayed list. The 14:00 shift boundary never forces logout; a valid continuing session may span shifts.
4. **Picker alerts are server-filtered.** Agent may load only open `PENDING/SENT` Picker contact documents; it must not list 100 historical alerts and filter resolved rows client-side on each presence refresh.
5. **Supra page size.** Before lookup/mutation, Agent verifies the semantic **Số dòng mỗi trang** control. If it is not 100, Agent selects exactly **100**, waits for reload and verifies the new value. Missing/ambiguous controls or option 100 fail closed.
6. **Checkbox-ready lookup.** A unique visible PickList row is not considered confirmable until that exact row has one enabled checkbox. If the row is present but the checkbox is disabled/unselectable, the same batch may spend its one existing semantic **Tìm kiếm** refresh budget, then re-resolve. Still-unselectable after that refresh is a terminal Supra rejection and no confirmation mutation is attempted. A burst/batch performs at most one Search refresh, not one per PDA.
7. **Agent-owned browser preferred.** Agent prefers a separately distributed x64 **WebView2 Fixed Version Runtime** plus a dedicated Agent browser host/profile. The browser profile may use WebView2 password/autofill persistence, but Agent code must never read, log or persist plaintext passwords, cookies, headers, tokens or signing material.
8. **Browser fallback is mandatory.** If the owned WebView2 bundle is absent, unsupported, fails to start or cannot attach its local DOM-control channel, Agent automatically falls back to the D126 dedicated-profile system-browser path: Microsoft Edge first, then Google Chrome. Failure of the preferred browser must not make an otherwise-capable laptop unusable.
9. **Isolation.** User Edge/Chrome and the Agent-owned WebView2 runtime are separate processes/profiles. Closing or terminating the user's normal Edge must not terminate the owned browser host. The legacy fallback remains available for machines that cannot run the owned runtime.
10. **Security boundary unchanged.** DOM-only automation remains limited to Runtime/Page semantics. Network inspection, auth extraction/replay, direct WMS APIs and coordinate-only mutation remain forbidden. D117/D118 HA/generation fences and D126 exact row/modal confirmation remain protected.
11. Candidate Agent target is **relay-agent-v51**. Android remains **beta-vc76** unless a later implementation defect requires a separately justified Android rebuild. No Stable change is authorized.

## D127 technical / release checkpoint — 2026-09-26

D127 implementation and release repair are **TECHNICAL / RELEASE PASS** on Beta. Owner field acceptance remains pending under OA052.

- Implementation PR #208 squash-merged to main `f5ad9d45be3445b6e030d1f5f0de1abc0507b54e`; all PR gates passed before merge.
- The first main Relay Agent release job published `relay-agent-v51` and advanced the normal Agent channel, but failed only while trying to scrape the non-rendered Microsoft WebView2 page for the Fixed Runtime bundle. The Agent binary itself was already valid and published.
- Release-repair PR #209 replaced static HTML scraping with a rendered Microsoft Edge/Playwright resolver, dynamically selecting the currently offered official x64 Fixed Version Runtime. All PR gates passed; it squash-merged to main `74947a0a66bb63c0ec02d2b00ba7bda31c189b1d`.
- Final main gates after the repair passed, including Relay Agent run `36254747649`. The normal v51 Agent source tree did not change during the repair.
- Agent release: `relay-agent-v51`, release id `397296190`, canonical EXE asset id `590949850`, size `331264` bytes, SHA-256 `adfd0350484c41b27842d406551d3f8b0d877c076b280b7c1a932adb62421fbd`.
- `inventory-channel` now serves the v51 Agent manifest/EXE assets `590987988/590987986`.
- Agent-owned browser bundle is published on the same channel using official Microsoft WebView2 Fixed Runtime **154.0.4258.37 x64**. Bundle asset id `590989452`, size `318502518` bytes, SHA-256 `d7cd8e9b295efc33b68c1bcd52248a8a6e0a04a8ec104454579570c8f446c12e`; manifest/checksum assets `590989453/590989454`.
- Android remains signed `beta-vc76`; D127 required no Android rebuild.
- D127 source guards keep fresh-only Firestore PENDING reads, event-driven Picker presence with 180-second transient disconnect grace, server-filtered open Picker alerts, semantic page-size 100, one batch Search retry for a missing/disabled exact row, owned WebView2 preferred, automatic Edge/Chrome fallback, and D126 DOM-only security/confirmation guards.
- Stable remains OWNER-GATED and untouched.
- Next gate: OA052 real-field acceptance. D127 is not Owner-PASS until that physical Beta review passes.

## D127 hotfix — Agent v52 UI visibility and owned-browser download status — 2026-09-26

Owner requested two field-facing fixes before OA052 acceptance. **TECHNICAL / RELEASE PASS** on Beta; OA052 physical field acceptance remains pending.

- PR #211 squash-merged to main `50773a7001b3ab145d3e0189eed068c03b2d9ee5`.
- Main Relay Agent run `36256314847` completed successfully.
- Agent release advanced to `relay-agent-v52`, release id `397315426`, canonical EXE asset `591029955`, size `335360` bytes, SHA-256 `fce784ee55c7bef84c3f283cc6a0ec7e6f91dc1153f46386a0a3d2fb1edf1852`.
- `inventory-channel` now serves v52 through manifest/EXE assets `591030008/591030007`.
- After-hours decision UI no longer shares the Agent/Relay/Wi-Fi status area. It uses a dedicated responsive panel with the fleet table reflowed below it, so **Tiếp tục** / **Dừng** remain visible in the half-width Agent card and after resize.
- **Hệ thống Supra** now exposes **Tải trình duyệt Agent**, a 0–100% progress bar, and a persistent **Trình duyệt Agent khả dụng · WebView2 Fixed <version>** state after checksum-verified installation.
- Automatic background acquisition remains supported; owned WebView2 remains preferred and Edge/Chrome dedicated-profile fallback remains unchanged.
- The WebView2 Fixed runtime bundle remains **154.0.4258.37 x64** on `inventory-channel` (asset `590989452`); no redundant browser bundle republish was required.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 should be run against **relay-agent-v52**.

## D127 field hotfix — Agent v54 explicit x64 WebView2Loader — 2026-09-26

Owner field review on v53 confirmed the rows-per-page 100 repair works, but the Agent-owned browser still reproduced `BadImageFormatException / 0x8007000B`.

- PR #215 squash-merged to main `65f17d48c6f4dd00f9dd48c52ecb05ecba3703f8`.
- Main Relay Agent run `36258561369` completed successfully.
- Agent release advanced to `relay-agent-v54`, release id `397327827`, canonical EXE asset `591091889`, size `340992` bytes, SHA-256 `05db596637f30c24e59c9394affbc79d97d5981d9e663b8e2d7295e53c337ca6`.
- `inventory-channel` serves v54 through manifest/EXE assets `591091939/591091938`.
- v54 no longer relies on default native-loader probing. The owned host requires a 64-bit process and explicitly binds the dedicated `host/loader/x64/WebView2Loader.dll` before creating the WebView2 environment.
- CI now PE-validates both the host executable and the dedicated loader as AMD64 before publishing the browser bundle.
- Browser bundle generation advanced to `host_build=3`; Agent v54 refuses older local browser bundles without matching host-build/host-arch markers, preventing v52/v53 browser hosts from being reused as ready.
- New browser bundle asset `591093722`, manifest/checksum assets `591093726/591093719`, size `318615500` bytes, SHA-256 `bf3dea509fe631a59f09a49b51756c55f4086c2388241386115817ee0420d1bb`.
- Explicit browser choice remains: **Mở trình duyệt Agent** never auto-falls back to Desktop; **Mở trình duyệt Desktop** explicitly opens Edge/Chrome.
- Rows-per-page 100 remains unchanged from v53 and was reported field-OK by Owner.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 remains pending until the Owner verifies the Agent-owned browser physically on v54.

## D127 field hotfix — Agent v55 same-tab HY1/SFT3 login recovery — 2026-09-27

Owner confirmed WebView2 and rows-per-page 100 were working on v54, but Supra auto-login could redirect the managed tab to Dashboard. Accessing HY1/SFT3 from the Dashboard then opened another tab, leaving Agent attached to the old tab and reporting a wrong Confirm page.

- PR #218 squash-merged to main `19a1a23ec893090beb494e8d26f6eb5feb47e6de`.
- Main Relay Agent run `36261176519` completed successfully.
- Agent release advanced to `relay-agent-v55`, release id `397341737`, canonical EXE asset `591167575`, size `351744` bytes, SHA-256 `702d2a5310f0d9b25c007a12a6762a9d668e978e075ac887f39c3923fbe1db09`.
- Agent-owned browser host advanced to `host_build=4`. WebView2 Fixed remains `154.0.4258.37 x64`; bundle asset `591168957`, manifest/checksum assets `591168955/591168959`, size `318615768` bytes, SHA-256 `1fce2b4683cc819593663412328fa408d63ed0df9fc4f3952c579b46c376890e`.
- If Supra auto-login returns the Agent browser to Dashboard, Agent identifies the unique **Kho Hưng Yên 1 / SFT3** quick-access card and clicks its access control automatically.
- The WebView2 host intercepts Supra `NewWindowRequested` for the trusted WMS host and navigates the current WebView instead of creating a second tab.
- After the warehouse route is entered, Agent navigates that same managed tab to the canonical Confirm URL and only reports READY after the Confirm DOM guard passes.
- Desktop browser mode remains explicit and is not auto-selected.
- Rows-per-page 100 remains unchanged and field-OK.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 remains pending until Owner verifies the complete same-tab auto-login recovery on v55.

## D127 field hotfix — Agent v56 HY1/SFT3 geometric arrow selector — 2026-09-27

Owner field review on v55 showed same-tab routing worked, but the HY1/SFT3 access arrow was not clicked automatically. The rendered action can be visually inside the warehouse card while not being a direct DOM descendant of the smallest text container.

- PR #220 squash-merged to main `1644b1d63fddda22d9e24828c172e52870397720`.
- Main Relay Agent run `36262177317` completed successfully.
- Agent release advanced to `relay-agent-v56`, release id `397346966`, canonical EXE asset `591193432`, size `353280` bytes, SHA-256 `9f4530ff5a66edeec27804b125e833eb4925a659fcaa7c1dbef4e19eaa17b2a6`.
- v56 anchors on visible **Kho Hưng Yên 1** and **SFT3** text, resolves the nearest card rectangle, finds enabled DOM actions whose centers lie inside the card, and chooses the right-most action corresponding to the access arrow.
- Automation remains DOM-only; no Windows cursor movement or screen-coordinate click is used.
- v55 same-tab `NewWindowRequested` interception remains unchanged. Rows-per-page 100 remains unchanged and field-OK.
- Browser host remains `host_build=4`; the ~318 MB browser bundle does not need to be re-downloaded for v56.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 remains pending until Owner verifies the automatic arrow click on v56.

## D127 field hotfix — Agent v57 exact HY1/SFT3 MUI arrow + storage management — 2026-09-27

Owner supplied the live DOM for the HY1/SFT3 quick-access arrow after v56 still did not click it automatically.

- PR #222 squash-merged to main `8128783905e0503658db7ac1d59f2ce3272d3f4c`.
- Main Relay Agent run `36263791064` completed successfully.
- Agent release advanced to `relay-agent-v57`, release id `397355162`, canonical EXE asset `591237002`, size `355328` bytes, SHA-256 `7c2684091bbeb8b4ce249c9ce5cb417ddfaef6e8292e899c95dd072882fb70b2`.
- v57 resolves the nearest `MuiPaper-root` card containing exact visible **Kho Hưng Yên 1** and **SFT3**, then selects `button.MuiIconButton-root`; it prefers the exact right-arrow SVG path from the field DOM and only falls back when that card contains exactly one MUI icon button.
- Same-tab WebView2 `NewWindowRequested` interception and the rows-per-page 100 field fix remain unchanged.
- Browser host remains `host_build=4`; the existing WebView2 Fixed `154.0.4258.37 x64` bundle is reused, so v57 itself does not require another ~318 MB browser download.
- Browser storage cleanup now removes obsolete inactive `wv2-*` bundle directories and stale download/extract leftovers after successful activation and once on Agent startup. The active runtime and persistent browser profile/session are retained.
- The Supra card is renamed **Đăng nhập Supra**, displays total local Agent data usage plus Browser data usage, and exposes **Mở thư mục dữ liệu**.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 remains pending until Owner verifies the exact arrow auto-click and storage controls on v57.

## D127 field hotfix — Agent v58 structural quick-access selector + visible build identity — 2026-09-27

Owner reported v57 still did not auto-click the dashboard access control and questioned whether generated names differed between browser runtimes. The v57 official artifact was independently inspected and did contain the intended UI/storage/selector strings, so v58 makes the selector independent of visible warehouse names and adds an obvious in-UI build identity.

- PR #224 squash-merged to main `c388b000858aeaadb4cc54ecebafb4f46d537054`.
- Main Relay Agent run `36265082575` completed successfully.
- Agent release advanced to `relay-agent-v58`, release id `397361984`, EXE asset `591275971`, size `354816` bytes, SHA-256 `6ab4d8707ca1d2d5785d598268895910980c26c1cd1230830dc2d9ef52334309`.
- v58 no longer uses **Kho Hưng Yên 1**, **SFT3**, generated JSS classes, or generated CSS hashes to identify the access action.
- It resolves the warehouse quick-access card by the distinctive warehouse illustration SVG paths and resolves the action by the exact right-arrow SVG path; same-origin iframes are included and the action fails closed unless exactly one structural candidate exists.
- The Supra card title now renders **Đăng nhập Supra · v58**, making stale/wrong binary detection visible without relying only on the window title.
- The v57 data-size display, data-folder button, browser cleanup, same-tab WebView2 routing, and rows-per-page 100 behavior remain.
- Browser host remains build 4; no WebView2 bundle redownload is required solely for v58.
- Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- OA052 remains pending physical v58 verification.

## D127 field hotfix — Agent v60 host-native Dashboard entry + storage breakdown — 2026-09-27

Owner video on v59 showed the visible Agent WebView2 remaining on Dashboard without automatically clicking the warehouse quick-access arrow. Storage UI also caused confusion because the ~318 MB downloadable browser bundle was compared with total installed/local browser data.

- PR #227 squash-merged to main `dd6f6fc94e6f1097614372da1d7027f06e7fcbfa`.
- Main Relay Agent run `36267173324` completed successfully.
- Agent release advanced to `relay-agent-v60`, release id `397372247`, canonical EXE asset `591333970`, size `355840` bytes, SHA-256 `416f712c4f9a385d85715baaa5bfd6cf56720dcbb65d79b0fcb201c062a9b54f`.
- Dashboard quick-access probing now runs inside the visible WebView2 host itself on a short timer, rather than relying on the outer Agent's DevTools target/cadence. The probe uses the warehouse illustration SVG plus the right-arrow SVG and only clicks a unique candidate.
- WebView2 new-window requests remain forced into the current tab; after warehouse entry the same tab returns to the canonical Confirm URL.
- Browser host advanced to `host_build=5`; browser bundle asset `591335732`, manifest/checksum assets `591335733/591335734`, size `318618821` bytes, SHA-256 `d23dbd53f49a30d15a5ab9647e81e476a7feb240f714f1a5c9b14cb90d8a6b48`.
- Storage UI now separates **Runtime cài**, **Profile/cache**, **Khác**, and **Tổng**. The ~318 MB channel asset is the compressed download bundle and is not equivalent to installed runtime + browser profile/cache usage.
- Existing cleanup still removes obsolete inactive `wv2-*` bundles and stale download/extract leftovers while preserving the active runtime and login profile.
- Android remains unchanged; Stable remains OWNER-GATED and untouched.
- OA052 remains pending physical v60 verification.

## D127 field failure — Agent v62 Dashboard recovery and v63 corrective direction — 2026-09-27

Owner field test confirmed `relay-agent-v62` still remains on the Supra Dashboard after login; OA052 therefore remains **FIELD FAIL** for Dashboard → HY1/SFT3 → Confirm recovery. A CI/build/release PASS must not be treated as field acceptance.

- Source audit found a concrete regression: the v58 outer-browser recovery walked the top document plus same-origin iframes, but the host-native implementation introduced in v60 and retained through v62 queried only the top-level `document`. Changing v62 from `HTMLElement.click()` to DevTools mouse injection did not repair a target that may live in a Dashboard frame/micro-frontend.
- v63 restores bounded same-origin document traversal inside the visible Agent-owned WebView2 host (maximum eight documents), resolves the exact right-arrow MUI control under the unique warehouse-card structure, and fails closed on zero or multiple candidates.
- v63 activates that unique control through CDP `Runtime.evaluate` with `userGesture=true`. This preserves browser user-activation semantics for the Supra handler that opens the warehouse route, while the existing `NewWindowRequested` handler still forces the validated `wms-supra.winmart.vn` route into the same Agent tab and then returns to the canonical Confirm PickList page.
- Diagnostics record only sanitized structural counts (`docs/arrows/cards`) and activation state. They do not record passwords, cookies, tokens, headers, signatures, page text, or session material.
- No Windows cursor movement/screen-coordinate automation is introduced. No direct WMS API is introduced. Android remains `beta-vc76`; Stable remains OWNER-GATED and untouched.
- v63 targets Agent build 63 and browser host build 8. Exact merged/release evidence is recorded only after CI/release reaches terminal PASS.

## D127 v63 release checkpoint — frame-aware user-gesture Dashboard recovery — 2026-09-27

The v62 Owner field result remains **FAIL**: the Agent-owned browser stayed on Supra Dashboard even after v62 changed the activation mechanism to DevTools mouse events. D127 therefore must not treat v62 as field-accepted.

v63 corrective release evidence:
- PR #234 squash-merged to `main` at `f7dd84a151e295d30dc7e6082524fe198b1bb314`.
- PR gates PASS: Repo Authority `36270734532`, Project State `36270734540`, UI Design `36270734523`, Verify Beta Relay Agent `36270734586`, Firestore `36270734659`, RTDB `36270734531`.
- Main gates PASS: Repo Authority `36270857400`, Project State `36270857386`, UI Design `36270857416`, Verify Beta Relay Agent `36270857415`.
- Agent release: `relay-agent-v63`, release id `397391250`, canonical EXE asset id `591438006`, size `355840` bytes, SHA-256 `7db5ca13a8fa68930553314cfee217e452fa879f8cef5f17ee542cc5bc2aba16`.
- Inventory channel Agent alias advanced to manifest asset `591438067` and EXE asset `591438070`.
- Agent-owned Fixed WebView2 remains version `154.0.4258.37 x64` and advances to **host build 8**. Channel bundle asset id `591439589`, size `318620689` bytes, SHA-256 `845e9b55ed1b419308c892260758da6fa547ec9e0d1f90e9b07cd8726fc01f1e`; manifest/checksum asset ids `591439590/591439588`.
- v63 restores bounded same-origin frame traversal lost by the v60-v62 host-native rewrite and activates only the unique structural warehouse access control through CDP `Runtime.evaluate` with `userGesture=true`. Validated Supra new-window navigation is still forced into the same managed tab before canonical Confirm PickList navigation.
- Sanitized diagnostics expose only activation state and `docs/arrows/cards` counts. No password, cookie, token, header, signature or page-content capture is added.
- Android remains `beta-vc76`. Stable remains OWNER-GATED and untouched.

D127 is now **TECHNICAL / RELEASE PASS for v63**, but OA052 remains open. Final field PASS requires the Owner to verify on the real company laptop that a Supra login landing on Dashboard automatically enters the warehouse/SFT3 route and reaches Confirm PickList **without manual Dashboard clicking**.

## D127 v64 — direct Confirm navigation with bounded login-aware retry — 2026-09-27

Owner field test reports `relay-agent-v63` still remains on the Supra Dashboard. The Dashboard-card automation introduced across v55–v63 is therefore retired for the Agent-owned browser.

Approved v64 behavior:
- Pressing **Mở trình duyệt Agent** targets the canonical Confirm PickList URL directly: `https://wms-supra.winmart.vn/sft3/app/saleorder/auto-pickpack-confirm`.
- After the page is fully loaded, Agent detects the login screen only by the exact visible text **Lưu thông tin đăng nhập**. When present, Agent shows **Cần đăng nhập Supra trên trình duyệt**, performs no Dashboard action and does not repeatedly reload Confirm.
- The user enters Supra credentials only inside the browser. Agent does not read, capture, store or log those credentials or any cookie/token/header/signature/session material.
- When the exact login marker disappears, if the fully loaded page is not the canonical Confirm URL, Agent navigates directly to Confirm **once**. The same one-retry rule applies when an already-authenticated initial Confirm navigation redirects to Dashboard.
- If that one retry still ends on a fully loaded page that is neither the login marker state nor the Confirm URL, Agent stops and reports **Chưa vào được Confirm sau khi thử lại**. No infinite navigation loop is allowed.
- The Agent-owned WebView2 host no longer searches for, identifies or clicks any Dashboard warehouse/SFT3 card, arrow, SVG or other Dashboard action.
- Desktop Edge/Chrome remains an explicit operator-selected fallback button; v64 does not auto-switch browser modes.
- Existing D126 semantic Confirm DOM, paginator 100, row checkbox, exact confirmation dialog, HA/rate-limit/idempotency, quota protections and Android `beta-vc76` remain unchanged. Stable remains OWNER-GATED and untouched.

v64 targets Agent build 64 and Agent-owned browser host build 9. Technical/release PASS is recorded only after PR/main gates and release assets complete; OA052 remains open for real-company-laptop field acceptance.

## D127 v64 release checkpoint — direct Confirm retry — 2026-09-27

The v63 Owner field result remains **FAIL** because the Agent-owned browser still remained on Supra Dashboard. v64 retires Dashboard-card automation and implements the Owner-approved direct-Confirm retry model.

Release evidence:
- PR #236 squash-merged to `main` at `402faa0c073a34fa968b1b056fb74c6f857c0b64`.
- PR gates PASS: Repo Authority `36285503453`, Project State `36285503407`, UI Design `36285503355`, Verify Beta Relay Agent `36285503361`, Firestore `36285503354`, RTDB `36285503357`.
- Main gates PASS: Repo Authority `36285587047`, Project State `36285587052`, UI Design `36285587090`, Verify Beta Relay Agent `36285587114`.
- Agent release: `relay-agent-v64`, release id `397461190`, canonical EXE asset id `591859697`, size `349184` bytes, SHA-256 `c0a5d56d77ee2b701207082706afc3adf14aab966c72187168ba6420986f079c`.
- Inventory channel Agent alias advanced to manifest asset `591859771` and EXE asset `591859762`.
- Agent-owned Fixed WebView2 remains `154.0.4258.37 x64` and advances to **host build 9**. Main workflow log confirms publication with bundle size `318615765` bytes and SHA-256 `2be8b5665c7793dbbd3d54d58d96d487003aaa9dd8e51c8f034a8644461fdbec`; channel bundle/manifest/checksum asset ids are `591861254/591861251/591861252`.
- The host/controller no longer contains Dashboard warehouse/SFT3 selector/click automation. Agent initially navigates directly to the canonical Confirm URL, pauses on exact visible **Lưu thông tin đăng nhập**, and after login or an already-authenticated Dashboard redirect performs at most one loaded-page direct Confirm retry.
- If one retry still ends on a loaded non-login, non-Confirm page, Agent stops and exposes **Chưa vào được Confirm sau khi thử lại** rather than looping.
- Desktop Edge/Chrome remains explicit operator fallback. No password/session/token/cookie/header/signature extraction and no direct WMS API is introduced.
- Android remains `beta-vc76`. Stable remains OWNER-GATED and untouched.

D127 v64 is **TECHNICAL / RELEASE PASS**. OA052 remains open until the Owner verifies the real logged-out and already-authenticated flows on the company laptop.

## D127 v65 — cross-host direct Confirm retry — 2026-09-27

Owner field evidence on `relay-agent-v64`: the logged-out path works, but an already-authenticated direct Confirm request may redirect to Dashboard and remain there while Agent reports **Sai trang Confirm**.

Root cause is confirmed in v64 source: the retry path returned early unless the *current* page URL started with `https://wms-supra.winmart.vn`. That contradicts the approved behavior because a Dashboard/SSO redirect may use another company host.

v65 correction:
- Current page host is no longer used to decide whether the bounded retry may run.
- The retry destination remains fixed to the canonical Confirm URL: `https://wms-supra.winmart.vn/sft3/app/saleorder/auto-pickpack-confirm`.
- Exact visible **Lưu thông tin đăng nhập** still pauses automatic retry and waits for the user.
- When that marker clears on a fully loaded non-Confirm page, retry Confirm once immediately.
- For an already-authenticated loaded non-login/non-Confirm page, require the same URL to remain stable for at least 750 ms before issuing the one retry, preventing a SPA-render race.
- After retry issuance, allow 3 seconds for navigation/redirect before reporting **Chưa vào được Confirm sau khi thử lại**. No loop.
- No Dashboard selector/click automation is restored. WebView2 host build 9 is reused; only the Agent/controller advances to v65.
- Existing D126/D127 confirmation, HA, idempotency, quota and security guards remain unchanged. Android remains `beta-vc76`; Stable remains OWNER-GATED.

## D127 v65 release checkpoint — cross-host direct Confirm retry — 2026-09-27

v64 Owner field acceptance is **FAIL** for the already-authenticated Dashboard path. v65 removes the incorrect current-page host gate and keeps the retry destination fixed to the canonical Confirm URL.

Release evidence:
- PR #238 squash-merged to `main` at `f623a83ec6785f920aa2a6916a1f016e9ec63680`.
- PR gates PASS: Repo Authority `36286272704`, Project State `36286272723`, UI Design `36286272697`, Verify Beta Relay Agent `36286272725`, Firestore `36286272715`, RTDB `36286272676`.
- Main gates PASS: Repo Authority `36286366129`, Project State `36286366233`, UI Design `36286366194`, Verify Beta Relay Agent `36286366107`.
- Agent release: `relay-agent-v65`, release id `397466396`, canonical EXE asset id `591888602`, size `349696` bytes, SHA-256 `3df5c5aab895e2c7ae26f8d7eec016fa6ea4cea5aef1a5c883fb30c9910ef75b`.
- Inventory channel Agent alias advanced to manifest asset `591888652` and EXE asset `591888651`.
- Agent-owned Fixed WebView2 remains `154.0.4258.37 x64`, host build **9**. The browser channel assets remain unchanged at bundle/manifest/checksum ids `591861254/591861251/591861252`, proving this was an Agent/controller-only release.
- v65 no longer requires the current Dashboard/SSO page to be hosted at `wms-supra.winmart.vn` before retry. The retry target is still only the canonical Confirm URL.
- Logged-out exact-marker behavior remains unchanged. Already-authenticated non-login/non-Confirm pages settle for 750 ms, then receive one retry; retry has a 3-second navigation grace before terminal exhaustion. No loop or Dashboard click is introduced.
- Android remains `beta-vc76`. Stable remains OWNER-GATED and untouched.

D127 v65 is **TECHNICAL / RELEASE PASS**. OA052 remains open for Owner field verification on the real company laptop.

## D127 Dashboard activation diagnostic probe — 2026-09-27

Owner field evidence on `relay-agent-v65` changes the diagnosis: the logged-out flow can recover after login, but when the managed browser is already authenticated and the Confirm request lands on `https://auth-supra.winmart.vn/dashboard`, a second direct Confirm navigation still returns to Dashboard. Dashboard activation is therefore a real prerequisite that must be observed rather than bypassed with further blind reloads.

Approved diagnostic scope:
- Add a standalone **D127 Dashboard Probe v1** for Beta field diagnosis. It opens the registered auth UI page `https://auth-supra.winmart.vn/dashboard` using the already-installed Agent Fixed WebView2 runtime but a separate probe browser profile.
- The probe does not change normal Agent v65 confirmation behavior. No Agent v66 behavior is approved until field evidence identifies the real Dashboard activation contract.
- Target discovery is bounded to the supplied right-arrow SVG path. It prefers the unique arrow whose ancestor card contains **Kho Hưng Yên 1** and **SFT3**; if there is only one right-arrow candidate on the page it may use that unique fallback. Ambiguous/missing targets fail closed and ask for one manual click.
- Automatic activation trials are bounded and sequential: DOM `.click()`, synthetic pointer/mouse events, CDP `Runtime.evaluate` with `userGesture=true`, browser-level CDP mouse input using iframe-offset-aware viewport coordinates, then focused target + browser-level Enter key. The probe stops when navigation or a new-window request is observed.
- The probe records target counts, the attempted method, target input-event `isTrusted` state, sanitized NavigationStarting/SourceChanged/NavigationCompleted evidence, and sanitized `NewWindowRequested` target.
- A new-window target is kept in the same probe tab only when it is HTTPS on exact `auth-supra.winmart.vn` or `wms-supra.winmart.vn`. Any other host is logged as scheme + host + path and blocked fail-closed.
- If no automatic method transitions, the Owner clicks the intended Dashboard arrow once manually while the probe remains open. That trusted click is diagnostic evidence; the probe records the resulting trusted input/navigation/new-window behavior.
- Logs strip query strings and fragments and must never include passwords, cookies, tokens, headers, signatures, web-storage values, request payloads or browser-profile contents. The probe never enables the DevTools Network domain and never calls the WMS API.
- `auth-supra.winmart.vn` is added to project scope only for this D127 Beta browser diagnostic. Stable remains OWNER-GATED and untouched.

## D127 Dashboard Probe v1 release checkpoint — 2026-09-27

The standalone Beta diagnostic probe is now released and ready for OA052 field evidence.

Release evidence:
- Implementation PR #240 passed D127 Dashboard Probe, Repo Authority Guard, Project State Guard, UI Design Guard, Firestore and RTDB PR gates, then squash-merged to `main` at `b3dd0e2b101432595956311b476a25444ee066cb`.
- Main D127 Dashboard Probe workflow run `36288410742` completed **PASS** and published prerelease `d127-dashboard-probe-v1`.
- Release id: `397476380`.
- ZIP asset id: `591948670`, size `485027` bytes.
- SHA-256 companion asset id: `591948671`.
- The probe remains diagnostic-only: it does not modify relay-agent v65, Android `beta-vc76`, normal Confirm mutation logic, or Stable.
- OA052 remains open until the Owner runs the probe on the company laptop and uploads only the newest sanitized `dashboard-probe-*.log`.

## D127 v66 — SFT3 browser-session bootstrap from field evidence — 2026-09-27

Owner field log from D127 Dashboard Probe v1 proves the missing Dashboard action semantics. The auth Dashboard loaded successfully and exposed three matching right-arrow controls, so selector-based auto-click remains ambiguous. A real manual trusted click on the intended control emitted trusted pointer/mouse/click events and then a `NewWindowRequested` target of exactly `https://wms-supra.winmart.vn/sft3/session`. Keeping that target in the same tab produced the redirect chain `/sft3/session` → `/sft3/` → `/sft3/app/dashboard`.

The v65 direct-Confirm retry model is therefore insufficient when an authenticated browser is parked on `auth-supra.winmart.vn/dashboard`: the Dashboard control first establishes/activates an SFT3 browser session through the fixed WMS UI route `/sft3/session`.

Approved v66 behavior:
- Keep the initial canonical Confirm navigation and exact visible login marker **Lưu thông tin đăng nhập**.
- If a fully loaded non-login page settles on exact `https://auth-supra.winmart.vn/dashboard`, do not reload Confirm and do not attempt DOM/card/SVG clicking.
- Navigate the same managed browser once to exact `https://wms-supra.winmart.vn/sft3/session`.
- Allow up to 10 seconds for the observed WMS browser redirect sequence. When exact `https://wms-supra.winmart.vn/sft3/app/dashboard` is fully loaded, navigate once to the canonical Confirm PickList URL.
- If the session bootstrap does not reach the WMS app Dashboard within the bounded window, stop and report a terminal SFT3-session bootstrap failure. No loop.
- For other stable loaded non-login/non-Confirm destinations, preserve the v65 one direct Confirm retry behavior.
- No Dashboard DOM selector/click automation, screen-coordinate automation, Network DevTools, cookie/token/header/storage extraction, direct WMS API, or session-file capture is introduced.
- WebView2 Fixed Runtime remains `154.0.4258.37 x64`, host build 9 is reused, Android remains `beta-vc76`, and Stable remains OWNER-GATED.

## D127 v66 release checkpoint — SFT3 session bootstrap — 2026-09-27

The D127 Dashboard Probe v1 field evidence established that the missing Dashboard action is the browser UI session route `https://wms-supra.winmart.vn/sft3/session`. v66 implements that exact bounded bootstrap without Dashboard DOM clicking.

Release evidence:
- PR #242 passed Repo Authority, Project State, UI Design, Verify Beta Relay Agent, D127 Dashboard Probe, Firestore and RTDB gates, then squash-merged to `main` at `a65437585bb86ad187c733d7dca80a441047f2fa`.
- Main **Verify Beta Relay Agent** run `36289263800` completed **PASS**.
- Agent release: `relay-agent-v66`, release id `397480817`.
- Canonical EXE asset id `591974558`, size `352256` bytes, SHA-256 `3093d244aa97a28bf855b76d41554a43fcf4a7fcbe9d7d3c91de87503a5653d0`.
- Inventory channel advanced to Agent manifest asset `591974644` and EXE asset `591974642`.
- WebView2 Fixed Runtime remains `154.0.4258.37 x64` and host build 9 is reused; the browser bundle was not republished for this controller-only correction.
- Android remains `beta-vc76`. Stable remains OWNER-GATED and untouched.

D127 v66 is **TECHNICAL / RELEASE PASS**. OA052 remains open for the Owner to verify the real already-authenticated Dashboard path and the logged-out/login regression path on the company laptop.

## D127 Dashboard Probe v2 — explicit auto vs trusted user action — 2026-09-27

Owner field evidence invalidates the v66 assumption that the `/sft3/session` URL observed after a trusted Dashboard click can be replayed by direct navigation. On the company laptop, direct v66 navigation to that path returns an access-denied result. Therefore v66 is field-failed for the authenticated-Dashboard recovery path.

Approved diagnostic v2:
- Keep Agent v66 unchanged during diagnosis. Do not add another Agent auto-click or direct-session workaround until field evidence is complete.
- Build a lightweight standalone browser using the installed Agent Fixed WebView2 runtime and a separate diagnostic profile.
- User may enter a URL only on exact HTTPS `auth-supra.winmart.vn` or `wms-supra.winmart.vn`; embedded URL credentials are rejected.
- Login remains manual in the browser. Probe must never read or log form/input values.
- Automation starts only when the user presses **Tự động kiểm tra**. The bounded matrix is: DOM click → synthetic pointer/mouse → CDP `Runtime.evaluate` with `userGesture=true` → browser-level CDP mouse → Enter → Space. Stop after the first navigation/new-window evidence.
- Target discovery may use the known access-arrow SVG plus local semantic checks. When several candidates exist, prefer the unique HY1/SFT3 candidate with the smallest containing semantic area; otherwise fail closed.
- Unlike v1, approved `NewWindowRequested` is not forced into the current tab. Let WebView2 use its default popup/new-window behavior so the diagnostic stays closer to ordinary browser semantics. New-window to an unscoped host is blocked fail-closed.
- If auto testing fails or target selection remains ambiguous, the user presses **Theo dõi thao tác người dùng** and then clicks the intended access arrow once. Monitoring is click-target-only: pointer/mouse/click and Enter/Space on the known access-arrow control, plus sanitized navigation/new-window evidence.
- Logs may include `isTrusted`, preventDefault state, arrow index/count, geometry, and boolean semantic flags. Logs must not include page text, input values, password, cookies, tokens, headers, request bodies, web storage, browser-profile contents, query strings, or fragments.
- Probe writes logs locally only. No upload/sync transport is implemented.
- No stealth, anti-detection bypass, user-agent spoofing, `AutomationControlled` bypass, fake headers/referrers, direct WMS API or DevTools Network use is allowed.
- Stable remains OWNER-GATED and untouched.

## D127 Dashboard Probe v2 — explicit test vs trusted click — 2026-09-27

Field result: v66 direct navigation to the observed WMS session path returned access denied. The prior assumption that a URL seen after a trusted Dashboard click can be replayed directly is therefore rejected.

Approved diagnostic:
- Keep Agent v66 unchanged while collecting evidence.
- Probe v2 uses the installed Fixed WebView2 runtime with a separate profile.
- User-entered navigation is limited to HTTPS on exact auth-supra.winmart.vn or wms-supra.winmart.vn. URL credentials are rejected.
- Login is manual; form/input values are never read or logged.
- **Tự động kiểm tra** explicitly starts one bounded method sequence: DOM click, synthetic pointer/mouse, CDP userGesture, browser-level CDP mouse, Enter, Space. Stop on the first navigation or new-window event.
- Access-target discovery remains fail-closed. If multiple HY1/SFT3 matches exist, only a unique smallest semantic-card candidate may be used.
- Approved new-window behavior is left to WebView2 instead of being forced into the current tab. Unapproved hosts are blocked.
- If automatic testing fails, **Theo dõi thao tác người dùng** records only events on the known access-arrow clickable control and sanitized navigation/new-window evidence while the Owner performs one real click.
- Local log may contain event type, isTrusted, default-prevented, arrow index/count, geometry and boolean semantic flags. It must not contain page text, form values, passwords, cookies, tokens, headers, request bodies, web storage, profile contents, query strings or fragments.
- Probe has no log-upload transport, no direct WMS API path and no browser-identification spoofing.
- Stable remains OWNER-GATED and untouched.

## D127 Dashboard Probe v2 release checkpoint — 2026-09-27

Probe v2 is technically released and ready for OA052 field evidence.

Release evidence:
- Implementation PR #244 passed Repo Authority, Project State, UI Design, D127 Dashboard Probe, Firestore and RTDB gates and merged to `main` at `2286f553c17722dce9a932d2aa09a75bd387750e`.
- Main D127 Dashboard Probe run `36290763125` completed PASS and UI regression run `36290763091` completed PASS.
- Prerelease `d127-dashboard-probe-v2`, release id `397490971`.
- ZIP asset id `592021858`, size `488910` bytes, SHA-256 `1111204c23ce1e121c47d3859c0193c467b90f1eca70867028fba3fbb282f0fa`.
- Checksum companion asset id `592021856`.
- Agent v66 remains unchanged and field-failed for direct session-route recovery. Probe v2 is diagnostic only.
- Stable remains OWNER-GATED and untouched.
- OA052 remains open until the Owner uploads the newest sanitized `dashboard-probe-v2-*.log`.

## D127 v67 — field-proven Dashboard click with real child popup — 2026-09-27

Probe v2 field logs establish that automatic DOM click and the Owner's trusted manual click hit the same Dashboard access control: arrow 1 of 3, same HY1/SFT3 semantic match, same 36x36 geometry at the same coordinates, and both produce the same WMS new-window target. The only observed input difference is that the manual action includes trusted pointer/mouse events while DOM click produces an untrusted click event. The Owner confirmed the automatic Probe path still reaches Confirm successfully.

Therefore v67 intentionally uses the simplest successful browser action: one DOM `.click()` on the field-proven HY1/SFT3 target. It does not emulate pointer sequences, keyboard input or trusted events.

The v66 field failure is attributed to host behavior after the click boundary: v66 converted the Dashboard-created new-window target into a same-tab direct navigation. v67 removes that rewrite.

Approved flow:
- Initial canonical Confirm navigation remains unchanged.
- Exact visible **Lưu thông tin đăng nhập** remains the login gate. User enters credentials manually; after the marker clears, the existing one direct Confirm retry is preserved because that path previously field-passed.
- If a valid stored auth session causes Confirm to settle on exact auth Dashboard, wait 750 ms, identify the same HY1/SFT3 access control used by Probe v2, and call `.click()` exactly once.
- Target selection is fail-closed: use exact right-arrow SVG; prefer the unique HY1/SFT3 semantic candidate; if several semantic candidates exist, only a unique smallest semantic-card candidate within 5% tolerance may be clicked.
- The owned WebView2 host must preserve new-window/opener semantics. A validated WMS popup is assigned to a new child WebView2 created with the same CoreWebView2Environment and dedicated profile. The original page remains alive but hidden.
- Agent DevTools disconnects from auth Dashboard and attaches only to an HTTPS WMS page target created by that child popup. No direct navigation to the observed `/sft3/session` URL is allowed.
- After the WMS child reaches `/sft3/app/dashboard`, Agent navigates that child context once to canonical Confirm. Session/popup flow is bounded and fail-closed.
- No stealth, user-agent spoofing, fake referrer/header, CDP mouse/keyboard simulation, Network-domain access, cookie/token/header/storage extraction, browser-profile reads or direct WMS API calls are introduced.
- Host build increments to 10; Agent target is v67. Android remains beta-vc76. Stable remains OWNER-GATED and untouched.

## D127 v67 release checkpoint — Dashboard click + child popup — 2026-09-27

The Probe-v2 field conclusion is now implemented and technically released.

Release evidence:
- PR #246 passed Repo Authority, Project State, UI Design, Verify Beta Relay Agent, D127 Dashboard Probe, Firestore and RTDB gates, then squash-merged to `main` at `62aa2cb8430b28619b72f2515fbdbfe456f1a3c3`.
- Main Verify Beta Relay Agent run `36292073068` completed PASS; UI regression run `36292073085` completed PASS.
- Agent release `relay-agent-v67`, release id `397498020`.
- Agent EXE asset id `592064220`, size `361984` bytes, SHA-256 `01067a5443a68b084266d012355fe9a8abd94b655994b4493f655a31d8bff790`.
- Inventory channel Agent manifest/exe asset ids: `592064311` / `592064314`.
- Owned browser host build is now `10`. Browser manifest asset id `592065625`; bundle asset id `592065629`, size `318616553` bytes, SHA-256 `bb623ac7e6c252b21c5f6b23be22ccb4681f3d7ffb42314cee9e014cd8427042`; checksum asset id `592065626`.
- v67 keeps the manual-login flow, uses one Probe-v2-proven DOM click only for stored-session Dashboard recovery, preserves a real child WebView2 popup, and forbids direct `/sft3/session` navigation.
- Android remains `beta-vc76`. Stable remains OWNER-GATED and untouched.

D127 v67 is **TECHNICAL / RELEASE PASS** and **OWNER FIELD PASS**. OA052 is closed.

## D128 — Agent/browser resource observability, readiness barrier and Picklist overlay — 2026-09-27

Status: **OWNER APPROVED — IMPLEMENTATION TARGET AGENT v68**.

D127 v67 field acceptance:
- Owner explicitly confirms the released **D127 v67** Confirm-access flow passes on the company laptop. OA052 remains closed as **OWNER FIELD PASS**.
- Stable remains OWNER-GATED and untouched.

Approved D128 runtime behavior:
1. **Agent-owned WebView2 runs in the background by default.** After a valid Agent login/session restore, the Agent automatically ensures the owned WebView2 is progressing toward canonical Web Confirm without presenting its window.
2. **Show only for mandatory manual Supra login.** If exact visible **Lưu thông tin đăng nhập** is detected, owned WebView2 is shown for the operator to enter credentials manually. Agent never reads/persists credential values. When canonical Confirm becomes READY, owned WebView2 hides again automatically.
3. **Desktop remains explicit.** **Mở trình duyệt Desktop** is a user-selected alternative; there is no silent Agent-owned → Desktop fallback.
4. **Strict readiness barrier.** Confirm-dependent relay/HA/manual PickList business processing is allowed only while both are true: valid Agent application session + canonical Web Confirm READY. Losing either prerequisite pauses/fails closed those paths.
5. D126/D127 page-size/search/exact-row/checkbox/modal/terminal-result/quota/browser-security guards remain unchanged. No cookie/token/header/storage/profile extraction or direct WMS API is authorized.

Approved resource presentation:
- **Hệ thống Agent:** show Agent process **CPU % · RAM MB · Thời gian chạy**.
- **Đăng nhập Supra:** show managed browser mode/name plus aggregate browser-process-tree **CPU % · RAM MB · process count · Thời gian chạy**.
- Do not use the English user-visible label **Uptime**.
- Resource sampling remains local-only, coarse (5-second visible-window cadence), non-blocking and is never uploaded.
- **When the main Agent window is hidden/background, resource sampling stops completely** for Agent/browser CPU/RAM/runtime presentation. Normal business, readiness, Firestore, HA, schedule and Web Confirm logic continue.
- Tray icon no longer exposes CPU/RAM/resource details by hover; it remains the normal Agent icon/name only.

Approved Picklist overlay:
- Restore the lightweight always-on-top overlay and display exactly: **Picklist nhận: xx | Picklist xác nhận: xx | Picklist lỗi: xx**.
- Overlay uses existing in-memory operational counters only and must not add CPU/RAM/GPU/disk/network resource polling or provider traffic.
- Settings must support: show/hide, lock/unlock position, movable position when unlocked, background color, text color, background opacity, size and persisted local settings.
- When locked, the overlay is click-through so the operator can select/click objects in the application behind it.
- The overlay may remain active while the main Agent window is hidden because it only renders existing Picklist counters.

Release target:
- Beta Windows Agent **v68**.
- Android remains unchanged. Stable remains OWNER-GATED and untouched.

Release evidence:
- Implementation PR **#249** merged to main commit `921f52274d1634d11cad2ea0ed439d3dfa2eaa21`.
- PR #249 authority/state/Firestore/RTDB/D127-probe/Relay-Agent/UI gates all PASS before merge.
- Main runs PASS: Repo Authority `36300178425`, Project State `36300178375`, D127 Dashboard Probe `36300178448`, Verify Beta Relay Agent `36300178380`, UI Design Guard `36300178365`.
- `relay-agent-v68` prerelease id `397536007` published from main. Primary EXE asset id `592310281`, size `380416` bytes, SHA-256 `23b23d24418f15a2a7b028df2cc1ac595319ead7a177276e3828a1bc298c4618`; checksum asset id `592310280`.
- Main Relay Agent run confirms both Agent EXE build and Agent-owned Fixed WebView2 bundle publication PASS.
- D128 is **TECHNICAL / RELEASE PASS**. Physical company-laptop field acceptance remains separate as OA053.



## D128 Owner field acceptance — 2026-09-27

Status: **OWNER FIELD PASS**.

- Owner explicitly confirms released Beta Agent **v68** passes the D128 field review.
- Accepted D128 baseline includes Agent-owned WebView2 background operation, manual-login foreground recovery, strict Agent-auth + Web-Confirm readiness barrier, visible-window-only Agent/browser resource sampling and lightweight Picklist overlay.
- OA053 is closed. Stable remains OWNER-GATED and untouched.

## D129 — Agent operational UX and Firestore quota hardening — 2026-09-27

Status: **OWNER APPROVED — IMPLEMENTATION TARGET AGENT v69**.

D129 refines the accepted D128 Beta Agent without changing D117 confirmation latency/failover contracts or introducing a new runtime provider.

1. **Hệ thống Agent is compact and truthful.** Authenticated header is `Hệ thống Agent | Sẵn sàng | <user> | <role label>`; logged-out header is `Hệ thống Agent | Chưa đăng nhập`. The next line is `Chế độ nhận tin từ PDA: <role state> | Wi-Fi hiện tại: <SSID>` using friendly PRIMARY/Đang nhận, STANDBY/Dự phòng and FROZEN/Tạm dừng labels. The following line is local Agent CPU, RAM and **Thời gian chạy**. Visible confirmation counters are removed from this card because the Picklist overlay already owns that presentation. The Agent fleet table remains.
2. **Supra card is a single-browser state machine.** Remove the build/version suffix and redundant HY1/DOM/readiness copy. Header states are `Chưa sẵn sàng`, `Cần đăng nhập | Web Agent/Web Desktop`, `Đang chuẩn bị | ...`, `Sẵn sàng | ...` or `Lỗi ...` according to real state. Resource detail is only Agent-controlled browser process-tree CPU, RAM, process count and **Thời gian chạy**.
3. **Exactly one managed Web mode may run.** Web Agent remains preferred. With no browser active, expose **Mở Web Agent** and **Mở Web Desktop**. A running mode exposes a protected **Tắt Web Agent/Desktop** action; switching modes stops the current managed browser before opening the other. Stop/switch requires warning plus the currently authenticated Agent user's local password verifier. No Agent-managed Web Agent and Web Desktop may operate simultaneously.
4. **Browser visibility is explicit.** Active visible Web exposes **Chuyển Web chạy nền**; active hidden Web exposes **Hiện Web**. Normal Agent-owned startup remains background-first; exact Supra login marker may still show it automatically. Explicit user show is respected until the operator returns it to background. Browser runtime download/install progress stays visible; an installed verified runtime reports **Web Agent đang khả dụng**.
5. **PickList readiness is visible.** Card title is **Xử lý PickList | Sẵn sàng** only when Agent authentication + one managed Web Confirm READY are both true; otherwise **Chưa sẵn sàng** and manual input/search are disabled. Manual PickList readiness does not depend on PRIMARY/STANDBY/FROZEN, preserving specialist work while relay is frozen.
6. **Picklist overlay sizing.** Overlay defaults ON. With no user-customized size, it auto-fits the exact Picklist counter text rather than starting from a fixed 430×50 class size. User sizing then persists. Keep a small technical minimum **120×24**, broad desktop maximum, show/hide, move, lock, locked click-through, background/text color and background opacity.
7. **PDA row state is corrected.** `PDA_READY` renders **Đang hoạt động**. `PDA_GRACE` renders **Mất kết nối tạm thời** during the existing 180-second transient-disconnect grace. Reconnect restores active state immediately; grace expiry removes the row. Existing event-driven projection, search, scroll/selection preservation and no-flicker behavior remain.
8. **Quota hardening targets the two observed Sep 25–26 failure classes.** Historical/stale PENDING list reads remain forbidden under D127. UI refresh may not trigger durable fleet-metrics checkpoints or a parallel periodic Firestore schedule-read loop. Fleet metrics remain RAM-realtime locally and skip unchanged durable writes/checkpoints. Shared schedule propagation uses the existing D117 role/lease coordination; explicit conflicting schedule actions may perform a bounded refresh.
9. **Local quota guard only.** Agent counts Firestore HTTP read/write attempts locally by component and may warn at 70%/85%/95% of conservative public reference points (50k reads/day, 20k writes/day). These are reference thresholds only, never a claim about the account's billing entitlement. The guard itself performs no provider read/write and uploads no quota telemetry.
10. **Protected cadence remains unchanged.** PRIMARY confirmation queue stays 4s idle / 2s bounded-hot, PRIMARY lease 7s, STANDBY takeover threshold 10s, and STANDBY/FROZEN business-poll rules remain D117-authoritative. D127 fresh-only PENDING and event-driven Picker presence remain authoritative.
11. **Realtime-listener optimization is not silently activated.** A Firestore realtime-listener replacement for PRIMARY queue polling may be researched later as a separate bounded Office field POC. It must prove proxy/stream stability and cost behavior before any runtime switch.
12. Target is Beta Windows Agent **v69**. Android remains **beta-vc76** unless an independently justified defect requires rebuild. No new provider/resource/collection is introduced. Stable remains OWNER-GATED and untouched.

Release evidence:
- Implementation PR **#251** merged to main commit `28294cc98770f35e98b4dfeca8aca9d655ea39fb`.
- Main gates PASS: Repo Authority `36305126289`, Project State `36305126367`, D127 Dashboard Probe `36305126268`, UI Design `36305126316`, Verify Beta Relay Agent `36305126265`.
- Beta prerelease **relay-agent-v69** id `397561381` published from main. Primary EXE asset id `592453697`, size `388096` bytes, SHA-256 `b282cfb63b879d330a13bab80df69dee622ca5efd96e1895a3fea262709e82a4`.
- D129 is **TECHNICAL / RELEASE PASS**. Remaining gate is **OA054 Owner field acceptance** on one company laptop/PDA. Stable remains OWNER-GATED and untouched.


## D129 Owner field acceptance — 2026-09-27

Status: **OWNER FIELD PASS**.

- Owner explicitly confirmed the released Beta Agent **v69** passes the D129 field review.
- OA054 is closed as OWNER FIELD PASS. This acceptance does not waive defects discovered immediately afterward; those defects are tracked separately under D130.
- Stable remains OWNER-GATED and untouched.

## D130 — PDA↔Agent transport recovery and live resource presentation — 2026-09-27

Status: **TECHNICAL / RELEASE PASS — OWNER FIELD ACCEPTANCE OA055 PENDING**.

Field evidence after D129 acceptance shows two independent reliability defects:
1. Agent CPU/RAM/runtime values are sampled but do not repaint continuously while the main window remains foreground; switching away/back forces visible refresh.
2. PDA→Firestore→Agent delivery can become unavailable until relay restart. Current field logs show successful PRIMARY polling followed by a Firestore transport-offline transition with no later confirmation polling until the relay is restarted. Android logs independently show both uncertain Firestore creates and requests that are created successfully but never consumed inside the bounded wait. One PDA also remained in realtime `connecting`, so event-driven Picker presence never became authoritative for that device.

Approved D130 correction:
- Keep expensive Agent/browser resource sampling local-only and visible-window-only. A one-second UI-only clock/repaint updates **Thời gian chạy** continuously from the latest cached sample; CPU/RAM remain bounded coarse samples and must repaint without requiring focus changes.
- Raise the .NET per-host connection pool floor to 16 for the Agent process. Preserve TLS/proxy policy and do not bypass company filtering.
- Firestore confirmation transport must be self-healing. Callback/log/UI faults inside a failed poll are isolated, failed confirmation reads use a bounded retry budget, and an unexpected transport-loop exit is supervised/restarted automatically without operator stop/start.
- Preserve D117 business cadence: PRIMARY 4s idle / 2s hot, 7s lease, 10s failover; STANDBY/FROZEN do not business-poll.
- Android Firestore request creation uses one logical request/document id. If the SDK write is uncertain, verify that exact document on the server and perform at most one same-id retry; a late first create/Agent ACK must never be overwritten. The terminal wait remains 20 seconds and user copy must state 20 seconds.
- Android foreground realtime gains a 12-second WebSocket handshake watchdog so `connecting` cannot remain indefinitely. A wedged handshake is cancelled and reconnects using the existing bounded backoff.
- Picker presence remains active-socket/event-driven. Login alone is still not an online-PDA signal; however a healthy logged-in foreground client must recover its realtime socket automatically so presence can appear without app restart.
- No new provider, collection, heartbeat or periodic presence poll is introduced. Existing D127 fresh-only PENDING, D129 quota guard and Stable OWNER-GATED policy remain authoritative.

Release evidence:
- Implementation PR **#254** merged to main commit `241f1cd464ff005969b1d7a6f2d979fb64342b50`.
- Main PASS runs: Repo Authority **36308658427**, Project State **36308658322**, D127 Dashboard Probe **36308658310**, Verify Beta Android **36308658342**, UI Design **36308658329**, Deploy Beta Worker **36308658284**, Verify Beta Relay Agent **36308658298**.
- Beta Windows Agent **relay-agent-v70** release id **397580687**; EXE asset id **592563191**, size **389632 bytes**, SHA-256 **708400f835ca671bd15632d6c7db93387aff3ed10a307ddcbba2ff3ba7307f02**.
- Signed Android Beta **beta-vc77** release id **397580708**; APK asset id **592563343**, size **19052908 bytes**, SHA-256 **1d9b0583e5df5537e1a2b1e5936ca015a03e3f18ed830544d8eead34cee5909a**.
- D130 is technically/release PASS. Remaining gate is **OA055 Owner field acceptance** on one company laptop/PDA. Stable remains OWNER-GATED and untouched.


## D131 — Firestore-only free-tier HA redesign for PDA ↔ Agent — 2026-09-27

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED AND IN PROGRESS**.

Owner explicitly rejects the dual Cloudflare+Firestore relay proposal for PickList confirmation because keeping both relay paths warm would spend quota without enough operational benefit. D131 keeps **Cloud Firestore as the only PDA↔Agent confirmation carrier** and redesigns HA, cadence, presence and counters to stay below the Firestore no-cost allowance while meeting the real operating model.

Authoritative operating envelope:
- Up to **20 Windows Agents** in the design envelope.
- Exactly **1 PRIMARY** may consume PickList business jobs. The other Agents are business-hibernating and must not query the PENDING business queue.
- The fleet runs PDA↔Agent business transport from **05:00 through 23:00 Asia/Ho_Chi_Minh**. Without an explicit overtime extension, business relay stops at 23:00 and resumes at 05:00 even if Windows remains running. Manual/local Agent operations may remain available.
- Shift capacity: 06:00–14:00 up to 50 PDA; 14:00–22:00 up to 50 PDA; overlap/overtime 10:00–16:00 may reach **75 simultaneously active PDA**.
- Design volume: approximately **1,200 PDA confirmation submissions/results per day**, including invalid suffixes; burst capacity **40 simultaneous requests** plus arbitrary 1–2 second consecutive submissions.
- Good-network objective: PDA submission to terminal result **<=6 seconds** for normal/small-burst operation. Any Agent death/failover/transport defect must produce either the business terminal result or a specific failover/error terminal result **before 20 seconds**. A single browser cannot truthfully guarantee 40 independent sequential DOM mutations inside 6 seconds; D131 therefore requires bounded coalescing/batch DOM handling where the managed page safely supports it and treats a 40-request burst as an explicit acceptance test.

HA/state model:
- PRIMARY heartbeat/lease is a compact Firestore coordination document. Final implementation cadence is **10-second heartbeat / 15-second lease expiry**.
- One hibernating Agent is deterministic **NEXT-A**. It does zero business queue polling and watches only the compact coordination/lease state, scheduled from the observed lease expiry so it can take over around lease expiry rather than blind high-frequency polling.
- One hibernating Agent is deterministic **NEXT-B** as second failover candidate at a coarser cadence. Remaining Agents are **DEEP-HIBERNATE**.
- PRIMARY death during idle time must still trigger takeover; work traffic is not required to detect failure.
- Promotion uses the existing generation/fencing model. A new PRIMARY must not process a PENDING job until it owns the current generation.
- NEXT-A/other hibernating readiness is maintained with coarse compact state only; they never poll the business queue.

Business queue:
- PRIMARY-only PENDING polling is **3 seconds while at least one operational PDA is active** and **15 seconds while the operational window is open but no PDA is active**. A bounded short hot/drain mode may run only after a real multi-job burst; PDA activity immediately returns the PRIMARY to the 3-second cadence. Query limit must cover the 40-request burst in one fetch (target limit >=100).
- Returned jobs are deduplicated by request id and exact suffix rules remain fail-closed.
- Multi-request bursts are coalesced into a bounded browser batch. Where the rendered Confirm page safely allows multiple exact rows to be resolved/selected/confirmed in one DOM cycle, D131 must use that path instead of serially repeating full page work. No direct WMS API, cookie/header/session extraction, or network interception is authorized.
- Android continues one logical request/document id with exact-document result observation and D130 same-id uncertain-create recovery.

Counters and fleet visibility:
- All Agents should display a common daily received / confirmed / error view without a separate high-frequency metrics stream.
- Daily counters are durable from relay job state plus a coordination summary/checkpoint. RAM may cache values only for UI; it is not counter authority.
- On takeover, the new PRIMARY reads the last checkpoint and performs one bounded tail reconciliation of request documents newer than the checkpoint, deduplicated by request id, before continuing counters. This makes counters exact across failover without replaying the full day.
- Fleet status supports up to 20 Agents: Agent id/machine, role, Agent auth ready, Web Confirm ready, Firestore ready, last_seen and current network label. PRIMARY lease doubles as PRIMARY heartbeat. Hibernating Agents use coarse readiness heartbeats only; no per-second global presence writes.
- Fleet UI may be slightly stale on deep-hibernating Agents and must show last_seen/age rather than pretending per-second accuracy.

PDA activity list:
- Active-PDA authority remains event-driven from the authenticated Android session/realtime lifecycle already projected to Firestore; do not add a per-PDA heartbeat.
- Login/realtime connect may add the PDA, explicit logout/session/device replacement removes immediately, and unexpected disconnect retains the existing bounded grace before removal.
- Every PickList request is also an implicit last activity signal for the PRIMARY in RAM and may refresh that row locally with **zero additional Firestore write**.
- At 23:00 without overtime the operational PDA list is hidden/frozen with the relay; 05:00 re-entry performs one bounded authoritative snapshot.

No-cost budget guard:
- D131 targets Firestore Standard no-cost limits with engineering headroom, not merely staying one operation below provider limits.
- Daily target ceilings: **<=42,000 document reads**, **<=15,000 document writes**, **<=3,000 deletes**, **<=0.75 GiB stored**, **<=8 GiB monthly outbound** for this project path.
- Provider hard/no-cost reference at decision time is 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB storage and 10 GiB/month outbound. Runtime quota accounting must reset on the **Firestore provider day (America/Los_Angeles)**, not Asia/Ho_Chi_Minh.
- Nonessential fleet/UI refresh is throttled before business latency is degraded. Business queue, lease/fencing and terminal ACK remain the protected operations.
- TTL deletes are not used for this free-tier design. Retention cleanup is bounded/manual-scheduled deletion so delete/read cost stays inside the daily budget.

D130 self-healing transport, Android same-id create recovery, managed-browser security boundaries and D127 fresh-only queue filtering remain inherited unless D131 explicitly supersedes cadence values above. OA055 is superseded by D131 implementation/field acceptance; D130 technical/release evidence remains historical PASS. Stable remains OWNER-GATED and untouched.


### D131 refinement — warm managed browser, durable daily counters and audit export

Owner keeps D131 in design-only status and refines the model before implementation:

- Fleet design expands from max 6 to **up to 20 Agents**, while preserving exactly one business-queue PRIMARY, one NEXT-A and one NEXT-B. All remaining Agents are DEEP-HIBERNATE for Firestore business work; they do not consume the PENDING queue.
- Hibernation applies to relay/business provider work, **not to the managed Supra browser**. Every authenticated Agent keeps its single managed WebView2/profile available so manual/local PickList confirmation on that laptop remains immediately usable. Background Agents must remove unnecessary DOM polling, resource sampling and provider refresh, but must not close the prepared Confirm page merely because they are not PRIMARY.
- Promotion prefers an Agent whose Agent auth + Firestore + Web Confirm readiness are already valid. A non-ready candidate must not claim business work merely because its relay rank is next.
- Shared daily PickList counters are no longer RAM-authoritative. The durable relay_poc_jobs documents are the audit authority. Each request carries request id, business date, user identity snapshot, submitted suffix and server receive time; terminal ACK adds result/status, sanitized error/result code, owning Agent identity and terminal timestamps/duration.
- A compact **daily durable summary/checkpoint** lives in existing Firestore coordination state. PRIMARY updates it only when terminal work is committed, preferably once per processed batch. The terminal job updates and summary checkpoint must be transactionally/conditionally consistent enough that failover can verify uncertainty instead of double-counting.
- New PRIMARY reconstructs exact daily counters from the durable summary plus a bounded tail, or uses Firestore aggregation queries for the current business day when checkpoint confidence is uncertain. RAM may cache the result for UI only; it is never the authority.
- Every open Agent may refresh the shared daily counters/fleet snapshot at a **10-minute cadence**. Bringing the Agent window to foreground or pressing explicit refresh may perform one bounded authoritative refresh. Do not attach every Agent to the high-frequency PRIMARY lease or counter updates.
- Detailed daily export is supported from the durable relay job ledger and must include at least: request id, employee/user identity, send time, submitted suffix, terminal result, result/error code, Agent identity, completion time and elapsed time. Export is one bounded read of the selected day and may be delivered through the existing scoped Beta exports/Drive mechanism; no secrets, browser session material or WMS auth data may enter the file.
- Target retention for relay audit documents is bounded so Firestore storage remains under the D131 soft ceiling; after steady-state retention, bounded cleanup rather than TTL is used.

For a 20-Agent design, fleet/counter synchronization must use coarse snapshots and aggregation rather than per-Agent realtime listeners. PRIMARY lease, NEXT-A failover watch and business queue remain the high-priority operations; deep-Agent presentation is allowed to be up to 10 minutes stale and must show its freshness age.

This refinement supersedes D131's earlier PRIMARY RAM counters and max 6 Agent wording. It does not authorize runtime code yet. Stable remains OWNER-GATED and untouched.


### D131 refinement — server-side daily Drive export independent of Agents

Owner confirms one automatic detailed PickList audit export to the existing scoped Beta Drive exports area per business day.

- Export execution is **server-side**, owned by the existing Beta Cloudflare Worker/scheduled runtime and Google Drive OAuth configuration. No Windows Agent needs to be online.
- Source is the durable Firestore PickList job ledger, not Agent RAM/local files.
- Business day uses Asia/Ho_Chi_Minh with a 05:00 boundary so authorized overtime after 23:00 remains part of the preceding operational day.
- Preferred schedule is shortly after the next 05:00 boundary (target 05:10 Asia/Ho_Chi_Minh) and exports the just-closed business day. This avoids truncating late overtime.
- The logical export is exactly one file per business day. Execution is idempotent: a transient Firestore/Drive failure may retry server-side, but retries must update/complete the same business-day export identity rather than create duplicate files.
- File detail includes request id, employee/user identity, send time, submitted suffix, terminal result/status, sanitized result/error code, processing Agent identity, completion time and elapsed duration. No password, browser cookie, token, header, signature or Supra session material is exported.
- Export failure is recorded for retry/diagnostics and must not require an Agent to start. If Google OAuth/Drive authorization is revoked or unavailable, the server records the failure and retries boundedly after provider recovery.

This is still D131 design authority only; runtime implementation has not started. Stable remains OWNER-GATED.


### D131 continuation gate — review first, code only after explicit OK

Owner closes the current D131 design discussion with the following continuation contract:

- Exact future trigger phrase: **`bắt đầu tối ưu lại mô hình`**.
- On that phrase, the next session must first bootstrap fresh canonical GitHub authority and **must not write runtime code yet**.
- The response must enumerate the full D131 planned change set in detail from canonical authority, including at least: Firestore-only carrier; up-to-20-Agent fleet roles; one PRIMARY + NEXT-A + NEXT-B + deep business-hibernating Agents; all managed Web Confirm browsers kept warm for local/manual PickList; 05:00–23:00 base relay window with overtime extension; 50/50 shift load, 75-PDA overlap, ~1,200 daily submissions/results, 40 simultaneous burst; latency/failover targets; event-driven PDA presence; durable daily request/audit ledger; non-RAM daily counters; 10-minute non-primary counter/fleet refresh; exact failover reconstruction; and server-side once-daily Drive export independent of Agent liveness.
- That design-review response must finish with a **worst-case/free-usage projection** using the maximum approved model envelope. It must show the component-level assumptions for Firestore document reads/writes/deletes/storage/outbound and any other materially affected free/paid-limited service, compare totals against current provider allowances/soft guards, and identify remaining headroom. Provider limits must be freshly verified from authoritative/current sources rather than copied blindly from an old chat estimate.
- If Owner requests logic changes in that review session, update the design first and recalculate the worst-case usage before implementation.
- Only after Owner explicitly replies **OK / đồng ý chạy code / equivalent final approval** may implementation start. Implementation then begins from a fresh `main` short-lived branch and follows branch → PR → authority/continuity/build/quota guards → merge → Beta release/field gate.
- A message containing the trigger phrase alone is **not** implementation authorization.
- Stable remains OWNER-GATED and untouched.


### D131 implementation authorization and final refinements — 2026-09-28

Owner completed the review-first gate and explicitly authorized implementation of the full D131 change set on Beta.

- Final HA cadence is 10-second PRIMARY lease heartbeat / 15-second expiry. NEXT_A alone watches the lease for takeover; NEXT_B is coarse; DEEP_HIBERNATE Agents do not poll the business queue.
- PRIMARY business polling is adaptive: 3 seconds when at least one operational PDA is active, 15 seconds during the 05:00–23:00 window when no PDA is active, plus a bounded short hot/drain cadence after a real burst.
- D131 delete soft guard is 3,000/day. This does not change the current provider reference; it is an engineering soft ceiling sized for bounded job + confirmation-guard cleanup.
- The D127 picker_presence_current pseudo-job is retired. PDA activity uses only picker_presence_projection/current plus PRIMARY-local zero-write request activity.
- Daily received/confirmed/error values use durable job state + compact daily coordination summary. Android must not delete ACK jobs before server export/retention cleanup.
- "Gọi về bàn CV" becomes a persistent per-Picker active call. A create-only lock prevents two Agents from opening duplicate simultaneous calls. The originating Agent owns the close action; the PDA overlay remains until that call is resolved and can restore from Firestore after app/PDA restart.
- Agent adds a scoped Usage tab for PDA↔Agent/export dependencies. Provider metrics are fetched server-side; provider credentials are never sent to Agent. Failure to read Monitoring is shown explicitly and must not be hidden by Firestore self-scans that increase quota.
- Server-side daily PickList export remains one idempotent file per 05:00-boundary business day and is independent of Agent liveness.
- Implementation branch is feat/d131-firestore-ha-usage and PR is #259. Stable remains OWNER-GATED and untouched.


### D131 technical/runtime/release evidence — 2026-09-28

- Implementation PR **#259** passed all applicable PR gates and squash-merged to main commit `3569934ec2a36f6fa2f6fe92cf332ae679ad4070`.
- Main PASS runs: Repo Authority **36351588508**, Project State **36351588659**, Firestore **36351588514**, Beta Worker **36351588539**, Android **36351588555**, Relay Agent **36351588527**, UI Design **36351588512**, Functions **36351588564**, D127 Dashboard Probe **36351588613**.
- Beta Windows Agent **relay-agent-v71** release id **397818991**; canonical EXE asset id **593804846**, size **404992 bytes**, SHA-256 **e9fac90ebd5d89c6accdf1df903673cad3971a65c3333806602a636b3b55c508**.
- Signed Android Beta **beta-vc78** release id **397819144**; APK asset id **593805739**, size **19052908 bytes**, SHA-256 **032d17f774592464101ed9711677f98117fddb17a2dcad53da3ea1feae6005f4**.
- D131 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta. Remaining gate is **OA056 Owner physical field acceptance** for real company-network/fleet/latency behavior. Stable remains OWNER-GATED and untouched.


## D132 — Agent presence/status/layout hotfix — 2026-09-28

Status: **OWNER AUTHORIZED IMPLEMENTATION — BETA HOTFIX IN PROGRESS**.

Owner reports three post-D131 field defects and authorizes a coordinated Beta hotfix:

1. The Agent status line must never alternate between the high-level PDA receive mode and the low-level Relay state. It renders one stable line containing **Chế độ nhận tin từ PDA + Relay + current Wi-Fi**. D131 HA role semantics remain unchanged.
2. **Picker đang hoạt động trên PDA** must reflect Android login/logout and real PickList activity. Root cause from the latest Beta logs/source is that D131 retained the Firestore projection writer but removed the fixed presence control event while the Agent had no Firestore realtime listener for that projection. D132 restores exactly one fixed `relay_poc_jobs/picker_presence_current` single-slot control event on presence state changes. It is overwritten, not accumulated, uses no per-PDA heartbeat and adds no new polling loop. The PRIMARY ACKs this control event without changing PickList received/confirmed/error durable counters. A real PickList request also refreshes that Picker in PRIMARY RAM with zero extra provider write. Foreground Agent activation may perform one bounded authoritative projection refresh so a non-primary operator can reconcile the current list without continuous polling.
3. Column sizing changes from a hidden checkbox to one visible **Auto size cột: Bật/Tắt** button. ON auto-fits displayed content and disables manual column resizing. OFF enables manual sizing and stores widths per authenticated Agent account.
4. The Agent normal-window bounds (position/width/height) are stored per authenticated Agent account. Maximizing and restoring must return to that account's last manually adjusted normal bounds rather than the default small bounds. Existing startup maximized behavior remains allowed.
5. Target release is **relay-agent-v72**. Android remains **beta-vc78**; Worker/service changes only restore the existing Firestore presence signal. No new provider/resource is introduced. Stable remains OWNER-GATED and untouched.

Quota boundary: D132 presence delivery uses the already-running PRIMARY PENDING query. Each actual presence-state change adds a bounded fixed-document projection/control write, one returned control document read when PRIMARY observes it, and one control ACK write. It does not create a periodic PDA heartbeat, a second queue poll, or non-primary business polling. D131 soft quota guards remain authoritative.


### D132 technical/runtime/release evidence — 2026-09-28

- Hotfix PR **#262** passed all applicable PR gates and squash-merged to main commit `32411d15198331e8763f4d9a73288dd89524b65a`.
- Main PASS runs: Repo Authority **36363752173**, Project State **36363752156**, Beta Worker **36363752158**, Relay Agent **36363752155**, UI Design **36363752204**, D127 Dashboard Probe **36363752172**.
- Beta Worker deploy includes the repaired fixed single-slot Picker presence signal. No new heartbeat or non-primary business polling was added.
- Windows Agent **relay-agent-v72** release id **397878131**; canonical EXE asset id **594118802**, size **411136 bytes**, SHA-256 **3de3db7f21f838341bf0c5f66057924cb72727fefa623537f1955866fd44114d**.
- Android remains signed **beta-vc78** unchanged.
- D132 is **TECHNICAL / RUNTIME / RELEASE PASS**. Remaining gate is **OA058 Owner field retest** for the visible status line, real login/logout/PickList presence, column-mode persistence and Windows normal-bounds restore. D131 OA056 remains a separate broader fleet/failover acceptance gate. Stable remains OWNER-GATED and untouched.

## D132 Owner field acceptance — 2026-09-28

Status: **OWNER FIELD PASS**.

- Owner explicitly confirms the D132 hotfix passes the physical field check.
- Accepted baseline is Beta Agent v72 with beta-vc78 Android unchanged.
- OA058 is closed by Owner acceptance.
- Stable remains OWNER-GATED and untouched.

## D133 — Six-field reliability and alert-safety hotfix — 2026-09-28

Status: **OWNER APPROVED — BETA IMPLEMENTATION / RELEASE TARGET**.

After D132 field PASS, Owner approves the following coordinated Beta changes:

1. **One Auto-size mode covers the entire Agent operational surface.** The per-Agent-account Auto size cột setting applies to the Hệ thống Agent fleet grid, Picker list and manual PickList grid. Hệ thống Agent exposes the same Bật/Tắt control and both controls stay synchronized. Manual widths remain per-account when Auto size is off.
2. **Usage HTTP 401 is an Agent-auth contract defect.** The Windows Agent signs in directly through Firebase password auth and therefore has real ADMIN/PICKPACK_ADMIN role claims but no interactive Web/Android session channel. /api/agent/usage must authenticate this bounded direct-Agent token shape without weakening Web/Android session-generation guards; Web/Android tokens are not accepted through the Agent Usage path.
3. **The three PickList counters are Firestore-authoritative across upgrades/restarts.** relay_poc_coordination/daily_<business-day> remains the source of truth for received / confirmed / error totals. The PickList overlay must never use process-RAM counters as authority. After a durable ACK commit, Agent performs a coalesced exact summary refresh so visible counts update promptly without a per-request polling loop.
4. **Gọi về bàn CV uses two delivery paths and the current Picker identity.** Android refreshes the bounded relay custom token after restored sessions when required; the active-call listener must bind only when FirebaseAuth belongs to the current Picker account. Firestore listener is the reconciliation path and FCM is the fast path. The Functions deployment must include pickerActiveCallCreated and pickerActiveCallResolved.
5. **Full-screen alerts must be locally dismissible and time-bounded.** For HAS_STOCK / SKIP_ALLOWED result overlays, tapping acknowledgement first persists the pending acknowledgement locally and closes the overlay immediately; upload is retried on resume and while the Activity remains alive. This is acknowledgement transport only and does not reopen offline Báo hàng. For Gọi về bàn CV, the overlay self-closes after at most 60 seconds even if network/session state is lost; the originating specialist Agent may resolve it earlier.
6. **Required Android alert permissions are a hard startup gate.** The app may enter operational UI only when Android notifications are enabled (including POST_NOTIFICATIONS where runtime permission applies) and SYSTEM_ALERT_WINDOW / **Hiển thị trên ứng dụng khác** is granted. Missing permission shows a blocking permission screen with direct system-settings actions and no bypass. The product does not rely on Android full-screen-intent permission for this flow; the current mechanism is the application overlay.

Implementation targets: **relay-agent-v73** and the next signed Beta Android release after beta-vc78. Existing Beta Worker, Firebase/Firestore/Functions and distribution resources are reused. No new provider resource is authorized. Stable remains OWNER-GATED and untouched.

## D133 technical/runtime/release checkpoint — 2026-09-28

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA059 OWNER FIELD REVIEW READY**.

- Implementation PR #264 merged to main `42909cfdd9c577a18cadc012506fb597bc13c381`.
- Main PASS evidence: Repo Authority `36367536057`, Project State `36367536023`, Beta Worker `36367536034`, Beta Functions `36367536035`, Android `36367536084`, Agent `36367536068`, UI `36367536031`, Dashboard Probe `36367536141`.
- Beta Worker includes the bounded Agent Usage authentication repair.
- Beta Functions deployment includes `pickerActiveCallCreated` and `pickerActiveCallResolved`.
- Signed Android release: `beta-vc79`, release `397895785`, APK asset `594221883`, size `19052908`, SHA-256 `af78c15d69c9c108fe63b302985b913b8b3190742b468e98d3c32583d73c29a5`.
- Agent release: `relay-agent-v73`, release `397895794`, EXE asset `594221966`, size `412160`, SHA-256 `65ffe4e5486d9b074925d5dec0f9c01bca4bda3b647bc0b85306647bf2aa33eb`.
- Fixed `inventory-channel` was refreshed to the D133 Agent/APK artifacts.
- OA059 is the remaining physical Owner field gate. Stable remains OWNER-GATED and untouched.

## D134 — Agent/PDA field reliability, compact fleet sync and session authority — 2026-09-28

Status: **OWNER APPROVED — BETA IMPLEMENTATION IN PROGRESS**.

D133 technical/release gates passed, but the Owner's physical field test found defects. D134 supersedes OA059 field acceptance and authorizes the following coordinated Beta repair:

1. **Usage is server-collected and Agent-consumed through Firestore.** Provider Monitoring/Drive data is cached server-side and mirrored to `relay_poc_coordination/usage_current` every 10 minutes. The Office Agent reads that compact document directly with its Firebase identity; it does not depend on Cloudflare DNS/Worker reachability to display Usage. One unavailable Monitoring metric becomes `N/A` and must not make all provider metrics unavailable.
2. **Auto size has one operator control only.** The button exists only under Hệ thống Agent but applies to Agent fleet, Picker and manual PickList grids. Auto mode measures displayed content, bounds action/text columns and distributes compression/slack proportionally. Long text is single-line/clipped with tooltip behavior. Manual widths and normal window bounds stay per Agent account when Auto is off.
3. **Readiness colors are truthful.** Hệ thống Agent, Đăng nhập Supra and Xử lý PickList are green only when ready, red for definite unavailable/error states and neutral while transiently preparing.
4. **Firestore transport health is separated from logic faults.** Firestore resource names are normalized to REST URLs before mutation. A URI/data/processing exception must not mark Firestore transport offline; only actual transport/network failures do.
5. **Liên hệ picker is reusable with a fleet-wide 60-second lock.** The per-Picker active-call document may transition back to ACTIVE after RESOLVED or expiry using conditional update-time fencing. FCM remains the fast path and the exact Picker document listener remains recovery. Every Agent receives the compact call lock immediately, including Replay/deep-hibernate Agents. Only the originating Agent may end an active call; the call button remains locked for the full 60 seconds.
6. **PDA presence authority is explicit session state, not socket/heartbeat state.** LOGIN shows online, LOGOUT removes, and a valid PickList may repair a delayed/missing presence projection with source `PICKLIST`. Socket connect/close/error, window focus and silence are not online/offline authority.
7. **Kích User is generation-fenced.** The Picker grid exposes Kích User with two confirmations. Kicking writes the revoked Android session generation, removes the Picker fleet-wide immediately and makes the PDA return to login. Firestore Rules reject PickList creates from a revoked generation so a stale session cannot resurrect itself.
8. **Fleet/quota model is bounded.** D134 supports up to 10 Agent entries, one compact listener per authenticated Agent, one PRIMARY five-minute reconcile, no per-job counter refresh, no UI-focus presence read and no socket-presence write. Internal Firestore read soft target is 45,000/day.
9. **Sensitive Agent actions require the Agent password and UI identity is clean.** Web visibility/stop/switch paths and Agent logout are password protected as applicable; user-visible identity is the login username only, never a composite internal id.
10. **Existing resources only.** Beta Worker, Firestore, Functions, Android and Agent distribution resources are reused. Stable remains OWNER-GATED and untouched.

Implementation target: **relay-agent-v74** plus the next monotonic signed Beta Android release after `beta-vc79`. No Stable mutation is authorized.

## D134 technical/runtime/release checkpoint — 2026-09-28

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA060 OWNER FIELD REVIEW READY**.

- Implementation PR #266 merged to main `8b703f12ec6f1667e43dab101114f2fbcc1a8819`.
- Main PASS evidence: Repo Authority `36378669821`, Project State `36378669818`, Beta Worker `36378669809`, Beta Firestore `36378669837`, Beta Functions `36378669820`, Android `36378669791`, Agent `36378669807`, UI `36378669834`, Dashboard Probe `36378669798`.
- Beta runtime health passed on the exact merged source: HTTP 200/status ok, source commit exact, SQLite `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- Firestore Rules deployed and release readback PASS. Beta Functions updated `pickerAlertCreated`, `pickerAlertResolved`, `pickerActiveCallCreated`, and `pickerActiveCallResolved`.
- Signed Android release: `beta-vc80`, release `397956615`, APK asset `594510841`, size `19069292`, SHA-256 `c25e052f308154ed4fe30ea584ecebc7aab0c26bcd9fb53f99313070c73cf330`.
- Agent release: `relay-agent-v74`, release `397956520`, EXE asset `594510384`, size `7029760`, SHA-256 `3c3792de465cc1e81f772a90ad2591c14bf79c8e97298ea743ca7701edbf366b`.
- Fixed `inventory-channel` now carries the D134 Agent/APK artifacts; the approved Fixed WebView2 bundle remains unchanged.
- OA060 is the remaining physical Owner field gate. Stable remains OWNER-GATED and untouched.
## D134 field hotfix — 2026-09-28

Status: **OWNER REPORTED FIELD FAILURE — HOTFIX AUTHORIZED**.

After installing signed `beta-vc80` and `relay-agent-v74`, Owner reported that Android could not send PickList confirmation requests. Scoped runtime evidence identified two D134 implementation defects, without changing the approved product model:

1. Firestore Rules require `app_session_generation` to be numeric, while the Worker-generated Firebase custom token emitted that claim as a string. Android request creation is therefore rejected before Agent receipt. The repair keeps the generation fence and emits a true numeric custom claim; it must not weaken the Rules.
2. D134 starts Picker Firestore listeners before the older relay client attempts its per-client Firestore persistence setting. Firestore online-only configuration moves to application startup before any listener, and existing pre-fix Firebase auth is refreshed once on first confirmation so the user is not forced to manually clear app data.
3. Agent v74 compact `agent_sync` listener is also field-broken because the final single EXE does not expose `grpc_csharp_ext.x64.dll` where Grpc.Core loads it. The hotfix must package the x64 native library correctly and CI must execute a native-load self-test against the final EXE, not only compile it.

Hotfix targets are **relay-agent-v75** and the next monotonic signed Android release **beta-vc81**. OA060 remains blocked until those Beta artifacts are published and re-tested. Existing Worker/Firestore/Functions/Android/Agent resources are reused. **Stable remains OWNER-GATED and untouched.**

## D135 — Post-D134 field refinements: realtime processing counters, alert safety and UI cleanup — 2026-09-28

Status: **OWNER APPROVED — BETA IMPLEMENTATION IN PROGRESS**.

After D134 hotfix field operation passed the restored PickList send/receive path, the Owner approved the following Beta refinements. D135 reuses the existing D134 resources and does not authorize any Stable mutation.

1. **Liên hệ picker is locally anti-spam before network completion.** After the operator confirms Liên hệ picker, the originating Agent immediately enters a local pending/disabled state before the asynchronous Firestore mutation. A successful call remains fleet-locked for the full existing 60-second window. A failed call rolls the local pending state back. Both **Liên hệ picker** and **Kết thúc** require one explicit Đồng ý/Huỷ confirmation. Ending early closes the Picker alert but does not shorten the 60-second call-button lock.
2. **PickList browser lookup is faster without extra provider usage.** The existing one-click **Tìm kiếm** retry remains. Agent observes the already-open browser DOM locally and may conclude a stable miss after repeated identical DOM samples; positive/ambiguous results return immediately. No Firestore cadence, listener, read/write or additional WMS search click is introduced.
3. **Counter labels distinguish fleet authority from process diagnostics.** Durable daily counters remain the authority. The shared presentation is labeled **Hôm nay toàn cụm**; process-local diagnostic counters are labeled **Agent này**.
4. **Processing-Agent overlay counters update immediately after durable terminal ACK.** The Agent that successfully commits a PickList terminal ACK updates its visible received/confirmed/error floor from that known durable result without another provider read. Later compact/durable snapshots merge by monotonic maximum and remain authoritative across restart/failover. Deep-hibernate/non-processing Agents keep the existing compact synchronization cadence. This optimization must not add Firestore listeners, reads, writes or polling.
5. **Picker does not see the 60-second implementation TTL text.** The internal call TTL remains for safety, but its automatic-close implementation detail is not displayed to the Picker.
6. **Agent identity is username-only in visible UI.** Composite internal values such as `admin:admin` or `admin:tamnv2` must render as `admin` or `tamnv2`. Internal application identity used for authorization/audit is not weakened.
7. **Android Beta product name is `1291 Báo hàng Beta`.** Package ID, Beta channel, update identity and signing model remain unchanged.
8. **Every Báo hàng full-screen result acknowledgement is local-first.** Both the overlay-service path and the in-app dialog path persist pending ACK metadata locally, dismiss the blocking surface immediately, then attempt server acknowledgement. Network loss, logout, session replacement or Kích User must never leave the PDA blocked behind the result dialog. Pending ACK retries only after a valid authenticated/network state returns and never creates an offline Báo hàng mutation.
9. **Current PickList resolution taxonomy remains unchanged.** Android input stays 3–20 numeric suffix digits; NOT_FOUND alone contributes anti-spam strikes; ambiguous results require explicit candidate selection; confirmation remains exact-row, generation/PRIMARY/guard fenced and fail-closed.

Implementation targets: **relay-agent-v76** and next monotonic signed Beta Android release after `beta-vc81` (expected `beta-vc82`). Existing Beta Worker/Firestore/Functions resources are reused. Stable remains OWNER-GATED and untouched.

## D136 — Manual PickList result visibility, retire Usage, and no-password Web background hide — 2026-09-28

Status: **OWNER APPROVED — IMPLEMENTATION IN PROGRESS**.

Owner explicitly confirmed D135 PASS, then approved these follow-up corrections:

1. **Manual PickList result is a complete operational row.** Every uniquely found PickList shown in Agent must simultaneously expose the full PickList code, its row-specific **Xác nhận** action, and its current **Trạng thái**. Auto-size, manual saved widths, normal/maximized transitions and window resize must not silently hide the action/status columns. A horizontal-scroll fallback is allowed only when the actual viewport cannot physically fit all critical minimum widths.
2. **Manual confirmation action follows row state.** Successful/already-confirmed rows are non-repeatable. An uncertain in-progress outcome must not offer a resend. Retryable failures may return the row action to **Xác nhận**.
3. **Usage is retired rather than presenting unreliable provider numbers.** The Agent Usage tab is removed. The Beta Worker no longer polls Google Monitoring for the Usage feature and no longer periodically writes `relay_poc_coordination/usage_current`. Do not replace this with self-counted numbers presented as Firebase/provider-authoritative usage. Existing local `FirestoreQuotaGuard` may remain only as a reference/soft guard based on operations observed by that Agent.
4. **Web Confirm hide is presentation-only.** **Chuyển Web chạy nền** hides the managed browser without asking for the Agent password. Security-sensitive actions remain protected: showing the hidden Web, stopping Web, Agent logout and switching managed browser mode retain the current password gates.
5. D135 PickList safety/HA/generation/idempotency behavior remains unchanged. No direct WMS API/session extraction is introduced. Android remains `beta-vc82`. Target Agent is `relay-agent-v77`. Stable remains OWNER-GATED and untouched.

## D137 — Normal-window PickList visibility and mandatory post-arrival Confirm refresh — 2026-09-28

Status: **OWNER APPROVED — IMPLEMENTATION IN PROGRESS**.

Owner explicitly confirmed D136 field operation OK on `relay-agent-v77`, then approved these follow-up repairs:

1. **The manual PickList result surface must remain operational in the normal/smaller Agent window.** The reported normal-window screenshot shows the input/search and bottom status text while the result grid itself collapses out of view. D137 must reserve enough vertical space for the result grid to show its header plus at least one actionable row. Maximize → restore, saved window bounds and Auto size on/off must not regress this.
2. **D136 horizontal protection remains mandatory.** PickList, **Xác nhận** and **Trạng thái** stay simultaneously visible/reachable; D137 adds vertical protection rather than replacing the D136 width rules.
3. **First arrival at Confirm is not READY evidence.** After Agent reaches the canonical Confirm page—whether after manual Supra login, stored-session Dashboard recovery, or another managed route—the Agent must perform one normal browser reload equivalent to F5 before it may declare Web Confirm ready.
4. **READY is granted only after the reloaded document is actually ready and stable.** Search/confirm actions remain disabled until the post-reload Confirm DOM satisfies the existing exact search/confirm/table guards for a bounded stable interval. An empty/unhydrated first document must never be treated as operational.
5. **Reload is bounded and non-looping.** Exactly one normal reload is required per first Confirm arrival. No periodic reload, cache-bypass reload loop, extra provider polling, or search-button spam is introduced.
6. **Security boundary is unchanged.** The implementation remains browser-UI automation using DevTools Page/Runtime only. Do not enable Network, inspect cookies/tokens/headers/storage/session material, or introduce direct WMS API calls.

Implementation target: **relay-agent-v78**. Android remains **beta-vc82**. Existing Agent-owned WebView2 host build 10 is reused. No new provider resource is introduced. Stable remains OWNER-GATED and untouched.

### D137 v79 hotfix — final Confirm data hydration

Status: **OWNER APPROVED — HOTFIX IN PROGRESS**.

Owner field-tested released `relay-agent-v78`. The D137 normal-window PickList result presentation is accepted, but the Confirm data-loading defect remains. Sanitized v78 log evidence shows the final WMS child was attached at 15:30:08.784, the automatic reload was issued at 15:30:09.400, and the Agent declared reload PASS at 15:30:12.391. The first real PickList search at 15:30:34.222 returned `NOT_FOUND`; after the operator manually pressed F5, the same workflow returned `FOUND` at 15:31:03.904 and confirmation succeeded.

The v78 assumption is therefore superseded: DOM controls + `navigationType=reload` are not sufficient evidence that WMS PickList data is hydrated when the reload fires immediately after final-route arrival.

Approved hotfix behavior:
- Target **relay-agent-v79**; Android remains **beta-vc82** and WebView2 host build 10 is reused.
- Do not reload the transient first Confirm shell. The same final canonical Confirm document must remain loaded for **3 seconds** before the automatic normal reload is issued.
- After reload, require the existing exact Confirm DOM guards to remain ready for **1.2 seconds** before publishing READY.
- If the first real search still sees **zero `PL...` codes in the entire visible table**, Agent may perform **one** bounded local normal reload and retry the search once. This recovery is one-shot per Confirm navigation and must never loop.
- The empty-table self-heal is browser-local only: no additional Firestore/Worker/provider operation or polling is introduced.
- DevTools remains Page/Runtime only. Network, cookie/token/header/storage/session extraction and direct WMS API remain forbidden.
- Stable remains OWNER-GATED and untouched.


## D138 — Web SLA realtime must preserve dirty form state

Status: **OWNER-REPORTED DEFECT / IMPLEMENTATION AUTHORIZED BY BUG-FIX REQUEST** — 2026-09-28

- On Beta Web `Thời gian xử lý`, choosing **Theo báo đầu tiên của SKU** (`FIRST_REPORT`) must remain selected while the operator is editing, including during background realtime reconciliation.
- A realtime refresh must never rebuild a dirty SLA form from an older `slaResponse` snapshot. `loadSla()` is the rendering authority for the SLA route because it already owns the dirty-form/version guard.
- Saving keeps the existing server-authoritative optimistic version check. Web may show success only when the immediate save response and the subsequent authoritative reload both return the exact mode selected by the operator.
- The existing `FIRST_REPORT` / `PER_PICKER` business semantics, service schema and timing calculations are unchanged.
- Scope is Beta Web/Worker asset deployment only. No provider resource, schema, Android or Agent change. D137 OA063 stays independently open. Stable remains OWNER-GATED.


## D139 — Dirty SLA form is protected at the shared render boundary

Status: **OWNER FIELD DEFECT / HOTFIX AUTHORIZED** — 2026-09-28

- D138 did not fully solve the reported issue: Owner selected **Theo báo đầu tiên của SKU**, saved, refreshed, and the server-authoritative view still returned **Theo từng Picker**.
- The D138 fix guarded only the realtime reconcile caller. Other shared `patchActiveSection(true)` callers can still rebuild the SLA form from the last server snapshot while the operator is editing: delayed section-load completion, network online/offline repaint, and generic action-finally repaint.
- D139 moves dirty-form protection into the shared `patchActiveSection` boundary. While `slaFormDirty=true`, generic preserved-context patches must not rebuild the SLA form.
- Save reads the actually checked `autoSkipMode` radio at submit time. Existing policy-version protection and server response + post-save GET verification remain mandatory.
- Beta Web only. No schema/provider/Android/Agent change. D137 OA063 remains independent. Stable remains OWNER-GATED.

## D140 — Firestore Agent-sync reconnect storm and quota protection

Status: **OWNER-REPORTED PRODUCTION-LIKE BETA DEFECT / AGENT HOTFIX AUTHORIZED** — 2026-09-28

- The Sep 28 Beta Agent logs show the compact `agent_sync` gRPC listener repeatedly opening and failing with `InvalidArgument` roughly once per second while real PDA PickList volume remained low. This is an Agent implementation defect, not normal load from many PDA devices.
- Root cause 1: the raw streaming Firestore gRPC client did not provide the Firestore streaming routing metadata. D140 adds both `google-cloud-resource-prefix` and `x-goog-request-params` for the configured database before opening `Listen`.
- Root cause 2: retry backoff was reset immediately after sending the Listen request, before Firestore had accepted the target. A rejected target therefore looped near 1 second indefinitely. D140 resets backoff only after the first valid server response, uses exponential transient retry, and opens a five-minute circuit for permanent/configuration/quota errors such as `InvalidArgument`, `PermissionDenied`, `FailedPrecondition` and `ResourceExhausted`.
- Root cause 3: D134 allowed every authenticated Agent, including deep-hibernate Agents, to keep the same compact listener. D140 supersedes that rule: only PRIMARY, NEXT_A and NEXT_B may keep the realtime compact listener; DEEP_HIBERNATE keeps no `agent_sync` listener.
- PRIMARY full reconciliation remains bounded to five minutes; forced reconcile cannot repeat faster than one minute. Window focus/restore remains UI-only.
- Mutations of the compact sync document compare normalized business state and skip PATCH when the state is unchanged. This removes avoidable writes without weakening call/kick/presence/counter semantics.
- The Android/PDA confirmation carrier, APK version and business flow are unchanged. D140 is **Agent-only** plus repository/CI authority. No Stable mutation is authorized.
- Agent target is v80. CI must keep the packaged gRPC native smoke test and additionally enforce routing metadata, retry/circuit policy, HA-trio listener gating and the D140 sync-safety self-test.



## D141 — SLA Save must prove server persistence end-to-end

Status: **OWNER AUTHORIZED / IMPLEMENTATION ACTIVE** — 2026-09-28

- D139 is field-failed. The observed clean-page contradiction **radio FIRST_REPORT / Đang áp dụng PER_PICKER** is not an acceptable state.
- Source review identified the concrete UI cause: shared `restoreUiContext()` restored pre-render SLA radio/field values after an authoritative rerender. SLA form controls are therefore excluded from generic field restoration.
- SLA now has separate concepts: **server/applied mode** and **draft mode**. Before Save, a changed radio is shown as an explicit unsaved draft while **Đang áp dụng** remains server authority.
- SLA Save must not use the generic `run()` busy gate because `run()` silently returns while another generic action is busy. SLA uses its own single-flight lock; one click either runs or visibly reports an in-progress save.
- A PUT is successful only after InventoryCore rereads the just-written SQLite policy and verifies the complete policy, requested mode and incremented policy version. The Web then performs a fresh no-cache GET and verifies the exact persisted mode/version again.
- A sanitized request id, requested mode, previous mode and policy version are recorded for diagnosis. No secret/session material may be logged.
- D141 is Beta Web/Worker only. Schema, provider resources, Android and Agent are unchanged. D140 Agent v80 remains a parallel workstream. Stable remains OWNER-GATED.

## D142 — Android 11 critical-alert readiness for Newland MT90 and Urovo DT50 — 2026-09-28

Status: **TECHNICAL / RUNTIME / RELEASE PASS — SIGNED BETA-VC83 — OA068 FIELD READY**.

The warehouse currently uses **Newland NLS-MT90 Android 11** and **Urovo DT50 Android 11**. D142 hardens only the Beta Android alert/readiness path and must not reopen already accepted Báo hàng, PickList, Agent or Web behavior.

1. **Readiness is automatic and precedes login/business use.** On cold start and every relevant Activity resume, `1291 Báo hàng Beta` checks the local Android alert prerequisites. If all are ready, the existing login/restored-session flow continues normally. If any mandatory item is missing, operational clients are stopped and login/business use remains blocked until readiness is restored.
2. **The required list is explicit.** The gate covers: app notifications enabled; Draw over other apps; Notification Policy Access for Do Not Disturb; battery-optimization exemption; and the dedicated critical channel at high importance with DND bypass. Android 13+ notification runtime permission may still be handled for forward compatibility, but Android 11 does not show a fake POST_NOTIFICATIONS step.
3. **Each missing item links to the closest official Android Settings surface.** App notification settings and channel settings are package/channel-specific; overlay and battery exemption use package-targeted actions where Android exposes them; DND Policy Access opens Android's policy-access list because Android 11 exposes no package-specific policy-detail action. Every row includes short Vietnamese guidance and falls back safely to App details when an OEM does not resolve a deep link.
4. **No manual test/check ceremony.** Returning from Settings triggers automatic re-evaluation. There is no `KIỂM TRA LẠI` button and setup does not require the operator to deliberately toggle Battery Saver/DND and run a special alert test.
5. **Critical alerts retain the existing authoritative overlay and local-first ACK.** D142 does not replace D133/D135 result surfaces. A new high-importance critical channel (`inventory_critical_alert_v2`) is created only after Notification Policy Access is available and requests DND bypass. Android 11 `USE_FULL_SCREEN_INTENT` plus a bounded wake Activity turns the screen on / presents a full-screen fallback, while the existing overlay service remains the main cross-app alert surface.
6. **Battery cost remains event-driven.** Existing FCM HTTP v1 data-only delivery already uses Android `priority=high` for urgent messages and is retained. D142 adds no alert polling loop, no always-on wake lock and no new always-running service. The foreground overlay/wake path exists only while a real alert is active; the wake Activity self-finishes after a bounded window.
7. **Platform boundaries stay truthful.** Normal apps cannot silently grant their own DND Policy Access, overlay permission or battery exemption. Force Stop, powered-off PDA and total network loss remain outside the guarantee. D142 must not weaken these platform controls to claim false readiness.
8. **Scope isolation.** Beta Android only, target the next monotonic signed release after `beta-vc82`. D141 Web/SLA and D140 Agent v80 remain parallel and unchanged. No new Firebase/Cloudflare/provider resource is introduced. **Stable remains OWNER-GATED and untouched.**

Field gate: **OA068** after technical/release PASS, using one normal MT90 Android 11 and one normal DT50 Android 11. Setup validation uses the automatic gate; no special manual DND/Battery Saver toggle-and-test workflow is required.

## D142 release checkpoint — 2026-09-28

- Implementation PR #284 merged to main `4e382a39fa574fe49d176af435c1a6a4afdf75f4`.
- PR gates PASS: Repo Authority `36427225972`, Project State `36427226166`, UI Design `36427226362`, Verify Beta Android `36427226198`, Firestore `36427226312`, RTDB `36427225990`, Dashboard Probe `36427226365`.
- Signed release `beta-vc83` exists and the tag resolves exactly to main `4e382a39fa574fe49d176af435c1a6a4afdf75f4`.
- The Android release workflow publishes a signed Beta only after its exact-source Beta runtime gate succeeds; therefore publication of `beta-vc83` is release evidence for the merged D142 source.
- OA068 is now **READY_FOR_OWNER_FIELD_TEST** on one Newland NLS-MT90 Android 11 and one Urovo DT50 Android 11 using the normal automatic setup flow. No deliberate Battery Saver/DND toggle-and-test ceremony is required.
- No Agent/Web/provider/Stable resource was changed by D142. Stable remains OWNER-GATED.

## D142 Owner field acceptance — 2026-09-28

Status: **OWNER FIELD PASS**.

- Owner explicitly confirmed D142 PASS after the signed `beta-vc83` technical/runtime/release checkpoint.
- Accepted PDA scope: **Newland NLS-MT90 Android 11** and **Urovo DT50 Android 11**.
- Accepted behavior includes the automatic pre-login critical-alert readiness gate, missing-setting list with Settings routing/guidance, automatic recheck after Android Back, and preservation of the existing critical alert/overlay/local-first acknowledgement path.
- OA068 is closed PASS. No further D142 field action remains.
- Canonical Android marker: `D142_OWNER_FIELD_PASS__SIGNED_BETA_VC83__ANDROID11_MT90_DT50_CRITICAL_ALERT_READINESS`.
- D141 OA067 and D140 Agent v80 remain independent open workstreams. Stable remains OWNER-GATED and untouched.

## D143 — Owner operational refinements across Android, Web and Agent — 2026-09-29

Status: **OWNER AUTHORIZED / IMPLEMENTATION ACTIVE**.

D143 is one coordinated Beta refinement and preserves previously accepted business paths unless explicitly superseded below.

1. **Android permission/readiness UX.** D143 supersedes D142 only where D142 required automatic-only advancement with no manual recheck. The blocking readiness screen keeps separate permission cards, gives a short business reason and direct Settings guidance, and adds **Kiểm tra cấp quyền**. Returning from Settings still auto-rechecks; if OEM/UI state does not advance, the manual check performs the same local readiness evaluation. **Đặt lại mặc định** resets only application-side gate presentation/check state and opens the Android app Settings surface for the operator to adjust system permissions. The app must never claim it silently revoked Android special permissions.
2. **Android login/compact presentation.** The company heading is two lines: `CÔNG TY CỔ PHẦN THE SUPRA` then `DC HƯNG YÊN`. The small bottom-right credit is `Phát triển hệ thống - tamnv2 | Pick Pack 1291`. Picker order-confirm guidance is concise/non-duplicative. SKU suggestion rows may use the full usable screen width instead of being constrained to the input width.
3. **Picker default-password convenience without public-secret leakage.** The Android login password field may be prefilled, masked, from the protected Owner-defined Picker default-password value supplied only at signed Beta build time. The plaintext password is forbidden in Git/source/logs/artifacts metadata. If the protected build value is unavailable for a release that requires this behavior, the release gate fails instead of hardcoding it.
4. **Web role/access refinements.** `PICKPACK_ADMIN` may use **Ca vận hành**. ROOT's permission-review selector includes `PICKPACK_ADMIN`. ROOT remains hidden/protected in the managed-user list. Only real ROOT may select/delete managed `ADMIN`, `PICKPACK_ADMIN`, and `REPORTER` identities; Picker bulk selection remains a separate role-filtered path.
5. **Web presentation refinements.** A zero pending count is not rendered as a `0` badge beside Xử lý báo hàng. Dashboard and detailed reporting default to **Hôm nay**. Exact Today/7/30/60 ranges highlight the matching quick preset; a non-preset custom range leaves all presets neutral and highlights both date inputs. Audit previous/next paging is shown at the top directly under the visible range/total heading.
6. **Agent operating boundary.** Normal relay business time is **05:00–22:00 Asia/Ho_Chi_Minh**. At **21:30** the Agent displays one foreground/topmost decision surface for the 22:00 boundary, whether the main window is visible or in tray. The choices are **Tăng ca thêm 1 giờ** or **Đúng giờ về**. Every accepted overtime extension advances the boundary exactly one hour; at HH:30 before the next boundary the same one-shot decision is presented again. Repetitive five-minute warning balloons are removed. If no extension applies at the boundary, existing relay/HA business processing enters sleep/deep-hibernate; the EXE may remain alive.
7. **Agent UI stability.** Auto-size must not calculate against a hidden/minimized/collapsed grid. After tray/maximize/normal restore, sizing is deferred until the visible layout has real dimensions. Compact `agent_sync` snapshots older than the already-applied version are ignored so stale listener/reconcile arrivals cannot temporarily replace the current Picker list.
8. **Picker list authority.** A valid Android LOGIN presence or a valid PickList activity may make the Picker visible. Explicit logout/session revocation/kick removes it. No timer/refresh may fabricate another user list. An old APK that is genuinely still logged in may remain visible until authoritative logout/revocation; stale sync state must not win over a newer version.
9. **Agent → Picker contact split.** **Liên hệ picker** first offers: (a) call the Picker directly back to the specialist desk using the existing 60-second shared call lock/resolve flow, or (b) send a free-text notification up to 200 characters. Chat produces a critical Picker alert with title **Chuyên viên gửi thông báo tới bạn:**, the message, and **Hãy đọc kĩ và thực hiện theo!**. The Picker's **Xác nhận** closes chat locally only; no acknowledgement is written back and no Kết thúc action exists for chat.
10. **Managed WebView2 resource bound.** The Agent-owned browser keeps the existing D126/D127 page/credential/security boundary. Hidden obsolete child WebViews are disposed with a small bounded retained set; cosmetic browser chrome is reduced and WebView2 process failure closes the host so the existing Agent lifecycle can recover it. No Network-domain/session/cookie/header extraction is introduced.
11. **Release/scope.** Target Windows Agent is `relay-agent-v81`; Android target is the next monotonic signed Beta release after `beta-vc83`. D143 uses existing Beta Worker/InventoryCore/Firebase/Firestore/GitHub distribution resources only. **No new provider resource. Stable remains OWNER-GATED and untouched.**

## D141 Owner field acceptance — 2026-09-29

Status: **OWNER FIELD PASS**.

- Owner explicitly confirmed D141 OK before opening D143.
- Accepted behavior is the end-to-end server-authoritative SLA persistence repair: separate server/draft state, non-droppable Save, SQLite post-write readback, fresh GET verification and consistent FIRST_REPORT presentation after reload.
- OA067 is closed PASS. D143 may refine adjacent Web presentation/RBAC but must not regress the D141 persistence contract.

## D144 — Field repair: runtime logs, Picker chat, legacy Kích User

Owner field evidence on D143 `beta-vc84` + Agent v81 supersedes OA069 acceptance for three defects while preserving the parts already working.

1. **Runtime logs**
   - `LOGS_OAUTH_FAILED: Token has been expired or revoked` is a real provider-auth failure, not a Web rendering issue.
   - Runtime log list/upload must not depend on Google OAuth or Google Drive availability.
   - InventoryCore SQLite is the bounded primary runtime-log authority for sanitized Web/Android support logs, with 90-day retention and the existing 30/60/90-day journal views.
   - Google Drive `Inventory/Beta/Logs` becomes best-effort archive only. A revoked OAuth token may defer Drive archival but must not fail client log upload or Web Nhật ký listing.
   - No Google Drive folder-permission change is required for D144. No OAuth token, service-account key, or credential value may be committed/logged.

2. **Picker chat**
   - Direct call behavior remains unchanged and is the reference delivery model.
   - Chat must use the existing per-Picker Firestore session-control realtime listener as the authoritative direct path; D143 FCM remains a compatibility fast-path.
   - Message length is 1–200 characters.
   - PDA presentation is full-screen: **Chuyên viên gửi thông báo tới bạn:**, the message, then **Hãy đọc kĩ và thực hiện theo!**
   - Picker **Xác nhận** dismisses locally only. No provider ACK, no Agent “Kết thúc” action and no extra usage write is allowed.
   - Agent chat input must retain keyboard focus during normal typing; modal chat entry is isolated from periodic Agent UI refresh timers while the editor is open.

3. **Kích User / legacy APK**
   - Firestore session-control revocation remains the immediate client signal for supported builds.
   - Agent must additionally request an authoritative Worker-side Android session revoke, incrementing the server generation, clearing Android device/presence and disabling the old Android notification registration. Before disabling the prior FCM registration, Worker sends one best-effort backward-compatible re-login alert for older APKs that already understand Picker command alerts.
   - The Agent fleet list must not treat a stale legacy presence as authoritative over a live kick.
   - An old APK that has no revocation listener cannot be forced to visually close its local screen while totally idle; however its server session/business authority must be revoked when the Worker revoke succeeds, and it must be removed from the Agent list. A fresh explicit login creates a new valid session.

D144 target: Beta Agent v82 + next signed Beta after vc84. SQLite schema target is 14 with an additive bounded runtime-log buffer. No new provider resource. Stable remains OWNER-GATED.
## D145 — Public OAuth production disclosure pages for Beta

Owner requires the Beta OAuth application to have public, Google-reviewable application information pages so the existing Beta OAuth client can move out of Testing without inventing a new provider resource.

1. **Public URLs.** The existing Beta host exposes unauthenticated GET/HEAD routes:
   - `https://inventory-beta.supra.cc.cd/about`
   - `https://inventory-beta.supra.cc.cd/privacy`
   - `https://inventory-beta.supra.cc.cd/terms`
   These pages must remain public and must not redirect to the application login.
2. **Application identity and purpose.** The About page identifies **SUPRA Inventory Beta**, describes the Inventory/Báo hàng workflow and explains the two existing Google scopes used by the application.
3. **Google scope boundary.** OAuth scope remains exactly the existing `drive.file` + `gmail.send` contract. The public copy states that Drive access is limited to app-created/user-authorized files and Gmail is used only to send transactional verification/recovery messages; the application does not request inbox-read permission.
4. **Privacy disclosure.** The Privacy page describes Google-data access, use, server-side OAuth credential storage, sharing/processor boundary, revocation and Google API Services User Data Policy / Limited Use. Google user data is not sold or used for advertising.
5. **Terms.** The Terms page describes authorized business use, account security, Google integration, Beta changes and third-party infrastructure without claiming Google sponsorship.
6. **Discoverability.** Web login/password-reset surfaces and the authenticated footer link to About, Privacy and Terms so the policy remains discoverable from the product.
7. **Verification/deploy guard.** Beta deployment must prove all three URLs return HTTP 200 and must verify application identity, exact scope disclosure and Privacy/Limited-Use markers.
8. **Provider and security guard.** No new provider resource is introduced and no OAuth token, client secret, service-account key or other secret may appear in source/logs. After runtime PASS, OA073 is the bounded Owner-only step to publish the existing Beta OAuth app and replace its revoked refresh token. Stable remains OWNER-GATED and untouched.


## D146 — Reliable Drive logs, live SKU refresh, managed-user delete guard and Agent input stability

Owner approved on 2026-09-29. D146 supersedes the D144 log schedule/Drive-delivery details while preserving D144 InventoryCore log availability, chat delivery and authoritative kick behavior.

1. **Immediate error/crash logs.** Web, Android and Agent must attempt a sanitized support-log delivery immediately when a crash/fatal or bounded runtime error is detected. Failure of Drive archival must not make Web/Android runtime logs unavailable.
2. **Scheduled log times.** Scheduled support logs are **06:00, 12:00, 18:00 and 21:00 Asia/Ho_Chi_Minh**. The old midnight/00:00 slot is removed because normal operation is usually off after 22:00.
3. **Typed filenames.** Drive filenames distinguish purpose and source: Web/Android use `scheduled_`, `manual_`, `error_` or `crash_` plus source/device/time; Agent uses `scheduled_agent_`, `error_agent_` or `crash_agent_` plus machine/time.
4. **Beta Google OAuth state.** Owner confirms the existing Beta OAuth application is now **In production**, a fresh refresh token was consented/deployed on 2026-09-29, and the former Testing 7-day expiry condition is removed. `gmail.send` is field-confirmed working. Scope remains exactly `drive.file + gmail.send`; no Gmail-read scope is added.
5. **Web/Android log transport.** Web and Android may use the normal Cloudflare path. InventoryCore SQLite remains the primary bounded support-log authority. Each accepted upload immediately attempts the existing OAuth Drive archive; any unsynced row is retried from InventoryCore on the existing bounded five-minute Worker cron. A Drive/OAuth outage therefore delays archival rather than losing the support log.
6. **Agent Google-first log transport.** The company-laptop Agent must not depend on office access to Cloudflare for the log payload. Agent sends bounded sanitized parts directly to the existing Beta **Google Firestore** collection. A Beta Google Cloud Function assembles the parts and uploads the payload to Google Drive. Because the Logs folder is in My Drive and a service account cannot own new My Drive files, the Function does **not** use service-account Drive ownership. Instead its existing Google workload identity authenticates to one protected Worker endpoint that returns only a short-lived resumable Drive upload session created with the existing renewed user OAuth. The OAuth token itself is never returned. The log payload then goes Google Function → Google Drive. If that direct Google-side attempt fails, parts move to `WORKER_FALLBACK` for the existing bounded Worker drain. No Drive/OAuth secret is stored on the Agent.
7. **SKU live refresh.** A successful Web SKU import emits a `sku_catalog_updated` realtime scope and a silent FCM compatibility signal. A foreground PDA syncs its local SQLite SKU cache immediately from the realtime event; a background/resumed PDA consumes the silent FCM marker and syncs without logout/login. The existing catalog version/delta validation remains authoritative.
8. **Managed-user delete authority.** Deleting managed ADMIN/PICKPACK_ADMIN/REPORTER accounts requires both **effective role ROOT** and **base role ROOT** at Web presentation, Worker API and InventoryCore mutation boundaries. A real PICKPACK_ADMIN and a ROOT temporarily downgraded to PICKPACK_ADMIN cannot select or delete an ADMIN account. True ROOT in ROOT mode retains the existing managed-account authority.
9. **Agent protected text input.** Password dialogs used by protected Agent actions (including protected exit and browser show/hide actions) are isolated from periodic UI refresh timers while open. The general Agent tick also avoids repaint work while protected text entry or primary text fields have focus, preventing the prior “type a few characters then focus drops” regression.
10. **Release targets.** Beta target is Agent `relay-agent-v83` and the next monotonic signed Android Beta after `beta-vc85`. Stable remains OWNER-GATED and untouched.

The Owner's message ended with an empty item 9; D146 does not invent an additional requirement beyond the eight concrete items above.

D146 Owner acceptance: **PASS / done** on 2026-09-29. This acceptance covers the D146 requirements as released on Beta (`beta-vc86`, `relay-agent-v83`) after the final Firestore-rules hotfix. It closes OA074 and the remaining D145/OA073 Drive runtime retest. Stable remains OWNER-GATED.


## D147 — Serial Owner-PASS gate and accepted-base protection

Owner approved this governance requirement on 2026-09-29. D147 refines D119 for sequencing and final acceptance.

- The accepted base is the latest change explicitly confirmed PASS by the Owner; technical, CI, runtime, or release PASS alone is insufficient.
- Only one Dxxx change may be active. No later Dxxx or unrelated project mutation starts while the current change lacks Owner PASS.
- NOT PASS or FAIL is repaired and retested under the same Dxxx until explicit Owner PASS.
- Before any requested change that may affect the accepted base is implemented, present base impact, affected components, regression/stability risk, resource/quota/security impact, and the safest proposed approach; implementation requires explicit Owner approval.
- Owner PASS must be recorded in canonical decision/state/Owner-action continuity under the same Dxxx before any later Dxxx starts.
- D147 is governance-only: no Web, Android, Agent, database schema, provider resource, quota cadence, or Stable runtime changes.
- D146 is the accepted base entering D147. D147 remains the only active change until explicit D147 PASS.

D147 Owner acceptance: **PASS** on 2026-09-29. The Owner explicitly confirmed "147 ok", accepting the serial Owner-PASS governance gate. D147 becomes the accepted governance base. D147 remains governance-only: the accepted runtime behavior remains the D146 Owner-PASS runtime baseline, and Stable remains OWNER-GATED.

## D148 — Web/Android alert, reporting and support-log refinement

Owner approved on 2026-09-29 after D147 Owner PASS. D148 is deliberately limited to items 1, 2, 4, 5, 6 and 7 from the Owner request; overtime unification (item 3) is excluded and must be handled only in a later change after D148 Owner PASS.

1. **Web pending visibility.** The `Xử lý báo hàng` navigation badge is absent only when the authoritative pending queue count is exactly zero. A realtime transition from zero to a positive count must create the badge immediately; positive counts must never depend on a prior DOM badge instance.
2. **Android report-created overlay.** Existing data-only high-priority FCM `report_created` is reused for Reporter/Admin Android. With overlay permission, show an adaptive cross-app card headed **THÔNG TIN BÁO HẾT HÀNG** with SKU, product name and one local **OK** action. Long product names may wrap to multiple lines and expand the card within a bounded screen-safe layout. If overlay cannot be used, retain the accepted Android notification fallback. No alert polling or new provider resource is added.
3. **Excel by shift.** Detailed Web export remains client-side after the existing bounded report pages are loaded. Shift attribution is **Ca 1 = 06:00–<14:00**, **Ca 2 = 14:00–<22:00**, otherwise **Ngoài ca / Tăng ca**, in Asia/Ho_Chi_Minh. Export adds shift columns and a `So sánh ca` sheet with workload, outcome and average-duration comparisons. No additional server/provider reads are introduced solely for the workbook.
4. **PickList warning copy.** Existing server/Firestore anti-spam semantics stay unchanged: 3 not-found attempts inside 60 seconds trigger escalating temporary locks of 5, 30 and 60 minutes. Android copy explicitly shows `Sai 1/3`, `Sai 2/3`, remaining attempts, the consequence at 3/3 and the expected unlock time; internal “lock level” terminology is not user-facing.
5. **Android support-log cadence.** Android periodic INFO uploads at 06/12/18/21 are retired. The existing 60-second local reconciliation tick remains because it also handles catalog invalidation and pending result ACK retries, but it must not send scheduled PDA INFO logs. Android sends one sanitized INFO support log when an authenticated session ends/logs out; a failed session-end send may retry only for the same user on a later login. ERROR/CRASH immediate best-effort and manual **Gửi log** remain. Web/Agent scheduled log policy is unchanged.
6. **Sequential alert queue.** Cross-app Android overlays are de-duplicated by alert/event id and presented one at a time. Specialist/Picker-command alerts have highest priority; shortage/result information follows. A higher-priority specialist alert may temporarily preempt a lower-priority visible item, but the interrupted item returns to the queue. One acknowledgement removes only the active item and then shows the next; it must never dismiss multiple SKU results. Result ACK keeps the accepted local-first durable retry contract.
7. **Resource/stability boundary.** D148 adds no schema, no new provider resource, no polling cadence, no extra Firestore read loop, no Agent change and no overtime-authority change. Stable remains OWNER-GATED and untouched.

D148 technical/runtime/release checkpoint: **PASS / Owner field acceptance pending** on 2026-09-29. Implementation PR #300 merged to main `fe893db1d80e417021defdad92d85947c37abd82`. Main authority, continuity, Beta deploy, Android, legacy operational regression and build-probe gates passed. Signed Android `beta-vc87` was published from the exact main commit and the fixed PDA distribution channel was refreshed to the same APK. Agent remains `relay-agent-v83` unchanged; item 3 overtime unification remains excluded. OA076 is field-ready. D147 remains the accepted base until explicit Owner D148 PASS.

D148 Owner acceptance: **PASS** on 2026-09-29. The Owner explicitly confirmed "D148 pass" after field review of the approved D148 scope on live Beta Web and signed Android `beta-vc87`. This closes OA076 and promotes D148 to the accepted project base. The deferred overtime Web/App/Agent unification remains outside D148 and unstarted. Agent remains `relay-agent-v83`; Stable remains OWNER-GATED and untouched.

## D149 — Unified operating schedule, recoverable Android state and operational refinements

Owner approved D149 on 2026-09-29 after D148 Owner PASS. D149 is one coordinated Beta change; D148 remains the accepted base until explicit D149 Owner PASS.

1. **One fleet schedule authority.** Agent schedule decisions are canonical in the existing Firestore coordination path. Any authenticated Agent operator may decide an eligible boundary; the first successful Firestore CAS decision for that boundary wins and every Agent follows the same shared state. A later conflicting click must not overwrite the accepted boundary.
2. **Normal window.** Replay/automatic PDA→Agent confirmation runs automatically **06:00–22:00 Asia/Ho_Chi_Minh**. No schedule write is needed to open at 06:00 or to sleep at 22:00.
3. **Overtime.** At **21:30**, and then at **HH:30 only while the current overtime extension is active**, Agent offers one-hour continuation. Each accepted extension advances exactly one hour and is capped at **05:00**. There is no 04:30 prompt to extend past 05:00.
4. **Default sleep and manual adjustment.** If no decision exists at 22:00, replay sleeps by default without a Firestore write. While sleeping between 22:00 and 05:00, Agent exposes **Điều chỉnh tăng ca**. One explicit action may reopen replay only to the next whole-hour boundary, capped at 05:00; it does not consume the upcoming HH:30 scheduled decision boundary.
5. **Early start.** From **05:00–<06:00**, Agent exposes **Bật sớm trước 06:00**. Early start is shared fleet state and expires at 06:00; 06:00 then enters the normal window automatically.
6. **Low-usage projection.** Do not trigger Cloud Functions from hot HA roles/lease documents. A dedicated low-frequency current-state projection under the already-scoped Firestore coordination collection is updated only when a real schedule decision/adjustment changes. FCM accelerates Android state delivery; it is not the sole authority. No Android/Web schedule polling or new always-on Agent schedule listener is allowed.
7. **Recovery.** Worker/InventoryCore mirrors the same schedule for Báo hàng mutation enforcement. Android cold start/login/reconnect consumes Worker state when healthy; an already-authenticated PDA may perform one exact Firestore current-state GET only as Worker-outage fallback. Missed FCM never requires event replay or per-minute reads.
8. **Shift-close behavior.** Reaching a closed boundary blocks new schedule-governed business actions but does not automatically destroy a valid Android login solely because the shift closed; a later shared overtime adjustment can reopen eligible work without forcing a fresh login.
9. **Web recent results.** Kết quả gần đây gains explicit bounded date/range navigation, overview and matching report handoff while retaining server pagination and the existing hot-report retention bound.
10. **Result attribution.** Android Có hàng/Skip result information includes SKU, product name, confirmer display name and human role/source; system timeout is identified as system rather than a generic Reporter.
11. **Agent Web storage.** Agent can select a fixed local-drive storage location for managed Web data. Migration closes the managed Web if needed, copies/moves the complete managed browser root, verifies before switching, reopens when previously running, and rolls back safely on failure. Network/removable paths are rejected.
12. **PickList presentation.** Remove the unneeded **Hôm nay** counter cluster from the PickList list surface only. Durable daily counters remain canonical for coordination/diagnostics.
13. **Quota/security guard.** No new provider is introduced. Default 22:00 sleep is write-free; schedule changes are event-driven and idempotent. D140 reconnect/backoff/circuit/listener guards remain mandatory. Stable remains OWNER-GATED and untouched.

D149 field acceptance is OA077. Technical/runtime/release PASS alone does not promote the accepted base; explicit Owner PASS is still required.

D149 Owner acceptance: **PASS** on 2026-09-29. The Owner explicitly confirmed "d149 pass" after field review of the released D149 Beta set. This closes OA077 and promotes D149 to the accepted project base. Technical/release evidence remains implementation PR #303, main `c03f54861e5fbb6ff093b129e9b76e303475c358`, signed Android `beta-vc88` and Agent `relay-agent-v84`. No provider/resource/schema expansion is introduced by the acceptance record; Stable remains OWNER-GATED and untouched.

## D150 — Quota-safe Agent coordination and manual PRIMARY takeover — 2026-09-29

Status: **OWNER FIELD ACCEPTED — PASS**.

Owner approved the post-D149 safety refinement after an explicit source-level review of free-tier risk. D150 is now the accepted base after explicit Owner PASS on 2026-09-29. Stable remains OWNER-GATED and untouched.

1. **Protected business/HA cadence.** D150 must not change the accepted confirmation latency/failover contract: PRIMARY active queue query remains **3 seconds**, inactive query **15 seconds**, burst HOT **1 second for the existing bounded window**, PRIMARY lease heartbeat **10 seconds**, failover threshold **15 seconds**, NEXT-A exact lease monitoring remains active, NEXT-B/DEEP do not query the business PENDING queue, and Android adds no polling.
2. **Fresh Picker-contact query.** The PRIMARY five-minute reconcile must no longer list up to 100 historical `picker_active_calls` documents and filter them locally. It queries only calls whose `lock_until_ms` is still in the future, with a bounded limit, then validates `ACTIVE` locally. Historical/resolved call documents remain available without being repeatedly downloaded.
3. **No N×N Agent presence scan.** Only PRIMARY may query the fresh `relay_poc_agents` projection, server-filtered by `heartbeat_at_ms` within the existing freshness window and bounded to the compact fleet envelope. NEXT-A/NEXT-B receive fleet state through the existing D140 `agent_sync` listener. DEEP keeps no realtime listener and may exact-read the single compact `agent_sync` document at a **10-minute** cadence plus the existing bounded foreground recovery.
4. **Presence/HA semantics retained.** The 10-minute Agent presence write, D140 listener backoff/circuit, role refresh, shared schedule propagation and D149 06:00–22:00/overtime authority remain. D150 does **not** turn off all coordination overnight because sleeping Agents must still learn shared overtime/early-start decisions.
5. **Document-aware local quota telemetry.** Local quota diagnostics account for the number of documents actually returned by list/query operations rather than treating every query HTTP request as one document read. This remains local reference telemetry only; provider Usage polling stays retired under D136.
6. **Agent error-storm fuse.** Crash upload remains immediate. The first occurrence of an Agent error fingerprint is sent immediately; repeated equivalent errors are suppressed for a 10-minute window and summarized on the next permitted upload. A bounded global immediate-error fuse prevents a multi-error cascade from turning an application fault into a Firestore write storm. Scheduled 06/12/18/21 support logs remain available.
7. **Commit-last Agent log chunks.** Multi-part Agent logs write non-triggering `DIRECT_PART` chunks first and write exactly one final `DIRECT_PENDING` chunk last. The existing Beta Google Function assembles/claims/uploads only after that final part exists. This removes one Function/query fan-out per intermediate chunk without reducing scheduled-log payload scope.
8. **Bounded Worker fallback.** The Worker fallback no longer lists the whole `relay_agent_log_uploads` collection. It uses a bounded Firestore query for fallback statuses only; the existing five-minute scheduled fallback remains the retry/backoff cadence. No new provider or collection is added.
9. **Manual PRIMARY privilege.** Only authenticated Agent login usernames exactly `tamnv2` or `admin` (case-insensitive) expose the **Chuyển Agent chính** action. Other ADMIN/PICKPACK_ADMIN accounts do not receive this action. The button is on the Hệ thống Agent action row at the far right and hides automatically when the current machine is PRIMARY.
10. **Manual takeover readiness.** The action is disabled unless the shared replay schedule is open, the Agent session is valid and Web Confirm is ready. One confirmation dialog is required; no password re-entry is added.
11. **Manual takeover safety.** Takeover performs an authoritative role read, bounded fresh-fleet discovery, CAS against the current roles document, creates a **new generation**, promotes the requesting machine to PRIMARY and immediately writes the generation-scoped lease. A healthy previous PRIMARY is preferred as NEXT-A; existing NEXT-A/NEXT-B are retained in order where fresh/ready and non-duplicate. Existing generation fencing before WMS mutation remains mandatory, so a stale former PRIMARY cannot confirm after authority changes.
12. **Security/resource boundary.** Username gating is an operational client authorization, not a new server identity model. D150 does not add a backend takeover endpoint, provider, collection, secret, Android build or Stable mutation. Existing Firestore/Function/Worker/Agent resources are reused.
13. **Target release.** Windows Agent target is **relay-agent-v85**. Android remains signed **beta-vc88** unchanged unless a separately justified defect is discovered. D150 field acceptance is tracked separately; technical/release PASS alone does not promote D150 to the accepted base.

### D150 technical/runtime/release checkpoint — 2026-09-29

D150 implementation PR **#306** squash-merged to main commit `c9d42c701f66283f447aad4f24c8f9043db17e37`. Main Repo Authority, Project State, Firestore, Functions, Beta Worker, UI Design, Android compatibility, Dashboard Probe and Relay Agent workflows all passed.

Runtime evidence:
- Beta Worker/Web exact-source health reached source `c9d42c701f66283f447aad4f24c8f9043db17e37`, HTTP 200, SQLite schema 14/14, agent migrations 0/0 and Operational V2 5/5 in run **36532689311**.
- Firestore Rules source validation, ruleset creation, deployment and release readback passed in run **36532689358**.
- Beta Functions deployment completed successfully in run **36532689256**.
- Windows Agent **relay-agent-v85** was published from exact commit `c9d42c701f66283f447aad4f24c8f9043db17e37`; release id **398883765**, canonical EXE asset id **597497266**, size **7,069,184 bytes**, SHA-256 `d1e7d89c431c8641591ce71e8e55b872bd4511c1cadf07bae24fce3c0005e080`. The existing `inventory-channel` Agent assets were refreshed to v85.
- Android main compatibility run **36532689273** passed with `ANDROID_RELEASE_REQUIRED=false`; no new Android release was published. Installed Beta authority therefore remains signed **beta-vc88**.
- UI Design run **36532689242**, Dashboard Probe **36532689292**, Repo Authority **36532689218** and Project State **36532689312** passed.
- No new provider, collection, secret, Android production artifact or Stable mutation was introduced.

D150 is now **TECHNICAL / RUNTIME / RELEASE PASS**. OA078 is **READY_FOR_OWNER_FIELD_TEST**. D149 remains the accepted project base until the Owner explicitly records D150 PASS; technical/release PASS alone does not promote the base.

D150 Owner acceptance: **PASS** on 2026-09-29. The Owner explicitly confirmed “d150 pass” after field review. OA078 is closed and D150 is promoted to the accepted project base. Technical/runtime/release evidence remains implementation PR #306, main `c9d42c701f66283f447aad4f24c8f9043db17e37`, Agent `relay-agent-v85`, and signed Android `beta-vc88` unchanged. No new provider/resource/schema/secret is introduced by this acceptance record; Stable remains OWNER-GATED and untouched.

## D151 — One-off MT90 DND diagnostic APK and Beta log intake

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED (2026-09-29)**

Owner requested one lightweight standalone APK to install on both a normal Newland NLS-MT90 and a failing NLS-MT90 to isolate the Android 11 `Không làm phiền / Notification Policy Access` inconsistency. The APK is diagnostic-only and must not replace or mutate the production 1291 Báo hàng Beta app.

Approved scope:
- one standalone package `cd.cc.supra.inventory.dnddiag`, Android 11+, with no application login, Firebase, realtime, SKU, PickList or shortage-report logic;
- read and display the exact system/build/profile/DND signals needed to compare the two MT90 devices, including firmware/build fingerprint, security patch, user/profile restrictions, manifest permission declaration, `NotificationManager.isNotificationPolicyAccessGranted()`, the secure policy-access package projection, and a dedicated HIGH notification channel's `canBypassDnd()` state;
- provide `MỞ CÀI ĐẶT KHÔNG LÀM PHIỀN`, `LÀM MỚI TRẠNG THÁI` and one `GỬI LOG VỀ BETA` action;
- send the sanitized diagnostic payload through a Beta-only bounded Worker endpoint, then archive through the existing Inventory/Beta logs pipeline and existing Google Drive credential held server-side;
- keep the production Android package/release at `beta-vc88` unchanged.

Base impact: **NO business-runtime behavior change to the accepted D150 Android/Agent/Web flows.** D151 adds only an isolated diagnostic APK plus a bounded Beta diagnostic-log intake route.

Affected components: diagnostic APK source, Beta Worker log intake, existing runtime-log archive path, CI/authority continuity.

Regression/stability risk: low for business runtime; the only shared-runtime change is one new Beta-only POST route before authenticated business routes. It has no business mutation and does not change existing authentication, realtime, notification, Agent, WMS or InventoryCore business semantics.

Resource/quota/security impact:
- no new provider, Firebase app, collection, database, schema, secret, polling loop, listener or scheduled job;
- each Owner-triggered upload is one bounded support-log write plus the existing Drive archive operation;
- endpoint accepts only a fixed diagnostic schema/package, rejects payloads above 20 KB, applies a short best-effort per-device/IP throttle, reconstructs an allowlisted payload server-side, and still passes through the existing runtime-log sanitizer;
- no OAuth token, refresh token, Google credential, password, API secret or signing material is embedded in the APK;
- Stable remains OWNER-GATED and untouched.

Field objective: install the same APK on one normal MT90 and one failing MT90, reproduce/open DND access state as observed, press `GỬI LOG VỀ BETA` on each, then compare the two resulting logs to distinguish firmware/build mismatch, profile/policy restriction, stale secure-settings projection, NotificationManager policy-access mismatch, or channel bypass failure.



### D151 repair probe — package DND detail + overlay compatibility test

Owner approved on 2026-09-29 after field evidence from one normal MT90 and two distinct failing MT90 devices.

Field evidence:
- normal `MT90-GL_V8.04.006`: Notification Policy API granted, secure policy list contains the diagnostic package and the high-importance diagnostic channel can bypass DND;
- two distinct `MT90-GL_V8.01.002` devices: Notification Policy API false, secure policy list does not contain the package and no bypass-DND channel can be created; sampled devices are not managed profiles and have no relevant sound/settings restriction;
- therefore D151 remains open and the next action is a bounded diagnostic repair probe, not a production permission bypass.

Owner-approved probe:
1. Keep production `1291 Báo hàng Beta` at signed `beta-vc88`; do not change its readiness gate yet.
2. Revise only the standalone D151 diagnostic APK to try the package-specific Android DND detail action `android.settings.NOTIFICATION_POLICY_ACCESS_DETAIL_SETTINGS` with `package:<diagnostic package>`, falling back safely to the existing DND list when the OEM does not resolve the detail activity.
3. Add a local `TYPE_APPLICATION_OVERLAY` 15-second probe using the diagnostic package's own `SYSTEM_ALERT_WINDOW` permission. The probe is local-only and must not add Firebase, Worker polling, Firestore, listeners or scheduled traffic.
4. Field-test on a failing V8.01.002 device. If package-detail settings repairs the real Notification Policy backend, production can later adopt that route under D151 after a new impact review. If it does not, the overlay probe provides evidence for a narrowly-scoped firmware compatibility mode proposal; no production compatibility mode is authorized by this probe alone.
5. Stable remains OWNER-GATED and untouched.


## D151 — Adaptive Android alert engine production remediation

Owner approved on 2026-09-29 after D151 field diagnosis showed one MT90 `MT90-GL_V8.04.006` with real Notification Policy grant/channel bypass and three distinct MT90 `MT90-GL_V8.01.002` devices with the same OEM mismatch: Settings appears allowed but `NotificationManager.isNotificationPolicyAccessGranted()` remains false, the package is absent from the secure policy list and no bypass-DND channel is available. The latest failing-device run also reproduced the mismatch while DND was actually active; the local `TYPE_APPLICATION_OVERLAY` probe remained visible.

Owner-approved production rule:
- do **not** select behavior from manufacturer/model/firmware allowlists;
- Android capability APIs are authority;
- hard operational readiness is app notifications (plus runtime notification permission where required), `SYSTEM_ALERT_WINDOW` / `Settings.canDrawOverlays()`, and battery-optimization exemption;
- when real Notification Policy access plus a high-importance channel with `canBypassDnd()` are available, use **Native DND mode**;
- otherwise use **Overlay Compatibility mode** without falsely claiming DND access and without blocking login solely on the broken/unsupported DND backend;
- overlay remains the canonical visual alert surface and preserves the accepted D148 priority/FIFO/de-duplication/local-first ACK semantics;
- when screen is off or keyguard is active, use the existing bounded `CriticalWakeActivity` via a local capability-based wake coordinator; no WakeLock, polling, always-on service or provider traffic is added;
- notification full-screen intent is only a capability-checked fallback, not alert authority;
- Beta Android only. Agent, Web, Worker business behavior, Firestore coordination and Stable remain unchanged.

### D151 Owner acceptance — 2026-09-29

D151 Owner acceptance: **PASS**. The Owner explicitly confirmed D151 PASS after field review of the signed `beta-vc89` adaptive Android alert engine. OA079 is closed and D151 is promoted to the accepted project base. The accepted scope remains capability-based alert readiness/delivery with Notification + Overlay + battery-exemption hard requirements, native DND enhancement only when truly available, and Overlay Compatibility otherwise. No new provider/resource/schema/polling/listener/secret is introduced by this acceptance; Agent/Web/Stable remain unchanged and Stable remains OWNER-GATED.

## D152 — Bounded PickList checkbox recovery and post-confirm verification — 2026-09-29

Status: **OWNER APPROVED — IMPLEMENTATION ACTIVE**.

After explicitly accepting D151 PASS, the Owner approved the proposed PickList recovery logic with the requirement that normal speed remain stable while exceptional states are not missed.

1. The normal path remains unchanged: exact unique PickList row + usable checkbox proceeds directly through the existing exact-row / checkbox-verified / semantic-confirm / exact-dialog confirmation path.
2. A unique PickList row whose checkbox is not usable first receives the existing single Search retry. If the exact row still exists but remains unselectable, Agent may perform exactly one bounded normal Confirm-page reload and one bounded Search recheck. This recovery is local browser UI work only and must not add Firestore/provider polling.
3. If the same exact row becomes selectable after recovery, confirmation continues normally. If the row disappears or resolves to a different exact code, return a state conflict rather than NOT_FOUND; do not increment Picker wrong-input strikes. If the same row remains unselectable, return a state conflict / checkbox-not-ready outcome rather than claiming Supra rejected the confirmation.
4. After the existing dialog-confirm click, retain the existing passive terminal observation. If no trustworthy success/error signal is obtained, exactly one read-only Search refresh may verify whether the exact row is stably gone. This path must never click Confirm again.
5. An existing uncertain confirmation guard remains a hard no-resend fence. A later request for the same exact PickList may perform one read-only browser verification; only stable disappearance of that exact row may convert the result to CONFIRMED. Otherwise it remains uncertain.
6. Existing request-age, single-PRIMARY, generation, full-code, exact-row and confirmation-guard fences remain mandatory. No direct WMS API, session extraction, Network interception, second mutation provider or guessed success state is allowed.
7. D152 is Agent-only and targets `relay-agent-v86`. Signed Android remains `beta-vc89`. No new provider resource, Firestore collection/schema, listener, polling cadence, cron or secret is authorized. Stable remains OWNER-GATED.

### D152 Owner acceptance — 2026-09-29

D152 Owner acceptance: **PASS**. The Owner explicitly confirmed PASS after downloading and field-testing the released `relay-agent-v86`. OA080 is closed and D152 is promoted to the accepted project base.

Accepted technical/release evidence: implementation PR #316 → main `a418de7e852ff9c1bc8b37309b65cdfc75fe3f24`; Repo Authority, Project State, Relay Agent, UI Design and Dashboard Probe main gates PASS; release `relay-agent-v86` id `399178131`; Agent EXE SHA-256 `098d8cc6c51bdf58e0ef9bd662b9b7bfaf8a0f12b749318d44c194e89eb0c430`. The inventory Agent channel points to the same EXE digest.

The accepted D152 behavior remains the bounded PickList recovery/verify-only contract already approved: normal ready PickLists keep the fast path; checkbox-not-ready recovery is bounded; recovery state changes do not become false NOT_FOUND strikes; post-confirm and existing uncertain-guard handling never resend the Confirm mutation. Android remains signed `beta-vc89`; no new provider/resource/schema/listener/polling/write cadence is introduced; Stable remains OWNER-GATED.


## D153 — Quota-safe Picker presence and notification write dedupe — 2026-09-29

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED**.

Baseline is D152 Owner PASS (`relay-agent-v86`). After impact review, the Owner approved only the reviewed A+B+C optimization. The proposed single-document streaming redesign (D) is explicitly deferred until separate field evidence and approval exist.

1. **PickList fallback is one-shot, never a heartbeat.** LOGIN/session projection remains authoritative. A PickList request may add a `PICKLIST` fallback only when that Picker's current Android session is absent from the Agent list. If LOGIN already contains the same/newer session, or the same/newer fallback already exists, that PickList performs zero Picker-list/provider write. Repeated PickLists from the same session must not refresh fallback state.
2. **Fallback is session-generation fenced.** A newer Android session may supersede an older fallback. Delayed older-session work may not downgrade a newer LOGIN/fallback. Explicit logout/session revoke/kick carries bounded user + session-generation removal metadata so only matching/older fallback is removed; unrelated presence events and transient realtime/network loss must not erase fallback.
3. **InventoryCore performs semantic dedupe before Firestore.** Volatile timestamps such as `last_seen_at`, `device_seen_at`, `generated_at` and `updated_at` are not shared-Picker membership. Re-registering the same device/session remains a recovery opportunity but, after successful projection acknowledgement, causes zero Firestore presence/control write.
4. **Notification-target mirroring is desired-state idempotent and retry-safe.** `picker_notification_targets/<user>` is written/deleted only when user/device/platform/token/enabled differs from the last successfully acknowledged mirror. A failed write or acknowledgement is never marked current, so a later normal registration may retry.
5. **Agent no-op gate is Picker-only.** Repeated Picker presence/fallback state is skipped before `agent_sync`. This optimization must not short-circuit call locks, kicks, fleet/PRIMARY takeover, durable counters or other concurrency-sensitive state. Existing five-minute PRIMARY reconciliation remains the repair net.
6. **Protected business/HA timing is frozen.** PRIMARY queue remains 3s active / 15s inactive / 1s bounded HOT; PRIMARY lease remains 10s; failover remains 15s. Android exact-request result observation and D152 WMS confirmation/recovery behavior remain unchanged.
7. **Deferred scope D.** D153 does not replace the existing `picker_presence_projection/current` + `picker_presence_current` control/ACK transport with a new streaming path. That redesign requires separate evidence and Owner approval.
8. D153 reuses existing Beta Worker, InventoryCore, Firestore and Agent resources. No new provider, collection, SQLite schema, Firestore schema/rule expansion, secret, listener, polling loop, cron or Android release is authorized. Target Agent is `relay-agent-v87`; signed Android remains `beta-vc89`. Stable remains OWNER-GATED and untouched.


## D153 technical/runtime/release checkpoint — 2026-09-29

D153 implementation PR #321 merged to main `d69566ee0ae6294573ec91f9eb649764e91561ee`. Main Repo Authority `36594651066`, Project State `36594651211`, UI Design `36594651147`, Dashboard Probe `36594651119`, Beta Worker `36594651073`, DND compatibility build `36594651179` and Relay Agent `36594651175` all PASS.

Beta Worker live health returned HTTP 200 with exact source `d69566ee0ae6294573ec91f9eb649764e91561ee`, SQLite `14/14`, Operational V2 `5/5`, and Agent auth migration `0/0`. Agent release `relay-agent-v87` id `399311941` points to the same main commit. EXE asset id `598619169`, size `7,078,912` bytes, SHA-256 `0f863dea6a9841cb237be48ab83f17ff9443654c298ea9db6bc5c8a79c597070`; inventory-channel Agent asset id `598619345` has the same digest.

D153 technical/runtime/release status is **PASS** and OA081 is **READY_FOR_OWNER_FIELD_TEST**. Accepted base remains D152 until explicit Owner D153 PASS. Android remains signed `beta-vc89`; the deferred streaming redesign D was not implemented; no new provider, collection, schema, secret, listener, polling loop or cron was added. Stable remains OWNER-GATED and untouched.


## D153 Owner acceptance — PASS — 2026-09-29

The Owner explicitly confirmed **D153 PASS** after field validation of the released quota-safe Picker presence changes. D153 is promoted to the accepted Beta base.

Accepted runtime remains implementation main `d69566ee0ae6294573ec91f9eb649764e91561ee`, Agent `relay-agent-v87` release id `399311941`, EXE SHA-256 `0f863dea6a9841cb237be48ab83f17ff9443654c298ea9db6bc5c8a79c597070`, and signed Android `beta-vc89` unchanged.

Accepted D153 scope remains A+B+C only: one-shot session-fenced PickList fallback, InventoryCore semantic presence/notification write dedupe, and Picker-only Agent sync no-op gating. The proposed streaming redesign D remains deferred. Protected 3s/15s/1s confirmation cadence, 10s PRIMARY lease, 15s failover and D152 confirmation safeguards remain unchanged. OA081 is closed; no new provider/resource/schema/listener/polling/cron was introduced; Stable remains OWNER-GATED.


## D154 — Unified 05:45–22:30 schedule, schedule self-heal, Android setup UX and visible version — 2026-09-30

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED**.

Baseline is D153 Owner PASS. After impact review, the Owner approved the coordinated D154 change across Android, Agent, Functions, Worker and Web.

1. Android login footer shows the running application version on the left of the existing developer credit, using the same small typography. The value is derived from BuildConfig and is not hard-coded; presentation is `Phiên bản beta <base-version> - version <versionCode>`.
2. The Android pre-login permission surface moves the DND test + Overlay guidance to a visually distinct top priority group. Native DND remains capability-based and non-blocking; Notification + Overlay + battery-exemption remain the hard readiness requirements from D151.
3. Normal shared business time is widened to **05:45–22:30 Asia/Ho_Chi_Minh**. The overtime cutoff remains **05:00**. Early start is therefore **05:00–<05:45**.
4. Overtime cadence is anchored to **22:30 → 23:30 → 00:30 ...**, capped at 05:00. Agent is still the schedule authority; normal UI timers must not add a schedule listener or polling loop.
5. When a shared override is active outside the normal window, Agent shows a professional shared-state message including the effective end time and exposes **Huỷ tăng ca**. Cancellation is a new explicit `CANCEL_OVERTIME` schedule decision that closes the override immediately and is propagated to Android/Web.
6. A repeated explicit manual schedule action may re-project the already-authoritative role state once to repair a missed projection. This is action-driven self-heal only; it is not a timer/retry loop.
7. Root cause found during D154 implementation: `operatingScheduleChanged` existed in Functions source but was omitted from the Beta Functions deployment allow-list. D154 adds the function to the deploy workflow and guard. The Function mirrors the exact schedule document to Worker and sends FCM; Worker mirror gets one bounded retry inside the same event on failure.
8. Android PickList reconciliation no longer treats a successful but closed/stale Worker schedule response as final. If still blocked outside normal time, it performs one exact Firestore `operating_schedule` GET under the existing 60-second user-attempt gate; there is no background listener/list query or periodic retry.
9. D154 targets Agent `relay-agent-v88` and the next monotonic signed Android Beta after `beta-vc89` (expected `beta-vc90` if no intervening release).
10. No new provider, Firestore collection/schema, SQLite schema, secret, polling loop, listener or cron is authorized. Stable remains OWNER-GATED and untouched.


### D154 technical/runtime/release checkpoint — 2026-09-30

D154 implementation is technically released on Beta but is **not Owner-accepted yet**. D153 remains the accepted base until OA082 receives explicit Owner PASS.

- Implementation PR #324 merged to main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`.
- Main Worker run `36609749783` PASS with HTTP 200 health, exact source commit, SQLite 14/14, Operational V2 5/5 and Agent migration 0/0.
- Main Functions run `36609749800` PASS and successfully **created** `operatingScheduleChanged(asia-southeast1)`, resolving the identified D149 deployment omission.
- Signed Android **beta-vc90** release id `399404364`, APK asset `598876063`, size `19,118,744` bytes, SHA-256 `b3204970660096768950de870ccf6b8a6329018f6f27ccde12d83b24189a1cf4`.
- Agent **relay-agent-v88** release id `399403230`, EXE asset `598872709`, size `7,081,472` bytes, SHA-256 `74128bc35fdc8b635e512b8af7a59131d0c932c7865b8597c31399d4d7a3d8f2`.
- Both release tags resolve to exact main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`; the fixed inventory channel was refreshed to the same APK/EXE digests.
- Agent run `36609749714` passed on attempt 2. Attempt 1 had a transient Microsoft Fixed WebView2 package-list/download race after the Agent EXE had already published; rerun passed without any source/runtime hotfix. Experimental PR #325 was closed unmerged.
- Main Repo Authority `36609749884`, Project State `36609749791`, UI Design `36609749861`, Dashboard Probe `36609749872`, Android `36609749611`, Worker `36609749783`, Functions `36609749800` and Agent `36609749714` are PASS.
- No new provider/resource/collection/schema/secret/listener/polling/cron. Stable remains OWNER-GATED and untouched.
- OA082 is **READY_FOR_OWNER_FIELD_TEST**.


### D154 Owner acceptance — PASS — 2026-09-30

The Owner explicitly confirmed D154 PASS after field validation of the released Beta implementation.

- D154 is now the **accepted project base**.
- Accepted runtime source remains implementation main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`.
- Accepted releases: Android `beta-vc90` and Agent `relay-agent-v88`.
- Accepted schedule authority: normal replay **05:45–22:30**, early start **05:00–05:45**, 22:30-anchored overtime extensions capped at 05:00, explicit `CANCEL_OVERTIME`, and one shared Agent-owned schedule state consumed by Android/Web.
- Accepted synchronization repair: `operatingScheduleChanged` is deployed in Beta; Worker mirror retry is bounded to one retry inside the same event; Android exact Firestore schedule recovery is only on a blocked PickList attempt that still sees a closed Worker state.
- Accepted Android presentation: dynamic Beta version footer and DND + Overlay priority setup while Notification/Overlay/battery hard readiness remains unchanged.
- OA082 is closed PASS. The serial Owner-PASS gate is open for the next separately reviewed change.
- No new provider/resource/collection/schema/secret/listener/polling/cron. Stable remains OWNER-GATED and untouched.

## D155 — Picker contractor identity and shortage-reporting capability — 2026-09-30

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED**.

Baseline is D154 Owner PASS. After impact review, the Owner approved D155 with a strict transport/quota boundary.

1. Picker HR identity adds configurable **Nhà thầu / nhà cung cấp** alongside Mã nhân viên and Họ và tên. Mã nhân viên remains the identity key. Missing HR membership still does not automatically disable/delete an account.
2. The HR source adds a required Nhà thầu column mapping. Individual Picker contractor cells may be blank. Contractor data applies only to PICKER identities.
3. Existing and newly provisioned Pickers default to **Báo hàng enabled**. HR sync preserves an existing Picker's explicit reporting toggle and never silently re-enables a Picker previously disabled by an administrator.
4. shortage_reporting_enabled is independent from account ACTIVE/DISABLED. Disabling it must not block login, PickList/Xác nhận đơn, Agent presence/contact or other non-Báo-hàng capability.
5. ADMIN, PICKPACK_ADMIN and ROOT may enable/disable Báo hàng for one, many or all Pickers. This does not widen PICKPACK_ADMIN account lifecycle disable/delete authority.
6. When disabled, Android keeps the Picker signed in and keeps **Xác nhận đơn** available. Báo hàng is visibly locked, shortage submission is blocked server-side, and new Có hàng/Skip shortage-result delivery is suppressed. Historical shortage data is preserved.
7. The shortage capability control path is strictly **Web ↔ Cloudflare Worker/InventoryCore ↔ PDA**. D155 must not use Firestore/RTDB as authority, delivery, polling or recovery for enabling/disabling Báo hàng. Online PDA uses the existing Cloudflare WebSocket direct-control path; missed frames self-heal from /api/auth/me on normal login/resume. No capability polling is allowed.
8. Contractor display on Windows Agent may piggyback only on the **existing Agent Picker presence/sync payload**. It adds no Firestore listener, poll, read/write cadence or HR-triggered Firestore write. Contractor-only HR edits may appear on Agent at the next already-required Picker presence/Agent sync update.
9. Web managed-user search includes contractor and filters Báo hàng enabled/disabled. Picker rows show contractor/reporting capability. Android shows contractor compactly in Picker identity; Agent adds contractor to Picker list/search.
10. Quota policy: no new provider resource, Firestore collection, Firestore/RTDB capability operation, FCM capability push, polling loop, listener or cron. Cloudflare realtime reuses the existing hibernatable WebSocket path.
11. D155 uses additive InventoryCore SQLite schema 15, targets Agent relay-agent-v89, and the next monotonic signed Android Beta after beta-vc90. Stable remains OWNER-GATED and untouched.

## D156 — Schedule convergence repair + Picker Báo hàng default OFF — 2026-09-30

Status: **OWNER APPROVED — IMPLEMENTATION AUTHORIZED**.

Baseline is D155 Owner PASS. D156 is a coordinated Beta repair for the observed split state where Agent/PickList accepted overtime while Web and the Báo hàng path could still see a closed Worker schedule.

1. Agent/Firestore remains the single schedule authority. D156 does not create a second schedule writer.
2. The normal path remains Agent schedule action → existing operatingScheduleChanged Function → Worker mirror + existing FCM. No new listener, polling loop, cron or provider resource is authorized.
3. When InventoryCore still reads the business window as closed, a schedule-governed request may use a single exact Firestore read of relay_poc_coordination/operating_schedule through the existing Google runtime service account. Durable Object in-flight sharing plus a 10-second global throttle prevents burst amplification. No collection query/listener is allowed.
4. If exact recovery observes a newer schedule version, InventoryCore mirrors it locally and emits the existing operating_schedule WebSocket invalidation for ADMIN/PICKPACK_ADMIN/ROOT. Web Ca vận hành must actually reload that state on the existing realtime scope.
5. Android retains the existing data-only FCM topic. The active MainActivity consumes the existing operating-schedule broadcast and immediately reapplies shared-window presentation; Báo hàng send controls are disabled while the shared window is closed. Server authorization remains final authority.
6. D156 explicitly supersedes D155's initial default-enabled rollout policy: all existing PICKER rows are set to Báo hàng disabled once by a durable migration marker, and newly HR-provisioned Pickers are created disabled. After this one-time migration, HR sync preserves any later explicit administrator enable/disable choice.
7. shortage_reporting_enabled missing/null state is fail-closed for Picker across Worker, notification targeting, realtime result eligibility and Android parsing.
8. Account ACTIVE/DISABLED remains independent. Tắt Báo hàng still does not block login, Xác nhận đơn/PickList, Agent presence/contact or unrelated alerts.
9. Target runtime is SQLite schema 16 and the next monotonic signed Android Beta after beta-vc91. Windows Agent remains relay-agent-v90 unchanged.
10. Stable remains OWNER-GATED and untouched.

## D156 technical/runtime/release checkpoint — 2026-09-30

D156 is technically/runtime released on Beta and **READY_FOR_OWNER_FIELD_TEST** under OA084. D155 remains the accepted base until explicit Owner D156 PASS.

- Implementation PR #333 merged to main `859a7dfb8b83594cc43fa502ac53d449ab1ee8ef`.
- Beta Worker run `36645477945` PASS: HTTP 200, exact source, SQLite `16/16`, Operational V2 `5/5`, Agent auth migration `0/0`.
- Signed Android **beta-vc92** release id `399600358`, APK asset `599489469`, size `19,118,748` bytes, SHA-256 `10171a4b8e38b542670be2c21c556c269c2f3f7b1f1ed8757e738618522e6d7f`; inventory channel APK asset `599489528` matches the same digest.
- Windows Agent remains **relay-agent-v90** unchanged.
- D156 normal schedule propagation remains Agent → existing operatingScheduleChanged Function → Worker + FCM. Exact recovery is only while Worker is closed and is single-flight/globally throttled to one exact schedule-document read per 10 seconds.
- Schema 16 applied the one-time existing-Picker Báo hàng default-off migration; new HR Pickers also default off while later explicit toggles are preserved.
- Main Authority, State, UI, Dashboard, Worker and Android gates are PASS. No new provider resource, collection, secret, listener, polling loop, cron or Firestore write cadence is introduced. Stable remains OWNER-GATED.

## D156 Owner acceptance — PASS — 2026-09-30

The Owner explicitly confirmed **D156 PASS** after field validation of the released Beta implementation.

- D156 is now the **accepted project base**.
- Accepted runtime remains implementation main `859a7dfb8b83594cc43fa502ac53d449ab1ee8ef`, SQLite schema `16`, signed Android `beta-vc92`, and Agent `relay-agent-v90` unchanged.
- Accepted schedule behavior keeps Agent/Firestore as the only schedule authority, uses the existing Function → Worker + FCM normal path, and permits only single-flight globally throttled exact recovery when Worker remains closed.
- Accepted Picker capability policy: existing Pickers were migrated once to Báo hàng disabled; newly provisioned Pickers default disabled; later explicit ADMIN/PICKPACK_ADMIN/ROOT enable/disable choices survive HR sync.
- Web Ca vận hành and foreground Android Báo hàng now converge on the shared overtime state without a new polling/listener cadence.
- OA084 is closed PASS. The serial Owner-PASS gate is open for the next separately reviewed change.
- No new provider resource, Firestore collection/write cadence, secret, listener, polling loop or cron was introduced. Stable remains OWNER-GATED and untouched.

## D157 — Agent throughput, write reduction, targeted PRIMARY and WMS session validation — 2026-09-30

Status: **OWNER APPROVED — IMPLEMENTATION ACTIVE**.

Owner explicitly accepted the D157 proposal on top of the D156 accepted base, then narrowed browser work to session-check scheduling only.

1. **Android contract is frozen.** Android remains signed `beta-vc92`; no Android source/rebuild, PickList request schema, ACK/result semantics, session generation, anti-spam or notification flow may change in D157.
2. **PRIMARY queue speed may improve without weakening the accepted poll path.** The D131 REST PENDING query remains the single processing pipeline at 3s with active PDA, 15s inactive and 1s HOT burst. D157 may add one PRIMARY-only Firestore query listener solely to wake that existing REST poll sooner. It must not parse/mutate/ACK through a parallel pipeline. A local read-budget guard disables the optional listener before the reserved read margin is consumed; REST fallback remains unchanged.
3. **Write optimization targets only daily summary counters.** Terminal PickList ACK stays immediate and durable. The per-ACK daily summary write is removed from the latency-critical ACK commit. PRIMARY periodically rebuilds the daily totals from authoritative ACK documents using bounded Firestore aggregation counts and writes one absolute summary checkpoint after 50 new ACKs or five minutes, plus one recovery checkpoint after PRIMARY generation/startup changes. Calls, Kích User, rate limits, confirmation guards, leases and HA safety writes remain unchanged.
4. **Targeted PRIMARY transfer.** Exact Agent logins `tamnv2` and `admin` may use **Chuyển Agent chính** from any current role, including while their current machine is PRIMARY. The action shows the fresh Agent fleet, the operator selects a ready target, confirms, and the target machine performs its own WMS readiness proof before roles/generation CAS. The old PRIMARY remains authoritative until the target's CAS succeeds.
5. **Target readiness is local and fail-closed.** A target must still be online, Replay/business-enabled and Web Confirm ready when it receives the transfer. Immediately before promotion it performs a real top-level Confirm reload using the existing D137 `Page.reload` / normal-F5 path. Failure or expiry leaves the old PRIMARY in place.
6. **Session validation cadence only; no browser optimization.** All non-PRIMARY Agents perform one real Confirm reload every two hours, only while idle; if busy, defer until work ends and at least 30 seconds is idle. PRIMARY reloads only after 60 minutes without strong real WMS activity/proof and at least 60 seconds idle. PickList work always outranks scheduled reload. No WebView2 memory/CPU tuning, suspend, Chromium flag change, profile/cache clearing or passive `RefreshState` cadence optimization is authorized.
7. **D137 remains protected.** Login → Dashboard/SFT3 → canonical Confirm, three-second final-document settling, real `Page.reload(ignoreCache=false)`, `navigationType=reload`, 1.2-second stable DOM readiness and bounded empty-table/checkbox recovery remain unchanged. DOM inspection alone is never equivalent to the D157 active session check.
8. **Network transition hardening.** On a real Windows network-address change, refresh the Windows proxy immediately plus the existing delayed refreshes. During the bounded network-transition window, safe Firestore reads may prefer a fresh system-proxy snapshot on the first attempt. Corporate-proxy bypass remains forbidden.
9. **Scope.** Beta Windows Agent + existing Beta Firestore coordination/index configuration + authority/tests only. No new provider collection, secret, Worker business route or Stable mutation. Stable remains OWNER-GATED.

Implementation target: **relay-agent-v91**. Final Owner field PASS is required before D157 becomes the accepted base.


## D157 technical/runtime/release checkpoint — 2026-09-30

D157 is technically/runtime released on Beta and **READY_FOR_OWNER_FIELD_TEST** under OA085. D156 remains the accepted base until explicit Owner D157 PASS.

- Implementation PR #336 merged to main `87cbed6d7fc14cb71176ce65e613afb334ecb5e3`.
- Main gates PASS: Project State `36675226281`, Dashboard Probe `36675226242`, Repo Authority `36675226227`, UI Design `36675226333`, Beta Firestore `36675226210`, Verify Beta Relay Agent `36675226296`.
- Windows Agent **relay-agent-v91** release id `399752709`; canonical EXE asset `600151295`, size `7,113,216` bytes, SHA-256 `b9db68c6e23e538d038638e0b2aead13cf1e8c82f12242dc2ca54c386025b341`.
- Inventory runtime channel Agent asset `600151474` has the same SHA-256; manifest asset is `600151475`. Android remains **beta-vc92** unchanged.
- D157 preserves the accepted D137 real `Page.reload`/normal-F5 browser semantics. Secondary Agents validate every two hours only when idle; PRIMARY validates only after 60 minutes without strong WMS proof plus idle time. No WebView2/browser-runtime optimization was introduced.
- PRIMARY realtime wake only accelerates the existing REST fresh-PENDING pipeline. Per-job daily-summary write is removed; absolute aggregate checkpoints run after 50 ACKs / five minutes and on PRIMARY recovery. Targeted PRIMARY handoff validates the selected target with a real reload before CAS.
- No new provider resource, Firestore collection, secret, Android release or Stable mutation. Stable remains OWNER-GATED.


## D157 repair — role-independent Agent/User/Picker presentation — 2026-09-30

Owner field testing of Agent v91 found that a logged-in secondary Agent could receive the shared Agent-sync snapshot but leave Agent/User and Picker lists blank until that machine was manually promoted to PRIMARY. This is a D157 defect, not intended PRIMARY authorization.

Approved repair contract:
- PRIMARY ownership gates PickList confirmation mutation only; it does **not** gate viewing the Agent/User fleet or active Picker list.
- PRIMARY, NEXT_A and NEXT_B must render the shared fleet/snapshot they already hold. Deep/fallback behavior keeps the existing D150 bounded synchronization policy.
- Login and CLOSED→ACTIVE lifecycle transitions must repaint existing in-memory fleet/Picker state before relying on any later provider refresh.
- The repair must not add Firestore polling, reads, writes, listeners, collections, provider resources or a parallel data pipeline.
- Existing operating-hours behavior, D137 real Page.reload/F5 semantics, D157 session checks, HA mutation fences, Android beta-vc92 and Stable remain unchanged.
- Repair release target: Windows Agent v92. D156 remains accepted base until explicit Owner D157 PASS.


## D157 repair technical/runtime/release checkpoint — 2026-09-30

D157 repair is technically/runtime released on Beta and **READY_FOR_OWNER_FIELD_RETEST** under OA085. D156 remains the accepted base until explicit Owner D157 PASS.

- Repair PR #338 merged to main `6b71a9bf439a1399a86b13252613e3aaea05e5ee`.
- Main gates PASS: Repo Authority `36678094171`, Project State `36678094241`, Dashboard Probe `36678094200`, UI Design `36678094162`, Verify Beta Relay Agent `36678094225`.
- Windows Agent **relay-agent-v92** release id `399772355`; EXE asset `600203458`, size `7,113,728` bytes, SHA-256 `58e7d60def203660dccd8df1ec766c672afaa90d6eceaffb81cb9c1784baf5b6`.
- Inventory runtime-channel Agent asset `600203519` matches the same size and SHA-256; manifest asset is `600203516`. Android remains **beta-vc92** unchanged.
- Repair makes Agent/User and active Picker list presentation role-independent for authenticated PRIMARY/NEXT_A/NEXT_B Agents and repaints already-held in-memory sync state on login/CLOSED→ACTIVE transitions. PRIMARY still exclusively gates protected PickList mutation.
- No new Firestore read/write/listener/poll cadence, collection, provider resource or parallel data pipeline was introduced. D137 Page.reload/F5 semantics, D157 session checks/HA fences and Stable are unchanged.


## D157 Owner acceptance — PASS — 2026-09-30

The Owner explicitly confirmed **D157 PASS** after field validation of the released Agent v92 repair and the complete D157 behavior.

- D157 is now the **accepted project base**; OA085 is closed PASS and the serial next-change gate is unlocked.
- Accepted Agent runtime is **relay-agent-v92**, release id `399772355`, EXE asset `600203458`, SHA-256 `58e7d60def203660dccd8df1ec766c672afaa90d6eceaffb81cb9c1784baf5b6`; Android remains **beta-vc92** unchanged.
- Accepted D157 behavior includes optional PRIMARY realtime wake of the existing REST pipeline, removal of per-ACK daily-summary writes in favor of absolute 50-ACK/5-minute checkpoints, targeted tamnv2/admin PRIMARY handoff with target-side real F5 validation, two-hour idle secondary session checks, PRIMARY checks only after 60 minutes without strong WMS proof plus idle, and network-transition proxy refresh hardening.
- The v92 repair is accepted: authenticated PRIMARY/NEXT_A/NEXT_B Agents can view synchronized Agent/User and active Picker lists without PRIMARY promotion; login and CLOSED→ACTIVE repaint already-held in-memory sync state without new provider reads/writes.
- D137 real Page.reload/F5 semantics remain frozen; no WebView2/browser-runtime optimization was introduced.
- No new provider resource, Firestore collection, secret, Android release, polling cadence or Stable mutation was introduced. Stable remains OWNER-GATED and untouched.

## D158 — Agent v93 speed/stability/usage reuse + health/counter/log lifecycle — Owner approved 2026-10-01

D158 starts from the **Owner-accepted D157 base**. It is Windows-Agent-only; Android **beta-vc92 is hard-locked and must not be rebuilt, changed or released**. Stable remains OWNER-GATED.

Owner-approved requirements:
- Preserve D157 business safety and timing as the minimum contract: PRIMARY REST 3s active / 1s hot / 15s inactive fallback, 10s PRIMARY lease, 15s failover, confirmation guard, generation fence, rate-limit, D137 real Page.reload/F5 and WMS exact-row mutation semantics.
- Reuse data already travelling through an accepted path before issuing another provider read/write. A fast path may shorten the path, but failure must fall back to D157 rather than create a weaker/slower mode.
- The PRIMARY Firestore Listen event may carry the full PENDING document into the existing single confirmation pipeline. REST remains independent fallback; no second WMS business path is authorized.
- A successful authoritative roles read used by the pre-WMS mutation fence also satisfies the periodic role-refresh proof.
- AgentSync mutations may reuse the current listener snapshot + updateTime CAS; exact GET remains fallback for missing cache or conflict.
- Connection health is role-aware. NEXT_A/NEXT_B must not be reported offline merely because only PRIMARY performs business queue polls. Login must converge to and render the actual PRIMARY/NEXT_A/NEXT_B/DEEP role.
- Firestore gRPC Listen routing must use one canonical full database resource identity. The field-observed database/header mismatch is a D158 defect target.
- New resilience reads are allowed only when they improve degraded-path speed/stability and are locally bounded to at most **2,000 additional reads per provider quota day**. Normal operation is expected to use the same or fewer reads than D157.
- Agent counters use the operational day **05:00 Asia/Ho_Chi_Minh → 04:59:59**. Process-local/UI/overlay counters reset before the first new-day render/increment; stale previous-day shared counters must not be merged.
- Durable daily-counter provider reads are recovery reads, not a blind five-minute cadence: reload on business-day or PRIMARY-generation recovery, then use current RAM/shared state.
- Agent support logs keep the two local streams but are sealed into durable non-overlapping bundles on 6h dirty, ~2 MiB, session/logout, error, crash, manual/recovery boundaries. Capture and upload are separate; logging never blocks PickList/WMS/ACK.
- Target support-log transport is Beta Google Apps Script → the existing scoped Inventory/Beta/Logs Drive folder, with deterministic bundle idempotency and Firebase ADMIN/PICKPACK_ADMIN token validation. Firestore is retired **only from Agent support-log delivery** after real Office proof. Until the gateway is provisioned/configured, the D157 Firestore log transport remains the safe fallback.
- No secret, password, token, WMS cookie/session/signature or signing material may be committed or written to support logs.

D158 target release is **relay-agent-v93**. D157 remains the accepted project base until explicit Owner D158 PASS.

Owner continuation on 2026-10-01: D158 field acceptance must use the **official normal-distribution `relay-agent-v93` release**, not a PR-only workflow artifact. PR artifacts remain technical evidence only. AI must merge the technically passing D158 PR, allow the existing main Agent workflow to publish `relay-agent-v93` and update the Agent channel, verify that release/channel evidence, and only then hand OA086 to the Owner for Office field proof. D157 remains the accepted base until explicit Owner D158 PASS.

D158 hotfix continuation approved by Owner on 2026-10-01 after real v93 error-log review:
- The official v93 release is **not** eligible for Owner D158 field PASS because a same Firestore request was observed entering the confirmation batch twice and reaching two browser mutation attempts.
- Hotfix target is the next monotonic Agent release **relay-agent-v94**. Android remains beta-vc92 hard-locked; Stable remains untouched; D157 remains the accepted base.
- PRIMARY listener payload is processed without waiting behind a due REST fallback round-trip. The accepted REST 3s/1s/15s safety cadence remains active and independent; the 2s degraded reserve remains bounded exactly as D158 approved.
- Request identity is the Firestore job/document request id. Duplicate protection is defense-in-depth: realtime queue keeps the newest snapshot per document identity, transport deduplicates before audit/business work, business input deduplicates again, and the final WMS mutation loop hard-blocks a second ConfirmExact for the same RequestId.
- Firebase Agent role probing may use a local non-secret role hint keyed by a one-way identifier fingerprint. A first-role HTTP 400 is diagnostic only; one canonical error is emitted only after both allowed Agent role identities fail.
- Full sanitized local technical logs remain complete. Repeated transient Google/DNS/timeout symptoms from one active connectivity incident are coalesced into one immediate support bundle; observed recovery closes the incident so a later outage is captured as a new incident.
- CI must fail if the request-id dedupe fences, WMS single-mutation fence, auth-probe classification, connectivity-incident lifecycle or Firestore database routing guards regress.

D158 hotfix technical/release checkpoint on 2026-10-01: PR #343 passed Repo Authority, Project State, Agent, UI/Android, Firestore, RTDB and Dashboard gates, merged to main at `25b146a6d7e826b34b79944967cb83f0e643b1d0`, and main verification published official **relay-agent-v94**. The normal Agent distribution channel was refreshed to the same v94 binary digest; Android beta-vc92 remained unchanged. This is technical/runtime/release PASS only. D157 remains the accepted base and D158 remains open until OA086 field proof and explicit Owner PASS.



## D158 Owner acceptance — PASS — 2026-10-01

The Owner explicitly confirmed **D158 PASS** after field validation of the official **relay-agent-v94** release on the real Office path.

- D158 is promoted to the **accepted project base**.
- Accepted Agent runtime is `relay-agent-v94`; Android remains `beta-vc92` unchanged.
- The accepted D158 behavior includes request-id duplicate suppression across listener/REST overlap and the final WMS mutation fence, listener payload fast-path without removing the D157 REST safety cadence, role-probe error classification, and sanitized connectivity-incident coalescing.
- The Owner field PASS closes OA086 and accepts the provisioned Beta Apps Script support-log gateway path for Agent support-log delivery. No secret/token value is recorded.
- Stable remains OWNER-GATED and untouched.
- The serial change gate is unlocked for the next Owner-approved change.


## D159 — Isolated Firestore Usage test utility — Owner approved 2026-10-01

D159 starts from the **Owner-accepted D158 base** and is deliberately isolated from every accepted runtime path.

Owner-approved requirements:
- Create a separate Windows test utility named **SUPRA Firestore Usage Test**. It is not Agent v94 and must not replace, modify, inject into or share process state with Agent v94.
- UI has exactly one operational tab: **Thông tin**. Opening the EXE immediately attempts the test; there is no login form and no unrelated Agent/PickList/WMS function.
- Authentication is silent and read-only: the utility may read the existing Agent DPAPI CurrentUser `session.bin`, refresh the Firebase ID token in memory, and call the D159 gateway. It must never rewrite, rotate, delete or migrate the accepted Agent session file.
- If no saved Agent session exists, fail clearly rather than adding a second login flow.
- The D159 provider is a **new, separate Beta Google Apps Script Web App**, not the accepted D158 support-log gateway. A D159 failure may remove Usage visibility only; it must not affect support logs, PickList confirmation, HA, WMS, Android, Web or Worker.
- The Apps Script validates Firebase ID tokens and permits only exact ADMIN or PICKPACK_ADMIN base/effective-role matches.
- It queries only Google Cloud Monitoring metrics for the Beta Firestore default database: document reads, writes, deletes, active connections, snapshot listeners and rules evaluations (ALLOW/DENY/ERROR).
- Provider results are globally cached for **15 minutes** in Apps Script. The EXE refreshes immediately at startup, then every 15 minutes; a manual **Cập nhật ngay** action may request the same cached path.
- Summary presentation includes provider-quota-day Reads/Writes/Deletes against informational 50k/20k/20k reference values, realtime current + 24h peak, and Rules ALLOW/DENY/ERROR for the last 24 hours.
- Detailed presentation is a 24-hour hourly table with Read, Write, Delete, Listener peak, Connection peak, ALLOW, DENY and ERROR.
- Reference limits are informational only and are not represented as a billing entitlement guarantee.
- Cloud Monitoring data may lag live provider activity by several minutes; the UI must label the source/update time accordingly.
- D159 itself creates **zero Firestore document reads/writes/deletes** for Usage collection. It does not call WMS, Cloudflare business APIs, Drive or Android.
- One new Beta Apps Script resource is authorized. No secret/token/key value may be committed or logged. Deployment URL is stored only in GitHub Beta environment variable `D159_USAGE_GATEWAY_URL_BETA`.
- Stable remains OWNER-GATED and untouched.

D159 technical implementation follows branch → PR → authority/continuity PASS → merge. The current connected tools cannot create/deploy a new Apps Script Web App or set the GitHub environment variable, so the only remaining manual gate after technical merge is OA087 provisioning via Web UI. Owner field PASS is required before D159 is accepted as the next base.


## D159 technical/source checkpoint — 2026-10-01

Status: **TECHNICAL SOURCE / BUILD PASS — OA087 OWNER PROVISIONING READY**.

- PR #346 merged to `main` at `0f67eecd2ec37a2291061d1fc8cbdb2d6f4bc2cb`.
- Main PASS evidence: Repo Authority `36872486803`, Project State `36872486890`, UI Design `36872486834`, Dashboard Probe `36872486812`, D159 Usage Test `36872486836`.
- The standalone Windows D159 EXE compiles and passes its parser/self-test and source isolation/security guards.
- Main workflow produced technical artifact `11168455789` (digest `sha256:1a8364ec8c2a9e7f79bed8cb7b7287ed8396d4639902f0918ad4fda77975ec06`). Because the dedicated D159 gateway URL is not yet configured, this artifact contains a CI placeholder gateway and is **not** the Owner field-test release.
- The separate Apps Script source passes JavaScript syntax and isolation guards; it uses only external request + `monitoring.read`, shared 900-second Script Cache, Firebase ADMIN/PICKPACK_ADMIN token validation, and no Firestore/Drive/WMS/Worker mutation path.
- D158 Agent v94 and its accepted log gateway are unchanged. Android remains beta-vc92. Stable remains OWNER-GATED.
- OA087 is the only current blocker: Owner provisions the separate Apps Script D159 Web App and stores its `/exec` URL in GitHub Beta environment variable `D159_USAGE_GATEWAY_URL_BETA`. After that configuration, CI must prove gateway identity and publish the configured D159 field-test prerelease before Owner testing.


## D159 configured field-release checkpoint — 2026-10-01

Status: **TECHNICAL/RUNTIME/RELEASE PASS — READY FOR OWNER FIELD TEST**.

- Owner completed the separate D159 Apps Script provisioning and GitHub Beta environment-variable setup.
- PR #348 verified the configured D159 gateway identity successfully without changing runtime logic.
- Main commit `95a03d0a90d781ed3b75f1cbe13798cb36d6cdda` passed Repo Authority `36889812834`, Project State `36889812825`, UI Design `36889812805`, Dashboard Probe `36889812846`, and configured D159 Usage Test `36889812874`.
- The main D159 workflow proved the configured Apps Script GET identity for project `supra-inventory-beta`, built the standalone EXE, passed self-test/isolation guards and published official prerelease `d159-usage-test-v1`.
- Release id `401138149`; EXE asset id `603627225`, size `27,648` bytes, SHA-256 `91df4f9aef51e3a00c16b6a45119402371197a0168863c36890e7cca9a9f5571`; checksum asset id `603627229`.
- D159 remains isolated: accepted D158 Agent v94/log gateway, Android beta-vc92, Worker/WMS business paths and Stable are unchanged.
- OA087 now requires only Owner field comparison of real D159 values against Firebase/Cloud Monitoring. D158 remains the accepted base until explicit Owner D159 PASS.


## D159 field failure — all Monitoring metrics N/A — 2026-10-01

Owner field test of `d159-usage-test-v1` is **FAIL** for provider data retrieval.

Observed screenshot facts:
- the standalone EXE opens normally;
- it identifies the saved `admin` Agent session;
- it receives a D159 gateway response and shows the shared cache state (`<=15 phút`);
- every Read/Write/Delete, realtime, Rules and hourly metric is `N/A`.

This narrows the failure boundary to **Apps Script -> Cloud Monitoring**. Client-to-gateway reachability and the Firebase saved-session authentication path are not the failing stage.

Same-change repair D159-v2:
- preserve the existing isolated architecture and 15-minute shared cache;
- do not alter D158 Agent v94/log gateway, Android vc92, Worker/WMS or Stable;
- expose only sanitized Cloud Monitoring HTTP/status/reason identifiers (for example HTTP status + Google error status/reason), never raw provider response text or credentials;
- show the exact provider failure code in the D159 UI so the next field run can distinguish IAM/scope/API enablement from an invalid Monitoring query;
- no extra Firestore document operations and no increased Monitoring cadence.

Owner PASS remains blocked until D159 loads real provider values and they are compared with Firebase/Cloud Monitoring.


## D159 v2 diagnostic repair release — 2026-10-01

After the Owner field screenshot showed every provider metric as `N/A`, D159 remains open and the same change ID was repaired rather than opening a new change.

- PR #349 recorded the field failure and added a bounded v2 diagnostic repair.
- Main commit `ae5e309b9d64c45190cffc4a199c461a9ddb6579` passed the configured D159 gateway identity probe, standalone Windows build, parser self-test, isolation/security guard and prerelease publication.
- Official repair prerelease: `d159-usage-test-v2`, release id `401147817`.
- EXE asset id `603649137`, size `28,160` bytes, SHA-256 `0a281091e1c3072d4d93f5fbbee1b26cb09194bc5302871cf824fbec6e5366b6`.
- V2 does not increase Monitoring cadence and creates no Firestore document operation. It only surfaces the provider failure code that v1 hid behind generic `N/A`.
- Owner retest requirement: if values remain unavailable, report only the visible sanitized `Cloud Monitoring lỗi: ...` code/status. This identifies whether the remaining issue is OAuth/IAM/API enablement or Monitoring query syntax without exposing secrets.


## D159 403 root-cause repair — quota-project attribution — 2026-10-01

The Owner's D159-v2 field screenshot proves the provider failure is HTTP **403**. The D159 Windows client, saved Agent DPAPI session, Firebase token refresh, Web App reachability and 15-minute cache path are all functioning.

The same D159 change is repaired without touching the D158 accepted base.

Repair:
- every Apps Script Cloud Monitoring REST call now includes `X-Goog-User-Project: supra-inventory-beta` in addition to the bearer token from `ScriptApp.getOAuthToken()`;
- the Script Cache key is bumped to `D159_FIRESTORE_USAGE_V3_QUOTA_PROJECT` so an old cached 403/N-A snapshot cannot survive the redeploy;
- provider failures remain sanitized but classify missing `monitoring.timeSeries.list`, missing `serviceusage.services.use`, insufficient OAuth scope, disabled Monitoring API and missing quota-project cases;
- CI gains an independent Google Cloud provider canary using the existing protected Beta service-account secret. It calls the exact Firestore read metric/filter with `X-Goog-User-Project` and must return HTTP 200 before this repair may merge.

This follows Google's documented user-credential REST requirement that a quota project can be supplied with `X-Goog-User-Project`; the caller must have `serviceusage.services.use` on that project. Cloud Monitoring `timeSeries.list` also requires `monitoring.timeSeries.list`.

No new runtime secret is introduced. The existing CI service-account credential is used only inside GitHub Actions and is never copied to Apps Script or the EXE. Runtime cadence and Firestore document-operation cost remain unchanged.

After technical PASS, the only manual action is updating/redeploying the **existing** D159 Apps Script Web App as a new version. The deployment URL and D159-v2 EXE do not need to change.


## D159 403 diagnostic proof — missing Monitoring consumer permissions — 2026-10-01

Automated provider diagnosis on run `36893601587` reproduced HTTP 403 outside Apps Script using the protected Beta Google service-account identity and the exact Firestore Monitoring filter.

Safe `testIamPermissions` output:
- `monitoring.timeSeries.list = false`
- `serviceusage.services.use = false`
- Monitoring API enabled-state could not be confirmed because the caller lacks Service Usage permission.

The Owner field Apps Script path independently returns `MONITORING_HTTP_403`. Therefore D159 is blocked at Google Cloud Monitoring consumption/IAM, not at the Windows EXE, Firebase session, D159 gateway routing, cache, Firestore data model or metric filter.

Minimal provider fix:
1. Ensure **Cloud Monitoring API** is enabled on `supra-inventory-beta`.
2. Grant **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) to the Google account used to deploy/execute the D159 Apps Script.
3. Grant the same role to `inventory-beta-runtime@supra-inventory-beta.iam.gserviceaccount.com` for the automated provider canary.
4. Redeploy the existing D159 Apps Script with repo-managed Gateway revision `D159-GW-v3`, which adds `X-Goog-User-Project: supra-inventory-beta` and a fresh cache key.

This is narrower than granting project Viewer/Editor. No Stable role/resource is touched.

## D159 provider repair proof — IAM/API/redeploy technical PASS — 2026-10-01

Owner confirmed the Google Cloud provider repair actions for the existing isolated D159 resource: Cloud Monitoring API is enabled on `supra-inventory-beta`, the required Service Usage Consumer grant is present for the Apps Script execution account and `inventory-beta-runtime@supra-inventory-beta.iam.gserviceaccount.com`, and the repo-managed `D159-GW-v3` code was redeployed using the existing Web App deployment.

GitHub Actions rerun `36893999796` provides independent technical proof:
- Cloud Monitoring API: `ENABLED`;
- `monitoring.timeSeries.list = true`;
- `serviceusage.services.use = true`;
- the exact Firestore `document/read_ops_count` query for the default database returned HTTP 200;
- configured D159 gateway identity, isolated EXE build and parser/self-test all PASS.

This closes the 403 provider/IAM blocker technically. It does **not** constitute Owner PASS for D159: OA087 remains open until the Owner field-retests the existing D159-v2 standalone EXE and confirms that real totals/hourly/realtime/rules values are visible and plausible against Firebase Usage. D158 remains the accepted base; Agent v94, Android vc92, Web/Worker/WMS and Stable are unchanged.

## D159 v3 — multi-service Firebase usage field candidate — 2026-10-02

Owner approved continuing the **same D159** with a v3 standalone field candidate before any next change is opened. D158 remains the accepted base and production Agent v94 / Android vc92 / Web / Worker / WMS / Stable are unchanged.

D159-v3 expands the existing Cloud Monitoring-only gateway from the Firestore core metrics to a bounded provider snapshot covering:
- Firestore document read/write/delete operations, active connections, snapshot listeners, Security Rules, data+index storage, provider-day remaining quota/reset and derived 24-hour totals/peak hours;
- Firebase Authentication / Identity Toolkit request volume and Secure Token refresh volume;
- Firebase Cloud Messaging API request/error volume;
- the existing `inventory-beta-picker-alerts` Cloud Run function request/error volume, current/peak instance count and billable instance time.

The gateway performs 13 Cloud Monitoring queries only on a **shared 15-minute Script Cache miss**. The usage feature does not query, scan, write or delete Firestore documents. The standalone client still refreshes its existing saved Firebase session in memory and the gateway validates the ID token, so a small bounded Firebase Auth request overhead remains; this is not Firestore document quota.

The v3 UI is Vietnamese-first and uses clear operational terms. The 24-hour Firestore detail table is retained with Vietnamese columns. Provider data may lag; N/A is never treated as zero.

Owner also fixed the future Agent integration contract: once D159 itself receives explicit Owner PASS and a later change integrates this surface, **Thông tin Usage is visible only for exact normalized Agent logins `tamnv2` and `admin`**. Every other Agent user must have no Usage tab, no Usage refresh timer and no Usage gateway request. This requirement is recorded now but no later change is opened or implemented before D159 Owner PASS.

## D159 Owner result — PASS — 2026-10-02

Owner explicitly confirmed **D159 PASS** after field validation of the official `d159-usage-test-v3` candidate with deployed `D159-GW-v4`.

Accepted D159 behavior:
- Vietnamese-first **Thông tin Usage** standalone surface covering Firestore quota/day, storage, realtime, Security Rules, 24-hour totals/peaks/hourly detail, Firebase Authentication/Secure Token, FCM and the existing Picker-alert Cloud Run function;
- automatic client refresh every 15 minutes with a shared Apps Script cache of 900 seconds;
- Usage collection performs zero Firestore document Read/Write/Delete operations; bounded Firebase authentication overhead is not Firestore document quota;
- provider lag is allowed and unavailable provider series remain truthful `N/A`, never fabricated as zero;
- the future Windows Agent integration contract remains exact login `tamnv2` or `admin` only; every other Agent login has no Usage tab, no Usage timer and no Usage gateway request;
- production Agent v94, Android beta-vc92, Web/Worker/WMS business paths and Stable are unchanged by D159.

OA087 is closed. D159 is promoted to the accepted project base and the serial governance gate is unlocked for a later Owner-approved change. No later change is opened by this acceptance record itself.

## Apps Script automation permission canary — Owner approved — 2026-10-02

After D159 Owner PASS, the Owner approved a **non-D160 infrastructure capability probe** to validate the already-configured GitHub Environment `beta` secret `CLASPRC_JSON` and the enabled Google Apps Script API. D159 remains the accepted project base and no product/runtime change ID is opened by this probe.

The only authorized provider mutation is the temporary scoped resource `apps-script-automation-canary-beta`. The main-only canary may create one standalone Apps Script project, push the repo-managed minimal source, create immutable versions, create/list/update/delete one versioned deployment, then delete the temporary script in the same run. The canary uses `webapp.access=MYSELF`, contains no business data and must not access Firestore, RTDB, WMS, Cloudflare business APIs, Drive business files or Stable.

Exact temporary Script/deployment IDs and the `CLASPRC_JSON` value must never be committed or intentionally printed. PR execution is static validation only; provider mutation is allowed only after branch → PR → authority/continuity PASS → merge to `main`. A failed probe does not alter the D159 accepted base and does not open D160.
## D160 — Agent v95 bulk confirm, Usage, unified Logs and Picker history — Owner approved — 2026-10-02

The Owner explicitly approved D160 against the accepted D159 base. Android **beta-vc92 is hard locked**: D160 must not rebuild, release or change its contract. Stable remains OWNER-GATED.

D160 confirmation behavior is Agent-only and changes the WMS browser orchestration without changing the PDA Firestore request schema required by vc92. One micro-batch is capped at **15 requests**. Agent performs one multi-term WMS search, classifies each request independently and processes the READY subset before any checkbox-not-ready recovery. True NOT_FOUND, ambiguity, rate-lock and other terminal outcomes remain per-request; one bad request never makes the batch all-or-nothing. READY outcomes are durably ACKed before the deferred recovery wave. Duplicate request IDs and duplicate resolved full PickLists are coalesced without conflating different requests that merely share a suffix.

For a READY mutation wave, Agent freezes the exact unique PickList set, proves there is no stale dialog, no foreign selected checkbox and exactly one usable checkbox for every target, then selects those rows and uses one WMS **Xác nhận lấy lại hàng** dialog. After the final dialog click, **CONFIRMED** is accepted only from a **new or content-changed success surface observed after that click**. A fresh WMS error surface is recorded as post-click evidence but, for a multi-row mutation, remains **CONFIRM_IN_PROGRESS_OR_UNCERTAIN** because it does not prove zero partial success. WMS page reload, dialog disappearance, PickList row presence or PickList row disappearance are never success evidence. Every non-success post-click result keeps the confirmation guard closed and must not issue a second WMS mutation.

D160 targets normal end-to-end response in **5–10 seconds** and a hard product target of **≤20 seconds**. The implementation reserves final-click/terminal-signal/ACK time with an earlier mutation-start safety fence and does not spend the fast lane on the old long zero-table F5 recovery. An entirely zero/unhydrated WMS table is technical unavailability and must not create a Picker NOT_FOUND strike.

D160 also incorporates the accepted D159-v3 **Thông tin Usage** surface into the official Agent. It is visible only for exact normalized Agent logins `tamnv2` and `admin`; any other valid Agent login has no Usage tab, no Usage timer and no Usage gateway call. Refresh remains 15 minutes through the shared Apps Script cache and Usage collection performs zero Firestore document Read/Write/Delete operations.

Agent presentation changes: **Kết nối** becomes **Cài đặt**; existing connectivity test and PickList overlay settings remain unchanged. User-facing **Nhật ký vận hành** and **Chẩn đoán kỹ thuật** tabs are removed and Agent no longer maintains realtime log listboxes for presentation. Operational + technical evidence is written to one complete sanitized local log stream. Cài đặt exposes basic Logs status, open-file and manual **Gửi Logs** using the existing upload path.

D160 adds **Lịch sử Picker xác nhận PickList**. It is populated only from request/outcome data already passing through Agent plus existing in-memory Picker synchronization, so the tab adds no Firestore read/write/listener/poll cadence. It shows operational time, user/MNV, Picker name, contractor, sent suffix/text, result, resolved full PickList when available and processing time. The visible/local day resets at 05:00. Contractor and resolved full PickList are added to the existing terminal ACK payload without increasing ACK write count.

The existing closed-day Excel export is enriched with contractor and resolved full PickList. Only after the Drive file upload succeeds, terminal ACK job documents for that exported day may be deleted using the exact document list already read for the export; this adds no second query/read. Unresolved/non-terminal work is never deleted by this D160 purge.

Provider consolidation is part of D160: the accepted D159 Monitoring action is merged into the existing Agent log Apps Script gateway. That existing script is renamed **SUPRA Inventory Beta - Agent Operations Gateway**, moved into the scoped Inventory Drive folder, and keeps the existing Agent gateway URL. The separate **SUPRA Inventory Beta - Firestore Usage Gateway D159** is deleted only after the existing gateway URL proves the unified D160 GET identity **and** an authenticated Firebase ADMIN canary successfully calls `get_firestore_usage` with a real Monitoring-backed response. CI reuses the existing protected Beta Firebase Rules service-account secret to mint one short-lived custom token, deletes the temporary Auth user immediately, and never prints the token. No new provider resource or repo secret is introduced.

D160 also repairs cross-cycle terminal-request replay with a short local terminal cache, treats gRPC UNAUTHENTICATED as refresh/reconnect rather than a five-minute permanent circuit, and bounds Worker revoke 401 recovery to one token refresh + one retry followed by a local 60-second circuit while the existing Firestore kick path remains available.

D159 remains the accepted base until D160 passes branch/PR/authority/continuity/release gates and the Owner explicitly records D160 PASS under OA090.

### D160 technical/provider release checkpoint — 2026-10-02

After the Owner reported `D160_MONITORING_AUTH_PASS`, provider verification workflow `36949347354` attempt 2 passed the unified gateway identity, Firebase-authenticated Usage POST and Cloud Monitoring read proof, then retired the redundant D159 Apps Script and verified it absent.

The blocked Agent workflow `36942335324` was rerun and passed, publishing Beta prerelease `relay-agent-v95`. Android remains `beta-vc92`; Stable remains untouched. This is technical/runtime/release evidence only. D159 remains the accepted business base until OA090 field validation ends with explicit Owner D160 PASS.



### D160 Owner-field repair approval — 2026-10-02

Owner field review of `relay-agent-v95` found D160 is not yet acceptable and explicitly approved same-D160 repair. D159 remains the accepted base; no new change ID opens.

The repair target is `relay-agent-v96`; Android stays hard-locked at `beta-vc92` and Stable remains untouched.

Approved repair requirements:
- PickList checkbox classification must use only visible/enabled checkbox controls inside the exact visible data row. A header/select-all/framework checkbox without a real `PL...` row is not a foreign selection; a checked different real PickList row remains fail-closed.
- Web Confirm may advertise READY only after the real normal reload/F5 path and actual PickList data hydration. A rendered table shell with zero real `PL...` codes is not READY. Agent may perform at most one bounded real F5 recovery for this empty-hydration state before remaining unavailable.
- Cài đặt must visibly contain a Logs card below the existing PickList overlay card, with basic local/pending/last-send information plus manual send and open-log actions.
- Agent must seal/send an additional log delta at the 21:45 local operational boundary if running, and after successful overtime continue/stop/cancel/manual-adjust decisions.
- Only after the existing Apps Script gateway confirms the Drive upload succeeded may already-uploaded local source log lines be pruned. Newer lines and durable unsent sealed bundles must remain.
- Thông tin Usage automatic refresh uses fixed local clock boundaries `:00 / :15 / :30 / :45`, not a 15-minute interval measured from process startup. Manual refresh and the existing tamnv2/admin visibility restriction remain.
- Current-business-day Picker confirmation history must converge across the existing PRIMARY/NEXT_A/NEXT_B `agent_sync` stream without a new listener, poll, collection or history-only provider write. History payload is bounded and piggybacks only when the existing aggregate-counter mutation already requires the existing reconcile write.
- Picker history adds wrong-input/strike count and lock detail (level/minutes/until) from the rate-limit decision already produced by the confirmation pipeline; no extra rate-limit read is authorized.

The existing D160 maximum-15 micro-batch, per-request terminal ACK, exact target fence, fresh post-final-click success evidence, no-second-mutation uncertainty guard, PRIMARY generation fence, consolidated Agent Operations Gateway and D159 gateway retirement remain unchanged. D160 remains open under OA090 until v96 technical/release PASS followed by explicit Owner field PASS.

### D160 repair v96 technical release checkpoint — 2026-10-02

- PR #379 (`fix/d160-field-repair`) passed all 9 PR workflows and merged to `main` at `ffb75df558d5217cb0ec871928471916c75a6769`.
- Main Agent workflow run `36964147000` PASS published `relay-agent-v96` (release `401538424`), canonical EXE asset `604789328`, size `7,212,544` bytes, SHA-256 `6a76e825e92f46632043f6f83721ce43228614babb951e6634261623db2573c7`.
- Repair includes exact visible PickList-row checkbox fencing, real-PL hydration readiness/recovery, visible Settings Logs/manual send, 21:45 and overtime boundary checkpoints, Drive-confirmed oldest-first/fail-closed local log pruning, existing-agent-sync history piggyback with strike/lock details, and Usage boundaries `:00/:15/:30/:45`.
- Android remains `beta-vc92` unchanged; Stable remains Owner-gated and untouched.
- This is technical/release PASS only. D160 remains unaccepted until Owner completes OA090 field acceptance against the real company WMS/PDA/fleet environment and explicitly reports PASS.
- D159 remains the accepted base until that explicit D160 Owner PASS.

### D160 v97 overlay/history lifecycle repair approval — 2026-10-02

Owner review of the v95/v96 field logs isolated an additional same-D160 Windows Agent lifecycle defect and explicitly approved repair before any further Owner acceptance.

Canonical root cause: during Agent construction, D128 overlay initialization refreshes D135 counters before D160 History UI columns exist. That counter path can call the business-day history reset/load path. If a same-day Picker history file already contains rows, the old implementation attempted to insert those rows into a zero-column DataGridView, raising InvalidOperationException. Because overlay form creation, initial counter refresh, overlay show, Settings card creation and tray-menu wiring shared one try/catch, that exception also prevented both the overlay and its Settings surface from appearing. A later History UI initialization could then skip repaint because the business-day key had already been marked loaded.

Approved repair remains under D160 and targets relay-agent-v97:
- Separate D160 History model load/reset from WinForms rendering. The model may load before UI construction; rendering is deferred until the grid is initialized and remains idempotent for same-day restart.
- Guard row rendering on History UI readiness/columns and repaint the already-loaded current-day model after UI initialization.
- Create the Bảng nổi Picklist Settings card independently from overlay-form success so a runtime overlay failure cannot hide the operational settings surface.
- Add explicit overlay lifecycle diagnostics by stage, one bounded automatic retry after D160 UI initialization and a manual **Thử lại bảng nổi** action. No periodic retry/provider loop is allowed.
- Startup-smoke must seed a non-empty same-day History file and fail unless both History repaint and overlay lifecycle initialize successfully.
- Preserve the v96 confirmation pipeline, WMS hydration/checkbox fixes, Usage/log/history-sync provider cadence, Android beta-vc92 and Stable without behavioral expansion.

D159 remains the accepted base. D160 stays open under OA090 until relay-agent-v97 passes branch/PR/authority/continuity/release gates and the Owner explicitly reports D160 PASS.

### D160 v97 technical release checkpoint — 2026-10-02

- Owner-approved same-D160 lifecycle repair PR #381 passed all 9 PR workflows and merged to `main` at `4c3f0a4dffc94f66237d0958032fd27ac52fed29`.
- Main Agent workflow run `36969035725` PASS, including the strengthened startup-smoke with non-empty same-day Picker History and overlay lifecycle checks.
- Beta prerelease `relay-agent-v97` was published as release `401562436`. Canonical EXE asset `604881289`, size `7,216,128` bytes, SHA-256 `b8f75d0f100cbb97493d140f39fd708df7002dc1a073eff6a4b7c346d12f4530`.
- The repair separates History model loading from UI rendering, repaints already-loaded same-day History after UI readiness, makes the Bảng nổi Picklist Settings surface independent from overlay-form success, adds staged sanitized diagnostics, one bounded post-UI auto retry and explicit manual retry.
- The v96 WMS confirmation pipeline, Agent Operations Gateway/provider cadence and Android `beta-vc92` are unchanged. Stable remains OWNER-GATED and untouched.
- This is technical/runtime/release PASS only. D159 remains the accepted base and OA090 is now ready for Owner field acceptance of v97. No later change ID may open until explicit Owner D160 PASS.



### D160 Owner field acceptance — 2026-10-02

- Owner explicitly confirmed **D160 PASS** for the released `relay-agent-v97` field candidate.
- OA090 is closed PASS. The v97 overlay/history lifecycle repair and the prior D160 v96 repair scope are accepted as the field baseline.
- D160 is now the accepted project base; D159 is superseded only as the accepted-base pointer, while its approved behavior remains inherited where D160 did not change it.
- Android remains hard-locked at `beta-vc92` with no D160 Android source/build/release change. Stable remains OWNER-GATED and untouched.
- The serial Owner-PASS gate is unlocked for the next change, subject to the normal impact review and explicit Owner approval before any base-affecting mutation.

## D161 — Consolidated Web/Android/HR repair backlog — Owner requirements approved, implementation deferred — 2026-10-02

The Owner explicitly requires GitHub, not chat memory, to be the durable authority for the collection phase. D161 is therefore opened as an **authority/backlog workstream only** against the accepted D160 base. D160 remains the accepted runtime base. No D161 source change, build, release, deploy, provider mutation or Stable mutation is authorized until the Owner separately commands implementation after reviewing the consolidated list.

Canonical detailed backlog: `docs/D161_APPROVED_BACKLOG.md`.

Owner-approved D161 requirements currently include:
- repair the Picker shortage-reporting capability contract by normalizing external Service/Worker values to boolean and hardening Android parsing/reconciliation, while preserving fail-closed behavior and preventing D156 migration history from being erased by ordinary runtime reset;
- identify the current Web as **Version 1**, render **Website nghiệp vụ Inventory | Version 1**, increment the Web version on later Web-source releases, and include `web_version` in Web runtime logs;
- make all applicable Web date presets update both authoritative query state and visible `Từ/Đến` fields without generic UI restoration overwriting the chosen range;
- replace manual HR synchronization with an event-driven, no-Apps-Script Google Sheet change path using a verified source, Drive file-change watch, Worker, Sheets API and InventoryCore; +1 new Picker auto-applies, >1 new Picker requires realtime Web confirmation, bounded information-change thresholds apply, and destructive/invalid source conditions fail closed;
- replace Android vc92's hidden SKIP_ALLOWED row-tap correction with an explicit server-authoritative **Sửa thành Đã có hàng · MM:SS** action, one local zero-network countdown ticker, automatic button removal at expiry, server revalidation at mutation, convergent Web authority and bounded diagnostics;
- remove **Giới thiệu / Quyền riêng tư / Điều khoản** from the authenticated Web business footer while retaining the public legal/OAuth routes and public login/recovery links.

Additional Owner-approved findings/refinements may be appended under the same D161 while implementation remains deferred. Before implementation, present the complete D161 backlog and let the Owner choose all or selected items. Stable remains OWNER-GATED.

### D161 Owner addendum — support logs, Agent UI performance and overtime UX — 2026-10-03

The Owner explicitly approved the previously reviewed unified support-log proposal and added two Agent requirements: eliminate progressive/wave rendering in History/Usage with canonical newest-first History behavior, and replace the existing pre-end overtime confirmation flow with the D161 sleep/extension state machine.

Canonical detail remains `docs/D161_APPROVED_BACKLOG.md`. The durable decisions are:
- Android logout immediately shows a blocking progress state and is single-flight; session-end log classification is not `scheduled`.
- Runtime logs archive under server-resolved `Inventory/Beta/Logs/YYYY-MM-DD` by actual Drive archive date in Asia/Ho_Chi_Minh; clients do not independently create/list daily folders.
- Android/Agent local evidence is pruned only after positive Drive synchronization. Intermediate Worker/Core/Firestore acceptance cannot delete the only local copy.
- Normal support logging is bounded and anti-spam: Android bounded local journal plus event/logout/final safety paths rather than four full periodic INFO uploads; Web bounded pending-error queue; Agent error/incident suppression and idempotent boundary sealing.
- Exact Agent logins `admin` and `tamnv2` alone may request a global support-log collection. Backend revalidates the identity; request-id/TTL/dedupe/jitter apply; only currently authenticated clients respond; already Drive-synced history is not re-uploaded; no per-device Firestore ACK write is introduced.
- Agent History/Usage must render atomically/batched with no visible row/label wave and no provider-cadence increase. History tab entry always restores authoritative `SentAtMs` descending order; temporary manual sort is discarded after leaving/re-entering the tab.
- D161 supersedes D154's end-of-day timing only where conflicting: normal shared replay end becomes **22:15 Asia/Ho_Chi_Minh**, with no pre-end Continue/Stop confirmation. At 22:15 without an active override the shared relay state is SLEEP and the Agent shows a red/white no-extension panel with **Gia hạn +1 giờ**.
- Sleeping extension starts at `min(now + 1h, 05:00)`; active extension adds one hour to authoritative `override_until`, capped at 05:00. Fifteen minutes before `override_until`, show one deduped warning with **Gia hạn +1 giờ / Không gia hạn**; no response means automatic sleep at the current deadline. Existing shared CAS authority, propagation, 05:00 cutoff and 05:00–05:45 early-start model remain.
- The schedule change is shared authority, not Agent-only presentation: later implementation must keep Agent, schedule propagation/enforcement, Android and Web consistent.
- This addendum is **requirements authority only**. D160 remains the accepted runtime base; no D161 implementation/build/release/deploy/provider mutation is authorized yet. Stable remains OWNER-GATED.

### D161 Owner clarification — business shift 06:00–22:00 versus Replay guard — 2026-10-03

The Owner clarified that the Replay timing approved in D161 is an internal operating margin, not the business shift definition.

- Human-facing **Ca bình thường** remains **06:00–22:00**.
- D161 Replay technical availability remains **05:45–22:15**, providing a 15-minute technical margin on both sides of the business shift.
- Web and other outward business surfaces must show 06:00–22:00 for the normal shift. They must not relabel 05:45–22:15 as the business shift.
- A technical diagnostic may expose 05:45–22:15 only when clearly labelled as the Replay technical window.
- Previously approved D161 overtime behavior still begins from Replay SLEEP at 22:15; this clarification changes presentation/semantic labeling, not the technical Replay boundary.
- D160 remains the accepted runtime base; D161 implementation remains deferred.

### D161 Owner approval — bulk kick and manual update lifecycle — 2026-10-03

The Owner approved adding the source-reviewed proposals to the D161 backlog, plus a permanent manual Android update-check control on the unauthenticated login screen.

- Agent gets a protected **Kích toàn bộ user** action for all currently authenticated Picker/PDA sessions. It is an exact-login **admin/tamnv2** operation, requires a destructive warning plus current Agent-password verification, is not affected by search filtering and must be implemented as one idempotent server-authoritative bulk revoke rather than N Agent-side per-user kick requests.
- The bulk operation targets Android Picker interactive sessions only. Server session-generation invalidation is authoritative; Firebase/FCM may accelerate logout but may not become the authority.
- Agent application updates become manual-only: remove startup and 30-minute auto checks; keep **Kiểm tra cập nhật** as the explicit user action and preserve the existing trusted/checksummed replace-and-restart installer after confirmation.
- Android update discovery is advisory for normal login. Temporary inability to contact/parse the update channel may warn but may not disable **ĐĂNG NHẬP**. Integrity failure of the currently installed APK remains fail-closed.
- Android update-check diagnostics must retain a sanitized stage/reason rather than collapsing every exception into one generic “không xác minh được” message.
- Login UI adds a professional **Phiên bản & cập nhật** row: current **Beta vcXX** plus visible **Kiểm tra cập nhật**. This button remains available before authentication and is the explicit recovery path when automatic discovery fails or misses an update.
- Login-screen auto-check is bounded and single-flight. New version → **Cập nhật / Để sau**; only **Cập nhật** downloads. Failure does not block login or retry in a tight loop.
- While authenticated, tapping the version first asks **Tìm kiếm bản cập nhật?**; Yes checks once and, if a newer trusted release exists, proceeds automatically through download/verify/install without a second download confirmation.
- After explicit user consent, Android automates download/checksum/package/version/signer validation and installer handoff as far as normal Android permissions allow. Full silent/MDM/Device-Owner/OEM privileged installation is not part of D161 and would require a separate Owner-approved resource/security workstream.
- No new provider, polling/listener cadence, Stable mutation or runtime implementation is authorized by this decision capture. D160 remains the accepted runtime base.

### D161 Owner approval — mandatory safety baseline and rescue contract — 2026-10-03

The Owner approved a mandatory forward-recovery model for D161.

- Exact command **`bắt đầu D161 tiến hành`** authorizes the complete then-current D161 implementation. The AI must first complete and PASS **Phase 0 Safety Baseline**, then automatically continue through the already-approved D161 backlog without asking the Owner to restate or reconfirm those items.
- Phase 0 captures the pre-D161 safe model: source/component identities, schema/health markers, Web reproducible build identity, Agent/APK release artifacts and hashes, release-channel manifests and non-secret resource/config references.
- Before D161 business changes, publish/verify monotonic safety releases of Android and Agent from the pre-D161 safe behavior. Exact version numbers are resolved at execution time.
- Web/Worker rescue is not a raw whole-deployment rollback. Web may return to Safety presentation while Worker/InventoryCore remains on a newer schema-compatible forward deployment.
- Until Owner acceptance, migrations must remain additive/backward-compatible where technically possible. Rescue must not blindly downgrade SQLite or delete new state.
- After D161 technical/runtime/release PASS, the Owner field-tests. In the explicit D161 field-test-ready state, **`ghi nhận ok`** or explicit **D161 PASS** records Owner acceptance and promotes D161 to the accepted base.
- Exact command **`quay lại bản backup ban đầu trước khi sửa code`** triggers rescue under the same D161: stop further feature rollout; restore Safety Web behavior; forward-repair backend behavior without unsafe schema downgrade; publish Android and Agent rescue versions with numbers higher than the failed D161 versions but Safety behavior; repoint trusted channels only after signature/checksum verification.
- A rescue restores safe operation first, preserves diagnostics, and does not create a new change ID. D161 repair may continue afterward.
- No secret, WMS session material, password, refresh token, signing material or sensitive runtime data may be copied into the public repository as part of the safety manifest.
- Stable is untouched/OWNER-GATED.

### D161 Owner approval — mandatory Phase 0A permission/provider preflight — 2026-10-03

The Owner approved a new hard gate before the existing D161 Safety Baseline so a large D161 implementation cannot progress and only later discover missing provider permissions.

- The exact D161 start command remains **`bắt đầu D161 tiến hành`**. After that command, execution order becomes: fresh authority bootstrap → **Phase 0A Permission & Provider Preflight PASS** → existing Phase 0 Safety Baseline PASS → D161 backlog implementation.
- No D161 business/runtime source mutation may begin while Phase 0A is not PASS.
- Phase 0A proves the actual Beta capabilities required by D161 across GitHub/release channels, Cloudflare deploy, Android signing, Agent release, Firebase/Firestore/Functions/FCM, Apps Script/Monitoring, current Google OAuth/runtime access, HR Sheets read, support-log Drive archive and the selected global-log control plane.
- The **HR Drive watch** path is a hard gate: the least-privilege chosen identity must resolve the verified HR file, create a bounded `files.watch` channel, receive the initial Google `sync` callback at the Beta Worker, prove replacement/renewal behavior without duplicate business processing, stop the superseded channel and clean up. The probe must not change HR rows.
- The **daily log folder** path is a hard gate: the trusted archive layer must prove create/resolve/upload/readback/cleanup for one disposable test child under the already scoped `Inventory/Beta/Logs` parent before D161 changes log lifecycle behavior.
- Prefer read-only/no-op proofs. A real write is permitted only when needed to prove capability, must be Beta-only, disposable, scoped to existing canonical resources, verified and cleaned up in the same preflight.
- Do not broaden Google OAuth scope merely for convenience. Use the minimum working identity/scope; a broader grant requires evidence that the narrower approved path cannot satisfy the required operation.
- If a real Owner-only consent/grant is unavoidable, collect all known missing grants first and request one shortest official Web-UI action; after completion, automatically rerun the affected/full Phase 0A matrix before proceeding.
- Protected secrets/signing material remain outside the public repository and diagnostics.
- Phase 0A is capability proof only. It does not itself authorize HR business mutation, fleet-wide log collection, bulk Picker revoke, schedule changes, Stable activity or any other D161 business behavior.
- D160 remains the accepted runtime base; D161 implementation remains deferred until the exact start command.



### D160 post-PASS diagnostic Agent candidate — Owner approved — 2026-10-03
The Owner explicitly approved a bounded **D160 post-PASS diagnostic candidate** to collect richer Windows Agent evidence before any WMS confirmation-behavior repair. This does not reopen or alter the D161 backlog.
- Accepted runtime base remains **D160 / relay-agent-v97** until a separate explicit Owner field PASS promotes a later candidate.
- Diagnostic candidate target is **relay-agent-v98** unless execution-time version resolution proves that number is already occupied; any actual candidate version must remain monotonic.
- Scope is **logging/telemetry only**. Existing D160 v97 business behavior for Search, real F5/Page.reload recovery, page-size handling, checkbox selection, bulk confirm, confirmation guard, 12-second mutation fence, HA, Firestore cadence, update cadence, Android beta-vc92 and all provider/runtime business semantics must remain unchanged.
- Candidate distribution is **manual-install only**. It may publish a dedicated prerelease/artifact but must **not update the trusted `inventory-channel` Agent manifest/assets** and must not cause fleet auto-update.
- Telemetry must capture bounded structured evidence needed to diagnose/optimize: WMS reload/page epoch and timing, page-size state, hydration/row counts, search/recovery timing and DOM-change hashes, exact-row/checkbox classifications without raw PickList values, batch/wave timing, confirm-dialog/final-click timing, terminal-surface lifecycle counts, same-row post-confirm marker classification, Firestore control/business error classification, HA/role-refresh reasons and relevant latency summaries.
- Logging must not add WMS/Firestore/Google polling, listeners, provider writes or business retries. Read-only DOM snapshots are allowed only at already-existing request/recovery boundaries and must not add another Confirm click.
- Never log full PickList codes/suffixes, passwords, tokens, cookies, WMS/Firebase/Google session material, authorization headers, private keys, signing material, raw HTML or screenshots. Existing sanitization remains mandatory and is strengthened for PickList-like values.
- Local log rotation/upload lifecycle remains D160 accepted behavior; no new Drive/Apps Script/Firestore resource or upload cadence is authorized.
- D161 remains **OWNER_APPROVED_REQUIREMENTS_CAPTURED__IMPLEMENTATION_DEFERRED** and is not edited by this diagnostic hotfix.
- If the diagnostic candidate is not accepted, relay-agent-v97 remains the runtime baseline. If it is accepted later, canonical accepted-artifact pointers must be reconciled before D161 implementation starts.


### D160 diagnostic Agent v98 technical release checkpoint — 2026-10-03
- PR #391 merged to `main` at `7c9270bb5f98d089ade3a05fa21b9c9838533d3a`.
- Main `Verify Beta Relay Agent` run `37090244165` PASS, including build, startup smoke, protected D160 regression guards, D146 log lifecycle guard and D102 schedule regression.
- Dedicated manual-only prerelease `relay-agent-v98` exists as release id `402285229`.
- Canonical EXE asset id `606990416`, size `7244288` bytes, SHA-256 `1d7902903311862af471b01f8b66ac9e7b309949eb65228cf6198afb987d2bad`.
- Trusted `inventory-channel` was intentionally not updated. Its Agent EXE asset remains id `604881360`, size `7216128` bytes, SHA-256 `b8f75d0f100cbb97493d140f39fd708df7002dc1a073eff6a4b7c346d12f4530`, exactly matching accepted `relay-agent-v97` asset id `604881289`.
- Main Repo Authority, Project State, UI/Android, D127 and D159 usage guards are PASS for the merged diagnostic source.
- This is **TECHNICAL / RELEASE PASS only**. Accepted runtime remains D160 / relay-agent-v97. OA092 now waits for Owner manual field test and sanitized diagnostic logs.
- D161 authority/backlog and its deferred implementation state remain unchanged. Android beta-vc92, Web/backend runtime behavior and Stable are unchanged.


### D160 post-PASS optimization test Agent candidate — Owner approved — 2026-10-03
The Owner explicitly approved a second bounded D160 post-PASS Agent candidate to test evidence-backed confirmation/Firestore/logging optimizations during the remainder of the shift before deciding what is promoted into D161.
- Accepted runtime and trusted update channel remain **D160 / relay-agent-v97**.
- Target candidate is **relay-agent-v99**, manual-install only, diagnostic/test use only; no fleet auto-update and no `inventory-channel` mutation.
- D161 remains unchanged and implementation-deferred. Results from the v99 field run are evidence only; D161 backlog is updated later only after end-of-shift analysis and explicit Owner decision.
- v98 diagnostic evidence established three authorized repair targets for v99:
  1. Preserve the existing fresh-success terminal fast path; when no authoritative fresh reject exists, allow **all exact target rows showing the same-row confirmed marker `Xác nhận lấy lại hàng` before the checkbox** to prove CONFIRMED after final click. For multi-target waves, every target must satisfy the exact-row marker proof. No second Confirm click, no added provider call and no added F5.
  2. Treat Firestore presence-control ACK HTTP 400 + canonical `FAILED_PRECONDITION` + update precondition as a **SUPERSEDED stale snapshot**, not business transport OFFLINE. Do not arm HA role refresh or retry the stale control snapshot; newer listener state remains authoritative.
  3. Keep successful `D160_DIAG TERMINAL result=CONFIRMED` in the complete local journal but do not seal/upload it as an immediate error bundle. UNCERTAIN/reject/real failure/crash behavior remains.
- The following evidence-backed v98 behaviors are deliberately preserved for the v99 test: Search-before-F5 for missing/unselectable rows, FOREIGN_SELECTION hard-reload safety, 12-second mutation fence, exact-match/ambiguity guards, one final business click only, page-size=100 restoration after reload, no periodic WMS refresh, no intentional batching delay.
- Persistent NOT_FOUND timeout tuning is **not changed in v99** because the current sample is insufficient; continue measuring it.
- Telemetry remains enabled and redacted so end-of-shift comparison can quantify CONFIRMED/UNCERTAIN/CONFLICT/NOT_FOUND, terminal proof route, Search/F5 recovery, latency, Firestore control supersession, HA refresh, log upload volume and any regression.
- Android beta-vc92, Web/backend business runtime, provider resources, schema and Stable remain unchanged.


### D160 optimization test Agent v99 technical release checkpoint — 2026-10-03
- PR #393 merged to `main` at `ef403ded346d4d25875b57db2413ffc914e1c921`.
- Main `Verify Beta Relay Agent` run `37100883906` PASS; Repo Authority, Project State, UI/Android, D127 and D159 usage guards also PASS.
- Dedicated manual-only prerelease `relay-agent-v99` exists as release id `402351882`.
- Canonical EXE asset id `607236270`, size `7248896` bytes, SHA-256 `38ad765453299649a8373d6b6c02c4c26a72b58b435b4f358f7276f1a8cd36b0`.
- Trusted `inventory-channel` remains exact accepted relay-agent-v97 Agent identity: size `7216128` bytes and SHA-256 `b8f75d0f100cbb97493d140f39fd708df7002dc1a073eff6a4b7c346d12f4530`, matching relay-agent-v97 asset id `604881289`.
- This is **TECHNICAL / RELEASE PASS only**. v99 is manual field-test candidate; accepted runtime/channel remain relay-agent-v97.
- OA093 now waits for Owner end-of-shift field run and sanitized logs. D161 remains unchanged and implementation-deferred until later evidence review + explicit Owner decision.


### D160 post-PASS optimization test Agent v100 — Owner approved — 2026-10-03
The Owner reviewed the v99 field evidence and explicitly directed that the v99 repairs which proved correct remain unchanged while the next D160 manual candidate focuses only on remaining latency/recovery defects.
- relay-agent-v97 remains the accepted runtime and trusted inventory-channel target. v99 evidence is accepted for the three bounded optimizations only; v99 is not promoted fleet-wide by this decision.
- Freeze the v99-proven behavior: same-row `Xác nhận lấy lại hàng` terminal fallback, presence FAILED_PRECONDITION→SUPERSEDED handling, and suppression of immediate error-bundle sealing for successful terminal diagnostics.
- Target candidate is **relay-agent-v100**, manual-install test only. No inventory-channel update, Android/Web/backend/provider/schema/Stable mutation and no D161 implementation.
- v100 may change only the remaining evidence-backed areas:
  1. Checkbox/Search recovery reload keeps the existing real Page.reload and fail-closed semantics, but the 4.5-second soft wait may extend by at most 3.5 seconds only when the reloaded document is already on the exact Confirm route, navigation type is `reload`, and the document has loaded. The 12-second mutation-start fence still decides whether any WMS final click may occur after recovery.
  2. Post-final terminal observation remains passive and one-click-only. Its bounded wait may use up to 5.2 seconds when the existing end-to-end budget allows; no Search, F5, provider retry or second Confirm click is permitted after the final business click.
  3. Add local redacted timing telemetry separating Firestore-created/client age at transport handoff, handler-to-browser gate delay, search/classification timing and the terminal budget actually granted. No provider operation is added.
- Persistent NOT_FOUND tuning remains deferred because the sample is still insufficient.
- Existing exact-match/ambiguity guards, FOREIGN_SELECTION recovery, max-15 semantics, page-size restoration, confirmation guards, HA/failover authority, Firestore cadence and successful fast path remain unchanged.


### D160 optimization test Agent v100 technical release checkpoint — 2026-10-03
- PR #395 merged to `main` at `7216aa74cd7e07ce233c8e377104bcb400997798`.
- Main `Verify Beta Relay Agent` run `37118152206` PASS; Repo Authority, Project State, UI, D127 and D159 main guards also PASS.
- Dedicated manual-only prerelease `relay-agent-v100` exists as release id `402469781`.
- Canonical EXE asset id `607659111`, size `7266816` bytes, SHA-256 `4e7030854b00fdc42679e8713ca5727d451fe51e55193c6532a3831c9b2f5497`.
- Trusted `inventory-channel` remains the accepted relay-agent-v97 identity: release id `394587029`, Agent EXE asset id `604881360`, size `7216128`, SHA-256 `b8f75d0f100cbb97493d140f39fd708df7002dc1a073eff6a4b7c346d12f4530`.
- This is TECHNICAL / RELEASE PASS only. v100 is manual field-test evidence; accepted runtime remains relay-agent-v97. OA094 waits for Owner field run and sanitized logs.
- Android beta-vc92, Web/backend business runtime, provider resources, D161 implementation state and Stable are unchanged.

## D160 closure and D161 PickList-confirm carry-forward — Owner approved — 2026-10-03

The Owner explicitly closes all D160 post-PASS Agent testing. **D160 is complete and closed on the accepted relay-agent-v97 runtime.** The manual-only v98/v99/v100 candidates are evidence artifacts only and are not promoted to the trusted `inventory-channel`. No further D160 test build is authorized.

The Owner also approves carrying the evidence-backed PickList-confirm improvements into the existing D161 backlog. This is D161 requirements authority only; it is **not** the exact D161 start command and does not authorize Phase 0A, Phase 0, source mutation, build, release, deploy or provider mutation yet.

D161 must inherit the proven v99 behavior:
- after the one final business click, when there is no authoritative fresh reject, the exact same-row `Xác nhận lấy lại hàng` confirmed marker may prove CONFIRMED only when **every exact target row** satisfies the marker proof; never issue a second Confirm click;
- Firestore presence-control HTTP 400 + canonical `FAILED_PRECONDITION` caused by an update precondition is `SUPERSEDED`, not business transport OFFLINE, and must not arm HA refresh/retry of the stale snapshot;
- successful terminal diagnostics remain in the complete local journal but do not immediately seal/upload an error bundle.

D161 must also inherit the v100 confirmation/recovery behavior that remained safe under field evidence:
- checkbox recovery uses the real WMS Page.reload path and remains pre-final/fail-closed; the 4.5-second soft wait may use the existing progress-gated extension of at most 3.5 seconds, while the 12-second mutation-start fence remains authoritative;
- after the final business click, terminal observation is passive and one-click-only, with a bounded wait up to 5.2 seconds when the existing end-to-end budget permits; no Search, F5, provider retry or second Confirm click occurs after the final click;
- retain bounded local queue/mutation/terminal timing telemetry without adding provider operations or cadence.

The Owner approves two final D161 recovery refinements from v100 field evidence:
1. **Reload/recovery readiness must include page-size restoration.** After any successful recovery/reload barrier, restore and verify `page_size=100` before the browser is considered operational-ready for the next business request.
2. **Any successful reload resets the D157 secondary 2-hour idle-reload clock.** Recovery/manual/scheduled successful reloads all count. A D157 secondary idle check must not issue another F5 until at least two hours have elapsed since the latest successful reload and the Agent is idle.

A request that reaches the existing safety fence still fails closed; late browser self-heal may prepare the browser for the next request but must never authorize a post-fence click for the old request. Persistent NOT_FOUND timeout tuning remains deferred until stronger evidence exists.

The trusted D160 runtime is therefore explicitly **relay-agent-v97**. The active Agent source baseline is also restored to the accepted v97 source identity (`4c3f0a4dffc94f66237d0958032fd27ac52fed29`) before D161 starts; v98/v99/v100 test-only Agent source and diagnostic release guards are removed from the active baseline while their evidence remains in GitHub history/backlog. The first official D161 Agent runtime build is designated **v98**, resuming the official runtime lineage from accepted v97. Existing manual-only historical prerelease tags `relay-agent-v98`, `relay-agent-v99` and `relay-agent-v100` do not become trusted runtime versions; D161 publication must avoid overwriting historical evidence while exposing official runtime version v98 through the trusted release/channel contract.

The exact implementation trigger remains **`bắt đầu D161 tiến hành`**. Until that exact command is received, D161 remains implementation-deferred and Stable remains OWNER-GATED.

### D161 Owner addendum — complete PickList confirm regression contract + Observability/Support Log v2 — 2026-10-03

The Owner approved adding the full post-D160 PickList-confirm optimization review into D161 and redesigning Web/Android/Agent logs to collect the information needed for diagnosis, optimization and fault isolation while excluding sensitive/security material.

#### PickList confirm
D161 must preserve the accepted v97 safety/idempotency model and reapply the proven v99/v100 behavior, while also making the following previously implicit/identified requirements explicit:

- immediate local DOM scan must isolate FAST READY requests before slow Search/recovery;
- mixed-batch classification is per request, so one ambiguous request cannot suppress Search for another missing/unselectable request;
- already-terminal outcomes durable-ACK before deferred recovery;
- deferred recovery is shared/bounded, never one F5 per request;
- max 15 is a ceiling, not a reason to delay a request waiting for a fuller batch;
- listener/REST/batch/recent-terminal/same-PickList dedupe and confirmation-guard idempotency remain;
- role/generation fencing remains immediately before WMS mutation;
- the 12-second mutation fence is rechecked close to the real mutation path and remains subordinate to the original ≤20s request budget;
- zero/unhydrated WMS table is technical unavailable, never a true NOT_FOUND strike;
- WMS health proof requires hydrated/valid evidence rather than a responsive shell;
- shared schedule/control-plane availability is distinguished from temporary WMS mutation readiness;
- Firestore/HA errors log canonical operation/precondition/generation classification so stale/superseded writes do not become false transport failures;
- mixed-batch and burst regression fixtures, including 20 PDA / 5 seconds, are mandatory.

D161 may measure post-terminal cleanup and rate-limit critical-path cost and optimize them only when telemetry proves material latency and the accepted safety/anti-spam contract remains intact.

The v100 reload-extension description is clarified: at the 4.5s soft boundary the field-tested extension gate is exact Confirm route + loaded page/document + navigation type `reload`. Progress/hydration counters remain diagnostic evidence but are not silently promoted into an untested stricter gate.

#### Observability/Support Log v2
Canonical design is `docs/specs/OBSERVABILITY_LOGGING.md`.

The Owner requires a unified structured event model across Web, Android and Agent with cross-platform trace IDs, per-journal sequence/gap accounting, critical-stage latency, lifecycle/auth/network/API/realtime/business/HA/WMS/update/logging evidence, and bounded local journals. Recording events must not create per-event provider writes or new polling.

Sensitive/security data remains excluded, including credentials/tokens/cookies/private keys/signing/session material, raw WMS session data, raw HTML/screenshots, HTTP bodies/query values and raw PickList code/suffix. Redaction is required on both client and trusted server/archive layers.

Existing D161 daily Drive folders, Drive-confirmed local prune, bounded upload/debounce, and authorized global log collection remain. A global support request ID becomes the common trace ID in all responding Web/Android/Agent bundles.

This addendum is requirements/authority only. It does not start D161 implementation. The exact implementation trigger remains **`bắt đầu D161 tiến hành`**, followed by Phase 0A → Phase 0 Safety → implementation. Stable remains OWNER-GATED.

### D161 Owner addendum — PickList History shows processing Agent user — 2026-10-03

The Owner requires **Lịch sử Picker xác nhận PickList** to add a visible column **User Agent xử lý**.

- The value is the authenticated Agent username that actually owns the terminal processing/durable ACK, e.g. `tamnv2`, `admin`, `dienhx`.
- Prefer the terminal Agent session `LoginName`; use `AppUserId` only as fallback. Do not substitute Firebase UID, machine name or Picker identity.
- If a pending local row already has a provisional processor, the terminal outcome must converge/overwrite to the user that actually produced the durable ACK.
- The identity is carried in the **same existing confirmation ACK operation** and in the existing compact History payload that piggybacks only when the existing counter-driven `agent_sync` mutation already occurs.
- This requirement adds **zero extra Firestore document read/write/listener/poll cadence** and creates no history-only provider mutation.
- Local History JSON, fleet merge and UI rendering retain the field; canonical History sort remains full `SentAtMs` newest-first.

This is D161 authority/backlog only and does not start runtime implementation. Exact start remains **`bắt đầu D161 tiến hành`**.



## D161 Owner approval — integrity/convergence hardening after full-log review — 2026-10-04

Status: **OWNER APPROVED — PART OF D161 / IMPLEMENTATION STILL CONTROLLED BY EXISTING EXACT START GATE**.

After review of the consolidated D161 authority plus 2026-10-03 Web/Android/Agent logs, the Owner approved adding the following to the same D161 backlog:

- distinguish Phase 0 Safety Agent release from feature-bearing D161 Agent release; feature Agent must be strictly newer than the resolved Safety build, with historical D160 manual v98/v99/v100 remaining immutable evidence;
- HR snapshot revision/fingerprint, stale-proposal revalidation, whole-snapshot atomicity and precedence HARD_BLOCK > CONFIRM_REQUIRED > AUTO;
- monotonic revision/generation for authoritative shortage_reporting_enabled;
- cross-platform support-log bundle_id/boundary idempotency at trusted archive, including Android logout and Web scheduled-slot dedupe;
- same-version agent_sync no-op for rebuild/persist/repaint, with same-version/different-content treated as a consistency anomaly;
- canonical observability severity semantics so success and expected superseded/transient states do not become immediate error bundles;
- PickList confirm trace-completeness terminal classes and non-mutating TRACE_GAP_DETECTED;
- Web reload-surviving diagnostic journal isolation by authenticated session generation;
- one immediate idempotent overtime warning when a newly created boundary is already inside its T-15 window near the 05:00 hard cutoff.

These refinements add no provider polling/listener cadence, no new persistent provider resource and no Stable mutation. D160/Agent v97 remains accepted until D161 passes its existing implementation/field gates.


## D161 implementation start authorization — 2026-10-04

Status: **OWNER COMMAND RECEIVED / PHASE 0A ACTIVE**.

The Owner issued the exact previously-gated command:

`bắt đầu D161 tiến hành`

This authorizes the complete then-current D161 backlog to proceed automatically under the existing sequence and safety constraints:

1. fresh GitHub authority bootstrap;
2. **Phase 0A Permission & Provider Preflight PASS** before any D161 business/runtime source mutation or Safety release;
3. **Phase 0 Safety Baseline PASS** before feature-bearing D161 runtime implementation;
4. then continue the complete approved D161 backlog under branch → PR → authority/continuity PASS → merge until field-ready or a genuine Owner-only blocker.

Live release reconciliation at start found historical immutable Agent test tags v98/v99/v100 while accepted runtime remains v97. Therefore the first monotonic **Safety Agent is v101** and the first feature-bearing D161 Agent must be **v102 or later**. Android accepted release is vc92, so the first Safety Android is **vc93** and the first feature-bearing D161 Android is **vc94 or later**, unless a newer release is introduced and authority is reconciled before publication.

Stable remains OWNER-GATED and untouched. The D160 accepted runtime remains the rescue/base behavior until D161 is explicitly field-accepted.


## D161 Phase 0 Safety PASS checkpoint — 2026-10-04

The mandatory pre-feature gates are complete. Phase 0A Permission & Provider Preflight is PASS and Phase 0 Safety Baseline is PASS. Final Safety evidence is main `6702b0aabc807954d6427e7e3aa6442134cb95e3`, main Safety run `37170577529` PASS and UI Design Guard run `37170513921` PASS. Safety artifacts are Android `beta-vc93` and Agent `relay-agent-v101`, both preserving the pre-D161 behavior and verified through the trusted Beta release/channel contracts.

The already-recorded Owner start authorization therefore advances D161 automatically into the complete approved feature backlog. No new Owner reconfirmation is required for already-approved D161 items. D160 behavior remains the accepted/rescue base until D161 reaches field-ready state and the Owner explicitly records acceptance. Stable remains OWNER-GATED and untouched.


## D161 Owner field-repair decision — 2026-10-04

Owner field test of the D161 Beta candidate found three defects and explicitly authorized repair within D161:

1. **Schedule presentation:** outward business-shift UI must show **06:00–22:00**. The technical Replay guard is separate and, when shown, must be labelled **Cửa sổ kỹ thuật Replay · 05:45–22:15**. Obsolete 22:30 copy is forbidden. Runtime 22:15 enforcement remains unchanged.
2. **HR HARD_BLOCK diagnostics:** a blocked HR snapshot must explain the concrete safe reason. For invalid rows, Web shows bounded row numbers plus non-sensitive validation reasons and a bounded **Kiểm tra lại nguồn** action. HARD_BLOCK remains fail-closed and cannot be force-applied. For `CONFIRM_REQUIRED`, Web presents explicit **Có · Áp dụng** / **Không · Giữ nguyên** choices; **Không** performs no mutation and leaves the proposal pending for a later decision.
3. **Agent active-Picker observation:** after Agent authentication, **Picker đang hoạt động trên PDA** remains visible and synchronized even when Web Confirm/WMS is not ready and even outside the business-processing window. Only an unauthenticated Agent hides the list. PickList mutation/PRIMARY processing remains gated by WMS readiness and schedule authority. The repair reuses one existing Agent-sync gRPC listener stream and observes exactly two existing documents on that stream: `relay_poc_coordination/agent_sync` plus authoritative `picker_presence_projection/current`. It adds no collection query, per-Picker listener, polling loop or write cadence.

Impact approved by Owner: Beta Web/Worker/Android/Agent plus existing compact Agent-sync listener semantics. Web release increments to **Version 2**; Agent candidate increments to **v105**; Android source change requires the next monotonic Beta APK (expected **vc97** if no intervening release). Stable remains OWNER-GATED and untouched.

## D161 Owner field-retest repair — bulk revoke / WMS-not-ready History / Usage — 2026-10-04

Status: **OWNER REPORTED FAIL — REPAIR AUTHORIZED WITHIN THE SAME D161 CHANGE ID**.

The Owner field-tested Agent v105 with Android vc97 and reported three additional defects:

1. **Bulk Picker revoke:** **Kích toàn bộ user** fails although revoking one Picker can still complete its local session-generation path. Agent-authenticated Worker endpoints must accept the dedicated Agent Firebase identity without weakening WEB/ANDROID interactive-session authority. The privileged bulk action remains limited to the existing authorized Agent users and keeps its confirmation/password guard.
2. **PickList request History while Web Confirm is not ready:** once an authenticated Agent receives a PDA request, WMS/browser readiness must not suppress request ingress, History creation or an explicit terminal result. If Web Confirm is still preparing/not ready, the request must terminate without any WMS mutation as **WMS_SESSION_REQUIRED / Web Agent chưa sẵn sàng**, be visible in **Lịch sử Picker xác nhận PickList**, and return the explicit reason to the PDA instead of timing out with blank Agent history. Existing schedule authority, PRIMARY/generation fencing and all WMS mutation safety gates remain.
3. **Usage:** Agent must accept the currently deployed authenticated Usage gateway revision **D161-GW-v2** while retaining legacy **D160-GW-v1** compatibility and exact service/project identity checks. Arbitrary gateway revisions remain rejected.

Implementation lineage for this repair is **Agent v106**. Android **vc97 remains unchanged** because the timeout/blank-history defect is on Agent ingress/terminal handling, not the Android request contract. Beta Worker/Agent may change; Stable remains OWNER-GATED and untouched. No new persistent provider resource, polling loop, collection query or write cadence is authorized.

## D161 v106 field-retest NOT PASS — Agent-only WMS-not-ready History repair — 2026-10-04

Status: **OWNER AUTHORIZED REPAIR WITHIN D161 — AGENT ONLY**.

Owner field retest of Agent v106 + Android vc97 confirmed that the PDA request can be sent while Agent History remains blank when Web Confirm is not ready. This means the second D161 repair did not satisfy the approved WMS-not-ready History contract.

Canonical diagnosis:
- Android vc97 request creation/transport contract is unchanged and does not require repair.
- Agent v106 already keeps the authenticated transport alive and may hold a degraded PRIMARY receiver role.
- However, `FirestoreConfirmationTransport` still called the strict `VerifyPrimaryBeforeMutation` fence **before** entering `D160ConfirmPipeline`.
- That strict fence correctly requires WMS-ready, so a not-ready browser returned before `RecordD160PickerHistoryRequest` could run. The PDA request therefore had no Agent History row and no explicit `WMS_SESSION_REQUIRED` terminal response.
- Actual WMS safety must remain fail-closed: WMS-ready + current PRIMARY/generation are still mandatory immediately before any WMS mutation.

Approved repair:
1. Add a separate PRIMARY/generation **business-ingress fence** that does not depend on WMS readiness.
2. Use that ingress fence only before D160 request/history processing.
3. Preserve the existing strict `VerifyPrimaryBeforeMutation` check inside the WMS mutation path.
4. When Web Confirm is not ready, D160 must create History and terminal `WMS_SESSION_REQUIRED / Web Agent chưa sẵn sàng`, ACK it to the PDA, and perform zero WMS mutation.
5. Add a regression guard proving the transport no longer uses the mutation fence as a pre-pipeline ingress gate.
6. Repair lineage is **relay-agent-v107**. Android remains **beta-vc97 unchanged**. No Worker or Stable change is required for this defect.


## D161 v108 fourth field repair — Owner approved 2026-10-04

- Owner field evidence makes relay-agent-v107 **NOT PASS** for the Web-Confirm-not-ready History case. The lower pre-pipeline ingress fence was repaired in v107, but `StartListening()` and `IsBusinessAllowed()` still re-coupled authenticated relay ingress to `HasOperationalReadiness()` / WMS readiness.
- Repair remains **inside D161**. Android is hard-locked at **beta-vc97** for this repair; Worker/Web/Stable are unchanged.
- `StartListening()` must require an authenticated Agent session, not WMS readiness. `IsBusinessAllowed()` must represent Agent-authenticated Replay schedule authority only. WMS readiness remains mandatory only at the protected pre-mutation fence immediately before Search/checkbox/Confirm mutation.
- Usage optimization is accepted with a fail-safe condition: **zero active PDA + healthy D157 pending realtime listener => suppress the redundant REST pending-queue query**. Listener-delivered requests must still enter the canonical D160 pipeline immediately. If the realtime listener disconnects, the existing 15-second REST fallback resumes automatically.
- Existing active cadence is preserved: PDA active 3s, listener-degraded resilience 2s within the existing budget, burst HOT 1s. No new provider timer, query family, collection, listener, write, heartbeat or Android change is authorized.
- A local-only wake on Picker presence transition `0 -> active` is allowed to remove the login/first-request race. This wake performs no provider read/write. Realtime connect/disconnect transitions also wake the local transport so fallback changes take effect promptly.
- Actual PickList request evidence outranks cached PDA count: a listener-delivered PENDING request must never be discarded merely because local presence count is zero.
- Target Agent release is monotonic **relay-agent-v108**. D160 relay-agent-v97 remains the accepted rescue base until explicit Owner D161 PASS.

## D161 fifth field repair — single Kích User server-authority convergence — Owner approved 2026-10-04

Status: **OWNER APPROVED REPAIR WITHIN D161 — ANDROID VC97 HARD-LOCKED**.

The Owner reported that per-row **Kích User** could leave a PDA covered by a non-dismissible specialist-style overlay while **Kích toàn bộ user** did not reproduce the problem. Canonical source review found that the single-revoke InventoryCore path still emitted the D144 backward-compatibility FCM as `picker_command / CALL_SPECIALIST`. Android beta-vc97 correctly interprets that event as the existing locked specialist-call overlay, so the revoke path itself was injecting an unrelated presentation command.

The Owner explicitly approved an Android-free repair:

- keep **beta-vc97 unchanged**; this repair is not an Android bug-fix release;
- per-row **Kích User** uses one bounded idempotent `request_id` and the same server-generation authority principle as D161 bulk revoke, but targets exactly one authenticated Android Picker session;
- InventoryCore commits the authoritative Android generation revoke first, clears Android device/session authority, disables the old Android notification target and removes presence;
- only after authoritative revoke succeeds may Worker publish the existing `picker_session_controls/<firebase_uid>.revoked_generation` fence so beta-vc97 returns to login immediately;
- session revocation must **never** be encoded as `picker_command`, `CALL_SPECIALIST` or any other specialist/chat/result overlay event;
- Agent removes the Picker from its compact fleet state only after the server command returns the authoritative revoked generation;
- a bounded retry must reuse the same request id so response loss or a transient post-authority session-signal failure cannot revoke a newer generation twice;
- existing two-step per-row confirmation and existing single-kick ADMIN/PICKPACK_ADMIN authority remain unchanged;
- no new collection, listener, poll, heartbeat, provider resource or Stable mutation is introduced. Existing Worker/InventoryCore/Firestore session-control resources are reused.

Target repair Agent is **relay-agent-v109**. D160 relay-agent-v97 remains the accepted/rescue base until explicit D161 Owner PASS.



## D161 sixth field repair — overtime activation + explicit empty PickList readiness — 2026-10-04

Owner field retest after Agent v109 found three related Agent-only defects and approved repair under the same D161 change.

- The outside-hours warning panel must keep its red/white warning presentation while always laying out the currently available action button(s) inside the visible panel. In the normal sleeping state, **Gia hạn +1 giờ** must be visible and usable; resize/auto-size must not hide it behind the status label.
- Overtime extension and the 05:00–05:45 early-start schedule action are **schedule/control-plane decisions** and must not depend on Web Confirm/WMS PickList readiness. An authenticated Agent may activate/extend the shared relay schedule even when the Confirm page has no current PickList.
- A Confirm page that has the expected controls/table structure and explicitly displays **Không tìm thấy kết quả phù hợp** is a hydrated empty state, not a broken/unready WMS session. It is represented as `READY_EMPTY` and shown to the user as **Web Agent chưa có PickList**.
- A truly blank or partially hydrated Confirm shell without the explicit no-results marker remains fail-closed and is not promoted to ready.
- When a PDA PickList arrives while the browser is in `READY_EMPTY`, Agent must run the existing normal Search/recovery/confirm pipeline. The empty-at-idle state must not cause an immediate WMS-not-ready terminal solely because there were no PickLists before the request.
- Existing pre-mutation safety remains mandatory: actual WMS checkbox/Confirm mutation still requires current PRIMARY/generation authority and operational browser readiness at the mutation fence.
- Scope is Windows Agent only. Android remains beta-vc97; Worker/Web/Stable are unchanged. No new provider resource, collection, listener, query, polling loop, heartbeat or write cadence is authorized.
- Target repair release is **relay-agent-v110**. D160 relay-agent-v97 remains the accepted/rescue base until explicit Owner PASS for D161.


## D161 seventh field repair — Picker presence realtime convergence — 2026-10-04

Owner field testing after Agent v110 found that an Android Picker could remain visible in the Agent active-Picker list after self logout or **Kích User** even though session authority had already ended/revoked. The Owner approved repair under the existing D161 gate.

- The active-Picker list continues to mean **authenticated Android Picker sessions**, not device-power/heartbeat state.
- Reuse only the existing event-driven paths: the authenticated Agent exact-document stream for `relay_poc_coordination/agent_sync` + `picker_presence_projection/current`, plus the already-existing presence control event. Do **not** add a listener, query, polling loop, heartbeat, timer cadence or provider resource.
- After authoritative per-row **Kích User** succeeds, Agent removes that exact Picker generation from local RAM/UI immediately; it must not wait for another provider event. Existing server revoke and existing `agent_sync` mutation remain unchanged.
- After authoritative **Kích toàn bộ user** succeeds, Agent removes only the session generations captured when the command was issued so a legitimate newer login that races the response is not hidden.
- Agent keeps a RAM-only `user_id -> removed/revoked generation` tombstone. Delayed direct-presence, PickList fallback or `agent_sync` data at the same/older generation is ignored. A strictly newer legitimate session generation clears the tombstone automatically.
- Direct `picker_presence_projection/current` remains the primary complete login/logout view. Existing `agent_sync` presence deltas are allowed to converge the UI as a second already-paid event path instead of being permanently ignored after the first direct-presence observation.
- Unrelated `agent_sync` mutations such as history/counters/call locks must not repaint Picker presence. Only an actual `agent_sync` presence delta participates in fallback convergence.
- Android stays **beta-vc97**; Worker/Web/Stable are unchanged for this repair. No extra normal-path Desktop/provider usage is authorized.
- Target repair release is **relay-agent-v111**. D160 relay-agent-v97 remains the accepted/rescue base until explicit D161 Owner PASS.

## D161 eighth field repair — successful WMS confirm but terminal ACK rejected — 2026-10-05

Status: **OWNER APPROVED REPAIR WITHIN D161 — NO APK CHANGE**.

Owner field evidence on Agent v111 + Android beta-vc97 shows a PickList request can reach the Agent, be confirmed successfully on the WMS page, and still time out on the PDA after about 20 seconds because the terminal Firestore ACK is not committed.

- Android beta-vc97 request creation and timeout contract are unchanged and are not the defect. **Do not rebuild the APK for this repair.**
- D161 Tranche B added `agent_login_name` to confirmation/presence ACK payloads so PickList History can display **User Agent xử lý**. The current `relay_poc_jobs` Firestore update allowlist did not include that field, so the ACK update is rejected with `PERMISSION_DENIED`.
- Because the terminal ACK is rejected, the request remains `PENDING`, may be discovered again after WMS has already confirmed it, and the PDA eventually reports its existing timeout even though the business mutation succeeded.
- The Agent WebException path also disposed the `HttpWebResponse` before the outer diagnostic layer logged it. That converted the useful Firestore 403 evidence into `ObjectDisposedException` and obscured the root cause.
- Repair scope is **relay-agent-v112 + the existing Beta Firestore Rules only**. Add `agent_login_name` as a bounded optional ACK field to preserve compatibility with older Agent ACKs, preserve the original WebException response until it is diagnosed when rethrowing, and make Firestore error description non-throwing.
- CI must verify the Agent ACK payload and Firestore Rules allowlist evolve together so a future new ACK field cannot silently break terminal delivery after a successful WMS mutation.
- No WMS confirm semantics, Android behavior, Web, Worker business logic, provider resource, listener/query family, polling/heartbeat or normal write cadence changes are authorized.
- Stable remains OWNER-GATED and untouched. D160 relay-agent-v97 remains the accepted/rescue base until explicit D161 Owner PASS.

## 2026-10-05 — D161 v113 support-log UI repair

- Owner approved moving the existing Agent global support-log command to the visible `Cài đặt → Logs` card because its previous host page was not reachable from the live tab set.
- The command remains visible only for Agent login `admin` or `tamnv2`; its existing confirmation and server-side control flow remain unchanged.
- Agent-only UI/build repair. Android vc97, Web, Worker, provider cadence and Stable are unchanged.



## D161 Owner field acceptance — PASS — 2026-10-05

Status: **OWNER FIELD ACCEPTED PASS — D161 CLOSED**.

The Owner explicitly instructed to close D161 as done after the D161 v113 Agent repair was merged and released. This promotes D161 to the accepted project base and unlocks the next serial change.

Accepted runtime/release evidence:
- canonical main: `a246412fc747e04ca99dcef785333bd38925d9b2` (PR #445 merged);
- Windows Agent: **relay-agent-v113**, release id `403819430`, asset id `612827259`, SHA-256 `f474abb09883ec1c9413f26b22fa8f16e2789467696bae5dda3312151296d87d`;
- Agent verification run `37326091818` PASS;
- Repo Authority run `37326091751` PASS and Continuity run `37326091618` PASS;
- Android remains **beta-vc97 unchanged**;
- Web remains D161 Version 2; Stable remains **OWNER-GATED and untouched**.

No new persistent provider resource is introduced by this acceptance record. D161 owner action OA096 is closed PASS. The next change may be opened only from this accepted D161 base.


## D162 usage efficiency and transport simplification — Owner approved — 2026-10-05

Status: **OWNER APPROVED IMPLEMENTATION — BETA ONLY — ANDROID/APK HARD-LOCKED**.

The Owner approved opening D162 immediately after D161 PASS to reduce abnormal Cloudflare Durable Objects and Firestore usage without reducing current speed, realtime behavior, business correctness or operational stability.

Preimplementation review:
- **base impact:** D162 starts from accepted D161 main `c3791eeae1295020d75be32002e52dc448a5d23e`; all D161 business behavior is preserved unless an internal transport/read-amplification path is explicitly replaced with an equivalent lower-cost path.
- **affected components:** Beta Service/Worker + InventoryCore Durable Object, Web realtime refresh orchestration, Windows Agent Firestore transport/presence convergence, regression/usage tests and canonical authority.
- **regression/stability risk:** medium because hot-path transport is changing; mitigation is listener-first with immediate degraded fallback, server-authoritative session checks inside InventoryCore, full reconcile after stream gaps, unchanged WMS mutation fences and no Android contract change.
- **resource/quota/security impact:** no new persistent resource, collection, secret, listener family, polling family or heartbeat. Existing Beta Cloudflare/Firestore resources only. Authentication remains verified Firebase ID token + authoritative session-generation validation. Stable is untouched.
- **recommended approach:** remove redundant per-request Operational V2 readiness DO calls; collapse high-volume authorized read/receipt paths to one DO invocation where safe; make Web refresh only scopes changed by realtime; make Agent realtime listener the normal fast path with REST reads as watchdog/degraded fallback; remove presence ACK writes only if repository-wide evidence proves no consumer depends on them; aggregate 4xx telemetry instead of per-request error logging.

Hard invariants:
- Android remains **beta-vc97 unchanged**: no Android source edit, APK build, version bump or release.
- WMS browser mutation safety, PRIMARY/generation fences, D161 confirm behavior and 20-second outer contract remain unchanged.
- Normal-path latency must be no worse than D161 and should improve where duplicate reads are removed.
- Full state reconciliation remains mandatory on realtime gap/reconnect or integrity uncertainty.
- Stable remains **OWNER-GATED and untouched**.

## 2026-10-06 — D162 realtime badge lazy-queue repair — Owner approved

- Owner reported that D162's queue/recent separation reduced realtime feel because the operational badge still depended on refreshing queue data.
- Approved same-D162 repair: the **Xử lý báo hàng** badge remains realtime, while the full Reporter queue is fetched only when the Operations surface is visible.
- Queue-count changes piggyback on existing realtime event metadata as bounded `queue_delta` values. No polling, listener family, heartbeat, database/resource or new provider write cadence is introduced.
- When the badge has no trusted baseline or realtime continuity is dirty/gapped, Web performs one authoritative lightweight queue-count reconciliation; it must not fetch the full off-screen queue merely to repair the badge.
- The Results surface loads recent-result data only. The Operations surface loads queue data only. A normal off-screen `reporter_queue` event updates the badge from realtime metadata without a queue API read.
- Missing/legacy queue-delta metadata fails closed to the lightweight count reconciliation. Realtime gaps/reconnects also reconcile the count authoritatively.
- Windows Agent remains **relay-agent-v114 unchanged**, Android remains **beta-vc97 unchanged**, and Stable remains **OWNER-GATED and untouched**.

## 2026-10-06 — D162 workspace tab realtime counter repair — Owner approved

- Field review found the two visible Web workspace counts **Đang xử lý** and **Kết quả gần đây** were still derived from loaded list state (`queueRows.length` / `recentTotal`) and therefore changed only after the corresponding tab loaded.
- This is a same-D162 NOT-PASS repair, not a new change ID.
- Both workspace counts must update immediately from the existing realtime event stream without polling and without loading an off-screen list.
- Normal realtime events carry only bounded counter metadata already known by the committed mutation: pending queue uses `queue_delta`; recent results use a before/after `recent_counter` transition so current date/status filters can be updated correctly.
- F5/login/reconnect/gap may perform one authoritative lightweight Reporter-counter reconciliation for both numbers. That reconciliation must not load either full list.
- Full **Đang xử lý** rows are read only when Operations is visible. Full **Kết quả gần đây** rows are read only when Results is visible.
- No new provider resource, Firestore read/write cadence, polling, listener or heartbeat is introduced.
- Agent remains `relay-agent-v114`, Android remains `beta-vc97`, and Stable remains OWNER-GATED and untouched.

## 2026-10-06 — D162 Owner field acceptance — PASS

- Owner explicitly recorded **D162 PASS** after the workspace-tab realtime counter repair was technically deployed on Beta.
- D162 is closed and promoted to the accepted business base. The final D162 runtime checkpoint remains PR #451 / main `8fca1fb539f2396cefaff621368758336035c00b` with Beta deploy run `37395842899`.
- Agent remains `relay-agent-v114`, Android remains `beta-vc97`, and Stable remains OWNER-GATED and untouched.
- OA097 is closed by this explicit Owner acceptance. D163 may now open.

## 2026-10-06 — D163 forced-logout log continuity and reporting Picker detail — Owner approved

Status: **OWNER APPROVED IMPLEMENTATION — BETA SERVICE/WEB — ANDROID VC97 UNCHANGED**.

Owner approved two coordinated D163 changes:

1. **Kích User must preserve the normal logout support-log boundary.**
   - Server session-generation revoke remains authoritative and immediate.
   - Android `beta-vc97` is not rebuilt or modified.
   - After a forced Picker revoke, only the just-revoked Android Picker generation may upload the existing sanitized `INFO / session_end_logout` bundle.
   - The grace is limited to exactly one generation behind the current Android session generation and applies only to `/api/logs/upload`; no business API, realtime authority, notification registration or other log reason becomes valid again.
   - Existing runtime-log sanitization, local InventoryCore persistence, archive idempotency and Drive-as-secondary-archive behavior remain unchanged.

2. **Báo cáo chi tiết must expose individual Picker information per report batch/SKU.**
   - Add a professional **Xem Picker / Ẩn Picker** drill-down directly in the detailed report table.
   - Picker detail is lazy-loaded only when an operator expands one batch and is requested by exact `batch_id`; do not fan out a request for every visible row.
   - Show Picker employee code/name, report time, effective result/source, Picker wait duration and result receipt/display/acknowledgement state where applicable.
   - Reuse the existing detailed-report data authority already used by Excel export. No new database schema or persistent provider resource is introduced.

Preimplementation review:
- **base impact:** D162 accepted behavior is preserved. D163 changes only the runtime-log authentication exception for one safe final boundary and Web reporting presentation/read shape.
- **affected components:** Beta Worker/Service, existing InventoryCore reporting query, Web reporting UI/API, regression/authority state.
- **regression/stability risk:** medium-low. The main security risk is accidentally reviving a revoked session; mitigation is Android + Picker + one-generation-behind + exact INFO/session_end_logout + log-route-only gating. Reporting risk is read amplification; mitigation is one exact-batch lazy read on user expansion.
- **resource/quota/security impact:** no new persistent resource, secret, schema, polling, listener, heartbeat or provider write cadence. A real forced logout may add one final runtime-log upload that normal logout already performs. Picker detail reads occur only on explicit expansion.
- **recommended approach:** keep revoke first and authoritative, grant only the bounded final-log exception, and reuse existing reporting-detail authority with exact batch filtering plus lazy Web expansion.

Hard invariants:
- Android stays `beta-vc97`; Agent stays `relay-agent-v114`.
- Forced revoke continues to block every business request immediately.
- Stable remains OWNER-GATED and untouched.

## 2026-10-06 — D163 technical/runtime release checkpoint

- D163 implementation PR #461 merged to main `d991c83bcf617c4aac523f85337f2b27f9fe3193`.
- Beta deploy run `37417036768` and all main authority/regression/build gates PASS.
- This checkpoint proves technical/runtime readiness only. It does **not** constitute Owner business acceptance.
- OA098 is now the remaining gate: physical Kích User → login return + final logout-log continuity, plus Web Báo cáo chi tiết → exact selected batch Picker drill-down.
- Android `beta-vc97`, Agent `relay-agent-v114`, and Stable remain unchanged.

## 2026-10-06 — D163 Owner field acceptance — PASS

Status: **OWNER FIELD ACCEPTED PASS — D163 CLOSED**.

The Owner explicitly confirmed D163 complete with **“ok done 163”** after technical/runtime PASS.

Accepted evidence:
- implementation PR #461 merged to main `d991c83bcf617c4aac523f85337f2b27f9fe3193`;
- Beta deploy run `37417036768` PASS;
- forced Picker Kích User keeps revoke immediate while preserving the normal final `INFO / session_end_logout` support-log boundary;
- Web **Báo cáo chi tiết** exposes lazy exact-`batch_id` Picker detail;
- Android remains `beta-vc97`, Agent remains `relay-agent-v114`, Stable remains OWNER-GATED and untouched.

OA098 is closed PASS and D163 is promoted to the accepted Inventory base. The already-authorized **D164 PDA Management** workstream remains an independent isolated scope and continues under `ops/pda-management-state.json`; this acceptance record does not imply D164 Owner PASS.

## D165 — Inventory reliability, realtime and usage optimization proposal — Owner approved for recording only — 2026-10-06

Status: **OWNER-APPROVED PROPOSAL ONLY — IMPLEMENTATION NOT STARTED**.

The Owner approved recording the complete D165 proposal after review of D163 live behavior, the complete 2026-10-06 Báo hàng logs and refreshed provider-usage evidence. Canonical detail is `docs/D165_INVENTORY_RELIABILITY_USAGE_PLAN.md`.

Hard gate:
- this record does not authorize runtime/source implementation;
- D165 must be re-verified in a later fresh-bootstrap session and requires a new explicit Owner start command before code/build/deploy;
- D164 PDA Management remains an independent isolated workstream under `ops/pda-management-state.json`; D165 does not replace the current D164 change-control slot;
- Stable remains OWNER-GATED and untouched.

Owner-approved D165 scope:
1. One canonical daily Logs folder for Android/Web/Agent, race-safe folder resolution and `bundle_id` idempotency.
2. User-facing App/Agent release notes carried by existing update manifests, with no sensitive/internal/AI/Owner-only content.
3. New **Quá hạn** Reporter tab for `PER_PICKER` only. `FIRST_REPORT` is explicitly unchanged.
4. In `PER_PICKER`, a Picker may receive automatic Skip eligibility while the SKU batch remains `PENDING` for Invent; the same SKU may simultaneously contain waiting Pickers in Đang xử lý and timed-out Pickers in Quá hạn.
5. Quá hạn **Đã có hàng** affects all applicable Pickers; Quá hạn **Cho phép Skip** sends new Skip only to still-waiting Pickers and avoids duplicate Skip delivery to already-timed-out Pickers.
6. Correction source is **HAS_STOCK** only: HAS_STOCK -> PENDING or HAS_STOCK -> SKIP_ALLOWED, with two confirmations, immutable audit and Picker corrected-result acknowledgement. HAS_STOCK -> PENDING resets per-Picker auto-skip deadlines from correction time.
7. Saving processing/SLA timing configuration requires a critical warning plus server-side verification of the current authenticated user’s password; passwords never enter logs/audit/local storage.
8. Agent repairs: bulk/single kick list refresh from local authoritative state, temporary action status instead of stale banner, and reliable Android final logout-log persistence after Kích User.
9. Android catalog synchronization becomes single-flight/coalesced to eliminate overlapping staging corruption.
10. Web stops protected refresh work after session loss/replacement.
11. Expected `PRESENCE_ACK_CONTROL SUPERSEDED` concurrency losses remain safe CAS diagnostics and stop generating per-event error archives unless real convergence/health impact exists.
12. Realtime Web/Android applies exact row/snapshot deltas where sufficient instead of full queue/recent/report/result API reloads per event; full reconcile is reserved for initial load, real gap/epoch mismatch/integrity uncertainty.
13. Add measured SQL indexes and transactional/materialized batch summary counters to trade very low rows-written usage for much lower rows-read usage.
14. Reconnect remains fast and delta-first; multiple reconcile triggers coalesce.
15. Existing Beta RTDB is approved as a **proposal-only HA liveness carrier**: PRIMARY small heartbeat + NEXT_A realtime observation, while Firestore remains authoritative for PRIMARY/generation and remains the fail-closed fallback. The accepted 15-second failover objective may not regress.
16. Only current authoritative PRIMARY/generation should terminally ACK the single-slot presence control; standby avoids expected redundant write races.
17. D1 cold-history/report offload is deliberately deferred beyond D165 until post-D165 field evidence.

Usage policy:
- modest increases in DO SQL writes, CPU/memory/duration and tiny RTDB liveness traffic are acceptable when they measurably reduce DO requests/rows-read or Firestore read/write without weakening behavior;
- no new periodic polling, no slower realtime, no weaker WMS/PRIMARY/session fences and no new provider solely for quota savings;
- because the Workers $5 account is shared by multiple projects, Inventory targets <=150k–200k attributable DO compute requests/month after D165, not the full account allowance;
- target DO rows-read reduction >=70% from the observed ~63M/day baseline, target <20M/day;
- target Firestore writes <=3k/day and reads <=10k/day, preferred <=8k/day, under comparable load;
- current PickList latency, realtime behavior, 15-second failover objective, correctness and zero duplicate WMS mutation are hard acceptance guards.

No D165 source/build/runtime action occurred in this authority-only recording.


## 2026-10-07 — D165 implementation start — Owner explicit authorization

Status: **IMPLEMENTATION STARTED — BETA/INVENTORY SCOPE ONLY**.

After a fresh authority bootstrap and review of the canonical D165 plan, the Owner explicitly confirmed **“Ok chốt. Tiến hành chạy code.”** This closes OA099 and authorizes D165 implementation on a branch/PR.

Boundary guard:
- D164 PDA Management remains field-pending and isolated under `pda-management/**`;
- D165 may run in parallel only inside the Inventory runtime scope already defined by the approved plan;
- any shared-boundary collision must wait/fail closed rather than merge D164 and D165 behavior;
- Stable remains OWNER-GATED and untouched;
- D165 technical/runtime PASS will still require Owner field PASS before promotion to the accepted Inventory base.


## 2026-10-07 — D165 Owner field NOT PASS; Android parity and privileged-auth repair

Status: **D165 SAME-CHANGE REPAIR — PR #487 DRAFT — NOT YET RELEASED / NOT OWNER PASS**.

Owner reports D165 privileged-account password change is not live and explicitly requires the two HAS_STOCK correction actions plus the PER_PICKER **Quá hạn** workspace on **Android APK** as well as Web. Continue under D165; do not open D166.

- The already merged D165 Beta worker/Web provided PER_PICKER overdue and HAS_STOCK correction, but Android Reporter remained on four tabs and exposed only the earlier SKIP_ALLOWED -> HAS_STOCK correction. PR #487 repairs that feature gap using the existing scoped APIs.
- Android Reporter adds a fifth **Quá hạn** tab only when server counters report `auto_skip_enabled=true` and `auto_skip_mode=PER_PICKER`. FIRST_REPORT keeps the existing four-tab arrangement and behavior. The fifth tab is scrollable on small PDAs, while four-tab layout remains equal-width.
- The overdue list is requested on explicit tab opening and then updated via the existing `reporter_overdue` realtime scope; the badge uses existing authoritative counters and event delta. It shows timed-out and still-waiting Picker counts separately, with both **Đã có hàng** and **Cho phép skip** actions. No extra poll/listener/provider is authorized.
- Android **Đã có hàng** result rows add **Sửa - Đang xử lý** and **Sửa - Cho phép Skip**. Both require two explicit warning/confirmation steps, one outstanding action per batch, a fresh server-side `expected_version` fence, immutable audit and the existing critical Picker corrected-result delivery/ACK; no client-side mutation without server approval.
- Existing SKIP_ALLOWED -> HAS_STOCK five-minute correction is preserved.
- D165 privileged logins `root`, `admin`, `tamnv2` require the authorized one-time-code model via the existing project Google mail sender. PR #487 implements the code request/verification surface and Agent session continuation, **but remains draft and not deployed**.
- **SECURITY BLOCKER**: The exact requested emergency rule (any numeric >=8-character input merely containing the current Vietnam HHmm within ±5 minutes) is public/predictable and cannot securely authenticate an administrator. This emergency rule must not be activated as a production-capable bypass until the Owner explicitly approves a separate secret-backed emergency factor. Do not record or commit actual codes, credentials or secrets.
- PR #487 previously failed Project State Guard because canonical state was not updated in the source change set. This repair records decisions/spec/state together, then reruns gates.
- D164 PDA Management stays isolated and independently field-pending; Stable is OWNER-GATED untouched. Do not promote D165 as Owner PASS without field validation.

## 2026-10-07 — D165 Owner UI refinement — Android Reporter tabs

Owner explicitly requested a same-D165 Reporter APK presentation refinement while D165 PR #487 is under repair:

- Remove the **Picker đã thu hồi** tab from the **Android Reporter** workspace. Historical withdrawals, audit/report data and all server-side lifecycle behavior remain unchanged.
- Keep the **Đang xử lý** and conditional **Quá hạn** tabs with visible authoritative numeric badges.
- Remove numeric badges from the **Đã có hàng** and **Cho phép Skip** tabs. The tabs and their report rows/actions stay available.
- Exactly four operational tabs are visible when `PER_PICKER` auto-skip is enabled: **Đang xử lý · Quá hạn · Đã có hàng · Cho phép Skip**. With `FIRST_REPORT` or disabled per-Picker auto-skip, **Quá hạn** is hidden, leaving three tabs; underlying FIRST_REPORT timeout/transaction semantics are not changed.
- Tabs share the available width instead of requiring a horizontal-scroll container. No new API request, poll, listener, background timer, database field or provider resource is introduced. Realtime queue/overdue counters remain the only UI badges.
- This UI-only change applies to **Android Reporter**; Web operations, detailed reporting, withdrawal history and RBAC remain unchanged.
- PR #487 remains draft until Android/authority/continuity gates pass and the separately documented privileged-login emergency authentication security blocker is resolved. No change to D164; Stable remains Owner-gated.

## 2026-10-07 — D165 explicit Owner override: exact emergency login rule, no added factor

**Status: CURRENT OWNER DECISION. Supersedes the preceding D165 proposal-only independent-secret release blocker.** Owner explicitly rejected adding TOTP, another secret, or any extra emergency-auth factor and ordered continuation of the existing D165 code through technical PASS. The Owner-directed privileged-login contract for the exact `root`, `admin`, `tamnv2` accounts remains:

- No fixed username-specific login passwords. Login uses the existing 4-digit single-use Gmail OTP (subject `MẬT KHẨU BÁO HÀNG {username} - {xxxx}`, delivered to the existing authorized recipient); a successful OTP login consumes it and requests the next one.
- The alternative emergency login input **must be numeric and >=8 digits**, containing a contiguous 4-digit `HHmm` for the current Vietnam wall-clock minute within **±5 minutes**, anywhere in the input. No additional factor. Server time, not a client-supplied clock, is authoritative.
- Existing user-role/session-generation fences, Web/Android role restrictions, Agent session restore, critical-action re-auth, immutable audit hygiene and no-token/no-password logging rules remain intact. Stable is untouched.

**Explicit residual security risk:** This clock-only proof is publicly predictable, even with a minimum input length. It is not a secret and cannot independently authenticate a real administrator. The Owner was informed of the account-takeover risk and explicitly directed use of the exact behavior without an extra factor. Prior recommendations to block Beta deployment pending an added secret are therefore superseded as product decisions, not recharacterized as a security improvement. Do not claim this proof is secure or field-validated; future changes require a new Owner decision.

D165 PR #487 must complete existing CI/authority/continuity, merge/deploy only the scoped Beta resources, and record real build/runtime outcomes accurately. Its technical PASS is **not** Owner field/usage PASS. D164 remains independently isolated and Stable remains OWNER-GATED.

## 2026-10-07 — D165 required Agent Gateway release completion

After PR #487 merged and Beta Worker/Android/Agent releases, the Windows Agent privileged OTP/password action path still depends on the existing scoped Google Apps Script Agent Operations Gateway. Updating only `ops/apps-script/agent-log-gateway/Code.gs` in GitHub does not publish its live Web App deployment. Owner-approved D165 completion therefore includes an automated **same-resource, same-deployment-ID** Apps Script update from the existing GitHub Beta `CLASPRC_JSON` credential and `AGENT_LOG_GATEWAY_URL_BETA` variable. The process must find exactly one Script under the canonical scoped name and verify the *existing* deployment belongs to it; zero or ambiguous matches fail closed. It may push repo-managed source, create a new Script version and update only that existing deployment, then verify readback. No new Script or deployment, no new periodic polling, no Stable changes. Do not expose credentials, Script IDs or deployment IDs in public repo or CI logs. Agent Office login field proof and D165 Owner PASS remain separate.

## 2026-10-07 — D165 scoped Apps Script deployment readback repair

The existing-gateway workflow passed source validation and issued the expected in-place `clasp push`, `create-version` and `create-deployment` commands for the already-scoped deployment, but its immediate `list-deployments` readback did not yet reflect the target version. **Do not treat that as confirmed deployment PASS or create a new Script/deployment.** Repair the same D165 workflow with bounded reads of the exact provider `projects.deployments.get` version plus a safe live invalid-username rejection probe for the D165 handler. Neither check sends email or performs a business mutation. Maintain exact Script/deployment identity and Stable prohibition.

## 2026-10-07 — D165 Beta source/release/Gateway technical PASS; Owner field PASS outstanding

The D165 same-change follow-on PRs #487, #488 and #489 are merged. All PR required checks passed, Beta Worker deployment completed, signed Android `beta-vc99` and Windows Agent `relay-agent-v116` were published. The **existing** scoped Beta Agent Operations Gateway (no new Script/deployment) was updated in place and verified by Google Apps Script REST deployment readback plus a nonmutating live handler challenge; run `37554446509` PASS. The earlier immediate CLI-list readback failure `37553946690` was repaired in the same change. No Stable mutation.

This is **technical/runtime PASS only**: OTP email delivery and Agent Office login with real authenticated accounts have **not** been exercised in these automated checks, nor has comparable-load usage/regression evidence been field accepted. D165 Owner business PASS must not be recorded until explicit field acceptance (OA100). The Owner knowingly retained the insecure clock-only HHmm emergency proof without a further factor; the predictable account-takeover risk is documented and not cured by CI PASS.

## 2026-10-07 — D165 same-change correction: neutral login UI, automatic OTP succession

**CURRENT OWNER REQUIREMENT — D165 NOT YET OWNER-PASS.** The Owner clarified that a protected-account login is performed in the same username/password form as any other login. There must be no visible **request/send one-time password** button and no pre-login explanation disclosing which usernames use the special one-time flow. This supersedes D165's previously published user-facing request-code controls.

- Applies to Inventory Web, Android Báo hàng and the Windows Agent login UI. The public login labels/hints must say only **Mật khẩu**, not **mã một lần**, **khẩn cấp**, or the list of privileged account names.
- On a valid protected-account **four-digit one-use code**, the Worker consumes that code and automatically issues and emails the next fresh code to the already-authorized existing recipient, using the established subject contract. The user does **not** press a second request button. This behavior already existed in the D165 Worker and is retained, with a regression guard rather than an extra per-login provider request.
- Remove the Web's separate code-request affordance on both the login and authenticated Account surfaces, Android login request button, and Windows Agent's request button. Normal nonprivileged password/password-recovery controls remain.
- A server-side endpoint retained for controlled bootstrap/legacy support is **not** an advertised client-facing action; hiding a UI button is not itself a security boundary or an account-secrecy guarantee in this public repository.
- **Known functional limit requiring later explicit Owner review:** existing D165 OTP expiry is 15 minutes from email issuance. Without the request button, a later sign-in after expiry cannot use that stale code and must use the separately approved emergency authentication route. The present correction does not silently extend OTP lifetime or add background email delivery.
- **Risk/review:** accepted D163 Inventory base unchanged; affected only Web/Android/Agent login display and UI regression guard; no new resource, periodic fetch, quota cadence, security role grant, or Stable mutation. Regression focus: normal login, OTP consume/next-mail, expired-code/error, Agent session continuity, Android packaging and user account UI. The Owner explicitly ordered this same-D165 correction.

D165 technical/build/deploy evidence from prior PRs remains valid only for the **previous published artifacts**; this new UI source correction requires its own CI/release and field acceptance before declaring D165 complete.

## 2026-10-07 — D165 neutral-login UX repair release checkpoint (technical PASS, field pending)

D165 PR #491 merged to main `ecad23eb2217d3ea4abf97c8c0b1baf3ce4f387f` after **14/14 PR CI PASS**. The resulting main source passed **11/11** workflows including Beta Worker deployment run `37558186044`. The official signed Beta Android release is **`beta-vc100`** and official Windows Agent release is **`relay-agent-v117`**, with refreshed `inventory-channel` assets. No Stable release, new resource, periodic provider quota or D164 PDA Management mutation occurred.

Client login forms are neutral; no visible OTP request button or privileged-user list. The existing server one-use four-digit code consumption and automatic next-email issue path is unchanged. The previous 15-minute OTP expiry remains and cannot be silently represented as a durable daily rolling password. **OA100 remains field/usage acceptance pending** for real email delivery, Agent Office session, device UI and comparable-load usage; no Owner PASS is inferred from code or GitHub release checks. The already documented publicly predictable clock-only emergency fallback is still a serious security risk.

## 2026-10-07 — D165 Owner field NOT PASS: Reporter counter-range and always-visible overdue tabs

**CURRENT D165 REPAIR DECISION. Supersedes the earlier conditional Android/Web overdue-tab visibility, not the underlying PER_PICKER business rule.** The Owner supplied an Android vc100 field log showing `INVALID_COUNTER_RANGE` immediately after Reporter login and again on refresh. The cause is contractual: Android called `GET /api/reporter/counters` without `from`/`to`, but the D165 Worker requires a bounded range. The failed request aborted the Reporter view refresh and preserved stale/hidden tab state.

- Android Reporter must always render exactly four pinned tabs: **Đang xử lý · Quá hạn · Đã có hàng · Cho phép Skip**, including when auto-skip is disabled, mode is `FIRST_REPORT`, or overdue count is zero. The Web operations tab set must likewise keep Quá hạn visible; do not redirect the user away. The overdue list is an empty explanatory view when the policy is not enabled `PER_PICKER`.
- **Only enabled PER_PICKER computes the actionable overdue list/count**. Disabled/FIRST_REPORT shows count zero; no fabricated overdue rows, forced policy change, backdated deadlines or alternate business meaning. The same SKU may still appear in pending/overdue simultaneously under the existing PER_PICKER rule.
- Fix Android counters request with a bounded `from`/`to` range based on the already fetched **server** snapshot clock and `Asia/Ho_Chi_Minh` business day, not the PDA wall clock. Keep Web's independent existing range handling. Never relax service validation or add a new periodic fetch solely for UI.
- Reporter tab badge counts remain only on Đang xử lý/Quá hạn; no withdrawn operational tab; both HAS_STOCK correction options remain versioned/double-confirmed. All D163 field-PASS behavior, D164 isolated PDA Management and Stable OWNER-GATED remain unchanged.
- Impact: existing D163 accepted base not promoted; affected Beta Android UI/API, Web tab visibility and automated guards. No Worker schema or provider change; no new listener, heartbeat, timer, database write or token. Regression risk: disabled-policy empty state, dashboard initial load, reconciled counts/SQL and reconnect. The Owner explicitly directed this D165 repair and regression completion; technical PASS still requires signed Beta artifact, GitHub CI and later physical Owner field/usage PASS.

## 2026-10-07 — D165 Reporter field-repair technical PASS and signed vc101 release

D165 PR #493 merged to main `b640ac576e628ac64ad162766c972502499092a3` after **13/13 PR checks PASS**. Main **10/10 CI PASS**, Beta Worker/Web deploy run `37560667192` PASS, Android signed `beta-vc101` release `405305194` (APK asset `617295842`) published on the preexisting `inventory-channel`. Windows Agent remains v117, project D164 remains isolated and Stable OWNER-GATED.

The field-reported vc100 `INVALID_COUNTER_RANGE` was caused by Android GET counters without mandatory `from/to`; vc101 calculates a bounded Vietnam day from the already returned server snapshot time. The always-visible Web/Android Quá hạn tab now gives zero with explanatory empty state when policy is inapplicable, without changing underlying PER_PICKER-only overdue business authority or introducing extra polling. Static/runtime CI validates source contracts and compiles the APK, but **does not substitute for field evidence**: real PDA login/refresh/reconnect, one real timed-out + waiting Picker, Web zero-mode display, D163 forced-logout/detail regression, Agent Office, privileged OTP next-email and comparable-load provider usage remain OA100 test cases. D165 is **READY_FOR_OWNER_FIELD_TEST**, not Owner PASS.

## 2026-10-07 — D165 Owner field NOT PASS: Skip correction and Agent privileged login, persistent OTP (current decision)

**Owner explicitly ordered code repair and full Beta CI/release of the still-open D165.** The supplied signed Android vc101 log records repeated `INVALID_INPUT` when changing a recently skipped SKU. Root cause: Android posted the retired unversioned correction shape while Worker required `target` and `expected_version`, and the Worker accepted only HAS_STOCK-origin corrections. The user also confirmed Agent v117 silently reset its login inputs for both permitted privileged Agent accounts; Web login already works. This is a D165 field **NOT PASS**, not authorization to open D166 or promote Stable.

- In resolved **Cho phép Skip**, Android and Web present two actions within the configured `skip_to_stock_minutes` correction window measured from the batch's **first report**, not the Skip click: **Sửa - Đang xử lý** and **Sửa - Đã có hàng**. The server must independently enforce the window, previously resolved state and expected version; rejects expired, disabled, duplicate or stale corrections. HAS_STOCK → PENDING/SKIP remains available. Each accepted correction changes batch/tickets atomically, updates appropriate versioned counters, creates immutable correction event and audit, and resets new pending timeout from correction time without modifying historical events.
- For corrections, notify and require new ACK **only the Picker users with reports for that exact batch/SKU** through existing event-based result targeting; preserve names, SKU, product and explicit former/new state and human reason. No global Picker push, new provider, listener cadence, periodic refresh or Firestore Báo hàng write.
- OTP for exact privileged accounts `root`, `admin`, `tamnv2` is a four-digit, **single-use** code delivered only to the already-approved mailbox. **Supersedes the previous 15-minute expiration**: an issued code remains valid without a deadline until successful consumption; then issue/email its successor automatically. A still-pending durable code cannot be overwritten by public requests. The authorized first deployment triggers one controlled initial email per account without exposing code in GitHub public repo or logs. The established email subject format is unchanged.
- Agent login for `admin`/`tamnv2` must accept the same Worker-authoritative OTP or Owner-approved numeric >=8 digits containing Vietnam server HHmm ±5 minutes. Prefer the Worker path shared with Web; use the existing scoped Office Apps Script Gateway only on transport failure. Never bypass real ADMIN/Agent session/Firestore controls. Failed Agent login must display sanitized error and preserve username while wiping password/proof. Agent v118 is the next candidate. Root itself is not granted Agent ADMIN permissions.
- **Known serious residual risk**, reconfirmed: permanent four-digit codes and a publicly predictable clock-only emergency proof expose these accounts to takeover; existing rate limit is not equivalent to a secret second factor. Stable remains OWNER-GATED, D164 remains isolated, D163 remains last Owner-accepted Inventory base. PR/CI/release technical PASS is distinct from Owner field PASS. No comparable-load usage improvement may be asserted without measurement.

## 2026-10-07 — D165 Owner field NOT PASS on Agent v118: privileged role-parity defect

Owner field evidence on published Agent v118 shows both the current emailed OTP and the approved emergency HHmm proof return `HTTP 401 INVALID_CREDENTIALS` through the direct Beta Worker path, while the same OTP succeeds on Web. The same v118 machine subsequently signs in a normal `PICKPACK_ADMIN` Agent account and claims Firestore successfully, proving network/Firebase/Agent session infrastructure is available.

Code review identifies the defect: general Agent authority and Firestore Rules accept immutable/effective `ADMIN/ADMIN` **or** `PICKPACK_ADMIN/PICKPACK_ADMIN`, but D165 `privilegedAgentLogin` and its client token validation were hard-coded to `ADMIN/ADMIN` only; D165 re-auth also requested only `ADMIN`. This contradicts the already accepted Agent operator matrix and the D165 requirement that exact privileged Agent logins `admin` and `tamnv2` use OTP/emergency authentication.

Owner directed immediate same-D165 repair. Worker privileged login/re-auth must use the existing Agent operator matrix without granting ROOT/REPORTER access. Agent must normalize composite internal usernames such as `admin:tamnv2` to the visible canonical login before the privileged Worker request and validate returned claims with the same `IsAgentOperatorRole` predicate as ordinary Agent auth. Candidate version advances to v119. Stable remains OWNER-GATED; D164 remains isolated; D163 remains the last Owner-accepted Inventory base.

## 2026-10-07 — D165 Agent v119 technical release checkpoint

Same-D165 repair PR #497 merged to main `1278b2025494e61e0bd952bb3b1ebb84c2338ee1`. PR checks completed with 14 success, 9 conditional skips and zero failures. Main push completed **11/11 workflows PASS**, including Beta Worker deployment run `37569696945`, Agent verification/release run `37569696832`, UI Design Guard `37569696705`, Repo Authority `37569696776` and Project State Guard `37569696712`. Official prerelease `relay-agent-v119` is published.

v119 aligns D165 privileged login/re-auth with the already-authorized Agent operator matrix: immutable/effective `ADMIN/ADMIN` or `PICKPACK_ADMIN/PICKPACK_ADMIN`; exact special login is normalized before request; ROOT/Reporter remain denied. OTP persistence/rotation, Owner-approved HHmm emergency proof, Firestore session fences, Android signed `beta-vc102`, D164 isolation and Stable OWNER-GATED are unchanged.

This is **technical/build/deploy PASS only**. Owner physical Agent OTP/HHmm retest, vc102 Skip-correction retest and comparable-load usage/stability remain OA100; do not mark D165 Owner PASS from CI.

## 2026-10-07 — D164 standalone PDA Management cancelled; successor becomes consolidated workforce/operations model

Status: **OWNER DECISION — D164 CANCELLED WITHOUT OWNER PASS; SUCCESSOR DIRECTION RECORDED ONLY**.

The Owner explicitly cancelled the standalone D164 PDA Management direction and decided not to continue building PDA management as a separate product. D164 had reached technical/runtime Beta readiness but had not received Owner field PASS; therefore it is closed as **cancelled**, is not promoted to the accepted base, and its Beta artifacts/resources are frozen rather than deleted or repurposed by this decision.

The replacement direction is one consolidated operational management model containing:
- Nhân sự;
- ra/vào ca;
- công nhật;
- quản lý công cụ dụng cụ (CCDC), with **PDA treated as one CCDC asset type**;
- quản lý biên bản;
- nhận hàng rớt.

Canonical successor scope is recorded in `docs/specs/OPERATIONS_MANAGEMENT.md`.

Governance:
- D163 remains the accepted Inventory base.
- D165 becomes the current open change and still requires explicit Owner field/usage PASS.
- No new change ID is assigned to the consolidated model while D165 remains open.
- Existing D164 source, releases and Beta runtime resources remain historical/reuse candidates only; this decision authorizes no delete, deploy, migration or repurpose.
- Any reuse/new resource for the consolidated model requires later project-scope reconciliation and explicit Owner approval.
- Stable remains OWNER-GATED and untouched.

## 2026-10-08 — D165 HA usage repair: Owner-approved staged Agent rollout

Status: **OWNER APPROVED IMPLEMENTATION — D165 CONTINUATION; FIELD PASS PENDING**.

Owner approved a Beta-only RTDB HA-role parity repair and bounded observer-retry wake improvement after 08/10 field logs exposed high Firestore Reads. Preserve existing APK, Web/Worker, WMS mutation/ACK contract, 15-second HA safety objective, Firestore authoritative role/generation fences, and the accepted D163 base. Stable remains OWNER-GATED.

Rollout: build/release a manually updated Agent candidate (v120). Owner updates NEXT_A/standby first while v119 PRIMARY continues processing; verifies standby readiness, then explicitly uses the existing authorized PRIMARY handoff control after all in-flight confirmations settle. Only after real PickList confirmation and HA field PASS does Owner update remaining Agent machines. Never initiate a remote/forced installation or automatically switch PRIMARY. Comparably loaded Firestore/RTDB usage, fallback and errors are measured before D165 Owner PASS. If RTDB becomes unhealthy, existing Firestore lease fallback and fail-closed mutation fences remain mandatory.

The RTDB change is restricted to already-scoped Beta `relay_poc/coordination/ha_liveness` permissions: authenticated `AGENT` sessions with matching `ADMIN/ADMIN` or `PICKPACK_ADMIN/PICKPACK_ADMIN`; no Picker/Web/ROOT or blanket RTDB access. Client logging reports sanitized HTTP/transport error classes only, without tokens or URLs.

## 2026-10-08 — D165 Owner explicit PASS; accept deployed Agent v120, defer HA/Usage optimization to post-shift D166

**Authority: OWNER EXPLICIT PASS, superseding earlier D165 field-PENDING and any interpretation of "pause/stop v120".** The Owner clarified: "chốt v120 và các code 165 đã triển khai, ghi nhận coi như pass. Tối nay có log anh gửi em tối ưu lại và mở 166." Record D165 **PASS and CLOSED** exactly as currently deployed in Beta, including Agent `relay-agent-v120`, Android `beta-vc102`, existing Web/Worker and Beta RTDB HA rule changes. **Do not roll back, disable, freeze or force-restart v120** as a consequence of this closeout. D165 becomes the accepted Inventory baseline, replacing D163.

This acceptance is a **version/deployed-code baseline decision**, not a claim that HA flapping or excessive Firestore usage is repaired. Known evidence from 08/10: an authorized targeted handoff to Agent v120 on ADMIN-PC later reverted to another v120 Agent; RTDB observer timeouts/HTTP 403, uncoordinated RTDB-vs-Firestore heartbeat, and high Firestore Reads/Writes require further end-to-end evidence. These remain **documented open technical findings for a future D166 optimization**, with no silent mutation of accepted D165 code. No Stable promotion; Stable remains OWNER-GATED.

**Next step:** Owner will supply full Agent/Android/Web log bundle and usage evidence after end of shift at **22:00 Vietnam time**. Analyze real event timestamps (not upload timestamps) across 06:00–22:00, include the HA/confirmation/RTDB/Firestore/Cloudflare usage trade-offs, provide ranked root causes and safe change proposals to Owner, and **then open D166**. D166 is **not yet active in this D165 closure**. Any D166 code or runtime mutation requires Owner agreement to the proposed scope and its own branch/PR/authority+continuity PASS/merge.

## 2026-10-08 — Owner approved SUPRA Shared Quota Governance (authority-only; GOV-QUOTA-20261008)

**Owner explicitly approved the policy and authorized branch/PR/CI/merge of Inventory authority documentation only.** Apply internal shared-pool allocation **Inventory 30% / Pick Pack 30% / third project 30% / central reserve 10%**, on verified shared quota pools only; do not infer common billing/free tier from use of the same login. Cloudflare Workers Paid USD 5/month base remains unchanged; Google Cloud/Firebase Blaze internal **USD 10/month soft budget**, allocated USD 3/USD 3/USD 3/USD 1, warning at 70/85/95% with 100% escalation, **never an automatic service shutdown**. Google consumer account and GitHub remain Free; other services Free unless separately approved. USD 15/month is a planning baseline, not an invoice ceiling; Cloudflare overages/taxes are outside that estimate.

For Inventory, future development is **Beta-only planned**, without new Stable build; existing Stable resources remain listed, untouched and **OWNER-GATED**. D165 deployed baseline (Agent v120, Android vc102, Beta Web/Worker/RTDB) remains unchanged and PASS; D166 is reserved for separate post-22:00 log-based HA/usage work. No provider, billing, credential, resource, code, runtime or other-project mutation is authorized. Prior D098 Inventory 35% Cloudflare allowance is **superseded as the shared-cost governance target** by the new 30% allocation; existing runtime safety guards are not implicitly changed. Exact project identities, Google Billing Account links, provider alerts and any operational configuration require read-only discovery and a separate explicit approval. Complete policy in `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`. Approval to record/merge authority must not be conflated with later Owner acceptance of an implemented technical change.

### SUPRA Shared Quota Governance — authority-only recording technical checkpoint (2026-10-08)

The Owner-approved policy was captured in scoped Inventory PR [#504](https://github.com/tamnv2/supra-inventory/pull/504) and **merged** to `main` at `05b81cd2efaaa98abcf710fd4ddfb8ed11467f6b` after **Repo Authority Guard PASS** and **Project State Guard/Continuity PASS**. Its diff covered exactly eight authority/spec/registry/state documentation files, with zero runtime/provider/CI configuration modifications. This entry records technical authority delivery, **not** post-merge Owner business PASS. OA101 remains pending explicit Owner acceptance; until then, the serialized governance change `GOV-QUOTA-20261008` stays open and future Inventory D166 may not be opened. This update does not authorize Billing alert configuration, new provider resources or changes to other repositories.

## 2026-10-08 — GOV-QUOTA-20261008 explicit Owner PASS; close governance gate

Owner explicitly replied `GOV-QUOTA-20261008 PASS` after PR #504 and #505 were merged and instructed that D166 may be opened for research of an Agent Usage download-to-ZIP proposal. The quota governance workstream is **Owner PASS and closed**; this is acceptance of policy documentation only, **not** authorization to configure provider Billing, mutate credentials, or implement Agent collection/export features. The latest accepted **deployed runtime** remains D165 Agent v120 / Android vc102 / Beta Web and Worker. D166 may now be opened sequentially only after this acceptance is merged into canonical state; initial D166 stage is analysis/proposal with no code/runtime/provider mutation. Stable stays OWNER-GATED.

## 2026-10-08 — D166 opened for analysis: on-demand Agent Usage evidence ZIP (PROPOSAL ONLY)

After explicit `GOV-QUOTA-20261008 PASS` was recorded and its gate closed, Owner requested **open D166** and first **research/analyze/propose**, rather than directly implement, a restricted Agent **Thông tin Usage** button `Tải số liệu Usage để phân tích`. Intended behavior: select today's Vietnam data or rolling last 24h, collect *available provider usage metrics*, generate one sanitized ZIP locally on the Windows Desktop for Owner to upload to AI for daily comprehensive analysis, with provider API costs reviewed against manual dashboard screenshots. **No feature build, change to existing Apps Script endpoint, API token, provider quota, billing, deployment or release is approved by this request.**

Existing D160 Usage already reads 13 Cloud Monitoring metric groups through the cached 15-minute Apps Script Agent Gateway; it does **not** yet cover Cloudflare, RTDB, Drive, Sheets, GitHub or authoritative billing cost. Preferred Phase A proposal is local ZIP of already available provider-authoritative data with explicit per-source missing/partial status, UTC/Vietnam windows and sanitization. Expanding provider coverage, Cloudflare account credentials/Gateway, changing Agent code, or creating any billing export requires specific Owner scope approval after full impact/risk review. Exact proposal and official pricing/source references: `docs/D166_USAGE_EVIDENCE_EXPORT_PROPOSAL.md`. D166 is the only open Inventory change and Owner acceptance remains pending; D165 is the last accepted deployed runtime and Stable remains OWNER-GATED.

## 2026-10-08 — D166 A+B+C expansion approved; safe deployment gate

Owner approved implementing the Agent `Tải số liệu Usage để phân tích` ZIP immediately with expanded cost-bounded Phase B provider reads, manual website links/screenshot fallback for unconfigured or expensive sources, and Phase C comparative analysis with uploaded logs and ZIP. A v121 candidate and existing Beta Apps Script read-only Monitoring extension may be prepared. **Do not merge or release while existing D160 Gateway migration-on-main could run concurrently with D165 scoped Gateway in-place deployment**; explicitly verify and isolate the workflow boundary first. No new secrets, Cloudflare account-wide token, BigQuery export, D165 WMS/HA changes or Stable. Preserve Agent v120 operational baseline until safe CI and field acceptance.

## 2026-10-08 — D166 Owner authorizes combined Usage-export implementation A+B+C

Owner expanded the D166 initial proposal: **implement both A and B now**, collect the maximum low-cost read-only Inventory Beta Usage through existing credentials/resources, and include direct provider dashboard links when a metric cannot be retrieved safely, legally, or at reasonable incremental usage cost. **Phase C** compares Owner-uploaded ZIP + screenshot supplements + separately gathered Agent/Web/Android logs. If Usage unexpectedly spikes due to export, investigate and repair under D166; do not disable live business workflows on soft budget thresholds. In D166 source PR #509 the candidate Windows Agent version is **v121**, while D165 **v120 remains accepted live Agent** pending explicit field acceptance.

Exact scope: on-click-only ZIP on Windows Desktop from restricted **Thông tin Usage** for exact Agent login `admin`/`tamnv2`, with Vietnam Today / rolling last 24h / 06:00–22:00 shift. Extend only the *existing scoped Beta Apps Script Agent Operations Gateway* with read-only Cloud Monitoring for Firestore, RTDB b/w, Firebase Auth/FCM, Cloud Run, Sheets/Drive API metrics, and one Drive `about.get` current **shared-account** storage snapshot; no new Firestore document operations, no auto polling/upload, no raw WMS or employee/Picker data, no cloud billing export infrastructure. Cloudflare account GraphQL and billing, Google Cloud invoice dollars, GitHub account-wide data and any unknown service remain `N/A` with linked manual dashboards/screenshots, **not fabricated zeros or fees**. New Cloudflare API credentials/other-project mutations are not authorized by this decision. No Stable build/deploy: existing Stable resources are OWNER-GATED.

Owner reports disabling legacy **D160 Consolidate Agent Operations Gateway** workflow on GitHub to prevent concurrent migration with the existing D165 in-place Beta Gateway deployment. Direct independent workflow enabled-state readback is not available through the current GitHub connector, so this is recorded as **OWNER-REPORTED** pending deploy gate; do not claim independent provider verification. A CI PASS of v121 does not imply field PASS, provider deploy PASS or permission to forcibly update the active v120 PRIMARY. Preserve sequential standby-first manual field rollout.

## 2026-10-08 — D166 v121 scoped release and Gateway technical PASS (Owner FIELD PASS pending)

Owner-approved combined A+B+C was implemented and merged via [PR #509](https://github.com/tamnv2/supra-inventory/pull/509), merge SHA `93d2104194226d411882549938ea1fdc4c00bab5`. The main release workflow **PASS** published [Agent v121](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v121) (release ID 407021794), the canonical EXE, its SHA-256 sidecar and updated the `inventory-channel` Agent download alias. The existing scoped Beta **Agent Operations Apps Script Gateway** was updated in place, successful GitHub workflow run 37805621341, with unchanged public Web App deployment identity and no new resource/API token. Repo Authority, continuity, Agent .NET build/regression and Beta Gateway checks are PASS. The obsolete standalone **D159** workflow has an unrelated current-main failure at `Probe configured D159 gateway identity` because it still queries a retired D159 standalone `/exec` URL rather than the consolidated Agent Gateway; preserve this known CI discrepancy for later safe reconciliation, never conceal it as PASS. Direct workflow modification/re-run was blocked by current tool permissions. Owner-reported manual disabling of historical D160 migration plus source guard preventing push-triggered legacy migration remain documented.

This is **technical release only**: D165 v120 is still the accepted deployed PRIMARY runtime. D166 v121 is an available, manually installed **standby-first** candidate. Do not force/fleet-update, change WMS confirmation/HA/ACK, alter Stable, switch PRIMARY, or mark field/usage PASS before Owner supplies one v121 Desktop Usage ZIP plus supplemental Cloudflare/Billing dashboard screenshots as needed, and separate Agent/Android/Web logs for phase C. Owner acceptance and any optimization code after reviewing the evidence remain D166 work, not a new change ID.

## 2026-10-08 — D166 Cloudflare read-only export extension (Owner approved; branch candidate only)

Owner approved collecting the maximum safe Cloudflare Analytics/DO/Billable Usage evidence using a read-only token stored as GitHub Beta Environment secret `D166_CF_READ_TOKEN`. The Owner reports creating the secret; the linked GitHub connector cannot verify or reveal its value. Scope remains the existing Inventory Beta Worker and explicitly labeled shared-account aggregates. An optional v122 Agent candidate adds separate Cloudflare JSON sections to the manual ZIP. Missing permissions, unavailable schema/data and delayed billing are `N/A`, never zero or invoice proof. **Cloudflare DO account totals are NOT Inventory-attributable** until a canonical InventoryCore namespace ID is verified. Google Billing/BigQuery remains unapproved. No token in source, EXE, GitHub logs, ZIP or public repository. The automatic GitHub-to-Apps-Script secret transfer has not been provisioned or validated; no operational Cloudflare reads are claimed. D166 remains open, D165 Agent v120 accepted, no Stable change or fleet rollout. A provider-safe credential provisioning design and explicit validation gate must precede merge/deployment.

### 2026-10-09 — D166 Owner approved existing Beta Worker read-only API bridge

Owner explicitly approved using **existing scoped `supra-inventory-beta` Worker** to access Cloudflare Analytics/Billing instead of provisioning the Cloudflare token into the Apps Script Gateway with >50 Script Properties. D166 **remains the one open workstream**, without reopening D165. This supersedes the draft PR #511 direct-Apps-Script Cloudflare fetch and the temporary credential-provisioning blocker. Worker `/api/agent/d166/usage` is POST, Beta only, verified Firebase Agent token + live registered privileged operator `admin`/`tamnv2`, strict <=24h window, read-only, on-demand only. The existing Beta GitHub Environment secret name `D166_CF_READ_TOKEN` is never exposed in public source, Agent/ZIP, GitHub logs or Apps Script; approved Beta main workflow verifies token activity, then puts it as the scoped Worker runtime secret after Worker health. `D166_CF_ACCOUNT_ID` uses existing repository variable `CF_ACCOUNT_ID`. The Worker calls official Cloudflare Workers GraphQL for exact script `supra-inventory-beta` and a shared-account **Workers/DO-family-filtered** billable-usage endpoint. Account-wide DO rows cannot be safely attributed because InventoryCore's namespace identifier is not canonically registered: **no DO account-wide query**, mark `NAMESPACE_NOT_CANONICALLY_SCOPED`. Billing cost records are account-wide/possibly delayed, not Inventory expense or invoice. Provider errors are section-level N/A. Agent v122 ZIP candidate, D165 v120 accepted live Agent, no Stable changes or automatic rollout. Strict branch → PR #511 → Authority+Continuity+TypeScript+Agent CI → merge/deploy verification → standby field test → Owner PASS. Any missing CI/provider permission remains a blocker, not PASS.

### D166 runtime verification repair — 2026-10-09

D166 PR #511 merged as main `5c71cd0d8aaf8b8264f43a7450eb4220d17cdf03` after 16/16 PR checks PASS. Beta Gateway in-place deploy PASS; Worker deploy, `/health` before secret and GitHub-to-Worker secret name readback PASS. The immediate no-auth endpoint probe returned HTTP **404** instead of expected **401**, so Beta deploy workflow overall FAIL and **D166 v122 is NOT runtime/field PASS**. Existing Agent v120 remains Owner accepted. Repair remains D166: add post-secret Worker `/health` env/source readback and 10×5-second bounded unauthenticated endpoint retry with sanitized error-code visibility; no additional provider reads and no new business cadence. Do not claim root cause until post-secret readback distinguishes lost bindings, stale route propagation or code routing. Stable remains OWNER-GATED.

### D166 cloudflare bridge — technical runtime receipt 2026-10-09

PR #511 merged as main `5c71cd0d8aaf8b8264f43a7450eb4220d17cdf03` after 16/16 PR CI PASS. The first Worker Beta deploy (run `37815507756`) failed the immediate no-auth D166 route smoke HTTP 404 after Worker health and GitHub-to-Worker secret-name readback had passed; this failure was not hidden or marked healthy. The same-D166 repair PR #512 merged as main `16cde935943f3c62b4f90c36350fa0ba1fa6f885` after 13/13 PR CI PASS. Beta Worker redeploy run `37816448917` **PASS**, including Cloudflare read-token activity preflight, Worker health before secret, `D166_CF_READ_TOKEN` Worker secret binding-name readback, Worker `source_commit`/`APP_ENV` readback after secret, no-auth D166 POST strict `401 AUTH_REQUIRED`, and existing auth/SQLite/schema/PDA/OAuth regressions. Existing Agent Operations Gateway deployed PASS run `37815507761`; Agent v122 prerelease technical build/release PASS run `37815507718`. The isolated 404 is **not independently root-caused**, possibly initial propagation; post-secret bounded verification is durable protection. Provider-authenticated read/actual Billing coverage/ZIP content and field ACK/WMS/HA parity remain **NOT YET VERIFIED**, thus D166 is still open and not Owner PASS. D165 Agent v120 remains accepted deployed PRIMARY; v122 is manual standby-only candidate, never automatic fleet update or Stable.

### 2026-10-09 — D166 v122 field NOT PASS: USAGE ZIP provider_not_ready

Owner reported the v122 Agent field test failed repeatedly at approximately 00:27 and 00:33 Vietnam time with `D166 USAGE ZIP export=DEFER reason=D166_PROVIDER_NOT_READY` instead of creating a ZIP. The reported WMS reload barrier completed and Agent log upload showed PASS; these events are **not proof of a picklist/failover defect**. Source analysis identified `collectD166UsageExport_` in the existing Beta Apps Script Gateway invoking `d166CloudflareNumber_` without any definition. When successful/partial Cloudflare hourly rows are attached, Apps Script throws a ReferenceError, returns `{ok:false,...}`, and Agent v122 masks the underlying error behind `D166_PROVIDER_NOT_READY`. Repair under the SAME D166: restore a strictly nonnegative finite numeric parser, null/N/A preservation, defensive hourly payload guards; add real Gateway JS mocked-worker regression (OK and HTTP429/partial). **No Agent EXE or Worker business logic changes; deploy only the existing scoped Apps Script Gateway via protected branch/PR/CI.** Owner must retry v122 ZIP and validate Cloudflare sections before D166 Owner PASS. Stable and D165 accepted PRIMARY v120 remain unchanged. Exact original Apps Script error not captured in field logs, so missing function is verified code defect and primary causal hypothesis, not an independently confirmed runtime exception.

### D166 Gateway-only field repair technical PASS (09/10/2026)

Owner-reported three v122 ZIP failures `D166_PROVIDER_NOT_READY` motivated server-only correction. [PR #514](https://github.com/tamnv2/supra-inventory/pull/514) merged commit `4600acca2b7e2934480006bc31a0329816553aba`. Gateway missing helper `d166CloudflareNumber_` was restored with null/nonfinite/negative value guards; a real Code.gs VM regression verifies Cloudflare valid hourly numbers (7 requests, 0 errors, 2 subrequests) and worker 429/billing 403 partial fallback. PR CI 14/14 required executing checks PASS; existing scoped Beta Apps Script Gateway deploy [run 37818739635](https://github.com/tamnv2/supra-inventory/actions/runs/37818739635) PASS, REST in-place deployment revision verified and harmless live D165 pre-auth handler PASS. No Agent binary build, Cloudflare Worker mutation, new secret, additional polling, business logic, or Stable deployment. **Authenticated live D166 export data and Owner field acceptance remain unverified: D166 still NOT PASS until Owner retries the unchanged v122 on standby and sends ZIP/status.** D165 accepted v120 PRIMARY preserved.


### 2026-10-09 — D166 Owner direction: v122 accepted as next Agent base, v123 logging-only; three-day usage audit

Owner explicitly selected Agent v122 as the **official development and release baseline** for successor v123; the earlier v120 baseline remains historical D165 acceptance, not the code branch for future Agent builds. This is a scoped Owner baseline selection, **not an assertion** that prior v122 manual Usage ZIP `D166_PROVIDER_NOT_READY` successfully passed field replay. Re-test the ZIP independently. The active serial workstream stays **D166**, not a new D167.

Owner approved: preserve detailed sanitized 06/10 and 08/10 usage analyses in `docs/D166_USAGE_AUDIT_2026-10-06_08.md` and compare with 09/10; identify Firestore document-read attribution through code/log analysis; **only implement diagnostics/logging enhancements** in Agent v123 derived from v122 and in the existing Android/Web support-log surfaces. Do not touch Firestore/RTDB Rules, Firebase business request cadence, WMS confirmation, Agent HA lease/role/PRIMARY, UI realtime logic, session/ACK, background schedule, Worker/DO SQL or any application workflow. **Usage optimization repairs remain design proposals only**, pending later explicit Owner instruction.

Local counters may count existing API/Firestore attempts by safe method/component and hour, classify outcomes, retries, elapsed time, listener/fallback transitions and bounded UI events. Only attach to the **existing scheduled/manual/crash log payload**; no additional per-event provider writes, polling, timers, listeners, connectivity probes, log-upload intervals or persistent local writes. Small bounded metadata will necessarily add some bytes to existing log bodies; describe this honestly, do not promise literal zero bytes or call estimated reads billable reads. Redact secrets/PII and do not log raw document IDs, Picklist codes, SKU, WMS/session payload or query arguments. Resource scope stays Beta; Stable OWNER-GATED. Branch → PR → authority + continuity + security/Agent/Android/Web regression gates → merge; field trial and release permission remain separate.

### 2026-10-09 — D166 Owner backlog: Android Báo hàng bắt buộc cập nhật, không “Để sau”

**Owner-approved requirement (BACKLOG ONLY, not permission to deploy):** Mỗi khi có APK Báo hàng mới được phát hành hợp lệ cho kênh/phạm vi áp dụng, Android APK cũ phải khóa sử dụng, không hiện và không cho lách “Để sau”, “Bỏ qua” hay tiếp tục nghiệp vụ. Áp dụng cả app đang đăng nhập sau khi nhận diện phiên bản mới ở ranh giới an toàn; tuyệt đối giữ đúng kết quả thao tác/ACK đang dở, không sinh submit trùng. Với hủy cài đặt, lỗi mạng/tải/cài, sai checksum/chữ ký hoặc chưa xác minh được nguồn, tiếp tục fail-closed và cho Thử lại/hướng dẫn xử lý, không mở lại phiên bản cũ. Không kích hoạt cưỡng chế từ draft/prerelease/chưa duyệt kênh; bảo toàn D039/D055 canonical signed release/version gate và giới hạn kiểm tra để không tăng read/polling/usage bất thường. **Chỉ APK Báo hàng Inventory Beta**; không ngầm áp dụng Launcher/Quản lý PDA/Agent/Web hoặc Stable. Chi tiết kịch bản và acceptance: `docs/D166_APPROVED_BACKLOG.md` và `docs/specs/ACCEPTANCE_TESTING.md`. Đây chỉ là thêm hạng mục cho **cùng D166**; chưa sửa runtime/build/release, cần Owner duyệt phương án tác động trước khi triển khai.


### 2026-10-09 — D166 Owner bổ sung: điều tra và sửa lỗi hai thư mục Logs trùng ngày

**OWNER APPROVED BACKLOG ONLY, chưa chấp thuận runtime mutation.** Owner yêu cầu tìm nguyên nhân thực và xử lý triệt để hiện tượng cùng `Inventory/Beta/Logs` có hai folder `YYYY-MM-DD` khác Drive ID, khiến Web/Android/Agent logs có thể bị chia giữa hai folder. Nguồn hiện tại tồn tại hai đường `LIST -> CREATE -> LIST`: Worker `resolveRuntimeLogDailyFolder` và Agent Apps Script `resolveDailyLogFolder_`, với cache/lock riêng, chưa có distributed atomic authority. Đây là **verified concurrency risk**, không phải chứng minh nguyên nhân field. D166 phải điều tra parent ID, actor, createdTime, upload path, retry, cache, quyền truy cập và deployment; đề xuất một canonical folder identity xuyên các luồng, xử lý chống tạo trùng và hậu kiểm idempotent `bundle_id` với `DRIVE_SYNCED` thực, không mất log. Folder lịch sử có dữ liệu chỉ lập inventory/kế hoạch hợp nhất; không tự xóa/chuyển trước Owner approval. Không thêm polling/log storm, không động Stable hay project khác. Full requirement and test gate: `docs/D166_APPROVED_BACKLOG.md#d166-log-folder-duplicate--tìm-nguyên-nhân-và-xử-lý-dứt-điểm-hai-thư-mục-log-trùng-ngày`.


### 2026-10-09 — D166 Owner yêu cầu ghi thêm bốn phương án để phân tích sau (BACKLOG ONLY)

Owner yêu cầu bổ sung vào **cùng D166**, không bắt đầu triển khai: (1) cùng một setting số phút cho sửa trạng thái `Đã có hàng` và `Cho phép Skip` (ví dụ 15 phút), quá hạn thì **ẩn nút Sửa trên Web và Android**, API vẫn buộc deadline; (2) thay `Kết quả gần đây` trên **Web** bằng năm tab `Đang xử lý / Quá hạn / Đã có hàng / Cho phép Skip / Picker đã thu hồi`, giữ Android tab set hiện hành; (3) **nghiên cứu** Agent ổn định sau startup mở thêm trình duyệt Supra, xuất file SKU và nhập vào Inventory một lần/ngày, xác nhận thật mới DONE, thiết kế đầy đủ xử lý lỗi/đa Agent/HA/retry; (4) nghiên cứu Web hiển thị **khu vực lưu SKU tại thời điểm báo** (LTA/Shelving) và phân tích báo hết hàng theo khu vực, tái thiết kế báo cáo tổng quan/chi tiết. **Chưa chốt giải pháp, code, nguồn vị trí, xác thực, quota, quyền provider hay rollout.**

Ranh giới quan trọng: D126 đang **cấm tự động Supra/WMS SKU sync**, D002 chỉ cho **SKU + tên**. Các quy định này giữ nguyên cho runtime hiện tại; yêu cầu hôm nay **chỉ cho phép ghi backlog và phân tích về sau** chứ không ngầm bãi bỏ các quy tắc cũ hoặc ủy quyền truy cập/sử dụng dữ liệu vị trí WMS. Giữ Web/Android/Agent chức năng cũ, WMS confirm/ACK/HA và Stable OWNER-GATED. Điều kiện phân tích/phê duyệt được viết rõ trong `docs/D166_APPROVED_BACKLOG.md` và các spec liên quan.
