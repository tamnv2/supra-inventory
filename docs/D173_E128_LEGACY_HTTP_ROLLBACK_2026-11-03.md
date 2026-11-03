# D173-E128 — Phục hồi đường request nghiệp vụ trước E110, giữ nghiệp vụ Production mới (03/11/2026)

## Lệnh Owner và thứ tự bắt buộc
Owner duyệt khôi phục **cách vận hành request cũ**, không khôi phục nguyên bộ phiên bản cũ. Trình tự: (1) thay đổi transport về HTTP đơn, (2) CI/hồi quy E123 trên base hiện tại, (3) sau khi ổn định mới làm E125, E126-01, E127 và E120/E121, (4) phát hành theo cổng kiểm soát và đo usage thực tế. Đây là D173, không là dự án mới. D172 OBPP độc lập PENDING/HOLD; Stable OWNER-GATED; không tạo resource mới, không migrate/recreate SQLite.

## Phân tích và phase 1
- Cloudflare 02/11: khoảng 52.138 DO Requests cả ngày; 03/11 00–19h: 59.652 so với 47.504 cùng khung 02/11. Không được quy toàn bộ biến động cho E123 hay E110 chỉ bằng tương quan.
- E110 dùng d173-v2 negotiated WebSocket business commands với HTTP hedge khoảng 50ms (Web, Android mutation), 250ms với Android GET. Client audit ghi TIMEOUT/RETRY liên tục, tạo khả năng phát sinh lời gọi DO song song.
- **Phase 1 chỉ khôi phục một đường HTTP cho lệnh nghiệp vụ.** Trong `service/src/core.ts` đặt `D173_E128_LEGACY_HTTP_OPERATIONS=true`. Core không cấp command capability trên realtime ticket mới; client Web/Android hiện hữu sẽ tự đi HTTP sau khi kết nối lại, có cùng durable request id. Các socket cũ được giữ tương thích đến lúc reconnect để không làm gián đoạn realtime hay WMS ACK; không nhận là cắt ngay 100% đường WS trong thời điểm rollout. Realtime WebSocket server push, auth, E123 picker cutoff, Agent HA/ACK, Firestore/Rules, SQL projection, E123 read-model, D172 routes không đổi.
- Giữ các phần tối ưu SQL/bundled snapshot không gây hai đường request; đánh giá riêng sau cùng-ca billing và fixture parity. Không được tuyên bố **toàn bộ** E110 P1–P4 đã đảo ngược chỉ vì Phase 1 đổi transport.
- Mục tiêu dưới 35.000 DO Requests/ngày với khối lượng tương đương là **ngưỡng FIELD/BILLING phải đo**, không là CODE PASS tự động.

## Gates
1. CI source: `node --test tests/d173-e128-legacy-http-rollback.test.mjs`, existing E086/E109 + E123 end-to-end/SQL read-model, D172 independent regression, Worker/Web/Android compatibility.
2. Chứng minh sau deploy: Production Worker exact SHA /health, realtime delivery, Reporter/Picker mutation idempotency, shift cutoff 14h/22h, Actor auth/session, Agent PRIMARY/ACK; quan sát live DO billed requests và p95.
3. Nếu có lỗi: dừng mở rộng, sửa cùng E128; rollback **lớp request** về base mã gần nhất (không rollback DB/Android/WMS).
4. Release chỉ qua branch→PR→exact CI→source-pinned protected marker/workflow; không dùng marker E123/E110 cũ để phát hành code khác. Không claim FIELD/OWNER PASS từ GitHub checks.
5. Sau Phase 1 CI và nghiệp vụ PASS mới xử lý E125 (lịch SKU include manual rows), E126 badge sequence, E127 Drive token/ACK, E120/E121 status trên source hợp nhất.

## Kết quả lúc tạo nguồn
Owner APPROVED. CODE source candidate trên nhánh `fix/d173-e128-legacy-http-rollback-20261103`. CI/RELEASE/FIELD/BILLING/OWNER PASS: **chưa xác minh**. PR/CI phải cập nhật bằng bằng chứng thật; không tự gắn PASS.
