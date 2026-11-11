# D173-E189 — Agent186 FIELD FAIL: normal login, header overlap, Web Confirm white (11/11/2026)

## Current evidence
- Main source SHA at intake `cbd534092fb496497638af972c962db1784db31e`; v186 signed GitHub Release published 2026-11-11T12:23:19Z, digest `sha256:89932a9f8b704d4814395db059fb6254c6dd9db0b2e3f764804fe7aa623a65c0` matches the public inventory-channel Agent EXE.
- Owner reports FIELD FAIL of **Agent186** (screenshot version), despite v186 release technical PASS. Three issues: ordinary account sign-in HTTP 400, intermittent overlapping Agent header text, blank Web Confirm after WMS sign-in.
- Only earlier **v185** manual logs for three machines were found on registered Drive. They show WMS DOM accessible, popup attached, and `paint_proof=UNVERIFIED`. They do NOT prove exact v186 HWND/paint cause. Do not record any password, employee identity or WMS content.
- Repo v186 source: `relay-agent/Program.cs` uses privileged Worker auth only for pre-approved one-time accounts; ordinary ADMIN/PICKPACK_ADMIN uses two Firebase password probes, with strict signed role/UID checks. Both HTTP 400 probes currently collapse to uninformative `Dictionary` exception. The backend only makes managed Firebase passwords ready on its authorized account provisioning/update path; the affected user’s live Firebase error and synchronization state remain UNVERIFIED.
- `SetAgentAuthUi` updates but does not hide previously visible failed-login notice on success, allowing overlap with `D173E182FitAgentHeader`. This is source-confirmed and corrected.
- v186 WMS host uses WebView2 fixed Host14 with top-level window overlay and cross-process HWND ownership. Static tests prove event wiring, NOT visible paint on target machines.

## Authorized narrow code candidate
1. After successful Agent login, clear only the stale visible auth notification; preserve user/role/Firebase state and the sign-in failure notification.
2. Decode nested Firebase `error.message` instead of printing a .NET Dictionary type. This does **not** change credentials, Firebase provider state, privileges or claim checks and is not claimed as the FIELD login fix.
3. A **new lightweight presentation host** may reuse the supported WebView2 fixed engine, profile, WMS popup/new-window behavior and existing protected CDP session. Writing a new rendering engine or replacing the browser with an unauthorized WMS API client would be heavier and unsafe. A replacement browser is **NOT yet built or source-PASS** in this checkpoint. No switch to the new host can be safe before v186 paint/HWND inspection and the WMS input shield, OTP, HA, real popup and Confirm parity matrix.

## Verification gates and unresolved work
- Agent source static regression: stale label clears after success, failure remains visible; Firebase nested 400 returns sanitised code; current admin role restrictions untouched. CI Windows x64 build still required; do not claim PASS before exact run.
- Investigate actual v186 machine logs: Host14 PID/HWND, owned window visibility, screen coordinates after login and tab switches, front/back z-order, WebView2 ProcessFailed/NavigationCompleted, physical screenshot; never upload WMS screenshots, tokens or usernames to public repo.
- Verify normal-user Firebase synchronization via authorized admin controls, preserving shared D172 identity; no cross-module Auth mutation without explicit scope/dual regression.
- Visual comparison on three Agent machines and DPI 100/125/150%, login + popup + confirm in PRIMARY, hide/restore/RDP, idle, active and shielded role. Neither green static test nor a signed release is FIELD PASS.
- **Scope:** D173 Agent only. Worker/Web/Android/D172/Stable unchanged. **Release:** no new Agent tag/OTA authorized by this code-only browser-design investigation. **FIELD/OWNER PASS:** false. Keep rollback at signed v186.

## Current source commits / PR
The branch is `fix/d173-e189-agent186-field-auth-layout-browser-intake-20261111`; link exact commit and PR from live GitHub, do not infer from this document.
