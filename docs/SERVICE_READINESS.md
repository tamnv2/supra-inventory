# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `CONCEPT3_FINISH_POLISH_BETA_DEPLOY_PASS`
- Android: `CONCEPT3_FINISH_POLISH_SIGNED_OTA_BETA_PASS`
- Latest signed Beta APK: `beta-vc30`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `ROOT_ADMIN_HIERARCHY_AND_HR_PICKER_SYNC_BETA_DEPLOY_PASS`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `CONCEPT3_OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`

## Remaining acceptance/build work

- Field-verify FCM delivery on a physical logged-in PDA; technical foundation is deployed
- Owner business acceptance
- Isolated business-mutation load acceptance after Owner scale target is defined

## Next action

Owner field-test current Beta beta-vc30 on Web/PDA; future AI sessions bootstrap from GitHub authority v2 and apply new feedback on Beta. Stable remains gated.

Stable remains Owner-gated.
