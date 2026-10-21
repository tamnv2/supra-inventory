import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("D171 E062: VPS has authenticated operational parity for bulk Kick and support logs", () => {
  const agent = read("relay-agent/D161AdminControl.cs");
  const support = read("relay-agent/D161SupportLogControl.cs");
  const service = read("service/src/index.ts");
  assert.match(agent, /login == "admin" \|\| login == "tamnv2" \|\| login == "vps"/);
  assert.match(agent, /session\.Role == "ADMIN" && session\.BaseRole == "ADMIN"/);
  assert.match(support, /IsD161PrivilegedAgentLogin\(session\)/);
  assert.equal((service.match(/\["admin", "tamnv2", "vps"\]\.includes\(login\)/g) || []).length, 2);
  assert.match(service, /operator\.base_role !== operator\.role/);
  assert.match(service, /requireAgentUser\(request, env, \["ADMIN", "PICKPACK_ADMIN"\]\)/);
});

test("D171 E062: bulk preview zero clears only locally stale generations, no false server Kick", () => {
  const agent = read("relay-agent/D161AdminControl.cs");
  const source = read("relay-agent/D119AgentFeatures.cs");
  assert.match(agent, /targetCount <= 0[\s\S]*CapturePickerSessionGenerations\(\)[\s\S]*ApplyLocalPickerSessionRemovals/);
  assert.match(source, /item\.SessionGeneration > Math\.Max\(0L, removedGeneration\)/);
  assert.match(source, /FilterPickerTombstones\(next\)/);
  assert.match(source, /_pickerOnlineRenderSignature = "";/);
  assert.match(source, /loginName.*[\s\S]*"vps", StringComparison\.OrdinalIgnoreCase/);
  assert.match(read("relay-agent/FirestoreVpsReclaim.cs"), /IsOwner\(AgentSession session\)/);
  assert.doesNotMatch(read("relay-agent/FirestoreVpsReclaim.cs").split("internal static bool IsOwner")[1].split("private static bool IsRealAgentRole")[0], /"vps"/);
});

test("D171 E062: Wi-Fi priority removed from everyday Connection settings without breaking scoped SKU fallback", () => {
  const ui = read("relay-agent/Program.cs");
  const route = read("relay-agent/D168NetworkRoute.cs");
  const settings = ui.split("// Kết nối")[1].split("// Nhật ký")[0];
  assert.doesNotMatch(settings, /InitializeD168WorkerWifiControls\(networkCard\)/);
  assert.match(ui, /Cấu hình mạng dự phòng SKU/);
  assert.match(ui, /ConfigureD168WorkerWifiProfiles\(\)/);
  assert.match(route, /ApprovedProfiles\(\)/);
  assert.match(route, /OpenWorkerSession/);
  assert.match(route, /RestoreOriginalProfile/);
});
