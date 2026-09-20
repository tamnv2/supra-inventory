# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation. Canonical authority is project state, Owner decisions, affected specs, scope/resource registry and current source/CI.

## 1. Current canonical markers

- SQLite schema: `7`
- Latest Beta APK: `beta-vc52`
- Web: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`
- Android/Agent: `D085_RELEASE_PASS__SIGNED_BETA_VC52__AGENT_V12_SOURCE_CANDIDATE__OWNER_FIELD_TEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta checkpoint: `BETA_SOURCE_D087_AGENT_V12__PR_GATES_PENDING__OWNER_FIELD_TEST_PENDING`
- Active workstream: `XAC_NHAN_DON_D087`
- Stable: `OWNER_GATED`

## 2. D087 exact checkpoint

Owner field evidence from released v11 showed overlay initialization failing with a sanitized `NullReferenceException`; the same log showed ADMIN/Firebase restore, DPAPI WMS session restore, read-only Picklist preload, Agent HA and real Picklist ACK continuing to work.

D087 Agent v12 source candidate:
- fixes overlay construction to be null-safe during base WinForms initialization;
- overlay settings remains enabled/retryable after a transient failure;
- splits local logs into PDA↔Agent operational audit and technical-AI diagnostics, both with common secret redaction;
- operational audit may contain the approved exact five-digit Picklist suffix plus bounded user/device/request/result correlation, never credentials/WMS session/full response;
- removes the normal X and adds an explicit minimize-to-Windows-taskbar control; protected ADMIN shutdown remains;
- overlay row 1: CPU, Memory, Disk, WiFi/Ethernet throughput + Windows Internet state, GPU where available;
- overlay row 2: total online Agents plus this-machine current-runtime APK received / Agent response counters;
- per-machine counters are RAM-only and never globally synchronized;
- total Agent online uses only minimal existing Beta RTDB presence: 30s own write, 60s list read, 90s freshness.

## 3. Unchanged boundaries

- D085 sticky one-ACTIVE Agent, 3s leader heartbeat, ~10s failover, cache/single-flight and anti-spam remain unchanged.
- D086 DPAPI CurrentUser WMS session file-first restore/browser fallback remains unchanged.
- D078 final PDA↔Agent transport selection is still pending physical Office evidence; current RTDB remains temporary.
- WMS remains signed GET-only. Confirmation/mutation is not implemented or authorized.
- Stable remains OWNER-GATED.

## 4. Next action

Finish D087 branch → PR → Repo Authority/Project State/UI/Agent/RTDB validation → merge → main release of `relay-agent-v12`. Then Owner physically reviews v12 on the company laptop/PDA: overlay/settings, click-through, minimize-to-taskbar, both log streams, local/online Agent counters and idle CPU/RAM/Disk/GPU overhead.

## 5. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ checkpoint hiện tại.**

The AI must fresh-bootstrap GitHub and continue D087 unless the Owner gives a newer explicit command.

No manual end-of-session handover is required. No manual chat-memory reconstruction is authoritative. Stable remains OWNER-GATED.
