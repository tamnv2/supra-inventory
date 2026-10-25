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
  assert.match(agent, /SizeType.Percent, 62F/);
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
  assert.match(theme, /ApplyD173ColorsRecursively\(this, dark\)/);
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
