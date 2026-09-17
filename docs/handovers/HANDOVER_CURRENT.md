# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F02_F05_RUNTIME_PASS_MAIN_641D106F__F06_F07_SOURCE_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `F02_F05_BETA_DEPLOY_PASS_641D106F__F06_F07_WEB_SOURCE_IN_PROGRESS`
- Android: `SIGNED_BETA_VC37_RUNTIME_BASELINE__F06_F07_ANDROID_SOURCE_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc37`
- Realtime: `F02_F05_RUNTIME_PASS__F06_F07_GLOBAL_SCAN_APPLIED_CURSOR_SOURCE_IN_PROGRESS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Proven Beta runtime

- F01 runtime/readiness/release gate is closed.
- F02–F05 merged in PR #17 at `641d106fbb300a11d721c5ccb4e67cd27f996659`.
- Deploy Beta run `35287719792` completed success.
- Health reported base schema `5/5` and Operational V2 extension `2/2`.
- Business capability/auth guards, Web shell and Google OAuth start smoke all passed.
- F02–F05 did not change Android, so the signed device baseline remains `beta-vc37`.

## Current work — F06/F07

Branch `fix/realtime-cursor-application` implements:
- global scanned `cursor_seq` so a Picker stream need not have numerically contiguous authorized events;
- explicit `stream_epoch`, `retained_from_seq`, `has_more`, `resync_required` and resync reason;
- Web and Android applied cursors that persist only after authoritative read-model application succeeds;
- serialized/dirty recovery so a failed fetch or refresh already in flight cannot silently lose an invalidation;
- Android per-user persisted realtime cursor/epoch with server-reset recovery.

Operational V2 source target is extension schema 3. PR/CI/runtime verification is still pending.

## Guards

- No offline business mode.
- No legacy 1291 resource/provider import.
- No secrets in this public repository.
- Stable remains untouched / OWNER-GATED.
- Technical/runtime/release PASS remain separate from physical-device and Owner acceptance.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
