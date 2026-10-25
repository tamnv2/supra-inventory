# D173-E038 — Agent v143 UI FIELD FAIL → Owner chọn Mẫu 2, Agent v144 (25/10/2026)

## Lệnh Owner và phạm vi
- Owner xác nhận mẫu **2 (Fleet-first sidebar)**, duyệt CODE và lệnh triển khai cập nhật Agent Windows sau kiểm thử.
- D173 tiếp tục sửa bản E037 chưa nghiệm thu. Agent143 TECHNICAL RELEASE PASS không phải UI FIELD/OWNER PASS.
- **Scope ONLY** `relay-agent/` Windows UI, binding hiển thị phiên Agent/Web/Android (chỉ dùng nguồn Inventory hiện hữu), chart sampling OS local. Không sửa Worker/Firebase/Android/WMS/OBPP API hay tài nguyên dùng chung.
- D172 vĩnh viễn PENDING/HOLD đến khi Owner ra lệnh đóng riêng, old Stable OWNER-GATED. Không triển khai Beta→Stable, không đổi signing/OTA package/channel, chỉ tăng version v143→v144 kênh Agent có sẵn.

## 8 lỗi được duyệt
1. Sáng/tối: làm lại palette chữ/nền/nút/bảng, sửa dark rows, readonly cells, chống chữ tối trên nền tối và chữ sáng trên nền sáng.
2. PickList chuyển trái, Agent+Đăng nhập Supra ở giữa, tài nguyên OS ở phải; ở viewport hẹp đưa biểu đồ xuống hàng riêng, bảng phiên được ưu tiên 57% chiều cao.
3. Danh sách phiên hoạt động: phân tách Picker PDA, phiên Inventory Web/Android (đã xác thực), Agent fleet; Office/Worker không xác minh được thì ghi rõ **không khả dụng** (không biến thành 0 online, không copy user Firebase chung); Reporter/Agent readonly, chỉ Picker hợp lệ có nút hành động.
4. Một nút `Ẩn/hiện tab trình duyệt` trong panel Đăng nhập Supra, thay `Ẩn/hiện web` cũ; không phá vòng đời WebView2.
5. Chuyển thanh hành động Agent thành hai hàng, giữ `Tự căn cột` và `Chuyển Agent chính` có quyền; không chồng nút.
6. Agent mở và phục hồi từ tray ở trạng thái maximized `Screen.WorkingArea`; giữ tray và exit có bảo vệ phiên, không tự dừng PRIMARY.
7. Biểu đồ GDI+ 60 mẫu CPU/GPU/RAM/Disk/Network có lưới, nền mờ, điểm cuối, sáng/tối; chọn local sampling 1/2/5/10 giây. Không đổi network/Provider/Office polling.
8. Thiết kế sidebar native WinForms, menu động theo đúng TabPages có quyền; giữ các trang cũ như Cài đặt, Cập nhật SKU, Web Confirm, Hiệu năng, Lịch sử/Chẩn đoán/Log và event handler hiện hữu.

## Impact và kiểm thử
- Base: E037 Web3.3.0/Agent143/Android120 published TECH PASS; Agent visual Owner FIELD FAIL (25/10).
- Touch code: `relay-agent/Program.cs`, `D173E038Sidebar.cs`, `D119AgentFeatures.cs`, `D173DesktopResources.cs`, `D173E036Theme.cs`, `D173PerformanceDetails.cs` + version 144.
- Risks: high-DPI / 1000,1366,1600,1920-width; WinForms TabControl owner style, startup smoke, Agent role rights, AUTH/PRIMARY handoff actions, history tabs, WebView2 tab display, tray/exit.
- Required gates: WinForms net48 x64 compiler CI + branch authority continuity + native startup smoke + runtime UI screenshots bright/dark at 100/125/150/200 DPI, WMS PickList manual search/confirmation and PRIMARY/standby regression. CI build alone cannot confer FIELD PASS.
- For release, new **exact source SHA/CI PASS** and Owner E038 Agent-only scoped receipt, gated protected merge→GitHub signed Agent v144+SHA256→existing OTA channel verified. E036 previous source pin must NOT be reused or extended.
- If build/tests fail, retain Agent143 as latest Production; don't publish untested exe, don't mark DONE.

## Trạng thái
OWNER_REQUIREMENTS_AND_DESIGN_APPROVED; SOURCE_CANDIDATE_AGENT144; **CI/RELEASE/FIELD/OWNER PASS NOT VERIFIED** pending checks. Đây là hồ sơ scope, không tự nhận phát hành.
