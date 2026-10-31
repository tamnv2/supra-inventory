# D173-E113: Actual Cloudflare result, 31 October 2026

Owner explicitly authorized one isolated metered test; GitHub label m2-cloud-once was applied to PR809.

## Evidence
- Run: https://github.com/tamnv2/supra-inventory/actions/runs/41171345338
- Jobs offline-first SUCCESS, owner-once-cloud SUCCESS; 24/24 real InventoryCore Cloudflare checks PASS.
- Artifact D173-E113-REAL-CLOUDFLARE-EVIDENCE, artifact ID 13030264818.
- New separate Cloudflare Worker supra-inventory-m2-lab and SQLite DO LabRealCore; two test instance names http/m2. No production routes, DNS, Firebase or D172 records changed.
- Test key expires 120 minutes after creation, but Worker and SQLite DO resources persist until explicitly removed.

## One Cloudflare measurement
| Measure | HTTP | M2 WebSocket |
| --- | ---: | ---: |
| 20 concurrent real business reports, completion | 346.42 ms | 153.90 ms |
| Per-report p50 | 134.97 ms | 141.71 ms |
| Per-report p95 | 147.00 ms | 153.10 ms |
| Per-report p99 | 342.77 ms | 153.23 ms |

60 concurrent WS handshakes completed in 567.93 ms; p95 of 60 WS read requests 109.77 ms. Driver sent 75 HTTP calls, 81 WS messages and 61 WS connections. Business retry, idempotency, resolution and role checks PASS. Synthetic users on GitHub runner, not warehouse PDA fleet.

## Billing limitation — not a cost pass
Provider Cloudflare GraphQL pre at 05:08:25 UTC and post at 05:09:52 UTC yielded the identical account aggregates: 90138 DO raw invocations, 248553417 rows read, 315215 rows written, duration field 1111.093974784, test script raw invocations 0. The query may lag actual traffic and is account-wide. This DOES NOT prove no metered requests or any monetary savings. Billed DO Compute Requests are not the same as raw invocations. Need time-delayed attributable metrics or dedicated test subaccount/longer paired benchmarking before cost conclusions.

## Release boundary
Exact business Core tested on remote Cloudflare: PASS for test scope. Production release readiness: FAIL/NOT PROVEN, since real Web/APK/Agent/FCM/WMS/Firestore, 60 physical PDA field and shared D172 regressions are missing. Known E097 SQLITE_NOMEM and E105 Agent162 FIELD issues remain. PR809 remains Draft. No Production merge, deploy or OTA; D172 stays independent PENDING/HOLD.
