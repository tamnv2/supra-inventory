# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `12`
- Latest signed Beta APK: `beta-vc80`
- Current released Agent: `relay-agent-v74`
- Beta: `D134_TECHNICAL_RUNTIME_RELEASE_PASS__OA060_FIELD_READY`
- Web: `D120_RUNTIME_PASS_MAIN_43A94207__OWNER_FIELD_TEST_OK`
- Android: `D134_SIGNED_BETA_VC80__OA060_FIELD_READY`
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

## D110 source checkpoint — 2026-09-23

- Owner opened D110 after D109 Owner PASS.
- Beta: `D110_SOURCE_IMPLEMENTED__PR_GATES_AND_SIGNED_BETA_RELEASE_PENDING`.
- Android: `D110_REPORTER_PINNED_4TABS_BADGES_DIRECT_ACTION_LOCAL_MINUTE_SLA__RELEASE_PENDING`.
- Accepted released baseline remains signed `beta-vc65` until the D110 main release publishes the next monotonic Beta APK.
- Reporter source pins **Đang xử lý / Đã có hàng / Cho phép skip / Picker đã thu hồi** below the compact identity header and gives every tab an authoritative count badge.
- Pending Reporter rows expose direct **Đã có hàng / Cho phép skip** actions below SKU with per-batch double-tap locking; old pre-resolution Android confirmation dialogs are removed.
- Reporter SLA waiting minutes advance locally from service `server_now` on calibrated minute boundaries. No timer polling/provider read is added; manual Reporter refresh is removed.
- Normal/warning/overdue pending backgrounds are neutral/light-yellow/light-red.
- Android visible identity uses the canonical app icon and requested tamnv2 developer line.
- Android session authority now permits only PICKER/REPORTER; base ADMIN/ROOT are server-denied on ANDROID while Web and real ADMIN Agent remain unchanged.
- OA030 is pending technical/runtime/release PASS, then Owner physical review. Target signed release: `beta-vc66`.
- Stable remains OWNER-GATED and untouched.

## D110 technical/runtime/release checkpoint — 2026-09-23

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA030 FIELD READY**.
- Beta: `D110_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_E7931CF8__SCHEMA11__SIGNED_BETA_VC66__OA030_FIELD_READY`.
- Android: `D110_SIGNED_BETA_VC66__REPORTER_PINNED_4TABS_BADGES_DIRECT_ACTION_LOCAL_MINUTE_SLA__OA030_FIELD_READY`.
- Web remains the D109 Owner-accepted baseline: `D109_OWNER_ACCEPTED_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS`.
- PR #157 squash-merged main `e7931cf892978332960e63d9a17dffe454ac1c43`.
- Main PASS runs: Repo Authority `35816314068`, Project State `35816313998`, UI `35816313994`, Beta Worker `35816313928`, Android `35816313946`.
- Live Beta health attempt 1: HTTP 200, exact source `e7931cf8...`, storage true, schema `11/11`, missing bindings 0, Agent migration 0/0, Operational V2 `5/5`.
- Signed `beta-vc66`: release id `394288616`; APK asset id `582908040`; size `19018752`; SHA-256 `715612464d7fd4ead1036959ce70b4fb8cf281e38566aa214a428fbebbf32328`.
- Reporter minute ticker is presentation-only and generates no network/provider request.
- OA030 is ready for Owner physical review. Stable remains OWNER-GATED and untouched.

## D110 Owner acceptance — 2026-09-23

- OA030: `PASS_OWNER_CONFIRMED_D110`; signed `beta-vc66` is Owner field-accepted.
- Accepted D110 baseline: four pinned Reporter tabs and authoritative badges, semantic SLA backgrounds, local zero-poll minute clock, canonical Android identity/footer, Android PICKER/REPORTER-only admission.
- D111 explicitly supersedes D110's no-preconfirm action detail and selected Reporter presentation/display-scope details only.
- Stable remains OWNER-GATED and untouched.

## D111 source checkpoint — 2026-09-23

- Beta: `D111_SOURCE_IMPLEMENTED__D110_OWNER_ACCEPTED__SCHEMA11__PR_GATES_RELEASE_PENDING`.
- Android: `D111_REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE__SOURCE_IMPLEMENTED__TARGET_NEXT_AFTER_VC66`.
- Reporter now has per-user 80–140% A−/A+ scale, pending-only red/white badge priority, neutral history badges, no redundant result/ack/summary copy, and explicit confirmation before HAS_STOCK/SKIP_ALLOWED mutation.
- Android reads use `APP_TODAY_OPEN`: Picker = today + older unresolved; Reporter pending = all unresolved; Reporter completed/withdrawn = first reported today. Filtering occurs in InventoryCore SQL before LIMIT; Web behavior is unchanged.
- No schema migration or polling/provider cadence is added. Existing realtime and local minute ticker behavior remain unchanged.
- OA031 is pending technical/runtime/release PASS. Current released baseline remains `beta-vc66` until the next monotonic signed Beta APK is produced.
- Next action: PR authority/state/UI/Service/Android gates → merge only after PASS → exact Beta runtime + signed release verification → OA031 Owner field review.
- Stable remains OWNER-GATED and untouched.

## D111 runtime/release checkpoint — 2026-09-23

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA031 FIELD READY**.
- Beta: `D111_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_8E08BEAD__SCHEMA11__SIGNED_BETA_VC67__OA031_FIELD_READY`.
- Android: `D111_SIGNED_BETA_VC67__REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE__OA031_FIELD_READY`.
- PR #159 merged main `8e08bead67b34f8302185d0d4ff259ddd5fae857`.
- Main PASS runs: Repo Authority `35819012567`, Project State `35819012547`, UI Design `35819012526`, Beta Worker `35819012562`, Android `35819012653`.
- Live Beta health: HTTP 200 exact source `8e08bead...`, schema `11/11`, Operational V2 `5/5`, missing bindings 0, Agent migration 0/0.
- Signed `beta-vc67`: release id `394302425`, APK asset id `582970502`, size `19019076`, SHA-256 `0ea00d861d38e6f4cdd22c76120707b9f730b2c990da0ee834e3072d81318edc`.
- OA031 is ready for Owner field review. D111 is not Owner-PASS until explicit field confirmation.
- Stable remains OWNER-GATED and untouched.

## D111 Owner-accepted checkpoint — 2026-09-23

- Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.
- OA031: `PASS_OWNER_CONFIRMED_D111`.
- Beta: `D111_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_8E08BEAD__SCHEMA11__SIGNED_BETA_VC67`.
- Android: `D111_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC67__REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE`.
- Runtime implementation source: `8e08bead67b34f8302185d0d4ff259ddd5fae857`; runtime checkpoint main: `0fe8eb9578b5452fed2f2b9c1345b28de3f115af`.
- Main technical PASS runs: Repo Authority `35819012567`, Project State `35819012547`, UI `35819012526`, Beta Worker `35819012562`, Android `35819012653`.
- Signed `beta-vc67`: APK SHA-256 `0ea00d861d38e6f4cdd22c76120707b9f730b2c990da0ee834e3072d81318edc`.
- Accepted behavior: Reporter scale controls; pending-only red badge; neutral history badges; minimal timing copy; confirmation before Có hàng/Skip; App shows today + older unresolved while Web history stays unchanged.
- Current workstream after this acceptance: `READY_FOR_NEXT_OWNER_REQUIREMENT`.
- Next session: bootstrap from `ops/authority-manifest.json`, preserve D111 as accepted Beta baseline, then apply only the new Owner requirement.
- Stable remains OWNER-GATED and untouched.

## D112 source checkpoint — 2026-09-23

- Owner approved the complete D112 cross-surface Beta scope after D111 field PASS.
- Branch: `feat/d112-web-android-agent-ops-hardening`.
- Beta source status: `D112_SOURCE_CANDIDATE__D111_OWNER_ACCEPTED_BASELINE__SCHEMA11__PR_GATES_PENDING`.
- Web source: two-card App/Agent Tools; version-independent service distribution paths; exact date-preset state; primary Dashboard/Report load no longer blocks on presence/noncritical summaries; `REPORT_CREATED` Web notice; 30/60/90-day log/audit views.
- Retention source: hot management audit and Beta support logs have a 90-day operational boundary; cleanup is bounded and does not redefine business archive authority.
- Android source: service-manifest updater + fixed distribution aliases, existing SHA/signer fail-close, system/cutout insets, password visibility, one-line footer/action, confirmed-input clear/refocus and temporary update-APK cleanup. Current D105 four-digit confirmation remains unchanged.
- Agent target: `relay-agent-v31`; normal resizable Windows chrome; watchdog armed only after valid ADMIN runtime; manual 3–20 digit exact-suffix unique-only lookup with ambiguity fail-close; confirm action left of PickList; operational/process/fleet overlay.
- No new polling/provider cadence. D097/D104/D105 quota, Firestore and WMS guards remain required. Stable remains OWNER-GATED and untouched.
- OA032 is registered but is not field-ready until PR/main/runtime/release gates PASS.
- NEXT_ACTION: open D112 PR → repair all authority/continuity/UI/Worker/Android/Agent gates → merge only on PASS → verify exact Beta runtime, signed next Android release, relay-agent-v31 and fixed channel assets → make OA032 field-ready.


- Canonical marker: `D112_TOOLS_RELEASE_CHANNEL_PRESETS_NONBLOCKING_REPORT_NOTICE_RETENTION__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.

- Canonical marker: `D112_UPDATE_CHANNEL_INSETS_LOGIN_INPUT_CLEANUP__SOURCE_IMPLEMENTED__TARGET_NEXT_AFTER_VC67`.

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

### D112 canonical current-status markers

- Web: `D112_BETA_RUNTIME_PASS__TOOLS_RELEASE_CHANNEL_PRESETS_NONBLOCKING_REPORT_NOTICE_90D_RETENTION__OA032_FIELD_READY`
- Android: `D112_SIGNED_BETA_VC68__UPDATE_CHANNEL_INSETS_LOGIN_INPUT_CLEANUP__OA032_FIELD_READY`
- Latest Beta APK: `beta-vc68`
- SQLite schema: `11`

## D112 Owner-accepted checkpoint — 2026-09-23

- Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.
- OA032: `PASS_OWNER_CONFIRMED_D112`.
- Beta: `D112_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_92AFF2FD__SCHEMA11__SIGNED_BETA_VC68__AGENT_V31`.
- Web: `D112_OWNER_ACCEPTED_PASS__TOOLS_RELEASE_CHANNEL_PRESETS_NONBLOCKING_REPORT_NOTICE_90D_RETENTION`.
- Android: `D112_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC68__UPDATE_CHANNEL_INSETS_LOGIN_INPUT_CLEANUP`.
- Runtime implementation source: `92aff2fd7b617af9f8f7706e84a5232b81aab42a`; release checkpoint main: `ec53ed6725a9de1874cef062eb805f05c20cbbab`.
- Accepted artifacts: signed `beta-vc68` and `relay-agent-v31`; fixed `inventory-channel` remains the version-independent distribution authority.
- Accepted behavior: D112 Web Tools/presets/logs/performance/realtime notice; Android update/insets/login/footer/confirmation cleanup; Agent v31 window/watchdog/manual suffix/overlay behavior.
- Current workstream after this acceptance: `READY_FOR_NEXT_OWNER_REQUIREMENT`.
- Next session: bootstrap from `ops/authority-manifest.json`, preserve D112 as accepted Beta baseline, then apply only the new Owner requirement.
- Stable remains OWNER-GATED and untouched.

## D113 source checkpoint — 2026-09-24

- Owner requirement source: uploaded Web/App/Agent refinement document after D112 Owner PASS.
- Branch: `feat/d113-web-android-agent-refinements`.
- Accepted runtime baseline remains D112: Web + signed `beta-vc68` + `relay-agent-v31`.
- D113 Web source: reference-style Vietnamese login, browser-managed remember-login, pending badge, independent SLA switches, mandatory auto-Skip mode, first-report-based Skip→Đã có hàng window, nonblocking SLA config load and refined Tools presentation.
- D113 Android source: compact empty Picker state, action text-fit, 100% reset, standardized footer/login copy, friendly login errors, Reporter actions below timing and resolver identity.
- D113 Agent source target: `relay-agent-v32` with explicit **Chuyển xuống nền** action; D112 native-window/watchdog/HA behavior is preserved.
- No schema migration, no new polling cadence, no new external resource and no Stable change.
- OA033 is registered but not field-ready until branch PR/main gates, exact Beta runtime and signed release publication PASS.
- NEXT_ACTION: PR → repair authority/state/UI/Worker/Android/Agent gates → merge only on PASS → verify exact Beta runtime + next signed Android + Agent v32 → record release checkpoint and make OA033 field-ready.

## D113 technical/runtime/release checkpoint — 2026-09-24

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA033 FIELD READY**.
- PR #165 squash-merged main `7dcc76aba6b0b2774208b151ca587aa2a2b09931`.
- Main PASS runs: Repo Authority `35933061054`, Project State `35933061086`, UI `35933061098`, Beta Worker `35933061039`, Android `35933061049`, Relay Agent `35933061088`.
- Live Beta exact-source proof: HTTP 200 on attempt 2; source `7dcc76ab...`; SQLite `11/11`; Operational V2 `5/5`; missing bindings `0`; Agent migration `0/0`; auth/business/Web/OAuth smoke PASS.
- Signed Android `beta-vc69`: release `395136931`, asset `584751944`, size `19019800`, SHA-256 `f6b1f6e8866358b270bb5781958e6a0a05d54fbc65f446c6dc3ae5e0b9ef07c0`.
- Agent `relay-agent-v32`: release `395136705`, asset `584751479`, size `287744`, SHA-256 `e6b838377931fd804bf4dc7de7b02577010244041867975e301fd42b9d35e80c`.
- `inventory-channel` refreshed: Agent manifest/exe `584751529/584751528`; PDA manifest/apk `584751996/584751999`.
- OA033 is ready for Owner field review; do not record D113 Owner PASS until explicit confirmation.
- Stable remains OWNER-GATED and untouched.

### D113 canonical current-status markers

- Web: `D113_BETA_RUNTIME_PASS__REFERENCE_LOGIN_QUEUE_BADGE_SLA_SWITCHES_FIRST_REPORT_CORRECTION_TOOLS__OA033_FIELD_READY`
- Android: `D113_SIGNED_BETA_VC69__COMPACT_PICKER_100_RESET_LOGIN_RESPONDER__OA033_FIELD_READY`
- Latest Beta APK: `beta-vc69`
- SQLite schema: `11`


## D114 source checkpoint — 2026-09-24

- Status: **SOURCE IMPLEMENTED / TECHNICAL VALIDATION PENDING**.
- Owner's D113 field review immediately reported Agent/PDA/Web defects; D113 is not recorded as Owner PASS. OA033 is superseded by OA034 after D114 release.
- Branch: `feat/d114-picklist-feedback-web-realtime`.
- PickList contract: PDA one 3–20 digit numeric suffix at a time; Agent manual keeps 1–10 comma-separated 3–20 digit terms; every lookup is exact trailing digits only.
- Ambiguous PDA lookup returns bounded full PickList candidates without WMS mutation. Android requires row-specific one-at-a-time selection plus explicit warning confirmation; Huỷ sends nothing.
- Agent direct PickList grid is PickList → Thao tác → Kết quả with persistent specific feedback; PDA-originated terminal outcome is surfaced specifically on Agent. Target Agent is `relay-agent-v33` with assembly/file version parity.
- Web Công cụ is two balanced compact cards on desktop and stacked on narrow width. Reporter queue badge refreshes from existing realtime reporter scopes even while another Web section is active; no polling cadence is added.
- SQLite remains 11. D097/D104 HA, batching, idempotency and quota guards remain authoritative. Stable remains OWNER-GATED and untouched.
- NEXT_ACTION: PR → repair all required authority/state/UI/Web/Android/Agent/Firestore gates → merge only on PASS → verify exact Beta runtime + next signed Android after beta-vc69 + relay-agent-v33 → record runtime/release checkpoint → make OA034 field-ready.

### D114 canonical current-status markers

- Web: `D114_SOURCE_IMPLEMENTED__BALANCED_TOOLS__GLOBAL_REALTIME_QUEUE_BADGE__PR_GATES_PENDING`
- Android: `D114_SOURCE_IMPLEMENTED__PDA_ONE_TERM_3_20_SUFFIX__AMBIGUOUS_SINGLE_SELECT__RESULT_TAXONOMY__TARGET_NEXT_AFTER_VC69`
- Latest Beta APK: `beta-vc69`
- SQLite schema: `11`


## D114 technical/runtime/release checkpoint — 2026-09-24

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA034 OWNER FIELD REVIEW READY**.
- Implementation PR #167 merged at `8cdf941be71fcfddaf074e2016336c2f8d416608`.
- Main PASS evidence: Repo Authority `35940942055`, Project State `35940942026`, UI Design `35940942050`, Beta Worker `35940942052`, Android `35940942048`, initial Agent release `35940942087`.
- Live Beta Worker proof: attempt 2 HTTP 200, status ok, env beta, exact source `8cdf941be71fcfddaf074e2016336c2f8d416608`, storage true, SQLite `11/11`, missing bindings `0`, Agent migration `0/0`, Operational V2 `5/5`; auth/business/Web shell smoke PASS.
- Firestore Rules repair: PR #168 merged main `e6138dbdd72e073e2c5a88e7fd431b1d0643c180`; main run `35943098393` PASS with ruleset create + cloud.firestore release readback.
- Final Agent release-gate hardening: PR #170 merged main `bc8d6c3eb9f52b1c62c86a26a356d18d9867024d`; Repo Authority `35944022991`, Project State `35944023044`, Agent `35944022982` PASS. Existing `relay-agent-v33` is reused only when the exact Agent source tree is unchanged and its published checksum verifies.
- Signed Android `beta-vc70`: release `395205061`, APK asset `584890700`, size `19019872`, SHA-256 `aff46b7191e2bcf95e0960e8559c75ad89df41005f183892a3a29430c1f3cfa3`.
- Agent `relay-agent-v33`: release `395204655`, EXE asset `584889767`, size `292864`, SHA-256 `3bcf141b30378c222b7af5f3d012e1df0151c72e9ecb11d559615da2ff27e89f`; tag resolves to implementation source `8cdf941b`.
- Fixed `inventory-channel`: PDA manifest/APK `584890776/584890792`; Agent manifest/EXE `584943002/584943001`.
- OA034 is now the only D114 remaining gate: Owner field-tests live Beta Web + `beta-vc70` + `relay-agent-v33`, then replies PASS or itemized defects.
- Stable remains OWNER-GATED and untouched.

### D114 canonical current-status markers

- Beta: `D114_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_8CDF941B__FIRESTORE_RULES_E6138DBD__SCHEMA11__SIGNED_BETA_VC70__AGENT_V33__OA034_FIELD_READY`
- Web: `D114_BETA_RUNTIME_PASS__BALANCED_TOOLS__GLOBAL_REALTIME_QUEUE_BADGE__OA034_FIELD_READY`
- Android: `D114_SIGNED_BETA_VC70__PDA_ONE_TERM_3_20_SUFFIX__AMBIGUOUS_SINGLE_SELECT__RESULT_TAXONOMY__OA034_FIELD_READY`
- Latest Beta APK: `beta-vc70`
- SQLite schema: `11`



## D114 Owner-accepted checkpoint — 2026-09-24

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- OA034 is closed as `PASS_OWNER_CONFIRMED_D114`.
- Beta: `D114_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_8CDF941B__SCHEMA11__SIGNED_BETA_VC70__AGENT_V33`.
- Web: `D114_OWNER_ACCEPTED_PASS__BALANCED_TOOLS__GLOBAL_REALTIME_QUEUE_BADGE`.
- Android: `D114_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC70__PDA_SUFFIX_AMBIGUOUS_SINGLE_SELECT_RESULTS`.
- Latest Beta APK: `beta-vc70`.
- Agent: `relay-agent-v33` is Owner field-accepted.
- SQLite schema: `11`.
- D097/D104 HA, batching, idempotency and fail-closed WMS guards remain authoritative.
- Separate post-pass diagnostic: latest Android relay log reports cleanup permission failures, slower perceived confirmation, and 30-second no-ACK timeouts. No follow-up behavior is approved yet.
- Stable remains OWNER-GATED and untouched.


## D115 source checkpoint — 2026-09-24

- Owner approved the post-D114 relay reliability repair and healthy PRIMARY/no-failover **<5s** target.
- Branch: `feat/d115-relay-under5s`.
- Live accepted baseline remains D114: signed `beta-vc70` + `relay-agent-v33`; D114 Owner PASS is not revoked.
- D115 source changes PRIMARY confirmation poll 5s→2s only; STANDBY stays 10s, FROZEN has no business-job polling and failover stays 10s.
- Android moves cleanup off the send critical path, scopes new cleanup records to Firebase UID, prunes legacy/foreign denied records in background, uses neutral 10s wait copy and performs one final server ACK read before 30s fallback.
- Agent target v34 uses bounded Firestore ACK retry/read-after-write without rerunning the WMS business mutation and logs redacted queue/business/ACK timing.
- Target releases: signed `beta-vc71` + `relay-agent-v34`; SQLite remains 11; Web business behavior unchanged; Stable OWNER-GATED.
- OA035 is registered but remains pending technical/runtime/release PASS.


## D115 technical/runtime/release checkpoint — 2026-09-24

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA035 FIELD READY**.
- PR #173 merged main `bcbabc09928ae997d81f12404a49e7a8be6d971f`.
- Main PASS: Authority `35948065198`, State `35948065182`, UI `35948065209`, Worker `35948065164`, Android `35948065152`, Agent `35948065389`.
- Live Beta health: HTTP 200 attempt 1, exact source `bcbabc09...`, SQLite `11/11`, Operational V2 `5/5`, missing `0`, Agent migration `0/0`.
- Signed Android `beta-vc71`: release `395262617`, asset `585009621`, size `19019872`, SHA-256 `f1137dccd460133e5fdc41836658c6bb6b41a885f41f4ba16ca908a0c96d3d1d`.
- Agent `relay-agent-v34`: release `395262208`, asset `585008591`, size `294400`, SHA-256 `eef4e6e6bbb20f7fad223ba4c7a7081200eecbe74af1e43c4335fd78034f4285`.
- `inventory-channel`: PDA manifest/APK `585009672/585009671`; Agent manifest/EXE `585008719/585008720`.
- OA035 field test: one healthy PRIMARY, WMS ready, normal network, no failover; controlled Android create→terminal result RTT must be under 5 seconds, plus cleanup and ACK-recovery checks.
- Stable remains OWNER-GATED and untouched.

### D115 canonical current-status markers

- Beta: `D115_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_BCBABC09__SCHEMA11__SIGNED_BETA_VC71__AGENT_V34__OA035_FIELD_READY`
- Web: `D114_OWNER_ACCEPTED_PASS__BALANCED_TOOLS__GLOBAL_REALTIME_QUEUE_BADGE`
- Android: `D115_SIGNED_BETA_VC71__ASYNC_UID_CLEANUP__FINAL_ACK_SERVER_READ__NEUTRAL_FAILOVER_COPY__OA035_FIELD_READY`
- Latest Beta APK: `beta-vc71`
- SQLite schema: `11`

## D116 source checkpoint — 2026-09-24

- Web: D116_SOURCE_READY__AUTO_SELECTED_PICKER_DETAIL__SKU_CATALOG_WORKSPACE__PICKER_SAFE_BULK_SELECTION
- Android: D116_SOURCE_READY__TERMINAL_CONFIRM_RESULT_PERSISTS_AFTER_INPUT_RESET__LIVE_BETA_VC71__NEXT_SIGNED_BETA_PENDING
- Current signed Beta before D116 merge/release: beta-vc71
- SQLite schema: 11
- Agent target: relay-agent-v35; PRIMARY 3s, STANDBY 10s, FROZEN no business polling.
- D115 OA035 is superseded by OA036 after Owner-reported quota/result defects.
- D116 source is on feat/d116-quota-result-web-admin / PR #175. Merge only after authority + continuity + source gates PASS.
- Stable remains OWNER-GATED and untouched.

## D116 technical/runtime/release checkpoint — 2026-09-24

- Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA036 FIELD READY**.
- PR #175 merged main `9319eb30f55e48b3c60283ab2e9135bf0a33054d`.
- Main PASS: Authority `35962512361`, State `35962512549`, UI `35962512491`, Worker `35962512349`, Android `35962512556`, Agent `35962512375`.
- Live Beta: HTTP 200 attempt 1, exact source `9319eb30...`, SQLite `11/11`, Operational V2 `5/5`, missing `0`, Agent migration `0/0`.
- Signed Android: `beta-vc72`, release `395378687`, APK asset `585274995`, size `19019872`.
- Agent: `relay-agent-v35`, release `395378457`, EXE asset `585274568`, size `294400`.
- `inventory-channel`: PDA manifest/APK `585275037/585275028`; Agent manifest/EXE `585274637/585274636`.
- OA036 field review remains; Stable remains OWNER-GATED and untouched.

### D116 canonical current-status markers

- Beta: `D116_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_9319EB30__SCHEMA11__SIGNED_BETA_VC72__AGENT_V35__OA036_FIELD_READY`
- Web: `D116_BETA_RUNTIME_PASS__AUTO_SELECTED_PICKER_DETAIL__SKU_CATALOG_WORKSPACE__PICKER_SAFE_BULK_SELECTION__OA036_FIELD_READY`
- Android: `D116_SIGNED_BETA_VC72__TERMINAL_CONFIRM_RESULT_PERSISTS_AFTER_INPUT_RESET__OA036_FIELD_READY`
- Latest Beta APK: `beta-vc72`
- SQLite schema: `11`
- Quota contract: PRIMARY 3s, STANDBY 10s, FROZEN no business poll, Android no polling; healthy-primary field target remains under 5 seconds.

## D117 derived continuity refresh — 2026-09-24

- SQLite schema: `11`.
- Latest signed Beta APK remains `beta-vc72` until D117 release gates pass.
- Beta canonical status: `D117_OWNER_APPROVED_IMPLEMENTATION_CANDIDATE__D116_LIVE_UNTIL_D117_GATES_RELEASE`.
- Web canonical status: `D116_BETA_RUNTIME_PASS__AUTO_SELECTED_PICKER_DETAIL__SKU_CATALOG_WORKSPACE__PICKER_SAFE_BULK_SELECTION__OA036_FIELD_READY`.
- Android canonical status: `D117_BETA_VC73_CANDIDATE__20S_RELAY_TERMINAL_WINDOW__D116_LIVE_UNTIL_RELEASE`.
- D117 target artifacts: `beta-vc73` + `relay-agent-v36`; these are source candidates, not released artifacts yet.
- D117 Owner-approved semantics: Firestore-only proactive 7s PRIMARY lease / 10s failover, PRIMARY 4s idle + 2s hot queue polling, STANDBY/FROZEN no business queue polling, no periodic WMS probe, 06:00–22:00 relay window, hourly after-hours extension, default fleet freeze, early-start-to-06:00, and manual Agent confirmation remains available.
- Stable remains OWNER-GATED and untouched.

## D117 v37 final-hardening candidate — 2026-09-24

- SQLite schema: `11`.
- Latest signed Beta APK: `beta-vc73`.
- Current live Agent: `relay-agent-v36`; final hardening target: `relay-agent-v37`.
- Beta: `D117_V37_FINAL_HARDENING_CANDIDATE__LIVE_BETA_VC73_AGENT_V36_UNTIL_RELEASE`.
- Web: `D116_WEB_FEATURES_LIVE_UNCHANGED__D117_RELAY_HARDENING_AGENT_ONLY`.
- Android: `D117_SIGNED_BETA_VC73__20S_RELAY_TERMINAL_WINDOW__LIVE_UNCHANGED`.
- v37 adds immediate schedule propagation in the PRIMARY lease, 30s FROZEN control-role convergence for early-start, final 20s age recheck and per-WMS-chunk PRIMARY generation fence.
- OA037 is blocked until v37 technical/runtime/release PASS. Stable remains OWNER_GATED / untouched.

## D117 final v37 release-state refresh — 2026-09-24

- SQLite schema: `11`.
- Latest signed Beta APK: `beta-vc73`.
- Current released Agent: `relay-agent-v37`.
- Beta: `D117_TECHNICAL_RUNTIME_RELEASE_PASS__WEB_APK_SOURCE_BBB6C83B__AGENT_SOURCE_E583D20D__SIGNED_BETA_VC73__AGENT_V37__OA037_FIELD_READY`.
- Web: `D116_WEB_FEATURES_LIVE_UNCHANGED__BETA_SOURCE_BBB6C83B__D117_AGENT_ONLY_HARDENING_PASS`.
- Android: `D117_SIGNED_BETA_VC73__20S_RELAY_TERMINAL_WINDOW__OA037_FIELD_READY`.
- Final Agent source: `e583d20d12f097bd7895494992408c41976b1835`; Web/APK runtime source remains `bbb6c83b3f75d234f8220d8ef42b22c3105d9964`.
- OA037 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER_GATED / untouched.

## D118 source continuity refresh — 2026-09-24

- SQLite schema: `11`.
- Latest signed Beta APK remains `beta-vc73` until D118 merge/release gates publish the next signed build.
- Beta candidate: `D118_OWNER_APPROVED_IMPLEMENTATION_CANDIDATE__TARGET_WEB_BETA_VC74_AGENT_V38__D117_LIVE_UNTIL_RELEASE`.
- Web: `D118_CANDIDATE__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL__D117_LIVE_UNTIL_RELEASE`.
- Android: `D118_BETA_VC74_CANDIDATE__IME_ADJUST_RESIZE__D117_VC73_LIVE_UNTIL_RELEASE`.
- D118 Agent target is `relay-agent-v38`; D117 `relay-agent-v37` remains live until release.
- NEXT_ACTION: PR #181 → repair all required authority/state/UI/Web/Android/Agent/Firestore gates → merge only on PASS → verify exact Beta runtime + signed beta-vc74 + Agent v38 → record D118 technical/runtime/release checkpoint → make OA038 field-ready.
- Stable remains OWNER-GATED and untouched.
- PR #181 continuity rerun checkpoint: D118 derived views are aligned to the current candidate markers before merge.

## D118 technical/runtime/release refresh — 2026-09-25

- SQLite schema: `11`.
- Latest signed Beta APK: `beta-vc74`.
- Current released Agent: `relay-agent-v38`.
- Beta: `D118_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_D29237C0__SCHEMA11__SIGNED_BETA_VC74__AGENT_V38__OA038_FIELD_READY`.
- Web: `D118_BETA_RUNTIME_PASS__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL__OA038_FIELD_READY`.
- Android: `D118_SIGNED_BETA_VC74__IME_ADJUST_RESIZE__PICKER_TABS_ABOVE_KEYBOARD__OA038_FIELD_READY`.
- Implementation PR #181 merged main `d29237c0990eb677ddef726785a88e08bce88dce`; all final main Authority/State/UI/Worker/Android/Agent gates PASS.
- Live Beta is exact D118 source with schema 11/11, Operational V2 5/5, missing bindings 0 and Agent migration 0/0.
- OA038 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER_GATED / untouched.
- NEXT_ACTION: Owner field-tests beta-vc74 + relay-agent-v38 for fleet-wide overtime CAS, inherited D117 HA/fencing, real pagination, revision-safe SLA, detailed Excel, Agent footer and keyboard-safe Android tabs.

## D118 Owner-accepted refresh — 2026-09-25

- Status: **OWNER FIELD ACCEPTED PASS**.
- SQLite schema: `11`.
- Latest signed Beta APK: `beta-vc74`.
- Current released Agent: `relay-agent-v38`.
- Beta: `D118_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_D29237C0__SCHEMA11__SIGNED_BETA_VC74__AGENT_V38`.
- Web: `D118_OWNER_ACCEPTED_PASS__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL`.
- Android: `D118_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC74__IME_ADJUST_RESIZE__PICKER_TABS_ABOVE_KEYBOARD`.
- OA038 closed as `PASS_OWNER_CONFIRMED_D118`.
- D118 accepted baseline preserves D117 proactive HA/fencing and accepts fleet-wide overtime CAS, real pagination, authoritative SLA, detailed Excel, Agent footer and keyboard-safe Android tabs.
- NEXT_ACTION: await the next explicit Owner requirement and bootstrap authority before any new change.
- Stable remains OWNER_GATED / untouched.

## D120 derived continuity refresh — 2026-09-26

- SQLite schema: `11`.
- Latest signed Beta APK: `beta-vc75`.
- Web: `D120_SOURCE_CANDIDATE__SLA_DIRTY_GUARD__COMPACT_POLICY_UI__DYNAMIC_VIEWPORT__ROOT_ROLE_EDITOR`.
- Android: `D120_SOURCE_CANDIDATE__SINGLE_CROSS_APP_RED_BLUE_RESULT__NO_LOGIN_FLASH__ACK_RETRY`.
- D119 is Owner field-accepted; D120 is the active Beta source-repair workstream targeting relay-agent-v40 and the next signed Android Beta after beta-vc75.
- Stable remains OWNER-GATED and untouched.

## D120 Picker-presence hotfix continuity — 2026-09-26

- Current released Beta baseline: main `43a94207ff99f45ab932312bac80bf2b7ac99414`, signed `beta-vc76`, `relay-agent-v40`.
- Main runtime health: source exact, SQLite `12/12`, Operational V2 `5/5`, migration `0/0`.
- Owner field status: D120 broader test is usable/partial PASS; online-Picker list has a confirmed flicker + stale-online-count defect.
- Active repair branch: `fix/d120-picker-presence-flicker-accuracy`; Agent target `relay-agent-v41`.
- Presence repair reuses active Android realtime sockets and adds no PDA heartbeat/polling. Stable remains OWNER-GATED and untouched.

### Canonical current-status markers

- `D120_RUNTIME_PASS_MAIN_43A94207__OWNER_FIELD_TEST_OK`
- `D120_SIGNED_BETA_VC76_RELEASED__OWNER_FIELD_TEST_OK`


## D131 current design checkpoint — 2026-09-27

- Owner keeps Firestore as the only PDA↔Agent confirmation carrier; the dual Cloudflare+Firestore relay proposal is closed.
- Capacity model: up to 20 Agents, one PRIMARY, NEXT-A/NEXT-B plus deep business-hibernating Agents; all keep managed Web Confirm warm for local/manual use; 50 PDA per shift, 75 overlap, ~1,200 requests/day and 40 simultaneous burst.
- Operating relay window: 05:00–23:00 Asia/Ho_Chi_Minh unless explicitly extended for overtime.
- Initial design targets: PRIMARY queue 3s, lease heartbeat 8s, lease expiry 12s, query limit >=100.
- Shared received/confirmed/error counters piggyback PRIMARY lease and are tail-reconciled on takeover.
- D131 soft quota targets: <=42k reads/day, <=15k writes/day, <=2k deletes/day, <=0.75 GiB storage, <=8 GiB/month outbound; quota day is America/Los_Angeles.
- D130 v70/beta-vc77 remain the released baseline. OA055 is superseded; OA057 is the pre-implementation review/approval gate and OA056 remains the post-release field gate.
- Stable remains OWNER-GATED and untouched.


## D131 continuation gate — review before implementation

- Exact trigger phrase: `bắt đầu tối ưu lại mô hình`.
- On that phrase, fresh-bootstrap canonical GitHub and present the complete D131 planned change set; do not write runtime code.
- End the review with a maximum-envelope usage projection using current provider limits and explicit assumptions/headroom.
- Approved envelope includes up to 20 Agents, warm Web Confirm on every Agent, 05:00–23:00 base relay, 50 PDA per shift / 75 overlap, ~1,200 daily requests, 40 simultaneous burst, durable non-RAM counters, 10-minute non-primary snapshot refresh and one server-side daily Drive export independent of Agent liveness.
- If Owner changes logic, update design/recalculate usage first.
- Runtime implementation requires a later explicit Owner OK/equivalent. Stable remains OWNER-GATED.


D131 current Android state marker: D130_SIGNED_BETA_VC77_BASELINE__D131_PR259_IMPLEMENTATION_IN_PROGRESS


## D131 release-state refresh — 2026-09-28

- Main source: `3569934ec2a36f6fa2f6fe92cf332ae679ad4070`.
- Windows Agent: `relay-agent-v71`.
- Signed Android Beta: `beta-vc78`.
- D131 technical/runtime/release: **PASS**; OA056 physical Owner field acceptance is READY.
- Stable remains OWNER-GATED / untouched.


## D132 hotfix in progress — 2026-09-28

- Baseline main: `8944d767c8044cb970a54bd58072b35ae27750f2`.
- D131 remains technical/runtime/release PASS; Android remains `beta-vc78`.
- D132 branch: `fix/d132-agent-presence-layout`; target Agent: `relay-agent-v72`.
- Scope: stable combined receive-mode/Relay/Wi-Fi row; restore fixed single-slot event-driven Picker presence signal without business-counter pollution; PickList request zero-write activity refresh; visible Auto size cột button; per-Agent-account column widths and normal-window bounds.
- No new provider/resource, no PDA heartbeat, no non-primary business-queue polling. Stable remains OWNER-GATED.


## D132 release-state refresh — 2026-09-28

- Main source: `32411d15198331e8763f4d9a73288dd89524b65a`.
- Windows Agent: `relay-agent-v72`.
- Android remains `beta-vc78`.
- Beta Worker presence-signal repair: deployed PASS.
- D132 technical/runtime/release: **PASS**; OA058 short Owner field retest is READY. D131 OA056 broader fleet/failover acceptance remains open.
- Stable remains OWNER-GATED / untouched.

## D133 source continuity refresh — 2026-09-28

- SQLite schema: `12`.
- Latest signed Beta APK remains `beta-vc78` until the D133 signed release is published.
- Web remains: `D120_RUNTIME_PASS_MAIN_43A94207__OWNER_FIELD_TEST_OK`.
- Android source marker: `D133_SOURCE_READY__NEXT_SIGNED_BETA_AFTER_VC78__HARD_ALERT_PERMISSION_GATE__LOCAL_FIRST_ACK`.
- Agent source target: `relay-agent-v73`.
- D132 Owner field result: **PASS**.
- D133 covers shared Auto-size for Agent grids, Agent Usage 401 repair, Firestore-authoritative PickList overlay counters, current-account Gọi về bàn CV delivery, local-first result acknowledgement, 60-second command-overlay safety TTL, and hard Android notification/overlay permission gating.
- No new provider resource. Stable remains OWNER-GATED and untouched.

## D133 release-state refresh — 2026-09-28

- SQLite schema: `12`.
- Latest signed Beta APK: `beta-vc79`.
- Web: `D120_RUNTIME_PASS_MAIN_43A94207__OWNER_FIELD_TEST_OK`.
- Android: `D133_SIGNED_BETA_VC79__HARD_ALERT_PERMISSION_GATE__LOCAL_FIRST_ACK__60S_CALL_SPECIALIST__OA059_FIELD_READY`.
- Beta: `D133_TECHNICAL_RUNTIME_RELEASE_PASS__MAIN_42909CFD__AGENT_V73__BETA_VC79__OA059_FIELD_READY`.
- Windows Agent: `relay-agent-v73`.
- D133 Worker/Functions/Android/Agent/UI/Authority/State main gates are PASS and the distribution channel is refreshed.
- OA059 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER-GATED and untouched.

## D134 implementation continuity — 2026-09-28

- D133 v73/vc79 passed technical/release gates but Owner field testing found concrete defects; OA059 is superseded by OA060.
- Active branch: `fix/d134-field-reliability-pda-sync`; target Agent `relay-agent-v74`; Android target is the next monotonic signed Beta after `beta-vc79`.
- D134 removes socket/disconnect-grace presence authority. LOGIN/LOGOUT are authoritative; a valid PickList may repair delayed presence and carries the Android session generation.
- Kích User writes `picker_session_controls/<firebase_uid>`; Firestore Rules reject jobs from the revoked generation and the PDA returns to login. Two confirmations are required.
- Liên hệ picker is reusable after RESOLVED/expiry and has a fleet-wide 60-second lock. FCM remains fast path; exact document listeners provide recovery.
- All authenticated Agents listen to one compact `relay_poc_coordination/agent_sync` document, including Replay/deep-hibernate roles. PRIMARY reconciles every 5 minutes; fleet presentation is capped at 10.
- Usage is server-collected and mirrored every 10 minutes to `relay_poc_coordination/usage_current`; Windows Agent reads it directly from Firestore so Office does not depend on Worker DNS.
- D134 soft Firestore read target is 45k/day; no UI-focus read and no per-job durable-counter refresh remain.
- Auto size control exists only in Hệ thống Agent; title readiness colors and password-protected Web/Agent logout are part of the same change set.
- Stable remains OWNER-GATED and untouched.

## D134 release-state refresh — 2026-09-28

- Main source: `8b703f12ec6f1667e43dab101114f2fbcc1a8819`.
- Windows Agent: `relay-agent-v74`, SHA-256 `3c3792de465cc1e81f772a90ad2591c14bf79c8e97298ea743ca7701edbf366b`.
- Signed Android Beta: `beta-vc80`, SHA-256 `c25e052f308154ed4fe30ea584ecebc7aab0c26bcd9fb53f99313070c73cf330`.
- Worker runtime exact-source health PASS: schema `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- Firestore Rules deployment/readback, Functions deployment, Agent, Android, UI, Authority, State and Dashboard Probe main workflows all PASS.
- `inventory-channel` is refreshed to v74/vc80. Fixed WebView2 runtime bundle is reused unchanged.
- D134 technical/runtime/release is PASS; OA060 physical Owner field acceptance is READY.
- Stable remains OWNER-GATED and untouched.

## D135 implementation continuity — 2026-09-28
- Baseline signed Android Beta: `beta-vc81`.
- Canonical Android source marker: `D135_TARGET_BETA_VC82__1291_BAO_HANG_BETA__LOCAL_FIRST_RESULT_ACK_ALL_SURFACES`.

- D134 hotfix core field path is Owner-confirmed PASS on Agent v75 / Android vc81. OA060 is closed; D135 follow-up acceptance is OA061.
- Active branch: `fix/d135-post-d134-field-refinements`, based on main `fd57b420ff80fea6cd259e9ea1daa22b00c9535b`. Targets are Agent v76 and next monotonic signed Android Beta after vc81.
- Approved D135 changes: immediate initiating-Agent call lock + single confirmations, faster one-click DOM lookup with stable-miss settle, explicit fleet/local counter labels, processing-Agent overlay counter immediacy after durable ACK, hidden Picker TTL implementation text, username-only display, Android name **1291 Báo hàng Beta**, and local-first ACK on both Báo hàng result surfaces.
- Counter immediacy is local presentation derived from the already-successful durable ACK commit. It must not add Firestore provider operations. Durable daily summary remains cross-process authority; compact snapshots reconcile without moving totals backward.
- D134 fleet/presence/generation/quota architecture is preserved. Stable remains OWNER-GATED and untouched.

## D135 release-state refresh — 2026-09-28
- Canonical release marker: `D135_TECHNICAL_RUNTIME_RELEASE_PASS__MAIN_6D929E42__AGENT_V76__BETA_VC82__OA061_FIELD_READY`.
- Canonical release marker: `D135_SIGNED_BETA_VC82__1291_BAO_HANG_BETA__LOCAL_FIRST_RESULT_ACK_ALL_SURFACES__OA061_FIELD_READY`.

- Main source: `6d929e42fa2474712e0629a95bb5ac9cf59112bd`.
- Windows Agent: `relay-agent-v76`.
- Signed Android Beta: `beta-vc82` — **1291 Báo hàng Beta 0.2.0-beta.82**.
- Main Repo Authority, Project State, UI Design, Beta Worker, Android, Relay Agent and Dashboard Probe workflows all PASS.
- Runtime health proves exact main source, SQLite `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- D135 is **TECHNICAL / RUNTIME / RELEASE PASS**. OA061 is READY_FOR_OWNER_FIELD_TEST.
- Stable remains OWNER-GATED and untouched.

## D136 implementation continuity — 2026-09-28

- Canonical Android marker: `D135_OWNER_FIELD_PASS__SIGNED_BETA_VC82__1291_BAO_HANG_BETA`.
- Released Android baseline remains `beta-vc82`.
- D135 field acceptance is Owner-confirmed PASS; OA061 is closed.
- Active D136 branch: `fix/d136-picklist-ui-retire-usage-background-hide`; target Agent `relay-agent-v77`; Android unchanged.
- D136 manual PickList rows require code + **Xác nhận** + **Trạng thái** together and protect those columns from saved-width/auto-size clipping.
- D136 retires the Agent Usage tab and provider Usage Monitoring/snapshot publication. The local Firestore quota guard remains reference-only.
- **Chuyển Web chạy nền** requires no password; showing/stopping/logout/mode-switch security gates remain.
- OA062 opens after technical/release PASS. Stable remains OWNER-GATED and untouched.

## D136 release-state refresh — 2026-09-28

- D136 status: **TECHNICAL / RUNTIME / RELEASE PASS**.
- Main: `62ab2aa11cda251f18090fc0bd637a092ab0998d`.
- Agent: `relay-agent-v77`; Android: `beta-vc82` unchanged.
- Main Authority/State/UI/Worker/Agent/Dashboard gates PASS.
- Runtime exact-source health PASS with schema `12/12`, Operational `5/5`, migration `0/0`.
- OA062 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER-GATED.

## D137 implementation continuity — 2026-09-28

- Owner confirmed D136 field PASS on Agent v77 and opened D137 for two follow-up field defects.
- Normal/restored Agent windows must keep the manual PickList grid itself visible with at least one actionable row; D136 PickList/Xác nhận/Trạng thái width guards remain.
- First loaded arrival at the canonical Confirm route is never READY. Agent v78 performs one normal F5-equivalent reload and requires stable post-reload DOM before enabling PickList work.
- Login and stored-session Dashboard recovery converge on the same refresh barrier. No reload loop, DevTools Network, session extraction, direct WMS API or additional provider polling.
- Target: `relay-agent-v78`; Android `beta-vc82` unchanged; WebView2 host build 10 reused.
- Branch: `fix/d137-picklist-height-confirm-refresh`; OA063 blocked pending release. Stable OWNER-GATED.

## D137 v79 hotfix continuity — 2026-09-28

- Owner field result on v78: normal-window PickList UI PASS; Confirm data hydration FAIL.
- Sanitized field log: final WMS child attach 15:30:08.784 → v78 auto reload 15:30:09.400 → reload PASS 15:30:12.391 → first search NOT_FOUND 15:30:34.222 → after operator F5 search FOUND 15:31:03.904 and confirm PASS.
- Root cause in v78 gating: reload fired against the final route too early and READY was based on DOM shell/navigation proof rather than data-hydration resilience.
- v79 hotfix: final Confirm 3s settle → one normal reload → 1.2s stable post-reload DOM; first search with zero table PickList codes gets one bounded local reload/search retry.
- Target `relay-agent-v79`; Android `beta-vc82` unchanged; no new provider resources; Stable OWNER-GATED.

## D137 v79 release continuity — 2026-09-28

- D137 v79 hotfix is technical/release PASS on main `b177ef0f9169b051fe90349460c1c3e2d7a07663`.
- PR #275 and all applicable main Authority/State/UI/Agent/Dashboard gates passed.
- `relay-agent-v79` is published; inventory-channel Agent manifest/EXE point to the v79 binary with SHA-256 `e88108a53ff5def868c7ca036318fcac5a2ba19da2fe426fddb1983fa1056d23`.
- OA063 is field-ready: update to v79, enter Confirm without manual F5, search the known PickList, verify bounded self-heal/no loop and confirmation success.
- Android remains `beta-vc82`; Stable remains OWNER-GATED.


## D138 Web SLA realtime continuity — 2026-09-28

- Owner field report: selecting **Theo báo đầu tiên của SKU** could be reset to **Theo từng Picker** before/around Save.
- Root cause: `loadSla()` correctly protected the dirty form, but generic `reconcileActive()` still repatched the active SLA section from the older authoritative snapshot.
- Fix branch: `fix/d138-sla-mode-realtime-reset`.
- Fix: SLA reconcile delegates rendering entirely to `loadSla()` and returns; generic patch no longer runs after the dirty guard.
- Existing save verification remains: immediate server result and fresh reload must equal the selected mode before success.
- Target: Beta Web/Worker deploy only; no schema/provider/Android/Agent change.
- OA064 opens after technical/runtime PASS. D137 OA063 remains open independently. Stable remains OWNER-GATED.

- Canonical Web marker: `D138_SOURCE_CANDIDATE__SLA_DIRTY_FORM_REALTIME_RECONCILE_PRESERVATION`.


## D138 runtime PASS — 2026-09-28

- PR #277 merged to main `005d829811ddfa534f0552cd808d69e12c5cf763`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web deploy run `36408876240` PASS under the exact-source runtime health workflow.
- Web marker: `D138_RUNTIME_PASS_MAIN_005D8298__SLA_DIRTY_FORM_REALTIME_PRESERVATION__OA064_FIELD_READY`.
- OA064 is READY_FOR_OWNER_FIELD_TEST. D137 OA063 remains independently open.
- Android remains `beta-vc82`; Agent remains `relay-agent-v79`; Stable remains OWNER-GATED.


## D139 continuity — 2026-09-28

- D138 OA064: **FIELD FAIL**, superseded by D139/OA065.
- Owner evidence: choose FIRST_REPORT → Save → F5 → server-authoritative view still PER_PICKER.
- D139 branch: `fix/d139-sla-dirty-form-global-rerender`.
- Fix moves SLA dirty-form protection from one realtime caller into shared `patchActiveSection`, covering delayed section load, network repaint and action-finally repaint.
- Save explicitly reads the checked Deadline radio; backend revision/roundtrip guards remain unchanged.
- Beta Web only; no resource/schema/Android/Agent change. D137 OA063 remains open. Stable OWNER-GATED.
- Canonical Web marker: `D139_SOURCE_CANDIDATE__GLOBAL_DIRTY_SLA_FORM_RERENDER_GUARD`.


## D139 runtime PASS — 2026-09-28

- PR #279 merged to main `219469840a9ece147441b1ef9a0db8242109e5a7`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web deploy run `36414388456` PASS, including service typecheck, Worker/Web assets/Durable Object deploy, Beta health/schema/auth/business/Web-shell/OAuth verification.
- Web marker: `D139_RUNTIME_PASS_MAIN_21946984__GLOBAL_DIRTY_SLA_FORM_RERENDER_GUARD__OA065_FIELD_READY`.
- OA065 is READY_FOR_OWNER_FIELD_TEST for FIRST_REPORT save + browser-reload persistence.
- D138 is field-failed and superseded by D139. D137 OA063 remains independently open.
- Android remains `beta-vc82`; Agent remains `relay-agent-v79`; Stable remains OWNER-GATED.

## D140 Agent Firestore usage-storm continuity — 2026-09-28

- Root cause: raw Firestore gRPC streaming lacked required database routing metadata, and retry backoff reset before any accepted server response; D134 also multiplied the fault by allowing every authenticated Agent to listen.
- Fix target: `relay-agent-v80`.
- Listener policy: PRIMARY/NEXT_A/NEXT_B only; DEEP_HIBERNATE listener disabled.
- Retry policy: permanent/configuration/quota error → 5-minute circuit; transient error → 2s exponential backoff capped at 60s; reset only after a valid response.
- PRIMARY reconcile remains 5 minutes steady / at least 1 minute forced; unchanged compact state skips PATCH.
- Android remains `beta-vc82` and requires no update.
- OA066 is blocked pending technical/runtime/release PASS, then 30–60 minute field soak + Firestore Usage check.
- D139 OA065 and D137 OA063 remain independent. Stable remains OWNER-GATED.



## D141 SLA persistence continuity — 2026-09-28

- D139/OA065: **FIELD FAIL**, superseded by D141/OA067.
- Field evidence: after reload, radio = FIRST_REPORT while **Đang áp dụng** = PER_PICKER.
- Confirmed UI source defect: `restoreUiContext()` restored SLA form controls after authoritative rerender, creating mixed draft/server presentation.
- Additional reliability defect removed: SLA Save no longer goes through generic `run()` / `if (busy) return`; it has dedicated single-flight execution.
- Server now rereads the SQLite SLA row after PUT and returns success only when full policy/mode/version match.
- Web then issues a fresh no-cache GET and requires identical persisted mode/version before success.
- Branch: `fix/d141-sla-server-draft-persistence`.
- OA067 opens only after PR/main/Beta runtime PASS.
- D140 Agent v80 is parallel and unchanged by D141. Android beta-vc82 unchanged. D137 OA063 remains open. Stable OWNER-GATED.

- Canonical Web marker: `D141_SOURCE_CANDIDATE__SLA_SERVER_DRAFT_SPLIT__SQLITE_READBACK__NON_DROPPABLE_SAVE`.


## D141 runtime PASS — 2026-09-28

- PR #282 merged to main `966b6d1f561768551969694065b1035bb2e2b234`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web exact-source deploy run `36421277405` PASS.
- D141 now separates server-applied SLA authority from browser draft state, uses a dedicated non-droppable save path, verifies SQLite readback before server success, and requires a fresh no-cache GET match before Web success.
- Web marker: `D141_RUNTIME_PASS_MAIN_966B6D1F__SLA_SERVER_DRAFT_SPLIT__SQLITE_READBACK__NON_DROPPABLE_SAVE__OA067_FIELD_READY`.
- OA067 is READY_FOR_OWNER_FIELD_TEST. D140 Agent v80 remains parallel. D137 OA063 remains independently open.
- Android unchanged; Stable remains OWNER-GATED.

## D142 Android 11 critical-alert continuity — 2026-09-28

- Owner-approved target devices: Newland NLS-MT90 Android 11 + Urovo DT50 Android 11.
- Branch: `feat/d142-android11-critical-alert-readiness`; baseline main `966b6d1f561768551969694065b1035bb2e2b234`.
- Android source candidate: `D142_SOURCE_CANDIDATE__ANDROID11_MT90_DT50_CRITICAL_ALERT_READINESS__NEXT_SIGNED_BETA_AFTER_VC82`.
- Gate before login checks notifications, overlay, DND policy access, battery exemption and critical channel HIGH + DND bypass.
- Missing rows get short Vietnamese guidance + closest Settings action; returning with Android Back auto-rechecks. No manual test/check button.
- Existing data-only FCM HIGH delivery, D133/D135 full-screen overlay and local-first ACK are preserved. Full-screen intent/wake is a bounded Android 11 reliability layer only; no polling/persistent wake lock.
- Target signed Android: next monotonic release after `beta-vc82`; OA068 opens after technical/release PASS.
- D141 Web/SLA and D140 Agent v80 remain parallel/untouched by D142. No provider resource change. Stable OWNER-GATED.

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

## D143 derived continuity refresh — 2026-09-29

- SQLite schema: `13`.
- Latest signed Beta APK remains `beta-vc83` until D143 main/release gates publish the next monotonic signed build.
- Beta marker: `D143_IMPLEMENTATION_ACTIVE__D142_OWNER_PASS__D141_OWNER_PASS__D140_AGENT_V80_PARALLEL`.
- Web marker: `D141_OWNER_FIELD_PASS__SLA_FIRST_REPORT_SERVER_PERSISTENCE_ACCEPTED__D143_WEB_REFINEMENTS_IN_PROGRESS`.
- Android marker: `D143_ANDROID_REFINEMENTS_IN_PROGRESS__BASELINE_D142_OWNER_PASS_BETA_VC83`.
- D141 is now Owner field PASS; OA067 closed. D143 implementation branch targets Agent v81 plus the next signed Android Beta, with OA069 blocked until technical/runtime/release PASS.
- No new provider resource. Stable remains OWNER-GATED and untouched.

## D143 runtime/release partial PASS — 2026-09-29

- Canonical marker: `D143_WEB_AGENT_RUNTIME_RELEASE_PASS__ANDROID_OWNER_SECRET_BLOCKED`.
- Main implementation PR #287 merged to `96e38ca88633ef9a0114d6682bdac5bea2d4f2c8`.
- Beta Worker/Web run `36463932814` PASS with exact-source health: HTTP 200, source `96e38ca8`, SQLite `13/13`, Operational V2 `5/5`, Agent migration `0/0`.
- Web marker: `D143_RUNTIME_PASS__MAIN_96E38CA8__SCHEMA13__RBAC_DATE_AUDIT_REFINEMENTS`.
- Agent main run `36463932863` PASS and prerelease `relay-agent-v81` is published.
- Main Authority, State, UI, Dashboard, Firestore and Functions gates PASS.
- Android marker: `D143_SOURCE_AND_PR_GATES_PASS__SIGNED_BETA_RELEASE_BLOCKED_MISSING_GITHUB_BETA_DEFAULT_PASSWORD_SECRET__BASELINE_BETA_VC83`.
- Signed Android source/PR gates passed, but main Android release run `36463932866` failed closed before build because GitHub Beta environment secret `ANDROID_PICKER_DEFAULT_PASSWORD` is not configured.
- The password is intentionally not committed to this public repository. OA070 is the single Owner-only setup action; OA069 field acceptance remains blocked until the next signed Beta Android release is published.
- Latest signed Android therefore remains `beta-vc83`.
- Stable remains OWNER-GATED and untouched.

## D143 full technical/runtime/release PASS — 2026-09-29

- Canonical Beta marker: `D143_TECHNICAL_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC84__AGENT_V81__OA069_FIELD_READY`.
- Canonical Android marker: `D143_SIGNED_BETA_VC84__SECURE_DEFAULT_PASSWORD_INJECTION__OA069_FIELD_READY`.
- Latest signed Beta APK: `beta-vc84`; release id `398516587`; APK asset id `596111333`; size `19085892` bytes; SHA-256 `8f060f6d8482efca73bf01279435126a7e5ba1c9ac39f916f077e1bd0dddaaa4`.
- Android source is exact D143 implementation main `96e38ca88633ef9a0114d6682bdac5bea2d4f2c8`. Verify Beta Android run `36463932866`, attempt 2, PASS; secure default-password injection check, signed APK build, exact-source Beta runtime gate and release publication all PASS.
- GitHub Beta environment secret `ANDROID_PICKER_DEFAULT_PASSWORD` is configured; only the secret reference is recorded. No plaintext password is stored in repo/logs.
- Agent `relay-agent-v81` remains released and D143 Web/Worker runtime remains PASS on SQLite `13/13`, Operational V2 `5/5`, Agent migration `0/0`.
- OA070 is closed PASS. OA069 is READY_FOR_OWNER_FIELD_TEST on `relay-agent-v81` + `beta-vc84`.
- Stable remains OWNER-GATED and untouched.

## D144 field-repair workstream — 2026-09-29

- Beta marker: `D144_SOURCE_IMPLEMENTED__PENDING_PR_GATES`.
- Web marker: `D144_INVENTORYCORE_RUNTIME_LOG_BUFFER_SOURCE_READY__D143_WEB_RUNTIME_BASELINE_PASS`.
- Android marker: `D144_DIRECT_CHAT_AND_KICK_COMPAT_SOURCE_READY__BASELINE_BETA_VC84`.
- D143 OA069 field acceptance failed on three bounded items: runtime-log OAuth refresh revoked, Agent chat input/delivery, and legacy Picker Kích User resurrection. Direct specialist call remains PASS.
- D144 reuses existing Beta resources only: InventoryCore SQLite, existing Logs folder as optional archive, existing Firestore Picker session/control collections, existing Worker and Android/Agent distribution.
- Target Agent is `relay-agent-v82`; Android target is the next monotonic signed Beta after `beta-vc84`; SQLite source target is schema 14 with an additive bounded runtime-log buffer.
- Web/Android runtime logs persist to InventoryCore first and are listed/read there. Drive archival is best-effort only, so revoked OAuth no longer blocks log upload or Web Nhật ký. OA072 is superseded; no folder permission change is required.
- Chat uses the existing per-Picker session-control listener as direct realtime authority, with FCM compatibility delivery and local-only PDA dismiss. The modal editor pauses periodic Agent UI refresh timers while typing.
- Kích User adds authoritative Worker Android-session revocation plus a bounded 5-minute fallback reconciliation from the existing compact Agent sync document when direct Worker access is unavailable. Worker also sends one best-effort backward-compatible re-login command before disabling the old Android notification target.
- Stable remains OWNER-GATED and untouched.

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
