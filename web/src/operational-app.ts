import "./styles.css";
import "./legacy-operational.css";
import "./legacy-transplant/style.css";
import "./legacy-transplant/workflow-dashboard-v5.css";
import "./legacy-transplant/warehouse-ui-v2.css";
import "./legacy-transplant/ops-console.css";
import "./legacy-transplant/workflow-v3-overrides.css";
import "./legacy-transplant/workflow-v4-ux.css";
import "./legacy-transplant/web-fast-ui.css";
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
  setRootEffectiveRole,
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
  type SlaState,
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
const PRODUCT_CREDIT = "Xây dựng và phát triển bởi tamnv2 - Chuyên viên Pick Pack 1291";
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
  | "devices"
  | "logs"
  | "versions"
  | "account";

type Notice = { type: "success" | "error" | "warning"; text: string } | null;
type ThemeMode = "AUTO" | "LIGHT" | "DARK";

const THEME_KEY = "supra_inventory_web_theme_v1";

function loadThemeMode(): ThemeMode {
  const raw = String(localStorage.getItem(THEME_KEY) || "AUTO").toUpperCase();
  return raw === "LIGHT" || raw === "DARK" ? raw : "AUTO";
}

function autoThemeIsDark(): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  return hour >= 18 || hour < 6;
}

let themeMode: ThemeMode = loadThemeMode();

function applyTheme(): void {
  const resolved = themeMode === "AUTO" ? (autoThemeIsDark() ? "dark" : "light") : themeMode.toLowerCase();
  document.body.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#0f172a" : "#087443");
}

applyTheme();

const ROUTABLE_SECTIONS: Section[] = [
  "picker", "operations", "results", "sku", "hr", "users", "sla", "dashboard", "reports", "system", "devices", "logs", "versions", "account",
];

function defaultSectionForProfile(value: AppProfile): Section {
  if (value.role === "PICKER") return "picker";
  if (value.role === "REPORTER") return "operations";
  return "dashboard";
}

function canAccessSection(section: Section, value: AppProfile): boolean {
  if (value.role === "PICKER") return ["picker", "system", "account"].includes(section);
  if (value.role === "REPORTER") return ["operations", "results", "account"].includes(section);
  return section !== "picker";
}

function legacyRoleLabel(value: AppProfile["role"]): string {
  if (value === "ROOT") return "Quản trị hệ thống";
  if (value === "ADMIN") return "Quản trị hệ thống";
  if (value === "REPORTER") return "Người báo hàng";
  return "Người lấy hàng";
}

function rootRoleOptionLabel(role: AppProfile["role"]): string {
  if (role === "ROOT") return "ROOT · Quản trị hệ thống";
  if (role === "ADMIN") return "ADMIN · Quản trị hệ thống";
  if (role === "REPORTER") return "REPORTER · Người báo hàng";
  return "PICKER · Người lấy hàng";
}

function clearRoleScopedViewState(): void {
  queueRows = [];
  recentRows = [];
  batchDetails.clear();
  pickerReports = [];
  pickerResults = [];
  pickerSuggestions = [];
  pickerSelected = null;
  managedUsers = [];
  selectedUserIds.clear();
  allPickerSelection = false;
  hrPreview = null;
  dashboardData = null;
  reportRows = [];
  reportTotal = 0;
  operationalInsights = null;
  selectedBatchId = null;
}

function sectionFromHash(): Section | null {
  const raw = window.location.hash.replace(/^#/, "").trim().toLowerCase();
  return ROUTABLE_SECTIONS.includes(raw as Section) ? (raw as Section) : null;
}

function resolveInitialSection(value: AppProfile): Section {
  const requested = sectionFromHash();
  return requested && canAccessSection(requested, value) ? requested : defaultSectionForProfile(value);
}

function syncSectionHash(section: Section): void {
  if (window.location.hash === `#${section}`) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${section}`);
}

let profile: AppProfile | null = getStoredProfile();
let activeSection: Section = profile ? resolveInitialSection(profile) : "operations";
let notice: Notice = null;
let busy = false;
let realtimeState = "connecting";
let realtimeLastSeq = 0;
let serviceReachable = false;
let lastWebUpdateAt: Date | null = null;
let queueRows: ReporterBatch[] = [];
let queueServerOffsetMs = 0;
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
let displayedResultEvents = new Set<string>();
let pickerSearchGeneration = 0;
let userQuery = "";
let userRole = "";
let userStatus = "";
let userOffset = 0;
let userTotal = 0;
let allPickerSelection = false;
const USER_PAGE_SIZE = 100;
let editUserId: string | null = null;
let passwordUserId: string | null = null;
let selectedBatchId: string | null = null;
let dashboardLoadGeneration = 0;
let reportLoadGeneration = 0;
let sessionViewGeneration = 0;

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

function formatHeaderUpdate(value: Date | null): string {
  if (!value) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.hour}:${p.minute} ${p.month}/${p.day}/${p.year}`;
}

function patchHeaderRuntime(): void {
  const service = document.querySelector<HTMLElement>("#service-state");
  if (service) {
    service.textContent = `Service: Cloudflare ${serviceReachable ? "ON" : "OFF"}`;
    service.dataset.state = serviceReachable ? "on" : "off";
  }
  const update = document.querySelector<HTMLElement>("#last-web-update");
  if (update) update.textContent = `Cập nhật: ${formatHeaderUpdate(lastWebUpdateAt)}`;
}

function markWebUpdateReceived(): void {
  lastWebUpdateAt = new Date();
  serviceReachable = true;
  patchHeaderRuntime();
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

function renderDatePresets(target: "dashboard" | "reports"): string {
  return `<div class="toolbar date-presets">
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="0">Hôm nay</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="6">7 ngày</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="29">30 ngày</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="59">60 ngày</button>
  </div>`;
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
  if (activeSection === "devices") return renderLegacyDevices();
  if (activeSection === "logs") return renderLegacyLogs();
  if (activeSection === "versions") return renderLegacyVersions();
  return renderAccount();
}

function mainMarkup(): string {
  return `${renderNotice()}${activeContent()}`;
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

function navIcon(key: string): string {
  const paths: Record<string, string> = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    operations: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    results: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8.5"/>',
    picker: '<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M7 9v6M10 8v8M13 9v6M16 8v8"/>',
    sku: '<path d="M4 6h16v12H4z"/><path d="M4 10h16M9 6v12"/>',
    hr: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.5 2.5-5.5 5.5-5.5s4.9 2 5.5 5.5M17 8v6M14 11h6"/>',
    users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 19c.6-3.5 2.5-5.5 5.5-5.5s4.9 2 5.5 5.5M14.5 14c2.8 0 4.8 1.5 5.5 4.5"/>',
    devices: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    sla: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    reports: '<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>',
    system: '<rect x="4" y="4" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/>',
    logs: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/>',
    versions: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/>',
    account: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4.2 3.1-6.5 7-6.5s6.2 2.3 7 6.5"/>',
    "group-operations": '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
    "group-management": '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z"/>',
    "group-infrastructure": '<path d="M4 7h16M4 17h16M7 4v6M17 14v6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="7" r="2"/>',
    "group-settings": '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  };
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.dashboard}</svg>`;
}

function navButton(section: Section, label: string): string {
  return `<button class="nav-button ${activeSection === section ? "active" : ""}" data-section="${section}"${activeSection === section ? ' aria-current="page"' : ""}>${navIcon(section)}<span>${esc(label)}</span></button>`;
}

function navGroup(title: string, rows: Array<[Section, string]>): string {
  const iconKey = title === "VẬN HÀNH" ? "group-operations" : title === "QUẢN LÝ" ? "group-management" : title === "HẠ TẦNG" ? "group-infrastructure" : "group-settings";
  return `<span class="nav-section-label" data-nav-section="${esc(title)}">${navIcon(iconKey)}<span>${esc(title)}</span></span>${rows.map(([id, label]) => navButton(id, label)).join("")}`;
}

function renderNav(): string {
  if (!profile) return "";
  if (profile.role === "PICKER") return navButton("picker", "Báo thiếu hàng");
  if (profile.role === "REPORTER") return navButton("operations", "Xử lý báo thiếu");
  return [
    navGroup("VẬN HÀNH", [["dashboard", "Tổng quan hôm nay"], ["operations", "Xử lý báo thiếu"], ["sku", "Danh mục SKU"], ["reports", "Báo cáo vận hành"]]),
    navGroup("QUẢN LÝ", [["users", "Nhân sự & tài khoản"], ["devices", "Thiết bị & thông báo"]]),
    navGroup("HẠ TẦNG", [["system", "Hạ tầng & chi phí"], ["logs", "Nhật ký hệ thống"]]),
    navGroup("THIẾT LẬP", [["sla", "Thời gian nghiệp vụ"], ["versions", "Phiên bản ứng dụng"]]),
  ].join("");
}

function renderLogin(): void {
  document.body.dataset.role = "";
  document.body.dataset.testRole = "";
  app.innerHTML = `<main class="login-shell"><section class="login-card">
    <div class="brand">1291</div><p class="eyebrow">BÁO HÀNG 1291</p><h1>Web nghiệp vụ</h1>
    <p class="muted">Đăng nhập bằng tài khoản Báo hàng 1291.</p>
    ${!firebaseReady ? `<div class="message" data-type="error">Thiếu cấu hình Firebase Web: ${esc(firebaseMissing.join(", "))}</div>` : ""}
    ${renderNotice()}
    <form id="login-form">
      <label>Mã nhân viên<input name="username" required autocomplete="username" placeholder="Nhập mã nhân viên" /></label>
      <label>Mật khẩu<input name="password" type="password" required autocomplete="current-password" placeholder="Nhập mật khẩu" /></label>
      <button class="primary wide" ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "ĐĂNG NHẬP"}</button>
    </form>
    <div class="login-actions"><button id="forgot-password" type="button" class="login-link">Lấy lại mật khẩu</button></div>
    <p class="security">${PRODUCT_CREDIT}</p>
  </section></main>`;
  document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      profile = await loginWithPassword(String(data.get("username") || "").trim(), String(data.get("password") || ""));
      sessionViewGeneration += 1;
      activeSection = resolveInitialSection(profile);
      syncSectionHash(activeSection);
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
      render();
    });
  });
}

function renderShell(content: string): void {
  if (!profile) return renderLogin();
  const visualRole = profile.role === "PICKER" ? "PICKER" : profile.role === "REPORTER" ? "INVENT" : "ADMIN";
  document.body.dataset.role = visualRole;
  document.body.dataset.testRole = "";
  app.innerHTML = `<div class="app-shell role-${esc(profile.role.toLowerCase())}">
    <header class="topbar">
      <div class="header-product">
        <p class="company-name">CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN</p>
        <h1>Website nghiệp vụ Inventory 1291</h1>
        <div class="header-runtime">
          <span id="service-state" data-state="${serviceReachable ? "on" : "off"}">Service: Cloudflare ${serviceReachable ? "ON" : "OFF"}</span>
          <span class="header-runtime-separator">|</span>
          <span id="last-web-update">Cập nhật: ${formatHeaderUpdate(lastWebUpdateAt)}</span>
        </div>
      </div>
      <div class="user header-user">
        <div class="header-user-identity">
          <strong>${esc(profile.display_name)}</strong>
          <span>${esc(legacyRoleLabel(profile.role))}</span>
        </div>
        <div class="header-controls">
          ${profile.base_role === "ROOT" ? `<label class="header-control root-role-control"><span>Kiểm tra quyền</span><select id="root-role-select">${(["ROOT","ADMIN","REPORTER","PICKER"] as AppProfile["role"][]).map((role) => `<option value="${role}" ${profile?.role === role ? "selected" : ""}>${esc(rootRoleOptionLabel(role))}</option>`).join("")}</select></label>` : ""}
          <label class="header-control theme-control"><span>Giao diện</span><select id="theme-mode"><option value="AUTO" ${themeMode === "AUTO" ? "selected" : ""}>Tự động</option><option value="LIGHT" ${themeMode === "LIGHT" ? "selected" : ""}>Sáng</option><option value="DARK" ${themeMode === "DARK" ? "selected" : ""}>Tối</option></select></label>
          <div class="user-actions"><button id="logout" class="ghost">Đăng xuất</button></div>
        </div>
      </div>
    </header>
    <nav class="tabs" data-shell-generation="legacy-direct-transplant">${renderNav()}</nav>
    <main id="content" class="content main">${renderNotice()}${content}</main>
    <footer id="appCopyright" class="app-footer">${PRODUCT_CREDIT}</footer>
    <div id="overlay-root">${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}</div>
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

function renderUserModals(): string {
  if (activeSection !== "users") return "";
  const editUser = editUserId ? managedUsers.find((row) => row.user_id === editUserId) : null;
  const passwordUser = passwordUserId ? managedUsers.find((row) => row.user_id === passwordUserId) : null;
  if (editUser) {
    return `<div class="modal"><div class="modal-box"><h2>Sửa tài khoản</h2>
      <div class="tiny muted">${esc(editUser.employee_code || editUser.user_id)} · ${esc(editUser.role)}</div>
      <form id="edit-user-form">
        <div class="field"><span>Họ tên</span><input name="displayName" value="${esc(editUser.display_name)}" required /></div>
        <div class="field" style="margin-top:10px"><span>Trạng thái</span><select name="status"><option value="ACTIVE" ${editUser.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option value="DISABLED" ${editUser.status === "DISABLED" ? "selected" : ""}>DISABLED</option></select></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-user-modal">Huỷ</button><button class="btn">Lưu</button></div>
      </form>
    </div></div>`;
  }
  if (passwordUser) {
    return `<div class="modal"><div class="modal-box"><h2>Đổi mật khẩu</h2>
      <div class="tiny muted">${esc(passwordUser.employee_code || passwordUser.user_id)} · ${esc(passwordUser.display_name)}</div>
      <form id="password-user-form">
        <div class="field"><span>Mật khẩu mới</span><input name="password" type="password" autocomplete="new-password" required /></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="cancel-user-modal">Huỷ</button><button class="btn">Xác nhận đổi</button></div>
      </form>
    </div></div>`;
  }
  return "";
}

function render(): void {
  if (!profile) return renderLogin();
  renderShell(activeContent());
  bindSection();
}

function renderOperations(): string {
  const hasStockCount = recentRows.filter((row) => row.status === "HAS_STOCK").length;
  const skipCount = recentRows.filter((row) => row.status === "SKIP_ALLOWED").length;
  const closedCount = recentRows.filter((row) => row.status === "CLOSED").length;
  const selected = queueRows.find((row) => row.batch_id === selectedBatchId) || queueRows[0] || null;
  if (selected && selectedBatchId !== selected.batch_id) selectedBatchId = selected.batch_id;
  const timing = selected ? liveQueueTiming(selected) : null;
  const selectedDetails = selected ? batchDetails.get(selected.batch_id) : null;
  return `<section id="fastEvents" class="fast-events">
    <div class="fast-page-head"><div><h2>Xử lý báo thiếu</h2></div></div>
    <div class="fast-buckets" role="tablist">
      <button class="active">Đang xử lý <b>${queueRows.length}</b></button>
      <button>Đã có hàng <b>${hasStockCount}</b></button>
      <button>Đã bỏ qua <b>${skipCount}</b></button>
      <button>Picker thu hồi <b>${closedCount}</b></button>
    </div>
    <div class="fast-workspace">
      <div class="fast-list" id="fastList" aria-live="polite">
        ${queueRows.length ? queueRows.map((row) => {
          const rowTiming = liveQueueTiming(row);
          const tone = rowTiming.state === "ESCALATED" ? "danger" : rowTiming.state === "WARNING" ? "open" : "work";
          return `<button class="fast-issue-row ${selected?.batch_id === row.batch_id ? "selected" : ""}" data-select-batch="${esc(row.batch_id)}">
            <span class="fast-sku">${esc(row.sku)}</span>
            <span class="fast-product">${esc(row.product_name)}</span>
            <span class="fast-meta"><b class="fast-status ${tone}">${esc(slaLabel(rowTiming.state))}</b><em>${Number(row.affected_picker_count)} Picker</em><em>${rowTiming.waiting} phút</em></span>
          </button>`;
        }).join("") : `<div class="fast-empty-row">Không có SKU trong nhóm này.</div>`}
      </div>
      <aside class="fast-detail" id="fastDetail">
        ${selected && timing ? `<div class="fast-detail-head"><div><span>SKU đang xử lý</span><h3>${esc(selected.sku)}</h3></div><b class="fast-status ${timing.state === "ESCALATED" ? "danger" : timing.state === "WARNING" ? "open" : "work"}">${esc(slaLabel(timing.state))}</b></div>
          <div class="fast-detail-name">${esc(selected.product_name)}</div>
          <dl class="fast-facts">
            <div><dt>Picker ảnh hưởng</dt><dd>${Number(selected.affected_picker_count)}</dd></div>
            <div><dt>Chờ xử lý</dt><dd data-wait-batch="${esc(selected.batch_id)}">${timing.waiting} phút</dd></div>
            <div><dt>Báo đầu</dt><dd>${esc(fmt(selected.first_report_at))}</dd></div>
            <div><dt>Phiên bản</dt><dd>v${Number(selected.version || 1)}</dd></div>
          </dl>
          ${selected.previous_batch_id ? `<div class="fast-warning">SKU tái phát từ đợt xử lý trước.</div>` : ""}
          <div class="fast-actions"><button class="primary" data-resolve="HAS_STOCK" data-batch="${esc(selected.batch_id)}">CÓ HÀNG</button><button class="danger" data-skip-batch="${esc(selected.batch_id)}">CHO SKIP HÀNG</button><button class="secondary" data-detail="${esc(selected.batch_id)}">${selectedDetails ? "Ẩn Picker" : "Picker"}</button></div>
          ${selectedDetails ? `<div class="detail" style="margin-top:10px"><div class="detail-list">${selectedDetails.map((item) => `<span class="picker-chip"><strong>${esc(item.picker_employee_code)}</strong> · ${esc(item.picker_display_name || "—")} · ${esc(fmt(item.reported_at))}</span>`).join("")}</div></div>` : ""}
        ` : `<div class="fast-empty"><strong>Chọn một SKU</strong><span>Chi tiết và thao tác sẽ hiển thị tại đây.</span></div>`}
      </aside>
    </div>
  </section>`;
}

function liveQueueTiming(row: ReporterBatch): { waiting: number; state: SlaState } {
  const now = Date.now() + queueServerOffsetMs;
  const first = Date.parse(row.first_report_at);
  const waiting = Number.isFinite(first) ? Math.max(0, Math.floor((now - first) / 60_000)) : Number(row.waiting_minutes || 0);
  const escalation = row.escalation_at ? Date.parse(row.escalation_at) : NaN;
  const warning = row.warning_at ? Date.parse(row.warning_at) : NaN;
  const state: SlaState = Number.isFinite(escalation) && now >= escalation
    ? "ESCALATED"
    : Number.isFinite(warning) && now >= warning
      ? "WARNING"
      : row.sla_state === "UNCONFIGURED"
        ? "UNCONFIGURED"
        : "NORMAL";
  return { waiting, state };
}

function renderOperationRow(row: ReporterBatch): string {
  const timing = liveQueueTiming(row);
  const sla_state = timing.state;
  const recurrence = row.previous_batch_id ? `<span class="badge">Tái phát${row.recurrence_minutes != null ? ` · ${Math.round(row.recurrence_minutes / 60)}h` : ""}</span>` : "";
  const details = batchDetails.get(row.batch_id);
  return `<article class="operation-row ${sla_state === "ESCALATED" ? "escalated" : sla_state === "WARNING" ? "warning" : ""}" data-operation-batch="${esc(row.batch_id)}">
    <div><div class="sku-code">${esc(row.sku)}</div><div class="product-name">${esc(row.product_name)}</div></div>
    <div><div class="operation-count">${Number(row.affected_picker_count)} Picker</div><div class="tiny muted">Phiên bản ${Number(row.version || 1)}</div></div>
    <div class="operation-meta"><span data-wait-batch="${esc(row.batch_id)}">${timing.waiting} phút</span><span data-sla-batch="${esc(row.batch_id)}" class="badge ${sla_state === "ESCALATED" ? "escalated" : sla_state === "WARNING" ? "warning" : sla_state === "NORMAL" ? "ok" : ""}">${esc(slaLabel(sla_state))}</span>${recurrence}<span>Báo đầu ${esc(fmt(row.first_report_at))}</span></div>
    <div class="operation-actions"><button class="btn success" data-resolve="HAS_STOCK" data-batch="${esc(row.batch_id)}">CÓ HÀNG</button><button class="btn danger" data-skip-batch="${esc(row.batch_id)}">CHO SKIP HÀNG</button><button class="btn secondary" data-detail="${esc(row.batch_id)}">${details ? "Ẩn Picker" : "Picker"}</button></div>
    ${details ? `<div class="detail"><div class="detail-list">${details.map((item) => `<span class="picker-chip"><strong>${esc(item.picker_employee_code)}</strong> · ${esc(item.picker_display_name || "—")} · ${esc(fmt(item.reported_at))}</span>`).join("")}</div></div>` : ""}
  </article>`;
}

function updateQueueClockDom(): void {
  if (activeSection !== "operations") return;
  for (const row of queueRows) {
    const timing = liveQueueTiming(row);
    const wait = document.querySelector<HTMLElement>(`[data-wait-batch="${CSS.escape(row.batch_id)}"]`);
    if (wait) wait.textContent = `${timing.waiting} phút`;
    const badge = document.querySelector<HTMLElement>(`[data-sla-batch="${CSS.escape(row.batch_id)}"]`);
    if (badge) {
      badge.textContent = slaLabel(timing.state);
      badge.className = `badge ${timing.state === "ESCALATED" ? "escalated" : timing.state === "WARNING" ? "warning" : timing.state === "NORMAL" ? "ok" : ""}`;
    }
    const card = document.querySelector<HTMLElement>(`[data-operation-batch="${CSS.escape(row.batch_id)}"]`);
    if (card) card.className = `operation-row ${timing.state === "ESCALATED" ? "escalated" : timing.state === "WARNING" ? "warning" : ""}`;
  }
}

function renderResults(): string {
  const visible = recentRows.filter((row) => recentFilter === "ALL" || row.status === recentFilter);
  return `<section><div class="page-head"><div><h1>Kết quả gần đây</h1></div></div>
    <div class="filters">${(["ALL", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"] as const).map((id) => `<button class="filter ${recentFilter === id ? "active" : ""}" data-result-filter="${id}">${id === "ALL" ? "Tất cả" : statusLabel(id)}</button>`).join("")}</div>
    <div class="table-wrap"><table><thead><tr><th>SKU / Sản phẩm</th><th>Kết quả</th><th>Picker</th><th>Xác nhận</th><th>Thời gian</th><th>Tái phát</th><th></th></tr></thead><tbody>
      ${visible.map((row) => { const canCorrect = row.status === "SKIP_ALLOWED" && row.correction_deadline_at && Date.now() <= Date.parse(row.correction_deadline_at); return `<tr><td><strong>${esc(row.sku)}</strong><div class="tiny muted">${esc(row.product_name)}</div></td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : "closed"}">${esc(statusLabel(row.status))}</span></td><td>${Number(row.affected_picker_count)}</td><td>${row.status === "CLOSED" ? "—" : `${Number(row.acknowledged_count || 0)}/${Number(row.ack_target_count || 0)} Picker`}</td><td>${esc(fmt(row.resolved_at || row.first_report_at))}</td><td>${row.previous_batch_id ? `<span class="badge">Tái phát</span>` : "—"}</td><td>${canCorrect ? `<button class="btn secondary small" data-correct="${esc(row.batch_id)}">Sửa thành Có hàng</button>` : ""}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Chưa có dữ liệu.</td></tr>`}
    </tbody></table></div></section>`;
}

function renderPicker(): string {
  const today = dateDaysAgo(0);
  const reports = pickerReports.filter((row) => todayKey(row.reported_at) === today);
  return `<section class="picker-workspace"><div class="page-head"><div><h1>Báo SKU hết hàng</h1></div></div>
    <div class="card"><input id="picker-sku-input" class="sku-input picker-input" placeholder="Nhập / quét SKU" value="${esc(pickerQuery)}" autocomplete="off" />
      ${pickerSuggestions.length ? `<div class="suggestions">${pickerSuggestions.slice(0, 12).map((item) => `<button class="suggestion" data-pick-sku="${esc(item.sku)}"><strong>${esc(item.sku)}</strong> · ${esc(item.product_name)}</button>`).join("")}</div>` : ""}
      <div class="selected-sku">${pickerSelected ? `<strong>${esc(pickerSelected.sku)}</strong><span>${esc(pickerSelected.product_name)}</span>` : `<span>Chưa chọn SKU hợp lệ</span>`}</div>
      <button id="picker-report" class="btn report-button" ${!pickerSelected || !onlineForMutation() || busy ? "disabled" : ""}>BÁO HẾT HÀNG</button>
      ${!onlineForMutation() ? `<div class="notice warning">Cần kết nối mạng để báo hàng. Hệ thống không có chế độ offline.</div>` : ""}
    </div>
    <div class="page-head"><div><h1 style="font-size:18px">BÁO HÔM NAY</h1></div></div>
    <div class="history-list">${reports.length ? reports.map((row) => { const state = row.batch_status === "HAS_STOCK" ? "ok" : row.batch_status === "SKIP_ALLOWED" ? "skip" : row.status === "WITHDRAWN" || row.batch_status === "CLOSED" ? "closed" : "pending"; const canWithdraw = row.status === "OPEN" && Date.now() <= Date.parse(row.withdraw_deadline_at); return `<article class="history-card ${state}"><div><strong>${esc(row.sku)}</strong><div class="product-name">${esc(row.product_name)}</div><div class="tiny muted">${esc(fmt(row.reported_at))} · ${esc(statusLabel(row.batch_status || row.status))}${row.result_event_id && !row.acknowledged_at ? " · Chưa xác nhận kết quả" : ""}</div></div>${canWithdraw ? `<button class="btn secondary small" data-withdraw="${esc(row.ticket_id)}">Thu hồi</button>` : ""}</article>`; }).join("") : `<div class="card empty">Hôm nay chưa có báo hàng.</div>`}</div>
  </section>`;
}

function renderSku(): string {
  const wb = pendingWorkbook;
  return `<section class="ops-route">
    <div class="heading"><div><h2>Danh mục SKU</h2></div></div>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Cập nhật Master SKU</h3></div></div>
      <div class="ops-form-grid"><label class="span">File Excel .xlsx<input id="sku-file" type="file" accept=".xlsx" /></label></div>
      ${skuImportProgress ? `<div class="message">${esc(skuImportProgress)}</div>` : ""}
      ${wb ? `<section class="ops-status-strip"><span><b>${wb.total_data_rows.toLocaleString("vi-VN")}</b> dòng dữ liệu</span><span><b>${wb.items.length.toLocaleString("vi-VN")}</b> SKU sẵn sàng</span><span><b>${wb.conflicts.length}</b> xung đột</span></section>` : ""}
    </article>
    ${wb?.conflicts.length ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Xử lý SKU trùng mã khác tên</h3><p>Chọn đúng tên sản phẩm trước khi cập nhật.</p></div></div><div class="ops-form-grid">${wb.conflicts.map((conflict) => `<label class="span">${esc(conflict.sku)}<select data-sku-conflict="${esc(conflict.sku)}"><option value="">Chọn tên sản phẩm</option>${conflict.candidates.map((candidate) => `<option value="${esc(candidate.product_name)}" ${skuConflictChoices.get(conflict.sku) === candidate.product_name ? "selected" : ""}>${esc(candidate.product_name)} · dòng ${candidate.rows.join(", ")}</option>`).join("")}</select></label>`).join("")}</div><div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật Master SKU</button></div></article>` : wb ? `<article class="ops-panel"><div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật Master SKU</button></div></article>` : ""}
  </section>`;
}

function renderHr(): string {
  const source = hrSource?.source;
  return `<section class="ops-route">
    <div class="heading"><div><h2>Nguồn danh sách nhân sự</h2></div></div>
    <article class="ops-panel ops-staff-source">
      <div class="ops-panel-title"><div><h3>Google Sheet nhân sự</h3><p>Nhập link, tên tab và đúng tên cột đang sử dụng.</p></div></div>
      <form id="hr-source-form" class="ops-form-grid">
        <label class="span">Link Google Sheet<input name="sheetUrl" value="${esc(source?.sheet_url || "")}" required /></label>
        <label>Tên tab<input name="tabName" value="${esc(source?.tab_name || "")}" required /></label>
        <label>Tên cột Mã nhân viên<input name="employeeCodeHeader" value="${esc(source?.mnv_header || "Mã nhân viên")}" required /></label>
        <label>Tên cột Họ và tên<input name="fullNameHeader" value="${esc(source?.full_name_header || "Họ và tên")}" required /></label>
        <div class="ops-form-actions"><button class="primary">Xác nhận nguồn</button></div>
      </form>
    </article>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Đồng bộ Picker</h3><p>Kiểm tra thay đổi trước khi áp dụng.</p></div></div>
      <div class="ops-form-actions"><button class="secondary" id="preview-hr">Xem trước</button>${hrPreview ? `<button class="primary" id="apply-hr">Áp dụng</button>` : ""}</div>
      ${hrPreview ? `<section class="ops-status-strip"><span>Nguồn <b>${hrPreview.total_source}</b></span><span>Tạo mới <b>${hrPreview.create}</b></span><span>Đổi tên <b>${hrPreview.rename}</b></span><span>Không đổi <b>${hrPreview.unchanged}</b></span></section>` : `<div class="ops-empty">Chưa có bản xem trước.</div>`}
    </article>
  </section>`;
}

function renderUsers(): string {
  const canCreateAdmin = profile?.role === "ROOT";
  const pageStart = userTotal ? userOffset + 1 : 0;
  const pageEnd = Math.min(userOffset + managedUsers.length, userTotal);
  const selectedCount = allPickerSelection ? userTotal : selectedUserIds.size;
  return `<section class="ops-route">
    <div class="heading"><div><h2>Nhân sự & tài khoản</h2></div></div>
    <article class="ops-panel ops-create-user">
      <div class="ops-panel-title"><div><h3>Tạo tài khoản</h3></div></div>
      <form id="create-user-form" class="ops-form-grid">
        <label>Mã nhân viên / username<input name="username" required /></label>
        <label>Họ tên<input name="displayName" required /></label>
        <label>Vai trò<select name="role"><option value="REPORTER">REPORTER</option>${canCreateAdmin ? `<option value="ADMIN">ADMIN</option>` : ""}</select></label>
        <label>Mật khẩu khởi tạo<input name="password" type="password" autocomplete="new-password" required /></label>
        <div class="ops-form-actions"><button class="primary">Tạo tài khoản</button></div>
      </form>
    </article>
    <article class="ops-panel ops-users-panel">
      <div class="ops-panel-title"><div><h3>Danh sách tài khoản</h3><p>${userTotal.toLocaleString("vi-VN")} tài khoản phù hợp.</p></div></div>
      <form id="user-filter-form" class="ops-form-grid">
        <label class="span">Tìm tài khoản<input name="query" value="${esc(userQuery)}" placeholder="MNV / họ tên / user id" /></label>
        <label>Vai trò<select name="role"><option value="">Tất cả</option>${["PICKER","REPORTER","ADMIN"].map((role) => `<option value="${role}" ${userRole === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
        <label>Trạng thái<select name="status"><option value="">Tất cả</option><option value="ACTIVE" ${userStatus === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option value="DISABLED" ${userStatus === "DISABLED" ? "selected" : ""}>DISABLED</option></select></label>
        <div class="ops-form-actions"><button class="secondary">Lọc</button></div>
      </form>
      <div class="ops-form-actions"><button class="secondary" id="toggle-all-pickers">${allPickerSelection ? "Bỏ chọn tất cả Picker" : "Chọn tất cả Picker"}</button><button class="secondary" data-picker-action="ENABLE">Mở lại Picker đã chọn</button><button class="secondary" data-picker-action="DISABLE">Ngừng hoạt động</button><button class="danger" data-picker-action="DELETE">Xóa Picker</button><span>${allPickerSelection ? "Tất cả Picker" : `${selectedCount} đã chọn`}</span></div>
      <div class="table-wrap"><table class="ops-users-table"><thead><tr><th></th><th>Mã nhân viên</th><th>Họ tên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        ${managedUsers.length ? managedUsers.map((user) => `<tr><td><input type="checkbox" data-user-select="${esc(user.user_id)}" ${allPickerSelection || selectedUserIds.has(user.user_id) ? "checked" : ""} ${user.role !== "PICKER" || allPickerSelection ? "disabled" : ""}/></td><td><b>${esc(user.employee_code || user.user_id)}</b></td><td>${esc(user.display_name)}</td><td>${esc(user.role)}</td><td><span class="badge ${user.status === "ACTIVE" ? "good" : ""}">${esc(user.status)}</span></td><td><button class="secondary" data-edit-user="${esc(user.user_id)}">Sửa</button> <button class="secondary" data-password-user="${esc(user.user_id)}">Đổi mật khẩu</button></td></tr>`).join("") : `<tr><td colspan="6" class="ops-empty">Không có tài khoản phù hợp.</td></tr>`}
      </tbody></table></div>
      <div class="ops-panel-title"><span>${pageStart}–${pageEnd} / ${userTotal.toLocaleString("vi-VN")}</span><div><button class="secondary" id="user-prev" ${userOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="user-next" ${userOffset + USER_PAGE_SIZE >= userTotal ? "disabled" : ""}>Trang sau</button></div></div>
    </article>
  </section>`;
}

function renderSla(): string {
  const sla = slaResponse?.sla;
  const insight = operationalInsights?.sla;
  return `<section class="ops-route">
    <div class="heading"><div><h2>Thời gian nghiệp vụ</h2></div></div>
    <form id="sla-form">
      <div class="ops-settings-grid">
        <article class="ops-setting-card"><span class="ops-step">01</span><h3>Cảnh báo</h3><p>Hiển thị cảnh báo khi SKU chờ quá mốc này.</p><label>Phút<input name="warning" type="number" min="1" max="1440" value="${esc(sla?.warning_minutes || "")}" required /></label></article>
        <article class="ops-setting-card"><span class="ops-step">02</span><h3>Quá hạn</h3><p>Đánh dấu mức cần chú ý cao hơn; không tự xử lý SKU.</p><label>Phút<input name="escalation" type="number" min="2" max="2880" value="${esc(sla?.escalation_minutes || "")}" required /></label></article>
      </div>
      <div class="ops-form-actions"><button class="primary">Lưu thời gian nghiệp vụ</button></div>
    </form>
    <section class="ops-status-strip"><span>Cảnh báo hiện tại <b>${Number(insight?.warning_count || 0)}</b></span><span>Quá hạn hiện tại <b>${Number(insight?.escalated_count || 0)}</b></span></section>
  </section>`;
}

function renderDashboard(): string {
  const k = dashboardData?.kpis;
  const recurrence = operationalInsights?.recurrence?.top_skus || [];
  const timeline = dashboardData?.timeline || [];
  const outcomes = dashboardData?.outcomes || [];
  const count = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const totalOutcomes = outcomes.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const pct = (value: number) => totalOutcomes > 0 ? Math.round(value * 100 / totalOutcomes) : 0;
  const hasStock = count("HAS_STOCK");
  const skipped = count("SKIP_ALLOWED");
  const withdrawn = count("CLOSED");
  const pending = Number(k?.pending_batch_count || 0);
  const hourly = Array.from({ length: 24 }, (_, index) => Number(timeline[index]?.reports || 0));
  const maxHour = Math.max(1, ...hourly);
  return `<section class="v5-root">
    <div class="v5-page-head"><div><h2>Tổng quan hôm nay</h2></div></div>
    <div class="v5-block"><div class="v5-block-head"><h3>Cần xử lý</h3></div>
      <div class="v5-kpi-grid v5-kpi-grid-3">
        <article class="v5-kpi blue"><span>Đang xử lý</span><strong>${pending}</strong><small>SKU đang mở</small></article>
        <article class="v5-kpi"><span>Quá mốc Inventory</span><strong>${Number(operationalInsights?.sla?.escalated_count || 0)}</strong><small>${operationalInsights?.sla?.config?.escalation_minutes ?? "—"} phút</small></article>
        <article class="v5-kpi amber"><span>Picker chờ xác nhận</span><strong>${Number(k?.pending_picker_count || 0)}</strong><small>đang ảnh hưởng</small></article>
      </div>
    </div>
    <div class="v5-block"><div class="v5-block-head"><h3>Kết quả hôm nay</h3></div>
      <div class="v5-kpi-grid v5-kpi-grid-4">
        <article class="v5-kpi green"><span>Đã có hàng</span><strong>${hasStock}</strong><small>${pct(hasStock)}%</small></article>
        <article class="v5-kpi"><span>Đã bỏ qua</span><strong>${skipped}</strong><small>${pct(skipped)}%</small></article>
        <article class="v5-kpi"><span>Picker thu hồi</span><strong>${withdrawn}</strong><small>${pct(withdrawn)}%</small></article>
        <article class="v5-kpi"><span>Tự động bỏ qua</span><strong>0</strong><small>không áp dụng</small></article>
      </div>
    </div>
    <div class="v5-layout-main">
      <article class="v5-panel"><div class="v5-panel-head"><h3>SKU ưu tiên</h3><span>${pending} SKU đang mở</span></div>
        ${pending === 0 ? `<div class="v5-empty v5-empty-good">Không có SKU đang chờ xử lý.</div>` : `<div class="v5-priority-table">${(dashboardData?.top_skus || []).slice(0,8).map((row) => `<div class="v5-priority-row"><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><b>${row.report_count} báo</b><span>${row.picker_count} Picker</span><button class="secondary" data-section="operations">Mở</button></div>`).join("")}</div>`}
      </article>
      <article class="v5-panel"><div class="v5-panel-head"><h3>Hiệu suất hôm nay</h3></div>
        <div class="v5-compact-grid">
          <div class="v5-compact-metric"><span>Lượt báo</span><b>${Number(k?.reports_count || 0)}</b></div>
          <div class="v5-compact-metric"><span>Đợt SKU</span><b>${Number(k?.unique_sku_count || 0)}</b></div>
          <div class="v5-compact-metric"><span>Xử lý trung vị</span><b>${k?.avg_resolution_minutes ?? "—"}</b></div>
          <div class="v5-compact-metric"><span>P95</span><b>—</b></div>
          <div class="v5-compact-metric"><span>Báo lại ≤30 phút</span><b>${recurrence.length}</b></div>
          <div class="v5-compact-metric"><span>Picker ACK trễ</span><b>0</b></div>
        </div>
        <div class="v5-outcome-bars">
          <div class="v5-outcome-line"><div><span>Đã có hàng</span><b>${hasStock}</b></div><div class="v5-track"><i class="green" style="width:${pct(hasStock)}%"></i></div><small>${pct(hasStock)}%</small></div>
          <div class="v5-outcome-line"><div><span>Đã bỏ qua</span><b>${skipped}</b></div><div class="v5-track"><i class="red" style="width:${pct(skipped)}%"></i></div><small>${pct(skipped)}%</small></div>
          <div class="v5-outcome-line"><div><span>Picker thu hồi</span><b>${withdrawn}</b></div><div class="v5-track"><i class="gray" style="width:${pct(withdrawn)}%"></i></div><small>${pct(withdrawn)}%</small></div>
        </div>
      </article>
    </div>
    <div class="v5-layout-bottom">
      <article class="v5-panel"><div class="v5-panel-head"><h3>Phát sinh 24 giờ</h3></div><div class="v5-hourly">${hourly.map((value, hour) => `<div class="v5-hour"><i style="height:${Math.max(value ? 6 : 2, value / maxHour * 100)}%"></i><span>${hour % 3 === 0 ? String(hour).padStart(2,"0") : ""}</span></div>`).join("")}</div></article>
      <article class="v5-panel"><div class="v5-panel-head"><h3>SKU phát sinh nhiều</h3></div>${dashboardData?.top_skus?.length ? `<div class="v5-rank-list">${dashboardData.top_skus.slice(0,8).map((row,index) => `<div class="v5-rank-row"><b>${index+1}</b><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><em>${row.report_count}</em></div>`).join("")}</div>` : `<div class="v5-empty">Chưa có dữ liệu.</div>`}</article>
    </div>
  </section>`;
}

function renderReports(): string {
  return `<section class="ops-route">
    <div class="heading"><div><h2>Báo cáo vận hành</h2></div><button class="secondary" id="export-reports">Xuất CSV</button></div>
    <article class="ops-panel">
      <form id="report-filter" class="ops-form-grid">
        <label>Từ ngày<input name="from" type="date" value="${esc(reportFrom)}" /></label>
        <label>Đến ngày<input name="to" type="date" value="${esc(reportTo)}" /></label>
        <label>Trạng thái<select name="status"><option value="">Tất cả</option>${["PENDING","HAS_STOCK","SKIP_ALLOWED","CLOSED"].map((state) => `<option value="${state}" ${reportStatus === state ? "selected" : ""}>${esc(statusLabel(state))}</option>`).join("")}</select></label>
        <label>SKU / tên sản phẩm<input name="query" value="${esc(reportQuery)}" /></label>
        <div class="ops-form-actions"><button class="primary">Lọc</button></div>
      </form>
      ${renderDatePresets("reports")}
    </article>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Chi tiết</h3><p>${reportTotal.toLocaleString("vi-VN")} bản ghi.</p></div><div><button class="secondary" id="report-prev" ${reportOffset <= 0 ? "disabled" : ""}>Trang trước</button> <button class="secondary" id="report-next" ${reportOffset + REPORT_PAGE_SIZE >= reportTotal ? "disabled" : ""}>Trang sau</button></div></div>
      <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Trạng thái</th><th>Báo đầu</th><th>Xử lý</th><th>Phút</th><th>Ticket</th></tr></thead><tbody>${reportRows.map((row) => `<tr><td><strong>${esc(row.sku)}</strong></td><td>${esc(row.product_name)}</td><td>${esc(statusLabel(row.status))}</td><td>${esc(fmt(row.first_report_at))}</td><td>${esc(fmt(row.resolved_at))}</td><td>${row.duration_minutes ?? "—"}</td><td>${row.total_ticket_count}</td></tr>`).join("") || `<tr><td colspan="7" class="ops-empty">Chưa có dữ liệu.</td></tr>`}</tbody></table></div>
    </article>
  </section>`;
}

function sanitizeDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 300);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      output[key] = /authorization|bearer|token|password|secret|private|credential|api.?key|refresh/i.test(key)
        ? "[REDACTED]"
        : sanitizeDiagnosticValue(item, depth + 1);
    }
    return output;
  }
  return String(value).slice(0, 300);
}

function supportDiagnostics(): Record<string, unknown> {
  return {
    format: "supra-inventory-support-v1",
    generated_at: new Date().toISOString(),
    app: {
      surface: "WEB",
      host: window.location.host,
    },
    network: {
      online: navigator.onLine,
    },
    realtime: {
      state: realtimeState,
      applied_seq: realtimeLastSeq,
    },
    ui: {
      section: activeSection,
    },
    service_health: serviceHealth ? sanitizeDiagnosticValue(serviceHealth) : null,
  };
}

function downloadSupportDiagnostics(): void {
  const body = JSON.stringify(supportDiagnostics(), null, 2).slice(0, 16_000);
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
  const link = document.createElement("a");
  link.href = url;
  link.download = `supra-inventory-beta-support-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderSystem(): string {
  const safe = serviceHealth ? JSON.stringify(sanitizeDiagnosticValue(serviceHealth), null, 2) : "Chưa tải trạng thái dịch vụ.";
  return `<section><div class="page-head"><div><h1>Trạng thái & chẩn đoán</h1></div><div class="toolbar"><button class="btn secondary" id="refresh-system">Kiểm tra dịch vụ</button><button class="btn secondary" id="download-support-log">Tạo log hỗ trợ</button></div></div><div class="card"><div class="status-line"><span class="badge ${navigator.onLine ? "ok" : "escalated"}">Mạng: ${navigator.onLine ? "Online" : "Mất kết nối"}</span><span class="badge">Realtime: ${esc(realtimeState)}</span><span class="badge">Seq: ${realtimeLastSeq}</span></div></div><pre class="diagnostics">${esc(safe)}</pre></section>`;
}


function renderLegacyDevices(): string {
  return `<section><div class="heading"><div><h2>Thiết bị & thông báo</h2></div></div><article class="ops-panel"><div class="ops-panel-title"><div><h3>Trạng thái thiết bị</h3></div></div><section class="ops-status-strip"><span>Kết nối <b>${navigator.onLine ? "Online" : "Offline"}</b></span><span>Realtime <b>${esc(realtimeState)}</b></span><span>Seq <b>${realtimeLastSeq}</b></span></section></article></section>`;
}

function renderLegacyLogs(): string {
  const safe = serviceHealth ? JSON.stringify(sanitizeDiagnosticValue(serviceHealth), null, 2) : "Chưa tải trạng thái dịch vụ.";
  return `<section><div class="heading"><div><h2>Nhật ký hệ thống</h2></div><button class="secondary" id="download-support-log">Tạo log hỗ trợ</button></div><article class="card"><pre class="diagnostics">${esc(safe)}</pre></article></section>`;
}

function renderLegacyVersions(): string {
  return `<section><div class="heading"><div><h2>Phiên bản ứng dụng</h2></div></div><article class="ops-panel"><div class="ops-panel-title"><div><h3>Ứng dụng Báo hàng 1291</h3></div></div><section class="ops-status-strip"><span>Web <b>Đang hoạt động</b></span><span>APK <b>Beta</b></span></section></article></section>`;
}

function renderAccount(): string {
  return `<section class="ops-route"><div class="heading"><div><h2>Đổi mật khẩu</h2><p class="muted">${esc(profile?.employee_code || profile?.user_id)} · ${esc(profile?.display_name)}</p></div></div><article class="ops-panel" style="max-width:620px"><form id="password-form" class="ops-form-grid"><label class="span">Mật khẩu hiện tại<input name="current" type="password" required /></label><label class="span">Mật khẩu mới<input name="next" type="password" required /></label><div class="ops-form-actions"><button class="primary">Đổi mật khẩu</button></div></form></article></section>`;
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
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [queue, recent] = await Promise.all([getReporterQueue(200), getReporterRecent(200)]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  const serverNow = queue.server_now ? Date.parse(queue.server_now) : NaN;
  queueServerOffsetMs = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
  queueRows = queue.items;
  recentRows = recent.items;
  markWebUpdateReceived();
}

async function loadPicker(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [reports, results] = await Promise.all([getPickerReportsV2(120), getPickerResultsV2(120)]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  pickerReports = reports.items;
  pickerResults = results.items;
  markWebUpdateReceived();
  for (const result of pickerResults.filter((row) => !row.acknowledged_at && !markedResultEvents.has(row.result_event_id))) {
    markedResultEvents.add(result.result_event_id);
    void markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "RECEIVED")
      .catch(() => markedResultEvents.delete(result.result_event_id));
  }
}

async function loadSla(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const range = apiRange(dateDaysAgo(6), dateDaysAgo(0));
  const [nextSla, nextInsights] = await Promise.all([getAdminSla(), getAdminOperationalInsights(range.from, range.to)]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  slaResponse = nextSla;
  operationalInsights = nextInsights;
  markWebUpdateReceived();
}

async function loadDashboard(): Promise<void> {
  const generation = ++dashboardLoadGeneration;
  const sessionGeneration = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const range = apiRange(dashboardFrom, dashboardTo);
  const [nextDashboard, nextInsights] = await Promise.all([
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
  ]);
  if (generation !== dashboardLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  dashboardData = nextDashboard;
  operationalInsights = nextInsights;
  markWebUpdateReceived();
}

async function loadReports(): Promise<void> {
  const generation = ++reportLoadGeneration;
  const sessionGeneration = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const range = apiRange(reportFrom, reportTo);
  const result = await getAdminReporting({
    from: range.from,
    to: range.to,
    status: reportStatus,
    query: reportQuery,
    limit: REPORT_PAGE_SIZE,
    offset: reportOffset,
  });
  if (generation !== reportLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  reportRows = result.items;
  reportTotal = result.total;
  markWebUpdateReceived();
}

async function loadUsers(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const result = await listManagedUsers({
    query: userQuery,
    role: userRole,
    status: userStatus,
    limit: USER_PAGE_SIZE,
    offset: userOffset,
  });
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  if (result.total > 0 && userOffset >= result.total) {
    userOffset = Math.max(0, Math.floor((result.total - 1) / USER_PAGE_SIZE) * USER_PAGE_SIZE);
    const retry = await listManagedUsers({
      query: userQuery,
      role: userRole,
      status: userStatus,
      limit: USER_PAGE_SIZE,
      offset: userOffset,
    });
    if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    managedUsers = retry.items;
    userTotal = retry.total;
    markWebUpdateReceived();
    return;
  }
  managedUsers = result.items;
  userTotal = result.total;
  markWebUpdateReceived();
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function exportReportsCsv(): Promise<void> {
  const range = apiRange(reportFrom, reportTo);
  const rows: AdminReportingRow[] = [];
  let offset = 0;
  let total = 0;
  const pageSize = 500;
  const maxRows = 100_000;

  do {
    const page = await getAdminReporting({
      from: range.from,
      to: range.to,
      status: reportStatus,
      query: reportQuery,
      limit: pageSize,
      offset,
    });
    total = page.total;
    rows.push(...page.items);
    offset += page.items.length;
    if (!page.items.length) break;
    if (rows.length > maxRows) throw new Error(`Bộ lọc có hơn ${maxRows.toLocaleString("vi-VN")} dòng; hãy thu hẹp khoảng ngày trước khi xuất.`);
  } while (offset < total);
  markWebUpdateReceived();

  const header = ["SKU","Tên sản phẩm","Trạng thái","Báo đầu","Xử lý","Thời gian xử lý (phút)","Ticket"];
  const body = rows.map((row) => [
    row.sku,
    row.product_name,
    statusLabel(row.status),
    row.first_report_at,
    row.resolved_at || "",
    row.duration_minutes ?? "",
    row.total_ticket_count,
  ].map(csvCell).join(","));
  const csv = "\uFEFF" + [header.map(csvCell).join(","), ...body].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
  const link = document.createElement("a");
  link.href = url;
  link.download = `supra-inventory-beta-report-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setNotice("success", `Đã xuất ${rows.length.toLocaleString("vi-VN")} dòng CSV theo bộ lọc hiện tại.`);
}

async function loadSection(section: Section): Promise<void> {
  if (!profile) return;
  let received = false;
  if ((section === "operations" || section === "results") && roleOperate()) { await loadOperations(); received = true; }
  else if (section === "picker" && profile.role === "PICKER") { await loadPicker(); received = true; }
  else if (section === "hr" && roleManage()) { hrSource = await getHrSource(); received = true; }
  else if (section === "users" && roleManage()) { await loadUsers(); received = true; }
  else if (section === "sla" && roleManage()) { await loadSla(); received = true; }
  else if (section === "dashboard" && roleManage()) { await loadDashboard(); received = true; }
  else if (section === "reports" && roleManage()) { await loadReports(); received = true; }
  else if (["system", "devices", "logs", "versions"].includes(section)) {
    try {
      serviceHealth = await getServiceHealth();
      received = true;
    } catch {
      serviceHealth = null;
      serviceReachable = false;
      patchHeaderRuntime();
    }
  }
  if (received) markWebUpdateReceived();
}

function bindShell(): void {
  const currentProfile = profile;
  if (!currentProfile) return;
  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.section as Section;
    if (!next || next === activeSection) return;
    if (!canAccessSection(next, currentProfile)) return;
    activeSection = next;
    syncSectionHash(next);
    notice = null;
    pickerSearchGeneration += 1;
    dashboardLoadGeneration += 1;
    reportLoadGeneration += 1;
    editUserId = null;
    passwordUserId = null;
    void run(async () => { await loadSection(next); });
  }));
  document.querySelector<HTMLSelectElement>("#theme-mode")?.addEventListener("change", (event) => {
    const next = String((event.currentTarget as HTMLSelectElement).value || "AUTO").toUpperCase();
    themeMode = next === "LIGHT" || next === "DARK" ? next : "AUTO";
    localStorage.setItem(THEME_KEY, themeMode);
    applyTheme();
  });
  document.querySelector<HTMLSelectElement>("#root-role-select")?.addEventListener("change", (event) => {
    if (!profile || profile.base_role !== "ROOT") return;
    const role = String((event.currentTarget as HTMLSelectElement).value || "ROOT") as AppProfile["role"];
    if (!["ROOT", "ADMIN", "REPORTER", "PICKER"].includes(role) || role === profile.role) return;
    void run(async () => {
      profile = await setRootEffectiveRole(role);
      sessionViewGeneration += 1;
      pickerSearchGeneration += 1;
      dashboardLoadGeneration += 1;
      reportLoadGeneration += 1;
      clearRoleScopedViewState();
      activeSection = defaultSectionForProfile(profile);
      syncSectionHash(activeSection);
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
    });
  });
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", () => {
    pickerSearchGeneration += 1;
    dashboardLoadGeneration += 1;
    reportLoadGeneration += 1;
    sessionViewGeneration += 1;
    clearSession();
    profile = null;
    notice = null;
    queueRows = [];
    recentRows = [];
    batchDetails.clear();
    pickerReports = [];
    pickerResults = [];
    pickerSuggestions = [];
    pickerSelected = null;
    markedResultEvents.clear();
    displayedResultEvents.clear();
    window.dispatchEvent(new CustomEvent("supra:session-changed"));
    renderLogin();
  });
  bindOverlay();
}

function bindOverlay(): void {
  document.querySelector<HTMLButtonElement>("#cancel-skip")?.addEventListener("click", () => {
    skipConfirm = null;
    patchOverlays();
  });
  document.querySelector<HTMLButtonElement>("#confirm-skip")?.addEventListener("click", () => {
    if (!skipConfirm) return;
    const batch = skipConfirm;
    skipConfirm = null;
    void run(async () => {
      await resolveReporterBatch(batch.batch_id, "SKIP_ALLOWED");
      await loadOperations();
      setNotice("success", `${batch.sku} đã được cho phép skip.`);
    });
  });

  const ack = document.querySelector<HTMLButtonElement>("#ack-result");
  const visibleResult = pickerResults.find((row) => row.result_event_id === ack?.dataset.event);
  if (ack && visibleResult && !visibleResult.acknowledged_at && !displayedResultEvents.has(visibleResult.result_event_id)) {
    displayedResultEvents.add(visibleResult.result_event_id);
    void markPickerResult(visibleResult.result_event_id, visibleResult.batch_id, visibleResult.batch_version, "DISPLAYED")
      .catch(() => displayedResultEvents.delete(visibleResult.result_event_id));
  }
  ack?.addEventListener("click", () => {
    const result = pickerResults.find((row) => row.result_event_id === ack.dataset.event);
    if (!result) return;
    void run(async () => {
      await markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "ACKNOWLEDGED");
      await loadPicker();
      setNotice("success", "Đã xác nhận nhận kết quả.");
    });
  });

  document.querySelector<HTMLButtonElement>("#cancel-user-modal")?.addEventListener("click", () => {
    editUserId = null;
    passwordUserId = null;
    patchOverlays();
  });
  document.querySelector<HTMLFormElement>("#edit-user-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const userId = editUserId;
    if (!userId) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const displayName = String(data.get("displayName") || "").trim();
    const status = String(data.get("status") || "") as "ACTIVE" | "DISABLED";
    void run(async () => {
      await updateManagedUser(userId, displayName, status);
      editUserId = null;
      await loadUsers();
      setNotice("success", "Đã cập nhật tài khoản.");
    });
  });
  document.querySelector<HTMLFormElement>("#password-user-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const userId = passwordUserId;
    if (!userId) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const password = String(data.get("password") || "");
    if (!password) return;
    void run(async () => {
      await setManagedUserPassword(userId, password);
      passwordUserId = null;
      await loadUsers();
      setNotice("success", "Đã đổi mật khẩu tài khoản.");
    });
  });
}

function bindSection(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-select-batch]").forEach((button) => button.addEventListener("click", () => {
    selectedBatchId = button.dataset.selectBatch || null;
    patchActiveSection();
  }));

  document.querySelectorAll<HTMLButtonElement>("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
    const batchId = button.dataset.batch || "";
    const row = queueRows.find((item) => item.batch_id === batchId);
    if (!row) return;
    void run(async () => {
      await resolveReporterBatch(batchId, "HAS_STOCK");
      await loadOperations();
      setNotice("success", `${row.sku} đã xác nhận Có hàng.`);
    });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-skip-batch]").forEach((button) => button.addEventListener("click", () => {
    skipConfirm = queueRows.find((item) => item.batch_id === button.dataset.skipBatch) || null;
    patchOverlays();
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-detail]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.detail || "";
    if (batchDetails.has(id)) {
      batchDetails.delete(id);
      patchActiveSection();
      return;
    }
    void run(async () => { batchDetails.set(id, (await getReporterBatchTickets(id)).items); });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-correct]").forEach((button) => button.addEventListener("click", () => void run(async () => {
    await correctReporterBatch(button.dataset.correct || "");
    await loadOperations();
    setNotice("success", "Đã sửa kết quả thành Có hàng.");
  })));
  document.querySelectorAll<HTMLButtonElement>("[data-result-filter]").forEach((button) => button.addEventListener("click", () => {
    recentFilter = button.dataset.resultFilter as typeof recentFilter;
    patchActiveSection();
  }));

  const pickerInput = document.querySelector<HTMLInputElement>("#picker-sku-input");
  let searchTimer = 0;
  pickerInput?.addEventListener("input", () => {
    pickerQuery = pickerInput.value.trim();
    pickerSelected = pickerSelected?.sku === pickerQuery ? pickerSelected : null;
    window.clearTimeout(searchTimer);
    const generation = ++pickerSearchGeneration;
    const requestedQuery = pickerQuery;
    if (requestedQuery.length < 3) {
      pickerSuggestions = [];
      patchActiveSection();
      return;
    }
    searchTimer = window.setTimeout(() => {
      void searchSkus(requestedQuery, 20)
        .then((result) => {
          if (
            generation !== pickerSearchGeneration ||
            requestedQuery !== pickerQuery ||
            activeSection !== "picker" ||
            profile?.role !== "PICKER"
          ) return;
          pickerSuggestions = result.items;
          patchActiveSection();
        })
        .catch(() => undefined);
    }, 180);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-pick-sku]").forEach((button) => button.addEventListener("click", () => {
    pickerSearchGeneration += 1;
    pickerSelected = pickerSuggestions.find((item) => item.sku === button.dataset.pickSku) || null;
    pickerQuery = pickerSelected?.sku || pickerQuery;
    pickerSuggestions = [];
    patchActiveSection();
  }));
  document.querySelector<HTMLButtonElement>("#picker-report")?.addEventListener("click", () => {
    if (!pickerSelected || !onlineForMutation()) return;
    const sku = pickerSelected.sku;
    pickerSearchGeneration += 1;
    void run(async () => {
      await createPickerReport(sku);
      pickerSelected = null;
      pickerQuery = "";
      pickerSuggestions = [];
      await loadPicker();
      setNotice("success", `${sku} đã được báo hết hàng.`);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-withdraw]").forEach((button) => button.addEventListener("click", () => void run(async () => {
    await withdrawPickerReport(button.dataset.withdraw || "");
    await loadPicker();
    setNotice("success", "Đã thu hồi báo hàng.");
  })));

  document.querySelector<HTMLInputElement>("#sku-file")?.addEventListener("change", (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    void run(async () => {
      pendingWorkbook = await parseSkuExcel(file);
      skuConflictChoices.clear();
      skuImportProgress = `Đã đọc ${pendingWorkbook.total_data_rows.toLocaleString("vi-VN")} dòng.`;
    });
  });
  document.querySelectorAll<HTMLSelectElement>("[data-sku-conflict]").forEach((select) => select.addEventListener("change", () => {
    if (select.value) skuConflictChoices.set(select.dataset.skuConflict || "", select.value);
    else skuConflictChoices.delete(select.dataset.skuConflict || "");
  }));
  document.querySelector<HTMLButtonElement>("#apply-sku-import")?.addEventListener("click", () => void run(importSkuWorkbook));

  document.querySelector<HTMLFormElement>("#hr-source-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await saveHrSource(
        String(data.get("sheetUrl") || ""),
        String(data.get("tabName") || ""),
        String(data.get("employeeCodeHeader") || ""),
        String(data.get("fullNameHeader") || ""),
      );
      hrSource = await getHrSource();
      hrPreview = null;
      setNotice("success", "Đã xác nhận và ghim nguồn nhân sự.");
    });
  });
  document.querySelector<HTMLButtonElement>("#preview-hr")?.addEventListener("click", () => void run(async () => {
    hrPreview = await previewHrPickerSync();
  }));
  document.querySelector<HTMLButtonElement>("#apply-hr")?.addEventListener("click", () => void run(async () => {
    await applyHrPickerSync();
    hrPreview = await previewHrPickerSync();
    setNotice("success", "Đã áp dụng đồng bộ Picker.");
  }));

  document.querySelector<HTMLFormElement>("#create-user-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await createManagedUser(
        String(data.get("username") || ""),
        String(data.get("displayName") || ""),
        String(data.get("role") || "REPORTER") as "ADMIN" | "REPORTER",
        String(data.get("password") || ""),
      );
      await loadUsers();
      setNotice("success", "Đã tạo tài khoản.");
    });
  });
  document.querySelector<HTMLFormElement>("#user-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    userQuery = String(data.get("query") || "").trim();
    userRole = String(data.get("role") || "");
    userStatus = String(data.get("status") || "");
    userOffset = 0;
    selectedUserIds.clear();
    allPickerSelection = false;
    void run(loadUsers);
  });
  document.querySelector<HTMLButtonElement>("#toggle-all-pickers")?.addEventListener("click", () => {
    allPickerSelection = !allPickerSelection;
    selectedUserIds.clear();
    patchActiveSection();
  });
  document.querySelectorAll<HTMLInputElement>("[data-user-select]").forEach((box) => box.addEventListener("change", () => {
    const id = box.dataset.userSelect || "";
    if (box.checked) selectedUserIds.add(id);
    else selectedUserIds.delete(id);
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-picker-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.pickerAction as "ENABLE" | "DISABLE" | "DELETE";
    const ids = [...selectedUserIds];
    if (!allPickerSelection && !ids.length) {
      setNotice("warning", "Chọn ít nhất một Picker hoặc chọn tất cả Picker.");
      patchActiveSection();
      return;
    }
    const targetLabel = allPickerSelection ? "tất cả Picker" : `${ids.length} Picker đã chọn`;
    if (action === "DELETE" && !window.confirm(`Xóa ${targetLabel}? Lịch sử nghiệp vụ vẫn được giữ.`)) return;
    void run(async () => {
      await updatePickerAccounts(action, ids, allPickerSelection);
      selectedUserIds.clear();
      allPickerSelection = false;
      await loadUsers();
      setNotice("success", "Đã cập nhật Picker.");
    });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-edit-user]").forEach((button) => button.addEventListener("click", () => {
    editUserId = button.dataset.editUser || null;
    passwordUserId = null;
    patchOverlays();
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-password-user]").forEach((button) => button.addEventListener("click", () => {
    passwordUserId = button.dataset.passwordUser || null;
    editUserId = null;
    patchOverlays();
  }));
  document.querySelector<HTMLButtonElement>("#user-prev")?.addEventListener("click", () => {
    userOffset = Math.max(0, userOffset - USER_PAGE_SIZE);
    void run(loadUsers);
  });
  document.querySelector<HTMLButtonElement>("#user-next")?.addEventListener("click", () => {
    userOffset += USER_PAGE_SIZE;
    void run(loadUsers);
  });

  document.querySelector<HTMLFormElement>("#sla-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      const warning = Number(data.get("warning"));
      const escalation = Number(data.get("escalation"));
      if (
        !Number.isInteger(warning) ||
        !Number.isInteger(escalation) ||
        warning < 1 ||
        warning > 1440 ||
        escalation <= warning ||
        escalation > 2880
      ) throw new Error("Cảnh báo phải 1–1440 phút; Escalate phải lớn hơn cảnh báo và tối đa 2880 phút.");
      await saveAdminSla(warning, escalation);
      await loadSla();
      setNotice("success", "Đã lưu cấu hình SLA.");
    });
  });

  document.querySelector<HTMLFormElement>("#dashboard-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    dashboardFrom = String(data.get("from"));
    dashboardTo = String(data.get("to"));
    void run(loadDashboard);
  });
  document.querySelector<HTMLFormElement>("#report-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    reportFrom = String(data.get("from"));
    reportTo = String(data.get("to"));
    reportStatus = String(data.get("status") || "");
    reportQuery = String(data.get("query") || "");
    reportOffset = 0;
    void run(loadReports);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-date-target][data-date-days]").forEach((button) => button.addEventListener("click", () => {
    const days = Math.max(0, Math.min(59, Number(button.dataset.dateDays || 0)));
    const target = button.dataset.dateTarget;
    if (target === "dashboard") {
      dashboardFrom = dateDaysAgo(days);
      dashboardTo = dateDaysAgo(0);
      void run(loadDashboard);
    } else if (target === "reports") {
      reportFrom = dateDaysAgo(days);
      reportTo = dateDaysAgo(0);
      reportOffset = 0;
      void run(loadReports);
    }
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-dashboard-status], [data-dashboard-sku]").forEach((button) => button.addEventListener("click", () => {
    reportFrom = dashboardFrom;
    reportTo = dashboardTo;
    reportStatus = button.dataset.dashboardStatus || "";
    reportQuery = button.dataset.dashboardSku || "";
    reportOffset = 0;
    activeSection = "reports";
    notice = null;
    void run(loadReports);
  }));
  document.querySelector<HTMLButtonElement>("#report-prev")?.addEventListener("click", () => {
    reportOffset = Math.max(0, reportOffset - REPORT_PAGE_SIZE);
    void run(loadReports);
  });
  document.querySelector<HTMLButtonElement>("#report-next")?.addEventListener("click", () => {
    reportOffset += REPORT_PAGE_SIZE;
    void run(loadReports);
  });
  document.querySelector<HTMLButtonElement>("#export-reports")?.addEventListener("click", () => void run(exportReportsCsv));

  document.querySelector<HTMLButtonElement>("#refresh-system")?.addEventListener("click", () => void run(async () => {
    serviceHealth = await getServiceHealth();
  }));
  document.querySelector<HTMLButtonElement>("#download-support-log")?.addEventListener("click", downloadSupportDiagnostics);
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await changeMyPassword(String(data.get("current") || ""), String(data.get("next") || ""));
      setNotice("success", "Đã đổi mật khẩu.");
    });
  });
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
  try {
    if ((activeSection === "operations" || activeSection === "results") && roleOperate()) await loadOperations();
    else if (activeSection === "picker" && profile?.role === "PICKER") await loadPicker();
    else return true;
    patchActiveSection(true);
    return true;
  } catch {
    // Realtime client keeps the applied cursor unchanged and retries dirty state.
    return false;
  }
}

registerRealtimeApplier(async (events: RealtimeEventFrame[], context) => {
  realtimeLastSeq = context.cursorSeq;
  if (events.length > 0) markWebUpdateReceived();
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
  serviceReachable = navigator.onLine && realtimeState === "connected";
  patchHeaderRuntime();
  const node = document.querySelector<HTMLElement>("#connection-state");
  if (node) {
    node.className = `connection ${realtimeState}`;
    const dirtySuffix = detail.dirty ? " · đang khôi phục" : "";
    node.textContent = realtimeState === "connected"
      ? `Realtime · #${realtimeLastSeq}${dirtySuffix}`
      : `${realtimeState}${dirtySuffix}`;
  }
});
window.addEventListener("online", () => {
  realtimeState = "connecting";
  serviceReachable = false;
  patchHeaderRuntime();
  if (profile) patchActiveSection(true);
});
window.addEventListener("offline", () => {
  realtimeState = "offline";
  serviceReachable = false;
  patchHeaderRuntime();
  if (profile) patchActiveSection(true);
});
window.addEventListener("hashchange", () => {
  if (!profile) return;
  const requested = sectionFromHash();
  if (!requested || !canAccessSection(requested, profile) || requested === activeSection) return;
  activeSection = requested;
  notice = null;
  pickerSearchGeneration += 1;
  dashboardLoadGeneration += 1;
  reportLoadGeneration += 1;
  editUserId = null;
  passwordUserId = null;
  void run(async () => { await loadSection(requested); });
});

async function bootstrap(): Promise<void> {
  if (!hasSession()) { renderLogin(); return; }
  try {
    profile = await getMyProfile();
    sessionViewGeneration += 1;
    activeSection = resolveInitialSection(profile);
    syncSectionHash(activeSection);
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

window.setInterval(updateQueueClockDom, 15_000);
window.setInterval(() => {
  if (themeMode === "AUTO") applyTheme();
}, 60_000);

void bootstrap();
