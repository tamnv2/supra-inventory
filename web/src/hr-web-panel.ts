import type { HrSyncPreview } from "./api";
import type { HrEmployeeInput } from "./hr-excel";

function esc(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderHrWeb(rows: HrEmployeeInput[], preview: HrSyncPreview | null, filename: string, tabs: string, canManage: boolean): string {
  if (!canManage) return `<section class="ops-route people-workspace"><div class="business-page-head"><h2>Nhân sự & tài khoản</h2></div>${tabs}<div class="ops-readonly">Chỉ Admin/Root được phép nhập nhân sự Picker.</div></section>`;
  const conflictCount = preview?.collisions?.length || 0;
  const changeCount = Number(preview?.rename || 0) + Number(preview?.contractor_update || 0);
  return `<section class="ops-route people-workspace">
    <div class="business-page-head"><div><h2>Nhân sự & tài khoản</h2><p>Nhập trực tiếp hoặc tải Excel mẫu; dữ liệu chỉ được ghi sau khi xem trước và xác nhận.</p></div></div>
    ${tabs}
    <div class="ops-layout">
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Nhập một Picker</h3><p>Điền đủ mã nhân viên, họ tên và Nhà thầu.</p></div></div>
        <form id="hr-manual-form" class="ops-form-grid">
          <label>Mã nhân viên<input name="employeeCode" required maxlength="64" autocomplete="off" /></label>
          <label>Họ và tên<input name="displayName" required maxlength="200" autocomplete="off" /></label>
          <label>Nhà thầu<input name="contractorName" required maxlength="200" autocomplete="off" /></label>
          <div class="ops-form-actions"><button class="primary" type="submit">Kiểm tra thông tin</button></div>
        </form>
      </article>
      <article class="ops-panel">
        <div class="ops-panel-title"><div><h3>Nhập danh sách bằng Excel</h3><p>Tải mẫu .xlsx, nhập thông tin và kiểm tra trước khi áp dụng.</p></div></div>
        <div class="ops-form-actions"><button class="secondary" id="download-hr-example" type="button">Tải file Excel mẫu</button></div>
        <div class="ops-form-grid"><label class="span">Chọn file .xlsx<input id="hr-excel-file" type="file" accept=".xlsx" /></label></div>
        <div class="ops-note">Các mã nhân viên không xuất hiện trong file sẽ được giữ nguyên; không tự xóa, khóa hay bật lại tài khoản cũ.</div>
      </article>
    </div>
    <article class="ops-panel">
      <div class="ops-panel-title"><div><h3>Xem trước và xử lý mâu thuẫn</h3><p>Không ghi dữ liệu trước khi xác nhận.</p></div><span>${esc(filename || "Nhập trực tiếp")}</span></div>
      ${rows.length ? `<section class="ops-status-strip"><span>Mã hợp lệ <b>${rows.length}</b></span><span>Tạo mới <b>${Number(preview?.create || 0)}</b></span><span>Đổi tên <b>${Number(preview?.rename || 0)}</b></span><span>Đổi Nhà thầu <b>${Number(preview?.contractor_update || 0)}</b></span><span>Không đổi <b>${Number(preview?.unchanged || 0)}</b></span></section>` : '<div class="ops-empty">Chưa nhập thông tin nhân sự.</div>'}
      ${conflictCount ? `<div class="notice error"><b>Không thể áp dụng:</b> ${conflictCount} mã trùng tài khoản không phải Picker. ${preview?.collisions.slice(0,10).map(x => esc(x.employee_code) + " (" + esc(x.role) + ")").join(", ")}</div>` : ""}
      ${changeCount ? `<div class="notice warning">${changeCount} thay đổi tên/Nhà thầu cần phê duyệt trước khi ghi.</div>` : ""}
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Mã nhân viên</th><th>Họ và tên</th><th>Nhà thầu</th></tr></thead><tbody>${rows.slice(0,20).map(row => `<tr><td>${esc(row.employee_code)}</td><td>${esc(row.display_name)}</td><td>${esc(row.contractor_name)}</td></tr>`).join("")}</tbody></table></div>${rows.length > 20 ? `<p class="muted">Đang hiển thị 20 / ${rows.length} dòng.</p>` : ""}` : ""}
      ${preview && !conflictCount && rows.length ? `<div class="ops-form-actions"><button class="primary" id="hr-apply-web" type="button">Xác nhận ghi ${rows.length} nhân sự</button></div>` : ""}
    </article>
  </section>`;
}
