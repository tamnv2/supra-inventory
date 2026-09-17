# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE_PRE_REBASELINE_RUNTIME__LEGACY_OPERATIONAL_V2_SOURCE_BUILD_PASS_PENDING_MERGE_DEPLOY_RELEASE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_SOURCE_PRODUCTION_BUILD_PASS__LIVE_RUNTIME_STILL_PRE_REBASELINE`
- Android: `LEGACY_OPERATIONAL_UI_V2_DEBUG_BUILD_PASS__LIVE_SIGNED_BASELINE_STILL_VC35`
- Latest signed Beta APK: `beta-vc35`
- Realtime: `OPERATIONAL_V2_SEQ_DELTA_ACK_SOURCE_BUILD_PASS_PENDING_BETA_RUNTIME_VERIFICATION`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Source/build readiness

- PR #14 implements Legacy Operational V2 on `feat/legacy-operational-rebaseline-v1`.
- Operational V2 service schema/API source and Worker typecheck: PASS.
- Web operational-first production build: PASS.
- Android Picker/Reporter/Admin-Root/realtime debug build: PASS.
- No offline business path is present or authorized.
- Beta runtime deploy and next signed APK release remain pending until protected merge.

## Proven live runtime baseline

- Runtime source commit: `a00a23727f515d208726907e4abc672243815460`
- Signed Android release: `beta-vc35` (`SUPRA Inventory Beta 0.2.0-beta.35`)
- APK SHA-256: `09dd3fe51d6df9979d03bc58985fdd3f583d30be4f71e1535e72ceb9888afb38`
- APK size: `9185074` bytes
- This remains the live pre-rebaseline runtime until the new code is merged, deployed and released.

## Next action

Complete final PR #14 authority/continuity/UI guards, merge through protected main, then run Beta deploy/runtime smoke and publish/verify the next monotonic signed Beta APK. Physical PDA/UI/FCM/ACK acceptance remains separate. Stable remains Owner-gated.
