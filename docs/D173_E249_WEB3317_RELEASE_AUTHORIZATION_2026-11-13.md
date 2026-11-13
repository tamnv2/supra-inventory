# D173-E249 — Owner phê duyệt hoàn thiện và phát hành Web 3.3.17 (13/11/2026)

Owner yêu cầu: **"done code hoàn chỉnh và phát hành 3.3.17"** trên cùng D173, kế tiếp E247-E248. Chỉ phê duyệt Web UI + D173 API/InventoryCore hợp đồng nhà thầu trong Worker hiện hữu phục vụ `inventory.supra.cc.cd`. Không bao gồm Agent, APK, D172 OBPP, Firebase, Gateway, Stable, nguồn dữ liệu riêng D172 hoặc tạo resource/provider mới.

- Source PR: [#968](https://github.com/tamnv2/supra-inventory/pull/968), base main `648cbe69d4925aa8a61c7ff978b798711d9e9ab3`, Web mục tiêu `3.3.17`.
- Yêu cầu: thu gọn Dashboard/Report, cụm ngày; đưa nhập SKU Excel lên đầu; thêm quản lý nhà thầu + select khi nhập Picker; tài khoản hiển thị đầy đủ và lọc trên máy trong RAM; tinh gọn giao diện nghiệp vụ.
- D173 schema riêng: một bảng `contractor_catalog`; ban đầu tạo từ nhà thầu đang có của Picker, không sửa dữ liệu Picker/D172. Nhà thầu đang gắn Picker không cho đổi tên/xóa để tránh sửa liên kết nghiệp vụ im lặng. HR Excel đã được duyệt ghi nhận các nhà thầu mới.
- Bản danh sách tài khoản cục bộ chỉ ở **RAM phiên được xác thực**, khóa theo người dùng/quyền, TTL 120 giây; dữ liệu định danh cá nhân không ghi xuống ổ đĩa hoặc IndexedDB của máy kho dùng chung. Nghiệp vụ hiển thị đủ và lọc tại Web, không phân trang. Lưu đĩa dài hạn không nằm trong phát hành này vì chưa có phương án bảo vệ dữ liệu tại rest; ghi rõ, không báo hoàn tất giả.
- Shared Worker schema và API mới: bắt buộc typecheck Service, Web build, D172 isolated regression/guard, D169 RBAC, canonical authority + continuity PASS.
- Gate: `tools/d173_e249_web3317_release_gate.py`, Owner receipt `ops/d173-e249-web3317-release-authorization.json`; merge commit **hai cha** với subject bắt đầu `D173-E249_WEB3317_PRODUCTION_RELEASE:`; bảo vệ diff chính xác trong PR #968, không mở cho Stable/Provider ngoại phạm vi.
- Chỉ merge vào main sau khi source CI exact SHA và guard tất cả PASS. Sau merge GitHub Actions `Deploy Beta Worker` hiện hữu thực hiện Web/Worker Production. Xác minh workflow SUCCESS, `/health` HTTP200 source_commit đúng merge SHA, storage/schema operational, Web shell và thông tin version. FIELD browser đăng nhập thật và Owner PASS riêng, không tự suy diễn.
- Nếu CI/Release fail: sửa trong PR/nhánh D173 cùng scope, re-CI và chỉ dùng source pin đã kiểm chứng. Không push main trực tiếp, không tự giả PASS.
