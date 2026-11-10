# D173-E179 — Agent178 Tổng quan 50/50, phần trên không cuộn (10/11/2026 VN)

## Owner approval
Owner explicitly approved source-native Agent UI review, then required the following without further questions: upper operational half auto-size/auto-alignment, **no horizontal or vertical scrolling anywhere in the upper half**; lower active-session list **always exactly 50% of the Overview client height**, with vertical scrolling permitted **only in the lower roster DataGridView**; build/test and publish a new signed Agent version. No Web/Android/Worker/D172/Stable release authorization granted by this request.

## Source and technical design
- Existing WinForms net48 form `relay-agent/Program.cs`, partials `D119AgentFeatures.cs`, `D173DesktopResources.cs`, `D173E038Sidebar.cs`, `D173E175NetworkCapability.cs`. New partial `D173E179OverviewNoScroll.cs` reuses the exact current controls and handlers. No HTML runtime, separate WebView2 instance, extra provider call, timer, bridge or credential.
- `overviewLayout` top and bottom: `RowStyles[0,1]` exactly 50%/50%. No absolute-height clamp or 60/40 fallback.
- Main three-column upper viewport at usable width >=1240px: Agent / Supra+PickList / Desktop 40%/37%/23%; upper panels `AutoScroll=false`, upper mini grids `ScrollBars=None`.
- At narrower content width, one native four-tab switcher (Agent/Web/PickList/Tài nguyên) permits the *same existing controls* to occupy the upper half one panel at a time. It replaces the old 725/1165px high vertical overflow mode, does not re-create WebView2 or any network session. Lower roster is always visible.
- Roster actions and filters wrap into two rows and never use horizontal scroll; the large roster table has vertical-only scroll. Non-critical columns are condensed on narrow screens, kept in the underlying DataGridView cells and accessible by double-clicking a session row. Existing Picker role-based row buttons are retained.
- Upper Agent fleet is a compact non-scrollable overview; complete Agent entries remain accessible through the lower roster filter Agent. At short heights its duplicate grid is hidden rather than clipped. Browser auxiliary tools are under one WinForms contextual menu using existing action methods; PickList search/confirm UI and protection unchanged.
- Desktop monitoring uses the existing 1/2/5/10s local-only stream, with CPU/RAM/Disk/Network/GPU and sparkline components retained.

## Risks and test boundaries
- 1280x720 with DPI 100/125/150%, 1600x900, 1920x1080; tray hide/restore; normal/maximized Windows WorkingArea; dark/light theme; primary takeover; overtime banner; missing browser bundle; larger-than-screen data and many concurrent Agent sessions.
- Verify via **real Windows native build and startup-smoke**, confirm no upper clipped actionable control, no horizontal scroll, exact upper/lower 50/50, upper compact-tab navigation, roster vertical-only, PickList result/actions, Agent RBAC, WebView2 in separate host tab and zero extra Cloudflare/Firebase usage. Static tests alone do **not** constitute Windows FIELD_PASS.
- Host13, WMS/CDP automation, Worker/DO, Firestore/RTDB, Android, Web, D172 independent PENDING/HOLD and legacy Stable are unchanged. Owner release requires exact-source CI and a separate signed OTA receipt. E175 Worker/Agent177/Android128 release in progress must be reconciled before Agent178 source promotion.

## Status
OWNER CODE+AGENT-ONLY SIGNED RELEASE AUTHORIZED. CODE CANDIDATE on separate branch; GitHub CI, signed OTA RELEASE, Windows FIELD and final OWNER PASS must be checked independently. No claim of completion without CI and release evidence.
