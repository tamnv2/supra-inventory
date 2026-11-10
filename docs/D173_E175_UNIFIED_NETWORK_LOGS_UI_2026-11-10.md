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

## Exact-source CI — 10/11/2026
- Tested application/source SHA: `6124042dc09d3b4be8df5c1db6feac8787166649` (PR #889). GitHub Actions: **48 success / 0 failure / 2 conditional skipped**, on 50 workflows. Explicit E175 Android, Agent/Host, Worker/Web, Firestore emulator, D172 shared regression and UI guards all succeeded. The 2 skips were workflow conditions, not failed checks.
- Source approval receipt is pinned to the exact SHA; following commits may change only authority/continuity/release metadata, not application binaries or Firebase Rules before Production. No FIELD/OWNER PASS is asserted.
- Main includes independent D172 E063 changes, retained byte-for-byte. E175 PR diff changes no D172 business sources.
- Cross-account log replay now confirms the immutable original user claim before accepting the same-bundle retry. New actor remains the authenticated forwarding user.
- Read-only deployed Firestore Rules probe on CI returned `MATCH_REQUIRED_AGENT_RBAC`. This does **not** prove the cause of Picker-lock `PermissionDenied`; investigate session claims/transport on live devices. Same-semantics Rules republish must not be reported as a verified fix.
- Blank embedded WebView2 candidate is a bounded tab-activation compositor repaint; native compile PASS does not prove physical rendering is fixed.
- Next: protected merge and technical publication under Owner authorization; field/readback and Owner PASS remain independently pending.

## Production post-merge repair — 10/11/2026
- Owner-approved PR #889 merged as `8ac328c5360b2038d97296a2fe212793f7b46cfc`; 48 source CI PASS/2 expected skipped. Production is **not** fully released: initial Worker push run 42723712955 FAILED at malformed legacy shell conditional; Agent Gateway deployment run 42723712814 was correctly rejected by historic D167 grant; Android run 42723712848 blocked by obsolete D171-vc117-only gate; D170 push historical Rules parity test failed. Firestore Rules run 42723712673 succeeded on the release SHA.
- Fix confined to GitHub workflow gates/test: exact E175 Worker Owner gate; preserve D172 Worker-only authority; skip unapproved Agent Gateway redeployment (reuse verified existing script); exempt E175 from historical Android vc117/Agent136-only checks while retaining E175 Worker→Agent177→Android128 exact release gates; update historical D170 parity test for exact E175 main release marker. No application source, provider registry, D172 module or Stable mutation.
- D172 standalone APK workflow failure on E175 main push is expected independent fail-closed and must **not** result in D172 release or gate weakening. No FIELD or OWNER PASS inferred.
- Repair branch `fix/d173-e175-production-release-workflow-repair-20261110`. New release requires separate PR CI and Owner-approved merge; check GitHub run/release, exact signed tags and live health before declaring technical Production PASS.

## D146 Worker release gate recovery (10/11/2026)
- Owner requested continuation to full Production. Main release SHA `05bfa0fa860ed298d3551ce830282976a08a6e16`: Worker run `42725590204` failed the historical D146 Web two-slot check; current Web already uses E175-approved ten VN slots. The existing E165/E167 ten-slot guard covers this exact contract.
- Agent177 run `42725590199` and Android128 run `42725590641` fail closed because Worker health for the same release SHA is unavailable; these are consequences, not proof of a broken Android/Agent build.
- Fix: include only the exact E175 Production marker in the D146 ten-slot validation branch. Keep all original log receipt, privacy, idempotency, D172, Stable and signed release checks. Application source and source-CI SHA remain unchanged.
- Do not infer Worker deployment, signed artifacts, field acceptance or Owner PASS until new GitHub run/readback evidence.

## Gateway baseline guard repair — 10/11/2026
- PR #894 merged with 23/23 CI PASS as `ef5abffd3b26bdcde17d1b4ab82a72877b752944`, but production Worker run `42728752751` failed **after the E175 authorization passed**. Its D171 Gateway step compared to obsolete `62a713...` from before independent D172-E063. This is a guard baseline error, not evidence of E175 changing D172.
- The release receipt `ops/d173-e175-release-authorization.json` already fixes `base_main_sha` to `c7b1c43e4eea7ae879c11796bc6bc60a3e506168`; its E175 gate independently checks immutable D172, shared Worker, Stable and prior source CI. Reuse this exact verified base for the redundant Gateway diff.
- Source, signed binary inputs, D172, Firebase, Web, Agent, Android, Stable and provider settings remain unchanged. Worker/Agent177/Android128 Production not yet PASS; no FIELD or OWNER PASS implied.
