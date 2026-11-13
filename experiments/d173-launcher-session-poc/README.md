# D173 Launcher v0.3.26 → existing Firebase QA test

This is the current design, per Owner's 13/11/2026 correction: **real Firebase Auth on the existing Báo hàng project `supra-inventory-beta`**, using only a dedicated idle Picker QA account and the existing Worker API. No Firebase project provisioning, Cloud Functions, Firebase Rules or Báo hàng Production APK changes.

Two independent debug APKs: `vn.supra.pdalauncher.identitytest` and `vn.supra.identitytest`. See [FIREBASE_REAL_TEST_SCOPE.md](FIREBASE_REAL_TEST_SCOPE.md) for exact operational effect of login, QA allowlist and FIELD test matrix.

**Fail-closed:** no QA MNV / Firebase public client API key in GitHub Actions variables → build compiles but login blocked; no embedded default password, no production user session replacement (`force=false`).

CI and FIELD receipts must be recorded only after verified source-pinned build and actual PDA tests. Earlier offline-only and dedicated-project demos do not prove this integration.
