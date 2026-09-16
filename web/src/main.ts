import "./styles.css";
import { firebaseMissing, firebaseReady } from "./firebase";
import {
  changeMyPassword,
  clearSession,
  getAdminReports,
  getHrSource,
  getMyProfile,
  getStoredProfile,
  hasSession,
  importSkuItems,
  loginWithPassword,
  saveHrSource,
  searchSkus,
  type AdminReportBatch,
  type AppProfile,
  type SkuItem,
} from "./api";
import { parseSkuExcel } from "./sku-excel";

const app = document.querySelector<HTMLDivElement>("#app")!;
let profile: AppProfile | null = getStoredProfile();
let message = "";
let busy = false;
let skuStatus = "";
let skuRows: SkuItem[] = [];
let reportRows: AdminReportBatch[] = [];

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { hour12: false });
}

function renderSkuRows(): string {
  if (!skuRows.length) return `<p class="muted">Chưa tải danh sách SKU.</p>`;
  return `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Cập nhật</th></tr></thead><tbody>${skuRows
    .map((row) => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.product_name)}</td><td>${escapeHtml(fmtDate(row.updated_at))}</td></tr>`)
    .join("")}</tbody></table></div>`;
}

function renderReportRows(): string {
  if (!reportRows.length) return `<p class="muted">Chưa có batch hoặc chưa tải dữ liệu.</p>`;
  return `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Trạng thái</th><th>Open/Total</th><th>Báo đầu</th><th>Kết quả</th></tr></thead><tbody>${reportRows
    .map((row) => `<tr><td>${escapeHtml(row.sku)}</td><td>${escapeHtml(row.product_name)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(`${row.open_ticket_count}/${row.total_ticket_count}`)}</td><td>${escapeHtml(fmtDate(row.first_report_at))}</td><td>${escapeHtml(row.resolution || "—")}</td></tr>`)
    .join("")}</tbody></table></div>`;
}

function render(): void {
  if (!firebaseReady) {
    app.innerHTML = `<main class="shell"><section class="card"><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Thiếu cấu hình Firebase Web</h1><p>Web source đã deploy-ready nhưng Auth cần Firebase API key public của app Beta.</p><pre>${escapeHtml(firebaseMissing.join(", "))}</pre></section></main>`;
    return;
  }
  if (!hasSession() || !profile) {
    app.innerHTML = `<main class="shell"><section class="card login-card"><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Đăng nhập</h1><form id="login-form" class="stack"><label>Tên đăng nhập<input name="username" autocomplete="username" value="root" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "Đăng nhập"}</button></form>${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}</section></main>`;
    document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", handleLogin);
    return;
  }

  const canManage = profile.role === "ROOT" || profile.role === "ADMIN";
  const adminTools = canManage
    ? `<article class="card span-full"><h2>Master SKU</h2><p>Nhập file <strong>.xlsx</strong>. Hệ thống tìm cột SKU + Tên sản phẩm trong 20 dòng đầu, kiểm tra dòng thiếu/trùng trước khi gửi một lô tới backend.</p><form id="sku-import-form" class="stack"><label>File Excel<input id="sku-file" name="skuFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang xử lý..." : "Kiểm tra & nhập SKU"}</button></form>${skuStatus ? `<pre id="sku-status">${escapeHtml(skuStatus)}</pre>` : ""}<div class="inline-form"><input id="sku-query" placeholder="Tìm SKU hoặc tên sản phẩm" /><button id="sku-search" class="secondary">Tìm</button><button id="sku-recent" class="secondary">Tải danh sách</button></div><div id="sku-list">${renderSkuRows()}</div></article><article class="card span-full"><div class="section-head"><div><h2>Giám sát báo hàng</h2><p class="muted">Dữ liệu đọc trực tiếp từ authority Beta.</p></div><button id="load-reports" class="secondary">Tải lại</button></div><div id="report-list">${renderReportRows()}</div></article>`
    : "";

  app.innerHTML = `<main class="shell wide"><header class="topbar card"><div><p class="eyebrow">SUPRA Inventory — Beta</p><h1>${escapeHtml(profile.display_name || "Đang tải hồ sơ...")}</h1></div><div class="actions"><span class="badge">${escapeHtml(profile.role)}</span><button id="logout" class="secondary">Đăng xuất</button></div></header>${message ? `<p class="message card">${escapeHtml(message)}</p>` : ""}<section class="grid"><article class="card"><h2>Đổi mật khẩu</h2><form id="password-form" class="stack"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required /></label><label>Mật khẩu mới<input name="newPassword" type="password" minlength="8" required /></label><button>Đổi mật khẩu</button></form></article>${canManage ? `<article class="card"><h2>Nguồn nhân sự</h2><p>Nhập link Google Sheet và tên tab chính xác. Backend chỉ lưu sau khi kiểm tra quyền đọc + cột MNV/Họ tên.</p><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><button id="load-hr" class="secondary block-gap">Đọc cấu hình hiện tại</button><pre id="hr-result"></pre></article>` : ""}${adminTools}</section></main>`;

  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", handleLogout);
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", handlePasswordChange);
  document.querySelector<HTMLFormElement>("#hr-form")?.addEventListener("submit", handleHrSave);
  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
  document.querySelector<HTMLFormElement>("#sku-import-form")?.addEventListener("submit", handleSkuImport);
  document.querySelector<HTMLButtonElement>("#sku-search")?.addEventListener("click", () => void handleSkuSearch());
  document.querySelector<HTMLButtonElement>("#sku-recent")?.addEventListener("click", () => void loadSkus(""));
  document.querySelector<HTMLInputElement>("#sku-query")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSkuSearch();
    }
  });
  document.querySelector<HTMLButtonElement>("#load-reports")?.addEventListener("click", () => void loadReports());
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  busy = true;
  message = "";
  render();
  try {
    profile = await loginWithPassword(String(form.get("username") || ""), String(form.get("password") || ""));
    message = "Đăng nhập thành công.";
  } catch (error) {
    profile = null;
    clearSession();
    message = error instanceof Error ? error.message : "Đăng nhập thất bại.";
  } finally {
    busy = false;
    render();
  }
}

function handleLogout(): void {
  clearSession();
  profile = null;
  message = "";
  skuStatus = "";
  skuRows = [];
  reportRows = [];
  render();
}

async function handlePasswordChange(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  try {
    await changeMyPassword(String(form.get("currentPassword") || ""), String(form.get("newPassword") || ""));
    message = "Đổi mật khẩu thành công.";
    (event.currentTarget as HTMLFormElement).reset();
  } catch (error) {
    message = error instanceof Error ? error.message : "Không đổi được mật khẩu.";
  }
  render();
}

async function handleHrSave(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  try {
    const result = await saveHrSource(String(form.get("sheetUrl") || ""), String(form.get("tabName") || ""));
    message = "Nguồn nhân sự đã được kiểm tra và cập nhật.";
    const output = document.querySelector<HTMLElement>("#hr-result");
    if (output) output.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    message = error instanceof Error ? error.message : "Không cập nhật được nguồn nhân sự.";
    render();
  }
}

async function handleHrLoad(): Promise<void> {
  try {
    const output = document.querySelector<HTMLElement>("#hr-result");
    if (output) output.textContent = JSON.stringify(await getHrSource(), null, 2);
  } catch (error) {
    message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự.";
    render();
  }
}

async function handleSkuImport(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#sku-file");
  const file = input?.files?.[0];
  if (!file) return;
  busy = true;
  skuStatus = `Đang đọc ${file.name}...`;
  render();
  try {
    const parsed = await parseSkuExcel(file);
    skuStatus = `Đã kiểm tra ${parsed.items.length} SKU; header dòng ${parsed.header_row}. Đang gửi backend...`;
    render();
    const result = await importSkuItems(parsed.items);
    skuStatus = [
      `IMPORT PASS`,
      `Tổng: ${result.total}`,
      `Thêm mới: ${result.inserted}`,
      `Cập nhật: ${result.updated}`,
      `Không đổi: ${result.unchanged}`,
      `Bỏ qua dòng trống khi đọc file: ${parsed.skipped_blank_rows}`,
      `Thời gian server: ${result.imported_at}`,
    ].join("\n");
    await loadSkus("");
  } catch (error) {
    skuStatus = `IMPORT FAIL\n${error instanceof Error ? error.message : "Không nhập được SKU."}`;
  } finally {
    busy = false;
    render();
  }
}

async function handleSkuSearch(): Promise<void> {
  const query = document.querySelector<HTMLInputElement>("#sku-query")?.value || "";
  await loadSkus(query);
}

async function loadSkus(query: string): Promise<void> {
  try {
    const result = await searchSkus(query, 100);
    skuRows = result.items;
  } catch (error) {
    message = error instanceof Error ? error.message : "Không tải được SKU.";
  }
  render();
}

async function loadReports(): Promise<void> {
  try {
    const result = await getAdminReports(100);
    reportRows = result.items;
  } catch (error) {
    message = error instanceof Error ? error.message : "Không tải được báo hàng.";
  }
  render();
}

async function restoreSession(): Promise<void> {
  if (!hasSession()) {
    render();
    return;
  }
  try {
    profile = await getMyProfile();
  } catch (error) {
    clearSession();
    profile = null;
    message = error instanceof Error ? error.message : "Phiên đăng nhập không còn hợp lệ.";
  }
  render();
}

render();
void restoreSession();
