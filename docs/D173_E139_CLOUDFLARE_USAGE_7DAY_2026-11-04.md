# D173-E139 — Cloudflare usage read-only, 29/10–04/11/2026

## Phạm vi & chứng cứ
- Read-only GitHub Actions: https://github.com/tamnv2/supra-inventory/actions/runs/41855956708
- Source: Cloudflare GraphQL API (daily Vietnam time, `Asia/Ho_Chi_Minh`) and account billable-usage endpoint (UTC provider periods).
- Token is used only as GitHub Environment `beta` secret `D173_CF_USAGE_READONLY_TOKEN`. No token value logged, committed or included in artifact.
- Generated 2026-11-04T15:16:16Z (22:16:16 VN). The Nov 04 data is PARTIAL.
- Durable Objects and D1: **account-shared**, cannot attribute purely to SUPRA Inventory or exclude D172 consumption from account aggregates. Workers: script-filtered `supra-inventory-beta`.
- AdaptiveGroups are provider analytics (possibly sampled); do not confuse with final billable usage or per-route SQL attribution. Stable remains OWNER-GATED, D172 independent PENDING/HOLD.

## GraphQL Analytics observed daily

| VN Day | DO invocations | DO SQL rows read | DO SQL rows written | DO GB-s | Worker requests (script) | Worker CPU ms (script) |
|---|---:|---:|---:|---:|---:|---:|
| 2026-10-29 | 38,947 | 112,387,603 | 127,586 | 262.37 | 30,294 | 111,108 |
| 2026-10-30 | 41,564 | 111,673,035 | 148,310 | 503.44 | 33,090 | 119,551 |
| 2026-10-31 | 36,696 | 111,192,001 | 142,693 | 672.60 | 28,115 | 98,009 |
| 2026-11-01 | 2,611 | 3,523,997 | 19,898 | 17.59 | 1,670 | 27,730 |
| 2026-11-02 | 52,138 | 317,606,631 | 284,790 | 2,334.16 | 29,427 | 123,822 |
| 2026-11-03 | 64,468 | 186,392,845 | 320,097 | 1,723.81 | 33,297 | 137,179 |
| 2026-11-04 (22:16 VN, partial) | 36,896 | 83,951,402 | 158,602 | 738.39 | 28,893 | 115,638 |

- DO requests 04/11 vs 03/11: -42.77%; rows read -54.96%; duration -57.17%; Worker requests -13.23%, all comparisons partial-vs-full.
- DO requests 04/11 vs mean 29,30,31,02,03: -21.1%; DO rows read -50.0%.
- 01/11 low traffic on both GraphQL and provider billing, not a reliable normal-workload baseline.
- 02/11 rows read/request approx 6,092 vs 2,687–3,030 on 29–31/10; possible query amplification, causation NOT verified.
- D1 Analytics 31/10 MISSING_TIME_BUCKETS; 01–04/11 NO_DATA, do **not** report as definitive zero.

## Provider Billing API snapshot & planning risk

- Billing endpoint returns included-tier UTC-day line items **through 03/11**, not 04/11. API does not establish invoice cycle start or final charges in this evidence.
- Sum of the available UTC days **19/10–03/11** (16 days; do not call this full billing cycle):
  - DO Compute Requests **652,248** (~65.2% of monthly 1,000,000 included; ~130.4% of Owner's 500k internal 50% allocation)
  - DO SQL Rows Read **4,731,729,080** (~18.9% of 25B included)
  - DO SQL Rows Written **2,152,951** (~4.3% of 50M included)
  - DO Compute Duration **8,411.10 GB-s** (~2.1% of 400,000 GB-s included)
  - Workers Standard Requests **504,115** (~5.0% of 10M included)
  - Workers CPU **1,794,151 ms** (~6.0% of 30M included)
  - D1 Rows Read **7,941** from available lines through 30/10; missing lines after that are not proof of zero.
- If the complete billing cycle still has >8–9 days before reset and DO requests continue at ~39k/day, the **1M included** threshold may be crossed; this is a conditional forecast, not a confirmed invoice overage. A 50% internal planning target is already exceeded in the observed window alone.
- Billing data here has included-tier quantities but no verified amount or monthly cycle dates; no assertion of zero overage or exact billed USD. Other unused metric allowances do not substitute for DO request quota.

## Gate
- PR read-only evidence workflow only. No Worker, Agent, Android, Web, Firebase, business SQL, D172 or Stable source mutation; no Production release.
- Preserve this summary as ANALYSIS / BILLING_FIELD_NOT_YET_FINAL; no FIELD/OWNER PASS inference or proposed change authorization.
