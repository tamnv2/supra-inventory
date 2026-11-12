# D173 — Web Vận hành báo hàng: review UX và truy xuất picker theo đợt (12/11/2026)

## Trạng thái/quyền
- **Owner yêu cầu phân tích phương án xử lý 5 điểm UI/lookup; chưa ra lệnh CODE/RELEASE trong lượt này.**
- D173 Báo hàng Web v3.3.6; GitHub accepted main tại thời điểm rà soát `f9237ec593ce1e8ecc1f20af04ae497a5269fb08`. D172 OBPP1291 độc lập PENDING/HOLD, Stable OWNER-GATED.
- Chỉ ghi checkpoint/phương án; **KHÔNG sửa runtime, API, DB, Worker, APK, Agent hoặc phát hành**. FIELD/OWNER PASS của mục mới = chưa có.

## 5 yêu cầu Owner (tóm tắt ẩn dữ liệu nhân sự thực tế)
1. Bỏ nút điều hướng **Mở báo cáo chi tiết** trong màn hình kết quả vận hành; không tự xóa các trang báo cáo/nghiệp vụ sẵn có.
2. Tab **Picker đã thu hồi**: cột Người xử lý hiện `mã nhân viên - họ tên`, không phải chữ “Picker”. Tab **Đã có hàng**/**Cho phép Skip**: double-click dòng SKU sẽ mở chi tiết ngay dưới dòng về mã/tên/thời điểm `reported_at` của từng picker **đúng batch**, và thu gọn khi double-click tiếp.
3. Ô `Tìm SKU` trên cùng hàng tabs; chỉ số, kích hoạt tự động khi >=3 chữ số, không có nút, tìm trong **toàn bộ server-side result thuộc phạm vi trạng thái và khoảng ngày**, không chỉ 50 dòng trang hiện tại. Khi đổi tab, tìm trong tab mới.
4. Bộ lọc **Hôm nay/Hôm qua/7 ngày/30 ngày/Từ ngày/Đến ngày** chuyển sang bên phải cùng hàng tabs, không có nút Áp dụng; chọn preset/ngày hợp lệ sẽ tự áp dụng, giữ date boundary/validations.
5. Tab **Đã có hàng** và **Cho phép Skip** thêm cột **Thời gian báo hàng đầu tiên** đứng ngay trước **Thời điểm xử lý**.

## Bằng chứng source tại main
- `web/src/operational-app.ts`: `renderOperationalTabs` quanh L1595 chỉ xuất năm tab; `renderResults` quanh L1814–1875 hiện có nút `recent-open-report`, form `recent-range-form` + Áp dụng, 50 kết quả/trang, `CLOSED ? "Picker" : resolutionActorLabel(row)`, hiển thị `resolved_at || first_report_at`. `bindSection` quanh L5015–5058 đã auto-load preset nhưng date chỉ submit. `loadReporterRecentSnapshot` quanh L3698 dùng limit/offset/status/from/to, chưa có query.
- `web/src/api.ts`: `getReporterRecent` quanh L1188–1218 chưa gửi search query; `getReporterBatchTickets(batchId)` quanh L1220 đã sẵn, bảo vệ bằng authenticated path.
- `service/src/operational-v2-core.ts`: `reporterRecent` quanh L975–1180 lọc status + `b.first_report_at` trong khoảng ngày và áp LIMIT/OFFSET ở SQL; totals toàn phạm vi hiện tại, thiếu query SKU. `reporterBatchTickets` L1182–1218 trả `picker_employee_code`, `picker_display_name`, `reported_at` theo `batch_id`; bảng `report_tickets` có ticket ID riêng.
- `service/src/core.ts`: `report_batches.batch_id,sku,first_report_at`; `report_tickets.ticket_id,batch_id,picker_employee_code,reported_at,withdrawn_at`; index cho batch/SKU/date đã có.

## Thiết kế đề xuất (CHƯA PHÊ DUYỆT TRIỂN KHAI)
- Chỉ bỏ nút trong workspace, không xóa báo cáo độc lập.
- `CLOSED`: suy danh tính **từ ticket đã WITHDRAWN của cùng batch_id**, không từ SKU hoặc bản ghi HR hiện hành khác đợt. Trường hợp batch có nhiều người cùng thu hồi phải hiển thị đủ/tách dòng; không ép một actor giả. Đề xuất thêm dữ liệu hiển thị trong chính `reporterRecent` (set-based join vào page IDs), tránh N+1 request từ mỗi dòng đóng.
- `HAS_STOCK/SKIP_ALLOWED`: double-click chi tiết bằng endpoint batch tickets hiện hữu, theo `batch_id`; phân biệt từng lần SKU phát sinh lại, sắp xếp `reported_at ASC`, hiển thị mã/tên/giờ báo. Chỉ fetch lần đầu mở, cache theo batch; hủy cache khi data/version thay đổi, khi chuyển session và khi realtime làm thay đổi thành viên; chặn lỗi trả về cũ sau đổi tab/session.
- Tìm kiếm: kiểm soát đầu vào chuỗi số, min 3 ký tự, empty restores; debounce khoảng 300ms, bỏ phản hồi cũ, đặt `offset=0` mỗi lần đổi query/tab/date; server thêm `query`/SKU vào endpoint danh sách **trước** phân trang, trả đúng `total` của kết quả tìm; giữ nguyên badge/aggregate tổng phạm vi ngày, không bị biến thành số match tìm. Giữ giới hạn 50/trang và quy tắc ngày <=60 như hiện tại. Không fetch 300 rows về client để lọc. Cần benchmark LIKE chứa chuỗi so với tiền tố có index; chưa chốt kiểu khớp SKU, không triển khai giả định làm tăng DO Rows Read. Với Đang xử lý/Quá hạn phải xét query server/luồng realtime riêng nếu áp dụng ô chung cho cả năm tab.
- Layout responsive: tabs căn trái, khu vực tìm kiếm + date căn phải cùng hàng khi đủ độ rộng; màn hình hẹp bọc xuống hàng thay vì đè/chèn/cắt control. Chỉ tự áp dụng on `change` của ngày sau khi validate khoảng hợp lệ, từ<=đến, không ngày tương lai, tối đa 60 ngày. Không gọi API khi input date chưa hoàn chỉnh; tránh hai load cạnh tranh hoặc thêm polling.
- Cột `first_report_at` đã có cho mọi dòng batch; chỉ hiển thị cho hai tab Owner yêu cầu, trước cột resolved time. Giữ phân quyền sửa trạng thái.
- Không thay đổi `report_tickets/report_batches` schema, nghiệp vụ xác nhận, quyền, archive, APK/Agent, D172. Nếu chạm shared Worker/Core phải có impact review và independent regression D172 + D173, Owner phê duyệt triển khai trước.

## Rủi ro/tiêu chí kiểm thử sau khi được duyệt
1. Trong 300 dòng/50 dòng trang đầu, SKU ở vị trí >50 vẫn tìm được; count + trang đúng, tìm không đụng tab khác; 2 SKU trùng nhau qua 2 batch khác ngày không trộn picker.
2. CLOSED nhiều picker hiển thị đúng danh sách; mã/tên thiếu thì placeholder minh bạch, không bịa. Double-click chỉ tải khi cần, không phát sinh N+1 request.
3. Ngày tự đổi, giới hạn 60 ngày, ngày tương lai, từ>đến, nhập 1–2 số, dán chữ, xóa input, đổi tab giữa lúc request, realtime cập nhật, sửa kết quả và role guard đều đúng.
4. Thử viewport HD/HD+/zoom 100–150%, không tràn hàng/che nút, trạng thái mở rộng có accessibility bằng bàn phím nếu có thể.
5. Đo trước/sau số Worker/DO request, SQL rows read, latency p50/p95 cho tìm kiếm/đổi tab/mở chi tiết, giữ cadence realtime và counters trước khi báo PASS.

## Trạng thái
ANALYSIS_RECOVERABLE — chưa code, chưa CI, chưa release; Owner chưa duyệt phương án cụ thể/semantics tìm SKU. Không có FIELD/OWNER PASS.