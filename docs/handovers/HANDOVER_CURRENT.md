# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is project state, Owner decisions, affected specs, scope/resource registry and current source/CI.

## 1. Current canonical markers

- SQLite schema source target: `8`
- Latest signed Beta APK currently live: `beta-vc52`
- Web: `D088_SOURCE_CANDIDATE__WEBSITE_NGHIEP_VU_INVENTORY__TOOLS__PERSISTENT_SINGLE_SESSION`
- Android/Agent: `D088_SOURCE_CANDIDATE__1291_BETA__SIGNED_RELEASE_PENDING__AGENT_V13_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `D088_SOURCE_CANDIDATE__CI_PENDING__LIVE_D087_AGENT_V12`
- Active workstream: `XAC_NHAN_DON_D088`
- Stable: `OWNER_GATED`

## 2. D088 exact source checkpoint

Owner approved the eight-item D088 Beta change set on 2026-09-20. Source is implemented on branch `feat/d088-unified-brand-single-session-tools-overlay`; PR/CI/merge/release are still pending.

Implemented:
1. Web renamed to **Website nghiệp vụ Inventory**.
2. Android Beta renamed to **1291 Beta**.
3. Windows utility/executable renamed to **Agent Auto Confirm Pick Pack**.
4. Web + Android share one persistent server-authoritative interactive session generation. Reopen restores a valid session; fresh Web/Android login invalidates older interactive generations. Agent has a separate real-ADMIN auth channel so D085 multi-Agent HA is not broken.
5. Admin/Root Web adds **HỆ THỐNG → Công cụ** with current Agent release information, official direct download and usage guidance.
6. Unlocked overlay is draggable/resizable and supports numeric width/height plus full background/text color selection; locked overlay remains true click-through.
7. Agent minimize is System-Tray-only and tray restore returns the window; no normal X; protected exit remains.
8. Shared Owner-selected icon #4 motif is used across Web, Android and Agent.

## 3. Release targets and unchanged boundaries

- Agent target: `relay-agent-v14`; canonical asset `Agent Auto Confirm Pick Pack.exe`.
- Android target: next monotonic signed Beta release after current `beta-vc52`.
- One legacy Agent asset alias may exist on v13 solely for v12 auto-update compatibility.
- D078 final transport remains pending; current RTDB is temporary.
- D085 HA/cache/anti-spam, D086 DPAPI/protected exit/watchdog and D087 split logs/presence remain unchanged.
- WMS remains GET-only. Confirmation/mutation is not implemented or authorized.
- Stable remains OWNER-GATED.

## 4. Immediate next action

Continue the finite D088 execution ladder:
`PR → all guards/builds PASS → merge → Beta deploy PASS → signed Android release PASS → relay-agent-v14 release PASS → canonical release-checkpoint PR`.

After technical release, Owner field review OA010 covers the visible names/icons, reopen-without-login, cross-Web/Android session replacement, Tools download, tray-only minimize/restore and overlay resize/colors/click-through.

## 5. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue D088 from the latest canonical checkpoint unless the Owner gives a newer explicit command.

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
