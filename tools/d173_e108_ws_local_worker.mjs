// D173-E108 — LOCAL-ONLY WS hibernation POC. NEVER import into service/src or deploy.
// No Firebase/WMS credentials, no business data, no production binding.
const json = (value, status = 200) => Response.json(value, { status });

export class PocM2 {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.blockConcurrencyWhile(async () => {
      const sql = this.ctx.storage.sql;
      sql.exec("CREATE TABLE IF NOT EXISTS actors(uid TEXT PRIMARY KEY, role TEXT, generation INT, active INT)");
      sql.exec("CREATE TABLE IF NOT EXISTS receipts(uid TEXT, request_id TEXT, fingerprint TEXT, reply TEXT, PRIMARY KEY(uid,request_id))");
      sql.exec("CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, uid TEXT, sku TEXT, UNIQUE(uid,sku))");
      sql.exec("CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, payload TEXT)");
      sql.exec("INSERT OR IGNORE INTO actors(uid,role,generation,active) VALUES('p1','PICKER',1,1),('p2','PICKER',1,1),('r1','REPORTER',1,1)");
    });
  }

  dispatch(att, frame) {
    if (!frame || typeof frame !== "object" || typeof frame.request_id !== "string" ||
        frame.request_id.length < 1 || frame.request_id.length > 128)
      return { error: "INVALID_FRAME" };
    const actor = this.ctx.storage.sql.exec(
      "SELECT role,generation,active FROM actors WHERE uid=?", att.uid).toArray()[0];
    if (!actor || !actor.active || Number(actor.generation) !== Number(att.generation))
      return { error: "SESSION_REVOKED" };
    // Both HTTP and incoming WS frames execute this SAME transaction, with no DO self-fetch.
    return this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const fingerprint = JSON.stringify([frame.operation, frame.sku ?? "", frame.event_id ?? ""]);
      const old = sql.exec(
        "SELECT fingerprint,reply FROM receipts WHERE uid=? AND request_id=?",
        att.uid, frame.request_id).toArray()[0];
      if (old) return old.fingerprint === fingerprint
        ? JSON.parse(old.reply) : { error: "REQUEST_ID_REUSED" };
      let reply;
      if (frame.operation === "REPORT" && actor.role === "PICKER" &&
          typeof frame.sku === "string" && frame.sku.length > 0 && frame.sku.length < 100) {
        try {
          sql.exec("INSERT INTO reports(uid,sku) VALUES(?,?)", att.uid, frame.sku);
          const eventId = sql.exec("INSERT INTO events(recipient,payload) VALUES(?,?)",
            att.uid, JSON.stringify({ event: "REPORT", sku: frame.sku })).toArray();
          void eventId; // event sequence read using SQLite, not second business invocation.
          const id = sql.exec("SELECT id FROM reports WHERE uid=? AND sku=?", att.uid, frame.sku)
            .toArray()[0].id;
          reply = { ok: true, id: Number(id), sku: frame.sku };
        } catch {
          reply = { error: "ACTIVE_REPORT_EXISTS" };
        }
      } else if (frame.operation === "RECOVER") {
        const after = Number(frame.after_seq ?? 0);
        if (!Number.isSafeInteger(after) || after < 0) reply = { error: "INVALID_CURSOR" };
        else {
          const data = sql.exec("SELECT seq,payload FROM events WHERE recipient=? AND seq>? ORDER BY seq LIMIT 100",
            att.uid, after).toArray();
          const latest = sql.exec("SELECT COALESCE(MAX(seq),0) AS latest FROM events").toArray()[0].latest;
          reply = {
            events: data.map(r => ({ seq: Number(r.seq), ...JSON.parse(r.payload) })),
            covered_through: data.length === 100 ? Number(data[99].seq) : Number(latest)
          };
        }
      } else reply = { error: "FORBIDDEN_OR_UNSUPPORTED" };
      // Idempotency includes error receipt; real implementation requires error classification.
      sql.exec("INSERT INTO receipts(uid,request_id,fingerprint,reply) VALUES(?,?,?,?)",
        att.uid, frame.request_id, fingerprint, JSON.stringify(reply));
      return reply;
    });
  }

  async fetch(request) {
    const u = new URL(request.url);
    const att = { uid: u.searchParams.get("uid") || "", generation: Number(u.searchParams.get("gen") || 0) };
    if (u.pathname === "/socket" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment(att);
      server.send(JSON.stringify({ type: "CONNECTED", epoch: "m2-poc-only" }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (u.pathname === "/command" && request.method === "POST") {
      let frame;
      try { frame = await request.json(); } catch { return json({ error: "INVALID_JSON" }, 400); }
      return json(this.dispatch(att, frame));
    }
    if (u.pathname === "/test-revoke" && request.method === "POST") {
      // Test-only route; impossible to access from published InventoryCore, no production import.
      this.ctx.storage.sql.exec("UPDATE actors SET generation=generation+1 WHERE uid=?", att.uid);
      return json({ ok: true });
    }
    return json({ error: "NOT_FOUND" }, 404);
  }

  webSocketMessage(socket, message) {
    let frame;
    try {
      frame = JSON.parse(String(message));
    } catch {
      socket.send(JSON.stringify({ error: "INVALID_JSON" }));
      return;
    }
    const att = socket.deserializeAttachment() || {};
    socket.send(JSON.stringify({
      type: "RESULT", request_id: frame?.request_id ?? "",
      ...this.dispatch(att, frame),
    }));
  }
}

export default {
  fetch(request, env) {
    const stub = env.POC_CORE.get(env.POC_CORE.idFromName("m2-local-only"));
    return stub.fetch(request);
  },
};
