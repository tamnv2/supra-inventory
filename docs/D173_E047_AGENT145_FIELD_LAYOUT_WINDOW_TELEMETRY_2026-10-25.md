# D173-E047 — Agent145 FIELD FAIL: layout, desktop resources, window and logging (25/10/2026)

## Owner-reported defects and authorized repair
Agent v145 FIELD finding on Windows: (1) Desktop metrics card lacks the same visible border as Agent/Supra/PickList; (2) Agent and Supra are clipped in a 63/37 shared column; (3) desktop resource traces visibly flicker on the supplied 10.5s 2880x1724 capture; (4) one network trace incorrectly plots sum of upload/download; (5) Windows native title interaction restores to a smaller window and locks out maximization; (6) Worker/DO need durable per-query/operation count, rows read/written and latency; conditional Agent RTDB timeout/reconnect/actual Firestore fallback fields only if existing diagnostics are insufficient.

## Root-cause code evidence
- `relay-agent/Program.cs`: old 63/37 shared Agent/Supra stack and native maximized fixed-size window; responsive reflow has original coordinates.
- `relay-agent/D173DesktopResources.cs`: chart card uses different panel primitive from `NewCard`, network calls `Push(down+up)`, sparkline is redrawn every sample.
- `service/src/d166-sql-usage.ts`: 15 allowlisted SQL Cursor query types already count executions/rows/latency, but snapshots live in per-DO-state WeakMap, reset when isolate restarts.
- `service/src/d167-route-usage.ts`: operation families/HTTP methods counted per hour, likewise volatile.
- `relay-agent/RtdbHaLiveness.cs`: stream timeout/failure code/recovered duration/retry count and fallback-armed already recorded, `FirestoreAgentLeaderCoordinator.cs` records primary lease GET attempts; actual fallback receipt frequency must be correlated before adding duplicative logs.

## Agent v146 candidate (CODE ONLY)
- NewCard for Desktop: a consistent 1px palette border on all four cards.
- Agent occupies full left top card; Supra moves to top center, PickList beneath it; wide and compact reflows updated, preserve roster and WMS.
- Local chart uses double-buffered paints and independent teal Download + blue Upload values, common Mbps scale; no extra network APIs, external service calls or pollers.
- Native Windows intercepts title double-click/drag and SC_RESTORE/SC_MOVE/SC_SIZE; an unexpected normal restore returns to working-area maximize; minimizing hides into tray.
- Agent build version is 146 **candidate**, not deployed or signed until isolated CI/release authorization.

## Scope, risk and gates
- AGENT source only: no WMS/HA/auth/Office service/network changes, no Worker/Core/Firebase/Android/D172/Stable mutation in this change.
- Test WinForms net48 Windows build/startup smoke; resizing/display scaling 100/125/150/200%, light/dark, 1366/1600/1920px, 1/2/5/10-second graphs and bandwidth direction, minimizing from title and tray recovery.
- UI trace shows flicker but source-only double buffering is not field proof. Repeat actual captured video comparison.
- Worker durable observability is a **separate isolated follow-up**, not silently treated as implemented: naive per-query SQL upserts increase paid SQL Writes and latency, and the existing DO physically serves D172. Require flush/retention/coverage policy, D172 regression, quota benchmark, and independently approved gated release.
- FIELD PASS = false; OWNER PASS = false; Agent v145 remains current signed OTA until v146 release evidence is verified.

## Evidence
- Owner image and video received 25/10/2026, no user identifiers or media uploaded to public repository.
- Agent v145 canonical release receipt: `docs/D173_E046_AGENT145_SIGNED_OTA_RELEASE_RECEIPT_2026-10-25.md`.
