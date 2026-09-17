# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F07_AUTOMATED_RUNTIME_PASS_MAIN_17C1C061__NEXT_P1_WEB_ANDROID`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `F06_F07_APPLIED_CURSOR_BETA_DEPLOY_PASS_17C1C061__NEXT_WEB_OPERATIONAL_P1`
- Android: `F06_F07_APPLIED_CURSOR_SIGNED_BETA_VC38_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc38`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_3`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## F01–F07 automated runtime baseline

- F01 readiness/release eligibility: PASS.
- F02–F05 immutable result, Picker projection/privacy and count integrity: Beta runtime PASS on `641d106f`.
- F06–F07 global scan cursor, stream epoch/retention and applied-state dirty recovery: merged PR #18 at `17c1c0610dc5344ff0813436d770e843f66b3d59`.
- Deploy Beta run `35288849052`: success; health `schema=5/5`, Operational V2 `3/3`; business auth guards, Web shell and OAuth smoke PASS.
- Verify Beta Android run `35288849022`: matching runtime gate PASS; published `beta-vc38`.
- `beta-vc38` APK SHA-256: `0950621118df4339c69f5b5672ecb43aeff1229ef38d81de704d96ab031ff7aa`; size `9217842` bytes.
- Stable remains untouched / OWNER-GATED.

## Next work

- Web P1 operational contracts: preserve input/focus/filter/context under realtime, guard stale SKU search responses, then restore/verify management/reporting functions already required by canonical specs.
- Android lifecycle/UI/FCM/cache/updater follows in the next package, preserving F01–F07 regression gates.
- Physical PDA/FCM/business acceptance remains separate from automated technical PASS.

## Guards

- No offline business mode.
- No legacy 1291 resource/provider import.
- No secrets in this public repository.
- Technical/runtime/release PASS is separate from Owner field acceptance.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
