import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const core=read("service/src/obpp1291-core.ts");
const app=read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const workflow=read(".github/workflows/release-obpp1291.yml");

test("E043 DO-only Core comparison never depends on store/QR/parcels/notes",()=>{
  const f=core.slice(core.indexOf("function duplicateDo("),core.indexOf("function parcel("));
  assert.match(f,/deleted=0 AND do_code=\? AND id<>\? LIMIT 1/);
  for(const field of ["store_code=?","raw_scan=?","parcel_index","total_parcels","location=?","note=?"])
    assert.ok(!f.includes(field),field);
  assert.match(core,/CREATE INDEX IF NOT EXISTS obpp_do_lookup_idx ON obpp_records\(do_code,deleted\)/);
});
test("E043 Core preflight is read-only and final POST is transaction-atomic",()=>{
  const pre=core.slice(core.indexOf('if(path==="/obpp1291/records/do-check"'),core.indexOf('if(path==="/obpp1291/records" && method==="GET")'));
  assert.match(pre,/method==="GET"/);
  assert.match(pre,/doRx\.test\(doCode\)/);
  assert.match(pre,/duplicate:duplicateDo\(state,doCode,excluded\)/);
  assert.doesNotMatch(pre,/INSERT INTO|UPDATE obpp_|outbox|audit\(/);
  assert.match(core,/state\.storage\.transactionSync\(\(\)=>\{/);
  assert.match(core,/if\(duplicateDo\(state,p\.do_code\)\)\{duplicate=true;return;\}/);
  assert.match(core,/p\.do_code!==String\(before\.do_code\) && duplicateDo\(state,p\.do_code,id\)/);
  assert.match(core,/duplicate\?reply\(\{error:"DUPLICATE_DO"\},409\)/);
  assert.match(core,/if\(!conflict && !duplicate\)writeResult/);
});
test("E043 APK refuses scan before populating form, rejects manual DO, preserves Save guard",()=>{
  assert.match(app,/private fun checkScannedDo\(raw: String, info: ParcelInfo\)/);
  assert.match(app,/records\/do-check\?do_code=/);
  assert.match(app,/if\(res\.optBoolean\("duplicate"\)\)/);
  assert.match(app,/qr\.setText\(""\)/);
  assert.match(app,/private fun checkTypedDo\(\)/);
  assert.match(app,/doCode\.setOnFocusChangeListener/);
  assert.match(app,/if\(duplicateDoBlocked==d\)/);
  assert.match(app,/safeError=="DUPLICATE_DO"/);
  assert.match(app,/ObQrParser\.parse\(scan\)\.doCode!=d/);
  assert.match(app,/ObppDraftStore\.clear\(this\)/);
});
test("E043 secure release requires newly deployed Worker SHA before separately signed APK",()=>{
  assert.match(workflow,/expected_worker_sha="\$GITHUB_SHA"/);
  assert.match(workflow,/D172 OBPP1291 signed GitHub APK release/);
});
