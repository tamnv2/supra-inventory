# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live/source status is `ops/project-state.json`; resource identity/evidence is `ops/resource-registry.json`. Fresh-bootstrap `ops/authority-manifest.json` before mutation.

## Current markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc53`
- Web: `D088_RUNTIME_PASS__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION`
- Android/Agent: `D088_SIGNED_BETA_VC53__1291_BETA__AGENT_V14_RELEASE_REPAIR_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `D088_RUNTIME_PASS__SIGNED_BETA_VC53__AGENT_V14_RELEASE_REPAIR_PENDING`
- Stable: `OWNER_GATED`

## D088 runtime/release checkpoint

Runtime/UI/Android are PASS on main `8084928724110e7186867b8b16d79462134951aa`:
- Beta deploy run `35505678533` — PASS; schema 8/runtime Web/service gates passed.
- UI Design run `35505678481` — PASS.
- Verify Beta Android run `35505678482` — PASS.
- Signed Android release `beta-vc53`, name **1291 Beta 0.2.0-beta.53**.
- APK asset id `576632055`, size `9333938`, SHA-256 `7cc0f5ec8ae0a9c7e61a985fcb8dcb32cb7e72934407efb4f19a0c7810875fa3`.

Transitional `relay-agent-v13` built/startup-smoked and published, but GitHub normalized the spaced release filename to `Agent.Auto.Confirm.Pick.Pack.exe`. The v13 updater expected the spaced asset name. This was detected before Owner field acceptance/download. Final D088 Agent target is therefore `relay-agent-v14`, using the actual normalized GitHub asset name while the Windows assembly/product remains **Agent Auto Confirm Pick Pack**.

## Unchanged boundaries

- Current PDA ↔ Agent RTDB carrier remains temporary; D078 final transport selection is pending physical Office evidence.
- D085 HA/cache/anti-spam, D086 DPAPI/protected exit/watchdog, D087 split logs/presence remain.
- WMS remains signed GET-only; no confirmation/mutation is authorized.
- Stable remains OWNER-GATED.

## Next action

Finish `fix/d088-agent-release-asset-normalization` through PR/CI/merge and publish `relay-agent-v14`; verify the Web Tools direct download and updater asset lookup, then record final D088 release PASS.
