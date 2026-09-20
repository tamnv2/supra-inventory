# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Current signed Beta APK: `beta-vc53`
- Current released Agent: `relay-agent-v14`
- D089 Agent target: `relay-agent-v15`
- D089 status: **SOURCE CANDIDATE / CI PENDING**
- Stable: `OWNER_GATED`

## D089 candidate readiness

Implemented source corrections:
- shared exact Owner-selected icon #4 for Web/Android/Agent;
- HTTP service status separated from realtime status;
- complete Tools dark-theme surfaces;
- Overlay master visibility plus persisted granular Laptop/Agent metric options;
- per-user single-instance Agent contract with duplicate-launch restore;
- Agent v15 candidate;
- next signed Android Beta release required because launcher resource changed.

Not yet claimed:
- PR guards PASS;
- Beta runtime deploy PASS for D089;
- signed Android D089 release;
- relay-agent-v15 release;
- Owner physical re-test.

## Previous released baseline

D088 remains the currently released baseline until D089 merges/releases:
- Web/Worker main source checkpoint: `48367c46b20405c48abb6ed8c0b59601defe1130`
- signed Android: `beta-vc53`
- Agent: `relay-agent-v14`

## Unchanged boundaries

- D078 transport selection pending; current RTDB temporary.
- WMS GET-only; no mutation.
- Stable OWNER-GATED.

## Next action

Run D089 branch → PR → guards → merge → runtime/artifact verification → final canonical release checkpoint.
## Canonical exact markers

- SQLite schema: `8`
- Latest Beta APK: `beta-vc53`
- Web: `D089_SOURCE_CANDIDATE__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON__CI_PENDING`
- Android: `D089_SOURCE_CANDIDATE__1291_BETA_APPROVED_ICON__NEXT_SIGNED_RELEASE_PENDING__AGENT_V15_TARGET__TRANSPORT_SELECTION_PENDING`
- Beta: `D089_SOURCE_CANDIDATE__FIELD_REPAIR_CI_PENDING__SIGNED_BETA_VC53_CURRENT__AGENT_V15_TARGET`

