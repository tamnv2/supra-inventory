# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F13_F21_F22_RUNTIME_PASS__F14_F19_F20_F23_SOURCE_IN_PROGRESS`
- SQLite schema: `5`
- Web: `WEB_P1_RUNTIME_PASS__F14_SLA_CLOCK_F23_DIAGNOSTICS_SOURCE_IN_PROGRESS`
- Android: `VC39_RUNTIME_BASELINE__F14_SLA_CLOCK_F23_DIAGNOSTICS_SOURCE_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc39`
- Operational V2 runtime: `4/4`.

## Proven baseline

- F01–F13/F21–F22 automated runtime/release baseline remains PASS.
- Signed Android baseline remains `beta-vc39`.

## Current source package — F14/F19/F20/F23

Branch `fix/sla-archive-insights-diagnostics` implements:
- Reporter queue `server_now` plus absolute warning/escalation deadlines, with locally advancing Web/PDA SLA presentation and no API polling ticker;
- operational insights maximum 60-day window and SQL aggregate SLA warning/escalated counts;
- existing archive tabs extended with batch version/recurrence and immutable result/ACK lifecycle evidence;
- retention cleanup covers associated result ACKs, result snapshots, realtime rows and notification delivery attempts before deleting archived hot batches;
- bounded/redacted Web support-log JSON and PDA support diagnostics/share surface.

Protected PR regression/typecheck/build/runtime/release gates are pending.

## Next

1. Run protected PR authority/continuity plus all source regression/build gates.
2. Repair until all gates PASS.
3. Merge and verify matching Beta deploy/runtime smoke.
4. Because Android diagnostics/SLA source changed, verify the matching signed Beta release gate.
5. Record runtime/release continuity, then continue physical/load acceptance.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
