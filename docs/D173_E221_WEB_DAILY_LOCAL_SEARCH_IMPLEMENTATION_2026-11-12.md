# D173-E221 — Web 3.3.11: tải toàn bộ trong ngày và tìm SKU cục bộ (12/11/2026)

## Quyết định Owner
Sau báo lỗi Web 3.3.10 FIELD SKU và phương án D173-E220, Owner phê duyệt **bỏ phân trang**, chấp nhận usage có thể tăng, sẽ yêu cầu sửa sau nếu bất thường. Không có lệnh merge/triển khai mới trong lượt phê duyệt này.

## Phạm vi code
- Chỉ Web D173 và cầu nối tham số D173 trong `service/src/core.ts`. Không thay bảng/Schema, DO business, D172, Agent, APK, Firebase, Gateway hoặc Stable.
- Giao diện năm tab Xử lý báo hàng **không có chuyển trang**; giữ nút chức năng/permission/Realtime hiện hữu.
- Ba tab kết quả `Đã có hàng / Cho phép skip / Picker đã thu hồi` có duy nhất một ô chọn **ngày VN**, mặc định hôm nay sau F5/đăng nhập. Ngày chỉ áp dụng ba tab kết quả dựa `first_report_at`, không che đơn chưa xử lý của ngày cũ.
- Đang xử lý và Quá hạn tiếp tục hiển thị mọi đơn OPEN, không lọc ngày.
- Mỗi tab tải từng phần qua API `limit=200`, gộp dữ liệu đến khi đủ `total`, kiểm tra trùng/lệch và thử lại tối đa một lần; nếu thiếu, báo lỗi thay vì hiển thị bộ dữ liệu thiếu như đầy đủ. Riêng Picker đã thu hồi dùng row key `batch_id + picker_employee_code` để không làm mất số Picker riêng.
- Tìm SKU hậu tố trực tiếp trong DOM/RAM sau khi tải đủ, không phát request theo phím và không thay input đang focus; không dùng localStorage/IndexedDB lưu dữ liệu nghiệp vụ.
- Service `/authorized/operational/reporter/recent` nhận đầy đủ `sku_suffix`, `picker_rows`, `include_totals`; overdue nhận `sku_suffix` (chỉ chuyển qua hệ kiểm tra auth và Core vốn đã thực hiện). Hành vi API khác giữ nguyên.
- Realtime thay đổi kết quả cập nhật theo snapshot; trường hợp Picker thu hồi/tập dữ liệu không đủ sẽ đồng bộ lại trọn tab. Snapshot mutation rút gọn không được ghi đè danh sách đầy đủ.

## Đánh đổi và test
- 357 dòng/ngày ít nhất hai page read thay vì 50-row first page; nhiều dòng sẽ tăng request ban đầu, payload, CPU trình duyệt và có thể Rows Read. Owner chấp nhận **rủi ro có điều kiện**, không coi đây là đo đạt usage/hiệu năng.
- PASS CODE: có unit regression tái hiện lỗi params bridge, test one-day, zero keypress API, exact Picker withdrawal, no visible pagination, build Web/Worker; D172 independent tests và isolation guard PASS theo chính xác SHA.
- RELEASE: **HOLD** đến lệnh Owner riêng; không push main trực tiếp. CI PASS không đồng nghĩa FIELD/OWNER PASS.
- FIELD: chờ trình duyệt đăng nhập thật kiểm tra SKU, ngày, 357+ rows, realtime, role, correction, DO Usage trước/sau. Không ghi log/commit SKU hay dữ liệu người dùng thật.
- Source base: `main:da5f6948852777528ced565cf894b35364841ee0`; working PR `#952` `docs/d173-e220-web-daily-client-search-review-20261112`. Version source candidate **3.3.11**, Production vẫn 3.3.10.

## Trạng thái ban đầu
CODE candidate đang cập nhật; CI/RELEASE/FIELD/OWNER PASS chưa có chứng cứ. D172 PENDING/HOLD riêng, Stable OWNER-GATED.

## E222 — kiểm chứng exact source CODE/CI (12/11/2026)
- PR #952 implementation and direct field repair source SHA: `1cb83f32da0e8c1d4b3f56528e0d3cbdd17c8db0`.
- Web/Worker typecheck, new E221 source tests, Web production build, D172 independent regression: [run 43202503500](https://github.com/tamnv2/supra-inventory/actions/runs/43202503500) **SUCCESS**.
- Existing Worker/Web SQL, auth and D172 regression: [run 43202503880](https://github.com/tamnv2/supra-inventory/actions/runs/43202503880) **SUCCESS**.
- D172 isolation: [run 43202503474](https://github.com/tamnv2/supra-inventory/actions/runs/43202503474) **SUCCESS**.
- Repo authority [43202503719](https://github.com/tamnv2/supra-inventory/actions/runs/43202503719) **SUCCESS**; state/continuity [43202503313](https://github.com/tamnv2/supra-inventory/actions/runs/43202503313) **SUCCESS**.
- Other legacy check jobs can fail due unrelated frozen Agent/SLA/old hardcoded Web-version contracts; **do not claim all repository workflows pass**. They are not repaired outside this Owner-approved scope.
- **CODE PASS, 5 scoped CI PASS**. `Web 3.3.11` remains **unreleased**; current official Production still `Web 3.3.10`, SKU search FIELD NOT PASS. FIELD/OWNER PASS remain **FALSE**. No secret or private operational rows logged.
