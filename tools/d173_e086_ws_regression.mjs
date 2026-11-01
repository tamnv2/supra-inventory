import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "../service/node_modules/typescript/lib/typescript.js";

const core = readFileSync("service/src/core.ts", "utf8");
const realtime = readFileSync("service/src/read-model-core.ts", "utf8");
const client = readFileSync("web/src/realtime-client.ts", "utf8");
const protocolSource = readFileSync("service/src/d173-command-protocol.ts", "utf8");
const begin = core.indexOf("  async webSocketMessage(");
const end = core.indexOf("  async webSocketClose(", begin);
assert.ok(begin > 0 && end > begin, "must have hibernation message handler");
assert.equal(core.indexOf("  async webSocketMessage(", begin + 1), -1, "one handler only");
const method = core.slice(begin, end);
assert.match(realtime, /state\.acceptWebSocket\(server/);
assert.match(realtime, /state\.setWebSocketAutoResponse\(new WebSocketRequestResponsePair\("ping", "pong"\)\)/);
// D173-E109 explicitly negotiates two-way commands. Preserve the entire E086
// legacy contract using the REAL adapter; do not ban newly authorized v2 code.
assert.match(client, /configureCommandTransport/);
assert.match(method, /handleD173WebSocketFrame/);
assert.doesNotMatch(method, /setTimeout\(|setInterval\(/);
const protocolModule = { exports: {} };
const protocolCompiled = ts.transpileModule(protocolSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(protocolCompiled, { module: protocolModule, exports: protocolModule.exports,
  TextEncoder, Request, Headers, Response, Date, WeakMap, Set });
const transpiled = ts.transpileModule("class WSProbe { constructor(){this.state={};this.env={};}\n" + method + "\n}", {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  reportDiagnostics: true
});
assert.equal(transpiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const forbidden = () => { throw Error("legacy frame may not execute any business or provider operation"); };
const WSProbe = vm.runInNewContext(transpiled.outputText + "\nWSProbe;", {
  handleD173WebSocketFrame: protocolModule.exports.handleD173WebSocketFrame,
  scheduleD173ShortageFcm: forbidden, d173LocalNamespace: forbidden,
});
const probe = new WSProbe();
function mockSocket(throws=false){
  const calls=[];
  return { calls, send(){calls.push(["send"]);}, close(...args){calls.push(["close",...args]);if(throws)throw Error("already closed");} };
}
for (const message of ["", "unexpected frame", "ắ".repeat(2000), "{\"type\":\"mutation\"}",
  '{"type":"request","operation":"shortage.resolve","request_id":"legacy-test","args":{}}', new ArrayBuffer(128)]) {
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
console.log("D173_E086_LEGACY_FRAME_EQUIVALENCE_PASS: legacy no DB/network/timer/echo, text-unit limit preserved; negotiated v2 tested separately");

// Existing Worker regression entrypoint also verifies D173-E097 SQLite cold/warm boot safety.
await import("./d173_e097_startup_regression.mjs");
