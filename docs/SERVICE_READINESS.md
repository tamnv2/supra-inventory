# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_PR4_VALIDATION`
- Android: `PRACTICAL_BALANCED_CANONICAL_SOURCE_AND_MONOTONIC_OTA_PR4_VALIDATION`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_PR4_VALIDATION`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PR4_VALIDATION`

## Remaining acceptance/build work

- PR #4 authority + continuity + canonical Practical Balanced source guard + Worker typecheck + Web production build + Android debug build terminal PASS.
- After PR #4 merge: Beta Worker/Web deploy smoke and signed Android release with monotonic versionCode greater than `beta-vc30`.
- Runtime smoke for expanded Root/Admin hierarchy, direct managed-password flow, flexible HR header mapping and explicit Picker lifecycle.
- Field-verify FCM delivery on a physical logged-in PDA.
- Owner business acceptance.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Complete PR #4 checks; merge only after PASS; then verify Beta deploy and signed `beta-vc31` or higher evidence before updating the runtime baseline. Stable remains gated.

Stable remains Owner-gated.
