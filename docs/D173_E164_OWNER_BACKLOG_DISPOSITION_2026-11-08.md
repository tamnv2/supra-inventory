# D173-E164 — Owner chốt backlog và đối chiếu E109/E110/E128 (08/11/2026 VN)

**Loại:** OWNER DECISION / FIELD ATTESTATION / DOCS ONLY. Không sửa source, không merge/deploy, không thay đổi Provider, Database, Signed OTA, D172 hoặc Stable. D173 **chưa** được Owner PASS toàn bộ.

## 1. Làm rõ gói tối ưu DO P1–P4

- **E109 (01/11):** P1–P4 CODE READY, source CI 40 SUCCESS, 0 FAIL ở `6f1692bbb349dca3dad982368d8631727a7ed523`. Không phát hành tại thời điểm đó.
- **E110 (01/11):** Owner sau đó duyệt phát hành cùng PR #815, merge main `3135efaa98e0749247fd504995b095f1e6d467d2`. Worker/Web production workflow `41325295079` SUCCESS; signed Android vc122 workflow `41325295010` SUCCESS, OTA manifest cập nhật. Agent không thay đổi. **Do đó không được ghi P1–P4 là một gói CODE_READY chưa deploy.**
- **P1:** xác thực + đọc DO trong một lần gọi và tùy chọn read model trong mutation response, với version/session guard.
- **P2:** tái sử dụng cùng projection, queue/recent/overdue, delta coverage và tránh full refresh thừa mà giữ SQL/parity.
- **P3:** từng phát hành command WebSocket `d173-v2`, sau đó **E128 (03/11)** Owner duyệt phục hồi **HTTP đơn** cho nghiệp vụ vì HTTP/WS hedge và retry có thể tăng DO Requests. Source hiện có `D173_E128_LEGACY_HTTP_OPERATIONS=true`; E128 Worker production TECH PASS tại run `41672033285`. Realtime WebSocket push vẫn giữ; **không** coi command WS là tối ưu đang hoạt động hay tự bật lại.
- **P4:** gom nhánh notification/FCM, maintenance và routine health; phần SQL/bundled snapshot không gây hai đường request được giữ theo phạm vi E128; không có chỉ số tiết kiệm Production được nghiệm thu cho cả gói.
- **Phân biệt:** E110 đã triển khai kỹ thuật; E128 chỉ rollback tầng command transport về HTTP, không rollback toàn bộ E110/DB/UI. Chưa có same-load billing + latency/quota evidence đủ để đánh giá tiết kiệm DO Requests/Rows Read; công việc đo/phân tích vẫn OPEN trong P0.

Nguồn: `docs/D173_E109_DO_OPTIMIZATION_CODE_ONLY_2026-11-01.md`, `docs/D173_E110_PR815_PRODUCTION_TECHNICAL_RELEASE_RECEIPT_2026-11-01.md`, `docs/D173_E128_LEGACY_HTTP_ROLLBACK_2026-11-03.md`, `ops/project-state.json#d173_e110/#d173_e128`.

## 2. Danh sách Owner chốt 08/11 (không suy rộng phạm vi)

| Mục | Owner disposition | Ý nghĩa |
|---|---|---|
| Agent decision sync E117: overtime/shift/VPS PRIMARY/defer 15m | **OWNER PASS** | Ghi nhận đạt về nghiệp vụ trong phạm vi Owner xác nhận, không còn backlog cùng nội dung. Không suy diễn thêm provider quota/FIELD lab coverage. |
| Web Online/Offline E121 | **PENDING IMPLEMENTATION** | Tiếp tục chờ; không tự đánh dấu PASS dù E123 có source liên quan Web Presence. |
| Tách PDA Picker/Reporter E120 | **CANCELLED AS WRONG INTERPRETATION** | Owner chỉ yêu cầu phân loại Picker/Reporter trong **Agent**; mã E123 đã triển khai lọc riêng trong Agent; không phát triển hai APK/package. Không xóa lọc Agent đang chạy. |
| Cửa sổ phụ Agent trên taskbar E119 | **CANCELLED** | Ngừng theo dõi/sửa theo PR #851 Draft; đóng không merge, không rollback bản đã phát hành. |
| Android vc125 Reporter badge/count/overdue E126 | **OWNER PASS** | Ghi nhận Owner nghiệm thu, không lặp FIELD gate cũ. |
| Agent ↔ PDA confirm, ACK, HA, chống xác nhận trùng | **OWNER PASS** | Ghi nhận đạt theo Owner; không đồng nghĩa cấp phép phát lại mutation WMS khi UNKNOWN. |
| Agent173 WebView2/tray/CDP/WMS confirm/5 Agent E161 | **OWNER PASS** | Đã có CI & signed OTA technical release; Owner xác nhận thực tế đạt, đóng backlog FIELD của phạm vi này. |
| Log Agent/Web/Android 13:15, 21:15 và lệnh Agent thu log toàn hệ thống E163 | **PENDING ANALYSIS** | Chưa kết luận nguyên nhân/không code mới. |
| P0 Cloudflare DO Rows Read/Requests/SQL attribution | **PENDING ANALYSIS** | Chưa có query-ID/route-ID cost proof, không gán toàn bộ Cloudflare account cho Inventory. |
| P0 Firebase Firestore listener PermissionDenied và RTDB HA timeout | **PENDING ANALYSIS** | Chưa chứng minh Rules/claims/query root cause, chưa đổi Firebase Provider. |

## 3. Quy tắc tiếp tục

- Các mục OWNER PASS hoặc CANCELLED không xuất hiện lại trong backlog đang mở nếu không có yêu cầu/lỗi mới từ Owner.
- **Không đóng toàn bộ D173**; không coi Owner attestation là số liệu billing, benchmark p95 hoặc bằng chứng từng thiết bị ngoài phạm vi được Owner xác nhận.
- Không triển khai lại gói P1–P4 đã phát hành; P3 HTTP theo E128 giữ nguyên đến khi có lệnh mới.
- D172 OBPP1291 độc lập **PENDING/HOLD**; Stable **OWNER-GATED**.
