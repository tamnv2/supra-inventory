# D173-E122 — Owner-approved SQL Query-ID evidence extraction (02/11/2026)

## Exact permission and production boundary
Owner explicitly directed collecting **actual query-ID SQL rows-read measurements** without asking for a Firebase token, service-account JSON, Windows manual export or repeated log uploads. E122 is part of D173. Protected single-Production Worker is the existing technically Beta-named `supra-inventory-beta` / InventoryCore at `inventory.supra.cc.cd`. Legacy Stable is OWNER-GATED. D172 OBPP1291 remains independent PENDING/HOLD.

The approved source delta is limited to:
- `service/src/d173-sql-audit-auth.ts` — HMAC verification using **existing** D166 Cloudflare read-only Worker secret; fixed GET route and 90-second timestamp skew.
- `service/src/index.ts` — one protected aggregate-only GET `/api/internal/d173/sql-evidence`, returning only the existing `InventoryCore /diagnostics/d167/usage` result.
- `.github/workflows/d173-usage-readonly-collect.yml` — source CI, aggregate Cloudflare analytics and **post-deploy** actual SQL query-ID capture. The SQL artifact must contain no credentials or raw business SQL.
- Tests, exact source/Owner release gate and canonical state/continuity in this same PR.

No business write, schema migration, new provider resource, Firebase Rules, client APK/EXE, auth/login rules, D172-owned source or Stable mutation is authorized. This narrow release changes existing shared Worker executable code; D172/auth/email regression is mandatory. All provider aggregate API reads use the existing protected GitHub Beta environment token, never copied to the repository or user-visible output.

## Security and billing truth
Cloudflare account-wide DO Rows Read is **not** InventoryCore-only SQL rows read. The existing D166 counters cover 15 allowlisted query IDs, return 36h from InventoryCore `d173_usage_counters`, and are `ESTIMATE_NOT_PROVIDER_BILLING`. Never fabricate full SQL coverage. The signed Worker route does not accept a raw Cloudflare token, password or ID token; only a short-lived HMAC computed from the existing beta secret. A bad signature, wrong HTTP method/route, expired timestamp, missing secret, non-beta deployment or malformed signature fails closed.

GitHub Actions performs a matching exact-source /health check after successful **main** Worker deployment. Only if the deployed Worker commit equals the completed deploy workflow SHA does it call the signed query-ID endpoint and upload a 7-day short-lived sanitized artifact. A mere PR code PASS is **not** the actual SQL evidence.

## Gates
1. Protected PR #826, complete current source change journal, exact HMAC unit tests, Worker TypeScript typecheck, email/auth immutable-source guard and independent D172 business regression.
2. Exact source blob pins in `ops/d173-e122-sql-audit-release-authorization.json`. Owner permission is narrowly Worker-only, but **never** overrides required CI.
3. Merge only with explicit `D173-E122_SQL_AUDIT_RELEASE:` commit title after source CI proves eligible; registered Gateway, Android, Agent, Firebase and Stable must not be redeployed as part of this change.
4. Release receipt must cite real Worker run SUCCESS, exact /health SHA and successful live SQL artifact retrieval, then analyze top query IDs; do not call FIELD/Owner PASS from CI.
5. If any gate fails, fix and re-run in same PR. D172 remains HOLD.
