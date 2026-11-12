import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const web = source("web/src/operational-app.ts");
const api = source("web/src/api.ts");
const core = source("service/src/operational-v2-core.ts");

test("E209: suffix-only search, no prefix or middle match, numeric minimum 3", () => {
  const match = (sku, term) => /^\d{3,32}$/.test(term) && sku.endsWith(term);
  assert.equal(match("10011233", "233"), true);
  assert.equal(match("10011233", "1233"), true);
  assert.equal(match("10011233", "123"), false);
  assert.equal(match("10011233", "100"), false);
  assert.equal(match("10011233", "23"), false);
  assert.match(core, /INVALID_SKU_SUFFIX/);
  assert.match(core, /b\.sku LIKE \?/);
  assert.match(core, /sku_suffix/);
  assert.match(web, /placeholder="Tìm SKU theo các chữ số cuối"/);
  assert.match(web, /opsInput\.value\.replace\(\/\\D\/g, ""\)/);
  assert.match(web, /if \(!wasSearching && next\.length < 3\) return/);
});

test("E209: search is server-side before pagination and omits expensive aggregates", () => {
  assert.match(core, /WHERE \$\{clause\}/);
  assert.match(core, /LIMIT \? OFFSET \?/);
  assert.match(core, /const totalsRow = suffix \? \{\} : first/);
  assert.match(core, /const ackTotals = suffix \? \{\} : first/);
  assert.match(core, /totals_included: !suffix/);
  assert.match(web, /recent\.totals_included !== false/);
  assert.match(web, /recentFilter === "CLOSED"/);
  assert.match(web, /viewKey !== \[recentFilter, recentFrom, recentTo, opsSkuSuffix, recentOffset\]/);
  assert.match(api, /if \(pickerRows\) params\.set\("picker_rows", "1"\)/);
});

test("E209: withdrawn list is grouped by employee inside exact batch, counted and paginated as picker rows", () => {
  assert.match(core, /GROUP BY b\.batch_id, t\.picker_employee_code/);
  assert.match(core, /MAX\(t\.withdrawn_at\) AS withdrawn_at/);
  assert.match(core, /const filteredTotal = \(suffix \|\| pickerRows\)/);
  assert.match(core, /LEFT JOIN users withdrawn_user/);
  assert.match(web, /withdrawn_picker_employee_code/);
  assert.match(web, /dòng Picker thu hồi/);
  assert.match(web, /recentFilter !== "CLOSED"/);
});

test("E209: pending search uses cached complete queue, overdue server handles all pages", () => {
  assert.match(web, /row\.sku\.endsWith\(opsSkuSuffix\)/);
  assert.match(web, /loadCompleteReporterQueue/);
  assert.match(api, /getReporterOverdue\(limit = 100, offset = 0, suffix = ""\)/);
  assert.match(core, /REPORTER_OVERDUE_PAGE/);
  assert.match(core, /s\.overdue_picker_count > 0\$\{skuPredicate\}/);
  assert.match(web, /overdueSearchOffset \+ 200 >= overdueSearchTotal/);
});

test("E209: no extra picker-fetch and no mutation-read-model overwrite", () => {
  assert.match(web, /if \(!batchId \|\| batchDetails\.has\(batchId\) \|\| batchDetailLoads\.has\(batchId\)\) return/);
  assert.match(web, /prefetchBatchDetails\(batchId\);/);
  assert.match(web, /expandedRecentPickerBatches\.has\(batchId\)/);
  assert.match(web, /recentFilter === "CLOSED" \|\| opsSkuSuffix\.length >= 3/);
  assert.match(web, /read_model contains no suffix/);
});

test("E209: date range retains first_report_at, no Apply button or report redirect", () => {
  assert.match(core, /b\.first_report_at >= \?/);
  assert.match(core, /b\.first_report_at < \?/);
  assert.match(web, /input\[type=date\]/);
  assert.doesNotMatch(web, /id="recent-open-report"/);
  assert.doesNotMatch(web, /type="submit">Áp dụng<\/button>/);
  assert.match(web, /showFirstReport \? "<th>Thời gian báo hàng đầu tiên<\/th>"/);
});
