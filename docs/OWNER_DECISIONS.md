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
| D044 | ACTIVE | Web + Android visual/product baseline is **Legacy Operational UI V2**. The prior Báo hàng 1291 product is an approved business/UX reference for operational density, role separation, SKU prominence and fast actions only. Reimplement cleanly on current architecture; never import its legacy backend/resources/credentials or out-of-scope stock/bin/location features. |
| D045 | ACTIVE | Picker PDA uses vertical operational composition: compact header/tools, large SKU input, prominent selected SKU + product name block, full-width `BÁO HẾT HÀNG`, then today history/status cards. Do not compress SKU input and the primary report action into one narrow row. Existing server dedupe, batch grouping and 60-second withdrawal remain authoritative. |
| D046 | ACTIVE | Reporter PDA keeps the four business-state filters `Đang xử lý`, `Đã có hàng`, `Đã cho skip`, `Picker thu hồi`, but pending cards prioritize SKU/product, affected Picker count, first-report/waiting/SLA context and two large actions. Picker detail expands without shrinking the primary actions. Skip uses an explicit impact confirmation. |
| D047 | ACTIVE | ADMIN/ROOT on PDA must have a concise operational launcher/menu and must not be rendered as only Reporter. It groups role-allowed entries under Vận hành / Quản trị / Hệ thống; deep HR/Master SKU/reporting administration remains Web-first. |
| D048 | ACTIVE | Foreground realtime is upgraded from refresh-style invalidation to monotonic event sequence + bounded delta recovery. Realtime frames carry sequence/event/scopes plus batch/version identity where relevant. Clients patch affected operational state, detect sequence gaps, fetch deltas after `last_seq`, and use full authoritative reconcile only as fallback. Database remains transaction authority. |
| D049 | ACTIVE | Critical Picker results `HAS_STOCK` and `SKIP_ALLOWED` require explicit user acknowledgement tracked by target Picker + notification event + batch/version. Delivery lifecycle distinguishes server event/attempt, client received, displayed and acknowledged. ACK is idempotent and audit/telemetry only; notification failure never rolls back a committed business resolution. |
| D050 | ACTIVE | SLA is operational warning/escalation only and must never auto-resolve or auto-Skip. Server derives waiting/SLA state; UI exposes attention/escalation and Admin/Root gets configuration. D007 ordering remains canonical until a separate exact scoring formula is explicitly approved. |
| D051 | ACTIVE | Resolved shortage episodes are immutable. A later report for the same SKU creates a new processing batch episode linked through `previous_batch_id`; recurrence context may show prior resolution time/elapsed interval. Do not reopen/mutate an old finalized batch as the new episode. |
| D052 | ACTIVE | Product support diagnostics are redacted and bounded. They may include app/build/device/platform, network/service reachability, realtime state/last sequence, catalog version and recent errors, but never passwords, session/access/refresh tokens, Firebase/Google credentials, signing material, private keys or other secrets. |
| D053 | ACTIVE | `CHO SKIP HÀNG` is a deliberate two-step business action: first tap opens a confirmation that names the SKU/product and affected Picker count; second explicit confirmation commits. No password/OTP is required for normal Reporter Skip. |
| D054 | ACTIVE | Web information architecture is operational-first. Reporter opens/focuses on the dense live queue. Admin/Root group functions into Vận hành, Dữ liệu, Quản trị, Báo cáo and Hệ thống. Dashboard/reporting remains available but must not displace the live Reporter queue. |
| D055 | ACTIVE | Android mandatory-update hardening retains versionCode + APK SHA-256 verification and should additionally verify canonical package/signing identity where supported by the current release pipeline. This hardening must not weaken Android installation security or require legacy updater architecture. |

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
| O002 | OPEN | Final policy for one account using one vs multiple simultaneous devices/sessions. |
| O003 | OPEN | Final Root MFA/recovery design for Stable. |
| O004 | OPEN | Final reporting/export columns and exact Reporter dashboard visibility beyond the core queue. |
| O005 | OPEN | Final Stable password KDF/rate-limit/account-lock policy. |
| O006 | CLOSED | Closed by D043 on 2026-09-17: no offline business mode or offline report creation is permitted. |

## Owner acceptance rule

Technical CI PASS does not equal Owner business acceptance. Owner may accept with numbered feedback such as `1 OK, 2 chưa OK...`; only explicit Owner acceptance should be recorded as accepted behavior for release/promotion decisions.
