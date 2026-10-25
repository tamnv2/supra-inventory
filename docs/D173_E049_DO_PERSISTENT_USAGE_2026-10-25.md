# D173-E049 — Bền vững hóa log Worker / Durable Objects, dùng SQLite InventoryCore hiện có (25/10/2026)

## Owner directive
Cần log số lần thực thi theo nghiệp vụ, SQL rowsRead/rowsWritten, độ trễ từng truy vấn và không reset sau restart DO. Owner yêu cầu tiếp tục triển khai, nhưng không được làm ảnh hưởng đến D172, vận hành realtime hoặc để lộ dữ liệu.

## Findings, scope and design
- D166 đã có 15 allowlisted query IDs đo từ SqlStorageCursor; D167 đã có method/route-family count. Hai bộ đếm WeakMap reset khi isolate restart.
- E049 dùng **một bảng mới** `d173_usage_counters` trong SQLite của **InventoryCore hiện có** (được đăng ký trong project-scope), không tạo Worker/DO/database/provider mới. Không sửa nguồn nghiệp vụ D172, không đọc/ghi bảng `obpp_*`.
- Khoá tổng hợp `hour_utc + metric_kind(SQL/ROUTE) + metric_id + method`, atomic `UPSERT` đếm executions, SUM rowsRead/rowsWritten/latency, MAX latency/rows và unavailable sample. Tên metric chỉ fixed enum/allowlist, không có raw SQL/URL, tham số, SKU, MNV, nội dung yêu cầu, token hoặc phiên.
- Vùng dữ liệu retained 35 ngày; startup thực hiện dọn các bucket quá hạn, snapshot mặc định 36 giờ để tránh response quá lớn. Vẫn lưu được khi DO/isolate khởi động lại và khi không có client truy cập.
- Đếm alarm riêng bằng family `ALARM`; Worker tổng requests trực tiếp không đi qua DO phải đối chiếu Cloudflare provider billing, không giả định nội dung log DO là toàn bộ Worker.
- Nếu SQLite telemetry lỗi: fallback WeakMap; nghiệp vụ không bị throw, phản ánh `durable=false` hoặc `persistence_failures_current_isolate`. Không gắn nhãn đã thu thập đủ khi storage fallback.

## Cost, performance and D172 safety — explicit impact
- **Mỗi lần đo tạo thêm 1 SQL UPSERT/1 row write**. Mỗi DO HTTP request tạo thêm 1 row write; từng SQL trong 15 hotpath thêm 1 row write. Đây là chi phí đo bắt buộc của persistence từng sự kiện; không coi là miễn phí.
- Không thêm Timer, Cloudflare API request, Worker→DO request, Firestore, RTDB, outbound network, new binding hoặc scheduled cron.
- Đọc aggregate chỉ khi gọi diagnostic endpoint có quyền; provider billed SQL rowsWritten sẽ tăng sau release.
- Trước Production release bắt buộc pass Worker typecheck, D172 auth/private-table/route negative regressions, readonly Picker/Reporter/Overdue/realtime, quota + latency comparative budget và source-pinned Owner-scoped Worker gate. Nếu không có benchmark phù hợp: giữ `CODE_ONLY`, không mạo hiểm triển khai.
- Không gọi log data là BILLING; đó là chỉ số quan sát SQL cursor trong 15 query IDs cùng route groups.

## Release boundary
- PR E049 **CODE ONLY until exact CI/source/rollback & shared D172 guards**. Không tự merge hoặc deploy vì chỉ đạt source test.
- Agent146 đã có signed tag và OTA SHA256 riêng; không chạm Agent source/channel trong E049.
- D172 **PENDING/HOLD** độc lập, Stable Worker OWNER-GATED. FIELD/OWNER PASS không suy ra từ CI.
