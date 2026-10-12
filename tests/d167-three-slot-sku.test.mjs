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
  // Owner 12/10: WMS auth comes from a separate managed side tab but the
  // workbook is fetched by a distinct allowlisted GET, not UI Search/Export.
  assert.match(agent, /D167SkuDirectExport\.CaptureAuthorizedHeaders/);
  assert.match(agent, /D167SkuDirectExport\.DownloadReadOnly/);
  assert.doesNotMatch(agent, /ClickOneExact|WaitCompleteXlsx|ClickOneExactNavigation/);
  assert.match(agent, /finally\s*\{[\s\S]*Page\.close/);
});

test("D167 recovered PRIMARY import never mixes two distinct staged source files", async () => {
  const { readFileSync } = await import("node:fs");
  const core = readFileSync(new URL("../service/src/d167-sku-sync-core.ts", import.meta.url), "utf8");
  const claim = core.slice(core.indexOf('if (action === "claim")'), core.indexOf('if (!guard(body, job))'));
  assert.match(claim, /reclaimDifferentSource/);
  assert.match(claim, /reclaimOtherOwner/);
  assert.match(claim, /resetStage/);
  assert.match(claim, /transactionSync\(\(\) => \{/);
  assert.match(claim, /DELETE FROM d167_sku_stage WHERE day_vn/);
  assert.match(claim, /fingerprint=CASE WHEN \? THEN NULL ELSE fingerprint END/);
  assert.match(claim, /total_rows=CASE WHEN \? THEN 0 ELSE total_rows END/);
});

test("D167 midnight boundary: yesterday Web rename does not block today FULL", () => {
  const prev = {
    ...old("482","Web yesterday","LTA"),
    product_name: "Web yesterday", last_wms_name: "Original WMS",
    last_wms_observed_ms: Date.parse("2026-10-10T23:00:00Z"),
    manual_name_revision: Date.parse("2026-10-11T13:00:00Z"),
  };
  const incoming = [{
    sku:"482",product_name:"Morning WMS",area:"LTA",
    area_verified:true,area_reason:"VERIFIED",
  }];
  const previousVn = planSkuChanges([prev],incoming,"FULL",0,"2026-10-11");
  assert.equal(previousVn.conflicts.length,1,"same-day Web edit requires approval");
  const nextVn = planSkuChanges([prev],incoming,"FULL",0,"2026-10-12");
  assert.equal(nextVn.conflicts.length,0,"past-day Web edit cannot block new morning");
  assert.equal(nextVn.update[0].name,"Morning WMS");
});


test("D167 Owner day freshness blocks all new-day reports until an authorized FULL", async () => {
  const {readFileSync}=await import("node:fs");
  const core=readFileSync(new URL("../service/src/business-core.ts",import.meta.url),"utf8");
  const info=readFileSync(new URL("../service/src/read-model-core.ts",import.meta.url),"utf8");
  const full=readFileSync(new URL("../service/src/d167-web-full-replace.ts",import.meta.url),"utf8");
  const web=readFileSync(new URL("../web/src/operational-app.ts",import.meta.url),"utf8");
  const android=readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt",import.meta.url),"utf8");
  assert.match(core,/String\(skuSync\?\.last_full_day \|\| ""\) !== dayForSku/);
  assert.doesNotMatch(core,/nowVNHour\s*>=\s*5/);
  assert.match(core,/SKU_TODAY_SYNC_PENDING/);
  assert.match(info,/sku_day_ready: skuDayReady/);
  assert.match(info,/sku_day_warning:/);
  assert.match(full,/last_full_day=\?/);
  assert.match(full,/sku_day_first_full/);
  assert.match(web,/skuDayBanner\(\)/);
  assert.match(web,/!skuDayReady\(\)/);
  assert.match(android,/private var skuDayReady = false/);
  assert.match(android,/skuDayReady && shortageReportingEnabled/);
});

test("D167 read-only signed API GET uses only short-lived managed WMS headers", async () => {
  const {readFileSync}=await import("node:fs");
  const direct=readFileSync(new URL("../relay-agent/D167SkuDirectExport.cs",import.meta.url),"utf8");
  const source=readFileSync(new URL("../relay-agent/D167SkuBrowserExport.cs",import.meta.url),"utf8");
  assert.match(direct,/Network\.requestWillBeSent/);
  assert.match(direct,/Network\.requestWillBeSentExtraInfo/);
  assert.match(direct,/https:\/\/api-supra\.winmart\.vn\/sft3-hy1\/api\/v1\/report\/stock\/exportBinStocks/);
  assert.match(direct,/req\.Method="GET"/);
  assert.match(direct,/req\.AllowAutoRedirect=false/);
  assert.match(direct,/HMACSHA256/);
  assert.doesNotMatch(direct,/File\.WriteAllBytes|Network\.setExtraHTTPHeaders|Page\.navigate/);
  assert.doesNotMatch(source,/ClickOneExact|WaitCompleteXlsx|ClickOneExactNavigation/);
});

test("D167 first FULL wakes SKU freshness clients even on a catalog no-op", async () => {
  const {readFileSync}=await import("node:fs");
  const agent=readFileSync(new URL("../service/src/d167-sku-sync-core.ts",import.meta.url),"utf8");
  const web=readFileSync(new URL("../service/src/business-api.ts",import.meta.url),"utf8");
  const router=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
  assert.match(agent,/sku_day_first_full:firstVerifiedFullToday/);
  assert.match(web,/summary\.sku_day_first_full!==true/);
  assert.match(router,/published\.sku_day_first_full !== true && published\.catalog_changed !== true/);
  assert.match(router,/event:"sku_catalog_updated",scopes:\["sku_catalog"\]/);
});


test("D167 manual Agent SKU sync requires Worker password + PRIMARY, never creates a Firebase listener", async () => {
  const {readFileSync}=await import("node:fs");
  const api=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
  const core=readFileSync(new URL("../service/src/d167-sku-sync-core.ts",import.meta.url),"utf8");
  const gateway=readFileSync(new URL("../ops/apps-script/agent-log-gateway/Code.gs",import.meta.url),"utf8");
  const agent=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../relay-agent/D167SkuUi.cs",import.meta.url),"utf8");
  assert.match(api,/action === "manual-start"/);
  assert.match(api,/verifyCurrentAuthenticationProof\(env,operator,proof\)/);
  assert.match(api,/verifyD167AgentPrimary\(env,/);
  assert.match(api,/manual_start_verified:true/);
  assert.match(core,/manual_start_verified !== true/);
  assert.match(core,/d167_sku_manual_authority/);
  assert.match(core,/MANUAL_DELTA_\[a-f0-9\]\{32\}/);
  assert.match(core,/run_id TEXT NOT NULL/);
  assert.match(core,/MANUAL_FULL_ALREADY_AUTHORIZED/);
  assert.match(core,/manualAuthorized/);
  assert.match(core,/manual:\s*Boolean\(manual\)/);
  assert.match(gateway,/manual-start/);
  assert.match(agent,/Interlocked\.CompareExchange\(ref running,1,0\)/);
  assert.match(agent,/RunManual\(string credential\)/);
  assert.match(agent,/service\.ManualStart/);
  assert.match(ui,/AgentPasswordVerificationDialog/);
  assert.match(ui,/StatusChanged|RenderD167SkuStatus/);
  assert.doesNotMatch(ui,/Firestore|setInterval|System\.Threading\.Timer/);
});

test("D167 manual DELTA and automatic three-slot schedule remain independent", async () => {
  const {readFileSync}=await import("node:fs");
  const core=readFileSync(new URL("../service/src/d167-sku-sync-core.ts",import.meta.url),"utf8");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const client=readFileSync(new URL("../relay-agent/D167SkuServiceClient.cs",import.meta.url),"utf8");
  assert.match(core,/const SLOTS: D167Slot\[\] = \["INITIAL_05", "DELTA_12", "DELTA_19"\]/);
  assert.match(core,/const chosen=full\?"MANUAL_DELTA_"\+runId:"INITIAL_05"/);
  assert.match(core,/if\(full\) state\.storage\.sql\.exec/);
  assert.match(core,/slot==="INITIAL_05"\?"INITIAL_05":"DELTA_12"/);
  assert.match(core,/source_unchanged:true,completed_at:at/);
  assert.match(core,/state='DONE' AND fingerprint IS NOT NULL/);
  assert.match(coordinator,/service\.Schedule\(day\)/);
  assert.match(client,/RecentManual/);
  assert.match(client,/SourceRows|source_rows|ReceiptJson/);
  assert.doesNotMatch(core,/DELETE FROM sku_master/);
});
