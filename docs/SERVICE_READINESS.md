# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F07_WEB_OPERATIONAL_P1_AUTOMATED_RUNTIME_PASS_MAIN_343AFFD8__NEXT_ANDROID_P1`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_BETA_DEPLOY_SMOKE_PASS_343AFFD8__OWNER_FUNCTIONAL_ACCEPTANCE_PENDING`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__WEB_VISIBLE_DISPLAY_STAGE_SOURCE_BUILD_DEPLOY_PASS__PHYSICAL_ACCEPTANCE_PENDING`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Runtime readiness

- F01–F07 automated runtime baseline: PASS.
- Web operational P1 source/build/deploy smoke: PASS on main `343affd8`.
- Deploy run: `35291272392`.
- Health: base schema `5/5`; Operational V2 `3/3`; required bindings/root secret/storage healthy.
- Auth/business guards, Web shell and Google OAuth start: PASS.
- Signed Android remains `beta-vc38`.

## Current acceptance boundary

Automated technical/runtime PASS does not replace:
- Owner functional acceptance of Web flows;
- physical PDA layout/update behavior;
- physical foreground/background FCM presentation and explicit ACK.

## Next action

Implement Android F09–F13/F21–F22 from this proven baseline, then continue SLA/archive/insights/diagnostics P1. Stable remains Owner-gated.
