# D173-E242 — Web 3.3.16: chỉnh giao diện sau Web 3.3.15 (13/11/2026)

## Quyết định Owner / bằng chứng
- Owner xác nhận Web 3.3.15 đã phát hành ổn và yêu cầu sửa UI bốn khu vực, dựa trên ảnh Web thực tế.
- Bản 3.3.15 đã có Production technical receipt E241, release main `8cfd4b2427a02ba59cca68e0e0dc277b8a58d62f`, Workflow `43259764849` SUCCESS. PR #962 MERGED, main mới nhất khi bắt đầu E242: `bbd922e2f5873586aaa7264038b464b16be0c597`.
- Branch `fix/d173-e242-web3316-ui-consistency-20261113`, PR #965 (Draft). Đây là yêu cầu chỉnh CODE, **không có lệnh mới duyệt merge hoặc phát hành Production**.

## Phạm vi ứng viên Web 3.3.16
1. Xử lý báo hàng: 4 cột Picker/nhân sự/thời điểm báo/mốc tự bỏ qua trên một hàng; đậm họ tên và thời gian; căn giữa theo chiều cao ô ở cả ba nhóm kết quả và nút; giảm chiều rộng ô chọn ngày.
2. Header: đồng bộ chiều cao control 36px, chỉ làm rõ nhãn kết nối HTTP API và cập nhật dữ liệu WebSocket, giữ nguyên trạng thái điều khiển gốc.
3. Tổng quan/Báo cáo: gom hai tab với chọn khoảng ngày vào một thanh; áp dụng khi thay đổi ngày; bỏ nút Xem/Xem báo cáo; đặt vùng nội dung vào panel có một vùng cuộn dọc, không đụng cơ chế API, bảng, quyền, Excel; giữ nguyên các preset và bộ lọc báo cáo cũ. Để tiết kiệm request, ô tìm kiếm văn bản chỉ áp dụng khi change/submit, không theo mỗi phím.
4. Ca vận hành: ẩn nội dung kỹ thuật thừa, Việt hóa nhãn thời hạn; trạng thái và tính toán ca bên dưới giữ nguyên.
5. Web version 3.3.16 và kiểm thử hồi quy E242 + đồng bộ pin của E227/E230/E233/E237.

## Ranh giới / kiểm chứng
- Chỉ thay đổi `web/src/operational-app.ts`, `web/src/d173-tabler.css`, version/package, test nguồn và tài liệu trạng thái. Không đổi Service Worker, DO/SQLite/API/realtime nghiệp vụ/Android/Agent/Firebase/Auth/D172/Stable hoặc provider.
- Kiểm thử: HTML/CSS source và typecheck/build Web; bảo toàn thông báo realtime, các preset/ngày, kết quả, nút chỉnh trạng thái, phiên, phân quyền; D172 isolation.
- Rủi ro FIELD chưa xác minh: Chrome HD/HD+ và zoom 100–150%, tràn hàng, sticky/single-scroll trong cả light/dark, date auto-apply và khả năng bị request trùng; chỉ Owner/thiết bị thật xác nhận.
- CODE đang trên PR #965; CI chính xác theo head phải được đối chiếu. Các workflow lịch sử có assertion Agent và version cũ không được tự gọi PASS nếu FAIL.
- RELEASE: **HOLD**, không merge, deploy hoặc tăng version Production khi chưa được Owner duyệt. FIELD/OWNER PASS: PENDING.

## E243 — Kiểm thử source xác minh ngày 13/11/2026
- PR #965, source CI SHA `df757f4302613b6a0448e9d8ed1c8cde1077e6e1`.
- <https://github.com/tamnv2/supra-inventory/actions/runs/43351325372> — **PASS:** E242 + E237/E233/E230/E227 regression, Web TypeScript và Vite build, D172 isolated guard và test.
- <https://github.com/tamnv2/supra-inventory/actions/runs/43351325639> — Authority PASS.
- <https://github.com/tamnv2/supra-inventory/actions/runs/43351325756> — Continuity PASS.
- <https://github.com/tamnv2/supra-inventory/actions/runs/43351325885> — Scope/types PASS.
- <https://github.com/tamnv2/supra-inventory/actions/runs/43351325405> — Source SQL/Auth/D172 PASS.
- Các kiểm tra Agent/history legacy không thuộc scope còn FAIL với assertion UI Agent và pin Web phiên bản cũ; **không gọi toàn bộ CI PASS**.
- D173-E243 ghi trạng thái **CODE/CI PASS theo phạm vi**, RELEASE HOLD, FIELD và OWNER PASS chưa có. Việc bổ sung checkpoint docs/state sau source pin không làm thay đổi Web runtime.

## E244 — Owner cho phép phát hành (13/11/2026)
Lệnh mới thay thế trạng thái "chưa duyệt phát hành" trước đó: hoàn thiện và phát hành Web3.3.16 sau khi CI/guard PASS, tham chiếu `docs/D173_E244_WEB3316_RELEASE_AUTHORIZATION_2026-11-13.md`. Không mở rộng D172/Agent/APK/Stable.
