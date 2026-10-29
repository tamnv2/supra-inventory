# D173-E097 — P0 InventoryCore SQLite_NOMEM / HTTP500 (29/10/2026)

## Owner authority and scope
Owner 29/10: "Anh duyệt, em tiến hành xử lí triệt để cho anh" following incident diagnosis. Existing Production Worker `supra-inventory-beta` for `inventory.supra.cc.cd` only. Same InventoryCore SQLite, no new namespace/provider/database. D172 OBPP1291 remains independent PENDING/HOLD and requires shared Worker regression. Separate Stable OWNER-GATED. No Android/Web/Agent/Gateway/Firebase/WMS modification.

## Verified field evidence, not a proven root cause
- SUPRA official `/health` captured 29/10 15:43 VN: HTTP503, `storage: {ok:false,status:"unavailable"}`, 7/7 required bindings configured, Worker source SHA `6824de94ac99183f8a3d4bd2120bc729ed8f7638`.
- Owner-reported Web and Android HTTP500 both on Office/4G-hotspot.
- User-provided Cloudflare Worker CSV window 08:37:26–08:54:49 UTC (29/10), 2000 sampled events, 613 HTTP500 responses, 21 `SQLITE_NOMEM` log lines representing 11 distinct request IDs. Correlated private core paths include realtime ticket, operational realtime delta, and /health. This is not the entire day's request count. **No raw CSV/headers/IP/users/tokens in public GitHub.**
- Memory P50 5.83 MB, P90 6.33 MB, P99 6.65 MB, P999 6.74 MB in Owner screenshot. This does not prove Worker isolate exceeded 128 MB or identify a SQL statement. Future chart after screenshot time is not evidence of a crash.
- The existing Worker `checkCore` collapses failed DO fetch, malformed response and core 503 into `storage.unavailable`. The Worker catch returns generic HTTP500 for exceptions.
- Exact live source `InventoryCore.constructor` always calls `initializeSchema`, which repeats DDL, indexes and legacy backfill checks on each DO activation, including shared D172. A potential amplification mechanism, **not proven causal**.
- Cloudflare provider-level storage failure remains possible; `SQLITE_NOMEM` is distinct from `SQLITE_FULL`. No evidence of data loss.

## Scoped source candidate
- `service/src/core.ts`: before legacy schema initializer, read-only check of schema version 17, required existing tables/indexes/columns, all three D172 historical migration markers, and V2 readiness. A fully migrated DO skips repeated DDL/backfills after optional bounded usage-metrics maintenance. Any missing guard falls through to the **unchanged original schema initializer**. SQLITE_NOMEM, CORRUPT, IOERR and FULL are not hidden by fallback. On bootstrap failure, emit only allowlisted phase/code and rethrow.
- Preserve `blockConcurrencyWhile`, SQL structure, all business routes, D172 code, auth/RBAC, realtime contract, HA and telemetry semantics. Future schema changes MUST update required markers or change version before fastpath.
- `tools/d173_e097_startup_regression.mjs` runs via existing E086 Worker regression fixture. Read-only warm boot; missing schema/migration/operational readiness -> original initializer; storage failure fail-closed.
- No destructive maintenance, table rebuild, PITR restore, DB replacement, namespace reassignment, emergency bypass or retry storm. Never treat source CI as field PASS.

## Gates and recovery plan
1. Exact source CI: TypeScript, new bootstrap fixture, E086 WebSocket, D172 auth/private SQL/Sheet regression, E055 SQL parity, E049 usage persistence, WMS/Agent/Android compatibility and security/authority guards.
2. If SOURCE PASS, prepare exact-SHA authorized Worker-only release with rollback proof. Do not reuse Agent158 authorization; new E097 Owner approval and release pin must be validated by release guard.
3. Production deploy of existing Worker only after executable release guard. GET `/health`: HTTP200 + storage.ok + exact new source SHA; internal realtime ticket/delta under real workload, D172 isolated checks, Cloudflare exceptions and memory/SQLite error rate at matched interval.
4. If startup still throws SQLITE_NOMEM or provider errors persist, **do not create a fresh DO/SQLite**. Raise Cloudflare support incident with sanitized timestamps, error code and request references privately, and consider prior Worker-source-only rollback after checking safety. Never infer full success from one /health.

## Status
OWNER APPROVED RECOVERY SCOPE; CODE CANDIDATE in PR795. CI / MERGE / PRODUCTION RELEASE / FIELD / OWNER PASS unverified until explicit receipts. D172 PENDING/HOLD. Stable OWNER-GATED.
