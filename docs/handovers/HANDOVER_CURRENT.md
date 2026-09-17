# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_VC34_APPROVED_OPERATIONAL_LAYOUT_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc33`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Proven runtime baseline

- Runtime source commit: `21cc34e82c229fc686801e8f00476438555f89cb`
- Signed release: `beta-vc33` / `SUPRA Inventory Beta 0.2.0-beta.33`
- APK SHA-256: `192c39ee66e68795af147a8ab4f0b8164207fe41e93ad445e75c0c63045adda5`
- APK size: `9168694` bytes
- vc33 remains the rollback/reference baseline until vc34 release evidence is proven.

## Workboard

### In progress
- Android vc34 compact `BÁO HÀNG 1291` operational header approved by Owner.
- Picker one-row SKU entry + `BÁO HẾT HÀNG`, followed by today status-card history.
- Reporter four-state filter row and equal `CÓ HÀNG` / `CHO SKIP HÀNG` actions.
- Reporter `Picker thu hồi` uses real `CLOSED` withdrawal batch read data.

### Next
- PR must pass authority, continuity and Practical Balanced source/build guard.
- Merge only after required checks pass.
- Poll Beta Worker deploy and monotonic signed Android release to terminal PASS.
- Record vc34 runtime/release evidence back into canonical state/resource views.
- Owner field-test signed vc34 on physical PDA.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of signed vc34 on physical PDA.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
