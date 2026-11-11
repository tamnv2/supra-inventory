# D173-E188 — Agent186 signed release: Owner Agent185 FIELD FAIL repair (11/11/2026)

## Owner approval and verified base
- Owner explicitly orders **fix all 4 Agent185 FIELD failures and release Agent186**. Same D173 change, independent D172 HOLD, Stable OWNER-GATED.
- Source base: main `8048dab31c0318774926c3d8cdbbf900b26ec76e`, signed Agent185 / Host14 release tag `relay-agent-v185`; PR914 initially analysis-only, now owner approved Agent186 code+protected release.
- FIELD evidence: all three 11/11 manual Agent logs show WMS DOM READY / popup ATTACHED / `paint_proof=UNVERIFIED` with user-visible white Web tab. Microsoft WebView2 Feedback #985 documents blank loaded WinForms WebView2 after parent change using `SetParent`; this is corroborating mechanism, **not direct proof on these machines**. Source: `relay-agent/SupraConfirmBrowser.cs`, `relay-agent/D173E179OverviewNoScroll.cs`, `relay-agent/D119AgentFeatures.cs`.
- Owner's 4 issues: (1) visible WMS Web tab white after login on all agents, (2) exact five-button order, (3) HD/HD+ clipped labels/buttons, (4) live session action-strip auto-size overlap.

## Candidate solution (Agent-only, Host14 unchanged)
1. **Web presentation:** Avoid cross-process `SetParent`/WS_CHILD composition. Keep exact authenticated Host14/Fixed Runtime as a **top-level WS_POPUP/WS_EX_TOOLWINDOW owned by the Agent root HWND**, positioned from Web Confirm viewport ClientToScreen and sized on tab resize/Agent movement; hide on tab switch/tray, restore on Web tab. Verify exact Host PID/HWND and owning Window; no second profile/process, no WMS navigation/click/reload, no alternate provider path. Host14 input shield/OTP/confirmation CDP/real popup semantics unchanged. Host14 manifest SHA `f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2` to be reused without republishing 320MB.
2. **Actions:** visible order `Chuyển Agent chính | Cập nhật | Xuống nền | Đăng xuất | Tắt Agent`; preserve handlers, visibility, RBAC and OTP.
3. **HD/HD+:** measure text/toolbar heights and available area before selecting 34/33/33. Fall back to existing native tabs when impossible; Web button rows wrap when necessary. Preserve overview 40/60 and middle Web/PickList 50/50 when three columns feasible.
4. **Roster auto-size:** do not count the hidden technical checkbox in layout width; remeasure live labels, avoid overlap and keep per-cell/toolbutton tooltips without horizontal scrolling.

## Safety/trade-offs and testing
- New owned popup is presentation-only but has a **Windows z-order/focus risk** across multiple monitors, RDP, modal dialogs and tray. Unlike a child HWND, the display follows coordinates; physical Windows verification is required for FIELD PASS. No assurance of visual repair solely from CI.
- Native Windows x64 Agent build; source tests must catch SetParent reintroduction, WMS role/input shield, 5 actions, portrait/DPI; existing E187 Host14, HA/Confirm, D172 isolation and scope/CI protections must PASS.
- FIELD matrix: all 3 original Agents login→Dashboard popup→Confirm visual+manual interaction, shield/unlock, tab swap/tray/restore/move/RDP, WMS confirmation on PRIMARY, monitor/DPI 1280×720 / 1366×768 / 1600×900 / 1920×1080 at 100/125/150%, 0/3/29/140 sessions, roles and changing counters.
- Code boundary: only `relay-agent/`, Agent-only release workflow, release gate/tests and D173 docs/ops. **No** `relay-agent-webview2-host/` modification, Worker/Web/Android/D172/Stable mutation, new cloud requests, or WMS business change.

## Release stages
- Owner code+signed Agent186 approved: YES. Candidate source and new E188 source regression: PREPARED.
- Exact PR CI: PENDING; source CI must prove native Windows build/HA/input shield and D172 isolation. Pin exact source SHA and work state before release.
- Protected main two-parent merge marker `D173-E188_AGENT186_ONLY_RELEASE:` required; signed release `relay-agent-v186`, inventory-channel EXE/hash readback and Host14 fixed SHA must be verified.
- **FIELD PASS=false, OWNER PASS=false until explicit evidence.** Do not call technical release PASS before actual GitHub release+channel readback.
