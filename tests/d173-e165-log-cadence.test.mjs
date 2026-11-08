import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const slots = ["0100","0300","0500","0700","0900","1100","1300","1500","1700","1900","2100","2300"];

test("Agent seals durable two-hour VN slots with stable stagger and independent manual support", () => {
  const agent = source("relay-agent/AgentLogUploadBridge.cs");
  assert.match(agent,/DeliverySlots\s*=/);
  for(const slot of slots) assert.match(agent,new RegExp("(?<![0-9])"+Number(slot)+"(?![0-9])"));
  assert.doesNotMatch(agent,/new TimeSpan\(21, 15, 0\)/);
  assert.match(agent,/hash%601/);
  assert.match(agent,/TryQueueManualSnapshot/);
  assert.match(agent,/TryQueueGlobalSupportSnapshot/);
  assert.match(agent,/File\.Move\(temp, pendingPath\)/);
  assert.match(agent,/File\.Delete\(path\)/);
});

test("Android schedule and immutable bundle responder share twelve VN slots", () => {
  const work = source("android/app/src/main/java/cd/cc/supra/inventory/beta/D171DailyLogWorker.kt");
  const reply = source("android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt");
  for(const slot of slots){
    assert.ok(work.includes('"'+slot+'"'),"WorkManager "+slot);
    assert.ok(reply.includes(slot),"Android responder "+slot);
  }
  assert.match(reply,/if \(!slot\.matches\(Regex/);
  assert.match(work,/10L \* 60_000L/);
  assert.match(work,/WorkManager/);
  assert.match(reply,/archive_status/);
  assert.match(reply,/DRIVE_SYNCED/);
  assert.match(reply,/savedPayload/);
});

test("Web acknowledges scheduled logs only after durable Service/Core write, not merely network success", () => {
  const web = source("web/src/runtime-logger.ts");
  const service = source("service/src/runtime-logs.ts");
  for(const slot of [60,180,300,420,540,660,780,900,1020,1140,1260,1380]) assert.ok(web.includes(String(slot)));
  assert.match(web,/SLOT_PREFIX\s*=\s*"supra_inventory_web_log_slot_v4/);
  assert.match(web,/10 \* 60_000/);
  assert.match(web,/result.archive_status === "CORE_STAGED"/);
  const persist = service.indexOf('runtime-logs/upsert');
  const ack = service.indexOf('archive_status: "CORE_STAGED"');
  assert.ok(persist>=0 && ack>persist);
  assert.match(service,/source === "WEB".*scheduled_/);
  assert.match(service,/FILE_ID_RE.test\(env.LOGS_FOLDER_ID\)/);
  assert.match(service,/retryBufferedRuntimeLogArchives/);
});

test("Service log archive piggybacks existing five-minute cron at thirty-minute boundaries", () => {
  const worker = source("service/src/index.ts");
  const scheduler = source("service/src/d173-background-worker.ts");
  assert.match(worker,/controller.cron === "\*\/5 \* \* \* \*"/);
  assert.match(worker,/logDrainTime\.getUTCMinutes\(\) % 30 === 0/);
  assert.match(worker,/nearDailyCutoff/);
  assert.match(worker,/tick\.getUTCMinutes\(\) % 30 === 0/);
  assert.match(worker,/drainObppSheets\(env\)/); // D172 independent cron remains intact
  assert.match(scheduler,/retryBufferedRuntimeLogArchives\(env, 20, logs\)/);
  assert.match(scheduler,/drainLogArchive/);
});

test("daily report runs 05:30 VN and retains explicit missing-logs uncertainty", () => {
  const workflow = source(".github/workflows/d173-daily-usage-2200.yml");
  const script = source("tools/d173_daily_usage_2200.py");
  assert.match(workflow,/cron: "30 22 \* \* \*"/);
  assert.match(script,/dt\.time\(22, 0\)/);
  assert.match(script,/PENDING_VERIFIED_DRIVE_LOG_COVERAGE/);
  assert.match(script,/repository_source_sha/);
  assert.match(script,/production_deployment_sha/);
  assert.match(script,/root_cause_status/);
});
