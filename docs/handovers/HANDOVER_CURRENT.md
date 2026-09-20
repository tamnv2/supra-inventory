# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is project state, Owner decisions, affected specs, scope/resource registry and current source/CI.

## 1. Current canonical markers

- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc53`
- Web: `D088_RUNTIME_PASS__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION`
- Android/Agent: `D088_SIGNED_BETA_VC53__1291_BETA__AGENT_V14_RELEASE_REPAIR_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `D088_RUNTIME_PASS__SIGNED_BETA_VC53__AGENT_V14_RELEASE_REPAIR_PENDING`
- Active workstream: `XAC_NHAN_DON_D088`
- Stable: `OWNER_GATED`

## 2. D088 checkpoint

The eight D088 source requirements are implemented and main `8084928724110e7186867b8b16d79462134951aa` passed Beta deploy/UI/Android release:
- Web **Website nghiệp vụ Inventory**.
- Android **1291 Beta**, signed `beta-vc53`.
- one persistent server-authoritative interactive Web/Android session; new Web/Android login replaces older interactive session;
- separate real-ADMIN Agent auth channel preserving D085 multi-Agent HA;
- Admin/Root **HỆ THỐNG → Công cụ**;
- tray-only Agent minimize;
- resize/color configurable unlocked overlay with locked click-through;
- shared D088 icon motif.

Evidence: Beta deploy `35505678533`, UI `35505678481`, Android `35505678482`; all PASS.

## 3. Agent release normalization repair

`relay-agent-v13` was published and startup-smoke PASS, but GitHub normalized the spaced asset filename to `Agent.Auto.Confirm.Pick.Pack.exe`. The v13 updater expected the spaced name. Detected before Owner field acceptance.

Current branch `fix/d088-agent-release-asset-normalization` advances final D088 Agent target to `relay-agent-v14`:
- Windows assembly/product title remains **Agent Auto Confirm Pick Pack**.
- updater/release direct-link contract uses GitHub's actual `Agent.Auto.Confirm.Pick.Pack.exe`.
- pre-D088 legacy alias remains only for updater compatibility.

## 4. Immediate next action

`v14 repair PR → all guards PASS → merge → relay-agent-v14 release PASS → verify release asset/direct Tools download → final canonical D088 checkpoint`.

Then Owner field review OA010 uses `beta-vc53` + `relay-agent-v14`.

D078 final transport remains pending; current RTDB stays temporary. WMS remains GET-only. Stable remains OWNER-GATED.

## 5. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue D088 from the latest canonical checkpoint unless the Owner gives a newer explicit command.

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
