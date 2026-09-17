# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `SIGNED_BETA_VC34_TECHNICAL_PASS_FIELD_UI_REJECTED_REMEDIATION_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc34`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `SOURCE_GUARD_EXTENDED_FOR_PHYSICAL_PDA_LAYOUT_REGRESSION_PENDING_PR_CI`

## Proven runtime baseline

- Runtime source commit: `c056e842467b2b9e03f6a03e3de4187991361200`
- Signed release: `beta-vc34` / `SUPRA Inventory Beta 0.2.0-beta.34`
- APK SHA-256: `80708e58281b67256f6f7a69e5c4ed9aa9dfaafef4b053657a5c68ae77feda52`
- APK size: `9185074` bytes
- PR #10 technical source/build/deploy/release evidence: PASS.
- Physical PDA field/UI evidence on 2026-09-17: REJECTED. The narrow-device header truncates, Picker/Reporter typography and actions are over-compressed relative to the approved layout, successful catalog sync occupies unnecessary operating space, and Reporter picker-detail control squeezes card context.

## Workboard

### In progress
- Physical-PDA layout parity remediation on branch `fix/android-vc35-pda-layout-parity`.
- Preserve all existing business semantics while fixing only the visual/interaction mismatch.
- Extend source guard so the fixed-width header and squeezed Reporter control cannot silently return.

### Next / field acceptance
- Pass PR authority + continuity + UI/build guards, merge, and publish the next signed Beta APK.
- Owner field-test the remediated signed Beta APK on the same physical PDA.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance remains pending until the remediated signed APK exists.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
