import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const webRequire = createRequire(join(ROOT, "web/package.json"));
const { chromium } = webRequire("playwright");
const read = path => readFileSync(join(ROOT, path), "utf8");
const ts = read("web/src/operational-app.ts");
const imports = [...ts.matchAll(/^import "([^"]+\.css)";/gm)].map(match => match[1]);
const css = imports.map(path => path.startsWith("./") ? read("web/src/" + path.slice(2)) : readFileSync(webRequire.resolve(path), "utf8")).join("\n");

test("E283 real Inventory APIs and role controls remain, preview has no mock business data", () => {
  assert.equal(imports.at(-1), "./d173-inventory-preview.css");
  for (const contract of [
    "function canAccessSection(", "function renderOperations(", "function renderFastDetail(",
    "getReporterQueue(", "resolveReporterBatch(", "createPickerReport(", "registerRealtimeApplier(",
    'id="theme-mode"', 'id="root-role-select"', 'id="logout"',
    'id="inventory-menu-toggle"', 'id="inventory-accent-color"',
    'class="inventory-nav-scroll">${renderNav()}', 'data-select-batch="${esc(row.batch_id)}"',
    'id="service-state"', 'id="realtime-state"', 'id="last-web-update"'
  ]) assert.ok(ts.includes(contract), contract + " preserved");
  assert.match(ts, /function previewSectionTitle\(section: Section\)/);
  assert.match(ts, /class="fast-list-heading"/);
  assert.doesNotMatch(ts, /data-shell-generation="legacy-direct-transplant"/);
  assert.doesNotMatch(read("web/src/d173-inventory-preview.css"), /url\(https?:\/\//);
});

const nav = '<div class="inventory-side-brand"><div class="inventory-brand-mark">S</div><div class="inventory-brand-lines"><strong>CÔNG TY CỔ PHẦN THE SUPRA</strong><small>DC HƯNG YÊN</small></div></div>' +
  '<div class="inventory-side-app"><strong>1291 Báo hàng</strong><small>Kho HY1</small></div>' +
  '<div class="inventory-nav-scroll"><span class="nav-section-label">VẬN HÀNH</span><button class="nav-button active"><svg class="nav-icon"></svg><span>Xử lý báo hàng</span></button></div>' +
  '<div class="inventory-side-footer"><div class="header-runtime"><span data-state="on">Dịch vụ sẵn sàng</span></div><footer class="app-footer">tamnv2</footer></div>';

const operations = '<section class="ops-business-workspace"><div class="d173-ops-toolbar"><div class="workspace-tabs"><button class="workspace-tab active">Đang xử lý</button><button class="workspace-tab">Quá hạn</button></div></div>' +
  '<div class="business-summary-grid"><article class="business-summary-card">Đang chờ 12</article></div>' +
  '<div class="fast-workspace"><div class="fast-list"><div class="fast-list-heading"><span>SKU</span><span>Tên sản phẩm</span><span>Picker</span><span>Thời gian báo</span><span>Trạng thái</span></div>' +
  '<button class="fast-issue-row selected"><span class="fast-sku">893100001000</span><span class="fast-product">Bột giặt</span><span class="fast-picker-count">1 Picker</span><time class="fast-reported-at">17:50</time><span class="fast-meta"><b class="fast-status">Đang xử lý</b></span></button></div>' +
  '<aside class="fast-detail"><div class="fast-detail-head">Chi tiết</div><dl class="fast-facts"><div><dt>Picker</dt><dd>1</dd></div></dl><div class="fast-actions"><button>Đã có hàng</button></div></aside></div></section>';

const fixture = (theme, content=operations) => '<!doctype html><html lang="vi"><meta charset="utf-8"><style>' + css + '</style>' +
  '<body data-role="ADMIN" data-theme="' + theme + '" data-inventory-accent="coral"><div class="app-shell d173-tabler-shell d173-inventory-preview role-admin">' +
  '<nav class="tabs d173-tabler-sidebar">' + nav + '</nav>' +
  '<header class="topbar d173-tabler-navbar"><strong class="inventory-current-title">Xử lý báo hàng</strong><div class="inventory-top-actions"><time class="inventory-clock">05:57:44 PM</time>' +
  '<details class="inventory-user-menu"><summary class="inventory-user-trigger">Quản trị viên</summary><div class="inventory-user-panel">Cài đặt</div></details></div></header>' +
  '<main class="content main d173-page-content">' + content + '</main><button class="inventory-sidebar-backdrop">Đóng</button><div id="overlay-root"></div></div></body></html>';

test("E283 Chromium shell matches approved dark navigation, content layout and responsive mode", async () => {
  const browser = await chromium.launch({ headless:true });
  try {
    for (const width of [390, 1280, 1366, 1920]) for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport:{ width, height:900 } });
      await page.setContent(fixture(theme));
      const ui = await page.evaluate(() => {
        const el = selector => document.querySelector(selector);
        const style = selector => getComputedStyle(el(selector));
        return {
          sidebar:style(".d173-tabler-sidebar").backgroundColor,
          sidebarWidth:el(".d173-tabler-sidebar").getBoundingClientRect().width,
          sidebarTransform:style(".d173-tabler-sidebar").transform,
          header:style(".d173-tabler-navbar").backgroundColor,
          main:style(".d173-page-content").backgroundColor,
          tableCols:style(".fast-list-heading").gridTemplateColumns.split(" ").length,
          pageOverflow:document.documentElement.scrollWidth > innerWidth+1,
          menu:el(".inventory-user-menu") !== null,
          sku:el(".fast-sku").textContent
        };
      });
      const prefix = theme + " @" + width;
      assert.equal(ui.sidebar, theme==="light"?"rgb(35, 38, 40)":"rgb(17, 22, 28)", prefix+" sidebar");
      assert.equal(ui.sidebarWidth,254,prefix+" width");
      assert.equal(ui.menu,true,prefix+" account access");
      assert.equal(ui.tableCols,5,prefix+" 5 verified live queue columns");
      assert.equal(ui.sku,"893100001000",prefix+" SKU");
      assert.equal(ui.pageOverflow,false,prefix+" no body horizontal overflow");
      if (width < 781) assert.notEqual(ui.sidebarTransform,"none",prefix+" mobile drawer closed");
      else assert.equal(ui.sidebarTransform,"none",prefix+" desktop sidebar visible");
      await page.close();
    }
  } finally { await browser.close(); }
});
