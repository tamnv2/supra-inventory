# D173-E146 — Agent169 SKU layout, .NET/GDI shell helpers, Picker shift server cutoff (07/11/2026 VN)

## Owner authorization and boundary
Owner explicitly approved implementing the three previously reviewed items: own-Agent .NET/GDI+ auxiliary taskbar windows, SKU tab vertical ratio 35/35/30, and automatic 14:00/22:00 Picker logout without changing APK. This is **D173**, no new Dxxx. D172 OBPP is independent PENDING/HOLD; historical Stable is OWNER-GATED. The review and approval refer to code and gated Production release only; green CI cannot establish real-device FIELD/OWNER PASS.

Allowed source: `relay-agent/`, `service/src/`, targeted `tests/`, E146 docs/authority, pre-existing GitHub CI/release machinery as strictly necessary. No Android/Web/OBPP business source changes, no new Cloudflare/Firebase project, Cron trigger, Firestore collection, SQL table, migration, Google function, WMS integration or signing identity. Agent169 reuses WebView2 Host12.

## Agent169 behavior
1. Resolve the Host12 root cause using source-verified PR #851 (exact code SHA 1c52507d): only locate the titled, unowned top-level Host12 BrowserForm HWND from the correct Host process PID for WebView2 embed/show/hide/shield. Never enumerate/show all Host PID windows or treat first-PID helper HWND as the browser. Set shell TOOLWINDOW on the embedded real BrowserForm only; preserve Host12 signed binary. This complements, rather than replaces, the own-Agent-PID helper guard below.
2. Only own-PID, exact framework helper classes/titles are candidates. Set WS_EX_TOOLWINDOW and clear WS_EX_APPWINDOW in own helper HWND; retain hidden-message/GDI pump and do **not** destroy, disable, hide with ShowWindow, enumerate other PIDs, or modify WinForms/WMS/WebView2 windows. Scope event hook to the current process. Restore/unhook on actual Agent exit, not minimize-to-tray.
3. SKU current `D167SkuUi.cs` has fixed header, metrics and footer; change the three dynamic display areas to **35% automatic / 35% manual / 30% operational status** of the remaining client height. Same grid columns, data, business logic, scrollbars and status requests. Verify native WinForms layout at Windows 720p, 100/125/150% DPI, minimize/restore.
4. Bump native assembly, AgentConfig and VERSION consistently to 169; existing signed Agent168/Host12 remains the rollback baseline until field acceptance.

## Picker shift cutoff — existing infrastructure, no APK change
Prior E123 already enforces Picker-only time limits on InventoryCore/Worker and Firebase Rules:
- Android Picker login before 10:00 VN -> expiry at 14:00 same day.
- Login 10:00–21:59 VN -> expiry at 22:00 same day.
- New login from 22:00 VN -> next-day 22:00 expiry. Schedule/overtime business gates remain separate.

E146 reuses the existing Worker 5-minute Cron only at **07:00/15:00 UTC** (=14:00/22:00 VN) with bounded retries up to minute 30. An internal Core method selects only ACTIVE PICKER Android sessions whose **own authoritative start time** has elapsed. A synchronous SQL transaction increments their session generation, nulls Android session metadata, disables old Android FCM registration and clears prior presence rows. CAS on generation + start time excludes a new shift/overtime login, Reporter, Web, Agent and OBPP.

A per-cutoff InventoryCore `app_config` outbox records the revoked generations and pending delivery; the Worker publishes to the **existing** `picker_session_controls/{firebaseUid}` document (no new collection, listener or APK). The old Android `PickerActiveCallWatcher` already logs out when `revokedGeneration >= generation`; new logins have larger generations and are not terminated by an old cutoff. The Worker acknowledges successful deliveries and retries only outstanding users. No credentials, tokens, login email or raw UID in Worker logs.

**Physical timing limitation:** the server denies expired business sessions immediately using the existing E123 checks. Existing Android timer supports timely foreground UI logout. Cron and Firestore propagation may run later than the exact minute, and a sleeping/offline PDA cannot be guaranteed to display the login screen while offline. Upon wake/reconnect, E123 local deadline and session generation reconciliation apply. Do not report a guaranteed exact-second UI transition or a FIELD PASS without evidence.

## Impact and regression plan
- Components changed: Windows Agent native shell/SKU/version, existing Cloudflare Worker scheduled handler and InventoryCore auth/session rows, existing Firebase control document writes.
- Components unchanged: Android signed package/client UI code, Web business code, Agent-WMS browser/HA/PRIMARY/PickList confirmation flow, existing realtime semantics, Firestore Rules and schema, D172 OBPP and Stable.
- Tests: native WinForms build/startup, E143 UI regression, new E146 layout/native guard/Cron/outbox contract, service TS typecheck, existing Picker boundary and E123 security, D172 isolation/backend, existing WMS/ACK/HA, Worker operational health, signed OTA SHA/channel proof.
- Field tests: one Picker logged before 10:00, another 10:00–21:59, new 14:01 login, new 22:01 login, offline/sleeping PDA and Web/PDA Reporter unchanged, broken Firebase publish retry, duplicate Cron and restart. Distinguish server revoke time, Firebase ACK and actual PDA login UI state.
- Quota: No new 5-minute trigger, no continuous polling or new D1/DO table. Incremental operations: cutoff Core request(s), transactional SQL writes for truly expiring sessions, existing Firestore control-document writes per revoked Picker plus bounded retries/ACK. No guarantee of zero incremental usage; compare billing before/after.
- Rollback: stop E146 Cron invocation, retain existing E123 session-expiry rules; Agent168 signed tag remains retrievable. Do not roll back auth/Rules or restore expired sessions to hide an incident.

## Status
CODE candidate on E146 branch. CI, production Worker release, signed Agent169 OTA, Windows FIELD and Owner PASS **not established until verified**. Stable OWNER-GATED; D172 PENDING/HOLD.
