# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `7`
- Latest signed Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V11__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `BETA_RUNTIME_PASS_D086_AGENT_V11_RELEASE__OWNER_FIELD_TEST_PENDING`
- Stable: `OWNER_GATED`

## D086 Agent v11 readiness

Status: **TECHNICAL RELEASE PASS / OWNER PHYSICAL REVIEW PENDING**.

Release evidence:
- PR #92 merged: `207a57be6c4d95ab48d174b8af154f122bec7c5e`
- Verify Beta Relay Agent main run: `35490227885` — PASS
- UI Design Guard main run: `35490227907` — PASS
- Release: `relay-agent-v11` / id `392316320`
- EXE asset: id `576140376`, `148992` bytes
- EXE SHA-256: `dce3a779c86096a6a82ed1991e385e7e6acea2d9ba75078e8bf2371eb1387659`
- Android remains signed `beta-vc52`.

Implemented and CI-verified:
- local WMS request-session persistence uses DPAPI `CurrentUser` encryption;
- startup validates saved session and preloads all-date Picklist before browser fallback;
- invalid/expired saved session is cleared before local browser reacquisition;
- successful real WMS preload/refresh renews the encrypted file;
- Agent UI is split into `Tổng quan / Cài đặt`;
- locked overlay uses cross-process click-through behavior;
- normal title-bar shutdown is removed; graceful exit uses the authenticated ADMIN's protected local verifier;
- HKCU autostart remains; watchdog provides best-effort unexpected-exit restart;
- old continuous ~4-second SSID/netsh polling is removed;
- D085 3-second heartbeat/~10-second failover/cache/anti-spam semantics remain;
- WMS remains signed GET-only with mutation disabled.

Field-only checks still required:
- actual company-laptop UI review;
- valid saved-session restart without browser;
- invalid-session browser fallback;
- click-through over a real desktop/app control;
- protected exit;
- watchdog restart after killing only the main process;
- weak-laptop idle CPU/RAM;
- D085 multi-Agent ACTIVE/STANDBY behavior and anti-spam where practical.

User-mode limitation remains explicit: the same Windows user can still kill both Agent and watchdog. Absolute anti-kill behavior is not claimed.

## D078 transport readiness

Status: **PENDING PHYSICAL OFFICE EVIDENCE**.

- Current Beta RTDB remains temporary.
- D086 does not select or replace the PDA ↔ Agent transport.
- Do not provision/switch final transport before D078 evidence.
- This workstream does not create an offline Báo hàng business mode.

## Security/read-only boundary

- Never commit/log passwords, tokens, WMS session values, signing material or the encrypted WMS session file.
- Company WMS credentials remain browser-only.
- WMS confirmation/mutation remains forbidden/not implemented.
- Stable remains OWNER-GATED.

## Next action

Owner field-reviews `relay-agent-v11` with signed `beta-vc52` on the company laptop/PDA. Any newer explicit Owner command supersedes this order.

Canonical details:
- `ops/project-state.json`
- `ops/resource-registry.json`
- `ops/owner-actions.json`
- `docs/OWNER_DECISIONS.md`
- `docs/specs/`
