import "./styles.css";
import "./legacy-operational.css";
import "./legacy-transplant/style.css";
import "./legacy-transplant/workflow-dashboard-v5.css";
import "./legacy-transplant/warehouse-ui-v2.css";
import "./legacy-transplant/ops-console.css";
import "./legacy-transplant/workflow-v3-overrides.css";
import "./legacy-transplant/workflow-v4-ux.css";
import "./legacy-transplant/web-fast-ui.css";
import "./legacy-transplant/web-unified-ui.css";
import { firebaseReady } from "./firebase";
import {
  applyHrPickerSync,
  changeMyPassword,
  clearSession,
  createManagedUser,
  getAdminDashboard,
  getAdminOperationalInsights,
  getAdminReporting,
  getAdminSla,
  getRealtimePresence,
  getRuntimeLogDetail,
  getRuntimeLogs,
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
  logoutInteractiveSession,
  requestPasswordReset,
  updateMyAuthEmail,
  ApiError,
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
  type RealtimePresence,
  type RuntimeLogDetail,
  type RuntimeLogItem,
  type SystemStatusSnapshot,
  type ReporterBatch,
  type ReporterRecentBatch,
  type SkuItem,
  type SlaResponse,
  type SlaState,
} from "./api";
import { parseSkuExcel, type ParsedSkuWorkbook } from "./sku-excel";
import { downloadReportWorkbook } from "./report-excel";
import { registerRealtimeApplier, type RealtimeEventFrame } from "./realtime-client";
import { getWebRuntimeDiagnosticSnapshot, initWebRuntimeLogging, runtimeLogEvent, runtimeLogMetric, sendWebRuntimeLog } from "./runtime-logger";
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
  | "tools"
  | "versions"
  | "account";

type NoticeType = "success" | "error" | "warning";
type Notice = { id: number; type: NoticeType; text: string; createdAt: number } | null;
type ToastItem = NonNullable<Notice>;
type ThemeMode = "AUTO" | "LIGHT" | "DARK";
type SectionHistoryMode = "push" | "replace" | "none";

const THEME_KEY = "supra_inventory_web_theme_v1";
const UI_ZOOM_KEY = "supra_inventory_web_zoom_v1";
const WEB_TEXT_BASE_SCALE = 1.05;
const SKIP_DELAY_KEY_PREFIX = "supra_inventory_skip_delay_v1";
const SKIP_CONFIRM_DELAY_MS = 5_000;
const DEADLINE_NOTICE_KEY_PREFIX = "supra_inventory_deadline_notices_v1";

function loadUiZoom(): number {
  const stored = Number(localStorage.getItem(UI_ZOOM_KEY) || 100);
  if (!Number.isFinite(stored)) return 100;
  return Math.max(70, Math.min(140, Math.round(stored / 10) * 10));
}

let uiZoom = loadUiZoom();

function applyUiZoom(): void {
  const effectiveScale = WEB_TEXT_BASE_SCALE * (uiZoom / 100);
  document.body.style.setProperty("zoom", effectiveScale.toFixed(3));
  document.body.dataset.logicalUiZoom = String(uiZoom);
  const label = document.querySelector<HTMLElement>("#ui-zoom-value");
  if (label) label.textContent = `${uiZoom}%`;
}

function skipDelayStorageKey(userId = profile?.user_id || "anonymous"): string {
  return `${SKIP_DELAY_KEY_PREFIX}:${userId}`;
}

function loadSkipDelayEnabled(userId = profile?.user_id || "anonymous"): boolean {
  return localStorage.getItem(skipDelayStorageKey(userId)) !== "0";
}

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
  "picker", "operations", "results", "sku", "hr", "users", "sla", "dashboard", "reports", "logs", "tools", "account",
];

function defaultSectionForProfile(value: AppProfile): Section {
  if (value.role === "PICKER") return "picker";
  return "operations";
}

function canAccessSection(section: Section, value: AppProfile): boolean {
  if (value.role === "PICKER") return ["picker", "account"].includes(section);
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
  if (role === "ROOT") return "Quản trị hệ thống";
  if (role === "ADMIN") return "Quản trị";
  if (role === "REPORTER") return "Người báo hàng";
  return "Người lấy hàng";
}

function businessRoleLabel(role: string): string {
  if (role === "ROOT") return "Quản trị hệ thống";
  if (role === "ADMIN") return "Quản trị";
  if (role === "REPORTER") return "Người xử lý báo hàng";
  if (role === "PICKER") return "Người lấy hàng";
  return role || "—";
}

function clearRoleScopedViewState(): void {
  queueRows = [];
  recentRows = [];
  batchDetails.clear();
  expandedBatchDetails.clear();
  batchDetailLoads.clear();
  pendingReporterResolutions.clear();
  operationsLoadQueued = false;
  stockConfirm = null;
  skipConfirm = null;
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
  realtimePresence = null;
  reportSummary = null;
  reportInsights = null;
  serviceHealth = null;
  systemStatus = null;
  runtimeLogs = [];
  runtimeLogDetail = null;
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

function sectionUrl(section: Section): string {
  return `${window.location.pathname}${window.location.search}#${section}`;
}

function syncSectionHistory(section: Section, mode: SectionHistoryMode = "replace"): void {
  if (mode === "none") return;
  const url = sectionUrl(section);
  if (mode === "push") {
    if (window.location.hash !== `#${section}`) window.history.pushState({ section }, "", url);
    return;
  }
  window.history.replaceState({ section }, "", url);
}

let profile: AppProfile | null = getStoredProfile();
let activeSection: Section = profile ? resolveInitialSection(profile) : "operations";
let notice: Notice = null;
let toastItems: ToastItem[] = [];
let toastSerial = 0;
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
let queueFilter: "ALL" | "WARNING" | "ESCALATED" = "ALL";
let skipConfirm: ReporterBatch | null = null;
let stockConfirm: ReporterBatch | null = null;
let skipConfirmOpenedAt = 0;
let skipDelayEnabled = loadSkipDelayEnabled();
let expandedBatchDetails = new Set<string>();
let batchDetailLoads = new Set<string>();
let pendingReporterResolutions = new Map<string, "HAS_STOCK" | "SKIP_ALLOWED">();
let operationsLoadPromise: Promise<void> | null = null;
let operationsLoadQueued = false;
let slaResponse: SlaResponse | null = null;
let operationalInsights: OperationalInsights | null = null;
let realtimePresence: RealtimePresence | null = null;
let managedUsers: ManagedUser[] = [];
let selectedUserIds = new Set<string>();
let hrSource: HrSourceResponse | null = null;
let hrPreview: HrSyncPreview | null = null;
let pendingWorkbook: ParsedSkuWorkbook | null = null;
let skuConflictChoices = new Map<string, string>();
let skuImportProgress = "";
let dashboardData: AdminDashboard | null = null;
let reportRows: AdminReportingRow[] = [];
let reportSummary: AdminDashboard | null = null;
let reportInsights: OperationalInsights | null = null;
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
let systemStatus: SystemStatusSnapshot | null = null;
let runtimeLogSource: "WEB" | "ANDROID" = "WEB";
let runtimeLogs: RuntimeLogItem[] = [];
let runtimeLogDetail: RuntimeLogDetail | null = null;
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

function realtimeStatusLabel(): string {
  if (realtimeState === "connected") return "Đã kết nối";
  if (realtimeState === "offline") return "Mất realtime";
  if (realtimeState === "reconnecting") return "Đang kết nối lại";
  return "Đang kết nối";
}

function patchHeaderRuntime(): void {
  const service = document.querySelector<HTMLElement>("#service-state");
  if (service) {
    service.textContent = `Dịch vụ: ${serviceReachable ? "Hoạt động" : "Mất kết nối"}`;
    service.dataset.state = serviceReachable ? "on" : "off";
  }
  const realtime = document.querySelector<HTMLElement>("#realtime-state");
  if (realtime) {
    realtime.textContent = `Đồng bộ: ${realtimeStatusLabel()}`;
    realtime.dataset.state = realtimeState === "connected" ? "on" : realtimeState === "offline" ? "off" : "pending";
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

function ensureToastRoot(): HTMLElement {
  let root = document.querySelector<HTMLElement>("#web-toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "web-toast-root";
    root.className = "web-toast-stack";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "false");
    document.body.appendChild(root);
  }
  return root;
}

function renderToastItems(): void {
  const root = ensureToastRoot();
  root.innerHTML = toastItems.map((item) => `<div class="web-toast ${item.type}" data-toast-id="${item.id}" role="status">${esc(item.text)}</div>`).join("");
}

function dismissToast(id: number): void {
  toastItems = toastItems.filter((item) => item.id !== id);
  if (notice?.id === id) notice = null;
  renderToastItems();
}

function setNotice(type: NoticeType, text: string): void {
  const item: ToastItem = { id: ++toastSerial, type, text, createdAt: Date.now() };
  notice = item;
  toastItems = [...toastItems, item].slice(-5);
  renderToastItems();
  window.setTimeout(() => dismissToast(item.id), 5_000);
}

function deadlineNoticeStorageKey(userId = profile?.user_id || "anonymous"): string {
  return `${DEADLINE_NOTICE_KEY_PREFIX}:${userId}`;
}

function seenDeadlineNoticeIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(deadlineNoticeStorageKey()) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).slice(-200) : [];
  } catch {
    return [];
  }
}

function markDeadlineNoticeSeen(eventIds: string[]): string[] {
  const known = new Set(seenDeadlineNoticeIds());
  const fresh = eventIds.filter((id) => id && !known.has(id));
  for (const id of fresh) known.add(id);
  localStorage.setItem(deadlineNoticeStorageKey(), JSON.stringify([...known].slice(-200)));
  return fresh;
}

function browserBackgroundNotice(title: string, body: string): void {
  if (document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "supra-inventory-deadline" });
  } catch {
    // Browser notification is supplementary; realtime product state remains authoritative.
  }
}

function announceDeadlineEvents(events: RealtimeEventFrame[]): void {
  const relevant = events.filter((row) => [
    "SLA_WARNING",
    "SLA_ESCALATED",
    "TICKET_AUTO_SKIP_ALLOWED",
    "BATCH_AUTO_SKIP_ALLOWED",
  ].includes(String(row.event || "").toUpperCase()));
  if (!relevant.length) return;
  const freshIds = markDeadlineNoticeSeen(relevant.map((row) => String(row.event_id || "")).filter(Boolean));
  if (!freshIds.length) return;
  const fresh = relevant.filter((row) => freshIds.includes(String(row.event_id || "")));
  const count = (name: string) => fresh.filter((row) => String(row.event || "").toUpperCase() === name).length;
  const autoCount = count("TICKET_AUTO_SKIP_ALLOWED") + count("BATCH_AUTO_SKIP_ALLOWED");
  const escalated = count("SLA_ESCALATED");
  const warning = count("SLA_WARNING");

  if (profile?.role === "PICKER") {
    if (autoCount) {
      const text = autoCount === 1 ? "Hệ thống đã cho phép bỏ qua SKU quá thời gian phản hồi." : `${autoCount} SKU đã được hệ thống cho phép bỏ qua.`;
      setNotice("warning", text);
      browserBackgroundNotice("SUPRA Inventory · Được phép bỏ qua", text);
    } else if (escalated) {
      const text = escalated === 1 ? "SKU đang chờ đã quá thời gian xử lý." : `${escalated} SKU đang chờ đã quá thời gian xử lý.`;
      setNotice("warning", text);
      browserBackgroundNotice("SUPRA Inventory · SKU quá hạn", text);
    }
    return;
  }

  if (autoCount) {
    const text = autoCount === 1 ? "Một SKU quá thời gian đã được hệ thống cho phép bỏ qua." : `${autoCount} SKU quá thời gian đã được hệ thống cho phép bỏ qua.`;
    setNotice("warning", text);
    browserBackgroundNotice("SUPRA Inventory · Tự động cho phép bỏ qua", text);
  }
  if (escalated) {
    const text = escalated === 1 ? "Một SKU vừa chuyển sang quá hạn." : `${escalated} SKU vừa chuyển sang quá hạn.`;
    setNotice("warning", text);
    browserBackgroundNotice("SUPRA Inventory · SKU quá hạn", text);
  } else if (warning) {
    const text = warning === 1 ? "Một SKU vừa tới mốc cảnh báo." : `${warning} SKU vừa tới mốc cảnh báo.`;
    setNotice("warning", text);
    browserBackgroundNotice("SUPRA Inventory · SKU sắp quá hạn", text);
  }
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
  if (state === "ESCALATED") return "Quá thời gian";
  if (state === "WARNING") return "Sắp quá thời gian";
  if (state === "NORMAL") return "Trong thời gian";
  return "Chưa thiết lập thời gian";
}

function statusLabel(status: string): string {
  if (status === "HAS_STOCK") return "Đã có hàng";
  if (status === "SKIP_ALLOWED") return "Được phép bỏ qua";
  if (status === "CLOSED") return "Picker đã thu hồi";
  if (status === "PENDING" || status === "OPEN") return "Đang xử lý";
  if (status === "WITHDRAWN") return "Đã thu hồi";
  if (status === "RESOLVED") return "Đã xử lý";
  return status;
}

function renderDatePresets(target: "dashboard" | "reports"): string {
  return `<div class="toolbar date-presets compact-date-presets" aria-label="Chọn nhanh khoảng ngày">
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="0">Hôm nay</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="6">7 ngày</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="29">30 ngày</button>
    <button type="button" class="btn secondary small" data-date-target="${target}" data-date-days="59">60 ngày</button>
  </div>`;
}

function renderCompactDateRange(target: "dashboard" | "reports", from: string, to: string): string {
  return `<div class="compact-date-range" role="group" aria-label="Khoảng ngày dữ liệu">
    <label><span>Từ</span><input name="from" type="date" value="${esc(from)}" /></label>
    <span class="compact-date-separator">–</span>
    <label><span>Đến</span><input name="to" type="date" value="${esc(to)}" /></label>
    ${renderDatePresets(target)}
  </div>`;
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
  mainScrollTop: number;
  mainScrollLeft: number;
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
  const scrollBoxes = [".table-wrap", ".user-list", ".history-list", ".operation-list", ".fast-list", ".log-list", ".diagnostics", ".suggestions"].flatMap((className) =>
    [...main.querySelectorAll<HTMLElement>(className)].map((node, index) => ({
      className,
      index,
      top: node.scrollTop,
      left: node.scrollLeft,
    })),
  );
  return {
    section: (main.dataset.activeSection as Section) || activeSection,
    userId: profile?.user_id || null,
    scrollY: window.scrollY,
    mainScrollTop: main.scrollTop,
    mainScrollLeft: main.scrollLeft,
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
  main.scrollTop = snapshot.mainScrollTop;
  main.scrollLeft = snapshot.mainScrollLeft;
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
  if (activeSection === "tools") return renderTools();
  if (activeSection === "versions") return renderLegacyVersions();
  return renderAccount();
}

function mainMarkup(): string {
  return activeContent();
}

function patchOverlays(): void {
  const root = document.querySelector<HTMLElement>("#overlay-root");
  if (!root) return;
  root.innerHTML = `${renderStockModal()}${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}`;
  bindOverlay();
}

function patchActiveSection(preserveContext = true): void {
  const main = document.querySelector<HTMLElement>(".main");
  if (!main) {
    render();
    return;
  }
  const started = performance.now();
  const snapshot = preserveContext ? captureUiContext() : null;
  main.innerHTML = mainMarkup();
  main.dataset.activeSection = activeSection;
  bindSection();
  patchOverlays();
  restoreUiContext(snapshot);
  runtimeLogMetric("RENDER", "patch_active_section", {
    section: activeSection,
    preserve_context: preserveContext,
    html_chars: main.innerHTML.length,
    dom_nodes: main.querySelectorAll("*").length,
    queue_rows: queueRows.length,
  }, performance.now() - started);
}

function syncNavigationSelection(): void {
  document.querySelectorAll<HTMLElement>("[data-section]").forEach((node) => {
    const selected = node.dataset.section === activeSection;
    node.classList.toggle("active", selected);
    if (selected) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  });
}

function navigateToSection(next: Section, historyMode: SectionHistoryMode = "push"): void {
  if (!profile || !canAccessSection(next, profile)) return;
  if (next === activeSection) {
    syncSectionHistory(next, historyMode === "push" ? "none" : historyMode);
    return;
  }
  const started = performance.now();
  activeSection = next;
  syncSectionHistory(next, historyMode);
  pickerSearchGeneration += 1;
  dashboardLoadGeneration += 1;
  reportLoadGeneration += 1;
  editUserId = null;
  passwordUserId = null;
  syncNavigationSelection();
  patchActiveSection(false);
  const displayedMs = Math.max(0, Math.round(performance.now() - started));
  runtimeLogEvent(`Mở ${next}: hiển thị ${displayedMs}ms`);

  const requestedSection = next;
  const loadStarted = performance.now();
  void loadSection(requestedSection)
    .then(() => {
      runtimeLogEvent(`Tải ${requestedSection}: ${Math.max(0, Math.round(performance.now() - loadStarted))}ms`);
      if (activeSection === requestedSection) {
        patchActiveSection(true);
        syncNavigationSelection();
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : "Không tải được dữ liệu.";
      runtimeLogEvent(`Lỗi tải ${requestedSection}: ${message}`, "ERROR");
      setNotice("error", message);
    });
}

function handleSectionHistoryNavigation(): void {
  if (!profile) return;
  const requested = sectionFromHash();
  if (!requested || !canAccessSection(requested, profile) || requested === activeSection) return;
  navigateToSection(requested, "none");
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
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.5 2.5-3-3 2.5-2.5Z"/>',
    versions: '<path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/>',
    account: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.8-4.2 3.1-6.5 7-6.5s6.2 2.3 7 6.5"/>',
    "group-operations": '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
    "group-data": '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    "group-management": '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z"/>',
    "group-reports": '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    "group-system": '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  };
  return `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] || paths.dashboard}</svg>`;
}

function navButton(section: Section, label: string): string {
  return `<button class="nav-button ${activeSection === section ? "active" : ""}" data-section="${section}"${activeSection === section ? ' aria-current="page"' : ""}>${navIcon(section)}<span>${esc(label)}</span></button>`;
}

function navGroup(title: string, rows: Array<[Section, string]>): string {
  const iconKey = title === "VẬN HÀNH"
    ? "group-operations"
    : title === "QUẢN LÝ"
      ? "group-management"
      : "group-system";
  return `<span class="nav-section-label" data-nav-section="${esc(title)}">${navIcon(iconKey)}<span>${esc(title)}</span></span>${rows.map(([id, label]) => navButton(id, label)).join("")}`;
}

function renderNav(): string {
  if (!profile) return "";
  if (profile.role === "PICKER") {
    return navButton("picker", "Báo thiếu hàng");
  }
  if (profile.role === "REPORTER") {
    return navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"]]);
  }
  return [
    navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"], ["dashboard", "Tổng quan & báo cáo"]]),
    navGroup("QUẢN LÝ", [["sku", "Danh mục SKU"], ["users", "Nhân sự & tài khoản"], ["sla", "Thời gian xử lý"]]),
    navGroup("HỆ THỐNG", [["logs", "Nhật ký"], ["tools", "Công cụ"]]),
  ].join("");
}

function renderLogin(): void {
  document.body.dataset.role = "";
  document.body.dataset.testRole = "";
  app.innerHTML = `<main class="login-shell"><section class="login-card">
    <div class="brand">1291</div><p class="eyebrow">BÁO HÀNG 1291</p><h1>Web nghiệp vụ</h1>
    <p class="muted">Đăng nhập bằng tài khoản Báo hàng 1291.</p>
    ${!firebaseReady ? `<div class="message" data-type="error">Hệ thống đăng nhập chưa sẵn sàng. Vui lòng thử lại sau.</div>` : ""}
    <form id="login-form">
      <label>Mã nhân viên<input name="username" required autocomplete="username" placeholder="Nhập mã nhân viên" /></label>
      <label>Mật khẩu<input name="password" type="password" required autocomplete="current-password" placeholder="Nhập mật khẩu" /></label>
      <button class="primary wide" ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "ĐĂNG NHẬP"}</button>
    </form>
    <div class="login-actions"><button id="forgot-password" type="button" class="login-link">Lấy lại mật khẩu</button></div>
    <form id="reset-password-form" class="login-reset-form" hidden>
      <p class="muted">Chỉ áp dụng cho ROOT và ADMIN có email đã đăng ký.</p>
      <label>Tài khoản<input name="username" required autocomplete="username" placeholder="Mã nhân viên / tài khoản" /></label>
      <label>Email đăng ký<input name="email" type="email" required autocomplete="email" placeholder="name@company.com" /></label>
      <button class="secondary wide">GỬI LINK ĐẶT LẠI MẬT KHẨU</button>
      <div id="reset-password-result" class="tiny muted"></div>
    </form>
    <p class="security">${PRODUCT_CREDIT}</p>
  </section></main>`;

  document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    void run(async () => {
      try {
        profile = await loginWithPassword(username, password, false);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === "SESSION_ACTIVE_OTHER_DEVICE" &&
          window.confirm(`${error.message}\n\nTiếp tục đăng nhập và đăng xuất phiên Web cũ?`)
        ) {
          profile = await loginWithPassword(username, password, true);
        } else {
          throw error;
        }
      }
      markWebUpdateReceived();
      skipDelayEnabled = loadSkipDelayEnabled(profile.user_id);
      runtimeLogEvent(`Đăng nhập: ${profile.role}`);
      sessionViewGeneration += 1;
      activeSection = resolveInitialSection(profile);
      syncSectionHistory(activeSection, "replace");
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
      render();
    });
  });

  document.querySelector<HTMLButtonElement>("#forgot-password")?.addEventListener("click", () => {
    const form = document.querySelector<HTMLFormElement>("#reset-password-form");
    if (form) form.hidden = !form.hidden;
  });
  document.querySelector<HTMLFormElement>("#reset-password-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const result = document.querySelector<HTMLElement>("#reset-password-result");
    void run(async () => {
      const message = await requestPasswordReset(
        String(data.get("username") || "").trim(),
        String(data.get("email") || "").trim(),
      );
      if (result) result.textContent = message;
    }, "none");
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
        <h1>Website nghiệp vụ Inventory</h1>
        <div class="header-runtime">
          <span id="service-state" data-state="${serviceReachable ? "on" : "off"}">Dịch vụ: ${serviceReachable ? "Hoạt động" : "Mất kết nối"}</span>
          <span class="header-runtime-separator">|</span>
          <span id="realtime-state" data-state="${realtimeState === "connected" ? "on" : realtimeState === "offline" ? "off" : "pending"}">Đồng bộ: ${realtimeStatusLabel()}</span>
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
          <div class="header-control zoom-control"><span>Cỡ chữ</span><div class="zoom-buttons"><button type="button" class="ghost" data-ui-zoom="-10" aria-label="Giảm cỡ chữ">A−</button><button type="button" class="ghost zoom-value" data-ui-zoom="0" id="ui-zoom-value" aria-label="Đặt cỡ chữ về 100%">${uiZoom}%</button><button type="button" class="ghost" data-ui-zoom="10" aria-label="Tăng cỡ chữ">A+</button></div></div>
          <div class="user-actions"><button type="button" class="ghost header-account-action ${activeSection === "account" ? "active" : ""}" data-section="account">Tài khoản</button><button id="logout" class="ghost">Đăng xuất</button></div>
        </div>
      </div>
    </header>
    <nav class="tabs" data-shell-generation="legacy-direct-transplant">${renderNav()}</nav>
    <main id="content" class="content main" data-active-section="${esc(activeSection)}">${content}</main>
    <footer id="appCopyright" class="app-footer">${PRODUCT_CREDIT}</footer>
    <div id="overlay-root">${renderStockModal()}${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}</div>
  </div>`;
  bindShell();
}

function renderStockModal(): string {
  if (!stockConfirm) return "";
  return `<div class="modal"><div class="modal-box action-confirm-box"><h2>XÁC NHẬN ĐÃ CÓ HÀNG?</h2>
    <div class="sku-code">${esc(stockConfirm.sku)}</div><div class="product-name">${esc(stockConfirm.product_name)}</div>
    <p>Xác nhận SKU này đã có hàng. Kết quả sẽ được gửi đến <strong>${Number(stockConfirm.affected_picker_count)} Picker</strong> đang bị ảnh hưởng.</p>
    <div class="modal-actions"><button class="btn secondary" id="cancel-stock">HUỶ</button><button class="btn success" id="confirm-stock">XÁC NHẬN ĐÃ CÓ HÀNG</button></div></div></div>`;
}

function renderSkipModal(): string {
  if (!skipConfirm) return "";
  const waitSeconds = skipDelayEnabled
    ? Math.max(0, Math.ceil((skipConfirmOpenedAt + SKIP_CONFIRM_DELAY_MS - Date.now()) / 1000))
    : 0;
  return `<div class="modal"><div class="modal-box action-confirm-box"><h2>XÁC NHẬN BỎ QUA?</h2>
    <div class="sku-code">${esc(skipConfirm.sku)}</div><div class="product-name">${esc(skipConfirm.product_name)}</div>
    <p>Cho phép <strong>${Number(skipConfirm.affected_picker_count)} Picker</strong> đang bị ảnh hưởng bỏ qua SKU này.</p>
    ${waitSeconds > 0 ? `<p class="confirm-wait">Vui lòng kiểm tra lại thông tin. Có thể xác nhận sau <strong>${waitSeconds} giây</strong>.</p>` : ""}
    <div class="modal-actions"><button class="btn secondary" id="cancel-skip">HUỶ</button><button class="btn danger" id="confirm-skip" ${waitSeconds > 0 ? "disabled" : ""}>${waitSeconds > 0 ? `XÁC NHẬN BỎ QUA (${waitSeconds}s)` : "XÁC NHẬN BỎ QUA"}</button></div></div></div>`;
}

function renderCriticalResult(): string {
  if (profile?.role !== "PICKER") return "";
  const result = pickerResults.find((row) => !row.acknowledged_at);
  if (!result) return "";
  const isSkip = result.resolution === "SKIP_ALLOWED";
  return `<div class="critical-result"><div class="critical-box ${isSkip ? "skip-result" : ""}">
    <h2>${isSkip ? "ĐƯỢC PHÉP BỎ QUA" : "ĐÃ CÓ HÀNG"}</h2>
    <div class="critical-sku">${esc(result.sku)}</div><div class="product-name">${esc(result.product_name)}</div>
    <p>${isSkip ? "Người xử lý đã xác nhận SKU này được phép bỏ qua." : "Người xử lý đã xác nhận SKU này đã có hàng."}</p>
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
        <div class="field" style="margin-top:10px"><span>Email đăng ký${editUser.role === "ADMIN" ? " · bắt buộc" : ""}</span><input name="authEmail" type="email" value="${esc(editUser.auth_email || "")}" ${editUser.role === "ADMIN" ? "required" : ""} /></div>
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
  const started = performance.now();
  const snapshot = captureUiContext();
  renderShell(activeContent());
  bindSection();
  restoreUiContext(snapshot);
  runtimeLogMetric("RENDER", "full_shell", {
    section: activeSection,
    dom_nodes: app.querySelectorAll("*").length,
    queue_rows: queueRows.length,
  }, performance.now() - started);
}

function renderOperationalTabs(current: "operations" | "results"): string {
  return `<div class="workspace-tabs" role="tablist" aria-label="Vận hành báo hàng">
    <button type="button" class="workspace-tab ${current === "operations" ? "active" : ""}" data-workspace-section="operations">Đang xử lý <b>${queueRows.length}</b></button>
    <button type="button" class="workspace-tab ${current === "results" ? "active" : ""}" data-workspace-section="results">Kết quả gần đây <b>${recentRows.length}</b></button>
  </div>`;
}

function filteredQueueRows(): ReporterBatch[] {
  if (queueFilter === "ALL") return queueRows;
  return queueRows.filter((row) => liveQueueTiming(row).state === queueFilter);
}

function pickerDetailMarkup(batchId: string, details: BatchPickerTicket[] | undefined): string {
  if (!expandedBatchDetails.has(batchId)) return "";
  if (!details) return `<div class="detail picker-detail-panel"><div class="picker-detail-loading">Đang tải danh sách Picker...</div></div>`;
  return `<div class="detail picker-detail-panel"><div class="picker-detail-list">${details.map((item) => `
    <div class="picker-detail-row">
      <strong>${esc(item.picker_employee_code)}</strong>
      <span>${esc(item.picker_display_name || "—")}</span>
      <time>${esc(fmt(item.reported_at))}</time>
      <span class="picker-timeout-state">${item.auto_skip_allowed_at ? "Đã được hệ thống cho phép bỏ qua" : item.auto_skip_deadline_at ? `Tự động bỏ qua lúc ${esc(fmt(item.auto_skip_deadline_at))}` : ""}</span>
    </div>`).join("") || `<div class="picker-detail-loading">Không có Picker đang bị ảnh hưởng.</div>`}</div></div>`;
}

function renderFastDetail(selected: ReporterBatch | null): string {
  if (!selected) return `<div class="fast-empty"><strong>Không có SKU trong nhóm đang chọn</strong><span>Chọn nhóm khác để tiếp tục theo dõi.</span></div>`;
  const timing = liveQueueTiming(selected);
  const pendingResolution = pendingReporterResolutions.get(selected.batch_id) || null;
  return `<div class="fast-detail-head"><div><span>SKU đang xử lý</span><h3>${esc(selected.sku)}</h3></div><b class="fast-status ${timing.state === "ESCALATED" ? "danger" : timing.state === "WARNING" ? "open" : "work"}">${esc(slaLabel(timing.state))}</b></div>
    <div class="fast-detail-name">${esc(selected.product_name)}</div>
    <dl class="fast-facts">
      <div><dt>Picker bị ảnh hưởng</dt><dd>${Number(selected.affected_picker_count)}</dd></div>
      <div><dt>Thời gian chờ</dt><dd data-wait-batch="${esc(selected.batch_id)}">${timing.waiting} phút</dd></div>
      <div><dt>Thời điểm báo đầu tiên</dt><dd>${esc(fmt(selected.first_report_at))}</dd></div>
      <div><dt>Báo gần nhất</dt><dd>${esc(fmt(selected.last_report_at || selected.first_report_at))}</dd></div>
      <div><dt>Tự động cho phép bỏ qua</dt><dd>${selected.auto_skip_enabled ? (selected.auto_skip_at ? esc(fmt(selected.auto_skip_at)) : "Chỉ áp dụng báo mới") : "Đang tắt"}</dd></div>
    </dl>
    ${selected.previous_batch_id ? `<div class="fast-warning">SKU này đã phát sinh lại sau lần xử lý trước.</div>` : ""}
    ${pendingResolution ? `<div class="fast-action-pending" role="status">Đang gửi xác nhận ${pendingResolution === "HAS_STOCK" ? "Có hàng" : "Bỏ qua"}…</div>` : ""}
    <div class="fast-actions"><button class="primary" data-resolve="HAS_STOCK" data-batch="${esc(selected.batch_id)}" ${pendingResolution ? "disabled" : ""}>ĐÃ CÓ HÀNG</button><button class="danger" data-skip-batch="${esc(selected.batch_id)}" ${pendingResolution ? "disabled" : ""}>CHO PHÉP BỎ QUA</button><button class="secondary" data-detail="${esc(selected.batch_id)}">${expandedBatchDetails.has(selected.batch_id) ? "Ẩn danh sách Picker" : "Xem Picker ảnh hưởng"}</button></div>
    ${pickerDetailMarkup(selected.batch_id, batchDetails.get(selected.batch_id))}`;
}

function refreshFastDetailOnly(): void {
  if (activeSection !== "operations") return;
  const detail = document.querySelector<HTMLElement>("#fastDetail");
  if (!detail) return;
  const started = performance.now();
  const selected = queueRows.find((row) => row.batch_id === selectedBatchId) || null;
  detail.innerHTML = renderFastDetail(selected);
  bindReporterActionButtons(detail);
  runtimeLogMetric("RENDER", "reporter_detail_only", {
    selected_batch: selected?.batch_id || null,
    picker_detail_loaded: selected ? batchDetails.has(selected.batch_id) : false,
  }, performance.now() - started);
}

function prefetchBatchDetails(batchId: string): void {
  if (!batchId || batchDetails.has(batchId) || batchDetailLoads.has(batchId)) return;
  batchDetailLoads.add(batchId);
  void getReporterBatchTickets(batchId)
    .then((result) => {
      batchDetails.set(batchId, result.items);
      if (activeSection === "operations" && selectedBatchId === batchId) refreshFastDetailOnly();
    })
    .catch((error) => runtimeLogEvent(`Không tải được danh sách Picker: ${error instanceof Error ? error.message : "unknown"}`, "ERROR"))
    .finally(() => batchDetailLoads.delete(batchId));
}

function renderOperations(): string {
  const visibleRows = filteredQueueRows();
  let selected = visibleRows.find((row) => row.batch_id === selectedBatchId) || null;
  if (!selected && visibleRows.length) {
    selected = visibleRows[0];
    selectedBatchId = selected.batch_id;
  }
  const warningCount = queueRows.filter((row) => liveQueueTiming(row).state === "WARNING").length;
  const overdueCount = queueRows.filter((row) => liveQueueTiming(row).state === "ESCALATED").length;
  const affected = queueRows.reduce((sum, row) => sum + Number(row.affected_picker_count || 0), 0);
  return `<section id="fastEvents" class="fast-events ops-business-workspace">
    <div class="business-page-head"><div><h2>Vận hành báo hàng</h2><p>Theo dõi và xử lý các SKU Picker đang báo hết hàng.</p></div></div>
    ${renderOperationalTabs("operations")}
    <section class="business-summary-grid queue-summary-grid">
      <button type="button" class="business-summary-card summary-filter-card primary ${queueFilter === "ALL" ? "active" : ""}" data-queue-filter="ALL"><span>SKU đang chờ xử lý</span><strong>${queueRows.length.toLocaleString("vi-VN")}</strong><small>${affected.toLocaleString("vi-VN")} Picker đang bị ảnh hưởng</small></button>
      <button type="button" class="business-summary-card summary-filter-card warning ${queueFilter === "WARNING" ? "active" : ""}" data-queue-filter="WARNING"><span>Sắp quá thời gian</span><strong>${warningCount.toLocaleString("vi-VN")}</strong><small>Nhấn để xem danh sách</small></button>
      <button type="button" class="business-summary-card summary-filter-card danger ${queueFilter === "ESCALATED" ? "active" : ""}" data-queue-filter="ESCALATED"><span>Đã quá thời gian</span><strong>${overdueCount.toLocaleString("vi-VN")}</strong><small>Nhấn để xem danh sách</small></button>
    </section>
    <div class="fast-workspace">
      <div class="fast-list" id="fastList" aria-live="polite">
        ${visibleRows.length ? visibleRows.map((row) => {
          const rowTiming = liveQueueTiming(row);
          const tone = rowTiming.state === "ESCALATED" ? "danger" : rowTiming.state === "WARNING" ? "open" : "work";
          return `<button class="fast-issue-row ${selected?.batch_id === row.batch_id ? "selected" : ""}" data-select-batch="${esc(row.batch_id)}">
            <span class="fast-sku">${esc(row.sku)}</span>
            <span class="fast-product">${esc(row.product_name)}</span>
            <span class="fast-meta"><b class="fast-status ${tone}">${esc(slaLabel(rowTiming.state))}</b><em>${Number(row.affected_picker_count)} Picker</em><em>Chờ ${rowTiming.waiting} phút</em></span>
          </button>`;
        }).join("") : `<div class="fast-empty-row">${queueFilter === "ALL" ? "Hiện không có SKU chờ xử lý." : "Không có SKU trong nhóm này."}</div>`}
      </div>
      <aside class="fast-detail" id="fastDetail">${renderFastDetail(selected)}</aside>
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
    <div><div class="operation-count">${Number(row.affected_picker_count)} Picker</div><div class="tiny muted">Báo gần nhất ${esc(fmt(row.last_report_at || row.first_report_at))}</div></div>
    <div class="operation-meta"><span data-wait-batch="${esc(row.batch_id)}">${timing.waiting} phút</span><span data-sla-batch="${esc(row.batch_id)}" class="badge ${sla_state === "ESCALATED" ? "escalated" : sla_state === "WARNING" ? "warning" : sla_state === "NORMAL" ? "ok" : ""}">${esc(slaLabel(sla_state))}</span>${recurrence}<span>Báo đầu ${esc(fmt(row.first_report_at))}</span></div>
    <div class="operation-actions"><button class="btn success" data-resolve="HAS_STOCK" data-batch="${esc(row.batch_id)}">CÓ HÀNG</button><button class="btn danger" data-skip-batch="${esc(row.batch_id)}">CHO PHÉP BỎ QUA</button><button class="btn secondary" data-detail="${esc(row.batch_id)}">${expandedBatchDetails.has(row.batch_id) ? "Ẩn Picker" : "Picker"}</button></div>
    ${pickerDetailMarkup(row.batch_id, details)}
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
  const hasStock = recentRows.filter((row) => row.status === "HAS_STOCK").length;
  const skipped = recentRows.filter((row) => row.status === "SKIP_ALLOWED").length;
  const withdrawn = recentRows.filter((row) => row.status === "CLOSED").length;
  const acknowledged = recentRows.reduce((sum, row) => sum + Number(row.acknowledged_count || 0), 0);
  const targets = recentRows.reduce((sum, row) => sum + Number(row.ack_target_count || 0), 0);
  return `<section class="ops-route ops-business-workspace">
    <div class="business-page-head"><div><h2>Vận hành báo hàng</h2><p>Kiểm tra kết quả đã xử lý và tình trạng Picker nhận kết quả.</p></div></div>
    ${renderOperationalTabs("results")}
    <section class="business-summary-grid business-summary-grid-4">
      <article class="business-summary-card good"><span>Đã có hàng</span><strong>${hasStock}</strong><small>SKU đã xác nhận có hàng</small></article>
      <article class="business-summary-card danger"><span>Được phép bỏ qua</span><strong>${skipped}</strong><small>SKU đã cho Picker bỏ qua</small></article>
      <article class="business-summary-card"><span>Picker đã thu hồi</span><strong>${withdrawn}</strong><small>Báo được Picker tự thu hồi</small></article>
      <article class="business-summary-card primary"><span>Picker đã nhận kết quả</span><strong>${acknowledged}/${targets}</strong><small>Tổng lượt xác nhận nhận kết quả</small></article>
    </section>
    <article class="ops-panel">
      <div class="filters">${(["ALL", "HAS_STOCK", "SKIP_ALLOWED", "CLOSED"] as const).map((id) => `<button class="filter ${recentFilter === id ? "active" : ""}" data-result-filter="${id}">${id === "ALL" ? "Tất cả kết quả" : statusLabel(id)}</button>`).join("")}</div>
      <div class="table-wrap"><table><thead><tr><th>SKU / Sản phẩm</th><th>Kết quả</th><th>Picker ảnh hưởng</th><th>Picker đã nhận</th><th>Thời điểm xử lý</th><th>Phát sinh lại</th><th>Thao tác</th></tr></thead><tbody>
        ${visible.map((row) => { const canCorrect = row.status === "SKIP_ALLOWED" && row.correction_deadline_at && Date.now() <= Date.parse(row.correction_deadline_at); return `<tr><td><strong>${esc(row.sku)}</strong><div class="tiny muted">${esc(row.product_name)}</div></td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : "closed"}">${esc(statusLabel(row.status))}</span>${row.resolution_source === "SYSTEM_TIMEOUT" ? '<div class="tiny muted">Hệ thống tự động do quá hạn</div>' : ""}</td><td>${Number(row.affected_picker_count)}</td><td>${row.status === "CLOSED" ? "Không áp dụng" : `${Number(row.acknowledged_count || 0)}/${Number(row.ack_target_count || 0)}`}</td><td>${esc(fmt(row.resolved_at || row.first_report_at))}</td><td>${row.previous_batch_id ? `<span class="badge warning">Có</span>` : "Không"}</td><td>${canCorrect ? `<button class="btn secondary small" data-correct="${esc(row.batch_id)}">Sửa thành Có hàng</button>` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="7" class="empty">Chưa có kết quả phù hợp.</td></tr>`}
      </tbody></table></div>
    </article>
  </section>`;
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
    <div class="history-list">${reports.length ? reports.map((row) => { const effectiveStatus = row.resolution === "SKIP_ALLOWED" ? "SKIP_ALLOWED" : row.batch_status || row.status; const state = effectiveStatus === "HAS_STOCK" ? "ok" : effectiveStatus === "SKIP_ALLOWED" ? "skip" : row.status === "WITHDRAWN" || effectiveStatus === "CLOSED" ? "closed" : "pending"; const canWithdraw = row.status === "OPEN" && !row.auto_skip_allowed_at && Date.now() <= Date.parse(row.withdraw_deadline_at); return `<article class="history-card ${state}"><div><strong>${esc(row.sku)}</strong><div class="product-name">${esc(row.product_name)}</div><div class="tiny muted">${esc(fmt(row.reported_at))} · ${esc(statusLabel(effectiveStatus))}${row.resolution_source === "SYSTEM_TIMEOUT" ? " · Hệ thống tự động do quá hạn" : ""}${row.result_event_id && !row.acknowledged_at ? " · Chưa xác nhận kết quả" : ""}</div>${row.auto_skip_deadline_at && !row.auto_skip_allowed_at ? `<div class="tiny muted">Mốc tự động: ${esc(fmt(row.auto_skip_deadline_at))}</div>` : ""}</div>${canWithdraw ? `<button class="btn secondary small" data-withdraw="${esc(row.ticket_id)}">Thu hồi</button>` : ""}</article>`; }).join("") : `<div class="card empty">Hôm nay chưa có báo hàng.</div>`}</div>
  </section>`;
}

function renderSku(): string {
  const wb = pendingWorkbook;
  return `<section class="ops-route">
    <div class="heading"><div><h2>Danh mục SKU</h2></div></div>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Cập nhật danh mục SKU</h3></div></div>
      <div class="ops-form-grid"><label class="span">File Excel .xlsx<input id="sku-file" type="file" accept=".xlsx" /></label></div>
      ${skuImportProgress ? `<div class="message">${esc(skuImportProgress)}</div>` : ""}
      ${wb ? `<section class="ops-status-strip"><span><b>${wb.total_data_rows.toLocaleString("vi-VN")}</b> dòng dữ liệu</span><span><b>${wb.items.length.toLocaleString("vi-VN")}</b> SKU sẵn sàng</span><span><b>${wb.conflicts.length}</b> xung đột</span></section>` : ""}
    </article>
    ${wb?.conflicts.length ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Xử lý SKU trùng mã khác tên</h3><p>Chọn đúng tên sản phẩm trước khi cập nhật.</p></div></div><div class="ops-form-grid">${wb.conflicts.map((conflict) => `<label class="span">${esc(conflict.sku)}<select data-sku-conflict="${esc(conflict.sku)}"><option value="">Chọn tên sản phẩm</option>${conflict.candidates.map((candidate) => `<option value="${esc(candidate.product_name)}" ${skuConflictChoices.get(conflict.sku) === candidate.product_name ? "selected" : ""}>${esc(candidate.product_name)} · dòng ${candidate.rows.join(", ")}</option>`).join("")}</select></label>`).join("")}</div><div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật danh mục SKU</button></div></article>` : wb ? `<article class="ops-panel"><div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật danh mục SKU</button></div></article>` : ""}
  </section>`;
}

function renderPeopleTabs(current: "users" | "hr"): string {
  return `<div class="workspace-tabs" role="tablist" aria-label="Nhân sự và tài khoản">
    <button type="button" class="workspace-tab ${current === "users" ? "active" : ""}" data-workspace-section="users">Danh sách tài khoản</button>
    <button type="button" class="workspace-tab ${current === "hr" ? "active" : ""}" data-workspace-section="hr">Nguồn nhân sự & đồng bộ Picker</button>
  </div>`;
}

function renderHr(): string {
  const source = hrSource?.source;
  return `<section class="ops-route people-workspace">
    <div class="business-page-head"><div><h2>Nhân sự & tài khoản</h2><p>Quản lý tài khoản, nguồn nhân sự và đồng bộ Picker trong cùng một nghiệp vụ.</p></div></div>
    ${renderPeopleTabs("hr")}
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
  const activeCount = managedUsers.filter((user) => user.status === "ACTIVE").length;
  const pickerCount = managedUsers.filter((user) => user.role === "PICKER").length;
  const reporterCount = managedUsers.filter((user) => user.role === "REPORTER").length;
  return `<section class="ops-route users-workspace">
    <div class="business-page-head"><div><h2>Nhân sự & tài khoản</h2><p>Tạo, tìm kiếm và quản lý tài khoản theo đúng vai trò nghiệp vụ.</p></div></div>
    ${renderPeopleTabs("users")}
    <section class="business-summary-grid">
      <article class="business-summary-card primary"><span>Tài khoản phù hợp</span><strong>${userTotal.toLocaleString("vi-VN")}</strong><small>Theo bộ lọc hiện tại</small></article>
      <article class="business-summary-card good"><span>Đang hoạt động trên trang</span><strong>${activeCount}</strong><small>Trong ${managedUsers.length} tài khoản đang hiển thị</small></article>
      <article class="business-summary-card"><span>Picker / Người xử lý</span><strong>${pickerCount} / ${reporterCount}</strong><small>Trên trang hiện tại</small></article>
    </section>
    <div class="users-top-grid">
      <article class="ops-panel users-create-panel">
        <div class="ops-panel-title"><div><h3>Tạo tài khoản nghiệp vụ</h3><p>Dùng cho Người xử lý báo hàng và Quản trị. Picker được đồng bộ từ nguồn nhân sự.</p></div></div>
        <form id="create-user-form" class="users-form-grid">
          <label>Mã nhân viên / tên đăng nhập<input name="username" autocomplete="off" required /></label>
          <label>Họ và tên<input name="displayName" autocomplete="off" required /></label>
          <label>Quyền sử dụng<select name="role"><option value="REPORTER">Người xử lý báo hàng</option>${canCreateAdmin ? `<option value="ADMIN">Quản trị</option>` : ""}</select></label>
          <label>Email đăng ký<input name="authEmail" type="email" autocomplete="email" placeholder="Bắt buộc khi tạo Admin" /></label>
          <label>Mật khẩu khởi tạo<input name="password" type="password" autocomplete="new-password" required /></label>
          <div class="ops-form-actions"><button class="primary">Tạo tài khoản</button></div>
        </form>
      </article>
      <article class="ops-panel users-filter-panel">
        <div class="ops-panel-title"><div><h3>Tìm và lọc tài khoản</h3><p>Lọc nhanh theo mã nhân viên, họ tên, quyền hoặc trạng thái.</p></div></div>
        <form id="user-filter-form" class="users-form-grid">
          <label class="span">Tìm kiếm<input name="query" value="${esc(userQuery)}" placeholder="Mã nhân viên / họ tên / tài khoản" /></label>
          <label>Quyền<select name="role"><option value="">Tất cả quyền</option>${["PICKER","REPORTER","ADMIN"].map((role) => `<option value="${role}" ${userRole === role ? "selected" : ""}>${esc(businessRoleLabel(role))}</option>`).join("")}</select></label>
          <label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option><option value="ACTIVE" ${userStatus === "ACTIVE" ? "selected" : ""}>Đang hoạt động</option><option value="DISABLED" ${userStatus === "DISABLED" ? "selected" : ""}>Đã dừng</option></select></label>
          <div class="ops-form-actions"><button class="secondary">Áp dụng bộ lọc</button></div>
        </form>
      </article>
    </div>
    <article class="ops-panel ops-users-panel">
      <div class="ops-panel-title"><div><h3>Danh sách tài khoản</h3><p>Thao tác hàng loạt chỉ áp dụng cho Picker.</p></div><span>${pageStart}–${pageEnd} / ${userTotal.toLocaleString("vi-VN")}</span></div>
      <div class="user-bulk-bar"><button class="secondary" id="toggle-all-pickers">${allPickerSelection ? "Bỏ chọn tất cả Picker" : "Chọn tất cả Picker"}</button><button class="secondary" data-picker-action="ENABLE">Mở lại</button><button class="secondary" data-picker-action="DISABLE">Dừng hoạt động</button><button class="danger" data-picker-action="DELETE">Xóa Picker</button><span>${allPickerSelection ? "Đã chọn tất cả Picker" : `${selectedCount} đã chọn`}</span></div>
      <div class="table-wrap"><table class="ops-users-table"><thead><tr><th></th><th>Mã nhân viên</th><th>Họ và tên</th><th>Quyền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        ${managedUsers.length ? managedUsers.map((user) => `<tr><td><input type="checkbox" data-user-select="${esc(user.user_id)}" ${allPickerSelection || selectedUserIds.has(user.user_id) ? "checked" : ""} ${user.role !== "PICKER" || allPickerSelection ? "disabled" : ""}/></td><td><b>${esc(user.employee_code || user.user_id)}</b></td><td>${esc(user.display_name)}</td><td>${esc(businessRoleLabel(user.role))}</td><td><span class="badge ${user.status === "ACTIVE" ? "good" : "closed"}">${user.status === "ACTIVE" ? "Đang hoạt động" : "Đã dừng"}</span></td><td><div class="user-row-actions"><button class="secondary" data-edit-user="${esc(user.user_id)}">Sửa</button><button class="secondary" data-password-user="${esc(user.user_id)}">Đổi mật khẩu</button></div></td></tr>`).join("") : `<tr><td colspan="6" class="ops-empty">Không có tài khoản phù hợp.</td></tr>`}
      </tbody></table></div>
      <div class="user-pagination"><span>Trang hiển thị ${pageStart}–${pageEnd}</span><div><button class="secondary" id="user-prev" ${userOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="user-next" ${userOffset + USER_PAGE_SIZE >= userTotal ? "disabled" : ""}>Trang sau</button></div></div>
    </article>
  </section>`;
}

function renderSla(): string {
  const sla = slaResponse?.sla;
  const insight = operationalInsights?.sla;
  const autoEnabled = sla?.auto_skip_enabled === true;
  const mode = sla?.auto_skip_mode || "FIRST_REPORT";
  return `<section class="ops-route sla-workspace">
    <div class="business-page-head"><div><h2>Thời gian xử lý</h2><p>Thiết lập ba mốc thời gian theo giờ hệ thống. Luôn phải theo thứ tự Cảnh báo &lt; Quá hạn &lt; Tự động cho phép bỏ qua.</p></div></div>
    <form id="sla-form" class="ops-panel sla-config-panel">
      <div class="sla-config-body">
        <div class="ops-settings-grid sla-threshold-grid">
          <article class="ops-setting-card"><span class="ops-step">01</span><h3>Cảnh báo</h3><p>Đánh dấu vàng và thông báo cho bộ phận xử lý khi SKU đạt mốc này.</p><label>Phút<input name="warning" type="number" min="1" max="1440" value="${esc(sla?.warning_minutes || "")}" required /></label></article>
          <article class="ops-setting-card"><span class="ops-step">02</span><h3>Quá hạn</h3><p>Đánh dấu đỏ và cảnh báo mức cao cho người liên quan.</p><label>Phút<input name="escalation" type="number" min="2" max="2880" value="${esc(sla?.escalation_minutes || "")}" required /></label></article>
          <article class="ops-setting-card"><span class="ops-step">03</span><h3>Tự động cho phép bỏ qua</h3><p>Nếu Invent vẫn chưa phản hồi khi tới mốc này, hệ thống có thể tự cấp kết quả bỏ qua.</p><label>Phút<input name="autoSkip" type="number" min="3" max="10080" value="${esc(sla?.auto_skip_minutes || "")}" required /></label></article>
        </div>
        <div class="sla-auto-policy">
          <label class="account-setting-row"><input name="autoSkipEnabled" type="checkbox" ${autoEnabled ? "checked" : ""}/><span><strong>Bật tự động cho phép Picker bỏ qua khi quá thời gian</strong><small>Tắt chức năng sẽ hủy các mốc tự động chưa chạy. Bật lại chỉ áp dụng cho báo mới, không hồi tố báo cũ.</small></span></label>
          <div class="sla-mode-options">
            <span>Cách tính mốc tự động</span>
            <label><input type="radio" name="autoSkipMode" value="FIRST_REPORT" ${mode === "FIRST_REPORT" ? "checked" : ""}/> Tính từ người báo đầu tiên của SKU</label>
            <label><input type="radio" name="autoSkipMode" value="PER_PICKER" ${mode === "PER_PICKER" ? "checked" : ""}/> Tính riêng từ thời điểm từng Picker báo</label>
          </div>
        </div>
      </div>
      <div class="sla-config-footer"><span class="muted tiny">Ví dụ 10 → 15 → 20 phút. Thay đổi số phút không làm tự động hồi tố các deadline đã được cấp trước đó.</span><button class="primary">Lưu thiết lập</button></div>
    </form>
    <section class="sla-current-grid" aria-label="Tình trạng hiện tại">
      <article class="sla-current-card warning"><span>Đang ở mức cảnh báo</span><strong>${Number(insight?.warning_count || 0)}</strong></article>
      <article class="sla-current-card danger"><span>Đang quá hạn</span><strong>${Number(insight?.escalated_count || 0)}</strong></article>
      <article class="sla-current-card ${autoEnabled ? "auto" : ""}"><span>Tự động cho phép bỏ qua</span><strong>${autoEnabled ? "Bật" : "Tắt"}</strong></article>
    </section>
  </section>`;
}

function renderReportTabs(current: "dashboard" | "reports"): string {
  return `<div class="workspace-tabs" role="tablist" aria-label="Tổng quan và báo cáo">
    <button type="button" class="workspace-tab ${current === "dashboard" ? "active" : ""}" data-workspace-section="dashboard">Tổng quan</button>
    <button type="button" class="workspace-tab ${current === "reports" ? "active" : ""}" data-workspace-section="reports">Báo cáo chi tiết</button>
  </div>`;
}

function renderDashboard(): string {
  const k = dashboardData?.kpis;
  const recurrence = operationalInsights?.recurrence?.top_skus || [];
  const timeline = dashboardData?.timeline || [];
  const outcomes = dashboardData?.outcomes || [];
  const count = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const hasStock = count("HAS_STOCK");
  const skipped = count("SKIP_ALLOWED");
  const withdrawn = count("CLOSED");
  const pending = Number(k?.pending_batch_count || 0);
  const totalResolved = Math.max(0, hasStock + skipped + withdrawn);
  const outcomePct = (value: number) => totalResolved > 0 ? Math.round(value * 100 / totalResolved) : 0;
  const warningCount = Number(operationalInsights?.sla?.warning_count || 0);
  const overdueCount = Number(operationalInsights?.sla?.escalated_count || 0);
  const roleOnline = realtimePresence?.online_users_by_role || { PICKER: 0, REPORTER: 0, ADMIN: 0, ROOT: 0 };
  const onlineTotal = Number(realtimePresence?.online_users || 0);
  const hourly = Array.from({ length: 24 }, (_, index) => Number(timeline[index]?.reports || 0));
  const maxHour = Math.max(1, ...hourly);
  return `<section class="v5-root report-workspace">
    <div class="business-page-head"><div><h2>Tổng quan & báo cáo</h2><p>Toàn cảnh vận hành báo hàng theo thời gian được chọn.</p></div></div>
    ${renderReportTabs("dashboard")}
    <article class="ops-panel report-filter-panel">
      <form id="dashboard-filter" class="report-filter-row report-filter-compact">
        ${renderCompactDateRange("dashboard", dashboardFrom, dashboardTo)}
        <button class="primary report-filter-submit">Xem</button>
      </form>
    </article>

    <div class="report-section-title"><h3>Tình trạng hiện tại</h3><span>Dữ liệu trực tiếp từ hệ thống</span></div>
    <section class="business-summary-grid business-summary-grid-4">
      <article class="business-summary-card primary"><span>SKU đang chờ xử lý</span><strong>${pending}</strong><small>${Number(k?.pending_picker_count || 0)} Picker đang bị ảnh hưởng</small></article>
      <article class="business-summary-card warning"><span>Sắp quá thời gian</span><strong>${warningCount}</strong><small>Cần ưu tiên kiểm tra</small></article>
      <article class="business-summary-card danger"><span>Đã quá thời gian</span><strong>${overdueCount}</strong><small>Cần xử lý ngay</small></article>
      <article class="business-summary-card good"><span>Người đang online</span><strong>${onlineTotal}</strong><small>Đang đăng nhập và kết nối bình thường</small></article>
    </section>

    <div class="report-layout-two">
      <article class="ops-panel presence-panel">
        <div class="ops-panel-title"><div><h3>Người đang online theo quyền</h3><p>Một tài khoản được tính một lần dù mở nhiều phiên cùng quyền.</p></div></div>
        <div class="presence-grid">
          <div><span>Người lấy hàng</span><strong>${Number(roleOnline.PICKER || 0)}</strong></div>
          <div><span>Người xử lý báo hàng</span><strong>${Number(roleOnline.REPORTER || 0)}</strong></div>
          <div><span>Quản trị</span><strong>${Number(roleOnline.ADMIN || 0)}</strong></div>
          <div><span>Quản trị hệ thống</span><strong>${Number(roleOnline.ROOT || 0)}</strong></div>
        </div>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Khối lượng trong kỳ</h3><p>Các chỉ số chính theo khoảng thời gian đã chọn.</p></div></div>
        <div class="presence-grid">
          <div><span>Lượt báo hết hàng</span><strong>${Number(k?.reports_count || 0)}</strong></div>
          <div><span>SKU phát sinh</span><strong>${Number(k?.unique_sku_count || 0)}</strong></div>
          <div><span>Đợt đã xử lý</span><strong>${Number(k?.resolved_batch_count || 0)}</strong></div>
          <div><span>Thời gian xử lý bình quân</span><strong>${k?.avg_resolution_minutes == null ? "—" : `${k.avg_resolution_minutes} phút`}</strong></div>
        </div>
      </article>
    </div>

    <div class="report-layout-two">
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Kết quả xử lý</h3><p>Tỷ trọng các kết quả đã khép lại trong kỳ.</p></div></div>
        <div class="v5-outcome-bars">
          <div class="v5-outcome-line"><div><span>Đã có hàng</span><b>${hasStock}</b></div><div class="v5-track"><i class="green" style="width:${outcomePct(hasStock)}%"></i></div><small>${outcomePct(hasStock)}%</small></div>
          <div class="v5-outcome-line"><div><span>Được phép bỏ qua</span><b>${skipped}</b></div><div class="v5-track"><i class="red" style="width:${outcomePct(skipped)}%"></i></div><small>${outcomePct(skipped)}%</small></div>
          <div class="v5-outcome-line"><div><span>Picker đã thu hồi</span><b>${withdrawn}</b></div><div class="v5-track"><i class="gray" style="width:${outcomePct(withdrawn)}%"></i></div><small>${outcomePct(withdrawn)}%</small></div>
        </div>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>SKU phát sinh lại</h3><p>Ưu tiên xem các SKU đã xử lý nhưng tiếp tục được báo lại.</p></div></div>
        ${recurrence.length ? `<div class="v5-rank-list">${recurrence.slice(0,8).map((row,index) => `<div class="v5-rank-row"><b>${index+1}</b><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><em>${Number(row.recurrence_count)} lần</em></div>`).join("")}</div>` : `<div class="v5-empty">Không có SKU phát sinh lại trong kỳ.</div>`}
      </article>
    </div>

    <div class="report-layout-two">
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>Phát sinh theo giờ</h3><p>Số lượt báo phân bổ trong ngày.</p></div></div><div class="v5-hourly">${hourly.map((value, hour) => `<div class="v5-hour"><i style="height:${Math.max(value ? 6 : 2, value / maxHour * 100)}%"></i><span>${hour % 3 === 0 ? String(hour).padStart(2,"0") : ""}</span></div>`).join("")}</div></article>
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>SKU phát sinh nhiều</h3><p>SKU có nhiều lượt báo nhất trong kỳ.</p></div></div>${dashboardData?.top_skus?.length ? `<div class="v5-rank-list">${dashboardData.top_skus.slice(0,8).map((row,index) => `<div class="v5-rank-row"><b>${index+1}</b><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><em>${row.report_count} báo</em></div>`).join("")}</div>` : `<div class="v5-empty">Chưa có dữ liệu.</div>`}</article>
    </div>
  </section>`;
}

function renderReports(): string {
  const k = reportSummary?.kpis;
  const outcomes = reportSummary?.outcomes || [];
  const count = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const recurrenceCount = reportInsights?.recurrence?.top_skus?.length || 0;
  return `<section class="ops-route report-workspace">
    <div class="business-page-head"><div><h2>Tổng quan & báo cáo</h2><p>Tra cứu chi tiết các đợt báo hàng theo thời gian, trạng thái và SKU.</p></div><button class="secondary" id="export-reports">Xuất Excel</button></div>
    ${renderReportTabs("reports")}
    <article class="ops-panel report-filter-panel">
      <form id="report-filter" class="report-filter-grid report-filter-compact report-filter-detail">
        ${renderCompactDateRange("reports", reportFrom, reportTo)}
        <label>Kết quả<select name="status"><option value="">Tất cả kết quả</option>${["PENDING","HAS_STOCK","SKIP_ALLOWED","CLOSED"].map((state) => `<option value="${state}" ${reportStatus === state ? "selected" : ""}>${esc(statusLabel(state))}</option>`).join("")}</select></label>
        <label class="report-query-field">SKU / tên sản phẩm<input name="query" value="${esc(reportQuery)}" placeholder="Nhập SKU hoặc tên sản phẩm" /></label>
        <button class="primary report-filter-submit">Xem báo cáo</button>
      </form>
    </article>
    <section class="business-summary-grid business-summary-grid-4">
      <article class="business-summary-card primary"><span>Lượt báo hết hàng</span><strong>${Number(k?.reports_count || 0)}</strong><small>Trong khoảng thời gian đã chọn</small></article>
      <article class="business-summary-card good"><span>Đã có hàng</span><strong>${count("HAS_STOCK")}</strong><small>Đợt kết thúc với kết quả có hàng</small></article>
      <article class="business-summary-card danger"><span>Được phép bỏ qua</span><strong>${count("SKIP_ALLOWED")}</strong><small>Đợt được phép bỏ qua SKU</small></article>
      <article class="business-summary-card warning"><span>SKU phát sinh lại</span><strong>${recurrenceCount}</strong><small>Số SKU nổi bật có phát sinh lại</small></article>
    </section>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Chi tiết đợt báo hàng</h3><p>${reportTotal.toLocaleString("vi-VN")} bản ghi phù hợp với bộ lọc.</p></div><div class="user-row-actions"><button class="secondary" id="report-prev" ${reportOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="report-next" ${reportOffset + REPORT_PAGE_SIZE >= reportTotal ? "disabled" : ""}>Trang sau</button></div></div>
      <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Kết quả</th><th>Báo lần đầu</th><th>Xử lý xong</th><th>Thời gian xử lý</th><th>Số lượt báo</th></tr></thead><tbody>${reportRows.map((row) => `<tr><td><strong>${esc(row.sku)}</strong></td><td>${esc(row.product_name)}</td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : row.status === "CLOSED" ? "closed" : "warning"}">${esc(statusLabel(row.status))}</span></td><td>${esc(fmt(row.first_report_at))}</td><td>${esc(fmt(row.resolved_at))}</td><td>${row.duration_minutes == null ? "—" : `${row.duration_minutes} phút`}</td><td>${row.total_ticket_count}</td></tr>`).join("") || `<tr><td colspan="7" class="ops-empty">Chưa có dữ liệu phù hợp.</td></tr>`}</tbody></table></div>
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
    format: "supra-inventory-support-v2",
    generated_at: new Date().toISOString(),
    app: {
      surface: "WEB",
      host: window.location.host,
    },
    runtime: getWebRuntimeDiagnosticSnapshot("download_support_log"),
    service_health: serviceHealth ? sanitizeDiagnosticValue(serviceHealth) : null,
  };
}

function downloadSupportDiagnostics(): void {
  const body = JSON.stringify(supportDiagnostics(), null, 2).slice(0, 180_000);
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
  const link = document.createElement("a");
  link.href = url;
  link.download = `supra-inventory-support-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function systemObj(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function systemNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtBytes(value: unknown): string {
  const bytes = systemNum(value);
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let scaled = bytes;
  while (scaled >= 1000 && index < units.length - 1) {
    scaled /= 1000;
    index += 1;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${scaled.toFixed(digits)} ${units[index]}`;
}

function usagePercent(used: unknown, limit: unknown): number | null {
  const a = systemNum(used);
  const b = systemNum(limit);
  if (a < 0 || b <= 0) return null;
  return Math.max(0, Math.min(100, a * 100 / b));
}

function usageBar(used: unknown, limit: unknown, label = ""): string {
  const pct = usagePercent(used, limit);
  if (pct == null) return `<div class="system-usage-line"><span>${esc(label || "Đang dùng")}</span><strong>${fmtBytes(used)}</strong></div>`;
  const tone = pct >= 85 ? "danger" : pct >= 65 ? "warning" : "good";
  return `<div class="system-usage"><div class="system-usage-line"><span>${esc(label || "Đang dùng")}</span><strong>${fmtBytes(used)} / ${fmtBytes(limit)} · ${pct.toFixed(pct >= 10 ? 1 : 2)}%</strong></div><div class="system-meter"><i class="${tone}" style="width:${Math.max(.5,pct)}%"></i></div></div>`;
}

function renderSystem(): string {
  const snapshot = systemStatus;
  const core = systemObj(snapshot?.core);
  const sqlite = systemObj(core.sqlite);
  const accounts = systemObj(core.accounts);
  const business = systemObj(core.business);
  const realtime = systemObj(core.realtime);
  const notifications = systemObj(core.notifications);
  const archive = systemObj(core.archive);
  const hr = systemObj(core.hr_source);
  const providers = systemObj(snapshot?.providers);
  const drive = systemObj(providers.google_drive);
  const driveQuota = systemObj(drive.storage_quota);
  const folders = systemObj(drive.folders);
  const logsFolder = systemObj(folders.logs);
  const archiveFolder = systemObj(folders.archive);
  const exportsFolder = systemObj(folders.exports);
  const github = systemObj(providers.github);
  const release = systemObj(github.latest_beta_release);
  const limits = systemObj(snapshot?.limits);
  const workerLimits = systemObj(limits.cloudflare_workers);
  const workerFree = systemObj(workerLimits.free);
  const workerPaid = systemObj(workerLimits.paid);
  const doLimits = systemObj(limits.durable_objects_sqlite);
  const roleCounts = systemObj(accounts.by_role);
  const accountStatus = systemObj(accounts.by_status);
  const batchStatus = systemObj(business.batches_by_status);
  const ticketStatus = systemObj(business.tickets_by_status);
  const delivery = systemObj(notifications.delivery_last_24_hours);
  const devices = systemObj(notifications.active_by_platform);
  const tables = systemObj(sqlite.table_rows);
  const loadTest = systemObj(core.last_load_test);
  const driveLimit = driveQuota.limit_bytes == null ? null : systemNum(driveQuota.limit_bytes);
  const driveUsed = driveQuota.usage_bytes == null ? null : systemNum(driveQuota.usage_bytes);
  const dbSize = systemNum(sqlite.database_size_bytes);
  const doLimit = systemNum(doLimits.storage_per_object_bytes);
  const providerRefresh = String(providers.refreshed_at || "");
  const overallOk = serviceReachable && !core.error;
  const successfulLoad = systemNum(loadTest.successful_reports);

  return `<section class="ops-route system-workspace">
    <div class="business-page-head">
      <div><h2>Trạng thái hệ thống</h2><p>Theo dõi tình trạng, mức sử dụng và giới hạn của các dịch vụ.</p></div>
      <button class="secondary" id="refresh-system">Cập nhật số liệu</button>
    </div>

    <div class="system-refresh-note">
      <span>Số liệu chính tự cập nhật mỗi 60 giây khi đang mở trang.</span>
      <span>Số liệu Google Drive và GitHub cập nhật tối đa mỗi 5 phút.</span>
      <span>Cập nhật gần nhất: <b>${esc(snapshot?.generated_at ? fmt(snapshot.generated_at) : "Chưa tải")}</b></span>
    </div>

    <section class="business-summary-grid business-summary-grid-4">
      <article class="business-summary-card ${overallOk ? "good" : "danger"}"><span>Hệ thống nghiệp vụ</span><strong>${overallOk ? "Hoạt động" : "Cần kiểm tra"}</strong><small>Dịch vụ chính</small></article>
      <article class="business-summary-card primary"><span>Dữ liệu đang dùng</span><strong>${fmtBytes(dbSize)}</strong><small>${doLimit ? `${(usagePercent(dbSize, doLimit) || 0).toFixed(3)}% giới hạn vùng dữ liệu` : "Đang đo dung lượng"}</small></article>
      <article class="business-summary-card good"><span>Người đang online</span><strong>${systemNum(realtime.online_users)}</strong><small>${systemNum(realtime.online_sessions)} phiên đang kết nối</small></article>
      <article class="business-summary-card"><span>Google Drive</span><strong>${driveUsed == null ? "—" : fmtBytes(driveUsed)}</strong><small>${driveLimit ? `Giới hạn ${fmtBytes(driveLimit)}` : "Chưa đọc được giới hạn"}</small></article>
    </section>

    <div class="system-service-grid">
      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Cloudflare</span><h3>Website & dịch vụ xử lý</h3></div><b class="system-health ${serviceReachable ? "ok" : "bad"}">${serviceReachable ? "Đang hoạt động" : "Mất kết nối"}</b></div>
        <p class="system-service-desc">Cung cấp website và xử lý các yêu cầu nghiệp vụ.</p>
        <div class="system-facts">
          <div><span>Kết nối Internet</span><b>${navigator.onLine ? "Bình thường" : "Mất kết nối"}</b></div>
          <div><span>Đồng bộ tức thời</span><b>${realtimeState === "connected" ? "Đã kết nối" : "Đang kết nối lại"}</b></div>
          <div><span>Người đang online</span><b>${systemNum(realtime.online_users).toLocaleString("vi-VN")}</b></div>
          <div><span>Phiên đang kết nối</span><b>${systemNum(realtime.online_sessions).toLocaleString("vi-VN")}</b></div>
        </div>
        <div class="system-limit-box"><strong>Giới hạn dịch vụ tham chiếu</strong><div>Gói miễn phí: ${systemNum(workerFree.requests_per_day).toLocaleString("vi-VN")} yêu cầu/ngày · bộ nhớ ${fmtBytes(workerFree.memory_bytes_per_isolate)}.</div><div>Gói trả phí: không giới hạn số yêu cầu/ngày theo mức tham chiếu · bộ nhớ ${fmtBytes(workerPaid.memory_bytes_per_isolate)}.</div><small>Gói đang sử dụng không được trả về trực tiếp nên các mức trên chỉ dùng để đối chiếu.</small></div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Cloudflare</span><h3>Cơ sở dữ liệu nghiệp vụ</h3></div><b class="system-health ok">Sẵn sàng</b></div>
        <p class="system-service-desc">Lưu SKU, báo hàng, lịch sử xử lý và cấu hình hệ thống.</p>
        ${usageBar(dbSize, doLimit, "Dung lượng dữ liệu")}
        <div class="system-facts">
          <div><span>SKU</span><b>${systemNum(business.sku_count).toLocaleString("vi-VN")}</b></div>
          <div><span>Đợt xử lý</span><b>${systemNum(tables.report_batches).toLocaleString("vi-VN")}</b></div>
          <div><span>Lượt báo Picker</span><b>${systemNum(tables.report_tickets).toLocaleString("vi-VN")}</b></div>
          <div><span>Bản ghi cập nhật</span><b>${systemNum(realtime.retained_events).toLocaleString("vi-VN")}</b></div>
        </div>
        <div class="system-limit-box"><strong>Giới hạn lưu trữ tham chiếu</strong><div>10 GB cho mỗi vùng dữ liệu · tổng miễn phí 5 GB · tối đa 5 triệu lượt đọc và 100.000 lượt ghi/ngày ở mức miễn phí.</div><div>Khả năng xử lý tham chiếu khoảng 1.000 yêu cầu/giây cho một vùng dữ liệu.</div></div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Firebase</span><h3>Đăng nhập & tài khoản</h3></div><b class="system-health ${systemNum(accounts.total) ? "ok" : "warn"}">${systemNum(accounts.total) ? "Hoạt động" : "Chưa có dữ liệu"}</b></div>
        <p class="system-service-desc">Quản lý đăng nhập và phiên sử dụng của người dùng.</p>
        <div class="system-facts">
          <div><span>Tài khoản ứng dụng</span><b>${systemNum(accounts.total).toLocaleString("vi-VN")}</b></div>
          <div><span>Đã liên kết đăng nhập</span><b>${systemNum(accounts.firebase_linked).toLocaleString("vi-VN")}</b></div>
          <div><span>Đang hoạt động</span><b>${systemNum(accountStatus.ACTIVE).toLocaleString("vi-VN")}</b></div>
          <div><span>Đã dừng</span><b>${systemNum(accountStatus.DISABLED).toLocaleString("vi-VN")}</b></div>
        </div>
        <div class="system-role-mini"><span>Picker <b>${systemNum(roleCounts.PICKER)}</b></span><span>Người xử lý <b>${systemNum(roleCounts.REPORTER)}</b></span><span>Quản trị <b>${systemNum(roleCounts.ADMIN)}</b></span><span>Quản trị hệ thống <b>${systemNum(roleCounts.ROOT)}</b></span></div>
        <div class="system-limit-box"><strong>Giới hạn đăng nhập tham chiếu</strong><div>Mức miễn phí tham chiếu: 3.000 người dùng hoạt động/ngày.</div><small>Gói đang sử dụng không được trả về trực tiếp nên mức trên chỉ dùng để đối chiếu.</small></div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Firebase</span><h3>Thông báo ứng dụng</h3></div><b class="system-health ${systemNum(delivery.FAILED) ? "warn" : "ok"}">${systemNum(delivery.FAILED) ? "Có lỗi gửi" : "Bình thường"}</b></div>
        <p class="system-service-desc">Gửi thông báo đến thiết bị khi có kết quả hoặc thay đổi cần chú ý.</p>
        <div class="system-facts">
          <div><span>Thiết bị Android</span><b>${systemNum(devices.ANDROID).toLocaleString("vi-VN")}</b></div>
          <div><span>Thiết bị Web</span><b>${systemNum(devices.WEB).toLocaleString("vi-VN")}</b></div>
          <div><span>Gửi thành công 24h</span><b>${systemNum(delivery.SENT).toLocaleString("vi-VN")}</b></div>
          <div><span>Gửi lỗi 24h</span><b>${systemNum(delivery.FAILED).toLocaleString("vi-VN")}</b></div>
        </div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Google Drive</span><h3>Lưu trữ file</h3></div><b class="system-health ${drive.status === "ok" ? "ok" : "warn"}">${drive.status === "ok" ? "Đã kết nối" : "Chưa đọc được"}</b></div>
        <p class="system-service-desc">Lưu nhật ký, dữ liệu lịch sử và file xuất.</p>
        ${driveUsed == null ? `<div class="system-usage-line"><span>Dung lượng tài khoản</span><strong>Chưa đọc được</strong></div>` : usageBar(driveUsed, driveLimit, "Dung lượng tài khoản Google")}
        <div class="system-folder-grid">
          <div><span>Nhật ký</span><b>${systemNum(logsFolder.item_count)} file · ${fmtBytes(logsFolder.binary_size_bytes)}</b></div>
          <div><span>Lưu trữ</span><b>${systemNum(archiveFolder.item_count)} file · ${fmtBytes(archiveFolder.binary_size_bytes)}</b></div>
          <div><span>File xuất</span><b>${systemNum(exportsFolder.item_count)} file · ${fmtBytes(exportsFolder.binary_size_bytes)}</b></div>
        </div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Google Sheets</span><h3>Nguồn nhân sự & lưu trữ</h3></div><b class="system-health ${hr.configured ? "ok" : "warn"}">${hr.configured ? "Đã cấu hình" : "Chưa cấu hình"}</b></div>
        <p class="system-service-desc">Đọc danh sách nhân sự và lưu dữ liệu lịch sử theo đợt.</p>
        <div class="system-facts">
          <div><span>Nhân sự nguồn</span><b>${systemNum(hr.data_row_count).toLocaleString("vi-VN")} dòng</b></div>
          <div><span>Tab nhân sự</span><b>${esc(String(hr.tab_name || "—"))}</b></div>
          <div><span>Đợt đã lưu trữ</span><b>${systemNum(archive.exported_batches).toLocaleString("vi-VN")}</b></div>
          <div><span>Cập nhật nguồn</span><b>${hr.updated_at ? esc(fmt(String(hr.updated_at))) : "—"}</b></div>
        </div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">GitHub</span><h3>Phiên bản ứng dụng</h3></div><b class="system-health ${github.status === "ok" ? "ok" : "warn"}">${github.status === "ok" ? "Đã kết nối" : "Chưa đọc được"}</b></div>
        <p class="system-service-desc">Theo dõi phiên bản ứng dụng đang phát hành.</p>
        <div class="system-facts">
          <div><span>Phiên bản mới nhất</span><b>${esc(String(release.tag || "—").replace(/^beta[-_]?/i, ""))}</b></div>
          <div><span>Ngày phát hành</span><b>${release.published_at ? esc(fmt(String(release.published_at))) : "—"}</b></div>
          <div><span>Cập nhật số liệu</span><b>${providerRefresh ? esc(fmt(providerRefresh)) : "—"}</b></div>
        </div>
      </article>

      <article class="ops-panel system-service-card">
        <div class="system-service-head"><div><span class="system-provider">Kết nối trực tiếp</span><h3>Đồng bộ tức thời</h3></div><b class="system-health ${realtimeState === "connected" ? "ok" : "warn"}">${realtimeState === "connected" ? "Đã kết nối" : "Đang nối lại"}</b></div>
        <p class="system-service-desc">Cập nhật thay đổi giữa các thiết bị đang sử dụng.</p>
        <div class="system-facts">
          <div><span>Người online</span><b>${systemNum(realtime.online_users)}</b></div>
          <div><span>Phiên online</span><b>${systemNum(realtime.online_sessions)}</b></div>
          <div><span>Mốc đồng bộ</span><b>${systemNum(realtime.max_seq).toLocaleString("vi-VN")}</b></div>
          <div><span>Bản ghi đồng bộ còn lưu</span><b>${systemNum(realtime.retained_events).toLocaleString("vi-VN")}</b></div>
        </div>
      </article>
    </div>

    <div class="report-section-title"><h3>Dữ liệu nghiệp vụ đang lưu</h3><span>Số lượng bản ghi hiện tại</span></div>
    <article class="ops-panel">
      <div class="system-table-grid">
        <div><span>SKU</span><b>${systemNum(tables.sku_master).toLocaleString("vi-VN")}</b></div>
        <div><span>Đợt xử lý</span><b>${systemNum(tables.report_batches).toLocaleString("vi-VN")}</b></div>
        <div><span>Lượt báo Picker</span><b>${systemNum(tables.report_tickets).toLocaleString("vi-VN")}</b></div>
        <div><span>Lịch sử xử lý</span><b>${systemNum(tables.report_events).toLocaleString("vi-VN")}</b></div>
        <div><span>Bản ghi cập nhật</span><b>${systemNum(tables.realtime_events).toLocaleString("vi-VN")}</b></div>
        <div><span>Xác nhận kết quả</span><b>${systemNum(tables.result_acknowledgements).toLocaleString("vi-VN")}</b></div>
        <div><span>Nhật ký thao tác</span><b>${systemNum(tables.audit_log).toLocaleString("vi-VN")}</b></div>
        <div><span>Thiết bị nhận thông báo</span><b>${systemNum(tables.fcm_devices).toLocaleString("vi-VN")}</b></div>
      </div>
      <div class="system-status-strip">
        <span>10 phút gần nhất <b>${systemNum(business.reports_last_10_minutes)} lượt báo</b></span>
        <span>24 giờ gần nhất <b>${systemNum(business.reports_last_24_hours)} lượt báo</b></span>
        <span>Đang chờ xử lý <b>${systemNum(batchStatus.PENDING)} đợt / ${systemNum(ticketStatus.OPEN)} Picker</b></span>
      </div>
    </article>

    <div class="report-section-title"><h3>Bài kiểm tra tải gần nhất</h3></div>
    <article class="ops-panel">
      ${loadTest.test_id ? `
        <div class="system-load-grid">
          <div><span>Lượt báo thành công</span><b>${successfulLoad.toLocaleString("vi-VN")} / ${systemNum(loadTest.requested_reports).toLocaleString("vi-VN")}</b></div>
          <div><span>Picker tham gia</span><b>${systemNum(loadTest.picker_count)}</b></div>
          <div><span>SKU phát sinh</span><b>${systemNum(loadTest.unique_skus_reported)} / ${systemNum(loadTest.sku_count)}</b></div>
          <div><span>Thời gian chạy</span><b>${systemNum(loadTest.duration_seconds).toFixed(1)} giây</b></div>
          <div><span>Phản hồi bình quân</span><b>${systemNum(loadTest.average_ms).toFixed(1)} ms</b></div>
          <div><span>95% yêu cầu dưới</span><b>${systemNum(loadTest.p95_ms).toFixed(1)} ms</b></div>
        </div>
        <p class="system-test-note">Hoàn thành ${esc(String(loadTest.completed_at ? fmt(String(loadTest.completed_at)) : "—"))}. Đây là số liệu đo thực tế tại thời điểm kiểm tra.</p>
      ` : `<div class="ops-empty">Chưa có kết quả kiểm tra tải.</div>`}
    </article>
  </section>`;
}

function renderLegacyDevices(): string {
  return renderSystem();
}

function logSourceLabel(source: unknown): string {
  return String(source || "").toUpperCase() === "ANDROID" ? "Android" : "Web";
}

function logSectionLabel(section: unknown): string {
  const labels: Record<string, string> = {
    picker: "Báo thiếu hàng",
    operations: "Xử lý báo hàng",
    results: "Kết quả gần đây",
    sku: "Danh mục SKU",
    hr: "Nguồn nhân sự",
    users: "Nhân sự & tài khoản",
    sla: "Thời gian xử lý",
    dashboard: "Tổng quan",
    reports: "Báo cáo chi tiết",
    system: "Trạng thái hệ thống",
    devices: "Trạng thái hệ thống",
    logs: "Nhật ký",
    versions: "Trạng thái hệ thống",
    account: "Tài khoản",
  };
  return labels[String(section || "").toLowerCase()] || "Trang ứng dụng";
}

function renderRuntimeLogSummary(): string {
  if (!runtimeLogDetail) return `<div class="ops-empty">Chưa chọn nhật ký.</div>`;
  const content = systemObj(runtimeLogDetail.content);
  const payload = systemObj(content.payload);
  const browser = systemObj(payload.browser);
  const connection = systemObj(browser.connection);
  const memory = systemObj(browser.memory);
  const performanceInfo = systemObj(payload.performance);
  const navigation = systemObj(performanceInfo.navigation);
  const resources = systemObj(performanceInfo.resources);
  const state = systemObj(payload.state);
  const queueState = systemObj(state.queue);
  const recentResultState = systemObj(state.recent_results);
  const realtime = systemObj(state.realtime);
  const device = systemObj(content.device);
  const dom = systemObj(payload.dom);
  const recentEvents = Array.isArray(payload.recent_events) ? payload.recent_events.map(systemObj) : [];
  const longTasks = Array.isArray(performanceInfo.long_tasks) ? performanceInfo.long_tasks.map(systemObj) : [];
  const slowResources = Array.isArray(resources.slowest) ? resources.slowest.map(systemObj) : [];
  const errorEvents = recentEvents.filter((item) => String(item.level || "").toUpperCase() === "ERROR");
  const apiEvents = recentEvents.filter((item) => String(item.category || "").toUpperCase() === "API");
  const renderEvents = recentEvents.filter((item) => String(item.category || "").toUpperCase() === "RENDER");
  const realtimeEvents = recentEvents.filter((item) => String(item.category || "").toUpperCase() === "REALTIME");
  const sourceLabel = logSourceLabel(content.source || runtimeLogSource);
  const severity = String(content.severity || "").toUpperCase() === "ERROR" ? "Có lỗi" : "Bình thường";
  const syncState = String(realtime.state || "").toLowerCase() === "connected"
    ? "Đã kết nối"
    : String(realtime.state || "").toLowerCase() === "offline"
      ? "Mất kết nối"
      : "Đang kết nối lại";
  const networkState = browser.online === false ? "Mất kết nối" : "Bình thường";
  const rtt = Number(connection.rtt_ms);
  const usedMemory = Number(memory.used_js_heap_bytes);
  const queueTotal = Number(queueState.total ?? state.queue_count ?? 0);
  const recentTotal = Number(recentResultState.total ?? state.recent_result_count ?? 0);
  const averageDuration = (items: Record<string, any>[]): string => {
    const values = items.map((item) => Number(item.duration_ms)).filter((value) => Number.isFinite(value) && value >= 0);
    if (!values.length) return "—";
    return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)} ms`;
  };
  const recentEventRows = recentEvents.slice(-30).reverse().map((item) => {
    const category = String(item.category || item.level || "APP");
    const name = String(item.name || item.message || "Hoạt động");
    const duration = Number(item.duration_ms);
    return `<div class="diagnostic-event-row"><span>${esc(fmt(String(item.at || "")))}</span><b>${esc(category)}</b><strong>${esc(name)}</strong><em>${Number.isFinite(duration) && duration > 0 ? `${Math.round(duration)} ms` : ""}</em></div>`;
  }).join("");
  const slowResourceRows = slowResources.slice(0, 12).map((item) => `
    <div class="diagnostic-event-row"><span>${esc(String(item.initiator || "resource"))}</span><b>${esc(String(item.path || "—"))}</b><strong>${Math.round(Number(item.duration_ms || 0))} ms</strong><em>${fmtBytes(item.transfer_size_bytes)}</em></div>
  `).join("");
  const longTaskRows = longTasks.slice(-12).reverse().map((item) => `
    <div class="diagnostic-event-row"><span>${esc(fmt(String(item.at || "")))}</span><b>Tác vụ dài</b><strong>${Math.round(Number(item.duration_ms || 0))} ms</strong><em></em></div>
  `).join("");
  return `<div class="log-detail-summary">
    <div class="system-facts diagnostic-facts">
      <div><span>Nguồn</span><b>${esc(sourceLabel)}</b></div>
      <div><span>Thời điểm</span><b>${esc(fmt(String(content.generated_at || runtimeLogDetail.file.created_at || "")))}</b></div>
      <div><span>Tình trạng</span><b>${esc(severity)}</b></div>
      <div><span>Thiết bị</span><b>${esc(String(device.label || device.platform || "—"))}</b></div>
      <div><span>Trang đang mở</span><b>${esc(logSectionLabel(state.section))}</b></div>
      <div><span>Kết nối mạng</span><b>${esc(networkState)}</b></div>
      <div><span>Đồng bộ tức thời</span><b>${esc(syncState)}</b></div>
      <div><span>Độ trễ mạng</span><b>${Number.isFinite(rtt) && rtt >= 0 ? `${Math.round(rtt)} ms` : "—"}</b></div>
      <div><span>Bộ nhớ trình duyệt</span><b>${Number.isFinite(usedMemory) && usedMemory >= 0 ? fmtBytes(usedMemory) : "—"}</b></div>
      <div><span>SKU đang chờ xử lý</span><b>${queueTotal.toLocaleString("vi-VN")}</b></div>
      <div><span>Kết quả gần đây</span><b>${recentTotal.toLocaleString("vi-VN")}</b></div>
      <div><span>Lỗi ghi nhận gần đây</span><b>${errorEvents.length.toLocaleString("vi-VN")}</b></div>
      <div><span>API trung bình</span><b>${averageDuration(apiEvents)}</b></div>
      <div><span>Render trung bình</span><b>${averageDuration(renderEvents)}</b></div>
      <div><span>Sự kiện realtime</span><b>${realtimeEvents.length.toLocaleString("vi-VN")}</b></div>
      <div><span>Tác vụ dài</span><b>${longTasks.length.toLocaleString("vi-VN")}</b></div>
      <div><span>DOM hiện tại</span><b>${systemNum(dom.nodes).toLocaleString("vi-VN")} phần tử</b></div>
      <div><span>Tải trang</span><b>${navigation.duration_ms == null ? "—" : `${Math.round(Number(navigation.duration_ms))} ms`}</b></div>
    </div>
    <section class="diagnostic-section"><h4>Hoạt động gần đây</h4><div class="diagnostic-event-list">${recentEventRows || '<div class="ops-empty">Chưa có sự kiện gần đây.</div>'}</div></section>
    <section class="diagnostic-section"><h4>Tài nguyên tải chậm</h4><div class="diagnostic-event-list">${slowResourceRows || '<div class="ops-empty">Không có dữ liệu tài nguyên.</div>'}</div></section>
    <section class="diagnostic-section"><h4>Tác vụ trình duyệt kéo dài</h4><div class="diagnostic-event-list">${longTaskRows || '<div class="ops-empty">Không ghi nhận tác vụ dài.</div>'}</div></section>
  </div>`;
}

function renderLogs(): string {
  return `<section class="ops-route logs-workspace">
    <div class="business-page-head"><div><h2>Nhật ký</h2></div><div class="user-row-actions"><button class="secondary" id="send-web-log">Gửi log Web ngay</button><button class="secondary" id="download-support-log">Tải log Web xuống</button></div></div>
    <div class="workspace-tabs" role="tablist" aria-label="Nguồn nhật ký">
      <button type="button" class="workspace-tab ${runtimeLogSource === "WEB" ? "active" : ""}" data-log-source="WEB">Log Web</button>
      <button type="button" class="workspace-tab ${runtimeLogSource === "ANDROID" ? "active" : ""}" data-log-source="ANDROID">Log Android</button>
    </div>
    <div class="logs-layout">
      <article class="ops-panel log-list-panel">
        <div class="ops-panel-title"><div><h3>Log ${runtimeLogSource === "WEB" ? "Web" : "Android"} gần đây</h3><p>${runtimeLogs.length} bản gần nhất.</p></div></div>
        <div class="log-list">${runtimeLogs.length ? runtimeLogs.map((item) => `<button type="button" class="log-row ${runtimeLogDetail?.file.id === item.id ? "selected" : ""}" data-log-file="${esc(item.id)}"><span class="log-severity ${item.severity === "ERROR" ? "error" : "info"}">${item.severity === "ERROR" ? "Lỗi" : "Định kỳ"}</span><div><strong>Nhật ký ${esc(logSourceLabel(item.source))}</strong><small>${esc(fmt(item.created_at))} · ${Math.max(1, Math.round(Number(item.size || 0) / 1024))} KB</small></div></button>`).join("") : `<div class="ops-empty">Chưa có log ${runtimeLogSource === "WEB" ? "Web" : "Android"}.</div>`}</div>
      </article>
      <article class="ops-panel log-detail-panel">
        <div class="ops-panel-title"><div><h3>Tóm tắt nhật ký</h3></div></div>
        ${renderRuntimeLogSummary()}
      </article>
    </div>
  </section>`;
}

function renderLegacyLogs(): string {
  return renderLogs();
}

function renderLegacyVersions(): string {
  return renderSystem();
}

const AGENT_RELEASE_TAG = "relay-agent-v15";
const AGENT_RELEASE_URL = "https://github.com/tamnv2/supra-inventory/releases/tag/" + AGENT_RELEASE_TAG;
const AGENT_DOWNLOAD_URL = "https://github.com/tamnv2/supra-inventory/releases/download/" + AGENT_RELEASE_TAG + "/Agent.Auto.Confirm.Pick.Pack.exe";

function renderTools(): string {
  return `<section class="ops-route tools-workspace">
    <div class="heading">
      <div><h2>Công cụ</h2><p class="muted">Phần mềm hỗ trợ vận hành giữa Pick Pack và Inventory.</p></div>
    </div>
    <div class="tools-grid">
      <article class="ops-panel tool-card tool-card-primary">
        <div class="tool-card-head">
          <img class="tool-icon-image" src="/app-icon.png" alt="" aria-hidden="true" />
          <div><h3>Agent Auto Confirm Pick Pack</h3><p>Agent Windows phục vụ luồng xác nhận lấy lại đơn và trao đổi dữ liệu với PDA.</p></div>
        </div>
        <div class="tool-facts">
          <div><span>Phiên bản</span><strong>v15</strong></div>
          <div><span>Nền tảng</span><strong>Windows</strong></div>
          <div><span>Quyền chạy</span><strong>User thường</strong></div>
          <div><span>Cập nhật</span><strong>Tự động qua GitHub</strong></div>
        </div>
        <div class="tool-actions">
          <a class="primary tool-download" href="${AGENT_DOWNLOAD_URL}">Tải Agent</a>
          <button type="button" class="secondary" id="copy-agent-link">Sao chép link</button>
        </div>
      </article>
      <article class="ops-panel tool-guide">
        <div class="ops-panel-title"><div><h3>Sử dụng</h3></div></div>
        <ol class="tool-steps">
          <li>Tải <strong>Agent Auto Confirm Pick Pack.exe</strong> từ link chính thức.</li>
          <li>Mở Agent bằng tài khoản Windows hiện tại; không cần quyền Administrator.</li>
          <li>Đăng nhập Agent bằng tài khoản ADMIN thực và thiết lập phiên Supra trên máy xử lý.</li>
          <li>Agent chạy nền ở System Tray và tự nhận yêu cầu từ PDA theo cơ chế đang được áp dụng.</li>
        </ol>
      </article>
      <article class="ops-panel tool-safety">
        <div class="ops-panel-title"><div><h3>Trạng thái nghiệp vụ</h3></div></div>
        <div class="tool-status-list">
          <div><span class="badge ok">Sẵn sàng</span><span>Tra cứu Picklist và phối hợp nhiều Agent.</span></div>
          <div><span class="badge">Tự động</span><span>Khởi động cùng Windows và tự kiểm tra cập nhật.</span></div>
          <div><span class="badge warning">Đang kiểm thử</span><span>Kênh PDA ↔ Agent cuối cùng vẫn chờ kết quả kiểm tra mạng nội bộ.</span></div>
        </div>
      </article>
    </div>
  </section>`;
}

function renderAccount(): string {
  return `<section class="ops-route account-workspace">
    <div class="heading"><div><h2>Tài khoản</h2></div></div>
    <div class="account-grid">
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>Đổi mật khẩu</h3></div></div><form id="password-form" class="ops-form-grid"><label class="span">Mật khẩu hiện tại<input name="current" type="password" required /></label><label class="span">Mật khẩu mới<input name="next" type="password" required /></label><div class="ops-form-actions"><button class="primary">Đổi mật khẩu</button></div></form></article>
      ${roleOperate() ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Xác nhận thao tác</h3></div></div><label class="account-setting-row"><input id="skip-delay-setting" type="checkbox" ${skipDelayEnabled ? "checked" : ""}/><span><strong>Chờ 5 giây trước khi xác nhận bỏ qua</strong><small>Giúp hạn chế bấm nhầm thao tác bỏ qua SKU.</small></span></label></article>` : ""}
      ${"Notification" in window ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Thông báo nền</h3></div></div><div class="account-setting-row"><span><strong>Thông báo khi Web đang ẩn</strong><small>Trạng thái hiện tại: ${Notification.permission === "granted" ? "Đã cho phép" : Notification.permission === "denied" ? "Đã chặn trong trình duyệt" : "Chưa cấp quyền"}</small></span>${Notification.permission === "default" ? '<button class="secondary" id="request-browser-notifications">Cho phép</button>' : ""}</div></article>` : ""}
    </div>
  </section>`;
}

async function run(fn: () => Promise<void>, renderMode: "section" | "full" | "none" = "section"): Promise<void> {
  if (busy) return;
  const started = performance.now();
  busy = true;
  notice = null;
  let failed = false;
  try {
    await fn();
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : "Thao tác thất bại.";
    runtimeLogEvent(`Lỗi tại ${activeSection}: ${message}`, "ERROR");
    void sendWebRuntimeLog("web_operation_error", "ERROR", {
      section: activeSection,
      message,
      stack: error instanceof Error ? error.stack : null,
    });
    setNotice("error", message);
  } finally {
    busy = false;
    if (renderMode === "full") render();
    else if (renderMode === "section") {
      patchActiveSection(true);
      syncNavigationSelection();
    }
    runtimeLogMetric("ACTION", "run_complete", {
      section: activeSection,
      render_mode: renderMode,
      failed,
    }, performance.now() - started, failed ? "ERROR" : "INFO");
  }
}

async function loadCompleteReporterQueue(): Promise<Awaited<ReturnType<typeof getReporterQueue>>> {
  const pageSize = 200;
  const first = await getReporterQueue(pageSize, 0);
  const all = [...first.items];
  const seen = new Set(all.map((row) => row.batch_id));
  let offset = first.items.length;
  const total = Math.max(Number(first.total || 0), all.length);
  while (offset < total) {
    const page = await getReporterQueue(pageSize, offset);
    if (!page.items.length) break;
    for (const row of page.items) {
      if (seen.has(row.batch_id)) continue;
      seen.add(row.batch_id);
      all.push(row);
    }
    offset += page.items.length;
  }
  return { ...first, items: all, count: all.length, total: Math.max(total, all.length), limit: all.length, offset: 0 };
}

async function loadOperationsSnapshot(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [queue, recent] = await Promise.all([loadCompleteReporterQueue(), getReporterRecent(200)]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  const serverNow = queue.server_now ? Date.parse(queue.server_now) : NaN;
  queueServerOffsetMs = Number.isFinite(serverNow) ? serverNow - Date.now() : 0;
  queueRows = queue.items;
  recentRows = recent.items;
  if (selectedBatchId && !queueRows.some((row) => row.batch_id === selectedBatchId)) selectedBatchId = null;
  const selected = queueRows.find((row) => row.batch_id === selectedBatchId) || filteredQueueRows()[0] || queueRows[0];
  if (selected) {
    selectedBatchId = selected.batch_id;
    prefetchBatchDetails(selected.batch_id);
  }
  markWebUpdateReceived();
}

async function loadOperations(): Promise<void> {
  if (operationsLoadPromise) {
    operationsLoadQueued = true;
    return operationsLoadPromise;
  }
  const perform = async () => {
    do {
      operationsLoadQueued = false;
      await loadOperationsSnapshot();
    } while (operationsLoadQueued);
  };
  operationsLoadPromise = perform();
  try {
    await operationsLoadPromise;
  } finally {
    operationsLoadPromise = null;
  }
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
  const [nextDashboard, nextInsights, nextPresence] = await Promise.all([
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
    getRealtimePresence(),
  ]);
  if (generation !== dashboardLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  dashboardData = nextDashboard;
  operationalInsights = nextInsights;
  realtimePresence = nextPresence;
  markWebUpdateReceived();
}

async function loadReports(): Promise<void> {
  const generation = ++reportLoadGeneration;
  const sessionGeneration = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const range = apiRange(reportFrom, reportTo);
  const [result, summary, insights] = await Promise.all([
    getAdminReporting({
      from: range.from,
      to: range.to,
      status: reportStatus,
      query: reportQuery,
      limit: REPORT_PAGE_SIZE,
      offset: reportOffset,
    }),
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
  ]);
  if (generation !== reportLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  reportRows = result.items;
  reportTotal = result.total;
  reportSummary = summary;
  reportInsights = insights;
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

async function loadLogs(): Promise<void> {
  if (!roleManage()) return;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const result = await getRuntimeLogs(runtimeLogSource, 60);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  runtimeLogs = result.items;
  if (runtimeLogDetail && !runtimeLogs.some((item) => item.id === runtimeLogDetail?.file.id)) runtimeLogDetail = null;
  markWebUpdateReceived();
}

async function exportReportsExcel(): Promise<void> {
  const range = apiRange(reportFrom, reportTo);
  const rows: AdminReportingRow[] = [];
  let offset = 0;
  let total = 0;
  const pageSize = 500;
  const maxRows = 100_000;
  const started = performance.now();

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

  downloadReportWorkbook(rows, {
    from: reportFrom,
    to: reportTo,
    status: reportStatus,
    query: reportQuery,
    generatedAt: new Date(),
  }, statusLabel);
  runtimeLogMetric("EXPORT", "report_excel", {
    rows: rows.length,
    from: reportFrom,
    to: reportTo,
    status: reportStatus || "ALL",
    has_query: Boolean(reportQuery),
  }, performance.now() - started);
  setNotice("success", `Đã xuất ${rows.length.toLocaleString("vi-VN")} dòng ra file Excel.`);
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
  else if (section === "logs" && roleManage()) { await loadLogs(); received = true; }
  if (received) markWebUpdateReceived();
}

function bindShell(): void {
  const currentProfile = profile;
  if (!currentProfile) return;
  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.section as Section;
    if (!next || next === activeSection || !canAccessSection(next, currentProfile)) return;
    navigateToSection(next, "push");
  }));
  document.querySelector<HTMLSelectElement>("#theme-mode")?.addEventListener("change", (event) => {
    const next = String((event.currentTarget as HTMLSelectElement).value || "AUTO").toUpperCase();
    themeMode = next === "LIGHT" || next === "DARK" ? next : "AUTO";
    localStorage.setItem(THEME_KEY, themeMode);
    applyTheme();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-ui-zoom]").forEach((button) => button.addEventListener("click", () => {
    const step = Number(button.dataset.uiZoom || 0);
    uiZoom = step === 0 ? 100 : Math.max(70, Math.min(140, uiZoom + step));
    localStorage.setItem(UI_ZOOM_KEY, String(uiZoom));
    applyUiZoom();
  }));
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
      skipDelayEnabled = loadSkipDelayEnabled(profile.user_id);
      activeSection = defaultSectionForProfile(profile);
      syncSectionHistory(activeSection, "replace");
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
    }, "full");
  });
  document.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", () => {
    pickerSearchGeneration += 1;
    dashboardLoadGeneration += 1;
    reportLoadGeneration += 1;
    sessionViewGeneration += 1;
    runtimeLogEvent("Đăng xuất");
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

async function commitReporterResolution(batch: ReporterBatch, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<void> {
  if (pendingReporterResolutions.has(batch.batch_id)) return;
  const uiStarted = performance.now();
  pendingReporterResolutions.set(batch.batch_id, resolution);
  stockConfirm = null;
  skipConfirm = null;
  patchOverlays();
  if (activeSection === "operations" && selectedBatchId === batch.batch_id) refreshFastDetailOnly();
  runtimeLogMetric("ACTION", "reporter_resolution_immediate_feedback", {
    batch_id: batch.batch_id,
    resolution,
  }, performance.now() - uiStarted);

  try {
    await resolveReporterBatch(batch.batch_id, resolution);
    pendingReporterResolutions.delete(batch.batch_id);
    queueRows = queueRows.filter((row) => row.batch_id !== batch.batch_id);
    batchDetails.delete(batch.batch_id);
    expandedBatchDetails.delete(batch.batch_id);
    if (selectedBatchId === batch.batch_id) selectedBatchId = filteredQueueRows()[0]?.batch_id || queueRows[0]?.batch_id || null;
    if (activeSection === "operations") {
      patchActiveSection(true);
      if (selectedBatchId) prefetchBatchDetails(selectedBatchId);
    }
    setNotice("success", resolution === "HAS_STOCK"
      ? `${batch.sku} đã xác nhận Có hàng.`
      : `${batch.sku} đã được cho phép bỏ qua.`);
  } catch (error) {
    pendingReporterResolutions.delete(batch.batch_id);
    if (activeSection === "operations" && selectedBatchId === batch.batch_id) refreshFastDetailOnly();
    const message = error instanceof Error ? error.message : "Thao tác thất bại.";
    runtimeLogEvent(`Lỗi xử lý ${batch.sku}: ${message}`, "ERROR");
    void sendWebRuntimeLog("web_operation_error", "ERROR", {
      section: activeSection,
      action: "reporter_resolution",
      message,
    });
    setNotice("error", message);
  }
}

function bindOverlay(): void {
  document.querySelector<HTMLButtonElement>("#cancel-stock")?.addEventListener("click", () => {
    stockConfirm = null;
    patchOverlays();
  });
  document.querySelector<HTMLButtonElement>("#confirm-stock")?.addEventListener("click", () => {
    if (!stockConfirm) return;
    const batch = stockConfirm;
    void commitReporterResolution(batch, "HAS_STOCK");
  });
  document.querySelector<HTMLButtonElement>("#cancel-skip")?.addEventListener("click", () => {
    skipConfirm = null;
    patchOverlays();
  });
  document.querySelector<HTMLButtonElement>("#confirm-skip")?.addEventListener("click", () => {
    if (!skipConfirm) return;
    if (skipDelayEnabled && Date.now() < skipConfirmOpenedAt + SKIP_CONFIRM_DELAY_MS) return;
    const batch = skipConfirm;
    void commitReporterResolution(batch, "SKIP_ALLOWED");
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

function bindReporterActionButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLButtonElement>("[data-resolve]").forEach((button) => button.addEventListener("click", () => {
    const batchId = button.dataset.batch || "";
    stockConfirm = queueRows.find((item) => item.batch_id === batchId) || null;
    patchOverlays();
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-skip-batch]").forEach((button) => button.addEventListener("click", () => {
    skipConfirm = queueRows.find((item) => item.batch_id === button.dataset.skipBatch) || null;
    skipConfirmOpenedAt = Date.now();
    patchOverlays();
    if (skipConfirm && skipDelayEnabled) {
      const batchId = skipConfirm.batch_id;
      for (const delay of [1_000, 2_000, 3_000, 4_000, SKIP_CONFIRM_DELAY_MS + 50]) {
        window.setTimeout(() => {
          if (skipConfirm?.batch_id === batchId) patchOverlays();
        }, delay);
      }
    }
  }));
  root.querySelectorAll<HTMLButtonElement>("[data-detail]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.detail || "";
    if (!id) return;
    if (expandedBatchDetails.has(id)) expandedBatchDetails.delete(id);
    else expandedBatchDetails.add(id);
    if (activeSection === "operations" && selectedBatchId === id) refreshFastDetailOnly();
    else patchActiveSection(true);
    if (expandedBatchDetails.has(id)) prefetchBatchDetails(id);
  }));
}

function bindSection(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-workspace-section]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.workspaceSection as Section;
    if (!profile || !next || next === activeSection || !canAccessSection(next, profile)) return;
    navigateToSection(next, "push");
  }));

  document.querySelectorAll<HTMLButtonElement>("[data-queue-filter]").forEach((button) => button.addEventListener("click", () => {
    const next = String(button.dataset.queueFilter || "ALL") as typeof queueFilter;
    if (!["ALL", "WARNING", "ESCALATED"].includes(next)) return;
    queueFilter = next;
    const visible = filteredQueueRows();
    if (!visible.some((row) => row.batch_id === selectedBatchId)) selectedBatchId = visible[0]?.batch_id || null;
    patchActiveSection(false);
    if (selectedBatchId) prefetchBatchDetails(selectedBatchId);
  }));

  document.querySelectorAll<HTMLButtonElement>("[data-log-source]").forEach((button) => button.addEventListener("click", () => {
    const next = String(button.dataset.logSource || "WEB").toUpperCase() === "ANDROID" ? "ANDROID" : "WEB";
    if (next === runtimeLogSource) return;
    runtimeLogSource = next;
    runtimeLogDetail = null;
    void run(loadLogs);
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-log-file]").forEach((button) => button.addEventListener("click", () => {
    const fileId = button.dataset.logFile || "";
    if (!fileId) return;
    void run(async () => {
      runtimeLogDetail = await getRuntimeLogDetail(fileId);
      markWebUpdateReceived();
    });
  }));
  document.querySelector<HTMLButtonElement>("#copy-agent-link")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(AGENT_DOWNLOAD_URL);
      setNotice("success", "Đã sao chép link tải Agent.");
    } catch {
      setNotice("warning", "Không sao chép tự động được. Hãy dùng nút Tải Agent.");
    }
  });

  document.querySelector<HTMLButtonElement>("#send-web-log")?.addEventListener("click", () => void run(async () => {
    const sent = await sendWebRuntimeLog("manual_web_log", "INFO");
    if (!sent) throw new Error("Chưa gửi được log Web. Kiểm tra kết nối rồi thử lại.");
    runtimeLogSource = "WEB";
    runtimeLogDetail = null;
    await loadLogs();
    setNotice("success", "Đã gửi log Web.");
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-select-batch]").forEach((button) => button.addEventListener("click", () => {
    const started = performance.now();
    const nextBatchId = button.dataset.selectBatch || null;
    if (!nextBatchId || nextBatchId === selectedBatchId) return;
    selectedBatchId = nextBatchId;
    document.querySelectorAll<HTMLElement>("[data-select-batch].selected").forEach((row) => row.classList.remove("selected"));
    button.classList.add("selected");
    refreshFastDetailOnly();
    prefetchBatchDetails(nextBatchId);
    runtimeLogEvent(`Chọn SKU hiển thị sau ${Math.max(0, Math.round(performance.now() - started))}ms`);
  }));

  bindReporterActionButtons();
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

  document.querySelector<HTMLInputElement>("#skip-delay-setting")?.addEventListener("change", (event) => {
    skipDelayEnabled = (event.currentTarget as HTMLInputElement).checked;
    localStorage.setItem(skipDelayStorageKey(), skipDelayEnabled ? "1" : "0");
  });
  document.querySelector<HTMLButtonElement>("#request-browser-notifications")?.addEventListener("click", () => {
    void Notification.requestPermission().then(() => patchActiveSection(true));
  });

  document.querySelector<HTMLFormElement>("#sla-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      const warning = Number(data.get("warning"));
      const escalation = Number(data.get("escalation"));
      const autoSkip = Number(data.get("autoSkip"));
      const autoSkipEnabled = data.get("autoSkipEnabled") === "on";
      const autoSkipMode = String(data.get("autoSkipMode") || "FIRST_REPORT") as "FIRST_REPORT" | "PER_PICKER";
      if (
        !Number.isInteger(warning) ||
        !Number.isInteger(escalation) ||
        !Number.isInteger(autoSkip) ||
        warning < 1 ||
        warning > 1440 ||
        escalation <= warning ||
        escalation > 2880 ||
        autoSkip <= escalation ||
        autoSkip > 10080
      ) throw new Error("Ba mốc phải là số phút nguyên và luôn theo thứ tự Cảnh báo < Quá hạn < Tự động cho phép bỏ qua.");
      await saveAdminSla({
        warning_minutes: warning,
        escalation_minutes: escalation,
        auto_skip_minutes: autoSkip,
        auto_skip_enabled: autoSkipEnabled,
        auto_skip_mode: autoSkipMode,
      });
      await loadSla();
      setNotice("success", "Đã lưu thời gian nghiệp vụ.");
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
    navigateToSection("reports", "push");
  }));
  document.querySelector<HTMLButtonElement>("#report-prev")?.addEventListener("click", () => {
    reportOffset = Math.max(0, reportOffset - REPORT_PAGE_SIZE);
    void run(loadReports);
  });
  document.querySelector<HTMLButtonElement>("#report-next")?.addEventListener("click", () => {
    reportOffset += REPORT_PAGE_SIZE;
    void run(loadReports);
  });
  document.querySelector<HTMLButtonElement>("#export-reports")?.addEventListener("click", () => void run(exportReportsExcel, "none"));

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
  if (databaseConflicts.length && !window.confirm(`Có ${databaseConflicts.length} SKU đổi tên so với danh mục hiện tại. Xác nhận cập nhật tên?\n\n${databaseConflicts.slice(0, 15).join("\n")}`)) {
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
  if (events.length > 0) {
    markWebUpdateReceived();
    announceDeadlineEvents(events);
  }
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
  // D089: service reachability and realtime transport are independent.
  // A websocket outage must not label the HTTP/API service as down.
  patchHeaderRuntime();
  const node = document.querySelector<HTMLElement>("#connection-state");
  if (node) {
    node.className = `connection ${realtimeState}`;
    const recovering = detail.dirty ? " · đang khôi phục" : "";
    node.textContent = realtimeState === "connected"
      ? `Đồng bộ: Đã kết nối${recovering}`
      : realtimeState === "offline"
        ? "Đồng bộ: Mất realtime"
        : `Đồng bộ: Đang kết nối${recovering}`;
  }
});
window.addEventListener("online", () => {
  realtimeState = "connecting";
  patchHeaderRuntime();
  if (profile) patchActiveSection(true);
});
window.addEventListener("offline", () => {
  realtimeState = "offline";
  serviceReachable = false;
  patchHeaderRuntime();
  if (profile) patchActiveSection(true);
});
window.addEventListener("popstate", handleSectionHistoryNavigation);
window.addEventListener("hashchange", handleSectionHistoryNavigation);

async function bootstrap(): Promise<void> {
  if (!hasSession()) { renderLogin(); return; }
  try {
    profile = await getMyProfile();
    markWebUpdateReceived();
    sessionViewGeneration += 1;
    activeSection = resolveInitialSection(profile);
    syncSectionHistory(activeSection, "replace");
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

applyUiZoom();

initWebRuntimeLogging(() => ({
  section: activeSection,
  role: profile?.role || null,
  base_role: profile?.base_role || null,
  user_id: profile?.user_id || null,
  theme_mode: themeMode,
  resolved_theme: document.body.dataset.theme || null,
  ui_zoom_percent: uiZoom,
  busy,
  realtime: { state: realtimeState, applied_seq: realtimeLastSeq },
  service_reachable: serviceReachable,
  queue: {
    total: queueRows.length,
    filter: queueFilter,
    visible: filteredQueueRows().length,
    selected_batch: selectedBatchId,
    expanded_picker_details: expandedBatchDetails.size,
    cached_picker_detail_batches: batchDetails.size,
  },
  recent_results: {
    total: recentRows.length,
    filter: recentFilter,
  },
  picker: {
    query_length: pickerQuery.length,
    suggestion_count: pickerSuggestions.length,
    selected_sku: pickerSelected?.sku || null,
    today_report_count: pickerReports.filter((row) => todayKey(row.reported_at) === dateDaysAgo(0)).length,
    pending_result_count: pickerResults.filter((row) => !row.acknowledged_at).length,
  },
  users: {
    loaded: managedUsers.length,
    selected: selectedUserIds.size,
    total: userTotal,
  },
  reporting: {
    rows_loaded: reportRows.length,
    total: reportTotal,
    offset: reportOffset,
    status: reportStatus || "ALL",
    has_query: Boolean(reportQuery),
  },
  runtime_logs: {
    source: runtimeLogSource,
    loaded: runtimeLogs.length,
    detail_open: Boolean(runtimeLogDetail),
  },
  current_notice: notice,
}));

window.setInterval(updateQueueClockDom, 15_000);
window.setInterval(() => {
  if (themeMode === "AUTO") applyTheme();
}, 60_000);
window.setInterval(() => {
  if (!profile || !roleManage() || activeSection !== "dashboard") return;
  void getRealtimePresence().then((next) => {
    realtimePresence = next;
    patchActiveSection(true);
  }).catch((error) => runtimeLogEvent(`Không cập nhật được số người online: ${error instanceof Error ? error.message : "unknown"}`, "ERROR"));
}, 30_000);

void bootstrap();
