import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const agent = read("relay-agent/Program.cs");
const leader = read("relay-agent/FirestoreAgentLeaderCoordinator.cs");
const browser = read("relay-agent/SupraConfirmBrowser.cs");
const monitor = read("relay-agent/D173E141VpsWebMonitor.cs");
const host = read("relay-agent-webview2-host/Program.cs");
const bundle = read("relay-agent/AgentBrowserBundle.cs");
const hostProject = read("relay-agent-webview2-host/SupraInventoryWebView2Host.csproj");
const config = read("relay-agent/AgentConfig.cs");

test("E141 Agent167 + owned WebView2 Host12 have distinct bump and no new WMS session", () => {
  assert.equal(read("relay-agent/VERSION").trim(), "167");
  assert.match(config, /AgentBuild = 167;/);
  assert.match(read("relay-agent/SupraInventoryRelayAgent.csproj"), /0\.167\.0\.0/);
  assert.match(bundle, /RequiredHostBuild = 12;/);
  assert.match(hostProject, /1\.0\.12\.0/);
  assert.match(host, /CoreWebView2Environment\.CreateAsync/);
  assert.match(host, /_skuExportWeb = skuChild/);
  assert.doesNotMatch(browser, /Network\.enable/);
});

test("single HA lease writer is scheduled outside blocking role+presence loop", () => {
  assert.match(leader, /Task\.Run\(\(\) => E141LeaseLoop\(token\), token\)/);
  assert.match(leader, /private void E141LeaseLoop\(CancellationToken token\)/);
  assert.match(leader, /lock \(_e141LeaseWriteGate\)/);
  assert.match(leader, /Interlocked\.Exchange\(ref _lastLeaseWriteMs, 0\)/);
  assert.match(leader, /expectedGeneration/);
  assert.match(leader, /string\.Equals\(_generation, expectedGeneration, StringComparison\.Ordinal\)/);
  assert.match(leader, /E141LogFailure/);
  assert.match(leader, /_vpsReclaim\.PublishReady/);
  const coordinatorCycle = leader.slice(leader.indexOf("private void Loop("), leader.indexOf("private void RefreshRole("));
  assert.doesNotMatch(coordinatorCycle, /WritePrimaryLease\(session\)/);
  assert.doesNotMatch(coordinatorCycle, /_vpsReclaim\.PublishReady\(session/);
  assert.match(leader, /FailoverAfterMs = 15000;/);
  assert.match(leader, /PrimaryLeaseHeartbeatMs = 10000;/);
  assert.match(leader, /VerifyPrimaryBeforeMutation/);
  assert.match(leader, /MUTATION_FENCE_CHANGED/);
});

test("host-native input shield blocks physical input while keeping CDP automation", () => {
  assert.match(host, /InputShieldMessage = 0x8000 \+ 0x341/);
  assert.match(host, /_inputProtected = true/);
  assert.match(host, /view\.Enabled = !_inputProtected/);
  assert.match(host, /_web\.Enabled = !_inputProtected/);
  assert.match(host, /protected override bool ProcessCmdKey/);
  assert.match(browser, /SendMessageTimeout\(/);
  assert.match(browser, /HOST_COMMAND_UNAVAILABLE/);
  assert.match(browser, /SetAgentInputProtected\(bool protect\)/);
  assert.match(agent, /ToggleE141BrowserInput\(\)/);
  assert.match(monitor, /VerifyCurrentAgentPasswordForBrowserAction/);
  assert.doesNotMatch(host, /ex\.Message/);
});

test("browser stays visible, no reparenting on tab switch and no new profile", () => {
  const background = browser.slice(browser.indexOf("internal SupraBrowserState OpenAgentBackground()"), browser.indexOf("internal bool IsAgentOwnedMode()"));
  assert.match(background, /SetAgentInputProtectionNoLock\(true\)/);
  assert.match(background, /ShowNoLock\(\)/);
  assert.doesNotMatch(background, /SetBrowserWindowsVisibleNoLock\(false\);\s*_hidden = true;\s*_log\("SUPRA_BROWSER direct_confirm/);
  const changeTab = agent.slice(agent.indexOf("_mainTabs.SelectedIndexChanged +="), agent.indexOf("var footer = new Panel", agent.indexOf("_mainTabs.SelectedIndexChanged +=")));
  assert.doesNotMatch(changeTab, /_supraBrowser\.Hide\(\)/);
  const embedded = agent.slice(agent.indexOf("private void SizeEmbeddedWmsViewport()"), agent.indexOf("private void ToggleSupraBrowserVisibility()"));
  assert.doesNotMatch(embedded, /TryEmbedAgentWindow\(/);
  assert.match(embedded, /_supraBrowser\.Show\(\)/);
  assert.match(browser, /webview2-fixed-profile/);
});

test("VPS monitor is enrolled, opt-in, sanitized and uses only existing Agent bundle", () => {
  for (const marker of [
    "FirestoreVpsReclaim.IsVps", "ProtectedData.Protect", "ProtectedData.Unprotect",
    "E141MachineBinding", "E141ReadOptIn", "E141ToggleWebMonitor",
    "E141ObserveWeb", "AgentDiagnostics.Write", "SampleResourceUsage",
    "DataHydrated", "PicklistCodeCount", "E141StateClass"
  ]) assert.ok(monitor.includes(marker), "missing " + marker);
  assert.match(agent, /E141ObserveWeb\(state\)/);
  assert.match(agent, /E141InitWebMonitorButton\(\)/);
  assert.doesNotMatch(monitor, /HttpClient|WebRequest|FirestoreClient|DriveClient|File\.AppendAllText|localStorage|cookie|document\.cookie/);
  assert.match(read("relay-agent/AgentLogUploadBridge.cs"), /AgentDiagnostics\.BuildUploadSnapshot/);
  assert.match(read("relay-agent/Program.cs"), /AppendSnapshotStream\(builder, "AGENT_COMPLETE"/);
});
