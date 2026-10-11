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
