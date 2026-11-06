# D173-E147 — E146 Agent WebView2 helper-window source CI receipt (07/11/2026 VN)

**Scope:** Docs-only verification of E146 PR851. There is NO Agent release/OTA/Windows field acceptance here. Agent168 and Host12 signed production artifacts remain unchanged.

## Verified exact source commit

- Draft [PR851](https://github.com/tamnv2/supra-inventory/pull/851) code + native Windows workflow source SHA **`1c52507d5e15d6d5857fb6576236c6ba8d86f8fd`**.
- At that exact SHA GitHub reported **50 checks: 36 SUCCESS, 14 SKIPPED, 0 FAILURE, 0 RUNNING**.
- Windows `relay-agent` job SUCCESS. `D173 E146 verify Agent WebView2 helper-window isolation` SUCCESS; `Build lightweight Windows Agent` SUCCESS; existing Host12 build and native UI smoke SUCCESS.
- Native compile and source regex tests do **not** establish actual Windows desktop taskbar HWND/PID field observation. Owner screenshot E119 recurrence on Agent168 remains **FIELD FAIL**. A newer release has not been authorized/published.
- No Worker/Web/Android/Gateway/Firebase/D172 provider deployment was part of this PR. D172 independent PENDING/HOLD and Stable OWNER-GATED.

## Next gate

- Explicit Owner approval for a strictly **Agent-only new signed version/OTA** after review; version bump and release gate required. Do not republish Agent168 with a silently changed binary.
- Field test after an authorized release: cold start/auto startup/login; embedded WebView2 Confirm with protected input and lock/unlock; taskbar/Alt+Tab no `.NET-BroadcastEventWindow` or `GDI+ Window`; exit/minimize/restore; WMS login/Confirm, SKU read-only side view and HA/PRIMARY on actual Windows 10/11.
- Confirm operating process PID/HWND if the symptom persists and do not force-close framework helper windows.

**Status:** E146 source/native CI PASS; new signed RELEASE PENDING; physical FIELD PASS PENDING; OWNER PASS PENDING.
