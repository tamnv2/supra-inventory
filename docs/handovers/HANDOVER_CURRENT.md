# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc59`
- Current released Agent: `relay-agent-v20`
- Beta: `D096_WMS_EXACT_RESOLVER_SOURCE_READY__CURRENT_AGENT_V20_PDA_AGENT_FIELD_PASS__TARGET_V21__BETA_VC59_UNCHANGED__OA017_AFTER_RELEASE`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D095_SIGNED_BETA_VC59_PDA_AGENT_FIELD_PASS__NO_D096_ANDROID_CHANGE`
- D089: **OWNER ACCEPTED PASS**
- Stable: `OWNER_GATED`

## 2. Accepted D089 baseline

Owner confirmed on 2026-09-21 that the D089 result **đã đạt**. The following are accepted and must not be regressed unless a later explicit Owner requirement supersedes them:

1. Exact selected icon #4 is the shared Web / Android / Agent identity.
2. Web `Dịch vụ` and realtime `Đồng bộ` are independent statuses.
3. `HỆ THỐNG → Công cụ` is coherent in dark theme.
4. Agent Overlay supports master ON/OFF, granular Laptop/Agent metric selection, resize, colors, lock/click-through and local persistence.
5. Agent is single-instance per Windows user session; duplicate launch restores/activates the existing instance instead of creating another runtime.

`OA011` is closed PASS.

## 2A. D090 Office transport boundary

Owner confirmed on 2026-09-21 that Office should be treated as internal Supra plus selected Google services only. Sanitized field evidence: WMS UI/API read-only PASS, Firebase Auth PASS, RTDB corporate-proxy 403, and Google-hosted Firestore/Apps Script/Sheets/Drive endpoints reachable. Do not retest Cloudflare/Worker on Office. Firestore is the preferred next candidate from D078 but remains unselected until an authenticated Beta relay/HA/quota proof.

## 2B. D091 Firestore field candidate

D091 infrastructure is runtime PASS: Beta Firestore `(default)` exists in `asia-southeast1`, locked Security Rules are deployed through the Firebase Rules Management API, and the `cloud.firestore` release was read back successfully on main run `35548847740`. Field artifacts `relay-agent-v16` and signed `beta-vc55` are released. The remaining gate is one physical Office transport-only round trip with one Agent and `TRANSPORT_ONLY` ACK. It does not query/mutate WMS and does not yet implement final multi-Agent HA. Transport failure routes directly to Apps Script.

## 3. Released artifacts and evidence

D089 runtime:
- PR #99 merged at `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Release checkpoint PR #100 merged at `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`.
- Main Beta Worker/UI/Agent/Android/Authority/State gates all PASS.

Released artifacts:
- `relay-agent-v16`: canonical EXE `Agent.Auto.Confirm.Pick.Pack.exe`, SHA-256 `796ca102c4b240ae58094302ed690cc93d65f72f20e42cd526d734a8ca2f34b5`.
- `beta-vc55`: APK SHA-256 `e562f68c16fc2411ecd74d3a72e1650e01f5108a5fba65954d4532ae6bbd9818`.
- D091 Firestore infrastructure: main `cecf56079eba144188a0080bca8b1e78bcbfdd00`, run `35548847740` PASS with database readback plus Rules release readback.

## 4. Open boundaries

- D091 infrastructure and releases are PASS; one physical PDA → Firestore → Office Agent → Firestore → PDA field round trip remains. RTDB/Cloudflare Office retest stays closed.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.
- Do not alter Stable unless the Owner explicitly authorizes it.

## 5. Next action

D089 remains the accepted UI/runtime baseline. D091 Firestore infrastructure and field artifacts are ready; the next action is the Owner's one physical Office PDA ↔ Agent transport-only round trip using `relay-agent-v16` + `beta-vc55`.

On the next session:
1. read `ops/authority-manifest.json`;
2. read the complete declared `bootstrap_order`;
3. verify recent commits/CI and relevant live source;
4. execute the Owner's next explicit requirement from this D089 accepted baseline.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và xử lý yêu cầu mới.**

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.

## D092 release-state refresh — 2026-09-21

- SQLite schema: `8`.
- Web status: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D092_SIGNED_BETA_VC56_CONFIRMATION_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Latest signed Beta APK: `beta-vc56`.
- Windows Agent: `relay-agent-v17`.
- D092 technical/runtime/release: PASS; OA013 Owner real Picklist confirmation: PENDING.
- Stable: OWNER-GATED / untouched.

## D093 current repair checkpoint — 2026-09-21

- D091 authenticated PDA → Firestore → Office Agent → Firestore → PDA field PASS remains the carrier-selection authority.
- D092 released `relay-agent-v17` / `beta-vc56` exposed a field regression: Firestore coordination/relay could fail after network transition while Agent online state could remain misleading.
- D093 preserves Firestore and repairs the regression: current Windows proxy per Firestore request, safe-read transient retry, truthful `Online 0 / FIRESTORE OFFLINE`, bounded 10-second leadership grace, and Android 30-second PENDING claim grace with 120-second total wait.
- PR #111 is merged and released as `relay-agent-v18` + `beta-vc57`; OA014 is READY_FOR_OWNER_FIELD_TEST. OA013 real Picklist confirmation remains blocked until OA014 PASS.
- Stable remains OWNER-GATED and untouched.

## D093 release-state refresh — 2026-09-21

- Main: `377159ed6722eede6b7716c9c83066b863a4e805`; PR #111 merged.
- Main Authority / State / Beta Worker / UI / Agent / Android workflows all PASS.
- Released Agent: `relay-agent-v18`, SHA-256 `96e2cde601f41908e1af10492a4bd8b9e8a47a905ce464d33d4917038838acb7`.
- Released signed APK: `beta-vc57`, SHA-256 `f655844b1222787938cacf169ca2f158630ab536b0a9c252f19f56d60cc3ce19`.
- Next action: OA014 physical Firestore PDA-Agent regression re-test. OA013 remains blocked until OA014 PASS.
- Stable remains OWNER-GATED and untouched.

## D094 current repair checkpoint — 2026-09-21

- Owner field log from released v18 confirms saved ADMIN DPAPI session/Firebase refresh and WMS restore work, while no PDA request reached Agent claim/ACK.
- Manual Firestore probe could return HTTP 200 while the D093 helper intermittently used DIRECT and failed DNS/connect; D094 restores the D091-proven default Windows proxy path first, with fresh-system proxy only as a bounded safe-read retry.
- Agent v19 source adds persistent-login UX completion: authenticated login controls dim/disable, explicit Logout clears the saved application session, next login replaces identity, and Overview shows Agent verification state.
- Confirmation receive uses a direct `PENDING + ANDROID_CONFIRM_V1` Firestore query with bounded newest-first fallback instead of an arbitrary first collection page.
- PDA source shows the short request ID after CREATE so Agent `pending-found → claim → ACK` can be correlated.
- Current released artifacts remain `relay-agent-v18` + `beta-vc57` until D094 merges/releases.
- Next field gate is OA015 after release. OA013 real WMS confirmation remains blocked. Stable remains OWNER-GATED.

## D095 current repair checkpoint — 2026-09-21

- Owner physical test of `relay-agent-v19` + `beta-vc58` failed for Xác nhận đơn even though PDA Firestore CREATE succeeded repeatedly.
- Root cause is confirmed: D094 parsed Firestore JSON arrays with `as ArrayList`; `JavaScriptSerializer` returns an enumerable/object array, so valid query/list results could be interpreted as zero documents. D091 field-PASS code used `IEnumerable`.
- A second field failure deleted a still-PENDING Android job at 30 seconds while Agent Firestore connectivity recovered later. D095 keeps PENDING alive through the 120-second bounded window; 30 seconds is notice-only.
- Agent v20 source refreshes the Windows default proxy on network-address change and gives safe Firestore reads three bounded default/fresh/default route attempts. Firestore never uses the WMS corporate fallback proxy.
- Product paths are explicitly separate: Báo hàng = PDA normal Internet → Worker/InventoryCore; Xác nhận đơn = PDA normal Internet → Firestore → ACTIVE Agent (normal Internet or Office) → Firestore ACK → PDA.
- D095 repair is released as `relay-agent-v20` + `beta-vc59`; technical/runtime/release is PASS. The prior v19/vc58 pair remains historical field-FAIL evidence.
- OA016 is READY_FOR_OWNER_FIELD_TEST. OA013 real WMS confirmation remains blocked until OA016 PASS.
- Stable remains OWNER-GATED and untouched.

## D095 release-state refresh — 2026-09-21

- Main: `52aabdbd3a1eedfa96c6a525dd155b370e9d9138`; PR #115 merged.
- Main Authority / State / Beta Worker / UI / Agent / Android workflows all PASS.
- Released Agent: `relay-agent-v20`, SHA-256 `4e1daa4dc154b7fa850199f1b700819085741cfc4d0311f31827df74cf9f1096`.
- Released signed APK: `beta-vc59`, SHA-256 `5fb4422312cf4380a158cec9d12d1730dc184ea5a468def599edc15508ec8800`.
- D095 technical/runtime/release: PASS.
- OA016 is READY_FOR_OWNER_FIELD_TEST: PDA stays normal Internet; test Agent on normal Internet and Office with matching request IDs; verify Báo hàng remains Worker/InventoryCore and Agent-independent.
- OA013 remains blocked until OA016 PASS.
- Stable remains OWNER-GATED and untouched.

## D096 current repair checkpoint — 2026-09-21

- Owner confirms PDA ↔ Agent now works with released `relay-agent-v20` + `beta-vc59`.
- Field log proves Firestore `pending-found` and `CLAIM PASS`, then WMS exact-resolve GET HTTP 200, followed by `EXACT_CODE_NOT_RESOLVED`; no WMS confirm POST was reached.
- Root cause: `WmsPicklistExactResolver.CollectCodes` was ArrayList-only while .NET `JavaScriptSerializer` returns JSON arrays as `object[]`. The normal lookup parser already handled this correctly.
- D096 changes exact resolution to non-string `IEnumerable`, adds redacted parser counts and executable CI regression using synthetic JSON.
- Existing authorized confirm endpoint/payload remains unchanged. D096 additionally requires HTTP 2xx **and** WMS business `Status=true` before reporting CONFIRMED.
- D096 targets `relay-agent-v21` only. Android stays at signed `beta-vc59`.
- Next field gate: OA017 real eligible Picklist exact-resolve → confirm → Status=true → Firestore ACK → SFT/SFT3 verification.
- Stable remains OWNER-GATED and untouched.


## D097 current repair checkpoint — 2026-09-21

- Owner approved a narrow confirmation-transport/HA/quota repair only. D096 WMS session, exact PickListCode resolver, `confirmSkipItem` contract/business `Status=true`, Báo hàng path, accepted UI baseline and Stable are frozen.
- Physical logs prove Firestore is reachable on both normal Internet and Office; the failure window occurs while Windows transitions from ordinary DIRECT/DNS settings to the Office IP/DNS/system proxy.
- D097 replaces quota-heavy 4-second leader writes and per-job `PROCESSING` with request-driven **PRIMARY / STANDBY / FROZEN** roles and direct conditional `PENDING → ACK`.
- PRIMARY polls every 5 seconds; STANDBY every 10 seconds and may take over at request age >=10 seconds; FROZEN Agents do not poll business jobs. New PRIMARY may later select a replacement standby.
- Android uses one authenticated Firestore snapshot listener for its own job with offline persistence disabled. Normal target is <=10 seconds; terminal automatic handling is 30 seconds, then specialist-desk guidance.
- D097 design envelope: 120 Pickers/day × 50 attempts = 6,000 requests/day, max 30 simultaneous. Source guards forbid reintroducing the 4-second lease write, `PROCESSING` write or 1-second PDA GET polling.
- Target releases after merge: `relay-agent-v22` and next signed Beta APK after `beta-vc59` (expected `beta-vc60`).
- OA018 is the physical normal→Office / standby failover / 30-second terminal gate. OA017 final real-WMS acceptance remains blocked by OA018.
- Stable remains OWNER-GATED and untouched.

- Canonical Android status: `D097_FIRESTORE_SNAPSHOT_LISTENER_SOURCE_READY__TARGET_BETA_VC60__D095_UI_BASELINE_PRESERVED`.


## D097 release-state refresh — 2026-09-21

- Main: `ad9bdbe32bc9d9c342b3a98d9fbb00846d8692af`; PR #119 merged.
- Main Authority / State / Beta Worker / Firestore / RTDB / Agent / UI / Android workflows all PASS.
- Beta status: `D097_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V22__BETA_VC60__OA018_FIELD_ACCEPTANCE_READY`.
- Android status: `D097_SIGNED_BETA_VC60_FIRESTORE_LISTENER_RELEASED__D095_UI_BASELINE_PRESERVED`.
- Latest signed Beta APK: `beta-vc60`, SHA-256 `0c295a55fcd5e0ab6f2a9a1b9cd1d53d1fefba90c39187e9c74c7320a96853cc`.
- Released Agent: `relay-agent-v22`, SHA-256 `e986f660935bc3d24f2c493a63902fb23ca6125bb327ad87ddc9ed95dfcd5a64`.
- D097 technical/runtime/release: PASS. OA018 is READY_FOR_OWNER_FIELD_TEST.
- Next action: physical normal network → Office transition, STANDBY takeover at >=10s, and 30-second terminal specialist fallback; then OA017 final real-WMS acceptance.
- Stable remains OWNER-GATED and untouched.


## D098 current source/PR checkpoint — 2026-09-21

- Owner approved D098: Firebase credential authority for all users while InventoryCore remains business/RBAC authority.
- Session slots are independent: one WEB + one ANDROID + one AGENT per user, same-channel warn/force-replace only.
- Client matrix: PICKER App only; REPORTER/ROOT App+Web; ADMIN App+Web+Agent.
- ROOT/ADMIN recovery email + Firebase reset-link flow is source-implemented.
- Web realtime now shares session V2 with HTTP API; legacy V1 lookup is removed; reconnect uses bounded jittered backoff.
- Inventory Cloudflare design ceiling is 35% of each Workers Paid included metric at max-load; normal runtime must remain lower.
- Agent v23 source logs in ADMIN directly to Firebase, independent of Worker, keeps D097 Firestore HA, and adds direct specialist 3–5 digit full-PickList substring search with explicit selection and guarded local confirmation.
- Agent Overview is Hệ thống Supra + Xác minh Agent + direct specialist flow. Settings is Kết nối + embedded Bảng nổi + Nhật ký vận hành + Chẩn đoán kỹ thuật.
- PR #121 is the active implementation PR. Technical/runtime/release PASS is **not yet claimed** until all PR/main gates pass.
- OA019 is blocked until technical release PASS, then covers physical channel replacement, Office direct Firebase Agent auth, Web realtime and specialist confirmation.
- Stable remains OWNER-GATED and untouched.


### D098 canonical derived markers

- SQLite schema source/current candidate: `9`
- Latest signed Beta APK remains `beta-vc60` until D098 main release publishes the next monotonic build.
- Web: `D098_SOURCE_CANDIDATE__FIREBASE_CREDENTIAL_AUTHORITY__WEB_SESSION_ISOLATED__REALTIME_V2_AUTHORITY_REPAIRED__35PCT_CLOUDFLARE_BUDGET`
- Android: `D098_SOURCE_CANDIDATE__ANDROID_SESSION_ISOLATED__PICKER_APP_ONLY__NEXT_MONOTONIC_BETA_RELEASE_PENDING`


## D098 Firestore main deploy hotfix — 2026-09-21

- D098 implementation PR #121 merged to main `bbc2127fa345879c4603a5baaa48cc566150af0f`.
- Main Firestore deploy source validation and authentication passed, but index ensure returned Google `ALREADY_EXISTS` after the pre-list failed to recognize the already-present D097 composite index.
- Hotfix `fix/d098-firestore-index-idempotent` changes only deployment idempotency: `ALREADY_EXISTS` is treated as PASS; all other index-create errors remain fatal.
- No Firestore Rules, WMS behavior, Agent business logic, Android logic or Stable resources are changed by this hotfix.


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


### D098 final canonical derived markers

- SQLite schema: `9`
- Latest signed Beta APK: `beta-vc61`
- Web: `D098_BETA_RUNTIME_PASS__FIREBASE_CREDENTIAL_AUTHORITY__WEB_SESSION_ISOLATED__REALTIME_V2_REPAIRED__35PCT_CLOUDFLARE_GUARD_PASS`
- Android: `D098_SIGNED_BETA_VC61__ANDROID_SESSION_ISOLATED__PICKER_APP_ONLY__D097_CONFIRM_LISTENER_PRESERVED`
- Beta: `D098_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V23__BETA_VC61__OA019_FIELD_ACCEPTANCE_READY`
- Next action: OA019 on released v23/vc61; do not claim physical PASS until Owner executes it.


## D099 active checkpoint — 2026-09-21

- Owner reported every account login on Agent/App/Web returns `INVALID_CREDENTIALS`.
- PR #124 live configuration readback confirmed Beta Identity Platform `signIn.email.enabled=false` and `passwordRequired=false`.
- This is the shared D098 login outage root cause: migrated users existed, but Firebase password sign-in provider was disabled.
- D099 source candidate automatically enables/readbacks Email/Password on Beta main, then runs an ephemeral PBKDF2-SHA256/100000 import → password sign-in → cleanup proof.
- Worker login adds a fail-safe one-time Firebase native-password repair only after the same supplied password verifies against canonical InventoryCore PBKDF2.
- Agent target v24: registered ADMIN email direct Firebase login; Xác minh Agent first; Supra disabled until Agent auth; Enter login/search; Overlay practical range 120×32 through 7680×4320.
- Android next monotonic Beta build adds Enter/Done login submission; Web form Enter behavior remains.
- D096/D097/D098 business confirmation/realtime semantics outside this fix remain frozen. Stable remains OWNER-GATED.
- OA019 is temporarily blocked until D099 technical/runtime/release PASS.
