# D173-E175 — Owner-approved unified network, logs and Agent overview (10/11/2026)

## Owner approval and boundaries
Owner approves one coordinated Báo hàng production change: Firestore common Agent↔Agent/PDA HA/commands across Office and ordinary Internet; capability classification with saved per-network hints and manual refresh button **inside Hệ thống Agent**; disable inaccessible functions; unified scheduled/manual/logout/crash/support logs for Web/Agent/Android/Service; Android user B permitted to forward existing sealed user A logs from the same PDA; Agent176 blank embedded WebView2 forensic repair; responsive overview and dedicated **Tắt Agent** button using the already protected exit command.

Only resources in `ops/project-scope.json`; do not create a bridge, firewall bypass, unknown resource, new database or Stable release. D172 remains independent PENDING/HOLD and needs shared Worker regression.

## Code candidate, not release evidence
Branch `feat/d173-e175-unified-network-logs-ui-20261110` started from main `94a99e738eefb1309b4dfcd37767eae50766297c`.

- Agent UI: responsive 37/37/26 columns and 60/40 vertical split; five responsive controls including protected exit; network refresh in Agent card.
- Network: event-driven parallel authenticated Firestore GET and approved Worker capability GET, DPAPI-protected bounded cache, five classifications; cache is display-only and cannot authorize network actions. No generic external proxy or VPN.
- HA: Firestore PRIMARY lease 10s, NEXT_A-only common generation lease check; no RTDB writes/SSE/active probes; pre-v136 legacy case is fenced/fail-closed. No additional heartbeat.
- Android: preserve original logout/scheduled bundles across user changes; post-login/current-session transport may forward pending original bundles, never display older log to new user; do not delete before Drive receipt, retry remains pending.
- Service: original-user claim is explicitly client-reported, while authenticated user B remains submission actor. Accept idempotent retries only if sealed content, source, reason, boundary, device and timestamp match; reject changed payload.
- Service runtime log reasons distinguish `logout` and `support` from scheduled.

## Gates before any production merge
1. Exact branch HEAD native Windows build, Android compile/build, Worker typecheck and source/test checks.
2. Explicit D172 Worker shared-resource regression, Firebase permission/claims and multi-network simulated tests.
3. Version bump and signed publication for every actually changed component, source SHA receipt and release gate.
4. Physical VPS + Office Agent field checks: WMS browser visibility/attach, failover/no duplicate picklist, listener vs REST latency, denied RTDB/Worker paths, account A→B log continuation and billing quotas.
5. No `FIELD_PASS` or `OWNER_PASS` without observed evidence.

## Working status
CODE **PARTIAL CANDIDATE**, CI **PENDING**, RELEASE **NOT STARTED**, FIELD/OWNER **NOT PASS**.
Remaining: complete integration of the 10-slot log state machine across Web/Service/Agent; validate service server-side cross-user provenance; analyze/repair v176 blank WebView2 root cause; Firestore picker-lock PermissionDenied; complete real network/usage regression and signed production gates.

## CI repair record — 10/11/2026
- PR #889 E175 dedicated CI covers native Agent/Host, Android, Worker, D172 regression and Firestore emulator; this is not production or field verification.
- Updated historical tests/guards hardcoding Agent176, Web3.3.4, Android vc127, D171 two-slot logs and RTDB HA. New checks require exact E175 Owner receipt, ten log slots, Firestore PRIMARY/NEXT_A fencing, D172 isolation and Stable Owner boundary. E097/E127/E174 historical grants remain denied for E175.
- Prevented the old D171 isolated-Rules workflow from automatically publishing on an E175 release commit. Existing Firestore emulator and E175 Owner authorization remain mandatory.
- Repair commits: 0ae2a6d, 3b52017, 6df63bf, e51e817, 3b7f790. Full GitHub CI matrix remains RUNNING/NOT VERIFIED. Source CI PASS, merge, Production deploy, FIELD PASS and Owner acceptance are not claimed.
- Still requires proven unified log delivery and receipts, production WebView2 blank-window root cause repair, Picker Firestore PermissionDenied investigation, real network failover and quota checks. No Production promotion without technical evidence.
