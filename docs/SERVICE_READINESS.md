# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `WEB_P1_F14_F20_F23_BETA_RUNTIME_PASS__OWNER_FUNCTIONAL_ACCEPTANCE_PENDING`
- Android: `VC40_F14_F23_SIGNED_RUNTIME_GATE_PASS__PHYSICAL_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc40`
- Operational V2 runtime: `4/4`.

## Runtime/release readiness

F14/F19/F20/F23 are automated runtime/release PASS on main `c375643687b0f72132ffeba035f724795a1f6280`:
- Deploy Beta run `35295250687`: PASS.
- UI Design Guard: PASS.
- Verify Beta Android: PASS.
- Runtime health: SQLite `5/5`, Operational V2 `4/4`.
- Web shell, auth/business guards and Google OAuth smoke: PASS.
- Signed Beta release: `beta-vc40`.
- APK SHA-256: `7d87872a090fe825a1d2d0d208c9ceac82f4503b34c0805f9504ed7f3f35eac8`.

## Next action

Validate the legacy UI parity source candidate, then deploy the Beta Web candidate and publish the signed Android/PDA candidate through the existing gates. Explicit Owner UI/layout acceptance is required before canonical business logic/scenario rebuild resumes.
