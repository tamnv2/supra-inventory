import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
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
  assert.match(ts, /class="inventory-warning-filter"/);
  assert.match(ts, /resultTabBadgeCounts\.HAS_STOCK/);
  assert.match(ts, /resultTabBadgeCounts\.SKIP_ALLOWED/);
  assert.doesNotMatch(ts, /data-shell-generation="legacy-direct-transplant"/);
  assert.doesNotMatch(read("web/src/d173-inventory-preview.css"), /url\(https?:\/\//);
});

const nav = '<div class="inventory-side-brand"><div class="inventory-brand-mark">S</div><div class="inventory-brand-lines"><strong>CÔNG TY CỔ PHẦN THE SUPRA</strong><small>DC HƯNG YÊN</small></div></div>' +
  '<div class="inventory-side-app"><strong>1291 Báo hàng</strong><small>Kho HY1</small></div>' +
  '<div class="inventory-nav-scroll"><span class="nav-section-label">VẬN HÀNH</span><button class="nav-button active"><svg class="nav-icon"></svg><span>Xử lý báo hàng</span></button></div>' +
  '<div class="inventory-side-footer"><div class="header-runtime"><span data-state="on">Dịch vụ sẵn sàng</span></div><footer class="app-footer">tamnv2</footer></div>';

const operations = '<section class="ops-business-workspace"><div class="d173-ops-toolbar"><div class="workspace-tabs"><button class="workspace-tab active">Đang xử lý</button><button class="workspace-tab">Quá hạn</button></div></div>' +
  '<div class="business-summary-grid queue-summary-grid"><article class="business-summary-card">SKU đang chờ xử lý <strong>12</strong></article><article class="business-summary-card danger">SKU quá hạn <strong>4</strong></article><article class="business-summary-card good">Đã có hàng <strong>5</strong></article><article class="business-summary-card warning">Cho phép Skip <strong>2</strong></article></div><div class="inventory-warning-filter"><button type="button" class="btn small secondary">Sắp quá thời gian: 1</button></div>' +
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



// Representative screenshot fixtures: no credentials, API calls, Production data or fake PASS.
const reviewSections = [
  ["operations", operations],
  ["dashboard", '<section class="report-workspace d173-dashboard"><div class="d173-overview-content"><div class="d173-overview-kpis"><article class="d173-overview-kpi"><strong>12</strong><span>Đang xử lý</span></article><article class="d173-overview-kpi"><strong>4</strong><span>Quá hạn</span></article></div><article class="d173-overview-panel"><header>Tổng quan báo hàng</header><div class="ops-panel">Dữ liệu minh họa bố cục</div></article></div></section>'],
  ["shift", '<section class="ops-route tools-workspace"><div class="business-page-head"><h2>Ca vận hành</h2></div><div class="business-summary-grid"><article class="business-summary-card">Ca 1: 06:00–14:00</article><article class="business-summary-card">Ca 2: 14:00–22:00</article></div><article class="ops-panel shift-history-panel"><div class="ops-panel-title"><h3>Lịch sử ca vận hành</h3></div><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Ca</th></tr></thead><tbody><tr><td>20/11/2026</td><td>Ca 1</td></tr></tbody></table></div></article></section>'],
  ["sku", '<section class="ops-route sku-workspace"><div class="business-page-head"><h2>Danh mục SKU</h2></div><div class="business-summary-grid"><article class="business-summary-card">Danh mục</article></div><article class="ops-panel"><div class="ops-panel-title"><h3>Thông tin SKU</h3></div><div class="table-wrap"><table><thead><tr><th>Mã SKU</th><th>Tên sản phẩm</th></tr></thead><tbody><tr><td>893100001000</td><td>Sản phẩm minh họa</td></tr></tbody></table></div></article></section>'],
  ["users", '<section class="ops-route users-workspace"><div class="workspace-tabs users-mode-tabs"><button class="workspace-tab active">Danh sách</button><button class="workspace-tab">Phân quyền</button></div><div class="users-top-grid"><article class="ops-panel users-filter-panel"><div class="ops-panel-title"><h3>Tìm và lọc tài khoản</h3></div><div class="users-form-grid"><label>Tên nhân sự<input placeholder="Tìm kiếm"></label></div></article></div><article class="ops-panel ops-users-panel"><div class="ops-panel-title"><h3>Danh sách tài khoản</h3></div><div class="table-wrap"><table><thead><tr><th>Mã NV</th><th>Vai trò</th></tr></thead><tbody><tr><td>100</td><td>Picker</td></tr></tbody></table></div></article></section>'],
  ["sla", '<section class="ops-route sla-workspace"><div class="business-page-head"><h2>Thời gian xử lý</h2></div><article class="ops-panel sla-config-panel"><div class="ops-panel-title"><h3>Thiết lập mốc phản hồi</h3></div><div class="ops-settings-grid"><label>Phút cảnh báo<input value="10" readonly></label><label>Quá hạn<input value="15" readonly></label></div></article></section>'],
  ["logs", '<section class="ops-route logs-workspace"><div class="business-page-head"><h2>Nhật ký</h2></div><div class="workspace-tabs"><button class="workspace-tab active">Log Web</button><button class="workspace-tab">Log Agent</button></div><article class="ops-panel"><div class="ops-panel-title"><h3>Sự kiện hệ thống</h3></div><div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Loại</th></tr></thead><tbody><tr><td>17:50</td><td>Minh họa</td></tr></tbody></table></div></article></section>'],
  ["tools", '<section class="ops-route tools-workspace"><div class="business-page-head"><h2>Công cụ</h2></div><article class="ops-panel"><div class="ops-panel-title"><h3>Kiểm tra</h3></div><button type="button" class="btn secondary">Kiểm tra trạng thái</button></article></section>'],
  ["account", '<section class="ops-route account-workspace"><div class="business-page-head"><h2>Tài khoản</h2></div><article class="ops-panel"><div class="ops-panel-title"><h3>Thông tin cá nhân</h3></div><label>Tên hiển thị<input value="Nhân viên mẫu" readonly></label></article></section>']
];

test("E285 responsive interaction and 9-screen visual review artifacts", async () => {
  const browser = await chromium.launch({ headless:true });
  const root = join(ROOT, ".artifacts", "d173-e283-ui-review");
  mkdirSync(root, {recursive:true});
  const pages = [];
  try {
    for (const [section, markup] of reviewSections) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({viewport:{width:1366,height:900}, deviceScaleFactor:1});
        await page.setContent(fixture(theme,markup));
        const state = await page.evaluate(() => {
          const nav = document.querySelector(".d173-tabler-sidebar");
          const header = document.querySelector(".d173-tabler-navbar");
          const main = document.querySelector(".d173-page-content");
          return {
            sidebar:nav.getBoundingClientRect(), header:header.getBoundingClientRect(),
            main:main.getBoundingClientRect(), overflow:document.documentElement.scrollWidth>innerWidth+1,
            cardCount:main.querySelectorAll(".ops-panel,.business-summary-card,.fast-list,.fast-detail,.d173-overview-panel").length
          };
        });
        assert.equal(state.overflow,false,section+" "+theme+" desktop horizontal overflow");
        assert.ok(state.sidebar.width >= 250 && state.sidebar.width <= 260, section+" sidebar width");
        assert.ok(state.main.left >= 250, section+" main left inset");
        assert.ok(state.cardCount > 0, section+" content rendered");
        const file = section+"-"+theme+"-1366.png";
        await page.screenshot({path:join(root,file),fullPage:true,animations:"disabled"});
        pages.push({section,theme,width:1366,file});
        await page.close();
      }
    }
    for (const section of ["operations", "users"]) {
      for (const theme of ["light","dark"]) {
        const markup=reviewSections.find(x=>x[0]===section)[1];
        const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,reducedMotion:"reduce"});
        await page.setContent(fixture(theme,markup));
        const closed=await page.locator(".d173-tabler-sidebar").evaluate(el=>getComputedStyle(el).transform);
        assert.notEqual(closed,"none","mobile nav initially closed");
        await page.evaluate(()=>document.body.dataset.inventoryMenuOpen="true");
        const opened=await page.locator(".d173-tabler-sidebar").evaluate(el=>getComputedStyle(el).transform);
        assert.notEqual(closed,opened,"mobile drawer opens");
        const file=section+"-"+theme+"-390.png";
        await page.screenshot({path:join(root,file),fullPage:true,animations:"disabled"});
        pages.push({section,theme,width:390,file});
        await page.close();
      }
    }
    const html = '<!doctype html><html lang="vi"><meta charset="utf-8"><title>D173 UI Review - Synthetic Fixtures</title><style>body{font:14px system-ui;background:#f6f7f9;color:#243040;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0;padding:12px;background:white;border:1px solid #dce3e9;border-radius:8px}img{display:block;width:100%;height:280px;object-fit:contain;object-position:top}figcaption{font-weight:700;padding:8px 0}p{line-height:1.6}</style><h1>D173-E283 | Review giao diện</h1><p>Ảnh từ Chromium và CSS source trên PR #991, dữ liệu minh họa, không phải kiểm thử tài khoản hoặc nghiệp vụ Production.</p><main>' +
      pages.map(p=>'<figure><a href="'+p.file+'"><img src="'+p.file+'" alt="'+p.section+' '+p.theme+'"></a><figcaption>'+p.section+' | '+p.theme+' | '+p.width+'px</figcaption></figure>').join("") +
      '</main></html>';
    writeFileSync(join(root,"index.html"),html,"utf8");
    writeFileSync(join(root,"manifest.json"),JSON.stringify({source:"D173 PR991 candidate",synthetic_data_only:true,production_connected:false,generated_screens:pages},null,2));
    assert.equal(pages.length,22,"9 desktop screens x 2 + 2 mobile x 2");
  } finally {await browser.close();}
});
