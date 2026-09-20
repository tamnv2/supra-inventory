# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is project state, Owner decisions, affected specs, scope/resource registry and current source/CI.

## 1. Current canonical markers

- SQLite schema: `7`
- Latest signed Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V12__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `BETA_RUNTIME_PASS_D087_AGENT_V12_RELEASE__OWNER_FIELD_TEST_PENDING`
- Active workstream: `XAC_NHAN_DON_D087`
- Stable: `OWNER_GATED`

## 2. D087 exact checkpoint

D087 Windows Agent v12 is technically released and ready for Owner physical review.

Evidence:
- Runtime/code PR: #94
- Runtime/code main commit: `8b0e3ec3fd1a6fffea09e3f4aafd43e544625f58`
- Project State Guard: `35495453237` — PASS
- Repo Authority Guard: `35495453239` — PASS
- Deploy Beta RTDB Rules: `35495453228` — PASS
- Verify Beta Relay Agent: `35495453233` — PASS
- UI Design Guard: `35495453255` — PASS
- Verify Beta Android: `35495453242` — PASS
- Agent release tag: `relay-agent-v12` — verified by GitHub ref, VERSION `12`
- Signed Android remains `beta-vc52`; `beta-vc53` is absent.
- Exact v12 release-asset id/size/SHA is not available through the connected GitHub release metadata surface and is intentionally not inferred.

Implemented:
- separate sanitized PDA↔Agent operational audit and technical-AI diagnostic logs;
- overlay construction repaired from the v11 null-initialization failure and settings remain retryable;
- no close/X; explicit minimize-to-Windows-taskbar; protected ADMIN shutdown remains;
- overlay row 1: CPU, Memory, Disk, WiFi/Ethernet throughput + Windows Internet state, GPU where available;
- overlay row 2: total online Agents plus this-process APK received / Agent response counters;
- total online Agents uses minimal ADMIN-only Beta RTDB presence at 30s own-write / 60s list-read / 90s freshness;
- per-machine APK/response counters are RAM-only and never globally synchronized.

## 3. Unchanged boundaries

- D085 sticky ACTIVE/STANDBY model, 3-second leadership heartbeat, about 10-second failover, Picklist cache/single-flight and anti-spam remain unchanged.
- D086 DPAPI CurrentUser WMS session file-first restore and browser fallback remain unchanged.
- D078 final PDA ↔ Agent transport remains pending physical Office-network evidence. Current RTDB remains temporary.
- WMS remains signed read-only GET-only. Confirmation/mutation is not implemented or authorized.
- Stable remains OWNER-GATED.

## 4. Owner physical review — next action

Run released `relay-agent-v12` on the company laptop; use signed `beta-vc52` on PDA where needed.

Review:
1. Open `Cài đặt > Bảng nổi`; it must no longer be permanently gray/disabled.
2. Verify two-row overlay data and locked click-through; unlock and drag.
3. Verify the main window has no X but the minimize control keeps it on the Windows taskbar.
4. Open both log tabs, run a controlled PDA Picklist lookup, and verify operational correlation is in PDA↔Agent log while technical lifecycle/errors are in the technical-AI log, with no credentials/session values.
5. Observe idle and lookup CPU/RAM/Disk/GPU impact on the weak laptop.
6. If multiple Agents are available, verify total online count changes while APK/response counters stay local to each machine.
7. Where practical, recheck D085 failover/cache/anti-spam and D086 saved-session behavior in the same field cycle.

## 5. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue from D087 Owner physical review unless the Owner gives a newer explicit command.

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
