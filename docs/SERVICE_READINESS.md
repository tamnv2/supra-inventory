# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F13_F21_F22_ANDROID_P1_RUNTIME_RELEASE_PASS_MAIN_09F6C6C4__NEXT_F14_F19_F20_F23`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_HASH_DEEPLINK_BETA_DEPLOY_PASS_09F6C6C4`
- Android: `F09_F13_F21_F22_SIGNED_BETA_VC39_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc39`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_4`
- FCM: `DATA_ONLY_SERVICE_CORRELATION_DELIVERY_ATTEMPTS_INVALID_TOKEN_CLEANUP_RUNTIME_RELEASE_PASS__PHYSICAL_ACCEPTANCE_PENDING`

## Runtime readiness

- Android P1 source/build/deploy/release: PASS on `09f6c6c4`.
- Deploy run: `35293918856`.
- Health: base schema `5/5`; Operational V2 `4/4`.
- Auth/business guards, Web shell and Google OAuth start: PASS.
- Verify Beta Android run: `35293918801`.
- Signed release: `beta-vc39`.
- APK SHA-256: `59ec8144b26f241ca8997e28d4c0a7cb754a1bfe83c9e6e4618bbe46c855095d`.
- APK size: `9,250,662` bytes.

## Next action

Implement F14/F19/F20/F23 for SLA time behavior, archive/retention metadata, bounded admin insights and redacted diagnostics, then repeat protected Beta source/runtime gates.
