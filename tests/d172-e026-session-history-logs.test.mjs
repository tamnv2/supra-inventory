import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/MainActivity.kt");
const core=read("service/src/obpp1291-core.ts");
const worker=read("service/src/index.ts");
const mirror=read("service/src/obpp1291-sheets.ts");
const session=read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppSessionStore.kt");
const logs=read("obpp1291/android/app/src/main/java/cd/cc/supra/obpp1291/ObppDiagnostics.kt");
const manifest=read("obpp1291/android/app/src/main/AndroidManifest.xml");
test("E026 navigation renders History immediately even if record response is unchanged",()=>{
 assert.match(app,/selectedTab = tab\s*\/\/ Render immediately[\s\S]*?showWorkplace\(\)/);
 assert.match(app,/if \(tab == "Lịch sử"\) refreshRecords\(\)/);
 assert.match(app,/private fun showHistory\(/);
});
test("E026 isolated device session is opaque, hashed and replaces old logins",()=>{
 assert.match(worker,/const opaque="obpp1_"/);
 assert.match(worker,/crypto\.subtle\.digest\("SHA-256"/);
 assert.match(core,/token_hash=excluded\.token_hash/);
 assert.match(core,/session\/check-opaque/);
 assert.match(worker,/OBPP_SESSION_REPLACED/);
 assert.match(session,/AndroidKeyStore/);
 assert.match(session,/AES\/GCM\/NoPadding/);
 assert.doesNotMatch(worker,/return json\(\{session_token:session\.id_token/);
});
test("E026 real Sheet confirm, foreground status, exact app icon",()=>{
 assert.match(mirror,/sheet\/confirm-record/);
 assert.match(core,/UPDATE obpp_records SET sync_status='SYNCED'/);
 assert.match(app,/if \(tab == "Lịch sử"\) refreshRecords/);
 assert.match(manifest,/android:icon="@drawable\/obpp_launcher"/);
});
test("E026 manual sync is confirmed and throttled on durable Core and client",()=>{
 assert.match(core,/obpp_manual_sync_cooldown/);
 assert.match(core,/elapsed<60000/);
 assert.match(worker,/SYNC_COOLDOWN/);
 assert.match(app,/setTitle\("Xác nhận đồng bộ"\)/);
 assert.match(app,/manualSyncRunning/);
});
test("E026 OBPP logs use existing Drive authority and delete only after ACK",()=>{
 assert.match(worker,/manual_obpp1291/);
 assert.match(worker,/uploadRuntimeLog\(env/);
 assert.match(logs,/ZoneId\.of\("Asia\/Ho_Chi_Minh"\)/);
 assert.match(logs,/withHour\(21\)\.withMinute\(15\)/);
 assert.match(logs,/15\*60\*1000L/);
 assert.match(logs,/drive_synced/);
 assert.match(logs,/if\(!file\.delete\(\)\)return false/);
 assert.doesNotMatch(logs,/raw_scan|password|session_token|store_code|do_code/);
});
