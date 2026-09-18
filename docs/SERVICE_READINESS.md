# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F07_WEB_P1_RUNTIME_PASS__ANDROID_P1_SOURCE_IN_PROGRESS_OP_V2_TARGET_4`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_RUNTIME_PASS__ANDROID_LAUNCHER_HASH_DEEPLINK_SOURCE_IN_PROGRESS`
- Android: `F09_F13_F21_F22_SOURCE_IN_PROGRESS__VC38_RUNTIME_BASELINE`
- Latest signed Beta APK: `beta-vc38`
- Realtime runtime: `Operational V2 3/3`
- Operational V2 source target: `4`
- FCM: `DATA_ONLY_SERVICE_CORRELATION_DELIVERY_ATTEMPTS_INVALID_TOKEN_CLEANUP_SOURCE_IN_PROGRESS`

## Current source readiness

Implemented on `fix/android-operational-lifecycle`:
- keyed Android operational rendering;
- visible-only critical result DISPLAYED timing;
- SQLite staged/transactional catalog cache;
- data-only FCM service, token rotation, receipt reconciliation, provider delivery attempts and invalid-token cleanup;
- strict package/version/channel/signer OTA verification;
- exact launcher routing and Web hash deep-link handling;
- notification delivery-attempt schema target `4`.

Protected PR regression/typecheck/build gates and Beta runtime/release verification are still required.

## Next action

Complete PR/CI, Beta deploy migration to Operational V2 `4/4`, and the matching signed Android release gate; then continue SLA/archive/insights/diagnostics P1.
