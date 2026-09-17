# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `LEGACY_OPERATIONAL_V2_MAIN_50879EEF_DEPLOY_UPLOAD_PASS_BUSINESS_SMOKE_FAIL__F01_FIX_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_DEPLOYED_50879EEF__WEB_SMOKE_SKIPPED_AFTER_BUSINESS_FAILURE`
- Android: `LEGACY_OPERATIONAL_UI_V2_SIGNED_BETA_VC36_RELEASED__RUNTIME_ELIGIBILITY_GATE_FIX_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc36`
- Realtime: `OPERATIONAL_V2_SEQ_DELTA_ACK_DEPLOYED_50879EEF__AUTHENTICATED_RUNTIME_SMOKE_PENDING_AFTER_F01`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Verified evidence

- PR #14 merged to main at `50879eef1abbd1c17bed4c4e3f37fe2ee56849ad`.
- Deploy Beta run `35252261078`: Worker/Web/InventoryCore deploy PASS; health and auth probes PASS; business/auth-guard smoke failed because `/api/reporter/queue` returned `503 OPERATIONAL_V2_NOT_READY`; later Web/OAuth smoke steps were skipped.
- Android run `35252260928`: signed build PASS and published `beta-vc36` from `50879eef`.
- This exposed a release-gating defect: signed release publication was independent of the matching Beta runtime smoke result.

## Current work

- Branch `fix/beta-runtime-continuity` fixes F01.
- Operational V2 migration is moved to Durable Object initialization with a persisted readiness marker instead of per-request trigger recreation.
- Business routes authenticate/authorize before readiness checks.
- `/health` and capabilities expose Operational V2 readiness.
- Signed Beta release publication is gated on the matching `Deploy Beta Worker` workflow reaching terminal success.
- Stable remains untouched / OWNER-GATED.

## Next

1. Open PR and run authority, continuity, UI/source/build checks.
2. Merge only after required checks PASS.
3. Follow Beta deploy/runtime smoke to terminal PASS; verify all post-deploy smoke steps execute.
4. Continue F02–F05, then F06–F07.
5. Keep physical PDA/FCM/business acceptance separate from automated technical PASS.

## Guards

- No offline business mode.
- No legacy 1291 provider/resource import.
- No secret values in this public repository.
- No Stable mutation without current Owner authorization.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
