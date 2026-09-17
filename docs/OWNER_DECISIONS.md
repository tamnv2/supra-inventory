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
| D007 | ACTIVE | Reporter queue priority: more currently affected Pickers first; if equal, earlier first report first. |
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
| D024 | SUPERSEDED | Earlier unified visual direction was Concept 3. Superseded by D036, Owner-selected Practical Balanced / Phương án 1. |
| D025 | ACTIVE | Admin/Root Web uses an operational dashboard and detailed reporting flow. Dashboard is a compact decision overview with one shared date filter, core KPI cards, report/resolution trend, outcome breakdown, and top reported SKUs; detail is drilled into the Reporting view. Reporting supports date/status/SKU filters, pagination and explicit chunked CSV export. Do not add unapproved stock quantity/location metrics or individual employee performance scoring. Avoid aggressive polling/auto-refresh; authoritative realtime invalidation and explicit refresh remain preferred to protect runtime quota. |
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
| D036 | ACTIVE | Unified Web + Android visual direction is **Phương án 1 — Thực dụng cân bằng**, superseding Concept 3. Prioritize screen area and interaction speed for Picker/Reporter SKU/report workflows; Admin/Root management remains complete but secondary. Use light neutral surfaces, green primary, orange warning, red destructive, consistent Roboto/Noto Sans/system-sans typography, business-relevant package/SKU-alert icons, explicit business navigation labels, and the small centered footer `Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291`. Mockup-only maps, orders, stock quantities, incident photos or unrelated features are forbidden. |
| D037 | ACTIVE | HR synchronization no longer auto-disables/deletes Picker accounts absent from a newly configured source and no longer auto-reactivates a Picker deliberately disabled by Admin/Root. After provisioning, Admin/Root controls Picker lifecycle explicitly: select one, many or all Picker accounts and `Mở lại`, `Ngừng hoạt động`, or `Xóa Picker`. Deleting a Picker account must not erase historical report/audit records. |

## Superseded historical state

- Early handovers described the project as design-only or infra-only. Those status statements are `SUPERSEDED` by live repo evidence and `ops/project-state.json`.
- Older handover v3 stated Web/Android business implementation had not started and APK signing was pending. This is `SUPERSEDED` by later Beta app/auth/signing work.
- Handover v4 recorded schema v2 and Core Business APIs as the next build frontier. This is `SUPERSEDED`: live registry is schema v5 and the business API foundation is deployed.
- Earlier exploration of Office fallback providers is `CLOSED` by D018.
- The initial 5,000-row implementation cap for SKU import was a temporary technical limit and is `SUPERSEDED` by D021.
- The fixed HR-header assumption from D013 is `SUPERSEDED` by configurable source-column mapping in D033.
- The old account hierarchy/default-reset/auto-disable behavior from D023 is `SUPERSEDED` by D034, D035 and D037.
- Concept 3 visual authority from D024 is `SUPERSEDED` by Practical Balanced / Phương án 1 in D036. Dashboard/reporting business structure from D025 remains active independent of visual skin.

## Open decisions — do not invent

| ID | Status | Question |
|---|---|---|
| O001 | OPEN | SKU reset confirmation was described as random “6 chữ”; exact semantics (6 characters vs 6 words/other) are not yet Owner-confirmed. |
| O002 | OPEN | Final policy for one account using one vs multiple simultaneous devices/sessions. |
| O003 | OPEN | Final Root MFA/recovery design for Stable. |
| O004 | OPEN | Final reporting/export columns and exact Reporter dashboard visibility beyond the core queue. |
| O005 | OPEN | Final Stable password KDF/rate-limit/account-lock policy. |
| O006 | OPEN | Creation of a brand-new business report while fully offline is not approved. Do not add direct-to-Sheet or another offline primary path without an Owner decision. |

## Owner acceptance rule

Technical CI PASS does not equal Owner business acceptance. Owner may accept with numbered feedback such as `1 OK, 2 chưa OK...`; only explicit Owner acceptance should be recorded as accepted behavior for release/promotion decisions.
