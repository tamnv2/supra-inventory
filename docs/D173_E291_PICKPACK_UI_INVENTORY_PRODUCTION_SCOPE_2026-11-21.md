# D173-E291 — triển khai thực tế UI PickPack vào Web Inventory, Production-gated

**Owner command (21/11/2026):** Triển khai thật giao diện từ Web kiểm thử Mô hình quản lý vận hành và đưa lên Production khi đạt tiêu chí bảo vệ. Khác E289/E290 (checkpoint), E291 yêu cầu code tích hợp và phát hành thực, không chỉ mô phỏng hoặc ảnh.

## Xác minh nguồn
- Accepted main `9125244e64458b10ccbffec1744418b63b3423bd`, Production Web3.3.24 tech-pass (run `44735679902` attempt 2), Owner FIELD FAIL.
- Source giao diện PickPack tham chiếu đọc-only: `tamnv2/pickpack` PR #2 HEAD `c9a7730b4307aa085e48e0198e859a3419d1c33e`, `prototype/assets/styles.css` blob `f35a20e456355dbf6d7e065b856a6760cd355234`, `prototype/assets/app.js` (UI markup reference only). JS mock login/localStorage không nhập vào Inventory.
- PR #993 frontend candidate commits `cecf179c54ff24df6b06e28812dc56ceb9483cc3` and `fa01c891228447c1fdbc96a11e65956caff02663`, target Web3.3.25. 19 import stylesheet cũ bỏ khỏi `operational-app.ts`; HTML mới dùng classes PickPack; `web/src/pickpack-office.css` chứa nguyên CSS PickPack và `web/src/d173-pickpack-business.css` adapt D173; business API/RBAC/realtime giữ nguyên code. **Không có bằng chứng browser/CI PASS tại thời điểm checkpoint**.

## Release scope, risk và acceptance
- Chỉ `web/`, tests UI D173, source release gate/tool + workflow + docs/state D173; Worker `supra-inventory-beta` chỉ repack web assets đúng domain `inventory.supra.cc.cd`. D172 PENDING/HOLD độc lập, Stable OWNER-GATED, không sửa nghiệp vụ Worker/DO, Auth, Firebase, Android, Agent, PickPack.
- Rủi ro trình bày/khả dụng: loại 19 CSS cũ có thể làm vỡ bảng động, biểu đồ, modal, scanner, trạng thái và sự kiện DOM. Phải kiểm chứng nhấn thực trong app đã build, roles ROOT/ADMIN/REPORTER/PICKER, tất cả màn hình nhóm, mobile/HD/HD+, sáng/tối, scroll, theme/accent, zoom, API/RBAC/realtime, event/no extra polling. Test fixture HTML đơn thuần không đủ.
- CI nguồn phải PASS chính SHA, bao gồm Web tsc/Vite, Chromium integrated, D172 independent regression, project/authority/security guards; sau đó code pin, owner release gate và bảo vệ PR theo 2-parent merge. Không coi PR Draft hoặc source commit là Release PASS. Sau deployment: exact SHA Worker/health/API/Web readback, ghi receipt, FIELD/OWNER vẫn PENDING tới khi Owner trực tiếp đánh giá.
- Nếu code test, guard hoặc release gate không đạt thì **không merge/không deploy**, ghi bằng chứng và tồn đọng trên PR.

## D173-E292 — source CI kết quả (21/11/2026)

- Source commit: `c4490a2d0fd467e91d173b34b6366b0d075536e1`, PR #993; exact-source `web npm run build` PASS (TypeScript + Vite).
- CI Web browser Vite thật + mock API cách ly `44893357382`: 6/6 tests PASS gồm source PickPack CSS blob SHA, Auth/RBAC/API/WS retention, 9 page groups, 390/1280/1366/1920, light/dark, ROOT/REPORTER/PICKER, modal báo Đã có hàng và Skip (hủy không ghi dữ liệu). D172 guard và node regression PASS.
- Repo Authority `44893357601`, Project State `44893357551`, D173 D172 isolation `44893357536`: SUCCESS.
- Release auth `ops/d173-e291-web3325-release-authorization.json`: code/CI pinned `c4490a2d0fd467e91d173b34b6366b0d075536e1`, four run IDs. **Global UI Design Guard historical FAIL due expecting CSS legacy**; not masked as PASS. Technical Production **PENDING**. No FIELD/OWNER PASS.
