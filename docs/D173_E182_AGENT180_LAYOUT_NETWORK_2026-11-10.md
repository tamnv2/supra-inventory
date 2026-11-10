# D173-E182 — Agent180: FIELD Agent179 layout + 4 loại khả dụng mạng (10/11/2026)

## Owner approval
- Sửa spacing trống sai ở Hệ thống Agent, Web/PickList và Tài nguyên Desktop; giữ Tổng quan **40% trên / 60% Danh sách phiên**. Không cuộn toàn trang/phần trên; chỉ bảng phiên cuộn dọc.
- Các nút lọc và tác vụ phiên cùng một hàng đúng Agent177 khi đủ chiều ngang; chỉ tự xuống 2 hàng ở màn hẹp. Không thay đổi callback, quyền, business state.
- Hai ô trạng thái Agent và Web được đo chiều cao theo nội dung; text xuống dòng, không dùng AutoEllipsis; thay đổi bố cục trên để dành chỗ cho text.
- Phân loại mạng **Bình thường** (Firebase+Cloudflare READY); **Chỉ truy cập được Firebase** (Fire READY/Cloudflare NETWORK_UNREACHABLE); **Chỉ truy cập được Cloudflare** (Fire UNREACHABLE/Cloudflare READY); **Không truy cập được** (cả hai UNREACHABLE). Nếu lỗi quyền, 429, 5xx, timeout không đủ bằng chứng hai chiều: Chưa xác định.
- Chỉ làm mờ chức năng có phụ thuộc đã *xác minh* không khả dụng. Giữ lại logic giới hạn SKU/update Cloudflare sẵn có, làm rõ nguyên nhân bằng tooltip; WMS là capability riêng, không suy diễn từ 4 nhãn mạng.
- **Tuyệt đối không đổi** nhận/xác nhận PickList, UI confirm handler, dữ liệu, API, realtime/HA, quyền RBAC, Worker/Web/APK/Firestore, shared Host13 và D172.

## Existing source behavior / changes
- `relay-agent/D173E179OverviewNoScroll.cs`: giữ 40/60, nâng Web/PickList nội bộ 56/44, text dynamic height, Agent header measurements, no overflow, giữ đúng 6 cột.
- `relay-agent/D119AgentFeatures.cs`: toolbar 1 hàng tại viewport đủ rộng, 2 hàng tại viewport hẹp, grid/search tự dịch theo toolbar, không cuộn ngang.
- `relay-agent/D173E175NetworkCapability.cs`: **không thêm probe/provider request**; tái sử dụng phân loại dựa 2 GET xác thực đang tồn tại; thay các nhãn hiển thị.
- `relay-agent/Program.cs`: giữ nguyên `D173E159ApplyOfficeCapabilityUi` business gating; thêm tooltip cho Cloudflare-blocked SKU/update; không sửa `ConfirmManualPicklist` hoặc `SearchManualPicklists`.
- `tests/d173-e182-agent180-layout-network.test.mjs`: review layout, modes, GUI gates, không tăng request.

## Verification and release
- Chỉ Agent180; chủ động hồi quy Agent native, confirmation guard, source/UI guard, D172 isolation, cross-platform tests.
- Source CI PASS không tự chứng minh FIELD PASS. CI/Release/OTA/FIELD/OWNER là trạng thái độc lập.
- Branch→PR→CI→pin source SHA→merge theo Owner→signed Agent EXE/OTA; Stable OWNER-GATED; D172 PENDING/HOLD.
