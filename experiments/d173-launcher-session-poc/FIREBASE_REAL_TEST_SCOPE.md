# D173 — Firebase Auth integration test (isolation gate)

**Owner clarification 13/11/2026:** The earlier offline mock pair is not sufficient. This code path must use a **REAL Firebase Authentication project dedicated to QA**, perform a real custom-token exchange on a separate backend, and prove linked login/logout between the two isolated APKs. **This source is not deployed or field-tested.**

## Source / isolation

- Launcher base: `tamnv2/supra-pda-launcher` signed release v0.3.26 tag commit `c33a8262669f7ff33e698be86ce6d9c657686988`. Copied into `launcher/`, with independent package `vn.supra.pdalauncher.identitytest`.
- Second test APK: `vn.supra.identitytest`, does not use any Báo hàng package, database, user or endpoint.
- Firebase guard accepts **only** a NEW project whose ID matches `supra-d173-poc-[a-z0-9-]{3,45}`. Rejects `supra-inventory-beta`, existing Production, and Stable. There is no fallback.
- Original Launcher admin, OTA updates, background logging, HOME, Accessibility Guard, boot and job components are disabled in test APK to prevent unrelated network/provider traffic.
- No default user password or Google service-account key is committed, printed or embedded. Never try to extract/repurpose Production refresh tokens.
- Test backend uses Firebase Admin to mint a one-use custom token from a short-lived **server-issued 256-bit grant**, never passes a refresh token or account password through Android IPC. Grant only accessible via same-signed Launcher/Client Activity.
- Backend preserves `uid`, `session_id`, `generation`, records revocations; both test APKs subscribe to `poc_sessions/{sessionId}` for revocation using Firebase Firestore.
- Account QA is approved server-side via `poc_test_users/{uid}` mapping to a **synthetic test employee code**, preventing selecting an arbitrary real Picker merely by knowing their code.

## Required out-of-repo QA provisioning (NOT DONE)

No dedicated Firebase test project is registered in the repo's `ops/project-scope.json`. No Firebase provider connection is available in this chat. **Fail-closed: do not deploy to any existing project.**

Owner must first authorize/register a **new separate QA Firebase project**, and a human with Firebase project permissions must provision it using Firebase Console / CLI:

1. Create Firebase project with ID `supra-d173-poc-...` (new, dedicated), verify it is not `supra-inventory-beta` or Stable.
2. Register two Android app IDs `vn.supra.pdalauncher.identitytest` and `vn.supra.identitytest`. Obtain project ID, API key and two test Firebase App IDs.
3. Enable Email/Password sign-in on **QA-only Firebase Auth**; create synthetic user and record UID. Create Firestore database in test project and `poc_test_users/{uid}`: `{"employee_code":"<synthetic 5–12 digits>", "active":true}`.
4. Authorize deployment of only the source under `firebase-test-backend/` to that exact project. Cloud Functions v2 may require Blaze billing; do **not** enable paid billing or deploy without explicit Owner authorization and spending caps. Deploy `firestore.rules` only after confirming project ID.
5. Provide build envs from the QA project **without publishing credentials**: `D173_POC_FIREBASE_PROJECT_ID`, `D173_POC_FIREBASE_API_KEY`, `D173_POC_LAUNCHER_APP_ID`, `D173_POC_CLIENT_APP_ID`. CI can inject these as scoped repository variables on a protected QA build; debug APKs currently built with missing values fail closed.
6. Install the **two APKs from the same build** on a test PDA. Launcher first-time QA enrollment accepts email+password **once and masks it**; later launches use only synthetic code and the persisted Firebase SDK session. A single default password hidden in a public APK is not real authentication.

## Acceptance criteria (NOT YET FIELD PASS)

1. On the test PDA, before identity confirmation all Launcher tiles are dimmed and cannot launch user apps.
2. An approved QA user enters synthetic code and receives a real Firebase ID token with the expected UID; unapproved code fails even when it has the right format.
3. Opening standalone test client silently calls the one-use grant redeem API, signs in with Firebase custom token, and displays **same UID** and session generation.
4. Client cannot reuse an expired or already-redeemed grant; no plaintext password or refresh token in Intent, log or APK.
5. Logout Launcher, client sees revocation immediately (foreground/background), clears local session; reverse logout from client also closes Launcher.
6. Reconnect, launch from background and subsequent user switch cannot revive stale session; any missing network/credentials must fail closed, not substitute mock login.
7. No HTTPS calls or writes to `inventory.supra.cc.cd`, `inventory-beta.supra.cc.cd`, `supra-inventory-beta`, D172 or Stable. Separate QA telemetry must prove it.
8. CI: Android build for both packages, matching debug signatures, Firebase SDK implementation, backend unit tests, Repo Authority/State/D172 guards.
9. Field: verify on actual supported MT90 and DT50 before calling PASS. Production Báo hàng/Launcher remain unchanged.

**Note:** A code/build PASS does NOT prove live Firebase Auth or field behavior. Without QA provisioning the installed APK intentionally refuses authentication.
