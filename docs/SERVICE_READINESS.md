# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc59`
- Current released Agent: `relay-agent-v20`
- Beta: `D096_WMS_EXACT_RESOLVER_SOURCE_READY__CURRENT_AGENT_V20_PDA_AGENT_FIELD_PASS__TARGET_V21__BETA_VC59_UNCHANGED__OA017_AFTER_RELEASE`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D095_SIGNED_BETA_VC59_PDA_AGENT_FIELD_PASS__NO_D096_ANDROID_CHANGE`
- D089: **OWNER ACCEPTED PASS**
- Stable: `OWNER_GATED`

## Accepted readiness baseline

Owner acceptance completed on 2026-09-21:
- approved icon #4 across Web/Android/Agent;
- Service/API and realtime status separation;
- dark-theme Tools completion;
- persistent granular Overlay controls;
- per-user single-instance Agent behavior.

Technical/runtime/release evidence was already PASS before Owner acceptance:
- D089 runtime source `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`;
- release checkpoint `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`;
- signed `beta-vc54`;
- `relay-agent-v15`.

`OA011` is closed PASS. There is no remaining D089 field acceptance blocker.

## D090 Office transport evidence

Owner-confirmed field boundary: Office reaches internal Supra plus selected Google services only. Sanitized Agent evidence confirms WMS UI/API and Firebase Auth reachability, repeated RTDB corporate-proxy 403, and transport-layer reachability of Firestore/Apps Script/Sheets/Drive hosts. No further Cloudflare/Worker Office probe is required. A Google-hosted replacement still needs an authenticated Beta relay/HA/quota proof before selection.

## D091 candidate readiness

D091 infrastructure/runtime/release is PASS: Beta Firestore `(default)` is provisioned in `asia-southeast1`; locked Rules were deployed via Firebase Rules Management API and the `cloud.firestore` release readback passed on main run `35548847740`. `relay-agent-v16` and signed `beta-vc55` are released. Only the physical Office round trip remains before evaluating quota-safe HA/failover. The ACK is transport-only and WMS mutation remains forbidden.

## Open boundaries

- D091 Firestore is the active authenticated field candidate. It is not the final selected transport until real Office E2E plus later quota-safe D085 HA/failover validation pass.
- WMS remains GET-only; no confirmation/mutation.
- Stable remains OWNER-GATED.

## Next action

Run the single physical Office D091 transport test with `relay-agent-v16` + `beta-vc55`. PASS requires the PDA `KẾT NỐI PDA ↔ AGENT OK` result and the matching short request ID in the Agent FIRESTORE audit. Preserve the D089 accepted baseline.

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.

## D092 release-state refresh — 2026-09-21

- SQLite schema: `8`.
- Web status: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D092_SIGNED_BETA_VC56_CONFIRMATION_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Latest signed Beta APK: `beta-vc56`.
- Windows Agent: `relay-agent-v17`.
- D092 technical/runtime/release: PASS; OA013 Owner real Picklist confirmation: PENDING.
- Stable: OWNER-GATED / untouched.

## D093 Firestore regression repair checkpoint

- SQLite schema: `8`.
- Latest signed Beta APK is `beta-vc57`; D093 main release is published.
- Web status remains `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D093_SIGNED_BETA_VC57_FIRESTORE_HARDENING_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Firestore remains the selected PDA-Agent carrier from D091 field PASS; D093 repairs D092 relay/HA health without changing architecture.
- OA013 real Picklist confirmation is blocked until OA014 D093 PDA-Agent Firestore regression re-test PASS.
- Stable remains OWNER-GATED.

## D093 release readiness

- Main source `377159ed6722eede6b7716c9c83066b863a4e805` is technical/runtime/release PASS.
- `relay-agent-v18` is published and verified; canonical EXE SHA-256: `96e2cde601f41908e1af10492a4bd8b9e8a47a905ce464d33d4917038838acb7`.
- Signed `beta-vc57` is published and verified; APK SHA-256: `f655844b1222787938cacf169ca2f158630ab536b0a9c252f19f56d60cc3ce19`.
- OA014 is READY_FOR_OWNER_FIELD_TEST. OA013 is blocked until OA014 PASS.
- Stable remains OWNER-GATED.

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


## D097 readiness — quota-safe confirmation HA

Source target is Beta-only and limited to the Picker confirmation Firestore wrapper.

- Firestore carrier remains selected; normal Internet and Office field logs both show authenticated reachability.
- D097 addresses the Windows transition interval where IP/DNS/proxy can temporarily remain DIRECT before Office proxy readiness.
- PRIMARY 5s / STANDBY 10s / FROZEN no business polling replaces the old quota-heavy 4s lease model.
- Direct conditional PENDING→ACK replaces the per-job PROCESSING write.
- Android one-document snapshot listener uses no offline business persistence.
- WMS confirmation implementation from D096 is unchanged.
- Runtime/release readiness remains **PENDING PR + main CI + OA018 physical field acceptance**.
- Stable is not eligible for this change without a later explicit Owner command.

- Canonical Android status: `D097_FIRESTORE_SNAPSHOT_LISTENER_SOURCE_READY__TARGET_BETA_VC60__D095_UI_BASELINE_PRESERVED`.


## D097 release readiness

- Beta: `D097_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V22__BETA_VC60__OA018_FIELD_ACCEPTANCE_READY`.
- Android: `D097_SIGNED_BETA_VC60_FIRESTORE_LISTENER_RELEASED__D095_UI_BASELINE_PRESERVED`.
- Latest signed Beta APK: `beta-vc60`.
- Current released Agent: `relay-agent-v22`.
- Main source `ad9bdbe32bc9d9c342b3a98d9fbb00846d8692af` is technical/runtime/release PASS.
- Repo Authority `35575186486`, Project State `35575186191`, Beta Worker `35575186212`, Firestore `35575186225`, RTDB `35575186237`, Relay Agent `35575186389`, UI `35575186226`, Android `35575186223`: PASS.
- Agent v22 SHA-256: `e986f660935bc3d24f2c493a63902fb23ca6125bb327ad87ddc9ed95dfcd5a64`.
- APK vc60 SHA-256: `0c295a55fcd5e0ab6f2a9a1b9cd1d53d1fefba90c39187e9c74c7320a96853cc`.
- OA018 is READY_FOR_OWNER_FIELD_TEST; runtime/release is no longer pending.
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

