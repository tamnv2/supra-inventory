# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `17`
- Latest signed Beta APK: `beta-vc97`
- Current released Agent: `relay-agent-v114`
- Beta: `D165_MERGED_BETA__POST_MERGE_CI_ALL_GREEN__FIELD_USAGE_OWNER_PASS_PENDING__STABLE_UNTOUCHED`
- Web: `D165_IMPLEMENTED__REALTIME_EXACT_ROW_PATCH__OVERDUE_CORRECTION_SLA_REAUTH__TECHNICAL_PASS`
- Android: D165_PR_487_ANDROID_REPORTER_4_OR_3_TABS__PENDING_OVERDUE_BADGES_ONLY__NOT_RELEASED__SIGNED_BETA_VC97
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

D163 remains the last explicit Owner-accepted Inventory base. D165 is merged to Beta and all observed post-merge technical CI is green after PR #480 repaired the stale D160 gateway revision assertion. D165 still requires field validation of behavior, speed, stability and usage plus explicit Owner PASS. Independent D164 PDA Management remains technically PASS and pending its own Owner field test. Released Agent remains v114; D165 source is aligned to v115. Installed/released Android channel remains vc97 unless a later release record supersedes it. Stable remains OWNER-GATED.

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
- Released Agent: `relay-agent-v26`; release id `393404831`; canonical EXE asset id `580316553`, size `263680`, SHA-256 `5db50633e74247b45305a536a6caf140069626db66a7020acf32cf2d216ff79b`.
- Remaining gate: OA021 physical field acceptance. Stable remains OWNER-GATED and untouched.
## D102 Agent v27 source readiness

- Status: SOURCE_CANDIDATE / PR_GATES_PENDING.
- Beta-only Agent source target relay-agent-v27; Stable untouched.
- D097/D096 confirmation guards preserved.
- New local 21:30/22:00/05:00 schedule does not add provider polling; five-minute reminders are local.
- Firestore observability cadence: 15m presence write, 30m fleet read, 40m freshness; role refresh 60s PRIMARY/STANDBY, 5m FROZEN, plus bounded startup convergence.
- Next gate: Agent build/startup-smoke + authority/state/UI guards on PR, then main prerelease verification and OA022 field test.

## D102 Agent v27 release readiness — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA022 FIELD READY**.

- Beta: `D102_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V27__OA022_FIELD_READY`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`; SQLite schema: `10`.
- D102 main PASS: Authority `35683012628`, State `35683012626`, UI `35683012670`, Relay Agent `35683012671`.
- Agent release `relay-agent-v27` id `393435282`; EXE asset id `580448326`, size `271872`, SHA-256 `322159ed214be13d5340fd2a8a826b02232627aa016711c2a46492da1cc819e4`.
- D097 5s PRIMARY / 10s STANDBY / 10s pending-job takeover and D096 fail-closed confirmation semantics remain guarded.
- D102 schedule self-test PASSes 21:30 prompt boundaries, CONTINUE/STOP persistence, 22:00 business pause and 05:00 resume logic.
- Remaining gate: OA022 physical Windows/multi-Agent acceptance only. Stable remains OWNER-GATED.

## D103 Agent v28 source readiness

- Status: SOURCE_CANDIDATE / PR_GATES_PENDING.
- Beta: `D103_SOURCE_CANDIDATE__AGENT_V28_DENSE_OVERVIEW__PR_GATES_PENDING`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`; SQLite schema: `10`.
- relay-agent-v28 source enforces maximized launch/restore, non-scrolling dense Overview, max-five-row Agent fleet viewport, compact Supra and visible row-level PickList confirm actions.
- D102 HA/night schedule, D096/D097 guards and Stable OWNER-GATED status are unchanged.
- Next gate: PR authority/state/UI/Relay Agent PASS, merge, main prerelease verification, then OA023 physical UI review.

## D103 Agent v28 release readiness — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA023 FIELD READY**.

- Beta: `D103_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V28__OA023_FIELD_READY`.
- Web: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android: `D099_SIGNED_BETA_VC62_LOGIN_REPAIR__D100_NO_ANDROID_RUNTIME_CHANGE`.
- Latest signed Beta APK: `beta-vc62`; SQLite schema: `10`.
- D103 main PASS: Authority `35684829649`, State `35684829653`, UI `35684829650`, Relay Agent `35684829660`.
- Agent release `relay-agent-v28` id `393444068`; EXE asset id `580490417`, size `271360`, SHA-256 `4faf8507637d61d74ac8aa34ba998a1fc04bfacd0fdc572af1cabda5f8bb8cb1`.
- Maximized/non-scrolling Overview, five-row fleet viewport and row-specific PickList action guards are active; D102 HA/night schedule and D096/D097 business guards remain unchanged.
- Remaining gate: OA023 physical UI review only. Stable remains OWNER-GATED.

## D104 Agent v29 source readiness — 2026-09-22

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

- D103/OA023 physical UI acceptance is Owner PASS.
- Beta target: `relay-agent-v29`; Android `beta-vc62` unchanged; Stable OWNER-GATED.
- WorkingArea maximum preserves Windows taskbar.
- Multi-search: <=10 unique 3–5 digit comma terms, one cache snapshot, at most one shared refresh.
- Manual bulk confirm: visible only for >=2 displayed results; row buttons preserved.
- PDA batching: no faster Firestore polling and no extra coalescing read; <=12 jobs/logical batch; <=10 exact codes/WMS POST; per-code guard + per-job ACK.
- D096 Status=true success semantics, D097 HA/idempotency, D102 night schedule and D103 dense Overview remain required regressions.
- Next gate: PR authority/state/UI/Agent build/self-tests PASS, merge, v29 prerelease verification, then OA024 physical field acceptance.

## D104 Agent v29 release readiness — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA024 FIELD READY**.

- Beta: `D104_TECHNICAL_RUNTIME_RELEASE_PASS__AGENT_V29__OA024_FIELD_READY`.
- Android remains `beta-vc62`.
- D104 main PASS: Authority `35687822814`, State `35687822742`, UI `35687822767`, Relay Agent `35687822763`.
- Agent release `relay-agent-v29` id `393459636`; EXE asset id `580560440`, size `284160`, SHA-256 `10304ac734218146550c6bdf3c3b8a81d979fabe5b3ee7dddc94f1b217955b2d`.
- WorkingArea maximum, comma multi-search, conditional confirm-all, batch lookup/exact resolution and <=10-code WMS confirmation guards are active.
- Existing D097 HA cadence, D102 night schedule, D103 dense Overview, D096 Status=true confirmation semantics, per-code guard and per-job conditional ACK remain guarded.
- Remaining gate: OA024 physical company-WMS/Windows/PDA field acceptance only. Stable remains OWNER-GATED.

## D105 Android vc63 + Agent v30 source readiness — 2026-09-22

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

- D104/OA024 field acceptance is Owner PASS.
- Android target `beta-vc63`: exact four-digit input, in-flight button dim, prominent terminal result.
- Agent target `relay-agent-v30`: current four-digit suffix resolution with legacy five-digit rollout compatibility; manual search 3–4 digits.
- Beta Firestore Rules source accepts `{4,5}` digits during rollout; no extra reads/writes are introduced.
- D104 batch WMS <=10, max12 logical PDA jobs, per-code guard, per-job ACK and quota behavior are preserved.
- D097/D102/D103/D096 regressions and Stable OWNER-GATED state remain required.
- Next: PR gates/build/deploy PASS, merge, release verification, then OA025 physical field acceptance.

### D105 canonical marker sync

- SQLite schema: `10`.
- Latest released Beta APK baseline: `beta-vc62`.
- Web status: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android source status: `D105_SOURCE_CANDIDATE__BETA_VC63__FOUR_DIGIT_CONFIRM_UI__PR_GATES_PENDING`.

## D105 Android vc63 + Agent v30 release readiness — 2026-09-22

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA025 FIELD READY**.

- SQLite schema: `10`.
- Latest Beta APK: `beta-vc63`.
- Web status: `D101_BETA_RUNTIME_PASS__WEB_ONLINE_WEB_ANDROID_ONLY__TOOLS_AGENT_V26`.
- Android status: `D105_SIGNED_BETA_VC63__FOUR_DIGIT_CONFIRM_UI__OA025_FIELD_READY`.
- Beta: `D105_TECHNICAL_RUNTIME_RELEASE_PASS__ANDROID_VC63_AGENT_V30__OA025_FIELD_READY`.
- Main PASS: Authority `35694361080`, State `35694361070`, UI `35694361168`, Android `35694361091`, Agent `35694361074`, Firestore `35694361133`, Worker `35694361089`.
- Released Android `beta-vc63` and Agent `relay-agent-v30` both point to `e73206dea01e4c599d19abe040ffc8662b8836bf`.
- Four-digit Picker input, in-flight dim state, prominent terminal result, current 4-digit exact resolution and Agent 3–4 digit specialist search are in released source.
- D104 batching/guards/ACK/HA/quota invariants remain preserved.
- Remaining gate: OA025 physical field acceptance only. Stable remains OWNER-GATED.
## D107 Web source checkpoint — 2026-09-22

- Web: `D107_PROFESSIONAL_WEB_REFINEMENT__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.
- Admin dashboard/reporting: `D107_RICHER_EXISTING_DATA_OVERVIEW_AND_DETAIL__SOURCE_IMPLEMENTED__PR_GATES_PENDING__FINAL_STABLE_COLUMNS_OWNER_OPEN`.
- UI guard: `D107_PR_GATES_PENDING`.
- Scope is Beta Web source/presentation and existing-data reporting only; no new backend/provider polling or datastore.
- Android and Agent remain unchanged. Stable remains OWNER-GATED and untouched.

## D107 merged-source readiness — 2026-09-22

- Web: `D107_PR_GATES_PASS__MERGED_MAIN_4E733535__BETA_AUTODEPLOY_TRIGGERED__OWNER_VISUAL_REVIEW_PENDING`.
- Admin dashboard/reporting: `D107_RICHER_EXISTING_DATA_MERGED_MAIN__OWNER_VISUAL_REVIEW_PENDING__FINAL_STABLE_COLUMNS_OWNER_OPEN`.
- UI Design Guard: `D107_PR_UI_PASS_RUN_35729564681__MAIN_MERGED`.
- PR #149 authority/state/UI/Web-build/regression gates passed and main is `4e733535ef0abe893681afdf288097767141b115`.
- `Deploy Beta Worker` is configured for `main` changes under `web/**`; the D107 merge satisfies that trigger. Exact main push-run runtime evidence is not exposed by the connected GitHub action surface, so readiness remains Owner-review-pending rather than being mislabeled runtime PASS.
- Stable remains OWNER-GATED and untouched.

## D108 source readiness — 2026-09-23

- SQLite schema: `10`.
- Latest signed Beta APK: `beta-vc63` (D108 next monotonic release pending).
- Web: `D108_PASSWORD_RECOVERY_COLLAPSE__RESOLUTION_SOURCE_ACTOR__SOURCE_IMPLEMENTED__PR_GATES_PENDING`.
- Android: `D108_PICKER_NUMERIC_COMPACT_UI__PER_USER_SCALE__SOURCE_IMPLEMENTED__TARGET_NEXT_MONOTONIC_AFTER_VC63`.
- Backend D108 uses existing `resolution_source` / `resolved_by_user_id` plus bounded user joins and dashboard source aggregation; schema version remains unchanged.
- Web/App source and regression guards are implemented on the D108 branch. Runtime/release PASS is not claimed before PR/main CI and Beta release evidence.
- Stable remains OWNER-GATED and untouched.

## D108 technical/runtime/release PASS — 2026-09-23

- Beta: `D108_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_441F3C68__SIGNED_BETA_VC64__OA028_FIELD_READY`.
- Web: `D108_BETA_RUNTIME_PASS__RECOVERY_COLLAPSED__RESOLUTION_SOURCE_ACTOR__OA028_FIELD_READY`.
- Android: `D108_SIGNED_BETA_VC64__PICKER_DENSE_NUMERIC_UI__PER_USER_SCALE__OA028_FIELD_READY`.
- SQLite schema: `10`; latest signed Beta APK: `beta-vc64`.
- PR #151 PASS/merged; live proof run `35801069626` confirms exact D108 source on Beta with HTTP 200 and storage/schema/binding health PASS.
- Android release tag `beta-vc64` resolves to D108 source. Release-asset checksum metadata is deliberately left unknown where the current connector cannot read it.
- OA028 is field-ready. Stable remains OWNER-GATED and untouched.

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

## D109 Owner-accepted readiness — 2026-09-23

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- Beta: `D109_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_367D518D__SCHEMA11__SIGNED_BETA_VC65`.
- Web: `D109_OWNER_ACCEPTED_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS`.
- Android: `D109_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC65__COMPACT_HEADER_BOTTOM_TABS_TIME_ONLY`.
- Admin dashboard: `D109_OWNER_ACCEPTED_PASS__RESOLVER_ACTIVITY_PER_USER_RANGE`.
- Reporting: `D109_OWNER_ACCEPTED_PASS__DASHBOARD_PREF_RESOLVER_ACTIVITY_AUDIT`.

- Beta Web and signed Android `beta-vc65` are Owner-accepted for D109.
- SQLite source/runtime: `11/11`.
- Live runtime authority: implementation main `367d518d5e76ce5f7c0776ff8f6a3857ef2a9f94` with prior exact-source health PASS.
- Signed APK SHA-256: `3e2b5284ac2ed5d3040c36338a5bdb21026958eda7e4d4a12b40ea9bf6c0ea48`.
- Checkpoint PR #155 merged at `5d3990b5a659225ecd92d4d0281ace23330fc06b`; final Repo Authority/Project State guards and UI Design Guard `35811103699` are PASS.
- OA029 is closed PASS. No D109 Owner action remains.
- Ready for the Owner's next requirement. Stable remains OWNER-GATED and untouched.

## D110 source readiness checkpoint — 2026-09-23

- SQLite schema remains `11`.
- Latest released Beta APK remains `beta-vc65` until D110 main release completes.
- Web baseline remains `D109_OWNER_ACCEPTED_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS`.
- Android source status is `D110_REPORTER_PINNED_4TABS_BADGES_DIRECT_ACTION_LOCAL_MINUTE_SLA__RELEASE_PENDING`.
- D110 changes Android Reporter presentation/interaction and Android client-role admission only; no Stable resource mutation is authorized.
- Beta Worker source adds authoritative history-state totals to the existing Reporter recent response and server-side ADMIN/ROOT Android denial. No new polling endpoint/provider is introduced.

## D110 technical/runtime/release PASS — 2026-09-23

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA030 FIELD READY**.

- Beta: `D110_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_E7931CF8__SCHEMA11__SIGNED_BETA_VC66__OA030_FIELD_READY`.
- Web: `D109_OWNER_ACCEPTED_PASS__PER_USER_DASHBOARD_GLOBAL_SLA_AUDIT_PDA_TOOLS`.
- Android: `D110_SIGNED_BETA_VC66__REPORTER_PINNED_4TABS_BADGES_DIRECT_ACTION_LOCAL_MINUTE_SLA__OA030_FIELD_READY`.
- SQLite source/runtime: `11/11`; Operational V2: `5/5`.
- Main source `e7931cf892978332960e63d9a17dffe454ac1c43`; Worker run `35816313928` exact-source health PASS on attempt 1.
- Main Repo Authority/Project State/UI/Android runs `35816314068/35816313998/35816313994/35816313946` PASS.
- Signed `beta-vc66` release id `394288616`; APK asset id `582908040`; size `19018752`; SHA-256 `715612464d7fd4ead1036959ce70b4fb8cf281e38566aa214a428fbebbf32328`.
- Android Reporter uses local calibrated minute ticking with zero timer-generated service/provider requests.
- OA030 is field-ready. Stable remains OWNER-GATED and untouched.

## D110 Owner field PASS — 2026-09-23

- OA030 is closed as `PASS_OWNER_CONFIRMED_D110`.
- Signed `beta-vc66` is the Owner-accepted D110 Android baseline.
- D111 may supersede only its explicit Reporter UI/action/display-scope details. Stable remains OWNER-GATED.

## D111 source readiness — 2026-09-23

Status: **SOURCE IMPLEMENTED — PR/RUNTIME/RELEASE PASS PENDING**.

- Beta source status: `D111_SOURCE_IMPLEMENTED__D110_OWNER_ACCEPTED__SCHEMA11__PR_GATES_RELEASE_PENDING`.
- Android source status: `D111_REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE__SOURCE_IMPLEMENTED__TARGET_NEXT_AFTER_VC66`.
- InventoryCore schema remains `11/11`, Operational V2 schema remains `5/5`; D111 requires no schema change.
- Existing Android API reconciliation requests add only `scope=APP_TODAY_OPEN`; the Worker/core applies Asia/Ho_Chi_Minh today-plus-unresolved SQL projection before bounded LIMIT.
- Reporter local minute ticker remains zero-network. No new provider polling/listener/cadence is introduced.
- Current signed release remains `beta-vc66` pending D111 main merge and the next monotonic signed Beta release.
- OA031 is not field-ready until PR/main guards, exact Beta runtime and signed APK publication pass.
- Stable remains OWNER-GATED and untouched.

## D111 technical/runtime/release PASS — 2026-09-23

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA031 FIELD READY**.

- Beta: `D111_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_8E08BEAD__SCHEMA11__SIGNED_BETA_VC67__OA031_FIELD_READY`.
- Android: `D111_SIGNED_BETA_VC67__REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE__OA031_FIELD_READY`.
- SQLite source/runtime remains `11/11`; Operational V2 remains `5/5`.
- Main source `8e08bead67b34f8302185d0d4ff259ddd5fae857`; exact-source Beta Worker health PASS on attempt 2.
- Main Repo Authority/Project State/UI/Worker/Android runs `35819012567/35819012547/35819012526/35819012562/35819012653` PASS.
- Signed `beta-vc67` release id `394302425`; APK asset id `582970502`; size `19019076`; SHA-256 `0ea00d861d38e6f4cdd22c76120707b9f730b2c990da0ee834e3072d81318edc`.
- OA031 is field-ready. Stable remains OWNER-GATED and untouched.

## D111 Owner-accepted readiness — 2026-09-23

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- OA031 is closed as `PASS_OWNER_CONFIRMED_D111`.
- Beta: `D111_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_8E08BEAD__SCHEMA11__SIGNED_BETA_VC67`.
- Android: `D111_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC67__REPORTER_SCALE_BADGE_CONFIRM_DAILY_SCOPE`.
- SQLite/runtime remains `11/11`; Operational V2 remains `5/5`.
- Signed `beta-vc67` remains the accepted Android Beta release; no further D111 field gate remains.
- No new polling/provider cadence was introduced; Web historical behavior remains unchanged.
- Ready for the next explicit Owner requirement after mandatory authority bootstrap.
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

## D112 Owner-accepted readiness — 2026-09-23

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- OA032 is closed as `PASS_OWNER_CONFIRMED_D112`.
- Beta: `D112_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_92AFF2FD__SCHEMA11__SIGNED_BETA_VC68__AGENT_V31`.
- Web: `D112_OWNER_ACCEPTED_PASS__TOOLS_RELEASE_CHANNEL_PRESETS_NONBLOCKING_REPORT_NOTICE_90D_RETENTION`.
- Android: `D112_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC68__UPDATE_CHANNEL_INSETS_LOGIN_INPUT_CLEANUP`.
- Web: `D112_OWNER_ACCEPTED_PASS__TOOLS_RELEASE_CHANNEL_PRESETS_REPORT_NOTICE_90D_RETENTION`.
- Android: `D112_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC68__UPDATE_CHANNEL_INSETS_LOGIN_INPUT_CLEANUP`.
- Agent: `relay-agent-v31` is Owner field-accepted.
- SQLite/runtime remains `11/11`; Operational V2 remains `5/5`.
- D097/D104/D105 quota, Firestore/WMS and no-offline invariants remain authoritative.
- Ready for the next explicit Owner requirement after mandatory authority bootstrap.
- Stable remains OWNER-GATED and untouched.

## D113 source readiness — 2026-09-24

Status: **SOURCE IMPLEMENTED / PR GATES PENDING**.

- Current accepted live baseline remains D112 with SQLite `11/11`, signed `beta-vc68` and `relay-agent-v31`.
- D113 requires no SQLite schema change and no new provider resource.
- SLA app-config JSON is extended compatibly with enable flags and the first-report-based Skip-correction window; legacy rows default warning/escalation/correction enabled with correction window 5 minutes.
- Web/Android/Agent presentation refinements are source-implemented on `feat/d113-web-android-agent-refinements`.
- Target releases: next monotonic signed Beta Android after `beta-vc68`, and `relay-agent-v32`.
- OA033 remains pending technical/runtime/release PASS. Stable remains OWNER-GATED and untouched.

## D113 technical/runtime/release PASS — 2026-09-24

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA033 FIELD READY**.

- Main implementation source: `7dcc76aba6b0b2774208b151ca587aa2a2b09931`.
- Main Repo Authority/Project State/UI/Beta Worker/Android/Agent runs `35933061054/35933061086/35933061098/35933061039/35933061049/35933061088` all PASS.
- Live Beta health attempt 2 is exact source with storage ready, SQLite `11/11`, Operational V2 `5/5`, missing bindings 0 and Agent migration `0/0`.
- Signed `beta-vc69`: release id `395136931`, APK asset `584751944`, size `19019800`, SHA-256 `f6b1f6e8866358b270bb5781958e6a0a05d54fbc65f446c6dc3ae5e0b9ef07c0`.
- `relay-agent-v32`: release id `395136705`, EXE asset `584751479`, size `287744`, SHA-256 `e6b838377931fd804bf4dc7de7b02577010244041867975e301fd42b9d35e80c`.
- Fixed `inventory-channel` contains refreshed D113 PDA/Agent manifests and binaries.
- OA033 is field-ready. Stable remains OWNER-GATED and untouched.

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

## D118 source readiness checkpoint — 2026-09-24

- SQLite schema: `11`.
- Latest signed Beta APK remains `beta-vc73` until D118 release publication.
- Web: `D118_CANDIDATE__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL__D117_LIVE_UNTIL_RELEASE`.
- Android: `D118_BETA_VC74_CANDIDATE__IME_ADJUST_RESIZE__D117_VC73_LIVE_UNTIL_RELEASE`.
- Agent target: `relay-agent-v38`.
- D118 source implements fleet-wide single-decision overtime CAS, real bounded pagination, revision-safe global SLA, detailed multi-sheet Excel, Agent footer credit and Android IME resize.
- D117 live runtime remains authoritative until D118 PR/main/runtime/release gates pass.
- Stable remains OWNER-GATED and untouched.

## D118 technical/runtime/release PASS — 2026-09-25

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OA038 FIELD READY**.

- Main source: `d29237c0990eb677ddef726785a88e08bce88dce`.
- Beta: `D118_TECHNICAL_RUNTIME_RELEASE_PASS__LIVE_SOURCE_D29237C0__SCHEMA11__SIGNED_BETA_VC74__AGENT_V38__OA038_FIELD_READY`.
- Web: `D118_BETA_RUNTIME_PASS__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL__OA038_FIELD_READY`.
- Android: `D118_SIGNED_BETA_VC74__IME_ADJUST_RESIZE__PICKER_TABS_ABOVE_KEYBOARD__OA038_FIELD_READY`.
- Signed Android `beta-vc74`; released Agent `relay-agent-v38`; fixed inventory channel updated to both.
- Main runs PASS: Authority `36064078289`, State `36064078114`, UI `36064078112`, Worker `36064078233`, Android `36064078150`, Agent `36064078151`.
- Live health attempt 1: HTTP 200, exact source, SQLite 11/11, Operational V2 5/5, missing 0, Agent migration 0/0.
- OA038 is field-ready; Owner acceptance is still pending.
- Stable remains OWNER-GATED and untouched.

## D118 Owner-accepted readiness — 2026-09-25

Status: **TECHNICAL / RUNTIME / RELEASE / OWNER FIELD PASS**.

- OA038 is closed as `PASS_OWNER_CONFIRMED_D118`.
- Beta: `D118_OWNER_FIELD_ACCEPTED_PASS__LIVE_SOURCE_D29237C0__SCHEMA11__SIGNED_BETA_VC74__AGENT_V38`.
- Web: `D118_OWNER_ACCEPTED_PASS__PAGED_HISTORY_SKU_LOGS__REVISION_SAFE_SLA__DETAILED_EXCEL`.
- Android: `D118_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC74__IME_ADJUST_RESIZE__PICKER_TABS_ABOVE_KEYBOARD`.
- Signed Android `beta-vc74` and `relay-agent-v38` are the accepted Beta artifacts.
- SQLite/runtime remains `11/11`; Operational V2 remains `5/5`.
- Ready for the next explicit Owner requirement after mandatory authority bootstrap.
- Stable remains OWNER-GATED and untouched.

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

## D134 current candidate — 2026-09-28

- Baseline released artifacts remain `relay-agent-v73` and signed `beta-vc79` until D134 gates publish replacements.
- Target Agent is `relay-agent-v74`; Android target is the next monotonic signed Beta release.
- Owner has approved D134 implementation after D133 field defects. OA059 is superseded; OA060 becomes field-ready only after technical/runtime/release PASS.
- Candidate architecture: explicit Android session authority, generation-fenced Kick User, reusable 60-second specialist call, compact all-Agent Firestore listener, PRIMARY 5-minute reconciliation, 10-Agent fleet cap and 45k/day read soft target.
- Agent Usage is a server-produced 10-minute Firestore snapshot; Office Agent no longer requires Worker-domain reachability to render Usage.
- No new provider resource is introduced. Stable remains OWNER-GATED.

## D134 release checkpoint — 2026-09-28

- D134 implementation PR #266 merged to main `8b703f12ec6f1667e43dab101114f2fbcc1a8819`.
- Beta Worker health proves exact source, SQLite `12/12`, Operational V2 `5/5`, missing bindings `0` and Agent migration `0/0`.
- Firestore Rules deploy/readback and the four required notification/active-call Functions deployments PASS.
- Released Agent: `relay-agent-v74`; released signed Android: `beta-vc80`.
- Distribution channel has been refreshed to the v74/vc80 artifacts.
- OA060 is READY_FOR_OWNER_FIELD_TEST for Usage, balanced Auto size, truthful Firestore health, reusable 60-second call, Login/Logout/PickList presence authority, Kick User generation fencing and Agent password gates.
- Stable remains OWNER-GATED and untouched.

## D135 candidate — 2026-09-28
- Canonical Android source marker: `D135_TARGET_BETA_VC82__1291_BAO_HANG_BETA__LOCAL_FIRST_RESULT_ACK_ALL_SURFACES`.

- Baseline field-passed D134 hotfix artifacts are `relay-agent-v75` and signed `beta-vc81`.
- D135 target Agent is `relay-agent-v76`; Android target is the next monotonic signed Beta release after vc81.
- No new Worker, Firestore, Functions, Firebase or Cloudflare resource is required.
- Processing-Agent counter immediacy uses only the terminal result already known after the existing durable ACK/daily-summary atomic commit; there is no new counter read/listener/write/poll.
- WMS lookup acceleration is local DOM observation only and retains one semantic search click plus exact-row/checkbox/dialog fail-closed guards.
- Báo hàng result surfaces must dismiss local-first even during network loss or session revocation, with pending ACK metadata retried later.
- OA061 becomes field-ready only after D135 PR gates, main gates and v76/signed-Android release evidence pass.
- Stable remains OWNER-GATED and untouched.

## D135 release checkpoint — 2026-09-28
- Canonical release marker: `D135_TECHNICAL_RUNTIME_RELEASE_PASS__MAIN_6D929E42__AGENT_V76__BETA_VC82__OA061_FIELD_READY`.
- Canonical release marker: `D135_SIGNED_BETA_VC82__1291_BAO_HANG_BETA__LOCAL_FIRST_RESULT_ACK_ALL_SURFACES__OA061_FIELD_READY`.

- PR #270 merged to main `6d929e42fa2474712e0629a95bb5ac9cf59112bd`.
- Released Agent: `relay-agent-v76`; released signed Android: `beta-vc82` with visible name **1291 Báo hàng Beta**.
- Main Authority/State/UI/Worker/Android/Agent/Dashboard gates PASS.
- Runtime health is exact-source PASS with SQLite `12/12`, Operational V2 `5/5`, Agent migration `0/0`.
- Inventory distribution channel now points to Agent v76 and Android vc82.
- OA061 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER-GATED and untouched.

## D136 candidate — 2026-09-28

- Canonical Android marker: `D135_OWNER_FIELD_PASS__SIGNED_BETA_VC82__1291_BAO_HANG_BETA`.
- D135 is Owner field PASS on Agent v76 / Android vc82.
- D136 target is Agent v77 plus a Beta Worker deploy; Android stays `beta-vc82`.
- Manual PickList UI must preserve code/action/status simultaneously across sizing modes.
- Provider Usage runtime is intentionally retired: no scheduled Google Monitoring Usage collection and no periodic `usage_current` write for the removed UI. Local quota reference guard remains.
- Web Confirm hide-to-background is no-password; protected show/stop/logout/switch actions remain.
- No new provider resource. Stable remains OWNER-GATED.

## D136 release checkpoint — 2026-09-28

- PR #272 merged to `main` `62ab2aa11cda251f18090fc0bd637a092ab0998d`.
- `relay-agent-v77` is published and the inventory channel points to the v77 Agent asset. Android remains `beta-vc82`.
- Worker deploy and exact-source health PASS; Usage polling/publication runtime is retired.
- Main authority, continuity, UI and Agent gates PASS.
- OA062 is READY_FOR_OWNER_FIELD_TEST. Stable remains OWNER-GATED and untouched.

## D137 candidate — 2026-09-28

- D136 is Owner field PASS on released `relay-agent-v77`.
- D137 targets `relay-agent-v78`; Android remains `beta-vc82`; WebView2 host build 10 is reused.
- Normal-window PickList UI reserves a minimum actionable grid height and recalculates grid/status bounds from the current card size.
- Confirm readiness requires one normal top-level reload after first Confirm arrival and a stable post-reload DOM before READY/search/confirmation.
- No new provider resource or cadence is introduced. DevTools Network/session capture/direct WMS API remain forbidden.
- OA063 opens after D137 technical/release PASS. Stable remains OWNER-GATED.

## D137 v79 hotfix candidate — 2026-09-28

- v78 physical field result is partial: PickList UI PASS, Confirm first-load data hydration FAIL.
- v79 is Agent-only and reuses the existing WebView2 host/runtime and Beta distribution channel.
- Final Confirm must settle 3s before normal reload; post-reload DOM must remain ready 1.2s before READY.
- One empty-table self-heal reload/search retry is permitted only when the first search sees zero PickList codes; no loop and no Firestore/Worker/provider operation is added.
- OA063 remains blocked until v79 technical/release PASS. Android beta-vc82 and Stable are unchanged.

## D137 v79 release — 2026-09-28

- Agent v79 technical/release pipeline PASS from exact main `b177ef0f9169b051fe90349460c1c3e2d7a07663`.
- GitHub prerelease `relay-agent-v79` is published and inventory-channel updated to the same EXE.
- Release EXE SHA-256: `e88108a53ff5def868c7ca036318fcac5a2ba19da2fe426fddb1983fa1056d23`.
- OA063 is READY_FOR_OWNER_FIELD_TEST for real first-session Confirm hydration without operator F5.
- Android beta-vc82 and Stable are unchanged.


## D138 SLA realtime repair candidate — 2026-09-28

- Scope: Beta Web SLA form only.
- Root cause confirmed in source: dirty `loadSla()` refresh was followed by generic active-section rerender from the previous `slaResponse`.
- Candidate fix makes `loadSla()` the sole SLA render authority during reconcile; dirty edits survive realtime events.
- Existing optimistic policy-version check and save-response/post-save-GET mode verification remain unchanged.
- No provider, schema, Android or Agent changes. D137 OA063 remains independently field-ready. Stable remains OWNER-GATED.
- OA064 is blocked until PR gates and exact-source Beta deployment PASS.

- Canonical Web marker: `D138_SOURCE_CANDIDATE__SLA_DIRTY_FORM_REALTIME_RECONCILE_PRESERVATION`.


## D138 runtime PASS — 2026-09-28

- PR #277 merged to main `005d829811ddfa534f0552cd808d69e12c5cf763`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web deploy run `36408876240` PASS under the exact-source runtime health workflow.
- Web marker: `D138_RUNTIME_PASS_MAIN_005D8298__SLA_DIRTY_FORM_REALTIME_PRESERVATION__OA064_FIELD_READY`.
- OA064 is READY_FOR_OWNER_FIELD_TEST. D137 OA063 remains independently open.
- Android remains `beta-vc82`; Agent remains `relay-agent-v79`; Stable remains OWNER-GATED.


## D139 SLA hotfix candidate — 2026-09-28

- D138 live field test failed: FIRST_REPORT did not persist after Save + browser refresh.
- Candidate fix protects a dirty SLA form at the common active-section patch boundary and submits the explicitly checked mode.
- Existing optimistic policy-version and server roundtrip verification remain.
- No schema/provider/Android/Agent change.
- OA065 blocked until PR/main/runtime gates PASS. D137 OA063 remains independently open. Stable remains OWNER-GATED.
- Web marker: `D139_SOURCE_CANDIDATE__GLOBAL_DIRTY_SLA_FORM_RERENDER_GUARD`.


## D139 runtime PASS — 2026-09-28

- PR #279 merged to main `219469840a9ece147441b1ef9a0db8242109e5a7`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web deploy run `36414388456` PASS, including service typecheck, Worker/Web assets/Durable Object deploy, Beta health/schema/auth/business/Web-shell/OAuth verification.
- Web marker: `D139_RUNTIME_PASS_MAIN_21946984__GLOBAL_DIRTY_SLA_FORM_RERENDER_GUARD__OA065_FIELD_READY`.
- OA065 is READY_FOR_OWNER_FIELD_TEST for FIRST_REPORT save + browser-reload persistence.
- D138 is field-failed and superseded by D139. D137 OA063 remains independently open.
- Android remains `beta-vc82`; Agent remains `relay-agent-v79`; Stable remains OWNER-GATED.

## D140 Agent Firestore listener storm candidate — 2026-09-28

- Target Agent: `relay-agent-v80`; Android remains `beta-vc82`.
- Candidate adds Firestore streaming routing metadata, accepted-response-gated backoff reset, 5-minute permanent-error circuit, 2s→60s transient retry, HA-trio-only compact listeners and unchanged-state PATCH suppression.
- CI must pass v80 build, packaged gRPC native smoke, D140 sync-safety self-test and source guards before main publication.
- OA066 remains blocked until v80 is released and the Owner completes a 30–60 minute multi-Agent soak with no reconnect storm and normalized Firestore usage.
- No new provider resource; Stable remains OWNER-GATED.



## D141 SLA end-to-end persistence candidate — 2026-09-28

- D139 live field test failed with a contradictory SLA control/server label after reload.
- Root UI defect found: generic `restoreUiContext()` replayed SLA form values after authoritative rendering.
- D141 introduces explicit server/draft state, excludes SLA controls from generic context restoration, and uses a dedicated non-droppable Save single-flight.
- InventoryCore PUT performs post-write SQLite full-policy readback. Web requires both the readback proof and a fresh no-cache GET matching requested mode/version before success.
- Failures expose requested versus current server mode without secret/session data.
- No schema/provider/Android/Agent changes. D140 remains parallel. Stable remains OWNER-GATED.
- OA067 blocked pending PR/main/exact-source Beta runtime PASS.

- Canonical Web marker: `D141_SOURCE_CANDIDATE__SLA_SERVER_DRAFT_SPLIT__SQLITE_READBACK__NON_DROPPABLE_SAVE`.


## D141 runtime PASS — 2026-09-28

- PR #282 merged to main `966b6d1f561768551969694065b1035bb2e2b234`.
- Main Repo Authority, Project State, UI Design, Beta Worker and Dashboard Probe gates PASS.
- Beta Worker/Web exact-source deploy run `36421277405` PASS.
- D141 now separates server-applied SLA authority from browser draft state, uses a dedicated non-droppable save path, verifies SQLite readback before server success, and requires a fresh no-cache GET match before Web success.
- Web marker: `D141_RUNTIME_PASS_MAIN_966B6D1F__SLA_SERVER_DRAFT_SPLIT__SQLITE_READBACK__NON_DROPPABLE_SAVE__OA067_FIELD_READY`.
- OA067 is READY_FOR_OWNER_FIELD_TEST. D140 Agent v80 remains parallel. D137 OA063 remains independently open.
- Android unchanged; Stable remains OWNER-GATED.

## D142 Android 11 critical-alert candidate — 2026-09-28
- Canonical Android marker: `D142_SOURCE_CANDIDATE__ANDROID11_MT90_DT50_CRITICAL_ALERT_READINESS__NEXT_SIGNED_BETA_AFTER_VC82`.

- Scope: Beta Android only; supported warehouse targets are Newland NLS-MT90 Android 11 and Urovo DT50 Android 11.
- Current released baseline remains signed `beta-vc82` until D142 main/release gates publish the next monotonic APK.
- Candidate readiness gate is local/event-driven: notifications + overlay + DND policy + battery exemption + critical channel HIGH/DND-bypass must pass before login/business use.
- Missing requirements expose direct/closest Android Settings actions and concise guidance; returning from Settings automatically rechecks. There is no manual check/test-alert step.
- Critical delivery retains existing data-only FCM HIGH and D133/D135 overlay/local-first ACK; Android 11 full-screen wake is bounded and adds no persistent wake lock or alert polling.
- OA068 is blocked pending D142 technical/release PASS. D141/D140 parallel workstreams are unchanged. No new provider resource; Stable remains OWNER-GATED.

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
## D145 public OAuth pages — source candidate — 2026-09-29

- Web marker: `D145_OAUTH_PUBLIC_PAGES_SOURCE_READY__D144_RUNTIME_BASELINE_PASS`.
- Existing D144 Beta/Android/Agent status remains unchanged: `D144_TECHNICAL_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC85__AGENT_V82__OA071_FIELD_READY`, `beta-vc85`, Agent v82.
- Beta Worker source exposes public no-auth GET/HEAD routes `/about`, `/privacy`, `/terms` on the existing custom domain.
- About describes SUPRA Inventory Beta and exact `drive.file` + `gmail.send` purposes. Privacy covers access/use/storage/sharing, revocation and Google Limited Use. Terms covers authorized application use.
- Web login/reset/authenticated footer links to the three public surfaces.
- Deploy workflow includes runtime HTTP/content probes. OA073 stays blocked until the main Beta deploy proves all three URLs live.
- No new resource or secret is introduced. Stable remains OWNER-GATED and untouched.
## D145 technical/runtime PASS — 2026-09-29

- Web marker: `D145_OAUTH_PUBLIC_PAGES_RUNTIME_PASS__OA073_GOOGLE_PUBLISH_READY`.
- PR #292 merged to main `5e11a0941bdc94272246cf745bd3d4d53d9824b5`.
- Repo Authority `36482437090`, Project State `36482437070`, Beta Worker `36482436903`, UI Design `36482436949` and Dashboard Probe `36482436885` all PASS.
- The Beta deploy's dedicated OAuth-page probe confirms public HTTP 200 for About/Privacy/Terms and validates the required app identity, exact `drive.file` + `gmail.send` disclosure, Google API Services User Data Policy/Limited Use disclosure, existing health gates and OAuth start route.
- OA073 is READY_FOR_OWNER_GOOGLE_PUBLISH; no source/runtime blocker remains for entering the URLs in Google Auth Platform.
- Existing D144 Android/Agent releases remain unchanged. Stable remains OWNER-GATED and untouched.
## D146 source candidate — 2026-09-29

- Baseline main: `b4d935f93b12f531e4a2cca424db45eb2011cd65`.
- Branch: `feat/d146-runtime-log-sku-rbac-agent-input`.
- Target Agent: `relay-agent-v83`; target Android: next monotonic signed Beta after `beta-vc85`.
- Beta OAuth: Owner-confirmed **In production**, refresh token re-consented/deployed, former Testing 7-day expiry condition removed, transactional Gmail send field PASS. Drive runtime revalidation is included in D146.
- Web/Android logs: InventoryCore primary + immediate Drive attempt + bounded deferred retry; schedule 06/12/18/21 HCM; error/crash immediate; typed filenames.
- Agent logs: direct first hop to Google Firestore, Beta Google Function assembles and uploads payload to Drive through a protected short-lived resumable session broker; no OAuth/Drive secret on laptop; Worker drain is bounded fallback.
- SKU import: realtime `sku_catalog_updated` + silent FCM invalidation causes PDA local cache sync without relogin.
- Managed-user deletion: effective ROOT + base ROOT required at UI/API/Core.
- Agent protected password/browser-action inputs: periodic UI timer isolation and focus guard.
- Status: source implemented; PR/runtime/release evidence pending. Stable remains OWNER-GATED and untouched.


## D146 source candidate

- Web: `D146_SOURCE_CANDIDATE__LOG_DRIVE_RETRY__SKU_PDA_PUSH__TRUE_ROOT_DELETE_GUARD`
- Android: `D146_SOURCE_CANDIDATE__NEXT_AFTER_VC85__LIVE_SKU_REFRESH__06_12_18_21_LOGS`
- Latest Beta APK: `beta-vc85`
- SQLite schema: `14`


## D146 Owner-accepted Beta baseline — 2026-09-29
- Beta: `D146_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC86__AGENT_V83__FINAL_HOTFIX_MAIN_D7E0CB94`.
- Web: `D146_OWNER_FIELD_PASS__LOG_DRIVE_RETRY__SKU_PDA_PUSH__TRUE_ROOT_DELETE_GUARD`.
- Android: `D146_OWNER_FIELD_PASS__SIGNED_BETA_VC86__LIVE_SKU_REFRESH__06_12_18_21_LOGS`.
- Latest Beta APK: `beta-vc86`.
- SQLite schema remains `14`.
- Owner explicitly confirmed D146 done/PASS; OA073 and OA074 are closed. Stable remains OWNER-GATED and untouched.

## D147 Owner-accepted governance baseline — 2026-09-29
- Governance: `D147_OWNER_ACCEPTED_PASS__SERIAL_OWNER_PASS_GATE`.
- D147 is governance-only; no service/runtime/provider/schema/quota mutation was made.
- Runtime service readiness therefore remains the D146 Owner-accepted Beta baseline.
- No project change is currently open; the next base-affecting mutation requires pre-implementation impact review and explicit Owner approval.
- Stable remains OWNER-GATED and untouched.

## D148 source candidate — 2026-09-29
- Baseline accepted change: D147; runtime foundation remains D146.
- Branch: `feat/d148`.
- Web: zero→positive pending badge recreation and client-side shift comparison workbook.
- Android: existing FCM `report_created` adaptive overlay for Reporter/Admin; priority/FIFO one-at-a-time overlay queue; clearer PickList lock copy; periodic PDA INFO uploads retired in favor of session-end INFO plus existing error/crash/manual paths.
- Worker metadata reflects 06/12/18/21 scheduled policy for Web/Agent and Android session-end INFO policy.
- No Agent, overtime authority, schema, new provider resource or Stable change.
- OA076 remains blocked until technical/runtime/release PASS.

## D148 technical/runtime/release PASS — 2026-09-29
- PR #300 merged main `fe893db1d80e417021defdad92d85947c37abd82`.
- Main Repo Authority `36510191993`, continuity `36510191987`, Beta deploy `36510192034`, Android `36510192008`, legacy operational `36510192016`, and build-probe `36510192021` passed.
- Live Beta Web/Worker probes passed.
- Signed Android `beta-vc87` release id `398763774`; APK asset `596952438`; size 19,102,276 bytes; SHA-256 `41e5d499e2c38a703aa4b58a1408963031dbacdb9b11f885650a325a4d0147f2`.
- Fixed PDA distribution channel points to the same APK. Agent remains v83.
- No new resource/schema/polling/Agent/overtime-unification/Stable mutation.
- OA076 is field-ready. D148 is **not** Owner-accepted yet; D147 remains the accepted base.

Derived current-status markers:
- `D148_TECHNICAL_RUNTIME_PASS__PENDING_BADGE_RECREATE__SHIFT_COMPARISON_EXCEL`
- `D148_TECHNICAL_RELEASE_PASS__SIGNED_BETA_VC87__REPORT_CREATED_OVERLAY_QUEUE__SESSION_END_INFO_LOGS`

## D148 Owner-accepted Beta baseline — 2026-09-29
- Beta: `D148_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC87__AGENT_V83_UNCHANGED`.
- Web: pending badge recreation + client-side shift-comparison export field PASS.
- Android: signed `beta-vc87` report-created adaptive overlay, priority/FIFO one-at-a-time alerts, PickList messaging and session-end INFO logging field PASS.
- Agent: `relay-agent-v83` unchanged.
- No new provider resource, schema or polling loop was introduced by D148.
- OA076 is closed; D148 is the accepted base. Stable remains OWNER-GATED.

Derived current-status markers:
- `D148_OWNER_FIELD_PASS__PENDING_BADGE_RECREATE__SHIFT_COMPARISON_EXCEL`
- `D148_OWNER_FIELD_PASS__SIGNED_BETA_VC87__REPORT_CREATED_OVERLAY_QUEUE__SESSION_END_INFO_LOGS`

## D149 technical/runtime/release PASS — Owner field pending — 2026-09-29
- Accepted base remains **D148** until explicit Owner PASS on D149.
- Implementation PR #303 merged to main `c03f54861e5fbb6ff093b129e9b76e303475c358`.
- Live Beta Worker/Web exact-source deploy and health PASS; SQLite schema remains `14`.
- Signed Android: `beta-vc88`, exact source `c03f54861e5fbb6ff093b129e9b76e303475c358`, APK SHA-256 `0ce70330c2a829129f76902f4705975e260e5dd40c90f5328ada85c5e842c057`.
- Agent: `relay-agent-v84`, exact source `c03f54861e5fbb6ff093b129e9b76e303475c358`, EXE SHA-256 `af2d169e84d1c433f4c495cb8795e15afddc702800151dc871eb2e5454cd95f9`.
- D149 scope now technical/runtime/release PASS: bounded Web recent-result ranges; Android resolver/product/role attribution; configurable Agent Web storage move with close/verify/reopen/rollback; shared 06:00–22:00 schedule with 05:00 early-start and 22:00–05:00 bounded overtime; PickList Today aggregate UI removed while durable counters remain.
- OA077: **READY_FOR_OWNER_FIELD_TEST**. Technical PASS does not promote D149 to accepted base.
- Stable remains OWNER-GATED and untouched.

Derived current-status markers:
- `D149_TECHNICAL_RUNTIME_PASS__RECENT_RANGE__READ_ONLY_UNIFIED_SHIFT_STATE__MAIN_C03F5486`
- `D149_TECHNICAL_RELEASE_PASS__SIGNED_BETA_VC88__UNIFIED_SCHEDULE_CACHE_FCM__RESOLVER_ATTRIBUTION`
- Latest Beta APK: `beta-vc88`
- SQLite schema: `14`

## D149 Owner-accepted Beta baseline — 2026-09-29
- Owner explicitly confirmed **D149 PASS**; OA077 is closed.
- Accepted base is now **D149**.
- Runtime/release evidence remains PR #303 → main `c03f54861e5fbb6ff093b129e9b76e303475c358`.
- Web/Worker: D149 bounded recent-range and shared schedule state accepted; SQLite schema remains `14`.
- Android: signed `beta-vc88` unified schedule recovery + resolver attribution accepted.
- Agent: `relay-agent-v84` unified schedule + managed-Web storage relocation accepted.
- No new provider/resource/schema/polling loop is introduced by this Owner acceptance record.
- Stable remains OWNER-GATED and untouched.

Derived current-status markers:
- `D149_OWNER_FIELD_PASS__RECENT_RANGE__READ_ONLY_UNIFIED_SHIFT_STATE__MAIN_C03F5486`
- `D149_OWNER_FIELD_PASS__SIGNED_BETA_VC88__UNIFIED_SCHEDULE_CACHE_FCM__RESOLVER_ATTRIBUTION`
- Latest Beta APK: `beta-vc88`
- Agent: `relay-agent-v84`
- SQLite schema: `14`

## D150 Owner acceptance — PASS — 2026-09-29
- Accepted base is **D150** after explicit Owner PASS; OA078 is closed.
- D150 implementation PR #306 merged to main `c9d42c701f66283f447aad4f24c8f9043db17e37`.
- Beta Worker/Web exact-source health PASS; SQLite schema remains `14`.
- Firestore Rules deploy/readback PASS; Beta Functions deploy PASS.
- Agent: **relay-agent-v85**, exact source `c9d42c701f66283f447aad4f24c8f9043db17e37`, EXE SHA-256 `d1e7d89c431c8641591ce71e8e55b872bd4511c1cadf07bae24fce3c0005e080`; fixed Agent channel refreshed.
- Android: compatibility build PASS with no release required; signed **beta-vc88** remains the installed Beta release.
- D150 preserves 3s/15s/1s confirmation cadence, 10s lease and 15s failover; quota hardening removes historical/broad coordination scans and bounds support-log amplification.
- Manual **Chuyển Agent chính** is limited to `tamnv2`/`admin`, readiness-gated and CAS/new-generation fenced.
- OA078 is **PASS / CLOSED** after explicit Owner field acceptance.
- No new provider/collection/secret or Stable mutation.

Derived current-status markers:
- `D150_OWNER_FIELD_ACCEPTED_PASS__FILTERED_COORDINATION__LOG_STORM_GUARDS__MAIN_C9D42C70`
- `D150_OWNER_FIELD_ACCEPTED_PASS__AGENT_V85__ANDROID_VC88_UNCHANGED__OA078_CLOSED`
- Latest Beta APK: `beta-vc88`
- Agent: `relay-agent-v85`
- SQLite schema: `14`

## D151 MT90 DND diagnostic technical/runtime/build PASS — 2026-09-29

- Accepted business base remains **D150 Owner PASS**. D151 is diagnostic-only and awaits OA079 physical comparison; it is not yet Owner-accepted.
- Implementation PR #309 merged to `main` at `a7ac9315f51d868118ec6399184f8507e1f2c765`.
- Beta Worker deploy/health run `36544445299` PASS with exact source commit, HTTP 200, SQLite 14/14 and Operational V2 5/5.
- Standalone diagnostic APK build run `36544445475` PASS; artifact `mt90-dnd-diagnostic-apk` / id `11022311454`; APK size 2,529,134 bytes; SHA-256 `4c62afef28251e99a90bcd7ac69fc0f5beba70d08dc181e9b61056ffbf5d6ed4`.
- Repo Authority `36544445390`, Project State `36544445430`, UI/Worker regression `36544445238` and dashboard probe `36544445230` PASS.
- Production Android stays `beta-vc88`; no production Android release was created. Stable is untouched/OWNER-GATED.
- OA079 is READY: install the same diagnostic APK on one normal MT90 and one failing MT90, then send one DND diagnostic log from each.



## D151 revised MT90 DND detail / overlay probe technical PASS — 2026-09-29

- D151 remains the only open change; accepted business base remains D150 Owner PASS.
- Diagnostic-only implementation PR #311 squash-merged to main `eaead3f239e559f7df67feb2923e76bd595af527`.
- Main Build DND Diagnostic APK run `36550631691` PASS.
- Main artifact `mt90-dnd-diagnostic-apk` id `11024960495`; APK size `2,540,306` bytes; SHA-256 `168538b7dfe0c1a6f4d4c2dd5ae9dfd0dc0c12e19b1e33380282fef0f816d67a`.
- Main Repo Authority `36550631550`, Project State `36550631522`, D127 Dashboard Probe `36550631616` and UI Design / operational regression `36550631636` all PASS.
- Revised standalone diagnostic APK adds the package-specific DND detail Settings route with safe fallback plus a bounded local 15-second `TYPE_APPLICATION_OVERLAY` probe.
- Production signed Android remains `beta-vc88`; Agent/Web business runtime and Stable are unchanged. No provider, collection, schema, secret, polling, listener or scheduled traffic was added.
- OA079 is READY for one failing MT90 V8.01.002: try package-detail DND, run overlay probe, then send one manual diagnostic log and report the visual overlay result.


## D151 adaptive Android alert technical/runtime/release PASS — 2026-09-29

- PR #313 merged to main `44606b738b34b3ea216d4db14ab4a3af166f162c`.
- Main Repo Authority `36556013115`, Project State `36556013183`, D127 Dashboard Probe `36556013445`, UI Design / operational regression `36556013257`, Beta Worker `36556013002` and Verify Beta Android `36556013042` all PASS.
- Signed Android release `beta-vc89` release id `399040014` targets that exact main commit.
- APK asset id `597939005`, size `19,118,660` bytes, SHA-256 `9fe96a16a26d1d59e3b2664025cd0802a59b9535d545d92cd475995c4dfc12bc`.
- `inventory-channel` APK asset id `597939084` was refreshed to the same digest.
- D151 is technical/runtime/release PASS only. OA079 is field-ready; accepted base remains D150 until explicit Owner D151 PASS.
- Stable remains OWNER-GATED and untouched.

## D151 Owner-accepted / D152 active continuity — 2026-09-29

- Accepted base: **D151 Owner PASS**; OA079 closed.
- Signed Android: **beta-vc89** with marker `D151_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC89__ADAPTIVE_ALERT_ENGINE`.
- Current Web marker remains `D149_TECHNICAL_RUNTIME_PASS__RECENT_RANGE__READ_ONLY_UNIFIED_SHIFT_STATE__MAIN_C03F5486`.
- SQLite schema remains `14`.
- D152 is the only active change: Agent-only bounded PickList checkbox recovery and post-confirm verify-only logic, target `relay-agent-v86`.
- Normal confirmation fast path and D150 HA/quota fences remain unchanged. No new provider/resource/schema/listener/polling/write cadence or Android build.
- OA080 is blocked until Agent v86 technical/runtime/release PASS. Stable remains OWNER-GATED and untouched.

Derived current-status markers:
- Latest Beta APK: `beta-vc89`
- Android: `D151_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC89__ADAPTIVE_ALERT_ENGINE`
- Web: `D149_TECHNICAL_RUNTIME_PASS__RECENT_RANGE__READ_ONLY_UNIFIED_SHIFT_STATE__MAIN_C03F5486`
- SQLite schema: `14`

## D152 Owner acceptance — PASS — 2026-09-29

- Accepted base is **D152** after explicit Owner field PASS.
- PR #316 merged to main `a418de7e852ff9c1bc8b37309b65cdfc75fe3f24`.
- Main Repo Authority `36575399996`, Project State `36575399947`, Relay Agent `36575400117`, UI Design `36575400191` and Dashboard Probe `36575400049` all PASS.
- Agent release **relay-agent-v86** id `399178131`; EXE size `7,074,304` bytes; SHA-256 `098d8cc6c51bdf58e0ef9bd662b9b7bfaf8a0f12b749318d44c194e89eb0c430`; inventory Agent channel matches the same digest.
- Owner confirmed the downloaded Agent passed field validation; OA080 is closed.
- Android remains **beta-vc89**. No new provider/resource/schema/listener/polling/write cadence is introduced. Stable remains OWNER-GATED.

Derived current-status marker:
- `D152_OWNER_FIELD_ACCEPTED_PASS__MAIN_A418DE7E__AGENT_V86__OA080_CLOSED`


## D153 quota-safe Picker presence technical/runtime/release PASS — 2026-09-29

- Implementation: PR #321 → main `d69566ee0ae6294573ec91f9eb649764e91561ee`.
- Main gates PASS: Repo Authority `36594651066`, Project State `36594651211`, UI Design `36594651147`, Dashboard Probe `36594651119`, Beta Worker `36594651073`, DND compatibility `36594651179`, Relay Agent `36594651175`.
- Beta Worker health: HTTP 200, exact source `d69566ee0ae6294573ec91f9eb649764e91561ee`, SQLite `14/14`, Operational V2 `5/5`, Agent migration `0/0`.
- Agent: **relay-agent-v87**, release id `399311941`, EXE asset id `598619169`, size `7,078,912` bytes, SHA-256 `0f863dea6a9841cb237be48ab83f17ff9443654c298ea9db6bc5c8a79c597070`.
- Inventory Agent channel asset id `598619345` matches the same digest.
- D153 A+B+C only: one-shot session-fenced PickList fallback, semantic Worker/InventoryCore Firestore write dedupe, Picker-only Agent sync no-op gate. Streaming redesign D remains deferred.
- Protected 3s/15s/1s queue, 10s PRIMARY lease, 15s failover and D152 WMS confirmation path remain unchanged.
- OA081 is **READY_FOR_OWNER_FIELD_TEST**. D152 remains accepted base until explicit Owner D153 PASS.
- Android remains **beta-vc89**. Stable remains OWNER-GATED and untouched.

Derived current-status marker:
- `D153_TECHNICAL_RUNTIME_RELEASE_PASS__MAIN_D69566EE__AGENT_V87__OA081_FIELD_READY`


## D153 Owner acceptance — PASS — 2026-09-29

- Accepted base is **D153** after explicit Owner field PASS; OA081 is closed.
- Implementation source remains PR #321 → main `d69566ee0ae6294573ec91f9eb649764e91561ee`.
- Agent **relay-agent-v87** release id `399311941`; EXE SHA-256 `0f863dea6a9841cb237be48ab83f17ff9443654c298ea9db6bc5c8a79c597070`.
- Android remains **beta-vc89**.
- Owner accepted the A+B+C quota-safe Picker presence behavior after field validation; streaming redesign D remains deferred.
- No new provider/resource/schema/listener/polling/cron. Stable remains OWNER-GATED.
- Serial Owner-PASS gate is open for the next separately reviewed change.

Derived current-status marker:
- `D153_OWNER_FIELD_ACCEPTED_PASS__MAIN_D69566EE__AGENT_V87__OA081_CLOSED`


## D154 Owner-approved source candidate — 2026-09-30

- Accepted runtime remains D153 Owner PASS; D154 is source-only pending PR gates and deployment.
- Normal shared schedule target: **05:45–22:30**, early start 05:00–05:45, overtime capped at 05:00 with 22:30-anchored one-hour boundaries.
- Agent target `relay-agent-v88`; Android target is the next monotonic signed Beta after `beta-vc89`.
- `operatingScheduleChanged` is now included in the Beta Functions deploy allow-list; this repairs the identified source/deployment mismatch behind Agent projection PASS with Worker schedule version 0.
- Recovery remains bounded: one in-event Worker mirror retry and one exact Firestore GET only for a blocked Android PickList that still sees a closed Worker state.
- No new provider/resource/schema/secret/listener/polling/cron. Stable remains OWNER-GATED.
- OA082 is blocked pending technical/runtime/release PASS.

Derived current-status markers:
- Latest Beta APK: `beta-vc89`
- Android: `D151_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC89__ADAPTIVE_ALERT_ENGINE`
- Web: `D149_TECHNICAL_RUNTIME_PASS__RECENT_RANGE__READ_ONLY_UNIFIED_SHIFT_STATE__MAIN_C03F5486`
- SQLite schema: `14`


## D154 technical/runtime/release PASS — 2026-09-30

- Implementation PR #324 -> main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`.
- Beta Worker run `36609749783` PASS: HTTP 200, exact source `4aa06e7b`, SQLite 14/14, Operational V2 5/5, Agent migration 0/0.
- Beta Functions run `36609749800` PASS and created `operatingScheduleChanged(asia-southeast1)`.
- Signed Android **beta-vc90** release id `399404364`, asset `598876063`, size 19,118,744 bytes, SHA-256 `b3204970660096768950de870ccf6b8a6329018f6f27ccde12d83b24189a1cf4`.
- Agent **relay-agent-v88** release id `399403230`, asset `598872709`, size 7,081,472 bytes, SHA-256 `74128bc35fdc8b635e512b8af7a59131d0c932c7865b8597c31399d4d7a3d8f2`.
- Inventory channel APK and Agent EXE match those release digests. Existing verified Fixed WebView2 bundle remains unchanged.
- Main UI, Authority, State and Dashboard gates PASS. Agent attempt 1 hit a transient Microsoft Fixed Runtime selector/download race after v88 publication; attempt 2 PASS with no source hotfix. PR #325 was closed unmerged.
- Accepted base remains D153. OA082 is READY_FOR_OWNER_FIELD_TEST.
- No new provider/resource/schema/secret/listener/polling/cron. Stable remains OWNER-GATED.

Derived current-status markers:
- Latest Beta APK: `beta-vc90`
- Android: `D154_TECHNICAL_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC90__PERMISSION_VERSION_SCHEDULE_SYNC`
- Web: `D154_TECHNICAL_RUNTIME_PASS__UNIFIED_0545_2230__MAIN_4AA06E7B`
- SQLite schema: `14`


## D154 Owner acceptance — PASS — 2026-09-30

- Accepted base is **D154** after explicit Owner field PASS; OA082 is closed.
- Runtime implementation remains main `4aa06e7be0731ebe3b5fb05d30653de30fbdc406`.
- Agent **relay-agent-v88** and Android **beta-vc90** remain the current accepted Beta releases.
- Accepted behavior includes unified **05:45–22:30** normal replay, 05:00–05:45 early start, 22:30-anchored overtime with 05:00 cutoff, shared `CANCEL_OVERTIME`, and the deployed `operatingScheduleChanged` propagation path.
- Android login version and DND/Overlay priority setup are Owner-accepted together with the existing hard Notification/Overlay/battery readiness requirements.
- No new provider/resource/schema/secret/listener/polling/cron. Stable remains OWNER-GATED.
- Serial Owner-PASS gate is open for the next separately reviewed change.

Derived current-status markers:
- Latest Beta APK: `beta-vc90`
- Android: `D154_OWNER_FIELD_ACCEPTED_PASS__SIGNED_BETA_VC90__PERMISSION_VERSION_SCHEDULE_SYNC`
- Web: `D154_OWNER_FIELD_ACCEPTED_PASS__UNIFIED_0545_2230__MAIN_4AA06E7B`
- SQLite schema: `14`


## D155 Owner acceptance — PASS — 2026-09-30

- Accepted base is **D155** after explicit Owner field PASS; OA083 is closed.
- Current Beta runtime: schema **15**, Android **beta-vc91**, Agent **relay-agent-v90**.
- D155 contractor synchronization and Picker Báo hàng capability control are Owner-accepted; D154 shared schedule behavior remains the inherited schedule baseline.
- Serial Owner-PASS gate is open for the next separately reviewed change. Stable remains OWNER-GATED.

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

## D161 derived continuity markers — 2026-10-02

> Derived view only. Canonical authority is `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, affected specs, and `docs/D161_APPROVED_BACKLOG.md`.

- Accepted runtime base: `D160`.
- Beta collection state: `D160_ACCEPTED_BASE__D161_OWNER_APPROVED_BACKLOG_ACTIVE_IMPLEMENTATION_DEFERRED__ANDROID_VC92`.
- Web runtime marker: `D160_ACCEPTED_RUNTIME_WEB__D161_WEB_VERSION_1_AND_REPAIR_REQUIREMENTS_APPROVED_IMPLEMENTATION_DEFERRED`.
- Android runtime marker: `D160_ACCEPTED_RUNTIME__SIGNED_BETA_VC92__D161_REPAIR_REQUIREMENTS_APPROVED_IMPLEMENTATION_DEFERRED`.
- Latest signed Beta APK: `beta-vc92`.
- SQLite schema: `16`.
- D161 is authority/backlog collection only. No implementation/build/release/deploy/provider mutation is authorized until a separate explicit Owner command.
- Stable remains OWNER-GATED.

## D161 approved backlog extension — support logs / Agent UI / shared overtime — 2026-10-03

> Derived continuity view. Canonical authority: `docs/D161_APPROVED_BACKLOG.md`, `docs/OWNER_DECISIONS.md`, affected specs and `ops/project-state.json`.

- Accepted runtime base remains **D160 / Agent relay-agent-v97 / Android beta-vc92**; D161 implementation remains deferred.
- Newly approved log target: daily trusted Drive archive children under existing Beta Logs parent, strict Drive-confirmed Android/Agent prune, bounded anti-spam capture, and exact-login `admin`/`tamnv2` global support-log request with TTL/dedupe/jitter.
- Newly approved Agent UI target: atomic/batched History/Usage rendering with no visible wave; History resets to full `SentAtMs` newest-first order on every tab re-entry.
- Newly approved shared schedule target: D161 changes normal replay end to **22:15**, removes pre-end Continue/Stop confirmation, uses SLEEP red/white UI with +1h shared extensions, one T-15 expiry warning and automatic sleep when no extension occurs; 05:00 cutoff and 05:00–05:45 early-start model remain inherited.
- No code/build/release/deploy/provider mutation occurred in this authority update. Stable remains OWNER-GATED.

## D161 shift-display clarification — 2026-10-03

- Business-facing normal shift remains **06:00–22:00**.
- Replay technical guard remains **05:45–22:15** under the already-approved D161 logic.
- The 15-minute margins are technical only and must not be presented as the business shift.
- D161 implementation remains deferred; D160 runtime is unchanged.

## D161 bulk-kick / update-lifecycle extension — 2026-10-03

- Accepted runtime base remains **D160 / Agent relay-agent-v97 / Android beta-vc92**; D161 implementation remains deferred.
- Owner-approved Agent target: card-level **Kích toàn bộ user** for all authenticated Picker/PDA sessions, exact Agent login **admin/tamnv2**, destructive warning + current Agent-password verification, one idempotent server-authoritative bulk session-generation revoke; search filters do not change scope and no Agent-side N-user provider loop is allowed.
- Owner-approved Agent update target: **manual-only**. Remove startup and 30-minute checks; **Kiểm tra cập nhật** is the sole normal entry point and update-channel failure never disrupts relay work.
- Owner-approved Android update target: release-channel failure is advisory and cannot block normal login; current installed signer/integrity failure remains fail-closed.
- Login screen permanently shows **Beta vcXX** plus **Kiểm tra cập nhật** in a compact version/update row. Automatic login-screen discovery is bounded/single-flight and offers **Cập nhật / Để sau** only when a newer trusted release exists.
- While authenticated, tapping version asks **Tìm kiếm bản cập nhật?**; Yes checks once and a newer trusted release proceeds through download/verification/installer handoff from that consent.
- Best-effort Android install is in scope; full silent Device Owner/MDM/OEM/Play-style install is not part of D161 and would require separate Owner/resource approval.
- No new provider/resource/secret/polling/listener/runtime deployment is introduced by this authority capture. Stable remains OWNER-GATED.

## D161 mandatory Safety Baseline / rescue routing — 2026-10-03

- Accepted runtime base remains **D160**; D161 implementation is still deferred.
- Future exact Owner command **`bắt đầu D161 tiến hành`** authorizes complete then-current D161 implementation, but Phase 0 Safety Baseline must PASS before any D161 business/runtime backlog code.
- Phase 0 captures source/component identities, schema/health markers, release-channel manifests, artifact digests and non-secret resource references; it also publishes monotonic Android/Agent safety releases from pre-D161 safe behavior.
- After Phase 0 PASS, implementation automatically continues through the already-approved backlog without asking the Owner to restate requirements.
- While D161 is explicitly field-test-ready, **`ghi nhận ok`** or explicit **D161 PASS** records Owner acceptance.
- Exact rescue command **`quay lại bản backup ban đầu trước khi sửa code`** freezes feature rollout and restores Safety behavior through forward deployments/releases: Safety Web with schema-compatible backend, newer-number Agent/APK rescue releases, no blind SQLite downgrade and no D162.
- Stable remains OWNER-GATED and untouched.


## D161 Phase 0A start derived marker — 2026-10-04

- Android runtime marker: `D160_ACCEPTED_RUNTIME__SIGNED_BETA_VC92__D161_PHASE0A_ACTIVE__SAFETY_TARGET_VC93__FEATURE_MIN_VC94`.
- Accepted runtime remains Android beta-vc92 and Agent v97 while Phase 0A is active; no Safety or feature release has been published yet.
- Stable remains OWNER-GATED and untouched.

## D161 Phase 0 Safety derived marker — 2026-10-04

- SQLite schema: `16`.
- Latest signed Beta APK: `beta-vc92`.
- Web runtime marker: `D160_ACCEPTED_RUNTIME_WEB__D161_WEB_VERSION_1_AND_REPAIR_REQUIREMENTS_APPROVED_IMPLEMENTATION_DEFERRED`.
- Android runtime marker: `D160_ACCEPTED_RUNTIME__SIGNED_BETA_VC92__D161_PHASE0A_PASS__SAFETY_VC93_PREPARING__FEATURE_MIN_VC94`.
- Phase 0A: PASS on main `be097ce199f2f7f6d09570777193e63fb45399e3`.
- Phase 0 Safety: ACTIVE; Agent v101 and Android vc93 are Safety-only targets. D161 feature behavior remains blocked until Safety PASS.
- Stable remains OWNER-GATED and untouched.



## D161 Phase 0 Safety PASS — 2026-10-04

- Phase 0A: PASS.
- Phase 0 Safety main gate: run `37170577529` PASS on `6702b0aabc807954d6427e7e3aa6442134cb95e3`.
- UI Design Guard: run `37170513921` PASS.
- Safety artifacts: `beta-vc93` and `relay-agent-v101`.
- Feature-bearing D161 implementation is active; D160 behavior remains the rescue/accepted base until explicit Owner field acceptance.
- Stable remains OWNER-GATED / untouched.


## D161 Tranche D support/observability checkpoint — 2026-10-04

- Tranche C bulk Picker revoke is merged as PR #421 at main `5a5c4690e39c9e3caf8d459d6b6228c82d61bafa`.
- Tranche D is active on `feat/d161-support-observability-tranche-d`; Agent source candidate is v104 while released Safety Agent remains v101 and D160/v97 remains the accepted rescue base.
- Web/Android/Agent support logging is converging on schema v2 local-first evidence, trusted `YYYY-MM-DD` Drive archive folders, bundle/boundary idempotency and positive `DRIVE_SYNCED` prune authority.
- Existing scoped Beta Worker/InventoryCore/Logs Drive/Apps Script gateway/Firestore fallback are reused. No new persistent provider resource or provider polling cadence is introduced.
- Stable remains OWNER-GATED and untouched.
- NEXT_ACTION: pass Tranche D gates → merge → continue D161 HR + global support control → complete release/runtime verification → READY_FOR_OWNER_FIELD_TEST.


## D161 technical/runtime/release PASS — READY_FOR_OWNER_FIELD_TEST — 2026-10-04

- Implementation: Tranches A–E merged (PRs #419–#423); final provider repair PR #425 merged.
- Beta Worker/Web runtime: PASS on `e75b0a0a73543947840d2c3c599fa9efbf4220e5`, run `37191613243`, schema 17/17, Operational V2 5/5.
- Android: `beta-vc96` published and verified.
- Agent: `relay-agent-v104` published and verified.
- D161 runtime readiness: run `37192056329` PASS; HR production watch `APPLIED / AUTO`, future expiry.
- Agent Operations Gateway: main `e128deba6567216ac28156c4148eb3183be99c9f`, run `37193309206` PASS for redeploy, identity, authenticated Usage/Monitoring and D159-retired proof.
- Status: **READY_FOR_OWNER_FIELD_TEST** under OA096. This is technical/runtime/release PASS only; D160 remains the accepted base until explicit Owner D161 PASS. Stable untouched.


## D161 field repair technical/runtime/release PASS — READY_FOR_OWNER_FIELD_RETEST — 2026-10-04

- Repair PR #427 merged at main `afaf9d563894e61d3632f65ce624c1b3b76bfd36`.
- Beta Worker/Web deploy run `37199390053` PASS with source `afaf9d56`, HTTP 200, schema 17/17 and Operational V2 5/5.
- Repaired Web is **Version 2**.
- Repaired Android candidate **beta-vc97** is published; APK SHA-256 `28626e6058695cf81797c5eb32362365e1408645002d3f0f6b4bdd20c0771e19`.
- Repaired Agent candidate **relay-agent-v105** is published; EXE SHA-256 `542b82d2d1cee0d35442c580d85861b0fc79473c7ee0948a9aacd3c751d92807`.
- Main Android run `37199390022`, Agent run `37199390032`, UI guard run `37199390010` and all main workflows for the repair merge PASS.
- OA096 is **READY_FOR_OWNER_FIELD_RETEST**. D160 v97/vc92 remains the accepted rescue base until explicit D161 Owner PASS. Stable remains OWNER-GATED and untouched.

## D161 second field repair technical/runtime/release PASS — READY_FOR_OWNER_FIELD_RETEST — 2026-10-04

- Repair PR #430 merged to main `6fca277e7fe69d59864716b699788dd6b8d87c4f`.
- Beta Worker deploy run `37201568740` PASS.
- Agent verification/release run `37201568734` PASS; released **relay-agent-v106**.
- Usage provider/runtime verification run `37201568816` PASS; current gateway revision compatibility is restored.
- UI/Worker regression run `37201568724` PASS.
- Android remains **beta-vc97**; no Android source change was required for this repair.
- OA096 is **READY_FOR_OWNER_FIELD_RETEST** for: bulk kick-all, WMS-not-ready explicit History/result, and Usage.
- D160 v97/vc92 remains the accepted rescue base until explicit D161 Owner PASS. Stable remains OWNER-GATED and untouched.

## D161 Agent-only v107 History repair technical/runtime/release PASS — READY_FOR_OWNER_FIELD_RETEST — 2026-10-04

- Owner confirmed Android vc97 sends the PickList request, but Agent v106 still leaves Picker History blank when Web Confirm is not ready.
- Root cause is Agent-only: `FirestoreConfirmationTransport` used the strict WMS-ready mutation fence before the D160 pipeline, so History/terminal handling never ran.
- Repair target **relay-agent-v107** is released from main `b7307eebcc9fdff5de2cacadd96b618470a5fc86`. Android remains **beta-vc97 unchanged**; Worker/Web and Stable are untouched for this defect.
- v107 separates PRIMARY/generation request-ingress authority from the existing strict WMS mutation authority. The mutation fence still requires WMS-ready immediately before any real WMS action.
- Main Agent run `37203208163`, Usage run `37203208151`, UI run `37203208149` and D127 run `37203208171` PASS. OA096 is **READY_FOR_OWNER_FIELD_RETEST** for the WMS-not-ready History/explicit-result path.

- Agent v107 EXE SHA-256 `67a371a9e3e51a822344b74a97c93cbf56b5909ff8f374a4210722a8621707ca`; inventory-channel points to the same binary.


## D162 technical runtime readiness — 2026-10-05

- Main implementation: `9ac67180c310fe56324608e3118671d278f311c6` from PR #447.
- Beta Worker/Web: deploy run `37344066134` PASS with post-deploy health/source/schema checks.
- Agent: `relay-agent-v114`, verify/release run `37344066196` PASS.
- D162 optimized Service single-DO hot paths, Reporter scope-specific refresh and Agent listener-first watchdog are technically released.
- Android remains `beta-vc97` hard-locked unchanged.
- Stable remains OWNER-GATED and untouched.
- OA097 comparable-load usage/latency validation and explicit Owner PASS remain pending.

## D162 realtime badge lazy-queue repair runtime PASS — 2026-10-06

- PR #449 merged to main `d970790bfd440a50c80751102e7a2fb05f8300e3`.
- Beta deploy run `37391459092` PASS; health, Root/schema, auth routing, business guards, Web shell and public OAuth checks passed.
- Badge is realtime from bounded `queue_delta` metadata; off-screen full queue reads are removed; Results loads recent only.
- Authority `37391458033`, Project State `37391458064`, UI `37391458250`, D127 `37391458086`, D159 `37391457987` PASS.
- Agent v114 and Android vc97 are unchanged; Stable remains OWNER-GATED.
- OA097 is now PENDING_FIELD_VALIDATION.

## D162 workspace tab realtime counter repair runtime PASS — 2026-10-06

- PR #451 merged to main `8fca1fb539f2396cefaff621368758336035c00b`.
- Beta deploy run `37395842899` PASS.
- Queue and recent workspace badges are independent of loaded list rows and update from realtime metadata.
- One lightweight dual-counter authoritative request is used only for baseline/gap/reconnect recovery; no periodic polling exists.
- Authority `37395842893`, Project State `37395842908`, UI `37395843053`, D127 `37395843108`, D159 `37395843560` PASS.
- Agent v114, Android vc97 and Stable are unchanged.
- OA097 is PENDING_FIELD_VALIDATION.

## D162 Owner acceptance — 2026-10-06

- Owner explicitly recorded D162 PASS after PR #451 / main `8fca1fb539f2396cefaff621368758336035c00b` was deployed on Beta.
- OA097 is closed PASS. D162 is the accepted business base.
- Agent remains `relay-agent-v114`, Android remains `beta-vc97`, Stable remains OWNER-GATED.

## D163 source implementation checkpoint — 2026-10-06

- Branch: `d163-kick-logout-report-picker-detail`; PR/CI/runtime deployment pending.
- Service keeps forced revoke immediate and authoritative while allowing only the exactly previous Android PICKER generation to upload `INFO/session_end_logout` through `/api/logs/upload`.
- Web **Báo cáo chi tiết** adds lazy **Xem Picker / Ẩn Picker** drill-down using the existing detailed reporting authority with an exact parameterized `batch_id`.
- No new provider resource, schema, polling, listener, heartbeat or Android/Agent release.
- OA098 is pending technical release and later Owner field acceptance.

## D163 technical/runtime PASS — 2026-10-06

- PR #461 merged to main `d991c83bcf617c4aac523f85337f2b27f9fe3193`.
- Beta Worker/Web deploy run `37417036768` PASS, including Web build, Service typecheck, Worker/Web/DO deploy, health/schema/auth/Web-shell/OAuth verification.
- Main Repo Authority `37417036762`, Project State `37417036737`, UI Design Guard `37417036756`, D127 `37417036823`, D159 usage `37417036861` and DND debug build `37417036744` all PASS.
- D163 behavior now live on Beta: forced Picker revoke remains immediate while the just-revoked Android Picker generation may submit only the final `INFO/session_end_logout` log; Báo cáo chi tiết exposes lazy exact-`batch_id` Picker detail.
- Android remains `beta-vc97`; Agent remains `relay-agent-v114`; Stable remains OWNER-GATED and untouched.
- D163 is **not** Owner PASS yet. OA098 is READY_FOR_OWNER_FIELD_TEST.

## D163 Owner field acceptance — PASS — 2026-10-06

- Owner explicitly confirmed **D163 PASS** with “ok done 163”.
- OA098 is closed PASS.
- Accepted implementation remains PR #461 / main `d991c83bcf617c4aac523f85337f2b27f9fe3193`; Beta deploy run `37417036768` PASS.
- Accepted D163 behavior: Kích User preserves the normal final logout-log boundary without restoring revoked business authority; Web Báo cáo chi tiết provides lazy exact-batch Picker drill-down.
- Android remains `beta-vc97`, Agent remains `relay-agent-v114`, and Stable remains OWNER-GATED and untouched.
- D164 PDA Management continues only as its already-authorized isolated scope and remains separately field-gated.

## D165 proposal-only readiness note — 2026-10-06

D165 is recorded only as an Owner-approved proposal. No D165 runtime source, build, provider configuration or deployment has been changed. Inventory production/Beta runtime readiness remains the D163 accepted state; D164 PDA Management is isolated.

Future D165 implementation is gated by a fresh authority bootstrap, Owner re-verification of `docs/D165_INVENTORY_RELIABILITY_USAGE_PLAN.md`, and an explicit start command. Stable remains OWNER-GATED.

## D165 Android Reporter compact-tab refinement — 2026-10-07

- PR #487 proposes the Android Reporter UI-only tab refinement: four tabs in active PER_PICKER auto-skip, otherwise three; badges on Đang xử lý and Quá hạn only. The Picker đã thu hồi tab is removed from Android presentation, not audit/history.
- The signed runtime APK is still beta-vc97 pending a successful newer Beta release and field validation; no Web modification is part of this UI refinement.
- Predictable clock-only privileged emergency authentication is a blocker. Do not merge or deploy PR #487 until the independent secret-backed proof is authorized, implemented and validated. Stable stays Owner-gated.

## D165 source technical CI checkpoint — 2026-10-07

- D165 PR #487 source at `aaf72d511ba4aabcf3cd20f9cea6654837afd13e` passed **16/16 triggered GitHub Actions checks**, including Android resource linking/assembly, UI Design Guard, Project State Guard, Repo Authority Guard and Relay Agent verification.
- This is **source technical PASS only**. The PR remains draft: the predictable HHmm-only privileged emergency authentication lacks the required independent secret-backed factor.
- No merge or signed Beta APK auto-update release resulted from this PR. Existing signed Beta APK remains `beta-vc97`, and Stable remains Owner-gated. Owner device/field tests and usage acceptance are still pending.
