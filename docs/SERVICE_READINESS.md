# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC32_MANDATORY_UPDATE_GATE_PASS`
- Latest signed Beta APK: `beta-vc32`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `444f89d9ace5b5405f4f436b3be27869f16571e2`
- Signed Android release: `beta-vc32` (`SUPRA Inventory Beta 0.2.0-beta.32`)
- APK SHA-256: `4fc20b00397bf0af7f149aef5fd9d42e68ee6f3223f8e84efb4349075c654884`
- APK size: `9168718` bytes
- Beta Worker/Web deploy + health/auth/business/Web/OAuth smoke: PASS
- Android monotonic release: vc31 → vc32 PASS

## Remaining acceptance work

- Owner business/UI field acceptance of `beta-vc32` on physical PDA.
- Physical logged-in PDA realtime/FCM delivery verification.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Use signed `beta-vc32` as the current technical Beta baseline for Owner physical-PDA testing. Stable remains gated.

Stable remains Owner-gated.
