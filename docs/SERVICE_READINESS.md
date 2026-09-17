# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC34_APPROVED_OPERATIONAL_LAYOUT_PASS`
- Latest signed Beta APK: `beta-vc34`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Proven runtime baseline

- Runtime source commit: `c056e842467b2b9e03f6a03e3de4187991361200`
- Signed Android release: `beta-vc34` (`SUPRA Inventory Beta 0.2.0-beta.34`)
- APK SHA-256: `80708e58281b67256f6f7a69e5c4ed9aa9dfaafef4b053657a5c68ae77feda52`
- APK size: `9185074` bytes
- PR #10 authority + continuity + Practical Balanced source/build: PASS.
- Post-merge Project State Guard + Repo Authority Guard + UI Design Guard + Beta Worker deploy: PASS.
- Signed monotonic Android release vc33 → vc34: PASS.

## Current implementation state

- Approved compact `BÁO HÀNG 1291` operational header: technical runtime PASS.
- Picker one-row SKU input + `BÁO HẾT HÀNG` and today status-card history: technical runtime PASS.
- Reporter four-state tabs and equal `CÓ HÀNG` / `CHO SKIP HÀNG` actions: technical runtime PASS.
- Reporter `Picker thu hồi` reads actual `CLOSED` withdrawal batches: technical runtime PASS.

## Next action

Owner field-test signed `beta-vc34` on a physical PDA. Physical-device/UI acceptance and FCM field delivery remain separate evidence levels. Stable remains Owner-gated.
