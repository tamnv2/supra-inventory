import "./styles.css";
import { firebaseMissing, firebaseReady } from "./firebase";
import {
  changeMyPassword,
  clearSession,
  correctReporterBatch,
  createManagedUser,
  applyHrPickerSync,
  getHrSource,
  listManagedUsers,
  previewHrPickerSync,
  resetManagedUserPassword,
  updateManagedUser,
  getMyProfile,
  getReporterBatchTickets,
  getReporterQueue,
  getReporterRecent,
  getStoredProfile,
  hasSession,
  importSkuChunk,
  loginWithPassword,
  resolveReporterBatch,
  saveHrSource,
  searchSkus,
  type AppProfile,
  type ManagedUser,
  type HrSyncPreview,
  type BatchPickerTicket,
  type ReporterBatch,
  type ReporterRecentBatch,
  type SkuItem,
  type SkuNameChangeConflict,
} from "./api";
import { parseSkuExcel, type ParsedSkuWorkbook } from "./sku-excel";

const app = document.querySelector<HTMLDivElement>("#app")!;
const SKU_CHUNK_SIZE = 1000;
type Section = "operations" | "sku" | "hr" | "account";

let profile: AppProfile | null = getStoredProfile();
let activeSection: Section = "operations";
let message = "";
let busy = false;
let skuStatus = "";
let skuRows: SkuItem[] = [];
let queueRows: ReporterBatch[] = [];
let recentRows: ReporterRecentBatch[] = [];
const batchDetails = new Map<string, BatchPickerTicket[]>();
let pendingWorkbook: ParsedSkuWorkbook | null = null;
let pendingImportItems: SkuItem[] | null = null;
let pendingSourceHash = "";
let pendingImportId = "";
let pendingDatabaseConflicts: SkuNameChangeConflict[] = [];
let managedUsers: ManagedUser[] = [];
let hrSyncPreview: HrSyncPreview | null = null;

function escapeHtml(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN", { hour12: false });
}

function ageLabel(value: string): string {
  const ms = Math.max(0, Date.now() - Date.parse(value));
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "< 1 phút";
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  return `${hours}h ${totalMinutes % 60}m`;
}

function canOperate(user = profile): boolean {
  return Boolean(user && ["REPORTER", "ADMIN", "ROOT"].includes(user.role));
}

function canManage(user = profile): boolean {
  return Boolean(user && ["ADMIN", "ROOT"].includes(user.role));
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    PENDING: "Đang xử lý",
    HAS_STOCK: "Đã có hàng",
    SKIP_ALLOWED: "Được skip",
    CLOSED: "Picker thu hồi",
  };
  return labels[value] || value;
}

function renderNav(): string {
  if (!profile) return "";
  const tabs: Array<[Section, string]> = [];
  if (canOperate()) tabs.push(["operations", "Vận hành"]);
  if (canManage()) tabs.push(["sku", "Master SKU"], ["hr", "Nhân sự"]);
  tabs.push(["account", "Tài khoản"]);
  if (!tabs.some(([id]) => id === activeSection)) activeSection = tabs[0][0];
  return `<nav class="tabs">${tabs.map(([id, label]) => `<button class="tab ${activeSection === id ? "active" : ""}" data-section="${id}">${escapeHtml(label)}</button>`).join("")}</nav>`;
}

function renderBatchDetails(batchId: string): string {
  const items = batchDetails.get(batchId);
  if (!items) return "";
  if (!items.length) return `<div class="detail-panel muted">Không có ticket trong batch.</div>`;
  return `<div class="detail-panel"><strong>Picker liên quan</strong><div class="mini-list">${items.map((item) => `<span><b>${escapeHtml(item.picker_employee_code)}</b> — ${escapeHtml(item.picker_display_name || "Chưa có tên")} · ${escapeHtml(fmtDate(item.reported_at))}</span>`).join("")}</div></div>`;
}

function renderOperations(): string {
  const affected = queueRows.reduce((sum, item) => sum + Number(item.affected_picker_count || 0), 0);
  const hasStock = recentRows.filter((item) => item.status === "HAS_STOCK").length;
  const skipped = recentRows.filter((item) => item.status === "SKIP_ALLOWED").length;
  return `<section class="page-stack"><div class="section-head"><div><p class="eyebrow">Điều phối Inventory</p><h2>Danh sách cần xử lý</h2><p class="muted">Ưu tiên tự động: nhiều Picker bị ảnh hưởng hơn trước; bằng nhau thì báo đầu sớm hơn.</p></div><button id="refresh-operations" class="secondary">Tải lại</button></div><div class="metrics"><div class="metric"><span>Đợt đang chờ</span><strong>${queueRows.length}</strong></div><div class="metric"><span>Picker đang ảnh hưởng</span><strong>${affected}</strong></div><div class="metric"><span>Đã có hàng gần đây</span><strong>${hasStock}</strong></div><div class="metric"><span>Được skip gần đây</span><strong>${skipped}</strong></div></div><article class="card"><h3>Đang xử lý</h3>${queueRows.length ? `<div class="operation-list">${queueRows.map((row) => `<div class="operation-card"><div class="operation-main"><div><div class="sku-code">${escapeHtml(row.sku)}</div><div class="product-name">${escapeHtml(row.product_name)}</div><div class="operation-meta"><span>${Number(row.affected_picker_count)} Picker</span><span>Chờ ${escapeHtml(ageLabel(row.first_report_at))}</span><span>Báo đầu ${escapeHtml(fmtDate(row.first_report_at))}</span></div></div><div class="operation-actions"><button class="success" data-resolve="HAS_STOCK" data-batch="${escapeHtml(row.batch_id)}">Đã có hàng</button><button class="warning-btn" data-resolve="SKIP_ALLOWED" data-batch="${escapeHtml(row.batch_id)}">Cho phép skip</button><button class="secondary" data-detail-batch="${escapeHtml(row.batch_id)}">${batchDetails.has(row.batch_id) ? "Ẩn Picker" : "Chi tiết Picker"}</button></div></div>${renderBatchDetails(row.batch_id)}</div>`).join("")}</div>` : `<div class="empty-state">Không có SKU đang chờ xử lý.</div>`}</article><article class="card"><h3>Kết quả gần đây</h3>${recentRows.length ? `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Kết quả</th><th>Picker</th><th>Thời gian xử lý</th><th>Sửa kết quả</th></tr></thead><tbody>${recentRows.map((row) => { const correctable = row.status === "SKIP_ALLOWED" && Boolean(row.correction_deadline_at) && Date.now() <= Date.parse(row.correction_deadline_at!); return `<tr><td><b>${escapeHtml(row.sku)}</b></td><td>${escapeHtml(row.product_name)}</td><td><span class="status ${row.status === "HAS_STOCK" ? "ok" : "skip"}">${escapeHtml(statusLabel(row.status))}</span></td><td>${Number(row.affected_picker_count)}</td><td>${escapeHtml(fmtDate(row.resolved_at))}</td><td>${correctable ? `<button data-correct-batch="${escapeHtml(row.batch_id)}" class="secondary">Sửa thành Có hàng</button><div class="tiny">Hạn ${escapeHtml(fmtDate(row.correction_deadline_at))}</div>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty-state">Chưa có kết quả gần đây.</div>`}</article></section>`;
}

function renderSkuRows(): string {
  if (!skuRows.length) return `<p class="muted">Chưa tải danh sách SKU.</p>`;
  return `<div class="table-wrap"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Cập nhật</th></tr></thead><tbody>${skuRows.map((row) => `<tr><td><b>${escapeHtml(row.sku)}</b></td><td>${escapeHtml(row.product_name)}</td><td>${escapeHtml(fmtDate(row.updated_at))}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderFileConflicts(): string {
  if (!pendingWorkbook?.conflicts.length) return "";
  return `<section class="conflict-box"><h3>Xung đột trong file (${pendingWorkbook.conflicts.length} SKU)</h3><p class="muted">Một SKU xuất hiện với nhiều tên. Chọn đúng tên cho từng SKU trước khi đối chiếu với dữ liệu hiện tại.</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Chọn tên sản phẩm</th><th>Dòng nguồn</th></tr></thead><tbody>${pendingWorkbook.conflicts.map((conflict, index) => `<tr><td><b>${escapeHtml(conflict.sku)}</b></td><td><select data-file-conflict-index="${index}">${conflict.candidates.map((candidate, candidateIndex) => `<option value="${candidateIndex}">${escapeHtml(candidate.product_name)}</option>`).join("")}</select></td><td>${escapeHtml(conflict.candidates.map((candidate) => `${candidate.product_name}: ${candidate.rows.slice(0, 12).join(", ")}${candidate.rows.length > 12 ? "…" : ""}`).join(" | "))}</td></tr>`).join("")}</tbody></table></div><button id="resolve-file-conflicts" class="block-gap">Xác nhận lựa chọn & tiếp tục</button></section>`;
}

function renderDatabaseConflicts(): string {
  if (!pendingDatabaseConflicts.length) return "";
  return `<section class="conflict-box warning"><h3>SKU đã tồn tại nhưng tên thay đổi (${pendingDatabaseConflicts.length})</h3><p>Hệ thống chưa cập nhật các tên này. Kiểm tra danh sách rồi xác nhận nếu muốn đổi tên master SKU theo file mới.</p><div class="table-wrap"><table><thead><tr><th>SKU</th><th>Tên hiện tại</th><th>Tên trong file mới</th></tr></thead><tbody>${pendingDatabaseConflicts.map((conflict) => `<tr><td><b>${escapeHtml(conflict.sku)}</b></td><td>${escapeHtml(conflict.current_product_name)}</td><td>${escapeHtml(conflict.incoming_product_name)}</td></tr>`).join("")}</tbody></table></div><div class="actions block-gap"><button id="confirm-db-name-changes">Xác nhận đổi tên & nhập dữ liệu</button><button id="cancel-sku-import" class="secondary">Huỷ lượt nhập</button></div></section>`;
}

function renderSkuPage(): string {
  const importRetry = pendingImportItems && !pendingDatabaseConflicts.length && !pendingWorkbook?.conflicts.length && !busy ? `<button id="retry-sku-apply" class="secondary block-gap">Tiếp tục / thử lại ghi dữ liệu</button>` : "";
  return `<section class="page-stack"><div><p class="eyebrow">Danh mục hàng hóa</p><h2>Master SKU</h2><p class="muted">Chỉ quản lý SKU + Tên sản phẩm. File .xlsx 10.000–50.000 dòng được xử lý theo lô, không xóa SKU cũ chỉ vì file mới không còn dòng đó.</p></div><article class="card"><h3>Cập nhật từ Excel</h3><form id="sku-import-form" class="stack"><label>File Excel<input id="sku-file" name="skuFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang xử lý..." : "Kiểm tra & nhập SKU"}</button></form>${skuStatus ? `<pre id="sku-status">${escapeHtml(skuStatus)}</pre>` : ""}${renderFileConflicts()}${renderDatabaseConflicts()}${importRetry}</article><article class="card"><div class="section-head"><div><h3>Tra cứu Master SKU</h3><p class="muted">Tìm theo SKU hoặc tên sản phẩm.</p></div></div><div class="inline-form"><input id="sku-query" placeholder="Nhập SKU / tên sản phẩm" /><button id="sku-search" class="secondary">Tìm</button><button id="sku-recent" class="secondary">Tải danh sách</button></div><div id="sku-list">${renderSkuRows()}</div></article></section>`;
}

function renderHrPage(): string {
  const createRole = profile?.role === "ROOT" ? "ADMIN" : "REPORTER";
  const manageableRole = createRole;
  const preview = hrSyncPreview ? `<div class="detail-panel"><strong>Preview đồng bộ Picker</strong><div class="operation-meta"><span>Nguồn: ${hrSyncPreview.total_source}</span><span>Thêm: ${hrSyncPreview.create}</span><span>Kích hoạt lại: ${hrSyncPreview.reactivate}</span><span>Đổi tên: ${hrSyncPreview.rename}</span><span>Ngừng hoạt động: ${hrSyncPreview.disable}</span><span>Không đổi: ${hrSyncPreview.unchanged}</span></div>${hrSyncPreview.collisions.length ? `<p class="message">Có ${hrSyncPreview.collisions.length} MNV trùng tài khoản không phải Picker. Chưa được phép đồng bộ.</p>` : `<button id="apply-hr-sync" class="block-gap">Xác nhận đồng bộ Picker</button>`}</div>` : "";
  const userRows = managedUsers.length ? `<div class="table-wrap"><table><thead><tr><th>MNV/User</th><th>Họ tên</th><th>Role</th><th>Trạng thái</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead><tbody>${managedUsers.map((user) => { const canEdit = user.role === manageableRole; return `<tr><td><b>${escapeHtml(user.employee_code || user.user_id)}</b></td><td>${escapeHtml(user.display_name)}</td><td>${escapeHtml(user.role)}</td><td>${user.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}</td><td>${user.password_initialized ? "Đã khởi tạo" : "Mặc định"}</td><td>${canEdit ? `<button class="secondary" data-user-toggle="${escapeHtml(user.user_id)}" data-next-status="${user.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}" data-user-name="${escapeHtml(user.display_name)}">${user.status === "ACTIVE" ? "Ngừng hoạt động" : "Mở lại"}</button><button class="secondary" data-user-reset="${escapeHtml(user.user_id)}">Reset mật khẩu</button>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="muted">Chưa tải danh sách tài khoản.</p>`;
  return `<section class="page-stack"><div><p class="eyebrow">Nhân sự & tài khoản</p><h2>Quản lý nhân sự</h2><p class="muted">Picker lấy từ HR Sheet. ROOT tạo ADMIN; ADMIN tạo REPORTER. Tài khoản mất khỏi HR không bị xoá lịch sử mà chuyển ngừng hoạt động.</p></div><article class="card"><h3>Nguồn Google Sheet</h3><form id="hr-form" class="stack"><label>Google Sheet URL<input name="sheetUrl" type="url" required /></label><label>Tên tab chính xác<input name="tabName" value="Nhân sự" required /></label><button>Xác nhận & cập nhật</button></form><div class="actions block-gap"><button id="load-hr" class="secondary">Đọc cấu hình</button><button id="preview-hr-sync" class="secondary">Kiểm tra đồng bộ Picker</button></div><pre id="hr-result"></pre>${preview}</article><article class="card"><h3>Tạo ${createRole}</h3><form id="managed-user-form" class="inline-form"><input name="username" placeholder="MNV / tên đăng nhập" required /><input name="displayName" placeholder="Họ tên" required /><button>Tạo ${createRole}</button></form><p class="tiny">Tài khoản mới dùng mật khẩu mặc định từ bootstrap secret; không lưu mật khẩu trong source.</p></article><article class="card"><div class="section-head"><div><h3>Danh sách tài khoản</h3><p class="muted">ROOT được bảo vệ; Picker do HR quản lý; chỉ role thuộc phạm vi của cấp hiện tại mới có nút thao tác.</p></div><button id="load-users" class="secondary">Tải lại</button></div>${userRows}</article></section>`;
}

function renderAccountPage(): string {
  return `<section class="page-stack"><div><p class="eyebrow">Bảo mật tài khoản</p><h2>Tài khoản</h2></div><article class="card narrow"><form id="password-form" class="stack"><label>Mật khẩu hiện tại<input name="currentPassword" type="password" required /></label><label>Mật khẩu mới<input name="newPassword" type="password" minlength="8" required /></label><button>Đổi mật khẩu</button></form></article></section>`;
}

function renderContent(): string {
  if (activeSection === "operations" && canOperate()) return renderOperations();
  if (activeSection === "sku" && canManage()) return renderSkuPage();
  if (activeSection === "hr" && canManage()) return renderHrPage();
  return renderAccountPage();
}

function render(): void {
  if (!firebaseReady) {
    app.innerHTML = `<main class="shell"><section class="card"><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Thiếu cấu hình Firebase Web</h1><pre>${escapeHtml(firebaseMissing.join(", "))}</pre></section></main>`;
    return;
  }
  if (!hasSession() || !profile) {
    app.innerHTML = `<main class="shell login-shell"><section class="card login-card"><div class="brand-mark">SI</div><p class="eyebrow">SUPRA Inventory — Beta</p><h1>Đăng nhập hệ thống</h1><p class="muted">Admin / Root quản trị trên Web. Picker / Reporter vận hành chính trên PDA.</p><form id="login-form" class="stack"><label>Tên đăng nhập<input name="username" autocomplete="username" value="root" required /></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required /></label><button ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "Đăng nhập"}</button></form>${message ? `<p class="message">${escapeHtml(message)}</p>` : ""}</section></main>`;
    document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", handleLogin);
    return;
  }

  app.innerHTML = `<main class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark small">SI</div><div><strong>SUPRA Inventory</strong><span>Beta</span></div></div>${renderNav()}<div class="sidebar-foot"><div class="user-mini"><strong>${escapeHtml(profile.display_name)}</strong><span>${escapeHtml(profile.employee_code || profile.user_id)} · ${escapeHtml(profile.role)}</span></div><button id="logout" class="secondary full">Đăng xuất</button></div></aside><section class="workspace"><header class="workspace-head"><div><h1>${activeSection === "operations" ? "Vận hành báo hàng" : activeSection === "sku" ? "Master SKU" : activeSection === "hr" ? "Nhân sự" : "Tài khoản"}</h1><p class="muted">Mạng: ${navigator.onLine ? "Online" : "Offline"} · Dịch vụ: Beta</p></div><div class="header-badges"><span class="badge env">BETA</span><span class="badge">${escapeHtml(profile.role)}</span></div></header>${message ? `<div class="notice">${escapeHtml(message)}</div>` : ""}${renderContent()}</section></main>`;

  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => { activeSection = button.dataset.section as Section; message = ""; render(); }));
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", handleLogout);
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", handlePasswordChange);
  document.querySelector<HTMLFormElement>("#hr-form")?.addEventListener("submit", handleHrSave);
  document.querySelector<HTMLButtonElement>("#load-hr")?.addEventListener("click", handleHrLoad);
  document.querySelector<HTMLButtonElement>("#preview-hr-sync")?.addEventListener("click", () => void handleHrSyncPreview());
  document.querySelector<HTMLButtonElement>("#apply-hr-sync")?.addEventListener("click", () => void handleHrSyncApply());
  document.querySelector<HTMLFormElement>("#managed-user-form")?.addEventListener("submit", handleManagedUserCreate);
  document.querySelector<HTMLButtonElement>("#load-users")?.addEventListener("click", () => void loadManagedUsers());
  document.querySelectorAll<HTMLButtonElement>("[data-user-toggle]").forEach((button) => button.addEventListener("click", () => void handleManagedUserToggle(button)));
  document.querySelectorAll<HTMLButtonElement>("[data-user-reset]").forEach((button) => button.addEventListener("click", () => void handleManagedUserReset(button.dataset.userReset || "")));
  document.querySelector<HTMLFormElement>("#sku-import-form")?.addEventListener("submit", handleSkuImport);
  document.querySelector<HTMLButtonElement>("#resolve-file-conflicts")?.addEventListener("click", () => void handleFileConflictResolution());
  document.querySelector<HTMLButtonElement>("#confirm-db-name-changes")?.addEventListener("click", () => void applySkuImport(true));
  document.querySelector<HTMLButtonElement>("#cancel-sku-import")?.addEventListener("click", cancelSkuImport);
  document.querySelector<HTMLButtonElement>("#retry-sku-apply")?.addEventListener("click", () => void applySkuImport(false));
  document.querySelector<HTMLButtonElement>("#sku-search")?.addEventListener("click", () => void handleSkuSearch());
  document.querySelector<HTMLButtonElement>("#sku-recent")?.addEventListener("click", () => void loadSkus(""));
  document.querySelector<HTMLInputElement>("#sku-query")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); void handleSkuSearch(); } });
  document.querySelector<HTMLButtonElement>("#refresh-operations")?.addEventListener("click", () => void loadOperations());
  document.querySelectorAll<HTMLButtonElement>("[data-resolve]").forEach((button) => button.addEventListener("click", () => void handleResolve(button.dataset.batch || "", button.dataset.resolve as "HAS_STOCK" | "SKIP_ALLOWED")));
  document.querySelectorAll<HTMLButtonElement>("[data-correct-batch]").forEach((button) => button.addEventListener("click", () => void handleCorrect(button.dataset.correctBatch || "")));
  document.querySelectorAll<HTMLButtonElement>("[data-detail-batch]").forEach((button) => button.addEventListener("click", () => void handleBatchDetail(button.dataset.detailBatch || "")));
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  busy = true; message = ""; render();
  try {
    profile = await loginWithPassword(String(form.get("username") || ""), String(form.get("password") || ""));
    activeSection = canOperate(profile) ? "operations" : "account";
    if (canOperate(profile)) await loadOperations(false);
    message = "Đăng nhập thành công.";
  } catch (error) {
    profile = null; clearSession(); message = error instanceof Error ? error.message : "Đăng nhập thất bại.";
  } finally { busy = false; render(); }
}

function resetSkuImportState(): void { pendingWorkbook = null; pendingImportItems = null; pendingSourceHash = ""; pendingImportId = ""; pendingDatabaseConflicts = []; }
function cancelSkuImport(): void { resetSkuImportState(); skuStatus = "Đã huỷ lượt nhập SKU. Dữ liệu chưa xác nhận đổi tên không bị cập nhật."; render(); }
function handleLogout(): void { clearSession(); profile = null; message = ""; skuStatus = ""; skuRows = []; queueRows = []; recentRows = []; managedUsers = []; hrSyncPreview = null; batchDetails.clear(); resetSkuImportState(); render(); }

async function handlePasswordChange(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  try { await changeMyPassword(String(form.get("currentPassword") || ""), String(form.get("newPassword") || "")); message = "Đổi mật khẩu thành công."; (event.currentTarget as HTMLFormElement).reset(); }
  catch (error) { message = error instanceof Error ? error.message : "Không đổi được mật khẩu."; }
  render();
}

async function handleHrSave(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  try { const result = await saveHrSource(String(form.get("sheetUrl") || ""), String(form.get("tabName") || "")); message = "Nguồn nhân sự đã được kiểm tra và cập nhật."; const output = document.querySelector<HTMLElement>("#hr-result"); if (output) output.textContent = JSON.stringify(result, null, 2); }
  catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được nguồn nhân sự."; render(); }
}

async function handleHrLoad(): Promise<void> {
  try { const output = document.querySelector<HTMLElement>("#hr-result"); if (output) output.textContent = JSON.stringify(await getHrSource(), null, 2); }
  catch (error) { message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự."; render(); }
}

async function loadManagedUsers(renderAfter = true): Promise<void> {
  if (!canManage()) return;
  try { managedUsers = (await listManagedUsers()).items; }
  catch (error) { message = error instanceof Error ? error.message : "Không tải được tài khoản."; }
  if (renderAfter) render();
}

async function handleManagedUserCreate(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!profile || !["ROOT","ADMIN"].includes(profile.role)) return;
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const role = profile.role === "ROOT" ? "ADMIN" : "REPORTER";
  try {
    await createManagedUser(String(form.get("username") || ""), String(form.get("displayName") || ""), role);
    message = `Đã tạo ${role}. Tài khoản dùng mật khẩu mặc định cho lần đăng nhập đầu.`;
    (event.currentTarget as HTMLFormElement).reset();
    await loadManagedUsers(false);
  } catch (error) { message = error instanceof Error ? error.message : "Không tạo được tài khoản."; }
  render();
}

async function handleManagedUserToggle(button: HTMLButtonElement): Promise<void> {
  const userId = button.dataset.userToggle || "";
  const nextStatus = button.dataset.nextStatus as "ACTIVE" | "DISABLED";
  const displayName = button.dataset.userName || "";
  if (!userId || !nextStatus || !window.confirm(`${nextStatus === "DISABLED" ? "Ngừng hoạt động" : "Mở lại"} tài khoản ${displayName}?`)) return;
  try { await updateManagedUser(userId, displayName, nextStatus); message = "Đã cập nhật trạng thái tài khoản."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được tài khoản."; }
  render();
}

async function handleManagedUserReset(userId: string): Promise<void> {
  if (!userId || !window.confirm("Reset mật khẩu về mật khẩu mặc định và vô hiệu phiên hiện tại của tài khoản này?")) return;
  try { await resetManagedUserPassword(userId); message = "Đã reset mật khẩu về mặc định."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không reset được mật khẩu."; }
  render();
}

async function handleHrSyncPreview(): Promise<void> {
  busy = true; message = "Đang đọc nguồn HR và đối chiếu Picker..."; render();
  try { hrSyncPreview = await previewHrPickerSync(); message = "Đối chiếu HR hoàn tất. Kiểm tra số liệu trước khi xác nhận."; }
  catch (error) { hrSyncPreview = null; message = error instanceof Error ? error.message : "Không đối chiếu được HR."; }
  finally { busy = false; render(); }
}

async function handleHrSyncApply(): Promise<void> {
  if (!hrSyncPreview || hrSyncPreview.collisions.length) return;
  if (!window.confirm(`Xác nhận đồng bộ ${hrSyncPreview.total_source} Picker? Sẽ thêm ${hrSyncPreview.create}, kích hoạt lại ${hrSyncPreview.reactivate}, đổi tên ${hrSyncPreview.rename}, và chuyển ngừng hoạt động ${hrSyncPreview.disable} Picker không còn trong nguồn.`)) return;
  busy = true; render();
  try { await applyHrPickerSync(); hrSyncPreview = null; message = "Đồng bộ Picker từ HR Sheet thành công."; await loadManagedUsers(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không đồng bộ được Picker."; }
  finally { busy = false; render(); }
}

async function loadOperations(renderAfter = true): Promise<void> {
  if (!canOperate()) return;
  try {
    const [queue, recent] = await Promise.all([getReporterQueue(100), getReporterRecent(100)]);
    queueRows = queue.items;
    recentRows = recent.items;
  } catch (error) {
    message = error instanceof Error ? error.message : "Không tải được dữ liệu vận hành.";
  }
  if (renderAfter) render();
}

async function handleResolve(batchId: string, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<void> {
  if (!batchId) return;
  const label = resolution === "HAS_STOCK" ? "Đã có hàng" : "Cho phép skip";
  if (!window.confirm(`Xác nhận ${label} cho batch này?`)) return;
  busy = true; render();
  try { await resolveReporterBatch(batchId, resolution); message = `Đã cập nhật: ${label}.`; await loadOperations(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không xử lý được batch."; }
  finally { busy = false; render(); }
}

async function handleCorrect(batchId: string): Promise<void> {
  if (!batchId || !window.confirm("Xác nhận sửa kết quả từ Được skip thành Đã có hàng?")) return;
  busy = true; render();
  try { await correctReporterBatch(batchId); message = "Đã sửa kết quả thành Đã có hàng."; await loadOperations(false); }
  catch (error) { message = error instanceof Error ? error.message : "Không sửa được kết quả."; }
  finally { busy = false; render(); }
}

async function handleBatchDetail(batchId: string): Promise<void> {
  if (!batchId) return;
  if (batchDetails.has(batchId)) { batchDetails.delete(batchId); render(); return; }
  try { batchDetails.set(batchId, (await getReporterBatchTickets(batchId)).items); }
  catch (error) { message = error instanceof Error ? error.message : "Không tải được danh sách Picker."; }
  render();
}

async function handleSkuImport(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const input = document.querySelector<HTMLInputElement>("#sku-file"); const file = input?.files?.[0]; if (!file) return;
  resetSkuImportState(); busy = true; skuStatus = `Đang đọc và kiểm tra ${file.name}...`; render();
  try {
    pendingWorkbook = await parseSkuExcel(file); pendingSourceHash = pendingWorkbook.source_hash; pendingImportId = crypto.randomUUID();
    skuStatus = [`ĐỌC FILE PASS`, `Dòng dữ liệu: ${pendingWorkbook.total_data_rows.toLocaleString("vi-VN")}`, `SKU không xung đột trong file: ${pendingWorkbook.items.length.toLocaleString("vi-VN")}`, `SKU cần chọn tên: ${pendingWorkbook.conflicts.length.toLocaleString("vi-VN")}`, `Dòng trùng cùng SKU + cùng tên đã gộp: ${pendingWorkbook.merged_duplicate_rows.toLocaleString("vi-VN")}`, `Dòng trống bỏ qua: ${pendingWorkbook.skipped_blank_rows.toLocaleString("vi-VN")}`, `Header: dòng ${pendingWorkbook.header_row}`].join("\n");
    if (!pendingWorkbook.conflicts.length) { pendingImportItems = [...pendingWorkbook.items]; await previewSkuImport(); }
  } catch (error) { resetSkuImportState(); skuStatus = `IMPORT FAIL\n${error instanceof Error ? error.message : "Không đọc được SKU."}`; }
  finally { busy = false; render(); }
}

async function handleFileConflictResolution(): Promise<void> {
  if (!pendingWorkbook) return;
  const resolved: SkuItem[] = [...pendingWorkbook.items];
  for (let index = 0; index < pendingWorkbook.conflicts.length; index += 1) {
    const conflict = pendingWorkbook.conflicts[index]; const select = document.querySelector<HTMLSelectElement>(`select[data-file-conflict-index="${index}"]`); const candidate = conflict.candidates[Number(select?.value || 0)];
    if (!candidate) { skuStatus = `Không xác định được lựa chọn cho SKU ${conflict.sku}.`; render(); return; }
    resolved.push({ sku: conflict.sku, product_name: candidate.product_name });
  }
  pendingImportItems = resolved; pendingWorkbook = { ...pendingWorkbook, conflicts: [] }; busy = true; render();
  try { await previewSkuImport(); }
  catch (error) { skuStatus = `ĐỐI CHIẾU FAIL\n${error instanceof Error ? error.message : "Không đối chiếu được SKU."}`; }
  finally { busy = false; render(); }
}

function chunks<T>(items: T[], size: number): T[][] { const output: T[][] = []; for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size)); return output; }

async function previewSkuImport(): Promise<void> {
  if (!pendingImportItems?.length || !pendingSourceHash || !pendingImportId) return;
  const batches = chunks(pendingImportItems, SKU_CHUNK_SIZE); let inserted = 0; let updated = 0; let unchanged = 0; const conflicts: SkuNameChangeConflict[] = [];
  for (let index = 0; index < batches.length; index += 1) {
    skuStatus = `Đang đối chiếu master SKU: lô ${index + 1}/${batches.length} (${Math.min((index + 1) * SKU_CHUNK_SIZE, pendingImportItems.length).toLocaleString("vi-VN")}/${pendingImportItems.length.toLocaleString("vi-VN")})...`; render();
    const result = await importSkuChunk(batches[index], { requestId: `${pendingImportId}:preview:${index}`, sourceHash: pendingSourceHash, dryRun: true });
    inserted += result.inserted; updated += result.updated; unchanged += result.unchanged; conflicts.push(...(result.conflicts || []));
  }
  pendingDatabaseConflicts = conflicts;
  skuStatus = [`ĐỐI CHIẾU PASS`, `Tổng SKU: ${pendingImportItems.length.toLocaleString("vi-VN")}`, `Sẽ thêm mới: ${inserted.toLocaleString("vi-VN")}`, `Không đổi: ${unchanged.toLocaleString("vi-VN")}`, `Tên thay đổi cần xác nhận: ${updated.toLocaleString("vi-VN")}`].join("\n");
  if (!conflicts.length) await applySkuImport(false);
}

async function applySkuImport(confirmNameChanges: boolean): Promise<void> {
  if (!pendingImportItems?.length || !pendingSourceHash || !pendingImportId) return;
  busy = true; render(); const batches = chunks(pendingImportItems, SKU_CHUNK_SIZE); let inserted = 0; let updated = 0; let unchanged = 0;
  try {
    for (let index = 0; index < batches.length; index += 1) {
      skuStatus = `Đang ghi master SKU: lô ${index + 1}/${batches.length} (${Math.min((index + 1) * SKU_CHUNK_SIZE, pendingImportItems.length).toLocaleString("vi-VN")}/${pendingImportItems.length.toLocaleString("vi-VN")})...`; render();
      const result = await importSkuChunk(batches[index], { requestId: `${pendingImportId}:apply:${index}`, sourceHash: pendingSourceHash, confirmNameChanges });
      inserted += result.inserted; updated += result.updated; unchanged += result.unchanged;
    }
    const total = pendingImportItems.length; resetSkuImportState(); skuStatus = [`IMPORT PASS`, `Tổng SKU xử lý: ${total.toLocaleString("vi-VN")}`, `Thêm mới: ${inserted.toLocaleString("vi-VN")}`, `Cập nhật tên đã xác nhận: ${updated.toLocaleString("vi-VN")}`, `Không đổi: ${unchanged.toLocaleString("vi-VN")}`, `SKU không có trong file mới vẫn được giữ nguyên.`].join("\n"); await loadSkus("");
  } catch (error) { skuStatus = `GHI DỮ LIỆU CHƯA HOÀN TẤT\n${error instanceof Error ? error.message : "Không nhập được SKU."}\nCó thể thử lại; các lô đã ACK sẽ không bị ghi trùng.`; }
  finally { busy = false; render(); }
}

async function handleSkuSearch(): Promise<void> { await loadSkus(document.querySelector<HTMLInputElement>("#sku-query")?.value || ""); }
async function loadSkus(query: string): Promise<void> { try { skuRows = (await searchSkus(query, 100)).items; } catch (error) { message = error instanceof Error ? error.message : "Không tải được SKU."; } render(); }

async function restoreSession(): Promise<void> {
  if (!hasSession()) { render(); return; }
  try { profile = await getMyProfile(); activeSection = canOperate(profile) ? "operations" : "account"; if (canOperate(profile)) await loadOperations(false); }
  catch (error) { clearSession(); profile = null; message = error instanceof Error ? error.message : "Phiên đăng nhập không còn hợp lệ."; }
  render();
}

render();
void restoreSession();
