# D173-E152 — Agent171 / Host13 WebView2 embed FIELD FAIL (07/11/2026)

## Owner report and evidence
- Owner installed signed Agent170 / Host13; Web Confirm tab displayed blank area with "Chưa thể ghim Web Agent".
- Latest manual sanitized Agent log at ~11:41 VN: `SUPRA_BROWSER window_visibility=SKIPPED reason=OWNED_FORM_NOT_FOUND`; `E141 WEB_SHIELD state=FAIL_CLOSED reason=HOST_COMMAND_UNAVAILABLE`.
- In the same log, `dashboard_popup=ATTACHED` and `confirm_reload=PASS` with a hydrated page. This supports a Win32 embedding/host-recognition failure, **not proof of a WMS data or navigation failure**.
- Separately `D173_E140 PICKER_LOCK_LISTEN state=RECONNECT grpc=PermissionDenied` repeats; **not attributed to WebView blanking without additional proof**. No Firebase Rules modification is authorized by this fix.
- Previous Agent169 log showed `embedded_tab=ATTACHED host_owned=true`. Agent170 uses newly signed Host13, which starts off desktop.

## Source-supported cause and bounded repair
- Host13 `BrowserForm` sets `ShowInTaskbar=false`. Windows Forms may give this off-desktop form a hidden Win32 owner. The Agent's existing `FindOwnedAgentBrowserFormNoLock` rejected **all** HWNDs with `GW_OWNER != 0`, before checking their otherwise-valid exact caption.
- This is a **high-confidence code-level compatibility defect**, not a FIELD-confirmed sole root cause. New Agent171 accepts the Host-owned BrowserForm based on **matching Host PID plus exact known caption prefix**, not on generic process windows. It retains the explicit bad-helper-window guard.
- `GetParent` can return the owner of an unembedded popup, so both cached-window and visibility logic now require actual `WS_CHILD` before treating the Host as embedded. No arbitrary HWND foregrounding and no unprotected WMS input.
- Add diagnostic `SUPRA_BROWSER owned_form=FOUND owner_present=... pid_verified=true`. Existing `embedded_tab=ATTACHED` and Web shield command ACK remain the final runtime evidence.
- No new WebView2 process, profile, Web/Android/Worker/Rules/D172/Cloudflare operation, listener, provider resource or usage timer.
- Existing WebView2 Host13 binary/package remains intact; only Agent171 source changes.

## Test and release boundary
1. Source/CI: WinForms native .NET Framework x64 build for Agent171 and node regression for Host13 off-desktop owner detection, actual WS_CHILD requirement, E146 helper-window isolation, E143 Web tab, and D172 independent guard.
2. FIELD (Windows): verify `owned_form=FOUND` plus `embedded_tab=ATTACHED`, Web Confirm actually visible, shield protected, no external popup, login expiry re-entry and repeated minimize/restore; verify WMS confirm and HA unchanged.
3. `PICKER_LOCK_LISTEN PermissionDenied` is a separate tracked finding, not repaired here.
4. `CODE != CI != RELEASE != FIELD != OWNER PASS`. This PR is **CODE ONLY, draft for review**; no merge, signed OTA, production channel mutation or FIELD/OWNER PASS. Stable OWNER-GATED and D172 OBPP PENDING/HOLD unchanged.
