import assert from "node:assert/strict";
import { createServiceFixture, loadServiceModule } from "./fixtures/d173-service-fixture.mjs";

const { db, state, sockets, statements } = await createServiceFixture();
const operational = loadServiceModule("service/src/operational-v2-core.ts");
const readModel = loadServiceModule("service/src/read-model-core.ts");
const now = new Date().toISOString();
for (const [id, role] of [["aud-own", "PICKER"], ["aud-other", "PICKER"], ["aud-reporter", "REPORTER"]]) {
  db.prepare(`INSERT INTO users(user_id,firebase_uid,employee_code,display_name,role,status,shortage_reporting_enabled,
    web_session_generation,android_session_generation) VALUES(?,?,?,?,?,'ACTIVE',1,3,7)`).run(id, "uid-" + id, id, id, role);
}
for (const id of ["aud-own", "aud-other"]) {
  db.prepare("INSERT INTO sku_master(sku,product_name) VALUES(?,?)").run("sku-" + id, id);
  db.prepare(`INSERT INTO report_batches(batch_id,sku,product_name,status,first_report_at,last_report_at,business_day_vn,created_at,updated_at)
    VALUES(?,?,?,'PENDING',?,?,?,?,?)`).run("batch-" + id, "sku-" + id, id, now, now, "fixture-day", now, now);
  db.prepare(`INSERT INTO report_tickets(ticket_id,batch_id,picker_user_id,picker_employee_code,sku,status,business_day_vn,
    reported_at,withdraw_deadline_at,created_at,updated_at) VALUES(?,?,?,?,?,'OPEN',?,?,?,?,?)`)
    .run("ticket-" + id, "batch-" + id, id, id, "sku-" + id, "fixture-day", now, now, now, now);
}
const originalEpoch = operational.realtimeStreamMetadata(state).stream_epoch;
function socket(id = "aud-own", role = "PICKER", base = 0, epoch = originalEpoch) {
  return { attachment: { connection_id: "fixture", user_id: id, role, client_type: "WEB", firebase_uid: "uid-" + id,
      command_protocol: "d173-v2", session_channel: "WEB", session_generation: 3, auth_expires_at_ms: Date.now() + 60_000,
      last_sent_seq: base, last_sent_stream_epoch: epoch }, sent: [], closed: [], fail: false,
    deserializeAttachment() { return structuredClone(this.attachment); },
    serializeAttachment(value) { this.attachment = structuredClone(value); },
    send(value) { if (this.fail) throw Error("lost frame"); this.sent.push(JSON.parse(value)); },
    close(...value) { this.closed.push(value); },
  };
}
let seq = 0;
function event(own) {
  const id = "aud-event-" + ++seq;
  db.prepare(`INSERT INTO realtime_events(seq,event_id,event_type,batch_id,ticket_id,batch_version,scopes_json,payload_json,created_at)
    VALUES(?,?,'REPORT_CREATED',?,?,1,'["picker_reports"]','{}',?)`)
    .run(seq, id, "batch-" + (own ? "aud-own" : "aud-other"), "ticket-" + (own ? "aud-own" : "aud-other"), now);
  return id;
}
async function broadcast(eventId) {
  const result = await readModel.handleReadModelCoreRequest(state, new Request("https://inventory-core.internal/realtime/broadcast", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      event: "report_created", event_id: eventId, scopes: ["picker_reports"], tags: ["role:PICKER"],
    }),
  }));
  assert.equal(result.status, 200);
  return result.json();
}
try {
  const ws = socket(); sockets.push(ws);
  const other1 = event(false), own2 = event(true);
  await broadcast(other1);
  assert.equal(ws.sent.length, 0, "no new frame or invocation for an ineligible event");
  const start = statements.length;
  await broadcast(own2);
  const proof = ws.sent.at(-1).audience_coverage;
  assert.deepEqual(proof, { complete: true, stream_epoch: originalEpoch, user_id: "aud-own", role: "PICKER",
    session_channel: "WEB", session_generation: 3, from_seq: 1, through_seq: 1 });
  assert.equal(ws.attachment.last_sent_seq, 2);
  assert.equal(statements.slice(start).filter(sql => /FROM realtime_events candidate WHERE candidate\.seq >=/.test(sql)).length, 1,
    "one indexed bounded range query, not one query per hidden event");

  // Hibernation reconstructs the object from its persisted attachment.
  const recovered = socket(); recovered.attachment = structuredClone(ws.attachment);
  sockets.splice(0, sockets.length, recovered);
  event(false); const failedOwn4 = event(true);
  recovered.fail = true; await broadcast(failedOwn4);
  assert.equal(recovered.attachment.last_sent_seq, 2, "failed send never advances persisted baseline");
  recovered.fail = false; event(false); const own6 = event(true); await broadcast(own6);
  assert.equal(recovered.sent.at(-1).audience_coverage, undefined, "missed eligible frame forces normal delta");
  assert.equal(recovered.attachment.last_sent_seq, 6);
  event(true); event(false); const own9 = event(true); await broadcast(own9);
  assert.equal(recovered.sent.at(-1).audience_coverage, undefined, "unbroadcast eligible event cannot be certified away");
  const beforeLong = seq;
  for (let index = 0; index < 101; index++) event(false);
  const longCurrent = event(true);
  const beforeLongQueries = statements.length;
  await broadcast(longCurrent);
  assert.equal(recovered.sent.at(-1).audience_coverage, undefined);
  assert.equal(statements.slice(beforeLongQueries).filter(sql => /FROM realtime_events candidate WHERE candidate\.seq >=/.test(sql)).length, 0,
    "over-limit interval does not scan");
  assert.equal(seq - beforeLong, 102);

  event(false); const changedEpoch = event(true);
  db.prepare("UPDATE app_config SET value_json=? WHERE key='realtime_stream_epoch_v1'").run(JSON.stringify({ epoch: "replacement-epoch" }));
  await broadcast(changedEpoch);
  assert.equal(recovered.sent.at(-1).stream_epoch, "replacement-epoch");
  assert.equal(recovered.sent.at(-1).audience_coverage, undefined, "epoch change needs normal recovery");
  const deletedEvent = event(false); const afterDeleted = event(true);
  db.prepare("DELETE FROM realtime_events WHERE event_id=?").run(deletedEvent);
  await broadcast(afterDeleted);
  assert.equal(recovered.sent.at(-1).audience_coverage, undefined, "a deleted global row is not proof of audience filtering");

  const reporter = socket("aud-reporter", "REPORTER", seq, "replacement-epoch");
  sockets.splice(0, sockets.length, reporter);
  event(false); const reporterCurrent = event(true); await broadcast(reporterCurrent);
  assert.equal(reporter.sent.at(-1).audience_coverage, undefined, "non-Picker delta audience includes all global rows");
  assert.equal(reporter.attachment.last_sent_seq, seq);
  db.prepare("UPDATE users SET web_session_generation=4 WHERE user_id='aud-reporter'").run();
  const sentBefore = reporter.sent.length;
  await broadcast(event(true));
  assert.equal(reporter.sent.length, sentBefore);
  assert.equal(reporter.closed.at(-1)[0], 4401, "replaced generation never emits proof or private push");

  // The same predicate authorizes targets beyond ticket ownership (ACK audience),
  // so a gap containing an ACK-targeted result must also recover normally.
  const targetEvent = event(false);
  db.prepare(`INSERT INTO result_acknowledgements(result_event_id,batch_id,batch_version,target_user_id,created_at,updated_at)
    VALUES(?,'batch-aud-other',1,'aud-own',?,?)`).run(targetEvent, now, now);
  assert.equal(operational.pickerCanReceiveRealtimeEvent(state, targetEvent, "ticket-aud-other", "aud-own"), true);
  assert.equal(operational.pickerRealtimeGapIsIneligible(state, "aud-own", seq, seq), false);
  assert.equal(operational.pickerRealtimeGapIsIneligible(state, "aud-other", 1, 1), false);
  assert.equal(operational.pickerRealtimeGapIsIneligible(state, "aud-own", 1, 1), true);
  console.log("D173_E109_AUDIENCE_SQLITE_PASS: bounded shared eligibility, filtered gap proof, persistence, missed eligible/send-failure/epoch/retention/large-gap fallback, role/session fence");
} finally { db.close(); }
