# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F07_WEB_OPERATIONAL_P1_AUTOMATED_RUNTIME_PASS_MAIN_343AFFD8__NEXT_ANDROID_P1`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_BETA_DEPLOY_SMOKE_PASS_343AFFD8__OWNER_FUNCTIONAL_ACCEPTANCE_PENDING`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__WEB_VISIBLE_DISPLAY_STAGE_SOURCE_BUILD_DEPLOY_PASS__PHYSICAL_ACCEPTANCE_PENDING`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Automated runtime evidence

- Web operational P1 PR #20 merged to main at `343affd88779a68b32e92c1a2799bb0ee7fc5256`.
- Source gates PASS: authority, continuity, UI invariants, Web operational regression, Operational V2 regression, realtime cursor regression, Worker typecheck, Web production build and Android debug build.
- Deploy Beta run `35291272392`: PASS.
- Health: HTTP 200, base SQLite `5/5`, Operational V2 `3/3`.
- Auth/business guard smoke, Web shell and Google OAuth start: PASS.
- Android signed baseline remains `beta-vc38`; PR #20 did not change Android source.

## Web operational P1 delivered

- realtime/connectivity patches preserve focused field, caret, form/filter values and scroll context;
- stale/out-of-order SKU searches and cross-session responses are rejected;
- one canonical Web session/refresh manager is shared by Operational V2 APIs;
- managed user edit/password use explicit forms;
- managed users use server-side filtering, totals and pagination with one/many/all Picker actions;
- critical result DISPLAYED is recorded only when the result surface is rendered;
- Admin dashboard/reporting includes date presets, trend/outcomes, drill-down and bounded chunked CSV;
- Web SLA validation matches current server bounds.

Owner functional acceptance is separate from automated technical/runtime PASS.

## Next

1. Start Android F09–F13/F21–F22 package from main `343affd8`.
2. Preserve F01–F07 and Web P1 regression gates.
3. Merge/deploy/release only through protected Beta flow.
4. Continue F14/F19/F20/F23 after Android P1.
5. Stable remains untouched / OWNER-GATED.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
