import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const core = source("service/src/core.ts");
const worker = source("service/src/index.ts");
const projector = source("service/src/firestore-projection.ts");
const agent = source("relay-agent/D119AgentFeatures.cs");
const sync = source("relay-agent/FirestoreAgentSync.cs");
const web = source("web/src/realtime-client.ts");
const host = source("relay-agent-webview2-host/Program.cs");
const layout = source("relay-agent/D173E179OverviewNoScroll.cs");

test("Server Web kick requires current Agent password and server session generation", () => {
  assert.match(worker, /\/api\/agent\/web-session\/kick/);
  assert.match(worker, /verifyAgentControlProof\(env, operator/);
  assert.match(worker, /expected_generation: generation/);
  assert.match(core, /\/auth\/revoke-web-session/);
  assert.match(core, /web_session_generation = web_session_generation \+ 1/);
  assert.match(core, /WEB_SESSION_CHANGED_OR_ENDED/);
  assert.match(worker, /closeUserRealtime\(env, target, "WEB", "session-kicked", generation\)/);
  assert.match(source("service/src/read-model-core.ts"), /attachment.session_generation \|\| 0/);
  assert.match(web, /event\.reason === "session-kicked"/);
  assert.match(web, /clearSession\(\)/);
});

test("Remote Agent commands are scope-limited, password-protected, and one-time exact-target", () => {
  assert.match(worker, /"admin", "tamnv2", "vps"/);
  assert.match(worker, /privilegedLoginName\(operator\)/);
  assert.match(worker, /\/api\/agent\/remote-control\/issue/);
  assert.match(worker, /\/api\/agent\/remote-control\/claim/);
  assert.match(worker, /verifyAgentControlProof\(env, operator/);
  assert.match(core, /\/agent-remote\/issue/);
  assert.match(core, /\/agent-remote\/claim/);
  assert.match(core, /target_agent_user_id\.toLowerCase\(\) !== claimant\.toLowerCase\(\)/);
  assert.match(worker, /claimant_user_id: privilegedLoginName\(operator\)/);
  assert.match(core, /AGENT_COMMAND_WRONG_TARGET/);
  assert.match(core, /AGENT_COMMAND_EXPIRED_OR_CONSUMED/);
  assert.match(agent, /if \(expectedAction == "LOGOUT_USER"\) LogoutAgent\(\)/);
  assert.match(agent, /AgentRuntimeGuard\.MarkPlannedExit\(\)/);
  assert.match(agent, /ShowE185RemoteAgentChoice/);
  assert.match(projector, /remote_agent_commands_json/);
  assert.match(sync, /RemoteAgentCommandsJson/);
});

test("Roster separates four personnel fields, hides technical and sizes Supra buttons", () => {
  for (const name of ["D173SummaryContractor", "D173SummaryEmployee", "D173SummaryName", "D173SummaryRole"]) {
    assert.match(agent, new RegExp(name));
    assert.match(layout, new RegExp(name));
  }
  assert.match(agent, /_d173RosterTech\.Visible = false/);
  assert.match(layout, /_background, _agentExit/);
  assert.match(layout, /TextRenderer\.MeasureText\(button\.Text/);
  assert.match(host, /StartPosition = FormStartPosition\.CenterScreen/);
  assert.doesNotMatch(host, /Location = new System\.Drawing\.Point\(-32000, -32000\)/);
});

test("Reporter shift logout remains PDA-only backlog, not modified in E185", () => {
  const doc = source("docs/D173_E185_AGENT184_FIELD_WEB_ROSTER_REMOTE_CONTROL_2026-11-11.md");
  assert.match(doc, /chỉ PDA/);
  assert.match(doc, /không áp dụng Web/);
  assert.match(doc, /không sửa `android\/`/);
});
