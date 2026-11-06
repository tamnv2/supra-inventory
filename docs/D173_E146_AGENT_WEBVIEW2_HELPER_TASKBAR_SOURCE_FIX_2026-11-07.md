# D173-E146 — Agent WebView2 ghost taskbar windows (07/11/2026 VN)

**Owner FIELD report:** After opening the Agent browser, Windows taskbar previews include `.NET-BroadcastEventWindow` and `GDI+ Window`. This is the same category tracked as E119 on 02/11, not an accepted FIELD fix in Agent168.

## Verified source defect and evidence boundary

- `relay-agent/SupraConfirmBrowser.cs` at signed Agent168 currently calls `EnumWindows` for the WebView2 Host PID and `ShowWindow` on *every* top-level HWND when making the Agent browser visible. It can expose WinForms/.NET/GDI+ helper windows intentionally hidden by the framework.
- Agent168's embedded-tab and input-shield fallback choose the **first** HWND of the Host PID, without verifying the WinForms browser `Form`. A same-PID helper HWND can therefore be mistaken for the browser, breaking embedding and/or shield.
- `relay-agent-webview2-host/Program.cs` sets the owned BrowserForm's caption to `SUPRA Confirm PickList · Agent`, including when input protection changes; this is a deterministic discriminator in addition to the owned PID and unowned top-level window check.
- The screenshot alone does not reveal PID/HWND/class/owner. The source establishes a concrete capable-of-causing-the-symptom code defect, **not** a completed physical proof that the pictured windows belong to Host12 rather than another Agent child process. Verify on Windows for FIELD PASS.

## Isolated code candidate — PR #851, DRAFT

1. Resolve only the Host12 WinForms BrowserForm by matching existing Host process PID, no native window owner, and exact title prefix. Never use first-PID-window discovery.
2. Cache and reuse the verified HWND after `SetParent` makes it a child of the Agent Web tab, because cross-process child-window captions may not be retrieved reliably.
3. Only show/hide the verified HWND. **Do not** show, hide, parent, or send input-shield messages to `.NET-BroadcastEventWindow`, `GDI+ Window`, or any other helper HWND.
4. On successful embed, set `WS_EX_TOOLWINDOW` and remove `WS_EX_APPWINDOW` so there is no duplicate taskbar tile for the embedded browser. Restore original styles if parent attach fails.
5. Keep existing Host12 binary, WMS profile, CDP/confirm flow, authentication, password guards and Desktop browser behavior unchanged. No new network requests, provider usage or background timers.
6. Static regression tests cover exact titled/PID-owned HWND, exclusive Agent visibility path, child-aware shield, and unchanged published Agent168 version; native Windows compilation, startup, taskbar, WMS session/Confirm and physical field verification remain distinct gates.

## Deployment boundary

- **CODE CANDIDATE / CI PENDING; RELEASE NOT AUTHORIZED**. `relay-agent-v168` is still the currently signed published artifact; this PR does not upload OTA or claim fixed production.
- New Agent version/release must be separately Owner-approved, source-pinned, Windows-native CI-tested and published with a matching signed OTA checksum; verify Win10/11 plus startup, login, WMS navigation, shield lock/unlock, tray minimize/restore, browser start/stop and HA.
- No Worker, Web, Android, Firebase, Gateway, WebView2 Host12 binary, Cloudflare, D172 or historical Stable changes. D172 remains independent **PENDING/HOLD**; Stable **OWNER-GATED**.
- E119 remains **historical unaccepted FIELD issue**; the E146 candidate does not mark E119, Agent168 FIELD, or Owner PASS.

Evidence: Owner screenshot 07/11; historical `docs/D173_E119_E121_OWNER_BACKLOG_2026-11-02.md`; `relay-agent/SupraConfirmBrowser.cs` and `relay-agent-webview2-host/Program.cs`; [PR #851](https://github.com/tamnv2/supra-inventory/pull/851).
