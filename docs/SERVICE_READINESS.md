# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `LEGACY_UI_PARITY_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC41_LEGACY_UI_PARITY_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc41`
- Operational V2 runtime: `4/4`.

## UI parity runtime/release readiness

Legacy UI parity PR #27 is automated runtime/release PASS on main `d52eebe802dc2fb7a581d2118a1d8d9af104f7e0`:
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35299224843`: PASS.
- Deploy Beta run `35299224830`: PASS.
- Verify Beta Android run `35299224857`: PASS.
- Runtime health: SQLite `5/5`, Operational V2 `4/4`.
- Web shell, auth/business guards and Google OAuth smoke: PASS.
- Signed Beta release: `beta-vc41`.
- APK SHA-256: `83f201008b28ec94f23fba643cff7aaff540c1a9d514798928d84da9d5789da9`.

## Next action

Use the deployed Web and signed `beta-vc41` APK for explicit Owner screen-by-screen UI/layout review against the read-only Báo hàng 1291 reference. Fix UI-only mismatches until the Owner UI gate passes. Business logic/scenario rebuild remains deferred until that acceptance.
