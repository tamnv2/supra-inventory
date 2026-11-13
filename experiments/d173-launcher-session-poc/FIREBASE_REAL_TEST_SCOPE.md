# D173 — Firebase Auth thật trên project Báo hàng hiện hữu (Owner 13/11/2026)

**Owner decision supersedes separate-Firebase-project proposal.** Use the existing registered Firebase `supra-inventory-beta` + official Worker `https://inventory.supra.cc.cd` **only with a dedicated idle Picker QA identity**, not an operational Picker, Reporter, Root/Admin, OBPP or Agent user.

## Facts, scope and risks

- Source Launcher baseline: `tamnv2/supra-pda-launcher` release `v0.3.26` commit `c33a8262669f7ff33e698be86ce6d9c657686988`; copied under this isolated `experiments/` directory.
- Existing D173 Worker `POST /api/auth/login` is not read-only: it validates Firebase credentials and calls `/auth/activate-session`, modifying **that QA user's Android `session_generation`**, login audit and realtime presence; an existing active session on a *different PDA* triggers `409 SESSION_ACTIVE_OTHER_DEVICE`. The test **always sets `force=false`** and does not replace another device's session.
- The Worker emits an Android Firebase custom token carrying `uid`, `app_session_channel=ANDROID`, `app_session_generation`. The Launcher test signs in using this same server-issued token.
- The independent client (`vn.supra.identitytest`) receives the *existing* Firebase relay custom token via same-debug-signature Android explicit Activity. No password or refresh token is sent across. Its SDK calls `signInWithCustomToken`, checks UID/claims and validates current server authority through read-only `GET /api/auth/me`.
- Logout Launcher calls existing `POST /api/auth/logout` on the pinned QA account and immediately signs out/unlocks neither test app; a signature-protected broadcast causes the client to sign out. Client logout sends the same-signature command to Launcher which owns the server logout.
- This is a **test** of same-UID handoff and coupled logout, not implementation in the Production Báo hàng APK. In-memory custom token handoff is one-time locally, but no backend-issued single-use grant exists here. No new Worker/DO/Firebase schema, Firebase Rules, collections, Firebase projects, app registries, Production APK or D172 resources are deployed.
- Remaining FIELD limitations: if Launcher process dies, in-memory Worker ID token and relay token are lost and the test fails closed; transient network failure can leave server-side QA session until its existing TTL or a later valid login. Actual Android Firebase SDK compatibility with the reused registered app ID must be verified on supported PDA; **no FIELD PASS yet**.
- A shared default password hidden inside an APK is still extractable; the test intentionally requires a masked QA password at Launcher login, clears the input, and never commits it.

## Prerequisites (not verified/provisioned)

1. A dedicated **existing-project Picker QA account** must be registered/approved through the existing account rules, with a unique numeric MNV (5–12 digits), status ACTIVE, and **not logged in on a live PDA**. Its creation/mutation is not authorized merely by this PR.
2. GitHub Actions repository variables `D173_POC_TEST_USERNAME` (that QA MNV) and `D173_POC_FIREBASE_API_KEY` (Firebase public client API key of `supra-inventory-beta`) must be set by authorized owner. **Never provide or commit any password or service-account credential.**
3. Build the pair in one CI run; both debug APKs use the same debug certificate. With unset variables, APKs compile but **refuse to authenticate** by design.
4. Install only on an approved test PDA; open Launcher test and press **Xác nhận định danh** → enter pinned QA MNV and masked QA password; do not enter an operational account.
5. Open the independent test client: it must silently obtain the same UID and generation, show Firebase login, and survive a Worker `GET /api/auth/me` authority check. Then logout in both directions and verify old UID/generation no longer works.
6. Check network evidence: allow only `inventory.supra.cc.cd` auth endpoints and Firebase Identity Toolkit, no other Worker business API calls or D172. Must verify timing and behavior on MT90 and DT50 before FIELD PASS.

## Acceptance status

- Source code implements Worker-backed Firebase Auth handoff on the **existing** project, no provider changes in this PR.
- New CI build, QA configuration, runtime Firebase login, PDA tests and Owner PASS must all be independently verified. Old separate-project QA backend and old mock results are superseded.
