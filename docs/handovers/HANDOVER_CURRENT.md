# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_SOURCE_PENDING_CI_AND_BETA_DEPLOY`
- Android: `PRACTICAL_BALANCED_SOURCE_PENDING_CI_SIGNED_BETA_RELEASE`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_AND_FLEXIBLE_HR_SOURCE_PENDING_CI_DEPLOY`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`

## Workboard

### In progress
- Practical Balanced / Phương án 1 Web + Android source application on Beta branch
- Expanded Root/Admin managed-account authority and direct password-change flow
- Flexible HR source column mapping and explicit Picker one/many/all lifecycle management
- Practical Balanced UI regression guard migration from superseded Concept 3

### Next
- PR #3: pass authority + continuity + UI/build verification, repair any CI failure, then merge through protected main
- Deploy/verify Beta Web and produce next signed Beta APK through the existing pipeline
- Owner field-test resulting Practical Balanced Beta Web/PDA
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA

### Blocked / Owner-field dependent
- Owner business acceptance
- Physical PDA FCM delivery acceptance
- Isolated mutation load acceptance requires an Owner workload target/test boundary

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
