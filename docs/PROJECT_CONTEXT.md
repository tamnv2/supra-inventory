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
- Mutation is fail-closed: re-resolve the exact row, select only that row checkbox, verify checked, then click one uniquely identified enabled **Xác nhận lấy lại hàng** button. Never click **Xác nhận hoàn thành lấy hàng** or another nearby button.
- Firestore request/ACK, HA ownership, confirmation guards, anti-spam, operating schedule, Picker presence/contact and Báo hàng behavior remain unless explicitly changed by D126.
- SKU master is manual-file-only through the existing authorized file-import workflow. WMS/Tồn Bin SKU synchronization is retired; automatic SKU update is deferred.
- D125 Office-client rewrite is cancelled before implementation.
- v48 field re-test isolated the remaining readiness defect to the real magnifying-glass + **Tìm Kiếm** control. D126-H3 is merged and technically released as `relay-agent-v49`, with decorative-icon-tolerant search recognition only; exact confirmation mutation guards remain unchanged. OA051 real-Supra field re-test on v49 is the remaining acceptance layer.
- Stable remains OWNER-GATED.

