# D173-E114 M2 technical recommendation, 2026-10-31

Decision: GO isolated selective M2 engineering, NO-GO Production deployment pending demonstrated billing and fleet parity.

Cloudflare remote source-Core run https://github.com/tamnv2/supra-inventory/actions/runs/41171345338: 24/24 PASS. Twenty REPORT requests HTTP completion 346.42 ms, M2 WS completion 153.90 ms. p95 HTTP 147 ms vs WS 153.10 ms; p99 HTTP 342.77 ms vs WS 153.23 ms. GitHub runner synthetic fixtures, not physical PDA.

Delayed namespace specific Cloudflare analytics https://github.com/tamnv2/supra-inventory/actions/runs/41172565843: actual lab namespace LabRealCore DO raw invocations 278; Rows Read 24479; Rows Written 3374; provider duration field 0.169837952.

| Measured LAB usage | HTTP object | M2 object |
| --- | ---: | ---: |
| HTTP raw invocations | 48 | 88 |
| Hibernation raw invocations | 0 | 142 |
| Rows Read | 7471 | 17008 |
| Rows Written | 1597 | 1777 |
| Provider duration field | 0.059828736 | 0.110009216 |

NOT A LIKE-FOR-LIKE COST COMPARISON: M2 additionally received 60 WS upgrades and 60 Core reads that HTTP object did not receive. Raw hibernation invocations differ from billed DO Compute Requests. WS changes transport and cannot reduce SQL Rows Read if identical SELECT operations continue.

Read-only account usage audit https://github.com/tamnv2/supra-inventory/actions/runs/41172415400 saw +880 account raw DO invocations, +2471870 Rows Read and +5821 Rows Written since prior capture, but this includes unrelated concurrent Production traffic.

Benefits of selective M2 under correct implementation: reduce repetitive HTTP polling, push realtime results, amortize incoming WebSocket messages at Cloudflare documented 20:1 compute-request billing ratio, and idle hibernation for Duration. Risks include connection churn, replay/idempotency, cursor recovery, auth, and unchanged Rows Read if polling becomes WS polling.

GO scope: real shared business dispatcher for HTTP/WS, durable scoped event cursor, replay with request_id, event-push fanout, read-model/cache with measured SQL row costs, HTTP fallback. Do NOT change Office Firestore Agent-PDA, WMS/FCM, or D172.

Hard Production gates: full Web/APK/Agent actual source E2E on test variants, 25-60 real PDA under realistic network, true A/B equal client/data workload, delayed namespace-billed request + rows + duration costs with projected monthly charge <= existing $5 plan, p95 not worse than current and realtime response under 5 seconds, failover under 20 seconds, no duplicates/lost events, shared runtime D172 full regression, Owner approval.

NO-GO now for wholesale M2 migration or any Production release. D172 remains PENDING/HOLD, PR809 remains Draft, no Production merge/deploy.
