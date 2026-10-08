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

D147 serial acceptance rule: the latest explicit **Owner PASS** is the accepted project base. Only one change ID may be active at a time. Technical/runtime/release PASS is not enough to open the next change. If the current change is not yet Owner-PASS, all unrelated new project mutation fails closed; a NOT PASS result is repaired under the same change ID until PASS. Any proposed mutation that may affect the accepted base requires an impact/risk/affected-component proposal and explicit Owner approval before implementation. D147 itself is governance-only and does not alter the D146 runtime behavior.

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

## D092 technical/runtime/release checkpoint

D092 is technically released on Beta. PR #109 merged to `main` at `130a70ac912739e37caa98647cab60b53a6c0b06`.

Main PASS evidence: Repo Authority `35552139222`, Project State `35552139224`, Firestore Rules `35552139264`, Beta Worker `35552139258`, UI Design `35552139223`, Relay Agent `35552139283`, Android `35552139252`.

Released artifacts: signed Android `beta-vc56` (release id `392647903`, APK asset id `577982221`, size `9340858`, SHA-256 `fe41c136d16470d7b0fac45a4b125b8e1b29610f7b468a4e41171f68c420da80`) and Windows `relay-agent-v17` (release id `392647942`, EXE asset id `577982501`, size `216576`, SHA-256 `ccc0d499c044fb567b34cd37ff1a802293ee9cc47d082a34c4fac2778fe8cd24`).

Technical/runtime/release PASS does not replace physical business acceptance. OA013 is now the next action: one controlled authorized real Picklist confirmation, followed by direct SFT / SFT 3 verification. Stable remains OWNER-GATED.

## D101 Agent v26 operations rework — 2026-09-22

Owner reopened Agent operational UX/cache/log handling after confirming D100 reset recovery. D101 targets `relay-agent-v26` and keeps Stable owner-gated.

- PickList cache MISS is provisional on both PDA and manual specialist paths; Agent refreshes the WMS snapshot once through the existing single-flight coordinator before final NOT_FOUND.
- Agent checks GitHub at startup and every 30 minutes while running, keeping checksum/trusted-origin update guards.
- Agent UI becomes direct top-level tabs: Hệ thống Agent, Hệ thống Supra, Xử lý PickList, Kết nối, Bảng nổi, Nhật ký vận hành, Chẩn đoán kỹ thuật. Manual PickList rows own their Xác nhận button.
- Hệ thống Agent surfaces machine role and low-frequency online/PRIMARY/STANDBY/FROZEN counts. D097 request-driven failover remains unchanged to protect Firestore quota.
- Wi-Fi shows the real Windows SSID; sanitizer token boundaries prevent `ssid=` from being mistaken for secret `sid=`.
- Local Agent logs are size-rotated; scheduled/crash sanitized bundles use an ADMIN-only temporary Firestore spool and Beta Worker drain into Inventory/Beta/Logs.
- Web online totals remain WEB + ANDROID/PDA only; Agent is excluded.

## D101 release checkpoint

D101 Agent v26 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #136 merged to `main` at `25cb7554ff7ea058aa45d72e1ba4824c744c354e`.
- Main gates PASS: Repo Authority `35677556695`, Project State `35677556755`, Beta Worker `35677556693`, Firestore Relay `35677556771`, UI Design `35677556710`, Android `35677556734`, Relay Agent `35677556698`.
- Released Windows Agent: `relay-agent-v26`, release id `393404831`; canonical EXE asset id `580316553`, size `263680` bytes, SHA-256 `5db50633e74247b45305a536a6caf140069626db66a7020acf32cf2d216ff79b`.
- Android remains signed `beta-vc62`; D101 does not require a new PDA release.
- OA021 is the remaining physical Owner acceptance gate for truthful Wi-Fi/HA display, cache-miss WMS refresh, inline PickList confirmation, running auto-update behavior and scheduled/crash Agent log delivery.
- Stable remains OWNER-GATED and untouched.
## D102 Agent v27 operational refinement — 2026-09-22

D102 corrects D101's Agent presentation and multi-Agent convergence without reopening Stable or changing Android/Web business flows.

- Top-level Agent UI returns to one **Tổng quan** containing Agent, Supra and PickList sections; Kết nối/Bảng nổi/Nhật ký/Chẩn đoán remain direct tabs.
- Agent gains a manual trusted GitHub update check in addition to startup + 30-minute background checks.
- D097 business polling/failover stays 5s PRIMARY / 10s STANDBY / 10s pending-job takeover / FROZEN no business poll. Role metadata converges faster through 60s PRIMARY/STANDBY reads, 5m FROZEN reads and a bounded 5s startup burst; presence remains low-frequency metadata.
- The Agent fleet table shows bounded per-Agent identity/machine/role/Supra/version/last-seen data; local hardware metrics are not synchronized globally.
- Daily 21:30 HCM warning repeats every 5 minutes until an explicit continue/stop decision. Without continue, business processing pauses at 22:00; 05:00 resumes automatically. EXE/log/update/watchdog remain running while business processing is paused.
- Target is relay-agent-v27; Stable remains OWNER-GATED.

## D102 release checkpoint

D102 Agent v27 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #138 merged to `main` at `637d7509bcc66f4b57aba4bf4a415cb05c30903d`.
- PR gates PASS: Repo Authority `35682895002`, Project State `35682894986`, UI Design `35682895038`, Relay Agent `35682895029`, Firestore Relay `35682895023`, RTDB Rules `35682895001`.
- Main gates PASS: Repo Authority `35683012628`, Project State `35683012626`, UI Design `35683012670`, Relay Agent `35683012671`.
- Released Windows Agent: `relay-agent-v27`, release id `393435282`; canonical EXE asset id `580448326`, size `271872` bytes, SHA-256 `322159ed214be13d5340fd2a8a826b02232627aa016711c2a46492da1cc819e4`.
- The v27 tag points exactly to merge commit `637d7509bcc66f4b57aba4bf4a415cb05c30903d`. Android remains signed `beta-vc62`.
- OA022 is the remaining physical Owner field gate for real multi-Agent convergence/fleet agreement, manual/background updater behavior, and real 21:30/22:00/05:00 Windows operation.
- Stable remains OWNER-GATED and untouched.

## D103 Agent v28 dense Overview correction — 2026-09-22

Owner field review of v27 found the business logic acceptable but the Overview too tall and text-heavy. D103 is a Beta-only Agent presentation correction.

- Agent opens/restores maximized.
- Tổng quan no longer scrolls as a whole. Agent and Supra are bounded sections; PickList is fixed into the remaining lower viewport.
- Agent fleet viewport is exactly sized for up to five visible rows and uses an internal vertical scrollbar for additional Agents.
- Every manual PickList result retains an inline row-specific Xác nhận button.
- Verbose Agent/Firestore/update/WMS implementation guidance is removed from the visible Overview; compact operational state remains.
- D102 HA/night scheduling and D096/D097 WMS confirmation semantics are unchanged.
- Target is relay-agent-v28; Android remains beta-vc62; Stable remains OWNER-GATED.

## D103 release checkpoint

D103 Agent v28 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #140 merged to `main` at `15aba0412e625af0f6b9ef7489b995a3e524a131`.
- PR gates PASS: Repo Authority `35684714977`, Project State `35684714967`, UI Design `35684714971`, Relay Agent `35684714955`, Firestore Relay `35684714928`, RTDB Rules `35684714958`.
- Main gates PASS: Repo Authority `35684829649`, Project State `35684829653`, UI Design `35684829650`, Relay Agent `35684829660`.
- Released Windows Agent: `relay-agent-v28`, release id `393444068`; canonical EXE asset id `580490417`, size `271360` bytes, SHA-256 `4faf8507637d61d74ac8aa34ba998a1fc04bfacd0fdc572af1cabda5f8bb8cb1`.
- The v28 tag points exactly to merge commit `15aba0412e625af0f6b9ef7489b995a3e524a131`. Android remains signed `beta-vc62`.
- OA023 is the remaining physical Owner field gate for real maximized rendering, fleet viewport/scrolling, PickList row-action visibility and final spacing review.
- Stable remains OWNER-GATED and untouched.

## D104 Agent v29 batched confirmation — 2026-09-22

Owner accepted the D103/v28 physical UI and requested a bounded throughput refinement for the Windows Agent.

- Maximized Agent uses the Windows working area so the taskbar remains visible.
- Manual specialist search accepts up to 10 comma-separated 3–5 digit fragments, deduplicates them and searches all terms against one cache snapshot. A miss triggers at most one shared single-flight WMS refresh for the entire multi-search.
- Row-specific confirmation remains. When >=2 PickLists are displayed, **Xác nhận tất cả** appears and targets exactly the displayed full codes.
- The existing authorized `confirmSkipItem` POST may carry 1–10 exact full PickListCodes per request. Fixed HY1 payload flags and D096 response semantics remain unchanged.
- Concurrent PDA jobs already present in one Firestore poll are handled as a bounded logical batch (max 12), share lookup/exact resolution, retain one guard and one conditional ACK per job, and use WMS confirm chunks of at most 10 exact codes.
- No faster Firestore polling, no extra coalescing query and no PROCESSING write are added. The optimization primarily reduces duplicate WMS lookup/confirm work while preserving Firestore quota behavior.
- User-supplied WMS session/header/signature values are not repo data and are not logged.
- Target is relay-agent-v29. Android remains beta-vc62; Stable remains OWNER-GATED.

## D104 release checkpoint

D104 Agent v29 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #142 merged to `main` at `e1fa990aefa47ad81b063fc0ca27516c1cace5f8`.
- PR gates PASS: Repo Authority `35687702483`, Project State `35687702449`, UI Design `35687702531`, Relay Agent `35687702508`, Firestore Relay `35687702445`, RTDB Rules `35687702502`.
- Main gates PASS: Repo Authority `35687822814`, Project State `35687822742`, UI Design `35687822767`, Relay Agent `35687822763`.
- Released Windows Agent: `relay-agent-v29`, release id `393459636`; canonical EXE asset id `580560440`, size `284160` bytes, SHA-256 `10304ac734218146550c6bdf3c3b8a81d979fabe5b3ee7dddc94f1b217955b2d`.
- The v29 tag points exactly to merge commit `e1fa990aefa47ad81b063fc0ca27516c1cace5f8`. Android remains signed `beta-vc62`.
- OA024 is the remaining physical Owner field gate for taskbar-visible maximum, comma multi-search, real multi-code WMS confirmation and simultaneous PDA batch behavior.
- Stable remains OWNER-GATED and untouched.

## D105 Android 4-digit confirmation + Agent v30 — 2026-09-22

Owner accepted D104/OA024 and shortened the operational PickList suffix input.

- New Picker Android confirmation input is exactly four digits. Firestore/Agent accept 4 or legacy 5 during rollout, but `beta-vc63` UI is four-digit only.
- During an in-flight confirmation the action button is disabled + dimmed and cannot be re-enabled by typing until the terminal result returns.
- Terminal confirmation result text is larger and bold; success/error colors make the result visually dominant over helper/progress copy.
- Agent v30 resolves current PDA suffixes using their actual length; four-digit jobs therefore compare the last four digits. Multiple matching full codes remain ambiguous/fail-closed.
- Agent specialist manual search becomes 3–4 digits per comma-separated term. D104 bulk confirmation behavior remains unchanged.
- D104 batch/HA/quota behavior remains unchanged. Target Android is beta-vc63; target Agent is relay-agent-v30. Stable remains OWNER-GATED.

## D105 release checkpoint

D105 Android vc63 + Agent v30 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #144 merged to `main` at `e73206dea01e4c599d19abe040ffc8662b8836bf`.
- Main gates PASS: Repo Authority `35694361080`, Project State `35694361070`, UI Design `35694361168`, Beta Android `35694361091`, Beta Relay Agent `35694361074`, Beta Firestore Relay `35694361133`, Beta Worker `35694361089`.
- Released Android: `beta-vc63`, release id `393494217`; APK asset id `580723780`, size `18998096`, SHA-256 `add6716668f13e5f96a8b6b9cdfddba27db4270e990a4f3f7d92c373fadd5295`.
- Released Agent: `relay-agent-v30`, release id `393494208`; canonical EXE asset id `580723753`, size `284672`, SHA-256 `18cf58622cde42d7ae7c58a57615139913caa9c3dbd2718bd2b1348182f765ad`.
- Both tags point exactly to `e73206dea01e4c599d19abe040ffc8662b8836bf`.
- Beta Firestore Rules deployment for bounded current 4-digit + legacy 5-digit rollout compatibility passed.
- OA025 is the remaining physical Owner acceptance gate. Stable remains OWNER-GATED and untouched.

## D125 current operating-model boundary

D125 is the current Owner-approved direction and supersedes older WMS/Agent exceptions wherever they conflict.

- Background software must not obtain, store, refresh or use any Supra/WMS user-session material.
- Picker `Xác nhận đơn` (Supra PickList confirmation) is retired from the target Android/Agent model.
- Picker Android becomes a single-purpose Báo hàng client with no `Xác nhận đơn` tab.
- `Xác nhận SKU` remains the Báo hàng resolution workflow and is unrelated to the retired PickList confirmation feature.
- SKU master updates are manual-file based only; WMS/Tồn Bin SKU synchronization is retired.
- Windows Agent is repurposed as an Office Inventory client that mirrors role-authorized Web business capabilities through permitted Firebase/Google transport. It has no Supra/WMS session, lookup, confirmation or SKU-read authority.
- InventoryCore/Worker remains business authority; Firestore is only an Office-reachable projection/command bridge and never an independent business store.
- Legacy WMS/relay resources may remain for historical/cleanup purposes but are forbidden for runtime use under D125.
- Exact continuation command: `tiến hành sửa đổi mô hình` starts D125 implementation from current `main`.
- Stable remains OWNER-GATED.

## D126 current operating-model boundary

D126 supersedes D125 as the current Owner-approved implementation direction.

- Keep the currently published Android/PDA PickList confirmation workflow and the released Agent operating model.
- Retire all programmatic Supra/WMS session capture, DPAPI WMS-session persistence, header/token/signature replay and direct PickList WMS API calls.
- Hệ thống Supra opens the registered Confirm PickList page in an Agent-managed browser. The user logs into Supra directly in that browser.
- Agent becomes ready only when the Confirm PickList DOM is uniquely recognizable. The browser can be hidden from desktop/taskbar and restored later without ending the browser process.
- Manual/PDA PickList lookup is DOM-only and accepts only full visible codes matching `^PL[0-9]+$` whose numeric suffix exactly matches the submitted suffix.
- On an initial miss, Agent may click the exact **Tìm kiếm** button once and retry the rendered table once.
- Manual Agent requests still require the user to press Agent confirmation. PDA requests auto-confirm after a unique guarded match.
- Mutation is fail-closed: re-resolve the exact row, select only that row checkbox, verify checked, click one uniquely identified enabled **Xác nhận lấy lại hàng** button, then require the exact Supra confirmation dialog and click only its scoped **Xác nhận** action. Never click **Xác nhận hoàn thành lấy hàng**, **Đóng**, or another neighboring/global action as fallback.
- Firestore request/ACK, HA ownership, confirmation guards, anti-spam, operating schedule, Picker presence/contact and Báo hàng behavior remain unless explicitly changed by D126.
- SKU master is manual-file-only through the existing authorized file-import workflow. WMS/Tồn Bin SKU synchronization is retired; automatic SKU update is deferred.
- D125 Office-client rewrite is cancelled before implementation.
- Owner field observation confirmed the mandatory second confirmation dialog after **Xác nhận lấy lại hàng**. D126-H4 is merged and technically released as `relay-agent-v50`; it requires the exact dialog title/body and clicks only its scoped **Xác nhận** action before existing post-confirm terminal evidence. OA051 real-Supra field re-test on v50 remains the acceptance layer.
- Stable remains OWNER-GATED.

## D134 current implementation context — 2026-09-28

- Owner field testing of released D133 (`relay-agent-v73` + `beta-vc79`) exposed defects in Usage reachability, Auto size presentation, Firestore health classification, repeat specialist call behavior, Agent/Web password gates and Picker presence semantics.
- D134 is Owner-approved and Beta-only. Stable remains OWNER-GATED.
- Target fleet is up to 10 Agents. All authenticated Agents receive one compact Firestore sync document; PRIMARY performs one five-minute reconcile. Call/Kick changes are event-driven and reach Replay/deep-hibernate Agents.
- Picker presence authority is explicit Android session state; valid PickList identity is the fallback. Socket disconnect/silence is not offline authority.
- Kích User revokes the current Android session generation; stale generations cannot create new PickList jobs.
- Usage provider metrics are collected server-side and mirrored to Firestore every 10 minutes for direct Office Agent reads.
- D134 Agent target is v74 and Android target is the next monotonic signed Beta after vc79.

## D135 current implementation context — 2026-09-28

- Owner confirmed the D134 hotfix core PickList send/receive path passes on `relay-agent-v75` + `beta-vc81`, then approved D135 follow-up field refinements.
- Active branch: `fix/d135-post-d134-field-refinements`; target Agent is `relay-agent-v76`; Android target is the next monotonic signed Beta after `beta-vc81`.
- The processing Agent updates its three PickList overlay totals immediately only after the existing durable terminal ACK + daily-summary commit succeeds. No additional Firestore read/write/listener/poll is added; compact/durable snapshots remain authority and deep-hibernate Agents retain D134 cadence.
- PickList browser lookup keeps at most one **Tìm kiếm** click but replaces the former fixed eight-second miss loop with bounded local DOM stabilization and a 4.5-second hard safety bound.
- Liên hệ picker and Kết thúc each require one confirmation. The initiating Agent reserves/greys the call action locally before the asynchronous shared write; successful calls retain the existing fleet-wide 60-second lock.
- Both Báo hàng result full-screen paths are local-first: persist pending ACK, dismiss immediately, then acknowledge over the network. Logout, Kích User or lost connectivity must never trap the PDA behind a result screen.
- Android Beta user-visible name becomes **1291 Báo hàng Beta**. Visible Agent identity is username-only; internal authorization/audit identity is retained.
- Existing PickList 3–20 digit suffix taxonomy, anti-spam escalation, single-PRIMARY/guard fencing, D134 45k/day soft read target and Stable OWNER-GATE remain unchanged.

## D135 release checkpoint — 2026-09-28

D135 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #270 merged to `main` at `6d929e42fa2474712e0629a95bb5ac9cf59112bd`.
- Released Windows Agent: `relay-agent-v76`.
- Released signed Android: `beta-vc82`, visible product name **1291 Báo hàng Beta 0.2.0-beta.82**.
- Main Repo Authority, Project State, UI Design, Beta Worker, Android, Relay Agent and Dashboard Probe gates PASS.
- Beta runtime health proves exact source, SQLite `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- OA061 remains the physical Owner field acceptance gate for realtime processing-Agent counters, lookup latency, call anti-spam/confirmations, username-only presentation and local-first result dismissal.
- Stable remains OWNER-GATED and untouched.

## D136 active follow-up — 2026-09-28

- Owner explicitly confirmed D135 **PASS**. D135 is now Owner field accepted on `relay-agent-v76` + `beta-vc82`.
- D136 addresses three follow-ups on Beta only: manual PickList results must always show **PickList + Xác nhận + Trạng thái**; the unreliable Agent **Usage** surface/provider polling is retired; **Chuyển Web chạy nền** no longer requires the Agent password.
- Manual PickList critical columns are protected across Auto size, manual saved widths, normal/maximized transitions and resize. Horizontal scroll is the narrow-viewport fallback. Confirmed/already-confirmed and uncertain rows are non-repeatable.
- Usage retirement removes the visible Agent tab and the Beta Worker scheduled Google Monitoring / `usage_current` publication path. The local Firestore quota guard remains only a reference/soft guard and is not presented as provider-authoritative usage.
- Web Confirm hide-to-background is presentation-only. Showing hidden Web, stopping Web, Agent logout and switching browser mode remain password-protected.
- Target Agent: `relay-agent-v77`. Android remains signed `beta-vc82`. No new resource. Stable remains OWNER-GATED.

## D136 release checkpoint — 2026-09-28

D136 is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta.

- PR #272 merged to `main` at `62ab2aa11cda251f18090fc0bd637a092ab0998d`.
- Released Windows Agent: `relay-agent-v77`. Android remains signed `beta-vc82`.
- Beta Worker exact-source health PASS: SQLite `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- Main Repo Authority, Project State, UI Design, Beta Worker, Relay Agent and Dashboard Probe gates PASS.
- Agent Usage UI/provider collection is retired; no scheduled Google Monitoring Usage collection or `usage_current` publication remains.
- OA062 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER-GATED and untouched.

## D137 active follow-up — 2026-09-28

- D136 is Owner field PASS on `relay-agent-v77`; Android remains `beta-vc82`.
- Owner field evidence exposed two D137 defects: the manual PickList grid can collapse vertically in the restored/normal window, and the first loaded Confirm document can contain no usable data until a normal F5.
- D137 target is `relay-agent-v78`, Agent-only. The Overview allocation and PickList card bounds become vertically responsive with an actionable-grid minimum while retaining D136 critical-column protection.
- Managed Confirm readiness now requires one normal post-arrival top-level reload plus a stable post-reload DOM before READY. Login and Dashboard recovery use the same barrier.
- WebView2 host build 10, Android beta-vc82, provider resources and service cadence remain unchanged. DevTools Network/session extraction/direct WMS API remain forbidden.
- Active implementation branch: `fix/d137-picklist-height-confirm-refresh`. OA063 remains blocked until technical/release PASS. Stable remains OWNER-GATED.

## D137 v79 field-driven hotfix — 2026-09-28

- Released Agent v78 fixed the normal/restored PickList result surface, but Owner field evidence shows the Confirm page can still be visually READY while its PickList data is not hydrated.
- v78 log timing proves the automatic reload was issued roughly 0.6s after final WMS child attachment and was accepted as PASS before a later real search returned NOT_FOUND. Manual F5 then restored the same known PickList and confirmation succeeded.
- D137 therefore continues as Agent v79: wait for the final Confirm document to remain stable for 3s, issue one normal reload, require 1.2s post-reload stable DOM, and allow one empty-table local reload/search retry only when the first search sees zero PickList codes.
- Android remains beta-vc82; WebView2 host build 10 and provider resources are unchanged. Stable remains OWNER-GATED.

## D137 v79 release checkpoint — 2026-09-28

- PR #275 merged to main `b177ef0f9169b051fe90349460c1c3e2d7a07663`.
- Main Repo Authority, Project State, UI Design, Relay Agent and Dashboard Probe workflows PASS.
- Released Windows Agent: `relay-agent-v79`, release id 398080917, canonical EXE asset id 594949767, SHA-256 `e88108a53ff5def868c7ca036318fcac5a2ba19da2fe426fddb1983fa1056d23`.
- Inventory channel now carries the same v79 EXE (asset id 594949844) and refreshed Agent manifest (asset id 594949850).
- OA063 is READY_FOR_OWNER_FIELD_TEST. Android remains `beta-vc82`; Stable remains OWNER-GATED and untouched.


## D138 Web SLA realtime dirty-form repair — 2026-09-28

Owner reported that selecting **Theo báo đầu tiên của SKU** on Web **Thời gian xử lý** could jump back to **Theo từng Picker**, even though the page later showed the successful-save notice.

Source analysis isolates the defect to the Web realtime reconciliation path, not the SLA persistence contract. `loadSla()` already refuses to replace a dirty form, but `reconcileActive()` then performed an unconditional generic section patch using the older `slaResponse`, which visually reset the radio before Save captured `FormData`.

D138 makes the SLA reconcile branch return immediately after `loadSla()`. This leaves dirty-state protection and SLA rendering under one authority while retaining the existing server response + post-save reload verification. There is no schema, provider, Android or Agent change. D137 OA063 remains independently open; Stable remains OWNER-GATED.


## D138 runtime checkpoint — 2026-09-28

- PR #277 merged to main `005d829811ddfa534f0552cd808d69e12c5cf763`.
- Main Authority/State/UI/Beta Worker/Dashboard gates PASS; Beta deploy run `36408876240` PASS.
- Live Beta Web now contains the SLA realtime dirty-form preservation fix. No service schema, provider, Android or Agent change was required.
- OA064 is READY_FOR_OWNER_FIELD_TEST: select `FIRST_REPORT`, allow realtime activity, save, reload, and verify the server-authoritative mode remains `FIRST_REPORT`.
- D137 OA063 remains independently open. Stable remains OWNER-GATED.


## D139 SLA field-failure repair — 2026-09-28

D138 field acceptance failed: Owner selected `FIRST_REPORT`, saved and refreshed, but Web still returned `PER_PICKER`.

The remaining source risk is broader than realtime reconciliation. The shared `patchActiveSection(true)` can still rebuild the SLA form from the previous server snapshot through delayed section-load completion, network online/offline repaint, or generic action-finally repaint. D139 therefore moves dirty-form protection to that shared render boundary and reads the explicitly checked radio at submit time.

Existing server policy-version safety and save-response/post-save-GET verification remain unchanged. Scope is Beta Web only. Android beta-vc82 and Agent v79 remain unchanged. D137 OA063 stays open independently. Stable remains OWNER-GATED.


## D139 runtime PASS — 2026-09-28

- PR #279 merged to main `219469840a9ece147441b1ef9a0db8242109e5a7`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web deploy run `36414388456` PASS, including service typecheck, Worker/Web assets/Durable Object deploy, Beta health/schema/auth/business/Web-shell/OAuth verification.
- Web marker: `D139_RUNTIME_PASS_MAIN_21946984__GLOBAL_DIRTY_SLA_FORM_RERENDER_GUARD__OA065_FIELD_READY`.
- OA065 is READY_FOR_OWNER_FIELD_TEST for FIRST_REPORT save + browser-reload persistence.
- D138 is field-failed and superseded by D139. D137 OA063 remains independently open.
- Android remains `beta-vc82`; Agent remains `relay-agent-v79`; Stable remains OWNER-GATED.

## D140 Agent Firestore listener storm repair — 2026-09-28

Owner-reported Firebase usage showed a sharp Firestore read spike while real PDA PickList volume remained low. Sanitized Agent evidence isolated the amplification to the D134 compact `agent_sync` gRPC stream: one Agent produced 10,939 `InvalidArgument` reconnects during the 14–17h window while only 47 PDA PickList requests were observed.

D140 is Agent-only. The raw streaming client now supplies Firestore database routing metadata, retry state resets only after a valid server response, permanent/configuration/quota failures open a five-minute circuit, transient failures back off from 2s to 60s, and logs expose sanitized gRPC status detail/circuit state. Compact realtime listening is limited to PRIMARY/NEXT_A/NEXT_B; DEEP_HIBERNATE keeps no compact listener. PRIMARY reconciliation remains five-minute bounded with a one-minute forced floor, and unchanged normalized `agent_sync` state skips PATCH.

Target is `relay-agent-v80`. Android remains `beta-vc82`; no APK update, provider resource, schema or Stable change is part of D140. OA066 remains blocked until PR/CI/main/release PASS and a 30–60 minute Owner field soak confirms the reconnect storm and usage spike are gone.



## D141 SLA persistence repair — 2026-09-28

D139 failed field acceptance. Owner reloaded the Beta SLA screen and observed the radio on **Theo báo đầu tiên của SKU** while the server-authority label still showed **Theo từng Picker**.

The source review isolated a concrete rendering defect that D138/D139 had missed: `patchActiveSection(true)` captures all form controls, renders fresh authoritative markup, then `restoreUiContext()` replays the old control values. That can restore the old radio after the server label has already rendered from the latest response. In addition, the SLA submit still used generic `run()`, whose `if (busy) return` contract can silently discard a configuration save when another generic action owns the busy flag.

D141 replaces the mixed state with explicit server/draft mode ownership, excludes SLA fields from generic context restoration, gives SLA Save its own single-flight path, and adds two-stage persistence proof: InventoryCore SQLite post-write readback followed by a fresh no-cache Web GET. A mismatch is fail-closed and logged only with sanitized request/mode/version metadata.

Scope: Beta Web/Worker only. No provider/schema/Android/Agent mutation. D140 Agent v80 remains parallel, D137 OA063 remains open, and Stable remains OWNER-GATED.


## D141 runtime PASS — 2026-09-28

- PR #282 merged to main `966b6d1f561768551969694065b1035bb2e2b234`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web exact-source deploy run `36421277405` PASS.
- D141 now separates server-applied SLA authority from browser draft state, uses a dedicated non-droppable save path, verifies SQLite readback before server success, and requires a fresh no-cache GET match before Web success.
- Web marker: `D141_RUNTIME_PASS_MAIN_966B6D1F__SLA_SERVER_DRAFT_SPLIT__SQLITE_READBACK__NON_DROPPABLE_SAVE__OA067_FIELD_READY`.
- OA067 is READY_FOR_OWNER_FIELD_TEST. D140 Agent v80 remains parallel. D137 OA063 remains independently open.
- Android unchanged; Stable remains OWNER-GATED.

## D142 Android 11 PDA critical-alert readiness — 2026-09-28

Owner approved a Beta Android-only hardening for the two warehouse PDA families: **Newland NLS-MT90 Android 11** and **Urovo DT50 Android 11**. Branch `feat/d142-android11-critical-alert-readiness` starts from main `966b6d1f` and leaves D141 Web/SLA plus D140 Agent v80 work intact.

Candidate behavior: automatic start/resume readiness gate for app notifications, overlay, DND Policy Access, battery-optimization exemption and a high-importance DND-bypass critical channel; direct/closest Settings actions with short operator guidance; automatic recheck after Android Back; no manual check/test button. Critical FCM remains data-only HIGH and existing D133/D135 overlay/local-first ACK remains authoritative. Android 11 full-screen intent adds bounded screen wake/fallback without polling, persistent wake locks or an always-on new service.

Target: next monotonic signed Beta APK after `beta-vc82`. OA068 is blocked until technical/release PASS, then one normal MT90 and one normal DT50 field check. No new provider resource. Stable remains OWNER-GATED.

## D142 signed Beta release PASS — 2026-09-28

- Canonical Android marker: `D142_SIGNED_BETA_VC83__ANDROID11_MT90_DT50_CRITICAL_ALERT_READINESS__OA068_FIELD_READY`.
- Latest Beta APK: `beta-vc83`.
- PR #284 merged main `4e382a39fa574fe49d176af435c1a6a4afdf75f4`; all D142 PR authority/state/UI/Android/Firestore/RTDB/Dashboard gates PASS.
- `beta-vc83` resolves exactly to that main commit. The signed-release step is ordered after the exact-source Beta runtime gate in `Verify Beta Android`.
- D142 technical/runtime/release state is PASS. OA068 is field-ready for normal operation on one MT90 Android 11 and one DT50 Android 11.
- App startup blocks login only for missing critical-alert readiness items, routes the user to the relevant Settings screen, and auto-rechecks on Android Back. No manual check/test button is required.
- Existing FCM HIGH, D133/D135 overlay/local-first ACK, Agent/Web behavior and Stable are unchanged.

## D142 Owner field acceptance — 2026-09-28

Status: **OWNER FIELD PASS**.

- Owner explicitly confirmed D142 PASS after the signed `beta-vc83` technical/runtime/release checkpoint.
- Accepted PDA scope: **Newland NLS-MT90 Android 11** and **Urovo DT50 Android 11**.
- Accepted behavior includes the automatic pre-login critical-alert readiness gate, missing-setting list with Settings routing/guidance, automatic recheck after Android Back, and preservation of the existing critical alert/overlay/local-first acknowledgement path.
- OA068 is closed PASS. No further D142 field action remains.
- Canonical Android marker: `D142_OWNER_FIELD_PASS__SIGNED_BETA_VC83__ANDROID11_MT90_DT50_CRITICAL_ALERT_READINESS`.
- D141 OA067 and D140 Agent v80 remain independent open workstreams. Stable remains OWNER-GATED and untouched.


## D144 field-repair architecture — 2026-09-29

- D143 field evidence opened D144 for three bounded defects: revoked Google OAuth broke Web/Android runtime logs, Agent chat input/delivery failed, and a legacy already-logged-in Picker could remain visible after Kích User. Direct specialist call remains PASS.
- Sanitized Web/Android runtime logs now persist to a bounded 90-day InventoryCore SQLite buffer first. Web Nhật ký reads that buffer; Google Drive is best-effort archive only. D144 therefore requires no Drive permission change and schema source target advances to 14.
- Agent v82 chat uses the existing per-Picker `picker_session_controls` listener as direct delivery, keeps the D143 FCM path for compatibility, and pauses periodic Agent UI refresh timers while the modal editor is open. Picker Xác nhận remains local-only with duplicate suppression.
- Kích User keeps Firestore generation revocation and additionally revokes the Worker-authoritative Android session. Before disabling the old Android notification target, Worker sends one best-effort backward-compatible re-login command. A five-minute Worker reconciliation over existing compact Agent sync covers office-network Worker unreachability.
- No new provider resource is introduced. Stable remains OWNER-GATED and untouched.

## D144 technical/runtime/release PASS — 2026-09-29

- Canonical Beta marker: `D144_TECHNICAL_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC85__AGENT_V82__OA071_FIELD_READY`.
- Canonical Web marker: `D144_RUNTIME_PASS__INVENTORYCORE_LOG_BUFFER__SCHEMA14__OAUTH_NONBLOCKING`.
- Canonical Android marker: `D144_SIGNED_BETA_VC85__DIRECT_CHAT_AND_AUTHORITATIVE_KICK__OA071_FIELD_READY`.
- PR #290 merged to main `2b2b5a622b971efbb676e7143573652abf6f9570`.
- Main Repo Authority `36477936191`, Project State `36477936152`, Firestore `36477936251`, Dashboard `36477936051`, UI `36477936434`, Worker `36477936028`, Android `36477936034` and Relay Agent `36477936087` all PASS.
- Beta Worker exact-source health reached SQLite `14/14`, Operational V2 `5/5`, Agent migration `0/0`.
- Signed Android `beta-vc85` is published from the exact D144 main source; APK SHA-256 `fdf561f67a65a0f99393b0c3fff6b5853adcd87c3b37bd624d04451493ce6466`.
- Agent `relay-agent-v82` is published from the exact D144 main source; EXE SHA-256 `264f7068f7c9fd39f8a153e6c895dc1c5dfccacdd49f87cf35eb2f098f76256c`.
- Runtime-log authority is now the bounded InventoryCore SQLite buffer; revoked Google Drive OAuth can defer Drive archival but cannot block new Web/Android log upload/list/detail.
- Picker chat uses direct per-Picker Firestore session control plus FCM compatibility; PDA dismiss is local-only with duplicate suppression.
- Kích User now revokes the Worker-authoritative Android session, closes realtime presence, refreshes the Picker projection and retains bounded compact-sync reconciliation for a direct-call failure.
- OA071 is READY_FOR_OWNER_FIELD_TEST on `relay-agent-v82` + `beta-vc85`.
- Stable remains OWNER-GATED and untouched.
## D145 public OAuth disclosure workstream — 2026-09-29

- Owner requires three public Beta OAuth information pages at `/about`, `/privacy` and `/terms` so Google Auth Platform can use public application/home/privacy/terms URLs instead of the authenticated Web shell.
- Source routes are unauthenticated GET/HEAD responses from the existing Beta Worker custom domain. About identifies the application and existing `drive.file` + `gmail.send` purposes; Privacy covers Google-data access/use/storage/sharing, revocation and Limited Use; Terms covers authorized business use.
- Web login, password-reset and authenticated footer link to all three public surfaces.
- The Beta deploy workflow now probes all three URLs and verifies the scope/privacy markers after deployment.
- No new provider resource, OAuth scope, storage path or credential is introduced. OA073 remains Owner-only for Google Auth Platform publish/re-consent and Worker refresh-token secret replacement after D145 runtime PASS. Stable remains OWNER-GATED and untouched.
- Current D145 Web source marker: `D145_OAUTH_PUBLIC_PAGES_SOURCE_READY__D144_RUNTIME_BASELINE_PASS`.
## D145 technical/runtime PASS — 2026-09-29

- PR #292 merged to main `5e11a0941bdc94272246cf745bd3d4d53d9824b5`.
- Canonical Web marker: `D145_OAUTH_PUBLIC_PAGES_RUNTIME_PASS__OA073_GOOGLE_PUBLISH_READY`.
- Main Repo Authority run `36482437090`, Project State `36482437070`, Beta Worker `36482436903`, UI Design `36482436949` and Dashboard Probe `36482436885` all PASS.
- Beta deploy verified `/about`, `/privacy` and `/terms` at HTTP 200 without auth and passed the required application identity, exact OAuth scope, Privacy/Limited-Use and Google OAuth start checks.
- OA073 is now READY_FOR_OWNER_GOOGLE_PUBLISH. The remaining bounded Owner action is Google Auth Platform Testing → In production, one fresh Beta consent, and direct replacement of the protected Worker refresh-token secret without exposing its value.
- Stable remains OWNER-GATED and untouched.


## D146 source candidate — 2026-09-29

Owner reopened the Beta support-log delivery path after confirming the Beta Google OAuth app is **In production**, the refresh token was renewed/deployed, and transactional Gmail send works. D146 keeps the existing `drive.file + gmail.send` scope and does not request Gmail-read access.

- Web/Android support logs keep InventoryCore SQLite as primary authority and now retry deferred Drive archival on the bounded five-minute Worker cron. Error/crash delivery remains immediate best effort. Scheduled slots are 06:00 / 12:00 / 18:00 / 21:00 HCM; midnight is removed. Filenames distinguish scheduled/manual/error/crash and source/device.
- Agent v83 uses Google Firestore as its first hop for support-log parts, so Office operation does not require the laptop to reach Cloudflare. A Beta Google Function assembles the parts. The Function obtains a protected short-lived resumable Drive upload session from the Worker using Google workload identity; no OAuth token is returned and no Drive/OAuth secret exists on the laptop. The log payload is uploaded Google Function → Google Drive, with existing Worker drain as bounded fallback.
- Web SKU import broadcasts `sku_catalog_updated` and sends a silent FCM compatibility marker; Android syncs its local SKU catalog without logout/login.
- Managed-account deletion is true-ROOT-only at Web, Worker and InventoryCore boundaries. ROOT effective PICKPACK_ADMIN and real PICKPACK_ADMIN cannot delete ADMIN.
- Agent protected password/browser-action dialogs pause the periodic UI timers while text is being entered and the generic tick avoids repaint work during interactive text focus.
- Target releases: Agent `relay-agent-v83`; next monotonic signed Android after `beta-vc85`. Stable remains OWNER-GATED and untouched.


## D146 Owner acceptance checkpoint — 2026-09-29

Owner explicitly confirmed **D146 done / PASS** after the D146 release and Firestore-rules hotfix sequence. D146 is therefore the current Owner-accepted Beta baseline for the support-log schedule/delivery repair, live PDA SKU refresh after Web import, true-ROOT-only managed-account deletion, and Agent protected-input focus stability.

Technical/release evidence: implementation PR #294 merged at `108756a09d54ba100b1fff1d47f5345122bbe1bf`; signed Android `beta-vc86`; Agent `relay-agent-v83`; final Firestore-rules hotfix main `d7e0cb944b29ee7245053be64f5409be36e2b6c3` with main Firestore run `36498146440` PASS. OA073 and OA074 are closed by this Owner acceptance. Stable remains OWNER-GATED and untouched.

## D147 Owner acceptance checkpoint — 2026-09-29

Owner explicitly confirmed **D147 PASS**. D147 is now the accepted governance base for serial change sequencing: one active change at a time, same-ID repair after NOT PASS, and mandatory pre-implementation impact review plus explicit Owner approval for base-affecting mutations.

D147 introduced no Web, Android, Agent, database, provider-resource, schema, quota-cadence, or Stable runtime change. The runtime baseline remains the Owner-accepted D146 behavior; Stable remains OWNER-GATED.

## D148 approved implementation workstream — 2026-09-29

After D147 Owner PASS, Owner approved D148 limited to Web pending-badge repair, Reporter/Admin Android report-created overlay, shift-comparison Excel, clearer PickList strike/lock copy, Android session-end INFO-log policy, and prioritized sequential Android overlay handling. The proposed overtime Web/App/Agent unification is explicitly excluded from D148 and may not start until D148 itself receives Owner PASS.

D148 reuses existing Web/Worker/InventoryCore/FCM/Android resources, adds no schema/provider resource/polling cadence and does not change Agent or Stable. Android result acknowledgement remains local-first. Current branch: `feat/d148`. OA076 is the eventual Owner field acceptance gate.

## D148 technical/runtime/release checkpoint — 2026-09-29

PR #300 merged to main `fe893db1d80e417021defdad92d85947c37abd82`. Main Repo Authority, continuity, Beta deploy, Android, legacy operational regression and build-probe gates are PASS. Live Beta Worker/Web deployment passed health/auth/business/Web/OAuth and protected D146 Drive-broker probes.

Signed Android `beta-vc87` release id `398763774` contains APK asset `596952438` (19,102,276 bytes, SHA-256 `41e5d499e2c38a703aa4b58a1408963031dbacdb9b11f885650a325a4d0147f2`) and targets the exact D148 main commit. `inventory-channel` PDA assets were refreshed to the same APK. Agent remains v83 and overtime unification remains outside D148. OA076 is READY_FOR_OWNER_FIELD_TEST; D147 remains the accepted base until explicit Owner D148 PASS.

## D148 Owner acceptance checkpoint — 2026-09-29

Owner explicitly confirmed **D148 PASS** after field review. Accepted behavior includes the Web pending-badge repair, Reporter/Admin adaptive report-created overlay, shift-comparison Excel export, clearer PickList strike/lock copy, Android session-end INFO-log policy, and priority/FIFO one-at-a-time overlay queue.

Technical/release evidence remains PR #300 → main `fe893db1d80e417021defdad92d85947c37abd82`, live Beta Worker/Web PASS, signed Android `beta-vc87`, and Agent `relay-agent-v83` unchanged. OA076 is closed. D148 is the accepted base; overtime unification remains a separate future change. Stable remains OWNER-GATED.

## D149 Owner acceptance checkpoint — 2026-09-29

D149 is Owner-accepted on Beta. OA077 is closed after explicit Owner PASS. The accepted runtime remains main `c03f54861e5fbb6ff093b129e9b76e303475c358`, signed Android `beta-vc88` and Agent `relay-agent-v84`, covering the shared 06:00–22:00 operating schedule, bounded overtime/early-start logic, one-shot Android recovery, recent-result range UX, resolver attribution, Agent managed-Web storage relocation and PickList presentation refinement. No new provider or schema is added by this acceptance update. Stable remains OWNER-GATED.

## D150 Owner acceptance checkpoint

D150 is Owner-field accepted PASS on 2026-09-29. The accepted Beta base is D150: relay-agent-v85 quota-safe coordination/manual PRIMARY behavior is accepted; Android remains beta-vc88 unchanged. OA078 is closed. No new provider resource, collection, secret, schema, Stable deploy or Stable promotion is introduced by this acceptance record.

## D151 temporary DND diagnostic boundary

D151 adds a temporary standalone Android 11 diagnostic package, `cd.cc.supra.inventory.dnddiag`, solely to compare Notification Policy / Do Not Disturb behavior between normal and failing Newland NLS-MT90 devices. It is not the production PDA app and has no business, Firebase, realtime, PickList or WMS authority. It may POST only the bounded DND diagnostic schema to the Beta Worker diagnostic-log route, which reuses the existing sanitized runtime-log buffer and Inventory/Beta logs archive. Production `beta-vc88` remains unchanged and Stable remains OWNER-GATED.



## D151 adaptive Android alert remediation — 2026-09-29

D151 field diagnostics established that OEM DND Settings state is not a universally reliable readiness authority. After Owner approval, D151 now includes a Beta Android production remediation: alert delivery is selected from real platform capability rather than model/firmware identity. Notifications, cross-app Overlay permission and battery-optimization exemption are hard readiness; real DND policy/channel bypass is an optional native enhancement. Unsupported/broken DND implementations use Overlay Compatibility mode. Screen-off/keyguard critical events use the existing bounded wake Activity without WakeLock or new network cadence. Target is the next monotonic signed Beta after `beta-vc88`; Agent/Web/Stable remain unchanged and Stable is OWNER-GATED.


### D151 adaptive alert release checkpoint

D151 adaptive Android alert remediation is **TECHNICAL / RUNTIME / RELEASE PASS** on Beta. Implementation PR #313 merged at main `44606b738b34b3ea216d4db14ab4a3af166f162c`; signed `beta-vc89` release id `399040014` contains the exact-source APK (asset `597939005`, 19,118,660 bytes, SHA-256 `9fe96a16a26d1d59e3b2664025cd0802a59b9535d545d92cd475995c4dfc12bc`) and the inventory-channel APK was refreshed to the same digest. OA079 is now READY_FOR_OWNER_FIELD_TEST. D150 remains the accepted base until explicit Owner D151 PASS. Stable remains OWNER-GATED and untouched.

## D151 Owner acceptance checkpoint

D151 is Owner-field accepted PASS on 2026-09-29. The accepted Beta base now includes signed `beta-vc89` adaptive Android alert behavior. OA079 is closed. Agent remains `relay-agent-v85`; no new provider/resource/schema/secret/polling/listener is introduced by the acceptance record, and Stable remains OWNER-GATED.

## D152 approved PickList recovery workstream

After D151 Owner PASS, D152 is the active Owner-approved Agent-only workstream. It preserves the normal PickList confirmation fast path and adds bounded exception recovery for a unique row whose checkbox has not hydrated, plus read-only verification after an uncertain post-confirm state or an existing uncertain confirmation guard. Recovery never repeats the Confirm mutation, never converts a recovery state-change into a Picker NOT_FOUND strike, adds no provider cadence/resource/schema, targets `relay-agent-v86`, keeps Android at signed `beta-vc89`, and leaves Stable OWNER-GATED.

## D152 Owner acceptance checkpoint

D152 is Owner-field accepted PASS on 2026-09-29. The accepted Beta base now includes `relay-agent-v86` from PR #316 / main `a418de7e852ff9c1bc8b37309b65cdfc75fe3f24`, with bounded checkbox recovery and verify-only uncertain confirmation handling. OA080 is closed. Android remains signed `beta-vc89`; no new provider/resource/schema/listener/polling/write cadence is introduced and Stable remains OWNER-GATED. The serial gate is open for the next separately approved change.


## D153 accepted Beta base — 2026-09-29

- Accepted change base: **D153 Owner PASS**; OA081 closed.
- Current Agent: **relay-agent-v87**; signed Android remains **beta-vc89**.
- Accepted quota behavior: LOGIN remains Picker authority; PickList fallback is one-shot/session-fenced; repeated identical device/presence state is deduped before Firestore provider writes; Picker-only `agent_sync` no-op gating is retained with the 5-minute repair reconcile.
- Confirmation cadence remains 3s active / 15s inactive / 1s bounded HOT; PRIMARY lease 10s and failover 15s are unchanged.
- Streaming redesign D remains deferred. Stable remains OWNER-GATED.
- Serial Owner-PASS gate is open for the next separately reviewed change.


## D154 technical release checkpoint

D154 is technically/runtime released on Beta at main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`; explicit Owner field acceptance is still pending under OA082, so D153 remains the accepted base.

- Shared normal schedule: **05:45–22:30** Asia/Ho_Chi_Minh; early start **05:00–05:45**; overtime remains capped at **05:00** with 22:30-anchored one-hour boundaries.
- Agent is the single schedule writer. `CANCEL_OVERTIME` closes the current override immediately; Web remains read-only.
- `operatingScheduleChanged` is now actually deployed as a Beta Cloud Function in `asia-southeast1`. Android retains event-driven FCM and only performs one exact schedule-document Firestore read when a blocked PickList still sees a closed Worker mirror.
- Beta releases: Android `beta-vc90`; Agent `relay-agent-v88`.
- No new provider resource, collection/schema, secret, listener, polling loop or cron. Stable remains OWNER-GATED.


## D154 accepted Beta base

D154 is the current Owner-accepted Beta base after explicit PASS on 2026-09-30.

- Current accepted releases: Android `beta-vc90` and Agent `relay-agent-v88`.
- Shared schedule authority is 05:45–22:30 with early start 05:00–05:45, 22:30-anchored overtime capped at 05:00, and explicit `CANCEL_OVERTIME`.
- Agent remains the schedule writer; Web remains read-only; Android uses event-driven FCM plus the bounded exact-document recovery defined by D154.
- The previously missing `operatingScheduleChanged` Beta Function deployment is part of the accepted runtime.
- No new provider resource, collection/schema, secret, listener, polling loop or cron was added. Stable remains OWNER-GATED.
- The serial Owner-PASS gate is open for the next separately reviewed change.

## D156 active Owner-approved workstream — 2026-09-30

D155 is the accepted Beta base: schema 15, Android beta-vc91 and Agent relay-agent-v90. D156 is the single active Owner-approved change.

D156 repairs schedule convergence without changing Agent authority: normal Agent → operatingScheduleChanged → Worker/FCM remains the realtime path; a closed Worker decision may perform one exact operating_schedule Firestore recovery, single-flight and globally throttled to 10 seconds. Web consumes the existing operating_schedule WebSocket scope; active Android consumes the existing FCM broadcast and gates Báo hàng send by the shared window. No new listener/poll/cron/provider is introduced.

D156 also supersedes the D155 rollout default: existing Pickers are reporting-disabled once by migration and new HR Pickers start reporting-disabled; later administrator choices are preserved. Target is schema 16 + next signed Android Beta after beta-vc91; Agent stays v90. Stable remains OWNER-GATED.

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



## D157 technical/runtime/release checkpoint — 2026-09-30

D157 is technically/runtime released on Beta and **READY_FOR_OWNER_FIELD_TEST** under OA085. D156 remains the accepted base until explicit Owner D157 PASS.

- Implementation PR #336 merged to main `87cbed6d7fc14cb71176ce65e613afb334ecb5e3`.
- Main gates PASS: Project State `36675226281`, Dashboard Probe `36675226242`, Repo Authority `36675226227`, UI Design `36675226333`, Beta Firestore `36675226210`, Verify Beta Relay Agent `36675226296`.
- Windows Agent **relay-agent-v91** release id `399752709`; canonical EXE asset `600151295`, size `7,113,216` bytes, SHA-256 `b9db68c6e23e538d038638e0b2aead13cf1e8c82f12242dc2ca54c386025b341`.
- Inventory runtime channel Agent asset `600151474` has the same SHA-256; manifest asset is `600151475`. Android remains **beta-vc92** unchanged.
- D157 preserves the accepted D137 real `Page.reload`/normal-F5 browser semantics. Secondary Agents validate every two hours only when idle; PRIMARY validates only after 60 minutes without strong WMS proof plus idle time. No WebView2/browser-runtime optimization was introduced.
- PRIMARY realtime wake only accelerates the existing REST fresh-PENDING pipeline. Per-job daily-summary write is removed; absolute aggregate checkpoints run after 50 ACKs / five minutes and on PRIMARY recovery. Targeted PRIMARY handoff validates the selected target with a real reload before CAS.
- No new provider resource, Firestore collection, secret, Android release or Stable mutation. Stable remains OWNER-GATED.


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
## D160 active Owner-approved workstream — 2026-10-02

D159 is the accepted base. D160 is the single active Owner-approved change; the accepted production runtime remains Agent v94 + Android beta-vc92 until D160 technical release and explicit Owner PASS.

D160 targets Windows Agent v95. It introduces bounded multi-PickList confirmation with a maximum micro-batch of 15, independent per-request classification/ACK, READY-before-recovery ordering and exact checkbox/selection fences. Only a new or content-changed post-final-click success surface can produce CONFIRMED; a fresh post-click error remains guarded/uncertain because partial bulk mutation cannot be excluded. WMS reload or PickList row disappearance/persistence is never business-success evidence. Every non-success post-click outcome remains confirmation-guarded with no second mutation. Normal latency target is 5–10 seconds with a hard ≤20-second product target.

D160 also integrates accepted D159-v3 Usage into the official Agent for exact logins tamnv2/admin only, consolidates Agent logs into one complete sanitized stream, renames Kết nối to Cài đặt, removes user-facing realtime log tabs and adds a local-realtime Picker confirmation History projection. The History tab creates no new Firestore cadence; existing ACK payload is only enriched with contractor/full PickList.

The existing closed-day Excel exporter archives the richer history, then deletes only terminal ACK documents from the same already-read result list after Drive upload PASS. The existing D158 log Apps Script becomes **SUPRA Inventory Beta - Agent Operations Gateway**, receives the D159 Monitoring action and moves into the scoped Inventory folder; the redundant D159 script is deleted only after the unified existing URL proves D160 identity.

Android **beta-vc92 is hard locked and unchanged**. No new Firestore collection/provider resource/secret is introduced. Stable remains OWNER-GATED. OA090 is the final Owner field gate.

## D160 provider cutover technical repair — 2026-10-02

D160 implementation PR #367 passed all PR gates and merged to main `6c7106d9c6a9d41dfd675c9488f4e107e9eb66bc`. Agent v95 source/build/startup-smoke is technically clean, while Android remains hard-locked at beta-vc92.

The first main Apps Script consolidation run reached the existing Agent gateway rename/move, source push, immutable version creation and deployment update, but the existing public `/exec` URL did not yet prove `SUPRA_AGENT_OPERATIONS_GATEWAY_D160` within the bounded identity window. A direct retry produced the same boundary. The workflow therefore did **not** reach the D159 retirement step; the accepted D159 standalone Usage gateway remains present and no data/provider fallback was deleted.

Repair remains under the same D160 change ID. It adds control-plane deployment-version proof, cache-busting public identity polling and safe diagnostics limited to HTTP/service/project/revision. No token, Script ID or deployment ID is logged. OA090 remains pending technical release; D159 stays the accepted base and Stable remains untouched.

## D160 gateway Web App entrypoint root-cause repair — 2026-10-02

The extended cutover diagnostic proved the Apps Script control plane had the exact newly redeployed version, while the existing public `/exec` URL returned HTTP 404 for sixty cache-busted probes. This excludes normal propagation/cache delay and isolates the failure to Web App entrypoint semantics.

The repo-managed Agent gateway manifest did not contain a `webapp` resource. When automation pushed that manifest and created a new version for the existing deployment, the version no longer advertised a Web App entrypoint even though the deployment/version remained visible to the Apps Script API.

D160 repairs the same existing scoped gateway by explicitly declaring `webapp.access=ANYONE_ANONYMOUS` and `webapp.executeAs=USER_DEPLOYING`. This restores the already-accepted transport model: the endpoint itself is publicly reachable, GET exposes only bounded service identity, and protected POST actions still require a valid Firebase ADMIN/PICKPACK_ADMIN token. The existing URL is retained. D159 remains present until the repaired URL passes both D160 identity and authenticated Monitoring-backed Usage proof.

## D160 v97 overlay/history lifecycle repair — 2026-10-02

Field-log analysis of relay-agent-v96 proved a same-day restart lifecycle defect inherited from the D160 History integration: D128 overlay startup refresh could trigger D160 business-day History loading before the History DataGridView had columns. With existing same-day rows this raised InvalidOperationException, and the shared overlay try/catch then skipped overlay show plus Settings/tray setup. The loaded day key could also suppress later History repaint.

The Owner approved same-D160 repair targeting **relay-agent-v97**. History model loading is now independent from WinForms rendering; already-loaded same-day data is repainted only after History UI readiness. The Bảng nổi Picklist Settings surface is created independently from the overlay form, overlay failures expose staged sanitized diagnostics, one bounded post-UI retry and a manual retry control, and startup-smoke must exercise a non-empty same-day History restart.

The v96 WMS confirmation pipeline is intentionally unchanged. No new provider resource, Firestore collection/read/write/listener/poll cadence or secret is introduced. Android remains **beta-vc92** hard-locked and Stable remains OWNER-GATED. D159 remains the accepted base until explicit Owner D160 PASS.

## D160 v97 technical release checkpoint — 2026-10-02

PR #381 implemented the Owner-approved overlay/history lifecycle repair and merged to `main` at `4c3f0a4dffc94f66237d0958032fd27ac52fed29`. Main Agent run `36969035725` passed and published `relay-agent-v97` (release `401562436`, canonical EXE asset `604881289`, SHA-256 `b8f75d0f100cbb97493d140f39fd708df7002dc1a073eff6a4b7c346d12f4530`).

The v97 startup-smoke now exercises a non-empty same-day Picker History before AgentForm construction and requires both History repaint and overlay lifecycle readiness. History loading no longer depends on DataGridView construction, and the Bảng nổi Picklist Settings surface survives overlay-form initialization failure with bounded recovery.

Android remains `beta-vc92` hard-locked. No provider resource, Firestore cadence or Stable resource changed. D159 remains the accepted base; D160 remains open under OA090 until explicit Owner field PASS.



## D161 Owner field repair — 2026-10-04

- Owner field test rejected the initial v104/vc96/Web Version 1 candidate on three repairable defects while keeping D161 as the active change ID.
- **Schedule:** outward business shift is 06:00–22:00; technical Replay is separately labelled 05:45–22:15; obsolete 22:30 copy is removed without changing the 22:15 runtime boundary.
- **HR:** HARD_BLOCK exposes bounded non-sensitive row/reason diagnostics and a one-shot recheck; HARD_BLOCK remains fail-closed. CONFIRM_REQUIRED uses explicit Yes/No, where No performs no mutation and keeps the proposal pending.
- **Agent Picker list:** after Agent login, active Picker observation is independent from WMS/Web Confirm readiness and the business-processing window. It reuses one Agent-sync gRPC stream targeting the existing `agent_sync` and authoritative `picker_presence_projection/current` documents, and stops on Agent logout; PickList mutation gates remain unchanged.
- Repair lineage target: Web Version 2, Agent v105, next monotonic Android Beta after vc96. Stable remains OWNER-GATED and untouched.


## D161 repaired candidate field-retest readiness — 2026-10-04

- Owner-reported three-item field repair merged via PR #427 at main `afaf9d563894e61d3632f65ce624c1b3b76bfd36`.
- Technical/runtime/release gates PASS: Worker/Web run `37199390053`, Agent run `37199390032`, Android run `37199390022`, UI guard `37199390010`.
- Repaired candidates: Web **Version 2**, Agent **relay-agent-v105**, Android **beta-vc97**.
- Repair semantics: business shift outward **06:00–22:00**, technical Replay **05:45–22:15**; HR HARD_BLOCK gives bounded actionable row/reason detail plus one-shot recheck while remaining fail-closed; authenticated Agent observes active Picker authority independent of WMS readiness/business window using one gRPC stream over two exact existing documents.
- No new persistent resource, collection query, per-Picker listener, polling loop or write cadence. Stable remains OWNER-GATED.
- D161 remains not Owner PASS; next action is OA096 field retest.

## D161 v108 fourth field repair technical/runtime/release checkpoint — 2026-10-04

- Owner field retest of relay-agent-v107 was **NOT PASS**: with Agent authenticated and Web Confirm not ready, Picker History remained blank because higher-level `StartListening()` and `IsBusinessAllowed()` still coupled relay ingress/schedule authority to WMS operational readiness.
- Owner approved an **Agent-only** repair inside D161. Android is hard-locked at **beta-vc97**; Worker/Web/Stable are unchanged.
- PR #434 merged to main `217d33f1e25a42931da91c08c5544ca577236d32`. It starts authenticated relay transport without WMS readiness, separates Replay schedule authority from WMS readiness, preserves the strict WMS-ready + PRIMARY/generation mutation fence, and suppresses redundant REST pending-queue polling only when PDA count is zero and the D157 pending realtime listener is healthy.
- Listener disconnect wakes the local transport and restores the existing 15-second REST fallback. Picker presence transition `0 -> active` also wakes locally with no provider operation. Active 3-second, D158 degraded 2-second and HOT 1-second behavior remain bounded as before.
- CI now inspects the actual `StartListening()` and `IsBusinessAllowed()` method bodies so the v107 comment/marker-only false PASS cannot recur. PR #435 merged authority-only fix `5a3c07eb2a0486e2a79861b43b011a6fde739529`; D161 Phase0 Safety, authority and continuity gates PASS.
- Main Agent verification run **37207091449 PASS**. Release **relay-agent-v108** id **403043358**, EXE asset **609938421**, size **7,288,320 bytes**, SHA-256 `b096d45bea049c847a277921e2039f6fd81c75bbfab22cd0ee1be3bf0a177dbf`.
- Inventory channel Agent asset **609938501** matches the same size/SHA; manifest asset is **609938504** and checksum asset **609938500**. Android remains **beta-vc97** with existing APK asset **609733318** and SHA-256 `28626e6058695cf81797c5eb32362365e1408645002d3f0f6b4bdd20c0771e19`.
- No new persistent provider resource, Firestore listener/query family, write cadence, Android heartbeat or Stable mutation was introduced. D160 relay-agent-v97 remains the accepted rescue base until explicit Owner D161 PASS.
- Status: **TECHNICAL/RUNTIME/RELEASE PASS — READY FOR OWNER FIELD RETEST**, not Owner PASS.

## 2026-10-07 — D164 cancellation and future consolidated operations direction

D164 standalone PDA Management is **Owner-cancelled without Owner PASS** and is not part of the accepted base. Existing D164 Beta code/artifacts/resources are frozen historical/reuse candidates; no deletion, redeployment, migration or repurposing is authorized by the cancellation record.

The Owner's successor direction is a future consolidated model for **Nhân sự, ra/vào ca, công nhật, CCDC (including PDA), biên bản and nhận hàng rớt**. This future model is documented in `docs/specs/OPERATIONS_MANAGEMENT.md`, has no change ID yet, and must not be implemented while D165 remains pending Owner PASS. This direction does not expand active runtime/resource scope by itself; any later resource activation requires explicit scope reconciliation.

Current accepted Inventory base remains D163. Current open change is D165. Stable remains OWNER-GATED.

## 2026-10-08 — D165 Owner PASS of deployed Beta baseline; D166 later after 22:00 logs

Owner explicitly accepts all D165 code as already deployed, including Agent `v120`, signed Android `vc102` and deployed Beta Web/Worker/RTDB HA Rules. D165 is closed and becomes the accepted base. **This is not a rollback and not a technical assertion that HA/Usage are healthy.** Field-observed repeated PRIMARY takeover after targeted handoff, RTDB SSE/HTTP 403/timeout behavior, and high Firestore Reads/Writes remain known issues for comprehensive D166 analysis after the Owner sends end-of-shift 06:00–22:00 logs. Do not open D166 or mutate any code before those materials are reviewed and Owner agrees to the optimization plan. Stable OWNER-GATED unchanged.
