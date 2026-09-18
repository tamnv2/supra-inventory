# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F13_F21_F22_RUNTIME_PASS__F14_F19_F20_F23_SOURCE_IN_PROGRESS`
- SQLite schema: `5`
- Web: `WEB_P1_RUNTIME_PASS__F14_SLA_CLOCK_F23_DIAGNOSTICS_SOURCE_IN_PROGRESS`
- Android: `VC39_RUNTIME_BASELINE__F14_SLA_CLOCK_F23_DIAGNOSTICS_SOURCE_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc39`
- Operational V2 runtime: `4/4`.

## Current source readiness

Implemented on `fix/sla-archive-insights-diagnostics`:
- F14 server-calibrated local SLA progression without polling;
- F19 archive/retention coverage for newer result/ACK/realtime metadata using existing archive surfaces;
- F20 60-day bounded operational insights with SQL aggregate pending SLA counts;
- F23 bounded redacted Web/PDA diagnostics.

Protected PR regression/typecheck/build and matching Beta runtime/release verification are still required.

## Next action

Complete protected PR/CI, matching Beta runtime smoke and matching signed Android release gate for this package.
