import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("Web returns to pre-E036 Tabler 3.2 presentation without losing operational markup", () => {
  const op = read("web/src/operational-app.ts");
  const css = read("web/src/d173-tabler.css");
  assert.match(op, /import "\.\/d173-tabler\.css";/);
  assert.doesNotMatch(op, /import "\.\/d173-e036-unified-design\.css";/);
  assert.match(op, /<main id="content" class="content main d173-page-content"/);
  for (const selector of [".d173-tabler-shell", ".d173-tabler-sidebar", ".d173-page-content", ".nav-button"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(read("web/src/web-version.ts"), /WEB_VERSION = "3\.3\.1"/);
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
