# D173-E207 — Agent192 overview: 60/40 + Agent/PickList 65/35

## Owner scope (12/11/2026)
Owner approved the already reviewed WinForms screenshot, and explicitly forbids editing previously PASS/stable behaviors. The approved change is **Agent WinForms presentation only**:
- Preserve the existing outer top-operations versus lower online-session roster **40/60** division and existing lower roster handlers.
- In the top operations region, replace 3 columns with **left 60% / Desktop resources right 40%**.
- Left column: **Agent 65% (top) / PickList 35% (bottom)**; remove the old "Supra | Trang đã tải" summary from this overview.
- Keep existing Web Agent flow; remove the overview's **Desktop Web** launcher. Retain the **same** download, data-folder-open, data-location-change controls/handlers in the Agent action toolbar, visually distinct, with download disabled when the fixed Web Agent browser is ready; do not introduce downloads/requests while ready.
- Agent actions left-to-right: **Chuyển Agent chính → Cập nhật → Xuống nền → Đăng xuất → Tắt Agent**; legacy layout may no longer reorder actions.
- Preserve actions, WMS/Confirm, authenticated sessions, Firestore, HA/Picker, Provider usage cadence, logs, WebView2 Host14, Web, Android, Worker, Firebase, D172, Stable. Never mark an unaffected component PASS merely from code source.

## Implementation boundary and acceptance
- Only edit WinForms overview/table control positioning, button labels/visibility, and Agent version; preserve original click handlers and existing session/authorization guards. A narrow physical viewport may use the existing native-tab fallback to avoid overlapping/clipped controls without hiding actions.
- No Worker, shared auth or D172 business data/resource change.
- Source tests: `tests/d173-e207-agent192-overview-layout.test.mjs`, plus signed-in 5-action order, Web button existing handlers, 60/40 & 65/35 geometry, compact tabs, independent D172 tests. Native Windows x64 build and startup/roster/safety smoke required.
- Release version **Agent192** only after exact accepted-main/source pin, D172/authority and Windows source CI, protected PR merge with scoped release marker, signed `relay-agent-v192` OTA tag and `inventory-channel` EXE/SHA-256 readback.
- **FIELD**: real HD/HD+ and 100/125/150% DPI, top layout, zero overlapping/clipped controls, valid/invalid Web Agent download enablement, all buttons, lower roster and PickList; **Owner PASS** separate and pending.
- The previously observed stale Picker cross-Agent session projection is *not* an E207 fix and is not claimed corrected.

## Evidence references
- Owner instruction and reviewed WinForms mockup in the current conversation, 12/11/2026. No screenshot or private log bytes are committed to the public repo.
- Accepted baseline: main `385875072386c39c612ede14f813dc5ae4dfc7cc`; signed `relay-agent-v191` SHA-256 `6cebc31af550a90b7200bffced6c3b2dacff01e71a3f65641c88ec8d08b8c00f`; Host14 unchanged.
- Working source candidate pin `793af2c84832f9032f23b74d2677b9ebe362b103`.
