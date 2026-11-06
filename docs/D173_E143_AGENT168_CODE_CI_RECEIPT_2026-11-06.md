# D173-E143 — Agent168 Owner field corrections, exact code CI (06/11/2026)

**Authority:** Owner supplied seven Agent167 FIELD-NOT-PASS fixes, two screenshots, 2026-11-06. This is an **Agent-only code candidate**, NOT an Owner approval to merge, publish, update channel, use provider resources, or close D172.

## Scope and implementation

- Roster: 50/50 overview split; move local presence counts to all five filter buttons; searchable employee input capped width; one-line 31px session rows; retain source identity and role-aware actions. Kết thúc gọi / Liên hệ nhóm / Kích toàn bộ user reparented on same scrollable tab row; existing permission gates unchanged.
- PickList: remove 38px unnecessary empty gap when compact search is used without bulk-confirm button; dynamic layout still accommodates the bulk-confirm action when visible.
- Browser: permanent Web Confirm tab, no hide/show button. Place existing Agent-owned Host12 HWND inside the Agent viewport (existing WebView2 profile/CDP session); no second WebView2 process/session and no Desktop-WMS reparent.
- Native shield: resolve the owned child HWND after SetParent so protected input ACK continues working. Browser monitor remains VPS authenticated + machine/Agent-instance DPAPI-bound; monitor and shield toggle are pinned in Web header. Neither toggle asks for a second password. No provider logging expansion.
- Candidate source identity: AgentBuild 168, VERSION 168, assembly/file 0.168.0.0; Host12 not rebuilt as a version change.

## Exact CI evidence — code source

- PR: https://github.com/tamnv2/supra-inventory/pull/849 (Draft).
- Exact source-check head **`4ef03aca949e053da8df309fc162e483c66dbc69`**.
- GitHub Checks at that SHA: **51 total; 37 SUCCESS, 14 SKIPPED, 0 FAILURE, 0 INCOMPLETE**. Skipped jobs are not called PASS.
- Native Windows build + Agent offline startup/CDP self-test and existing Host12 x64 build **SUCCESS**: https://github.com/tamnv2/supra-inventory/actions/runs/42229053470.
- Relay Agent regression **SUCCESS**: https://github.com/tamnv2/supra-inventory/actions/runs/42229053515.
- Dedicated E143 test: `tests/d173-e143-agent168-roster-webview.test.mjs`, executed by `.github/workflows/d173-e141-agent-source.yml`; source contract, authority, continuity, D172-isolation, UI and usage regression checks SUCCESS.
- Fixes for stale tests and guards are limited to allowing new Owner-requested Agent168 CODE source; E141 Agent167 protected release function **cannot sign/publish Agent168** and explicitly denies a release path.

## Boundary and remaining gates

- CODE: E143 changes committed in PR849; **source/native CI PASS at exact source SHA above**.
- MERGE: NOT MERGED. RELEASE: NOT PUBLISHED. FIELD: NOT TESTED ON OWNER WINDOWS/VPS. OWNER PASS: PENDING.
- Do not claim runtime correctness merely from source/static tests; Windows DPI 100/125/150%, embedded shield ACK, tab switching and WMS confirm require owner in-field test.
- No changed Worker/Web/APK/Firebase/RTDB/Gateway/Apps Script/D172 code or Cloudflare quota. D172 remains independent **PENDING/HOLD**. Stable remains **OWNER-GATED**.
- Subsequent docs/state-only commits may have a different Git SHA; above CI pin refers to exact CODE candidate source. Any further code mutation requires fresh exact CI.
