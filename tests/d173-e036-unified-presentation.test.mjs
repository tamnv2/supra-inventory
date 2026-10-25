import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("all Web sections share one final design layer, including login and dialogs", () => {
  const op = read("web/src/operational-app.ts");
  const css = read("web/src/d173-e036-unified-design.css");
  assert.match(op, /import "\.\/d173-e036-unified-design\.css";/);
  assert.match(op, /<main id="content" class="content main d173-page-content"/);
  for (const selector of [".login-shell", ".d173-tabler-shell", ".modal-box",
    ".business-summary-card", ".nav-button", ".table-wrap", ".header-controls"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(css, /body\[data-theme="dark"\]/);
  assert.match(css, /max-width: 780px/);
  assert.doesNotMatch(css, /https?:\/\//);
});

test("Agent has app-wide persisted theme, five local histories and roster-focused overview", () => {
  const agent = read("relay-agent/Program.cs");
  const list = read("relay-agent/D119AgentFeatures.cs");
  const performance = read("relay-agent/D173DesktopResources.cs");
  const theme = read("relay-agent/D173E036Theme.cs");
  assert.match(agent, /tabActions.Visible = false/);
  assert.match(agent, /_supraCard\.Controls\.Add\(_toggleWmsTab\)/);
  assert.match(agent, /_toggleWmsTab\.Visible = true/);
  assert.match(agent, /agentCard\.AutoScroll = true/);
  assert.match(agent, /_supraCard\.AutoScroll = true/);
  assert.match(list, /_toggleWmsTab\.SetBounds\(/);
  assert.match(agent, /SizeType.Percent, 60F/);
  assert.match(list, /Danh sách phiên hoạt động/);
  assert.match(performance, /_d173NetworkTrend/);
  for (const resource of ["Cpu", "Gpu", "Ram", "Disk", "Network"]) {
    assert.ok(performance.includes("_d173" + resource + "Trend"), resource);
  }
  assert.doesNotMatch(performance, /_d173DesktopProcess/);
  assert.match(theme, /D173VietnamNight/);
  assert.match(theme, /"AUTO"/);
  assert.match(theme, /"LIGHT"/);
  assert.match(theme, /"DARK"/);
  assert.match(theme, /ApplyD173ColorsRecursively\(form, dark\)/);
  assert.doesNotMatch(theme, /HttpClient|Firestore|WebRequest|Sqlite|WmsConfirm/);
});

test("picker full-screen wake cannot render second result when overlay owns event", () => {
  const wake = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalWakeActivity.kt");
  const svc = read("android/app/src/main/java/cd/cc/supra/inventory/beta/CriticalOverlayService.kt");
  const layout = read("android/app/src/main/res/layout/overlay_alert.xml");
  assert.match(wake, /NotificationSignalStore\.isResultOverlayPresented/);
  assert.match(wake, /shouldRenderFallback\(intent\)/);
  assert.match(svc, /foregroundNotification\(next\.title, next\.body, next\.alertId, transparentWake = true\)/);
  assert.match(svc, /private fun foregroundNotification\(title: String, body: String, alertId: String, transparentWake: Boolean = false\)/);
  assert.match(svc, /finishActive\(userAcknowledged = true\)/);
  assert.match(svc, /recordDisplayedAfterDraw/);
  for (const heading of ["SỬA TRẠNG THÁI", "CHO PHÉP SKIP", "ĐÃ CÓ HÀNG"]) {
    assert.ok(svc.includes(heading), heading);
  }
  assert.match(svc, /Tình trạng sửa:/);
  assert.match(svc, /Người xác nhận:/);
  assert.match(layout, /overlayMessageScroll/);
  assert.match(layout, /btnOverlayAck/);
});

test("no D172 private source is included in this change contract", () => {
  const css = read("web/src/d173-e036-unified-design.css");
  const theme = read("relay-agent/D173E036Theme.cs");
  assert.doesNotMatch(css, /obpp1291|D172/);
  assert.doesNotMatch(theme, /obpp1291|D172/);
});

test("monotonic E036 release requires its own exact source proof and unchanged D172", () => {
  const gate = read("tools/d173_e036_release_gate.py");
  const old = read("tools/d173_e034_release_gate.py");
  const wrapper = read("tools/d167_release_gate.py");
  const cfg = JSON.parse(read("ops/d173-e036-ui-release-authorization.json"));
  assert.equal(cfg.checkpoint,"D173-E036");
  assert.equal(cfg.stable_deploy_permission,false);
  assert.equal(cfg.d172_business_mutation,false);
  assert.equal(cfg.field_pass,false);
  assert.equal(cfg.owner_pass,false);
  assert.equal(cfg.agent_target_version,143);
  assert.equal(cfg.android_target_version_code,120);
  assert.equal(cfg.web_version,"3.3.0");
  for(const marker of ["D173-E036_UI_RELEASE:","protected source/workflow drift",
    "independent D172/Gateway/Rules/resource drift","Agent143 mismatch"]) {
    assert.ok(gate.includes(marker),marker);
  }
  assert.match(wrapper, /d173_e036_release_gate\.py/);
  assert.match(old, /D173-E034_UI_RELEASE:/);
  const worker=read(".github/workflows/deploy-beta.yml");
  const agent=read(".github/workflows/verify-relay-agent.yml");
  const android=read(".github/workflows/verify-apps.yml");
  for(const file of [worker,agent,android]) assert.match(file,/d173_e036_release_gate\.py/);
  assert.match(android,/relay-agent-v143/);
  assert.match(android,/D173 E036 requires vc120/);
});

test("D173-E043 Mẫu 2 palette and readonly session controls", () => {
  const theme = read("relay-agent/D173E036Theme.cs");
  const sidebar = read("relay-agent/D173E038Sidebar.cs");
  const desktop = read("relay-agent/D173DesktopResources.cs");
  const list = read("relay-agent/D119AgentFeatures.cs");
  // Owner-selected colors. Both themes must use the same teal accent.
  for (const rgb of [
    "14, 23, 38", "16, 30, 48", "25, 39, 58",
    "247, 249, 252", "254, 254, 254", "237, 242, 248",
    "0, 142, 136", "228, 236, 247", "37, 56, 80"
  ]) {
    assert.ok(theme.includes("Color.FromArgb(" + rgb + ")"), rgb);
  }
  assert.match(theme, /D173Sample2Colors\(dark\)/);
  assert.match(theme, /D173SetNativeTitleBarTheme\(form, dark\)/);
  assert.match(theme, /\(\(DataGridViewButtonColumn\)column\)\.FlatStyle = FlatStyle\.Flat/);
  assert.match(theme, /cell\.ReadOnly/);
  assert.match(sidebar, /selected \? palette\.Accent : palette\.Sidebar/);
  assert.doesNotMatch(sidebar, /Color\.FromArgb\(36, 116, 216\)/);
  assert.match(desktop, /Color\.FromArgb\(0, 142, 136\)/);
  assert.match(list, /D173Sample2Colors\(D173IsDarkThemeActive\(\)\)\.Disabled/);
  assert.doesNotMatch(list, /\.Style\.BackColor = Color\.Gainsboro/);
});

test("D173-E044 Agent145 release requires dedicated exact-source owner/CI gate", () => {
  const version = read("relay-agent/VERSION").trim();
  const config = read("relay-agent/AgentConfig.cs");
  const project = read("relay-agent/SupraInventoryRelayAgent.csproj");
  const gate = read("tools/d173_e043_agent_release_gate.py");
  const wrapper = read("tools/d167_release_gate.py");
  const workflow = read(".github/workflows/verify-relay-agent.yml");
  const receipt = JSON.parse(read("ops/d173-e043-agent-release-authorization.json"));
  assert.equal(version, "145");
  assert.match(config, /AgentBuild = 145;/);
  assert.match(project, /<AssemblyVersion>0\.145\.0\.0<\/AssemblyVersion>/);
  assert.match(project, /<FileVersion>0\.145\.0\.0<\/FileVersion>/);
  assert.match(gate, /D173-E043_AGENT_ONLY_RELEASE:/);
  assert.match(gate, /"OWNER_EXPLICIT_DEPLOY_APPROVED"/);
  assert.match(gate, /git\("diff", "--quiet", sha, "HEAD", "--", \*PROTECTED\)/);
  assert.match(wrapper, /tools\/d173_e043_agent_release_gate\.py/);
  assert.match(workflow, /D173-E043_AGENT_ONLY_RELEASE:/);
  assert.match(workflow, /tools\/d173_e043_agent_release_gate\.py/);
  assert.equal(receipt.agent_target_version, 145);
  assert.deepEqual(receipt.approved_components, ["agent"]);
  assert.equal(receipt.d172_lifecycle, "PENDING_HOLD");
  assert.equal(receipt.worker_mutation, false);
  assert.equal(receipt.android_mutation, false);
  assert.equal(receipt.stable_deploy_permission, false);
  assert.equal(receipt.field_pass, false);
  assert.equal(receipt.owner_pass, false);
});
