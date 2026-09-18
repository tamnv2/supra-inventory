# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `LEGACY_UI_PARITY_HORIZONTAL_NAV_TOPBAR_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC42_LEGACY_UI_PARITY_FIXED_HEADER_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc42`
- Operational V2 runtime: `4/4`.

## UI parity runtime/release readiness

Legacy UI parity structural repair PR #29 is automated runtime/release PASS on main `d09d91583aa8f664406648c40c70e26438302375`:
- Web horizontal tabs below topbar restored from the read-only reference.
- Web login/topbar composition restored toward the legacy reference.
- Android operational header is fixed, full-width, 76dp and outside scroll content.
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35305421811`: PASS.
- Deploy Beta run `35305421857`: PASS.
- Verify Beta Android run `35305421853`: PASS.
- Runtime health: SQLite `5/5`, Operational V2 `4/4`.
- Web shell, auth/business guards and Google OAuth smoke: PASS.
- Signed Beta release: `beta-vc42`.
- APK SHA-256: `687a82d9a630aa301a4c875ea6218d5c12d050be10dfca40fd824917c35cb264`.

## Next action

Use the deployed Web and signed `beta-vc42` APK for explicit Owner screen-by-screen UI/layout review. Repair only UI/layout mismatches until the UI gate passes. Business logic/scenario rebuild remains deferred until that acceptance.
