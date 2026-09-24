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
