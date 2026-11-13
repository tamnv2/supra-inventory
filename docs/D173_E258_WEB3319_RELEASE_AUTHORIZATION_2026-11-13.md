# D173-E258 — Owner yêu cầu hoàn thiện E257 và phát hành Web 3.3.19 (13/11/2026)

## Owner command và phạm vi
- Owner: **“xử lí hoàn thiện code và phát hành”** sau khi nhận báo cáo FIELD FAIL Web3.3.18 và PR972 E257.
- Quyền hạn: hoàn thiện đúng giao diện/nghiệp vụ Tổng quan một trang E257, chạy kiểm thử và **phát hành Production Web 3.3.19 + phần Worker read-only phục vụ Tổng quan** khi đủ CI/release gate. Không suy diễn FIELD/OWNER PASS từ hành động phát hành.
- Chỉ sử dụng Worker `supra-inventory-beta` hiện tại trên tên miền chính thức `inventory.supra.cc.cd`, cùng `InventoryCore` đã đăng ký. Không tạo provider/schema hoặc cập nhật D172/Agent/Android/Firebase/Stable/Gateway.

## Sửa hiện hành
- Web: báo trực tiếp SKU và đợt còn chờ lâu nhất (tối đa 6 trên tổng số mở), thời gian chờ, khu vực *tại thời điểm báo đầu*, ticket Picker mở; vấn đề SLA/Skip tự động/tái phát; xu hướng VN 7 ngày và 24 giờ hôm nay; LTA/Shelving và SKU cần đối chiếu. Bỏ khối 5 kết quả mới nhất; tab Báo cáo chi tiết không bị sửa.
- Chỉ một `GET /api/admin/overview`, bên trong DO bổ sung 3 truy vấn SQL read-only có giới hạn phạm vi và trả dữ liệu tổng hợp; không API/cron/DO request theo từng giờ. Đồng hồ chờ cập nhật client 15 giây **không gửi request**.
- Khắc phục dữ liệu cũ: trên Tổng quan đang mở nhận sự kiện WebSocket báo hàng rồi gộp refresh, tối đa 1 truy vấn overview / 15 giây khi có sự kiện và trang đang hiển thị; không polling cố định. SLA chưa cấu hình hiển thị “—”; không quy kết nguyên nhân vật lý khi chưa có chứng cứ.
- Phiên bản Web: `3.3.19`. Thay các test guard phiên bản chính xác của Web, giữ kiểm thử bảo vệ role/auth/D172 và logging cũ.

## Release gate (bắt buộc)
- Base main đã xác minh `cfe3a7674b85b410f60297c77920408a971413fb`; source PR [#972](https://github.com/tamnv2/supra-inventory/pull/972).
- Ghi lại source code SHA và SHA chính xác CI đã chạy; xác minh Web build, Worker TS, E257 dashboard, D167 UI, D172 isolated regression, authority và continuity trên head đúng. Guard `tools/d173_e258_web3319_release_gate.py` từ chối drift/cross-project/source code sau pin, yêu cầu protected two-parent merge và release marker `D173-E258_WEB3319_PRODUCTION_RELEASE:`.
- Chỉ khi mã nguồn đã PASS CI mới chuyển PR từ draft, merge bằng protected GitHub; cùng merge SHA main phải thực thi `Deploy Beta Worker`, bảo toàn Gateway/D172 và 10-slot log, xác minh `/health` HTTP 200 status ok, đúng `source_commit`, SQLite 17/17, operational 7/7, FCM/Root config bindings, Web shell/OAuth/PDA registry.
- Không chấp nhận sự cố CI thực chất bị che bởi báo cáo PASS. Test cũ phụ thuộc version/legacy Agent không thuộc E258 chỉ phân loại sau khi đọc log và đối chiếu baseline main.
- Ghi nhận chi phí: 3 SQL SELECT (7 ngày) có thể tăng DO Rows Read; chưa có số đo billing/provider hoặc p95 thực địa. Không tuyên bố giảm usage; theo dõi và rollback nếu tăng vượt mức chấp nhận.

## PASS độc lập
CODE, scoped CI, protected merge, exact-source Production release, FIELD trình duyệt HD/HD+/dark/light, OWNER PASS tách biệt. D172 luôn PENDING/HOLD độc lập; Stable OWNER-GATED.
