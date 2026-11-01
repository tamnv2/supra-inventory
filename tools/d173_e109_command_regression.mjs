import assert from "node:assert/strict";
import { createServiceFixture, loadServiceModule } from "./fixtures/d173-service-fixture.mjs";

const protocol = loadServiceModule("service/src/d173-command-protocol.ts");
function socket(attachment = null, failSend = false) {
  const sent = [], closed = [];
  return { sent, closed, attachment,
    deserializeAttachment() { return this.attachment; }, serializeAttachment(value) { this.attachment = { ...value }; },
    send(value) { if (failSend) throw Error("lost response"); sent.push(JSON.parse(value)); },
    close(...args) { closed.push(args); },
  };
}
const forbidden = () => { throw Error("legacy frame must have no business effect"); };
for (const message of ["", "unexpected", "ắ".repeat(2000), '{"type":"request","request_id":"legacy-001","operation":"shortage.resolve","args":{}}', new ArrayBuffer(128)]) {
  const ws = socket();
  await protocol.handleD173WebSocketFrame({ storage: { sql: { exec: forbidden } } }, ws, message, forbidden, forbidden);
  assert.deepEqual(ws.sent, []); assert.deepEqual(ws.closed, []);
}
for (const message of ["x".repeat(2049), new ArrayBuffer(2049)]) {
  const ws = socket();
  await protocol.handleD173WebSocketFrame({}, ws, message, forbidden, forbidden);
  assert.deepEqual(ws.sent, []); assert.deepEqual(ws.closed, [[1009, "message-too-large"]]);
}
const { core, state, db, kv, sockets } = await createServiceFixture();
const readModel = loadServiceModule("service/src/read-model-core.ts");
const insertUser = db.prepare(`INSERT INTO users(user_id,firebase_uid,employee_code,display_name,role,status,
  shortage_reporting_enabled,web_session_generation,android_session_generation,firebase_agent_ready)
 VALUES(?,?,?,?,?,'ACTIVE',1,3,7,1)`);
for (const [id, role] of [["reporter", "REPORTER"], ["picker", "PICKER"], ["admin", "ADMIN"], ["root", "ROOT"]]) {
  insertUser.run("test-" + id, "uid-" + id, "fixture-" + id, id, role);
}
function identity(id = "reporter", role = "REPORTER", patch = {}) {
  return { command_protocol: "d173-v2", firebase_uid: "uid-" + id, user_id: "test-" + id,
    role, session_channel: "WEB", session_generation: 3, auth_expires_at_ms: Date.now() + 60_000, ...patch };
}
const frame = (id, operation, args = {}) => JSON.stringify({ type: "request", request_id: id, operation, args });
async function command(ws, id, operation, args = {}) {
  await core.webSocketMessage(ws, frame(id, operation, args));
  return ws.sent.at(-1);
}
try {
  let ws = socket(identity());
  assert.equal((await command(ws, "valid-read-001", "reporter.snapshot")).status, 200);
  assert.ok(ws.sent[0].payload.snapshot.queue);
  assert.equal((await command(ws, "inject-path-001", "/auth/user-by-firebase-uid", { uid: "uid-admin" })).status, 400);
  assert.equal((await command(ws, "inject-user-001", "reporter.snapshot", { firebase_uid: "uid-admin", role: "ROOT", user_id: "test-admin", url: "/health" })).status, 200);
  assert.equal(ws.sent.at(-1).payload.coverage.user_id, "test-reporter", "command arguments cannot substitute authority");
  assert.equal((await command(ws, "id-mismatch-001", "shortage.resolve", { request_id: "different-id", batch_id: "b", resolution: "HAS_STOCK" })).status, 400);
  const deep = socket(identity());
  const nestedFrame = '{"type":"request","request_id":"nested-case-001","operation":"shortage.resolve","args":{"read_model":{"kind":"REPORTER","params":{"limit":' +
    '['.repeat(7000) + '0' + ']'.repeat(7000) + '}}}}';
  await core.webSocketMessage(deep, nestedFrame);
  assert.equal(deep.sent.at(-1).status, 400, "deep valid bounded JSON cannot escape as a DO exception");
  await core.webSocketMessage(deep, '{"type":"request","request_id":' + '['.repeat(7000) + '0' + ']'.repeat(7000) + ',"operation":"reporter.snapshot","args":{}}');
  assert.equal(deep.sent.at(-1).status, 400, "non-string nested request ID is rejected without coercion");
  ws = socket(identity("reporter", "REPORTER", { auth_expires_at_ms: Date.now() - 1 }));
  assert.equal((await command(ws, "expired-identity", "reporter.snapshot")).status, 401);
  assert.equal(ws.closed.at(-1)[0], 4401);
  for (const patch of [{ firebase_uid: "unknown-uid" }, { session_generation: 2 }, { session_channel: "OBPP1291" }]) {
    const result = await command(socket(identity("reporter", "REPORTER", patch)), "denied-read-001", "reporter.snapshot");
    assert.ok([401, 403].includes(result.status));
  }
  db.prepare("UPDATE users SET role='PICKER' WHERE user_id='test-reporter'").run();
  assert.equal((await command(socket(identity()), "role-change-001", "reporter.snapshot")).status, 403, "per-command role checked in current SQLite");
  db.prepare("UPDATE users SET role='REPORTER' WHERE user_id='test-reporter'").run();
  db.prepare("UPDATE users SET status='DISABLED' WHERE user_id='test-reporter'").run();
  assert.equal((await command(socket(identity()), "disable-user-001", "reporter.snapshot")).status, 403);
  db.prepare("UPDATE users SET status='ACTIVE' WHERE user_id='test-reporter'").run();
  const disabled = socket(identity());
  await protocol.handleD173WebSocketFrame(state, disabled, frame("flag-disabled-01", "reporter.snapshot"), forbidden, forbidden, false);
  assert.equal(disabled.sent.length, 0, "transport rollback flag preserves legacy push socket");
  const oversized = socket(identity());
  await core.webSocketMessage(oversized, "ắ".repeat(6000));
  assert.equal(oversized.closed.at(-1)[0], 1009, "negotiated command limit uses UTF-8 bytes");
  const saturated = socket(identity());
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const pending = Array.from({ length: 16 }, (_, index) => protocol.handleD173WebSocketFrame(state, saturated,
    frame("pending-read-" + index, "reporter.snapshot"), async () => { await gate; return new Response("{}"); }, forbidden));
  await protocol.handleD173WebSocketFrame(state, saturated, frame("pending-read-17", "reporter.snapshot"), forbidden, forbidden);
  assert.equal(saturated.sent.at(-1).status, 429, "bounded pending commands protect object memory");
  release(); await Promise.all(pending);

  // Canonical root-only effective-role rules also protect private server push.
  db.prepare("UPDATE users SET role_override='PICKER' WHERE user_id='test-admin'").run();
  assert.equal(protocol.d173LiveSocketIdentity(state, identity("admin", "ADMIN")), true);
  assert.equal(protocol.d173LiveSocketIdentity(state, identity("admin", "PICKER")), false);
  db.prepare("UPDATE users SET role_override='REPORTER' WHERE user_id='test-root'").run();
  assert.equal(protocol.d173LiveSocketIdentity(state, identity("root", "REPORTER")), true);

  // One-use tickets bind a verified identity and refuse generation changes
  // occurring between ticket creation and the later socket handshake.
  const ticketResult = await readModel.handleReadModelCoreRequest(state, new Request("https://inventory-core.internal/realtime/ticket", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      user_id: "test-reporter", role: "REPORTER", client_type: "WEB", firebase_uid: "uid-reporter",
      session_channel: "WEB", session_generation: 3, auth_expires_at_ms: Date.now() + 60_000,
    }),
  }));
  const ticketBody = await ticketResult.json();
  assert.equal(kv.get("realtime-ticket:" + ticketBody.ticket).command_protocol, "d173-v2");
  db.prepare("UPDATE users SET web_session_generation=4 WHERE user_id='test-reporter'").run();
  const rejectedConnect = await readModel.handleReadModelCoreRequest(state, new Request("https://inventory-core.internal/realtime/connect?ticket=" + ticketBody.ticket, { headers: { Upgrade: "websocket" } }));
  assert.equal(rejectedConnect.status, 401);
  assert.equal(kv.has("realtime-ticket:" + ticketBody.ticket), false);
  db.prepare("UPDATE users SET web_session_generation=3 WHERE user_id='test-reporter'").run();
  const expiredPush = socket(identity("reporter", "REPORTER", { auth_expires_at_ms: Date.now() - 1 }));
  sockets.push(expiredPush);
  await readModel.handleReadModelCoreRequest(state, new Request("https://inventory-core.internal/realtime/broadcast", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "test", scopes: ["reporter_queue"], tags: ["role:REPORTER"] }),
  }));
  assert.equal(expiredPush.sent.length, 0);
  assert.equal(expiredPush.closed.at(-1)[0], 4401);
  sockets.length = 0;

  const now = new Date().toISOString();
  db.exec("INSERT INTO sku_master(sku,product_name) VALUES('12345678','Fixture')");
  const addBatch = id => {
    db.prepare(`INSERT INTO report_batches(batch_id,sku,product_name,status,first_report_at,last_report_at,business_day_vn,created_at,updated_at)
      VALUES(?,'12345678','Fixture','PENDING',?,?,?,?,?)`).run(id, now, now, id, now, now);
    db.prepare(`INSERT INTO report_tickets(ticket_id,batch_id,picker_user_id,picker_employee_code,sku,status,business_day_vn,
      reported_at,withdraw_deadline_at,created_at,updated_at) VALUES(?,?,'test-picker','fixture-picker','12345678','OPEN',?,?,?,?,?)`)
      .run("ticket-" + id, id, id, now, now, now, now);
  };
  addBatch("resolve-batch");
  const args = { batch_id: "resolve-batch", resolution: "HAS_STOCK", read_model: { kind: "REPORTER", params: {} } };
  // Simulate a response lost AFTER commit; the exact same HTTP ID must replay.
  await command(socket(identity(), true), "lost-response-001", "shortage.resolve", args);
  const fallback = protocol.d173CommandRequest(identity(), "lost-response-001", "shortage.resolve", args);
  const fallbackResult = await (await core.fetch(fallback)).json();
  assert.equal(fallbackResult.result.idempotent_replay, true);
  const eventId = fallbackResult.result.event_id;
  assert.ok(eventId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM report_events WHERE batch_id='resolve-batch' AND event_type='BATCH_RESOLVED'").get().n, 1);
  const changed = await command(socket(identity()), "lost-response-001", "shortage.resolve", { ...args, resolution: "SKIP_ALLOWED" });
  assert.equal(changed.status, 409);
  assert.equal(changed.payload.error, "IDEMPOTENCY_KEY_REUSED");
  assert.ok(!JSON.stringify(changed).includes("__d173_request_fingerprint"));
  const retry = await command(socket(identity()), "lost-response-001", "shortage.resolve", args);
  assert.equal(retry.status, 200); assert.equal(retry.payload.event_id, eventId);
  assert.equal("prepared" in retry.payload, false, "private envelope never leaks to WS response");
  const { scheduleD173ShortageFcm } = loadServiceModule("service/src/business-api.ts");
  const stripped = await scheduleD173ShortageFcm({ FIREBASE_PROJECT_ID: "fixture", INVENTORY_CORE: {} }, { waitUntil() {} }, "withdraw", {},
    new Response(JSON.stringify({ result: { status: "ok" }, prepared: { tokens: ["PRIVATE_DEVICE_TOKEN"] } })));
  assert.deepEqual(await stripped.json(), { status: "ok" });

  addBatch("race-batch");
  const racedRequest = protocol.d173CommandRequest(identity(), "race-case-0001", "shortage.resolve", { batch_id: "race-batch", resolution: "HAS_STOCK" });
  const parseOriginal = racedRequest.json.bind(racedRequest);
  racedRequest.json = async () => {
    const value = await parseOriginal();
    db.prepare("UPDATE users SET web_session_generation=4 WHERE user_id='test-reporter'").run();
    return value;
  };
  assert.equal((await core.fetch(racedRequest)).status, 401, "replaced session during request parsing cannot mutate");
  assert.equal(db.prepare("SELECT status FROM report_batches WHERE batch_id='race-batch'").get().status, "PENDING");
  db.prepare("UPDATE users SET web_session_generation=3 WHERE user_id='test-reporter'").run();
  const business = loadServiceModule("service/src/business-core.ts");
  const atomicRequest = new Request("https://inventory-core.internal/business/reporter/resolve", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ request_id: "atomic-race-0001", batch_id: "race-batch", resolution: "HAS_STOCK",
      actor: { user_id: "test-reporter", employee_code: "fixture-reporter", role: "REPORTER" },
      __d173_auth: { uid: "uid-reporter", channel: "WEB", generation: 3, user_id: "test-reporter", role: "REPORTER" } }),
  });
  const parseAtomic = atomicRequest.json.bind(atomicRequest);
  atomicRequest.json = async () => {
    const value = await parseAtomic();
    db.prepare("UPDATE users SET web_session_generation=4 WHERE user_id='test-reporter'").run();
    return value;
  };
  assert.equal((await business.handleBusinessRequest(state, atomicRequest)).status, 401, "transaction fence repeats live auth after business parse await");
  assert.equal(db.prepare("SELECT status FROM report_batches WHERE batch_id='race-batch'").get().status, "PENDING");
  db.prepare("UPDATE users SET web_session_generation=3 WHERE user_id='test-reporter'").run();

  // Fail the durable journal INSERT: SQLite must roll back the transition and
  // event as well, rather than committing un-replayable success.
  addBatch("rollback-batch");
  db.exec(`CREATE TRIGGER fixture_abort_journal BEFORE INSERT ON idempotency_keys
    WHEN NEW.idempotency_key='rollback-case-001' BEGIN SELECT RAISE(ABORT,'fixture disk failure'); END;`);
  const failed = await command(socket(identity()), "rollback-case-001", "shortage.resolve", { batch_id: "rollback-batch", resolution: "HAS_STOCK" });
  assert.equal(failed.status, 503);
  assert.equal(db.prepare("SELECT status FROM report_batches WHERE batch_id='rollback-batch'").get().status, "PENDING");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM report_events WHERE batch_id='rollback-batch' AND event_type='BATCH_RESOLVED'").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM idempotency_keys WHERE idempotency_key='rollback-case-001'").get().n, 0);
  db.exec("DROP TRIGGER fixture_abort_journal");
  assert.equal((await command(socket(identity()), "rollback-case-001", "shortage.resolve", { batch_id: "rollback-batch", resolution: "HAS_STOCK" })).status, 200);
  console.log("D173_E109_COMMAND_SQLITE_PASS: legacy parity, live auth + parse-race fences, frame/backpressure bounds, ticket revoke, private push, same-ID replay, fingerprint409, atomic rollback, prepared stripping");
} finally { db.close(); }
