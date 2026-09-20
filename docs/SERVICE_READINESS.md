# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc53`
- Web: `D088_RUNTIME_PASS__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION__OWNER_REVIEW_PENDING`
- Android/Agent: `D088_RELEASE_PASS__SIGNED_BETA_VC53__1291_BETA__AGENT_V14__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `BETA_RUNTIME_PASS_D088__SIGNED_BETA_VC53__AGENT_V14_RELEASE__OWNER_FIELD_TEST_PENDING`
- Stable: `OWNER_GATED`

## D088 final readiness

Status: **TECHNICAL / RUNTIME / RELEASE PASS — OWNER FIELD REVIEW PENDING**.

Final source/runtime evidence:
- runtime PR #96 → main `8084928724110e7186867b8b16d79462134951aa`;
- release-contract repair PR #97 → final main `48367c46b20405c48abb6ed8c0b59601defe1130`;
- Beta deploy `35506093272` — PASS;
- UI Design Guard `35506093215` — PASS;
- Repo Authority Guard `35506093253` — PASS;
- Project State Guard `35506093199` — PASS;
- Relay Agent build/startup-smoke/release `35506093283` — PASS.

Android:
- `beta-vc53`, release id `392397786`;
- **1291 Beta 0.2.0-beta.53**;
- APK asset `576632055`, 9,333,938 bytes;
- SHA-256 `7cc0f5ec8ae0a9c7e61a985fcb8dcb32cb7e72934407efb4f19a0c7810875fa3`.

Agent:
- `relay-agent-v14`, release id `392399976`;
- product/assembly: **Agent Auto Confirm Pick Pack**;
- canonical GitHub asset: `Agent.Auto.Confirm.Pick.Pack.exe`;
- asset id `576644961`, 168,448 bytes;
- SHA-256 `1aa847dec7e38dc1e67c5d9291ea3cb153ad89cb1afa5eac2ff6ee16b7c2adc2`;
- direct Web Tools download and updater both use the published dotted asset name.

Implemented and guarded:
- Web title **Website nghiệp vụ Inventory**;
- Android label **1291 Beta**;
- shared D088 icon motif across Web/Android/Agent;
- one persistent Web/Android interactive session generation per account; a fresh Web/Android login replaces the prior interactive session;
- separate real-ADMIN Agent auth channel preserving D085 multi-Agent HA;
- Admin/Root `HỆ THỐNG → Công cụ`;
- tray-only Agent minimize/restore;
- unlocked overlay drag + edge/corner resize + numeric width/height + full background/text colors; locked true click-through;
- additive SQLite schema 8 session-generation fields.

## Unchanged boundaries

- D078 final PDA ↔ Agent transport remains pending physical Office evidence; current RTDB is temporary.
- D085 sticky ACTIVE/STANDBY HA, cache and anti-spam remain.
- D086 DPAPI WMS session, protected exit and watchdog remain.
- D087 split logs and bounded Agent presence remain.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.

## Next action

Owner field-reviews released Beta Web + `beta-vc53` + `relay-agent-v14` under OA010.
