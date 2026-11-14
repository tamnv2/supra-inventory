import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(join(ROOT, "web/package.json"));
const { chromium } = webRequire("playwright");
const read = path => readFileSync(join(ROOT, path), "utf8");
const imports = [...read("web/src/operational-app.ts").matchAll(/^import "([^"]+\.css)";/gm)].map(m => m[1]);
const css = imports.map(path => readFileSync(path.startsWith("./") ? join(ROOT, "web/src", path) : webRequire.resolve(path), "utf8")).join("\n");
const panel = '<article class="ops-panel"><div class="ops-panel-title"><h3>Thông tin</h3></div><div>Nội dung</div></article>';
const pages = [
  ["operations", "ops-business-workspace", '<div class="d173-ops-toolbar"><div class="workspace-tabs"><button class="workspace-tab">Đang xử lý</button></div></div>' + panel],
  ["dashboard", "report-workspace d173-dashboard d173-dashboard-triage",
    '<div class="d173-overview-content"><div class="d173-overview-kpis"><article class="d173-overview-kpi">KPI</article></div><article class="d173-overview-panel"><header>Tổng quan</header><p>Thông tin</p></article></div>'],
  ["shift", "ops-route tools-workspace",
    '<section class="business-summary-grid"><article class="business-summary-card">Ca</article></section>' +
    '<div class="business-page-head"><h2>Giờ nghỉ</h2></div>' +
    '<article class="ops-panel shift-history-panel"><div class="ops-panel-title"><h3>Lịch sử ca</h3></div>Nội dung</article>'],
  ["sku", "ops-route sku-workspace", '<div class="business-summary-grid">SKU</div>' + panel],
  ["users", "ops-route users-workspace",
    '<div class="workspace-tabs users-mode-tabs"><button class="workspace-tab">Danh sách</button></div>' +
    '<div class="users-top-grid"><article class="ops-panel users-filter-panel">Bộ lọc</article></div>' +
    '<article class="ops-panel ops-users-panel">Người dùng</article>'],
  ["sla", "ops-route sla-workspace", '<div class="business-page-head"><h2>Thời gian</h2></div>' + panel],
  ["logs", "ops-route logs-workspace", '<div class="workspace-tabs"><button class="workspace-tab">Log Web</button></div>' + panel],
  ["tools", "ops-route tools-workspace", '<div class="business-page-head"><h2>Công cụ</h2></div>' + panel],
  ["reset", "ops-route reset-workspace", '<div class="business-page-head"><h2>Đặt lại</h2></div>' + panel],
];
const shell = (markup, role, theme) => '<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>' +
  css + '</style></head><body data-role="' + role + '" data-theme="' + theme + '">' +
  '<div class="app-shell d173-tabler-shell"><header class="topbar d173-tabler-navbar">SUPRA</header>' +
  '<nav class="tabs d173-tabler-sidebar">Menu</nav><main class="content main d173-page-content">' +
  markup + '</main><footer class="app-footer">Footer</footer></div></body></html>';

test("E270 Smart Lazy: remove genuine duplicate declarations without a new stylesheet", () => {
  assert.equal(imports.length, 18, "Do not add another CSS import");
  const local = imports.slice(1).map(path => read("web/src/" + path.slice(2))).join("\n");
  assert.ok((local.match(/!important/g) || []).length < 1392, "CSS override count should fall");
  assert.match(read("web/src/legacy-transplant/web-professional-v2.css"), /\.ops-panel \{ padding: 8px 10px !important; \}/);
  assert.doesNotMatch(read("web/src/legacy-transplant/web-unified-ui.css"), /\.ops-panel \{ padding: 16px !important; \}/);
  assert.equal(JSON.parse(read("web/package.json")).version, "3.3.23");
});

test("E270: nine workspaces share actual computed layout on HD/HD+ without changing route-specific scroll", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1366, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      for (const role of ["ADMIN", "ADMIN_INVENT"]) {
        for (const theme of ["light", "dark"]) {
          for (const [name, cls, markup] of pages) {
            await page.setContent(shell('<section class="' + cls + '">' + markup + '</section>', role, theme));
            const g = await page.evaluate(() => {
              const main = document.querySelector(".d173-page-content");
              const root = main.firstElementChild;
              const computed = el => getComputedStyle(el);
              const children = [...root.children].filter(el => computed(el).display !== "none");
              const bounds = children.map(el => el.getBoundingClientRect());
              const box = root.querySelector(".ops-panel");
              const title = root.querySelector(".ops-panel-title");
              const dashboard = root.querySelector(".d173-overview-content");
              const history = root.querySelector(".shift-history-panel");
              return {
                inset: parseFloat(computed(main).paddingLeft),
                gap: parseFloat(computed(root).rowGap),
                between: bounds.slice(1).map((b, i) => b.top - bounds[i].bottom),
                panelPadding: box && [parseFloat(computed(box).paddingTop), parseFloat(computed(box).paddingLeft)],
                titleMargin: title && parseFloat(computed(title).marginBottom),
                overviewInset: dashboard && parseFloat(computed(dashboard).paddingTop),
                historyMargin: history && parseFloat(computed(history).marginTop),
                overflowX: document.documentElement.scrollWidth > innerWidth + 1,
              };
            });
            const caseName = name + " " + role + " " + theme + " @" + width;
            assert.equal(g.inset, 6, caseName + " inset");
            assert.equal(g.overflowX, false, caseName + " horizontal overflow");
            if (name !== "operations" && name !== "dashboard") {
              assert.equal(g.gap, 6, caseName + " stack gap");
              for (const v of g.between) assert.ok(Math.abs(v - 6) < 1, caseName + " child gap " + v);
              assert.deepEqual(g.panelPadding, [8, 10], caseName + " panel padding");
            }
            if (name === "operations") assert.deepEqual(g.panelPadding, [6, 4], caseName + " compact operations padding");
            if (name === "dashboard") assert.equal(g.overviewInset, 0, caseName + " dashboard inset");
            if (name === "shift") assert.equal(g.historyMargin, 0, caseName + " history no double margin");
            if (g.titleMargin !== null) assert.equal(g.titleMargin, 6, caseName + " title gap");
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
