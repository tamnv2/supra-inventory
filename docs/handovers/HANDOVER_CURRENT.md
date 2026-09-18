# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F13_F21_F22_ANDROID_P1_RUNTIME_RELEASE_PASS_MAIN_09F6C6C4__NEXT_F14_F19_F20_F23`
- SQLite schema: `5`
- Web: `WEB_OPERATIONAL_P1_HASH_DEEPLINK_BETA_DEPLOY_PASS_09F6C6C4`
- Android: `F09_F13_F21_F22_SIGNED_BETA_VC39_RUNTIME_GATED_PASS`
- Latest signed Beta APK: `beta-vc39`
- Realtime: `GLOBAL_SCAN_CURSOR_STREAM_EPOCH_DIRTY_RECOVERY_BETA_RUNTIME_PASS_OP_V2_4`
- FCM: `DATA_ONLY_SERVICE_CORRELATION_DELIVERY_ATTEMPTS_INVALID_TOKEN_CLEANUP_RUNTIME_RELEASE_PASS__PHYSICAL_ACCEPTANCE_PENDING`

## Automated runtime/release evidence

- Android P1 PR #22 merged at `09f6c6c4b70ed8d851bf7b3a617abdfaf5e98455`.
- Protected source/build gates PASS: authority, continuity, UI invariants, Operational V2, realtime cursor, Web operational, Android operational, Worker typecheck, Web production build and Android debug build.
- Deploy Beta run `35293918856`: PASS.
- Health: HTTP 200, base SQLite `5/5`, Operational V2 `4/4`.
- Auth/business guard smoke, Web shell and Google OAuth start: PASS.
- Verify Beta Android run `35293918801`: PASS and explicitly observed the matching deploy run before release.
- Signed release: `beta-vc39`, source `09f6c6c4`, APK size `9,250,662` bytes, SHA-256 `59ec8144b26f241ca8997e28d4c0a7cb754a1bfe83c9e6e4618bbe46c855095d`.

## Android P1 delivered

- keyed Picker/Reporter operational rendering;
- visible-only critical result DISPLAYED;
- one-tap withdrawal confirmation;
- transactional staged SQLite SKU cache with old-cache safety;
- high-priority data-only FCM service/correlation, lifecycle receipt reconciliation and invalid-token cleanup;
- bounded provider delivery-attempt telemetry;
- fail-closed OTA source/package/version/channel/signer verification;
- exact launcher routes plus role-checked Web hash deep links.

## Next

1. Implement F14/F19/F20/F23.
2. Preserve all current regression/source-build gates.
3. Run protected PR and matching Beta deploy/runtime verification.
4. Keep physical PDA/FCM acceptance separate from automated technical PASS.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
