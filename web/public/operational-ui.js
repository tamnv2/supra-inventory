(() => {
  const SESSION_KEY = "supra_inventory_beta_session_v1";
  const FOOTER = "Phát triển và duy trì bởi: tamnv2 - Chuyên viên Pick Pack 1291";
  const NAV = {
    dashboard: ["Tổng quan vận hành", "chart"],
    operations: ["Hàng chờ xử lý", "queue"],
    reports: ["Báo cáo vận hành", "report"],
    sku: ["Danh mục Master SKU", "sku"],
    hr: ["Quản lý nhân sự", "people"],
    account: ["Quản lý tài khoản", "user"],
  };
  const ICONS = {
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>',
    queue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 4h14v16H5z"/><path d="M8 8h8m-8 4h5"/><path d="M17.5 14.5v3m0 2h.01"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6m-6 4h6m-6 4h4"/></svg>',
    sku: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M8 9v10"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7m1-6c3 0 5 2 5 5"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3.2-8 8-8s8 3 8 8"/></svg>',
  };
  const BRAND_SVG = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="5" y="5" width="38" height="38" rx="10" fill="#087443"/><path d="M14 17l10-5 10 5-10 5-10-5Z" fill="white"/><path d="M14 17v14l10 5 10-5V17M24 22v14" stroke="white" stroke-width="2.4" stroke-linejoin="round"/><circle cx="34" cy="13" r="6" fill="#F59E0B"/><path d="M34 10v4m0 2h.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  }
  function saveSession(session) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  async function token() {
    const session = getSession();
    if (!session?.id_token) throw new Error("Phiên đăng nhập không hợp lệ.");
    if (Number(session.expires_at || 0) > Date.now() + 30_000) return session.id_token;
    const response = await fetch("/api/auth/refresh", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ refresh_token: session.refresh_token }) });
    const payload = await response.json();
    if (!response.ok || !payload.id_token) throw new Error(payload.message || payload.error || "Không làm mới được phiên đăng nhập.");
    session.id_token = payload.id_token;
    session.refresh_token = payload.refresh_token || session.refresh_token;
    session.expires_at = Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000;
    saveSession(session);
    return session.id_token;
  }
  async function api(path, options = {}) {
    const auth = await token();
    const response = await fetch(path, { ...options, headers: { ...(options.headers || {}), Authorization:`Bearer ${auth}`, "content-type":"application/json" } });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
    if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    return payload;
  }
  function profile() { return getSession()?.user || null; }
  function requestId(prefix) { return `${prefix}:${crypto.randomUUID()}`; }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c])); }

  function addFooter() {
    const host = document.querySelector(".workspace") || document.querySelector(".login-shell") || document.querySelector(".shell");
    if (!host || host.querySelector(".ops-footer")) return;
    const footer = document.createElement("div");
    footer.className = "ops-footer";
    footer.textContent = FOOTER;
    host.appendChild(footer);
  }
  function enhanceBrand() {
    document.querySelectorAll(".brand-mark").forEach((mark) => {
      if (mark.dataset.opsBrand) return;
      mark.dataset.opsBrand = "1";
      mark.classList.add("ops-brand-icon");
      mark.innerHTML = BRAND_SVG;
    });
  }
  function enhanceNav() {
    document.querySelectorAll("button[data-section]").forEach((button) => {
      const item = NAV[button.dataset.section];
      if (!item) return;
      if (button.dataset.opsNav !== item[0]) {
        button.dataset.opsNav = item[0];
        button.textContent = item[0];
        const icon = document.createElement("span");
        icon.className = "ops-nav-icon";
        icon.innerHTML = ICONS[item[1]] || "";
        button.prepend(icon);
      }
    });
    const active = document.querySelector("button[data-section].active")?.dataset.section;
    const title = document.querySelector(".workspace-head h1");
    if (active && title && NAV[active]) title.textContent = NAV[active][0];
  }
  function replaceMnvText() {
    const input = document.querySelector('input[placeholder="Tên đăng nhập / MNV"]');
    if (input) input.placeholder = "Tên đăng nhập / Mã nhân viên";
    document.querySelectorAll("th,label,p,span,strong,h3,h4").forEach((el) => {
      [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach((node) => {
        if (node.nodeValue?.includes("MNV")) node.nodeValue = node.nodeValue.replaceAll("MNV", "Mã nhân viên");
      });
    });
  }

  async function configureHrForm(form) {
    if (form.dataset.opsEnhanced) return;
    form.dataset.opsEnhanced = "1";
    const button = form.querySelector("button");
    const wrap = document.createElement("div");
    wrap.className = "ops-hr-fields";
    wrap.innerHTML = '<label>Tên cột Mã nhân viên<input name="employeeCodeHeader" placeholder="Ví dụ: Mã NV / Employee ID" required /></label><label>Tên cột Họ và tên<input name="fullNameHeader" placeholder="Ví dụ: Họ tên / Full name" required /></label>';
    form.insertBefore(wrap, button);
    try {
      const current = await api("/api/admin/hr-source", { method:"GET" });
      if (current?.source) {
        form.elements.employeeCodeHeader.value = current.source.employee_code_header || current.source.mnv_header || "";
        form.elements.fullNameHeader.value = current.source.full_name_header || "";
      }
    } catch { /* UI remains editable even if source read fails. */ }
  }
  async function saveHrForm(form) {
    const data = new FormData(form);
    const payload = await api("/api/admin/hr-source-v2", {
      method:"PUT",
      body:JSON.stringify({
        sheet_url:String(data.get("sheetUrl") || ""),
        tab_name:String(data.get("tabName") || ""),
        employee_code_header:String(data.get("employeeCodeHeader") || ""),
        full_name_header:String(data.get("fullNameHeader") || ""),
      }),
    });
    alert(`Nguồn nhân sự hợp lệ: ${Number(payload.source?.data_row_count || 0).toLocaleString("vi-VN")} dòng.`);
    document.querySelector("#load-hr")?.click();
  }

  function enhanceCreateForm(form) {
    if (form.dataset.opsEnhanced) return;
    form.dataset.opsEnhanced = "1";
    const user = profile();
    const firstLabel = form.querySelector("label");
    if (firstLabel) {
      [...firstLabel.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => { n.nodeValue = "Tên đăng nhập / Mã nhân viên"; });
    }
    const button = form.querySelector("button");
    const roleLabel = document.createElement("label");
    if (user?.role === "ROOT") {
      roleLabel.innerHTML = '<span>Vai trò tài khoản</span><select name="role" required><option value="REPORTER">Reporter</option><option value="ADMIN">Admin</option></select>';
    } else {
      roleLabel.innerHTML = '<span>Vai trò tài khoản</span><input value="Reporter" disabled /><input type="hidden" name="role" value="REPORTER" />';
    }
    const passLabel = document.createElement("label");
    passLabel.innerHTML = '<span>Mật khẩu khởi tạo</span><input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required />';
    form.insertBefore(roleLabel, button);
    form.insertBefore(passLabel, button);
    button.textContent = "Tạo tài khoản";
  }
  async function submitCreate(form) {
    const data = new FormData(form);
    await api("/api/admin/users", { method:"POST", body:JSON.stringify({
      username:String(data.get("username") || ""), display_name:String(data.get("displayName") || ""),
      role:String(data.get("role") || "REPORTER"), password:String(data.get("password") || ""), request_id:requestId("user-create"),
    }) });
    form.reset();
    alert("Đã tạo tài khoản với mật khẩu được đặt trực tiếp.");
    await renderUserPanel(true);
  }

  function manageable(user, actor) {
    if (!actor || user.role === "ROOT") return false;
    if (actor.role === "ROOT") return ["ADMIN","REPORTER","PICKER"].includes(user.role);
    return actor.role === "ADMIN" && ["REPORTER","PICKER"].includes(user.role);
  }
  async function setPassword(user) {
    const value = prompt(`Nhập mật khẩu mới cho ${user.display_name} (${user.employee_code || user.user_id}). Tối thiểu 8 ký tự:`);
    if (value === null) return;
    await api("/api/admin/users/password", { method:"PUT", body:JSON.stringify({ user_id:user.user_id, password:value, request_id:requestId("password") }) });
    alert("Đã đổi mật khẩu và vô hiệu phiên đăng nhập cũ của tài khoản.");
  }
  async function toggleUser(user) {
    const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (!confirm(`${next === "DISABLED" ? "Ngừng hoạt động" : "Mở lại"} ${user.display_name}?`)) return;
    await api("/api/admin/users", { method:"PATCH", body:JSON.stringify({ user_id:user.user_id, display_name:user.display_name, status:next, request_id:requestId("user-status") }) });
  }
  async function bulkPicker(action, all = false) {
    const panel = document.querySelector("#ops-user-management");
    const selected = [...panel.querySelectorAll('input[data-picker-select]:checked')].map(x => x.value);
    if (!all && !selected.length) return alert("Hãy chọn ít nhất 1 Picker.");
    const label = action === "ENABLE" ? "mở lại" : action === "DISABLE" ? "ngừng hoạt động" : "xóa";
    if (!confirm(`${label[0].toUpperCase()+label.slice(1)} ${all ? "tất cả Picker" : selected.length + " Picker đã chọn"}?${action === "DELETE" ? " Hành động xóa tài khoản không thể hoàn tác; lịch sử báo hàng vẫn được giữ trong dữ liệu nghiệp vụ." : ""}`)) return;
    await api("/api/admin/pickers/bulk", { method:"POST", body:JSON.stringify({ action, all, user_ids:selected, request_id:requestId("picker-bulk") }) });
    await renderUserPanel(true);
  }

  async function renderUserPanel(force = false) {
    const hrPage = document.querySelector("#managed-user-form")?.closest("section.page-stack");
    if (!hrPage) return;
    let panel = document.querySelector("#ops-user-management");
    if (panel && !force) return;
    if (!panel) {
      panel = document.createElement("article");
      panel.id = "ops-user-management";
      panel.className = "card ops-user-card";
      hrPage.appendChild(panel);
    }
    panel.innerHTML = "<h3>Quản lý tài khoản theo vai trò</h3><p class='muted tiny'>ROOT quản lý Admin, Reporter và Picker. Admin quản lý Reporter và Picker. Picker không tự bị ngừng chỉ vì thay đổi nguồn nhân sự.</p><div class='empty-state'>Đang tải tài khoản...</div>";
    try {
      const result = await api("/api/admin/users?limit=1000", { method:"GET" });
      const actor = profile();
      const users = (result.items || []).filter(u => manageable(u, actor));
      const pickerCount = users.filter(u => u.role === "PICKER").length;
      panel.innerHTML = `<div class="section-head"><div><h3>Quản lý tài khoản theo vai trò</h3><p class="muted tiny">ROOT quản lý Admin, Reporter và Picker. Admin quản lý Reporter và Picker.</p></div><button class="secondary" data-ops-reload>Tải lại danh sách</button></div>
        <div class="ops-picker-note">Đồng bộ nguồn nhân sự chỉ thêm/cập nhật Picker có trong nguồn; Picker cũ không tự bị xóa hoặc ngừng hoạt động. Trạng thái làm/nghỉ do người quản trị chủ động quyết định.</div>
        <div class="ops-user-toolbar"><strong>Picker: ${pickerCount}</strong><button class="secondary small-btn" data-picker-bulk="ENABLE">Mở lại đã chọn</button><button class="secondary small-btn" data-picker-bulk="DISABLE">Ngừng đã chọn</button><button class="ops-danger small-btn" data-picker-bulk="DELETE">Xóa đã chọn</button><span class="spacer"></span><button class="secondary small-btn" data-picker-all="ENABLE">Mở lại tất cả</button><button class="secondary small-btn" data-picker-all="DISABLE">Ngừng tất cả</button><button class="ops-danger small-btn" data-picker-all="DELETE">Xóa tất cả Picker</button></div>
        <div class="ops-user-table"><table><thead><tr><th><input type="checkbox" data-select-all-picker aria-label="Chọn tất cả Picker đang hiển thị" /></th><th>Mã nhân viên / User</th><th>Họ và tên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${users.map(u => `<tr><td>${u.role === "PICKER" ? `<input type="checkbox" data-picker-select value="${esc(u.user_id)}" />` : ""}</td><td><b>${esc(u.employee_code || u.user_id)}</b></td><td>${esc(u.display_name)}</td><td><span class="badge role-badge">${esc(u.role)}</span></td><td><span class="status ${u.status === "ACTIVE" ? "ok" : "closed"}">${u.status === "ACTIVE" ? "Hoạt động" : "Ngừng hoạt động"}</span></td><td><div class="ops-user-actions"><button class="secondary" data-user-toggle-v2="${esc(u.user_id)}">${u.status === "ACTIVE" ? "Ngừng hoạt động" : "Mở lại"}</button><button class="secondary" data-user-password-v2="${esc(u.user_id)}">Đổi mật khẩu</button>${u.role === "PICKER" ? `<button class="ops-danger" data-user-delete-v2="${esc(u.user_id)}">Xóa Picker</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`;
      panel._opsUsers = Object.fromEntries(users.map(u => [u.user_id, u]));
    } catch (error) {
      panel.innerHTML = `<div class="status-panel error"><div class="status-panel-title">Không tải được tài khoản</div><div class="status-panel-body">${esc(error.message)}</div></div>`;
    }
    const legacyList = [...hrPage.querySelectorAll("article.card")].find(card => card !== panel && card.querySelector("h3")?.textContent?.includes("Danh sách tài khoản"));
    legacyList?.classList.add("ops-hidden");
  }

  async function applyHrSync() {
    if (!confirm("Xác nhận đồng bộ nguồn nhân sự? Hệ thống chỉ thêm Picker mới và cập nhật tên. Picker không có trong nguồn mới sẽ giữ nguyên trạng thái hiện tại; không tự xóa, không tự ngừng hoạt động.")) return;
    const result = await api("/api/admin/hr-sync/apply", { method:"POST", body:JSON.stringify({ confirm:true, request_id:requestId("hr-apply") }) });
    alert(`Đã đồng bộ ${Number(result.source_count || 0).toLocaleString("vi-VN")} Picker từ nguồn nhân sự.`);
    await renderUserPanel(true);
  }

  function enhance() {
    document.body.classList.add("concept1-operational");
    addFooter(); enhanceBrand(); enhanceNav(); replaceMnvText();
    const hrForm = document.querySelector("#hr-form"); if (hrForm) configureHrForm(hrForm);
    const createForm = document.querySelector("#managed-user-form"); if (createForm) { enhanceCreateForm(createForm); renderUserPanel(); }
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "hr-form" || form.id === "managed-user-form") {
      event.preventDefault(); event.stopImmediatePropagation();
      try { if (form.id === "hr-form") await saveHrForm(form); else await submitCreate(form); }
      catch (error) { alert(error.message || "Không thực hiện được thao tác."); }
    }
  }, true);

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target.closest("button,input") : null;
    if (!target) return;
    try {
      if (target.id === "apply-hr-sync") {
        event.preventDefault(); event.stopImmediatePropagation(); await applyHrSync(); return;
      }
      const panel = target.closest("#ops-user-management"); if (!panel) return;
      if (target.matches("[data-ops-reload]")) return void await renderUserPanel(true);
      if (target.matches("[data-select-all-picker]")) {
        panel.querySelectorAll("input[data-picker-select]").forEach(x => x.checked = target.checked); return;
      }
      if (target.dataset.pickerBulk) return void await bulkPicker(target.dataset.pickerBulk, false);
      if (target.dataset.pickerAll) return void await bulkPicker(target.dataset.pickerAll, true);
      const users = panel._opsUsers || {};
      if (target.dataset.userToggleV2) { await toggleUser(users[target.dataset.userToggleV2]); await renderUserPanel(true); return; }
      if (target.dataset.userPasswordV2) { await setPassword(users[target.dataset.userPasswordV2]); await renderUserPanel(true); return; }
      if (target.dataset.userDeleteV2) {
        const user = users[target.dataset.userDeleteV2];
        if (!confirm(`Xóa Picker ${user.display_name}? Lịch sử báo hàng vẫn được giữ, nhưng tài khoản Picker sẽ bị xóa khỏi danh sách.`)) return;
        await api("/api/admin/pickers/bulk", { method:"POST", body:JSON.stringify({ action:"DELETE", all:false, user_ids:[user.user_id], request_id:requestId("picker-delete") }) });
        await renderUserPanel(true);
      }
    } catch (error) { alert(error.message || "Không thực hiện được thao tác."); }
  }, true);

  const observer = new MutationObserver(() => enhance());
  observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance); else enhance();
})();
