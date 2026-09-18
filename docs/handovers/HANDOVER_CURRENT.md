# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F07_RUNTIME_PASS__WEB_OPERATIONAL_P1_SOURCE_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_CONTEXT_SESSION_USERS_REPORTING_SOURCE_IN_PROGRESS__BETA_RUNTIME_PENDING`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__WEB_DISPLAY_STAGE_SOURCE_FIXED__PHYSICAL_ACCEPTANCE_PENDING`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Proven automated baseline

- F01–F07 runtime remains PASS.
- Operational V2 runtime remains extension `3/3`.
- Signed Android baseline remains `beta-vc38`; this Web package does not change Android release identity.
- Stable remains untouched / OWNER-GATED.

## Current work — Web operational P1

Branch `fix/web-operational-contracts` implements:
- context-preserving active-section patching so realtime updates do not reset focused input, caret, filters/forms or local scroll context;
- generation guards for SKU search, analytics/reporting and cross-session stale responses;
- one Web authorized session/refresh manager shared by normal and Operational V2 API clients;
- explicit managed-user edit/password forms instead of ambiguous browser prompts;
- server-side managed-user filters/totals/pagination and true one/many/all Picker lifecycle actions;
- Picker result `DISPLAYED` only after the critical result surface is actually rendered;
- D025 Web date presets, trend/outcome surfaces, drill-down and bounded chunked CSV export;
- Web SLA bounds aligned to server 1–1440 / <=2880 contract.

Source regression/build/runtime gates are pending for this change set.

## Next

1. Run protected PR authority/continuity plus Web/F01-F07 regression and source-build gates.
2. Merge only on PASS.
3. Verify Beta runtime deploy/smoke while preserving Operational V2 `3/3`.
4. Record runtime evidence, then continue Android lifecycle/FCM/cache/updater package.
5. Keep physical PDA/FCM/Owner acceptance separate.

## Guards

- No offline business mode.
- No legacy 1291 resource/provider import.
- No secrets in this public repository.
- Stable remains OWNER-GATED.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
