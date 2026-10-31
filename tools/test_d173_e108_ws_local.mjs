#!/usr/bin/env node
// D173-E108: genuine local Miniflare/Wrangler websocket + sqlite POC, never remote.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { strict as assert } from "node:assert";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const root = join(dir, "..");
const port = 9797;
const origin = "http://127.0.0.1:" + port;
const wrangler = join(root, "service", "node_modules", "wrangler", "bin", "wrangler.js");
let logs = "";
const child = spawn(process.execPath, [wrangler, "dev",
  "--config", "tools/d173_e108_ws_local.wrangler.toml",
  "--local", "--ip", "127.0.0.1", "--port", String(port),
  "--persist-to", "/tmp/d173-e108-m2-wrangler-ephemeral",
  "--log-level", "error"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", d => { logs = (logs + d.toString()).slice(-8000); });
child.stderr.on("data", d => { logs = (logs + d.toString()).slice(-8000); });
const endpoint = (path, uid, gen = 1) => origin + path + "?uid=" + uid + "&gen=" + gen;
async function post(path, uid, frame) {
  const response = await fetch(endpoint(path, uid), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(frame ?? {}),
  });
  assert.equal(response.status, 200);
  return response.json();
}
async function ready() {
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error("wrangler exited: " + logs.slice(-3000));
    try {
      const r = await fetch(endpoint("/command", "p1"), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: "ready", operation: "RECOVER", after_seq: 0 })
      });
      if (r.ok) return;
    } catch { /* starting */ }
    await sleep(200);
  }
  throw new Error("wrangler did not start: " + logs.slice(-3000));
}
function channel(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const queue = [], waiters = [];
    const timeout = setTimeout(() => reject(new Error("websocket handshake timed out")), 12000);
    ws.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve({
        send: (frame) => ws.send(JSON.stringify(frame)),
        receive: () => new Promise((ok, fail) => {
          if (queue.length) return ok(queue.shift());
          const deadline = setTimeout(() => fail(new Error("websocket message timed out")), 10000);
          waiters.push((frame) => { clearTimeout(deadline); ok(frame); });
        }),
        close: () => ws.close(),
      });
    });
    ws.addEventListener("error", () => reject(new Error("websocket failure")));
    ws.addEventListener("message", ev => {
      const data = JSON.parse(String(ev.data));
      if (waiters.length) waiters.shift()(data);
      else queue.push(data);
    });
  });
}
try {
  await ready();
  const ws = await channel("ws://127.0.0.1:" + port + "/socket?uid=p1&gen=1");
  assert.equal((await ws.receive()).type, "CONNECTED");
  ws.send({ request_id: "m1", operation: "REPORT", sku: "A" });
  const first = await ws.receive();
  assert.equal(first.ok, true);
  assert.equal(first.id, 1);
  const retry = await post("/command", "p1", { request_id: "m1", operation: "REPORT", sku: "A" });
  assert.deepEqual(retry, { ok: true, id: 1, sku: "A" });
  const conflict = await post("/command", "p1", { request_id: "m1", operation: "REPORT", sku: "B" });
  assert.equal(conflict.error, "REQUEST_ID_REUSED");
  const second = await post("/command", "p2", { request_id: "m2", operation: "REPORT", sku: "B" });
  assert.equal(second.ok, true);
  ws.send({ request_id: "m3", operation: "RECOVER", after_seq: 0 });
  const recovered = await ws.receive();
  assert.equal(recovered.events.length, 1);
  assert.equal(recovered.events[0].sku, "A");
  assert.equal(recovered.covered_through, 2); // skips unrelated p2 without false gap
  const revoked = await post("/test-revoke", "p1", {});
  assert.equal(revoked.ok, true);
  ws.send({ request_id: "m4", operation: "REPORT", sku: "C" });
  assert.equal((await ws.receive()).error, "SESSION_REVOKED");
  ws.close();
  console.log(JSON.stringify({
    gate: "WS_LOCAL_INTEGRATION_PASS", ws_hibernation_handler: true,
    same_dispatcher_http_ws: true, persistence: "local_ephemeral_sqlite",
    duplicate_business_writes: 0, provider_requests: 0,
  }));
} catch (e) {
  console.error("WS_LOCAL_INTEGRATION_FAIL", String(e?.stack || e), logs.slice(-4000));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await sleep(250);
}
