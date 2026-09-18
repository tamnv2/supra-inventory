# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `LEGACY_UI_PARITY_HORIZONTAL_NAV_TOPBAR_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC42_LEGACY_UI_PARITY_FIXED_HEADER_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc42`
- Operational V2 runtime: `4/4`.

## Automated evidence

- Legacy UI parity structural repair PR #29 merged to main at `d09d91583aa8f664406648c40c70e26438302375`.
- Web horizontal navigation and legacy login/topbar composition are active.
- Android operational header is fixed, full-width, 76dp and outside scrolling content.
- Repo Authority Guard, Project State Guard and UI Design Guard PASS.
- UI Design Guard run `35305421811` includes explicit horizontal-navigation/fixed-header regressions.
- Deploy Beta run `35305421857` PASS.
- Runtime health: HTTP 200, SQLite `5/5`, Operational V2 `4/4`.
- Auth/business guards, Web shell and Google OAuth start smoke PASS.
- Verify Beta Android run `35305421853` PASS.
- Signed release `beta-vc42` published only after the matching runtime gate PASS.
- APK SHA-256: `687a82d9a630aa301a4c875ea6218d5c12d050be10dfca40fd824917c35cb264`.
- APK size: `9250662` bytes.

## UI-first gate

- Read-only visual/layout reference: `tam95supra-source/bao-hang-1291`.
- Web and Android/PDA visual shell is deployed/released for Owner review.
- UI/layout acceptance is still Owner-dependent and must not be inferred from CI success.
- Business logic/scenario rebuild remains deferred until explicit Owner UI acceptance.

## Next

1. Review deployed Web and signed `beta-vc42` screen-by-screen.
2. Record each screen as accepted or rejected.
3. Repair only remaining UI/layout mismatches until the UI gate passes.
4. Only then resume rebuilding/wiring canonical logic, scenarios and business requirements.
5. Physical FCM/device/load acceptance follows the functional rebuild.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
