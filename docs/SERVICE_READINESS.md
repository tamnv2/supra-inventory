# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `SIGNED_BETA_VC34_TECHNICAL_PASS_FIELD_UI_REJECTED_REMEDIATION_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc34`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `SOURCE_GUARD_EXTENDED_FOR_PHYSICAL_PDA_LAYOUT_REGRESSION_PENDING_PR_CI`

## Proven runtime baseline

- Runtime source commit: `c056e842467b2b9e03f6a03e3de4187991361200`
- Signed Android release: `beta-vc34` (`SUPRA Inventory Beta 0.2.0-beta.34`)
- APK SHA-256: `80708e58281b67256f6f7a69e5c4ed9aa9dfaafef4b053657a5c68ae77feda52`
- APK size: `9185074` bytes
- PR #10 and post-merge guards proved technical source/build/deploy/release PASS.
- Physical PDA field/UI evidence on 2026-09-17 rejects vc34 visual acceptance.

## Current implementation state

- Business workflows remain technically operational; no business-state semantics are being changed in this remediation.
- Physical PDA mismatch identified: fixed right-side header allocation truncates `BÁO HÀNG 1291` on narrow screens.
- Picker and Reporter text/actions/cards are too compressed compared with the approved operating layout.
- Successful Picker catalog synchronization leaves unnecessary status text in the operating area.
- Reporter `Xem Picker` mini-control squeezes the primary report context.
- Remediation is in progress on `fix/android-vc35-pda-layout-parity` with regression checks added to the UI guard.

## Next action

Pass branch/PR guards, merge, publish the next signed Beta APK, then perform physical-PDA UI verification. Stable remains Owner-gated.
