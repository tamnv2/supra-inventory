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
  importSkuChunk,
  loginWithPassword,
  saveHrSource,
  searchSkus,
  type AdminReportBatch,
  type AppProfile,
  type SkuItem,
  type SkuNameChangeConflict,
} from "./api";
import { parseSkuExcel, type ParsedSkuWorkbook } from "./sku-excel";

const app = document.querySelector<HTMLDivElement>("#app")!;
const SKU_CHUNK_SIZE = 1000;

let profile: AppProfile | null = getStoredProfile();
let message = "";
let busy = false;
let skuStatus = "";
let skuRows: SkuItem[] = [];
let reportRows: AdminReportBatch[] = [];
let pendingWorkbook: ParsedSkuWorkbook | null = null;
let pendingImportItems: SkuItem[] | null = null;
let pendingSourceHash = "";
let pendingImportId = "";
let pendingDatabaseConflicts: SkuNameChangeConflict[] = [];

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

function renderFileConflicts(): string {
  if (!pendingWorkbook?.conflicts.length) return "";
  return `<section class="conflict-box"><h3>Xung đột trong file (${pendingWorkbook.conflicts.length} SKU)</h3><p class="muted">Một SKU xuất hiện với nhiều tên. Chọn đúng tên cho từng SKU trước khi đối chiếu với dữ liệu hiện tại.</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Chọn tên sản phẩm</th><th>Dòng nguồn</th></tr></thead><tbody>${pendingWorkbook.conflicts
    .map((conflict, index) => `<tr><td>${escapeHtml(conflict.sku)}</td><td><select data-file-conflict-index="${index}">${conflict.candidates
      .map((candidate, candidateIndex) => `<option value="${candidateIndex}">${escapeHtml(candidate.product_name)}</option>`)
      .join("")}</select></td><td>${escapeHtml(conflict.candidates.map((candidate) => `${candidate.product_name}: ${candidate.rows.slice(0, 12).join(", ")}${candidate.rows.length > 12 ? "…" : ""}`).join(" | "))}</td></tr>`)
    .join("")}</tbody></table></div><button id="resolve-file-conflicts" class="danger-gap">Xác nhận lựa chọn & tiếp tục</button></section>`;
}

function renderDatabaseConflicts(): string {
  if (!pendingDatabaseConflicts.length) return "";
  return `<section class="conflict-box warning"><h3>SKU đã tồn tại nhưng tên thay đổi (${pendingDatabaseConflicts.length})</h3><p>Hệ thống chưa cập nhật các tên này. Kiểm tra danh sách rồi xác nhận nếu muốn đổi tên master SKU theo file mới.</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Tên hiện tại</th><th>Tên trong file mới</th></tr></thead><tbody>${pendingDatabaseConflicts
    .map((conflict) => `<tr><td>${escapeHtml(conflict.sku)}</td><td>${escapeHtml(conflict.current_product_name)}</td><td>${escapeHtml(conflict.incoming_product_name)}</td></tr>`)
    .join("")}</tbody></table></div><div class="actions block-gap"><button id="confirm-db-name-changes">Xác nhận đổi tên & nhập dữ liệu</button><button id="cancel-sku-import" class="secondary">Huỷ lượt nhập</button></div></section>`;
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
  const importRetry = pendingImportItems && !pendingDatabaseConflicts.length && !pendingWorkbook?.conflicts.length && !busy
    ? `<button id="retry-sku-apply" class="secondary block-gap">Tiếp tục / thử lại ghi dữ liệu</button>`
    : "";
  const adminTools = canManage
    ? `<article class="card span-full"><h2>Master SKU</h2><p>Hỗ trợ file <strong>.xlsx 10.000–50.000 dòng</strong>. Hệ thống chỉ lấy SKU + Tên sản phẩm, gộp dòng trùng cùng tên, bắt xử lý xung đột và ghi tuần tự theo lô để tránh request quá lớn.</p><form id="sku-import-form" class="stack"><label>File Excel<input id="sku-file" name="skuFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang xử lý..." : "Kiểm tra & nhập SKU"}</button></form>${skuStatus ? `<pre id="sku-status">${escapeHtml(skuStatus)}</pre>` : ""}${renderFileConflicts()}${renderDatabaseConflicts()}${importRetry}<div class="inline-form"><input id="sku-query" placeholder="Tìm SKU hoặc tên sản phẩm" /><button id="sku-search" class="secondary">Tìm</button><button id="sku-recent" class="secondary">Tải danh sách</button></div><div id="sku-list">${renderSkuRows()}</div></article><article class="card span-full"><div class="section-head"><div><h2>Giám sát báo hàng</h2><p class="muted">Dữ liệu đọc trực tiếp từ authority Beta.</p></div><button id="load-reports" class="secondary">Tải lại</button></div><div id="report-list">${renderReportRows()}</div></article>`
    : "";

  app.innerHTML = `<main class="shell wide"><header class="topbar card"><div><p class="eyebrow">SUPRA Inventory — Beta</p><h1>${escapeHtml(profile.display_name || "Đang tải hồ sơ...")}</h1><p class="muted">MNV: ${escapeHtml(profile.employee_code || "—")}</p></div><div class="actions"><span class="badge">${escapeHtml(profile.role)}</span><button id="logout" class="secondary">Đăng xuất</button></div></header>${message ? `<p class="message card">${escapeHtml(message)}</p>` : ""}<section class="grid"><article class="card"><h2>Đổi mật khẩu</h2><form id="password-form" class="stack"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required /></label><label>Mật khẩu mới<input name="newPassword" type="password" minlength="8" required /></label><button>Đổi mật khẩu</button></form></article>${canManage ? `<article class="card"><h2>Nguồn nhân sự</h2><p>Nhập link Google Sheet và tên tab chính xác. Backend chỉ lưu sau khi kiểm tra quyền đọc + cột MNV/Họ tên.</p><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><button id="load-hr" class="secondary block-gap">Đọc cấu hình hiện tại</button><pre id="hr-result"></pre></article>` : ""}${adminTools}</section></main>`;

  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", handleLogout);
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", handlePasswordChange);
  document.querySelector<HTMLFormElement>("#hr-form")?.addEventListener("submit", handleHrSave);
  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
  document.querySelector<HTMLFormElement>("#sku-import-form")?.addEventListener("submit", handleSkuImport);
  document.querySelector<HTMLButtonElement>("#resolve-file-conflicts")?.addEventListener("click", () => void handleFileConflictResolution());
  document.querySelector<HTMLButtonElement>("#confirm-db-name-changes")?.addEventListener("click", () => void applySkuImport(true));
  document.querySelector<HTMLButtonElement>("#cancel-sku-import")?.addEventListener("click", cancelSkuImport);
  document.querySelector<HTMLButtonElement>("#retry-sku-apply")?.addEventListener("click", () => void applySkuImport(false));
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

function resetSkuImportState(): void {
  pendingWorkbook = null;
  pendingImportItems = null;
  pendingSourceHash = "";
  pendingImportId = "";
  pendingDatabaseConflicts = [];
}

function cancelSkuImport(): void {
  resetSkuImportState();
  skuStatus = "Đã huỷ lượt nhập SKU. Dữ liệu chưa xác nhận đổi tên không bị cập nhật.";
  render();
}

function handleLogout(): void {
  clearSession();
  profile = null;
  message = "";
  skuStatus = "";
  skuRows = [];
  reportRows = [];
  resetSkuImportState();
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
  resetSkuImportState();
  busy = true;
  skuStatus = `Đang đọc và kiểm tra ${file.name}...`;
  render();
  try {
    pendingWorkbook = await parseSkuExcel(file);
    pendingSourceHash = pendingWorkbook.source_hash;
    pendingImportId = crypto.randomUUID();
    skuStatus = [
      `ĐỌC FILE PASS`,
      `Dòng dữ liệu: ${pendingWorkbook.total_data_rows.toLocaleString("vi-VN")}`,
      `SKU không xung đột trong file: ${pendingWorkbook.items.length.toLocaleString("vi-VN")}`,
      `SKU cần chọn tên: ${pendingWorkbook.conflicts.length.toLocaleString("vi-VN")}`,
      `Dòng trùng cùng SKU + cùng tên đã gộp: ${pendingWorkbook.merged_duplicate_rows.toLocaleString("vi-VN")}`,
      `Dòng trống bỏ qua: ${pendingWorkbook.skipped_blank_rows.toLocaleString("vi-VN")}`,
      `Header: dòng ${pendingWorkbook.header_row}`,
    ].join("\n");
    if (!pendingWorkbook.conflicts.length) {
      pendingImportItems = [...pendingWorkbook.items];
      await previewSkuImport();
    }
  } catch (error) {
    resetSkuImportState();
    skuStatus = `IMPORT FAIL\n${error instanceof Error ? error.message : "Không đọc được SKU."}`;
  } finally {
    busy = false;
    render();
  }
}

async function handleFileConflictResolution(): Promise<void> {
  if (!pendingWorkbook) return;
  const resolved: SkuItem[] = [...pendingWorkbook.items];
  for (let index = 0; index < pendingWorkbook.conflicts.length; index += 1) {
    const conflict = pendingWorkbook.conflicts[index];
    const select = document.querySelector<HTMLSelectElement>(`select[data-file-conflict-index="${index}"]`);
    const candidateIndex = Number(select?.value || 0);
    const candidate = conflict.candidates[candidateIndex];
    if (!candidate) {
      skuStatus = `Không xác định được lựa chọn cho SKU ${conflict.sku}.`;
      render();
      return;
    }
    resolved.push({ sku: conflict.sku, product_name: candidate.product_name });
  }
  pendingImportItems = resolved;
  pendingWorkbook = { ...pendingWorkbook, conflicts: [] };
  busy = true;
  render();
  try {
    await previewSkuImport();
  } catch (error) {
    skuStatus = `ĐỐI CHIẾU FAIL\n${error instanceof Error ? error.message : "Không đối chiếu được SKU."}`;
  } finally {
    busy = false;
    render();
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function previewSkuImport(): Promise<void> {
  if (!pendingImportItems?.length || !pendingSourceHash || !pendingImportId) return;
  const batches = chunks(pendingImportItems, SKU_CHUNK_SIZE);
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const conflicts: SkuNameChangeConflict[] = [];

  for (let index = 0; index < batches.length; index += 1) {
    skuStatus = `Đang đối chiếu master SKU: lô ${index + 1}/${batches.length} (${Math.min((index + 1) * SKU_CHUNK_SIZE, pendingImportItems.length).toLocaleString("vi-VN")}/${pendingImportItems.length.toLocaleString("vi-VN")})...`;
    render();
    const result = await importSkuChunk(batches[index], {
      requestId: `${pendingImportId}:preview:${index}`,
      sourceHash: pendingSourceHash,
      dryRun: true,
    });
    inserted += result.inserted;
    updated += result.updated;
    unchanged += result.unchanged;
    conflicts.push(...(result.conflicts || []));
  }

  pendingDatabaseConflicts = conflicts;
  skuStatus = [
    `ĐỐI CHIẾU PASS`,
    `Tổng SKU: ${pendingImportItems.length.toLocaleString("vi-VN")}`,
    `Sẽ thêm mới: ${inserted.toLocaleString("vi-VN")}`,
    `Không đổi: ${unchanged.toLocaleString("vi-VN")}`,
    `Tên thay đổi cần xác nhận: ${updated.toLocaleString("vi-VN")}`,
  ].join("\n");
  if (!conflicts.length) await applySkuImport(false);
}

async function applySkuImport(confirmNameChanges: boolean): Promise<void> {
  if (!pendingImportItems?.length || !pendingSourceHash || !pendingImportId) return;
  busy = true;
  render();
  const batches = chunks(pendingImportItems, SKU_CHUNK_SIZE);
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  try {
    for (let index = 0; index < batches.length; index += 1) {
      skuStatus = `Đang ghi master SKU: lô ${index + 1}/${batches.length} (${Math.min((index + 1) * SKU_CHUNK_SIZE, pendingImportItems.length).toLocaleString("vi-VN")}/${pendingImportItems.length.toLocaleString("vi-VN")})...`;
      render();
      const result = await importSkuChunk(batches[index], {
        requestId: `${pendingImportId}:apply:${index}`,
        sourceHash: pendingSourceHash,
        confirmNameChanges,
      });
      inserted += result.inserted;
      updated += result.updated;
      unchanged += result.unchanged;
    }
    const total = pendingImportItems.length;
    resetSkuImportState();
    skuStatus = [
      `IMPORT PASS`,
      `Tổng SKU xử lý: ${total.toLocaleString("vi-VN")}`,
      `Thêm mới: ${inserted.toLocaleString("vi-VN")}`,
      `Cập nhật tên đã xác nhận: ${updated.toLocaleString("vi-VN")}`,
      `Không đổi: ${unchanged.toLocaleString("vi-VN")}`,
      `Dữ liệu SKU không có trong file mới được giữ nguyên.`,
    ].join("\n");
    await loadSkus("");
  } catch (error) {
    skuStatus = `GHI DỮ LIỆU CHƯA HOÀN TẤT\n${error instanceof Error ? error.message : "Không nhập được SKU."}\nCó thể bấm Tiếp tục / thử lại; các lô đã ACK sẽ không bị ghi trùng.`;
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
