# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC31_MONOTONIC_OTA_PASS`
- Latest signed Beta APK: `beta-vc31`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_IMPLEMENTED_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `d7bfd1a0897ec760300a4c5d484b95d91444dc2d`
- Signed Android release: `beta-vc31` (`SUPRA Inventory Beta 0.2.0-beta.31`)
- APK SHA-256: `7f57cec90aad16cdc1747ae8cbe543948ce4fcabca96f5859b16d4087e384f1c`
- APK size: `9167082` bytes
- Beta Worker/Web deploy + health/auth/business/Web/OAuth smoke: PASS
- Android monotonic release: vc30 → vc31 PASS

## Remaining acceptance work

- Owner business/UI field acceptance on Beta Web/PDA.
- Physical logged-in PDA FCM delivery verification.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Use the deployed Practical Balanced Beta Web runtime and signed `beta-vc31` as the accepted technical baseline for Owner field testing. Stable remains gated.

Stable remains Owner-gated.
