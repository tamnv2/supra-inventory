import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const requireWeb = createRequire(join(ROOT, "web/package.json"));
const { chromium } = requireWeb("playwright");
const src = readFileSync(join(ROOT, "web/src/operational-app.ts"), "utf8");
const imports = [...src.matchAll(/^import "([^"]+\.css)";/gm)].map(match => match[1]);
const css = imports.map(path => {
  const file = path.startsWith("./") ? join(ROOT, "web/src", path) : requireWeb.resolve(path);
  return readFileSync(file, "utf8");
}).join("\n");

const shell = inner => '<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>' +
  css + '</style></head><body data-role="ADMIN" data-theme="light">' +
  '<div class="app-shell d173-tabler-shell">' +
  '<header class="topbar d173-tabler-navbar"><div class="header-product">' +
  '<p class="company-name">SUPRA</p></div></header>' +
  '<nav class="tabs d173-tabler-sidebar">Navigation</nav>' +
  '<main id="content" class="content main d173-page-content">' + inner + '</main>' +
  '<footer class="app-footer">SUPRA</footer></div></body></html>';

const users = '<section class="ops-route users-workspace">' +
  '<div class="workspace-tabs users-mode-tabs"><button class="workspace-tab active">Danh sách tài khoản</button></div>' +
  '<div class="users-list-summary"><span>123 tài khoản phù hợp</span></div>' +
  '<div class="users-top-grid"><article class="ops-panel users-filter-panel">' +
  '<div class="ops-panel-title"><h3>Tìm và lọc tài khoản</h3></div>' +
  '<form class="users-form-grid users-filter-form"><label>Tìm kiếm<input></label>' +
  '<div class="ops-form-actions"><button type="button">Áp dụng bộ lọc</button></div></form>' +
  '</article></div>' +
  '<article class="ops-panel ops-users-panel"><div class="ops-panel-title"><h3>Danh sách tài khoản</h3></div>' +
  '<div class="table-wrap"><table><thead><tr><th>Nhân viên</th></tr></thead>' +
  '<tbody><tr><td>Test</td></tr></tbody></table></div></article></section>';

const shift = '<section class="ops-route tools-workspace">' +
  '<section class="business-summary-grid">' +
  '<article class="business-summary-card primary"><span>Ca</span><strong>06:00–22:00</strong></article>' +
  '<article class="business-summary-card good"><span>Trạng thái</span><strong>Trong ca</strong></article></section>' +
  '<div class="business-page-head"><div><h2>Giờ nghỉ · tạm dừng tự động Skip</h2></div></div>' +
  '<div class="ops-grid-two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px">' +
  '<article class="ops-panel d167-meal-card"><div class="ops-panel-title"><h3>Nghỉ trưa</h3></div>' +
  '<form class="d167-meal-form" style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:14px">' +
  '<label>Giờ nghỉ<select><option>11:00–11:30</option></select></label>' +
  '<button type="button">Xác nhận</button></form></article>' +
  '<article class="ops-panel d167-meal-card"><h3>Nghỉ tối</h3></article></div>' +
  '<article class="ops-panel shift-history-panel"><div class="ops-panel-title"><h3>Lịch sử ca vận hành</h3></div>' +
  '<div class="table-wrap"><table><thead><tr><th>Ngày</th></tr></thead>' +
  '<tbody><tr><td>13/11/2026</td></tr></tbody></table></div></article></section>';

const overview = '<section class="v5-root report-workspace d173-dashboard d173-dashboard-triage">' +
  '<div class="d173-overview-content">' +
  '<div class="d173-overview-kpis d173-overview-kpis-triage">' +
  '<article class="d173-overview-kpi"><span>Đợt chờ xử lý</span><strong>0</strong></article></div>' +
  '<div class="d173-overview-priority"><article class="d173-overview-panel">' +
  '<header>Đợt đang nghẽn</header></article></div></div></section>';

const round = n => Math.round(n * 10) / 10;
const geometry = async (page, selector) => page.evaluate(selector => {
  const root = document.querySelector(selector);
  const main = document.querySelector(".d173-page-content");
  if (!root || !main) throw new Error("Fixture root missing: " + selector);
  const visible = [...root.children].filter(el => getComputedStyle(el).display !== "none");
  const boxes = visible.map(el => el.getBoundingClientRect());
  return {
    paddingLeft: parseFloat(getComputedStyle(main).paddingLeft),
    gap: parseFloat(getComputedStyle(root).rowGap),
    between: boxes.slice(1).map((b, i) => b.top - boxes[i].bottom),
    bodyOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
  };
}, selector);

test("E267: browser-computed spacing matches across users, shift and overview on HD/HD+", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 1366, 1792, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      for (const [name, markup, selector] of [
        ["users", users, ".users-workspace"],
        ["shift", shift, ".tools-workspace"],
        ["overview", overview, ".d173-overview-content"],
      ]) {
        await page.setContent(shell(markup), { waitUntil: "domcontentloaded" });
        const g = await geometry(page, selector);
        if (round(g.paddingLeft) !== 6) {
          const rules = await page.evaluate(() => {
            const el = document.querySelector(".d173-page-content");
            const matched = [];
            const walk = rs => {
              for (const rule of rs) {
                if (rule.selectorText && rule.style?.padding) {
                  try {
                    if (el.matches(rule.selectorText)) matched.push({
                      selector: rule.selectorText.slice(0,140),
                      padding: rule.style.padding, important: rule.style.getPropertyPriority("padding")
                    });
                  } catch {}
                }
                if (rule.cssRules) walk(rule.cssRules);
              }
            };
            for (const sheet of document.styleSheets) walk(sheet.cssRules);
            return matched.slice(-22);
          });
          console.log("E267 CSS matched padding cascade:", JSON.stringify(rules));
        }
        assert.equal(round(g.paddingLeft), 6, name + " main inset @" + width);
        assert.equal(round(g.gap), 6, name + " stack gap @" + width);
        for (const [index, value] of g.between.entries()) {
          assert.ok(Math.abs(value - 6) < 1, name + " child " + index + " spacing=" + value + " @" + width);
        }
        assert.equal(g.bodyOverflowX, false, name + " no page horizontal overflow @" + width);
      }
      await page.setContent(shell(shift), { waitUntil: "domcontentloaded" });
      const card = await page.locator(".d167-meal-card").first().evaluate(el => ({
        paddingTop: parseFloat(getComputedStyle(el).paddingTop),
        paddingLeft: parseFloat(getComputedStyle(el).paddingLeft),
        formMargin: parseFloat(getComputedStyle(el.querySelector(".d167-meal-form")).marginTop),
        formGap: parseFloat(getComputedStyle(el.querySelector(".d167-meal-form")).columnGap),
      }));
      assert.deepEqual(card, { paddingTop: 8, paddingLeft: 10, formMargin: 6, formGap: 6 });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
