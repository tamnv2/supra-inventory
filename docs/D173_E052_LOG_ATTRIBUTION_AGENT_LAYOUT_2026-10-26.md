# D173-E052 — Toàn mô hình log attribution và Agent UI (Owner 26/10/2026)

## Owner authorization / scope
Owner duyệt bổ sung log hiện hữu trên Web, Android, Agent và Worker; sửa UI Agent (toolbar/status/overtime không chồng lấn), nhấp nháy tài nguyên, chia Supra/PickList 50/50; yêu cầu phát hành theo channel một Production. D172 vẫn độc lập PENDING/HOLD; Stable Worker OWNER-GATED.

## Bằng chứng / phân tích
- Ảnh Agent field: bảng tăng ca chồng nút `Tự căn cột` / `Chuyển Agent chính`; thanh `ApplyD173E038AgentToolbar` dùng row 91 và 125, `ApplyAfterHoursAgentLayout` trước đây bắt đầu tại top 142.
- Desktop sparkline vốn DoubleBuffered nhưng invalidate toàn biểu đồ 1/2/5/10 giây và mạng AutoScale theo đỉnh lịch sử, có thể tạo hiệu ứng nhấp nháy. Theme clock còn cưỡng ép repaint toàn biểu mẫu mỗi phút.
- Android `D166UsageAudit.recordApi` gom mọi `/api/reporter/*` thành `REPORTER`, Web `D171` gom mọi API dưới `authorized_request`, không xác định nguồn GET.
- Worker/DO `D173-E049/E050` có telemetry bền vững ở InventoryCore SQLite đã release kỹ thuật; persistence hiện làm tăng **1 SQL UPSERT cho mỗi request/query được đo**, không miễn phí và không được tính là provider billing. Phần E052 **không thêm instrumentation server** hoặc tăng tần suất này.

## Changes staged for source CI
1. Agent 147 candidate: hai ô Supra/PickList phân bổ 50/50 ở mọi bố cục; đưa panel tăng ca xuống dưới cả hai hàng toolbar; giữ vị trí khi auth refresh; status một dòng với dấu rút gọn khi quá dài. Agent Card có double buffer; Sparkline vẽ opaque một lần/frame với nền chủ động, mạng auto-scale giảm chậm; theme timer chỉ repaint khi AUTO thực sự chuyển sáng/tối.
2. Android vc121 candidate: chia sẵn số lần HTTP theo Reporter queue/overdue/counters/recent/batch/resolve/correct/meal và realtime ticket/delta; không đổi HTTP transport, retry, token, Worker/API/FCM/ACK.
3. Web 3.3.2 candidate: bảng đếm RAM theo method + API family có allowlist; không lưu URL query/ID; không thay đổi API wrapper, websocket, lịch gửi hoặc provider.
4. Worker/DO: giữ E049 hiện tại, không thay đổi shared Core/Worker/SQLite/Auth hoặc D172, không thêm persistent log. Những dữ liệu Worker billable chỉ đối chiếu khi có Cloudflare provider metrics.

## Usage, privacy, performance contracts
- E052 không thêm network call, timer, listener, Firestore/RTDB/DO read/write hoặc log upload. Dòng Web/Android được tổng hợp ở event/callback đã có, Agent chỉ repaint local. Agent UI sampling selector giữ nguyên interval.
- Không ghi mật khẩu/token/phiên/SKU, không tăng kích thước gói thường kỳ theo tỷ lệ số request. Local counters bounded và báo rõ overflow/coverage; SDK callbacks không phải Firestore billing.
- Chính sách riêng của E049 tồn tại từ trước: DO SQL write per sample thực sự tăng billed Rows Written; chỉ được coi là không tăng usage **do E052**. Nếu Owner muốn giảm/loại bỏ chi phí E049 phải là patch riêng có bằng chứng before/after và D172 regression.
- So sánh usage 3 ngày làm việc cùng cửa sổ (VN vs provider billing day), version và workload. Không kết luận giảm usage trước khi có số liệu.

## Gates / source vs release
- Source CI: Windows Agent build + startup, Android Gradle, Web TypeScript/build, D173 E052 static guard, source authority/security, D172 route/auth/isolation, HA/ACK/FCM/OTP no-regression.
- Test layout: unauthenticated/authenticated, overtime ON/OFF, PRIMARY/NEXT_A, 1000/1366/1600/1920 widths, 100/125/150/200% DPI, Light/Dark/Auto; verify toolbar/text no overlap; desktop sparkline 1/2/5/10s and minimize/tray.
- Source CI is NOT release or FIELD PASS. Signed Agent147/Android121/Web332 require separate **exact-source release receipt + protected main merge + tagged OTA checksum + live official host proof**. No unauthorized direct release to historical Stable Worker.
- Owner physical FIELD PASS and 3-day matched usage remain pending until observed. If technical workflow blocked, leave PR/code candidate; do not mislabel deployed.

## E052 final source CI receipt (26/10/2026)

- PR #750 final protected source pin `60ad796949438abd8c5c6506f32805e65844cc2b`: 32/32 CI PASS, including Windows Agent build/startup, Android APK build, Web/service, D172 business isolation and compiled E052 production release gate.
- Existing registered Production distribution requires protected merge title `D173-E052_UI_LOG_RELEASE:`; no signed OTA or FIELD PASS is inferred from CI.
- Receipt: `ops/d173-e052-release-authorization.json` (only this source SHA; zero release authority for D172/old Stable).
