# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`.

- Project: `supra-inventory`
- Web: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`
- Android: `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed review APK: `beta-vc45`
- Web runtime source: `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- Android beta-vc45 source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`
- Owner UI review: **D067 items 1–8 and 10 accepted/frozen; D068 item 9 and requirements 11–15 pending**

## D057 baseline + D058/D059/D060/D061/D062/D063/D064 refinements

Visual authority:
- old UI repository: `tam95supra-source/bao-hang-1291`
- pinned reference commit: `8713f487386fa39c9225b180b2b8448d4a7e2b2d`
- Owner-provided old running-product screenshots
- D057 in `docs/OWNER_DECISIONS.md`
- D058 Web shell refinement in `docs/OWNER_DECISIONS.md`
- D059 Web header/identity refinement in `docs/OWNER_DECISIONS.md`
- D060 Root-role/theme refinement in `docs/OWNER_DECISIONS.md`
- D061 dark/sidebar/realtime cleanup in `docs/OWNER_DECISIONS.md`
- D062 final Web QA/canonical navigation in `docs/OWNER_DECISIONS.md`
- D063 consolidated operations/logs/reporting/presence/people refinement in `docs/OWNER_DECISIONS.md`
- D064 detailed system status + controlled Beta load test + post-test IA review in `docs/OWNER_DECISIONS.md`

Current review endpoints:
- Web: `https://inventory-beta.supra.cc.cd/`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc45/supra-inventory-beta.apk`

D064 detailed system status is deployed on Beta and technically PASS. Controlled Beta load test run `35376099693` PASS with 1,000/1,000 real Picker reports across 100 existing Pickers and 400 existing SKUs in 525.423 seconds, no errors; temporary gate verified closed. Navigation IA was approved by Owner as D066 and is deployed on Beta; PR #50 guards PASS, main UI Design Guard `35407227884` PASS, Beta deploy `35407227911` PASS.

Android/PDA presentation includes transplanted old native activity/login/Picker/Invent/Admin/row/overlay XML plus drawables/colors/styles, with current controllers bound to those resources.

Legacy backend/provider/auth/storage/database/credential code remains excluded.

## Automated evidence

- PR #31 merged at `fa677463`.
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35309444877`: PASS.
- Deploy Beta run `35309444859`: PASS.
- Verify Beta Android run `35309444931`: PASS.
- Signed release: `beta-vc43`.
- APK SHA-256: `37dbc5e64cd144bbcb9dcb3787d7b65a3486907746822d95a8e902e52f9a27d8`.
- APK size: `9283170` bytes.
- Runtime continuity PR #32 merged; main currently contains vc43 runtime evidence.
- D058 Web review repair PR #34 merged at `d848546d429dba60bb88e6f9686e83b05c730994`.
- D058 PR UI Design Guard run `35313797934`: PASS.
- D058 Beta deploy run `35313918056`: PASS, including health/business-auth/Web-shell/Google-OAuth smoke checks.
- D059 Web header/identity PR #36 merged at `b93175cfc62ff4504d6e28b9379b09ba4e61f809`.
- D059 PR UI Design Guard run `35321914326`: PASS.
- D059 Beta deploy run `35322055302`: PASS, including health/business-auth/Web-shell/Google-OAuth smoke checks.
- D059 main push Repo Authority Guard, Project State Guard and UI Design Guard: PASS.

Automated PASS is technical eligibility only. It is not Owner UI acceptance.

## D063 source candidate

`D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` is the active Web source candidate; Android source marker is `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`. `Inventory/Beta/Logs` is created and registered. D062/beta-vc45 remain the deployed/signed runtime references until D063 CI, merge, Beta deploy and signed Android release complete. Stable remains untouched.

## D062 runtime PASS

`D062_WEB_FINAL_QA_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING` is deployed on Beta. PR #42 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`; Deploy Beta run `35347188833` PASS. Scope: canonical five-area Admin/Root navigation over existing approved modules, operational-first landing, hidden-route access repair, and remaining dark transient-surface coverage. Android beta-vc45 and Stable remain unchanged. Owner UI acceptance remains pending.

## D061 runtime PASS

Web-only Owner review refinement:
- dark theme parity across all reachable operational/management/reporting/system surfaces;
- larger sidebar section headings plus inline monochrome icons;
- duplicate category/title and nonessential explanatory copy removed;
- generic `Làm mới` controls removed from realtime-backed operational/results/Picker/user views;
- D060 Root effective-role/theme semantics preserved;
- Android beta-vc45 and Stable unchanged.

Evidence: PR #40 merged at `967365bffa8d518e8ad85d802b14753bc5f4fa1d`; Repo Authority Guard PASS; Project State Guard PASS; UI Design Guard run `35334240734` PASS; Deploy Beta run `35334240991` PASS including health/schema, auth/business guards, Web shell and Google OAuth smoke. Owner UI acceptance remains pending.

## D060 runtime PASS

D060 is deployed on Beta:
- immutable base ROOT may select effective ROOT/ADMIN/REPORTER/PICKER from Web;
- normal HTTP RBAC, realtime projection and role-target FCM honor the effective role;
- Root realtime sockets are revoked on role change;
- Web identity/header/Dashboard head follows current Owner review;
- Web theme supports persisted Auto/Light/Dark; Auto uses Asia/Ho_Chi_Minh dark 18:00–05:59;
- SQLite schema is 6;
- Android beta-vc45 refreshes effective role from `/api/auth/me` on resume.

Evidence:
- PR #38 merge: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`.
- Deploy Beta run `35326095378`: PASS.
- UI Design Guard run `35326095346`: PASS.
- Verify Beta Android run `35326095361`: PASS.
- Signed release: `beta-vc45`.
- APK SHA-256: `c2ee4740ebee30fcdfc0ae8dcda44f7d5116dbefe8fbaed035a885e3d98ca5fb`.
- APK size: `9283170` bytes.
- Stable untouched.

Automated PASS is technical eligibility only. Owner UI/theme/role-test acceptance remains pending.

## Current work frontier

D064 runtime/load work is complete and D066 navigation is Owner-accepted. D067 is merged and Beta runtime PASS; next action is Owner testing of the exact 10 requested items.

For each Owner-rejected screen:
- compare current render to the pinned old source + current Owner feedback;
- fix presentation only;
- branch → PR → guards/build → merge → runtime/release;
- provide the next UI review candidate.

Do not resume business logic/scenario rebuild until explicit Owner UI acceptance.

## Next-chat resume command

`Kiểm tra live D067 và test 10 mục`

A screenshot or concise UI review note may be appended; no project-history restatement is required.


## D063 runtime PASS — 2026-09-19

PR #44 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`. Repo Authority, Project State and UI Design guards PASS. Deploy Beta run `35371181168` PASS including health/schema, auth/business guards, Web shell and Google OAuth start; `LOGS_FOLDER_ID` is bound to `Inventory/Beta/Logs`. Signed Android release `beta-vc45` published from the same source; Verify Beta Android run `35371181163` PASS, APK SHA-256 `fd9882d08d0aca288114595f79e1f2447141c4fb8ed32cf5750dd001a9c58c61`. Authenticated end-to-end Web/Android log upload still requires field verification with a real signed-in client. Stable remains untouched.


## D064 active workstream

Source candidate rebuilds `Trạng thái hệ thống` as a detailed provider/usage/capacity console and adds a guarded Beta-only real-Picker load-test workflow. Core metrics refresh at most every 60 seconds while visible; Google Drive/GitHub reads are cached five minutes. The load test targets 1,000 successful normal Picker reports across 100 existing active Pickers and about 400 existing SKUs within <=600 seconds. Stable is untouched. Navigation grouping is not changed by D064; a measured post-test proposal is required first.


## D064 runtime/load PASS

- Detailed all-service system-status console: Beta deploy PASS.
- Load-test run `35376099693`: 1,000/1,000 reports, 100 existing Pickers, 400 existing SKUs, 525.423s, no errors.
- Response timing: avg 250.34ms; P50 235.95ms; P95 348.72ms; max 625.64ms.
- SQLite growth: +2,572,288 bytes; +400 batches; +1,000 tickets; +1,000 report events; +1,000 realtime events; +1,000 audit rows.
- Temporary Beta load-test gate verified closed.
- Post-test navigation proposal is stored at `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md`; implementation is Owner-gated.
- Stable untouched.


## D065 navigation proposal

Owner constraint: exactly 3 Admin/Root large navigation groups, maximum 5 visible children per group. Proposed composition is VẬN HÀNH (2), QUẢN LÝ (3), HỆ THỐNG (2). Exact composition remains Owner-gated before implementation. Personal account/password action moves out of the business sidebar. Android/PDA and Stable are unchanged.


## D066 Beta runtime PASS

Owner-approved Web navigation is now source-implemented:
- VẬN HÀNH (2): Xử lý báo hàng; Tổng quan & báo cáo
- QUẢN LÝ (3): Danh mục SKU; Nhân sự & tài khoản; Thời gian xử lý
- HỆ THỐNG (2): Trạng thái hệ thống; Nhật ký
- personal account/password moved to pinned identity controls
- HR source + Picker sync moved under the Nhân sự & tài khoản workspace
- Reporter/Picker projections remain role-specific
- Android/PDA unchanged; Stable untouched

Current Web marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.

D066 runtime evidence:
- PR #50 merged at `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- PR Repo Authority / Project State / UI Design guards: PASS
- Main UI Design Guard run `35407227884`: PASS
- Beta deploy run `35407227911`: PASS
- Stable untouched; Android/PDA unchanged
- Owner visual acceptance remains pending


## D067 source candidate — 2026-09-19

`D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` preserves the accepted D066 navigation while implementing the 10 requested Web UX corrections. PR guards and Beta runtime verification are still pending. Android and Stable are unchanged.


## D067 runtime PASS — 2026-09-19

PR #52 merged at `c2249ceea9fbb9570c3855fc2a0a421b251e3328`. Repo Authority Guard `35411796234`, Project State Guard `35411796230`, UI Design Guard `35411796208` and Beta deploy `35411796215` all PASS. Current Web marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. Stable is untouched and OWNER-GATED.


## D068 source candidate — 2026-09-19

`D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` preserves frozen D067 items 1–8 and 10 and changes only item 9 plus requirements 11–15. Log review shows healthy connection/realtime and low browser memory use; D068 makes route display immediate, targets SKU detail updates, adds browser section history and replaces action banners with bounded toast notifications. PR/runtime verification PASS; Owner test pending. Android and Stable unchanged.


## D068 runtime PASS — 2026-09-19

PR #54 merged at `ba8579a157763288ff0cc3cca885e65e593917be`. Repo Authority Guard `35416184056`, Project State Guard `35416184002`, UI Design Guard `35416184004` and Beta deploy `35416184023` all PASS. Current Web marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. D067 items 1–8 and 10 remain frozen. Stable remains untouched and OWNER-GATED.


## D068 clean-log-copy runtime PASS — 2026-09-19

PR #56 merged at `656fb8d24b44e7adb087aabb6a8a02691b278d43`; main Repo Authority Guard `35417472683`, Project State Guard `35417472778`, UI Design Guard `35417472752` and Beta deploy `35417472735` PASS. Nhật ký no longer exposes raw runtime-log filenames or raw JSON in normal UI; structured operational summary is deployed. Stable remains OWNER-GATED.


## D069 active Web candidate — 2026-09-19

The complete D068 Web review is Owner-accepted. Current candidate `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` covers rich redacted Web diagnostics, Excel reporting export, unified Web presentation and UI-delay optimization. Enhanced pending-SKU alert policy is not implemented before Owner approval. Stable remains OWNER-GATED.


## D069 Beta runtime PASS — 2026-09-19

PR #58 merged at `fbd2e5c84ec2c401c784d5921b82aa6689bed2ee`. Main Repo Authority Guard `35419150651`, Project State Guard `35419150563`, UI Design Guard `35419150637` and Beta deploy `35419150648` all PASS. Deployed scope: rich redacted Web diagnostics, native Excel `.xlsx` export, unified Web presentation including `Thời gian xử lý`, and scoped-render/off-screen-paint responsiveness work. D068 is fully Owner-accepted/frozen. D069 item 3 pending-SKU alert behavior is proposal-only and not implemented. Stable untouched.


## D070 approved three-stage timing candidate — 2026-09-19

Owner approved the enhanced alert policy with three entered minute thresholds constrained as `warning < escalation < auto_skip`, an auto-Skip enable/disable switch and `FIRST_REPORT` / `PER_PICKER` timing modes. D050 no-auto-Skip is superseded. Current source candidate `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` implements InventoryCore Durable Object alarms, idempotent warning/escalation events, optional `SKIP_ALLOWED / SYSTEM_TIMEOUT`, exact Picker ACK targeting, grouped role alerts, Web/Android timeout surfaces, non-retroactive activation and fail-safe disable/mode-change cancellation. No extension feature is included. Stable untouched/OWNER-GATED.

D070 Android source marker: `D070_TIMEOUT_ALERT_PROJECTION_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`. Android changes are limited to timeout/deadline/result-source projection and background-alert labels; signed Beta release verification remains pending. Stable untouched.


## D070 Beta technical/runtime PASS — 2026-09-19

PR #60 merged at `3f3506a0f185d5e1a0f22ba6a908b161bae6dd6e`. Main Repo Authority Guard `35426339784`, Project State Guard `35426339862`, UI Design Guard `35426339800` and Beta deploy `35426339796` all PASS. Live health reports SQLite schema `7/7` and Operational V2 schema `5/5`; auth/business API, Web shell and Google OAuth smoke are PASS. Signed Android `beta-vc46` was published by Verify Beta Android run `35426339846` after the matching Beta runtime gate passed; APK SHA256 is `875b5bd32f22f77fbe7453020d38c60d587a97720bd14cecdae89d202e39287e`.

D070 deployed behavior: three entered thresholds with strict `warning < escalation < auto_skip`; automatic Skip ON/OFF; `FIRST_REPORT` and `PER_PICKER` timing; Durable Object alarm authority; `SKIP_ALLOWED / SYSTEM_TIMEOUT`; exact Picker result/ACK targeting; grouped Reporter/Admin/Root alerts; existing 5-minute Skip→Có hàng correction; no extension feature; D007 queue ordering unchanged; activation is non-retroactive. Technical/runtime PASS is complete. Owner live timing/device/background-FCM acceptance is still required. Stable remains untouched/OWNER-GATED.


Current Android marker: `D070_TIMEOUT_ALERT_PROJECTION_SIGNED_BETA_VC46_RUNTIME_GATE_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.


## D071 Web immediate-response/density candidate — 2026-09-19

Owner accepted the preceding Web review points and requested four Beta-Web refinements. Current source marker: `D071_WEB_IMMEDIATE_RESPONSE_DENSITY_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`.

- normalize every Web checkbox to one compact fixed size;
- raise the Web typography baseline by about 5%, with that new baseline displayed as logical `100%` in the existing text-size control;
- compress Overview/Detailed-report date selection into one inline date/preset group instead of a large extra row;
- Reporter final `Có hàng` / `Bỏ qua` confirmation closes immediately, shows a per-batch in-progress state, waits for authoritative service success before showing success toast, removes the old synchronous post-mutation `loadOperations()` chain, and coalesces concurrent complete-queue refreshes.

Support logs show no browser long tasks or memory pressure. The observed 1–3 second delay is dominated by roughly 0.8–0.9 second resolve POSTs followed by complete queue/recent refresh/realtime reconcile work; section DOM render itself is only tens of milliseconds. Android/PDA is unchanged. Stable remains untouched/OWNER-GATED.

Next command after runtime PASS: `Kiểm tra live D071 và review 4 mục Web mới`.


## D071 deploy blocker / D070 alarm runtime repair — 2026-09-19

D071 Web source merged at `f5c6287bdc0a2fa28c4de68116e910c3300b2255`; PR and main authority/state/UI/regression guards PASS. Beta deploy run `35429735327` built and deployed successfully on two attempts, but both attempts failed the live health gate: `HTTP 503 degraded`, all required bindings present, `storage.ok=false`, schema `0/0`, Operational V2 `0/0`. D071 changed no service source, so D071 runtime PASS is **not** declared.

Source investigation found a D070 alarm scheduling defect: if an alarm first sees a batch after escalation is already due, ESCALATED can be recorded while WARNING remains unrecorded. The scheduler then continues to see the old WARNING deadline in the past and can re-arm every 250 ms indefinitely. Current repair marker: `D070_ALARM_RUNTIME_AVAILABILITY_REPAIR_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`. The repair consumes a missed warning without emitting a late warning, bounds catch-up to 50 rows/category, enforces at least one second between catch-up alarms, schedules authoritative next work before notification delivery, and prevents downstream realtime/FCM delivery failure from throwing/retrying already-committed alarm work. D070 business semantics remain unchanged. Android beta-vc46 unchanged. Stable untouched/OWNER-GATED.

Current Web marker: `D071_WEB_SOURCE_MERGED__BETA_HEALTH_BLOCKED_BY_D070_STORAGE_UNAVAILABLE`.
Current Android marker: `D070_TIMEOUT_ALERT_PROJECTION_SIGNED_BETA_VC46_RUNTIME_GATE_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.

Next action: repair guards → merge → Beta deploy → require health/storage/schema/auth/business/Web/OAuth PASS → record D071 runtime continuity → Owner reviews the four D071 Web items.


## D070 runtime repair + D072 quota guard — 2026-09-19

Current source marker: `D070_ALARM_REPAIR_D072_SYSTEM_STATUS_QUOTA_GUARD_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`.

- D070 repair prevents an already-past warning deadline from continuously re-arming after escalation, bounds alarm catch-up, schedules the next authoritative alarm before downstream delivery, and prevents realtime/FCM failure from retrying committed alarm work.
- D072 removes `Trạng thái hệ thống` from normal Web navigation/routing, removes its manual/60-second monitoring calls, disables `GET /api/admin/system-status` before metric collection, and keeps Beta load-test snapshots core-only without Google Drive/GitHub provider reads.
- D071 Web source remains merged and will be runtime-reviewed only after Beta health recovers.
- Stable remains untouched/OWNER-GATED.

Next action: guards → PR → merge → Beta deploy → health/schema/auth/business/Web/OAuth PASS → record runtime continuity.


Current Web marker: `D071_WEB_SOURCE_MERGED__D072_SYSTEM_STATUS_EXCLUDED_SOURCE_IMPLEMENTED__BETA_RUNTIME_REPAIR_PENDING`.


## D070 repair + D071/D072 Beta runtime PASS — 2026-09-19

Runtime source: `ca5ab13a3f52722b595ce7a713afa95891a8b002` (PR #63).

Main Repo Authority Guard `35439017807`, Project State Guard `35439017780`, UI Design Guard `35439017789` and Beta deploy `35439017752` all PASS. Beta health passed on the first probe: HTTP 200, storage ready, SQLite schema `7/7`, Operational V2 `5/5`; auth/Root bootstrap, business API/auth guards, Web shell and Google OAuth start also PASS.

Current Web marker: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`. D071 is live for Owner review: uniform checkboxes, logical 100% at the new ~5% larger baseline, compact date controls, and immediate Reporter Có hàng/Skip pending feedback without synchronous full-queue reload. D072 is live: normal `Trạng thái hệ thống` navigation/routing/manual/60-second polling is removed, the normal admin system-status endpoint is quota-guard disabled, and the gated Beta load-test snapshot is core-only without Google Drive/GitHub provider reads. `HỆ THỐNG` exposes only `Nhật ký`.

Android remains signed `beta-vc46` and unchanged by PR #63. Stable remains untouched/OWNER-GATED.


## D073 Picker-to-Agent relay POC build/release PASS — 2026-09-19

Source merged in PR #65 at `f7c596f60eac626989a58ea40492417006ee61b1`.

PR Authority/Continuity/UI/Windows Agent gates PASS. Main Authority/Continuity/UI, Beta deploy `35442854000`, Verify Beta Android `35442853998`, and Verify Beta Relay Agent `35442853985` PASS. Signed Android release is `beta-vc47` with APK SHA-256 `8e2fc11e09940db061edf4c23b5973ec2be9300b2ddfc4835bcef1d3af74c439`; portable normal-user Windows Agent EXE SHA-256 is `1b51c33d53a53a0fb8b7c6a9c4f4305f7c042bbd2c97e91b082144587c7bdd73`.

D073 remains a transport-only Beta POC: Picker sends exactly five test digits through Firebase RTDB and the Windows Agent returns ACK/diagnostic timing. There is no WMS lookup or mutation. `OA002` remains OPEN: create the scoped Beta RTDB in Singapore locked mode, publish `firebase/database.rules.json`, then field-test PDA → relay → laptop on Office → ACK/RTT. Stable remains OWNER-GATED and untouched.

Current Android marker: `D073_RELAY_POC_SIGNED_BETA_VC47_BUILD_PASS__D070_FIELD_ACCEPTANCE_PENDING`.


## D074 relay field repair — 2026-09-19

First Office field test reached Firebase but authenticated RTDB read/SSE returned HTTP 403. D074 classifies this as auth/Rules/path rather than generic network failure. Android and Windows now derive the relay path from Firebase ID-token `sub`; the Windows Agent gains persistent sanitized local diagnostics and explicit RTDB 403 classification. Picker is being split into bottom-pinned **Báo hết hàng / Xác nhận đơn** panels with denser controls and reliable exact-five-digit input/send. No WMS mutation exists in this phase; Stable remains OWNER-GATED.

Current Android marker: `D074_PICKER_SPLIT_TABS_RELAY_INPUT_AUTH_REPAIR_IN_PROGRESS__LATEST_SIGNED_BETA_VC47`.


## D074 build/release PASS — 2026-09-19

- Source: PR #67 / main `7464c3c3a89db00e657021bcec960c1e5ea53fd8`.
- Beta deploy run `35445109008`: PASS.
- Main Repo Authority / Project State / UI Design: PASS.
- Verify Beta Android run `35445108881`: PASS; signed release `beta-vc48`, APK size `9317178` bytes.
- Verify Beta Relay Agent run `35445108964`: PASS; artifact `10584778212`, ZIP SHA-256 `72d51fc4c6ab6e77d1d5cb9c0ba124a52eddd0fad929c24ac727fadea0f51628`.
- D074 RTDB identity/path repair, sanitized Agent diagnostics, Picker split tabs and exact-five-digit send are build/release eligible.
- Physical Office RTDB/SSE + PDA ACK/RTT acceptance remains pending.
- No WMS mutation exists. Stable untouched and OWNER-GATED.


Current Android marker: `D074_PICKER_SPLIT_TABS_RELAY_UID_AUTH_DIAGNOSTICS_SIGNED_BETA_VC48_BUILD_PASS__OWNER_FIELD_RETEST_PENDING`.


## D075 shared relay / ADMIN Agent — 2026-09-19

- Root cause of the D074 timeout is identified: both Firebase transports were HTTP 200, but Picker 100 and Agent Picker 200 used different UID-isolated RTDB branches.
- D075 implementation target: shared `relay_poc/jobs` queue, real base-role ADMIN Agent authentication/audit identity, first-writer ACK ownership and dedicated prerelease self-update.
- Updated RTDB Rules publication and physical field acceptance remain pending after build/release.
- No WMS mutation. Stable remains OWNER-GATED.

Current relay marker: `D075_SHARED_PICKER_QUEUE_ADMIN_ONLY_AGENT_AUTO_UPDATE_IN_PROGRESS__NO_WMS_MUTATION`.


## D075 build/release PASS — 2026-09-19

- Source: PR #69 / main `9b149e56b4781eb905daa6793db6a220a045cf5a`.
- Main Authority / Continuity / UI Design: PASS.
- Beta deploy `35447318213`: PASS.
- Verify Beta Android `35447318221`: PASS; signed release `beta-vc49`.
- Verify Beta Relay Agent `35447318236`: PASS; dedicated prerelease `relay-agent-v2`, EXE 49,664 bytes.
- Android `/releases/latest` remains `beta-vc49`; Agent prerelease does not interfere with Android OTA.
- D075 shared queue, real ADMIN Agent identity/audit and automatic Agent update are source/build/release PASS.
- Beta RTDB still needs the merged D075 Rules published before physical field acceptance.
- No WMS mutation. Stable untouched and OWNER-GATED.

Current relay marker: `D075_SOURCE_BUILD_DEPLOY_RELEASE_PASS__RTDB_RULES_PUBLISH_AND_FIELD_TEST_PENDING__NO_WMS_MUTATION`.


Current Android marker: `D075_SHARED_RELAY_SIGNED_BETA_VC49_BUILD_PASS__RULES_PUBLISH_FIELD_TEST_PENDING`.


## D076 automated Beta RTDB Rules — 2026-09-19

Owner reports the one-time GitHub Environment `beta` secret `FIREBASE_RULES_SA_JSON_BETA` is configured. D076 moves Beta RTDB Rules publication from manual Firebase Console work to CI: pull requests validate credential/read access only; merged main changes deploy `firebase/database.rules.json` to `supra-inventory-beta`. Stable is never targeted and remains OWNER-GATED.

Current relay marker: `D076_AUTO_RTDB_RULES_DEPLOY_IN_PROGRESS__D075_SOURCE_BUILD_RELEASE_PASS__NO_WMS_MUTATION`.


## D076 RTDB REST deploy repair — 2026-09-19

D076 credential validation proved the Environment secret is present, belongs to `supra-inventory-beta`, can mint OAuth directly from its private key, and can read Firebase Rules API. The first main deploy using Firebase CLI failed opaquely during RTDB syntax-check. The repair replaces Firebase CLI with the official scoped RTDB `/.settings/rules.json` REST interface: PR checks `firebasedatabase.instances.update` plus Rules read access without mutation; main performs PUT then exact JSON readback verification.

Current relay marker: `D076_RTDB_REST_DEPLOY_REPAIR_IN_PROGRESS__PR_CREDENTIAL_READ_PASS__MAIN_FIREBASE_CLI_DEPLOY_FAILED__NO_WMS_MUTATION`.


## D076 PR validation PASS — 2026-09-19

PR #72 read-only CI has verified the configured Beta service-account credential, direct OAuth token exchange, `firebasedatabase.instances.update`, and authenticated RTDB Rules GET access. No Owner IAM/Rules setup action remains. After current guards PASS, merge PR #72; the main-only workflow must PUT the canonical D075 Rules to the scoped Beta RTDB and readback-verify exact JSON before D075 field acceptance.

Current relay marker: `D076_PR_VALIDATION_PASS__MAIN_RTDB_RULES_DEPLOY_PENDING__D075_RELEASE_PASS__NO_WMS_MUTATION`.


## D076 main Rules deploy PASS — 2026-09-19

PR #72 merged at `452feb1e25dff936617e5d1d51313438d85155eb`. Main workflow `35451292051` completed PASS and proved the full Beta Rules path: `firebasedatabase.instances.update` permission PASS, authenticated RTDB Rules GET PASS, canonical Rules PUT PASS, and exact JSON readback verification PASS. Beta RTDB now has the D075 shared Picker queue / real ADMIN Agent rules deployed automatically through GitHub Actions.

No Firebase/IAM/Rules setup action remains. The only remaining relay acceptance is the physical field test using signed `beta-vc49` and `relay-agent-v2`: real ADMIN Agent on the laptop, Office check/listener, then any Picker PDA sends five digits and receives ACK with ADMIN + machine + Agent instance + RTT.

Current relay marker: `D076_RTDB_RULES_DEPLOY_PASS__D075_FIELD_TEST_PENDING__NO_WMS_MUTATION`.
Current Android marker: `D075_SHARED_RELAY_SIGNED_BETA_VC49__D076_RULES_DEPLOY_PASS__FIELD_TEST_PENDING`.


## D077 Office proxy HTTP response repair — 2026-09-19

Field log shows `.PDA@MSN` RTDB GET PASS and `.Office@MSN` Firebase refresh PASS, followed by `ObjectDisposedException` before the real RTDB/proxy HTTP status could be surfaced. Source review found `ToRelayHttpException()` disposed `HttpWebResponse` and then read `StatusCode`. D077 captures status/response diagnostics before disposal, preserves sanitized error reporting, bumps the portable Agent to `relay-agent-v3`, and leaves D075 shared ADMIN relay plus D076 deployed Rules unchanged. No APK/WMS change.

Current relay marker: `D077_OFFICE_PROXY_HTTP_RESPONSE_DISPOSAL_REPAIR_IN_PROGRESS__D076_RULES_PASS__NO_WMS_MUTATION`.


## D077 Agent v3 release PASS — 2026-09-19

PR #74 merged at `a501282daeced491eda8883701a60a04b5f646eb`. Main Repo Authority `35452095791`, Project State `35452095808`, UI Design `35452095855`, and Verify Beta Relay Agent `35452095820` all PASS. Dedicated prerelease `relay-agent-v3` is published; EXE asset id `575004937`, size `50176` bytes.

D077 fixes the Office proxy error path by capturing `HttpWebResponse.StatusCode` and safe response metadata before disposal. The prior v2 field log had shown Office Firebase refresh PASS, then the EXE itself threw `ObjectDisposedException`, masking the actual proxy/RTDB status. v3 preserves the real HTTP error for diagnosis. D075 shared ADMIN relay and D076 deployed Rules are unchanged. No APK or WMS mutation change.

Current relay marker: `D077_AGENT_V3_RELEASE_PASS__OFFICE_FIELD_RETEST_PENDING__D076_RULES_PASS__NO_WMS_MUTATION`.


## D078 Office transport probe matrix — 2026-09-19

Field evidence proves `.Office@MSN` allows Firebase Secure Token but Wincommerce proxy blocks the Beta RTDB `*.firebasedatabase.app` endpoint with an HTML URL-filter block page. D078 adds read-only Agent probes for Firebase Auth, RTDB, Firestore, Apps Script, Sheets, Drive and Test tất cả. No replacement transport is selected or provisioned until the Owner runs the matrix on the real Office laptop and returns the sanitized log.

Current relay marker: `D078_OFFICE_TRANSPORT_PROBE_MATRIX_IN_PROGRESS__RTDB_PROXY_BLOCK_CONFIRMED__NO_WMS_MUTATION`.


## D078 Agent v4 release PASS — 2026-09-19

PR #76 merged at `8c9992dc1ae6ec19c7ec63dbd3b656dbf794246e`. Main Repo Authority `35455241759`, Project State `35455241764`, UI Design `35455241767`, and Verify Beta Relay Agent `35455241760` all PASS. Dedicated prerelease `relay-agent-v4` is published; release id `392137381`, EXE asset id `575094426`, size `61952` bytes.

Agent v4 provides read-only Office probes for Firebase Auth, RTDB, Firestore, Apps Script web/API, Sheets, Drive and TEST TẤT CẢ. RTDB proxy blocking remains established field evidence; no replacement transport has been selected or provisioned yet. Owner should run TEST TẤT CẢ once on `.Office@MSN` and provide the sanitized Agent log. No APK/WMS mutation change.

Current relay marker: `D078_AGENT_V4_RELEASE_PASS__OWNER_OFFICE_PROBE_PENDING__RTDB_PROXY_BLOCK_CONFIRMED__NO_WMS_MUTATION`.


## D079 workstream routing checkpoint — 2026-09-19

- Confirmation/relay work is **paused, not failed**: D078 Agent v4 technical/release PASS; physical Office probe remains pending.
- Exact resume phrase: `tiếp tục build xác nhận lấy lại hàng`.
- Resume checkpoint: `relay-agent-v4` + `beta-vc49`; run **TEST TẤT CẢ** on `.Office@MSN`, return sanitized log, then choose a reachable transport. No new relay provider is authoritative yet.
- Active next-session workstream is **Báo hàng Web/APK** from fresh canonical `main`.
- Do not resume D078 during Báo hàng work unless Owner explicitly routes back to it.
- Stable remains OWNER-GATED.

Current confirmation marker: `D078_AGENT_V4_RELEASE_PASS__PAUSED_OWNER_AWAY_FROM_OFFICE__RESUME_TRIGGER_D079__NO_WMS_MUTATION`.
Current active workstream marker: `BAO_HANG_WEB_ANDROID_ACTIVE_FOR_NEXT_SESSION`.

## D080 Agent ↔ Supra read-only POC — Agent v5 release PASS

D080 source/PR/main build and dedicated prerelease are PASS. `relay-agent-v5` is published from merged main with EXE SHA-256 `27b1ca9091e19047def478881692fe7cd7d9b930586e028fe33a1605ddcf0376`. Owner field action is now `TEST SUPRA`: no F12/cURL, sign in to the dedicated Edge WMS window only if WMS asks, then provide sanitized result/log. The probe remains WMS UI + signed read-only zones GET only; no Picklist lookup/confirmation/mutation. D078 PDA ↔ Agent Office testing remains separately pending.

Current relay marker: `D080_AGENT_V5_RELEASE_PASS__OWNER_WMS_FIELD_TEST_PENDING__D078_OFFICE_PENDING__NO_WMS_MUTATION`.

## D081 Agent v6 reliability/security/taskbar — source candidate

Owner field log on relay-agent-v5 proved Agent ↔ Supra read-only API works, but the first WMS capture can fail with `ClientWebSocket` state `Aborted` before login completes. D081 removes the short per-receive cancellation, gives the official WMS browser up to five minutes, prefers Edge and falls back to Chrome. WMS credentials remain browser-only; the Agent does not add a WMS password field. SUPRA Inventory ADMIN login remains the existing HTTPS/Firebase + DPAPI flow and clears the password UI immediately. A local-only taskbar monitor shows CPU %, current/approximate MHz and RAM used/total about every two seconds; it consumes no service quota and is the future surface for PL/online counters.

Current relay marker: `D081_AGENT_V6_SOURCE_IN_PROGRESS__WMS_LOGIN_WAIT_FIX__CHROME_FALLBACK__TRAY_MONITOR__NO_WMS_MUTATION`.

## D081 Agent v6 release PASS

PR #81 merged at `a0a68da1e72ba9a8f7bb728db0951b6fd2c23f47`; main Verify Beta Relay Agent run `35458750768` PASS and published `relay-agent-v6`. EXE size 84992 bytes, SHA-256 `7eca617aeb38bda403ca975e07ebdd8a323fbde19b90ef22f0d549b7b0f4b61e`. v6 removes the short per-receive WebSocket cancellation that caused the v5 first-login `Aborted` failure, allows the full five-minute official WMS login window, adds Edge→Chrome fallback, keeps WMS credentials browser-only, clears ADMIN password UI immediately, and exposes local taskbar CPU/MHz/RAM status. Owner field retest is required for first-attempt WMS capture and tray display. No WMS mutation; D078 Office transport remains separate/pending.

Current relay marker: `D081_AGENT_V6_RELEASE_PASS__OWNER_FIRST_ATTEMPT_WMS_RETEST_PENDING__D078_OFFICE_PENDING__NO_WMS_MUTATION`.

## D082 read-only Picklist lookup + persistent overlay — source candidate

D082 extends the confirmation POC only to Picklist existence lookup. Existing Internet/RTDB PDA ↔ Agent transport remains unchanged for the Owner's home test; D078 Office transport remains pending. Agent v7 source adds a persistent topmost overlay with opacity/position persistence and locked click-through behavior, suppresses repeated WMS login while a HY1 RAM session is valid, and converts five-digit PDA requests into a signed read-only Picklist-list GET. PDA receives `CÓ PICKLIST` / `KHÔNG CÓ PICKLIST` or explicit session/schema/transport errors. Confirmation page is reference-only; no WMS mutation is authorized or implemented.

Current relay marker: `D082_READONLY_PICKLIST_LOOKUP_SOURCE_IN_PROGRESS__AGENT_V7_ANDROID_RELEASE_PENDING__D078_OFFICE_PENDING__NO_WMS_MUTATION`.
