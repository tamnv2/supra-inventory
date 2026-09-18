# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F07_WEB_P1_RUNTIME_PASS__ANDROID_P1_SOURCE_IN_PROGRESS_OP_V2_TARGET_4`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_RUNTIME_PASS__ANDROID_LAUNCHER_HASH_DEEPLINK_SOURCE_IN_PROGRESS`
- Android: `F09_F13_F21_F22_SOURCE_IN_PROGRESS__VC38_RUNTIME_BASELINE`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DATA_ONLY_SERVICE_CORRELATION_DELIVERY_ATTEMPTS_INVALID_TOKEN_CLEANUP_SOURCE_IN_PROGRESS__PHYSICAL_ACCEPTANCE_PENDING`

## Proven runtime baseline

- F01–F07 runtime remains PASS.
- Web operational P1 runtime/deploy smoke remains PASS.
- Current signed Android baseline remains `beta-vc38`.
- Runtime Operational V2 remains `3/3` until this branch is merged/deployed.

## Android P1 source work

Branch `fix/android-operational-lifecycle` currently implements:
- keyed in-place Picker history and Reporter queue/result rendering;
- Picker result `RECEIVED` / visible-only `DISPLAYED` separation;
- one-tap withdrawal confirmation;
- transactional SQLite SKU cache with staging/version-count recheck and legacy TSV migration;
- high-priority data-only FCM handled by `FirebaseMessagingService`, token rotation, lifecycle reconciliation and bounded provider delivery telemetry;
- invalid/unregistered FCM token disable path;
- strict OTA verification for trusted HTTPS source, Beta tag, SHA-256, package ID, exact versionCode/versionName and trusted signer;
- exact Android launcher routes plus role-checked Web hash deep links;
- Operational V2 source target `4` for notification delivery-attempt telemetry.

PR/CI/runtime/release gates are still pending for this source package.

## Next

1. Run protected PR authority/continuity and all regression/source-build gates.
2. Repair until all PR checks PASS.
3. Merge and verify Beta deploy health with Operational V2 `4/4`.
4. Verify matching signed Beta Android release is published only after that runtime gate passes.
5. Record runtime/release evidence, then continue F14/F19/F20/F23.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
