# D173-E095 — Agent156 FIELD feedback: UI / auto-size / Usage / Drive logs (2026-10-28)

## Owner request & accepted base
Owner reports installed Agent156 UI FIELD NOT PASS: icon/chart color regression from Agent151–153, sidebar heading removal, history content-aware sizing, always-on auto-size across RDP screen/DPI changes, missing Usage percentage and global Drive log request unresolved.

Canonical D173-E094 verifies Agent156 signed OTA and existing Worker production TECH RELEASE PASS only. E095 is an isolated candidate, not installed or Owner FIELD PASS. D172 remains independent PENDING/HOLD; historical Stable OWNER-GATED.

## Preimplementation impact and isolation
- Agent-only: native WinForms sidebar, history grid, column sizing, theme/sparkline, Windows display notifications. No Android/Web/Worker/Firestore/RTDB/WMS/DO/Gateway/provider change or additional API calls.
- UI risk: Authentication, history row refresh, tray minimize/restore, remote desktop reconnect with 100/125/150% DPI and 1366/1600/1920 screens. Coalesce async UI resizing; preserve minimum widths and horizontal scroll when viewport is too small.
- Reuse existing Agent156 quota model. Cloudflare 50% verified cycle included allowance is internal planning reference, not an actual account hard day cap or 2.50 USD invoice ceiling. Monthly ratio needs verified active billing window plus complete daily provider buckets. Firestore Reads 50k/day, Writes/Deletes 20k/day by Pacific quota-day. RTDB sent quota requires valid monthly numerator+denominator. Connections/gauges/API counts/Cloud Run cannot be assigned invented quota/unit. Missing percentage is N/A with reason; never fake zero.
- Global support-log POST accepts a request and publishes best-effort delivery; this is NOT confirmed per-device Drive commit. Existing Agent log bridge only deletes pending after explicit Drive sync receipt; Firestore staging alone is not Drive. Drive accessible records on Oct 28 prove individual Agent manual/checkpoint uploads occurred, not full fleet success. Do not publicize raw log content, trace identifiers, users or secrets.

## Implemented as unmerged CODE candidate
1. Remove the SUPRA / AGENT sidebar heading without affecting TabPage or authorization.
2. Remove the auto-size toggle, force auto sizing despite obsolete AutoSize=false per-user persisted config, preserve window bounds.
3. Resize Agent/Picker/Manual PickList and PickList history on grid/form geometry, show/activate, display change, DPI change or RDP settings change. Coalesce UI dispatcher; never poll a provider. History uses displayed-cell preferred width and bounded minima with horizontal scrolling fallback. Preserve title/headers.
4. Restore distinct colors by metric family in native WinForms sparkline/icon; source-missing values remain visibly dimmed. Replace the generic 'Không có %' with exact UI reasons: unavailable billing cycle, missing daily sample, no verified metric quota, or instantaneous gauge that has no applicable request quota.
5. Usage denominator and global Drive collection conclusions are analysis-only here, no made-up percentage or shared Worker/Android/Gateway edits.

## Release gates & pending proof
Require protected PR authority+continuity, native net48 Windows compile/startup smoke, source UI regressions, security and D172 isolation checks. CI cannot substitute physical Windows 100/125/150% DPI, real RDP reconnection, WMS/HA/Picker tests, or per-platform Drive delivery receipts. No Agent version bump, no release authorization, no signed OTA or production deploy in this candidate. Await a new explicit Owner release instruction, exact source pin, release workflow and separate FIELD/OWNER PASS.