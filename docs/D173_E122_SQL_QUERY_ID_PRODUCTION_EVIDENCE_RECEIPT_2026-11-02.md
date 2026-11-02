# D173-E122 — Production SQL Query-ID evidence receipt (02/11/2026, VN)

## Exact release and direct evidence

- Owner direction: collect real SQL query IDs automatically without password, manual token handoff or repeated log exports.
- Existing Production Worker/Web at `inventory.supra.cc.cd` merged via PR [#826](https://github.com/tamnv2/supra-inventory/pull/826), exact main commit `aad9d06218d0a41078edfa75d2a3921bc7496ddf`.
- Worker deploy run [41484806469](https://github.com/tamnv2/supra-inventory/actions/runs/41484806469) **SUCCESS**: official /health source SHA matches, existing SQLite schema 17 health PASS, auth guards PASS, private D166 secret re-installed by protected workflow, no new resource or migration.
- Initial post-deploy SQL collector `workflow_run` [41485415837](https://github.com/tamnv2/supra-inventory/actions/runs/41485415837) failed because runner Python `urllib` health check could not verify deployed SHA, **not** because the SQL query ID endpoint returned business SQL failure.
- One-shot scoped read-only collector PR [#827](https://github.com/tamnv2/supra-inventory/pull/827) used `curl` from GitHub runner with same protected Beta read credential and SHA-matched HMAC route. [Run 41485775783](https://github.com/tamnv2/supra-inventory/actions/runs/41485775783) **SUCCESS**, SQL artifact `d173-sql-query-id-evidence` GitHub artifact ID **13162326490**, JSON `inventorycore-sql-summary.json` and `status:OK`.
- Scope: source `INVENTORYCORE_AUTHENTIC_D166_SQL_CURSORS`; `durable:true`; `coverage:SQLITE_DURABLE_HOURLY_AGGREGATE__ALLOWLISTED_HOTPATHS__ESTIMATE_NOT_PROVIDER_BILLING`; 240 hourly/query records from 14 observed IDs within last 36h, period touching 00:00–23:00 VN on 02/11.
- Combined measured SQL `rows_read=213051618`, `executions=103379`, 103379 estimated extra telemetry SQLite upserts. No user-level records, SQL text or secrets in artifact.

## Top measured causes

| Query ID | Rows Read | Executions | Share of measured rows read |
|---|---:|---:|---:|
| RECENT_ACK_TOTALS | 183311629 | 5425 | 86.04% |
| RECENT_RESULTS_PAGE | 14233551 | 5425 | 6.68% |
| PICKER_REPORTS_PAGE | 4749562 | 5344 | 2.23% |
| PICKER_REPORTS_COUNT | 4432835 | 5344 | 2.08% |
| Other instrumented queries | 6324041 | — | 2.97% |

`service/src/operational-v2-core.ts` **1117–1143**: `RECENT_ACK_TOTALS` computes `recent_batches AS MATERIALIZED`, joins `result_acknowledgements`, groups by batch/version, and repeats multiple `COUNT(DISTINCT target_user_id)` operations. Source and measured 5425 repeated executions justify targeted query-plan, aggregation reuse, delta/revision caching and exact parity tests **before** a production SQL logic rewrite.

Cloudflare DO provider accounting is account-shared, broader than these 14 InventoryCore instrumented query IDs; the earlier provider read at 23:14 VN on 02/11 yielded `317481945` account-shared rows read and `51947` DO requests. Its window differs from this evidence extraction and cannot establish unexplained reads as a direct subtraction.

## Acceptance and remaining work

- **D173-E122 CODE/CI: PASS** for the exact read-only Worker source PR #826, signed HMAC negative tests, Worker typecheck and D172 isolation.
- **Worker RELEASE TECH: PASS** E122 run41484806469.
- **Live SQL query evidence: PASS** run41485775783, `status:OK`, persisted aggregate results.
- **SQL optimization CODE/CI/RELEASE/FIELD: NOT DONE**. E122 only adds an authenticated diagnostic path, does not alter the heavy SQL or business results.
- **Physical FIELD / D173 Owner PASS: PENDING**. D172 standalone remains **PENDING/HOLD**; Legacy Stable remains **OWNER-GATED**.
- Docs-only maintenance PR #827 also repairs reusable collector to use curl for **future successful Production Worker releases**; it does not redeploy Worker/Web or change provider business data.
