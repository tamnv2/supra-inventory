# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc54`
- Current released Agent: `relay-agent-v15`
- Beta: `D089_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC54__AGENT_V15__READY_FOR_NEW_REQUIREMENTS`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D089_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC54__APPROVED_ICON__TRANSPORT_SELECTION_PENDING`
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

## Open boundaries

- D090 closes the Office reachability uncertainty: Cloudflare/Worker is excluded from further Office testing, RTDB is proxy-blocked, and replacement research is Google-hosted only. Firestore is preferred but not selected; current RTDB remains temporary outside Office.
- WMS remains GET-only; no confirmation/mutation.
- Stable remains OWNER-GATED.

## Next action

Fresh-bootstrap GitHub and process the Owner's next explicit requirement. Preserve the D089 accepted baseline unless explicitly superseded.

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.
