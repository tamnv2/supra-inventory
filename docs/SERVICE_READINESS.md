# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `LEGACY_OPERATIONAL_V2_MAIN_736DB693__F01_RUNTIME_DEPLOY_AND_RELEASE_GATE_PASS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_BETA_DEPLOY_PASS_736DB693`
- Android: `LEGACY_OPERATIONAL_UI_V2_SIGNED_BETA_VC37_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc37`
- Realtime: `OPERATIONAL_V2_SEQ_DELTA_ACK_BETA_DEPLOY_PASS__F02_F07_PENDING`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Runtime readiness

- F01 source/build/authority gates: PASS via PR #15.
- F01 Beta runtime/release eligibility: PASS, evidenced by `beta-vc37` being published from `736db693` under the new workflow that requires the matching Deploy Beta run to complete successfully.
- Operational V2 health now validates the extension schema marker in addition to base schema 5.
- Unauthenticated business probes return auth responses before Operational V2 readiness work.
- Direct vc37 APK hash/size remains unrecorded in canonical state until re-read from the release asset.

## Next action

Implement F02–F05 on Beta, then F06–F07. Physical PDA/UI/FCM/ACK acceptance remains separate. Stable remains Owner-gated.
