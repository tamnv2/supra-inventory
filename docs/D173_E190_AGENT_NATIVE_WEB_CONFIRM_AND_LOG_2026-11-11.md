# D173-E190 — Agent native Web Confirm tab + diagnostic intake (Owner 11/11/2026)

## Owner decisions (this change)
1. Increase **sanitized Agent login + Web tab** diagnostics so later field logs can identify a real failure; never log passwords, Firebase tokens, WMS cookies/DOM text, CDP URLs, query params or screenshots.
2. **Header overlap: proposal only, deployment deferred.** Source shows `SetAgentAuthUi` leaves `_agentAuthStatus.Visible` from a failed attempt after next successful login. Proposed fix: hide stale error status on successful login, and measure header/toolbar layout responsively at HD/HD+, including DPI changes. Review native layouts and field proof **before** integration. An older Draft PR #918 holds exploratory code only; this PR does not include that header change.
3. **Build a new browser component** attached to the Agent's own Web Confirm tab, optimized for long-lived WMS sign-in/Confirm. Browser engine is not fixed by Owner. Engineer choice: retained fixed Chromium/WebView2 because WMS UI/CDP/new-window and installer are already supported; replace the faulty cross-process HWND shell entirely with a same-process WinForms WebView2 child.

## Canonical baseline and failure evidence
- Main source SHA at branch: `cbd534092fb496497638af972c962db1784db31e`. Signed Agent186 release published on 11/11 at 12:23:19 UTC; Agent186 FIELD FAIL reported by Owner, not mistaken for test PASS.
- Existing Host14 emits DOM/popup ACK but *no physical paint proof*; v186 screenshot is blank after login. The old `SetParent` and Host14 owned top-level overlay both fail user field verification; component replacement is justified, not a claim that any new engine guarantees visual PASS.
- New branch `feat/d173-e190-native-tab-browser-log-20261111`, Draft PR #919, dedicated **D173 Agent only**. No changes to D172-specific data, Cloudflare Workers, Firebase Auth/provider data, Web product, Android, Stable or any remote WMS system.

## Source implementation candidate
- `relay-agent/AgentTabWebView2Browser.cs`: WebView2 WinForms **in-process tab child**; uses installed Fixed Runtime and the **same dedicated WMS profile**. One `about:blank` target is created so the existing `SupraConfirmBrowser` CDP adapter performs the canonical WMS navigation; no new WMS API nor new login/Confirm business protocol.
- `relay-agent/AgentFormE190Web.cs`: UI-thread WinForms lifecycle bridge. No foreign HWND ownership, no `SetParent`, no window overlay or second Agent executable. Explicit input protection ACK, window/tab show/hide without WMS reload. Renderer failure fails closed.
- Original same-origin real WMS new-window/opener behavior and D167 read-only SKU export side-view reproduced; old external host remains as historic/rollback source only and is **not** started for Agent mode. Desktop mode remains separate.
- Bounded diagnostic signals: `E190_AUTH` role probe HTTP status / Firebase category / elapsed milliseconds; `E190_WEB` renderer init, classified host navigation result, popup/child status, viewport class, privacy-safe sampled in-memory paint (all-white vs non-white, no pixel/file retained), input shield state, renderer failure. No extra Cloudflare or Firebase usage for logging.
- New browser still uses Chromium subprocesses and CDP; `in-process` refers to WinForms host ownership, **not** a single Chromium OS process. Resource and performance improvements are hypotheses until measured on the actual machines.

## CI and field criteria
- Exact source native **Windows x64** compile of Agent with WebView2 SDK, existing Host14 bundle installer guard, source tests for old CDP business parity, role auth security and D172 isolation.
- Physical on each of 3 affected Agents: authenticate ordinary and privileged role; WMS login -> dashboard -> genuine popup -> Confirm list; observed page visible; conditional `paint` screenshot proof; PRIMARY/NEXT role, idle >2h and ideally long shift; tray, RDP, DPI 100/125/150%, reconnect, signed logout/exit, D167 SKU export guard. Compare CPU/RAM, initial page latency and post-login stability against v186.
- Never infer a true physical UI pass from `NavigationCompleted`, `WMS DOM READY`, remote debugging connection, in-memory screenshot metric or CI alone.
- A download/runtime failure must fail closed. Do not auto-reload/duplicate WMS Confirm during uncertain post-click state.
- **Release boundary:** CODE ONLY until exact-source CI verified + Owner's explicit release command. Signed Agent186 remains Production. **FIELD/OWNER PASS: PENDING.**

## Current risks / unknowns
- Source-to-binary and Windows render proof not yet confirmed at initial checkpoint; actual three-machine v186 postrelease logs were not supplied to this change.
- In-process WebView2 requires a valid x64 loader, compatible signed runtime, UI STA thread and a consistently acquired single profile. A failure is not an excuse to silently start the old overlay or bypass protection.
- Stored password correctness cannot be determined solely from HTTP 400. Prefer structured Firebase error code and authorized account state before password/account mutation.
