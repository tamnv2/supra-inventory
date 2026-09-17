# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `LEGACY_OPERATIONAL_V2_MAIN_736DB693__F01_RUNTIME_DEPLOY_AND_RELEASE_GATE_PASS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_BETA_DEPLOY_PASS_736DB693`
- Android: `LEGACY_OPERATIONAL_UI_V2_SIGNED_BETA_VC37_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc37`
- Realtime: `F02_F05_PICKER_AUTHORIZED_PROJECTION_SOURCE_IN_PROGRESS__F06_F07_CURSOR_PENDING`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## F01 closed

- PR #15 merged at `736db6937f76d39382e627e3e2fc5c3a19e27299`.
- Operational V2 schema migration is initialization-gated with a persisted extension marker; normal business/realtime requests no longer recreate triggers.
- Authentication/authorization runs before business readiness probes.
- Beta health/capabilities require Operational V2 readiness.
- `beta-vc37` exists at the same source. Under the merged workflow, a signed Beta release is published only after the matching `Deploy Beta Worker` run for that SHA completes successfully.
- Direct vc37 APK hash/size is not recorded as reverified by the connected GitHub tool; do not copy vc36 hash forward.

## Current work

- F02–F05 implementation is active on `fix/result-event-privacy-counts`: immutable result snapshots, Picker-authorized realtime projection, exact targets and fanout-free counts.
- F06–F07 follow after the event/read-model contract is fixed.
- Stable remains untouched / OWNER-GATED.

## Guards

- No offline business mode.
- No legacy 1291 resource/provider import.
- No secrets in this public repository.
- Technical/runtime PASS is separate from physical-device and Owner acceptance.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
