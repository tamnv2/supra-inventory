# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC35_PDA_LAYOUT_REMEDIATION_TECHNICAL_PASS_FIELD_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc35`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PHYSICAL_PDA_REGRESSION_GUARD_SOURCE_WEB_ANDROID_BUILD_PASS`

## Proven runtime baseline

- Runtime source commit: `a00a23727f515d208726907e4abc672243815460`
- Signed release: `beta-vc35` / `SUPRA Inventory Beta 0.2.0-beta.35`
- APK SHA-256: `09dd3fe51d6df9979d03bc58985fdd3f583d30be4f71e1535e72ceb9888afb38`
- APK size: `9185074` bytes
- PR #12 Project State Guard + Repo Authority Guard + UI Design Guard: PASS before merge.
- Post-merge Repo Authority Guard and Verify Beta Android run 35224716068: PASS.
- vc35 fixes the specific vc34 physical-PDA implementation defects: fixed header allocation removed, operational typography/actions enlarged, successful catalog-sync noise hidden, Reporter card context no longer squeezed by a separate mini picker button, and matching source regression guards added.
- Field/UI acceptance is still separate and requires Owner verification on the physical PDA.

## Workboard

### In progress
- No automated implementation task remains for this vc35 remediation.

### Next / field acceptance
- Owner field-test signed `beta-vc35` on the same physical PDA and compare Picker/Reporter screens directly with the approved layout.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of `beta-vc35` on physical PDA.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
