# D173 — Web 3.3.6: Owner backlog cải tiến nghiệp vụ và trải nghiệm (11/11/2026)

**Trạng thái:** Owner **đồng ý ghi nhận toàn bộ định hướng cải tiến** từ lần review source và 13 ảnh Web thực tế, bổ sung bốn nhóm yêu cầu mới. **Chỉ tài liệu/backlog; CHƯA duyệt chạy code, thay đổi dữ liệu, CI phát hành hoặc deploy.** Mọi chi tiết mới dưới đây là thiết kế đề xuất để rà soát khi có lệnh triển khai, không mặc nhiên được chốt theo cách hiện thực cụ thể.

**Repo:** `tamnv2/supra-inventory`; **phạm vi:** D173 Báo hàng (Web và API nghiệp vụ tương ứng khi được duyệt). D172 OB×PP1291 độc lập HOLD; không thay đổi dữ liệu/luồng riêng D172. Stable OWNER-GATED.

## 1. Lời Owner và mục tiêu ưu tiên

Owner xác nhận Web hiện tại thiếu nhiều tiện ích nghiệp vụ nhỏ, danh sách và thao tác rườm rà/tốn diện tích, báo cáo sai trọng tâm, các nghiệp vụ chính còn sơ sài. Owner chấp nhận lưu các đề xuất UX đã review trước đó **để chạy code sau khi duyệt triển khai**. Các yêu cầu cụ thể mới:
1. Danh mục **Nhà thầu** dựng sẵn để chọn khi tạo/nhập nhân sự; hạn chế gõ lặp lại.
2. Cách hiển thị **số lượng nhân sự** và thao tác tìm/lọc/quản lý phải chính xác, súc tích, thuận tiện.
3. **Báo cáo phải tập trung so sánh 7 ngày gần nhất theo cùng khung giờ**, tìm dấu hiệu cải thiện hoặc kém hiệu quả vận hành, thay vì chỉ trưng bày biểu đồ/tổng lượng.
4. Rà soát bổ sung các **tiện ích nghiệp vụ nhỏ có giá trị thực tế**, không thêm tính năng ngẫu nhiên ngoài scope.

## 2. Source và ảnh đã kiểm chứng

- Production Web 3.3.6 theo `ops/current-context.json`/chứng từ D173-E185, chưa đồng nghĩa FIELD/OWNER PASS toàn diện. Main pin khi tiếp nhận: `a8ff7fa267702655558ffcb1acd53b159ff1f2a6`.
- `web/src/hr-web-panel.ts`: trường `contractorName` nhập tự do. `web/src/hr-excel.ts`: Excel yêu cầu tên Nhà thầu dạng chuỗi. `service/src/user-management-core.ts`: lưu `users.contractor_name` dạng text, chưa có bảng danh mục Nhà thầu ràng buộc.
- `web/src/operational-app.ts` `renderUsers`: `activeCount`, `pickerCount`, `reporterCount` đếm từ `managedUsers` đang phân trang, không phải tổng toàn hệ thống. `service/src/user-management-core.ts` `listUsers` chỉ trả `total` theo bộ lọc và `items` trang đang mở; mặc định loại `ROOT` khỏi bảng quản lý.
- `service/src/business-core.ts` `adminDashboard`: `spanMs <= 2 ngày` nhóm theo giờ, hơn 2 ngày tự nhóm theo ngày; `web/src/operational-app.ts` dashboard dùng `timeline.slice(-24)`, không biểu diễn 7 ngày × giờ có đối chiếu tương đương.
- `web/src/operational-app.ts` `renderReports`: danh sách theo đợt/SKU 12 cột, không trực tiếp tra mã Picker; phải bấm `Xem Picker` để truy vấn chi tiết từng đợt. API báo cáo lọc `b.first_report_at`, không lọc theo `t.reported_at` hay mã Picker.
- 13 ảnh thực tế do Owner gửi: màn hình queue 0 vẫn chiếm hai vùng trống cao; tab kết quả lặp 5 KPI; báo cáo đặt tổng hợp dày đặc trên khu vực tra cứu; bảng/nhật ký có font nhỏ và nhiều cuộn; form nhân sự thừa nhiều diện tích.
- `docs/specs/REPORTING_DASHBOARD.md` đã xác định thông số ca 06:00–<14:00, 14:00–<22:00, ngoài ca/tăng ca và có **So sánh ca ở Excel D148**; điều này **không** đồng nghĩa Web đã có so sánh 7 ngày theo khung giờ. Không suy diễn rằng workbook hiện tại đã đạt yêu cầu mới.

## 3. Backlog Owner đã chấp thuận về định hướng — chưa cho thực thi

### P0-A: Tra cứu Picker trực tiếp và thiết kế lại danh sách vận hành/báo cáo

- Hai lối nhìn: `Theo Picker` (mã nhân viên/tên) và `Theo SKU/đợt`, từ một màn tra cứu trực tiếp. Dữ liệu theo Picker hiển thị từng ticket của Picker (SKU, tên, ngày/giờ báo, khu vực có xác thực, trạng thái, xử lý, thời gian chờ, kết quả đã hiển thị/ACK).
- Dùng danh sách gọn và các cột nghiệp vụ cần đọc trước; chỉ bung chi tiết khi thực sự cần; hạn chế bảng lồng và đa cuộn ngang. Khi không có hàng chờ thì khung rỗng phải tự thu; không giữ min-height lớn mặc định.
- Phân biệt `report_tickets` (mỗi Picker một ticket) và `report_batches` (mỗi đợt SKU), đợt tái phát giữ riêng. Xem theo Picker phải lọc theo `ticket.reported_at` thời gian VN; theo batch giữ ngữ nghĩa batch; không đổi kết quả nghiệp vụ hoặc thống kê cũ.
- Giữ RBAC hiện hành; không mở quyền xem dữ liệu cho đối tượng chưa được phép. Realtime chỉ tận dụng luồng cũ, không thêm polling/WebSocket; chặn hiển thị cache quá hạn như dữ liệu mới.

### P0-B: Danh mục Nhà thầu dùng chung trong **nghiệp vụ nhân sự D173**

**Hướng đề xuất**, chưa chốt schema/quyền:
- Danh mục gồm mã định danh ổn định, **tên hiển thị**, trạng thái đang dùng/ngừng dùng, thời điểm và tài khoản sửa đổi; tên hiển thị thống nhất, ngăn trùng sau khi trim/casefold chuẩn hóa. Không cần thêm trường pháp lý/thuế vì Owner chưa yêu cầu.
- Mục `Danh mục Nhà thầu` gọn trong `Nhân sự & tài khoản` hoặc menu quản lý, cho phép tạo/sửa/vô hiệu hóa đúng quyền. Form thêm/sửa Picker dùng dropdown searchable (không gõ tay nếu có danh mục); Excel vẫn chấp nhận tên Nhà thầu hiện hữu nhưng phải **map/validate trước khi áp dụng**.
- Đối với tên cũ chưa nằm trong danh mục: cho xem trước các tên chưa khớp và phương án ánh xạ; **không tự đổi tên/ngầm tạo Nhà thầu hàng loạt, không tự cập nhật ngược nhân sự lịch sử**. Sửa tên Nhà thầu cần quyết định về hiển thị lịch sử vs cập nhật danh sách; xóa có liên kết nhân sự phải chặn hoặc ngừng sử dụng, không xóa mất dữ liệu.
- Không sử dụng danh mục chung với D172 chỉ vì cùng Worker/InventoryCore. Có thể nghiên cứu bảng D173 riêng trong cùng hạ tầng đăng ký khi Owner duyệt scope/migration.
- **Chưa được Owner quyết định**: quyền quản lý master (đề xuất Admin/ROOT; PickPack Admin chỉ sử dụng để nhập Picker), xử lý rename liên kết và chuyển đổi các giá trị text cũ. Đây là điều kiện fail-closed trước khi viết chức năng sửa dữ liệu.

### P0-C: Số lượng nhân sự chính xác và thao tác gọn

- **Tổng nhân sự/tài khoản** phải lấy từ aggregate phía máy chủ trong đúng phạm vi quyền, không đếm trang UI. Phân biệt:
  - tổng tài khoản (mẫu số rõ, gồm/không gồm ROOT được ghi nhãn đúng);
  - Picker/Reporter theo toàn bộ danh sách thuộc phạm vi;
  - đang hoạt động (`status=ACTIVE`) vs đã dừng;
  - Picker đã bật Báo hàng vs tắt;
  - phiên **online/kết nối realtime** là thước đo riêng, **không** suy từ `ACTIVE` hay `last_login_at`.
- Hiển thị gọn một dải số liệu, tránh ba card quá cao. Kết quả tìm kiếm, số ở trang và toàn phạm vi được ghi nhãn khác nhau. Tìm theo mã/tên/nhà thầu, lọc nhanh role/trạng thái/nhà thầu, giữ trạng thái lọc khi sửa và quay lại. Không bắt người dùng chuyển nhiều màn để tra một người.
- Các hành động thường dùng giữ trên dòng hoặc menu thao tác liên quan, vẫn yêu cầu xác nhận cho xóa/khóa và bảo vệ ROOT/ADMIN. Sử dụng aggregate trong **cùng** endpoint danh sách khi có thể; đo SQL Rows Read và request trước/sau, không tạo một call riêng cho từng ô thống kê.

### P0-D: So sánh vận hành 7 ngày gần nhất — **trọng tâm báo cáo**

**Mục tiêu nghiệp vụ:** phát hiện khung giờ và ngày có báo thiếu tăng, chậm giải quyết, nhiều Skip, backlog tồn và kiểm tra thay đổi vận hành có cải thiện thật không. Không biến kết quả thành chấm điểm từng nhân viên.

**Bố cục đề xuất:**
1. Mặc định hiển thị 7 ngày lịch gần nhất theo giờ Việt Nam **gồm hôm nay**, đánh dấu ngày hiện tại là chưa hoàn chỉnh; khi so sánh cùng giờ chỉ lấy các khung đã hoàn thành ở cả ngày đang so. Có thể đổi sang 7 ngày hoàn chỉnh sau nếu Owner chốt.
2. Bảng/heatmap **7 ngày × khung giờ** (06:00–22:00 theo khung giờ 1h; ngoài ca/tăng ca để riêng) và biểu đồ xếp chồng/đặt cạnh cùng khung giờ qua bảy ngày; chọn giờ để xem chênh lệch từng ngày.
3. KPI lõi: lượt Picker báo theo `ticket.reported_at`, số SKU khác nhau, số batch phát sinh, số batch xử lý, thời gian xử lý bình quân, tỷ lệ Có hàng/Skip/Thu hồi trên **cùng một mẫu số đã định nghĩa**. Nếu nguồn cho phép bổ sung đầu/cuối giờ tồn chờ và thời gian chờ Picker, có ngưỡng đạt/chưa đạt và giải thích.
4. Cảnh báo theo dữ liệu: tăng/giảm so với trung bình **cùng giờ của những ngày có dữ liệu đủ**; trình bày hiệu quả theo tỷ lệ/độ trễ chứ **không kết luận tốt chỉ vì số lượt báo giảm**. Ngày thấp tải, đợt chưa kết thúc, ngày chưa trọn khung phải được đánh dấu, không kết luận nhân quả.
5. Drill-down: chọn ngày/giờ → danh sách batch và ticket đúng cửa sổ → tra Picker/SKU trực tiếp; xuất Excel giữ đúng bộ lọc và định nghĩa.

**Nguyên tắc tính:**
- Dữ liệu theo sự kiện báo và xử lý cần giữ hai mốc độc lập: `ticket.reported_at` vs `batch.resolved_at`. Không tính tỷ lệ hoàn tất bằng phép chia hai tập khác nhau một cách sai lệch. Nếu tính tỷ lệ hoàn tất theo cohort, mẫu số phải là `batch.first_report_at` trong giờ đã chọn; mẫu có thời hạn chưa đủ cần loại hoặc đánh dấu chưa kết luận.
- Thời gian VN +07; số 0 thực sự khác `không có dữ liệu`. Với đầu ngày/ngoài ca không suy diễn giờ âm hay gộp 05:30 vào 06:00.
- Đánh giá index và aggregate SQL theo ngày/giờ trong giới hạn 7 ngày; reuse một endpoint/đường tải khi hợp lý, bounded response, zero new polling. Benchmark request/DO Rows Read/CPU và thời gian phản hồi trước sau.

### P1-E: Rà soát toàn Web những tiện ích nhỏ có giá trị vận hành

Bốn nhóm chức năng phải được rà soát từng thao tác trong code và ảnh Owner:
- Danh sách: tìm nhanh, bộ lọc rõ, giữ lựa chọn/trang sau thao tác, tránh reload/rerender toàn bộ khi chỉ một hàng đổi; lộ rõ actions thường dùng, giữ bảo vệ lệnh nguy hiểm.
- Vận hành: trạng thái rỗng compact, không lặp card tổng hợp vào mọi tab, thông tin Picker trực tiếp theo ngữ cảnh.
- Nhân sự: form rộng hợp lý, dropdown Nhà thầu và kết quả kiểm tra trước khi ghi, số lượng chính xác toàn phạm vi.
- Nhật ký/tổng quan: tiêu đề nhật ký mô tả nguồn/mức độ/máy/thời gian theo **log thật**; ẩn panel chi tiết khi chưa chọn, đưa dữ liệu quyết định lên trước biểu đồ trang trí.

Các tiện ích khác chưa được Owner chỉ định là **đề xuất cần review**, không được tự ý phát sinh chức năng hoặc provider resources.

## 4. Điều kiện CODE/CI/RELEASE trước khi Owner cho phép triển khai

- Owner phải ra **lệnh triển khai mới**; approval trong yêu cầu hiện tại **chỉ ghi nhận backlog**, không cho phép chỉnh Web/API/SQLite/Provider/Android/Agent.
- Trước code phải rà ảnh thực tế + code + guard RBAC, nêu rõ trường dữ liệu, tương thích Excel, quyền Nhà thầu và cách xử lý dữ liệu Nhà thầu đang có. Chưa rõ thay đổi schema/quyền → fail-closed.
- Có test tái hiện lỗi đếm nhân sự theo trang; test toàn hệ thống/pagination/role/contractor/đang bật Báo hàng; case lọc theo Picker, hai ticket một batch, tái phát, nhiều ngày, kết quả sửa và ACK.
- Test thống kê 7 ngày ở biên 00:00/06:00/14:00/22:00 và ngày hiện tại thiếu giờ; cùng mẫu số, không nhầm ngày báo với ngày xử lý; empty/no-data, timezone.
- Benchmark số click, thời gian tìm Picker, mật độ/cột/scroll ở các cỡ màn, request count, DO Rows Read và realtime/latency trước-sau. Không tuyên bố giảm usage hoặc tăng tốc nếu chưa đo.
- Nếu code chạm Worker/InventoryCore dùng chung, bắt buộc isolation guard và regression **cả D172/D173**; D172 riêng và Stable không tự deploy. PR/CI/release/field/Owner PASS tách biệt.

## 5. Trạng thái chi tiết

- **Đã xác minh:** source và ảnh Web3.3.6 có nhược điểm như mục 2, endpoint không có bảng master contractor, không có so sánh 7 ngày × giờ trực tiếp, số người theo trang.
- **Owner quyết định:** ghi nhận toàn bộ hướng cải tiến đã review + thêm mục Nhà thầu, nhân sự và phân tích vận hành 7 ngày để thực hiện **khi có lệnh duyệt triển khai**.
- **Chưa quyết định:** cụ thể hóa quyền sửa danh mục, migration/sửa tên Nhà thầu, định nghĩa KPI/so sánh 7 ngày, UX chi tiết, phạm vi phát hành, ngưỡng đo trước-sau.
- **CODE:** NOT_STARTED; **CI:** NOT_RUN; **RELEASE:** NOT_REQUESTED; **FIELD:** NOT_TESTED; **OWNER PASS:** NOT_GRANTED.
- **Lưu tại:** PR #924 Draft docs-only và nhật ký D173, không merge thành code.

## 6. Owner chốt bổ sung 3 nguyên tắc thiết kế (11/11/2026)

**Quyết định Owner:** “Ok đồng ý ghi nhận 3 cải tiến em đề xuất vào cùng các đề xuất trước đó để khi triển khai sẽ chạy code.” Đây là **phê duyệt đưa cả 3 nguyên tắc vào backlog cùng bộ D173 Web đã ghi nhận**, không phải lệnh viết code hoặc phát hành ngay. Không đổi lựa chọn riêng của Owner trước đó.

1. **Danh sách là nơi làm việc trực tiếp:** tìm kiếm → xem chi tiết → thao tác trong cùng ngữ cảnh, giữ nguyên bộ lọc/trang/vị trí cuộn, tránh nhiều modal và quay trang. Áp dụng phù hợp cho Picker, SKU, nhân sự, lịch sử; RBAC và các xác nhận nghiệp vụ nguy hiểm không được bỏ.
2. **Dashboard giúp phát hiện và điều tra nguyên nhân:** ưu tiên so sánh vận hành **7 ngày gần nhất theo cùng giờ** có mẫu số, số lượng mẫu, thời gian xử lý, tỷ lệ kết quả, tình trạng tồn chờ. Chọn ngày/giờ/SKU để mở bản ghi gốc tương ứng; không kết luận ít báo hơn đồng nghĩa hiệu suất tốt hơn, không tự tạo bảng xếp hạng nhân viên.
3. **Nhập liệu theo danh mục chuẩn và xác thực trước khi ghi:** khởi đầu bằng danh mục Nhà thầu, chọn nhanh khi tạo/sửa Picker, ánh xạ tên trong Excel và nêu rõ trường không khớp, cảnh báo trùng và xem trước thay đổi. Không tự suy diễn mở rộng danh mục ngoài dữ liệu D173 đã biết; schema/quyền sửa/migration dữ liệu cũ vẫn chờ phê duyệt cụ thể trước khi code.

**Tiêu chí kiểm thử tích hợp khi được triển khai:** đo số lần click/đổi màn, thời gian tra cứu, tổng số theo phạm vi quyền, tính đúng ticket/batch, timezone và 7×giờ; giữ Excel/ACK/realtime/RBAC/usage, không tạo polling mới. Mọi thay đổi Worker/InventoryCore dùng chung phải kiểm thử isolation D172 và D173. **CODE NOT STARTED; CI NOT RUN; RELEASE NOT AUTHORIZED; FIELD/OWNER PASS NOT CLAIMED.**
