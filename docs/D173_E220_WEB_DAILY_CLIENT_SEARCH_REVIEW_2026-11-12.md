# D173-E220 — Web 3.3.10 FIELD FAIL: đổi thành ngày đơn và tìm SKU tại trình duyệt (12/11/2026)

## Lệnh Owner / bằng chứng FIELD
- Owner xác nhận dù nhập SKU đúng, Web 3.3.10 vẫn thông báo kết quả tìm SKU không khớp bộ lọc.
- Owner đề nghị bỏ phân trang hiển thị, hiển thị toàn bộ dữ liệu; bỏ nút Hôm nay/Hôm qua/7 ngày/30 ngày và Từ/Đến; chỉ một lịch chọn ngày; F5/đăng nhập lại mặc định ngày hiện tại; tìm SKU ngay tại Web, không phát request tìm kiếm đến Service sau mỗi lần gõ.
- Hình ảnh đã được Owner gửi trong hội thoại; không đẩy ảnh, SKU hay dữ liệu Production lên repo public.

## Bằng chứng mã nguồn mới nhất
- Base `main` `da5f6948852777528ced565cf894b35364841ee0`. Web 3.3.10 released `93e677cb99963a90455da446dbe1f03678153603`, deploy `43183196333` SUCCESS, FIELD SKU search NOT PASS.
- `web/src/api.ts#getReporterRecent` thực sự gửi `sku_suffix`, `picker_rows`, `include_totals`.
- `service/src/read-api.ts` chuyển tiếp cả ba tham số trên đến `/authorized/operational/reporter/recent`.
- **Xác định lỗi ở `service/src/core.ts`**: handler `/authorized/operational/reporter/recent` chỉ whitelist `limit, offset, status, scope, from, to`, loại bỏ `sku_suffix`, `picker_rows`, `include_totals` trước khi chuyển đến `service/src/operational-v2-core.ts#reporterRecent`. Handler overdue tương tự bỏ `sku_suffix`. Do đó query Core không nhận suffix; Web E216 đúng logic fail-closed cảnh báo khi server trả SKU ngoài bộ lọc.
- Hệ quả code-level: tìm SKU ở results/overdue bị bỏ lọc; `CLOSED` không nhận `picker_rows=1` để tách Picker thu hồi; khi không có suffix, `reporterRecent` có thể chạy tổng hợp trạng thái/ACK trên từng page. Các tác động FIELD cụ thể khác ngoài lỗi tìm SKU **chưa kiểm tra authenticated Network**.
- Web hiện chỉ lấy `RECENT_PAGE_SIZE=50` và Service chặn `limit<=200`; tab result render footer Previous/Next. Queue đã gọi `loadCompleteReporterQueue` theo page 200, nhưng overdue còn một page 200 rồi search suffix phía Service.

## Review phương án và tác động (chưa code / chưa release)
1. **Ba tab kết quả** (`Đã có hàng`, `Cho phép skip`, `Picker đã thu hồi`): chỉ **một date picker**; ngày mặc định theo giờ VN, không lưu ngày qua F5/đăng nhập mới. Chọn ngày nào chỉ hiển thị kết quả có `first_report_at` trong 00:00–24:00 ngày VN đó. Giữ ngày khi đổi giữa ba tab trong cùng phiên.
2. **Không phân trang trên giao diện**: Web tải đủ dữ liệu của **ngày + tab đang xem** từ API hiện hữu bằng nhiều request `limit=200`/offset liên tiếp, dedupe an toàn rồi hiển thị một danh sách cuộn. Không tăng server `limit` vượt 200; không tải trước cả ba tab nếu chưa vào để tránh usage thừa. Khi đổi tab/ngày, làm mới scope/cache; nếu tải không đủ, báo lỗi rõ và không tuyên bố danh sách đầy đủ.
3. **Tìm SKU hoàn toàn local** trên tập đã tải đầy đủ, giữ nghiệp vụ tìm đuôi chữ số hiện hữu; nhập/xóa liên tục không gửi tìm kiếm về Service, không refresh counter; kết quả phản hồi ngay trên Web. `CLOSED` vẫn phải bảo toàn **một dòng/Picker thu hồi**, không biến thành một dòng/batch.
4. **Đang xử lý / Quá hạn** là tồn đọng realtime theo tình trạng OPEN, **không lọc ngày báo đầu tiên** vì đơn cũ chưa xử lý phải tiếp tục xuất hiện. Queue đã load toàn bộ; overdue cần đủ page 200 (không suffix server), tìm trong RAM. Date picker chỉ nằm tại ba tab kết quả; thanh tab chung giữ nguyên.
5. **Realtime**: batch/Picker updates cập nhật cache dựa trên event đúng batch/status/ngày; khi thiếu snapshot, sai số lượng, ngày đổi hoặc event gap, gọi đúng một reconcile theo active scope, không poll mỗi phím; không cắt xuống 50 dòng theo cũ. Nếu số lượng dữ liệu thay đổi trong lúc lấy nhiều trang, đối chiếu total/dedupe, thử lại có giới hạn; không dùng cache thiếu.
6. **Phạm vi hạ tầng cần xem xét**: tối thiểu sửa whitelist params `sku_suffix`, `picker_rows`, `include_totals` ở `core.ts` để bảo toàn nghiệp vụ hiện hữu. Cân nhắc cơ chế bỏ tổng hợp ACK/summary ở các page tiếp theo (có gate) nhằm tránh lặp DO Rows Read. Service là Worker/DO **dùng chung hạ tầng**, do đó bắt buộc D172 độc lập hồi quy và đúng quyền Owner trước khi sửa/phát hành; không sửa business D172, schema, Agent, APK, Firebase, Stable.
7. **Usage/hiệu năng**: với 357 kết quả/ngày như UI, tối thiểu 2 page API (200+157) để tải đủ thay vì 1 page 50 hiện tại; không phát sinh request khi gõ SKU. Nhưng tổng Rows Read, dung lượng JSON, thời gian render ban đầu có thể tăng; chưa có thử nghiệm nên **không cam kết giảm tổng usage hoặc không chậm**. Test 357, 1.000, 2.000 dòng, chuyển ngày/tab, phím tìm liên tiếp, realtime đang thêm/xóa/sửa, deadline correction, mất mạng và auth đổi. Cache RAM theo phiên, không lưu toàn bộ dữ liệu nghiệp vụ vào localStorage/IndexedDB.

## Điều kiện PASS đề xuất
- Web mới mặc định ngày VN hôm nay sau F5/truy cập lại; chỉ một bộ chọn ngày và không có nút preset/Từ/Đến ở ba tab kết quả.
- Không có nút phân trang ở tất cả năm tab; mỗi tab hiển thị đủ dữ liệu đúng nghiệp vụ (queue/overdue không bị che do ngày).
- Tìm SKU nội bộ đúng, kể cả SKU hợp lệ không tìm thấy; **0 API search request trên mỗi lần gõ**, không hiển thị tập bị thiếu là kết quả hoàn chỉnh.
- Kết quả/status, đếm tab, Picker thu hồi, sửa kết quả, quyền, realtime và thứ tự nghiệp vụ không lệch. D172 independent regression + source CI PASS, theo dõi DO Requests/Rows Read, latency trước/sau.
- **Chưa ghi CODE/CI/RELEASE/FIELD/OWNER PASS**, chưa cho phép merge/deploy từ hồ sơ review này. Chỉ chỉnh code sau khi Owner xem impact về ngày trên queue/overdue và workload tải tất cả rows.

## Trạng thái
**FIELD Web3.3.10: NOT PASS** (lỗi SKU). **Phương án: REVIEW ONLY**, Owner yêu cầu thiết kế lại, ranh giới/nguy cơ cần xác nhận trước code. E219 Technical Release PASS vẫn là sự thật; không suy diễn Owner PASS. D172 **PENDING/HOLD**; Stable **OWNER-GATED**.
