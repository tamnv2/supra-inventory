# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F02_F05_RUNTIME_PASS_MAIN_641D106F__F06_F07_SOURCE_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `F02_F05_BETA_DEPLOY_PASS_641D106F__F06_F07_WEB_SOURCE_IN_PROGRESS`
- Android: `SIGNED_BETA_VC37_RUNTIME_BASELINE__F06_F07_ANDROID_SOURCE_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc37`
- Realtime: `F02_F05_RUNTIME_PASS__F06_F07_GLOBAL_SCAN_APPLIED_CURSOR_SOURCE_IN_PROGRESS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Runtime readiness

- Main `641d106f` / PR #17: F02–F05 Beta runtime PASS.
- Deploy run `35287719792`: health `schema=5/5`, Operational V2 `2/2`, business auth guards, Web shell and OAuth start all PASS.
- Current signed Android baseline remains `beta-vc37` because F02–F05 did not modify Android.
- Stable remains Owner-gated and has not been activated.

## F06/F07 source readiness in progress

- Operational V2 source target: schema `3`.
- Server delta uses global scan cursor plus role projection and explicit epoch/retention/resync metadata.
- Web/Android keep an applied cursor and retry dirty state when read-model application fails.
- Android refresh-in-flight invalidations are queued through dirty rerun/completion instead of being dropped.
- Realtime cursor regression, service typecheck, Web build, Android build and protected PR gates are pending.

## Next action

Complete F06/F07 PR/CI, merge only on PASS, verify Beta Operational V2 `3/3`, then verify the matching runtime-gated signed Android release. Physical PDA/FCM/Owner acceptance remains separate.
