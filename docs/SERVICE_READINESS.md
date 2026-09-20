# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live/source status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema source target: `8`
- Latest signed Beta APK currently live: `beta-vc52`
- Web: `D088_SOURCE_CANDIDATE__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION`
- Android/Agent: `D088_SOURCE_CANDIDATE__1291_BETA__SIGNED_RELEASE_PENDING__AGENT_V13_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `D088_SOURCE_CANDIDATE__CI_PENDING__LIVE_D087_AGENT_V12`
- Stable: `OWNER_GATED`

## D088 readiness

Status: **SOURCE CANDIDATE / PR-CI-RELEASE PENDING**.

Implemented on `feat/d088-unified-brand-single-session-tools-overlay`:
- Web product name **Website nghiệp vụ Inventory**.
- Android Beta product name **1291 Beta**.
- Windows utility **Agent Auto Confirm Pick Pack**, target `relay-agent-v14`.
- shared D088 icon motif on Web/Android/Agent;
- one persistent server-authoritative interactive session across Web + Android, with fresh login replacing older Web/Android session;
- separate `AGENT` authentication channel so D085 multi-Agent HA is preserved;
- Admin/Root `HỆ THỐNG → Công cụ` with direct official Agent download and instructions;
- tray-only Agent minimize/restore;
- overlay unlocked drag/resize, numeric width/height, full background/text color selection; locked true click-through;
- additive SQLite schema target 8 for `session_generation` / `session_started_at`.

No D088 runtime/release PASS is claimed until PR guards, main Beta deploy, signed Android publication and `relay-agent-v14` publication all complete.

## Unchanged boundaries

- Current PDA ↔ Agent RTDB carrier remains temporary; D078 final transport selection is pending physical Office evidence.
- D085 sticky ACTIVE/STANDBY HA, 3-second heartbeat, ~10-second failover, cache and anti-spam remain.
- D086 DPAPI WMS session and protected exit/watchdog remain.
- D087 split logs and bounded Agent presence remain.
- WMS remains signed GET-only; no confirmation/mutation is authorized.
- Stable remains OWNER-GATED.

## Next action

Open D088 PR, obtain all required CI PASS, merge, verify Beta runtime + signed Android + Agent v14 releases, then record exact release evidence in a canonical checkpoint.
