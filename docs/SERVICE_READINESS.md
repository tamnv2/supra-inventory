# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `PRACTICAL_BALANCED_SIGNED_BETA_VC35_PDA_LAYOUT_REMEDIATION_TECHNICAL_PASS_FIELD_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc35`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PHYSICAL_PDA_REGRESSION_GUARD_SOURCE_WEB_ANDROID_BUILD_PASS`

## Proven runtime baseline

- Runtime source commit: `a00a23727f515d208726907e4abc672243815460`
- Signed Android release: `beta-vc35` (`SUPRA Inventory Beta 0.2.0-beta.35`)
- APK SHA-256: `09dd3fe51d6df9979d03bc58985fdd3f583d30be4f71e1535e72ceb9888afb38`
- APK size: `9185074` bytes
- PR #12 Project State Guard + Repo Authority Guard + UI Design Guard: PASS before merge.
- Post-merge Repo Authority Guard and Verify Beta Android run 35224716068: PASS.

## Current implementation state

- Business workflows and state semantics are unchanged from vc34.
- Narrow-PDA header no longer reserves a fixed 134dp metadata column; title/tools and identity/role are split into stable rows.
- Picker/Reporter operational text, cards, tabs and primary actions are enlarged for the physical PDA form factor.
- Picker catalog status is hidden after successful synchronization so it does not consume the main operating area.
- Reporter picker-detail access is preserved by tapping the report context; the separate mini `Xem Picker` control no longer squeezes the card.
- UI Design Guard now checks the narrow-header, Reporter-card and Picker catalog-status regressions.

## Next action

Owner field-test signed `beta-vc35` on the same physical PDA against the approved Picker/Reporter layout. Technical PASS is complete; physical-device/UI acceptance remains separate. Stable remains Owner-gated.
