import "./styles.css";
import "./legacy-operational.css";
import { firebaseMissing, firebaseReady } from "./firebase";
import {
  applyHrPickerSync,
  changeMyPassword,
  clearSession,
  createManagedUser,
  getAdminDashboard,
  getAdminOperationalInsights,
  getAdminReporting,
  getAdminSla,
  getHrSource,
  getMyProfile,
  getReporterBatchTickets,
  getReporterQueue,
  getReporterRecent,
  getStoredProfile,
  hasSession,
  importSkuChunk,
  listManagedUsers,
  loginWithPassword,
  previewHrPickerSync,
  resolveReporterBatch,
  correctReporterBatch,
  saveAdminSla,
  saveHrSource,
  searchSkus,
  setManagedUserPassword,
  updateManagedUser,
  updatePickerAccounts,
  type AppProfile,
  type AdminDashboard,
  type AdminReportingRow,
  type BatchPickerTicket,
  type HrSourceResponse,
  type HrSyncPreview,
  type ManagedUser,
  type OperationalInsights,
  type ReporterBatch,
  type ReporterRecentBatch,
  type SkuItem,
  type SlaResponse,
} from "./api";
import { parseSkuExcel, type ParsedSkuWorkbook } from "./sku-excel";
import { registerRealtimeApplier, type RealtimeEventFrame } from "./realtime-client";
import {
  createPickerReport,
  getPickerReportsV2,
  getPickerResultsV2,
  getServiceHealth,
  markPickerResult,
  withdrawPickerReport,
  type PickerReportV2,
  type PickerResultV2,
} from "./operational-api";

const app = document.querySelector<HTMLDivElement>("#app")!;
const PRODUCT_CREDIT = "Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291";
const SKU_CHUNK_SIZE = 1000;

type Section =
  | "picker"
  | "operations"
  | "results"
  | "sku"
  | "hr"
  | "users"
  | "sla"
  | "dashboard"
  | "reports"
  | "system"
  | "account";

type Notice = { type: "success" | "error" | "warning"; text: string } | null;

let profile: AppProfile | null = getStoredProfile();
let activeSection: Section = profile?.role === "PICKER" ? "picker" : "operations";
let notice: Notice = null;
let busy = false;
let realtimeState = "connecting";
let realtimeLastSeq = 0;
let queueRows: ReporterBatch[] = [];
let recentRows: ReporterRecentBatch[] = [];
let batchDetails = new Map<string, BatchPickerTicket[]>();
let recentFilter: "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED" | "ALL" = "ALL";
let skipConfirm: ReporterBatch | null = null;
let slaResponse: SlaResponse | null = null;
let operationalInsights: OperationalInsights | null = null;
let managedUsers: ManagedUser[] = [];
let selectedUserIds = new Set<string>();
let hrSource: HrSourceResponse | null = null;
let hrPreview: HrSyncPreview | null = null;
let pendingWorkbook: ParsedSkuWorkbook | null = null;
let skuConflictChoices = new Map<string, string>();
let skuImportProgress = "";
let dashboardData: AdminDashboard | null = null;
let reportRows: AdminReportingRow[] = [];
let reportTotal = 0;
let reportOffset = 0;
const REPORT_PAGE_SIZE = 100;
let dashboardFrom = dateDaysAgo(6);
let dashboardTo = dateDaysAgo(0);
let reportFrom = dateDaysAgo(6);
let reportTo = dateDaysAgo(0);
let reportStatus = "";
let reportQuery = "";
let serviceHealth: Record<string, unknown> | null = null;
let pickerQuery = "";
let pickerSuggestions: SkuItem[] = [];
let pickerSelected: SkuItem | null = null;
let pickerReports: PickerReportV2[] = [];
let pickerResults: PickerResultV2[] = [];
let markedResultEvents = new Set<string>();
let pickerSearchGeneration = 0;
let userQuery = "";
let userRole = "";
let userStatus = "";
let userOffset = 0;
let userTotal = 0;
const USER_PAGE_SIZE = 100;
let editUserId: string | null = null;
let passwordUserId: string | null = null;
let dashboardLoadGeneration = 0;
let reportLoadGeneration = 0;

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN", { hour12: false });
}

function dateDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function todayKey(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function apiRange(from: string, to: string): { from: string; to: string } {
  const a = new Date(`${from}T00:00:00+07:00`);
  const b = new Date(`${to}T00:00:00+07:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) throw new Error("Khoảng ngày không hợp lệ.");
  return { from: a.toISOString(), to: new Date(b.getTime() + 86_400_000).toISOString() };
}

function setNotice(type: Notice extends infer _ ? "success" | "error" | "warning" : never, text: string): void {
  notice = { type, text };
}

function roleManage(): boolean {
  return Boolean(profile && (profile.role === "ADMIN" || profile.role === "ROOT"));
}

function roleOperate(): boolean {
  return Boolean(profile && ["REPORTER", "ADMIN", "ROOT"].includes(profile.role));
}

function onlineForMutation(): boolean {
  return navigator.onLine;
}

function slaLabel(state: string): string {
  if (state === "ESCALATED") return "SLA quá hạn";
  if (state === "WARNING") return "SLA cảnh báo";
  if (state === "NORMAL") return "SLA bình thường";
  return "SLA chưa cấu hình";
}

function statusLabel(status: string): string {
  if (status === "HAS_STOCK") return "Đã có hàng";
  if (status === "SKIP_ALLOWED") return "Đã cho skip";
  if (status === "CLOSED") return "Picker thu hồi";
  if (status === "PENDING" || status === "OPEN") return "Đang xử lý";
  if (status === "WITHDRAWN") return "Đã thu hồi";
  if (status === "RESOLVED") return "Đã xử lý";
  return status;
}

function renderNotice(): string {
  return notice ? `<div class="notice ${notice.type}">${esc(notice.text)}</div>` : "";
}

type UiFieldSnapshot = {
  id: string;
  name: string;
  value: string;
  checked: boolean | null;
};

type UiContextSnapshot = {
  section: Section;
  userId: string | null;
  scrollY: number;
  fields: UiFieldSnapshot[];
  activeId: string;
  activeName: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollBoxes: Array<{ className: string; index: number; top: number; left: number }>;
};

function captureUiContext(): UiContextSnapshot | null {
  const main = document.querySelector<HTMLElement>(".main");
  if (!main) return null;
  const active = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLSelectElement
    ? document.activeElement
    : null;
  const fields = [...main.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")]
    .filter((field) => !(field instanceof HTMLInputElement && field.type === "file"))
    .map((field) => ({
      id: field.id || "",
      name: field.name || "",
      value: field.value,
      checked: field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio") ? field.checked : null,
    }));
  const scrollBoxes = [".table-wrap", ".user-list", ".history-list", ".operation-list"].flatMap((className) =>
    [...main.querySelectorAll<HTMLElement>(className)].map((node, index) => ({
      className,
      index,
      top: node.scrollTop,
      left: node.scrollLeft,
    })),
  );
  return {
    section: activeSection,
    userId: profile?.user_id || null,
    scrollY: window.scrollY,
    fields,
    activeId: active?.id || "",
    activeName: active?.name || "",
    selectionStart: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null,
    selectionEnd: active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionEnd : null,
    scrollBoxes,
  };
}

function restoreUiContext(snapshot: UiContextSnapshot | null): void {
  if (!snapshot || snapshot.section !== activeSection || snapshot.userId !== (profile?.user_id || null)) return;
  const main = document.querySelector<HTMLElement>(".main");
  if (!main) return;
  for (const saved of snapshot.fields) {
    let field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
    if (saved.id) field = document.getElementById(saved.id) as typeof field;
    if (!field && saved.name) {
      field = [...main.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")]
        .find((candidate) => candidate.name === saved.name) || null;
    }
    if (!field) continue;
    field.value = saved.value;
    if (saved.checked != null && field instanceof HTMLInputElement) field.checked = saved.checked;
  }
  for (const saved of snapshot.scrollBoxes) {
    const node = [...main.querySelectorAll<HTMLElement>(saved.className)][saved.index];
    if (node) {
      node.scrollTop = saved.top;
      node.scrollLeft = saved.left;
    }
  }
  let active: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
  if (snapshot.activeId) active = document.getElementById(snapshot.activeId) as typeof active;
  if (!active && snapshot.activeName) {
    active = [...main.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")]
      .find((candidate) => candidate.name === snapshot.activeName) || null;
  }
  if (active) {
    active.focus({ preventScroll: true });
    if ((active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && snapshot.selectionStart != null && snapshot.selectionEnd != null) {
      try { active.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd); } catch { /* non-text input */ }
    }
  }
  requestAnimationFrame(() => window.scrollTo({ top: snapshot.scrollY }));
}

function activeContent(): string {
  if (activeSection === "picker") return renderPicker();
  if (activeSection === "operations") return renderOperations();
  if (activeSection === "results") return renderResults();
  if (activeSection === "sku") return renderSku();
  if (activeSection === "hr") return renderHr();
  if (activeSection === "users") return renderUsers();
  if (activeSection === "sla") return renderSla();
  if (activeSection === "dashboard") return renderDashboard();
  if (activeSection === "reports") return renderReports();
  if (activeSection === "system") return renderSystem();
  return renderAccount();
}

function mainMarkup(): string {
  return `${renderNotice()}${activeContent()}<div class="credit">${PRODUCT_CREDIT}</div>`;
}

function patchOverlays(): void {
  const root = document.querySelector<HTMLElement>("#overlay-root");
  if (!root) return;
  root.innerHTML = `${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}`;
  bindOverlay();
}

function patchActiveSection(preserveContext = true): void {
  const main = document.querySelector<HTMLElement>(".main");
  if (!main) {
    render();
    return;
  }
  const snapshot = preserveContext ? captureUiContext() : null;
  main.innerHTML = mainMarkup();
  bindSection();
  patchOverlays();
  restoreUiContext(snapshot);
}

function navButton(section: Section, label: string): string {
  return `<button class="nav-button ${activeSection === section ? "active" : ""}" data-section="${section}">${esc(label)}</button>`;
}

function navGroup(title: string, rows: Array<[Section, string]>): string {
  return `<div class="nav-group"><div class="nav-group-title">${esc(title)}</div>${rows.map(([id, label]) => navButton(id, label)).join("")}</div>`;
}

function renderNav(): string {
  if (!profile) return "";
  if (profile.role === "PICKER") {
    return navGroup("Vận hành", [["picker", "Báo hàng"]]) + navGroup("Hệ thống", [["system", "Trạng thái"], ["account", "Tài khoản"]]);
  }
  if (profile.role === "REPORTER") {
    return navGroup("Vận hành", [["operations", "Hàng đang xử lý"], ["results", "Kết quả gần đây"]]) + navGroup("Tài khoản", [["account", "Đổi mật khẩu"]]);
  }
  return [
    navGroup("Vận hành", [["operations", "Hàng đang xử lý"], ["results", "Kết quả gần đây"]]),
    navGroup("Dữ liệu", [["sku", "Master SKU"], ["hr", "Nguồn nhân sự"]]),
    navGroup("Quản trị", [["users", "Tài khoản & Picker"], ["sla", "Cấu hình SLA"]]),
    navGroup("Báo cáo", [["dashboard", "Tổng quan"], ["reports", "Báo cáo chi tiết"]]),
    navGroup("Hệ thống", [["system", "Trạng thái & chẩn đoán"], ["account", "Tài khoản"]]),
  ].join("");
}

function renderLogin(): void {
  app.innerHTML = `<main class="login-page"><section class="login-card">
    <div class="brand"><div class="brand-mark">1291</div><div><h1>BÁO HÀNG 1291</h1><div class="muted tiny">SUPRA Inventory · Beta</div></div></div>
    ${!firebaseReady ? `<div class="notice warning">Thiếu cấu hình Firebase Web: ${esc(firebaseMissing.join(", "))}</div>` : ""}
    ${renderNotice()}
    <form id="login-form">
      <div class="field"><span>Mã nhân viên / tên đăng nhập</span><input name="username" autocomplete="username" required /></div>
      <div class="field"><span>Mật khẩu</span><input name="password" type="password" autocomplete="current-password" required /></div>
      <button class="btn" ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "Đăng nhập"}</button>
    </form>
    <div class="credit">${PRODUCT_CREDIT}</div>
  </section></main>`;
  document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      profile = await loginWithPassword(String(data.get("username") || "").trim(), String(data.get("password") || ""));
      activeSection = profile.role === "PICKER" ? "picker" : "operations";
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
      render();
    });
  });
}

function renderShell(content: string): void {
  if (!profile) return renderLogin();
  const identity = `${profile.employee_code || profile.user_id} · ${profile.display_name}`;
  app.innerHTML = `<div class="shell">
    <header class="topbar"><div class="brand"><div class="brand-mark">1291</div><div class="brand-copy"><div class="brand-title">BÁO HÀNG 1291</div><div class="brand-sub">${esc(identity)} · ${esc(profile.role)}</div></div></div>
      <div class="top-tools"><span class="connection ${esc(realtimeState)}" id="connection-state">${esc(realtimeState === "connected" ? `Realtime · #${realtimeLastSeq}` : realtimeState)}</span><button class="btn secondary small" id="logout">Thoát</button></div></header>
    <div class="layout"><aside class="sidebar">${renderNav()}</aside><main class="main">${renderNotice()}${content}<div class="credit">${PRODUCT_CREDIT}</div></main></div>
    ${renderSkipModal()}${renderCriticalResult()}
  </div>`;
  bindShell();
}

function renderSkipModal(): string {
  if (!skipConfirm) return "";
  return `<div class="modal"><div class="modal-box"><h2>CHO PHÉP SKIP?</h2>
    <div class="sku-code">${esc(skipConfirm.sku)}</div><div class="product-name">${esc(skipConfirm.product_name)}</div>
    <p>Thao tác này sẽ cho phép <strong>${Number(skipConfirm.affected_picker_count)} Picker</strong> đang bị ảnh hưởng skip SKU này.</p>
    <div class="modal-actions"><button class="btn secondary" id="cancel-skip">HUỶ</button><button class="btn danger" id="confirm-skip">XÁC NHẬN CHO SKIP</button></div></div></div>`;
}

function renderCriticalResult(): string {
  if (profile?.role !== "PICKER") return "";
  const result = pickerResults.find((row) => !row.acknowledged_at);
  if (!result) return "";
  const isSkip = result.resolution === "SKIP_ALLOWED";
  return `<div class="critical-result"><div class="critical-box ${isSkip ? "skip-result" : ""}">
    <h2>${isSkip ? "ĐƯỢC PHÉP SKIP" : "ĐÃ CÓ HÀNG"}</h2>
    <div class="critical-sku">${esc(result.sku)}</div><div class="product-name">${esc(result.product_name)}</div>
    <p>${isSkip ? "Reporter đã xác nhận SKU này được phép skip." : "Reporter đã xác nhận SKU này đã có hàng."}</p>
    <button class="btn report-button ${isSkip ? "danger" : "success"}" id="ack-result" data-event="${esc(result.result_event_id)}">XÁC NHẬN ĐÃ NHẬN</button>
  </div></div>`;
}

function render(): void {
  if (!profile) return renderLogin();
  let content = "";
  if (activeSection === "picker") content = renderPicker();
  else if (activeSection === "operations") content = renderOperations();
  else if (activeSection === "results") content = renderResults();
  else if (activeSection === "sku") content = renderSku();
  else if (activeSection === "hr") content = renderHr();
  else if (activeSection === "users") content = renderUsers();
  else if (activeSection === "sla") content = renderSla();
  else if (activeSection === "dashboard") content = renderDashboard();
  else if (activeSection === "reports") content = renderReports();
  else if (activeSection === "system") content = renderSystem();
  else content = renderAccount();
  renderShell(content);
  bindSection();
}

function renderOperations(): string {
  return `<section><div class="page-head"><div><h1>Hàng đang xử lý</h1><p>${queueRows.length} SKU/batch đang chờ Reporter xử lý.</p></div><div class="toolbar"><button class="btn secondary" id="refresh-operations">Làm mới</button></div></div>
    <div class="operation-list">${queueRows.length ? queueRows.map(renderOperationRow).join("") : `<div class="card empty">Không có SKU đang chờ xử lý.</div>`}</div></section>`;
}

function renderOperationRow(row: ReporterBatch): string {
  const sla_state = row.sla_state;
  const recurrence = row.previous_batch_id ? `<span class="badge">Tái phát${row.recurrence_minutes != null ? ` · ${Math.round(row.recurrence_minutes / 60)}h` : ""}</span>` : "";
  const details = batchDetails.get(row.batch_id);
  return `<article class="operation-row ${sla_state === "ESCALATED" ? "escalated" : sla_state === "WARNING" ? "warning" : ""}">
    <div><div class="sku-code">${esc(row.sku)}</div><div class="product-name">${esc(row.product_name)}</div></div>
    <div><div class="operation-count">${Number(row.affected_picker_count)} Picker</div><div class="tiny muted">Phiên bản ${Number(row.version || 1)}</div></div>
    <div class="operation-meta"><span>${Number(row.waiting_minutes || 0)} phút</span><span class="badge ${sla_state === "ESCALATED" ? "escalated" : sla_state === "WARNING" ? "warning" : sla_state === "NORMAL" ? "ok" : ""}">${esc(slaLabel(sla_state))}</span>${recurrence}<span>Báo đầu ${esc(fmt(row.first_report_at))}</span></div>
    <div class="operation-actions"><button class="btn success" data-resolve="HAS_STOCK" data-batch="${esc(row.batch_id)}">CÓ HÀNG</button><button class="btn danger" data-skip-batch="${esc(row.batch_id)}">CHO SKIP HÀNG</button><button class="btn secondary" data-detail="${esc(row.batch_id)}">${details ? "Ẩn Picker" : "Picker"}</button></div>
    ${details ? `<div class="detail"><div class="detail-list">${details.map((item) => `<span class="picker-chip"><strong>${esc(item.picker_employee_code)}</strong> · ${esc(item.picker_display_name || "—")} · ${esc(fmt(item.reported_at))}</span>`).join("")}</div></div>` : ""}
  </article>`;
}

function renderResults(): string {
  const visible = recentRows.filter((row) => recentFilter === "ALL" || row.status === recentFilter);
  return `<section><div class="page-head"><div><h1>Kết quả gần đây</h1><p>Trạng thái đã xử lý và tiến độ Picker xác nhận kết quả.</p></div><button class="btn secondary" id="refresh-results">Làm mới</button></div>
    <div class="filters">${(["ALL", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"] as const).map((id) => `<button class="filter ${recentFilter === id ? "active" : ""}" data-result-filter="${id}">${id === "ALL" ? "Tất cả" : statusLabel(id)}</button>`).join("")}</div>
    <div class="table-wrap"><table><thead><tr><th>SKU / Sản phẩm</th><th>Kết quả</th><th>Picker</th><th>Xác nhận</th><th>Thời gian</th><th>Tái phát</th><th></th></tr></thead><tbody>
      ${visible.map((row) => { const canCorrect = row.status === "SKIP_ALLOWED" && row.correction_deadline_at && Date.now() <= Date.parse(row.correction_deadline_at); return `<tr><td><strong>${esc(row.sku)}</strong><div class="tiny muted">${esc(row.product_name)}</div></td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : "closed"}">${esc(statusLabel(row.status))}</span></td><td>${Number(row.affected_picker_count)}</td><td>${row.status === "CLOSED" ? "—" : `${Number(row.acknowledged_count || 0)}/${Number(row.ack_target_count || 0)} Picker`}</td><td>${esc(fmt(row.resolved_at || row.first_report_at))}</td><td>${row.previous_batch_id ? `<span class="badge">Tái phát</span>` : "—"}</td><td>${canCorrect ? `<button class="btn secondary small" data-correct="${esc(row.batch_id)}">Sửa thành Có hàng</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Chưa có dữ liệu.</td></tr>`}
    </tbody></table></div></section>`;
}

function renderPicker(): string {
  const today = dateDaysAgo(0);
  const reports = pickerReports.filter((row) => todayKey(row.reported_at) === today);
  return `<section class="picker-workspace"><div class="page-head"><div><h1>Báo SKU hết hàng</h1><p>Chỉ gửi khi đã chọn đúng SKU từ Master và đang có kết nối dịch vụ.</p></div></div>
    <div class="card"><input id="picker-sku-input" class="sku-input picker-input" placeholder="Nhập / quét SKU" value="${esc(pickerQuery)}" autocomplete="off" />
      ${pickerSuggestions.length ? `<div class="suggestions">${pickerSuggestions.slice(0, 12).map((item) => `<button class="suggestion" data-pick-sku="${esc(item.sku)}"><strong>${esc(item.sku)}</strong> · ${esc(item.product_name)}</button>`).join("")}</div>` : ""}
      <div class="selected-sku">${pickerSelected ? `<strong>${esc(pickerSelected.sku)}</strong><span>${esc(pickerSelected.product_name)}</span>` : `<span>Chưa chọn SKU hợp lệ</span>`}</div>
      <button id="picker-report" class="btn report-button" ${!pickerSelected || !onlineForMutation() || busy ? "disabled" : ""}>BÁO HẾT HÀNG</button>
      ${!onlineForMutation() ? `<div class="notice warning">Cần kết nối mạng để báo hàng. Hệ thống không có chế độ offline.</div>` : ""}
    </div>
    <div class="page-head"><div><h1 style="font-size:18px">BÁO HÔM NAY</h1></div><button class="btn secondary small" id="refresh-picker">Làm mới</button></div>
    <div class="history-list">${reports.length ? reports.map((row) => { const state = row.batch_status === "HAS_STOCK" ? "ok" : row.batch_status === "SKIP_ALLOWED" ? "skip" : row.status === "WITHDRAWN" || row.batch_status === "CLOSED" ? "closed" : "pending"; const canWithdraw = row.status === "OPEN" && Date.now() <= Date.parse(row.withdraw_deadline_at); return `<article class="history-card ${state}"><div><strong>${esc(row.sku)}</strong><div class="product-name">${esc(row.product_name)}</div><div class="tiny muted">${esc(fmt(row.reported_at))} · ${esc(statusLabel(row.batch_status || row.status))}${row.result_event_id && !row.acknowledged_at ? " · Chưa xác nhận kết quả" : ""}</div></div>${canWithdraw ? `<button class="btn secondary small" data-withdraw="${esc(row.ticket_id)}">Thu hồi</button>` : ""}</article>`; }).join("") : `<div class="card empty">Hôm nay chưa có báo hàng.</div>`}</div>
  </section>`;
}

function renderSku(): string {
  const wb = pendingWorkbook;
  return `<section><div class="page-head"><div><h1>Master SKU</h1><p>Nhập Excel 10.000–50.000 dòng theo chunk an toàn; không xoá SKU cũ khi file mới không chứa.</p></div></div>
    <div class="card"><div class="field"><span>File Excel .xlsx</span><input id="sku-file" type="file" accept=".xlsx" /></div>${skuImportProgress ? `<div class="notice">${esc(skuImportProgress)}</div>` : ""}
      ${wb ? `<div class="status-line"><span class="badge ok">${wb.total_data_rows.toLocaleString("vi-VN")} dòng</span><span class="badge">${wb.items.length.toLocaleString("vi-VN")} SKU sẵn sàng</span><span class="badge ${wb.conflicts.length ? "warning" : "ok"}">${wb.conflicts.length} SKU xung đột trong file</span></div>` : ""}
    </div>
    ${wb?.conflicts.length ? `<div class="card"><h3>Xử lý SKU có nhiều tên trong file</h3>${wb.conflicts.map((conflict) => `<div class="field" style="margin-bottom:10px"><span>${esc(conflict.sku)}</span><select data-sku-conflict="${esc(conflict.sku)}"><option value="">Chọn tên sản phẩm</option>${conflict.candidates.map((candidate) => `<option value="${esc(candidate.product_name)}" ${skuConflictChoices.get(conflict.sku) === candidate.product_name ? "selected" : ""}>${esc(candidate.product_name)} · dòng ${candidate.rows.join(", ")}</option>`).join("")}</select></div>`).join("")}<button class="btn" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật Master SKU</button></div>` : wb ? `<div class="card"><button class="btn" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật Master SKU</button></div>` : ""}
  </section>`;
}

function renderHr(): string {
  const source = hrSource?.source;
  return `<section><div class="page-head"><div><h1>Nguồn nhân sự</h1><p>Google Sheet được kiểm tra trước khi ghim. Đồng bộ Picker luôn Preview → Apply.</p></div></div>
    <form id="hr-source-form" class="card form-grid">
      <div class="field"><span>Link Google Sheet</span><input name="sheetUrl" value="${esc(source?.sheet_url || "")}" required /></div>
      <div class="field"><span>Tên tab</span><input name="tabName" value="${esc(source?.tab_name || "")}" required /></div>
      <div class="field"><span>Tên cột Mã nhân viên</span><input name="employeeCodeHeader" value="${esc(source?.mnv_header || "Mã nhân viên")}" required /></div>
      <div class="field"><span>Tên cột Họ và tên</span><input name="fullNameHeader" value="${esc(source?.full_name_header || "Họ và tên")}" required /></div>
      <div><button class="btn">Xác nhận nguồn</button></div>
    </form>
    <div class="card"><div class="toolbar"><button class="btn secondary" id="preview-hr">Preview Picker</button>${hrPreview ? `<button class="btn" id="apply-hr">Apply Picker</button>` : ""}</div>
      ${hrPreview ? `<div class="metrics" style="margin-top:12px"><div class="metric"><span>Nguồn</span><strong>${hrPreview.total_source}</strong></div><div class="metric"><span>Tạo mới</span><strong>${hrPreview.create}</strong></div><div class="metric"><span>Đổi tên</span><strong>${hrPreview.rename}</strong></div><div class="metric"><span>Không đổi</span><strong>${hrPreview.unchanged}</strong></div></div><div class="tiny muted">Không tự disable/delete/reactivate Picker chỉ vì thay nguồn HR.</div>` : `<div class="empty">Chưa preview.</div>`}
    </div></section>`;
}

function renderUsers(): string {
  const canCreateAdmin = profile?.role === "ROOT";
  return `<section><div class="page-head"><div><h1>Tài khoản & Picker</h1><p>ROOT quản lý Admin/Reporter; Admin quản lý Reporter; Picker lifecycle tách khỏi membership HR.</p></div><button class="btn secondary" id="refresh-users">Làm mới</button></div>
    <form id="create-user-form" class="card form-grid three"><div class="field"><span>Mã nhân viên / username</span><input name="username" required /></div><div class="field"><span>Họ tên</span><input name="displayName" required /></div><div class="field"><span>Vai trò</span><select name="role"><option value="REPORTER">REPORTER</option>${canCreateAdmin ? `<option value="ADMIN">ADMIN</option>` : ""}</select></div><div class="field"><span>Mật khẩu khởi tạo</span><input name="password" type="password" required /></div><div><button class="btn">Tạo tài khoản</button></div></form>
    <div class="card"><div class="toolbar"><button class="btn secondary small" data-picker-action="ENABLE">Mở lại Picker đã chọn</button><button class="btn secondary small" data-picker-action="DISABLE">Ngừng hoạt động</button><button class="btn danger small" data-picker-action="DELETE">Xóa Picker</button></div>
      <div class="user-list">${managedUsers.length ? managedUsers.map((user) => `<div class="user-row"><input type="checkbox" data-user-select="${esc(user.user_id)}" ${selectedUserIds.has(user.user_id) ? "checked" : ""} ${user.role !== "PICKER" ? "disabled" : ""}/><div><strong>${esc(user.employee_code || user.user_id)}</strong><div class="tiny muted">${esc(user.display_name)}</div></div><span class="badge">${esc(user.role)}</span><span class="badge ${user.status === "ACTIVE" ? "ok" : "closed"}">${esc(user.status)}</span><div class="toolbar"><button class="btn secondary small" data-edit-user="${esc(user.user_id)}">Sửa</button><button class="btn secondary small" data-password-user="${esc(user.user_id)}">Đổi mật khẩu</button></div></div>`).join("") : `<div class="empty">Chưa có dữ liệu người dùng.</div>`}</div>
    </div></section>`;
}

function renderSla(): string {
  const sla = slaResponse?.sla;
  const insight = operationalInsights?.sla;
  return `<section><div class="page-head"><div><h1>Cấu hình SLA</h1><p>SLA chỉ cảnh báo/escalate; không tự Có hàng hoặc tự Skip và không đổi công thức ưu tiên queue.</p></div></div>
    <div class="section-grid"><form id="sla-form" class="card"><h3>Ngưỡng xử lý</h3>${slaResponse && !slaResponse.configured ? `<div class="notice warning">SLA chưa cấu hình</div>` : ""}<div class="form-grid"><div class="field"><span>Cảnh báo sau (phút)</span><input name="warning" type="number" min="1" max="10080" value="${esc(sla?.warning_minutes || "")}" required /></div><div class="field"><span>Escalate sau (phút)</span><input name="escalation" type="number" min="2" max="20160" value="${esc(sla?.escalation_minutes || "")}" required /></div></div><button class="btn" style="margin-top:12px">Lưu SLA</button></form>
      <div class="card"><h3>Trạng thái hiện tại</h3><div class="metrics"><div class="metric"><span>Cảnh báo</span><strong>${Number(insight?.warning_count || 0)}</strong></div><div class="metric"><span>Escalated</span><strong>${Number(insight?.escalated_count || 0)}</strong></div></div><div class="tiny muted">Trạng thái sla_state do server tính theo thời gian báo đầu tiên.</div></div></div>
  </section>`;
}

function renderDashboard(): string {
  const k = dashboardData?.kpis;
  const recurrence = operationalInsights?.recurrence?.top_skus || [];
  return `<section><div class="page-head"><div><h1>Tổng quan vận hành</h1><p>Module phân tích dành cho Admin/Root; không thay thế live queue.</p></div></div>
    <form id="dashboard-filter" class="card form-grid three"><div class="field"><span>Từ ngày</span><input name="from" type="date" value="${esc(dashboardFrom)}" /></div><div class="field"><span>Đến ngày</span><input name="to" type="date" value="${esc(dashboardTo)}" /></div><div><button class="btn">Áp dụng</button></div></form>
    <div class="metrics"><div class="metric"><span>Báo hàng</span><strong>${Number(k?.reports_count || 0)}</strong></div><div class="metric"><span>SKU</span><strong>${Number(k?.unique_sku_count || 0)}</strong></div><div class="metric"><span>Đang chờ</span><strong>${Number(k?.pending_batch_count || 0)}</strong></div><div class="metric"><span>TB xử lý (phút)</span><strong>${k?.avg_resolution_minutes ?? "—"}</strong></div></div>
    <div class="section-grid"><div class="card"><h3>Top SKU bị báo</h3>${dashboardData?.top_skus?.length ? dashboardData.top_skus.map((row) => `<div class="status-line" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid #e6ebe8"><span><strong>${esc(row.sku)}</strong> · ${esc(row.product_name)}</span><span>${row.report_count} báo</span></div>`).join("") : `<div class="empty">Chưa có dữ liệu.</div>`}</div><div class="card"><h3>SKU tái phát</h3>${recurrence.length ? recurrence.map((row) => `<div class="status-line" style="justify-content:space-between;padding:7px 0;border-bottom:1px solid #e6ebe8"><span><strong>${esc(row.sku)}</strong> · ${esc(row.product_name)}</span><span class="badge">Tái phát ${row.recurrence_count}</span></div>`).join("") : `<div class="empty">Chưa ghi nhận tái phát trong kỳ.</div>`}</div></div>
  </section>`;
}

function renderReports(): string {
  return `<section><div class="page-head"><div><h1>Báo cáo chi tiết</h1><p>Truy vấn bounded theo tối đa 60 ngày, không load toàn bộ dữ liệu vào trình duyệt.</p></div></div>
    <form id="report-filter" class="card form-grid three"><div class="field"><span>Từ ngày</span><input name="from" type="date" value="${esc(reportFrom)}" /></div><div class="field"><span>Đến ngày</span><input name="to" type="date" value="${esc(reportTo)}" /></div><div class="field"><span>Trạng thái</span><select name="status"><option value="">Tất cả</option>${["PENDING","HAS_STOCK","SKIP_ALLOWED","CLOSED"].map((s) => `<option value="${s}" ${reportStatus === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("")}</select></div><div class="field"><span>SKU / tên sản phẩm</span><input name="query" value="${esc(reportQuery)}" /></div><div><button class="btn">Lọc</button></div></form>
    <div class="card"><div class="status-line" style="justify-content:space-between"><strong>${reportTotal.toLocaleString("vi-VN")} bản ghi</strong><div class="toolbar"><button class="btn secondary small" id="report-prev" ${reportOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="btn secondary small" id="report-next" ${reportOffset + REPORT_PAGE_SIZE >= reportTotal ? "disabled" : ""}>Trang sau</button></div></div></div>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Trạng thái</th><th>Báo đầu</th><th>Xử lý</th><th>Phút</th><th>Ticket</th></tr></thead><tbody>${reportRows.map((row) => `<tr><td><strong>${esc(row.sku)}</strong></td><td>${esc(row.product_name)}</td><td>${esc(statusLabel(row.status))}</td><td>${esc(fmt(row.first_report_at))}</td><td>${esc(fmt(row.resolved_at))}</td><td>${row.duration_minutes ?? "—"}</td><td>${row.total_ticket_count}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div>
  </section>`;
}

function renderSystem(): string {
  const safe = serviceHealth ? JSON.stringify(serviceHealth, (key, value) => /token|password|secret|private|key/i.test(key) ? "[REDACTED]" : value, 2) : "Chưa tải trạng thái dịch vụ.";
  return `<section><div class="page-head"><div><h1>Trạng thái & chẩn đoán</h1><p>Log hỗ trợ chỉ chứa trạng thái kỹ thuật đã giới hạn và che thông tin nhạy cảm.</p></div><button class="btn secondary" id="refresh-system">Kiểm tra dịch vụ</button></div><div class="card"><div class="status-line"><span class="badge ${navigator.onLine ? "ok" : "escalated"}">Mạng: ${navigator.onLine ? "Online" : "Mất kết nối"}</span><span class="badge">Realtime: ${esc(realtimeState)}</span><span class="badge">Seq: ${realtimeLastSeq}</span></div></div><pre class="diagnostics">${esc(safe)}</pre></section>`;
}

function renderAccount(): string {
  return `<section><div class="page-head"><div><h1>Tài khoản</h1><p>${esc(profile?.employee_code || profile?.user_id)} · ${esc(profile?.display_name)} · ${esc(profile?.role)}</p></div></div><form id="password-form" class="card" style="max-width:520px"><div class="field"><span>Mật khẩu hiện tại</span><input name="current" type="password" required /></div><div class="field" style="margin-top:10px"><span>Mật khẩu mới</span><input name="next" type="password" required /></div><button class="btn" style="margin-top:12px">Đổi mật khẩu</button></form></section>`;
}

async function run(fn: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  notice = null;
  try { await fn(); }
  catch (error) { setNotice("error", error instanceof Error ? error.message : "Thao tác thất bại."); }
  finally { busy = false; render(); }
}

async function loadOperations(): Promise<void> {
  const [queue, recent] = await Promise.all([getReporterQueue(200), getReporterRecent(200)]);
  queueRows = queue.items;
  recentRows = recent.items;
}

async function loadPicker(): Promise<void> {
  const [reports, results] = await Promise.all([getPickerReportsV2(120), getPickerResultsV2(120)]);
  pickerReports = reports.items;
  pickerResults = results.items;
  for (const result of pickerResults.filter((row) => !row.acknowledged_at && !markedResultEvents.has(row.result_event_id))) {
    markedResultEvents.add(result.result_event_id);
    void markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "RECEIVED")
      .then(() => markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "DISPLAYED"))
      .catch(() => markedResultEvents.delete(result.result_event_id));
  }
}

async function loadSla(): Promise<void> {
  const range = apiRange(dateDaysAgo(6), dateDaysAgo(0));
  [slaResponse, operationalInsights] = await Promise.all([getAdminSla(), getAdminOperationalInsights(range.from, range.to)]);
}

async function loadDashboard(): Promise<void> {
  const range = apiRange(dashboardFrom, dashboardTo);
  [dashboardData, operationalInsights] = await Promise.all([getAdminDashboard(range.from, range.to), getAdminOperationalInsights(range.from, range.to)]);
}

async function loadReports(): Promise<void> {
  const range = apiRange(reportFrom, reportTo);
  const result = await getAdminReporting({ from: range.from, to: range.to, status: reportStatus, query: reportQuery, limit: REPORT_PAGE_SIZE, offset: reportOffset });
  reportRows = result.items;
  reportTotal = result.total;
}

async function loadSection(section: Section): Promise<void> {
  if (!profile) return;
  if ((section === "operations" || section === "results") && roleOperate()) await loadOperations();
  else if (section === "picker" && profile.role === "PICKER") await loadPicker();
  else if (section === "hr" && roleManage()) hrSource = await getHrSource();
  else if (section === "users" && roleManage()) managedUsers = (await listManagedUsers()).items;
  else if (section === "sla" && roleManage()) await loadSla();
  else if (section === "dashboard" && roleManage()) await loadDashboard();
  else if (section === "reports" && roleManage()) await loadReports();
  else if (section === "system") serviceHealth = await getServiceHealth().catch(() => null);
}

function bindShell(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.section as Section;
    if (!next || next === activeSection) return;
    activeSection = next;
    notice = null;
    void run(async () => { await loadSection(next); });
  }));
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", () => {
    clearSession();
    profile = null;
    notice = null;
    window.dispatchEvent(new CustomEvent("supra:session-changed"));
    renderLogin();
  });
  document.querySelector<HTMLButtonElement>("#cancel-skip")?.addEventListener("click", () => { skipConfirm = null; render(); });
  document.querySelector<HTMLButtonElement>("#confirm-skip")?.addEventListener("click", () => {
    if (!skipConfirm) return;
    const batch = skipConfirm;
    skipConfirm = null;
    void run(async () => { await resolveReporterBatch(batch.batch_id, "SKIP_ALLOWED"); await loadOperations(); setNotice("success", `${batch.sku} đã được cho phép skip.`); });
  });
  document.querySelector<HTMLButtonElement>("#ack-result")?.addEventListener("click", () => {
    const result = pickerResults.find((row) => row.result_event_id === document.querySelector<HTMLButtonElement>("#ack-result")?.dataset.event);
    if (!result) return;
    void run(async () => { await markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "ACKNOWLEDGED"); await loadPicker(); setNotice("success", "Đã xác nhận nhận kết quả."); });
  });
}

function bindSection(): void {
  document.querySelector<HTMLButtonElement>("#refresh-operations")?.addEventListener("click", () => void run(loadOperations));
  document.querySelector<HTMLButtonElement>("#refresh-results")?.addEventListener("click", () => void run(loadOperations));
  document.querySelectorAll<HTMLButtonElement>("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
    const batchId = button.dataset.batch || "";
    const row = queueRows.find((item) => item.batch_id === batchId);
    if (!row) return;
    void run(async () => { await resolveReporterBatch(batchId, "HAS_STOCK"); await loadOperations(); setNotice("success", `${row.sku} đã xác nhận Có hàng.`); });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-skip-batch]").forEach((button) => button.addEventListener("click", () => {
    skipConfirm = queueRows.find((item) => item.batch_id === button.dataset.skipBatch) || null;
    render();
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-detail]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.detail || "";
    if (batchDetails.has(id)) { batchDetails.delete(id); render(); return; }
    void run(async () => { batchDetails.set(id, (await getReporterBatchTickets(id)).items); });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-correct]").forEach((button) => button.addEventListener("click", () => void run(async () => { await correctReporterBatch(button.dataset.correct || ""); await loadOperations(); setNotice("success", "Đã sửa kết quả thành Có hàng."); })));
  document.querySelectorAll<HTMLButtonElement>("[data-result-filter]").forEach((button) => button.addEventListener("click", () => { recentFilter = button.dataset.resultFilter as typeof recentFilter; render(); }));

  const pickerInput = document.querySelector<HTMLInputElement>("#picker-sku-input");
  let searchTimer = 0;
  pickerInput?.addEventListener("input", () => {
    pickerQuery = pickerInput.value.trim();
    pickerSelected = pickerSelected?.sku === pickerQuery ? pickerSelected : null;
    window.clearTimeout(searchTimer);
    if (pickerQuery.length < 3) { pickerSuggestions = []; render(); return; }
    searchTimer = window.setTimeout(() => { void searchSkus(pickerQuery, 20).then((result) => { pickerSuggestions = result.items; render(); }).catch(() => undefined); }, 180);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-pick-sku]").forEach((button) => button.addEventListener("click", () => {
    pickerSelected = pickerSuggestions.find((item) => item.sku === button.dataset.pickSku) || null;
    pickerQuery = pickerSelected?.sku || pickerQuery;
    pickerSuggestions = [];
    render();
  }));
  document.querySelector<HTMLButtonElement>("#picker-report")?.addEventListener("click", () => {
    if (!pickerSelected || !onlineForMutation()) return;
    const sku = pickerSelected.sku;
    void run(async () => { await createPickerReport(sku); pickerSelected = null; pickerQuery = ""; pickerSuggestions = []; await loadPicker(); setNotice("success", `${sku} đã được báo hết hàng.`); });
  });
  document.querySelector<HTMLButtonElement>("#refresh-picker")?.addEventListener("click", () => void run(loadPicker));
  document.querySelectorAll<HTMLButtonElement>("[data-withdraw]").forEach((button) => button.addEventListener("click", () => void run(async () => { await withdrawPickerReport(button.dataset.withdraw || ""); await loadPicker(); setNotice("success", "Đã thu hồi báo hàng."); })));

  document.querySelector<HTMLInputElement>("#sku-file")?.addEventListener("change", (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    void run(async () => { pendingWorkbook = await parseSkuExcel(file); skuConflictChoices.clear(); skuImportProgress = `Đã đọc ${pendingWorkbook.total_data_rows.toLocaleString("vi-VN")} dòng.`; });
  });
  document.querySelectorAll<HTMLSelectElement>("[data-sku-conflict]").forEach((select) => select.addEventListener("change", () => { if (select.value) skuConflictChoices.set(select.dataset.skuConflict || "", select.value); else skuConflictChoices.delete(select.dataset.skuConflict || ""); }));
  document.querySelector<HTMLButtonElement>("#apply-sku-import")?.addEventListener("click", () => void run(importSkuWorkbook));

  document.querySelector<HTMLFormElement>("#hr-source-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); void run(async () => { await saveHrSource(String(data.get("sheetUrl") || ""), String(data.get("tabName") || ""), String(data.get("employeeCodeHeader") || ""), String(data.get("fullNameHeader") || "")); hrSource = await getHrSource(); hrPreview = null; setNotice("success", "Đã xác nhận và ghim nguồn nhân sự."); });
  });
  document.querySelector<HTMLButtonElement>("#preview-hr")?.addEventListener("click", () => void run(async () => { hrPreview = await previewHrPickerSync(); }));
  document.querySelector<HTMLButtonElement>("#apply-hr")?.addEventListener("click", () => void run(async () => { await applyHrPickerSync(); hrPreview = await previewHrPickerSync(); setNotice("success", "Đã áp dụng đồng bộ Picker."); }));

  document.querySelector<HTMLButtonElement>("#refresh-users")?.addEventListener("click", () => void run(async () => { managedUsers = (await listManagedUsers()).items; }));
  document.querySelector<HTMLFormElement>("#create-user-form")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); void run(async () => { await createManagedUser(String(data.get("username") || ""), String(data.get("displayName") || ""), String(data.get("role") || "REPORTER") as "ADMIN" | "REPORTER", String(data.get("password") || "")); managedUsers = (await listManagedUsers()).items; setNotice("success", "Đã tạo tài khoản."); }); });
  document.querySelectorAll<HTMLInputElement>("[data-user-select]").forEach((box) => box.addEventListener("change", () => { const id = box.dataset.userSelect || ""; if (box.checked) selectedUserIds.add(id); else selectedUserIds.delete(id); }));
  document.querySelectorAll<HTMLButtonElement>("[data-picker-action]").forEach((button) => button.addEventListener("click", () => { const action = button.dataset.pickerAction as "ENABLE" | "DISABLE" | "DELETE"; const ids = [...selectedUserIds]; if (!ids.length) { setNotice("warning", "Chọn ít nhất một Picker."); render(); return; } if (action === "DELETE" && !window.confirm(`Xóa ${ids.length} Picker đã chọn? Lịch sử nghiệp vụ vẫn được giữ.`)) return; void run(async () => { await updatePickerAccounts(action, ids); managedUsers = (await listManagedUsers()).items; selectedUserIds.clear(); setNotice("success", "Đã cập nhật Picker."); }); }));
  document.querySelectorAll<HTMLButtonElement>("[data-edit-user]").forEach((button) => button.addEventListener("click", () => { const user = managedUsers.find((row) => row.user_id === button.dataset.editUser); if (!user) return; const name = window.prompt("Họ tên", user.display_name); if (name == null) return; const status = window.confirm("OK = ACTIVE, Cancel = DISABLED") ? "ACTIVE" : "DISABLED"; void run(async () => { await updateManagedUser(user.user_id, name.trim(), status); managedUsers = (await listManagedUsers()).items; }); }));
  document.querySelectorAll<HTMLButtonElement>("[data-password-user]").forEach((button) => button.addEventListener("click", () => { const password = window.prompt("Nhập mật khẩu mới"); if (!password) return; void run(async () => { await setManagedUserPassword(button.dataset.passwordUser || "", password); setNotice("success", "Đã đổi mật khẩu tài khoản."); }); }));

  document.querySelector<HTMLFormElement>("#sla-form")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); void run(async () => { const warning = Number(data.get("warning")); const escalation = Number(data.get("escalation")); if (!Number.isInteger(warning) || !Number.isInteger(escalation) || warning < 1 || escalation <= warning) throw new Error("Escalate phải lớn hơn cảnh báo và cả hai phải là số nguyên dương."); await saveAdminSla(warning, escalation); await loadSla(); setNotice("success", "Đã lưu cấu hình SLA."); }); });
  document.querySelector<HTMLFormElement>("#dashboard-filter")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); dashboardFrom = String(data.get("from")); dashboardTo = String(data.get("to")); void run(loadDashboard); });
  document.querySelector<HTMLFormElement>("#report-filter")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); reportFrom = String(data.get("from")); reportTo = String(data.get("to")); reportStatus = String(data.get("status") || ""); reportQuery = String(data.get("query") || ""); reportOffset = 0; void run(loadReports); });
  document.querySelector<HTMLButtonElement>("#report-prev")?.addEventListener("click", () => { reportOffset = Math.max(0, reportOffset - REPORT_PAGE_SIZE); void run(loadReports); });
  document.querySelector<HTMLButtonElement>("#report-next")?.addEventListener("click", () => { reportOffset += REPORT_PAGE_SIZE; void run(loadReports); });
  document.querySelector<HTMLButtonElement>("#refresh-system")?.addEventListener("click", () => void run(async () => { serviceHealth = await getServiceHealth(); }));
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); void run(async () => { await changeMyPassword(String(data.get("current") || ""), String(data.get("next") || "")); setNotice("success", "Đã đổi mật khẩu."); }); });
}

async function importSkuWorkbook(): Promise<void> {
  const wb = pendingWorkbook;
  if (!wb) throw new Error("Chưa chọn file Excel.");
  if (wb.conflicts.some((conflict) => !skuConflictChoices.get(conflict.sku))) throw new Error("Cần chọn tên sản phẩm cho toàn bộ SKU xung đột trong file.");
  const items: SkuItem[] = [...wb.items, ...wb.conflicts.map((conflict) => ({ sku: conflict.sku, product_name: skuConflictChoices.get(conflict.sku)! }))];
  const databaseConflicts: string[] = [];
  for (let offset = 0; offset < items.length; offset += SKU_CHUNK_SIZE) {
    const chunk = items.slice(offset, offset + SKU_CHUNK_SIZE);
    skuImportProgress = `Kiểm tra ${Math.min(offset + chunk.length, items.length).toLocaleString("vi-VN")} / ${items.length.toLocaleString("vi-VN")} SKU...`;
    render();
    const result = await importSkuChunk(chunk, { requestId: crypto.randomUUID(), sourceHash: wb.source_hash, dryRun: true });
    for (const conflict of result.conflicts || []) databaseConflicts.push(`${conflict.sku}: ${conflict.current_product_name} → ${conflict.incoming_product_name}`);
  }
  if (databaseConflicts.length && !window.confirm(`Có ${databaseConflicts.length} SKU đổi tên so với Master hiện tại. Xác nhận cập nhật tên?\n\n${databaseConflicts.slice(0, 15).join("\n")}`)) {
    skuImportProgress = "Đã dừng trước khi cập nhật vì chưa xác nhận đổi tên SKU hiện hữu.";
    return;
  }
  let processed = 0;
  for (let offset = 0; offset < items.length; offset += SKU_CHUNK_SIZE) {
    const chunk = items.slice(offset, offset + SKU_CHUNK_SIZE);
    await importSkuChunk(chunk, { requestId: crypto.randomUUID(), sourceHash: wb.source_hash, confirmNameChanges: databaseConflicts.length > 0 });
    processed += chunk.length;
    skuImportProgress = `Đã cập nhật ${processed.toLocaleString("vi-VN")} / ${items.length.toLocaleString("vi-VN")} SKU.`;
    render();
  }
  pendingWorkbook = null;
  skuConflictChoices.clear();
  setNotice("success", `Hoàn tất cập nhật ${items.length.toLocaleString("vi-VN")} SKU.`);
}

async function reconcileActive(): Promise<boolean> {
  const scrollY = window.scrollY;
  try {
    if ((activeSection === "operations" || activeSection === "results") && roleOperate()) await loadOperations();
    else if (activeSection === "picker" && profile?.role === "PICKER") await loadPicker();
    else return true;
    render();
    requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
    return true;
  } catch {
    // Realtime client keeps the applied cursor unchanged and retries dirty state.
    return false;
  }
}

registerRealtimeApplier(async (events: RealtimeEventFrame[], context) => {
  realtimeLastSeq = context.cursorSeq;
  if (context.source === "reconcile") return reconcileActive();

  const scopes = new Set(events.flatMap((row) => row.scopes || []));
  const pickerRelevant = profile?.role === "PICKER" && activeSection === "picker" && scopes.has("picker_reports");
  const reporterRelevant =
    roleOperate() &&
    (activeSection === "operations" || activeSection === "results") &&
    (scopes.has("reporter_queue") || scopes.has("reporter_recent"));

  if (!pickerRelevant && !reporterRelevant) return true;
  return reconcileActive();
});

window.addEventListener("supra:realtime-status", (event) => {
  const detail = (event as CustomEvent<{ state?: string; lastSeq?: number; dirty?: boolean }>).detail || {};
  realtimeState = detail.state || realtimeState;
  realtimeLastSeq = Number(detail.lastSeq ?? realtimeLastSeq);
  const node = document.querySelector<HTMLElement>("#connection-state");
  if (node) {
    node.className = `connection ${realtimeState}`;
    const dirtySuffix = detail.dirty ? " · đang khôi phục" : "";
    node.textContent = realtimeState === "connected"
      ? `Realtime · #${realtimeLastSeq}${dirtySuffix}`
      : `${realtimeState}${dirtySuffix}`;
  }
});
window.addEventListener("online", () => { realtimeState = "connecting"; render(); });
window.addEventListener("offline", () => { realtimeState = "offline"; render(); });

async function bootstrap(): Promise<void> {
  if (!hasSession()) { renderLogin(); return; }
  try {
    profile = await getMyProfile();
    activeSection = profile.role === "PICKER" ? "picker" : "operations";
    await loadSection(activeSection);
    render();
    window.dispatchEvent(new CustomEvent("supra:session-changed"));
  } catch (error) {
    clearSession();
    profile = null;
    setNotice("error", error instanceof Error ? error.message : "Phiên đăng nhập không hợp lệ.");
    renderLogin();
  }
}

void bootstrap();
