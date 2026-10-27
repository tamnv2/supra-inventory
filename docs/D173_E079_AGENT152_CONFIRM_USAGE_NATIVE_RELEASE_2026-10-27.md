# D173-E079 — Agent152 WMS already-confirmed marker & native Usage dashboard (27/10/2026)

## Owner decision & exact scope
Owner explicitly approves implementation and release of the displayed dark Usage concept and matching native icons, with Cloudflare first, Firebase second, Google/Other third; one progress visualization per source-backed metric, integer quantities and one-decimal percentage, larger detail table scrolling with the whole Usage page, fixed 3-mode sidebar control, and removal of the useless shift forecast card. The same command approves Agent-side confirm handling of a unique exact PickList row containing a disabled/unready checkbox and the visible SAME-ROW action **"Xác nhận lấy lại hàng"**. It must return the existing `ALREADY_CONFIRMED` result and show the existing Android SFT/SFT 3 guidance. It must not click the recovery action, retry WMS mutation, or claim any new business click.

## Scope/decisions
- Agent-only .NET Framework 4.8 WinForms and DOM read-only detection; no changes to Worker, Firebase/Rules, Android APK, Google data, D172 OBPP, Gateway, WMS source, historical Stable or provider polling cadence.
- The current Android PickerController.kt already maps `ALREADY_CONFIRMED` to the existing success flow plus a visible "PickList đã được xác nhận trước đó trên SFT / SFT 3. Không cần xác nhận lại." message. Consequently no APK rebuild or additional transmission is necessary. Reuse the existing ACK result field rather than inventing a separate text packet/Firestore write.
- Positive WMS proof must match exactly one PL code, one visible native or role checkbox that is unready, and one visible action named exactly `Xác nhận lấy lại hàng` on the same row. Ambiguous/missing/unchecked-but-ready rows continue established logic, never falsely accepted.
- Cloudflare account usage versus internal 50% planning target remains distinct from billing/provider enforced quota. No false forecast/cost. Any provider metric with unverified target must display N/A and missing-source state, never a fabricated percentage or green OK.
- Dashboard is built from native Windows controls, native vector sidebar icons and owner-drawn bar charts rather than a static generated screenshot. The reference art is a design goal, not proof of pixel-perfect parity. Physical DPI screenshots remain FIELD acceptance.
- AUTO has an explicit Vietnam time schedule LIGHT from 06:00 to 17:59 and DARK from 18:00 to 05:59; SÁNG and TỐI are manual overrides. Sidebar remains fixed.
- Source-backed metric groups: Cloudflare Workers Requests / DO Compute Requests / DO SQL Rows Read / Workers CPU / DO Rows Written; Firebase Reads/Writes/Deletes; Google Cloud Run/RTDB HTTPS/Drive/Sheets. Per-metric percent bar is 100%-capped visually, raw 100+% and overage are printed. Other quantities show rounded whole values. Google metrics with unverified quota show actual from supported interval but NO fictional target.
- Detail DataGridView is expanded vertically and only outer content scrolls vertically; horizontal overflow may scroll horizontally. Preserve source freshness and billing-period N/A.
- No request to close D172; D172 PENDING/HOLD remains isolated. Shared historical Stable OWNER-GATED.

## Risks and gates
- False WMS positive is high consequence: distinguish exact same row, unique code, not-ready checkbox and action marker, with no mutation; preserve 12-second mutation fence and existing retry/idempotency safeguards.
- Rendering/read-only metrics may make charts appear blank for unverifiable limits; missing evidence is safer than invented levels. Use existing provider query cadence only.
- Native WinForms/DPI/hover-wheel, picklist confirm actual WMS, Office/HA, installed VPS and Android display must be verified in FIELD separately.
- Branch `fix/d173-e079-agent152-confirm-usage-dashboard-20261027`. STATUS: CODE CANDIDATE; PR CI / signed release / FIELD / OWNER PASS not implied. Dedicated source-pinned release gate must pass before any protected main merge, signed EXE tag, or OTA channel mutation. D172 remains independent HOLD.
