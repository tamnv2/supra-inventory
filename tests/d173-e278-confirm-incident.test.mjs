import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import ts from "../service/node_modules/typescript/lib/typescript.js";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("service/src/d173-confirm-incident.ts");
const translated = ts.transpileModule(
  source.replace(/^import \{ getServiceAccountAccessToken \} from "\.\/hr-source";\s*$/m, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { decideIncident, buildConfirmIncidentMail } =
  await import("data:text/javascript;base64," + Buffer.from(translated).toString("base64"));
const id1 = "a".repeat(32), id2 = "b".repeat(32);
const now = Date.parse("2026-11-16T10:00:00Z");

test("reproduces deduplicated PRIMARY outage across repeated requests and standby Agents", () => {
  const first = decideIncident(null, "FAILED", id1, now);
  assert.equal(first.status, "CLAIMED");
  assert.equal(first.shouldSend, true);
  for (const id of [id1, id2, id1]) {
    const repeated = decideIncident(first.state, "FAILED", id, now + 50_000);
    assert.equal(repeated.status, "SUPPRESSED_ACTIVE_INCIDENT");
    assert.equal(repeated.shouldSend, false);
  }
  const sent = decideIncident(first.state, "SENT", id1, now + 1000);
  assert.equal(sent.state.delivery, "SENT");
  assert.equal(decideIncident(sent.state, "FAILED", id2, now + 400_000).shouldSend, false);
});

test("fails closed on duplicate receipt, network send failure and false recovery", () => {
  const claim = decideIncident(null, "FAILED", id1, now).state;
  const failed = decideIncident(claim, "FAILED_SEND", id1, now + 1000);
  assert.equal(failed.state.delivery, "FAILED");
  assert.equal(decideIncident(failed.state, "FAILED", id1, now + 60000).shouldSend, false);
  assert.equal(decideIncident(claim, "SENT", id2, now).status, "STALE_RECEIPT");
  assert.equal(decideIncident(claim, "RECOVERED", id1, now + 50000, 290000).status, "NOT_REARMED");
});

test("re-arms after five minutes stable confirmation, suppresses flapping, then permits new outage", () => {
  const claim = decideIncident(null, "FAILED", id1, now).state;
  const recovered = decideIncident(claim, "RECOVERED", id2, now + 301000, 301000);
  assert.equal(recovered.status, "REARMED");
  assert.equal(recovered.state.active, false);
  assert.equal(decideIncident(recovered.state, "FAILED", id2, now + 10000).shouldSend, false);
  assert.equal(decideIncident(recovered.state, "FAILED", id2, now + 302000).shouldSend, true);
});

test("approved one-template subject/body preserves precise session-vs-functional cause", () => {
  const exp = buildConfirmIncidentMail({
    incidentId:id1, machine:"VPS", reason:"SESSION_EXPIRED",
    standby:"NOT_TRANSFERRED", atMs:now,
  });
  const broken = buildConfirmIncidentMail({
    incidentId:id1, machine:"VPS", reason:"WEB_CONFIRM_UNAVAILABLE",
    standby:"NO_READY_STANDBY", atMs:now,
  });
  assert.equal(exp.subject, "[SUPRA 1291] CẢNH BÁO: Agent chính không thể confirm PickList");
  assert.match(exp.body, /Phiên Supra hết hạn/);
  assert.match(broken.body, /Web không khả dụng dù phiên còn hiệu lực/);
  assert.match(broken.body, /Không có Agent khả dụng/);
  assert.match(exp.body, /16\/11\/2026 17:00:00/);
  assert.ok(!exp.body.includes("@"));
});

test("Web still logged in but empty after real failed searches enters bounded HA safely", () => {
  const agent = read("relay-agent/D173E278ConfirmIncident.cs");
  const pipeline = read("relay-agent/D160ConfirmPipeline.cs");
  const app = read("relay-agent/Program.cs");
  const browser = read("relay-agent/SupraConfirmBrowser.cs");
  assert.match(agent, /_e278EmptySearchStrikes >= 2 && !_e278ConfirmDegraded/);
  assert.match(agent, /if \(!search\.SearchClicked\) return false;/);
  assert.match(agent, /_e278LastNonEmptyMs <= 0/);
  assert.match(agent, /_e278LastEmptySearchMs > 60000/);
  assert.match(pipeline, /SearchMany\(eligible\.Select\(work => work\.Suffix\), true, false, true, 4000\)/);
  assert.match(pipeline, /var e278Degraded = E278ObserveSearch\(search, eligible\.Count > 0\)/);
  assert.match(pipeline, /search.PicklistCodeCount == 0 && search.SearchClicked &&/);
  assert.match(pipeline, /E278HasRecentPopulatedView\(\)/);
  assert.match(pipeline, /E278HasReadyStandby\(\)/);
  assert.match(pipeline, /WMS_DATA_UNAVAILABLE"\)\) outcome\.ShouldAck = false/);
  assert.match(app, /return _supraBrowserReady && !_e278ConfirmDegraded/);
  assert.match(app, /return _d173E140WebUnavailable \|\| _e278ConfirmDegraded/);
  assert.match(browser, /_emptyDataRecoveryUsed = true/);
  assert.match(pipeline, /retry_final_click=DENIED/);
});

test("Agent194 uses only its protected OTA; generic publisher cannot mutate Host14", () => {
  const generic = read(".github/workflows/verify-relay-agent.yml");
  const dedicated = read(".github/workflows/d173-e278-agent194-ota.yml");
  const firestore = read(".github/workflows/deploy-beta-firestore.yml");
  assert.match(generic, /D173-E278_AGENT194_CONFIRM_INCIDENT_PROD_RELEASE:/);
  assert.match(firestore, /D173-E278_AGENT194_CONFIRM_INCIDENT_PROD_RELEASE:/);
  assert.match(dedicated, /D173-E278_AGENT194_CONFIRM_INCIDENT_PROD_RELEASE:/);
  assert.match(dedicated, /previous.tag -ne 'relay-agent-v193'/);
  assert.match(dedicated, /host.host_build -ne 14/);
  assert.match(dedicated, /E278_WORKER_SAME_SHA_RELEASE_VERIFIED/);
});

test("incident email only after authentication and recent real PRIMARY lease", () => {
  const web = read("service/src/index.ts");
  const core = read("service/src/core.ts");
  assert.match(web, /POST" && url\.pathname === "\/api\/agent\/d173\/confirm-incident"/);
  assert.match(web, /requireAgentUser\(request, env, \["ADMIN", "PICKPACK_ADMIN"\]\)/);
  assert.match(web, /verifyIncidentReporter\(env, instance, generation\)/);
  assert.match(web, /if \(!claim\.should_send\)/);
  assert.match(web, /sendProjectEmail\(env, PROJECT_ADMIN_EMAIL, message\.subject, message\.body\)/);
  assert.match(core, /handleD173ConfirmIncidentCore\(this\.state, request\)/);
  assert.match(source, /state\.storage\.transactionSync/);
  assert.ok(!source.includes("tam95.supra@gmail.com"), "no duplicate Owner address in new source");
});

test("transient incident transport failure retries without additional scheduled polls or duplicate mail", () => {
  const agent = read("relay-agent/D173E278ConfirmIncident.cs");
  assert.match(agent, /_e278AlertAttempts >= 3/);
  assert.match(agent, /now - _e278LastAlertAttemptMs < 60000/);
  assert.match(agent, /E278PostIncident\("FAILED", incidentId, generation, reason, standby, 0L\)/);
  assert.match(agent, /_e278IncidentReported = false;/);
  assert.match(agent, /Worker global claim suppresses duplicate sends/);
  const claimed = decideIncident(null, "FAILED", id1, now);
  const repeat = decideIncident(claimed.state, "FAILED", id1, now + 61000);
  assert.equal(repeat.shouldSend, false);
  assert.equal(repeat.status, "SUPPRESSED_ACTIVE_INCIDENT");
});
