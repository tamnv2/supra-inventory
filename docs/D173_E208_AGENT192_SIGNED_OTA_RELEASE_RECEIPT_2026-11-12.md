# D173-E208 — Agent192 signed OTA release receipt (12/11/2026)

## Verified technical release
- **Owner-approved scope:** D173-E207 WinForms overview layout only; top region 60% left (Agent 65% / PickList 35%) and 40% Desktop resources; replace old Supra summary/Desktop Web control with the existing Web Agent download/folder buttons inside Agent; ordered 5 Agent actions. Compact native tabs protect physically short HD viewports. Existing bottom online-session roster 40/60 boundary, handlers and WMS/Confirm are untouched.
- **CODE PASS:** Owner-scoped [PR #937](https://github.com/tamnv2/supra-inventory/pull/937), protected merge main `7cb0037af96d57e650bdad371d9b7ffa663f185e`; exact Agent source pin `b0aebb45d962283abaa17c112d352b6470f409cd`.
- **CI PASS:** [run #43136248270](https://github.com/tamnv2/supra-inventory/actions/runs/43136248270), 5/5 Agent layout/order/Web-buttons tests, 74/74 independent D172 tests, Authority/Project-State/Change-Continuity guards PASS; Windows Host14 and Agent192 x64 native build and startup/roster/safety smoke PASS.
- **Release PASS:** [run #43136512050](https://github.com/tamnv2/supra-inventory/actions/runs/43136512050) completed SUCCESS, release log `E207_AGENT192_TECHNICAL_OTA_SHA_PASS tag=relay-agent-v192 sha256=38dbabe22ef470e90dff8fa2012d65115da230fed17d0d637d8fa3000c725675 FIELD_PENDING`.
- **Published tag:** [`relay-agent-v192`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v192), published 2026-11-12 01:45:33 UTC; signed EXE `Agent.Auto.Confirm.Pick.Pack.exe`, size 8,924,672 bytes, SHA-256 **`38dbabe22ef470e90dff8fa2012d65115da230fed17d0d637d8fa3000c725675`**.
- **inventory-channel readback:** same EXE size/hash as signed tag. `agent-latest.json` asset last updated 2026-11-12 01:45:38 UTC; existing `agent-browser-latest.json` Host14 stays unchanged (asset updated 2026-11-11 05:24:27 UTC).
- **NO changes to:** Worker, Web, Android APK, Firebase Rules, WebView2 Host14 runtime, WMS business/Confirm, D172 resources or business data, Stable, new provider requests or recurring usage cadence. Previous signed Agent191 remains available in its immutable tag.

## FIELD and Owner boundary
- **FIELD NOT PASS:** New Agent192 has not yet been observed on physical ADMIN-PC/VPS fleet at HD/HD+, 100/125/150% DPI. Must inspect actual 60/40 layout and 65/35 left split, fallback on physically short viewports, 5 Agent actions and 3 Web-data actions, valid/invalid Web download state, PickList and lower roster, no text/button overlap or visual flicker, then verify existing WMS/Confirm and startup/tray behavior.
- Prior cross-Agent stale Picker-session/projection inconsistency remains a separate unresolved shared-scope issue; Agent192 does **not** modify or claim to fix it.
- **OWNER PASS: PENDING.** A signed release/CI PASS does not imply physical fleet install or Owner acceptance. D172 remains independent PENDING/HOLD; Stable OWNER-GATED.

## Source of truth
Owner command/review: `docs/D173_E207_AGENT192_TWO_COLUMN_LAYOUT_2026-11-12.md`; source CI workflow `.github/workflows/d173-e207-agent192-release.yml`; authorization `ops/d173-e207-agent192-release-authorization.json`; this E208 receipt is documentation/authority only, not a new deployment.
