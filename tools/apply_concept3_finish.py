#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_API = ROOT / "web/src/api.ts"
WEB_MAIN = ROOT / "web/src/main.ts"
WEB_CSS = ROOT / "web/src/styles.css"
ANDROID = ROOT / "android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt"
STATE = ROOT / "ops/project-state.json"
REGISTRY = ROOT / "ops/resource-registry.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"PATCH_FAIL {label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, new_block: str, label: str) -> str:
    left = text.find(start)
    if left < 0:
        raise SystemExit(f"PATCH_FAIL {label}: start marker missing")
    right = text.find(end, left)
    if right < 0:
        raise SystemExit(f"PATCH_FAIL {label}: end marker missing")
    if text.find(start, left + len(start)) >= 0 and text.find(start, left + len(start)) < right:
        raise SystemExit(f"PATCH_FAIL {label}: duplicate start marker")
    return text[:left] + new_block + text[right:]


def patch_web_api() -> None:
    text = WEB_API.read_text(encoding="utf-8")
    marker = '''export interface HrSyncPreview {
  status: "preview";
  total_source: number;
  create: number;
  reactivate: number;
  rename: number;
  disable: number;
  unchanged: number;
  collisions: Array<{ employee_code: string; role: string; user_id: string }>;
}
'''
    addition = marker + '''
export interface HrSourceConfig {
  sheet_id: string;
  sheet_url: string;
  tab_name: string;
  mnv_header: string;
  full_name_header: string;
  header_row: number;
  data_row_count: number;
  verified_at: string;
  updated_at?: string;
  runtime_service_account?: string;
}

export interface HrSourceResponse {
  configured: boolean;
  source: HrSourceConfig | null;
}

export interface HrSourceSaveResponse {
  status: "saved";
  source: HrSourceConfig;
}
'''
    text = replace_once(text, marker, addition, "web-api-hr-types")
    text = replace_once(
        text,
        '''export async function getHrSource(): Promise<unknown> { return readJson(await authorizedFetch("/api/admin/hr-source")); }
export async function saveHrSource(sheetUrl: string, tabName: string): Promise<unknown> {
  return readJson(await authorizedFetch("/api/admin/hr-source", { method: "PUT", body: JSON.stringify({ sheet_url: sheetUrl, tab_name: tabName }) }));
}
''',
        '''export async function getHrSource(): Promise<HrSourceResponse> { return readJson(await authorizedFetch("/api/admin/hr-source")); }
export async function saveHrSource(sheetUrl: string, tabName: string): Promise<HrSourceSaveResponse> {
  return readJson(await authorizedFetch("/api/admin/hr-source", { method: "PUT", body: JSON.stringify({ sheet_url: sheetUrl, tab_name: tabName }) }));
}
''',
        "web-api-hr-functions",
    )
    WEB_API.write_text(text, encoding="utf-8")


def patch_web_main() -> None:
    text = WEB_MAIN.read_text(encoding="utf-8")
    text = replace_once(text, '  type HrSyncPreview,\n', '  type HrSyncPreview,\n  type HrSourceResponse,\n', 'web-import-hr-source')
    text = replace_once(text, 'let hrSyncPreview: HrSyncPreview | null = null;\n', 'let hrSyncPreview: HrSyncPreview | null = null;\nlet hrSourceState: HrSourceResponse | null = null;\n', 'web-state-hr-source')

    nav_start = 'function renderNav(): string {'
    nav_end = 'function renderBatchDetails(batchId: string): string {'
    nav_block = '''function renderNav(): string {
  if (!profile) return "";
  const tabs: Array<[Section, string]> = [];
  if (canManage()) tabs.push(["dashboard", "Tổng quan"]);
  if (canOperate()) tabs.push(["operations", "Hàng chờ"]);
  if (canManage()) tabs.push(["reports", "Báo cáo"], ["sku", "Master SKU"], ["hr", "Nhân sự"]);
  tabs.push(["account", "Tài khoản"]);
  if (!tabs.some(([id]) => id === activeSection)) activeSection = tabs[0][0];
  return `<nav class="tabs" aria-label="Điều hướng chính">${tabs.map(([id, label]) => `<button class="tab ${activeSection === id ? "active" : ""}" data-section="${id}" ${activeSection === id ? 'aria-current="page"' : ""}>${escapeHtml(label)}</button>`).join("")}</nav>`;
}

'''
    text = replace_between(text, nav_start, nav_end, nav_block, 'web-nav')

    sku_marker = 'function renderSkuPage(): string {'
    sku_helper = '''function renderSkuStatus(): string {
  if (!skuStatus) return "";
  const upper = skuStatus.toUpperCase();
  const tone = upper.includes("FAIL") || upper.includes("CHƯA HOÀN TẤT") ? "error" : upper.includes("PASS") || upper.includes("THÀNH CÔNG") ? "success" : "info";
  return `<div id="sku-status" class="status-panel ${tone}" role="status" aria-live="polite"><div class="status-panel-title">${tone === "error" ? "Cần kiểm tra" : tone === "success" ? "Trạng thái xử lý" : "Đang xử lý"}</div><div class="status-panel-body">${escapeHtml(skuStatus).replaceAll("\\n", "<br>")}</div></div>`;
}

'''
    if sku_helper not in text:
        text = text.replace(sku_marker, sku_helper + sku_marker, 1)
    text = replace_once(text, '${skuStatus ? `<pre id="sku-status">${escapeHtml(skuStatus)}</pre>` : ""}', '${renderSkuStatus()}', 'web-sku-status-panel')

    hr_start = 'function renderHrPage(): string {'
    hr_end = 'function renderAccountPage(): string {'
    hr_block = '''function renderHrPage(): string {
  const createRole = profile?.role === "ROOT" ? "ADMIN" : "REPORTER";
  const manageableRole = createRole;
  const source = hrSourceState?.source || null;
  const sourceSummary = source ? `<div class="source-summary"><div class="source-summary-head"><div><span class="status ok">✓ Nguồn hợp lệ</span><h4>${escapeHtml(source.tab_name)}</h4></div><a class="text-link" href="${escapeHtml(source.sheet_url)}" target="_blank" rel="noopener noreferrer">Mở Google Sheet</a></div><div class="summary-grid"><div><span>Dữ liệu</span><strong>${Number(source.data_row_count || 0).toLocaleString("vi-VN")} dòng</strong></div><div><span>Cột MNV</span><strong>${escapeHtml(source.mnv_header)}</strong></div><div><span>Cột họ tên</span><strong>${escapeHtml(source.full_name_header)}</strong></div><div><span>Xác minh</span><strong>${escapeHtml(fmtDate(source.verified_at))}</strong></div></div></div>` : `<div class="source-summary empty"><span class="status closed">Chưa cấu hình</span><p class="muted">Nhập link Google Sheet và tên tab chính xác, sau đó hệ thống sẽ kiểm tra quyền đọc và hai cột MNV + Họ tên trước khi lưu.</p></div>`;
  const preview = hrSyncPreview ? `<div class="detail-panel"><div class="section-head compact-head"><div><strong>Đối chiếu Picker</strong><p class="tiny">Kiểm tra thay đổi trước khi áp dụng vào tài khoản.</p></div><span class="badge">${hrSyncPreview.total_source.toLocaleString("vi-VN")} nhân sự nguồn</span></div><div class="summary-grid sync-grid"><div><span>Thêm</span><strong>${hrSyncPreview.create}</strong></div><div><span>Kích hoạt lại</span><strong>${hrSyncPreview.reactivate}</strong></div><div><span>Đổi tên</span><strong>${hrSyncPreview.rename}</strong></div><div><span>Ngừng hoạt động</span><strong>${hrSyncPreview.disable}</strong></div></div>${hrSyncPreview.collisions.length ? `<div class="status-panel error"><div class="status-panel-title">Không thể đồng bộ</div><div class="status-panel-body">Có ${hrSyncPreview.collisions.length} MNV đang trùng tài khoản không phải Picker.</div></div>` : `<button id="apply-hr-sync" class="block-gap">Xác nhận đồng bộ Picker</button>`}</div>` : "";
  const userRows = managedUsers.length ? `<div class="table-wrap"><table><thead><tr><th>MNV/User</th><th>Họ tên</th><th>Role</th><th>Trạng thái</th><th>Mật khẩu</th><th>Thao tác</th></tr></thead><tbody>${managedUsers.map((user) => { const canEdit = user.role === manageableRole; return `<tr><td><b>${escapeHtml(user.employee_code || user.user_id)}</b></td><td>${escapeHtml(user.display_name)}</td><td><span class="badge role-badge">${escapeHtml(user.role)}</span></td><td><span class="status ${user.status === "ACTIVE" ? "ok" : "closed"}">${user.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}</span></td><td>${user.password_initialized ? "Đã khởi tạo" : "Mặc định"}</td><td>${canEdit ? `<div class="table-actions"><button class="secondary small-btn" data-user-toggle="${escapeHtml(user.user_id)}" data-next-status="${user.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}" data-user-name="${escapeHtml(user.display_name)}">${user.status === "ACTIVE" ? "Ngừng hoạt động" : "Mở lại"}</button><button class="secondary small-btn" data-user-reset="${escapeHtml(user.user_id)}">Reset mật khẩu</button></div>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty-state">Chưa tải danh sách tài khoản.</div>`;
  return `<section class="page-stack"><div><p class="eyebrow">Nhân sự & tài khoản</p><h2>Quản lý nhân sự</h2><p class="muted">Picker lấy từ HR Sheet. ROOT tạo ADMIN; ADMIN tạo REPORTER. Tài khoản mất khỏi HR không bị xoá lịch sử mà chuyển ngừng hoạt động.</p></div><div class="settings-grid"><article class="card"><div class="card-head"><div><h3>Nguồn Google Sheet</h3><p class="muted tiny">Nguồn được ghim sau khi backend kiểm tra hợp lệ.</p></div><button id="load-hr" class="secondary small-btn">Tải cấu hình</button></div>${sourceSummary}<form id="hr-form" class="stack block-gap"><label>Google Sheet URL<input name="sheetUrl" type="url" value="${escapeHtml(source?.sheet_url || "")}" placeholder="https://docs.google.com/spreadsheets/d/..." required /></label><label>Tên tab chính xác<input name="tabName" value="${escapeHtml(source?.tab_name || "Nhân sự")}" required /></label><button>Xác nhận & cập nhật nguồn</button></form><button id="preview-hr-sync" class="secondary full block-gap">Kiểm tra đồng bộ Picker</button>${preview}</article><article class="card"><h3>Tạo ${createRole}</h3><p class="muted tiny">${profile?.role === "ROOT" ? "Root quản lý tài khoản Admin." : "Admin quản lý tài khoản Reporter."}</p><form id="managed-user-form" class="stack block-gap"><label>Tên đăng nhập / MNV<input name="username" placeholder="Nhập tên đăng nhập" required /></label><label>Họ tên<input name="displayName" placeholder="Nhập họ tên" required /></label><button>Tạo ${createRole}</button></form><p class="tiny">Tài khoản mới dùng mật khẩu mặc định từ bootstrap secret; mật khẩu không được hiển thị hoặc lưu trong source.</p></article></div><article class="card"><div class="section-head"><div><h3>Danh sách tài khoản</h3><p class="muted tiny">ROOT được bảo vệ; Picker do HR quản lý; chỉ role thuộc phạm vi của cấp hiện tại mới có thao tác.</p></div><button id="load-users" class="secondary">Tải lại</button></div>${userRows}</article></section>`;
}

'''
    text = replace_between(text, hr_start, hr_end, hr_block, 'web-hr-page')

    text = text.replace('autocomplete="username" value="root" required', 'autocomplete="username" placeholder="Tên đăng nhập / MNV" required')
    old_header = '<p class="muted">Mạng: ${navigator.onLine ? "Online" : "Offline"} · Dịch vụ: Beta</p>'
    new_header = '<div class="service-line"><span class="service-indicator ${navigator.onLine ? "online" : "offline"}"><i></i>${navigator.onLine ? "Đang kết nối" : "Mất kết nối"}</span><span class="muted tiny">Beta · cập nhật realtime khi có mạng</span></div>'
    text = replace_once(text, old_header, new_header, 'web-network-header')

    text = replace_once(text, 'managedUsers = []; hrSyncPreview = null; dashboardData = null;', 'managedUsers = []; hrSyncPreview = null; hrSourceState = null; dashboardData = null;', 'web-logout-state')
    text = replace_once(
        text,
        '  else if (section === "hr" && canManage()) await loadManagedUsers();\n',
        '  else if (section === "hr" && canManage()) { await Promise.all([loadHrSource(false), loadManagedUsers(false)]); render(); }\n',
        'web-hr-section-load',
    )

    old_save = '''async function handleHrSave(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  try { const result = await saveHrSource(String(form.get("sheetUrl") || ""), String(form.get("tabName") || "")); message = "Nguồn nhân sự đã được kiểm tra và cập nhật."; const output = document.querySelector<HTMLElement>("#hr-result"); if (output) output.textContent = JSON.stringify(result, null, 2); }
  catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được nguồn nhân sự."; render(); }
}

async function handleHrLoad(): Promise<void> {
  try { const output = document.querySelector<HTMLElement>("#hr-result"); if (output) output.textContent = JSON.stringify(await getHrSource(), null, 2); }
  catch (error) { message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự."; render(); }
}
'''
    new_save = '''async function handleHrSave(event: SubmitEvent): Promise<void> {
  event.preventDefault(); const form = new FormData(event.currentTarget as HTMLFormElement);
  busy = true; message = "Đang kiểm tra Google Sheet..."; render();
  try {
    const result = await saveHrSource(String(form.get("sheetUrl") || ""), String(form.get("tabName") || ""));
    hrSourceState = { configured: true, source: result.source };
    hrSyncPreview = null;
    message = `Nguồn nhân sự hợp lệ: ${Number(result.source.data_row_count || 0).toLocaleString("vi-VN")} dòng.`;
  } catch (error) { message = error instanceof Error ? error.message : "Không cập nhật được nguồn nhân sự."; }
  finally { busy = false; render(); }
}

async function loadHrSource(renderAfter = true): Promise<void> {
  if (!canManage()) return;
  try { hrSourceState = await getHrSource(); }
  catch (error) { message = error instanceof Error ? error.message : "Không đọc được nguồn nhân sự."; }
  if (renderAfter) render();
}

async function handleHrLoad(): Promise<void> { await loadHrSource(); }
'''
    text = replace_once(text, old_save, new_save, 'web-hr-handlers')

    # Render network status changes immediately without polling.
    tail = '''render();
void restoreSession();'''
    tail_new = '''window.addEventListener("online", () => render());
window.addEventListener("offline", () => render());
render();
void restoreSession();'''
    text = replace_once(text, tail, tail_new, 'web-network-listeners')

    WEB_MAIN.write_text(text, encoding="utf-8")


def patch_web_css() -> None:
    text = WEB_CSS.read_text(encoding="utf-8")
    additions = r'''

/* Concept 3 finish: human-readable states and denser operational ergonomics. */
.service-line { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:5px; }
.service-indicator { display:inline-flex; align-items:center; gap:7px; font-size:.79rem; font-weight:750; color:#4b5d53; }
.service-indicator i { width:8px; height:8px; border-radius:999px; background:#94a3a0; box-shadow:0 0 0 3px #edf3ef; }
.service-indicator.online i { background:var(--green-600); box-shadow:0 0 0 3px var(--green-100); }
.service-indicator.offline { color:#9a5308; }
.service-indicator.offline i { background:#d97706; box-shadow:0 0 0 3px var(--orange-100); }
.status-panel { margin-top:14px; padding:13px 14px; border:1px solid var(--line); border-radius:11px; background:#f7faf8; }
.status-panel.success { background:#f0faf4; border-color:#cce7d6; }
.status-panel.info { background:#f7faf8; }
.status-panel.error { background:#fff5f4; border-color:#efc3bf; }
.status-panel-title { font-weight:800; color:#244734; margin-bottom:5px; }
.status-panel.error .status-panel-title { color:var(--red-700); }
.status-panel-body { color:#56675e; font-size:.85rem; line-height:1.55; word-break:break-word; }
.settings-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(310px,.65fr); gap:14px; align-items:start; }
.source-summary { margin-top:12px; border:1px solid #dce9e1; background:#f8fbf9; border-radius:11px; padding:14px; }
.source-summary.empty { display:grid; gap:8px; }
.source-summary.empty p { margin:0; }
.source-summary-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
.source-summary-head h4 { margin:8px 0 0; font-size:1rem; color:#244734; }
.summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; margin-top:13px; }
.summary-grid > div { min-width:0; padding:10px 11px; border-radius:9px; background:#fff; border:1px solid #e4ede7; display:grid; gap:3px; }
.summary-grid span { color:#738178; font-size:.74rem; }
.summary-grid strong { color:#2b4636; font-size:.88rem; overflow-wrap:anywhere; }
.sync-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
.text-link { color:var(--green-700); font-weight:750; font-size:.82rem; text-decoration:none; white-space:nowrap; }
.text-link:hover { text-decoration:underline; }
.compact-head { align-items:center; }
.table-actions { display:flex; gap:6px; flex-wrap:wrap; min-width:210px; }
.role-badge { padding:4px 8px; font-size:.7rem; }
#sku-status { white-space:normal; }
.login-card form { margin-top:18px; }
.login-card .brand-mark { box-shadow:0 7px 18px rgba(8,116,67,.16); }
.workspace-head { position:sticky; top:0; z-index:5; padding:8px 0 12px; background:linear-gradient(#f4f8f5 78%,rgba(244,248,245,0)); }
@media (max-width:1100px) { .settings-grid { grid-template-columns:1fr; } .summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:760px) {
  .sidebar { padding:12px; gap:12px; border-right:0; border-bottom:1px solid var(--line); }
  .brand { padding:0 2px; }
  .tabs { display:flex; overflow-x:auto; gap:6px; padding-bottom:2px; scrollbar-width:thin; }
  .tab { width:auto; min-width:max-content; padding:9px 12px; }
  .sidebar-foot { grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; }
  .sidebar-foot .full { width:auto; }
  .user-mini { border-top:0; padding:0 2px; }
  .workspace-head { top:0; }
  .summary-grid,.sync-grid { grid-template-columns:1fr 1fr; }
  .source-summary-head { flex-direction:column; }
  .table-actions { min-width:0; }
}
@media (max-width:480px) { .summary-grid,.sync-grid { grid-template-columns:1fr; } .sidebar-foot { grid-template-columns:1fr; } .sidebar-foot .full { width:100%; } }
'''
    if '/* Concept 3 finish:' not in text:
        text += additions
    WEB_CSS.write_text(text, encoding="utf-8")


def patch_android() -> None:
    text = ANDROID.read_text(encoding="utf-8")
    text = replace_once(
        text,
        '    private val conceptOrangeSoft = Color.parseColor("#FFF0D9")\n',
        '    private val conceptOrangeSoft = Color.parseColor("#FFF0D9")\n    private val conceptRed = Color.parseColor("#B42318")\n    private val conceptRedSoft = Color.parseColor("#FEE4E2")\n    private val conceptGraySoft = Color.parseColor("#EDF1EE")\n',
        'android-semantic-colors',
    )

    picker_status = '''            card.addView(TextView(this).apply {
                text = businessStatus
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(statusColor(businessStatus))
                setPadding(0, dp(5), 0, dp(5))
            })
'''
    text = replace_once(text, picker_status, '            card.addView(statusBadge(businessStatus))\n', 'android-picker-status-badge')

    recent_status = '''            card.addView(TextView(this).apply {
                text = "$label · ${row.affectedPickerCount} Picker · ${fmtDate(row.resolvedAt)}"
                setTextColor(statusColor(label))
                textSize = 13f
            })
'''
    recent_new = '''            card.addView(statusBadge(label))
            card.addView(TextView(this).apply {
                text = "${row.affectedPickerCount} Picker · ${fmtDate(row.resolvedAt)}"
                setTextColor(conceptMuted)
                textSize = 12.5f
                setPadding(0, dp(5), 0, 0)
            })
'''
    text = replace_once(text, recent_status, recent_new, 'android-recent-status-badge')

    old_set_status = '''    private fun setStatus(message: String) {
        if (::status.isInitialized) status.text = message
    }
'''
    new_set_status = '''    private fun setStatus(message: String) {
        if (!::status.isInitialized) return
        status.text = message
        val normalized = message.lowercase()
        val isError = listOf("lỗi", "không thể", "không hợp lệ", "thất bại", "hết hạn", "không kiểm tra được", "không đồng bộ được").any { normalized.contains(it) }
        val isAttention = !isError && listOf("đang ", "cần ", "chờ ", "hết thời gian").any { normalized.contains(it) }
        val fill = when { isError -> conceptRedSoft; isAttention -> conceptOrangeSoft; else -> conceptGreenSoft }
        val stroke = when { isError -> Color.parseColor("#E7A5A1"); isAttention -> Color.parseColor("#F2C78B"); else -> conceptLine }
        val textColor = when { isError -> conceptRed; isAttention -> conceptOrange; else -> conceptGreenDark }
        status.setTextColor(textColor)
        status.background = roundedBackground(fill, stroke, 10)
    }
'''
    text = replace_once(text, old_set_status, new_set_status, 'android-semantic-status')

    status_color_marker = '    private fun statusColor(label: String): Int = when (label) {'
    status_badge = '''    private fun statusBadge(label: String): TextView = TextView(this).apply {
        text = label
        textSize = 12.5f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(statusColor(label))
        val fill = when (label) {
            "Đã có hàng" -> conceptGreenSoft
            "Được skip", "Đang xử lý" -> conceptOrangeSoft
            else -> conceptGraySoft
        }
        val stroke = when (label) {
            "Đã có hàng" -> Color.parseColor("#C7E3D2")
            "Được skip", "Đang xử lý" -> Color.parseColor("#F2C78B")
            else -> conceptLine
        }
        background = roundedBackground(fill, stroke, 999)
        setPadding(dp(10), dp(5), dp(10), dp(5))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(7)
            bottomMargin = dp(2)
        }
    }

'''
    text = text.replace(status_color_marker, status_badge + status_color_marker, 1)

    old_apply = '''    private fun applyConcept3Tree(view: View) {
        when (view) {
            is Button -> styleButton(view)
            is EditText -> styleInput(view)
            is CheckBox -> view.buttonTintList = ColorStateList.valueOf(conceptGreen)
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) applyConcept3Tree(view.getChildAt(index))
        }
    }
'''
    new_apply = '''    private fun addVerticalControlSpacing(view: View) {
        val parent = view.parent as? LinearLayout ?: return
        if (parent.orientation != LinearLayout.VERTICAL || parent.indexOfChild(view) <= 0) return
        val params = view.layoutParams as? LinearLayout.LayoutParams ?: return
        if (params.topMargin < dp(8)) params.topMargin = dp(8)
        view.layoutParams = params
    }

    private fun applyConcept3Tree(view: View) {
        when (view) {
            is Button -> { styleButton(view); addVerticalControlSpacing(view) }
            is EditText -> { styleInput(view); addVerticalControlSpacing(view) }
            is CheckBox -> { view.buttonTintList = ColorStateList.valueOf(conceptGreen); addVerticalControlSpacing(view) }
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) applyConcept3Tree(view.getChildAt(index))
        }
    }
'''
    text = replace_once(text, old_apply, new_apply, 'android-control-spacing')

    old_fatal = '''    private fun renderFatal(message: String) {
        val root = page()
        root.addView(TextView(this).apply {
            text = "SUPRA Inventory — Beta"
            textSize = 24f
            setTypeface(typeface, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = message
            setTextColor(Color.RED)
            setPadding(0, dp(12), 0, 0)
        })
        setContentView(wrapScroll(root))
    }
'''
    new_fatal = '''    private fun renderFatal(message: String) {
        val root = page()
        addBrandHeader(root, subtitle = "Báo hàng · Beta", meta = "")
        val fatalCard = card()
        fatalCard.addView(TextView(this).apply {
            text = "Không thể khởi động ứng dụng"
            textSize = 18f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(conceptRed)
        })
        fatalCard.addView(TextView(this).apply {
            text = message
            textSize = 13f
            setTextColor(conceptRed)
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = roundedBackground(conceptRedSoft, Color.parseColor("#E7A5A1"), 10)
        })
        root.addView(fatalCard)
        setContentView(wrapScroll(root))
    }
'''
    text = replace_once(text, old_fatal, new_fatal, 'android-fatal-card')
    ANDROID.write_text(text, encoding="utf-8")


def update_state_pending() -> None:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    state["current_status"]["web"] = "CONCEPT3_FINISH_POLISH_SOURCE_BUILD_DEPLOY_PENDING"
    state["current_status"]["android"] = "CONCEPT3_FINISH_POLISH_SOURCE_SIGNED_OTA_PENDING"
    pending = "Concept 3 finish polish: Web humanized HR/status/responsive + Android semantic status/pills/spacing — Beta verification pending"
    if pending not in state["completed_capabilities"]:
        state["completed_capabilities"].append(pending)
    state["next_action"]["primary"] = "Verify Concept 3 finish Web deploy and signed Android Beta release, then physical PDA realtime/FCM and Owner business acceptance."
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    registry["ui_design"]["web"] = "CONCEPT3_FINISH_POLISH_BUILD_DEPLOY_PENDING"
    registry["ui_design"]["android"] = "CONCEPT3_FINISH_POLISH_SIGNED_OTA_PENDING"
    REGISTRY.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    patch_web_api()
    patch_web_main()
    patch_web_css()
    patch_android()
    update_state_pending()
    print("CONCEPT3_FINISH_PATCH_PASS")


if __name__ == "__main__":
    main()
