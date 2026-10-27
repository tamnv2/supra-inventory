import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "../service/node_modules/typescript/lib/typescript.js";

const core = readFileSync("service/src/core.ts", "utf8");
const realtime = readFileSync("service/src/read-model-core.ts", "utf8");
const client = readFileSync("web/src/realtime-client.ts", "utf8");
const begin = core.indexOf("  async webSocketMessage(");
const end = core.indexOf("  async webSocketClose(", begin);
assert.ok(begin > 0 && end > begin, "must have hibernation message handler");
assert.equal(core.indexOf("  async webSocketMessage(", begin + 1), -1, "one handler only");
const method = core.slice(begin, end);
assert.match(realtime, /state\.acceptWebSocket\(server/);
assert.match(realtime, /state\.setWebSocketAutoResponse\(new WebSocketRequestResponsePair\("ping", "pong"\)\)/);
assert.doesNotMatch(client, /\b(?:next|socket)\.send\(/, "existing Web client is server-push only");
for (const banned of ["JSON.parse(", ".storage", ".sql.", ".fetch(", "setTimeout(", "setInterval(", "await "]){
  assert.ok(!method.includes(banned), "no business I/O or timer in handler: "+banned);
}
const transpiled = ts.transpileModule("class WSProbe {\n" + method + "\n}", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  reportDiagnostics: true
});
assert.equal(transpiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const WSProbe = vm.runInNewContext(transpiled.outputText + "\nWSProbe;");
const probe = new WSProbe();
function mockSocket(throws=false){
  const calls=[];
  return { calls, send(){calls.push(["send"]);}, close(...args){calls.push(["close",...args]);if(throws)throw Error("already closed");} };
}
for (const message of ["", "unexpected frame", "{\"type\":\"mutation\"}", new ArrayBuffer(128)]) {
  const ws=mockSocket();
  await probe.webSocketMessage(ws,message);
  assert.deepEqual(ws.calls,[], "benign unsolicited frames must not disrupt realtime");
}
for (const message of ["x".repeat(2049),new ArrayBuffer(2049)]) {
  const ws=mockSocket();
  await probe.webSocketMessage(ws,message);
  assert.deepEqual(ws.calls,[["close",1009,"message-too-large"]]);
}
const closing=mockSocket(true);
await probe.webSocketMessage(closing,new ArrayBuffer(4096));
assert.deepEqual(closing.calls,[["close",1009,"message-too-large"]]);
assert.match(core,/async webSocketClose\(/);
assert.match(core,/async webSocketError\(/);
console.log("D173_E086_HIBERNATION_FRAME_EQUIVALENCE_PASS: no DB/network/timer, no echoed frames, 1009 only for oversized frames");
