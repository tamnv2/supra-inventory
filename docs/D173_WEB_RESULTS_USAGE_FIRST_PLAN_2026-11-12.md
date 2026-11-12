# D173 — Kịch bản Web vận hành báo hàng, tối ưu Usage → Ổn định → Tốc độ (12/11/2026)

## Loại tài liệu, thẩm quyền
- **Phân tích/thiết kế để Owner review, không phải quyền CODE/merge/RELEASE.** Chỉ áp dụng D173 Báo hàng Web + API đọc. D172 OBPP1291 độc lập PENDING/HOLD; shared Worker/InventoryCore phải được phép và test cả hai trước triển khai; Stable OWNER-GATED.
- Source accepted main tại lúc phân tích: `f9237ec593ce1e8ecc1f20af04ae497a5269fb08`; Web Product 3.3.6, Worker/Web technical release E185, FIELD và OWNER không tự suy từ release. PR #942 branch `docs/d173-web-results-ux-review-20261112` OPEN DRAFT docs-only tại lúc kiểm.
- Owner chốt: input placeholder **Tìm SKU theo các chữ số cuối**, chỉ số, tối thiểu 3 chữ số, match suffix only: `10011233` matches `233`, `1233`, not `123`. 5 yêu cầu còn lại ở đề xuất `docs/D173_WEB_RESULTS_UX_REVIEW_2026-11-12.md`.
- Không có dữ liệu Rows Read/requests/p50/p95 Production đo riêng cho tính năng mới vì tính năng chưa tồn tại. Không gán số tiết kiệm % giả.

## Bằng chứng source liên quan trực tiếp
1. `web/src/operational-app.ts` `renderOperationalTabs` (~1595), `renderResults` (~1814), `bindSection` (~5015), `loadReporterRecentSnapshot` (~3697), `applyReporterSnapshotEvents` (~3580–3675), `handle realtime` (~5735): 5 tab, lịch sử 50/trang, date submit, request list gồm status/from/to không có suffix, realtime chỉnh danh sách + badges tại chỗ.
2. `web/src/api.ts` `getReporterRecent` (~1188), `getReporterQueue` (~1129), `getReporterOverdue` (~1134), `getReporterBatchTickets` (~1220): route recent và batch tickets được bảo vệ. Queue/overdue chưa có tham số từ/đến và suffix.
3. `service/src/operational-v2-core.ts` `reporterRecent` (~978–1182): `RECENT_RESULTS_PAGE`/ `RECENT_STATUS_TOTALS` / `RECENT_ACK_TOTALS`; tổng hiển thị/ACK tính theo mọi đợt trong ngày, không chỉ trang. `reporterBatchTickets` (~1183–1219) trả người báo theo batch ID; `reporterQueue`/ `reporterOverdue` (~865–974) không date-scope.
4. `service/src/core.ts` bảng `report_batches` có `batch_id,sku,status,first_report_at,resolved_at`, `report_tickets` có `ticket_id,batch_id,picker_employee_code,reported_at,status`. Index hiện có là `idx_report_batches_sku_status`, `idx_report_batches_first_report_at_status`, `idx_report_tickets_batch`, ...; không có suffix index.
5. `service/src/d166-sql-usage.ts` `d166MeasuredSqlRows` (~205) ghi telemetry theo SQLite cursor; dùng query IDs/rowsRead thực khi benchmark. `docs/D173_E108_PRODUCTION_BASE_DO_PROPOSAL_2026-11-01.md` nói DO Requests và Rows Read đang là quota cần giám sát; số liệu lịch sử 01/11 không đại diện usage 12/11.

## A. Thiết kế ưu tiên 1 — Usage
**A0, không tạo request**: ẩn nút mở báo cáo, bố cục tabs/date, cột `first_report_at`; tất cả có trong state/response. Giữ page size 50. Date preset auto update chỉ khi phạm vi ngày thực sự đổi và hợp lệ. Không thêm polling.
**A1, tìm SKU suffix**:
- Client giữ chuỗi số, placeholder chính xác; query chỉ khi >=3 chữ số, debounce đề xuất 450–500ms; 1–2 số không gửi request, xóa input trở lại dữ liệu nền; không gửi request trùng cùng user/tab/status/date/query/page và revision.
- **Duy trì endpoint hiện có** `/api/reporter/recent`, bổ sung tham số suffix cho 3 tab kết quả; phía server validate digits + min3 + max phù hợp SKU thực, điều kiện `b.sku` kết thúc bằng suffix, đồng thời lọc status + ngày qua `b.first_report_at` như hiện tại; **lấy count khớp và page 50 trên server trước LIMIT/OFFSET**. Không tải tất cả 300 dòng về Web; không gọi endpoint riêng cho từng ký tự/tab/row.
- Nhánh search chỉ cần query COUNT filtered + page filtered (và quyền/session hiện hành); **không chạy lại `RECENT_STATUS_TOTALS` hay `RECENT_ACK_TOTALS` trên mỗi thay đổi suffix**. KPI và badge vẫn là scope total ngày được lấy/đồng bộ độc lập. Cần tách `recentSearchTotal` khỏi `recentBadgeCount`; tránh các đoạn hiện hành reset `recentTotal` bằng badge count khi search.
- Tiếp tục dùng SQL suffix `LIKE '%' || ?`/equivalent chỉ **sau EXPLAIN QUERY PLAN + đo rowsRead**. LIKE có wildcard đầu thường không tận dụng index SKU để seek; ưu tiên index date/status có sẵn để thu hẹp trước. Mốc 30–60 ngày có thể nặng: nếu measured scan vượt ngưỡng quota/latency, nghiên cứu indexed reversed-SKU đã được kiểm nghiệm với migration/rollback riêng; **không thêm cột, trigger, bảng suffix-index hay index cho mọi suffix ngay** vì tăng writes/storage/backfill/complexity. Không chuyển thuật toán thành prefix vì Owner cấm.
- **Không đoán phần trăm tiết kiệm**. Đếm DO request thực theo action; SQL cursor rowsRead: search 3,4,6 chữ số; 1/7/30/60 ngày; tình huống không khớp, nhiều khớp, >50 khớp; baseline không search vs candidate. Đo p50/p95 và tỉ lệ request suppressed/duplicates.
**A2, chi tiết picker**: double-click HAS_STOCK/SKIP_ALLOWED thì gọi **duy nhất** GET `/api/reporter/batch-tickets?batch_id` nếu chưa có dữ liệu còn hợp lệ; một batch/mở lần đầu tối đa 1 DO request, những lần mở/đóng lại không gọi; đồng nhất in-flight và cache có khóa user/session/batch/version, xóa khi delta thay đổi, có fallback. Không prefetch toàn bộ lịch sử.
**A3, tên người thu hồi**: CLOSED lấy trực tiếp từ tickets WITHDRAWN **trong cùng `batch_id` thuộc 50 dòng kết quả** bằng query join/group sau paging **trong cùng DO invocation trả danh sách**; không N+1 GET cho từng CLOSED row. Nếu nhiều picker, dữ liệu nhiều người phải bảo toàn; không tạo/đổi bản ghi.
**A4, ngày/tabs**: không request nếu preset đã là phạm vi hiện tại, đang chỉnh một ngày nhưng phạm vi chưa hợp lệ, hoặc filter không thay đổi. Cùng ngày và trạng thái query có in-flight thì coalesce; đổi tab reset offset, không thêm counters poll chỉ vì nhập suffix.

## B. Thiết kế ưu tiên 2 — Ổn định
- Mỗi bộ kết quả có key `identity/session_generation + tab + from/to + suffix + page + realtime_revision`. Chỉ apply response khi key còn khớp; reject response cũ, cancel request khi có thể; quyền đang live được kiểm lại server, không cache kết quả qua logout/đổi người.
- Bảo toàn realtime event stream/badge current: khi search đang bật, delta không được chèn SKU không khớp hoặc đè danh sách được lọc. Chỉ patch khi chứng minh đúng predicate/offset/count; trường hợp count hoặc pagination không chắc ⇒ coalesce **một lần reconciliation cho đợt delta liên quan** (không mỗi event/mỗi giây). Đã tắt search ⇒ trở về delta-first hiện tại.
- Mutation `read_model` hiện mang status/from/to nhưng không mang suffix ⇒ không được ghi đè trang search bằng snapshot unfiltered; skip snapshot list không tương thích, dùng reconciliation có điều kiện. Giữ nguyên mutation và ACK authority.
- Dùng `batch_id` không dùng SKU để phân biệt nhiều lần báo; tôn trọng `first_report_at` time-scope hiện có. Nhân sự thiếu user name chỉ hiển thị code/placeholder, không bịa; hiện SQL join users cho tên hiện thời, không khẳng định đó là snapshot tên lịch sử.
- Phân quyền view và action hiện hữu không đổi; click double là **read-only**, không kích hoạt nút correction; lỗi tải chi tiết không mất data bảng. Thao tác sửa trạng thái không bị chặn bởi kết quả tìm; reset cache/reconcile nếu thay đổi version.
- Không thay đổi ngữ nghĩa của quá hạn và đang xử lý khi chưa được Owner quyết định rõ về date-scope. Không xử lý D172-owned data/source. Backend shared scope bảo vệ exact route + independent D172/D173 tests.

## C. Thiết kế ưu tiên 3 — Tốc độ
- Trang tải như hiện tại, 50/ trang; render date controls responsive; có loading inline cho chi tiết nhưng không khóa bảng/correct.
- Suffix search debounce và một DO request khi hợp lệ. Mục tiêu không tệ hơn baseline p95 cho no-search, kiểm riêng search p50/p95 theo size date; chưa đặt/khẳng định ms thực khi chưa có benchmark.
- Nếu lượng record trong 60 ngày lớn, chỉ nâng cấp index/search schema theo số đo và approval scope migration; không tăng writes, backfill hoặc tạo resource mới chỉ vì giả định.
- Search field on same tab row; narrow width wraps, không đè tab/button. Ngày đổi hợp lệ tự áp dụng, không nút Áp dụng.

## D. Kịch bản kiểm thử và tiêu chí PASS (đề xuất)
1. Match: SKU `10011233`, `233` đúng, `1233` đúng, `123` sai; không trả row trùng SKU khác batch/different statuses ngoài khoảng. Nhập 0/1/2 số, dán chữ, nhập nhanh 3→4→5 số ⇒ **0 request khi chỉ nhập query không hợp lệ**, một request khi query hợp lệ đã ổn định; xóa input phục hồi kết quả nền từ cache nếu revision còn hợp lệ, nếu đã thay đổi thì được phép đúng một GET reconcile; duplicate suppressed.
2. Toàn bộ >300 rows, query match record nằm ngoài trang đầu; `total` match chính xác, page50 ổn; badge/KPI không biến thành match count.
3. CLOSED một hoặc nhiều Picker trong cùng batch trả đúng mã + tên từ WITHDRAWN tickets; không N+1 DO; tên trống fallback rõ ràng. HAS_STOCK/SKIP_ALLOWED double-click trả mọi ticket đúng batch + `reported_at`, cache reuse/invalidated; sai/missing id fail gracefully.
4. Đổi tab/đổi ngày/nhập liên tục + realtime/ACK/correction/sửa status, logout/đổi role, request trễ, mất mạng ⇒ không stale UI, không reapply unfiltered read_model, không mất action hoặc ACK.
5. HTML/CSS HD/HD+/zoom 100/125/150%; date controls auto apply đúng, không duplicate fetch. D172 isolation + auth + source CI/TypeScript/Web build + SQL fixture + exact readbacks.
6. Đo provider/CI: DO requests per logical search (sau debounce max 1 GET), per reopen cached (0), per unique detail (1 GET), 0 new provider request cho layout/first_report_at, SQL `rowsRead` query IDs, p50/p95; đối chiếu tổng hourly request/Rows Read theo cùng workload. Không tuyên bố tiết kiệm khi chưa đo. Rollback bằng nguyên bản Web + API trước thay đổi, không schema migration trong phương án gốc.

## E. Owner đã chốt ba lựa chọn (12/11/2026) — có hiệu lực cho thiết kế
1. **Phạm vi SKU:** chỉ tìm trong **tab đang mở**. Tab `Đang xử lý` và `Quá hạn`: tìm **toàn bộ pending/overdue chưa hoàn tất**, không áp bộ lọc ngày của ba tab kết quả. Ba tab `Đã có hàng`, `Cho phép Skip`, `Picker đã thu hồi`: **tuyệt đối giới hạn đúng khoảng ngày hiện áp dụng**, lọc theo `report_batches.first_report_at` như hiện tại; không tự mở rộng khoảng ngày, không tìm trên tab khác.
2. **Picker đã thu hồi:** **mỗi picker một dòng**; cùng SKU/batch được phép nhiều dòng. Không gộp mọi picker thành một dòng batch. Trình bày và phân trang phải phản ánh bản ghi picker thuộc đúng batch.
3. **Thời gian lọc 3 tab kết quả:** `first_report_at` của batch (giữ nguyên cách hiện có), **không** thay bằng `withdrawn_at`/`resolved_at`.

## F. Hai điểm nghiệp vụ còn cần Owner quyết định
1. **Badge/tab/KPI ở “Picker đã thu hồi”:** hiện `CLOSED` count theo **batch**, nhưng Owner chọn hiển thị **một dòng cho từng picker**. Chọn (A, khuyến nghị) giữ badges/KPI là **số đợt SKU** như hiện tại, song footer/pagination nói rõ **số dòng picker**; hoặc (B) đổi badges/KPI sang **số picker đã thu hồi** (thay đổi cách tính số đang hiển thị, tác động counters/realtime).
2. **Một picker báo–thu hồi nhiều lần trong cùng batch:** source `business-core.ts` cho phép thu hồi ticket rồi báo lại khi batch vẫn pending do picker khác còn OPEN. Chọn (A, khuyến nghị) **một dòng mỗi picker cho mỗi batch**, hiển thị lần thu hồi mới nhất, lịch sử báo/thu hồi của picker không biến mất khỏi dữ liệu; hoặc (B) một dòng **mỗi lượt thu hồi/ticket**, cùng picker có thể xuất hiện nhiều lần trong cùng batch. Phải giữ thời gian thu hồi `withdrawn_at` đúng ticket, không dùng `first_report_at` làm thời gian thu hồi riêng.
Các câu hỏi trên là **cần chốt để code**, không phải thiếu dữ liệu để phân tích kỹ thuật. Không suy diễn Owner duyệt một trong hai.

## Ranh giới
Code **NOT STARTED**; CI **NOT RUN**; Production **UNCHANGED**; Field **NOT TESTED**; 3 lựa chọn trước đã được Owner chốt, 2 điểm phía trên chờ quyết định; **chưa có quyền triển khai**. Không khẳng định mức giảm usage/cost khi chưa đo.

## Owner chốt bổ sung và lệnh triển khai 12/11/2026
- Điểm F1: **A**, badge/KPI Picker thu hồi = số batch/đợt SKU theo source hiện tại; danh sách/phân trang = số dòng picker. Tuyệt đối không lấy số picker nhân lên thành số đợt.
- Điểm F2: **A**, một picker trong mỗi batch chỉ một dòng, lấy `MAX(withdrawn_at)` khi có nhiều ticket đã rút trong đợt. Dữ liệu lịch sử vẫn nguyên.
- Owner cấp quyền triển khai Web **3.3.7** và API Worker D173 liên quan theo phương án đã chốt, sau exact code/CI, D172 isolation, bảo vệ protected main, owner-specific release gate. Không chạm Agent/APK/Firebase/Stable/D172 data hay cấp FIELD/OWNER PASS.
- Source ứng viên hiện tại trong PR #942, không tuyên bố CODE/CI/RELEASE PASS khi chưa kiểm. Nguồn kiểm chứng là GitHub Actions + SHA khi hoàn thành.
