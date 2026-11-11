# D173 — Đối chiếu Web công khai và đề xuất tiện ích chủ động (11/11/2026)

**Trạng thái:** Research + đề xuất chưa duyệt; **KHÔNG cấp lệnh CODE, migration, CI hoặc phát hành**. Owner yêu cầu AI **chủ động tham khảo các web công khai có nghiệp vụ tương tự**, tự tìm tiện ích nhỏ có giá trị, không chỉ lặp yêu cầu đã nêu. Đây là backlog mở rộng D173 Báo hàng, không liên quan D172 OB×PP1291. Bản nền Main `a8ff7fa267702655558ffcb1acd53b159ff1f2a6`; Production Web theo receipt 3.3.6, FIELD/OWNER pending.

## Nguồn công khai đã kiểm tra

1. Oracle Warehouse Management, Warehouse Execution Command Center & Picking Exceptions: theo dõi ngoại lệ, nguy cơ tắc, điều tra short-pick theo mức ảnh hưởng và vào chi tiết; **không** đề xuất sao chép Oracle AI/wave/WMS vì SUPRA Báo hàng không sở hữu các dữ liệu ấy.
   - https://docs.oracle.com/en/cloud/saas/warehouse-management/26d/owaig/warehouse-execution-command-center.html
   - https://docs.oracle.com/en/cloud/saas/warehouse-management/26d/owaig/resolve-picking-exceptions.html
2. Odoo, Search/Filter/Group/Favorites: bộ lọc được lưu, nhóm dữ liệu và đặt mặc định; https://www.odoo.com/documentation/19.0/applications/general/search.html
3. Odoo, Batch picking: nhóm nghiệp vụ/lượt thao tác theo bối cảnh; https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory/shipping_receiving/picking_methods/batch.html
4. ERPNext/Frappe, Field Types: `Link` field tham chiếu danh mục thay chuỗi tự do; https://docs.frappe.io/erpnext/field-types
5. Retool, Table, Filters, Pagination: quick search, bulk actions, expandable rows, pagination ở phía server, lọc tại query khi bật server-side; https://docs.retool.com/classic-apps/guides/data/table/ và https://docs.retool.com/classic-apps/guides/data/table/pagination
6. Appsmith, table CRUD: tìm kiếm, sort, phân trang, chỉnh ngay trong bảng; https://www.appsmith.com/blog/the-complete-table-widget-building-complex-tables-with-appsmith
7. Metabase, time grouping, heatmap và drill-through: so sánh giờ/ngày, từ ô KPI xuống tập bản ghi; https://www.metabase.com/docs/latest/questions/visualizations/pivot-table và https://www.metabase.com/docs/latest/questions/visualizations/drill-through
8. Microsoft Dynamics 365 Warehouse mobile menu: trình đơn theo vai trò và thao tác hỏi đáp nhanh; https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/configure-mobile-devices-warehouse

**Lưu ý:** Nguồn bên ngoài chỉ chứng minh mẫu thiết kế/khả năng tham khảo, không chứng minh Web SUPRA đã/không có từng chức năng. Mục “hiện trạng” dưới đây đối chiếu trực tiếp source D173.

## Hiện trạng SUPRA đã xác minh trong mã nguồn

- `web/src/operational-app.ts`: nhiều màn HTML dựng trực tiếp từ một module ~5940 dòng; `renderUsers` thống kê active/PICKER/REPORTER từ **trang** `managedUsers`; có search/filter, pagination và một số bulk actions rồi, nhưng chưa thấy saved view cho danh sách; `renderReports` tra đợt/SKU, “Xem Picker” nạp chi tiết theo batch; dashboard hiện tại có trend nhưng `service/src/business-core.ts` chỉ nhóm **ngày** khi range >2 ngày.
- `web/src/hr-web-panel.ts` và `web/src/hr-excel.ts`: đã có nhập Excel mẫu, validate/preview và CRUD Picker; tên Nhà thầu còn text tự do; `service/src/user-management-core.ts` chỉ ghi `contractor_name`, chưa có contractor master có ID riêng.
- `web/src/operational-app.ts`: đã có các tab trạng thái, phân quyền, hành động status và xác nhận, logs Web/Android/Audit và logic ACK. **Không đề xuất làm lại các phần đã có**, chỉ nâng trải nghiệm theo ngữ cảnh; không tự bỏ xác nhận nguy hiểm.
- `docs/specs/REPORTING_DASHBOARD.md`: Excel đã có so sánh ca D148, 60-day bounded report; **chưa có Web so sánh 7 ngày × giờ**.

## Đề xuất tiện ích mới — để Owner review, chưa duyệt code

Ưu tiên dựa trên (1) số click giảm, (2) năng lực nghiệp vụ, (3) có nguồn dữ liệu trong D173, (4) chi phí/usage thấp, (5) nguy cơ đổi nghiệp vụ.

| ID | Ưu tiên | Mục nhỏ | Ví dụ thao tác / lợi ích | Đánh giá source / thực hiện |
| --- | --- | --- | --- | --- |
| X01 | P0 | **Bộ lọc yêu thích theo vai trò** | Admin chọn “Picker đang bật Báo hàng + Nhà thầu A”, lưu bộ lọc để lần sau mở một click; khôi phục bộ lọc/trang sau sửa. | Khác bộ lọc tạm thời đã có; lưu cấu hình tại browser/session hoặc theo tài khoản được duyệt, **không** chia sẻ dữ liệu trái quyền. |
| X02 | P0 | **Ghim/hide và sắp xếp các cột** | Chỉ xem Mã nhân viên, Nhà thầu, Quyền, Tình trạng; mở rộng cột khác khi cần; header cố định. | UI-only ưu tiên, giữ Export hoàn chỉnh; không ảnh hưởng dữ liệu. |
| X03 | P0 | **Thao tác ngữ cảnh ngay trên dòng** | Chọn một Picker → panel bên cạnh hiện vai trò, Nhà thầu, Báo hàng đang bật, lần kết nối gần nhất và các nút đúng quyền; không phải quay menu hoặc mở nhiều popup. | Danh sách có menu và chi tiết rời rạc, reuse API hiện hữu; kiểm tra RBAC cho từng thao tác. |
| X04 | P0 | **Sao chép nhanh + tìm bằng Enter/quét** | Một click copy SKU/mã nhân viên; ô tìm kiếm tự focus khi chủ động vào tra cứu; Enter tìm, Escape đóng panel; không bắt chọn/bấm Áp dụng nhiều lần. | Chủ yếu UI-only; không tự tạo mutation bằng phím quét. |
| X05 | P0 | **Chi tiết kèm dòng thời gian xử lý** | Mở SKU một lần thấy báo đầu tiên, Picker thêm vào, xác nhận Có hàng/Skip, chỉnh kết quả, những Picker đã hiển thị/nhận. | Audit/events/ACK có nguồn hiện hữu ở nhiều màn; phải ghép đúng `batch_id`/`ticket_id` và quyền, phân biệt ticket-vs-batch. |
| X06 | P0 | **Xem nhanh danh sách người chưa nhận kết quả** | Thay vì chỉ thấy `581/584`, bấm vào số chưa hiển thị/nhận để lấy đúng danh sách có quyền truy cập và thời điểm cuối, đối chiếu đã hiển thị vs đã bấm xác nhận. | Source có result ACK/receipt; chưa chứng minh endpoint thuận tiện nên cần xem D172-guard/performance. |
| X07 | P0 | **Chia cột chế độ “Báo cần theo dõi”** | Tab Đang xử lý ưu tiên báo chờ lâu, nhiều Picker bị ảnh hưởng và báo phát sinh lại, hiển thị lý do ưu tiên từ số liệu thật. | Có SLA/overdue/recurrence; **chỉ xếp/hiển thị**, không tự đổi thứ tự nghiệp vụ server hoặc khởi tạo status mới. |
| X08 | P0 | **Biểu đồ 7 ngày theo giờ có click mở bản ghi** | Chọn ô “Thứ ba, 14–15h” → danh sách những lượt báo và kết quả trong giờ đó; so với cùng giờ 6 ngày còn lại. | Chưa có 7×giờ Web; cần query bounded indexed và mẫu số thống nhất; không thêm polling. |
| X09 | P1 | **Cảnh báo dữ liệu nhân sự trùng/không khớp** | Khi nhập Picker/Excel, danh sách tên Nhà thầu chưa chuẩn hoặc mã trùng được gom thành bảng lỗi; sửa/xuất lỗi trước khi Apply. | Parser hiện đã validate/preview; bổ sung UX và mapping Nhà thầu; tránh duplicate cơ chế cũ. |
| X10 | P1 | **Danh mục Nhà thầu có tên chuẩn và bí danh nhập liệu** | “CTY A”, “Công ty A” map về cùng mã đã xác minh; dropdown gõ tìm; ngừng dùng thay vì xóa nếu nhân sự còn liên kết. | Contractor master là yêu cầu Owner đã ghi backlog; **bí danh/mapping** là tiện ích bổ sung, cần duyệt quy tắc đổi tên/migration và quyền. |
| X11 | P1 | **Thống kê “Toàn bộ / Đang hoạt động / Đã dừng / Có quyền báo hàng”** | Một dải tổng nhân sự toàn phạm vi, click chỉ số lọc đúng danh sách; hiển thị số theo Nhà thầu mà không nhầm “active” với “online”. | Counts hiện đếm trang. Cần aggregate server có RBAC, không lấy đủ user về client. |
| X12 | P1 | **So sánh 7 ngày với 7 ngày trước theo cùng khung** | So lượt báo, đợt báo, thời gian giải quyết và tỷ lệ Skip cùng giờ/ca, hiển thị số mẫu và ngày chưa trọn. | Có dấu thời gian, chưa có đối sánh chuẩn Web; tránh khẳng định xu hướng nếu tải việc/số mẫu khác nhau. |
| X13 | P1 | **KPI bấm để lọc và xuất đúng phạm vi** | Bấm “Skip 186” → danh sách đúng 186 đợt, lọc ngày/nguồn xử lý; xuất chỉ phần đã chọn. | Một số KPI đã deep-link, cần thống nhất ở mọi view, bảo đảm KPI/bảng cùng mẫu số. |
| X14 | P1 | **Trang nhập nhân sự dạng đối chiếu thay đổi** | Xem “Tạo mới / Đổi tên / Chuyển Nhà thầu / Giữ nguyên / Lỗi”, xem từng dòng trước khi áp dụng, tải file các dòng lỗi. | Preview hiện có kế hoạch tạo/đổi; thêm giải thích và báo cáo lỗi, không tự apply. |
| X15 | P1 | **Danh sách nhật ký có nội dung tìm được** | Log hiển thị thiết bị/nguồn, mức lỗi, thời gian, loại sự kiện và tóm tắt an toàn; bấm mới lấy chi tiết; tránh các dòng “Định kỳ” không phân biệt. | Có log source/severity, metadata khác cần kiểm tra; không tự trích secret/token hay sinh provider call. |
| X16 | P2 | **Đường dẫn mở thẳng trạng thái/đối tượng có quyền** | Copy link xem SKU, Picker, bộ lọc/khung giờ để gửi người quản lý; khi mở phải kiểm tra lại phiên và RBAC, không nhúng token. | Route state hiện có cho sections, chưa xác minh deep-link tùy đối tượng; cần thiết kế chống lộ ID và riêng tư. |
| X17 | P2 | **Tối ưu thao tác hàng loạt theo quyền** | Chọn nhiều Picker cùng Nhà thầu hoặc tình trạng → preview số hợp lệ / từ chối rồi mới áp dụng; thao tác đã có thì dùng lại, không tạo bulk API trùng. | Bulk Picker hiện có với hành động nguy hiểm; chức năng mới chỉ nên mở sau rà soát RBAC/audit/sai sót. |
| X18 | P2 | **Ghim phân tích cần xem và ghi chú cá nhân không thay đổi nghiệp vụ** | Quản lý đánh dấu một SKU/đợt cần quay lại để điều tra, không chỉnh trạng thái và không gửi thông báo cho Picker. | Thay đổi dữ liệu mới nếu đồng bộ đa thiết bị; ưu tiên local user preference, cần quyết định liệu có thực sự cần. |

## Các phương án **không** tự đưa vào build

- Không sao chép WMS hoàn chỉnh: mua hàng, kho vị trí, replenishment, wave, nhân sự chấm công, biểu đồ năng suất từng cá nhân, giá trị tồn kho — thiếu quyền nguồn và không thuộc Báo hàng D173.
- Không bổ sung nút Skip nhanh bỏ qua confirm/OTP, gán trách nhiệm cá nhân, tự đổi SLA, tự gửi email/Slack, polling 5 giây hoặc đăng nhập/giải mã WMS — chưa có Owner approval và có rủi ro.
- Không dùng AI “dự đoán chắc chắn” hoặc quy kết hiệu suất từ tỷ lệ báo ít; nếu có nghiên cứu nâng cao thì trình bày dưới dạng kiểm tra dữ liệu, không phán quyết tự động.

## Thiết kế MVP đề xuất khi được Owner duyệt (chỉ cho review)

- **Gói UI ít rủi ro:** X01/X02/X03/X04 (nếu không mutation hay query ngoài guard), compact empty states, thu gọn logs; đo số click/viewport 1366–1920 và accessibility.
- **Gói dữ liệu nhân sự:** Nhà thầu X10 + X09 + X11 + X14, schema riêng D173, migrate không phá string cũ, kiểm tra Excel/role/SQL index trước code.
- **Gói báo cáo nghiệp vụ:** X05/X06/X07/X08/X12/X13; tiêu chí chính 7×giờ, số mẫu, cohort, drill-down và chuẩn hóa thời gian; tối ưu request/Rows Read trước khi triển khai.
- **Sau đo kiểm:** X15/X16/X17/X18 nếu còn giá trị thực tế và được duyệt riêng. Không thêm tính năng chỉ vì các web khác có.

## Tiêu chí PASS/ranh giới

- Chọn 1 Picker → xem mọi ticket trong khoảng ngày (bao gồm nhiều batch/đợt tái phát), so đúng kết quả và ACK; không mất dữ liệu qua phân trang.
- Số tổng theo role/contractor/status phải là server-authoritative, phân biệt toàn phạm vi/trang lọc/online; không thu thập hết dữ liệu client.
- 7 ngày × giờ so cùng múi giờ VN, cohort đúng, ngày chưa kết thúc đánh dấu, so sánh 7 ngày trước phù hợp, click ô → chi tiết đúng.
- Benchmark trước/sau về số thao tác, latency, SQL/DO Rows Read, DO requests, tác động realtime; không cam kết usage thấp hơn nếu chưa đo.
- CODE/CI/RELEASE/FIELD/OWNER PASS độc lập; không sửa resource riêng D172, dùng isolation guard nếu chạm Worker/InventoryCore chung; Stable OWNER-GATED.
- Đây là **PROPOSALS_UNAPPROVED**, không suy diễn lệnh hỏi/than phiền thành lệnh phát hành.
