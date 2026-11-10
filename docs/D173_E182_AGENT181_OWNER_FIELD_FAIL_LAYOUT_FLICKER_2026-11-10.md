# D173-E182 — Agent181 Owner FIELD FAIL: layout và nhấp nháy (10/11/2026)

## Bằng chứng từ Owner
- Agent181 đã signed OTA technical RELEASE PASS nhưng Owner xác nhận **FIELD FAIL**: layout chưa theo sơ đồ, Hệ thống Agent nhấp nháy theo chu kỳ cập nhật Tài nguyên Desktop.
- Bố cục bắt buộc theo hình Owner: chiều dọc **40% trên / 60% Danh sách phiên**; phần trên theo chiều ngang **34% Hệ thống Agent / 33% Web+PickList / 33% Tài nguyên Desktop**; cột giữa chia **50% Đăng nhập Supra / 50% Xử lý PickList**.
- Kích thước phải dựa trên vùng hiển thị thực, không cố định pixel/%, không bỏ tính năng hoặc dữ liệu gốc. Không cuộn ngang/dọc phần trên; phần Danh sách phiên chỉ cuộn dọc.
- Các nút lọc/tác vụ phiên co giãn đều trong cùng một hàng, xuống hai hàng cân đối khi hẹp. Nút Web chỉ ghi **Website (xx/yy)** với xx = Web có bằng chứng online; yy = online + offline đã có bằng chứng. Không nhập nhằng bản ghi chưa xác minh thành offline.
- Không đổi nghiệp vụ xác nhận PickList, WebView2/Host13, HA, RBAC, WMS, Cloudflare/Firebase request cadence, Worker/Web/APK/D172/Stable.

## Đối chiếu source Agent181
- `relay-agent/D173E179OverviewNoScroll.cs` vẫn set cột 37/37/26; `D173E182FitMiddleStack` có thể đẩy Web/PickList khỏi 50/50 khi thay trạng thái; cả Agent và Web resource `TextChanged` kích hoạt relayout.
- `relay-agent/D119AgentFeatures.cs#RefreshD130ResourceClock` gọi `Label.Refresh()` đồng bộ theo clock; `LayoutD173RosterToolbar` cấp phần rộng dư chỉ cho Web và tác vụ cuối; Web filter hiển thị dài “Web · Online / Offline”.
- `relay-agent/Program.cs#ApplyAfterHoursAgentLayout` tái ấn định vị trí lưới Agent theo offset 163px trong tick schedule, cạnh tranh với measured layout.
- Video cho thấy có thay đổi cả nhãn PRIMARY/DEEP_HIBERNATE và nội dung banner ngoài giờ. Video **chưa đủ phân biệt** đây là chuyển vai trò HA thực tế hay chỉ UI; không được che chuyển trạng thái nghiệp vụ hợp lệ để tạo cảm giác ổn định.

## Sửa CODE trên branch riêng
- Dùng cấu trúc **40/60 + 34/33/33 + 50/50**, loại bỏ Web/PickList row-height thay đổi theo status.
- Bỏ forced `Refresh()` tài nguyên và bỏ relayout toàn Agent/Web khi riêng CPU/RAM/clock cập nhật. Dự phòng chiều cao nhãn metric để không co giật theo giây.
- Dùng một measured Agent-header/fleet authority cho cả overtime; schedule tick không đè lưới Agent bằng toạ độ legacy.
- Tab và nút tác vụ Danh sách phiên chia đều, tương ứng một/two-row theo bề rộng và hiển thị Website online/known total; nguồn chưa xác minh trả `Website (—/—)`, không suy diễn 0.
- Khi vùng trên dưới **900px rộng hoặc 240px cao**, ba cột cùng toàn bộ nhãn/tác vụ ở DPI 100-150% không thể hiện hữu đồng thời nếu cấm mọi scrollbar và cấm cắt chữ. Native tab fallback giữ quyền truy cập toàn bộ điều khiển; trường hợp này là giới hạn vật lý cần Owner nghiệm thu, không được hứa không cắt chữ ở mọi kích thước tuỳ ý.
- Nguồn chuẩn giữ dữ liệu đầy đủ, khả năng xem chi tiết và tooltip trong lưới phiên; một số ô không thể hiện hết ký tự ngay trên hàng khi tổng độ dài vượt quá chiều ngang.

## Gate
- **CODE:** thay đổi trên branch `fix/d173-e182-agent181-field-40-60-flicker-20261110`; source regression guard mới, chưa xác nhận CI/Windows native.
- **CI:** pending protected PR exact head, WinForms net48/x64 build, tests layout/roster/overtime/rbac, D172 isolation và zero new requests.
- **RELEASE:** bản hiện hành Agent181 vẫn là bản đã phát hành; **chưa được phép ghi đè v181**. Bản sửa này chưa ký EXE, chưa đổi OTA, chưa thay VERSION.
- **FIELD:** Agent181 FAIL theo Owner; candidate chưa có ảnh Windows 1280×720 / 1600×900 / 1920×1080, DPI 100/125/150, dark/light, overtime/active role test.
- **OWNER PASS:** false. Không suy đoán PASS từ test tĩnh.
- D172 độc lập PENDING/HOLD; Stable OWNER-GATED.
