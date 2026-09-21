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

## D086 release checkpoint

D086 Windows Agent v11 is technically released on Beta source authority.

- PR #92 merged to `main` at `207a57be6c4d95ab48d174b8af154f122bec7c5e`.
- Main `Verify Beta Relay Agent` run `35490227885` PASS, including v11 build, D086 regression guard and Windows startup-smoke.
- Main `UI Design Guard` run `35490227907` PASS.
- GitHub prerelease: `relay-agent-v11`, release id `392316320`.
- EXE asset id `576140376`, size `148992` bytes, SHA-256 `dce3a779c86096a6a82ed1991e385e7e6acea2d9ba75078e8bf2371eb1387659`.
- Signed Android remains `beta-vc52`; no Android rebuild was required by D086.
- Next physical checkpoint is Owner review of UI, DPAPI WMS session file-first reuse/browser fallback, true click-through overlay, protected ADMIN exit, watchdog behavior and weak-laptop idle CPU/RAM. D085 multi-Agent failover/cache/anti-spam may be verified in the same field cycle.
- D078 final PDA ↔ Agent transport remains pending physical Office evidence. Current RTDB carrier remains temporary. WMS confirmation/mutation remains forbidden. Stable remains OWNER-GATED.



## D087 Agent v12 source candidate

Owner field review of v11 exposed an overlay initialization failure while ADMIN restore, DPAPI WMS session restore, Picklist preload and relay lookup remained operational. D087 repairs that local UI defect and adds the approved Agent observability refinements.

- Two local sanitized log streams: PDA↔Agent audit and AI technical diagnostics.
- Main window has no X but has minimize-to-taskbar; protected shutdown remains unchanged.
- Two-row overlay: local laptop Task-Manager-style metrics and Agent status.
- Global synchronization is intentionally limited to tiny Agent-presence metadata; per-machine APK/response counters are RAM-only.
- Presence cadence is 30s write / 60s read / 90s freshness on the existing temporary Beta RTDB carrier.
- D078 final transport choice remains pending physical Office evidence; WMS is read-only and Stable remains OWNER-GATED.


## D087 release checkpoint

D087 Windows Agent v12 is technically released on Beta source authority.

- Runtime/code PR #94 merged to `main` at `8b0e3ec3fd1a6fffea09e3f4aafd43e544625f58`.
- Final PR gates PASS: Project State `35495453237`, Repo Authority `35495453239`, Beta RTDB Rules `35495453228`, Verify Beta Relay Agent `35495453233`, UI Design `35495453255`, Android verify `35495453242`.
- GitHub release tag `relay-agent-v12` exists and resolves to Agent VERSION `12`.
- Exact v12 binary asset id/size/SHA is not recorded here because the connected GitHub capability did not expose release-asset metadata; do not infer or copy v11 values.
- Signed Android remains `beta-vc52`; `beta-vc53` is absent. D087 therefore does not force an unnecessary PDA update.
- D087 split sanitized PDA↔Agent audit from technical-AI diagnostics, repaired retryable overlay initialization, restored minimize-to-taskbar without X, added two-row Laptop/Agent overlay and bounded Agent-online presence. Per-machine APK/response counters remain RAM-only.
- Next physical checkpoint is Owner review of released v12 on the company laptop/PDA.
- D078 final PDA ↔ Agent transport remains pending physical Office evidence. Current RTDB carrier remains temporary. WMS remains GET-only; Stable remains OWNER-GATED.

## D088 current implementation checkpoint

Owner approved a coordinated Beta naming/session/tools/Agent presentation update on 2026-09-20.

- Web user-facing product name: **Website nghiệp vụ Inventory**.
- Android Beta app: **1291 Beta**.
- Windows Agent: **Agent Auto Confirm Pick Pack**, target `relay-agent-v14`.
- Web + Android now have a server-authoritative one-interactive-session generation with persistent local session restore. A fresh Web/Android login replaces prior Web/Android sessions for the account; Agent uses a separate real-ADMIN channel so D085 multi-Agent HA is preserved.
- Admin/Root Web adds `HỆ THỐNG → Công cụ` with the v14 Agent direct download and usage guidance.
- Agent minimize is System-Tray-only. Overlay unlocked mode gains resize plus full background/text color selection; locked mode remains true click-through.
- Web/Android/Agent share the Owner-selected icon #4 motif.
- SQLite source schema target advances from 7 to 8 only for the additive session-generation fields.
- D078 final PDA ↔ Agent transport remains pending physical Office evidence; current RTDB is temporary. WMS remains GET-only; Stable remains OWNER-GATED.

Implementation branch: `feat/d088-unified-brand-single-session-tools-overlay`. D088 technical/runtime/release gates are now PASS; exact final evidence is recorded below.


### D088 release-asset repair note

The first merged D088 run published transitional `relay-agent-v13`, but GitHub normalized spaces in release asset filenames to dots. That made the Web direct URL and the v13 exact-name updater contract inconsistent. No field-download acceptance was recorded for v13. D088 therefore advances the final Agent target to `relay-agent-v14`, whose updater expects GitHub's actual normalized asset name `Agent.Auto.Confirm.Pick.Pack.exe` while the Windows assembly/product title remains **Agent Auto Confirm Pick Pack**. Signed Android `beta-vc53` and Beta schema 8/runtime deploy from main `8084928724110e7186867b8b16d79462134951aa` are already PASS.


## D088 final release checkpoint

D088 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta; Owner physical acceptance remains pending.

Final source/runtime authority:
- Runtime implementation PR #96 merged at `8084928724110e7186867b8b16d79462134951aa`.
- GitHub release-asset normalization repair PR #97 merged at final main `48367c46b20405c48abb6ed8c0b59601defe1130`.
- Final main Beta deploy run `35506093272` — PASS, including Web/service production deploy and SQLite schema 8.
- Final main UI Design Guard `35506093215` — PASS.
- Final main Repo Authority Guard `35506093253` — PASS.
- Final main Project State Guard `35506093199` — PASS.
- Final main Verify Beta Relay Agent `35506093283` — PASS, including Windows build and startup-smoke.

Android Beta:
- signed release `beta-vc53`;
- release id `392397786`;
- product name **1291 Beta 0.2.0-beta.53**;
- APK asset id `576632055`, size `9333938` bytes;
- SHA-256 `7cc0f5ec8ae0a9c7e61a985fcb8dcb32cb7e72934407efb4f19a0c7810875fa3`.

Windows Agent:
- final release `relay-agent-v14`, release id `392399976`;
- Windows product/assembly name **Agent Auto Confirm Pick Pack**;
- GitHub-normalized canonical release asset `Agent.Auto.Confirm.Pick.Pack.exe`;
- asset id `576644961`, size `168448` bytes;
- SHA-256 `1aa847dec7e38dc1e67c5d9291ea3cb153ad89cb1afa5eac2ff6ee16b7c2adc2`;
- Web `HỆ THỐNG → Công cụ` and v14 updater both target this exact published asset contract.

D088 closes O002 for current Beta: Web + Android use one persistent server-authoritative interactive session per account; Agent auth remains separate to preserve approved multi-Agent HA. D078 final transport remains pending physical Office evidence, current RTDB remains temporary, WMS remains GET-only, and Stable remains OWNER-GATED.

## D089 field-review repair

Owner field review of D088 found five corrective items on 2026-09-20:

- the deployed icon was a generated approximation instead of the selected icon #4 image;
- authenticated HTTP APIs were healthy while the header falsely displayed service loss because realtime was offline;
- Agent overlay needed a master visibility control and granular per-metric Laptop/Agent choices;
- normal Agent startup needed a per-user single-instance contract;
- the Web Tools page still contained light surfaces in dark theme.

D089 implements those corrections on Beta only. The approved image is committed once as the common brand source and consumed by Web/Android/Agent. Service health is no longer derived from WebSocket state. Agent v15 is the release target and the next signed Android Beta release is pending CI/main runtime gating. D078 transport selection remains pending physical Office evidence; WMS mutation remains forbidden; Stable remains OWNER-GATED.


## D089 final release checkpoint

D089 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta; Owner physical field re-test remains pending.

- Runtime implementation PR #99 merged to `main` at `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Final PR gates all PASS: Repo Authority `35528500471`, Project State `35528500466`, RTDB Rules `35528500468`, UI Design `35528500465`, Relay Agent `35528500524`, Android `35528500467`.
- Final main gates all PASS: Beta Worker `35528647549`, UI Design `35528647554`, Repo Authority `35528647571`, Project State `35528647574`, Relay Agent `35528647534`, Android `35528647526`.
- Signed Android release is `beta-vc54` (release id `392528497`), APK asset id `577316797`, size `9340834` bytes, SHA-256 `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.
- Windows release is `relay-agent-v15` (prerelease id `392528472`), canonical asset `Agent.Auto.Confirm.Pick.Pack.exe`, asset id `577316714`, size `177152` bytes, SHA-256 `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- Exact selected icon #4 now comes from a verified committed PNG binary shared by Web/Android/Agent; the previous generated approximation is no longer authoritative.
- Web API service reachability is independent from realtime state; Tools dark theme, overlay visibility/checklists and Agent single-instance behavior are source/build/release PASS.
- Next checkpoint is Owner field re-test `OA011`.
- D078 final transport remains pending; current RTDB is temporary. WMS remains GET-only. Stable remains OWNER-GATED.


## D089 Owner acceptance checkpoint

On 2026-09-21 the Owner confirmed the released D089 field result **PASS / đã đạt**. D089 is therefore the current Owner-accepted Beta baseline.

Accepted baseline:
- Web + Android + Agent use the approved icon #4 identity.
- Web Service/API health is independent from realtime synchronization state.
- Tools dark-theme completion is accepted.
- Agent Overlay visibility, granular metric selection, resize/colors/lock/click-through persistence are accepted.
- Agent duplicate-launch single-instance restore behavior is accepted.

Current accepted artifacts:
- signed Android: `beta-vc54`;
- Windows Agent: `relay-agent-v15`;
- D089 runtime source: `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`;
- D089 release-state checkpoint main: `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`.

No D089 field retest remains open. Future work starts from a fresh canonical GitHub bootstrap and the Owner's next explicit requirement. D078 final transport remains pending; WMS remains GET-only; Stable remains OWNER-GATED.

## D090 Office transport boundary

Owner physical Office testing on 2026-09-21 closes the Cloudflare-probe branch for the confirmation workstream. The Office network is treated as an allowlisted environment that reaches internal Supra services and selected Google services only.

For PDA ↔ Agent confirmation transport:
- do not continue testing the Cloudflare Worker/custom project host from Office;
- Firebase RTDB is excluded as the Office carrier because the corporate proxy repeatedly returns 403;
- Firebase Auth and several Google API hosts are reachable;
- replacement research is narrowed to Google-hosted candidates, with Firestore the preferred candidate from D078 but still requiring an authenticated Beta relay proof before final selection;
- current RTDB may remain temporary on Internet-capable networks only;
- no new relay resource is adopted until canonical scope/resource files are updated;
- WMS remains GET-only and Stable remains OWNER-GATED.

## D091 Firestore field candidate

The confirmation workstream now implements the first real Google-hosted replacement candidate rather than performing another host probe.

D091 test topology:
`Picker Beta → Firestore REST / relay_poc_jobs → one Office Agent v16 → Firestore ACK → Picker Beta`.

The ACK is transport-only. This phase does not call WMS lookup/mutation and does not claim the final D085 multi-Agent architecture. A physical Office round trip is required before Firestore can advance to HA/quota design. Failure of authenticated Firestore operations routes the workstream to Apps Script; Cloudflare/RTDB Office testing stays closed by D090.

## D092 bounded automatic Picklist confirmation exception

Owner field testing confirms the D091 authenticated Firestore PDA ↔ Office Agent round trip works on the company internal Wi-Fi. For the separate `Xác nhận lấy lại đơn` workstream, Firestore is therefore the selected Beta carrier.

D092 extends the registered WMS scope by exactly one mutation: after the approved D084/D085 lookup finds a match and a second fail-closed resolver identifies exactly one full `PickListCode`, the ACTIVE Agent may POST `/sft3-hy1/api/v1/autopp/pickListConfirms/confirmSkipItem` using the fixed HY1 confirmation payload. Firestore provides conditional job claim, sticky Agent coordination, persisted anti-spam state and cross-Agent idempotency/uncertainty guards.

This exception does not authorize broader Supra automation, does not change the normal Báo hàng Cloudflare/InventoryCore architecture, does not create offline mode, and does not touch Stable. Raw WMS credentials/session headers/signatures remain secret runtime material and never belong in the public repo.
