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

## 2026-10-11 — Owner supplied a newer real HY1 export and corrected test evidence

- The earlier **separate Windows Agent SKU tester** was in fact field-tested successfully for its bounded flow: read-only WMS XLSX export, SKU/name parse, 3 Inventory Beta import chunk receipts, and 3 sampled readbacks. This evidence is already recorded in `ops/project-state.json#d167.isolated_sku_test_2026_10_10`. **Do not ask Owner to rerun or rebuild that independent proof.**
- A newer Owner-provided `REPORT BIN INVENTORY` 2026-10-10 workbook was inspected locally without publishing its rows, SKU codes, product names, exact bins, or credentials: 8,848 data rows; 2,493 distinct SKUs, one validated `1291 - Urban` site; 4,904 `Có thể lấy hàng` rows; 2,207 distinct pickable SKUs = 1,017 LTA + 1,190 Shelving; 286 distinct SKUs have no pickable location. No conflicting names per SKU and no SKU with simultaneously known LTA+Shelving pickable area in this particular snapshot. Header columns required by `D167SkuWorkbook` are present.
- **Business distinction:** preserve all 2,493 source SKUs in the FULL daily membership, including the 286 with area `UNKNOWN/NO_PICKABLE_LOCATION`. Only assign LTA/Shelving to a valid pickable location; do not discard a catalog SKU merely for missing pickable placement.
- A **synthetic** regression recreates these aggregate counts, not actual product details. Real-file completeness/parse has been inspected; this does not prove the new PRIMARY managed-browser export API, real 3-slot automation, durable 5k-row SQL performance, installed-vehicle field tests, or per-provider usage.
- **Remaining engineering barrier is integration, not the prior standalone test**: the successful tester uses its own Edge login/profile and an external HTTP export with in-RAM header capture; current Owner D167 security policy requires executing the export inside the **existing Agent managed WMS browser/profile** without exporting/replaying its authentication outside that browser. The tester's credential-handling path must not be copied to the new production Agent.
- D167 CODE READY still depends on completing this same-browser integration, exact WMS source validation, report/Excel parity, full catalog readback, 5k SQL / multi-Agent / Android compatibility regressions and PR checks. **No Beta or Stable deployment is claimed.**

## 2026-10-12 — Owner CODE PASS ONLY hold, no deploy

Owner explicitly supersedes the earlier 2026-10-11 combined D167 PR #559 code+Beta rollout instruction **for work not yet released**. Finish the entire approved source and all non-deploying CI/regression to CODE READY; **STOP with this PR Draft and unmerged**. No Worker/Web/DO, Agent EXE/channel, Android APK/OTA, Firebase Rules, Apps Script Gateway, live WMS automation, live SKU catalog mutation, Beta or Stable deployment. Existing installed Beta releases remain untouched.

- PR CI may build/check source and use synthetic/mock fixtures, but must not publish artifacts to release channels, change production provider resources, run live WMS jobs or enable SKU-hiding flags.
- Validate current managed-browser integration statically and in isolated nonmutating CI. Any proof that necessarily requires real company WMS, live PRIMARY or physical PDA remains explicitly `FIELD_PENDING`, not fictitious CODE PASS. Owner will separately approve a scoped release/field validation later.
- Retain the existing 3-slot behavior, day-scoped FULL/DELTA, no deletion, atomic publish, historical area, reporting/Excel correctness, HA/ACK and quota regressions as mandatory CODE READY requirements.
- The 2026-10-11 Beta PR #555 technical release is historical and is not rolled back; new release permission is **not inherited**.

## 2026-10-12 — Continued implementation / FULL REPLACE and reporting parity

**Latest Owner command:** finish source and CI to CODE PASS only; Draft PR #559 remains unmerged and **no release/deploy**. The original entries above saying the Agent executor or same-managed-browser export are "not implemented" are stale regarding *source presence*: the branch now contains `relay-agent/D167SkuCoordinator.cs`, `D167SkuBrowserExport.cs`, `SupraConfirmBrowserD167.cs`, hosted WebView2 child handling, and `D167SkuServiceClient.cs`. Real Office WMS / company multi-Agent field E2E remains **unproven** and must not be conflated with existence/CI of this source.

| Scope | Current source implementation | Verification boundary |
| --- | --- | --- |
| PDA Confirm protection | Agent includes automatic D160 PDA work **and** manual work in the SKU export busy predicate; runtime approval dialog is created by the background job without a blocking main Agent-UI Invoke | Windows Agent CI compile, actual WMS latency field PENDING |
| FULL safety | Preview/approve guard for unexpectedly large active roster reduction (previous active >=300 and hide >max(150,40%)); no change to existing history; no silent large hide | Source guards + synthetic SQL, production provider/5k DO CPU unmeasured |
| Intraday staging | Noon DELTA coalesces durably into evening if still open once evening scheduled, Agent does not replay stale noon | Source/test guard, 6-Agent physical HA pending |
| Source cleanup | Agent deletes parsed XLSX and closes only hidden isolated WMS child target, preserving Confirm page | Windows build, managed WebView2 live proof pending |
| Report area coherence | Batch and Picker detail area filters use historical as-of SQL; Web filter/Excel pagination includes LTA/Shelving/UNKNOWN; overall KPI is labelled all-area | Web/Service build source proof, company dataset numbers pending |
| Manual Web FULL REPLACE | Optional only for Admin/Root; PATCH default; bounded FULL preview and explicit confirmation, revision+source-hash CAS, one atomic SQL catalog publish, no SKU/history deletion, inactive tombstones/membership epoch, readback, audit, idempotent lost-response receipt | Source CI/SQLite regression, actual 5k DO resource benchmark and PDA field pending |

**No provider resources, secrets, new WMS mutation, runtime release, Agent/Android app channel or Stable changes.** Workstream updates are recorded in `ops/change-continuity/D167.json`. Code-only proof remains separate from field acceptance and Owner D167 PASS. The last exact-head CI verdict must be read from GitHub, never taken from an earlier passing commit.

### D167 manual Web SKU area source parity (2026-10-12)

- SKU Excel parser now supports an **optional** `Khu vực` / `Area` column with only `LTA` or `Shelving`; absent/blank column does not erase an existing area; a duplicate SKU carrying contradictory areas fails source validation.
- Default Web PATCH previews same-name and same-field area edits. Explicit operator confirmation and catalog revision CAS precede any new admin-approved area interval. `WEB_APPROVED_PATCH` stores source class; intervals start at the approval timestamp and never retroactively change old reports.
- Root/Admin-only optional Web FULL REPLACE also accepts an area column; previews all category/name/membership changes and requires affirmative confirmation, then atomic source-hash/revision-fenced publish, complete membership readback, `WEB_APPROVED_FULL` interval, audit and idempotent receipt. History and hidden SKU remain physically preserved.
- Area-only and semantic no-op Web imports do not emit PDA catalogue refresh/FCM; only actual names/active memberships change the Android catalogue version.
- **CI/field distinction:** branch TypeScript/Windows/SQL contract validations are code evidence; installed PDA ACK/HA, company WMS profile, real SQL 5k latency and provider billing are **FIELD_PENDING**. Do not mark operational Owner PASS from workflow success.
