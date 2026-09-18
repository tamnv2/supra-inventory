# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `LEGACY_UI_PARITY_NAV_REPAIR_SOURCE_CANDIDATE__BUILD_RUNTIME_OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC41_RUNTIME__LEGACY_UI_PARITY_FIXED_HEADER_SOURCE_CANDIDATE__BUILD_RELEASE_OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc41`
- Operational V2 runtime: `4/4`.

## Automated evidence

- Legacy UI parity PR #27 merged to main at `d52eebe802dc2fb7a581d2118a1d8d9af104f7e0`.
- Repo Authority Guard, Project State Guard and UI Design Guard PASS.
- Deploy Beta run `35299224830` PASS.
- Runtime health: HTTP 200, SQLite `5/5`, Operational V2 `4/4`.
- Auth/business guards, Web shell and Google OAuth start smoke PASS.
- Verify Beta Android run `35299224857` PASS.
- Signed release `beta-vc41` published only after the matching runtime gate PASS.
- APK SHA-256: `83f201008b28ec94f23fba643cff7aaff540c1a9d514798928d84da9d5789da9`.
- APK size: `9250662` bytes.

## UI-first gate

- Read-only visual/layout reference: `tam95supra-source/bao-hang-1291`.
- The previous Web and Android/PDA visual shell is deployed/released, but two structural parity gaps are being repaired before Owner review: Web horizontal tabs and a fixed full-width Android 76dp header.
- UI/layout acceptance is still Owner-dependent and must not be inferred from CI success.
- Business logic/scenario rebuild remains deferred until explicit Owner UI acceptance.

## Next

1. Validate the UI-only navigation/header repair through authority/state/UI guards plus Web/Android builds.
2. Deploy/release the repair through the existing runtime gates.
3. Review Web and Android/PDA screen-by-screen and record each screen as accepted or rejected.
4. Repair only UI/layout mismatches until the UI gate passes.
5. Only then resume rebuilding/wiring canonical logic, scenarios and business requirements.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
