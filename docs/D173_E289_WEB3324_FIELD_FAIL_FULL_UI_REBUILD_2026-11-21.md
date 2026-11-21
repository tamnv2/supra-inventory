# D173-E289 — Web 3.3.24 FIELD FAIL: xây lại toàn bộ giao diện (21/11/2026)

## Sự thật đã xác minh
- Owner trực tiếp báo **Web 3.3.24 đã phát hành nhưng giao diện KHÔNG ĐẠT**, khác bản Web kiểm thử từ dự án Mô hình quản lý vận hành Pick Pack 1291.
- Production 3.3.24 TECHNICAL RELEASE PASS ở main `ac4b0512931cf7a72e231af0652dec9d21bbfeef` / workflow `44735679902` attempt 2, nhưng không có FIELD/OWNER PASS. [PR #991](https://github.com/tamnv2/supra-inventory/pull/991) MERGED; [PR #992](https://github.com/tamnv2/supra-inventory/pull/992) MERGED.
- `web/src/operational-app.ts` vẫn import CSS cũ (Tabler, `styles.css`, `legacy-operational.css`, nhiều `legacy-transplant/*`, `d173-tabler.css`, `d173-overview.css`) trước `d173-inventory-preview.css`. PR #991 thêm stylesheet mới thay vì thay hệ thống UI cũ (1199 additions / 34 deletions toàn PR). Đây là bằng chứng code dùng nhiều tầng CSS cũ, không phải tái xây giao diện.
- `tests/d173-e283-inventory-preview.test.mjs` sử dụng fixture markup/dữ liệu synthetic, kiểm tra geometry và screenshot 22 ảnh; không kiểm chứng các trang, quyền, tác vụ thật khi đăng nhập Production.
- Tham chiếu UI duy nhất được Owner chỉ định: PickPack 1291 [Draft PR #2](https://github.com/tamnv2/pickpack/pull/2), **chỉ đọc**. Không chuyển nghiệp vụ/dữ liệu/source/runtime tài nguyên của PickPack sang Inventory.

## Lệnh Owner mới / quyết định phạm vi
**Không tiếp tục vá, chỉnh CSS chồng lớp trên giao diện Web Báo hàng cũ. Phải thay hẳn lớp giao diện**, tham chiếu bản Web kiểm thử của dự án quản lý vận hành. Giữ nguyên tất cả logic D173 đang sử dụng (Firebase Auth, RBAC, API nghiệp vụ, WebSocket, dữ liệu thực, báo SKU, SLA, form, modal, dashboard, báo cáo, log, responsive và các chức năng thực). Không dùng dữ liệu/mock ở Production; không xây một shell đẹp nhưng bỏ thao tác thực.

## Đánh giá ảnh hưởng trước triển khai
- **Accepted base**: D171 Owner limited PASS không thay đổi; Web 3.3.24 Production tech PASS **không** phải Owner FIELD PASS.
- **Thành phần cần thay**: toàn bộ lớp giao diện trong `web/` (shell + tất cả module màn hình, CSS design tokens/components, login/form/modal, header/nav/table/scroll) và kiểm thử giao diện mới. Có thể tái sử dụng render/data/handler nghiệp vụ khi tách khỏi presentation; không mặc nhiên xóa code xử lý.
- **Rủi ro hồi quy**: CSS cũ có thể đang điều khiển layout và visibility quyền/điều hướng; bỏ import đồng loạt khi chưa chuyển đủ thành phần sẽ làm vỡ Web. Phải chuyển và thử từng màn hình, không cắt CSS mù; giữ mọi nút/handler/API đúng.
- **Quota/Resource/Security**: không thêm truy vấn, polling, lưu PII, provider mới hay đổi auth; chỉ source Web D173. D172 PENDING/HOLD độc lập, không sửa Worker/DO/SQLite, Agent/Android, Firebase, Gateway, Stable, PickPack.
- **Phương án**: tách hệ thống CSS kiểu legacy khỏi lớp UI hoàn toàn mới, xây một design system nhất quán dựa trên UI PickPack, gắn logic Inventory thật, đối chiếu trực quan 9 trang và responsive/dark/role bằng browser tương tác; giữ Production hiện hành cho đến khi CODE+CI+UAT đúng scope. Không suy diễn cho phép Production release mới từ E286.

## Tiêu chí chấp nhận / trạng thái
1. Không còn phụ thuộc stylesheet legacy cho giao diện authenticated Web; không có chuỗi `!important` chỉ để đè lớp cũ; bộ CSS mới đồng nhất trên 9 màn hình và đăng nhập.
2. Layout theo tham chiếu PickPack: sidebar, topbar, định dạng thẻ/bảng/form/modal, màu sáng/tối, chọn màu, co giãn HD/HD+/mobile, scroll không bị khuất, không text hướng dẫn/demo thừa.
3. Tất cả action hiện có có handler thật; role-based navigation/visibility, real-auth, realtime, SKU, danh sách, modal, export/import hoạt động và không tăng network calls.
4. TypeScript/Vite build; Chromium 9 trang và nhiều role/viewport với màn hình **tích hợp thực**, không chỉ synthetic fixture; D172 isolation và security/regression CI PASS.
5. CODE **NOT STARTED**; CI **NOT RUN**; RELEASE **3.3.24 UNCHANGED / TECH PASS ONLY**; FIELD **OWNER NOT PASS**; OWNER PASS **FALSE**. Không merge hoặc deploy từ checkpoint này.

**Nguồn**: Owner field feedback 21/11/2026 (không kèm dữ liệu cá nhân); source `main@9125244e64458b10ccbffec1744418b63b3423bd`; Production E288 receipt; PickPack PR #2 read-only.
