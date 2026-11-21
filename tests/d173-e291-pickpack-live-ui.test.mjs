import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(ROOT, "web");
const read = p => readFileSync(join(ROOT, p), "utf8");
const app = read("web/src/operational-app.ts");
const office = read("web/src/pickpack-office.css");
const adaptation = read("web/src/d173-pickpack-business.css");
const officePrefix = "/* PickPack Office UI source, read-only from tamnv2/pickpack PR#2 HEAD c9a7730b; presentation-only, no demo runtime. */\n";
const BROWSER_URL = process.env.D173_E291_WEB_URL || "";

test("E291 actual PickPack source CSS integrated, legacy CSS completely absent", () => {
  const imports = [...app.matchAll(/^import "([^"]+\.css)";/gm)].map(x=>x[1]);
  assert.deepEqual(imports, ["./pickpack-office.css", "./d173-pickpack-business.css"]);
  assert.ok(office.startsWith(officePrefix));
  const payload = office.slice(officePrefix.length);
  const hash = createHash("sha1").update("blob " + Buffer.byteLength(payload) + "\0" + payload).digest("hex");
  assert.equal(hash,"f35a20e456355dbf6d7e065b856a6760cd355234", "pinned PickPack CSS blob identity");
  for (const x of [
    ".sidebar{",".side-top{",".side-link{",".app-main{",".topbar{",".login-panel{",":root[data-theme=dark]"
  ]) assert.ok(payload.includes(x), "PickPack component missing: "+x);
  assert.ok(adaptation.length > 10000);
  assert.ok(app.includes('data-shell-generation="d173-pickpack-office-ui"'));
  assert.ok(!app.includes("d173-preview-ui"));
  assert.ok(!app.includes('import "./legacy-'));
  assert.ok(!app.includes('import "./d173-tabler.css"'));
  assert.equal(read("web/src/web-version.ts").includes('WEB_VERSION = "3.3.25"'), true);
  assert.equal(JSON.parse(read("web/package.json")).version, "3.3.25");
});

test("E291 real Inventory auth, role/RBAC, SKU event handlers and realtime remain connected", () => {
  for(const x of [
    "function canAccessSection(", "function renderShell(", "function renderOperations(",
    "function renderFastDetail(", "function renderStockModal(", "function renderSkipModal(",
    "getReporterQueue(", "resolveReporterBatch(", "createPickerReport(", "registerRealtimeApplier(",
    "getMyProfile(", "loginWithPassword(", "logoutInteractiveSession(",
    'id="login-form"', 'id="logout"', 'id="root-role-select"', 'id="theme-mode"',
    'id="inventory-accent-color"', 'id="inventory-menu-toggle"', 'id="realtime-state"',
    'id="overlay-root"', 'id="content"', 'data-section="${section}"',
    'class="main page-content"', 'function patchActiveSection(',
  ]) assert.ok(app.includes(x), "D173 real handler/UI wiring missing: "+x);
  assert.ok(!office.includes("pickpack1291-browser-backup"), "only PickPack CSS is imported, not mock data/runtime");
});

function qaProfile(role) {
  return {
    user_id: "qa-e291-"+role.toLowerCase(), firebase_uid: null, employee_code: "QA000",
    display_name:"QA Web UI", role, base_role:role,
    status:"ACTIVE",password_changed_at:null,auth_email:null,
  };
}
const emptyList = { items: [], count: 0, total: 0, limit: 200, offset: 0, next_page_token: "" };
const QA_BATCH = Object.freeze({
  batch_id:"qa-e291-pending-1",sku:"129100001",product_name:"SKU kiểm thử không tồn tại",
  status:"PENDING",first_report_at:"2026-11-21T03:00:00.000Z",
  last_report_at:"2026-11-21T03:00:00.000Z",affected_picker_count:2,
  earliest_ticket_at:"2026-11-21T03:00:00.000Z",version:1,
  previous_batch_id:null,sla_state:"NORMAL",waiting_minutes:0,auto_skip_enabled:false,
});
function mockBody(path, role, withBatch=false) {
  if(path==="/api/auth/login") return {
    id_token:"qa_e291_browser_only",refresh_token:"qa_e291_refresh_only",expires_in:3600,
    session_generation:1,session_channel:"WEB",user:qaProfile(role)
  };
  if(path==="/api/auth/me") return {user:qaProfile(role)};
  if(path==="/api/skus/catalog-info") return {
    count:0,sku_day_ready:true,sku_day_vn:"2026-11-21",sku_day_last_full:"2026-11-21",
    sku_day_warning:null,max_updated_at:null,version:"qa",items:[]
  };
  if(path==="/api/reporter/queue") return {...emptyList,...(withBatch?{items:[QA_BATCH],count:1,total:1}:{}),server_now:new Date().toISOString()};
  if(path==="/api/reporter/counters") return {
    queue_total:withBatch?1:0,overdue_total:0,recent_total:0,has_stock_total:0,
    skip_allowed_total:0,automatic_skipped_total:0,withdrawn_total:0,
    auto_skip_enabled:false,auto_skip_mode:null
  };
  if(path==="/api/reporter/overdue") return {...emptyList,enabled:false,auto_skip_mode:null};
  if(path==="/api/reporter/recent") return {...emptyList,totals:{has_stock:0,skip_allowed:0,automatic_skipped:0,withdrawn:0,ack_target_count:0,acknowledged_count:0,displayed_count:0}};
  if(path==="/api/admin/overview") return {
    dashboard:{kpis:{},resolution_sources:[],top_skus:[]},
    insights:{recurrence:{top_skus:[]},sla:{configured:false},totals:{}},
    areas:{areas:[],totals:{}},pending_items:[],trend_7d_hours:[],generated_at:new Date().toISOString()
  };
  if(path==="/api/admin/reporting") return {...emptyList,items:[]};
  if(path==="/api/admin/sla") return {sla:null};
  if(path==="/api/picker/reports" || path==="/api/picker/results") return emptyList;
  if(path==="/api/picker/snapshot") return null;
  if(path.endsWith("/health")) return {status:"ok"};
  return { ...emptyList, status:"ok", sla:null, data:[], sources:[], records:[], users:[] };
}

async function newAppPage(browser, role, width, theme, withBatch=false) {
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[],unhandled=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("console",m=>{
    if(m.type()!=="error")return;
    // Synthetic picker snapshot endpoint intentionally returns 404 to activate
    // supported fallback GET /api/picker/reports; do not ignore other errors.
    if(role==="PICKER" && m.text()==="Failed to load resource: the server responded with a status of 404 (Not Found)")return;
    errors.push("console: "+m.text());
  });
  page.on("response",response=>{
    if(response.status()===404 && !new URL(response.url()).pathname.startsWith("/api/picker/snapshot"))
      errors.push("unexpected 404: "+new URL(response.url()).pathname);
  });
  // Synthetic HTTP-only Vite preview has no WebSocket server. Fulfill a
  // browser-native WS handshake for isolated UI checks without provider calls.
  // This does not claim to validate real production WebSocket delivery.
  await page.routeWebSocket("**/api/realtime/connect?*", ws => {
    ws.onMessage(() => {});
  });
  await page.route("**/api/**", async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==="/api/picker/snapshot") {
      await route.fulfill({status:404,contentType:"application/json",body:'{"status":"NOT_SUPPORTED"}'});
      return;
    }
    const data=mockBody(u.pathname,role,withBatch);
    if(data===null) {unhandled.push(u.pathname);await route.fulfill({status:404,contentType:"application/json",body:"{}"});return}
    await route.fulfill({status:200,contentType:"application/json",headers:{"cache-control":"no-store"},body:JSON.stringify(data)});
  });
  await page.goto(BROWSER_URL+"/", {waitUntil:"domcontentloaded"});
  await page.locator("#login-form").waitFor({timeout:12000});
  await page.locator('#login-form input[name="username"]').fill("qa-e291");
  await page.locator('#login-form input[name="password"]').fill("qa-not-real-password");
  await page.locator("#login-form button.primary").click();
  await page.locator('#inventory-sidebar[data-shell-generation="d173-pickpack-office-ui"]').waitFor({timeout:15000});
  if(theme==="dark") {
    await page.locator(".inventory-user-trigger").click();
    await page.locator("#theme-mode").selectOption("DARK");
    await page.locator(".inventory-user-trigger").click();
  }
  return {page,errors,unhandled};
}

test("E291 Chromium real Vite app: root nine pages, identity controls, responsive, theme", {skip:!BROWSER_URL, timeout:180000}, async()=>{
  const {chromium}=createRequire(join(WEB,"package.json"))("playwright");
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [390,1280,1366,1920]) {
      const theme=width===1280?"dark":"light";
      const {page,errors,unhandled}=await newAppPage(browser,"ROOT",width,theme);
      try{
        const ui=await page.evaluate(()=>{
          const x=document.querySelector("#inventory-sidebar"),top=document.querySelector(".topbar"),main=document.querySelector("#content");
          return {
            side:!!x,sidebarPosition:getComputedStyle(x).position,
            top:!!top,main:!!main,mainWidth:Math.round(main.getBoundingClientRect().width),
            hasOldStyle:!!document.querySelector(".d173-tabler-shell"),
            rootTheme:document.documentElement.dataset.theme,
            overflow:document.documentElement.scrollWidth>innerWidth+2,
            sidebarTranslate:getComputedStyle(x).transform,
          }
        });
        assert.equal(ui.side&&ui.top&&ui.main,true);
        assert.equal(ui.sidebarPosition,"fixed");
        assert.equal(ui.hasOldStyle,false);
        assert.equal(ui.overflow,false,"body overflow at "+width);
        assert.ok(ui.mainWidth>100,"main visible");
        assert.equal(ui.rootTheme,theme);
        if(width<=900) assert.notEqual(ui.sidebarTranslate,"none","mobile menu collapsed");
        else assert.equal(ui.sidebarTranslate,"none","desktop sidebar visible");
        if(width===390) {
          await page.locator("#inventory-menu-toggle").click();
          assert.equal(await page.locator("body").getAttribute("data-inventory-menu-open"),"true");
          await page.locator("#inventory-sidebar-backdrop").click({position:{x:300,y:200}});
          assert.equal(await page.locator("body").getAttribute("data-inventory-menu-open"),"false");
        }
        if(width===1366) {
          const sections=["operations","overdue","results","shift","dashboard","sku","users","sla","reports","logs","account"];
          for(const section of sections){
            await page.evaluate(id=>{window.location.hash="#"+id},section);
            await page.waitForFunction(id=>document.querySelector("#content")?.dataset.activeSection===id,section,{timeout:10000});
            assert.equal(await page.locator("#inventory-current-title").innerText(),({
              operations:"Xử lý báo hàng",overdue:"Quá hạn",results:"Kết quả báo hàng",
              shift:"Ca vận hành",dashboard:"Tổng quan & báo cáo",sku:"Danh mục SKU",
              users:"Nhân sự & tài khoản",sla:"Thời gian xử lý",reports:"Báo cáo chi tiết",
              logs:"Nhật ký",account:"Tài khoản"
            })[section],"real header navigation "+section);
          }
          await page.evaluate(()=>{window.location.hash="#operations"});
          await page.waitForFunction(()=>document.querySelector("#content")?.dataset.activeSection==="operations");
          assert.equal(await page.locator('.side-link:has([data-section="operations"])').getAttribute("class").then(x=>x.includes("selected")),true,"sidebar active state tracks route");
          mkdirSync(join(ROOT,".artifacts/d173-e291-pickpack-ui"),{recursive:true});
          await page.screenshot({path:join(ROOT,".artifacts/d173-e291-pickpack-ui/root-desktop-light.png"),fullPage:true});
        }
        assert.deepEqual(unhandled,[],"unknown backend route");
        assert.deepEqual(errors,[],"runtime errors");
      }finally{await page.close()}
    }
  }finally{await browser.close()}
});

test("E291 Chromium role isolation with real Inventory UI, not copied PickPack mock RBAC", {skip:!BROWSER_URL,timeout:100000},async()=>{
  const {chromium}=createRequire(join(WEB,"package.json"))("playwright");
  const browser=await chromium.launch({headless:true});
  try{
    for(const [role,allowed,denied] of [
      ["REPORTER","operations","users"],
      ["PICKER","picker","operations"],
    ]){
      const {page,errors}=await newAppPage(browser,role,1366,"light");
      try{
        assert.equal(await page.locator('#inventory-sidebar').count(),1);
        assert.equal(await page.locator('.nav-button[data-section="'+allowed+'"]').count(),1);
        assert.equal(await page.locator('.nav-button[data-section="'+denied+'"]').count(),0);
        assert.equal(await page.locator('#root-role-select').count(),0);
        assert.deepEqual(errors,[],"No runtime errors for "+role);
      }finally{await page.close()}
    }
  }finally{await browser.close()}
});

test("E291 real Inventory operation actions: open and cancel both resolved/skip modals, without writes", {skip:!BROWSER_URL,timeout:80000},async()=>{
  const {chromium}=createRequire(join(WEB,"package.json"))("playwright");
  const browser=await chromium.launch({headless:true});
  try{
    const {page,errors}=await newAppPage(browser,"ROOT",1366,"light",true);
    try{
      await page.locator('[data-resolve="HAS_STOCK"]').waitFor({timeout:12000});
      assert.equal(await page.locator('#fastDetail .fast-sku').count(),0);
      assert.match(await page.locator("#fastDetail").innerText(),/129100001/);
      await page.locator('[data-resolve="HAS_STOCK"]').click();
      await page.locator("#confirm-stock").waitFor();
      assert.equal(await page.locator(".modal .modal-box").isVisible(),true);
      assert.match(await page.locator(".modal .modal-box").innerText(),/129100001/);
      await page.locator("#cancel-stock").click();
      assert.equal(await page.locator("#confirm-stock").count(),0);
      await page.locator("[data-skip-batch]").click();
      await page.locator("#cancel-skip").waitFor();
      assert.equal(await page.locator(".modal .modal-box").isVisible(),true);
      await page.locator("#cancel-skip").click();
      assert.equal(await page.locator("#confirm-skip").count(),0);
      assert.deepEqual(errors,[],"real DOM action wiring produced no browser runtime errors");
    }finally{await page.close()}
  }finally{await browser.close()}
});
