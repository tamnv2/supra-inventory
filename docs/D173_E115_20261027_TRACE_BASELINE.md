# D173-E115 — Hồ sơ tải quan sát ngày 27/10/2026

Đã đọc 49 Android support bundles và danh sách Agent session/checkpoint trong thư mục Drive 2026-10-27, **loại D172/OBPP**. Mẫu Android có 32 PDA khác nhau. Không lưu UID, tên nhân sự, mã đơn hoặc thông tin đăng nhập vào repo.

## Android sample (không phải hóa đơn Cloudflare)

| Loại | Số HTTP attempts từ nhóm log đã khử trùng |
| --- | ---: |
| Tổng quan sát | 10.403 |
| REALTIME_DELTA GET | 5.038 |
| REALTIME_TICKET POST | 1.110 |
| PICKER_REPORTS GET + POST | 659 |
| PICKER_RESULTS GET + POST | 643 |
| AUTH GET + POST | 1.046 |
| NETWORK_ERROR | 261 |
| AUTH_401 | 223 |
| HTTP_409 | 25 |

Đỉnh quan sát theo giờ VN: 17:00–17:59 là 2.057, 16:00–16:59 là 1.813, 13:00–13:59 là 1.287 HTTP attempts. Nhóm dữ liệu là bounded RAM per-attempt journal, không đầy đủ toàn bộ ngày hay toàn bộ PDA. Mỗi tổ hợp device/hour/route/method/status lấy MAX giữa các snapshot để chống tính trùng khi xuất lặp; có thể thiếu khi reboot. Log Agent có quota_day lệch so với timestamp (một số vẫn quota_day 20261026); D166 AGENT_ESTIMATE_NOT_BILLING không phải Firebase invoice.

## Cách dùng làm kiểm thử có cơ sở

1. Dùng phân bố theo giờ và loại route trong profile-anonymized.json làm **hình dạng workload**, không đưa dữ liệu nhân sự/PL thật vào test.
2. Chạy cùng số request, cùng tác vụ, cùng DB fixture và các pha tải giờ đỉnh cho HTTP và M2, thêm các nấc 25 / 40 / 60 PDA ảo.
3. M2 cần push thay REALTIME_DELTA theo đúng semantics; nếu chỉ đổi HTTP polling thành WS polling thì không được tính tiết kiệm SQL Rows Read.
4. Bên cạnh lỗi/latency/p95/p99, đọc Cloudflare usage dated 27/10 và đo namespace test riêng theo billable DO Compute Requests/Rows Read/Duration (raw invocations không phải billed requests).
5. Nghiêm cấm dùng account/SKU/PL thật hoặc chạm Production, không gộp D172. Test source local là bằng chứng tương thích một phần, không thay thế client Web/APK/Agent thực.

**Tình trạng:** PROFILE OBSERVED; full-day official Cloudflare billable usage và workload replay ngang giá cần gate riêng. Production M2 NO-GO cho đến khi đạt đầy đủ.
