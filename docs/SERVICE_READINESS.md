# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F07_AUTOMATED_RUNTIME_PASS_MAIN_17C1C061__NEXT_P1_WEB_ANDROID`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `F06_F07_APPLIED_CURSOR_BETA_DEPLOY_PASS_17C1C061__NEXT_WEB_OPERATIONAL_P1`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Automated readiness

- F01–F07 source/authority/regression/build gates: PASS through PR #18.
- Beta deploy run `35288849052`: PASS with base schema `5/5` and Operational V2 `3/3`.
- Business capability/auth guards, Web shell and OAuth start smoke: PASS.
- Android run `35288849022`: signed build PASS, matching-runtime gate PASS, release `beta-vc38`.
- APK SHA-256: `0950621118df4339c69f5b5672ecb43aeff1229ef38d81de704d96ab031ff7aa`.
- Stable remains Owner-gated and not live.

## Next action

Continue Web operational P1 package while retaining F01–F07 regression guards. Android lifecycle/FCM/cache/updater and physical PDA acceptance remain separate later gates.
