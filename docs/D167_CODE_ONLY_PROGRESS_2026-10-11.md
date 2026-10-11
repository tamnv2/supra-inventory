# D167 — CODE-ONLY implementation inventory (Owner 2026-10-11)

> **STATUS: IMPLEMENTATION IN PROGRESS, NOT CODE READY.** This branch/PR is a protected draft; never merge, release, enable Beta runtime, update Agent EXE/channel, Android APK, Firebase provider, or Stable without the Owner's explicit later scoped deployment approval. The Owner's current instruction authorized executable code and testing only.

## Scope successfully introduced in source branch

| Capability | Files | Evidence and caveat |
| --- | --- | --- |
| VN 05:00 FULL + randomized 12:00/19:00 DELTA schedule | `service/src/d167-sku-sync-logic.ts`, `relay-agent/D167SkuSchedule.cs` | Pure scheduler, stable 15-minute slot math and isolated Windows no-provider self-test. The Agent running schedule/executor is **not yet connected**. |
| Real WMS XLSX HY1 parsing | `relay-agent/D167SkuWorkbook.cs` | Parses SKU, product name, DC Site, Mã VTLT and Tính chất LT, aggregates pickable areas, dedupes, flags conflicting product names, preserves leading zeros, computes source fingerprint; no source credentials or quantity. **Managed Agent browser export not yet implemented/proved.** |
| One authoritative slot ledger, HA generation fence | `service/src/d167-sku-sync-core.ts`, `service/src/d167-sku-ha.ts`, `service/src/index.ts` | Beta-only restricted Agent API; verified Firestore PRIMARY role, lease/generation and heartbeat before every POST; DO staging, per-day+slot DONE, full-source fingerprint, CAS, atomic sparse publish and readback, identical source fingerprint no-staging fastpath for DELTA. Real browser end-to-end and 5k SQL load benchmark pending. |
| Daily active SKU and no deletion | `service/src/core.ts`, `service/src/d167-sku-sync-core.ts`, `service/src/business-core.ts`, `service/src/read-model-core.ts` | FULL hides absent only in active roster, preserves archival master/history, DELTA only actually changed fields, Picker new reports check current verified roster, lists/catalog exclude inactive; real device and existing day-close/ACK integration tests pending. |
| Web manual PATCH / same-day revision protection | `service/src/sku-import-core.ts`, `web/src/api.ts`, `web/src/operational-app.ts` | Revisioned dry-run preview and commit; SQL in-transaction CAS; changed/reintroduced SKU active; manual edited name timestamp; error if stale, Web paged upload passes revised expected revision. Web CSV/Excel optional coarse area input and separately guarded FULL REPLACE are **not yet fully implemented**. |
| LTA/Shelving temporal provenance | `service/src/d167-sku-sync-core.ts`, `service/src/d167-sku-sync-logic.ts` | One open area interval per SKU; verified LTA/Shelving changes or reliable observed UNKNOWN. Missing source area headers preserve previously valid evidence. Unknown before first proof; do not infer bin movement time. |
| Report overview/detail and Excel visibility | `service/src/d167-area-report-core.ts`, `service/src/business-core.ts`, `service/src/index.ts`, `web/src/operational-app.ts`, `web/src/api.ts`, `web/src/report-excel.ts` | Authenticated 60-day indexed as-of report; batch and Picker area-at-report columns; area summary in Web overview/detail; Excel includes area sheet and columns. Human Skip vs SLA timeout vs SYSTEM_DAY_END corrected in displayed sources. **Full metric-parity reconciliation, export pagination and real historical source testing pending**. |
| Synthetic regression/CI | `tests/d167-three-slot-sku.test.mjs`, `.github/workflows/verify-d167-three-slot.yml` | VN date/time, location ambiguity, FULL/DELTA, Web-edit preservation, SKU reactivation tests + Agent Windows compile/self-test and Worker typecheck; source-only checks are not physical/provider PASS. |

## Explicit remaining CODE READY blockers (MUST NOT MARK PASS)

1. **Windows PRIMARY Agent executor + same managed WMS browser**: prove separately attached, invisible, read-only WMS Bin Inventory Export within user-controlled existing Agent browser/profile, without extracting/replaying authentication, without changing Confirm Picklist page, and connect file to parsed manifest → authorized Agent Service API/three-slot event-driven triggers. Standalone tester with a separate browser and external credentials may NOT be used as a production implementation. Test fallback/no-login and 05:00 independent of 05:45 Picklist regular start.
2. **True WMS source completeness + performance**: verify raw file site/header/entire export and row anomalies; source file/hash readback; 2.5k–5k DO SQLite all-or-none SQL CPU/rows benchmark, 6-Agent fencing under genuine provider HA changes, network timeout after commit, manual conflict approval on Agent and Web.
3. **Completeness Web/Android**: Web SKU Excel with location optional field, explicit approved FULL REPLACE, Android catalog active-list tombstone/freshness correctness and existing realtime/FCM/ACK, full-filter Excel metric reconciliation and source attribution. No false historical as-of reconstruction.
4. **Usage and acceptance**: comparable 3-export/day cost vs old one-export design, Confirm Picklist p95/p99 nonregression, Firebase/DO/CPU write/read counts and physical hardware/login/HA tests. No measured savings or in-company Owner field PASS is claimed.

## Governance / resource statement

- Working branch `d167-code-three-slot-sku-area-report-20261011`, draft PR #559 targeting main, no merge.
- Existing Inventory Beta resources only. Registered Firestore role/lease documents are READ from service using existing IAM; no new provider collections or WMS business mutation.
- No secrets, cookies, private source files, employee data or WMS authentication recorded in GitHub.
- Stable remains OWNER-GATED; no Beta or Stable provider changes were made by this PR.
