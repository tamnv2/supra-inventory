# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Beta runtime/source: `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`
- Current signed Beta APK: `beta-vc54`
- Current released Agent: `relay-agent-v15`
- D089 status: **TECHNICAL / RUNTIME / RELEASE PASS — OWNER FIELD RETEST PENDING**
- Active workstream: `XAC_NHAN_DON_D089`
- Stable: `OWNER_GATED`

## 2. D089 released repairs

1. Exact Owner-selected icon #4 is the shared Web / Android / Agent visual source, committed as verified PNG binary.
2. Web `Dịch vụ` reflects HTTP/API reachability independently from realtime `Đồng bộ` status.
3. `HỆ THỐNG → Công cụ` is fully dark-theme coherent.
4. Agent overlay has master ON/OFF plus persisted granular Laptop and Agent metric checklists, while retaining resize/colors/lock/click-through.
5. Agent enforces one normal runtime per Windows user session; a duplicate EXE launch restores/activates the existing instance instead of creating another Agent/tray/overlay.

## 3. Release evidence

PR #99 merged to main `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.

Final PR gates PASS:
- Repo Authority `35528500471`
- Project State `35528500466`
- RTDB Rules `35528500468`
- UI Design `35528500465`
- Relay Agent `35528500524`
- Android `35528500467`

Final main gates PASS:
- Beta Worker `35528647549`
- UI Design `35528647554`
- Repo Authority `35528647571`
- Project State `35528647574`
- Relay Agent `35528647534`
- Android `35528647526`

Released artifacts:
- `relay-agent-v15`: release id `392528472`; `Agent.Auto.Confirm.Pick.Pack.exe` asset id `577316714`, size `177152` bytes, SHA-256 `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- `beta-vc54`: release id `392528497`; APK asset id `577316797`, size `9340834` bytes, SHA-256 `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.

## 4. Owner field re-test

Use `OA011` and report D089 items 1–5 OK/not OK:
- icon identity across Web/APK/EXE/tray;
- Service vs realtime status;
- Tools dark theme;
- overlay ON/OFF + granular checklist persistence;
- duplicate EXE single-instance restore.

## 5. Unchanged boundaries

- D078 final PDA ↔ Agent transport remains pending physical Office-network evidence; current RTDB is temporary.
- D085 HA/cache/anti-spam remains.
- D086 DPAPI WMS session/protected exit/watchdog remains.
- D087 split logs/bounded presence remains.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và tiếp tục từ D089 RELEASE PASS / OA011 field-retest.**

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.

## Canonical exact markers

- Latest Beta APK: `beta-vc54`
- Web: `D089_RUNTIME_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON__OWNER_FIELD_RETEST_PENDING`
- Android: `D089_RELEASE_PASS__SIGNED_BETA_VC54__APPROVED_ICON__OWNER_FIELD_RETEST_PENDING__TRANSPORT_SELECTION_PENDING`
- Beta: `D089_RUNTIME_RELEASE_PASS__SIGNED_BETA_VC54__AGENT_V15__OWNER_FIELD_RETEST_PENDING`
