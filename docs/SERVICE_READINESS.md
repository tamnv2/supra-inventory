# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC33_NATIVE_UI_FAIL_CLOSED_UPDATE_GATE_PASS`
- Latest signed Beta APK: `beta-vc33`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `21cc34e82c229fc686801e8f00476438555f89cb`
- Signed Android release: `beta-vc33` (`SUPRA Inventory Beta 0.2.0-beta.33`)
- APK SHA-256: `192c39ee66e68795af147a8ab4f0b8164207fe41e93ad445e75c0c63045adda5`
- APK size: `9168694` bytes
- PR #8 authority + continuity + Practical Balanced source + Worker typecheck + Web production + Android debug: PASS
- Post-merge main authority + continuity + Practical Balanced/Android debug: PASS
- Android monotonic release: vc32 → vc33 PASS
- Android-only change: no Worker runtime mutation required.

## Remaining acceptance work

- Owner business/UI field acceptance of `beta-vc33` on physical PDA.
- Physical logged-in PDA realtime/FCM delivery verification.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Use signed `beta-vc33` as the current technical Beta baseline for Owner physical-PDA testing. Stable remains gated.

Stable remains Owner-gated.
