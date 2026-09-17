# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC34_APPROVED_OPERATIONAL_LAYOUT_PASS`
- Latest signed Beta APK: `beta-vc34`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Proven runtime baseline

- Runtime source commit: `c056e842467b2b9e03f6a03e3de4187991361200`
- Signed release: `beta-vc34` / `SUPRA Inventory Beta 0.2.0-beta.34`
- APK SHA-256: `80708e58281b67256f6f7a69e5c4ed9aa9dfaafef4b053657a5c68ae77feda52`
- APK size: `9185074` bytes
- PR #10 authority + continuity + Practical Balanced source/build: PASS.
- Post-merge Project State Guard + Repo Authority Guard + UI Design Guard + Beta Worker deploy: PASS.
- Signed Android release vc33 → vc34: PASS.

## Workboard

### In progress
- No automated implementation task remains for the approved vc34 Picker/Reporter layout.

### Next / field acceptance
- Owner field-test signed `beta-vc34` on a physical PDA: approved Picker/Reporter layout, update gate/install handoff, Picker login/default-password behavior, launcher icon and role workflows.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of `beta-vc34` on physical PDA.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
