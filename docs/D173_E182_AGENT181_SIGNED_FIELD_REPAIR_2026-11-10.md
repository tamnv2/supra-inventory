# D173-E182 — Owner lệnh phát hành Agent181 sửa FIELD UI (10/11/2026)

## Owner quyết định
- Owner báo Agent180 FIELD FAIL với ảnh cụ thể: khoảng trống sai, căn chỉnh/hàng công cụ sai và Danh sách phiên có cột dư trong khi hoạt động/trạng thái bị cắt.
- Owner đã chốt sửa responsive + auto width trong D173-E182 và nay ra lệnh rõ: **“Sao chưa phát hành em? Xử lí cho anh để done triển khai”**; lệnh này phê duyệt merge/triển khai bản Agent sửa sau CI, không cần phê duyệt lần nữa.
- Agent180 đã là signed/OTA nên **không được ghi đè v180**. Tăng đúng một version thành **Agent181**, giữ Host13.
- Tất cả thay đổi **Agent Windows-only**: measured layout 40/60, toolbar/header/network, Web/PickList, cột phiên tự chia theo text thực, action compact và xem đủ text qua tooltip/detail.
- Không đổi xác nhận PickList, WMS, mạng/Cloudflare/Firebase probe cadence, HA, RBAC, API, Worker/Web/Android/Host13/D172/Stable. **Không tăng provider usage**.
- D172 vẫn độc lập PENDING/HOLD, Stable OWNER-GATED.

## Cổng triển khai
1. Branch `fix/d173-e182-agent180-field-layout-autowidth-20261110`, protected PR #904; không push main trực tiếp.
2. Exact source PR CI PASS gồm Windows net48/x64 native, test layout, confirm/HA, D172 isolation, authority/state/UI & zero-new-usage. **CODE/CI** khác **FIELD/OWNER PASS**.
3. Pin `ops/d173-e182-agent181-release-authorization.json#source_ci_sha` tới đúng source đã kiểm thử; giữ checksum CI và release gate fail-closed, không sử dụng lại quyền phát hành Agent180.
4. Protected merge commit phải bắt đầu `D173-E182_AGENT181_ONLY_RELEASE:`, 2 parents; workflow ký Agent mới, kiểm tra bản OTA hiện tại là Agent180, Worker/SQLite health sẵn sàng, Host13 nguyên trạng; nếu mất bằng chứng thì dừng.
5. Chỉ coi **RELEASE PASS** khi run signing SUCCESS, GitHub tag `relay-agent-v181`, sha256 EXE trong release khớp `inventory-channel` và manifest OTA chỉ tới đúng v181. Mọi bước lỗi phải sửa và chạy lại theo gate, không coi pass giả.
6. **FIELD/OWNER PASS:** Owner xác nhận trên màn hình máy thực tế; không được suy diễn từ CI/OTA.

## Trạng thái kỹ thuật
- Chưa ghi CI/RELEASE PASS khi chưa có run và checksum xác thực.
- PR #904 / source-only → protected merge → signed-only release `relay-agent-v181` / `inventory-channel`.
