import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const form = read("relay-agent/Program.cs");
const arrow = "m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z";

function dashboardScript() {
  const start = browser.indexOf("private string BuildDashboardAccessClickScript()");
  assert.ok(start >= 0);
  const match = browser.slice(start).match(/return @"([\s\S]*?)";/);
  assert.ok(match);
  return match[1].replace('" + arrowJson + @"', JSON.stringify(arrow));
}

function fakeDashboard(labels) {
  const paths = [];
  const clicked = [];
  const root = { offsetWidth: 1, innerText: labels.join(" "), textContent: labels.join(" "),
    parentElement: null, querySelectorAll: () => paths };
  for (const [index, label] of labels.entries()) {
    const card = { offsetWidth: 1, innerText: label, textContent: label,
      parentElement: root, querySelectorAll: () => [paths[index]] };
    const button = { offsetWidth: 1, disabled: false, innerText: "", textContent: "",
      parentElement: card, getAttribute: () => null, focus() {}, click() { clicked.push(index); } };
    const svg = { offsetWidth: 1 };
    const path = { getAttribute: name => name === "d" ? arrow : null,
      closest: selector => selector === "svg" ? svg : button };
    paths.push(path);
  }
  const document = { querySelectorAll: selector =>
    selector === "path" ? paths : [] };
  return { document, clicked };
}

test("Agent173 keeps the parent form HWND alive when the operator uses tray", () => {
  const hide = form.slice(form.indexOf("private void MinimizeToTray()"),
    form.indexOf("private void RestoreFromTray()"));
  assert.match(hide, /ShowInTaskbar = false;[\s\S]*Hide\(\)/);
  assert.doesNotMatch(hide, /WindowState = FormWindowState\.Minimized;/);
  assert.match(form, /command == 0xF020[\s\S]*MinimizeToTray\(\)/);
  assert.match(form, /D173_E161 TRAY event=HIDDEN/);
  assert.match(form, /D173_E161 TRAY event=VISIBLE/);
});

test("CDP disconnect does not destroy an existing live authenticated Host13", () => {
  const open = browser.slice(browser.indexOf("internal SupraBrowserState OpenAgentBackground()"),
    browser.indexOf("internal bool IsAgentOwnedMode()"));
  assert.match(open, /_process != null && !_process\.HasExited/);
  assert.match(open, /decision=DEFER reason=CDP_DOWN_HOST_ALIVE navigation=NONE/);
  assert.match(open, /State = "CDP_RECONNECTING"/);
  assert.match(browser, /_nextCdpReconnectUtc = now\.AddSeconds\(5\)/);
  assert.match(browser, /reason=EXIT_BACKOFF navigation=NONE/);
  assert.match(browser, /target_changed=/);
  assert.match(browser, /D173_E161 HOST_STOP/);
  assert.match(browser, /D173_E161 HOST_START/);
});

test("Dashboard selector chooses the uniquely scoped HY1 SFT3 card, not the smallest card", () => {
  const mock = fakeDashboard(["Kho Hưng Yên 1 SFT3", "HY2 SFT3", "Kho Hưng Yên 1 SFT2"]);
  const output = JSON.parse(vm.runInNewContext(dashboardScript(), { document: mock.document }));
  assert.equal(output.result, "CLICKED");
  assert.equal(output.reason, "HY1_SFT3_UNIQUE");
  assert.deepEqual(mock.clicked, [0]);
  assert.doesNotMatch(dashboardScript(), /SMALLEST_CARD|min \* 1\.05/);
});

test("Dashboard must fail closed on multiple identical HY1 SFT3 cards", () => {
  const mock = fakeDashboard(["HY1 SFT3", "Kho Hưng Yên 1 SFT3", "HY2 SFT3"]);
  const output = JSON.parse(vm.runInNewContext(dashboardScript(), { document: mock.document }));
  assert.equal(output.result, "TARGET_NOT_UNIQUE");
  assert.equal(output.reason, "HY1_SFT3_AMBIGUOUS");
  assert.deepEqual(mock.clicked, []);
  assert.match(browser, /D173_E161 DASHBOARD_SELECT state=DEFER/);
  assert.match(browser, /TimeSpan\.FromSeconds\(10\)/);
});

test("WMS confirmation readback cannot turn an uncertain click into a second final click", () => {
  const pipeline = read("relay-agent/D160ConfirmPipeline.cs");
  const confirm = read("relay-agent/SupraConfirmBrowserD160.cs");
  assert.match(pipeline, /D173_E161 WMS_OUTCOME classification=/);
  assert.match(pipeline, /CLICKED_RESULT_UNKNOWN/);
  assert.match(pipeline, /retry_final_click=DENIED/);
  assert.match(pipeline, /VerifyExactAlreadyConfirmedReadOnly/);
  assert.match(pipeline, /browser\.Result = "ALREADY_CONFIRMED"/);
  assert.match(confirm, /D173_E093 VERIFY_ONLY/);
  assert.match(confirm, /observed\.AlreadyConfirmedFragments\.Contains\(suffix\)/);
});

test("No new Host13 release or cross-module provider mutation", () => {
  assert.equal(read("relay-agent/VERSION").trim(), "173");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 173;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /0\.173\.0\.0/);
  assert.match(read("relay-agent/AgentBrowserBundle.cs"), /RequiredHostBuild = 13;/);
  assert.match(read("ops/project-scope.json"), /OWNER_GATED/);
});
