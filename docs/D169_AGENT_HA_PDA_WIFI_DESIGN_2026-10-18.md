# D169 — VPS HA, Picklist ACK và Wi-Fi theo nghiệp vụ (18/10/2026)

**Trạng thái:** Owner yêu cầu kiểm tra, thiết kế và setup; tài liệu là impact review, **KHÔNG CÓ CHỈ THỊ triển khai Beta/Stable hoặc thay đổi binary trong checkpoint này**. Áp dụng vào D169 đang mở, PR606 Draft, không mở D170. Chỉ dùng tài nguyên đã nằm trong `ops/project-scope.json`; không có provider mới.

## Phạm vi chứng cứ
- Hai log mạng V3 Owner gửi 17/10 là thông tin mạng chính: NORMAL Firebase Auth/Firestore REST/RTDB REST và RTDB SSE first frame PASS; OFFICE Firestore authenticated REST qua Windows system proxy PASS; RTDB direct không khả dụng, proxy 403; Worker Office không khả dụng. Firestore gRPC Listen, Write/ACK liên máy và FCM thiết bị chưa test; không nói PASS.
- Log Agent 18/10 trước đó cho thấy RTDB HA heartbeat 401 ở VPS, NEXT_A SSE timeout, Firestore lease fallback, tải tài liệu legacy `picker_alerts` lặp.
- Source: `relay-agent/FirestoreAgentLeaderCoordinator.cs`, `RtdbHaLiveness.cs`, `D160ConfirmPipeline.cs`, `FirestoreConfirmationTransport.cs`, `SupraConfirmBrowser.cs`, `SupraConfirmBrowserD160.cs`, `D168NetworkRoute.cs`, `D168SkuNetworkUi.cs`, `D167SkuCoordinator.cs`, `D160Resilience.cs`, `android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt` và `PickerController.kt`.

## 1. HA VPS FIRST, giới hạn phát hiện 15 giây
- VPS là PRIMARY ưu tiên thường trực khi Agent/Auth/Firestore/WMS Confirm hợp lệ. Không xem WMS ready = true chỉ vì RTDB heartbeat; current `RtdbHaLiveness.WriteHeartbeat` hardcodes `wms_ready=true`.
- Một NEXT_A theo dõi tích cực qua phương tiện phổ dụng đã được xác nhận trên Office; các standby khác không quét lease độc lập. Office không gọi RTDB/SSE rồi fallback lặp. Duy trì Firestore authoritative roles + generation CAS + trước-WMS mutation fence, không cho hai PRIMARY chạy cùng mã Picklist.
- Phát hiện mất điều kiện giữ PRIMARY **mục tiêu ≤15 giây trong điều kiện đường giám sát còn hoạt động**, không tuyên bố hard guarantee dưới network partition; failover actual completion còn phụ thuộc WMS probe/CAS/inflight. Firestore REST authenticated Office PASS nhưng gRPC listener chưa được field proof. Chọn heartbeat/listener/poll sau thử nghiệm để đạt latency/quota, không mặc định 30s heartbeat vì cần failover 15s.
- VPS phục hồi ổn định thì xin quyền lại theo fenced handoff + draining, không cướp tác vụ đang mutation. Manual `admin`/`tamnv2` override chặn auto reclaim; hộp thoại hỏi mỗi 15 phút khi VPS healthy, YES CAS takeover, SKIP snooze 15 phút; không spam, lưu quyết định theo server và không thay người đang xử lý. Trường hợp manual holder mất kết nối cần owner review.
- Nếu VPS WMS hết phiên hoặc CAPTCHA yêu cầu thao tác người dùng, VPS không đủ WMS-ready; chuyển sang standby đã login; không tự động vượt WMS CAPTCHA.

## 2. PDA Picklist end-to-end
- Source hiện tại: PDA `TOTAL_WAIT_MS=20000`, thông báo standby ở 10s là text suy đoán, Agent chặn mutation nếu job age ≥12s, HA threshold 15s. Vì vậy phát hiện sau 15s không bảo đảm job cũ kịp xử lý; phải thiết kế lại **cùng request_id** và ngân sách chờ recovery có điều kiện, giữ duplicate prevention và final ACK canonical.
- Khi PRIMARY mất WMS, `D160ConfirmPipeline` hiện có thể gửi `WMS_SESSION_REQUIRED` terminal ngay mà chưa đợi takeover. Sửa phân loại recovered/unavailable so với failover, không đánh tráo ACK.
- Terminal `FirestoreConfirmationTransport.TryAck` ghi `lookup_status`, route, `cache_mode` nhưng không có reason_code chuẩn riêng; `RelayPocClient` chỉ parse lookup status, `PickerController.relayOutcomeText` là text chung. Đề xuất thêm mã nguyên nhân allowlisted và giai đoạn thực có evidence, PDA phân biệt: created, primary received, failover initiated/confirmed, exact WMS verified, terminal confirmed/already-confirmed/not-found/ambiguous/expired/uncertain.
- `SupraConfirmBrowser.cs` literal `Xác nhận lấy lại hàng` là text của **nút thao tác WMS**, không phải trạng thái đã xác nhận. Checkbox disabled cũng không chứng minh đã xác nhận. Chỉ trả CONFIRMED/ALREADY_CONFIRMED khi có guard confirmed hoặc chứng cứ WMS positive exact row/success; không suy từ nút, checkbox hay dòng biến mất. Nếu WMS final-click đã phát đi nhưng không chứng minh kết quả, giữ UNCERTAIN và khóa double mutation.
- Không gửi thêm write định kỳ trên mỗi PDA chỉ để cập nhật spinner; chỉ gửi event khi thực sự thay đổi trạng thái HA/job cần thiết. Kéo dài tổng chờ chỉ khi failover có chứng cứ và vẫn cần Owner duyệt SLA/UX.

## 3. Network awareness và auto Wi-Fi
- Source `D168NetworkRoute` hỗ trợ saved Windows WLAN profiles, Internet fallback allowlist tối đa sáu, `netsh wlan connect`, restore original; chưa có bảng phân loại Office/NORMAL chung theo SSID hay khả năng endpoint cho tất cả thao tác. Phân loại bằng saved SSID + network epoch, default UNKNOWN fail-closed; VPS Ethernet/virtual NIC cần cấu hình loại interface riêng, không tự gán qua SSID giả.
- SKU hiện chỉ tự đề nghị đổi khi Worker probe trả NETWORK_UNREACHABLE; còn yêu cầu PRIMARY, WMS ready, Confirm idle, approved profiles, pre-export WMS; `RequestD168NetworkSwitchPermission` có Yes/Skip/timeout 60s (auto Yes chỉ nếu UI callback thực sự chạy và safety gates PASS). Vì thế không được khẳng định luôn tự đổi mạng khi đúng giờ.
- Kích Picker trực tiếp gọi Worker `/api/agent/picker-session/revoke`; Office Worker không khả dụng trong V3. Khi ở Office: hiển thị box thông báo cần Internet, không gửi Firestore-only fake-kick. Với sự kiện do người dùng chủ động chọn YES để đổi mạng, bắt buộc guard HA/inflight; nếu PRIMARY đang phục vụ PDA thì hoãn hoặc chuyển PRIMARY an toàn trước. Kích hàng loạt cùng nguyên tắc, không mất server-authoritative revocation.
- Gọi về bàn/chat/presence/session/ACK: giữ đường Firebase/Firestore hiện hữu để dùng Office, không đổi Wi-Fi chỉ để thao tác. SKU Worker: thông báo tới hạn và 60s auto-approved switch nếu idle & WMS export trước, restore and revalidate; nếu đang PRIMARY và không có handoff an toàn thì defer rõ nguyên nhân.
- Nghiệp vụ WMS Confirm luôn giữ đường mạng/cookie phiên hiện hữu, không tự chuyển trong final mutation. Không truyền secrets qua repo, Wi-Fi logs hay telemetry.

## 4. Impact review trước khi code
- Components: Agent coordinator/HA, browser-state validation, Firestore ACK, WinForms network UI/network classifier, SKU coordinator, single/bulk revoke, Android RelayPocClient/PickerController; cần xem Firebase rules/ACK allowlist nếu thêm fields. Mọi cập nhật chỉ Beta scoped, Stable OWNER-GATED.
- Risks: split-brain/generation conflict, duplicate WMS confirm, mơ hồ terminal ACK, Office gRPC streaming chưa chứng minh, 15s HA detection vs 12s mutation fence, 20s PDA wait, Wi-Fi failover làm mất Firestore, revoked user giả thành công, ghi quá nhiều heartbeat/notification.
- Test acceptance: real NORMAL↔OFFICE network, cold start/offline/expired WMS, VPS power loss, WMS login-needed, manual override 15m snooze, standby transition, double PRIMARY race, queued/inflight Picklist ACK exactly-once, checkbox disabled vs confirmed row, same-ID uncertain replay, idle vs active SKU network switching/restore, kick Office warning / confirmed NORMAL revoke, quota by collection and p95 latency.
- Release gate: code-only branch + scoped PR and authority/continuity/CI PASS; automated tests before field; no release/Stable without explicit owner stage approval. Provider/billed usage needs matched-hour measurement after test.


## 5. Source-level Android outcome mapping gap
- `relay-agent/FirestoreConfirmationTransport.cs` accepts both `CONFIRMED` and `ALREADY_CONFIRMED` as terminal success. `android/.../PickerController.kt relayOutcomeText` and `submitRelayProbe` currently recognize **only `CONFIRMED`** as UI success/input reset; `ALREADY_CONFIRMED` incorrectly falls to generic error if emitted by Agent.
- Agent can output `WMS_DATA_UNAVAILABLE` for empty/hydrating WMS table and `LOOKUP_ERROR` for DOM search exception. Android generic fallback currently hides both reasons.
- D160 checkbox recovery can end as `CONFIRM_CONFLICT` rather than exact `CHECKBOX_NOT_READY`; preserve source-specific sanitized reason alongside stable `lookup_status`, not freeform provider text.
- UI-only Android mapping may be a safe small candidate but requires versioned Android Beta testing, independent Owner release authorization, compatible Agent ACK field shapes and guards before shipping.
- Performance option for Owner impact approval: retain present 20s normal wait, extend bounded failover-only wait to ~35s when confirmed real server-side ownership transition, with source request TTL, WMS mutation-age fence and ACK commit aligned. **35s is a candidate, not agreed SLA or code.**

## 6. Quota and durability constraints
- For illustration, one active PRIMARY Firestore lease every 10 seconds over 17 business hours is 6,120 document writes if every lease is billed. A NEXT_A read every 5 seconds adds ~12,240 document reads over 17h, **before** actual PDA, Agent and other services. RTDB+Firestore double heartbeat is not a free saving if Office cannot see RTDB.
- Do not claim 15s detection as worst-case guarantee during Office-Firestore partition. Need real-time listener/cross-network field tests or demonstrate safe bounded REST read cadence and CAS contention handling. Do not sacrifice WMS exactly-once for lower usage.
