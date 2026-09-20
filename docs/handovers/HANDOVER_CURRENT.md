# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- SQLite schema: `8`
- Current signed Beta APK: `beta-vc53` (D088 release; D089 next signed release pending)
- Current released Agent: `relay-agent-v14`
- D089 Agent target: `relay-agent-v15`
- Web/Android/Agent D089 field-review repair: **SOURCE CANDIDATE — CI PENDING**
- Active workstream: `XAC_NHAN_DON_D089`
- Stable: `OWNER_GATED`

## 2. Why D089 exists

Owner field review of D088 on 2026-09-20 identified five valid defects:

1. Deployed icon was not the selected icon #4.
2. Web showed `Dịch vụ: Mất kết nối` while authenticated HTTP APIs were returning successfully because realtime offline was incorrectly reused as service-down state.
3. Overlay settings lacked a complete master toggle + per-metric Laptop/Agent checklist.
4. Agent could be launched more than once.
5. `HỆ THỐNG → Công cụ` was not fully coherent in dark theme.

## 3. D089 source candidate

Implemented on branch `fix/d089-field-review-icon-realtime-overlay-singleton-dark`:

- exact selected icon #4 committed as one shared visual source for Web, Android and Agent;
- Web separates `Dịch vụ` from `Đồng bộ`;
- Tools dark surfaces/borders/text/buttons completed;
- Agent overlay adds master ON/OFF and persisted Laptop + Agent granular checklist while retaining resize/colors/click-through;
- per-user named mutex + activation event blocks duplicate Agent runtimes and restores the existing instance;
- Agent build target bumped to v15;
- Android manifest uses the approved D089 launcher asset and therefore requires the next signed Beta release.

## 4. Unchanged boundaries

- D078 final PDA ↔ Agent transport remains pending physical Office-network evidence; current RTDB is temporary.
- D085 sticky ACTIVE/STANDBY HA/cache/anti-spam remains.
- D086 DPAPI WMS session/protected exit/watchdog remains.
- D087 split logs/bounded presence remains.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.

## 5. Next action

Open D089 PR, run authority/state/UI/Web/Android/Agent guards, repair until PASS, merge, verify Beta deployment plus signed Android/Agent v15 releases, then record exact final release evidence in a state-only checkpoint PR.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục D089 từ checkpoint hiện tại.**
## Canonical exact markers

- SQLite schema: `8`
- Latest Beta APK: `beta-vc53`
- Web: `D089_SOURCE_CANDIDATE__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON__CI_PENDING`
- Android: `D089_SOURCE_CANDIDATE__1291_BETA_APPROVED_ICON__NEXT_SIGNED_RELEASE_PENDING__AGENT_V15_TARGET__TRANSPORT_SELECTION_PENDING`
- Beta: `D089_SOURCE_CANDIDATE__FIELD_REPAIR_CI_PENDING__SIGNED_BETA_VC53_CURRENT__AGENT_V15_TARGET`


No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.
