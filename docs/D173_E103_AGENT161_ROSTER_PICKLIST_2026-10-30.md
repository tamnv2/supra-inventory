# D173-E103 — Agent161 session roster and manual PickList confirmation (30/10/2026)

## Owner authorization
Owner explicitly approved code + deployment after impact review of ten requests on the installed Agent160 UI. This remains the active D173 workstream; D172 OBPP1291 independent PENDING/HOLD and historical Stable OWNER-GATED.

## Contract and implementation
1. Agent main overview is 30% scrollable operations / 70% sessions. The earlier 50% override in Program.cs must not recur.
2. Three channels: Agent (existing Firestore HA fleet); Web (authenticated Worker WEB sessions, Admin/Root/PickPack Admin/Reporter); PDA (existing Picker PDA session projection plus authenticated Reporter Android sessions). No D172 OBPP session.
3. One source-backed channel count row, not duplicate count in the status subtitle. Default chronological ordering by confirmed login-at UTC converted to Asia/Ho_Chi_Minh (unknown Agent login sorts last).
4. Personnel grouped as Contractor - EmployeeCode - Bold Name, second line role; preserve individual action RBAC. Web/Reporter/Agent rows are read-only (no Picker kick or specialist contact).
5. Show Login and Last observed activity as separate columns; do not mistake FCM last_seen registration or HA heartbeat for user business action. Current v2 session projection reuses LOGIN timestamp as the only verified interactive activity; WebSocket state is a distinct connection indication. Existing WMS/HA activity keeps source-specific heartbeat label. NO invented PickList/confirm timestamp when no reliable channel evidence exists.
6. The existing Agent-only authenticated GET /api/agent/d173/reporter-online returns source-backed Web/Reporter Android sessions from current InventoryCore session generation, supplemented by the existing socket set for connection status/version, within same existing PRIMARY 5m or standby 10m sampling; one bounded SQL read, no new timer/heartbeat/DO request/write.
7. Manual WinForms search: exactly one unambiguous complete PickList result, zero unmatched fragments -> automatically call existing ConfirmManualPicklist after releasing the search operation interlock. 0/multiple/mixed/ambiguous remain manual. Existing Web Confirm DOM, Firestore guard, no double-submit/uncertain replay rules unchanged.
8. Agent native version increases monotonically to 161. Web and Android clients unchanged; Worker source read-only additive. No Firebase/Gateway/WMS mutation and no schema migration.

## Impact and regression
- Worker shared read-only endpoint: D172 independent API/session isolation and D173 auth negative checks mandatory.
- Confirm path: 0, 1, >1, duplicated suffixes, mixed missing matches, expired session, uncertain outcome, concurrent Agent primary switch. No alternate WMS API mutation.
- Chronological sorting across all channels, preserve row selection, scroll, PINed identity, Agent unknown timestamps, UTC offsets, dark/light/125%-150% Windows DPI, Web disconnect and logout/replacement.
- Billing: unchanged API request cadence; bounded InventoryCore SQL read adds potential Rows Read/DO Duration, no guaranteed usage savings. Avoid additional heartbeat/provider requests.
- Production deploy must be Worker first + verified official /health and D172 shared regression, then signed Agent161 release; verify exact source pin, CI, EXE/checksum/OTA channel and rollback to v160. FIELD/OWNER PASS never inferred.

## Current evidence and status
Owner approval: YES. CODE candidate on feat/d173-e103-agent161-roster-confirm-20261030; GitHub CI, Worker release, signed OTA, installed FIELD and OWNER PASS NOT YET VERIFIED. E097 SQL NOMEM root cause not asserted resolved. D172 HOLD preserved.

## Limitations requiring source evidence
A server timestamp for each individual Picker's PickList/WMS confirmation is not carried by current authenticated roster projection; until a reliable existing business-event source is validated, show only known LOGIN/HA/connection evidence and label it honestly. Do not silently add per-action write/heartbeat solely to fill this UI.
