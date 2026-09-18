# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `WEB_P1_F14_F20_F23_BETA_RUNTIME_PASS__OWNER_FUNCTIONAL_ACCEPTANCE_PENDING`
- Android: `VC40_F14_F23_SIGNED_RUNTIME_GATE_PASS__PHYSICAL_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc40`
- Operational V2 runtime: `4/4`.

## Automated evidence

- PR #24 merged to main at `c375643687b0f72132ffeba035f724795a1f6280`.
- Repo Authority Guard, Project State Guard, UI Design Guard and Verify Beta Android all PASS for that SHA.
- Deploy Beta run `35295250687` PASS.
- Runtime health: HTTP 200, SQLite `5/5`, Operational V2 `4/4`.
- Auth/business guards, Web shell and Google OAuth start smoke PASS.
- Signed release `beta-vc40` was published only after the matching runtime gate PASS.
- APK SHA-256: `7d87872a090fe825a1d2d0d208c9ceac82f4503b34c0805f9504ed7f3f35eac8`.
- APK size: `9250662` bytes.

## F14/F19/F20/F23 result

- F14: server-calibrated local SLA progression on Web/PDA without API polling.
- F19: archive/retention covers batch version/recurrence plus immutable result/ACK/realtime/notification-attempt lifecycle metadata.
- F20: operational insights are bounded to 60 days and use SQL aggregate SLA counts.
- F23: Web/PDA support diagnostics are bounded and redacted.

## Next

1. Run source/build guards for the legacy UI parity candidate.
2. Deploy the Beta Web UI candidate and publish a signed Beta APK through the existing runtime/release gate.
3. Obtain explicit Owner UI/layout acceptance screen-by-screen.
4. Only after the UI gate passes, continue rebuilding/wiring canonical logic, scenarios and business requirements.
5. Resume physical FCM/device/load acceptance after the functional rebuild.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
