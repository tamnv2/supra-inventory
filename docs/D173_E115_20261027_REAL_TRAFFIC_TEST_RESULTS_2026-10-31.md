# D173-E115 — Day-27 trace-based actual Cloudflare A/B results (2026-10-31)

## Result and isolation

Owner request: apply **27 October 2026 (Asia/Ho_Chi_Minh)** real measured operational distribution to evaluate M2 against HTTP. `Draft PR #810` remains unmerged; test resources are the separately registered `supra-inventory-m2-lab` Cloudflare Worker and `LabRealCore` SQLite Durable Object. The official `InventoryCore` source is imported into the TEST worker. No Production routing/Worker, Web/Android/Agent release, WMS, Firebase or D172 writes.

**Remote Cloudflare test run [41175960126](https://github.com/tamnv2/supra-inventory/actions/runs/41175960126): 27/27 PASS; offline and metered cloud jobs both SUCCESS.** Artifact `D173-E115-27OCT-REAL-CLOUD-AB-AND-PROVIDER` ID `13033185681`; the artifact includes `day27-remote-ineligible.json` (filename historical; JSON confirms `deployment=REMOTE_CLOUDFLARE`, `status=PASS`).

## Real observed operational profile

Source: Google Drive 27-Oct directory; 49 non-D172 Android support bundles, 32 distinct device fingerprints. The algorithm deduplicates RAM snapshot counters by taking the maximum per device/UTC-hour/route/method/status. This yields **10,403 observed HTTP attempts, NOT the entire fleet/day**, with 5,038 `REALTIME_DELTA|GET` (48.43%), 1,110 `REALTIME_TICKET|POST`, 659 Picker Reports GET+POST, 643 Picker Results GET+POST. Status groups: 9,894 OK, 261 NETWORK_ERROR, 223 AUTH_401, 25 HTTP_409. The highest observed hour in this partial Android sample was 17:00 VN: 2,057 attempts. Agent D166 logs were also located but are application estimates; their quota_day sometimes differs from event timestamps, so they are excluded from provider billing totals. No real user, device, employee, SKU or Picklist identifier included in public test profile.

## Actual Cloudflare provider metrics for 27 October Vietnam time

Read-only Cloudflare GraphQL exact UTC window `2026-10-26T17:00:00Z` to `2026-10-27T17:00:00Z`, with 24 distinct hour groups, no query truncation; [Actions run 41175332312](https://github.com/tamnv2/supra-inventory/actions/runs/41175332312); repeated successfully in PR810. Values for the observed core namespace (can include D172 since shared Core):

| Provider raw metric | 27/10 (VN) |
| --- | ---: |
| DO raw invocations | 56,661 |
| DO HTTP invocations | 54,055 |
| DO hibernation invocations | 2,577 |
| DO alarms | 29 |
| SQLite Rows Read | 133,115,948 |
| SQLite Rows Written | 177,739 |
| Cloudflare `duration` raw field | 475.937918208 |

These raw Cloudflare measurements **are not billed DO Compute Requests** and do not isolate D172. No fabricated financial conclusion. Historical namespace Rows Read was far larger than Android requests because it accounts for SQL operations on all served workloads and internal telemetry.

## Matched HTTP/M2 tests on real Cloudflare

The test selects seven real READ routes that are actually supported by `InventoryCore` (realtime delta; picker reports/results; reporter queue/recent/counters/overdue), totaling **6,905 observed eligible GET attempts**. **A bounded 2.5% proportionate workload** was executed: 173 HTTP commands and exactly 173 M2 WebSocket commands (same relative route mix and test-only fixtures). Additional 24 core/role/report/WS checks passed. The M2 path currently carries the **same actual Core SQL reads**, not the new push/SQL cache optimization.

| Metric | HTTP | M2 |
| --- | ---: | ---: |
| 173 matched read responses HTTP200 | 173/173 | 173/173 |
| Completion for 173 reads, CI runner to remote Worker | 3,070.59 ms | 1,997.84 ms |
| Read p50 | 83.24 ms | 87.27 ms |
| Read p95 | 288.07 ms | 143.75 ms |
| Read p99 | 435.46 ms | 152.20 ms |
| 20 real Core shortage write burst | 228.32 ms | 249.70 ms |

Observed M2 read-batch completion improvement in this one test = ~34.9%; write-burst M2 was slower by ~9.4%. This **does not imply** production throughput or SLA across Newland/Urovo, nor cost savings; CI runner traffic/network and short burst differ from the actual warehouse. 60 virtual WS connections also PASS; they are not 60 distinct authenticated PDA devices.

**Most important gap:** 5,038 client `REALTIME_DELTA` reads cannot be replaced in the source merely by WS request/response: a real server push subscription must produce matching events with authenticated audience, durable cursor, reconnect/replay, avoid duplicate writes, and eliminate SQL polling. This M2 event-push implementation has **NOT yet passed** the above tests. No true 24h replay of all 10,403 client HTTP attempts has occurred.

## Provider usage and go/no-go

Test namespace metrics collected immediately after the 27-Oct synthetic run still showed previous E113 sample totals (278 raw invocations, 24,479 Rows Read, 3,374 Rows Written), indicating provider propagation delay, **NOT** 0 usage. No defensible billed DO Compute Requests/Rows Read/Duration A/B economic comparison yet.

**Decision: GO only for selective M2 implementation and further equal-workload measurement; NO-GO Production M2 release today.** Need authenticated actual Web/APK/Agent source and push/cursor/read model, all corresponding 27-Oct traffic groups, equal HTTP/M2 field/net loads, namespace-attributed delayed billed usage and monthly $5 threshold, full D172 shared-runtime regression, p95 and error/failover gates, distinct Owner Production release approval. D172 remains PENDING/HOLD. No Production merge, deploy, OTA or account reconfiguration.

## Evidence and files

- [PR810](https://github.com/tamnv2/supra-inventory/pull/810), branch `poc/d173-e115-27oct-trace-driven-replay-20261031`
- Cloudflare remote A/B run 41175960126, artifact 13033185681
- Historical official Cloudflare 24h run 41175332312, artifact 13033300271 from later repeat
- Source anonymized profile `tools/d173_e115_day27/profile-anonymized.json`
- Exact-source test `tools/d173_e115_day27/test-real-day27.mjs`
- Production release unchanged; independent D172 HOLD.

## Delayed Cloudflare LAB namespace readback — measured after provider propagation

Read-only GraphQL at 2026-10-31 06:22:59 UTC from [GitHub Actions 41176347995](https://github.com/tamnv2/supra-inventory/actions/runs/41176347995) now shows **four distinct object IDs** in test-only namespace. The first two old objects belong to E113 benchmark; the **two newly created test objects** from E115 are identifiable by the distinct 60-websocket hibernation versus HTTP-only patterns.

| E115 fresh object metric | HTTP object (`…66e539d8`) | M2 WS object (`…218bb6d2`) |
| --- | ---: | ---: |
| DO raw HTTP invocations | 221 | 90 |
| DO raw hibernation invocations | 0 | 317 |
| SQLite Rows Read | 58,059 | 67,596 |
| SQLite Rows Written | 1,882 | 2,062 |
| Provider `duration` field | 0.374958592 | 0.297271168 |

**Actual measured SQL read cost on M2 is not lower:** M2 had **9,537 more rows read** in this workload, consistent with 60 additional WebSocket/SQL reads compared with HTTP. M2 hibernation raw invocations are **not the billed Compute Requests**; it is incorrect to add 90+317 and compare directly with HTTP221 or to treat 317/20 as a confirmed bill.

The two test objects are not 1:1 equivalent on **total** work because M2 additionally exercised 60 WebSocket upgrades and 60 Core reads. The 173 vs 173 matched read *subset* is equivalent by route and function, but aggregate namespace SQL usage contains the deliberately asymmetric connection stress and setup calls. Therefore **NO CLAIM OF CLOUDFARE $5 SAVINGS OR ROWS READ REDUCTION** is established by the current M2 transport. A genuine push/cursor/read-cache design and same-total-work A/B are prerequisites.

These numbers are from Cloudflare provider, not the client estimates, and were obtained with **read-only analytics only**; no repeat metered load after successful E115 single run.
