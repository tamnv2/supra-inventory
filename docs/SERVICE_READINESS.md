# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `7`
- Latest signed Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V12_SOURCE_CANDIDATE__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `BETA_SOURCE_D087_AGENT_V12__PR_GATES_PENDING__OWNER_FIELD_TEST_PENDING`
- Stable: `OWNER_GATED`

## D087 Agent v12 readiness

Status: **SOURCE CANDIDATE / PR GATES PENDING**.

Source changes:
- two sanitized local log streams: PDA-Agent operational audit and technical-AI diagnostics;
- overlay construction null-safe and retryable instead of permanently disabling settings after one fault;
- no normal X plus explicit minimize-to-taskbar;
- two-row overlay with local laptop metrics and Agent status;
- local APK/response counters are RAM-only;
- total Agent online uses minimal ADMIN-only RTDB presence at 30s write / 60s read / 90s freshness;
- laptop metrics are local Windows reads and do not create Cloudflare/Firebase/WMS provider polling;
- WMS remains GET-only and D078 transport selection remains pending.

## D086/D085 retained

DPAPI WMS file-first restore, protected shutdown, watchdog/autostart, sticky ACTIVE/STANDBY, 3s leader heartbeat, ~10s failover, Picklist cache and anti-spam remain required regressions.

## Security boundary

Neither log may contain passwords, access/ID/refresh tokens, Authorization/Bearer, cookies, API keys, WMS session/header/signature material, private/signing keys or raw full WMS payloads. Stable remains OWNER-GATED.

## Next action

Complete D087 PR gates, merge and publish `relay-agent-v12`; then perform Owner physical field review. Signed Android remains `beta-vc52`.
