# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F07_RUNTIME_PASS__WEB_OPERATIONAL_P1_SOURCE_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_CONTEXT_SESSION_USERS_REPORTING_SOURCE_IN_PROGRESS__BETA_RUNTIME_PENDING`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__WEB_DISPLAY_STAGE_SOURCE_FIXED__PHYSICAL_ACCEPTANCE_PENDING`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Runtime baseline

- F01–F07 automated runtime: PASS.
- Base SQLite schema: `5`.
- Operational V2 extension runtime: `3/3`.
- Signed Android baseline: `beta-vc38`.
- Stable: Owner-gated and not live.

## Web operational P1 source readiness

Implemented on `fix/web-operational-contracts`:
- realtime/search context preservation and stale-response guards;
- single Web session/refresh manager;
- explicit managed account edit/password forms;
- SQL-paged managed-user administration and one/many/all Picker controls;
- visible-only critical result DISPLAYED stage;
- dashboard presets/trend/outcomes/drill-down and bounded CSV export;
- SLA Web bounds aligned with server.

PR/CI and Beta runtime smoke are still required before this package becomes runtime PASS.

## Next action

Complete protected PR/CI and Beta runtime verification for Web operational P1, then continue Android operational lifecycle/FCM/cache/updater. Physical device/Owner acceptance remains separate.
