# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc57`
- Current released Agent: `relay-agent-v18`
- Beta: `D091_FIRESTORE_INFRA_RUNTIME_PASS__D089_OWNER_ACCEPTED_UI_BASELINE__SIGNED_BETA_VC55__AGENT_V16__PHYSICAL_OFFICE_E2E_PENDING`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D091_SIGNED_BETA_VC55_FIRESTORE_FIELD_CANDIDATE_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`
- D089: **OWNER ACCEPTED PASS**
- Stable: `OWNER_GATED`

## Accepted readiness baseline

Owner acceptance completed on 2026-09-21:
- approved icon #4 across Web/Android/Agent;
- Service/API and realtime status separation;
- dark-theme Tools completion;
- persistent granular Overlay controls;
- per-user single-instance Agent behavior.

Technical/runtime/release evidence was already PASS before Owner acceptance:
- D089 runtime source `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`;
- release checkpoint `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`;
- signed `beta-vc54`;
- `relay-agent-v15`.

`OA011` is closed PASS. There is no remaining D089 field acceptance blocker.

## D090 Office transport evidence

Owner-confirmed field boundary: Office reaches internal Supra plus selected Google services only. Sanitized Agent evidence confirms WMS UI/API and Firebase Auth reachability, repeated RTDB corporate-proxy 403, and transport-layer reachability of Firestore/Apps Script/Sheets/Drive hosts. No further Cloudflare/Worker Office probe is required. A Google-hosted replacement still needs an authenticated Beta relay/HA/quota proof before selection.

## D091 candidate readiness

D091 infrastructure/runtime/release is PASS: Beta Firestore `(default)` is provisioned in `asia-southeast1`; locked Rules were deployed via Firebase Rules Management API and the `cloud.firestore` release readback passed on main run `35548847740`. `relay-agent-v16` and signed `beta-vc55` are released. Only the physical Office round trip remains before evaluating quota-safe HA/failover. The ACK is transport-only and WMS mutation remains forbidden.

## Open boundaries

- D091 Firestore is the active authenticated field candidate. It is not the final selected transport until real Office E2E plus later quota-safe D085 HA/failover validation pass.
- WMS remains GET-only; no confirmation/mutation.
- Stable remains OWNER-GATED.

## Next action

Run the single physical Office D091 transport test with `relay-agent-v16` + `beta-vc55`. PASS requires the PDA `KẾT NỐI PDA ↔ AGENT OK` result and the matching short request ID in the Agent FIRESTORE audit. Preserve the D089 accepted baseline.

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.

## D092 release-state refresh — 2026-09-21

- SQLite schema: `8`.
- Web status: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D092_SIGNED_BETA_VC56_CONFIRMATION_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Latest signed Beta APK: `beta-vc56`.
- Windows Agent: `relay-agent-v17`.
- D092 technical/runtime/release: PASS; OA013 Owner real Picklist confirmation: PENDING.
- Stable: OWNER-GATED / untouched.

## D093 Firestore regression repair checkpoint

- SQLite schema: `8`.
- Latest signed Beta APK is `beta-vc57`; D093 main release is published.
- Web status remains `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D093_SIGNED_BETA_VC57_FIRESTORE_HARDENING_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Firestore remains the selected PDA-Agent carrier from D091 field PASS; D093 repairs D092 relay/HA health without changing architecture.
- OA013 real Picklist confirmation is blocked until OA014 D093 PDA-Agent Firestore regression re-test PASS.
- Stable remains OWNER-GATED.

## D093 release readiness

- Main source `377159ed6722eede6b7716c9c83066b863a4e805` is technical/runtime/release PASS.
- `relay-agent-v18` is published and verified; canonical EXE SHA-256: `96e2cde601f41908e1af10492a4bd8b9e8a47a905ce464d33d4917038838acb7`.
- Signed `beta-vc57` is published and verified; APK SHA-256: `f655844b1222787938cacf169ca2f158630ab536b0a9c252f19f56d60cc3ce19`.
- OA014 is READY_FOR_OWNER_FIELD_TEST. OA013 is blocked until OA014 PASS.
- Stable remains OWNER-GATED.
