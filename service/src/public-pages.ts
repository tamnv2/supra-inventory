const PUBLIC_INFO_PATHS = new Set(["/about", "/privacy", "/terms"]);

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageShell(options: {
  title: string;
  description: string;
  canonical: string;
  appName: string;
  body: string;
  origin: string;
}): string {
  const nav =
    '<nav class="nav" aria-label="Thông tin ứng dụng">' +
    '<a href="' + options.origin + '/about">Giới thiệu</a>' +
    '<a href="' + options.origin + '/privacy">Chính sách quyền riêng tư</a>' +
    '<a href="' + options.origin + '/terms">Điều khoản sử dụng</a>' +
    '<a href="' + options.origin + '/">Đăng nhập hệ thống</a>' +
    "</nav>";

  return '<!doctype html><html lang="vi"><head>' +
    '<meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<meta name="robots" content="index,follow" />' +
    '<meta name="description" content="' + esc(options.description) + '" />' +
    '<link rel="canonical" href="' + esc(options.canonical) + '" />' +
    '<link rel="icon" type="image/png" href="/app-icon.png" />' +
    "<title>" + esc(options.title) + "</title>" +
    "<style>" +
    ':root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202a;background:#f4f7f6}' +
    '*{box-sizing:border-box}body{margin:0;line-height:1.62}a{color:#096b45;text-underline-offset:3px}' +
    '.wrap{width:min(920px,calc(100% - 32px));margin:32px auto 56px}.card{background:#fff;border:1px solid #dce5e1;border-radius:16px;padding:clamp(22px,4vw,42px);box-shadow:0 8px 28px rgba(14,49,36,.07)}' +
    '.brand{display:flex;align-items:center;gap:14px;padding-bottom:22px;border-bottom:1px solid #e6ece9}.brand img{width:48px;height:48px;border-radius:11px}.brand strong{display:block;font-size:1.08rem}.brand span{display:block;color:#5f6f68;font-size:.93rem}' +
    'h1{font-size:clamp(1.75rem,4vw,2.35rem);line-height:1.2;margin:30px 0 12px}h2{font-size:1.2rem;margin:28px 0 8px}p,li{max-width:78ch}.lead{font-size:1.06rem;color:#35443e}' +
    '.notice{padding:14px 16px;border-radius:10px;background:#eef8f3;border-left:4px solid #087443}.nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:34px;padding-top:22px;border-top:1px solid #e6ece9;font-size:.94rem}' +
    '.meta{margin-top:28px;color:#68756f;font-size:.88rem}.scope{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f4f3;padding:2px 6px;border-radius:5px;word-break:break-all}' +
    'ul{padding-left:22px}@media(max-width:560px){.wrap{width:min(100% - 20px,920px);margin-top:10px}.card{border-radius:12px;padding:20px}.brand img{width:42px;height:42px}}' +
    "</style></head><body><main class=\"wrap\"><article class=\"card\">" +
    '<header class="brand"><img src="/app-icon.png" alt="" /><div><strong>' + esc(options.appName) + "</strong><span>Website nghiệp vụ Inventory · DC Hưng Yên</span></div></header>" +
    options.body + nav +
    '<p class="meta">Cập nhật lần cuối: 29/09/2026 · Hỗ trợ: tam95.supra@gmail.com</p>' +
    "</article></main></body></html>";
}

function aboutPage(origin: string, appName: string): string {
  const body =
    "<h1>Giới thiệu " + esc(appName) + "</h1>" +
    '<p class="lead"><strong>SUPRA Inventory — Báo hàng</strong> là hệ thống nghiệp vụ hỗ trợ quy trình báo SKU hết hàng, điều phối xử lý, quản trị người dùng, báo cáo và lưu trữ dữ liệu vận hành tại DC Hưng Yên.</p>' +
    "<h2>Chức năng chính</h2><ul>" +
    "<li>Picker báo SKU hết hàng và theo dõi kết quả xử lý.</li>" +
    "<li>Reporter/Admin xử lý yêu cầu, theo dõi SLA, lịch sử và báo cáo vận hành.</li>" +
    "<li>Quản trị danh mục SKU, tài khoản, dữ liệu hỗ trợ và các chức năng khôi phục tài khoản.</li></ul>" +
    "<h2>Cách ứng dụng sử dụng Google</h2><p>Ứng dụng chỉ yêu cầu các quyền Google cần thiết cho chức năng đã công bố:</p><ul>" +
    '<li><span class="scope">https://www.googleapis.com/auth/drive.file</span>: tạo, cập nhật và quản lý các tệp Google Drive mà ứng dụng tạo hoặc được người dùng cho phép ứng dụng sử dụng cho lưu trữ/xuất dữ liệu hỗ trợ nghiệp vụ.</li>' +
    '<li><span class="scope">https://www.googleapis.com/auth/gmail.send</span>: gửi email giao dịch do người dùng/hệ thống yêu cầu, gồm mã xác minh và khôi phục tài khoản. Ứng dụng không đọc, tải xuống, sửa hoặc xóa hộp thư Gmail.</li></ul>' +
    '<p class="notice">Dữ liệu Google không được dùng cho quảng cáo, không được bán và không được dùng để xây dựng hồ sơ quảng cáo. Chi tiết được công bố tại Chính sách quyền riêng tư.</p>';
  return pageShell({
    title: "Giới thiệu · " + appName,
    description: "Thông tin chính thức về SUPRA Inventory Beta, chức năng ứng dụng và cách ứng dụng sử dụng quyền Google.",
    canonical: origin + "/about",
    appName,
    body,
    origin,
  });
}

function privacyPage(origin: string, appName: string): string {
  const body =
    "<h1>Chính sách quyền riêng tư</h1>" +
    '<p class="lead">Chính sách này mô tả cách <strong>' + esc(appName) + "</strong> truy cập, sử dụng, lưu trữ và bảo vệ dữ liệu khi người dùng cấp quyền Google cho ứng dụng.</p>" +
    "<h2>1. Dữ liệu Google được truy cập</h2><ul>" +
    '<li><strong>Google Drive:</strong> quyền <span class="scope">drive.file</span> chỉ được dùng với các tệp do ứng dụng tạo hoặc các tệp mà người dùng cho phép ứng dụng sử dụng. Nội dung có thể gồm tệp lưu trữ, báo cáo hoặc dữ liệu hỗ trợ nghiệp vụ do ứng dụng tạo.</li>' +
    '<li><strong>Gmail:</strong> quyền <span class="scope">gmail.send</span> chỉ được dùng để gửi email giao dịch như mã xác minh và liên kết/thông báo khôi phục tài khoản. Ứng dụng không yêu cầu quyền đọc hộp thư và không đọc, tải xuống, phân tích, sửa hoặc xóa email của người dùng.</li></ul>' +
    "<h2>2. Mục đích sử dụng</h2><p>Dữ liệu và quyền Google chỉ được sử dụng để cung cấp các chức năng trực tiếp cho người dùng của SUPRA Inventory: lưu trữ/xuất dữ liệu hỗ trợ nghiệp vụ và gửi email giao dịch phục vụ xác minh hoặc khôi phục tài khoản.</p>" +
    "<h2>3. Lưu trữ và bảo mật</h2><p>Thông tin ủy quyền OAuth cần cho hoạt động backend được lưu dưới dạng secret phía máy chủ và không được đưa vào mã nguồn công khai hoặc phía trình duyệt. Các tệp được tạo trên Google Drive vẫn thuộc tài khoản Google đã cấp quyền và chịu các quy tắc lưu giữ/xóa dữ liệu của ứng dụng và của chủ tài khoản.</p>" +
    "<h2>4. Chia sẻ và chuyển giao dữ liệu</h2><p>Dữ liệu Google không được bán, không được dùng cho quảng cáo và không được chia sẻ với bên thứ ba không liên quan. Việc xử lý có thể đi qua các nhà cung cấp hạ tầng cần thiết để vận hành ứng dụng, chỉ trong phạm vi cung cấp chức năng đã công bố.</p>" +
    "<h2>5. Kiểm soát của người dùng và xóa quyền truy cập</h2><p>Người dùng có thể thu hồi quyền OAuth của ứng dụng trong phần bảo mật tài khoản Google. Sau khi quyền bị thu hồi, ứng dụng không thể tiếp tục sử dụng refresh token đã bị thu hồi. Yêu cầu liên quan đến dữ liệu ứng dụng có thể gửi tới địa chỉ hỗ trợ được ghi trên trang này.</p>" +
    "<h2>6. Google API Services User Data Policy</h2><p>Việc sử dụng và chuyển giao dữ liệu nhận từ Google APIs của " + esc(appName) + " tuân thủ Google API Services User Data Policy, bao gồm các yêu cầu Limited Use. Dữ liệu Google chỉ được dùng cho các tính năng trực tiếp, rõ ràng mà người dùng đã cấp quyền.</p>" +
    "<h2>7. Thay đổi chính sách</h2><p>Khi cách ứng dụng sử dụng dữ liệu Google thay đổi, chính sách này sẽ được cập nhật trước hoặc cùng thời điểm thay đổi có hiệu lực.</p>";
  return pageShell({
    title: "Chính sách quyền riêng tư · " + appName,
    description: "Chính sách quyền riêng tư của SUPRA Inventory Beta, bao gồm cách truy cập, sử dụng, lưu trữ và chia sẻ dữ liệu Google.",
    canonical: origin + "/privacy",
    appName,
    body,
    origin,
  });
}

function termsPage(origin: string, appName: string): string {
  const body =
    "<h1>Điều khoản sử dụng</h1>" +
    '<p class="lead">Các điều khoản này áp dụng cho việc sử dụng <strong>' + esc(appName) + "</strong>, một hệ thống nghiệp vụ phục vụ quy trình Inventory/Báo hàng.</p>" +
    "<h2>1. Phạm vi sử dụng</h2><p>Ứng dụng dành cho người dùng được cấp quyền hợp lệ. Người dùng chỉ được sử dụng hệ thống cho mục đích nghiệp vụ được phân công và theo đúng quyền tài khoản.</p>" +
    "<h2>2. Tài khoản và bảo mật</h2><p>Người dùng chịu trách nhiệm bảo vệ thông tin đăng nhập, không chia sẻ tài khoản trái phép và phải thông báo khi nghi ngờ tài khoản hoặc quyền truy cập bị lộ.</p>" +
    "<h2>3. Dữ liệu và tích hợp Google</h2><p>Khi cấp quyền Google, người dùng đồng ý cho ứng dụng sử dụng đúng các phạm vi quyền được hiển thị trên màn hình OAuth. Chi tiết về dữ liệu Google được truy cập, mục đích, lưu trữ và chia sẻ được nêu trong Chính sách quyền riêng tư.</p>" +
    "<h2>4. Sử dụng phù hợp</h2><p>Không được cố ý gửi dữ liệu sai, vượt quyền, phá hoại hệ thống, khai thác trái phép hoặc sử dụng ứng dụng cho mục đích không liên quan đến nghiệp vụ được cho phép.</p>" +
    "<h2>5. Phiên bản Beta và thay đổi dịch vụ</h2><p>Phiên bản Beta có thể được cập nhật để sửa lỗi, cải thiện bảo mật hoặc thay đổi quy trình nghiệp vụ. Các thay đổi quan trọng về quyền Google hoặc cách xử lý dữ liệu sẽ được phản ánh trong thông tin ứng dụng và Chính sách quyền riêng tư.</p>" +
    "<h2>6. Dịch vụ của bên thứ ba</h2><p>Ứng dụng sử dụng một số dịch vụ hạ tầng và Google APIs để cung cấp chức năng. SUPRA Inventory không phải là sản phẩm của Google và không tuyên bố được Google bảo trợ.</p>" +
    "<h2>7. Chấm dứt quyền sử dụng</h2><p>Quyền truy cập có thể bị vô hiệu hóa khi tài khoản không còn đủ điều kiện sử dụng, có rủi ro bảo mật hoặc vi phạm quy định nghiệp vụ.</p>";
  return pageShell({
    title: "Điều khoản sử dụng · " + appName,
    description: "Điều khoản sử dụng SUPRA Inventory Beta cho người dùng nghiệp vụ được cấp quyền.",
    canonical: origin + "/terms",
    appName,
    body,
    origin,
  });
}

export function handlePublicInfoPage(request: Request, appEnv: string): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  if (!PUBLIC_INFO_PATHS.has(path)) return null;

  const origin = url.origin;
  const appName = String(appEnv || "").toLowerCase() === "beta" ? "SUPRA Inventory Beta" : "SUPRA Inventory";
  const body = path === "/about"
    ? aboutPage(origin, appName)
    : path === "/privacy"
      ? privacyPage(origin, appName)
      : termsPage(origin, appName);

  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=300",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}
