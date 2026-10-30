# D173-E103 — Agent162 sửa hoạt động gần nhất, ưu tiên zero cloud usage (30/10/2026)

## Owner authorization / scope
Owner reported installed Agent161 FIELD FAIL: real Picker PickList operations did not replace LOGIN in the sessions roster. Owner then explicitly approved: **only Agent code, optionally existing service; prioritize cloud usage savings; deploy update**. This is a same-change E103 repair, not a new Dxxx. D172 OBPP1291 stays independent PENDING/HOLD. Stable remains OWNER-GATED.

## Source-backed root cause
- `service/src/read-model-core.ts` projects WEB/ANDROID last_activity_type=LOGIN and last_activity_at=login_at, not a business event; this field must not be represented as actual work.
- `relay-agent/D119AgentFeatures.cs` previously displayed "Đăng nhập" in Picker row even when a Firestore confirmation job arrived.
- `ApplyPickerRequestActivity()` previously returned immediately for same-generation authoritative LOGIN, so the PickList presence fallback could not double as activity.
- `FirestoreConfirmationTransport.cs` already carries request ID, server-created timestamp, Picker user ID, session generation and durable terminal outcome; reuse those existing signals.

## E103 Agent162 implementation
- New `relay-agent/D173E103Activity.cs`: **RAM-only**, bounded 500 user keys, per-`user_id + session_generation` last activity with request-ID replay guard and authoritative tombstone fence. No new provider request, read, write, timer, ping, heartbeat, websocket or logfile payload.
- Record a recent PickList submission at its existing server-created timestamp; record a terminal result only **after the existing durable ACK succeeded**. Enforce session generation and existing pending-age guard; reject stale replay, never infer success from an uncertain WMS outcome.
- Agent roster shows observed event label + local Vietnam date/time; default remains LOGIN if no verified event. Existing incremental roster signature changes on actual event only; selection/scroll and contact RBAC preserved.
- Own desktop Agent row may show **local, same-instance** actions: manual PickList search/confirmation, call/chat/resolved contact, group call/chat, successful Picker kick, and successful PRIMARY takeover. Unknown remote Agent activity is shown as unobserved rather than copied from an HA heartbeat. No fake global activity, no WMS/Supra session credentials persisted.
- Existing E100 roster smoke remains and `--e103-activity-self-test` is added to the Windows CI smoke. Increment native Agent version 161 -> 162.
- **Worker/service left byte-identical**: Reporter/Admin/Web actions are stored in `audit_log`/`report_events`, but querying per-user events on each 5/10 minute roster refresh would increase SQLite Rows Read/DO Duration. Defer service enhancement until an indexed/measurement-backed design is accepted. No Android/Web/D172/Firebase/Rules/Gateway change.

## Risks and mandatory verification
- Native Windows build, startup smoke, E100 and E103 self-test; session generation 2/3/4; repeat request and repeat ACK; request after tombstone/kick/logout; delayed replay; no ghost row; restore/relogin.
- Check **old valid LOGIN authority remains**, same-generation PickList doesn't demote device version/metadata, and terminal outcome is recorded only on durable ACK. No changes to UI contact RBAC/confirm WMS guard or Firestore HA protocol.
- Source regression for D172 independent scope (no shared Worker code change), and D173 confirm/agent-check. Do not infer actual Windows FIELD/Owner PASS from green CI.
- Billing claim: code adds **zero NEW API/Firestore/DO operations**, not a measured guarantee of overall provider billing. All activity RAM is local and reset on process exit; multi-Agent global consistency intentionally not promised.

## Lifecycle
Owner authorization: YES. CODE candidate: branch `fix/d173-e103-agent162-zero-usage-activity-20261030`. CI / signed Agent162 OTA / FIELD / OWNER PASS: **pending**, to be updated only from exact GitHub evidence.

## Verified PR source CI receipt (30/10/2026)
- Exact reviewed executable source: `1a6f0fc09882a98e631f0dbc5029ee8d42505129`, PR #801, 32/32 GitHub PR workflow runs SUCCESS; 0 failed.
- Native Windows build+startup+E103 activity self-test: 41011591596 SUCCESS. D172 business isolation: 41011591440 SUCCESS. D171 agent/code-only boundary: 41011591606 SUCCESS. E086 Worker/SQLite + D172 regression: 41011591511 SUCCESS. Repo authority: 41011591629 SUCCESS. Project state continuity: 41011591668 SUCCESS.
- Signed Agent162 OTA: **PENDING** until protected marker merge and verified release asset + immutable digest. Worker service source unchanged; existing Worker health required, not redeployed. FIELD/OWNER PASS remain **PENDING**.
