# D166 — Evidence Bin Inventory V3 từ Owner (09/10/2026)

**Mode:** Documented sanitized analysis; private workbook and screenshot are **not committed**. **Owner authorized scope:** the already-registered WMS browser UI and existing Inventory Beta Worker/InventoryCore. This evidence unblocks file-format and visible action-label identification, **not** authenticated production import, safe DOM selector proof or PRIMARY deployment.

## Visual evidence

Owner screenshot on the existing WMS UI `/sft3/app/report/bin-inventory` shows:

- Customer selector displays `WIN - WinCommerce`.
- DC Site selector displays `1291 - Urban`.
- Search field: SKU / storage-location / location-code search; left blank for full inventory.
- Search button `Tìm Kiếm`, then `Export`. There is **no separate "Đồng bộ" button** on this screen.
- Table has pagination with initial 10 visible rows. Visible row count on screenshot is a transient UI snapshot, not proof the exported workbook covers identical rows at the same instant.
- Do not use numeric screen positions as selectors. Automated UI test must require exactly one visible enabled button matching each action label, wait until search finishes and the table is stable, then invoke Export exactly once and verify download completion. No WMS HTTP/API calls, cookie extraction or DevTools network interception.

## Workbook structure verified from Owner-provided 833-KiB report

Original file: `REPORT_BIN_INVENTORY_HY1_20261009_2116.xlsx` (NOT included in public repo). First Excel worksheet:

| Item | Verified count/format |
| --- | --- |
| Worksheet shape | `A1:S10242`, 19 columns, 1 header + **10,241 data rows** |
| Required columns | B=`DC Site`, C=`SKU`, D=`Tên sản phẩm` |
| All customer/DC rows | Customer `WIN`, DC `1291 - Urban` |
| Unique SKU | **2,476** |
| Extra rows repeating a SKU | **7,765** — report is storage/lot level, not SKU master-level |
| One SKU mapped to multiple names **within this file** | **0** |
| ZoneCode | column S is blank in all data rows; do NOT assume it is suitable for area analytics |
| Other fields | storage-location, batch, PO, quantity, dates, Base Units — none are approved SKU-master import fields |

SHA256 content hash and row data are kept local/ephemeral. Do not publish file content, SKU values, product names, PO, location, or credentials into logs or GitHub. Only SKU/name pairs may be imported after explicit authorization and validation.

**Critical business semantics:** 2,476 source SKU with no name conflicts **within the file** does not prove there are zero name conflicts against the current InventoryCore catalog. The only authoritative answer is the existing `dry_run` Service validation + Agent-side confirmation on changed names. File row count is not SKU master count. Imported SKU are deduplicated by normalized SKU; absent existing SKUs are **not** deleted.

## D166 V3 test implementation boundary

A standalone **preflight tester** has source for manual `Thử Tìm→Export` click sequence using exactly matched visible buttons, bounded table-settle wait and a WebView2 `.xlsx` download completion event. The downloaded file is parsed by a new offline OOXML validator, showing only aggregates and strict `1291 - Urban` site provenance; ZIP log is sanitized. The user may separately click `Kiểm tra Excel` to validate local workbook.

This does **not** make V3 automatic upon PRIMARY startup/05:00; no Agent Firebase session is moved out of Agent, no Agent-auth import route, server daily lease or authorized SKU data mutation is present. The test is standalone/standby only. The Owner's requested full V3 requires Agent+Service code, atomic Service daily guard, authentication and field CI plus explicit release gate. Refer `docs/D166_SKU_AUTO_V3_APPROVED_FLOW_AND_GATES.md`.

## Required regression

- Selftest workbook: synthetic-only file, duplicate aggregation, different name conflict, wrong DC denial, header recognition; never use Owner's real file as a CI fixture.
- Browser: direct exact WMS page, unique search/export button, timeout fail closed, xlsx download completed, corrupted xlsx or stale file rejected, session login required stays website-owned.
- Existing Agent PRIMARY confirms unaffected; no claim of true process isolation while browser profile is shared.
- Authority+continuity+Windows build/security PASS and on-device field PASS before merging/releasing; Stable OWNER-GATED.
