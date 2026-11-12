# D173-E215 — Web 3.3.9 + Worker D173 Production technical release (12/11/2026)

## Chứng cứ phát hành đã kiểm chứng
- Owner 12/11/2026 yêu cầu tiếp tục xử lý sáu Web 3.3.8 FIELD FAIL và **phát hành Web phiên bản mới**, phạm vi D173; chấp thuận phát hành Web và shared Worker read-only sau bảo vệ.
- PR [#947](https://github.com/tamnv2/supra-inventory/pull/947) **MERGED** vào `main` với two-parent protected merge `331c2c1e99c5113f258acba8ab12ac3e8d5ca946`; commit title `D173-E214_WEB339_FIELD_REPAIR_PRODUCTION_RELEASE:`.
- Web source `web/src/web-version.ts` và `web/package.json` khai báo **3.3.9**.
- Đã đối chiếu exact source code PR947 SHA `e742d4b5b748458a50d46cdf7ab0d3c7926d63ac`; các required CI nguồn PASS:
  - [Web339+Worker SQL/SQLite, Web TypeScript/build, D172](https://github.com/tamnv2/supra-inventory/actions/runs/43168107470) SUCCESS.
  - [D172 isolation](https://github.com/tamnv2/supra-inventory/actions/runs/43168108212) SUCCESS.
  - [Repo Authority](https://github.com/tamnv2/supra-inventory/actions/runs/43168108075) SUCCESS.
  - [Project State](https://github.com/tamnv2/supra-inventory/actions/runs/43168107890) SUCCESS.
  - Final PR head `af59a68a6c7d3c4229508b164a6495c0202dab98` revalidated four checks SUCCESS: [E214](https://github.com/tamnv2/supra-inventory/actions/runs/43168348696), [D172](https://github.com/tamnv2/supra-inventory/actions/runs/43168348664), [Authority](https://github.com/tamnv2/supra-inventory/actions/runs/43168348666), [State](https://github.com/tamnv2/supra-inventory/actions/runs/43168348523).
- [Deploy Beta Worker #43168569077](https://github.com/tamnv2/supra-inventory/actions/runs/43168569077) **completed SUCCESS** trên exact `main` merge SHA `331c2c1e99c5113f258acba8ab12ac3e8d5ca946`.
- CI logs: `D173_E214_WEB339_WORKER_PINNED_RELEASE_ALLOWED`, `D173_E214_WEB339_WEB_PINNED_RELEASE_ALLOWED`, `D173_E214_REGISTERED_GATEWAY_UNCHANGED_WEB339_WORKER_READ_ONLY`.
- Wrangler upload 3 assets mới (4 assets đã có), deploy existing technical Worker `supra-inventory-beta` thành công. Cloudflare Worker version ID `a5b37c86-3dbe-4276-a433-510b296c7561`.
- Release CI xác nhận `D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS`, /health exact GitHub SHA, môi trường và SQLite, nguồn Worker sau cập nhật D166 read-only secret được giữ nguyên; `Beta Web shell PASS`, `Beta OAuth start PASS`.
- Official Web hostname phục vụ người dùng: `inventory.supra.cc.cd`. Technical Worker name `supra-inventory-beta` không phải môi trường người dùng thứ hai. **Không triển khai Stable**.
- PR #946 (ứng viên sửa Web 3.3.8 trước đây) đã được đóng **không merge**, thay bằng PR #947. PR Agent193 #945 giữ riêng.

## Scope và nghiệm thu
- Đã phát hành Web 3.3.9 và projection read-only phía D173 cho danh tính Picker thu hồi. Không đổi DB schema, không tăng API request theo code mới, không sửa Agent, APK, Firebase, D172 business/Worker routes, Gateway hay Stable.
- Giao diện: tiêu đề 150%, tab Skip chỉ tổng, một dòng desktop có overflow an toàn, date/SKU compact; tìm SKU suffix có key bộ lọc và chặn DOM restore cũ.
- Source SQL có fallback danh tính theo bản ghi thu hồi mới nhất; SQLite synthetic PASS, **chưa có bằng chứng người dùng thật** nếu lịch sử thiếu user/identity. Cần kiểm tra FIELD trực tiếp ô tìm kiếm, các tab và Picker thu hồi.
- Kiểm thử browser trực tiếp có đăng nhập trên thiết bị Owner **chưa thực hiện**; không suy diễn FIELD PASS hoặc OWNER PASS, cũng không xác nhận usage thực tế chỉ từ CI.

## Phân loại trạng thái
- CODE: **PASS** (merged protected main).
- CI: **PASS** (required source/SQL/D172/authority/state).
- RELEASE: **TECHNICAL PASS** (Worker/Web 3.3.9 exact-source + official hostname health/web-shell).
- FIELD: **PENDING** (Owner xác minh dữ liệu thật và layout thật).
- OWNER PASS: **FALSE**. D172 **INDEPENDENT PENDING/HOLD**; Stable **OWNER-GATED**.

D173-E215 chỉ là hồ sơ chứng cứ phát hành, **không được phép triển khai runtime hay sửa hạ tầng thêm**.
