# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_SOURCE_PENDING_CI_AND_BETA_DEPLOY`
- Android: `PRACTICAL_BALANCED_SOURCE_PENDING_CI_SIGNED_BETA_RELEASE`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_AND_FLEXIBLE_HR_SOURCE_PENDING_CI_DEPLOY`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`

## Remaining acceptance/build work

- Practical Balanced Web production build, Worker typecheck/deploy smoke and Android debug/signed release verification
- Expanded account hierarchy, direct managed-password flow, flexible HR column mapping and manual Picker lifecycle runtime smoke
- Field-verify FCM delivery on a physical logged-in PDA
- Owner business acceptance
- Isolated business-mutation load acceptance after Owner scale target is defined

## Next action

Complete PR #3 through protected-main checks, Beta deploy and signed APK evidence; then Owner field-tests Practical Balanced Web/PDA. Stable remains gated.

Stable remains Owner-gated.
