(() => {
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
      if (button.querySelector(".ops-nav-icon")) return;
      const icon = document.createElement("span");
      icon.className = "ops-nav-icon";
      icon.innerHTML = ICONS[item[1]] || "";
      button.prepend(icon);
    });
  }

  function enhance() {
    document.body.classList.add("concept1-operational");
    enhanceBrand();
    enhanceNav();
  }

  const observer = new MutationObserver(enhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance); else enhance();
})();
