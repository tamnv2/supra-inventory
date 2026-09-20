# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is project state, Owner decisions, affected specs, scope/resource registry and current source/CI.

## 1. Current canonical markers

- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc53`
- Web: `D088_RUNTIME_PASS__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION__OWNER_REVIEW_PENDING`
- Android/Agent: `D088_RELEASE_PASS__SIGNED_BETA_VC53__1291_BETA__AGENT_V14__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `BETA_RUNTIME_PASS_D088__SIGNED_BETA_VC53__AGENT_V14_RELEASE__OWNER_FIELD_TEST_PENDING`
- Active workstream: `XAC_NHAN_DON_D088`
- Stable: `OWNER_GATED`

## 2. D088 final checkpoint

D088 eight-item change set is **technical/runtime/release PASS**.

Released behavior:
1. Web product name: **Website nghiệp vụ Inventory**.
2. Android Beta app: **1291 Beta**.
3. Windows product: **Agent Auto Confirm Pick Pack**.
4. Web + Android share one persistent server-authoritative interactive session per account; a fresh Web/Android login invalidates older interactive sessions. Agent uses a separate real-ADMIN auth channel to preserve D085 multi-Agent HA.
5. Admin/Root Web exposes **HỆ THỐNG → Công cụ** with current Agent information, direct official download and usage guide.
6. Unlocked overlay supports drag, edge/corner resize, numeric width/height and full background/text colors; locked state remains true click-through.
7. Agent minimize is System-Tray-only; tray restore returns the main window; no normal X; protected ADMIN exit remains.
8. Web, Android and Agent use the selected D088 icon motif.

## 3. Exact release evidence

Final main: `48367c46b20405c48abb6ed8c0b59601defe1130`.

Main gates:
- Beta deploy `35506093272` — PASS
- UI Design Guard `35506093215` — PASS
- Repo Authority Guard `35506093253` — PASS
- Project State Guard `35506093199` — PASS
- Verify Beta Relay Agent `35506093283` — PASS

Android:
- `beta-vc53`, release id `392397786`
- APK asset id `576632055`
- SHA-256 `7cc0f5ec8ae0a9c7e61a985fcb8dcb32cb7e72934407efb4f19a0c7810875fa3`

Agent:
- `relay-agent-v14`, release id `392399976`
- GitHub asset `Agent.Auto.Confirm.Pick.Pack.exe`, id `576644961`
- size `168448` bytes
- SHA-256 `1aa847dec7e38dc1e67c5d9291ea3cb153ad89cb1afa5eac2ff6ee16b7c2adc2`
- Windows product/assembly remains **Agent Auto Confirm Pick Pack**; dotted filename is GitHub's published release-asset normalization.

## 4. Unchanged boundaries

- D078 final transport remains pending physical Office-network evidence. Current Beta RTDB remains temporary.
- D085 sticky ACTIVE/STANDBY, 3-second heartbeat, about 10-second failover, cache and anti-spam remain.
- D086 DPAPI session/protected exit/watchdog and D087 split logs/presence remain.
- WMS remains signed read-only GET-only; confirmation/mutation is not implemented or authorized.
- Stable remains OWNER-GATED.

## 5. Owner field review — next action

Use live Beta Web, signed `beta-vc53` and released `relay-agent-v14`:
- verify visible names/icons;
- close/reopen the same Web/Android client and confirm the valid session restores;
- login the same account freshly on the other Web/Android client and confirm the old interactive session is rejected on next authenticated activity;
- verify `HỆ THỐNG → Công cụ` downloads the Agent;
- verify tray-only minimize/restore;
- verify overlay resize/colors persist and locked click-through reaches the underlying object;
- observe weak-laptop idle footprint and, where practical, recheck D085 HA behavior.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue from D088 Owner field review unless the Owner gives a newer explicit command.

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
