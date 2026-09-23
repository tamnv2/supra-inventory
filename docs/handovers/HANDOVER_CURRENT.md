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


### D099 canonical derived markers

- Beta: `D099_FIX_PR_124__FIREBASE_EMAIL_PASSWORD_PROVIDER_ROOT_CAUSE_CONFIRMED_DISABLED__AGENT_V24__ANDROID_NEXT_MONOTONIC_PENDING`
- Web: `D099_SOURCE_CANDIDATE__FIREBASE_PROVIDER_ENABLE_AND_LEGACY_HASH_SELF_HEAL__D098_REALTIME_PRESERVED`
- Android: `D099_SOURCE_CANDIDATE__LOGIN_REPAIR__ENTER_SUBMIT__NEXT_MONOTONIC_RELEASE_PENDING`
- User management: `D099_ROOT_CAUSE_CONFIRMED__FIREBASE_EMAIL_PASSWORD_PROVIDER_DISABLED_ON_BETA__MAIN_DEPLOY_ENABLE_PLUS_SYNTHETIC_SIGNIN_REQUIRED`
- Agent/network: `D099_AGENT_V24_DIRECT_FIREBASE_EMAIL_LOGIN__SUPRA_GATED_UNTIL_AGENT_AUTH__D097_FIRESTORE_HA_PRESERVED`
- PickList confirmation: `D099_AGENT_V24_SOURCE_CANDIDATE__AUTH_FIRST_SUPRA_GATE__ENTER_SEARCH__EXPANDED_OVERLAY__D097_D098_CONFIRM_PATH_PRESERVED`


## D100 active implementation checkpoint — 2026-09-21

- Current released baseline before D100: `relay-agent-v24` and signed Android `beta-vc62` from main `216a5b88b2ca932e6ed863579677ed21df01e49b`.
- Active PR: **#126** `D100: username Agent login and Root system reset`, branch `feat/d100-username-auth-root-system-reset`.
- D100 target Agent: `relay-agent-v25`.
- Agent user-facing login is ADMIN username/MNV + password; deterministic Firebase sign-in alias is internal only. Registered real email remains recovery/OTP metadata.
- Agent remains Worker-independent and keeps auth-first gating: Xác minh Agent → Hệ thống Supra → specialist PickList.
- Web Tools Agent metadata is generated from `relay-agent/VERSION`; no historical Agent tag is authoritative in source.
- ROOT-only `HỆ THỐNG → Đặt lại hệ thống` zeroes only selected in-scope runtime data. ROOT identity/password/recovery email/session and external Google Sheet/Drive contents are preserved.
- Reset execution requires current ROOT password + emailed six-digit OTP. Confirmation-relay Firestore reset is blocked while any job is PENDING.
- D100 schema source target is **10** for additive Firebase Agent-readiness metadata.
- Stable remains **OWNER-GATED** and untouched.
- Technical/runtime/release PASS is not claimed until PR #126 and main gates PASS.


### D100 canonical derived markers

- Beta: `D100_SOURCE_PR_126__AGENT_V25_USERNAME_SHARED_UID__ROOT_SYSTEM_RESET__SCHEMA10__CI_RUNNING`
- Web: `D100_SOURCE_CANDIDATE__ROOT_ONLY_SYSTEM_RESET__TOOLS_AGENT_VERSION_FROM_CANONICAL_VERSION__D099_LOGIN_FIX_PRESERVED`
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_UI_CHANGE_REQUIRED`
- Latest signed Beta APK: `beta-vc62`
- Network/auth: `D100_AGENT_V25_USERNAME_SHARED_FIREBASE_UID_DIRECT__NO_WORKER_RUNTIME_DEPENDENCY__SUPRA_AUTH_GATE_PRESERVED`
- User management: `D100_SOURCE_CANDIDATE__ONE_FIREBASE_UID_WEB_APP_AGENT__REAL_RECOVERY_EMAIL_SEPARATE__ROOT_2FA_SYSTEM_RESET`
- Agent confirmation candidate: `D100_AGENT_V25_USERNAME_SHARED_UID_SOURCE_CANDIDATE__D097_D099_CONFIRM_PATH_AND_OVERLAY_PRESERVED`


## D100 deploy-proof hotfix — 2026-09-21

- D100 implementation PR #126 merged to main `8a769808b5c8c28fe76bbb2d31c5ec013265c148`.
- Agent `relay-agent-v25` released successfully from that main.
- The first D100 Worker deployment workflow returned a health response from the previous runtime during immediate rollout (`schema=9/9`), so that workflow success is not sufficient evidence for D100 schema 10.
- Hotfix `fix/d100-health-source-schema-proof` makes health expose `SOURCE_COMMIT` and makes deploy acceptance require: deployed source == `GITHUB_SHA`, runtime schema == source `SCHEMA_VERSION`, and Agent-auth migration failed/remaining are both zero.
- D100 runtime PASS must not be recorded until this exact proof passes on main.


## D100 Beta health schema-proof parser hotfix — 2026-09-21

- Main `2cf23d9229eb4bd5d9c45f3776bb2404ef06a68f` deployed a healthy D100 Beta runtime: HTTP 200/status ok, exact source commit, SQLite schema `10/10`, Agent-auth migration `0 failed / 0 remaining`, Operational V2 `5/5`.
- Deploy workflow still failed because the shell source-schema parser emitted literal `\1` instead of `10`; the runtime itself was not failing.
- `fix/d100-beta-health-schema-proof` changes only the deploy proof parser from an over-escaped sed replacement to the correct capture replacement.
- D100 final runtime PASS remains withheld until the corrected proof passes on main.
- Stable remains OWNER-GATED and untouched.


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


### D100 final canonical derived markers

- Beta: `D100_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V25__BETA_VC62__OA019_OA020_FIELD_READY`
- Web: `D100_BETA_RUNTIME_PASS__ROOT_ONLY_SYSTEM_RESET__TOOLS_AGENT_V25_CANONICAL__D099_LOGIN_FIX_PRESERVED`
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`
- Latest signed Beta APK: `beta-vc62`
- Agent: `relay-agent-v25`
- SQLite schema: `10`
- Next: OA019 physical Agent/PDA acceptance and OA020 ROOT reset-mail field acceptance. Stable remains OWNER-GATED.

## D100 OA020 Gmail field evidence — 2026-09-22

- Owner reached the ROOT System Reset mail-only challenge on Beta; the UI returned `RESET_EMAIL_UNAVAILABLE` with the Gmail-send-permission message before any destructive reset.
- The existing Beta OAuth refresh token is configured, but the active credential must be re-consented once for the canonical combined scopes `drive.file + gmail.send`.
- Required Owner-only step: run the existing Beta Google OAuth consent flow, approve the scopes, replace only the Beta Worker secret `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN` with the newly issued refresh token, and never paste that token into chat/GitHub/logs.
- After replacement, retry only the non-destructive six-digit OTP challenge first. OA020 remains blocked until email delivery succeeds; Stable remains OWNER-GATED and untouched.

## D100 OA020 mail/throttle repair — 2026-09-22

- Owner retried the ROOT System Reset mail-only challenge after Google OAuth re-consent. Recent Beta Web logs still show HTTP 503 from `/api/root/system-reset/challenge`, followed by `RESET_CODE_RATE_LIMIT`.
- Source audit confirmed the local 60-second reset-code throttle was written before Gmail provider acceptance. When Gmail failed, the challenge was deleted but the throttle remained, creating a false rate-limit.
- Repair candidate `fix/d100-oa020-mail-throttle-diagnostics` keeps throttling after a successful send but releases it when provider delivery fails.
- Gmail failures are now mapped to bounded non-secret causes: OAuth/auth failure, missing `gmail.send`, Gmail API disabled, Workspace domain policy, provider quota/rate, or generic HTTP class. Raw Google tokens/responses are not logged.
- Next field action occurs only after the repaired Beta runtime deploys: request one mail-only OTP. Do not repeat Google OAuth consent unless the repaired runtime specifically reports missing scope. Stable remains OWNER-GATED.

## D100 OA020 mail repair runtime checkpoint — 2026-09-22

Status: **RUNTIME PASS — ONE NON-DESTRUCTIVE OWNER MAIL RETRY READY**.

- PR #131 merged to main `27a791a1ad9a05da9acee0f2b7351fb1fda7cc4b`.
- Main Project State `35633339838`, Repo Authority `35633339786`, UI `35633339783` and Deploy Beta Worker `35633339816` all PASS.
- Failed Gmail provider delivery no longer consumes the local 60-second reset-code throttle.
- The next failure, if any, reports a bounded sanitized cause instead of always claiming missing `gmail.send`.
- Next Owner action: request one ROOT reset OTP only. Do not execute reset yet. Do not repeat OAuth consent unless the repaired message specifically identifies missing scope.
- Stable remains OWNER-GATED and untouched.

## D100 OA020 post-reset runtime recovery — 2026-09-22

Status: **OWNER FIELD FAIL — SOURCE REPAIR CANDIDATE**.

- Owner completed an actual Beta reset and confirmed the selected data was deleted correctly and ROOT remained active.
- Immediately after reset, recent Beta Web logs show HTTP 503 / `OPERATIONAL_V2_NOT_READY` on Reporter queue, Dashboard, realtime ticket and SKU import. User-list GET remained HTTP 200.
- Root cause 1: `RUNTIME_SETTINGS` deleted all `app_config`, including structural `realtime_stream_epoch_v1`; the running Durable Object then failed Operational V2 readiness.
- Root cause 2: business API already called internal `/operational/init`, but the Durable Object did not route `handleOperationalV2CoreRequest`, so self-repair could not run.
- Root cause 3: managed-account email validation used a double-escaped regex, causing valid Admin email syntax to fall into `INVALID_USER_CREATE_SCOPE`.
- Repair candidate `fix/d100-post-reset-runtime-recovery`: route Operational V2 core requests, add GET `/operational/init` self-repair, rebootstrap Operational V2 immediately after Runtime Settings reset, exclude structural epoch from resettable config count, fix email validation, return actionable account-create validation, and make SKU import progress terminate visibly on failure.
- Stable remains OWNER-GATED and untouched. No further destructive reset is required to recover the current Beta runtime.

## D100 post-reset recovery runtime checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME PASS — OWNER FIELD RETEST READY**.

- PR #133 merged to main `5409b8347f50a226bde0665637bef2e598bc3514`.
- Main Repo Authority `35636210008`, Project State `35636210129`, UI `35636210086` and Deploy Beta Worker `35636210016` all PASS.
- Beta deploy health on exact source `5409b834...` returned SQLite schema `10/10`, Operational V2 `true:5/5`, Agent auth migration `0/0`, plus business capability/auth-guard PASS.
- Live fixes include Operational V2 self-repair routing, immediate structural rebootstrap after Runtime Settings reset, corrected managed-account email validation and terminal SKU-import failure progress.
- Owner field re-test remains: normal operations/dashboard/realtime, create one intended Admin/Reporter, retry SKU import. No further destructive reset is required solely for recovery.
- Stable remains OWNER-GATED and untouched.

## D100 OA020 Owner field acceptance — 2026-09-22

Status: **OWNER FIELD PASS**.

- Owner confirmed the post-reset re-test is fully OK after PR #133 runtime recovery.
- Operational V2 navigation/realtime no longer returns `OPERATIONAL_V2_NOT_READY` after reset.
- Managed Admin/Reporter account creation succeeds with valid input.
- SKU Excel upload/import completes normally instead of stalling behind readiness failure.
- The exact regression protections remain in source: immediate post-reset Operational V2 structural rebootstrap, routed `/operational/init` self-repair, corrected managed-account email validation, and terminal SKU-import error progress.
- OA020 is closed PASS on Beta. Stable remains OWNER-GATED and untouched.

## D101 Agent v26 source candidate — 2026-09-22

Status: **SOURCE / PR GATE IN PROGRESS — NOT RELEASED**.

- Beta: `D101_AGENT_V26_SOURCE_CANDIDATE__D100_POST_RESET_OWNER_PASS`.
- Web: `D101_WEB_ONLINE_WEB_ANDROID_ONLY_SOURCE_CANDIDATE__D100_RUNTIME_BASELINE`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`.
- SQLite schema: `10`.
- Agent target: `relay-agent-v26`; current released baseline remains v25 until D101 main/release gates PASS.
- D101 keeps D096 confirmation semantics and D097 request-driven PRIMARY/STANDBY/FROZEN HA, adds cache-miss refresh-before-NOT_FOUND, bounded background update checks, inline PickList confirm, low-frequency fleet visibility and bounded Agent log delivery.
- Stable remains OWNER-GATED and untouched.

## D101 Agent v26 release checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA021 FIELD READY**.

- Beta: `D101_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V26__OA021_FIELD_READY`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`.
- SQLite schema: `10`.
- Network scope: `D101_AGENT_V26_FIRESTORE_HA_LOG_SPOOL_RUNTIME_RELEASE_PASS__STABLE_UNTOUCHED`.
- PickList confirmation: `D101_AGENT_V26_RELEASED__CACHE_MISS_WMS_REFRESH__D097_D096_GUARDS_PRESERVED`.
- PR #136 merged at `25cb7554ff7ea058aa45d72e1ba4824c744c354e`.
- Main PASS runs: Authority `35677556695`, State `35677556755`, Worker `35677556693`, Firestore `35677556771`, UI `35677556710`, Android `35677556734`, Agent `35677556698`.
- Released Agent: `relay-agent-v26`; EXE SHA-256 `5db50633e74247b45305a536a6caf140069626db66a7020acf32cf2d216ff79b`.
- Next action: OA021 physical field acceptance only. Stable remains OWNER-GATED.
## D102 current workstream — Agent v27

- Owner approved D102 on 2026-09-22.
- Source branch: feat/d102-agent-overview-ha-quiet-hours.
- Target: relay-agent-v27; Android remains beta-vc62; Stable remains OWNER-GATED.
- Agent UI: one Tổng quan contains Hệ thống Agent + Hệ thống Supra + Xử lý PickList. Direct tabs: Kết nối, Bảng nổi, Nhật ký vận hành, Chẩn đoán kỹ thuật.
- Update: startup + 30-minute background + manual trusted GitHub/SHA-256 check.
- HA metadata: four startup reads at 5s; PRIMARY/STANDBY role refresh 60s; FROZEN 5m; presence 15m write / 30m read / 40m fresh. D097 business poll/failover remains 5s/10s/10s and FROZEN no business poll.
- Night gate: 21:30 HCM warning every 5m until CONTINUE/STOP; no CONTINUE at 22:00 pauses business; 05:00 auto-resumes; EXE/log/update/watchdog stay alive.
- OA021 is superseded by OA022. OA022 is blocked until D102 technical release.

## D102 Agent v27 release checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA022 FIELD READY**.

- Beta: `D102_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V27__OA022_FIELD_READY`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`.
- SQLite schema: `10`.
- Network scope: `D102_AGENT_V27_OVERVIEW_HA_QUIET_HOURS_RUNTIME_RELEASE_PASS__STABLE_UNTOUCHED`.
- PickList confirmation: `D102_AGENT_V27_RELEASED__D101_CACHE_REFRESH__D097_D096_GUARDS_PRESERVED`.
- PR #138 merged at `637d7509bcc66f4b57aba4bf4a415cb05c30903d`.
- Main PASS runs: Authority `35683012628`, State `35683012626`, UI `35683012670`, Agent `35683012671`.
- Released Agent: `relay-agent-v27`; release id `393435282`; canonical EXE asset id `580448326`, size `271872`, SHA-256 `322159ed214be13d5340fd2a8a826b02232627aa016711c2a46492da1cc819e4`.
- OA022 is ready for physical field acceptance. Stable remains OWNER-GATED and untouched.

## D103 current workstream — Agent v28 dense Overview

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

- Beta: `D103_SOURCE_CANDIDATE__AGENT_V28_DENSE_OVERVIEW__PR_GATES_PENDING`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`; SQLite schema: `10`.
- Target Agent: `relay-agent-v28`; currently released baseline remains v27 until D103 main/release PASS.
- UI correction: maximized launch/restore, non-scrolling Tổng quan, fleet max five visible rows with internal scroll, compact Supra, PickList always in lower viewport, one Xác nhận per result row, verbose implementation prose removed.
- D102 HA/night schedule and D096/D097 confirmation rules are unchanged.
- OA022 is superseded by OA023. Stable remains OWNER-GATED and untouched.

## D103 Agent v28 release checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA023 FIELD READY**.

- Beta: `D103_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V28__OA023_FIELD_READY`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`; SQLite schema: `10`.
- Network scope: `D103_AGENT_V28_DENSE_OVERVIEW_RUNTIME_RELEASE_PASS__D102_HA_SCHEDULE_PRESERVED__STABLE_UNTOUCHED`.
- PickList confirmation: `D103_AGENT_V28_RELEASED__INLINE_ROW_CONFIRM_VISIBLE__D096_D097_GUARDS_PRESERVED`.
- PR #140 merged at `15aba0412e625af0f6b9ef7489b995a3e524a131`.
- Main PASS runs: Authority `35684829649`, State `35684829653`, UI `35684829650`, Agent `35684829660`.
- Released Agent: `relay-agent-v28`; release id `393444068`; canonical EXE asset id `580490417`, size `271360`, SHA-256 `4faf8507637d61d74ac8aa34ba998a1fc04bfacd0fdc572af1cabda5f8bb8cb1`.
- OA023 is ready for physical UI acceptance. Stable remains OWNER-GATED and untouched.

## D104 current workstream — Agent v29 multi-search and batch confirmation

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

- D103/OA023: **PASS_OWNER_CONFIRMED_D103**.
- Beta: `D104_SOURCE_CANDIDATE__AGENT_V29_BATCH_CONFIRM__PR_GATES_PENDING`.
- Android: `beta-vc62` unchanged. Stable remains OWNER-GATED.
- Agent v29: Windows WorkingArea maximum keeps taskbar visible; manual input supports 1–10 comma-separated 3–5 digit terms; one shared cache snapshot / at most one single-flight refresh per action.
- Row-specific Xác nhận remains; Xác nhận tất cả appears only when >=2 results are displayed.
- Existing Firestore poll cadence remains PRIMARY 5s / STANDBY 10s / FROZEN none. Up to 12 eligible jobs from one poll form one logical batch; shared lookup/exact scan; WMS confirm chunks <=10 exact codes; per-code guard and per-job conditional ACK remain.
- WMS scope: only existing confirmSkipItem endpoint; 1–10 exact full PickListCodes with fixed HY1 flags; uncertain results fail closed; no raw WMS session/header/signature values in repo/logs.
- Target release: `relay-agent-v29`; OA024 opens only after technical release PASS.

## D104 Agent v29 release checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA024 FIELD READY**.

- Beta: `D104_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V29__OA024_FIELD_READY`.
- Android: `beta-vc62` unchanged.
- Network scope: `D104_AGENT_V29_BATCH_CONFIRM_RUNTIME_RELEASE_PASS__D097_HA_D102_SCHEDULE_D103_UI_PRESERVED__STABLE_UNTOUCHED`.
- PickList confirmation: `D104_AGENT_V29_RELEASED__MULTI_SEARCH__BATCH_WMS_CONFIRM__PER_CODE_GUARD__PER_JOB_ACK`.
- Main PASS runs: Authority `35687822814`, State `35687822742`, UI `35687822767`, Agent `35687822763`.
- Released Agent: `relay-agent-v29`; release id `393459636`; canonical EXE asset id `580560440`, size `284160`, SHA-256 `10304ac734218146550c6bdf3c3b8a81d979fabe5b3ee7dddc94f1b217955b2d`.
- OA024 is ready for physical field acceptance. Stable remains OWNER-GATED and untouched.

## D105 current workstream — Android beta-vc63 + Agent v30

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

- D104/OA024: **PASS_OWNER_CONFIRMED_D104**.
- Beta: `D105_SOURCE_CANDIDATE__ANDROID_VC63_AGENT_V30__FOUR_DIGIT_CONFIRM__PR_GATES_PENDING`.
- Current released baseline remains Android `beta-vc62` + Agent `relay-agent-v29` until D105 main release passes.
- Android vc63 source: exact 4-digit confirmation input; submit is dimmed/disabled while request is in flight; terminal result is 17sp bold with success/error emphasis.
- Firestore/Agent rollout ingress accepts 4-digit current jobs plus legacy 5-digit vc62 jobs. New Android emits 4 digits only.
- Agent v30 exact resolution compares supplied suffix length; 4-digit ambiguity remains fail-closed. Manual specialist terms are 3–4 digits only.
- D104 batching/confirm-all/per-code guard/per-job ACK, D097 HA, D102 schedule and Stable guard remain unchanged.
- Next gate: PR authority/state/UI/Firestore/Agent/Android PASS → merge → publish beta-vc63 + relay-agent-v30 → OA025 physical acceptance.

### D105 canonical marker sync

- SQLite schema: `10`.
- Latest released Beta APK baseline: `beta-vc62`.
- Web status: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android source status: `D105_SOURCE_CANDIDATE__BETA_VC63__FOUR_DIGIT_CONFIRM_UI__PR_GATES_PENDING`.

## D105 Android vc63 + Agent v30 release checkpoint — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA025 FIELD READY**.

- SQLite schema: `10`.
- Latest Beta APK: `beta-vc63`.
- Web status: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android status: `D105_SIGNED_BETA_VC63__FOUR_DIGIT_CONFIRM_UI__OA025_FIELD_READY`.
- Beta: `D105_TECHNICAL_RUNTIME_RELEASE_PASS__ANDROID_VC63_AGENT_V30__OA025_FIELD_READY`.
- PickList confirmation: `D105_ANDROID_VC63_AGENT_V30_RELEASED__FOUR_DIGIT_CURRENT__MANUAL_3_4__EXACT_SUFFIX_LENGTH_FAIL_CLOSED`.
- Main PASS runs: Authority `35694361080`, State `35694361070`, UI `35694361168`, Android `35694361091`, Agent `35694361074`, Firestore `35694361133`, Worker `35694361089`.
- Android release: `beta-vc63`; release id `393494217`; APK asset id `580723780`; SHA-256 `add6716668f13e5f96a8b6b9cdfddba27db4270e990a4f3f7d92c373fadd5295`.
- Agent release: `relay-agent-v30`; release id `393494208`; EXE asset id `580723753`; SHA-256 `18cf58622cde42d7ae7c58a57615139913caa9c3dbd2718bd2b1348182f765ad`.
- OA025 is ready for physical field acceptance. Stable remains OWNER-GATED and untouched.
## D107 current Web checkpoint — 2026-09-22

- Owner explicitly reopened the Web presentation after the D089 accepted baseline.
- Web status: `D107_PROFESSIONAL_WEB_REFINEMENT__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.
- Admin dashboard/reporting: `D107_RICHER_EXISTING_DATA_OVERVIEW_AND_DETAIL__SOURCE_IMPLEMENTED__PR_GATES_PENDING__FINAL_STABLE_COLUMNS_OWNER_OPEN`.
- Login uses the exact shared D089 `/app-icon.png` plus `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` / `Website nghiệp vụ Inventory`; the numeric 1291 login tile and old login copy are removed.
- D107 adds a final professional Web light/dark presentation layer and richer existing-data overview/detail reporting. It does not change business logic, RBAC, realtime semantics, quota policy, Android or Agent.
- No new polling/provider monitoring, employee scoring, stock quantity/bin/location analytics or Stable action is authorized.
- Current next action: PR #149 must reach authority/state/UI/Web build PASS, then merge/deploy Beta and obtain explicit Owner visual acceptance.
- Stable remains OWNER-GATED and untouched.

## D107 merged-source checkpoint — 2026-09-22

- Web: `D107_PR_GATES_PASS__MERGED_MAIN_4E733535__BETA_AUTODEPLOY_TRIGGERED__OWNER_VISUAL_REVIEW_PENDING`.
- Admin dashboard/reporting: `D107_RICHER_EXISTING_DATA_MERGED_MAIN__OWNER_VISUAL_REVIEW_PENDING__FINAL_STABLE_COLUMNS_OWNER_OPEN`.
- UI guard: `D107_PR_UI_PASS_RUN_35729564681__MAIN_MERGED`.
- PR #149 passed Repo Authority `35729564644`, Project State `35729564770`, UI Design/Web production build `35729564681`, RTDB `35729564684` and Firestore `35729564631`.
- Squash merge main: `4e733535ef0abe893681afdf288097767141b115`.
- Main changed `web/**`, so the existing `Deploy Beta Worker` push workflow applies automatically. The current GitHub connector can enumerate PR-triggered runs but not main push-triggered runs; therefore exact D107 runtime/deploy PASS is deliberately not inferred.
- OA027 is the remaining D107 Owner visual gate on live Beta. Stable remains OWNER-GATED and untouched.

## D108 current source checkpoint — 2026-09-23

- Owner explicitly accepted D107/OA027 before opening D108.
- SQLite schema: `10`.
- Latest signed Beta APK remains `beta-vc63` until D108 main release publishes the next monotonic build.
- Web: `D108_PASSWORD_RECOVERY_COLLAPSE__RESOLUTION_SOURCE_ACTOR__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.
- Android: `D108_PICKER_NUMERIC_COMPACT_UI__PER_USER_SCALE__SOURCE_IMPLEMENTED__TARGET_NEXT_MONOTONIC_AFTER_VC63`.
- D108 Web source fixes password-recovery disclosure and exposes human/system resolution provenance using existing bounded fields/joins.
- D108 Picker source uses numeric-only >=3 digit SKU search, input + Xác nhận compact row, selected-state emphasis, stable suggestion dismissal, semantic history cards, no automatic deadline clock, and per-user local 80–140% display scale beside Log.
- No new provider polling or datastore is introduced. D105 Xác nhận đơn/Firestore relay is unchanged.
- Current next action: complete D108 PR authority/state/UI/Web/Android/build gates, merge after PASS, verify Beta Web + next signed Android release, then OA028 Owner review.
- Stable remains OWNER-GATED and untouched.

## D108 release-state refresh — 2026-09-23

- Beta: `D108_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_441F3C68__SIGNED_BETA_VC64__OA028_FIELD_READY`.
- Web: `D108_BETA_RUNTIME_PASS__RECOVERY_COLLAPSED__RESOLUTION_SOURCE_ACTOR__OA028_FIELD_READY`.
- Android: `D108_SIGNED_BETA_VC64__PICKER_DENSE_NUMERIC_UI__PER_USER_SCALE__OA028_FIELD_READY`.
- SQLite schema: `10`; latest signed Beta APK: `beta-vc64`.
- PR #151 merged main `441f3c687ad2ef94ecc6017b8fa9846e9b34a7a2` after all PR gates passed.
- Exact live Beta proof: test-only PR #152 run `35801069626` PASS on first attempt with source commit exact, storage true, schema 10/10, missing bindings 0, Agent migration 0/0. PR #152 was closed unmerged.
- `beta-vc64` tag readback succeeds and contains D108 Picker source.
- Remaining D108 gate: OA028 Owner field/visual review of live Web + beta-vc64. No technical build/deploy blocker remains.
- Stable remains OWNER-GATED and untouched.

## D109 source checkpoint — 2026-09-23

- Beta: `D109_SOURCE_CANDIDATE__WEB_AUDIT_PREFS_PDA_TOOLS__ANDROID_COMPACT_TABS__SCHEMA11__PR_GATES_PENDING`.
- Web: `D109_DASHBOARD_PREF_GLOBAL_SLA_AUDIT_PDA_TOOLS__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.
- Android: `D109_COMPACT_HEADER_BOTTOM_TABS_TIME_ONLY__SOURCE_IMPLEMENTED__TARGET_NEXT_MONOTONIC_AFTER_VC64`.
- SQLite source target: `11`; current released APK baseline remains `beta-vc64` until the D109 main release publishes the next monotonic signed build.
- D108/OA028 is Owner PASS. D109 source is implemented on `d109-web-audit-pda-picker-tabs`; PR/CI/runtime/release gates are not yet claimed.
- Web adds per-user Dashboard range persistence, global realtime SLA propagation, bounded Reporter/Admin/Root audit history, recent resolver identity and a version-independent App PDA QR/download path.
- Android compacts the header, places A−/A+ together, uses stationary bottom operation tabs and time-only shortage-history labels.
- Next action: complete authority/state/UI/Web/Service/Android PR gates → merge only after PASS → verify exact Beta schema 11 runtime + next signed Beta APK → OA029 Owner field review.
- Stable remains OWNER-GATED and untouched.

## D109 runtime/release checkpoint — 2026-09-23

- Beta: `D109_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_367D518D__SCHEMA11__SIGNED_BETA_VC65__OA029_FIELD_READY`.
- Web: `D109_BETA_RUNTIME_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS__OA029_FIELD_READY`.
- Android: `D109_SIGNED_BETA_VC65__COMPACT_HEADER_BOTTOM_TABS_TIME_ONLY__OA029_FIELD_READY`.
- SQLite runtime/source: `11/11`; latest signed Beta APK: `beta-vc65`.
- PR #154 merged at `367d518d5e76ce5f7c0776ff8f6a3857ef2a9f94` after all PR authority/state/UI/Android/Firestore/RTDB gates passed.
- Main Deploy Beta Worker run `35809583618` passed. Live health attempt 1: HTTP 200, exact source `367d518d...`, storage true, schema 11/11, missing bindings 0, Agent migration 0/0, Operational V2 5/5.
- Main UI run `35809583663`, Repo Authority `35809583637`, Project State `35809583624` and Android run `35809583599` passed.
- Signed `beta-vc65` release id `394246239`; APK asset id `582752309`, size `19015996`, sha256 `3e2b5284ac2ed5d3040c36338a5bdb21026958eda7e4d4a12b40ea9bf6c0ea48`.
- OA029 is ready for Owner field review. Stable remains OWNER-GATED and untouched.

## D109 Owner-accepted checkpoint — 2026-09-23

- Status: **OWNER FIELD PASS / COMPLETE**.
- OA029: `PASS_OWNER_CONFIRMED_D109`.
- Beta: `D109_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_367D518D__SCHEMA11__SIGNED_BETA_VC65`.
- Web: `D109_OWNER_ACCEPTED_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS`.
- Android: `D109_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC65__COMPACT_HEADER_BOTTOM_TABS_TIME_ONLY`.
- SQLite schema: `11`; latest signed Beta APK: `beta-vc65`; APK SHA-256 `3e2b5284ac2ed5d3040c36338a5bdb21026958eda7e4d4a12b40ea9bf6c0ea48`.
- Runtime implementation source remains main `367d518d5e76ce5f7c0776ff8f6a3857ef2a9f94`; checkpoint PR #155 merged at `5d3990b5a659225ecd92d4d0281ace23330fc06b`.
- Final checkpoint guards: Repo Authority PASS, Project State PASS, UI Design Guard run `35811103699` PASS.
- Current project workstream: `READY_FOR_NEXT_OWNER_REQUIREMENT`.
- Next session: bootstrap from `ops/authority-manifest.json`, preserve D109 as accepted Beta baseline, then apply only the new Owner requirement.
- Stable remains OWNER-GATED and untouched.
