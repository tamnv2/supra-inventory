# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_PR4_VALIDATION`
- Android: `PRACTICAL_BALANCED_CANONICAL_SOURCE_AND_MONOTONIC_OTA_PR4_VALIDATION`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_PR4_VALIDATION`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PR4_VALIDATION`

## Workboard

### In progress
- PR #4 canonical Practical Balanced Web source reconciliation.
- PR #4 Root/Admin/Reporter/Picker RBAC and direct managed-password hardening.
- PR #4 configurable HR headers and explicit Picker one/many/all lifecycle.
- PR #4 Android Beta monotonic versionCode release hardening.

### Next
- Repair PR #4 CI until authority, continuity, canonical UI source, service, Web and Android checks all PASS.
- Merge PR #4 only after all required checks PASS.
- Verify Beta Worker/Web deploy and signed Android `beta-vc31` or higher release.
- Record final runtime commit/release/hash evidence in canonical state/resource registry.
- Owner field-test resulting Beta Web/PDA and report numbered business/UI findings.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.

### Blocked / Owner-field dependent
- Owner business acceptance.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
