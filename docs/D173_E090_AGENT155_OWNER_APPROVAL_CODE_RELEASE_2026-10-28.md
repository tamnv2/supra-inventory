# D173-E090 — Agent155: Owner chốt 8 cải tiến UI / resources / log (28/10/2026)

## Lệnh Owner
Owner duyệt toàn bộ 8 đề xuất sau Agent154 và ra lệnh CODE + CI + signed OTA Agent155 cho tới khi kỹ thuật phát hành PASS. Không có lệnh đóng D172 hoặc bật Stable. Tất cả release phải qua branch -> PR -> exact-head CI -> nguồn đã pin -> protected merge -> signed agent channel; FIELD và OWNER PASS không tự suy ra.

## Tám yêu cầu, kết quả mục tiêu
1. Icon vector nội bộ cho Cloudflare/Firebase/Google, thẻ Usage và CPU/RAM/Disk/Network/GPU; không tải ảnh/font qua mạng.
2. Usage metric status thiếu nguồn => thẻ mờ; có actual nhưng thiếu quota vẫn nổi bật actual; không tạo số/quota/forecast tưởng tượng. Giữ Cloudflare shared và Firebase Pacific-day scope minh bạch.
3. Menu yêu cầu log toàn hệ thống phải truy cập được với các phiên Agent thực có đăng nhập ADMIN/PICKPACK_ADMIN và exact admin/tamnv2/vps; khi đang có lệnh vẫn bấm được để xem trạng thái single-flight; không bypass Worker RBAC. Worker endpoint hiện có; HTTP200 chỉ accepted/broadcast, không chứng minh tất cả client/upload Service đã hoàn thành.
4. Đổi nhãn tiếng Việt: Tổng quan vận hành, Đồng bộ danh mục SKU, Trình duyệt xác nhận PickList, Lịch sử xác nhận PickList, Giám sát mức sử dụng dịch vụ; rộng sidebar 225px và vector icon.
5. ComboBox sample tài nguyên Desktop ổn định, default 1 giây; các lựa chọn 1/2/5/10 giây; không reset khi tick; không tạo provider timer/call.
6. Tài nguyên Desktop kiểu Task Manager, một bảng duy nhất ở Tổng quan; bỏ khởi tạo tab Hiệu năng, không xóa nguồn SystemMonitor đã dùng nghiệp vụ cục bộ.
7. Bổ sung Kênh, Đăng nhập lúc, Ghi nhận gần nhất, Liên hệ/WMS trong bảng phiên, chỉ từ Picker/Reporter/Agent memory snapshots đã nhận; unknown => '—'; không thêm Firestore reads/heartbeat. Giữ exact identity/action cell permission và keyed row updates, không cho Reporter đá Picker.
8. Tổng quan chia 50% chiều cao bên trên Agent/Supra/PickList/Desktop, 50% bên dưới danh sách phiên; ba cột 35/39/26 trong phần trên. Khi chiều ngang nhỏ, chỉ vùng trên cuộn ngang, không đè nút WMS/PRIMARY, danh sách phiên có vùng riêng.

## Source change boundary
- Agent WinForms .NET Framework 4.8: `relay-agent/{Program,D119AgentFeatures,D173DesktopResources,D173E038Sidebar,D173E036Theme,D161SupportLogControl,D173E089UsageCards,D173VpsUsage,D160UiHistory,AgentConfig}.cs`, VERSION, csproj.
- Exact Owner source/CI gate: `tools/d173_e090_agent155_source_test.py`, `tools/d173_e090_release_gate.py`, existing D167 router and existing Agent signed workflow.
- No changes to `service/`, `web/`, `android/`, `firebase/`, `obpp1291/`, gateway, WMS, auth, DO, runtime quotas or historical Stable.
- Current Agent154 signed OTA is rollback baseline; D172 independent PENDING/HOLD.

## Acceptance
- CODE: Agent155 version lock, native Windows x64 compile and startup smoke, complete source guard; PR authority+continuity PASS.
- CI: source HEAD exact pin with Windows build/startup, WMS/HA/office regression and previous D161/DO/Android isolation; no secrets.
- RELEASE: protected main exact `D173-E090_AGENT155_RELEASE:` marker and verified signed `relay-agent-v155` EXE hash equal channel `inventory-channel`; no Worker deploy or Firebase Rules modification.
- FIELD: installed real VPS/Windows 100/125/150% DPI, menu vps operational request and recipient receipts, activity list state/contacts, local 1s CPU, WMS/PRIMARY/Office flow. Remains PENDING until verified.
- OWNER PASS: explicit separate Owner acceptance only.

Current checkpoint: Owner approved + code candidate, release not yet claimed.
