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


test("D167 Agent SKU tab follows Cài đặt; STANDBY remains read-only", async () => {
  const {readFileSync}=await import("node:fs");
  const program=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const skuUi=readFileSync(new URL("../relay-agent/D167SkuUi.cs",import.meta.url),"utf8");
  assert.match(program, /_mainTabs\.TabPages\.Add\(_overviewPage\);\s*_mainTabs\.TabPages\.Add\(_connectionPage\);\s*_mainTabs\.TabPages\.Add\(_d167SkuPage\);/);
  assert.match(program, /_mainTabs\.SelectedTab == _d167SkuPage && _d167SkuCoordinator != null/);
  assert.match(skuUi, /_d167SkuRun\.Enabled=!_d167SkuManualActive && primary && _supraBrowserReady && HasAgentSession\(\)/);
  assert.match(skuUi, /!_leaderCoordinator\.IsLeader \|\| !_supraBrowserReady/);
});


test("D167 v128 diagnoses existing direct API export safely without changing WMS Confirm", async () => {
  const {readFileSync}=await import("node:fs");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const exporter=readFileSync(new URL("../relay-agent/D167SkuBrowserExport.cs",import.meta.url),"utf8");
  const direct=readFileSync(new URL("../relay-agent/D167SkuDirectExport.cs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../relay-agent/D167SkuUi.cs",import.meta.url),"utf8");
  const program=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const version=readFileSync(new URL("../relay-agent/VERSION",import.meta.url),"utf8").trim();
  const config=readFileSync(new URL("../relay-agent/AgentConfig.cs",import.meta.url),"utf8");
  // Verify the version/build agreement without pinning a retired v129 Agent.
  // This read-only Web fix must not roll back an already released v130 binary.
  assert.ok(/^[0-9]+$/.test(version) && Number(version) >= 129);
  assert.match(config, new RegExp("AgentBuild = " + version + ";"));
  assert.match(program,/_mainTabs\.TabPages\.Add\(_overviewPage\);\s*_mainTabs\.TabPages\.Add\(_connectionPage\);\s*_mainTabs\.TabPages\.Add\(_d167SkuPage\);/);
  for(const step of ["SIDE_OPEN","SIDE_TARGET_DISCOVERY","SIDE_CDP_CONNECT","SIDE_NETWORK_ENABLE","SIDE_RELOAD","SIDE_AUTH_OBSERVE","DIRECT_GET","XLSX_PARSE"]) {
    assert.ok(exporter.includes('onStage("'+step+'")'),"missing safe phase "+step);
  }
  for(const step of ["AUTHORIZE_BEGIN","AUTHORIZE_DONE","WMS_EXPORT_BEGIN","WMS_EXPORT_DONE","SERVICE_UPLOAD_BEGIN"]) {
    assert.ok(coordinator.includes("step="+step),"missing support stage "+step);
  }
  assert.match(coordinator,/manualTrace=System\.Diagnostics\.Stopwatch\.StartNew\(\)/);
  assert.match(coordinator,/manual=FAILED error_type/);
  assert.match(coordinator,/phase="\+manualPhase/);
  assert.match(coordinator,/manual=TRACE export_stage/);
  assert.match(coordinator,/slotTrace=System\.Diagnostics\.Stopwatch\.StartNew\(\)/);
  assert.match(coordinator,/elapsed_ms=/);
  assert.match(coordinator,/SafeErrorCode\(Exception error\)/);
  assert.match(coordinator,/error_code="\+SafeErrorCode\(e\)/);
  assert.match(ui,/D167SkuCoordinator\.SafeErrorCode\(e\)/);
  assert.match(direct,/HTTP_"\+\(\(int\)http\.StatusCode\)/);
  // SafeErrorCode accepts uppercase only; WebExceptionStatus enum names are mixed-case.
  assert.match(direct,/NETWORK_"\+e\.Status\.ToString\(\)\.ToUpperInvariant\(\)/);
  assert.doesNotMatch(coordinator, /log\([^;]*e\.Message/);
  assert.doesNotMatch(exporter,/Network\.setExtraHTTPHeaders|Page\.navigate|ClickOneExact/);
  assert.match(direct,/req\.Method="GET"/);
});


test("D168 SKU reserve attests PRIMARY once; Worker uses durable job grant after handoff", async () => {
  const {readFileSync}=await import("node:fs");
  const leader=readFileSync(new URL("../relay-agent/FirestoreAgentLeaderCoordinator.cs",import.meta.url),"utf8");
  const client=readFileSync(new URL("../relay-agent/D167SkuServiceClient.cs",import.meta.url),"utf8");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const agent=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const ha=readFileSync(new URL("../service/src/d167-sku-ha.ts",import.meta.url),"utf8");
  const route=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
  assert.match(leader,/internal void EnsureD167SkuPrimaryLease\(string expectedGeneration\)/);
  assert.match(leader,/now - _d167SkuLeaseProofAtMs < 20000/);
  assert.match(leader,/WritePrimaryLease\(session\)/);
  assert.match(leader,/_role != FirestoreAgentRole\.PRIMARY/);
  assert.match(leader,/!string\.Equals\(_generation, expectedGeneration/);
  // D168: the PRIMARY proof is limited to reserving a new job or starting a privileged manual job.
  assert.match(client,/var primaryGate=operation=="reserve" \|\| operation=="manual-start"/);
  assert.match(client,/request.Headers\[HttpRequestHeader.Authorization\]/);
  assert.match(client,/job_grant/);
  assert.doesNotMatch(client,/script\.google\.com/);
  assert.match(route,/if \(action === "reserve"\)/);
  assert.match(route,/SKU_JOB_GRANT_REQUIRED/);
  const core=readFileSync(new URL("../service/src/d167-sku-sync-core.ts",import.meta.url),"utf8");
  assert.match(core,/async function guard\(/);
  assert.match(core,/job\.grant_hash/);
  assert.match(core,/JOB_NOT_RESERVED/);
  assert.match(core,/primary_verified !== true/);
  assert.match(client,/refreshSkuPrimaryLease\(Convert\.ToString\(proofGeneration\)\)/);
  assert.match(coordinator,/new D167SkuServiceClient\(currentSession,ensureFreshToken,primaryReady,ensureSkuLease\)/);
  assert.match(agent,/_leaderCoordinator\.EnsureD167SkuPrimaryLease\(expected\)/);
  assert.match(ha,/rolesResponse, leaseResponse/);
  assert.match(ha,/FIRESTORE_LEASE_STALE/);
  assert.match(ha,/FIRESTORE_ROLES_MISMATCH/);
  assert.match(ha,/Math\.abs\(Date\.now\(\) - heartbeat\) <= 45_000/);
  assert.doesNotMatch(ha,/return \{valid:true[^}]*\}\s*catch/);
  assert.match(route,/if \(!leader\.valid\) return json\(\{ ?error: ?"NOT_CURRENT_FIREBASE_PRIMARY_"\+leader\.reason/);
});

test("D167 P0 Vietnamese updater provenance uses existing Worker->Core receipt, no new UI polling", async () => {
  const {readFileSync}=await import("node:fs");
  const ui=readFileSync(new URL("../relay-agent/D167SkuUi.cs",import.meta.url),"utf8");
  const core=readFileSync(new URL("../service/src/d167-sku-sync-core.ts",import.meta.url),"utf8");
  const router=readFileSync(new URL("../service/src/index.ts",import.meta.url),"utf8");
  assert.match(router,/actor_display: \[String\(operator\.display_name/);
  assert.match(core,/manual \&\& \(manualAuthorized \|\| isManualDelta\(slot\)\)/);
  assert.match(core,/MANUAL_OPERATOR_CHANGED/);
  assert.equal(core.split("actor_id:actorId,actor_display:actorDisplay").length-1,2);
  assert.match(ui,/Người cập nhật/);
  assert.match(ui,/D167ReceiptNumber\(state\.ReceiptJson,"actor_display"\)/);
  assert.match(ui,/D167ReceiptNumber\(item\.ReceiptJson,"actor_display"\)/);
  assert.match(ui,/Đã cập nhật/);
  assert.match(ui,/Cập nhật chưa thành công/);
  assert.doesNotMatch(ui,/setInterval|System\.Threading\.Timer|FirestoreClient/);
});

test("D168 group contact preserves multiple selected Picker IDs after online snapshot refresh", async () => {
  const {readFileSync}=await import("node:fs");
  const agent=readFileSync(new URL("../relay-agent/D119AgentFeatures.cs",import.meta.url),"utf8");
  assert.match(agent,/var selectedSessions = new HashSet<Tuple<string,long,string>>\(\)/);
  assert.match(agent,/foreach \(DataGridViewRow selected in _pickerOnlineGrid\.SelectedRows\)/);
  assert.match(agent,/_pickerOnlineGrid\.ClearSelection\(\)/);
  assert.match(agent,/selectedSessions\.Contains\(Tuple\.Create\(picker\.UserId,picker\.SessionGeneration,picker\.FirebaseUid \?\? ""\)\)/);
  assert.match(agent,/InitializeD168GroupPickerContact\(pickerCard\)/);
});

test("D168 release guard: Office-blocked direct Worker must have a wired, approved WLAN route", async () => {
  const {readFileSync,readdirSync}=await import("node:fs");
  const agentDir=new URL("../relay-agent/",import.meta.url);
  const code=readdirSync(agentDir).filter(name=>name.endsWith(".cs") && name!=="D168NetworkRoute.cs")
    .map(name=>readFileSync(new URL(name,agentDir),"utf8")).join("\n");
  const network=readFileSync(new URL("D168NetworkRoute.cs",agentDir),"utf8");
  const sku=readFileSync(new URL("D167SkuServiceClient.cs",agentDir),"utf8");
  assert.match(network,/ApprovedProfile\(/);
  assert.match(network,/ConnectSavedProfile\(/);
  assert.match(network,/ProbeWorker\(/);
  assert.doesNotMatch(sku,/script\.google\.com|d167_sku_sync/);
  // A standalone helper is NOT a functional route. The Agent must call it from
  // a real SKU/optional-Worker user operation and verify reachability after switch.
  assert.match(code,/D168NetworkRoute\.OpenWorkerSession\(/,
    "D168 cannot be released: no SKU operation owns a safe Worker WLAN session");
  assert.match(network,/ConnectSavedProfile\(target\)/,
    "D168 must actually connect the approved saved profile");
  assert.match(network,/var result=ProbeWorker\(idToken\)/,
    "D168 must confirm real authenticated Worker reachability after switching");
  assert.match(network,/if\(result=="READY"\)/);
  assert.match(network,/RestoreOriginalProfile\(restoreProfile\)/,
    "D168 must restore and verify the original WLAN after each completed job");
  assert.match(code,/RequestD168NetworkSwitchPermission/,
    "D168 cannot silently switch networks without an operator-facing decision");
});

test("D168 Windows auto-start setting verifies the HKCU Run registration before reporting success", async () => {
  const {readFileSync}=await import("node:fs");
  const code=readFileSync(new URL("../relay-agent/UserStartupRegistration.cs",import.meta.url),"utf8");
  assert.match(code,/Registry\.CurrentUser\.OpenSubKey\(RunKey,false\)/);
  assert.match(code,/string\.Equals\(actual,expected,StringComparison\.Ordinal\)/);
  assert.match(code,/AUTOSTART_RUN_REGISTRATION_MISMATCH/);
  assert.match(code,/SetValue\(EnabledValue,previous\?1:0/);
  assert.match(code,/return false;/);
});

test("D168 manual SKU abort retains original VN-day lease if operation crosses midnight", async () => {
  const {readFileSync}=await import("node:fs");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  assert.match(coordinator,/activeGeneration=null,activeDay=null/);
  assert.match(coordinator,/activeDay=day;/);
  assert.match(coordinator,/service\.Abort\(activeDay,activeSlot,/);
  assert.doesNotMatch(coordinator,/service\.Abort\(D167SkuSchedule\.VNNow\(/);
});

test("D168 Office SKU network scope is bound to both manual and automatic jobs", async () => {
  const {readFileSync}=await import("node:fs");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const agent=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../relay-agent/D168SkuNetworkUi.cs",import.meta.url),"utf8");
  assert.match(coordinator,/workerNetworkScope=openWorkerNetwork\(\)/);
  assert.match(coordinator,/using\(var workerNetworkScope=openWorkerNetwork\(\)\)/);
  assert.match(coordinator,/workerNetworkScope\.Dispose\(\)/);
  assert.match(agent,/RequestD168NetworkSwitchPermission/);
  assert.match(agent,/InitializeD168WorkerWifiControls\(networkCard\)/);
  assert.match(ui,/TopMost=true/);
  assert.match(ui,/Interval=60000/);
  assert.match(ui,/ManualResetEventSlim/);
});

test("D168 Office network automatic SKU export precedes any WLAN transition", async () => {
  const {readFileSync}=await import("node:fs");
  const client=readFileSync(new URL("../relay-agent/D167SkuServiceClient.cs",import.meta.url),"utf8");
  const scheduler=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const workerRoute=scheduler.slice(scheduler.indexOf("private void EvaluateOnce()"));
  const preflight=workerRoute.indexOf('service.WorkerRouteStatus()=="NETWORK_UNREACHABLE"');
  const exportFirst=workerRoute.indexOf("officeWorkbook=D167SkuBrowserExport.Export");
  const switchAfter=workerRoute.indexOf("using(var workerNetworkScope=openWorkerNetwork())");
  const reserveAfter=workerRoute.indexOf("var grant=service.Reserve(");
  assert.ok(preflight>=0 && exportFirst>preflight && switchAfter>exportFirst && reserveAfter>switchAfter);
  assert.match(workerRoute,/var workbook=officeWorkbook \?\? D167SkuBrowserExport\.Export/);
  assert.match(client,/D168NetworkRoute\.ProbeWorker\(actor\.IdToken\)/);
});

test("D168 manual SKU on Office exports before WLAN change; Worker validates proof before publish", async () => {
  const {readFileSync}=await import("node:fs");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const manual=coordinator.slice(coordinator.indexOf("internal void RunManual("),
    coordinator.indexOf("internal void OnPrimaryOrWmsReady("));
  const wms=manual.indexOf("officeWorkbook=D167SkuBrowserExport.Export");
  const network=manual.indexOf("workerNetworkScope=openWorkerNetwork()");
  const proof=manual.indexOf("service.ManualStart(");
  const reserve=manual.indexOf("service.Reserve(");
  const publish=manual.indexOf("service.UploadAndPublish(");
  assert.ok(wms>=0 && network>wms && proof>network && reserve>proof && publish>reserve);
  assert.match(manual,/if\(service\.WorkerRouteStatus\(\)=="NETWORK_UNREACHABLE"\)/);
  assert.match(manual,/var workbook=officeWorkbook \?\? D167SkuBrowserExport\.Export/);
});

test("D168 shared SKU terminal status piggybacks existing exact Agent Firestore listener", async () => {
  const {readFileSync}=await import("node:fs");
  const sync=readFileSync(new URL("../relay-agent/FirestoreAgentSync.cs",import.meta.url),"utf8");
  const relay=readFileSync(new URL("../relay-agent/D168SkuSharedState.cs",import.meta.url),"utf8");
  const host=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const view=readFileSync(new URL("../relay-agent/D119AgentFeatures.cs",import.meta.url),"utf8");
  assert.match(sync,/internal string SkuStatusJson = ""/);
  assert.match(sync,/internal AgentSyncSnapshot SetSkuStatus\(AgentSession session,string json\)/);
  assert.match(sync,/AGENT_SYNC_SKU_TERMINAL/);
  assert.match(sync,/\{ "sku_status_json", StringField\(snapshot.SkuStatusJson \?\? ""\) \}/);
  assert.match(view,/ApplyD168SharedSkuStatus\(snapshot.SkuStatusJson\)/);
  assert.match(host,/PublishD168TerminalSkuStatus\(slots\)/);
  assert.match(relay,/x.State=="DONE"/);
  assert.match(relay,/if\(complete.Count==0\)return/);
  assert.doesNotMatch(relay,/FirestoreAgentSyncListener|new (?:Timer|System.Windows.Forms.Timer)/);
});

test("D168 never exports Office XLSX on unreachable Worker without preapproved fallback", async () => {
  const {readFileSync}=await import("node:fs");
  const coordinator=readFileSync(new URL("../relay-agent/D167SkuCoordinator.cs",import.meta.url),"utf8");
  const network=readFileSync(new URL("../relay-agent/D168NetworkRoute.cs",import.meta.url),"utf8");
  const instances=[coordinator.slice(coordinator.indexOf("internal void RunManual("),coordinator.indexOf("internal void OnPrimaryOrWmsReady(")),
    coordinator.slice(coordinator.indexOf("private void EvaluateOnce()"))];
  for (const fragment of instances) {
    const guard=fragment.indexOf("D168NetworkRoute.HasApprovedFallback()");
    const exportAt=fragment.indexOf("officeWorkbook=D167SkuBrowserExport.Export");
    assert.ok(guard>=0 && exportAt>guard);
  }
  assert.match(network,/internal static bool HasApprovedFallback\(\)/);
  assert.match(network,/ValidProfile\(original\) && HasSavedProfile\(original\)/);
  assert.match(network,/ApprovedProfiles\(\)\.Any\(target=>/);
});

test("D168 concurrent Agent receipt projection merges immutable completed SKU slots", async () => {
  const {readFileSync}=await import("node:fs");
  const sync=readFileSync(new URL("../relay-agent/FirestoreAgentSync.cs",import.meta.url),"utf8");
  assert.match(sync,/snapshot.SkuStatusJson=MergeTerminalSkuStatus\(snapshot.SkuStatusJson,json\)/);
  assert.match(sync,/bySlot\.OrderBy\(x=>x.Key,StringComparer\.Ordinal\)/);
  assert.match(sync,/!bySlot\.ContainsKey\(slot\)/, "Duplicate DONE cannot overwrite the first verified receipt");
  assert.match(sync,/combined\.Length>3500 \? previous : combined/,
    "Oversize concurrent merge cannot erase existing DONE slots");
  assert.match(sync,/return string\.CompareOrdinal\(oldDay,newDay\)>0 \? previous : incoming/);
  assert.match(sync,/AGENT_SYNC_SKU_TERMINAL/);
});

test("D168 one-click Agent field probe is read-only and distinguishes direct from switched", async () => {
  const {readFileSync}=await import("node:fs");
  const ui=readFileSync(new URL("../relay-agent/D168SkuNetworkUi.cs",import.meta.url),"utf8");
  const route=readFileSync(new URL("../relay-agent/D168NetworkRoute.cs",import.meta.url),"utf8");
  assert.match(ui,/Thử kết nối Worker/);
  assert.match(ui,/D168NetworkRoute\.OpenWorkerSession\(actor\.IdToken/);
  assert.match(ui,/switched=networkSession\.DidSwitch/);
  assert.match(ui,/SWITCHED_AND_RESTORED/);
  assert.match(ui,/SWITCHED_AND_RESTORED":"DIRECT"/);
  assert.match(route,/internal bool DidSwitch/);
  assert.doesNotMatch(ui,/WmsSkuBrowserExport|ManualStart\(|UploadAndPublish\(/);
});



test("D168 approved WLAN priority is local, saved-only, bounded and safely restored", async () => {
  const {readFileSync}=await import("node:fs");
  const network=readFileSync(new URL("../relay-agent/D168NetworkRoute.cs",import.meta.url),"utf8");
  const ui=readFileSync(new URL("../relay-agent/D168SkuNetworkUi.cs",import.meta.url),"utf8");
  assert.match(network,/internal static string\[\] SavedProfiles\(\)/);
  assert.match(network,/Arguments="wlan show profiles"/);
  assert.match(network,/internal static bool SaveApprovedProfiles\(/);
  assert.match(network,/WorkerProfilesValue="ApprovedWorkerWifiProfiles"/);
  assert.match(network,/RegistryValueKind.MultiString/);
  assert.match(network,/values.Length>6/);
  assert.match(network,/values.Any\(x=>!HasSavedProfile\(x\)\)/);
  assert.match(network,/foreach\(var target in targets\)/);
  assert.match(network,/if\(!RestoreOriginalProfile\(original\)\)/);
  assert.match(network,/result=="AUTH_REJECTED"/);
  assert.match(network,/result=="QUOTA"/);
  assert.match(ui,/ConfigureD168WorkerWifiProfiles\(\)/);
  assert.match(ui,/D168NetworkRoute.SavedProfiles\(\)/);
  assert.match(ui,/D168NetworkRoute.SaveApprovedProfiles\(ordered\)/);
  assert.match(ui,/Thêm →/);
  assert.match(ui,/Ưu tiên/);
  assert.doesNotMatch(ui,/new TextBox \{\s*Left=244,Top=257/);
});


test("D168 Reporter long-press copies SKU in Pending, Overdue, Has Stock and Skip", async () => {
  const {readFileSync}=await import("node:fs");
  const reporter=readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/ReporterController.kt",import.meta.url),"utf8");
  const picker=readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt",import.meta.url),"utf8");
  const layout=readFileSync(new URL("../android/app/src/main/res/layout/row_reporter_issue.xml",import.meta.url),"utf8");
  assert.match(reporter,/target\.setOnItemLongClickListener\s*\{/);
  assert.match(reporter,/Filter\.PENDING -> queue\.getOrNull\(position\)\?\.sku/);
  assert.match(reporter,/Filter\.OVERDUE -> overdueRows\.getOrNull\(position\)\?\.sku/);
  assert.match(reporter,/Filter\.HAS_STOCK, Filter\.SKIP_ALLOWED -> recentRows\(\)\.getOrNull\(position\)\?\.sku/);
  assert.match(reporter,/copySkuToClipboard\(sku\)/);
  assert.match(reporter,/ClipData\.newPlainText\("SKU", value\)/);
  assert.match(reporter,/findViewById<LinearLayout>\(R\.id\.reporterRowRoot\)\.apply\s*\{/);
  assert.match(reporter,/findViewById<TextView>\(R\.id\.tvReporterSku\)\.apply\s*\{/);
  assert.match(reporter,/setOnLongClickListener \{ copy\(it\) \}/);
  assert.match(reporter,/setOnItemClickListener\s*\{[\s\S]*?showTickets/);
  assert.match(reporter,/setOnClickListener \{ confirmResolution\(/);
  assert.match(reporter,/setOnClickListener \{ confirmResolvedCorrection\(/);
  assert.match(layout,/android:id="@\+id\/tvReporterSku"/);
  assert.match(picker,/attachSkuCopy\(this, row\.sku\)/);
  assert.match(picker,/attachSkuCopy\(this, result\.sku\)/);
  assert.doesNotMatch(reporter,/api\.copySku|networkCopySku|postCopySku/);
});

test("D168 local-first log delivery honors Owner daily and logout boundaries", async () => {
  const {readFileSync}=await import("node:fs");
  const bridge=readFileSync(new URL("../relay-agent/AgentLogUploadBridge.cs",import.meta.url),"utf8");
  const program=readFileSync(new URL("../relay-agent/Program.cs",import.meta.url),"utf8");
  const web=readFileSync(new URL("../web/src/runtime-logger.ts",import.meta.url),"utf8");
  const android=readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt",import.meta.url),"utf8");
  const global=readFileSync(new URL("../android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt",import.meta.url),"utf8");
  const scheduled=bridge.split("internal void TryQueueScheduledSnapshot()")[1].split("internal void TryQueueManualSnapshot()")[0];
  const error=bridge.split("internal void TryQueueErrorSnapshot(")[1].split("// Kept under the existing method name")[0];
  const crash=bridge.split("internal void TryQueueCrashSnapshot(")[1].split("internal void TryQueueErrorSnapshot(")[0];
  assert.match(scheduled,/SCHEDULE_BOUNDARY=/);
  assert.match(bridge,/new TimeSpan\(13, 15, 0\)/);
  assert.match(bridge,/new TimeSpan\(21, 15, 0\)/);
  assert.doesNotMatch(scheduled,/dueByTime|dueBySize|DirtyCheckpointMs/);
  assert.doesNotMatch(error,/TryFlushPending\(/);
  assert.doesNotMatch(crash,/TryFlushPending\(/);
  assert.match(program,/AgentDiagnostics\.ErrorUploadCallback = null/);
  // D171 E039 moved the VN slot clock into the durable Agent log bridge.
  assert.match(bridge,/DueSlot\(D167SkuSchedule\.VNNow\(\)\)/);
  assert.match(program,/ShouldRunScheduledOrRetry\(\)/);
  assert.match(web,/SLOT_RETRY_MS/);
  assert.doesNotMatch(web,/immediateError\(/);
  assert.match(web,/result\.archive_status === "DRIVE_SYNCED"/);
  assert.match(android,/pending_logout_queue_v3/);
  assert.doesNotMatch(android,/lastImmediateRuntimeLogAt/);
  assert.match(global,/180_001L/);
  assert.doesNotMatch(global,/retryDelayMs/);
});

test("D168 Picker presence convergence coalesces on existing event without polling", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(new URL("../relay-agent/D119AgentFeatures.cs", import.meta.url), "utf8");
  const handler = text.split("private void QueueD168PresencePublish(")[1]
    ?.split("private void ApplyD161DirectPickerPresence(")[0] || "";
  assert.match(handler, /_d168PresencePublishPending/);
  assert.match(handler, /_d168PresencePublishActive/);
  assert.match(handler, /PublishPresence\(SnapshotSession\(\), pending\)/);
  assert.match(handler, /retry=NEXT_PRESENCE_EVENT/);
  assert.doesNotMatch(handler, /Thread\.Sleep|Task\.Delay|Timer|new HttpWebRequest/);
  assert.match(text, /QueueD168PresencePublish\(merged, false\)/);
  assert.match(text, /QueueD168PresencePublish\(merged, true\)/);
});
