import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
test("D173 log archive diagnostic guard", () => {
  const service = read("service/src/runtime-logs.ts");
  const core = read("service/src/runtime-logs-core.ts");
  const agent = read("relay-agent/AgentLogUploadBridge.cs");
  assert.ok(service.includes('sourceValue || "").trim().toUpperCase() === "DIAGNOSTICS"'));
  assert.ok(service.includes("probeRuntimeLogArchiveDestination"));
  assert.ok(core.includes('url.pathname === "/runtime-logs/archive-diagnostics"'));
  assert.ok(core.includes("OTHER_ARCHIVE_FAILURE"));
  assert.ok(agent.includes("GATEWAY_REJECTED"));
  assert.ok(agent.includes("File.Delete(path)"));
});
