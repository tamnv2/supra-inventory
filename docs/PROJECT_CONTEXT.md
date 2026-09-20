# PROJECT_CONTEXT — SUPRA Inventory

Status: **CANONICAL PROJECT CONTEXT**. Read this before any project work.

## Identity

- Project key: `supra-inventory`
- Product name: `SUPRA Inventory — Báo hàng`
- Canonical GitHub repository: `tamnv2/supra-inventory`
- GitHub repository ID: `1372407002`
- Default branch: `main`
- Timezone: `Asia/Ho_Chi_Minh`
- Repository visibility: Public

This project is independent. Never import scope, credentials, resources, or architecture from Pick Pack 1291, Pickface Damage 1291, SupraCore, VHDCHY, or any other project. The prior Báo hàng 1291 product may be used only as the Owner-approved business/UX reference defined by D044; its legacy resources/backend remain out of scope.

## Product scope

The product manages the **SKU out-of-stock reporting and resolution workflow**.

In scope:
- SKU + product name master data.
- Picker reports that a SKU is out of stock.
- Reporter processing queue and resolution.
- Critical Picker result acknowledgement.
- Realtime event/delta synchronization, SLA warning/escalation and shortage-episode recurrence tracking.
- Admin/Root operations, HR source, account management, dashboard/reporting, archive/retention.
- Web + Android/PDA clients.
- Server-authoritative realtime synchronization.

Explicitly out of scope unless Owner reopens it:
- bin/location/pickface inventory management;
- stock quantity management;
- Office-network fallback/provider research for the Báo hàng transaction path.

D073 bounded exception: Beta may test an **online** Firebase Realtime Database relay for the new Picker `Xác nhận lấy hàng` capability. PDA remains on the Internet-capable PDA network; a Windows user-mode Agent may run on either PDA Internet or Office network and exchange test request/ACK through Google. This does not create offline Báo hàng, direct-to-Sheet fallback, or any WMS mutation during the POC.

Explicitly out of scope by active Owner decision D043:
- any offline business mode;
- offline report creation or offline mutation outbox;
- direct-to-Sheet business fallback or any alternate offline transaction path.

## Roles

- `PICKER`: MNV-based operational user; reports out-of-stock SKU, views own reports, may withdraw an unresolved mistaken report within 60 seconds and acknowledges critical final results.
- `REPORTER`: processes the priority queue; resolves `HAS_STOCK` or `SKIP_ALLOWED`; may correct `SKIP_ALLOWED` to `HAS_STOCK` within five minutes.
- `ADMIN`: inherits Reporter operations; manages Reporter accounts, Picker provisioning from HR, Master SKU, dashboard/reporting, allowed settings/SLA/system functions.
- `ROOT`: highest application role; inherits Admin/Reporter operations and manages Admin accounts. ROOT is protected from normal subordinate management flows.

The service is authoritative for identity, role, deadlines and state transitions. Client-supplied role is never trusted.

## Runtime topology

`Web / Android PDA → Cloudflare Worker → InventoryCore Durable Object → SQLite`

Supporting systems:
- Firebase Authentication for application identity/session exchange.
- Firebase Cloud Messaging for background notifications.
- Google Sheets as Admin/Root-configured HR source.
- Google Drive/Sheets for batched archive/supporting exports.
- GitHub for code, durable Owner decisions, specifications, work state and CI/deploy evidence.

There is no offline transaction topology.

## Environment identity

### Beta
- GCP/Firebase project: `supra-inventory-beta`
- Worker: `supra-inventory-beta`
- Host: `inventory-beta.supra.cc.cd`
- Android package: `cd.cc.supra.inventory.beta`
- Durable Object: `InventoryCore`
- Current SQLite schema and build/release status: **read `ops/project-state.json`; do not copy a version number from this document.**

### Stable
- GCP/Firebase project: `supra-inventory-stable`
- Worker/config name: `supra-inventory-stable`
- Host: `inventory.supra.cc.cd`
- Android package: `cd.cc.supra.inventory`
- Stable is **OWNER-GATED**. Configuration may exist; deployment/provisioning/public traffic/real-user bootstrap/Stable release requires an explicit current Owner command.

## Canonical authority graph

Read in this order before mutation:
1. Current explicit Owner command in the active conversation.
2. `AGENTS.md`.
3. `docs/PROJECT_CONTEXT.md` — identity and product boundary.
4. `ops/project-scope.json` — exact external-resource scope by ID/name; unlisted resources are out of scope.
5. `ops/project-state.json` — live work state: done / in-progress / next / blockers / runtime evidence.
6. `docs/OWNER_DECISIONS.md` — durable Owner-approved decisions and open decisions.
7. `docs/specs/` — approved product forms, workflows and design system.
8. `ops/resource-registry.json` — resource aliases/identifiers and environment status.
9. Current source code + recent commits + CI/deploy evidence.
10. Generated/derived views such as `docs/handovers/HANDOVER_CURRENT.md` and `docs/SERVICE_READINESS.md`.
11. Chat memory/old handovers are retrieval aids only and never override current repo authority.

If canonical sources conflict in a way that could change behavior or target resources, fail closed and reconcile before mutation.

## Continuity contract

GitHub is the durable project memory. Chat is the control surface, not the source of truth.

Every Owner-approved requirement must be captured in GitHub in the same workstream. Every meaningful implementation change must update project state in the same change set. Generated summaries are never manually authoritative.

## Resource scope authority

`ops/project-scope.json` is the canonical external-resource boundary. Every listed resource carries an exact known ID when appropriate, otherwise a canonical name plus an ID source. An unlisted provider project/app/worker/folder/sheet/domain is outside project scope until Owner-approved and added to the manifest.

## D080 bounded company-WMS POC exception

For the `Xác nhận lấy hàng` workstream only, D080 adds the registered external company endpoints `wms-supra.winmart.vn`, `api-supra.winmart.vn` and corporate proxy fallback reference to project scope for a read-only Agent connectivity/session proof. This does not import SupraCore as a project dependency and does not authorize WMS mutation. D018 remains unchanged for the normal Báo hàng runtime; the exception is bounded to D073–D080 confirmation-path research.

## D082 bounded read-only Picklist lookup extension

D082 extends the D073–D081 confirmation-path exception only far enough to verify Picklist existence. The existing Beta RTDB PDA ↔ Agent transport remains in use for the home test. The registered Supra API scope now includes the signed read-only Picklist-list GET; confirmation/mutation remains outside authority. The Owner-supplied WMS confirm page is a reference location only and is not an authorized action endpoint.

This does not reopen Office-network fallback for the normal Báo hàng transaction path. D078 Office transport testing remains a separate physical-company-network checkpoint.

## D084 all-date PickListCode lookup refinement

D084 keeps the same registered read-only WMS endpoint and existing Beta RTDB transport, but changes the lookup mechanics: no WMS date filter, `Content` remains empty, pagination is 100 records per page, and only the exact `PickListCode` field is evaluated. Values must follow the `PL` + digits form; the PDA's exact five digits are compared only with the trailing five digits of `PickListCode`. The Agent scans pages until match/exhaustion and fails closed on unsupported schema or broken pagination. D084 also makes overlay opacity/lock explicit settings while preserving locked click-through behavior. No WMS mutation is authorized.

## D085 sticky Agent HA and lookup protection

D085 does **not** choose the final PDA ↔ Agent transport. The existing Beta RTDB path remains the temporary implementation while D078 Office transport evidence is pending. The new coordination semantics are transport-independent product requirements: one sticky WMS-ready active Agent, 10-second failover to a standby, no-Agent guidance to the specialist desk, persistent Picker anti-spam locks, startup Picklist cache and user-mode Agent autostart.

WMS session reuse is based on the dedicated browser profile with raw captured request/session values held only in Agent RAM. D085 does not authorize confirmation or any WMS mutation. Stable remains OWNER-GATED.

## D086 current Windows Agent direction

D086 supersedes D085 only for local Windows Agent session/UI/lifecycle mechanics.

- Captured HY1 WMS request-session material may be persisted **only** in a DPAPI `CurrentUser` encrypted local file on the authorized company/user laptop. Company WMS username/password remain browser-only.
- Startup order is file-first read-only validation → all-date Picklist preload → continue without browser when valid; otherwise clear unusable local state and open the dedicated browser locally for reacquisition. Successful real preload/refresh renews the encrypted file.
- Agent shell is `Tổng quan / Cài đặt`; Overview keeps Supra login/ready, connection status and concise model information, while ADMIN auth/tests/overlay/logs are settings.
- Locked overlay must pass mouse input to the actual application below it.
- Agent is intended to live for the Windows user session: no normal close-box, ADMIN-password protected graceful exit, HKCU autostart and a best-effort sleep-only watchdog. User-mode software cannot truthfully guarantee protection against the same user killing both Agent and watchdog.
- Background UI monitoring is coarse to protect weak laptops. D085's 3-second HA heartbeat remains required for the approved 10-second failover.
- D078 final PDA-Agent transport choice remains pending; current RTDB is unchanged. WMS remains GET-only and Stable remains OWNER-GATED.

