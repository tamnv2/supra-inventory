# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Current signed Beta APK: `beta-vc54`
- Current released Agent: `relay-agent-v15`
- D089 status: **TECHNICAL / RUNTIME / RELEASE PASS — OWNER FIELD RETEST PENDING**
- Stable: `OWNER_GATED`

## D089 runtime/release readiness

PASS:
- exact approved icon #4 stored as verified PNG binary and shared by Web/Android/Agent;
- HTTP service state separated from realtime transport state;
- Tools dark-theme completion;
- Overlay master visibility plus persisted granular Laptop/Agent metric options;
- per-user single-instance Agent with duplicate-launch restore;
- PR #99 authority/state/RTDB/UI/Agent/Android gates;
- main Beta Worker deploy, UI, authority/state, Agent release and Android signed release.

Main source: `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.

Artifacts:
- `relay-agent-v15` — EXE SHA-256 `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- `beta-vc54` — APK SHA-256 `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.

## Remaining field-dependent acceptance

`OA011` remains pending because connected tools cannot physically validate:
- exact icon appearance on the Owner's Web/PDA/Windows surfaces;
- the visible Service/Realtime behavior under a real realtime interruption;
- physical dark-theme review;
- overlay interaction/persistence on the company laptop;
- duplicate EXE launch restoring the existing tray-hidden Agent.

## Unchanged boundaries

- D078 transport selection pending; current RTDB temporary.
- WMS GET-only; no confirmation/mutation.
- Stable OWNER-GATED.

## Next action

Owner field-retests D089 per `OA011` and reports items 1–5 OK/not OK.

## Canonical exact markers

- Latest Beta APK: `beta-vc54`
- Web: `D089_RUNTIME_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON__OWNER_FIELD_RETEST_PENDING`
- Android: `D089_RELEASE_PASS__SIGNED_BETA_VC54__APPROVED_ICON__OWNER_FIELD_RETEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `D089_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC54__AGENT_V15__OWNER_FIELD_RETEST_PENDING`
