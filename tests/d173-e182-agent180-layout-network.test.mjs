import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(p, "utf8");
const form=read("relay-agent/Program.cs");
const layout=read("relay-agent/D173E179OverviewNoScroll.cs");
const roster=read("relay-agent/D119AgentFeatures.cs");
const network=read("relay-agent/D173E175NetworkCapability.cs");
const auth=JSON.parse(read("ops/d173-e182-agent180-release-authorization.json"));

test("E182 Agent180 Owner scoped source, D172/Stable/provider isolation", () => {
  assert.equal(read("relay-agent/VERSION").trim(),"180");
  assert.match(read("relay-agent/AgentConfig.cs"), /AgentBuild = 180;/);
  assert.ok(read("relay-agent/SupraInventoryRelayAgent.csproj").includes("0.180.0.0"));
  assert.equal(auth.owner_code_approved,true);
  assert.equal(auth.owner_protected_release_approved,true);
  assert.deepEqual(auth.approved_components,["agent"]);
  for(const k of ["d172_mutation","stable_mutation","service_mutation",
    "web_mutation","android_mutation","worker_mutation","firestore_mutation",
    "host_mutation","confirm_business_mutation"])
    assert.equal(auth[k],false,k);
});
test("40/60 overview, 50/50 responsive internal Web/PickList", () => {
  assert.ok(form.includes("new RowStyle(SizeType.Percent, 40F)"));
  assert.ok(form.includes("new RowStyle(SizeType.Percent, 60F)"));
  assert.ok(layout.includes("overview.RowStyles[0].Height = 40F;"));
  assert.ok(layout.includes("overview.RowStyles[1].Height = 60F;"));
  assert.ok(layout.includes("middle.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));"));
  assert.ok(layout.includes("middle.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));"));
  assert.ok(layout.includes("viewport.AutoScroll = false;"));
  assert.ok(layout.includes("_agentFleetGrid.ScrollBars = ScrollBars.None;"));
  assert.ok(layout.includes("_manualPicklistGrid.ScrollBars = ScrollBars.None;"));
});
test("Agent & Web details wrap instead of ellipsis, dynamic Y positions", () => {
  for(const token of ["D173E182FitAgentHeader","_agentCardTitle.AutoEllipsis = false",
    "_relay.AutoEllipsis = false","_d128AgentResourceStatus.AutoEllipsis = false",
    "_supraCardTitle.AutoEllipsis = false","label.AutoEllipsis = false",
    "TextFormatFlags.WordBreak","resourceTop + resourceHeight + 5",
    "var lineTop = progressTop + 7"])
    assert.ok(layout.includes(token),token);
  assert.match(layout, /var contentBottom = D173E182FitAgentHeader\(host\)/);
  assert.match(layout, /_afterHoursPanel.Bottom \+ 5/);
  assert.match(layout, /var gridTop = contentBottom \+ 5/);
});
test("Agent177 one-row session controls when width fits, two-row if narrow", () => {
  assert.ok(roster.includes("var singleRow = width >= required;"));
  assert.ok(roster.includes("var toolbarHeight = singleRow ? 32 : 68;"));
  assert.ok(roster.includes("SetD173BoundsIfChanged(actions[i], x, 1"));
  assert.ok(roster.includes("SetD173BoundsIfChanged(actions[i], x, 36"));
  assert.ok(roster.includes("D173RosterSearchCaption"));
  assert.ok(roster.includes("var gridTop = searchTop + 35;"));
  assert.ok(layout.includes("grid.ScrollBars = ScrollBars.Vertical;"));
  for(const t of ["_d173E148ManualRefreshButton","_d173E140CloseAllCalls",
    "_d168GroupContact","_d161BulkKickAllButton","_d173RosterTech"])
    assert.ok(roster.includes(t),t);
});
test("4 verified network labels and UNKNOWN fallback, existing probes only", () => {
  for(const t of ["Bình thường","Chỉ truy cập được Firebase",
    "Chỉ truy cập được Cloudflare","Không truy cập được",
    "Chưa xác định"])assert.ok(network.includes(t),t);
  for(const t of ['firestore == "READY" && worker == "READY" ? "FULL"',
    'firestore == "READY" && worker == "NETWORK_UNREACHABLE" ? "OFFICE"',
    'firestore == "UNREACHABLE" && worker == "READY" ? "RESTRICTED"',
    'firestore == "UNREACHABLE" && worker == "NETWORK_UNREACHABLE" ? "UNAVAILABLE" : "UNKNOWN"'])
    assert.ok(network.includes(t),t);
  assert.ok(network.includes("D168NetworkRoute.ProbeWorker(session.IdToken)"));
  assert.ok(network.includes("FirestoreHttpTransport.SendJson"));
  assert.equal(auth.no_new_provider_requests,true);
});
test("verified Cloudflare gating only for update/SKU, never PickList", () => {
  const start=form.indexOf("private void D173E159ApplyOfficeCapabilityUi()");
  const end=form.indexOf("private void QueueWatchdogRefresh()",start);
  assert.ok(start>0 && end>start);
  const fn=form.slice(start,end);
  assert.ok(fn.includes("_d173E175ClassificationVerified && !_d173E175WorkerVerified"));
  assert.ok(fn.includes("_d167SkuPage.Enabled = !verifiedBlocked;"));
  assert.ok(fn.includes("_manualUpdate.Enabled = !verifiedBlocked"));
  assert.ok(fn.includes("_d173E182CapabilityTip.SetToolTip(_manualUpdate"));
  assert.ok(fn.includes("_d173E182CapabilityTip.SetToolTip(_d167SkuPage"));
  assert.doesNotMatch(fn,/_manualPicklist|ConfirmManualPicklist|_pickerOnlineGrid|_agentSync/);
  assert.ok(form.includes("Task.Run(() => ConfirmManualPicklist(code))"));
});
