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
import "./legacy-transplant/web-professional-v2.css";
import { firebaseReady } from "./firebase";
import QRCode from "qrcode";
import {
  applyHrPickerSync,
  confirmHrEventSync,
  recheckHrEventSync,
  changeMyPassword,
  clearSession,
  createManagedUser,
  deleteManagedUsers,
  getAdminDashboard,
  getAdminOperationalInsights,
  getAdminReporting,
  getAdminReportingDetail,
  getAdminAuditHistory,
  getAgentAppRelease,
  getAndroidAlertWindow,
  getD167MealState,
  confirmD167Meal,
  getAdminSla,
  getDashboardPreference,
  getPdaAppRelease,
  getRealtimePresence,
  getRuntimeLogDetail,
  getRuntimeLogs,
  getLauncherLogDiagnostics,
  getSystemResetPreview,
  requestSystemResetChallenge,
  executeSystemReset,
  getHrSource,
  getHrEventSyncState,
  getMyProfile,
  getSkuCatalogInfo,
  getReporterBatchTickets,
  getReporterCounters,
  getReporterQueue,
  getReporterOverdue,
  getReporterRecent,
  getStoredProfile,
  hasSession,
  importSkuChunk,
  listManagedUsers,
  loginWithPassword,
  logoutInteractiveSession,
  requestPasswordReset,
  confirmPasswordReset,
  updateMyAuthEmail,
  ApiError,
  previewHrPickerSync,
  resolveReporterBatch,
  correctReporterBatch,
  saveAdminSla,
  saveDashboardPreference,
  saveHrSource,
  searchSkus,
  setManagedUserPassword,
  setRootEffectiveRole,
  updateManagedUser,
  updatePickerAccounts,
  type AppProfile,
  type AdminAuditItem,
  type AdminDashboard,
  type AdminReportingRow,
  type AdminReportingDetailRow,
  type AgentAppRelease,
  type AndroidAlertWindowState,
  type D167MealState,
  type AutoSkipMode,
  type BatchPickerTicket,
  type HrSourceResponse,
  type HrSyncPreview,
  type HrEventSyncState,
  type ManagedUser,
  type OperationalInsights,
  type PdaAppRelease,
  type RealtimePresence,
  type RuntimeLogDetail,
  type RuntimeLogItem,
  type LauncherLogDiagnostics,
  type SystemStatusSnapshot,
  type SystemResetPreview,
  type SystemResetScope,
  type ReporterBatch,
  type ReporterOverdueBatch,
  type ReporterRecentBatch,
  type SkuCatalogInfo,
  type SkuItem,
  type SlaResponse,
  type SlaState,
} from "./api";
import { parseSkuExcel, type ParsedSkuWorkbook } from "./sku-excel";
import { downloadReportWorkbook } from "./report-excel";
import { registerRealtimeApplier, type RealtimeEventFrame } from "./realtime-client";
import { getWebRuntimeDiagnosticSnapshot, initWebRuntimeLogging, queueWebSupportLogRequest, runtimeLogEvent, runtimeLogMetric, sendWebRuntimeLog } from "./runtime-logger";
import { WEB_VERSION, WEB_VERSION_LABEL } from "./web-version";
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
const PRODUCT_CREDIT = "Phát triển hệ thống · tamnv2 | Pick Pack 1291";
const SKU_CHUNK_SIZE = 1000;

function privilegedOneTimeLogin(value: string | null | undefined): boolean {
  const raw = String(value || "").trim().toLowerCase();
  const tail = raw.includes(":") ? raw.split(":").pop() || "" : raw;
  return tail === "root" || tail === "admin" || tail === "tamnv2";
}

function privilegedOneTimeProfile(value: AppProfile | null | undefined): boolean {
  return Boolean(value && (privilegedOneTimeLogin(value.employee_code) || privilegedOneTimeLogin(value.user_id)));
}

function privilegedOneTimeManagedUser(value: ManagedUser | null | undefined): boolean {
  return Boolean(value && (privilegedOneTimeLogin(value.employee_code) || privilegedOneTimeLogin(value.user_id)));
}

type Section =
  | "picker"
  | "operations"
  | "overdue"
  | "results"
  | "shift"
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
  | "system-reset"
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
const DASHBOARD_RANGE_KEY_PREFIX = "supra_inventory_dashboard_range_v1";
const REMEMBER_LOGIN_KEY = "supra_inventory_login_username_v1";

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
  "picker", "operations", "overdue", "results", "shift", "sku", "hr", "users", "sla", "dashboard", "reports", "logs", "tools", "system-reset", "account",
];

function defaultSectionForProfile(value: AppProfile): Section {
  if (value.role === "PICKER") return "picker";
  return "operations";
}

function canAccessSection(section: Section, value: AppProfile): boolean {
  if (value.role === "PICKER") return ["picker", "account"].includes(section);
  if (value.role === "REPORTER") return ["operations", "overdue", "results", "shift", "account"].includes(section);
  if (value.role === "PICKPACK_ADMIN") {
    return ["operations", "overdue", "results", "shift", "sku", "hr", "users", "dashboard", "reports", "account"].includes(section);
  }
  if (section === "system-reset") return value.role === "ROOT" && value.base_role === "ROOT";
  return section !== "picker";
}

function legacyRoleLabel(value: AppProfile["role"]): string {
  if (value === "ROOT") return "Quản trị hệ thống";
  if (value === "ADMIN") return "Quản trị Invent";
  if (value === "PICKPACK_ADMIN") return "Quản trị Pick Pack";
  if (value === "REPORTER") return "Người xử lý báo hàng";
  return "Người lấy hàng";
}

function rootRoleOptionLabel(role: AppProfile["role"]): string {
  if (role === "ROOT") return "Quản trị hệ thống";
  if (role === "ADMIN") return "Quản trị Invent";
  if (role === "PICKPACK_ADMIN") return "Quản trị Pick Pack";
  if (role === "REPORTER") return "Người xử lý báo hàng";
  return "Người lấy hàng";
}

function businessRoleLabel(role: string): string {
  if (role === "ROOT") return "Quản trị hệ thống";
  if (role === "ADMIN") return "Quản trị Invent";
  if (role === "PICKPACK_ADMIN") return "Quản trị Pick Pack";
  if (role === "REPORTER") return "Người xử lý báo hàng";
  if (role === "PICKER") return "Người lấy hàng";
  return role || "—";
}

function clearRoleScopedViewState(): void {
  queueRows = [];
  queueBadgeCount = 0;
  queueBadgeInitialized = false;
  recentBadgeCount = 0;
  recentBadgeInitialized = false;
  reporterBadgeLoadGeneration += 1;
  overdueRows = [];
  overdueBadgeCount = 0;
  overdueBadgeInitialized = false;
  perPickerOverdueEnabled = false;
  recentRows = [];
  recentOffset = 0;
  recentTotal = 0;
  recentTotals = { has_stock: 0, skip_allowed: 0, automatic_skipped: 0, withdrawn: 0, ack_target_count: 0, acknowledged_count: 0 };
  batchDetails.clear();
  expandedBatchDetails.clear();
  batchDetailLoads.clear();
  pendingReporterResolutions.clear();
  operationsLoadQueued = false;
  stockConfirm = null;
  skipConfirm = null;
  pickerReports = [];
  pickerReportOffset = 0;
  pickerReportTotal = 0;
  pickerResults = [];
  pickerSuggestions = [];
  pickerSelected = null;
  managedUsers = [];
  selectedUserIds.clear();
  selectedManagedUserIds.clear();
  excludedPickerIds.clear();
  allPickerSelection = false;
  hrPreview = null;
  skuCatalogInfo = null;
  skuAdminQuery = "";
  skuAdminItems = [];
  skuAdminOffset = 0;
  skuAdminTotal = 0;
  dashboardData = null;
  reportRows = [];
  reportBatchDetails.clear();
  expandedReportBatches.clear();
  reportDetailLoads.clear();
  reportTotal = 0;
  slaResponse = null;
  slaFormDirty = false;
  slaLoadGeneration += 1;
  operationalInsights = null;
  realtimePresence = null;
  reportSummary = null;
  reportInsights = null;
  serviceHealth = null;
  systemStatus = null;
  systemResetPreview = null;
  systemResetChallenge = null;
  systemResetSelected.clear();
  runtimeLogs = [];
  runtimeLogDetail = null;
  launcherLogDiagnostics = null;
  runtimeLogPageTokens = [""];
  runtimeLogPageIndex = 0;
  runtimeLogNextPageToken = "";
  auditRows = [];
  auditTotal = 0;
  auditOffset = 0;
  auditRole = "";
  auditQuery = "";
  pdaAppRelease = null;
  agentAppRelease = null;
  androidAlertWindow = null;
  pdaQrDataUrl = "";
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
let queueBadgeCount = 0;
let queueBadgeInitialized = false;
let overdueRows: ReporterOverdueBatch[] = [];
let overdueBadgeCount = 0;
let overdueBadgeInitialized = false;
let perPickerOverdueEnabled = false;
let reporterOverdueLoadGeneration = 0;
let recentBadgeCount = 0;
let recentBadgeInitialized = false;
let reporterBadgeLoadGeneration = 0;
let queueServerOffsetMs = 0;
let recentRows: ReporterRecentBatch[] = [];
let recentOffset = 0;
let recentTotal = 0;
const RECENT_PAGE_SIZE = 50;
let recentTotals = { has_stock: 0, skip_allowed: 0, automatic_skipped: 0, withdrawn: 0, ack_target_count: 0, acknowledged_count: 0 };
let resultTabBadgeCounts = { HAS_STOCK: 0, SKIP_ALLOWED: 0, CLOSED: 0 };
let batchDetails = new Map<string, BatchPickerTicket[]>();
let recentFilter: "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED" | "ALL" = "HAS_STOCK";
let recentFrom = dateDaysAgo(0);
let recentTo = dateDaysAgo(0);
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
let reporterQueueLoadGeneration = 0;
let reporterRecentLoadGeneration = 0;
let slaResponse: SlaResponse | null = null;
let slaFormDirty = false;
let slaDraftMode: AutoSkipMode | null = null;
let slaSaveBusy = false;
let operationalInsights: OperationalInsights | null = null;
let realtimePresence: RealtimePresence | null = null;
let managedUsers: ManagedUser[] = [];
let selectedUserIds = new Set<string>();
let selectedManagedUserIds = new Set<string>();
let excludedPickerIds = new Set<string>();
let hrSource: HrSourceResponse | null = null;
let hrPreview: HrSyncPreview | null = null;
let hrEventSync: HrEventSyncState | null = null;
let pendingWorkbook: ParsedSkuWorkbook | null = null;
let skuCatalogInfo: SkuCatalogInfo | null = null;
let skuAdminQuery = "";
let skuAdminItems: SkuItem[] = [];
let skuAdminOffset = 0;
let skuAdminTotal = 0;
const SKU_PAGE_SIZE = 100;
let skuConflictChoices = new Map<string, string>();
let skuImportProgress = "";
let dashboardData: AdminDashboard | null = null;
let reportRows: AdminReportingRow[] = [];
let reportBatchDetails = new Map<string, AdminReportingDetailRow[]>();
let expandedReportBatches = new Set<string>();
let reportDetailLoads = new Set<string>();
let reportSummary: AdminDashboard | null = null;
let reportInsights: OperationalInsights | null = null;
let reportTotal = 0;
let reportOffset = 0;
const REPORT_PAGE_SIZE = 100;
let dashboardFrom = dateDaysAgo(0);
let dashboardTo = dateDaysAgo(0);
let reportFrom = dateDaysAgo(0);
let reportTo = dateDaysAgo(0);
let reportStatus = "";
let reportQuery = "";
let serviceHealth: Record<string, unknown> | null = null;
let systemStatus: SystemStatusSnapshot | null = null;
let systemResetPreview: SystemResetPreview | null = null;
let systemResetChallenge: { id: string; expiresAt: string; emailHint: string } | null = null;
let systemResetSelected = new Set<SystemResetScope>();
let logView: "WEB" | "ANDROID" | "AUDIT" = "WEB";
let logDays = 30;
let logFrom = dateDaysAgo(6);
let logTo = dateDaysAgo(0);
let runtimeLogSource: "WEB" | "ANDROID" = "WEB";
let runtimeLogs: RuntimeLogItem[] = [];
let runtimeLogDetail: RuntimeLogDetail | null = null;
let launcherLogDiagnostics: LauncherLogDiagnostics | null = null;
const RUNTIME_LOG_PAGE_SIZE = 50;
let runtimeLogPageTokens: string[] = [""];
let runtimeLogPageIndex = 0;
let runtimeLogNextPageToken = "";
let auditRows: AdminAuditItem[] = [];
let auditTotal = 0;
let auditOffset = 0;
let auditRole = "";
let auditQuery = "";
const AUDIT_PAGE_SIZE = 100;
let pdaAppRelease: PdaAppRelease | null = null;
let agentAppRelease: AgentAppRelease | null = null;
let androidAlertWindow: AndroidAlertWindowState | null = null;
let d167MealState: D167MealState | null = null;
let pdaQrDataUrl = "";
const reportNoticeBySku = new Map<string, number>();
let pickerQuery = "";
let pickerSuggestions: SkuItem[] = [];
let pickerSelected: SkuItem | null = null;
let pickerReports: PickerReportV2[] = [];
let pickerReportOffset = 0;
let pickerReportTotal = 0;
const PICKER_REPORT_PAGE_SIZE = 50;
let pickerResults: PickerResultV2[] = [];
let markedResultEvents = new Set<string>();
let displayedResultEvents = new Set<string>();
let pickerSearchGeneration = 0;
let userQuery = "";
let userRole = "";
let userStatus = "";
let userShortageReporting = "";
let userOffset = 0;
let userTotal = 0;
let allPickerSelection = false;
const USER_PAGE_SIZE = 100;
let editUserId: string | null = null;
let passwordUserId: string | null = null;
let selectedBatchId: string | null = null;
let dashboardLoadGeneration = 0;
let reportLoadGeneration = 0;
let slaLoadGeneration = 0;
let sessionViewGeneration = 0;
let dashboardPreferenceLoadedUserId = "";
if (profile?.user_id) restoreDashboardRangeForUser(profile.user_id);

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

function dashboardRangeStorageKey(userId = profile?.user_id || "anonymous"): string {
  return `${DASHBOARD_RANGE_KEY_PREFIX}:${userId}`;
}

function restoreDashboardRangeForUser(userId: string): void {
  const today = dateDaysAgo(0);
  dashboardFrom = today;
  dashboardTo = today;
  if (!userId) return;
  try {
    const raw = localStorage.getItem(dashboardRangeStorageKey(userId));
    if (!raw) return;
    const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
    const from = String(parsed.from || "");
    const to = String(parsed.to || "");
    const range = apiRange(from, to);
    if (Date.parse(range.to) - Date.parse(range.from) > 60 * 86_400_000) return;
    dashboardFrom = from;
    dashboardTo = to;
  } catch {
    dashboardFrom = today;
    dashboardTo = today;
  }
}

async function persistDashboardRangeForUser(): Promise<void> {
  const userId = profile?.user_id || "";
  if (!userId) return;
  const range = apiRange(dashboardFrom, dashboardTo);
  if (Date.parse(range.to) - Date.parse(range.from) > 60 * 86_400_000) return;
  localStorage.setItem(dashboardRangeStorageKey(userId), JSON.stringify({ from: dashboardFrom, to: dashboardTo }));
  await saveDashboardPreference(dashboardFrom, dashboardTo);
  dashboardPreferenceLoadedUserId = userId;
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

function browserBackgroundNotice(title: string, body: string, tag = "supra-inventory-deadline"): void {
  if (document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag });
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

function announceNewReportEvents(events: RealtimeEventFrame[]): void {
  if (!roleOperate()) return;
  const now = Date.now();
  const grouped = new Map<string, number>();
  for (const row of events) {
    if (String(row.event || "").toUpperCase() !== "REPORT_CREATED") continue;
    const snapshot = row.snapshot || {};
    const metadata = row.metadata || {};
    const sku = String(snapshot.sku || metadata.sku || "").trim();
    if (!sku) continue;
    const previous = reportNoticeBySku.get(sku) || 0;
    if (now - previous < 5_000) continue;
    grouped.set(sku, (grouped.get(sku) || 0) + 1);
    reportNoticeBySku.set(sku, now);
  }
  for (const [sku, count] of grouped) {
    const text = count > 1
      ? `SKU ${sku} vừa được ${count} Picker báo hết hàng.`
      : `SKU ${sku} vừa được báo hết hàng.`;
    setNotice("warning", text);
    browserBackgroundNotice("SUPRA Inventory · Báo hết hàng mới", text, `supra-inventory-report-${sku}`);
  }
  if (reportNoticeBySku.size > 200) {
    for (const [sku, at] of reportNoticeBySku) if (now - at > 60_000) reportNoticeBySku.delete(sku);
  }
}

function roleManage(): boolean {
  return Boolean(profile && ["ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(profile.role));
}

function rolePickPackManage(): boolean {
  return Boolean(profile && ["ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(profile.role));
}

function roleOperate(): boolean {
  return Boolean(profile && ["REPORTER", "ADMIN", "PICKPACK_ADMIN", "ROOT"].includes(profile.role));
}

function roleCanResolve(): boolean {
  return Boolean(profile && ["REPORTER", "ADMIN", "ROOT"].includes(profile.role));
}

function onlineForMutation(): boolean {
  return navigator.onLine;
}

function normalizeAutoSkipMode(value: unknown): AutoSkipMode | null {
  const mode = String(value || "").toUpperCase();
  return mode === "FIRST_REPORT" || mode === "PER_PICKER" ? mode : null;
}

function autoSkipModeLabel(mode: AutoSkipMode | null): string {
  return mode === "FIRST_REPORT" ? "Theo báo đầu tiên của SKU"
    : mode === "PER_PICKER" ? "Theo từng Picker"
      : "Chưa xác định";
}

function currentSlaServerMode(): AutoSkipMode | null {
  return normalizeAutoSkipMode(slaResponse?.sla?.auto_skip_mode);
}

function patchSlaDraftIndicator(): void {
  const serverMode = currentSlaServerMode();
  const serverNode = document.querySelector<HTMLElement>("#sla-server-mode-value");
  if (serverNode) serverNode.textContent = autoSkipModeLabel(serverMode);
  const node = document.querySelector<HTMLElement>("#sla-draft-value");
  if (!node) return;
  const draftMode = slaDraftMode || serverMode;
  const pending = Boolean(slaFormDirty && draftMode && draftMode !== serverMode);
  node.dataset.pending = pending ? "true" : "false";
  node.textContent = pending
    ? `Thay đổi chưa lưu: ${autoSkipModeLabel(draftMode)}`
    : "Biểu mẫu đang khớp cấu hình máy chủ.";
}

function syncSlaModeControlsFromState(): void {
  if (activeSection !== "sla") return;
  const serverMode = currentSlaServerMode();
  const desiredMode = slaFormDirty ? (slaDraftMode || serverMode) : serverMode;
  if (!desiredMode) return;
  document.querySelectorAll<HTMLInputElement>('input[name="autoSkipMode"]').forEach((input) => {
    const selected = input.value === desiredMode;
    input.checked = selected;
    input.defaultChecked = selected;
    input.autocomplete = "off";
  });
  patchSlaDraftIndicator();
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

function resolutionSourceLabel(source: string | null | undefined): string {
  if (source === "SYSTEM_TIMEOUT") return "Hệ thống tự động · quá hạn phản hồi";
  if (source === "REPORTER_CORRECTION") return "Nhân sự sửa kết quả";
  if (source === "REPORTER") return "Nhân sự xác nhận";
  return "—";
}

function resolutionActorLabel(row: {
  resolution_source?: string | null;
  resolved_by_display_name?: string | null;
  resolved_by_employee_code?: string | null;
  resolved_by_user_id?: string | null;
}): string {
  if (row.resolution_source === "SYSTEM_TIMEOUT") return "Hệ thống";
  const name = String(row.resolved_by_display_name || "").trim();
  const code = String(row.resolved_by_employee_code || "").trim();
  if (name && code) return `${name} · ${code}`;
  if (name) return name;
  if (code) return code;
  return String(row.resolved_by_user_id || "—");
}

function matchingDatePreset(from: string, to: string): number | null {
  if (to !== dateDaysAgo(0)) return null;
  for (const days of [0, 6, 29, 59]) {
    if (from === dateDaysAgo(days)) return days;
  }
  return null;
}

function renderDatePresets(target: "dashboard" | "reports"): string {
  const from = target === "dashboard" ? dashboardFrom : reportFrom;
  const to = target === "dashboard" ? dashboardTo : reportTo;
  const matched = matchingDatePreset(from, to);
  const button = (days: number, label: string) => {
    const active = matched === days;
    return `<button type="button" class="btn secondary small${active ? " active" : ""}" aria-pressed="${active ? "true" : "false"}" data-date-target="${target}" data-date-days="${days}">${label}</button>`;
  };
  return `<div class="toolbar date-presets compact-date-presets" aria-label="Chọn nhanh khoảng ngày">
    ${button(0, "Hôm nay")}
    ${button(6, "7 ngày")}
    ${button(29, "30 ngày")}
    ${button(59, "60 ngày")}
  </div>`;
}

function renderCompactDateRange(target: "dashboard" | "reports", from: string, to: string): string {
  const custom = matchingDatePreset(from, to) == null;
  return `<div class="compact-date-range${custom ? " custom-range-active" : ""}" role="group" aria-label="Khoảng ngày dữ liệu">
    <label><span>Từ</span><input name="from" type="date" value="${esc(from)}" /></label>
    <span class="compact-date-separator">–</span>
    <label><span>Đến</span><input name="to" type="date" value="${esc(to)}" /></label>
    ${renderDatePresets(target)}
  </div>`;
}

function syncVisibleDateRange(target: "dashboard" | "reports" | "recent", from: string, to: string): void {
  const form = document.querySelector<HTMLFormElement>(
    target === "dashboard" ? "#dashboard-filter" : target === "reports" ? "#report-filter" : "#recent-range-form",
  );
  const fromInput = form?.querySelector<HTMLInputElement>('input[name="from"]');
  const toInput = form?.querySelector<HTMLInputElement>('input[name="to"]');
  if (fromInput) fromInput.value = from;
  if (toInput) toInput.value = to;
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
  // D141: SLA has explicit server/draft state. Generic context restoration used to
  // replay stale radio values after an authoritative GET, producing the impossible
  // visual state "radio FIRST_REPORT / Đang áp dụng PER_PICKER". Never restore SLA
  // form controls from a pre-render snapshot; renderSla + slaDraftMode own them.
  if (snapshot.section !== "sla") {
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
  if (activeSection === "overdue") return renderOverdue();
  if (activeSection === "results") return renderResults();
  if (activeSection === "shift") return renderShiftOperations();
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
  if (activeSection === "system-reset") return renderSystemReset();
  if (activeSection === "versions") return renderLegacyVersions();
  return renderAccount();
}

function mainMarkup(): string {
  return activeContent();
}

function patchOverlays(): void {
  const root = document.querySelector<HTMLElement>("#overlay-root");
  if (!root) return;
  root.innerHTML = `${renderStockModal()}${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}${renderD167MealOverlay()}`;
  bindOverlay();
}

function patchActiveSection(preserveContext = true): void {
  const main = document.querySelector<HTMLElement>(".main");
  if (!main) {
    render();
    return;
  }

  // D139: while the operator is editing the SLA form, no generic section refresh
  // may rebuild .main from the last server snapshot. This covers realtime, delayed
  // initial-load completion, network online/offline events, action-finally patches
  // and any other shared repaint path. Successful/stale-authoritative SLA flows
  // explicitly clear slaFormDirty before they need a server-owned rerender.
  if (activeSection === "sla" && slaFormDirty && preserveContext) {
    patchSlaInsightCounts();
    patchOverlays();
    runtimeLogMetric("RENDER", "sla_dirty_patch_skipped", {
      section: activeSection,
      reason: "operator_edit_in_progress",
    }, 0);
    return;
  }

  const started = performance.now();
  const snapshot = preserveContext ? captureUiContext() : null;
  main.innerHTML = mainMarkup();
  main.dataset.activeSection = activeSection;
  bindSection();
  patchOverlays();
  restoreUiContext(snapshot);
  scheduleCorrectionExpiry();
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
  syncOperationsNavBadge();
}

function navigateToSection(next: Section, historyMode: SectionHistoryMode = "push"): void {
  if (!profile || !canAccessSection(next, profile)) return;
  if (next === activeSection) {
    syncSectionHistory(next, historyMode === "push" ? "none" : historyMode);
    return;
  }
  const started = performance.now();
  if (activeSection === "sla") {
    slaFormDirty = false;
    slaDraftMode = null;
  }
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
    shift: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2M7 3v3M17 3v3"/>',
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
  const noticeCount = section === "operations" && roleOperate() ? queueBadgeCount : null;
  const notice = noticeCount == null || noticeCount <= 0 ? "" : `<b class="nav-notice-badge" data-operations-nav-count>${noticeCount > 99 ? "99+" : noticeCount}</b>`;
  return `<button class="nav-button ${activeSection === section ? "active" : ""}" data-section="${section}"${activeSection === section ? ' aria-current="page"' : ""}>${navIcon(section)}<span>${esc(label)}</span>${notice}</button>`;
}

function syncOperationsNavBadge(): void {
  let node = document.querySelector<HTMLElement>("[data-operations-nav-count]");
  if (queueBadgeCount <= 0) {
    node?.remove();
    return;
  }
  if (!node) {
    const button = document.querySelector<HTMLButtonElement>('.nav-button[data-section="operations"]');
    if (!button) return;
    node = document.createElement("b");
    node.className = "nav-notice-badge";
    node.setAttribute("data-operations-nav-count", "");
    button.appendChild(node);
  }
  node.textContent = queueBadgeCount > 99 ? "99+" : String(queueBadgeCount);
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
    return navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"], ["shift", "Ca vận hành"]]);
  }
  if (profile.role === "PICKPACK_ADMIN") {
    return [
      navGroup("VẬN HÀNH", [["operations", "Theo dõi báo hàng"], ["dashboard", "Tổng quan & báo cáo"], ["shift", "Ca vận hành"]]),
      navGroup("QUẢN LÝ", [["sku", "Danh mục SKU"], ["users", "Nhân sự & tài khoản"]]),
    ].join("");
  }
  return [
    navGroup("VẬN HÀNH", [["operations", "Xử lý báo hàng"], ["dashboard", "Tổng quan & báo cáo"], ["shift", "Ca vận hành"]]),
    navGroup("QUẢN LÝ", [["sku", "Danh mục SKU"], ["users", "Nhân sự & tài khoản"], ["sla", "Thời gian xử lý"]]),
    navGroup("HỆ THỐNG", profile.role === "ROOT" && profile.base_role === "ROOT"
      ? [["logs", "Nhật ký"], ["tools", "Công cụ"], ["system-reset", "Đặt lại hệ thống"]]
      : [["logs", "Nhật ký"], ["tools", "Công cụ"]]),
  ].join("");
}

function renderLogin(): void {
  document.body.dataset.role = "";
  document.body.dataset.testRole = "";
  const recoveryToken = new URL(window.location.href).searchParams.get("password-reset") || "";
  if (/^[a-f0-9]{128}$/i.test(recoveryToken)) {
    app.innerHTML = `<main class="login-shell"><section class="login-card">
      <div class="login-brand-lockup"><img class="login-app-icon" src="/app-icon.png" alt="" /><div class="login-brand-copy"><p class="login-company">CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN</p><h1>Website nghiệp vụ Inventory | ${WEB_VERSION_LABEL}</h1></div></div><h2 class="login-view-title">Đặt lại mật khẩu</h2>
      <p class="muted">Nhập mật khẩu mới cho tài khoản đã yêu cầu khôi phục.</p>
      <form id="confirm-password-reset-form">
        <label>Mật khẩu mới<input name="next" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /></label>
        <label>Nhập lại mật khẩu<input name="confirm" type="password" required minlength="8" maxlength="128" autocomplete="new-password" /></label>
        <button class="primary wide">ĐẶT LẠI MẬT KHẨU</button>
        <div id="confirm-password-reset-result" class="tiny muted"></div>
      </form>
      <div class="oauth-public-links"><a href="/about">Giới thiệu</a><a href="/privacy">Quyền riêng tư</a><a href="/terms">Điều khoản</a></div>
      <p class="security">${PRODUCT_CREDIT}</p>
    </section></main>`;
    document.querySelector<HTMLFormElement>("#confirm-password-reset-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget as HTMLFormElement);
      const next = String(data.get("next") || "");
      const confirm = String(data.get("confirm") || "");
      const result = document.querySelector<HTMLElement>("#confirm-password-reset-result");
      if (next !== confirm) {
        if (result) result.textContent = "Hai lần nhập mật khẩu chưa khớp.";
        return;
      }
      void run(async () => {
        const message = await confirmPasswordReset(recoveryToken, next);
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
        renderLogin();
        setNotice("success", message);
      }, "none");
    });
    return;
  }
  const rememberedUsername = localStorage.getItem(REMEMBER_LOGIN_KEY) || "";
  app.innerHTML = `<main class="login-shell"><div class="login-stage">
    <div class="login-brand-lockup login-brand-reference"><img class="login-app-icon" src="/app-icon.png" alt="" /><div class="login-brand-copy"><p class="login-company">CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN</p><h1>Website nghiệp vụ Inventory | ${WEB_VERSION_LABEL}</h1></div></div>
    <section class="login-card">
      <div class="login-card-heading"><span></span><div><h2>Đăng nhập tài khoản</h2><p>Nhập thông tin để truy cập hệ thống</p></div></div>
      ${!firebaseReady ? `<div class="message" data-type="error">Hệ thống đăng nhập chưa sẵn sàng. Vui lòng thử lại sau.</div>` : ""}
      <form id="login-form">
        <label>Tài khoản<input name="username" required autocomplete="username" placeholder="Nhập tài khoản" value="${esc(rememberedUsername)}" /></label>
        <label>Mật khẩu<div class="password-input-wrap"><input id="login-password" name="password" type="password" required autocomplete="current-password" placeholder="Nhập mật khẩu" /><button id="toggle-login-password" class="password-eye" type="button" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div></label>
        <div class="login-options"><label class="remember-login"><input name="rememberLogin" type="checkbox" ${rememberedUsername ? "checked" : ""}/><span>Lưu tên đăng nhập</span></label><button id="forgot-password" type="button" class="login-link">Lấy lại mật khẩu</button></div>
        <button class="primary wide" ${busy ? "disabled" : ""}>${busy ? "Đang đăng nhập..." : "ĐĂNG NHẬP"}</button>
      </form>
      <form id="reset-password-form" class="login-reset-form" hidden>
        <p class="muted">Nhập thông tin tài khoản và email đã đăng ký.</p>
        <label>Tài khoản<input name="username" required autocomplete="username" placeholder="Mã nhân viên / tài khoản" /></label>
        <label>Email đăng ký<input name="email" type="email" required autocomplete="email" placeholder="name@company.com" /></label>
        <button class="secondary wide">GỬI LINK ĐẶT LẠI MẬT KHẨU</button>
        <div id="reset-password-result" class="tiny muted"></div>
      </form>
      <div class="oauth-public-links"><a href="/about">Giới thiệu</a><a href="/privacy">Quyền riêng tư</a><a href="/terms">Điều khoản</a></div>
      <p class="security">${PRODUCT_CREDIT}</p>
    </section>
  </div></main>`;

  document.querySelector<HTMLFormElement>("#login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    const rememberLogin = data.get("rememberLogin") === "on";
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
      if (rememberLogin) {
        localStorage.setItem(REMEMBER_LOGIN_KEY, username);
        try {
          const PasswordCredentialCtor = (window as unknown as { PasswordCredential?: new (data: { id: string; password: string; name?: string }) => Credential }).PasswordCredential;
          if (!privilegedOneTimeLogin(username) && PasswordCredentialCtor && navigator.credentials?.store) {
            await navigator.credentials.store(new PasswordCredentialCtor({ id: username, password, name: username }));
          }
        } catch {
          // Browser-managed credential storage is best-effort. The app never writes the password to localStorage.
        }
      } else {
        localStorage.removeItem(REMEMBER_LOGIN_KEY);
      }
      markWebUpdateReceived();
      skipDelayEnabled = loadSkipDelayEnabled(profile.user_id);
      restoreDashboardRangeForUser(profile.user_id);
      dashboardPreferenceLoadedUserId = "";
      runtimeLogEvent(`Đăng nhập: ${profile.role}`);
      sessionViewGeneration += 1;
      activeSection = resolveInitialSection(profile);
      syncSectionHistory(activeSection, "replace");
      window.dispatchEvent(new CustomEvent("supra:session-changed"));
      await loadSection(activeSection);
      render();
    });
  });

  document.querySelector<HTMLButtonElement>("#toggle-login-password")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const input = document.querySelector<HTMLInputElement>("#login-password");
    if (!input) return;
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.textContent = visible ? "Hiện" : "Ẩn";
    button.setAttribute("aria-label", visible ? "Hiện mật khẩu" : "Ẩn mật khẩu");
    button.setAttribute("aria-pressed", String(!visible));
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
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
        <h1>Website nghiệp vụ Inventory | ${WEB_VERSION_LABEL}</h1>
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
          ${profile.base_role === "ROOT" ? `<label class="header-control root-role-control"><span>Kiểm tra quyền</span><select id="root-role-select">${(["ROOT","ADMIN","PICKPACK_ADMIN","REPORTER","PICKER"] as AppProfile["role"][]).map((role) => `<option value="${role}" ${profile?.role === role ? "selected" : ""}>${esc(rootRoleOptionLabel(role))}</option>`).join("")}</select></label>` : ""}
          <label class="header-control theme-control"><span>Giao diện</span><select id="theme-mode"><option value="AUTO" ${themeMode === "AUTO" ? "selected" : ""}>Tự động</option><option value="LIGHT" ${themeMode === "LIGHT" ? "selected" : ""}>Sáng</option><option value="DARK" ${themeMode === "DARK" ? "selected" : ""}>Tối</option></select></label>
          <div class="header-control zoom-control"><span>Cỡ chữ</span><div class="zoom-buttons"><button type="button" class="ghost" data-ui-zoom="-10" aria-label="Giảm cỡ chữ">A−</button><button type="button" class="ghost zoom-value" data-ui-zoom="0" id="ui-zoom-value" aria-label="Đặt cỡ chữ về 100%">${uiZoom}%</button><button type="button" class="ghost" data-ui-zoom="10" aria-label="Tăng cỡ chữ">A+</button></div></div>
          <div class="user-actions"><button type="button" class="ghost header-account-action ${activeSection === "account" ? "active" : ""}" data-section="account">Tài khoản</button><button id="logout" class="ghost">Đăng xuất</button></div>
        </div>
      </div>
    </header>
    <nav class="tabs" data-shell-generation="legacy-direct-transplant">${renderNav()}</nav>
    <main id="content" class="content main" data-active-section="${esc(activeSection)}">${content}</main>
    <footer id="appCopyright" class="app-footer"><span>${PRODUCT_CREDIT}</span></footer>
    <div id="overlay-root">${renderStockModal()}${renderSkipModal()}${renderCriticalResult()}${renderUserModals()}${renderD167MealOverlay()}</div>
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
  const isPending = result.resolution === "PENDING";
  const from = result.correction_from_status === "SKIP_ALLOWED" ? "Skip" : result.correction_from_status === "HAS_STOCK" ? "Đã có hàng" : "";
  const to = isPending ? "Đang xử lý" : isSkip ? "Skip" : "Đã có hàng";
  const actor = result.resolved_by_display_name || result.resolved_by_employee_code || "Nhân sự Inventory";
  const reason = from && result.resolution_source === "REPORTER_CORRECTION"
    ? `Báo hàng ${result.sku} chuyển trạng thái SKU từ ${from} sang ${to}. Lý do: ${actor} sửa kết quả.`
    : isPending ? "Người xử lý đã chuyển SKU về trạng thái đang xử lý."
    : isSkip ? "Người xử lý đã xác nhận SKU này được phép bỏ qua." : "Người xử lý đã xác nhận SKU này đã có hàng.";
  return `<div class="critical-result"><div class="critical-box ${isSkip ? "skip-result" : ""}">
    <h2>${isPending ? "ĐANG XỬ LÝ LẠI" : isSkip ? "ĐƯỢC PHÉP BỎ QUA" : "ĐÃ CÓ HÀNG"}</h2>
    <div class="critical-sku">${esc(result.sku)}</div><div class="product-name">${esc(result.product_name)}</div>
    <p>${esc(reason)}</p>
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
        ${profile?.role === "ROOT" && editUser.role !== "PICKER" ? `<div class="field" style="margin-top:10px"><span>Quyền tài khoản · chỉ ROOT được thay đổi</span><select name="role"><option value="REPORTER" ${editUser.role === "REPORTER" ? "selected" : ""}>Người xử lý báo hàng</option><option value="PICKPACK_ADMIN" ${editUser.role === "PICKPACK_ADMIN" ? "selected" : ""}>Quản trị Pick Pack</option><option value="ADMIN" ${editUser.role === "ADMIN" ? "selected" : ""}>Quản trị Invent</option></select></div>` : ""}
        <div class="field" style="margin-top:10px"><span>Email đăng ký${editUser.role === "ADMIN" || editUser.role === "PICKPACK_ADMIN" ? " · bắt buộc với tài khoản quản trị" : ""}</span><input name="authEmail" type="email" value="${esc(editUser.auth_email || "")}" /></div>
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
  scheduleCorrectionExpiry();
  runtimeLogMetric("RENDER", "full_shell", {
    section: activeSection,
    dom_nodes: app.querySelectorAll("*").length,
    queue_rows: queueRows.length,
  }, performance.now() - started);
}

function renderOperationalTabs(current: "operations" | "overdue" | "results"): string {
  // D166: exactly five visible status tabs. All badges use ONE existing
  // counter snapshot and ONE versioned realtime delta stream, not five polls.
  const outcomeTab = (status: "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED", label: string) =>
    `<button type="button" class="workspace-tab ${current === "results" && recentFilter === status ? "active" : ""}" data-workspace-result-filter="${status}">${label} <b data-workspace-count="${status}">${resultTabBadgeCounts[status]}</b></button>`;
  return `<div class="workspace-tabs" role="tablist" aria-label="Vận hành báo hàng">
    <button type="button" class="workspace-tab ${current === "operations" ? "active" : ""}" data-workspace-section="operations">Đang xử lý <b data-workspace-count="operations">${queueBadgeCount}</b></button>
    <button type="button" class="workspace-tab ${current === "overdue" ? "active" : ""}" data-workspace-section="overdue">Quá hạn <b data-workspace-count="overdue">${overdueBadgeCount}</b></button>
    ${outcomeTab("HAS_STOCK", "Đã có hàng")}
    ${outcomeTab("SKIP_ALLOWED", "Cho phép Skip")}
    ${outcomeTab("CLOSED", "Picker đã thu hồi")}
  </div>`;
}

function syncOperationalTabBadges(): void {
  const operations = document.querySelector<HTMLElement>('[data-workspace-count="operations"]');
  const overdue = document.querySelector<HTMLElement>('[data-workspace-count="overdue"]');
  if (operations) operations.textContent = String(queueBadgeCount);
  if (overdue) overdue.textContent = String(overdueBadgeCount);
  for (const status of ["HAS_STOCK", "SKIP_ALLOWED", "CLOSED"] as const) {
    const badge = document.querySelector<HTMLElement>(`[data-workspace-count="${status}"]`);
    if (badge) badge.textContent = String(resultTabBadgeCounts[status]);
  }
}

function filteredQueueRows(): ReporterBatch[] {
  if (queueFilter === "ALL") return queueRows;
  return queueRows.filter((row) => liveQueueTiming(row).state === queueFilter);
}

function pickerDetailMarkup(batchId: string, details: BatchPickerTicket[] | undefined, forceVisible = false): string {
  if (!forceVisible && !expandedBatchDetails.has(batchId)) return "";
  if (!details) return `<div class="detail picker-detail-panel"><div class="picker-detail-title"><strong>Picker ảnh hưởng</strong></div><div class="picker-detail-loading">Đang tải danh sách Picker...</div></div>`;
  return `<div class="detail picker-detail-panel"><div class="picker-detail-title"><strong>Picker ảnh hưởng</strong><span>${details.length.toLocaleString("vi-VN")} người</span></div><div class="picker-detail-list">${details.map((item) => `
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
    ${roleCanResolve() ? `<div class="fast-actions"><button class="primary" data-resolve="HAS_STOCK" data-batch="${esc(selected.batch_id)}" ${pendingResolution ? "disabled" : ""}>ĐÃ CÓ HÀNG</button><button class="danger" data-skip-batch="${esc(selected.batch_id)}" ${pendingResolution ? "disabled" : ""}>CHO PHÉP BỎ QUA</button></div>` : `<div class="fast-action-pending" role="status">Chế độ chỉ xem · Quản trị Pick Pack không xử lý kết quả Báo hàng.</div>`}
    ${pickerDetailMarkup(selected.batch_id, batchDetails.get(selected.batch_id), true)}`;
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
    <div class="operation-actions">${roleCanResolve() ? `<button class="btn success" data-resolve="HAS_STOCK" data-batch="${esc(row.batch_id)}">CÓ HÀNG</button><button class="btn danger" data-skip-batch="${esc(row.batch_id)}">CHO PHÉP BỎ QUA</button>` : ""}<button class="btn secondary" data-detail="${esc(row.batch_id)}">${expandedBatchDetails.has(row.batch_id) ? "Ẩn Picker" : "Picker"}</button></div>
    ${pickerDetailMarkup(row.batch_id, details)}
  </article>`;
}

// One-shot timer for the next visible expiry, not a timer per SKU and never
// a provider request. The existing server-side deadline remains authoritative.
let correctionExpiryTimer: number | null = null;

function scheduleCorrectionExpiry(): void {
  if (correctionExpiryTimer !== null) {
    window.clearTimeout(correctionExpiryTimer);
    correctionExpiryTimer = null;
  }
  if (activeSection !== "results") return;

  const now = Date.now() + queueServerOffsetMs;
  let nextExpiry = Number.POSITIVE_INFINITY;
  document.querySelectorAll<HTMLElement>("[data-correction-deadline]").forEach((actions) => {
    const expiry = Date.parse(actions.dataset.correctionDeadline || "");
    if (!Number.isFinite(expiry) || expiry <= now) {
      actions.style.display = "none";
    } else {
      nextExpiry = Math.min(nextExpiry, expiry);
    }
  });
  if (Number.isFinite(nextExpiry)) {
    const wait = Math.min(2_147_483_647, Math.max(1, nextExpiry - now + 20));
    correctionExpiryTimer = window.setTimeout(scheduleCorrectionExpiry, wait);
  }
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

function renderOverdue(): string {
  return `<section class="ops-route ops-business-workspace">
    <div class="business-page-head"><div><h2>Vận hành báo hàng</h2><p>SKU có Picker đã tới mốc tự động cho phép bỏ qua nhưng vẫn chờ Invent chốt kết quả cuối.</p></div></div>
    ${renderOperationalTabs("overdue")}
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>SKU quá hạn</h3><p>Mỗi SKU chỉ xuất hiện một lần; số Picker quá hạn và Picker còn chờ được tách riêng.</p></div></div>
      ${!perPickerOverdueEnabled ? `<p class="muted">Tự động cho phép Skip theo từng Picker chưa được bật. Chưa có SKU quá hạn cần xử lý.</p>` : ""}
      <div class="table-wrap"><table><thead><tr><th>SKU / Sản phẩm</th><th>Picker quá hạn</th><th>Picker còn chờ</th><th>Quá hạn đầu tiên</th><th>Thao tác</th></tr></thead><tbody>
        ${overdueRows.map((row) => `<tr>
          <td><strong>${esc(row.sku)}</strong><div class="tiny muted">${esc(row.product_name)}</div></td>
          <td><span class="badge warning">${Number(row.overdue_picker_count || 0)} Picker</span></td>
          <td>${Number(row.waiting_picker_count || 0)} Picker</td>
          <td>${esc(fmt(row.first_overdue_at))}</td>
          <td>${roleCanResolve() ? `<div class="user-row-actions"><button class="btn success small" data-overdue-resolve="HAS_STOCK" data-batch="${esc(row.batch_id)}">ĐÃ CÓ HÀNG</button><button class="btn danger small" data-overdue-resolve="SKIP_ALLOWED" data-batch="${esc(row.batch_id)}">CHO PHÉP SKIP</button></div>` : "Chỉ xem"}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="empty">Hiện không có SKU quá hạn.</td></tr>`}
      </tbody></table></div>
    </article>
  </section>`;
}

function renderResults(): string {
  const visible = recentRows;
  const today = dateDaysAgo(0);
  const yesterday = dateDaysAgo(1);
  const rangeId =
    recentFrom === today && recentTo === today ? "TODAY" :
    recentFrom === yesterday && recentTo === yesterday ? "YESTERDAY" :
    recentFrom === dateDaysAgo(6) && recentTo === today ? "D7" :
    recentFrom === dateDaysAgo(29) && recentTo === today ? "D30" :
    "CUSTOM";
  const hasStock = Number(recentTotals.has_stock || 0);
  const skipped = Number(recentTotals.skip_allowed || 0);
  const withdrawn = Number(recentTotals.withdrawn || 0);
  const acknowledged = Number(recentTotals.acknowledged_count || 0);
  const targets = Number(recentTotals.ack_target_count || 0);
  const automaticSkipped = Number(recentTotals.automatic_skipped || 0);
  const humanSkipped = Math.max(0, skipped - automaticSkipped);
  const pageFrom = recentTotal ? recentOffset + 1 : 0;
  const pageTo = Math.min(recentTotal, recentOffset + recentRows.length);
  return `<section class="ops-route ops-business-workspace">
    <div class="business-page-head"><div><h2>Vận hành báo hàng</h2><p>Kiểm tra kết quả đã xử lý và tình trạng Picker nhận kết quả.</p></div></div>
    ${renderOperationalTabs("results")}
    <section class="business-summary-grid business-summary-grid-5">
      <article class="business-summary-card good"><span>Đã có hàng</span><strong>${hasStock}</strong><small>Nhân sự xác nhận có hàng</small></article>
      <article class="business-summary-card danger"><span>Bỏ qua bởi nhân sự</span><strong>${humanSkipped}</strong><small>Reporter/Admin xác nhận cho phép bỏ qua</small></article>
      <article class="business-summary-card warning"><span>Tự động bỏ qua</span><strong>${automaticSkipped}</strong><small>Quá hạn phản hồi nên hệ thống tự cho phép</small></article>
      <article class="business-summary-card"><span>Picker đã thu hồi</span><strong>${withdrawn}</strong><small>Báo được Picker tự thu hồi</small></article>
      <article class="business-summary-card primary"><span>Picker đã nhận kết quả</span><strong>${acknowledged}/${targets}</strong><small>Tổng lượt xác nhận nhận kết quả</small></article>
    </section>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Khoảng kết quả</h3><p>Theo thời điểm xử lý; tối đa 60 ngày. Tổng quan và bảng bên dưới dùng cùng khoảng này.</p></div><button class="secondary" id="recent-open-report">Mở báo cáo chi tiết</button></div>
      <div class="toolbar recent-range-toolbar" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">
        <div class="filters" style="display:flex;gap:6px;flex-wrap:wrap;align-self:flex-end">
          <button class="filter ${rangeId === "TODAY" ? "active" : ""}" data-recent-range="TODAY">Hôm nay</button>
          <button class="filter ${rangeId === "YESTERDAY" ? "active" : ""}" data-recent-range="YESTERDAY">Hôm qua</button>
          <button class="filter ${rangeId === "D7" ? "active" : ""}" data-recent-range="D7">7 ngày</button>
          <button class="filter ${rangeId === "D30" ? "active" : ""}" data-recent-range="D30">30 ngày</button>
        </div>
        <form id="recent-range-form" style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;min-width:0">
          <label style="min-width:146px">Từ ngày<input type="date" name="from" value="${esc(recentFrom)}" max="${esc(today)}" required /></label>
          <label style="min-width:146px">Đến ngày<input type="date" name="to" value="${esc(recentTo)}" max="${esc(today)}" required /></label>
          <button class="secondary" type="submit">Áp dụng</button>
        </form>
      </div>
      <div class="table-wrap result-audit-table"><table><thead><tr><th>SKU / Sản phẩm</th><th>Kết quả</th><th>Nguồn xử lý</th><th>Người xử lý</th><th>Picker ảnh hưởng</th><th>Picker đã nhận</th><th>Thời điểm xử lý</th><th>Phát sinh lại</th><th>Thao tác</th></tr></thead><tbody>
        ${visible.map((row) => { const correctionEnd = Date.parse(row.correction_deadline_at || "");
          const canCorrect = roleCanResolve() &&
            (row.status === "HAS_STOCK" || row.status === "SKIP_ALLOWED") &&
            row.correction_allowed === true &&
            Number.isFinite(correctionEnd) &&
            correctionEnd > Date.now() + queueServerOffsetMs; const source = row.status === "CLOSED" ? "Picker tự thu hồi" : resolutionSourceLabel(row.resolution_source); const actor = row.status === "CLOSED" ? "Picker" : resolutionActorLabel(row); return `<tr><td><strong>${esc(row.sku)}</strong><div class="tiny muted">${esc(row.product_name)}</div></td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : "closed"}">${esc(statusLabel(row.status))}</span></td><td><span class="resolution-source ${row.resolution_source === "SYSTEM_TIMEOUT" ? "automatic" : "human"}">${esc(source)}</span></td><td><strong class="resolution-actor">${esc(actor)}</strong></td><td>${Number(row.affected_picker_count)}</td><td>${row.status === "CLOSED" ? "Không áp dụng" : `${Number(row.acknowledged_count || 0)}/${Number(row.ack_target_count || 0)}`}</td><td>${esc(fmt(row.resolved_at || row.first_report_at))}</td><td>${row.previous_batch_id ? `<span class="badge warning">Có</span>` : "Không"}</td><td>${canCorrect ? `<div class="user-row-actions" data-correction-deadline="${esc(row.correction_deadline_at || "")}"><button class="btn secondary small" data-correct="${esc(row.batch_id)}" data-correct-target="PENDING" data-correct-version="${Number(row.version || 0)}">Sửa - Đang xử lý</button><button class="btn ${row.status === "SKIP_ALLOWED" ? "success" : "danger"} small" data-correct="${esc(row.batch_id)}" data-correct-target="${row.status === "SKIP_ALLOWED" ? "HAS_STOCK" : "SKIP_ALLOWED"}" data-correct-version="${Number(row.version || 0)}">Sửa - ${row.status === "SKIP_ALLOWED" ? "Đã có hàng" : "Cho phép Skip"}</button></div>` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="9" class="empty">Chưa có kết quả phù hợp trong khoảng ngày đã chọn.</td></tr>`}
      </tbody></table></div>
      <div class="user-pagination"><span>Hiển thị ${pageFrom.toLocaleString("vi-VN")}–${pageTo.toLocaleString("vi-VN")} / ${recentTotal.toLocaleString("vi-VN")} kết quả</span><div><button class="secondary" id="recent-prev" ${recentOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="recent-next" ${recentOffset + RECENT_PAGE_SIZE >= recentTotal ? "disabled" : ""}>Trang sau</button></div></div>
    </article>
  </section>`;
}

function renderPicker(): string {
  const reports = pickerReports;
  const pageFrom = pickerReportTotal ? pickerReportOffset + 1 : 0;
  const pageTo = Math.min(pickerReportTotal, pickerReportOffset + pickerReports.length);
  return `<section class="picker-workspace"><div class="page-head"><div><h1>Báo SKU hết hàng</h1></div></div>
    <div class="card"><input id="picker-sku-input" class="sku-input picker-input" placeholder="Nhập / quét SKU" value="${esc(pickerQuery)}" autocomplete="off" />
      ${pickerSuggestions.length ? `<div class="suggestions">${pickerSuggestions.slice(0, 12).map((item) => `<button class="suggestion" data-pick-sku="${esc(item.sku)}"><strong>${esc(item.sku)}</strong> · ${esc(item.product_name)}</button>`).join("")}</div>` : ""}
      <div class="selected-sku">${pickerSelected ? `<strong>${esc(pickerSelected.sku)}</strong><span>${esc(pickerSelected.product_name)}</span>` : `<span>Chưa chọn SKU hợp lệ</span>`}</div>
      <button id="picker-report" class="btn report-button" ${!pickerSelected || !onlineForMutation() || busy ? "disabled" : ""}>BÁO HẾT HÀNG</button>
      ${!onlineForMutation() ? `<div class="notice warning">Cần kết nối mạng để báo hàng. Hệ thống không có chế độ offline.</div>` : ""}
    </div>
    <div class="page-head"><div><h1 style="font-size:18px">BÁO HÔM NAY & CHƯA XỬ LÝ</h1><p class="tiny muted">Hiển thị báo hôm nay và các báo cũ chưa hoàn tất.</p></div></div>
    <div class="history-list">${reports.length ? reports.map((row) => { const effectiveStatus = row.resolution === "SKIP_ALLOWED" ? "SKIP_ALLOWED" : row.batch_status || row.status; const state = effectiveStatus === "HAS_STOCK" ? "ok" : effectiveStatus === "SKIP_ALLOWED" ? "skip" : row.status === "WITHDRAWN" || effectiveStatus === "CLOSED" ? "closed" : "pending"; const canWithdraw = row.status === "OPEN" && !row.auto_skip_allowed_at && Date.now() <= Date.parse(row.withdraw_deadline_at); return `<article class="history-card ${state}"><div><strong>${esc(row.sku)}</strong><div class="product-name">${esc(row.product_name)}</div><div class="tiny muted">${esc(fmt(row.reported_at))} · ${esc(statusLabel(effectiveStatus))}${row.resolution_source === "SYSTEM_TIMEOUT" ? " · Hệ thống tự động do quá hạn" : ""}${row.result_event_id && !row.acknowledged_at ? " · Chưa xác nhận kết quả" : ""}</div>${row.auto_skip_deadline_at && !row.auto_skip_allowed_at ? `<div class="tiny muted">Mốc tự động: ${esc(fmt(row.auto_skip_deadline_at))}</div>` : ""}</div>${canWithdraw ? `<button class="btn secondary small" data-withdraw="${esc(row.ticket_id)}">Thu hồi</button>` : ""}</article>`; }).join("") : `<div class="card empty">Không có báo hàng phù hợp.</div>`}</div>
    <div class="user-pagination"><span>Hiển thị ${pageFrom.toLocaleString("vi-VN")}–${pageTo.toLocaleString("vi-VN")} / ${pickerReportTotal.toLocaleString("vi-VN")}</span><div><button class="secondary" id="picker-history-prev" ${pickerReportOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="picker-history-next" ${pickerReportOffset + PICKER_REPORT_PAGE_SIZE >= pickerReportTotal ? "disabled" : ""}>Trang sau</button></div></div>
  </section>`;
}

function renderSku(): string {
  const wb = pendingWorkbook;
  const catalogCount = skuCatalogInfo?.count ?? 0;
  const pageFrom = skuAdminTotal ? skuAdminOffset + 1 : 0;
  const pageTo = Math.min(skuAdminTotal, skuAdminOffset + skuAdminItems.length);
  const updatedAt = skuCatalogInfo?.max_updated_at ? fmt(skuCatalogInfo.max_updated_at) : "Chưa có dữ liệu";
  const lastSyncAt = skuCatalogInfo?.last_sync_at ? fmt(skuCatalogInfo.last_sync_at) : "Chưa ghi nhận";
  const lastSyncSummary = skuCatalogInfo?.last_sync_at
    ? `Lô gần nhất: +${Number(skuCatalogInfo.last_sync_inserted || 0).toLocaleString("vi-VN")} mới · ${Number(skuCatalogInfo.last_sync_updated || 0).toLocaleString("vi-VN")} đổi tên · ${Number(skuCatalogInfo.last_sync_unchanged || 0).toLocaleString("vi-VN")} giữ nguyên`
    : "Chưa có lịch sử đồng bộ từ Agent";
  const version = skuCatalogInfo?.version || "—";
  return `<section class="ops-route sku-workspace">
    <div class="business-page-head"><div><h2>Danh mục SKU</h2><p>Tra cứu danh mục đang dùng và cập nhật dữ liệu từ Excel trong cùng một màn hình.</p></div></div>
    <section class="business-summary-grid">
      <article class="business-summary-card primary"><span>Tổng SKU hiện hành</span><strong>${catalogCount.toLocaleString("vi-VN")}</strong><small>Danh mục đang phục vụ Web/App</small></article>
      <article class="business-summary-card good"><span>Đồng bộ Agent gần nhất</span><strong class="sku-summary-time">${esc(lastSyncAt)}</strong><small>${esc(lastSyncSummary)}</small></article>
      <article class="business-summary-card"><span>Dữ liệu thay đổi gần nhất</span><strong class="sku-summary-time">${esc(updatedAt)}</strong><small>Thời điểm SKU thực sự được thêm mới hoặc đổi tên</small></article>
      <article class="business-summary-card"><span>Phiên bản danh mục</span><strong class="sku-summary-version">${esc(version)}</strong><small>Dùng để kiểm soát đồng bộ</small></article>
    </section>
    <div class="users-top-grid sku-top-grid">
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Tra cứu danh mục hiện tại</h3><p>Tìm theo mã SKU hoặc tên sản phẩm; không cần tải file để kiểm tra dữ liệu đang có.</p></div></div>
        <form id="sku-admin-search-form" class="sku-admin-search">
          <input name="query" value="${esc(skuAdminQuery)}" placeholder="Nhập SKU hoặc tên sản phẩm" autocomplete="off" />
          <button class="secondary">Tìm kiếm</button>
          <button class="secondary" type="button" id="sku-admin-clear" ${skuAdminQuery ? "" : "disabled"}>Xóa lọc</button>
        </form>
        <div class="table-wrap sku-catalog-table"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Cập nhật</th></tr></thead><tbody>
          ${skuAdminItems.length ? skuAdminItems.map((item) => `<tr><td><strong>${esc(item.sku)}</strong></td><td>${esc(item.product_name)}</td><td>${item.updated_at ? esc(fmt(item.updated_at)) : "—"}</td></tr>`).join("") : `<tr><td colspan="3" class="ops-empty-cell">Không có SKU phù hợp.</td></tr>`}
        </tbody></table></div>
        <div class="user-pagination sku-pagination"><span>Hiển thị ${pageFrom.toLocaleString("vi-VN")}–${pageTo.toLocaleString("vi-VN")} / ${skuAdminTotal.toLocaleString("vi-VN")} SKU${skuAdminQuery ? " phù hợp" : ""}</span><div><button class="secondary" id="sku-prev" ${skuAdminOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="sku-next" ${skuAdminOffset + SKU_PAGE_SIZE >= skuAdminTotal ? "disabled" : ""}>Trang sau</button></div></div>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Cập nhật danh mục từ Excel</h3><p>File được kiểm tra trước khi ghi. SKU trùng mã nhưng khác tên phải được xác nhận rõ ràng.</p></div></div>
        <div class="ops-form-grid"><label class="span">Chọn file Excel .xlsx<input id="sku-file" type="file" accept=".xlsx" /></label></div>
        ${skuImportProgress ? `<div class="message">${esc(skuImportProgress)}</div>` : `<div class="ops-note">Hệ thống giữ nguyên danh mục hiện tại cho tới khi file hợp lệ và bạn xác nhận cập nhật.</div>`}
        ${wb ? `<section class="ops-status-strip"><span><b>${wb.total_data_rows.toLocaleString("vi-VN")}</b> dòng dữ liệu</span><span><b>${wb.items.length.toLocaleString("vi-VN")}</b> SKU sẵn sàng</span><span><b>${wb.conflicts.length}</b> xung đột</span></section>` : ""}
        ${wb && !wb.conflicts.length ? `<div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật danh mục SKU</button></div>` : ""}
      </article>
    </div>
    ${wb?.conflicts.length ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Xử lý SKU trùng mã khác tên</h3><p>Chọn đúng tên sản phẩm trước khi cập nhật.</p></div></div><div class="ops-form-grid">${wb.conflicts.map((conflict) => `<label class="span">${esc(conflict.sku)}<select data-sku-conflict="${esc(conflict.sku)}"><option value="">Chọn tên sản phẩm</option>${conflict.candidates.map((candidate) => `<option value="${esc(candidate.product_name)}" ${skuConflictChoices.get(conflict.sku) === candidate.product_name ? "selected" : ""}>${esc(candidate.product_name)} · dòng ${candidate.rows.join(", ")}</option>`).join("")}</select></label>`).join("")}</div><div class="ops-form-actions"><button class="primary" id="apply-sku-import" ${busy ? "disabled" : ""}>Kiểm tra & cập nhật danh mục SKU</button></div></article>` : ""}
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
  const eventState = hrEventSync?.sync || {};
  const eventPlan = eventState.plan || {};
  const eventStatus = String(eventState.status || "CHƯA CÓ TÍN HIỆU");
  const watch = hrEventSync?.watch;
  const watchUntil = watch?.expires_at_ms
    ? fmt(new Date(Number(watch.expires_at_ms)).toISOString())
    : "Chưa đăng ký";
  const hardBlockLabels: Record<string, string> = {
    DUPLICATE_CONFLICT: "Trùng Mã nhân viên nhưng thông tin không đồng nhất",
    INVALID_ROWS: "Có dòng nhân sự không hợp lệ",
    EMPTY_SOURCE: "Nguồn nhân sự rỗng",
    NON_PICKER_COLLISION: "Mã nhân viên trùng tài khoản không phải Picker",
    SOURCE_ROW_LOSS_OVER_20_PERCENT: "Số dòng nguồn giảm quá 20%",
    HEADER_CHANGED: "Tên cột nguồn đã thay đổi",
    SOURCE_ACCESS_FAILED: "Không đọc được Google Sheet",
    SOURCE_READ_FAILED: "Không đọc được snapshot nhân sự",
  };
  const pendingFingerprint = String(eventState.pending_fingerprint || "");
  const canManageEvent = Boolean(profile && (profile.role === "ADMIN" || profile.role === "ROOT"));
  const canConfirmEvent = Boolean(pendingFingerprint && canManageEvent);
  const invalidReasonLabels: Record<string, string> = {
    INVALID_EMPLOYEE_CODE: "Mã nhân viên trống hoặc có ký tự không được phép",
    MISSING_DISPLAY_NAME: "Họ và tên đang để trống",
    DISPLAY_NAME_TOO_LONG: "Họ và tên vượt 200 ký tự",
    CONTRACTOR_TOO_LONG: "Nhà thầu vượt 200 ký tự",
  };
  const invalidRowDetails = Array.isArray(eventState.invalid_row_details)
    ? eventState.invalid_row_details.slice(0, 20)
    : [];
  const invalidRowsHtml = invalidRowDetails.length
    ? `<div class="ops-note"><b>Dòng cần sửa:</b><ul>${invalidRowDetails.map((item) => {
        const reasons = Array.isArray(item.reasons) && item.reasons.length
          ? item.reasons.map((reason) => invalidReasonLabels[String(reason)] || String(reason)).join("; ")
          : "Dữ liệu không hợp lệ";
        return `<li>Dòng <b>${Number(item.row || 0)}</b>: ${esc(reasons)}</li>`;
      }).join("")}</ul></div>`
    : "";
  const duplicateCodes = Array.isArray(eventState.duplicate_employee_codes)
    ? eventState.duplicate_employee_codes.slice(0, 20)
    : [];
  const duplicateHtml = duplicateCodes.length
    ? `<div class="ops-note"><b>Mã nhân viên bị trùng thông tin:</b> ${duplicateCodes.map((value) => esc(value)).join(", ")}</div>`
    : "";
  const hardBlockCode = String(eventState.hard_block_code || "");
  const hardBlockHelp: Record<string, string> = {
    INVALID_ROWS: "Sửa đúng các dòng được liệt kê trên Google Sheet rồi bấm Kiểm tra lại. Không cho phép ép áp dụng khi dữ liệu nguồn chưa hợp lệ.",
    DUPLICATE_CONFLICT: "Chuẩn hóa mỗi Mã nhân viên về một bộ Họ tên/Nhà thầu duy nhất rồi bấm Kiểm tra lại.",
    EMPTY_SOURCE: "Khôi phục dữ liệu nhân sự trong nguồn rồi bấm Kiểm tra lại.",
    NON_PICKER_COLLISION: "Xử lý tài khoản đang trùng Mã nhân viên nhưng không phải Picker trước khi đồng bộ.",
    SOURCE_ROW_LOSS_OVER_20_PERCENT: "Kiểm tra việc mất dòng nguồn. Hệ thống giữ nguyên user hiện tại cho đến khi nguồn hợp lệ.",
    HEADER_CHANGED: "Kiểm tra lại tên cột Mã nhân viên/Họ và tên/Nhà thầu và xác nhận lại nguồn.",
    SOURCE_ACCESS_FAILED: "Kiểm tra quyền truy cập Google Sheet rồi bấm Kiểm tra lại.",
    SOURCE_READ_FAILED: "Kiểm tra nguồn Google Sheet/kết nối rồi bấm Kiểm tra lại.",
  };
  const eventClass = eventStatus === "HARD_BLOCK"
    ? "error"
    : eventStatus === "CONFIRM_REQUIRED"
      ? "warning"
      : eventStatus === "APPLIED"
        ? "success"
        : "";
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
        <label>Tên cột Nhà thầu<input name="contractorHeader" value="${esc(source?.contractor_header || "Nhà thầu")}" required /></label>
        <div class="ops-form-actions"><button class="primary">Xác nhận nguồn</button></div>
      </form>
    </article>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Đồng bộ tự động D161</h3><p>Google Drive chỉ đánh thức hệ thống khi file thay đổi; máy chủ luôn đọc lại Sheet và kiểm tra toàn bộ snapshot trước khi áp dụng.</p></div></div>
      ${profile?.role === "ADMIN" || profile?.role === "ROOT" ? `
        <section class="ops-status-strip">
          <span>Watch <b>${watch?.configured ? "Đang hoạt động" : "Chưa hoạt động"}</b></span>
          <span>Gia hạn đến <b>${esc(watchUntil)}</b></span>
          <span>Trạng thái <b>${esc(eventStatus)}</b></span>
          <span>Dòng nguồn <b>${Number(eventState.source_row_count || 0).toLocaleString("vi-VN")}</b></span>
        </section>
        ${eventStatus === "CONFIRM_REQUIRED" ? `<div class="notice warning">
          <b>Snapshot mới cần quyết định:</b> tạo mới <b>${Number(eventPlan.create || 0)}</b>, cập nhật thông tin <b>${Number(eventPlan.existing_info_updates || 0)}</b>.
          <div>Dữ liệu hiện tại chưa thay đổi.</div>
          ${canConfirmEvent ? `<div class="ops-form-actions"><button class="primary" id="confirm-hr-event">Có · Áp dụng</button><button class="secondary" id="defer-hr-event">Không · Giữ nguyên</button></div>` : ""}
        </div>` : ""}
        ${eventStatus === "HARD_BLOCK" ? `<div class="notice error">
          <div><b>Đồng bộ đang bị chặn:</b> ${esc(hardBlockLabels[hardBlockCode] || hardBlockCode || "Cần kiểm tra nguồn nhân sự")}.</div>
          ${invalidRowsHtml}${duplicateHtml}
          <div><b>Cách xử lý:</b> ${esc(hardBlockHelp[hardBlockCode] || "Kiểm tra nguồn nhân sự, sửa nguyên nhân rồi kiểm tra lại.")}</div>
          <div>Dữ liệu người dùng hiện tại được giữ nguyên.</div>
          ${canManageEvent ? `<div class="ops-form-actions"><button class="secondary" id="recheck-hr-event">Kiểm tra lại nguồn</button></div>` : ""}
        </div>` : ""}
        ${eventClass === "success" ? `<div class="notice success">Snapshot gần nhất đã được áp dụng và xác minh theo fingerprint nguồn.</div>` : ""}
      ` : `<div class="ops-empty">Trạng thái đồng bộ tự động chỉ hiển thị cho Admin/Root.</div>`}
    </article>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Kiểm tra thủ công</h3><p>Xem trước vẫn dùng dữ liệu máy chủ đọc trực tiếp từ nguồn hiện tại.</p></div></div>
      <div class="ops-form-actions"><button class="secondary" id="preview-hr">Xem trước</button>${hrPreview ? `<button class="primary" id="apply-hr">Áp dụng</button>` : ""}</div>
      ${hrPreview ? `<section class="ops-status-strip"><span>Nguồn <b>${hrPreview.total_source}</b></span><span>Tạo mới <b>${hrPreview.create}</b></span><span>Đổi tên <b>${hrPreview.rename}</b></span><span>Đổi nhà thầu <b>${hrPreview.contractor_update || 0}</b></span><span>Không đổi <b>${hrPreview.unchanged}</b></span></section>` : `<div class="ops-empty">Chưa có bản xem trước.</div>`}
    </article>
  </section>`;
}

function canManageListedUser(user: ManagedUser): boolean {
  if (!profile || user.role === "ROOT") return false;
  if (profile.role === "ROOT") return ["ADMIN", "PICKPACK_ADMIN", "REPORTER", "PICKER"].includes(user.role);
  if (profile.role === "ADMIN") return ["REPORTER", "PICKER"].includes(user.role);
  if (profile.role === "PICKPACK_ADMIN") return user.role === "PICKER";
  return false;
}

function userSelectionLabel(): string {
  if (!allPickerSelection) return `${selectedUserIds.size.toLocaleString("vi-VN")} Picker đã chọn`;
  return excludedPickerIds.size
    ? `Tất cả Picker, trừ ${excludedPickerIds.size.toLocaleString("vi-VN")} đã bỏ chọn`
    : "Đã chọn tất cả Picker";
}

function renderUsers(): string {
  const canCreateAdmin = profile?.role === "ROOT";
  const canCreateReporter = profile?.role === "ROOT" || profile?.role === "ADMIN";
  const canCreateManaged = canCreateAdmin || canCreateReporter;
  const canLifecyclePickerBulk = profile?.role === "ADMIN" || profile?.role === "ROOT";
  const pageStart = userTotal ? userOffset + 1 : 0;
  const pageEnd = Math.min(userOffset + managedUsers.length, userTotal);
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
        <div class="ops-panel-title"><div><h3>${canCreateManaged ? "Tạo tài khoản nghiệp vụ" : "Quản lý Picker"}</h3><p>${canCreateManaged ? "Tạo Người xử lý báo hàng hoặc vai trò quản trị được phép. Picker được đồng bộ từ nguồn nhân sự." : "Quản trị Pick Pack chỉ quản lý Picker; không tạo Reporter hay Quản trị Invent."}</p></div></div>
        ${canCreateManaged ? `<form id="create-user-form" class="users-form-grid">
          <label>Mã nhân viên / tên đăng nhập<input name="username" autocomplete="off" required /></label>
          <label>Họ và tên<input name="displayName" autocomplete="off" required /></label>
          <label>Quyền sử dụng<select name="role"><option value="REPORTER">Người xử lý báo hàng</option>${canCreateAdmin ? `<option value="PICKPACK_ADMIN">Quản trị Pick Pack</option><option value="ADMIN">Quản trị Invent</option>` : ""}</select></label>
          <label>Email đăng ký<input name="authEmail" type="email" autocomplete="email" placeholder="Bắt buộc khi tạo Admin" /></label>
          <label>Mật khẩu khởi tạo<input name="password" type="password" autocomplete="new-password" required /></label>
          <div class="ops-form-actions"><button class="primary">Tạo tài khoản</button></div>
        </form>` : `<div class="ops-readonly">Thêm Picker mới qua Nguồn nhân sự và đồng bộ Picker.</div>`}
      </article>
      <article class="ops-panel users-filter-panel">
        <div class="ops-panel-title"><div><h3>Tìm và lọc tài khoản</h3><p>Lọc nhanh theo mã nhân viên, họ tên, nhà thầu, quyền hoặc trạng thái.</p></div></div>
        <form id="user-filter-form" class="users-form-grid">
          <label class="span">Tìm kiếm<input name="query" value="${esc(userQuery)}" placeholder="Mã nhân viên / họ tên / nhà thầu / tài khoản" /></label>
          <label>Quyền<select name="role"><option value="">Tất cả quyền</option>${["PICKER","REPORTER","PICKPACK_ADMIN","ADMIN"].map((role) => `<option value="${role}" ${userRole === role ? "selected" : ""}>${esc(businessRoleLabel(role))}</option>`).join("")}</select></label>
          <label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option><option value="ACTIVE" ${userStatus === "ACTIVE" ? "selected" : ""}>Đang hoạt động</option><option value="DISABLED" ${userStatus === "DISABLED" ? "selected" : ""}>Đã dừng</option></select></label>
          <label>Báo hàng<select name="shortageReporting"><option value="">Tất cả</option><option value="ENABLED" ${userShortageReporting === "ENABLED" ? "selected" : ""}>Đang bật</option><option value="DISABLED" ${userShortageReporting === "DISABLED" ? "selected" : ""}>Đang tắt</option></select></label>
          <div class="ops-form-actions"><button class="secondary">Áp dụng bộ lọc</button></div>
        </form>
      </article>
    </div>
    <article class="ops-panel ops-users-panel">
      <div class="ops-panel-title"><div><h3>Danh sách tài khoản</h3><p>ROOT được ẩn khỏi danh sách. Picker dùng thao tác hàng loạt riêng; ROOT có thể chọn Admin / Quản trị Pick Pack / Reporter để xóa.</p></div><span>${pageStart}–${pageEnd} / ${userTotal.toLocaleString("vi-VN")}</span></div>
      <div class="user-bulk-bar"><button class="secondary" id="toggle-all-pickers">${allPickerSelection ? "Bỏ chọn tất cả Picker" : "Chọn tất cả Picker"}</button><button class="secondary" data-picker-action="REPORTING_ENABLE">Bật Báo hàng</button><button class="secondary" data-picker-action="REPORTING_DISABLE">Tắt Báo hàng</button>${canLifecyclePickerBulk ? `<button class="secondary" data-picker-action="ENABLE">Mở lại</button><button class="secondary" data-picker-action="DISABLE">Dừng hoạt động</button><button class="danger" data-picker-action="DELETE">Xóa Picker</button>` : ""}<span id="user-selection-status">${esc(userSelectionLabel())}</span>${profile?.role === "ROOT" && profile?.base_role === "ROOT" ? `<button class="danger" id="delete-selected-managed" ${selectedManagedUserIds.size ? "" : "disabled"}>Xóa tài khoản đã chọn (${selectedManagedUserIds.size})</button>` : ""}</div>
      <div class="table-wrap"><table class="ops-users-table"><thead><tr><th class="user-select-col">Chọn</th><th>Mã nhân viên</th><th>Họ và tên</th><th>Nhà thầu</th><th>Báo hàng</th><th>Quyền</th><th>Trạng thái</th><th>Đăng nhập lần cuối</th><th>Thao tác</th></tr></thead><tbody>
        ${managedUsers.length ? managedUsers.map((user) => {
          const isPicker = user.role === "PICKER";
          const isChecked = isPicker && (allPickerSelection ? !excludedPickerIds.has(user.user_id) : selectedUserIds.has(user.user_id));
          const rootCanDeleteManaged = profile?.role === "ROOT" && profile?.base_role === "ROOT" && ["ADMIN", "PICKPACK_ADMIN", "REPORTER"].includes(user.role);
          const selectable = isPicker
            ? `<label class="bulk-picker-check" title="Chọn Picker này"><input type="checkbox" data-user-select="${esc(user.user_id)}" ${isChecked ? "checked" : ""}/><span aria-hidden="true"></span></label>`
            : rootCanDeleteManaged
              ? `<label class="bulk-picker-check" title="Chọn tài khoản để xóa"><input type="checkbox" data-managed-user-select="${esc(user.user_id)}" ${selectedManagedUserIds.has(user.user_id) ? "checked" : ""}/><span aria-hidden="true"></span></label>`
              : `<span class="bulk-not-applicable">—</span>`;
          const actions = canManageListedUser(user)
            ? `<div class="user-row-actions"><button class="secondary" data-edit-user="${esc(user.user_id)}">Sửa</button>${privilegedOneTimeManagedUser(user) ? `<span class="ops-readonly">Không đổi tại đây</span>` : `<button class="secondary" data-password-user="${esc(user.user_id)}">Đổi mật khẩu</button>`}</div>`
            : `<span class="ops-readonly">${user.role === "ROOT" ? "Tài khoản gốc được bảo vệ" : "Không thuộc quyền quản lý hiện tại"}</span>`;
          const contractor = isPicker ? (user.contractor_name || "—") : "—";
          const reporting = isPicker
            ? `<span class="badge ${user.shortage_reporting_enabled !== false ? "good" : "closed"}">${user.shortage_reporting_enabled !== false ? "Đang bật" : "Đang tắt"}</span>`
            : "—";
          return `<tr><td class="user-select-col">${selectable}</td><td><b>${esc(user.employee_code || user.user_id)}</b></td><td>${esc(user.display_name)}</td><td>${esc(contractor)}</td><td>${reporting}</td><td>${esc(businessRoleLabel(user.role))}</td><td><span class="badge ${user.status === "ACTIVE" ? "good" : "closed"}">${user.status === "ACTIVE" ? "Đang hoạt động" : "Đã dừng"}</span></td><td>${user.last_login_at ? `${esc(fmt(user.last_login_at))}<div class="tiny muted">${esc(user.last_login_channel || "")}</div>` : "Chưa ghi nhận"}</td><td>${actions}</td></tr>`;
        }).join("") : `<tr><td colspan="9" class="ops-empty">Không có tài khoản phù hợp.</td></tr>`}
      </tbody></table></div>
      <div class="user-pagination"><span>Trang hiển thị ${pageStart}–${pageEnd}</span><div><button class="secondary" id="user-prev" ${userOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="user-next" ${userOffset + USER_PAGE_SIZE >= userTotal ? "disabled" : ""}>Trang sau</button></div></div>
    </article>
  </section>`;
}

function renderSla(): string {
  if (!slaResponse) {
    return `<section class="ops-route sla-workspace">
      <div class="business-page-head"><div><h2>Thời gian xử lý</h2><p>Cấu hình chung toàn hệ thống.</p></div><span class="global-setting-badge">Đang tải cấu hình máy chủ…</span></div>
      <article class="ops-panel sla-loading-panel"><strong>Đang đồng bộ cấu hình hiện hành</strong><span>Web không hiển thị giá trị mặc định thay thế trong lúc chờ máy chủ để tránh nhầm cấu hình.</span></article>
    </section>`;
  }

  const sla = slaResponse.sla;
  const configured = Boolean(slaResponse.configured && sla);
  const insight = operationalInsights?.sla;
  const warningEnabled = configured ? sla!.warning_enabled === true : false;
  const escalationEnabled = configured ? sla!.escalation_enabled === true : false;
  const autoEnabled = configured ? sla!.auto_skip_enabled === true : false;
  const correctionEnabled = configured ? sla!.skip_to_stock_enabled === true : false;
  const serverMode = configured ? normalizeAutoSkipMode(sla!.auto_skip_mode) : null;
  const mode = slaFormDirty ? (slaDraftMode || serverMode) : serverMode;
  const modeInvalid = configured && !serverMode;
  const draftModePending = Boolean(slaFormDirty && mode && mode !== serverMode);
  const revision = Number(sla?.policy_version || 0);
  const updatedBy = sla?.updated_by || "—";
  const updatedAt = sla?.updated_at ? fmt(sla.updated_at) : "Chưa có";
  return `<section class="ops-route sla-workspace sla-professional">
    <div class="business-page-head sla-page-head">
      <div><h2>Thời gian xử lý</h2><p>Thiết lập một lần, áp dụng đồng nhất cho toàn bộ Reporter/Admin/Root và mọi thiết bị.</p></div>
      <div class="sla-authority-badges"><span class="global-setting-badge">Cấu hình máy chủ</span><span class="sla-revision-badge">${configured ? `Phiên bản ${revision}` : "Chưa cấu hình"}</span></div>
    </div>

    <section class="sla-authority-strip">
      <div><span>Trạng thái</span><strong>${configured ? "Đã đồng bộ" : "Chưa thiết lập"}</strong></div>
      <div><span>Cập nhật gần nhất</span><strong>${esc(updatedAt)}</strong></div>
      <div><span>Người cập nhật</span><strong>${esc(updatedBy)}</strong></div>
      <div><span>Phạm vi</span><strong>Toàn hệ thống</strong></div>
    </section>
    ${modeInvalid ? `<div class="sla-config-error" role="alert">Cấu hình máy chủ đang thiếu chính sách Deadline hợp lệ. Không lưu đè; hãy tải lại trang hoặc kiểm tra dịch vụ.</div>` : ""}

    <form id="sla-form" class="ops-panel sla-config-panel sla-config-professional" autocomplete="off">
      <div class="ops-panel-title sla-section-heading"><div><h3>01 · Mốc phản hồi</h3><p>Các mốc phải theo thứ tự Cảnh báo &lt; Quá hạn &lt; Tự động cho phép bỏ qua.</p></div></div>
      <div class="sla-threshold-flow">
        <article class="sla-threshold-card warning">
          <div class="sla-card-head"><div><span class="ops-step">01</span><strong>Cảnh báo</strong></div><label class="sla-switch"><input name="warningEnabled" type="checkbox" ${warningEnabled ? "checked" : ""}/><span>${warningEnabled ? "Đang bật" : "Đang tắt"}</span></label></div>
          <p>Nhắc Invent khi SKU bắt đầu cần được ưu tiên.</p>
          <label class="sla-minute-field"><span>Sau</span><input name="warning" type="number" min="1" max="1440" value="${configured ? esc(sla!.warning_minutes) : ""}" required /><b>phút</b></label>
        </article>
        <span class="sla-flow-arrow" aria-hidden="true">→</span>
        <article class="sla-threshold-card danger">
          <div class="sla-card-head"><div><span class="ops-step">02</span><strong>Quá hạn</strong></div><label class="sla-switch"><input name="escalationEnabled" type="checkbox" ${escalationEnabled ? "checked" : ""}/><span>${escalationEnabled ? "Đang bật" : "Đang tắt"}</span></label></div>
          <p>Đánh dấu mức ưu tiên cao khi chưa có phản hồi.</p>
          <label class="sla-minute-field"><span>Sau</span><input name="escalation" type="number" min="2" max="2880" value="${configured ? esc(sla!.escalation_minutes) : ""}" required /><b>phút</b></label>
        </article>
        <span class="sla-flow-arrow" aria-hidden="true">→</span>
        <article class="sla-threshold-card automatic">
          <div class="sla-card-head"><div><span class="ops-step">03</span><strong>Tự động bỏ qua</strong></div><label class="sla-switch"><input name="autoSkipEnabled" type="checkbox" ${autoEnabled ? "checked" : ""}/><span>${autoEnabled ? "Đang bật" : "Đang tắt"}</span></label></div>
          <p>Hệ thống tự cấp quyền bỏ qua nếu Invent chưa xử lý.</p>
          <label class="sla-minute-field"><span>Sau</span><input name="autoSkip" type="number" min="3" max="10080" value="${configured ? esc(sla!.auto_skip_minutes) : ""}" required /><b>phút</b></label>
        </article>
      </div>

      <div class="ops-panel-title sla-section-heading"><div><h3>02 · Chính sách tính thời gian</h3><p>Chọn cách tính deadline và cửa sổ sửa kết quả.</p></div></div>
      <div class="sla-policy-professional">
        <article class="sla-policy-card">
          <span class="sla-policy-kicker">Deadline tự động</span>
          <h4>Cách tính mốc tự động bỏ qua</h4>
          <div class="sla-choice-list" role="radiogroup" aria-label="Cách tính mốc tự động bỏ qua">
            <label class="sla-radio-row"><input type="radio" name="autoSkipMode" value="FIRST_REPORT" autocomplete="off" ${mode === "FIRST_REPORT" ? "checked" : ""} required/><span><strong>Theo báo đầu tiên của SKU</strong><small>Cả đợt dùng chung một mốc thời gian.</small></span></label>
            <label class="sla-radio-row"><input type="radio" name="autoSkipMode" value="PER_PICKER" autocomplete="off" ${mode === "PER_PICKER" ? "checked" : ""} required/><span><strong>Theo từng Picker</strong><small>Mỗi Picker có deadline tính từ lúc chính người đó báo.</small></span></label>
          </div>
          <div class="sla-server-value">Đang áp dụng: <strong id="sla-server-mode-value">${autoSkipModeLabel(serverMode)}</strong></div>
          <div id="sla-draft-value" class="sla-draft-value" data-pending="${draftModePending ? "true" : "false"}">${draftModePending ? `Thay đổi chưa lưu: ${autoSkipModeLabel(mode)}` : "Biểu mẫu đang khớp cấu hình máy chủ."}</div>
        </article>
        <article class="sla-policy-card">
          <span class="sla-policy-kicker">Sửa kết quả</span>
          <h4>Đã có hàng / Cho phép Skip</h4>
          <label class="sla-radio-row"><input name="skipToStockEnabled" type="checkbox" ${correctionEnabled ? "checked" : ""}/><span><strong>Cho phép sửa kết quả</strong><small>Cùng một thời hạn cho cả hai trạng thái, tính từ lúc công bố kết quả; độc lập với mốc quá hạn.</small></span></label>
          <label class="sla-minute-field compact"><span>Cho phép trong</span><input name="skipToStockMinutes" type="number" min="1" max="10080" value="${configured ? esc(sla!.skip_to_stock_minutes) : ""}" required /><b>phút</b></label>
        </article>
      </div>

      <div class="sla-config-footer">
        <div><strong>Lưu ý</strong><span>Hệ thống kiểm tra phiên bản cấu hình trước khi lưu. Nếu một máy khác vừa cập nhật, bản cũ sẽ không được phép ghi đè.</span></div>
        <label class="field"><span>Mật khẩu / mã xác nhận</span><input name="currentPassword" type="password" autocomplete="current-password" required maxlength="128" placeholder="Mật khẩu hiện tại, mã một lần hoặc khẩn cấp" /></label>
        <button id="sla-save-button" class="primary" ${slaSaveBusy ? "disabled" : ""}>${slaSaveBusy ? "Đang lưu…" : "Lưu cấu hình toàn hệ thống"}</button>
      </div>
    </form>

    <section class="sla-current-grid" aria-label="Tình trạng hiện tại">
      <article class="sla-current-card warning"><span>SKU đang cảnh báo</span><strong id="sla-warning-count">${warningEnabled ? Number(insight?.warning_count || 0) : "Tắt"}</strong></article>
      <article class="sla-current-card danger"><span>SKU đã quá hạn</span><strong id="sla-escalated-count">${escalationEnabled ? Number(insight?.escalated_count || 0) : "Tắt"}</strong></article>
      <article class="sla-current-card ${autoEnabled ? "auto" : ""}"><span>Tự động bỏ qua</span><strong>${autoEnabled ? "Đang bật" : "Đang tắt"}</strong></article>
      <article class="sla-current-card ${correctionEnabled ? "auto" : ""}"><span>Sửa kết quả Đã có hàng / Skip</span><strong>${correctionEnabled ? `${Number(sla?.skip_to_stock_minutes || 0)} phút` : "Đang tắt"}</strong></article>
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
  const recentResolutions = dashboardData?.recent_resolutions || [];
  const timeline = dashboardData?.timeline || [];
  const outcomes = dashboardData?.outcomes || [];
  const resolutionSources = dashboardData?.resolution_sources || [];
  const count = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const sourceCount = (status: string, source: string) => Number(resolutionSources.find((row) => row.status === status && row.resolution_source === source)?.count || 0);
  const hasStock = count("HAS_STOCK");
  const skipped = count("SKIP_ALLOWED");
  const automaticSkipped = sourceCount("SKIP_ALLOWED", "SYSTEM_TIMEOUT");
  const humanSkipped = Math.max(0, skipped - automaticSkipped);
  const withdrawn = count("CLOSED");
  const pending = Number(k?.pending_batch_count || 0);
  const totalResolved = Math.max(0, hasStock + skipped + withdrawn);
  const outcomePct = (value: number) => totalResolved > 0 ? Math.round(value * 100 / totalResolved) : 0;
  const warningCount = Number(operationalInsights?.sla?.warning_count || 0);
  const overdueCount = Number(operationalInsights?.sla?.escalated_count || 0);
  const roleOnline = realtimePresence?.online_users_by_role || { PICKER: 0, REPORTER: 0, ADMIN: 0, ROOT: 0 };
  const onlineTotal = Number(realtimePresence?.online_users || 0);
  const trendRows = timeline.slice(-24);
  const trendMax = Math.max(1, ...trendRows.flatMap((row) => [Number(row.reports || 0), Number(row.resolved || 0)]));
  const affectedInPeriod = Number(k?.affected_picker_count || 0);
  const recurrenceSkuCount = recurrence.length;
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
    <section class="business-summary-grid business-summary-grid-5 pro-kpi-grid">
      <button type="button" class="business-summary-card summary-filter-card primary" data-dashboard-status="PENDING"><span>SKU đang chờ xử lý</span><strong>${pending}</strong><small>Mở báo cáo chi tiết đang chờ</small></button>
      <article class="business-summary-card primary-soft"><span>Picker đang bị ảnh hưởng</span><strong>${Number(k?.pending_picker_count || 0)}</strong><small>Tại các SKU chưa xử lý</small></article>
      <article class="business-summary-card warning"><span>Sắp quá thời gian</span><strong>${warningCount}</strong><small>Cần ưu tiên kiểm tra</small></article>
      <article class="business-summary-card danger"><span>Đã quá thời gian</span><strong>${overdueCount}</strong><small>Cần xử lý ngay</small></article>
      <article class="business-summary-card good"><span>Người đang online</span><strong>${onlineTotal}</strong><small>Web + PDA đang hoạt động</small></article>
    </section>

    <div class="report-layout-two">
      <article class="ops-panel presence-panel">
        <div class="ops-panel-title"><div><h3>Người đang online theo quyền</h3><p>Chỉ Web + PDA; Agent không được tính. Một tài khoản được tính một lần dù mở nhiều phiên cùng quyền.</p></div></div>
        <div class="presence-grid">
          <div><span>Người lấy hàng</span><strong>${Number(roleOnline.PICKER || 0)}</strong></div>
          <div><span>Người xử lý báo hàng</span><strong>${Number(roleOnline.REPORTER || 0)}</strong></div>
          <div><span>Quản trị</span><strong>${Number(roleOnline.ADMIN || 0)}</strong></div>
          <div><span>Quản trị hệ thống</span><strong>${Number(roleOnline.ROOT || 0)}</strong></div>
        </div>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Khối lượng trong kỳ</h3><p>Các chỉ số chính theo khoảng thời gian đã chọn.</p></div></div>
        <div class="presence-grid pro-period-grid">
          <div><span>Lượt báo hết hàng</span><strong>${Number(k?.reports_count || 0).toLocaleString("vi-VN")}</strong></div>
          <div><span>SKU phát sinh</span><strong>${Number(k?.unique_sku_count || 0).toLocaleString("vi-VN")}</strong></div>
          <div><span>Picker bị ảnh hưởng</span><strong>${affectedInPeriod.toLocaleString("vi-VN")}</strong></div>
          <div><span>Đợt đã xử lý</span><strong>${Number(k?.resolved_batch_count || 0).toLocaleString("vi-VN")}</strong></div>
          <div><span>Thời gian xử lý bình quân</span><strong>${k?.avg_resolution_minutes == null ? "—" : `${k.avg_resolution_minutes} phút`}</strong></div>
          <div><span>SKU nổi bật phát sinh lại</span><strong>${recurrenceSkuCount.toLocaleString("vi-VN")}</strong></div>
        </div>
      </article>
    </div>

    <div class="report-layout-two">
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Kết quả xử lý</h3><p>Tỷ trọng các kết quả đã khép lại trong kỳ.</p></div></div>
        <div class="v5-outcome-bars">
          <div class="v5-outcome-line"><div><span>Đã có hàng</span><b>${hasStock}</b></div><div class="v5-track"><i class="green" style="width:${outcomePct(hasStock)}%"></i></div><small>${outcomePct(hasStock)}%</small></div>
          <div class="v5-outcome-line"><div><span>Bỏ qua bởi nhân sự</span><b>${humanSkipped}</b></div><div class="v5-track"><i class="red" style="width:${outcomePct(humanSkipped)}%"></i></div><small>${outcomePct(humanSkipped)}%</small></div>
          <div class="v5-outcome-line"><div><span>Tự động bỏ qua quá hạn</span><b>${automaticSkipped}</b></div><div class="v5-track"><i class="amber" style="width:${outcomePct(automaticSkipped)}%"></i></div><small>${outcomePct(automaticSkipped)}%</small></div>
          <div class="v5-outcome-line"><div><span>Picker đã thu hồi</span><b>${withdrawn}</b></div><div class="v5-track"><i class="gray" style="width:${outcomePct(withdrawn)}%"></i></div><small>${outcomePct(withdrawn)}%</small></div>
        </div>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>SKU phát sinh lại</h3><p>Ưu tiên xem các SKU đã xử lý nhưng tiếp tục được báo lại.</p></div></div>
        ${recurrence.length ? `<div class="v5-rank-list">${recurrence.slice(0,8).map((row,index) => `<div class="v5-rank-row"><b>${index+1}</b><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><em>${Number(row.recurrence_count)} lần</em></div>`).join("")}</div>` : `<div class="v5-empty">Không có SKU phát sinh lại trong kỳ.</div>`}
      </article>
    </div>

    <article class="ops-panel pro-resolution-activity">
      <div class="ops-panel-title"><div><h3>Kết quả xử lý gần đây</h3><p>Hiển thị rõ người đã xác nhận Có hàng / Cho phép bỏ qua; trường hợp quá hạn tự động hiển thị Hệ thống.</p></div></div>
      ${recentResolutions.length ? `<div class="resolution-activity-list">${recentResolutions.map((row) => {
        const actor = resolutionActorLabel(row);
        const automatic = row.resolution_source === "SYSTEM_TIMEOUT";
        return `<div class="resolution-activity-row"><div class="resolution-activity-sku"><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><span class="badge ${row.status === "HAS_STOCK" ? "ok" : "skip"}">${esc(statusLabel(row.status))}</span><div class="resolution-activity-actor"><span>Người xử lý</span><strong>${esc(actor)}</strong></div><div class="resolution-activity-time"><span>${automatic ? "Nguồn" : "Xử lý lúc"}</span><strong>${automatic ? "Hệ thống · quá hạn" : esc(fmt(row.resolved_at))}</strong></div></div>`;
      }).join("")}</div>` : `<div class="v5-empty">Chưa có kết quả xử lý trong khoảng thời gian này.</div>`}
    </article>

    <div class="report-layout-two">
      <article class="ops-panel pro-trend-panel"><div class="ops-panel-title"><div><h3>Nhịp vận hành theo thời gian</h3><p>So sánh lượt báo phát sinh và đợt được xử lý trong kỳ.</p></div><div class="pro-chart-legend"><span><i class="reports"></i>Lượt báo</span><span><i class="resolved"></i>Đã xử lý</span></div></div>${trendRows.length ? `<div class="pro-trend-chart">${trendRows.map((row,index) => { const reports = Number(row.reports || 0); const resolved = Number(row.resolved || 0); const label = dashboardData?.period.bucket === "hour" ? String(row.bucket).slice(11,16) : String(row.bucket).slice(5,10); const step = Math.max(1, Math.ceil(trendRows.length / 8)); return `<div class="pro-trend-column" title="${esc(label)} · ${reports} lượt báo · ${resolved} đã xử lý"><div class="pro-trend-bars"><i class="reports" style="height:${Math.max(reports ? 5 : 1, reports / trendMax * 100)}%"></i><i class="resolved" style="height:${Math.max(resolved ? 5 : 1, resolved / trendMax * 100)}%"></i></div><span>${index % step === 0 || index === trendRows.length - 1 ? esc(label) : ""}</span></div>`; }).join("")}</div>` : `<div class="v5-empty">Chưa có dữ liệu theo thời gian trong kỳ.</div>`}</article>
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>SKU phát sinh nhiều</h3><p>SKU có nhiều lượt báo nhất trong kỳ.</p></div></div>${dashboardData?.top_skus?.length ? `<div class="v5-rank-list pro-rank-list">${dashboardData.top_skus.slice(0,8).map((row,index) => `<button type="button" class="v5-rank-row pro-rank-action" data-dashboard-sku="${esc(row.sku)}"><b>${index+1}</b><div><strong>${esc(row.sku)}</strong><span>${esc(row.product_name)}</span></div><em>${Number(row.report_count).toLocaleString("vi-VN")} báo · ${Number(row.picker_count).toLocaleString("vi-VN")} Picker</em></button>`).join("")}</div>` : `<div class="v5-empty">Chưa có dữ liệu.</div>`}</article>
    </div>
  </section>`;
}

function reportPickerOutcome(row: AdminReportingDetailRow): { label: string; tone: string; source: string } {
  if (row.ticket_status === "WITHDRAWN") return { label: "Picker đã thu hồi", tone: "closed", source: "Picker tự thu hồi" };
  const resolution = row.ticket_resolution || row.batch_resolution;
  const source = row.ticket_resolution_source || row.batch_resolution_source || "";
  if (resolution === "HAS_STOCK") {
    return { label: "Đã có hàng", tone: "ok", source: source === "REPORTER_CORRECTION" ? "Invent sửa kết quả" : "Invent xác nhận" };
  }
  if (resolution === "SKIP_ALLOWED") {
    return { label: "Cho phép bỏ qua", tone: "skip", source: source === "SYSTEM_TIMEOUT" ? "Hệ thống · quá hạn" : "Invent xác nhận" };
  }
  return { label: "Đang chờ", tone: "pending", source: "Chưa xử lý" };
}

function reportPickerReceipt(row: AdminReportingDetailRow): string {
  if (row.ticket_status === "WITHDRAWN") return "Không áp dụng";
  if (row.result_acknowledged_at) return `Đã xác nhận · ${fmt(row.result_acknowledged_at)}`;
  if (row.result_displayed_at) return `Đã hiển thị · ${fmt(row.result_displayed_at)}`;
  if (row.result_received_at) return `Đã nhận · ${fmt(row.result_received_at)}`;
  if (row.ticket_resolution || row.batch_resolution) return "Chưa xác nhận";
  return "Chưa có kết quả";
}

function reportPickerDetailMarkup(batchId: string): string {
  if (reportDetailLoads.has(batchId)) {
    return `<div class="report-picker-detail-panel loading"><div class="report-picker-detail-head"><div><strong>Picker báo SKU</strong><span>Đang tải chi tiết đúng đợt báo hàng…</span></div></div></div>`;
  }
  const details = reportBatchDetails.get(batchId);
  if (!details) return "";
  if (!details.length) {
    return `<div class="report-picker-detail-panel"><div class="ops-empty">Không có dữ liệu Picker trong đợt này.</div></div>`;
  }
  return `<div class="report-picker-detail-panel">
    <div class="report-picker-detail-head"><div><strong>Picker báo SKU</strong><span>Chi tiết từng Picker trong đúng đợt báo hàng đã chọn.</span></div><b>${details.length.toLocaleString("vi-VN")} lượt</b></div>
    <div class="report-picker-detail-table">
      <div class="report-picker-detail-grid header"><span>Picker</span><span>Báo lúc</span><span>Kết quả</span><span>Thời gian chờ</span><span>Nhận kết quả</span></div>
      ${details.map((item) => {
        const outcome = reportPickerOutcome(item);
        return `<div class="report-picker-detail-grid">
          <span><strong>${esc(item.picker_employee_code || "—")}</strong><small>${esc(item.picker_display_name || "—")}</small></span>
          <span>${esc(fmt(item.reported_at))}</span>
          <span><b class="status ${outcome.tone}">${esc(outcome.label)}</b><small>${esc(outcome.source)}</small></span>
          <span>${item.picker_wait_minutes == null ? "—" : `${Number(item.picker_wait_minutes).toLocaleString("vi-VN")} phút`}</span>
          <span>${esc(reportPickerReceipt(item))}</span>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

async function loadReportBatchDetails(batchId: string): Promise<void> {
  if (!batchId || reportBatchDetails.has(batchId) || reportDetailLoads.has(batchId)) return;
  reportDetailLoads.add(batchId);
  if (activeSection === "reports") patchActiveSection(true);
  try {
    const range = apiRange(reportFrom, reportTo);
    const page = await getAdminReportingDetail({
      from: range.from,
      to: range.to,
      status: reportStatus,
      query: reportQuery,
      batchId,
      limit: 500,
      offset: 0,
    });
    reportBatchDetails.set(batchId, page.items.filter((item) => item.batch_id === batchId));
    markWebUpdateReceived();
  } catch (error) {
    expandedReportBatches.delete(batchId);
    runtimeLogEvent(`Không tải được chi tiết Picker báo cáo: ${error instanceof Error ? error.message : "unknown"}`, "ERROR");
    setNotice("error", "Không tải được chi tiết Picker của đợt báo hàng. Vui lòng thử lại.");
  } finally {
    reportDetailLoads.delete(batchId);
    if (activeSection === "reports") patchActiveSection(true);
  }
}

function renderReports(): string {
  const k = reportSummary?.kpis;
  const outcomes = reportSummary?.outcomes || [];
  const resolutionSources = reportSummary?.resolution_sources || [];
  const count = (status: string) => Number(outcomes.find((row) => row.status === status)?.count || 0);
  const sourceCount = (status: string, source: string) => Number(resolutionSources.find((row) => row.status === status && row.resolution_source === source)?.count || 0);
  const automaticSkipped = sourceCount("SKIP_ALLOWED", "SYSTEM_TIMEOUT");
  const humanSkipped = Math.max(0, count("SKIP_ALLOWED") - automaticSkipped);
  const recurrenceCount = reportInsights?.recurrence?.top_skus?.length || 0;
  const reportWarningCount = Number(reportInsights?.sla?.warning_count || 0);
  const reportOverdueCount = Number(reportInsights?.sla?.escalated_count || 0);
  const reportClosedTotal = count("HAS_STOCK") + count("SKIP_ALLOWED") + count("CLOSED");
  const reportOutcomePct = (value: number) => reportClosedTotal > 0 ? Math.round(value * 100 / reportClosedTotal) : 0;
  const pageFrom = reportTotal ? reportOffset + 1 : 0;
  const pageTo = Math.min(reportTotal, reportOffset + reportRows.length);
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
    <section class="business-summary-grid business-summary-grid-6 pro-report-kpis">
      <article class="business-summary-card primary"><span>Lượt báo hết hàng</span><strong>${Number(k?.reports_count || 0).toLocaleString("vi-VN")}</strong><small>Trong khoảng thời gian đã chọn</small></article>
      <article class="business-summary-card primary-soft"><span>SKU phát sinh</span><strong>${Number(k?.unique_sku_count || 0).toLocaleString("vi-VN")}</strong><small>Số SKU khác nhau trong kỳ</small></article>
      <article class="business-summary-card primary-soft"><span>Picker bị ảnh hưởng</span><strong>${Number(k?.affected_picker_count || 0).toLocaleString("vi-VN")}</strong><small>Tổng Picker ghi nhận trong kỳ</small></article>
      <article class="business-summary-card good"><span>Đợt đã xử lý</span><strong>${Number(k?.resolved_batch_count || 0).toLocaleString("vi-VN")}</strong><small>${k?.avg_resolution_minutes == null ? "Chưa có thời gian bình quân" : `Bình quân ${k.avg_resolution_minutes} phút`}</small></article>
      <article class="business-summary-card warning"><span>Sắp quá thời gian</span><strong>${reportWarningCount.toLocaleString("vi-VN")}</strong><small>Đang cần theo dõi</small></article>
      <article class="business-summary-card danger"><span>Đã quá thời gian</span><strong>${reportOverdueCount.toLocaleString("vi-VN")}</strong><small>Đang cần ưu tiên xử lý</small></article>
    </section>
    <div class="report-layout-two pro-report-analysis">
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>Cơ cấu kết quả</h3><p>Tỷ trọng các đợt đã khép lại trong bộ lọc hiện tại.</p></div></div><div class="v5-outcome-bars"><div class="v5-outcome-line"><div><span>Đã có hàng</span><b>${count("HAS_STOCK")}</b></div><div class="v5-track"><i class="green" style="width:${reportOutcomePct(count("HAS_STOCK"))}%"></i></div><small>${reportOutcomePct(count("HAS_STOCK"))}%</small></div><div class="v5-outcome-line"><div><span>Bỏ qua bởi nhân sự</span><b>${humanSkipped}</b></div><div class="v5-track"><i class="red" style="width:${reportOutcomePct(humanSkipped)}%"></i></div><small>${reportOutcomePct(humanSkipped)}%</small></div><div class="v5-outcome-line"><div><span>Tự động bỏ qua quá hạn</span><b>${automaticSkipped}</b></div><div class="v5-track"><i class="amber" style="width:${reportOutcomePct(automaticSkipped)}%"></i></div><small>${reportOutcomePct(automaticSkipped)}%</small></div><div class="v5-outcome-line"><div><span>Picker đã thu hồi</span><b>${count("CLOSED")}</b></div><div class="v5-track"><i class="gray" style="width:${reportOutcomePct(count("CLOSED"))}%"></i></div><small>${reportOutcomePct(count("CLOSED"))}%</small></div></div></article>
      <article class="ops-panel"><div class="ops-panel-title"><div><h3>Điểm cần theo dõi</h3><p>Tóm tắt nhanh để điều phối công việc hiện tại.</p></div></div><div class="pro-watch-grid"><div class="warning"><span>Sắp quá thời gian</span><strong>${reportWarningCount}</strong></div><div class="danger"><span>Đã quá thời gian</span><strong>${reportOverdueCount}</strong></div><div class="automatic"><span>Tự động bỏ qua quá hạn</span><strong>${automaticSkipped}</strong></div><div><span>SKU nổi bật phát sinh lại</span><strong>${recurrenceCount}</strong></div><div><span>Thời gian xử lý bình quân</span><strong>${k?.avg_resolution_minutes == null ? "—" : `${k.avg_resolution_minutes} phút`}</strong></div></div></article>
    </div>
    <article class="ops-panel">
      <div class="ops-panel-title pro-report-table-head"><div><h3>Chi tiết đợt báo hàng</h3><p>Đang hiển thị ${pageFrom.toLocaleString("vi-VN")}–${pageTo.toLocaleString("vi-VN")} / ${reportTotal.toLocaleString("vi-VN")} bản ghi phù hợp.</p></div><div class="user-row-actions"><button class="secondary" id="report-prev" ${reportOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="report-next" ${reportOffset + REPORT_PAGE_SIZE >= reportTotal ? "disabled" : ""}>Trang sau</button></div></div>
      <div class="table-wrap pro-report-table"><table><thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Kết quả</th><th>Nguồn xử lý</th><th>Người xử lý</th><th>Báo lần đầu</th><th>Xử lý xong</th><th>Thời gian xử lý</th><th>Đang mở</th><th>Tổng lượt báo</th><th>Chi tiết Picker</th></tr></thead><tbody>${reportRows.map((row) => { const source = row.status === "CLOSED" ? "Picker tự thu hồi" : row.status === "PENDING" ? "—" : resolutionSourceLabel(row.resolution_source); const actor = row.status === "CLOSED" ? "Picker" : row.status === "PENDING" ? "—" : resolutionActorLabel(row); const expanded = expandedReportBatches.has(row.batch_id); return `<tr><td><strong>${esc(row.sku)}</strong></td><td>${esc(row.product_name)}</td><td><span class="badge ${row.status === "HAS_STOCK" ? "ok" : row.status === "SKIP_ALLOWED" ? "skip" : row.status === "CLOSED" ? "closed" : "warning"}">${esc(statusLabel(row.status))}</span></td><td><span class="resolution-source ${row.resolution_source === "SYSTEM_TIMEOUT" ? "automatic" : "human"}">${esc(source)}</span></td><td><strong class="resolution-actor">${esc(actor)}</strong></td><td>${esc(fmt(row.first_report_at))}</td><td>${esc(fmt(row.resolved_at))}</td><td>${row.duration_minutes == null ? "—" : `${row.duration_minutes} phút`}</td><td>${Number(row.open_ticket_count || 0).toLocaleString("vi-VN")}</td><td>${Number(row.total_ticket_count || 0).toLocaleString("vi-VN")}</td><td><button type="button" class="secondary small report-picker-toggle" data-report-picker-detail="${esc(row.batch_id)}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "Ẩn Picker" : "Xem Picker"}</button></td></tr>${expanded ? `<tr class="report-picker-detail-row"><td colspan="11">${reportPickerDetailMarkup(row.batch_id)}</td></tr>` : ""}`; }).join("") || `<tr><td colspan="11" class="ops-empty">Chưa có dữ liệu phù hợp.</td></tr>`}</tbody></table></div>
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
      <article class="business-summary-card good"><span>Người đang online</span><strong>${systemNum(realtime.online_users)}</strong><small>${systemNum(realtime.online_sessions)} phiên Web/PDA · không tính Agent</small></article>
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
    shift: "Ca vận hành",
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

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    SKU_IMPORT: "Cập nhật danh mục SKU",
    BATCH_RESOLVE: "Xử lý báo hàng",
    BATCH_CORRECT: "Sửa kết quả báo hàng",
    SLA_CONFIG_UPDATE: "Cập nhật thời gian xử lý",
    USER_CREATE: "Tạo tài khoản",
    USER_UPDATE: "Cập nhật tài khoản",
    USER_PASSWORD_CHANGE_BY_MANAGER: "Đổi mật khẩu tài khoản",
    PICKER_DELETE: "Xóa Picker",
    PICKER_ENABLE: "Mở lại Picker",
    PICKER_DISABLE: "Dừng Picker",
    PICKER_BULK_ACTION: "Thao tác Picker hàng loạt",
    HR_PICKER_SYNC: "Đồng bộ Picker",
    USER_CREATE_ROLLBACK: "Hoàn tác tạo tài khoản",
    MANAGED_USER_DELETE: "Xóa tài khoản quản trị / Reporter",
  };
  return labels[action] || action.replaceAll("_", " ");
}

function auditTargetLabel(row: AdminAuditItem): string {
  const metadata = row.metadata || {};
  if (row.action === "BATCH_RESOLVE") {
    const result = String(metadata.resolution || "");
    const label = result === "HAS_STOCK" ? "Xác nhận Có hàng" : result === "SKIP_ALLOWED" ? "Cho phép bỏ qua" : "Xử lý báo hàng";
    return metadata.sku ? `${label} · SKU ${String(metadata.sku)}` : label;
  }
  if (row.action === "BATCH_CORRECT") return metadata.sku ? `Sửa Skip thành Có hàng · SKU ${String(metadata.sku)}` : "Sửa Skip thành Có hàng";
  const target = [row.target_type, row.target_id].filter(Boolean).join(" · ");
  return target || "—";
}

function renderLogs(): string {
  const auditPageFrom = auditTotal ? auditOffset + 1 : 0;
  const auditPageTo = Math.min(auditTotal, auditOffset + auditRows.length);
  const auditActive = logView === "AUDIT";
  return `<section class="ops-route logs-workspace">
    <div class="business-page-head"><div><h2>Nhật ký</h2><p>Log kỹ thuật và lịch sử thao tác nghiệp vụ được tách riêng để dễ tra cứu.</p></div>${!auditActive ? `<div class="user-row-actions"><button class="secondary" id="send-web-log">Gửi log Web ngay</button><button class="secondary" id="download-support-log">Tải log Web xuống</button></div>` : ""}</div>
    <div class="workspace-tabs" role="tablist" aria-label="Nguồn nhật ký">
      <button type="button" class="workspace-tab ${logView === "WEB" ? "active" : ""}" data-log-view="WEB">Log Web</button>
      <button type="button" class="workspace-tab ${logView === "ANDROID" ? "active" : ""}" data-log-view="ANDROID">Log Android</button>
      <button type="button" class="workspace-tab ${logView === "AUDIT" ? "active" : ""}" data-log-view="AUDIT">Lịch sử thao tác</button>
    </div>
    <form id="log-date-range" class="toolbar log-retention-window" style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap" aria-label="Khoảng nhật ký">
      <label>Từ ngày<input type="date" name="from" value="${esc(logFrom)}" max="${esc(dateDaysAgo(0))}" required /></label>
      <label>Đến ngày<input type="date" name="to" value="${esc(logTo)}" max="${esc(dateDaysAgo(0))}" required /></label>
      <button class="secondary" type="submit">Áp dụng</button>
      <span class="muted">Nhật ký hiện lưu tối đa 90 ngày; chỉ tải trang được yêu cầu.</span>
    </form>
    ${!auditActive && logView === "ANDROID" && profile?.role === "ROOT" && profile?.base_role === "ROOT" ? `
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Kiểm tra log Launcher trên Service</h3><p>Dành cho quản trị hệ thống. Chỉ truy vấn khi bấm nút, không tải log từ PDA và không tạo thêm lượt kiểm tra nền.</p></div>
          <button type="button" class="secondary" id="check-launcher-logs">Kiểm tra service</button>
        </div>
        ${launcherLogDiagnostics ? `
          <div class="ops-summary-grid">
            <div>HTTP POST tới service: <strong>${Number(launcherLogDiagnostics.ingress_http_attempts || 0).toLocaleString("vi-VN")}</strong></div>
            <div>HTTP gần nhất: <strong>${esc(Object.entries(launcherLogDiagnostics.ingress_http_statuses || {}).map(([status,count]) => `${status}: ${count}`).join(" · ") || "Chưa ghi nhận")}</strong></div>
            <div>Đã nhận trong 7 ngày: <strong>${Number(launcherLogDiagnostics.received || 0).toLocaleString("vi-VN")}</strong></div>
            <div>Đã xác nhận Drive: <strong>${Number(launcherLogDiagnostics.drive_synced || 0).toLocaleString("vi-VN")}</strong></div>
            <div>Đang chờ Drive: <strong>${Number(launcherLogDiagnostics.pending_drive || 0).toLocaleString("vi-VN")}</strong></div>
            <div>Chờ Drive có lỗi: <strong>${Number(launcherLogDiagnostics.pending_with_error || 0).toLocaleString("vi-VN")}</strong></div>
          </div>
          <p>Quyền thư mục Drive theo OAuth Worker: <strong>${esc(launcherLogDiagnostics.drive_folder_check?.status || "CHƯA_XÁC_MINH")}</strong>
            ${launcherLogDiagnostics.drive_folder_check?.folder_url && launcherLogDiagnostics.drive_folder_check.status === "ACCESSIBLE_WRITABLE"
              ? ` · <a href="${esc(launcherLogDiagnostics.drive_folder_check.folder_url)}" target="_blank" rel="noopener noreferrer">Mở thư mục Drive</a>` : ""}
          </p>
          <p class="muted">Theo dõi HTTP từ: ${launcherLogDiagnostics.ingress_monitor_started_at ? esc(fmt(launcherLogDiagnostics.ingress_monitor_started_at)) : "Chưa có dữ liệu"} · POST gần nhất: ${launcherLogDiagnostics.ingress_last_at ? esc(fmt(launcherLogDiagnostics.ingress_last_at)) : "Chưa có"}</p>
          <p class="muted">Log được lưu gần nhất: ${launcherLogDiagnostics.last_received_at ? esc(fmt(launcherLogDiagnostics.last_received_at)) : "Chưa có"} · Kiểm tra lúc: ${esc(fmt(launcherLogDiagnostics.checked_at))}</p>
          <p>${launcherLogDiagnostics.received === 0 ? "Service chưa ghi nhận log Launcher trong 7 ngày: kiểm tra lịch gửi, kết nối và DeviceKey trên PDA." : launcherLogDiagnostics.pending_drive > 0 ? "Service đã nhận log Launcher nhưng còn tồn đọng trước bước Drive. Kiểm tra nhóm lỗi lưu trữ bên dưới." : "Service đã nhận log; không còn log Launcher chờ Drive trong cửa sổ 7 ngày."}</p>
          <p class="muted">Nhóm lỗi gần nhất (${Number(launcherLogDiagnostics.recent_failure_sample_count || 0)} mẫu): ${Object.entries(launcherLogDiagnostics.recent_failure_classes || {}).map(([name,count]) => `${esc(name)}: ${Number(count)}`).join(" · ") || "Không ghi nhận lỗi lưu Drive"}</p>
        ` : `<p class="muted">Chưa kiểm tra. Bấm “Kiểm tra service” để đọc trạng thái thực tế.</p>`}
      </article>` : ""}
    ${auditActive ? `
      <article class="ops-panel audit-history-panel">
        <div class="ops-panel-title"><div><h3>Lịch sử thao tác Admin / Reporter / Root</h3><p>Không ghi thao tác Picker vào danh sách này. Dữ liệu được lưu tại hệ thống nghiệp vụ và phân trang giới hạn.</p></div><span>${auditPageFrom}–${auditPageTo} / ${auditTotal.toLocaleString("vi-VN")}</span></div>
        <div class="user-pagination audit-pagination-top"><span>Hiển thị ${auditPageFrom}–${auditPageTo}</span><div><button class="secondary" id="audit-prev" ${auditOffset <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="audit-next" ${auditOffset + AUDIT_PAGE_SIZE >= auditTotal ? "disabled" : ""}>Trang sau</button></div></div>
        <form id="audit-filter" class="report-filter-row audit-filter-row">
          <label>Quyền<select name="role"><option value="">Tất cả</option>${["REPORTER","ADMIN","ROOT"].map((role) => `<option value="${role}" ${auditRole === role ? "selected" : ""}>${esc(businessRoleLabel(role))}</option>`).join("")}</select></label>
          <label class="audit-query-field">Tìm kiếm<input name="query" value="${esc(auditQuery)}" placeholder="Người dùng / thao tác / đối tượng" /></label>
          <button class="secondary">Áp dụng</button>
        </form>
        <div class="table-wrap audit-table"><table><thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Quyền</th><th>Thao tác</th><th>Đối tượng / kết quả</th></tr></thead><tbody>
          ${auditRows.length ? auditRows.map((row) => `<tr><td>${esc(fmt(row.created_at))}</td><td><strong>${esc(row.actor_display_name || row.actor_employee_code || row.actor_user_id)}</strong><small>${esc(row.actor_employee_code || row.actor_user_id)}</small></td><td><span class="badge">${esc(businessRoleLabel(row.actor_role))}</span></td><td>${esc(auditActionLabel(row.action))}</td><td>${esc(auditTargetLabel(row))}</td></tr>`).join("") : `<tr><td colspan="5" class="ops-empty">Chưa có thao tác phù hợp.</td></tr>`}
        </tbody></table></div>
      </article>
    ` : `
      <div class="logs-layout">
        <article class="ops-panel log-list-panel">
          <div class="ops-panel-title"><div><h3>Log ${runtimeLogSource === "WEB" ? "Web" : "Android"} gần đây</h3><p>Trang ${runtimeLogPageIndex + 1} · tối đa ${RUNTIME_LOG_PAGE_SIZE} log/trang trong ${logDays} ngày.</p></div></div>
          <div class="log-list">${runtimeLogs.length ? runtimeLogs.map((item) => `<button type="button" class="log-row ${runtimeLogDetail?.file.id === item.id ? "selected" : ""}" data-log-file="${esc(item.id)}"><span class="log-severity ${item.severity === "ERROR" ? "error" : "info"}">${item.severity === "ERROR" ? "Lỗi" : "Định kỳ"}</span><div><strong>Nhật ký ${esc(logSourceLabel(item.source))}</strong><small>${esc(fmt(item.created_at))} · ${Math.max(1, Math.round(Number(item.size || 0) / 1024))} KB</small></div></button>`).join("") : `<div class="ops-empty">Chưa có log ${runtimeLogSource === "WEB" ? "Web" : "Android"}.</div>`}</div>
          <div class="user-pagination"><span>Trang ${runtimeLogPageIndex + 1}</span><div><button class="secondary" id="runtime-log-prev" ${runtimeLogPageIndex <= 0 ? "disabled" : ""}>Trang trước</button><button class="secondary" id="runtime-log-next" ${runtimeLogNextPageToken ? "" : "disabled"}>Trang sau</button></div></div>
        </article>
        <article class="ops-panel log-detail-panel">
          <div class="ops-panel-title"><div><h3>Tóm tắt nhật ký</h3></div></div>
          ${renderRuntimeLogSummary()}
        </article>
      </div>
    `}
  </section>`;
}

function renderLegacyLogs(): string {
  return renderLogs();
}

function renderLegacyVersions(): string {
  return renderSystem();
}

function renderSystemReset(): string {
  if (!profile || profile.role !== "ROOT" || profile.base_role !== "ROOT") {
    return `<section class="ops-route"><div class="notice danger">Chỉ ROOT thực được truy cập Đặt lại hệ thống.</div></section>`;
  }
  const counts = systemResetPreview?.counts || {};
  const relay = systemResetPreview?.confirmation_relay;
  const relayCount = relay?.status === "ok"
    ? Object.values(relay.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    : null;
  const items: Array<{ scope: SystemResetScope; title: string; detail: string; count: string; tone?: string }> = [
    { scope: "PICKER_ACCOUNTS", title: "Tài khoản Picker", detail: "Xóa Picker trong InventoryCore và Firebase Authentication. Không xóa hoặc sửa Google Sheet nhân sự.", count: Number(counts.picker_accounts || 0).toLocaleString("vi-VN") },
    { scope: "REPORTER_ACCOUNTS", title: "Tài khoản Reporter", detail: "Xóa tài khoản Reporter, phiên và thiết bị liên quan. Lịch sử báo hàng chỉ xóa khi chọn riêng mục Lịch sử.", count: Number(counts.reporter_accounts || 0).toLocaleString("vi-VN") },
    { scope: "ADMIN_ACCOUNTS", title: "Tài khoản Admin", detail: "Xóa Admin trong service, Firebase chính và Firebase alias Agent. Tài khoản ROOT luôn được giữ nguyên.", count: Number(counts.admin_accounts || 0).toLocaleString("vi-VN"), tone: "warning" },
    { scope: "SKU_MASTER", title: "Danh mục SKU", detail: "Đưa SKU Master trong service về 0. Không thay logic import và không tác động Google Sheet/Drive.", count: Number(counts.sku_master || 0).toLocaleString("vi-VN") },
    { scope: "OPEN_REPORTS", title: "Báo hàng đang xử lý", detail: "Xóa các đợt/ticket đang PENDING và dữ liệu đồng bộ liên quan; không tự xóa lịch sử đã kết thúc.", count: `${Number(counts.open_report_batches || 0).toLocaleString("vi-VN")} đợt`, tone: "warning" },
    { scope: "BUSINESS_HISTORY", title: "Lịch sử nghiệp vụ", detail: "Xóa các đợt đã kết thúc, ticket/event/ACK/realtime/archive marker trong service. File archive đã có trên Drive/Sheet không bị xóa.", count: `${Number(counts.history_batches || 0).toLocaleString("vi-VN")} đợt`, tone: "warning" },
    { scope: "SERVICE_LOGS", title: "Log kỹ thuật trong service", detail: "Xóa audit log và delivery-attempt telemetry trong InventoryCore. Không xóa file log đã lưu trên Google Drive.", count: `${Number(counts.audit_log || 0).toLocaleString("vi-VN")} audit` },
    { scope: "SESSIONS_DEVICES", title: "Phiên & thiết bị", detail: "Xóa FCM/presence và phiên Web/App của tài khoản không phải ROOT. ROOT hiện tại được bảo toàn.", count: `${Number(counts.fcm_devices || 0).toLocaleString("vi-VN")} thiết bị` },
    { scope: "RUNTIME_SETTINGS", title: "Cấu hình runtime", detail: "Đưa cấu hình SLA/app runtime và metadata kết nối nguồn nhân sự về mặc định. Không sửa/xóa nội dung Google Sheet nguồn.", count: `${Number(counts.app_config || 0) + Number(counts.hr_source_config || 0)} cấu hình`, tone: "warning" },
    { scope: "CONFIRMATION_RELAY", title: "Dữ liệu Xác nhận đơn Firestore", detail: "Xóa job/rate-limit/coordination/presence/confirmation-guard của luồng PDA ↔ Agent. Hệ thống chặn nếu còn job PENDING để tránh mất yêu cầu WMS đang chờ.", count: relayCount == null ? "Chưa đọc Firestore" : `${relayCount.toLocaleString("vi-VN")} tài liệu`, tone: "danger" },
  ];
  const allSelected = items.every((item) => systemResetSelected.has(item.scope));
  return `<section class="ops-route reset-workspace">
    <div class="business-page-head"><div><h2>Đặt lại hệ thống</h2><p>Chỉ đưa dữ liệu runtime đã chọn về 0. Không thay source code, logic nghiệp vụ, giao diện, schema, Google Sheet/Drive hoặc Stable.</p></div></div>
    <div class="notice warning"><strong>ROOT được bảo toàn tuyệt đối:</strong> tài khoản ROOT, cơ chế mật khẩu một lần/khẩn cấp, Firebase identity và email khôi phục không nằm trong phạm vi reset.</div>
    <div class="reset-toolbar">
      <label class="reset-all"><input id="reset-select-all" type="checkbox" ${allSelected ? "checked" : ""}/> <strong>Chọn toàn bộ dữ liệu runtime</strong></label>
      <button class="secondary" id="reset-refresh-preview">Cập nhật số lượng</button>
      <button class="secondary" id="reset-read-relay">Đọc số lượng Firestore</button>
    </div>
    <div class="reset-card-grid">
      ${items.map((item) => `<label class="ops-panel reset-card ${item.tone || ""}">
        <input type="checkbox" data-reset-scope="${item.scope}" ${systemResetSelected.has(item.scope) ? "checked" : ""}/>
        <span class="reset-card-copy"><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></span>
        <b>${esc(item.count)}</b>
      </label>`).join("")}
    </div>
    <article class="ops-panel reset-security-panel">
      <div class="ops-panel-title"><div><h3>Xác nhận bảo mật 2 lớp</h3><p>Bước 1 xác minh ROOT bằng mật khẩu một lần hoặc mật khẩu khẩn cấp. Bước 2 nhập mã 6 chữ số gửi tới email ROOT đã đăng ký. Mã có hiệu lực 10 phút và tối đa 5 lần thử.</p></div></div>
      <div class="ops-form-grid">
        <label class="span">Mã một lần / mật khẩu khẩn cấp ROOT<input id="reset-root-password" type="password" autocomplete="current-password" ${systemResetChallenge ? "disabled" : ""}/></label>
        ${systemResetChallenge ? `<div class="notice success span">Đã gửi mã tới ${esc(systemResetChallenge.emailHint)}. Hết hạn: ${esc(fmt(systemResetChallenge.expiresAt))}.</div>
          <label class="span">Mã xác nhận 6 chữ số<input id="reset-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" /></label>
          <div class="ops-form-actions"><button class="danger" id="reset-execute">XÁC NHẬN ĐẶT LẠI</button><button class="secondary" id="reset-cancel-challenge">Huỷ mã hiện tại</button></div>`
          : `<div class="ops-form-actions"><button class="danger" id="reset-request-code" ${systemResetSelected.size ? "" : "disabled"}>XÁC MINH MẬT KHẨU & GỬI MÃ</button></div>`}
      </div>
    </article>
    <div class="system-limit-box"><strong>Không bị tác động</strong><div>Tài khoản ROOT, cơ chế xác thực ROOT và email ROOT; Google Sheet nhân sự; dữ liệu Google Drive; mã nguồn GitHub; cấu trúc dữ liệu; logic, giao diện và kịch bản; Stable; tài khoản WMS.</div></div>
  </section>`;
}

function renderTools(): string {
  const pdaStableUrl = `${window.location.origin}${pdaAppRelease?.stable_download_path || "/downloads/pda/latest"}`;
  const agentStableUrl = `${window.location.origin}${agentAppRelease?.stable_download_path || "/downloads/agent/latest"}`;
  return `<section class="ops-route tools-workspace">
    <div class="heading">
      <div><h2>Công cụ</h2><p class="muted">Hai kênh cài đặt chính thức cho thiết bị vận hành.</p></div>
    </div>
    <div class="tools-grid tools-grid-d112">
      <article class="ops-panel tool-card tool-card-primary pda-tool-card">
        <div class="tool-card-head">
          <img class="tool-icon-image" src="/app-icon.png" alt="" aria-hidden="true" />
          <div><h3>App PDA</h3><p>Android · Picker / Reporter</p></div>
        </div>
        <div class="pda-tool-body">
          <div class="pda-qr-shell">${pdaQrDataUrl ? `<img src="${pdaQrDataUrl}" alt="QR tải App PDA mới nhất" />` : `<div class="pda-qr-loading">Đang tạo QR…</div>`}<small>Quét để tải bản mới nhất</small></div>
          <div class="pda-release-info">
            <div class="tool-facts">
              <div><span>Phiên bản</span><strong>${esc(pdaAppRelease?.tag || "Đang tải…")}</strong></div>
              <div><span>Nền tảng</span><strong>Android 11+</strong></div>
              <div><span>Dung lượng</span><strong>${pdaAppRelease ? fmtBytes(pdaAppRelease.size_bytes) : "—"}</strong></div>
              <div><span>Phát hành</span><strong>${pdaAppRelease?.published_at ? esc(fmt(pdaAppRelease.published_at)) : "—"}</strong></div>
              <div><span>Kênh cập nhật</span><strong class="tool-channel-ok">Beta · hoạt động</strong></div>
            </div>
            <div class="tool-actions">
              <a class="primary tool-download" href="${esc(pdaStableUrl)}">Tải App PDA</a>
              <button type="button" class="secondary" id="copy-pda-link">Sao chép link</button>
            </div>
          </div>
        </div>
      </article>

      <article class="ops-panel tool-card">
        <div class="tool-card-head">
          <img class="tool-icon-image" src="/app-icon.png" alt="" aria-hidden="true" />
          <div><h3>Agent Windows</h3><p>Agent Auto Confirm Pick Pack</p></div>
        </div>
        <div class="tool-facts">
          <div><span>Phiên bản</span><strong>${esc(agentAppRelease?.tag || "Đang tải…")}</strong></div>
          <div><span>Nền tảng</span><strong>Windows · quyền User</strong></div>
          <div><span>Dung lượng</span><strong>${agentAppRelease ? fmtBytes(agentAppRelease.size_bytes) : "—"}</strong></div>
          <div><span>Phát hành</span><strong>${agentAppRelease?.published_at ? esc(fmt(agentAppRelease.published_at)) : "—"}</strong></div>
          <div><span>Kênh cập nhật</span><strong class="tool-channel-ok">Beta · hoạt động</strong></div>
        </div>
        <div class="tool-actions">
          <a class="primary tool-download" href="${esc(agentStableUrl)}">Tải Agent</a>
          <button type="button" class="secondary" id="copy-agent-link">Sao chép link</button>
        </div>
      </article>
    </div>
    <article class="ops-panel tool-guide tool-guide-d112">
      <div class="ops-panel-title"><div><h3>Hướng dẫn cài đặt</h3><p>App: quét QR hoặc tải APK, xác nhận cài đặt khi Android yêu cầu. Agent: tải EXE và chạy bằng tài khoản Windows hiện tại; sau khi đăng nhập ADMIN, Agent tự duy trì và tự kiểm tra cập nhật.</p></div></div>
    </article>
  </section>`;
}

function renderMealStatusCard(period: "LUNCH" | "DINNER"): string {
  const record = period === "LUNCH" ? d167MealState?.lunch : d167MealState?.dinner;
  const title = period === "LUNCH" ? "Nghỉ trưa" : "Nghỉ tối";
  const early = period === "LUNCH" ? "11:00–11:30" : "18:00–18:30";
  const late = period === "LUNCH" ? "11:30–12:00" : "18:30–19:00";
  const selected = record?.choice === "EARLY" ? early : late;
  return `<article class="ops-panel d167-meal-card">
    <div class="ops-panel-title"><div><h3>${title}</h3><p>${period === "LUNCH" ? "Nhắc Reporter lúc 10:55" : "Nhắc Reporter lúc 17:55"} (giờ Việt Nam)</p></div>
      <span class="badge ${record ? "good" : "warning"}">${record ? "Đã xác nhận" : "Chưa xác nhận"}</span></div>
    ${record ? `<div class="ops-note"><strong>${esc(selected)}</strong> · ${esc(record.confirmed_name || "Reporter")} xác nhận lúc ${esc(fmt(record.confirmed_at))}</div>` :
      `<div class="ops-note">Nếu chưa ai xác nhận, Service tạm dừng tự động Skip trong toàn bộ ${period === "LUNCH" ? "11:00–12:00" : "18:00–19:00"} để phòng ngừa Skip sai. Reporter vẫn xử lý thủ công bình thường.</div>`}
    <form class="d167-meal-form" data-d167-meal-form="${period}" style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:14px">
      <label><span>Giờ nghỉ</span><select name="choice" ${record ? "disabled" : ""}>
        <option value="EARLY">${early}</option><option value="LATE">${late}</option>
      </select></label>
      <button class="primary" ${record || !roleCanResolve() || !(period === "LUNCH" ? d167MealState?.lunch_prompt_due : d167MealState?.dinner_prompt_due) ? "disabled" : ""}>Xác nhận giờ nghỉ</button>
    </form>
  </article>`;
}

function renderD167MealOverlay(): string {
  if (!roleCanResolve() || !d167MealState) return "";
  const period = d167MealState.lunch_prompt_due ? "LUNCH" : d167MealState.dinner_prompt_due ? "DINNER" : null;
  if (!period) return "";
  const first = period === "LUNCH" ? "11:00–11:30" : "18:00–18:30";
  const second = period === "LUNCH" ? "11:30–12:00" : "18:30–19:00";
  return `<div class="modal d167-meal-overlay" role="dialog" aria-modal="true" aria-label="Xác nhận giờ nghỉ">
    <div class="modal-box" style="max-width:520px;text-align:left">
      <p class="muted">CA VẬN HÀNH · ${esc(d167MealState.day_vn)}</p>
      <h2>Chọn giờ ${period === "LUNCH" ? "nghỉ trưa" : "nghỉ tối"}</h2>
      <p>Vui lòng xác nhận khoảng nghỉ của đội Reporter. Trong khoảng đã xác nhận, hệ thống chỉ tạm dừng <strong>đồng hồ tự động Skip</strong>; xử lý báo hàng thủ công vẫn bình thường.</p>
      <form id="d167-meal-overlay-form" data-period="${period}">
        <label class="sla-radio-row"><input type="radio" name="choice" value="EARLY" required checked/><span><strong>${first}</strong></span></label>
        <label class="sla-radio-row"><input type="radio" name="choice" value="LATE" required/><span><strong>${second}</strong></span></label>
        <div class="modal-actions"><button type="submit" class="primary">Xác nhận giờ nghỉ</button></div>
      </form>
      <p class="muted">Chỉ xác nhận đầu tiên hợp lệ được ghi nhận. Các Reporter khác sẽ tự đóng thông báo.</p>
    </div></div>`;
}

function renderShiftOperations(): string {
  const state = androidAlertWindow;
  const status = state == null
    ? "Đang tải trạng thái…"
    : state.is_open
      ? (state.early_start_open ? "Đang bật sớm" : state.overtime_open ? "Đang tăng ca" : "Trong ca vận hành")
      : "Replay/PDA đang nghỉ";
  const sharedUntil = state?.projection_open_until_ms
    ? new Date(state.projection_open_until_ms).toLocaleString("vi-VN", { hour12: false })
    : "Không có gia hạn";
  const decision = state?.decision === "EARLY_START"
    ? "Bật sớm"
    : state?.decision === "MANUAL_ADJUST"
      ? "Điều chỉnh tăng ca"
      : state?.decision === "CONTINUE"
        ? "Gia hạn +1 giờ"
        : state?.decision === "STOP"
          ? "Đúng giờ về"
          : state?.decision === "CANCEL_OVERTIME"
            ? "Đã huỷ tăng ca"
            : "Theo lịch mặc định";
  return `<section class="ops-route tools-workspace">
    <div class="business-page-head"><div><h2>Ca vận hành</h2><p>Trạng thái dùng chung từ Agent cho Web, Báo hàng và PickList. Web chỉ hiển thị authority hiện hành.</p></div></div>
    <section class="business-summary-grid">
      <article class="business-summary-card primary"><span>Ca bình thường</span><strong>06:00–22:00</strong><small>Cửa sổ kỹ thuật Replay · 05:45–22:15</small></article>
      <article class="business-summary-card ${state?.is_open ? "good" : ""}"><span>Trạng thái hiện tại</span><strong>${esc(status)}</strong><small>Cùng trạng thái với App/PDA</small></article>
      <article class="business-summary-card ${state?.overtime_open || state?.early_start_open ? "warning" : ""}"><span>State chia sẻ đến</span><strong>${esc(sharedUntil)}</strong><small>${esc(decision)}</small></article>
    </section>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Authority ca</h3><p>Agent là nơi quyết định. Agent nào chốt hợp lệ trước tại cùng boundary thì lệnh đó thắng và cả fleet dùng chung.</p></div></div>
      <div class="ops-note">Ca bình thường 06:00–22:00. Cửa sổ kỹ thuật Replay hoạt động 05:45–22:15; nếu không có gia hạn thì chuyển SLEEP lúc 22:15. Sau 22:15, Agent có thể Gia hạn +1 giờ; cảnh báo T-15 áp dụng cho mốc tăng ca đang hoạt động; tối đa đến 05:00. Từ 05:00–05:45 có thể Bật sớm tại Agent.</div>
    </article>
    <div class="business-page-head"><div><h2>Giờ nghỉ ăn · tạm dừng tự động Skip</h2><p>Hai lựa chọn mỗi buổi, đồng bộ toàn bộ Reporter; xác nhận một lần, không tác động thao tác thủ công.</p></div></div>
    <div class="ops-grid-two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px">
      ${renderMealStatusCard("LUNCH")}
      ${renderMealStatusCard("DINNER")}
    </div>
  </section>`;
}

function renderAccount(): string {
  const recoveryEmailAllowed = profile?.base_role === "ROOT" || profile?.base_role === "ADMIN";
  const oneTime = privilegedOneTimeProfile(profile);
  return `<section class="ops-route account-workspace">
    <div class="heading"><div><h2>Tài khoản</h2></div></div>
    <div class="account-grid">
      ${!oneTime ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Đổi mật khẩu</h3></div></div><form id="password-form" class="ops-form-grid"><label class="span">Mật khẩu hiện tại<input name="current" type="password" required /></label><label class="span">Mật khẩu mới<input name="next" type="password" required /></label><div class="ops-form-actions"><button class="primary">Đổi mật khẩu</button></div></form></article>` : ""}
      ${recoveryEmailAllowed ? `<article class="ops-panel"><div class="ops-panel-title"><div><h3>Email khôi phục</h3><p>Dùng để nhận thông tin xác minh và khôi phục tài khoản khi được hỗ trợ.</p></div></div><form id="auth-email-form" class="ops-form-grid"><label class="span">Email đăng ký<input name="email" type="email" autocomplete="email" required value="${esc(profile?.auth_email || "")}" /></label><div class="ops-form-actions"><button class="primary">Lưu email</button></div></form></article>` : ""}
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

async function loadReporterQueueSnapshot(): Promise<void> {
  const requestGeneration = ++reporterQueueLoadGeneration;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const queue = await loadCompleteReporterQueue();
  if (
    requestGeneration !== reporterQueueLoadGeneration ||
    generation !== sessionViewGeneration ||
    userId !== (profile?.user_id || "")
  ) return;
  const serverNow = queue.server_now ? Date.parse(queue.server_now) : NaN;
  queueServerOffsetMs = Number.isFinite(serverNow) ? serverNow - Date.now() : queueServerOffsetMs;
  queueRows = queue.items;
  queueBadgeCount = Math.max(0, Number(queue.total || queue.items.length));
  queueBadgeInitialized = true;
  syncOperationsNavBadge();
  syncOperationalTabBadges();
  if (selectedBatchId && !queueRows.some((row) => row.batch_id === selectedBatchId)) selectedBatchId = null;
  const selected = queueRows.find((row) => row.batch_id === selectedBatchId) || filteredQueueRows()[0] || queueRows[0];
  if (selected) {
    selectedBatchId = selected.batch_id;
    prefetchBatchDetails(selected.batch_id);
  }
  markWebUpdateReceived();
}

async function loadReporterTabCounters(force = false): Promise<void> {
  if (!roleOperate() || ((queueBadgeInitialized && overdueBadgeInitialized && recentBadgeInitialized) && !force)) return;
  const requestGeneration = ++reporterBadgeLoadGeneration;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const recentStatus = recentFilter === "ALL" ? "" : recentFilter;
  const range = apiRange(recentFrom, recentTo);
  const counters = await getReporterCounters(recentStatus, range.from, range.to);
  if (
    requestGeneration !== reporterBadgeLoadGeneration ||
    generation !== sessionViewGeneration ||
    userId !== (profile?.user_id || "")
  ) return;
  queueBadgeCount = Math.max(0, Number(counters.queue_total || 0));
  perPickerOverdueEnabled = Boolean(counters.auto_skip_enabled && counters.auto_skip_mode === "PER_PICKER");
  overdueBadgeCount = perPickerOverdueEnabled ? Math.max(0, Number(counters.overdue_total || 0)) : 0;
  recentBadgeCount = Math.max(0, Number(counters.recent_total || 0));
  resultTabBadgeCounts = {
    HAS_STOCK: Math.max(0, Number(counters.has_stock_total || 0)),
    SKIP_ALLOWED: Math.max(0, Number(counters.skip_allowed_total || 0)),
    CLOSED: Math.max(0, Number(counters.withdrawn_total || 0)),
  };
  queueBadgeInitialized = true;
  overdueBadgeInitialized = true;
  recentBadgeInitialized = true;
  syncOperationsNavBadge();
  syncOperationalTabBadges();
  markWebUpdateReceived();
}

type RecentCounterEndpoint = {
  status: "HAS_STOCK" | "SKIP_ALLOWED" | "CLOSED" | null;
  at: string | null;
};

function recentCounterEndpoint(statusValue: unknown, atValue: unknown): { valid: boolean; endpoint: RecentCounterEndpoint } {
  if (statusValue == null && atValue == null) return { valid: true, endpoint: { status: null, at: null } };
  const status = String(statusValue || "").trim().toUpperCase();
  const at = String(atValue || "").trim();
  if (!["HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(status) || !at || !Number.isFinite(Date.parse(at))) {
    return { valid: false, endpoint: { status: null, at: null } };
  }
  return { valid: true, endpoint: { status: status as RecentCounterEndpoint["status"], at } };
}

function recentCounterMatches(endpoint: RecentCounterEndpoint): boolean {
  if (!endpoint.status || !endpoint.at) return false;
  if (recentFilter !== "ALL" && endpoint.status !== recentFilter) return false;
  const atMs = Date.parse(endpoint.at);
  const range = apiRange(recentFrom, recentTo);
  return atMs >= Date.parse(range.from) && atMs < Date.parse(range.to);
}

function applyReporterRecentBadgeEvents(events: RealtimeEventFrame[]): boolean {
  if (!roleOperate() || !recentBadgeInitialized) return false;
  const recentMutationEvents = new Set([
    "REPORT_WITHDRAWN",
    "BATCH_RESOLVED",
    "BATCH_CORRECTED",
    "TICKET_AUTO_SKIP_ALLOWED",
    "BATCH_AUTO_SKIP_ALLOWED",
  ]);
  let next = recentBadgeCount;
  const nextTabs = { ...resultTabBadgeCounts };
  for (const row of events) {
    if (!(row.scopes || []).includes("reporter_recent")) continue;
    const eventName = String(row.event || "").trim().toUpperCase();
    if (eventName === "RESULT_ACKNOWLEDGED") continue;
    if (!recentMutationEvents.has(eventName)) continue;
    const transition = row.metadata?.recent_counter;
    if (!transition || typeof transition !== "object" || Array.isArray(transition)) return false;
    const values = transition as Record<string, unknown>;
    const before = recentCounterEndpoint(values.before_status, values.before_at);
    const after = recentCounterEndpoint(values.after_status, values.after_at);
    if (!before.valid || !after.valid) return false;
    next += (recentCounterMatches(after.endpoint) ? 1 : 0) - (recentCounterMatches(before.endpoint) ? 1 : 0);
    // Every inactive tab remains realtime on the same authoritative delta.
    if (before.endpoint.status && before.endpoint.at && recentDateRangeContains(before.endpoint.at))
      nextTabs[before.endpoint.status] -= 1;
    if (after.endpoint.status && after.endpoint.at && recentDateRangeContains(after.endpoint.at))
      nextTabs[after.endpoint.status] += 1;
  }
  recentBadgeCount = Math.max(0, next);
  resultTabBadgeCounts = {
    HAS_STOCK: Math.max(0, nextTabs.HAS_STOCK),
    SKIP_ALLOWED: Math.max(0, nextTabs.SKIP_ALLOWED),
    CLOSED: Math.max(0, nextTabs.CLOSED),
  };
  syncOperationalTabBadges();
  return true;
}

function applyReporterQueueBadgeEvents(events: RealtimeEventFrame[]): boolean {
  if (!roleOperate() || !queueBadgeInitialized) return false;
  const queueMutationEvents = new Set([
    "REPORT_CREATED",
    "REPORT_WITHDRAWN",
    "BATCH_RESOLVED",
    "TICKET_AUTO_SKIP_ALLOWED",
    "BATCH_AUTO_SKIP_ALLOWED",
  ]);
  let next = queueBadgeCount;
  for (const row of events) {
    if (!(row.scopes || []).includes("reporter_queue")) continue;
    const eventName = String(row.event || "").trim().toUpperCase();
    if (!queueMutationEvents.has(eventName)) continue;
    const delta = Number(row.metadata?.queue_delta);
    if (!Number.isInteger(delta) || delta < -1 || delta > 1) return false;
    next = Math.max(0, next + delta);
  }
  queueBadgeCount = next;
  syncOperationsNavBadge();
  return true;
}


function applyReporterOverdueBadgeEvents(events: RealtimeEventFrame[]): boolean {
  if (!roleOperate() || !overdueBadgeInitialized) return false;
  if (!perPickerOverdueEnabled) {
    overdueBadgeCount = 0;
    syncOperationalTabBadges();
    return true;
  }
  let next = overdueBadgeCount;
  for (const row of events) {
    if (!(row.scopes || []).includes("reporter_overdue")) continue;
    const eventName = String(row.event || "").trim().toUpperCase();
    const raw = row.metadata?.overdue_delta;
    // Withdrawing a still-waiting Picker can change the overdue row's waiting
    // count without changing whether that SKU exists in Quá hạn.
    if (raw == null && eventName === "REPORT_WITHDRAWN") continue;
    const delta = Number(raw);
    if (!Number.isInteger(delta) || delta < -1 || delta > 1) return false;
    next = Math.max(0, next + delta);
  }
  overdueBadgeCount = next;
  syncOperationalTabBadges();
  return true;
}

function realtimeSnapshotRecord(event: RealtimeEventFrame): Record<string, unknown> | null {
  const value = event.snapshot;
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function snapshotText(snapshot: Record<string, unknown>, key: string): string {
  return String(snapshot[key] ?? "").trim();
}

function snapshotNumber(snapshot: Record<string, unknown>, key: string): number {
  const value = Number(snapshot[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function replaceByBatch<T extends { batch_id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((item) => item.batch_id === row.batch_id);
  if (index < 0) return [...rows, row];
  const next = rows.slice();
  next[index] = row;
  return next;
}

function queueRowFromSnapshot(snapshot: Record<string, unknown>): ReporterBatch | null {
  if (snapshotText(snapshot, "status") !== "PENDING") return null;
  const waiting = snapshotNumber(snapshot, "waiting_picker_count") || snapshotNumber(snapshot, "open_ticket_count");
  if (waiting < 1) return null;
  const firstReportAt = snapshotText(snapshot, "first_report_at");
  const mode = normalizeAutoSkipMode(snapshot.auto_skip_mode);
  return {
    batch_id: snapshotText(snapshot, "batch_id"),
    sku: snapshotText(snapshot, "sku"),
    product_name: snapshotText(snapshot, "product_name"),
    status: "PENDING",
    first_report_at: firstReportAt,
    last_report_at: snapshotText(snapshot, "last_report_at") || null,
    affected_picker_count: waiting,
    earliest_ticket_at: snapshotText(snapshot, "earliest_ticket_at") || firstReportAt,
    version: snapshotNumber(snapshot, "version"),
    previous_batch_id: snapshotText(snapshot, "previous_batch_id") || null,
    previous_resolved_at: snapshotText(snapshot, "previous_resolved_at") || null,
    recurrence_minutes: snapshot.recurrence_minutes == null ? null : snapshotNumber(snapshot, "recurrence_minutes"),
    sla_state: (["UNCONFIGURED","NORMAL","WARNING","ESCALATED"].includes(snapshotText(snapshot, "sla_state"))
      ? snapshotText(snapshot, "sla_state")
      : "UNCONFIGURED") as SlaState,
    waiting_minutes: snapshotNumber(snapshot, "waiting_minutes"),
    warning_at: snapshotText(snapshot, "warning_at") || null,
    escalation_at: snapshotText(snapshot, "escalation_at") || null,
    auto_skip_enabled: snapshot.auto_skip_enabled === true,
    auto_skip_mode: mode,
    auto_skip_at: snapshotText(snapshot, "auto_skip_at") || null,
  };
}

function overdueRowFromSnapshot(snapshot: Record<string, unknown>): ReporterOverdueBatch | null {
  if (snapshotText(snapshot, "status") !== "PENDING") return null;
  const overdue = snapshotNumber(snapshot, "overdue_picker_count") || snapshotNumber(snapshot, "overdue_ticket_count");
  if (overdue < 1) return null;
  const firstOverdueAt = snapshotText(snapshot, "first_overdue_at");
  return {
    batch_id: snapshotText(snapshot, "batch_id"),
    sku: snapshotText(snapshot, "sku"),
    product_name: snapshotText(snapshot, "product_name"),
    status: "PENDING",
    first_report_at: snapshotText(snapshot, "first_report_at"),
    last_report_at: snapshotText(snapshot, "last_report_at") || null,
    version: snapshotNumber(snapshot, "version"),
    previous_batch_id: snapshotText(snapshot, "previous_batch_id") || null,
    overdue_picker_count: overdue,
    waiting_picker_count: snapshotNumber(snapshot, "waiting_picker_count") || snapshotNumber(snapshot, "open_ticket_count"),
    first_overdue_at: firstOverdueAt,
    latest_overdue_at: snapshotText(snapshot, "latest_overdue_at") || firstOverdueAt,
  };
}

function recentEffectiveAt(snapshot: Record<string, unknown>, event: RealtimeEventFrame): string {
  return snapshotText(snapshot, "resolved_at") || snapshotText(snapshot, "updated_at") || String(event.server_time || "");
}

function recentRowFromSnapshot(snapshot: Record<string, unknown>): ReporterRecentBatch | null {
  const status = snapshotText(snapshot, "status");
  if (!["HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(status)) return null;
  return {
    batch_id: snapshotText(snapshot, "batch_id"),
    sku: snapshotText(snapshot, "sku"),
    product_name: snapshotText(snapshot, "product_name"),
    status: status as ReporterRecentBatch["status"],
    first_report_at: snapshotText(snapshot, "first_report_at"),
    last_report_at: snapshotText(snapshot, "last_report_at") || null,
    resolved_at: snapshotText(snapshot, "resolved_at") || null,
    resolved_by_user_id: snapshotText(snapshot, "resolved_by_user_id") || null,
    resolved_by_display_name: snapshotText(snapshot, "resolved_by_display_name") || null,
    resolved_by_employee_code: snapshotText(snapshot, "resolved_by_employee_code") || null,
    resolution: (["HAS_STOCK","SKIP_ALLOWED"].includes(snapshotText(snapshot, "resolution"))
      ? snapshotText(snapshot, "resolution")
      : null) as ReporterRecentBatch["resolution"],
    resolution_source: snapshotText(snapshot, "resolution_source") || null,
    correction_deadline_at: snapshotText(snapshot, "correction_deadline_at") || null,
    correction_allowed: snapshot["correction_allowed"] === true,
    affected_picker_count: snapshotNumber(snapshot, "affected_picker_count"),
    version: snapshotNumber(snapshot, "version"),
    previous_batch_id: snapshotText(snapshot, "previous_batch_id") || null,
    previous_resolved_at: snapshotText(snapshot, "previous_resolved_at") || null,
    ack_target_count: snapshotNumber(snapshot, "ack_target_count"),
    acknowledged_count: snapshotNumber(snapshot, "acknowledged_count"),
  };
}

function recentDateRangeContains(at: string): boolean {
  if (!at || !Number.isFinite(Date.parse(at))) return false;
  const range = apiRange(recentFrom, recentTo);
  const ms = Date.parse(at);
  return ms >= Date.parse(range.from) && ms < Date.parse(range.to);
}

function recentRangeContains(status: ReporterRecentBatch["status"], at: string): boolean {
  return recentDateRangeContains(at) && (recentFilter === "ALL" || recentFilter === status);
}

function adjustRecentOutcomeTotal(status: string | null, delta: number, automatic = false): void {
  if (!status || !delta) return;
  if (status === "HAS_STOCK") recentTotals.has_stock = Math.max(0, recentTotals.has_stock + delta);
  if (status === "SKIP_ALLOWED") {
    recentTotals.skip_allowed = Math.max(0, recentTotals.skip_allowed + delta);
    if (automatic) recentTotals.automatic_skipped = Math.max(0, recentTotals.automatic_skipped + delta);
  }
  if (status === "CLOSED") recentTotals.withdrawn = Math.max(0, recentTotals.withdrawn + delta);
}

function applyReporterSnapshotEvents(events: RealtimeEventFrame[]): {
  queueExact: boolean;
  overdueExact: boolean;
  recentExact: boolean;
} {
  let queueExact = true;
  let overdueExact = true;
  let recentExact = true;

  for (const event of events) {
    const scopes = new Set(event.scopes || []);
    const touchesQueue = scopes.has("reporter_queue");
    const touchesOverdue = scopes.has("reporter_overdue");
    const touchesRecent = scopes.has("reporter_recent");
    if (!touchesQueue && !touchesOverdue && !touchesRecent) continue;

    const snapshot = realtimeSnapshotRecord(event);
    const batchId = snapshot ? snapshotText(snapshot, "batch_id") : String(event.batch_id || "");
    if (!snapshot || !batchId) {
      if (touchesQueue) queueExact = false;
      if (touchesOverdue) overdueExact = false;
      if (touchesRecent) recentExact = false;
      continue;
    }

    if (touchesQueue) {
      const row = queueRowFromSnapshot(snapshot);
      queueRows = row
        ? replaceByBatch(queueRows, row).sort((a, b) => a.first_report_at.localeCompare(b.first_report_at) || a.batch_id.localeCompare(b.batch_id))
        : queueRows.filter((item) => item.batch_id !== batchId);
      if (selectedBatchId === batchId && !row && activeSection === "operations") {
        selectedBatchId = filteredQueueRows()[0]?.batch_id || null;
      }
    }

    if (touchesOverdue) {
      const row = overdueRowFromSnapshot(snapshot);
      overdueRows = row
        ? replaceByBatch(overdueRows, row).sort((a, b) => a.first_overdue_at.localeCompare(b.first_overdue_at) || a.batch_id.localeCompare(b.batch_id))
        : overdueRows.filter((item) => item.batch_id !== batchId);
    }

    if (touchesRecent) {
      // Non-first pages can shift when a new/removed result arrives. Snapshot data
      // is exact for the batch but not enough to preserve an arbitrary page window.
      if (recentOffset > 0) {
        recentExact = false;
        continue;
      }

      const beforeRow = recentRows.find((item) => item.batch_id === batchId) || null;
      const transition = event.metadata?.recent_counter;
      if (transition && typeof transition === "object" && !Array.isArray(transition)) {
        const values = transition as Record<string, unknown>;
        const before = recentCounterEndpoint(values.before_status, values.before_at);
        const after = recentCounterEndpoint(values.after_status, values.after_at);
        if (!before.valid || !after.valid) {
          recentExact = false;
        } else {
          const beforeInRange = before.endpoint.status && before.endpoint.at
            ? recentDateRangeContains(before.endpoint.at)
            : false;
          const afterInRange = after.endpoint.status && after.endpoint.at
            ? recentDateRangeContains(after.endpoint.at)
            : false;
          const automaticAfter = snapshotText(snapshot, "resolution_source") === "SYSTEM_TIMEOUT";
          if (beforeInRange) adjustRecentOutcomeTotal(before.endpoint.status, -1, beforeRow?.resolution_source === "SYSTEM_TIMEOUT");
          if (afterInRange) adjustRecentOutcomeTotal(after.endpoint.status, 1, automaticAfter);

          if (beforeInRange && beforeRow) {
            recentTotals.ack_target_count = Math.max(0, recentTotals.ack_target_count - Number(beforeRow.ack_target_count || 0));
            recentTotals.acknowledged_count = Math.max(0, recentTotals.acknowledged_count - Number(beforeRow.acknowledged_count || 0));
          } else if (beforeInRange && !beforeRow) {
            // A correction/removal outside the loaded first page cannot safely
            // update aggregate ACK totals from a batch-local snapshot.
            recentExact = false;
          }
        }
      }

      const row = recentRowFromSnapshot(snapshot);
      const effectiveAt = row ? recentEffectiveAt(snapshot, event) : "";
      const matches = row ? recentRangeContains(row.status, effectiveAt) : false;
      if (row && matches) {
        recentRows = replaceByBatch(recentRows, row)
          .sort((a, b) => {
            const aAt = Date.parse(a.resolved_at || a.first_report_at);
            const bAt = Date.parse(b.resolved_at || b.first_report_at);
            return bAt - aAt || b.batch_id.localeCompare(a.batch_id);
          })
          .slice(0, RECENT_PAGE_SIZE);
        if (!beforeRow) {
          recentTotals.ack_target_count += Number(row.ack_target_count || 0);
          recentTotals.acknowledged_count += Number(row.acknowledged_count || 0);
        } else {
          recentTotals.ack_target_count = Math.max(0, recentTotals.ack_target_count + Number(row.ack_target_count || 0) - Number(beforeRow.ack_target_count || 0));
          recentTotals.acknowledged_count = Math.max(0, recentTotals.acknowledged_count + Number(row.acknowledged_count || 0) - Number(beforeRow.acknowledged_count || 0));
        }
      } else {
        recentRows = recentRows.filter((item) => item.batch_id !== batchId);
      }

    }
  }

  return { queueExact, overdueExact, recentExact };
}

async function loadReporterOverdueSnapshot(): Promise<void> {
  const requestGeneration = ++reporterOverdueLoadGeneration;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const overdue = await getReporterOverdue(200, 0);
  if (
    requestGeneration !== reporterOverdueLoadGeneration ||
    generation !== sessionViewGeneration ||
    userId !== (profile?.user_id || "")
  ) return;
  overdueRows = overdue.items;
  overdueBadgeCount = Math.max(0, Number(overdue.total || overdue.items.length));
  overdueBadgeInitialized = true;
  perPickerOverdueEnabled = Boolean(overdue.enabled && overdue.auto_skip_mode === "PER_PICKER");
  syncOperationalTabBadges();
  markWebUpdateReceived();
}

async function loadReporterRecentSnapshot(): Promise<void> {
  const requestGeneration = ++reporterRecentLoadGeneration;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const recentStatus = recentFilter === "ALL" ? "" : recentFilter;
  const recent = await getReporterRecent(
    RECENT_PAGE_SIZE,
    recentOffset,
    recentStatus,
    apiRange(recentFrom, recentTo).from,
    apiRange(recentFrom, recentTo).to,
  );
  if (
    requestGeneration !== reporterRecentLoadGeneration ||
    generation !== sessionViewGeneration ||
    userId !== (profile?.user_id || "")
  ) return;
  if (recent.total > 0 && recentOffset >= recent.total) {
    recentOffset = Math.max(0, Math.floor((recent.total - 1) / RECENT_PAGE_SIZE) * RECENT_PAGE_SIZE);
    return loadReporterRecentSnapshot();
  }
  recentRows = recent.items;
  recentTotal = recent.total;
  recentBadgeCount = Math.max(0, Number(recent.total || 0));
  recentBadgeInitialized = true;
  recentTotals = recent.totals;
  syncOperationalTabBadges();
  markWebUpdateReceived();
}

async function loadOperationsSnapshot(): Promise<void> {
  if (activeSection === "results") {
    const tasks: Promise<void>[] = [loadReporterRecentSnapshot()];
    if (!queueBadgeInitialized || !overdueBadgeInitialized) tasks.push(loadReporterTabCounters());
    await Promise.all(tasks);
    return;
  }
  if (activeSection === "overdue") {
    const tasks: Promise<void>[] = [loadReporterOverdueSnapshot()];
    if (!queueBadgeInitialized || !recentBadgeInitialized) tasks.push(loadReporterTabCounters());
    await Promise.all(tasks);
    return;
  }
  const tasks: Promise<void>[] = [loadReporterQueueSnapshot()];
  if (!recentBadgeInitialized || !overdueBadgeInitialized) tasks.push(loadReporterTabCounters());
  await Promise.all(tasks);
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
  const [reports, results] = await Promise.all([
    getPickerReportsV2(PICKER_REPORT_PAGE_SIZE, pickerReportOffset, "APP_TODAY_OPEN"),
    getPickerResultsV2(120),
  ]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  if (reports.total > 0 && pickerReportOffset >= reports.total) {
    pickerReportOffset = Math.max(0, Math.floor((reports.total - 1) / PICKER_REPORT_PAGE_SIZE) * PICKER_REPORT_PAGE_SIZE);
    return loadPicker();
  }
  pickerReports = reports.items;
  pickerReportTotal = reports.total;
  pickerResults = results.items;
  markWebUpdateReceived();
  for (const result of pickerResults.filter((row) => !row.acknowledged_at && !markedResultEvents.has(row.result_event_id))) {
    markedResultEvents.add(result.result_event_id);
    void markPickerResult(result.result_event_id, result.batch_id, result.batch_version, "RECEIVED")
      .catch(() => markedResultEvents.delete(result.result_event_id));
  }
}

function patchSlaInsightCounts(): void {
  if (activeSection !== "sla" || !slaResponse?.sla) return;
  const warning = document.querySelector<HTMLElement>("#sla-warning-count");
  const escalated = document.querySelector<HTMLElement>("#sla-escalated-count");
  if (warning) warning.textContent = slaResponse.sla.warning_enabled
    ? String(Number(operationalInsights?.sla?.warning_count || 0))
    : "Tắt";
  if (escalated) escalated.textContent = slaResponse.sla.escalation_enabled
    ? String(Number(operationalInsights?.sla?.escalated_count || 0))
    : "Tắt";
}

async function saveSlaConfiguration(form: HTMLFormElement): Promise<void> {
  if (slaSaveBusy) {
    setNotice("warning", "Cấu hình thời gian đang được lưu. Vui lòng chờ kết quả hiện tại.");
    return;
  }
  if (!onlineForMutation()) {
    setNotice("error", "Cần kết nối mạng để lưu cấu hình thời gian xử lý.");
    return;
  }

  const data = new FormData(form);
  const warning = Number(data.get("warning"));
  const warningEnabled = data.get("warningEnabled") === "on";
  const escalation = Number(data.get("escalation"));
  const escalationEnabled = data.get("escalationEnabled") === "on";
  const autoSkip = Number(data.get("autoSkip"));
  const autoSkipEnabled = data.get("autoSkipEnabled") === "on";
  const checkedMode = form.querySelector<HTMLInputElement>('input[name="autoSkipMode"]:checked');
  const requestedMode = normalizeAutoSkipMode(checkedMode?.value || slaDraftMode || data.get("autoSkipMode"));
  const skipToStockEnabled = data.get("skipToStockEnabled") === "on";
  const skipToStockMinutes = Number(data.get("skipToStockMinutes"));

  if (!requestedMode) {
    setNotice("error", "Cách tính mốc tự động bắt buộc phải chọn đúng 1 phương án.");
    return;
  }
  slaDraftMode = requestedMode;
  slaFormDirty = true;
  patchSlaDraftIndicator();

  if (
    !Number.isInteger(warning) ||
    !Number.isInteger(escalation) ||
    !Number.isInteger(autoSkip) ||
    !Number.isInteger(skipToStockMinutes) ||
    warning < 1 ||
    warning > 1440 ||
    escalation <= warning ||
    escalation > 2880 ||
    autoSkip <= escalation ||
    autoSkip > 10080 ||
    skipToStockMinutes < 1 ||
    skipToStockMinutes > 10080
  ) {
    setNotice("error", "Các mốc phải là số phút nguyên hợp lệ; Cảnh báo < Quá hạn < Tự động cho phép bỏ qua.");
    return;
  }

  if (!window.confirm("CẢNH BÁO: Thay đổi thời gian xử lý có thể làm mốc cho phép Skip của Picker sớm hơn hoặc muộn hơn. Bạn có chắc muốn lưu cấu hình mới?")) return;
  const currentPassword = String(data.get("currentPassword") || "");
  if (!currentPassword) {
    setNotice("warning", "Chưa lưu: cần mật khẩu tài khoản hiện tại để xác nhận.");
    return;
  }

  const expectedPolicyVersion = Number(slaResponse?.sla?.policy_version || 0);
  const requestId = crypto.randomUUID();
  const saveButton = form.querySelector<HTMLButtonElement>("#sla-save-button");
  slaSaveBusy = true;
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Đang lưu…";
  }
  const started = performance.now();

  try {
    runtimeLogMetric("SLA", "save_start", {
      request_id: requestId,
      requested_mode: requestedMode,
      expected_policy_version: expectedPolicyVersion,
    }, 0);

    const saved = await saveAdminSla({
      warning_minutes: warning,
      warning_enabled: warningEnabled,
      escalation_minutes: escalation,
      escalation_enabled: escalationEnabled,
      auto_skip_minutes: autoSkip,
      auto_skip_enabled: autoSkipEnabled,
      auto_skip_mode: requestedMode,
      skip_to_stock_enabled: skipToStockEnabled,
      skip_to_stock_minutes: skipToStockMinutes,
      expected_policy_version: expectedPolicyVersion,
      request_id: requestId,
      current_password: currentPassword,
    });

    const verification = saved.verification;
    const savedMode = normalizeAutoSkipMode(saved.sla?.auto_skip_mode);
    const savedVersion = Number(saved.sla?.policy_version || 0);
    const verificationValid = Boolean(
      verification &&
      verification.request_id === requestId &&
      verification.sqlite_readback === "PASS" &&
      verification.requested_mode === requestedMode &&
      verification.persisted_mode === requestedMode &&
      Number(verification.base_policy_version || 0) === expectedPolicyVersion &&
      Number(verification.persisted_policy_version || 0) === savedVersion &&
      savedMode === requestedMode &&
      savedVersion > expectedPolicyVersion
    );
    if (!verificationValid) {
      throw new Error(
        `Xác minh ghi SQLite thất bại. Yêu cầu ${requestedMode}; phản hồi ${savedMode || "UNKNOWN"}; phiên bản ${savedVersion || 0}.`,
      );
    }

    // D141 end-to-end authority check: use a fresh no-cache GET after the server's
    // SQLite readback. Success is impossible unless both reads agree with the
    // operator's requested mode and the exact committed policy version.
    const authoritative = await getAdminSla();
    const authoritativeMode = normalizeAutoSkipMode(authoritative.sla?.auto_skip_mode);
    const authoritativeVersion = Number(authoritative.sla?.policy_version || 0);
    if (authoritativeMode !== requestedMode || authoritativeVersion !== savedVersion) {
      throw new Error(
        `Xác minh GET sau lưu thất bại. Yêu cầu ${requestedMode}; máy chủ ${authoritativeMode || "UNKNOWN"}; phiên bản ${authoritativeVersion || 0}/${savedVersion}.`,
      );
    }

    slaResponse = authoritative;
    slaDraftMode = authoritativeMode;
    slaFormDirty = false;
    markWebUpdateReceived();
    runtimeLogMetric("SLA", "save_verified", {
      request_id: requestId,
      requested_mode: requestedMode,
      persisted_mode: authoritativeMode,
      policy_version: authoritativeVersion,
      sqlite_readback: "PASS",
    }, performance.now() - started);
    setNotice("success", `Đã lưu và xác minh: ${autoSkipModeLabel(authoritativeMode)} · phiên bản ${authoritativeVersion}.`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "SLA_CONFIG_STALE") {
      slaFormDirty = false;
      slaDraftMode = null;
      await loadSla();
      setNotice("warning", "Cấu hình đã được cập nhật ở phiên khác. Đã tải lại bản mới nhất; thay đổi cũ không được ghi đè.");
      return;
    }

    const message = error instanceof Error ? error.message : "Không lưu được cấu hình thời gian xử lý.";
    let latest: SlaResponse | null = null;
    try {
      latest = await getAdminSla();
    } catch {
      // Keep the current server snapshot if the verification read is unavailable.
    }
    if (latest) {
      slaResponse = latest;
      markWebUpdateReceived();
    }
    const serverMode = normalizeAutoSkipMode((latest || slaResponse)?.sla?.auto_skip_mode);
    const serverVersion = Number((latest || slaResponse)?.sla?.policy_version || 0);
    slaDraftMode = requestedMode;
    slaFormDirty = true;
    patchSlaDraftIndicator();
    runtimeLogMetric("SLA", "save_verify_failed", {
      request_id: requestId,
      requested_mode: requestedMode,
      server_mode: serverMode,
      server_policy_version: serverVersion,
      error: message,
    }, performance.now() - started, "ERROR");
    void sendWebRuntimeLog("sla_save_verify_failed", "ERROR", {
      request_id: requestId,
      requested_mode: requestedMode,
      server_mode: serverMode,
      server_policy_version: serverVersion,
      message,
    });
    setNotice(
      "error",
      `Lưu chưa được xác nhận. Yêu cầu: ${autoSkipModeLabel(requestedMode)} · Máy chủ hiện tại: ${autoSkipModeLabel(serverMode)}. ${message}`,
    );
  } finally {
    slaSaveBusy = false;
    if (saveButton && saveButton.isConnected) {
      saveButton.disabled = false;
      saveButton.textContent = "Lưu cấu hình toàn hệ thống";
    }
    if (activeSection === "sla") {
      if (slaFormDirty) {
        syncSlaModeControlsFromState();
        patchSlaDraftIndicator();
      } else {
        patchActiveSection(true);
      }
    }
  }
}

async function loadSla(): Promise<void> {
  const loadGeneration = ++slaLoadGeneration;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const range = apiRange(dateDaysAgo(6), dateDaysAgo(0));
  const nextSla = await getAdminSla();
  if (loadGeneration !== slaLoadGeneration || generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;

  // Never let a background refresh replace values that the operator is currently
  // editing. Keep the old policy_version so Save will fail stale rather than
  // silently overwriting another machine's newer configuration.
  if (activeSection === "sla" && slaFormDirty && slaResponse) {
    setNotice("warning", "Cấu hình máy chủ vừa thay đổi ở phiên khác. Thay đổi đang nhập được giữ nguyên; khi lưu hệ thống sẽ kiểm tra phiên bản.");
    return;
  }

  slaResponse = nextSla;
  slaDraftMode = normalizeAutoSkipMode(nextSla.sla?.auto_skip_mode);
  markWebUpdateReceived();
  if (activeSection === "sla") patchActiveSection(true);
  try {
    const nextInsights = await getAdminOperationalInsights(range.from, range.to);
    if (loadGeneration !== slaLoadGeneration || generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    operationalInsights = nextInsights;
    // Statistics are secondary. Update only their text; do not rebuild the SLA
    // form because a full patch resets radio/checkbox edits and looked like the
    // policy had changed by itself.
    patchSlaInsightCounts();
  } catch (error) {
    runtimeLogEvent(`Không tải được thống kê SLA phụ: ${error instanceof Error ? error.message : "unknown"}`, "ERROR");
  }
}

async function loadDashboard(): Promise<void> {
  const generation = ++dashboardLoadGeneration;
  const sessionGeneration = sessionViewGeneration;
  const userId = profile?.user_id || "";
  if (userId && dashboardPreferenceLoadedUserId !== userId) {
    const saved = await getDashboardPreference();
    if (generation !== dashboardLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    if (saved.configured && saved.preference?.from && saved.preference?.to) {
      dashboardFrom = saved.preference.from;
      dashboardTo = saved.preference.to;
      localStorage.setItem(dashboardRangeStorageKey(userId), JSON.stringify({ from: dashboardFrom, to: dashboardTo }));
    } else {
      dashboardFrom = dateDaysAgo(0);
      dashboardTo = dateDaysAgo(0);
      localStorage.removeItem(dashboardRangeStorageKey(userId));
    }
    dashboardPreferenceLoadedUserId = userId;
  }
  const range = apiRange(dashboardFrom, dashboardTo);
  const [nextDashboard, nextInsights] = await Promise.all([
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
  ]);
  if (generation !== dashboardLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  dashboardData = nextDashboard;
  operationalInsights = nextInsights;
  markWebUpdateReceived();
  void getRealtimePresence().then((nextPresence) => {
    if (generation !== dashboardLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    realtimePresence = nextPresence;
    if (activeSection === "dashboard") patchActiveSection(true);
  }).catch((error) => runtimeLogEvent(`Không cập nhật được số người online: ${error instanceof Error ? error.message : "unknown"}`, "ERROR"));
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
  void Promise.all([
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
  ]).then(([summary, insights]) => {
    if (generation !== reportLoadGeneration || sessionGeneration !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    reportSummary = summary;
    reportInsights = insights;
    if (activeSection === "reports") patchActiveSection(true);
  }).catch((error) => runtimeLogEvent(`Không tải được tổng hợp báo cáo: ${error instanceof Error ? error.message : "unknown"}`, "ERROR"));
}

async function loadSkuWorkspace(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [catalog, result] = await Promise.all([
    getSkuCatalogInfo(),
    searchSkus(skuAdminQuery, SKU_PAGE_SIZE, skuAdminOffset),
  ]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  if (result.total > 0 && skuAdminOffset >= result.total) {
    skuAdminOffset = Math.max(0, Math.floor((result.total - 1) / SKU_PAGE_SIZE) * SKU_PAGE_SIZE);
    return loadSkuWorkspace();
  }
  skuCatalogInfo = catalog;
  skuAdminItems = result.items;
  skuAdminTotal = result.total;
  markWebUpdateReceived();
}

async function loadUsers(): Promise<void> {
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const result = await listManagedUsers({
    query: userQuery,
    role: userRole,
    status: userStatus,
    shortageReporting: userShortageReporting,
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
      shortageReporting: userShortageReporting,
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
  if (logView === "AUDIT") {
    const result = await getAdminAuditHistory({
      role: auditRole,
      query: auditQuery,
      days: logDays,
      from: apiRange(logFrom, logTo).from,
      to: apiRange(logFrom, logTo).to,
      limit: AUDIT_PAGE_SIZE,
      offset: auditOffset,
    });
    if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
    auditRows = result.items;
    auditTotal = result.total;
    if (auditTotal > 0 && auditOffset >= auditTotal) {
      auditOffset = Math.max(0, Math.floor((auditTotal - 1) / AUDIT_PAGE_SIZE) * AUDIT_PAGE_SIZE);
      return loadLogs();
    }
    markWebUpdateReceived();
    return;
  }
  runtimeLogSource = logView;
  const pageToken = runtimeLogPageTokens[runtimeLogPageIndex] || "";
  const result = await getRuntimeLogs(runtimeLogSource, RUNTIME_LOG_PAGE_SIZE, logDays, pageToken,
    apiRange(logFrom, logTo).from, apiRange(logFrom, logTo).to);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  runtimeLogs = result.items;
  runtimeLogNextPageToken = result.next_page_token || "";
  if (runtimeLogDetail && !runtimeLogs.some((item) => item.id === runtimeLogDetail?.file.id)) runtimeLogDetail = null;
  markWebUpdateReceived();
}

async function loadD167MealState(): Promise<void> {
  if (!roleCanResolve()) return;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const fresh = await getD167MealState();
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  d167MealState = fresh;
  patchOverlays();
}

async function loadShiftOperations(): Promise<void> {
  if (!roleOperate()) return;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [alertResult, mealResult] = await Promise.all([
    roleManage() ? getAndroidAlertWindow().catch(() => null) : Promise.resolve(null),
    roleCanResolve() ? getD167MealState().catch(() => null) : Promise.resolve(null),
  ]);
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  androidAlertWindow = alertResult;
  d167MealState = mealResult;
  markWebUpdateReceived();
  patchOverlays();
}

async function loadTools(): Promise<void> {
  if (!roleManage()) return;
  const generation = sessionViewGeneration;
  const userId = profile?.user_id || "";
  const [pdaResult, agentResult] = await Promise.all([getPdaAppRelease(), getAgentAppRelease()]);
  const stableUrl = `${window.location.origin}${pdaResult.release.stable_download_path}`;
  const qr = await QRCode.toDataURL(stableUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });
  if (generation !== sessionViewGeneration || userId !== (profile?.user_id || "")) return;
  pdaAppRelease = pdaResult.release;
  agentAppRelease = agentResult.release;
  pdaQrDataUrl = qr;
  markWebUpdateReceived();
}

async function exportReportsExcel(): Promise<void> {
  const range = apiRange(reportFrom, reportTo);
  const rows: AdminReportingRow[] = [];
  const details: AdminReportingDetailRow[] = [];
  const pageSize = 500;
  const maxRows = 100_000;
  const maxDetailRows = 100_000;
  const started = performance.now();

  const [summary, insights] = await Promise.all([
    getAdminDashboard(range.from, range.to),
    getAdminOperationalInsights(range.from, range.to),
  ]);

  let offset = 0;
  let total = 0;
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
    if (rows.length > maxRows) {
      throw new Error(`Bộ lọc có hơn ${maxRows.toLocaleString("vi-VN")} đợt báo hàng; hãy thu hẹp khoảng ngày trước khi xuất.`);
    }
  } while (offset < total);

  offset = 0;
  total = 0;
  do {
    const page = await getAdminReportingDetail({
      from: range.from,
      to: range.to,
      status: reportStatus,
      query: reportQuery,
      limit: pageSize,
      offset,
    });
    total = page.total;
    details.push(...page.items);
    offset += page.items.length;
    if (!page.items.length) break;
    if (details.length > maxDetailRows) {
      throw new Error(`Bộ lọc có hơn ${maxDetailRows.toLocaleString("vi-VN")} dòng chi tiết Picker; hãy thu hẹp khoảng ngày trước khi xuất.`);
    }
  } while (offset < total);

  markWebUpdateReceived();
  downloadReportWorkbook(
    rows,
    details,
    summary,
    insights,
    {
      from: reportFrom,
      to: reportTo,
      status: reportStatus,
      query: reportQuery,
      generatedAt: new Date(),
    },
    statusLabel,
  );
  runtimeLogMetric("EXPORT", "report_excel_detailed", {
    batch_rows: rows.length,
    picker_rows: details.length,
    from: reportFrom,
    to: reportTo,
    status: reportStatus || "ALL",
    has_query: Boolean(reportQuery),
  }, performance.now() - started);
  setNotice("success", `Đã xuất Excel chi tiết: ${rows.length.toLocaleString("vi-VN")} đợt và ${details.length.toLocaleString("vi-VN")} dòng Picker.`);
}

async function loadSection(section: Section): Promise<void> {
  if (!profile) return;
  let received = false;
  if (roleOperate() && section !== "operations" && section !== "overdue" && section !== "results" && (!queueBadgeInitialized || !overdueBadgeInitialized || !recentBadgeInitialized)) {
    await loadReporterTabCounters();
  }
  if ((section === "operations" || section === "overdue" || section === "results") && roleOperate()) { await loadOperations(); received = true; }
  else if (section === "shift" && roleOperate()) { await loadShiftOperations(); received = true; }
  else if (section === "picker" && profile.role === "PICKER") { await loadPicker(); received = true; }
  else if (section === "sku" && rolePickPackManage()) { await loadSkuWorkspace(); received = true; }
  else if (section === "hr" && rolePickPackManage()) {
    hrSource = await getHrSource();
    hrEventSync = profile.role === "ADMIN" || profile.role === "ROOT"
      ? await getHrEventSyncState()
      : null;
    received = true;
  }
  else if (section === "users" && rolePickPackManage()) { await loadUsers(); received = true; }
  else if (section === "sla" && roleManage()) { await loadSla(); received = true; }
  else if (section === "dashboard" && rolePickPackManage()) { await loadDashboard(); received = true; }
  else if (section === "reports" && rolePickPackManage()) { await loadReports(); received = true; }
  else if (section === "logs" && roleManage()) { await loadLogs(); received = true; }
  else if (section === "tools" && roleManage()) { await loadTools(); received = true; }
  else if (section === "system-reset" && profile.role === "ROOT" && profile.base_role === "ROOT") {
    systemResetPreview = await getSystemResetPreview(false);
    received = true;
  }
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
    if (!["ROOT", "ADMIN", "PICKPACK_ADMIN", "REPORTER", "PICKER"].includes(role) || role === profile.role) return;
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
    void logoutInteractiveSession().finally(() => {
      pickerSearchGeneration += 1;
      dashboardLoadGeneration += 1;
      reportLoadGeneration += 1;
      sessionViewGeneration += 1;
      runtimeLogEvent("Đăng xuất");
      clearSession();
      profile = null;
      notice = null;
      queueRows = [];
      queueBadgeCount = 0;
      queueBadgeInitialized = false;
      overdueRows = [];
      overdueBadgeCount = 0;
      overdueBadgeInitialized = false;
      perPickerOverdueEnabled = false;
      recentBadgeCount = 0;
      resultTabBadgeCounts = { HAS_STOCK: 0, SKIP_ALLOWED: 0, CLOSED: 0 };
      recentBadgeInitialized = false;
      reporterBadgeLoadGeneration += 1;
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
  });
  bindOverlay();
}

async function commitReporterResolution(batch: ReporterBatch, resolution: "HAS_STOCK" | "SKIP_ALLOWED"): Promise<void> {
  if (!roleCanResolve()) {
    setNotice("warning", "Quản trị Pick Pack chỉ được xem Báo hàng, không được xử lý kết quả.");
    return;
  }
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

async function submitD167Meal(period: "LUNCH" | "DINNER", choice: "EARLY" | "LATE"): Promise<void> {
  if (!roleCanResolve()) return;
  try {
    await confirmD167Meal(period, choice);
    await loadD167MealState();
    if (activeSection === "shift") patchActiveSection(true);
    setNotice("success", "Đã xác nhận giờ nghỉ; đồng bộ tới toàn bộ Reporter.");
  } catch (error) {
    await loadD167MealState().catch(() => undefined);
    if (activeSection === "shift") patchActiveSection(true);
    setNotice("warning", error instanceof Error ? error.message : "Giờ nghỉ đã được Reporter khác chốt.");
  }
}

function bindOverlay(): void {
  document.querySelector<HTMLFormElement>("#d167-meal-overlay-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const period = form.dataset.period === "DINNER" ? "DINNER" : "LUNCH";
    const choice = new FormData(form).get("choice") === "LATE" ? "LATE" : "EARLY";
    void submitD167Meal(period, choice);
  });
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
    const authEmail = String(data.get("authEmail") || "").trim();
    const roleRaw = String(data.get("role") || "").trim();
    const role = ["ADMIN", "PICKPACK_ADMIN", "REPORTER"].includes(roleRaw)
      ? roleRaw as "ADMIN" | "PICKPACK_ADMIN" | "REPORTER"
      : undefined;
    void run(async () => {
      await updateManagedUser(userId, displayName, status, authEmail, role);
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
  if (!roleCanResolve()) {
    root.querySelectorAll<HTMLButtonElement>("[data-detail]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.detail || "";
      if (!id) return;
      if (expandedBatchDetails.has(id)) expandedBatchDetails.delete(id);
      else expandedBatchDetails.add(id);
      if (activeSection === "operations" && selectedBatchId === id) refreshFastDetailOnly();
      else patchActiveSection(true);
      if (expandedBatchDetails.has(id)) prefetchBatchDetails(id);
    }));
    return;
  }
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
  document.querySelectorAll<HTMLButtonElement>("[data-workspace-result-filter]").forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.workspaceResultFilter;
    if (!profile || !roleOperate() || !["HAS_STOCK", "SKIP_ALLOWED", "CLOSED"].includes(target || "")) return;
    if (activeSection === "results" && recentFilter === target) return;
    recentFilter = target as typeof recentFilter;
    recentOffset = 0;
    if (activeSection !== "results") navigateToSection("results", "push");
    else void run(async () => { await loadOperations(); patchActiveSection(true); });
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-workspace-section]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.workspaceSection as Section;
    if (!profile || !next || next === activeSection || !canAccessSection(next, profile)) return;
    navigateToSection(next, "push");
  }));

  document.querySelectorAll<HTMLInputElement>("[data-reset-scope]").forEach((input) => input.addEventListener("change", () => {
    const scope = input.dataset.resetScope as SystemResetScope;
    if (!scope) return;
    if (input.checked) systemResetSelected.add(scope);
    else systemResetSelected.delete(scope);
    const requestButton = document.querySelector<HTMLButtonElement>("#reset-request-code");
    if (requestButton) requestButton.disabled = systemResetSelected.size === 0;
    const all = document.querySelector<HTMLInputElement>("#reset-select-all");
    if (all) all.checked = document.querySelectorAll<HTMLInputElement>("[data-reset-scope]").length === systemResetSelected.size;
  }));
  document.querySelector<HTMLInputElement>("#reset-select-all")?.addEventListener("change", (event) => {
    const checked = (event.currentTarget as HTMLInputElement).checked;
    document.querySelectorAll<HTMLInputElement>("[data-reset-scope]").forEach((input) => {
      const scope = input.dataset.resetScope as SystemResetScope;
      input.checked = checked;
      if (checked) systemResetSelected.add(scope);
      else systemResetSelected.delete(scope);
    });
    const requestButton = document.querySelector<HTMLButtonElement>("#reset-request-code");
    if (requestButton) requestButton.disabled = systemResetSelected.size === 0;
  });
  document.querySelector<HTMLButtonElement>("#reset-refresh-preview")?.addEventListener("click", () => void run(async () => {
    systemResetPreview = await getSystemResetPreview(false);
    patchActiveSection(false);
    setNotice("success", "Đã cập nhật số lượng dữ liệu trong service.");
  }));
  document.querySelector<HTMLButtonElement>("#reset-read-relay")?.addEventListener("click", () => void run(async () => {
    systemResetPreview = await getSystemResetPreview(true);
    patchActiveSection(false);
    setNotice("success", "Đã đọc số lượng dữ liệu relay Firestore.");
  }));
  document.querySelector<HTMLButtonElement>("#reset-request-code")?.addEventListener("click", () => {
    if (!profile || profile.role !== "ROOT" || profile.base_role !== "ROOT" || !systemResetSelected.size) return;
    const password = document.querySelector<HTMLInputElement>("#reset-root-password")?.value || "";
    if (!password) {
      setNotice("warning", "Nhập mật khẩu ROOT hiện tại trước khi gửi mã xác nhận.");
      return;
    }
    const selected = [...systemResetSelected];
    if (!window.confirm(`Chuẩn bị đặt lại ${selected.length} nhóm dữ liệu đã chọn. ROOT và dữ liệu Google Sheet/Drive không bị xóa. Tiếp tục gửi mã xác nhận?`)) return;
    void run(async () => {
      const challenge = await requestSystemResetChallenge(selected, password);
      systemResetChallenge = { id: challenge.challenge_id, expiresAt: challenge.expires_at, emailHint: challenge.email_hint };
      patchActiveSection(false);
      setNotice("success", "Đã xác minh mật khẩu ROOT và gửi mã 6 chữ số.");
    });
  });
  document.querySelector<HTMLButtonElement>("#reset-cancel-challenge")?.addEventListener("click", () => {
    systemResetChallenge = null;
    patchActiveSection(false);
  });
  const executeReset = () => {
    if (!systemResetChallenge) return;
    const code = (document.querySelector<HTMLInputElement>("#reset-otp")?.value || "").trim();
    if (!/^\d{6}$/.test(code)) {
      setNotice("warning", "Nhập đúng mã xác nhận gồm 6 chữ số.");
      return;
    }
    if (!window.confirm("Đây là thao tác phá huỷ dữ liệu runtime đã chọn và không thể hoàn tác từ service. Xác nhận thực hiện?")) return;
    void run(async () => {
      const result = await executeSystemReset(systemResetChallenge!.id, code);
      const groups = result.scopes.length;
      systemResetChallenge = null;
      systemResetSelected.clear();
      systemResetPreview = await getSystemResetPreview(false);
      patchActiveSection(false);
      setNotice("success", `Đặt lại hoàn tất ${groups} nhóm dữ liệu. ROOT và Google Sheet/Drive được giữ nguyên.`);
    });
  };
  document.querySelector<HTMLButtonElement>("#reset-execute")?.addEventListener("click", executeReset);
  document.querySelector<HTMLInputElement>("#reset-otp")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    executeReset();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-queue-filter]").forEach((button) => button.addEventListener("click", () => {
    const next = String(button.dataset.queueFilter || "ALL") as typeof queueFilter;
    if (!["ALL", "WARNING", "ESCALATED"].includes(next)) return;
    queueFilter = next;
    const visible = filteredQueueRows();
    if (!visible.some((row) => row.batch_id === selectedBatchId)) selectedBatchId = visible[0]?.batch_id || null;
    patchActiveSection(false);
    if (selectedBatchId) prefetchBatchDetails(selectedBatchId);
  }));

  document.querySelector<HTMLButtonElement>("#check-launcher-logs")?.addEventListener("click", () => void run(async () => {
    if (profile?.role !== "ROOT" || profile?.base_role !== "ROOT") throw new Error("Chỉ ROOT thực được kiểm tra bộ đệm log Launcher.");
    launcherLogDiagnostics = await getLauncherLogDiagnostics();
    markWebUpdateReceived();
  }));
  document.querySelectorAll<HTMLFormElement>("[data-d167-meal-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const period = form.dataset.d167MealForm === "DINNER" ? "DINNER" : "LUNCH";
    const choice = new FormData(form).get("choice") === "LATE" ? "LATE" : "EARLY";
    void submitD167Meal(period, choice);
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-log-view]").forEach((button) => button.addEventListener("click", () => {
    const raw = String(button.dataset.logView || "WEB").toUpperCase();
    const next: "WEB" | "ANDROID" | "AUDIT" = raw === "ANDROID" ? "ANDROID" : raw === "AUDIT" ? "AUDIT" : "WEB";
    if (next === logView) return;
    logView = next;
    if (next !== "AUDIT") runtimeLogSource = next;
    runtimeLogDetail = null;
    runtimeLogPageTokens = [""];
    runtimeLogPageIndex = 0;
    runtimeLogNextPageToken = "";
    auditOffset = 0;
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
  document.querySelector<HTMLFormElement>("#log-date-range")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget as HTMLFormElement);
    const from = String(fields.get("from") || "");
    const to = String(fields.get("to") || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      from > to || to > dateDaysAgo(0) || Date.parse(to) - Date.parse(from) > 365 * 86_400_000) {
      setNotice("warning", "Chọn ngày bắt đầu/kết thúc hợp lệ, không vượt quá hôm nay.");
      return;
    }
    logFrom = from; logTo = to;
    auditOffset = 0;
    runtimeLogDetail = null;
    runtimeLogPageTokens = [""]; runtimeLogPageIndex = 0; runtimeLogNextPageToken = "";
    void run(loadLogs);
  });

  document.querySelector<HTMLFormElement>("#audit-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    auditRole = String(data.get("role") || "");
    auditQuery = String(data.get("query") || "").trim();
    auditOffset = 0;
    void run(loadLogs);
  });
  document.querySelector<HTMLButtonElement>("#audit-prev")?.addEventListener("click", () => {
    auditOffset = Math.max(0, auditOffset - AUDIT_PAGE_SIZE);
    void run(loadLogs);
  });
  document.querySelector<HTMLButtonElement>("#audit-next")?.addEventListener("click", () => {
    auditOffset += AUDIT_PAGE_SIZE;
    void run(loadLogs);
  });
  document.querySelector<HTMLButtonElement>("#runtime-log-prev")?.addEventListener("click", () => {
    if (runtimeLogPageIndex <= 0) return;
    runtimeLogPageIndex -= 1;
    runtimeLogDetail = null;
    void run(loadLogs);
  });
  document.querySelector<HTMLButtonElement>("#runtime-log-next")?.addEventListener("click", () => {
    if (!runtimeLogNextPageToken) return;
    const nextIndex = runtimeLogPageIndex + 1;
    runtimeLogPageTokens[nextIndex] = runtimeLogNextPageToken;
    runtimeLogPageIndex = nextIndex;
    runtimeLogDetail = null;
    void run(loadLogs);
  });
  document.querySelector<HTMLButtonElement>("#copy-pda-link")?.addEventListener("click", async () => {
    const stableUrl = `${window.location.origin}${pdaAppRelease?.stable_download_path || "/downloads/pda/latest"}`;
    try {
      await navigator.clipboard.writeText(stableUrl);
      setNotice("success", "Đã sao chép link tải App PDA mới nhất.");
    } catch {
      setNotice("warning", "Không sao chép tự động được. Hãy dùng nút Tải App PDA.");
    }
  });

  document.querySelector<HTMLButtonElement>("#copy-agent-link")?.addEventListener("click", async () => {
    try {
      const stableUrl = `${window.location.origin}${agentAppRelease?.stable_download_path || "/downloads/agent/latest"}`;
      await navigator.clipboard.writeText(stableUrl);
      setNotice("success", "Đã sao chép link tải Agent.");
    } catch {
      setNotice("warning", "Không sao chép tự động được. Hãy dùng nút Tải Agent.");
    }
  });


  document.querySelector<HTMLButtonElement>("#send-web-log")?.addEventListener("click", () => void run(async () => {
    const sent = await sendWebRuntimeLog("manual_web_log", "INFO");
    if (!sent) throw new Error("Chưa gửi được log Web. Kiểm tra kết nối rồi thử lại.");
    logView = "WEB";
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
    const batchId = button.dataset.correct || "";
    const target = button.dataset.correctTarget === "SKIP_ALLOWED" ? "SKIP_ALLOWED" : button.dataset.correctTarget === "HAS_STOCK" ? "HAS_STOCK" : "PENDING";
    const expectedVersion = Number(button.dataset.correctVersion || 0);
    const targetLabel = target === "PENDING" ? "Đang xử lý" : target === "HAS_STOCK" ? "Đã có hàng" : "Cho phép Skip";
    if (!window.confirm(`Xác nhận sửa kết quả đã thông báo thành “${targetLabel}”?`)) return;
    if (!window.confirm("CẢNH BÁO: Kết quả đã được gửi cho Picker. Thao tác này sẽ tạo kết quả điều chỉnh mới và yêu cầu Picker xác nhận lại. Tiếp tục?")) return;
    await correctReporterBatch(batchId, target, expectedVersion);
    await loadOperations();
    setNotice("success", `Đã điều chỉnh kết quả thành ${targetLabel}.`);
  })));

  document.querySelectorAll<HTMLButtonElement>("[data-overdue-resolve]").forEach((button) => button.addEventListener("click", () => void run(async () => {
    const batchId = button.dataset.batch || "";
    const resolution = button.dataset.overdueResolve === "HAS_STOCK" ? "HAS_STOCK" : "SKIP_ALLOWED";
    const row = overdueRows.find((item) => item.batch_id === batchId);
    if (!row) return;
    const label = resolution === "HAS_STOCK" ? "Đã có hàng" : "Cho phép Skip";
    if (!window.confirm(`Xác nhận ${label} cho SKU ${row.sku}?`)) return;
    await resolveReporterBatch(batchId, resolution);
    overdueRows = overdueRows.filter((item) => item.batch_id !== batchId);
    overdueBadgeCount = Math.max(0, overdueBadgeCount - 1);
    queueRows = queueRows.filter((item) => item.batch_id !== batchId);
    batchDetails.delete(batchId);
    syncOperationalTabBadges();
    patchActiveSection(true);
    setNotice("success", `${row.sku} đã xử lý: ${label}.`);
  })));
  document.querySelectorAll<HTMLButtonElement>("[data-recent-range]").forEach((button) => button.addEventListener("click", () => {
    const preset = button.dataset.recentRange || "";
    const today = dateDaysAgo(0);
    if (preset === "TODAY") { recentFrom = today; recentTo = today; }
    else if (preset === "YESTERDAY") { recentFrom = dateDaysAgo(1); recentTo = dateDaysAgo(1); }
    else if (preset === "D7") { recentFrom = dateDaysAgo(6); recentTo = today; }
    else if (preset === "D30") { recentFrom = dateDaysAgo(29); recentTo = today; }
    else return;
    syncVisibleDateRange("recent", recentFrom, recentTo);
    recentOffset = 0;
    // One counter reconcile for the new date scope, not one per tab.
    void run(async () => { await Promise.all([loadOperations(), loadReporterTabCounters(true)]); });
  }));
  document.querySelector<HTMLFormElement>("#recent-range-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const from = String(data.get("from") || "");
    const to = String(data.get("to") || "");
    const range = apiRange(from, to);
    if (Date.parse(range.to) - Date.parse(range.from) > 60 * 86_400_000) {
      setNotice("warning", "Kết quả gần đây chỉ cho phép tối đa 60 ngày.");
      return;
    }
    if (to > dateDaysAgo(0)) {
      setNotice("warning", "Không thể chọn ngày tương lai.");
      return;
    }
    recentFrom = from;
    recentTo = to;
    recentOffset = 0;
    // Match all five badge counts to the selected reporting range.
    void run(async () => { await Promise.all([loadOperations(), loadReporterTabCounters(true)]); });
  });
  document.querySelector<HTMLButtonElement>("#recent-open-report")?.addEventListener("click", () => {
    reportFrom = recentFrom;
    reportTo = recentTo;
    reportStatus = recentFilter === "ALL" || recentFilter === "CLOSED" ? "" : recentFilter;
    reportOffset = 0;
    navigateToSection("reports");
  });
  document.querySelector<HTMLButtonElement>("#recent-prev")?.addEventListener("click", () => {
    recentOffset = Math.max(0, recentOffset - RECENT_PAGE_SIZE);
    void run(loadOperations);
  });
  document.querySelector<HTMLButtonElement>("#recent-next")?.addEventListener("click", () => {
    if (recentOffset + RECENT_PAGE_SIZE >= recentTotal) return;
    recentOffset += RECENT_PAGE_SIZE;
    void run(loadOperations);
  });

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
  document.querySelector<HTMLButtonElement>("#picker-history-prev")?.addEventListener("click", () => {
    pickerReportOffset = Math.max(0, pickerReportOffset - PICKER_REPORT_PAGE_SIZE);
    void run(loadPicker);
  });
  document.querySelector<HTMLButtonElement>("#picker-history-next")?.addEventListener("click", () => {
    if (pickerReportOffset + PICKER_REPORT_PAGE_SIZE >= pickerReportTotal) return;
    pickerReportOffset += PICKER_REPORT_PAGE_SIZE;
    void run(loadPicker);
  });

  document.querySelector<HTMLFormElement>("#sku-admin-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    skuAdminQuery = String(data.get("query") || "").trim();
    skuAdminOffset = 0;
    void run(loadSkuWorkspace);
  });
  document.querySelector<HTMLButtonElement>("#sku-admin-clear")?.addEventListener("click", () => {
    skuAdminQuery = "";
    skuAdminOffset = 0;
    void run(loadSkuWorkspace);
  });
  document.querySelector<HTMLButtonElement>("#sku-prev")?.addEventListener("click", () => {
    skuAdminOffset = Math.max(0, skuAdminOffset - SKU_PAGE_SIZE);
    void run(loadSkuWorkspace);
  });
  document.querySelector<HTMLButtonElement>("#sku-next")?.addEventListener("click", () => {
    if (skuAdminOffset + SKU_PAGE_SIZE >= skuAdminTotal) return;
    skuAdminOffset += SKU_PAGE_SIZE;
    void run(loadSkuWorkspace);
  });

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
  document.querySelector<HTMLButtonElement>("#apply-sku-import")?.addEventListener("click", () => void run(async () => {
    try {
      await importSkuWorkbook();
      await loadSkuWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không cập nhật được danh mục SKU.";
      skuImportProgress = `Đã dừng: ${message}`;
      patchActiveSection(true);
      throw error;
    }
  }));

  document.querySelector<HTMLFormElement>("#hr-source-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await saveHrSource(
        String(data.get("sheetUrl") || ""),
        String(data.get("tabName") || ""),
        String(data.get("employeeCodeHeader") || ""),
        String(data.get("fullNameHeader") || ""),
        String(data.get("contractorHeader") || ""),
      );
      hrSource = await getHrSource();
      hrEventSync = profile?.role === "ADMIN" || profile?.role === "ROOT"
        ? await getHrEventSyncState()
        : null;
      hrPreview = null;
      setNotice("success", "Đã xác nhận nguồn và đăng ký đồng bộ thay đổi.");
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
  document.querySelector<HTMLButtonElement>("#confirm-hr-event")?.addEventListener("click", () => void run(async () => {
    const fingerprint = String(hrEventSync?.sync?.pending_fingerprint || "");
    if (!fingerprint) throw new Error("Snapshot chờ xác nhận không còn hợp lệ.");
    await confirmHrEventSync(fingerprint);
    hrEventSync = await getHrEventSyncState();
    hrPreview = null;
    setNotice("success", "Đã xác nhận và áp dụng snapshot nhân sự hiện tại.");
  }));
  document.querySelector<HTMLButtonElement>("#defer-hr-event")?.addEventListener("click", () => {
    setNotice("warning", "Đã chọn Không: dữ liệu hiện tại được giữ nguyên. Snapshot vẫn chờ để có thể quyết định lại sau.");
  });
  document.querySelector<HTMLButtonElement>("#recheck-hr-event")?.addEventListener("click", () => void run(async () => {
    await recheckHrEventSync();
    hrEventSync = await getHrEventSyncState();
    hrPreview = null;
    setNotice("success", "Đã kiểm tra lại nguồn nhân sự.");
  }));

  document.querySelector<HTMLFormElement>("#create-user-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await createManagedUser(
        String(data.get("username") || ""),
        String(data.get("displayName") || ""),
        String(data.get("role") || "REPORTER") as "ADMIN" | "PICKPACK_ADMIN" | "REPORTER",
        String(data.get("password") || ""),
        String(data.get("authEmail") || "").trim(),
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
    userShortageReporting = String(data.get("shortageReporting") || "");
    userOffset = 0;
    selectedUserIds.clear();
    selectedManagedUserIds.clear();
    excludedPickerIds.clear();
    allPickerSelection = false;
    void run(loadUsers);
  });
  document.querySelector<HTMLButtonElement>("#toggle-all-pickers")?.addEventListener("click", () => {
    allPickerSelection = !allPickerSelection;
    selectedUserIds.clear();
    excludedPickerIds.clear();
    patchActiveSection();
  });
  document.querySelectorAll<HTMLInputElement>("[data-user-select]").forEach((box) => box.addEventListener("change", () => {
    const id = box.dataset.userSelect || "";
    if (!id) return;
    if (allPickerSelection) {
      if (box.checked) excludedPickerIds.delete(id);
      else excludedPickerIds.add(id);
    } else if (box.checked) selectedUserIds.add(id);
    else selectedUserIds.delete(id);
    const label = document.querySelector<HTMLElement>("#user-selection-status");
    if (label) label.textContent = userSelectionLabel();
  }));
  document.querySelectorAll<HTMLInputElement>("[data-managed-user-select]").forEach((box) => box.addEventListener("change", () => {
    const id = box.dataset.managedUserSelect || "";
    if (!id) return;
    if (box.checked) selectedManagedUserIds.add(id);
    else selectedManagedUserIds.delete(id);
    patchActiveSection();
  }));
  document.querySelector<HTMLButtonElement>("#delete-selected-managed")?.addEventListener("click", () => {
    const ids = [...selectedManagedUserIds];
    if (!ids.length) return;
    if (!window.confirm(`Xóa ${ids.length} tài khoản Admin / Quản trị Pick Pack / Reporter đã chọn? Tài khoản ROOT không nằm trong thao tác này.`)) return;
    void run(async () => {
      const result = await deleteManagedUsers(ids);
      selectedManagedUserIds.clear();
      await loadUsers();
      setNotice("success", `Đã xóa ${result.affected} tài khoản.`);
    });
  });
  document.querySelectorAll<HTMLButtonElement>("[data-picker-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.pickerAction as "ENABLE" | "DISABLE" | "DELETE" | "REPORTING_ENABLE" | "REPORTING_DISABLE";
    const ids = [...selectedUserIds];
    if (!allPickerSelection && !ids.length) {
      setNotice("warning", "Chọn ít nhất một Picker hoặc chọn tất cả Picker.");
      patchActiveSection();
      return;
    }
    const targetLabel = allPickerSelection
      ? (excludedPickerIds.size ? `tất cả Picker trừ ${excludedPickerIds.size} tài khoản đã bỏ chọn` : "tất cả Picker")
      : `${ids.length} Picker đã chọn`;
    if (action === "DELETE" && !window.confirm(`Xóa ${targetLabel}? Lịch sử nghiệp vụ vẫn được giữ.`)) return;
    if (action === "REPORTING_DISABLE" && !window.confirm(`Tắt Báo hàng cho ${targetLabel}? Xác nhận đơn và đăng nhập vẫn hoạt động bình thường.`)) return;
    void run(async () => {
      await updatePickerAccounts(action, ids, allPickerSelection, [...excludedPickerIds]);
      selectedUserIds.clear();
      selectedManagedUserIds.clear();
      excludedPickerIds.clear();
      allPickerSelection = false;
      await loadUsers();
      setNotice("success", action === "REPORTING_ENABLE" ? "Đã bật Báo hàng cho Picker." : action === "REPORTING_DISABLE" ? "Đã tắt Báo hàng cho Picker." : "Đã cập nhật Picker.");
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

  const slaForm = document.querySelector<HTMLFormElement>("#sla-form");
  if (slaForm) {
    // D141: server authority and browser draft are separate. Initialize the DOM
    // from explicit state after every render so native/browser context restoration
    // cannot silently select a different radio than the server value.
    syncSlaModeControlsFromState();

    slaForm.addEventListener("input", (event) => {
      slaFormDirty = true;
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (target instanceof HTMLInputElement && target.name === "autoSkipMode" && target.checked) {
        slaDraftMode = normalizeAutoSkipMode(target.value);
      }
      patchSlaDraftIndicator();
    });
    slaForm.addEventListener("change", (event) => {
      slaFormDirty = true;
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (target instanceof HTMLInputElement && target.name === "autoSkipMode" && target.checked) {
        slaDraftMode = normalizeAutoSkipMode(target.value);
      }
      patchSlaDraftIndicator();
    });
    slaForm.addEventListener("submit", (event) => {
      event.preventDefault();
      // Do not route this global configuration write through run(): run() drops
      // work when another action owns the generic busy flag. SLA Save has its own
      // single-flight lock and must never disappear silently.
      void saveSlaConfiguration(event.currentTarget as HTMLFormElement);
    });

    requestAnimationFrame(() => syncSlaModeControlsFromState());
  }

  document.querySelector<HTMLFormElement>("#dashboard-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    dashboardFrom = String(data.get("from"));
    dashboardTo = String(data.get("to"));
    void run(async () => {
      await persistDashboardRangeForUser();
      await loadDashboard();
    });
  });
  document.querySelector<HTMLFormElement>("#report-filter")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    reportFrom = String(data.get("from"));
    reportTo = String(data.get("to"));
    reportStatus = String(data.get("status") || "");
    reportQuery = String(data.get("query") || "");
    reportOffset = 0;
    reportBatchDetails.clear();
    expandedReportBatches.clear();
    reportDetailLoads.clear();
    void run(loadReports);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-date-target][data-date-days]").forEach((button) => button.addEventListener("click", () => {
    const days = Math.max(0, Math.min(59, Number(button.dataset.dateDays || 0)));
    const target = button.dataset.dateTarget;
    if (target === "dashboard") {
      dashboardFrom = dateDaysAgo(days);
      dashboardTo = dateDaysAgo(0);
      syncVisibleDateRange("dashboard", dashboardFrom, dashboardTo);
      void run(async () => {
        await persistDashboardRangeForUser();
        await loadDashboard();
      });
    } else if (target === "reports") {
      reportFrom = dateDaysAgo(days);
      reportTo = dateDaysAgo(0);
      syncVisibleDateRange("reports", reportFrom, reportTo);
      reportOffset = 0;
      reportBatchDetails.clear();
      expandedReportBatches.clear();
      reportDetailLoads.clear();
      void run(loadReports);
    }
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-dashboard-status], [data-dashboard-sku]").forEach((button) => button.addEventListener("click", () => {
    reportFrom = dashboardFrom;
    reportTo = dashboardTo;
    reportStatus = button.dataset.dashboardStatus || "";
    reportQuery = button.dataset.dashboardSku || "";
    reportOffset = 0;
    reportBatchDetails.clear();
    expandedReportBatches.clear();
    reportDetailLoads.clear();
    navigateToSection("reports", "push");
  }));
  document.querySelector<HTMLButtonElement>("#report-prev")?.addEventListener("click", () => {
    reportOffset = Math.max(0, reportOffset - REPORT_PAGE_SIZE);
    reportBatchDetails.clear();
    expandedReportBatches.clear();
    reportDetailLoads.clear();
    void run(loadReports);
  });
  document.querySelector<HTMLButtonElement>("#report-next")?.addEventListener("click", () => {
    reportOffset += REPORT_PAGE_SIZE;
    reportBatchDetails.clear();
    expandedReportBatches.clear();
    reportDetailLoads.clear();
    void run(loadReports);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-report-picker-detail]").forEach((button) => button.addEventListener("click", () => {
    const batchId = button.dataset.reportPickerDetail || "";
    if (!batchId) return;
    if (expandedReportBatches.has(batchId)) {
      expandedReportBatches.delete(batchId);
      patchActiveSection(true);
      return;
    }
    expandedReportBatches.add(batchId);
    if (reportBatchDetails.has(batchId)) patchActiveSection(true);
    else void loadReportBatchDetails(batchId);
  }));
  document.querySelector<HTMLButtonElement>("#export-reports")?.addEventListener("click", () => void run(exportReportsExcel, "none"));

  document.querySelector<HTMLButtonElement>("#download-support-log")?.addEventListener("click", downloadSupportDiagnostics);
  document.querySelector<HTMLFormElement>("#password-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      await changeMyPassword(String(data.get("current") || ""), String(data.get("next") || ""));
      setNotice("success", "Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các phiên đang dùng.");
    });
  });
  document.querySelector<HTMLFormElement>("#auth-email-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    void run(async () => {
      profile = await updateMyAuthEmail(String(data.get("email") || "").trim());
      setNotice("success", "Đã cập nhật email khôi phục mật khẩu.");
      render();
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
    if (roleOperate()) await loadReporterTabCounters(true);
    if ((activeSection === "operations" || activeSection === "overdue" || activeSection === "results") && roleOperate()) await loadOperations();
    else if (activeSection === "picker" && profile?.role === "PICKER") await loadPicker();
    else if (activeSection === "sla" && roleManage()) {
      // D138: loadSla owns SLA rendering. Its dirty-form guard must be allowed to
      // return without a generic patch, otherwise realtime reconcile rebuilds the
      // form from the previous server snapshot and silently resets radio edits.
      await loadSla();
      return true;
    }
    else if (activeSection === "shift" && rolePickPackManage()) await loadShiftOperations();
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
    announceNewReportEvents(events);
    for (const row of events) {
      if (row.event === "support_log_request" || (row.scopes || []).includes("support_log_request")) {
        queueWebSupportLogRequest(row.metadata);
      }
    }
  }
  if (context.source === "reconcile") {
    if (roleCanResolve()) await loadD167MealState().catch(() => undefined);
    return reconcileActive();
  }
  if (roleCanResolve() && events.some(e => (e.scopes || []).includes("meal_break"))) {
    await loadD167MealState().catch(() => undefined);
    if (activeSection === "shift") patchActiveSection(true);
  }

  const scopes = new Set(events.flatMap((row) => row.scopes || []));
  const pickerRelevant = profile?.role === "PICKER" && activeSection === "picker" && scopes.has("picker_reports");
  const reporterQueueChanged = roleOperate() && scopes.has("reporter_queue");
  const reporterOverdueChanged = roleOperate() && scopes.has("reporter_overdue");
  const reporterRecentChanged = roleOperate() && scopes.has("reporter_recent");
  const reporterScopeChanged = reporterQueueChanged || reporterOverdueChanged || reporterRecentChanged;
  const reporterRelevant =
    reporterScopeChanged && (activeSection === "operations" || activeSection === "overdue" || activeSection === "results");
  const slaRelevant = roleManage() && activeSection === "sla" && scopes.has("sla_settings");
  const scheduleRelevant =
    rolePickPackManage() && activeSection === "shift" && scopes.has("operating_schedule");
  const hrRelevant =
    Boolean(profile && (profile.role === "ADMIN" || profile.role === "ROOT")) && scopes.has("hr_sync");

  // D165: normal realtime events carry an authoritative batch snapshot.
  // Patch the exact in-memory row and badges; list APIs are fallback only when
  // snapshot/transition metadata is insufficient or pagination makes a patch unsafe.
  if (reporterScopeChanged) {
    try {
      const queueBadgeExact = !reporterQueueChanged || applyReporterQueueBadgeEvents(events);
      const overdueBadgeExact = !reporterOverdueChanged || applyReporterOverdueBadgeEvents(events);
      const recentBadgeExact = !reporterRecentChanged || applyReporterRecentBadgeEvents(events);
      const patched = applyReporterSnapshotEvents(events);

      if (recentBadgeExact) recentTotal = recentBadgeCount;
      syncOperationsNavBadge();
      syncOperationalTabBadges();

      const tasks: Promise<void>[] = [];
      if (reporterQueueChanged && activeSection === "operations" && !patched.queueExact) {
        tasks.push(loadReporterQueueSnapshot());
      }
      if (reporterOverdueChanged && activeSection === "overdue" && !patched.overdueExact) {
        tasks.push(loadReporterOverdueSnapshot());
      }
      if (reporterRecentChanged && activeSection === "results" && !patched.recentExact) {
        tasks.push(loadReporterRecentSnapshot());
      }

      const needsCounterReconcile =
        (reporterQueueChanged && !queueBadgeExact && activeSection !== "operations") ||
        (reporterOverdueChanged && !overdueBadgeExact && activeSection !== "overdue") ||
        (reporterRecentChanged && !recentBadgeExact && activeSection !== "results");
      if (needsCounterReconcile) tasks.push(loadReporterTabCounters(true));

      if (tasks.length) await Promise.all(tasks);
      if (reporterRelevant) patchActiveSection(true);
    } catch {
      return false;
    }
  }

  if (hrRelevant) {
    try {
      hrEventSync = await getHrEventSyncState();
      const status = String(hrEventSync.sync?.status || "");
      if (status === "CONFIRM_REQUIRED") setNotice("warning", "Nguồn nhân sự vừa thay đổi và cần Admin/Root xác nhận.");
      else if (status === "HARD_BLOCK") setNotice("error", "Đồng bộ nhân sự đang bị chặn. Mở Nguồn nhân sự & đồng bộ Picker để xem dòng lỗi và cách xử lý.");
      if (activeSection === "hr") patchActiveSection(true);
    } catch {
      return false;
    }
  }

  if (!pickerRelevant && !reporterRelevant && !slaRelevant && !scheduleRelevant && !hrRelevant) return true;
  if (hrRelevant && activeSection === "hr") return true;
  if (reporterRelevant && !pickerRelevant && !slaRelevant && !scheduleRelevant) return true;
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
window.addEventListener("pageshow", () => {
  // D141: browsers may restore form controls on reload/back-forward navigation.
  // Re-assert explicit SLA server/draft authority after page restoration.
  requestAnimationFrame(() => syncSlaModeControlsFromState());
  // D166: a suspended browser may throttle the one-shot expiry timer.
  // Recheck visibility locally before presenting any edit control again.
  scheduleCorrectionExpiry();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleCorrectionExpiry();
});

async function bootstrap(): Promise<void> {
  if (!hasSession()) { renderLogin(); return; }
  try {
    profile = await getMyProfile();
    markWebUpdateReceived();
    restoreDashboardRangeForUser(profile.user_id);
    dashboardPreferenceLoadedUserId = "";
    sessionViewGeneration += 1;
    activeSection = resolveInitialSection(profile);
    syncSectionHistory(activeSection, "replace");
    await loadSection(activeSection);
    if (roleCanResolve()) await loadD167MealState().catch(() => undefined);
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
  web_version: WEB_VERSION,
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
  if (!hasSession() || !profile || !roleManage() || activeSection !== "dashboard") return;
  void getRealtimePresence().then((next) => {
    realtimePresence = next;
    patchActiveSection(true);
  }).catch((error) => runtimeLogEvent(`Không cập nhật được số người online: ${error instanceof Error ? error.message : "unknown"}`, "ERROR"));
}, 30_000);

void bootstrap();
