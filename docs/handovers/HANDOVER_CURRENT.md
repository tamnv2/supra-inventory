# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `CONCEPT3_FINISH_POLISH_BETA_DEPLOY_PASS`
- Android: `CONCEPT3_FINISH_POLISH_SIGNED_OTA_BETA_PASS`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- Admin dashboard/reporting: `CONCEPT3_OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`

## Workboard

### In progress
- None

### Next
- Owner field-test beta-vc30 on physical PDA/Web and report business/UI findings for iterative Beta adjustment
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA
- Define Owner workload target before isolated destructive/mutation load acceptance

### Blocked / Owner-field dependent
- Owner business acceptance
- Physical PDA FCM delivery acceptance
- Isolated mutation load acceptance requires an Owner workload target/test boundary

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
