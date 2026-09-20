# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `7`
- Latest signed Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V12__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `BETA_RUNTIME_PASS_D087_AGENT_V12_RELEASE__OWNER_FIELD_TEST_PENDING`
- Stable: `OWNER_GATED`

## D087 Agent v12 readiness

Status: **TECHNICAL RELEASE PASS / OWNER PHYSICAL REVIEW PENDING**.

Release evidence:
- PR #94 merged to `main`: `8b0e3ec3fd1a6fffea09e3f4aafd43e544625f58`
- Project State Guard `35495453237` — PASS
- Repo Authority Guard `35495453239` — PASS
- Beta RTDB Rules `35495453228` — PASS
- Verify Beta Relay Agent `35495453233` — PASS
- UI Design Guard `35495453255` — PASS
- Verify Beta Android `35495453242` — PASS
- Release tag `relay-agent-v12` exists and resolves to VERSION `12`.
- Android release remains `beta-vc52`; `beta-vc53` is absent.
- Exact v12 binary asset metadata is not exposed by the connected GitHub release surface and is therefore not invented.

Implemented and guarded:
- separate sanitized PDA-Agent audit and technical-AI logs;
- null-safe/retryable overlay initialization;
- no normal X plus explicit taskbar minimize;
- Laptop overlay metrics from local Windows sources;
- Agent overlay: total online Agents plus RAM-only local request/response counters;
- minimal Agent presence only: 30s write / 60s read / 90s freshness;
- no globally synchronized APK/response counters;
- D085 HA/anti-spam and D086 DPAPI session behavior preserved;
- WMS remains GET-only.

## D078 transport readiness

Status: **PENDING PHYSICAL OFFICE EVIDENCE**.

- Current Beta RTDB remains temporary.
- D087 presence does not select or approve the final PDA ↔ Agent transport.
- Do not provision/switch final transport before D078 evidence.

## Security/read-only boundary

- Neither local log may contain password, access/ID/refresh token, Authorization/Bearer, cookies, API keys, WMS session/header/signature values, private/signing keys or raw WMS response payloads.
- Company WMS credentials remain browser-only.
- WMS confirmation/mutation remains forbidden/not implemented.
- Stable remains OWNER-GATED.

## Next action

Owner field-reviews released `relay-agent-v12` with signed `beta-vc52` on the company laptop/PDA.
