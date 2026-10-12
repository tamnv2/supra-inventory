import assert from "node:assert/strict";
import test from "node:test";
import { vnDayAt, slotWindow, randomSlotTarget, normalizeSourceRows, planSkuChanges }
  from "../service/src/d167-sku-sync-logic.ts";

const old = (sku, name, area = "LTA") => ({
  sku, product_name:name, area, area_verified:true, area_reason:"VERIFIED",
  active:true,last_wms_name:name,last_wms_area:area,
  manual_name_revision:0, manual_area_revision:0,last_wms_observed_ms:100,
});
test("VN day calendar and exact 05:00 eligibility", () => {
  assert.equal(vnDayAt(Date.parse("2026-10-10T18:00:00Z")),"2026-10-11");
  const initial=slotWindow("INITIAL_05","2026-10-11");
  assert.equal(new Date(initial.start_ms).toISOString(),"2026-10-10T22:00:00.000Z");
  assert.equal(randomSlotTarget("INITIAL_05","2026-10-11",0.7),initial.start_ms);
});
test("12/19 random targets remain inside 15-minute window", () => {
  for(const slot of ["DELTA_12","DELTA_19"]) {
    const x=slotWindow(slot,"2026-10-11");
    for(const fraction of [0,0.1,0.55,0.9999]) {
      const m=randomSlotTarget(slot,"2026-10-11",fraction);
      assert.ok(m>=x.start_ms&&m<x.end_ms);
    }
  }
});
test("pickable WMS rows merge SKU with multiple shelving positions", () => {
  const a=normalizeSourceRows([
    {sku:"00123",product_name:"Mặt hàng A",storage_location:"39.23.02",pickable:true},
    {sku:"00123",product_name:"Mặt hàng A",storage_location:"39.23.03",pickable:true},
    {sku:"00123",product_name:"Mặt hàng A",storage_location:"TL.1.1",pickable:false},
  ],{site_verified:true,location_header_present:true});
  assert.equal(a.length,1);assert.equal(a[0].sku,"00123");
  assert.equal(a[0].area,"SHELVING");assert.equal(a[0].area_verified,true);
});
test("LTA/Shelving ambiguous => UNKNOWN unverified; no pickable => UNKNOWN verified",()=>{
  const x=normalizeSourceRows([
    {sku:"2",product_name:"B",pickable:true,storage_location:"LTA.16.14"},
    {sku:"2",product_name:"B",pickable:true,storage_location:"12.09.02"},
    {sku:"3",product_name:"C",pickable:false,storage_location:"TL.1.1"},
  ],{site_verified:true,location_header_present:true});
  assert.equal(x[0].area_reason,"MULTIPLE_AREA");
  assert.equal(x[0].area_verified,false);
  assert.equal(x[1].area,"UNKNOWN");
  assert.equal(x[1].area_reason,"NO_PICKABLE_LOCATION");
  assert.equal(x[1].area_verified,true);
});
test("source missing area column is NOT equivalent to no pickable",()=>{
  const x=normalizeSourceRows([{sku:"3",product_name:"C"}],{
    site_verified:true,location_header_present:false
  });
  assert.equal(x[0].area_verified,false);
  assert.equal(x[0].area_reason,"MISSING_AREA_COLUMN");
});
test("duplicate SKU different name refuses the entire manifest",()=>{
  assert.throws(()=>normalizeSourceRows([
    {sku:"3",product_name:"C"},{sku:"3",product_name:"D"},
  ],{site_verified:true,location_header_present:false}),/CONFLICTING_NAMES/);
});
test("FULL hides absent rows; DELTA never hides absent",()=>{
  const existing=[old("1","one"),old("2","two")];
  const incoming=[{sku:"1",product_name:"one",area:"LTA",area_verified:true,area_reason:"VERIFIED"}];
  assert.deepEqual(planSkuChanges(existing,incoming,"FULL",100).hide,["2"]);
  assert.deepEqual(planSkuChanges(existing,incoming,"DELTA",100).hide,[]);
  assert.equal(planSkuChanges(existing,incoming,"DELTA",100).update.length,0);
});
test("same name + changed WMS area is a sparse update",()=>{
  const incoming=[{sku:"1",product_name:"one",area:"SHELVING",area_verified:true,area_reason:"VERIFIED"}];
  const plan=planSkuChanges([old("1","one")],incoming,"DELTA",100);
  assert.equal(plan.update.length,1);
  assert.equal(plan.update[0].name,undefined);
  assert.equal(plan.update[0].area,"SHELVING");
});
test("unchanged WMS does not overwrite Web manual name",()=>{
  const manual={...old("1","manual"),last_wms_name:"old",product_name:"manual",
    last_wms_observed_ms:100,manual_name_revision:200};
  const oldWms=[{sku:"1",product_name:"old",area:"LTA",area_verified:true,area_reason:"VERIFIED"}];
  const plan=planSkuChanges([manual],oldWms,"DELTA",100);
  assert.equal(plan.update.length,0);assert.equal(plan.conflicts.length,0);
});
test("new WMS name conflicting same field manual revision requires explicit approval",()=>{
  const manual={...old("1","manual"),last_wms_name:"old",product_name:"manual",
    last_wms_observed_ms:100,manual_name_revision:200};
  const update=[{sku:"1",product_name:"changed",area:"LTA",area_verified:true,area_reason:"VERIFIED"}];
  const plan=planSkuChanges([manual],update,"DELTA",100);
  assert.equal(plan.update.length,0);assert.equal(plan.conflicts[0].field,"product_name");
});

test("ambiguous source supersedes an old known area with UNKNOWN", () => {
  const previous=old("4712","Product","LTA");
  const ambiguous={sku:"4712",product_name:"Product",area:"UNKNOWN",
    area_verified:false,area_reason:"MULTIPLE_AREA"};
  const plan=planSkuChanges([previous],[ambiguous],"DELTA",100);
  assert.equal(plan.update.length,1);
  assert.equal(plan.update[0].area,"UNKNOWN");
  assert.equal(plan.update[0].area_verified,false);
});
test("missing area column must preserve old LTA/Shelving evidence", () => {
  const previous=old("4712","Product","LTA");
  const missing={sku:"4712",product_name:"Product",area:"UNKNOWN",
    area_verified:false,area_reason:"MISSING_AREA_COLUMN"};
  const plan=planSkuChanges([previous],[missing],"DELTA",100);
  assert.equal(plan.update.length,0);
});
test("previously hidden SKU is reactivated when source returns it", () => {
  const previous={...old("001","Item"),active:false};
  const incoming={sku:"001",product_name:"Item",area:"LTA",
    area_verified:true,area_reason:"VERIFIED"};
  const plan=planSkuChanges([previous],[incoming],"DELTA",100);
  assert.deepEqual(plan.activate,["001"]);
  assert.deepEqual(plan.hide,[]);
});


test("Owner WMS export 2026-10-10 aggregate-shape regression without private source rows",()=>{
  // Source evidence: 8848 data rows, 2493 unique SKU, 4904 pickable lines,
  // 1017 LTA SKU, 1190 Shelving SKU, 286 SKU with no pickable location.
  // All row identifiers and names here are synthetic, not the original export.
  const rows=[];
  for(let i=0;i<2493;i++){
    const sku=String(10000000+i);
    const location=i<1017 ? "LTA.16.14" : i<2207 ? "42.03.02" : "TL.1.1";
    rows.push({sku,product_name:"Synthetic SKU "+i,storage_location:location,pickable:i<2207});
  }
  for(let i=0;i<2697;i++){
    const j=i%2207;
    rows.push({sku:String(10000000+j),product_name:"Synthetic SKU "+j,
      storage_location:j<1017?"LTA.16.15":"42.03.03",pickable:true});
  }
  for(let i=0;i<3658;i++){
    const j=i%2493;
    rows.push({sku:String(10000000+j),product_name:"Synthetic SKU "+j,
      storage_location:"TL.1.1",pickable:false});
  }
  assert.equal(rows.length,8848);
  const list=normalizeSourceRows(rows,{site_verified:true,location_header_present:true});
  assert.equal(list.length,2493);
  assert.equal(list.filter(x=>x.area==="LTA").length,1017);
  assert.equal(list.filter(x=>x.area==="SHELVING").length,1190);
  assert.equal(list.filter(x=>x.area==="UNKNOWN"&&x.area_reason==="NO_PICKABLE_LOCATION").length,286);
});

test("D167 source guard preserves active SKU on unusually small FULL unless approved", async () => {
  const { readFileSync } = await import("node:fs");
  const service = readFileSync(new URL("../service/src/d167-sku-sync-core.ts", import.meta.url), "utf8");
  assert.match(service, /requiresLargeHideApproval/);
  assert.match(service, /FULL_ACTIVE_SET_DROP_REQUIRES_APPROVAL/);
  assert.match(service, /approve_large_hide/);
  assert.match(service, /plan\.hide\.length > largeHideThreshold/);
});

test("D167 Agent automatic PDA Confirm stays independent of SKU export and approval UI", async () => {
  const { readFileSync } = await import("node:fs");
  const agent = readFileSync(new URL("../relay-agent/Program.cs", import.meta.url), "utf8");
  const client = readFileSync(new URL("../relay-agent/D167SkuServiceClient.cs", import.meta.url), "utf8");
  assert.match(agent, /Interlocked\.Increment\(ref _d167AutomaticConfirmRunning\)/);
  assert.match(agent, /Interlocked\.Decrement\(ref _d167AutomaticConfirmRunning\)/);
  assert.match(agent, /Interlocked\.CompareExchange\(ref _d167AutomaticConfirmRunning/);
  assert.doesNotMatch(agent, /MessageBox\.Show\(this,\s*previewText/);
  assert.match(client, /approve_large_hide/);
  assert.match(client, /Func<string,bool> confirmConflicts/);
});

test("D167 noon slot is durably coalesced into evening", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../service/src/d167-sku-sync-core.ts", import.meta.url), "utf8");
  const agent = readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs", import.meta.url), "utf8");
  assert.match(source, /COALESCED_INTO_DELTA_19/);
  assert.match(source, /state='SKIPPED'/);
  assert.match(source, /SLOT_COALESCED_INTO_EVENING/);
  assert.match(agent, /s\.State!="SKIPPED"/);
  assert.match(agent, /s\.Slot!="DELTA_12" \|\| !eveningDue/);
});

test("D167 Web report and Excel preserve identical as-of area filters", async () => {
  const { readFileSync } = await import("node:fs");
  const service = readFileSync(new URL("../service/src/business-core.ts", import.meta.url), "utf8");
  const api = readFileSync(new URL("../web/src/api.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
  const excel = readFileSync(new URL("../web/src/report-excel.ts", import.meta.url), "utf8");
  assert.ok(service.split('error: "INVALID_D167_REPORT_AREA"').length >= 3,
    "both batch and Picker detail reject invalid area");
  assert.ok(service.split("args.push(selectedArea);").length >= 3,
    "same as-of batch area filter reaches both report SQL paths");
  assert.ok(api.split('params.set("area", options.area)').length >= 3,
    "API forwards report area for detail and Picker rows");
  assert.match(ui, /area: reportArea \|\| undefined/);
  assert.match(excel, /Bộ lọc khu vực của đợt và chi tiết Picker/);
});

test("D167 Web FULL REPLACE is guarded separately from PATCH", async () => {
  const { readFileSync } = await import("node:fs");
  const core = readFileSync(new URL("../service/src/d167-web-full-replace.ts", import.meta.url), "utf8");
  const business = readFileSync(new URL("../service/src/business-api.ts", import.meta.url), "utf8");
  const web = readFileSync(new URL("../web/src/operational-app.ts", import.meta.url), "utf8");
  assert.match(core, /FULL_REPLACE_REQUIRES_CONFIRMATION/);
  assert.match(core, /FULL_REPLACE_STALE_PREVIEW/);
  assert.match(core, /FULL_REPLACE_READBACK_MISMATCH/);
  assert.match(core, /INSERT OR IGNORE INTO d167_sku_active/);
  assert.match(business, /POST \/api\/admin\/skus\/full-replace/);
  assert.match(web, /confirmFullReplace: true/);
  assert.match(web, /preview\.hidden/);
  assert.match(web, /if \(skuImportFullReplace\)/);
  assert.match(web, /importSkuChunk\(chunk,/);
});

test("D167 Web optional LTA/Shelving column preserves history and unknown fields", async () => {
  const { readFileSync } = await import("node:fs");
  const parser = readFileSync(new URL("../web/src/sku-excel.ts", import.meta.url), "utf8");
  const patch = readFileSync(new URL("../service/src/sku-import-core.ts", import.meta.url), "utf8");
  const full = readFileSync(new URL("../service/src/d167-web-full-replace.ts", import.meta.url), "utf8");
  assert.match(parser, /AREA_HEADERS/);
  assert.match(parser, /sameSkuAreaImpossible|cùng SKU có khu vực LTA\/Shelving mâu thuẫn/);
  assert.match(patch, /if \(!item.area\) continue/);
  assert.match(patch, /last_web_area_at/);
  assert.match(patch, /WEB_APPROVED_PATCH/);
  assert.match(full, /WEB_APPROVED_FULL/);
  assert.match(full, /area_updated:toAreaChanged.length/);
  assert.match(full, /last_web_area_at/);
});

test("D167 persisted WMS timestamp drives true same-day Web conflict CAS", async () => {
  const { readFileSync } = await import("node:fs");
  const core = readFileSync(new URL("../service/src/d167-sku-sync-core.ts", import.meta.url), "utf8");
  const agent = readFileSync(new URL("../relay-agent/D167SkuBrowserExport.cs", import.meta.url), "utf8");
  const rosterSelect = core.match(/function rosterRows\([\s\S]*?\}\nfunction auditArea/);
  assert.ok(rosterSelect, "roster query is present");
  assert.match(rosterSelect[0], /SELECT[\s\S]*a\.last_wms_observed_at[\s\S]*FROM sku_master/);
  assert.match(rosterSelect[0], /last_wms_observed_ms: x\.last_wms_observed_at/);
  // The side page must close on all timeout/error routes, not only a parsed XLSX.
  assert.match(agent, /finally\s*\{[\s\S]*File\.Delete\(downloadedFile\)[\s\S]*Page\.close/);
  assert.match(agent, /downloadedFile = WaitCompleteXlsx/);
});
