# D173-E237 — Web 3.3.15 đồng nhất giao diện toàn Web (CODE ONLY, 12/11/2026)

## Lệnh Owner và bằng chứng
Owner xác nhận Web 3.3.14 FIELD "ok" trong phạm vi hình ảnh đã cung cấp và yêu cầu thêm ba thay đổi: (1) lấy vùng Xử lý báo hàng làm chuẩn spacing/bo viền/màu cho các mục còn lại; (2) bỏ tiêu đề cấp trang trùng mục điều hướng; (3) ghim thanh tab của các trang có tab như ở Xử lý báo hàng. Đây là yêu cầu **cập nhật giao diện**; không suy diễn quyền merge/Production cho Web 3.3.15.

- Baseline `main` trước sửa: `7d5b1856857483c7696b53a0eda1db4fbc9fad14`; PR960 đã MERGED, Web 3.3.14 Production technical PASS theo E236 run43238438595 attempt2.
- Branch: `fix/d173-e237-web3315-global-layout-sticky-tabs-20261112`, Draft PR #961.
- Căn cứ source: các `business-page-head` chứa nhãn trùng menu, chỉ `d173-ops-toolbar` có sticky trong CSS hiện hành; các trang còn lại có style/padding/radius riêng.

## Phạm vi đã triển khai trong ứng viên
- `web/src/operational-app.ts`: bỏ nhãn trùng menu ở Dashboard, SKU, Nhân sự, SLA, Nhật ký, Ca vận hành, Công cụ, Tài khoản, Đặt lại hệ thống. Giữ tiêu đề nghiệp vụ đặc thù, phụ đề reset, nút gửi/tải log, Xuất Excel, badge cấu hình, cảnh báo và tất cả form/handler.
- `web/src/d173-tabler.css`: scoped thay đổi spacing/cards/table/bo góc trên các trang ngoài `.ops-business-workspace`; dải tab Tổng quan/Báo cáo, Nhân sự và Nhật ký sticky top:0, giữ trạng thái active sáng/tối, không đổi cơ chế cuộn riêng của workspace vận hành đã sửa ở E233.
- `web/src/web-version.ts` và `web/package.json`: phiên bản ứng viên 3.3.15; regression test E237 mới và cập nhật pin phiên bản trong các test E227/E230/E233.
- Không sửa API, Worker/DO/SQLite, realtime, dữ liệu nghiệp vụ, Firebase/Auth/RBAC, Agent, Android, D172, Stable, hoặc resource/quota.

## Rủi ro, kiểm chứng và gate
- Rủi ro còn cần kiểm tra FIELD: CSS cascading và sticky trên Dashboard dài, màn hình HD/HD+, zoom 100–150%, dark/light; nút thao tác/phân trang không bị che và không tạo cuộn lồng.
- Kiểm tra source candidate: bỏ 9 loại tiêu đề trùng, giữ tiêu đề Giờ nghỉ, giữ nút Xuất Excel/Gửi log/chọn reset, giữ CSS scoped và thanh tab sticky; **PASS kiểm tra source tĩnh**, chưa chứng minh browser/FIELD.
- CI TypeScript/Vite, test đầy đủ và D172 isolation: **PENDING exact PR head**.
- `CODE`: ứng viên đã commit; `CI`: PENDING; `RELEASE`: Web 3.3.15 CHƯA PHÁT HÀNH; `FIELD/OWNER PASS`: PENDING.
- Gate: PR/CI, source-pinned protected merge và Production Web release chỉ sau lệnh Owner riêng. D172 độc lập PENDING/HOLD; Stable OWNER-GATED.
