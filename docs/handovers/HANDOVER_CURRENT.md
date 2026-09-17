# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC32_MANDATORY_UPDATE_GATE_PASS`
- Latest signed Beta APK: `beta-vc32`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `444f89d9ace5b5405f4f436b3be27869f16571e2`
- Signed release: `beta-vc32` / `SUPRA Inventory Beta 0.2.0-beta.32`
- APK SHA-256: `4fc20b00397bf0af7f149aef5fd9d42e68ee6f3223f8e84efb4349075c654884`
- APK size: `9168718` bytes
- Beta Worker/Web deploy + health/auth/business/Web/OAuth smoke: PASS
- PR #6 authority + continuity + Practical Balanced source + Worker typecheck + Web production + Android debug: PASS
- Android signed monotonic release: vc31 → vc32 PASS

## Workboard

### In progress
- No automated implementation task remains for the Owner-requested vc32 remediation.

### Next / field acceptance
- Owner field-test signed `beta-vc32` on a physical PDA: update gate/install, Picker login/default-password behavior, narrow-screen layout, launcher icon and role workflows.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of `beta-vc32` on physical PDA.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
