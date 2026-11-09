# D172-E059 — OBPP v10 HTTP 500 history migration guard (09/11/2026)

## Field report and observed facts

- Owner installed signed OBPP v10 and reported HTTP 500 `OBPP_REQUEST_FAILED` when loading Cloud data.
- Protected E057 release commit: `c5326f7849d8782e89ace4927ae3a6b16c694b9b`; first Worker deployment failed D146. Recovery main `4a7d84d41ded6d6fba14b3f0320efe9350c5f1e3` subsequently passed Worker workflow 42628175071 and standalone signed v10 workflow 42628175038. Do not attribute this field failure to the *earlier* blocked release without fresh proof.
- Source root cause: `service/src/core.ts::isExistingSchemaReady()` E097 fast-path validates legacy `obpp_*` tables but omits E057's `obpp_record_changes` and `obpp_records_page_idx`. Production D172 v9 SQLite can satisfy that legacy readiness list, skip `initializeObppSchema()`, then the v10 GET `/obpp1291/records` calls `maxObppChangeSeq()` and queries a table that was never created. The Core catch returns generic HTTP 500 `OBPP_REQUEST_FAILED`.
- No raw Cloudflare exception/runtime trace was available; this is a deterministic vulnerable source path, not independent evidence of the actual database schema.

## Minimal D172 repair candidate

- Add the E057 journal table and pagination index to the existing fast-path requiredObjects list. A pre-v10 database falls through once to the already existing, idempotent `initializeObppSchema()`. Future requests can take the fast-path again.
- Retain all records, identities, outbox, Google Sheet ranges and signed OBPP v10 APK unchanged. No data deletion, schema reset, new credentials, Worker resource, polling, Android package, Agent/Web or Stable change.
- Add source tests for v9-readiness rejection and migration table/index creation. D173 E097 startup regression fixture was updated **only** to include the required v10 table/index in its ready-schema mock, with negative cases for missing journal/index; this repairs a mock contract failure (the actual test previously asserted v9 schema was ready). Run D172 backend, D173 E097/WebSocket, shared D173 E123, authority/state CI before any Worker-only release.
- Production verification MUST confirm the merged Worker /health source pin and authenticated OBPP `GET /records?limit=100` plus `GET /records/changes?after=0` with a legitimate non-test account. Never expose tokens or raw records in public logs.
- Until verified, CODE/CI/RELEASE/FIELD/OWNER are independent. This document and code stage do not grant a new Worker release authorization or override the E057 exact-source protection. D172 remains PENDING/HOLD.

## Impact and rollback

- Scope: shared `service/src/core.ts` readiness *only* and existing isolated `obpp_*` SQLite DDL. No D173 business mutation. Cloudflare D172 queries should return normally once the table exists.
- Idempotent DDL is forward-only; do not roll back by dropping the new table because its tombstone journal may contain future changes.
