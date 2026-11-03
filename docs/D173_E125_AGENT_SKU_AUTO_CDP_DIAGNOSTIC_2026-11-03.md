# D173-E125 — Sự cố Agent không hoàn thành FULL SKU tự động (03/11/2026 VN)

## Bằng chứng hiện có

- Ảnh Owner: slot `INITIAL_05` 03/11 lúc 05:00 đang `RESERVED` ("Đã cấp quyền cho máy cập nhật"), chưa có thời gian hoàn thành/biên nhận; các slot trưa, tối chưa đến giờ. Tab Agent báo WMS sẵn sàng nhưng không xác nhận quyền đọc SKU từ trình duyệt Agent-owned.
- `RESERVED` chỉ chứng minh đã lấy lease, **không chứng minh** đã lấy Excel WMS, stage hay cập nhật master. Không được tạo `DONE` giả hoặc ghi đè dữ liệu SKU.
- Drive archive 03/11 ở thời điểm kiểm tra chỉ có log Android, không có Agent source log của lần 05:00. **Không đủ căn cứ kết luận duy nhất nguyên nhân lỗi thực địa.**
- Source `D167SkuBrowserExport.Export` gọi `Page.reload` qua CDP; `Command` trước đó bỏ mọi event khác ID lệnh 2. CDP có thể trả `Network.requestWillBeSent` và `Network.requestWillBeSentExtraInfo` trong thời gian chờ phản hồi `Page.reload`; bỏ event mất dữ liệu nguồn cần thiết cho `CaptureAuthorizedHeaders`, dẫn đến `D167_WMS_AUTH_TRAFFIC_NOT_OBSERVED`. Đây là **race condition xác định từ mã nguồn**, chưa phải bằng chứng crash thực địa.
- `_supraBrowserReady` có thể true khi browser đang ở Desktop mode; nhưng tự động SKU còn yêu cầu `_supraBrowser.IsAgentOwnedMode()`. UI cũ hiển thị WMS "sẵn sàng" dù đường SKU không đủ điều kiện.

## Bản vá ứng viên, không thay đổi nghiệp vụ

1. Buffer tối đa 256 sự kiện Network CDP trên **một socket** trong lúc chờ phản hồi `Page.reload`; replay qua **cùng** kiểm tra HTTPS host `api-supra.winmart.vn` và requestId. Chỉ giữ trong RAM, không ghi/log URL, header, access token, cookie, signature; không điều hướng trang Confirm, không gọi thêm Worker hoặc WMS.
2. Thêm kiểm thử native Win64 không mạng bằng `--d167-sku-cdp-replay-self-test`: sự kiện ExtraInfo tới trước request, domain ngoài bị bỏ qua, chỉ cho phép header thuộc đúng request WMS.
3. UI chính xác: `RESERVED` ≠ `DONE`; báo thiếu Agent-owned browser dù Confirm WMS đang sẵn sàng, và hiển thị mã lỗi đọc WMS đã khử nhạy cảm. Khi bấm "Kiểm tra trạng thái" giữ thông báo lỗi gần nhất thay vì vô tình xóa.
4. Giữ nguyên 05:00/12:00/19:00, Worker/Core/SQL, lease/HA, manual confirm, runtime API, sở hữu nguồn WMS; không động D172, Stable, Rules, Gateway. Không phát sinh cloud request/timer mới.

## Kiểm thử / cổng triển khai

- SOURCE/CI: Windows native build + offline CDP replay, D167 3-slot SKU regression, Agent/HA/ACK/Confirm, static security/secret guards, D172 isolation.
- Không xuất bản bản vá vào `relay-agent-v164` đã ký. Nếu sau này phát hành phải tăng version monotonic, có Owner release authorization mới và source-pin/CI, signed Agent-only OTA; **không tái sử dụng quyền E123 để deploy**.
- Chưa có Agent log 03/11 để xác định 100% nguyên nhân; kiểm thử code không chứng minh WMS thực hoạt động. FIELD/OWNER PASS vẫn PENDING.
- Khi nhận log Agent có `D167_SKU slot` hoặc `D168_SKU_SUMMARY`, đối chiếu phase `SIDE_*`, reserve, abort và lỗi mạng để xác minh hiệu quả; không cần đọc secret.

## Rủi ro & tác động base

- Thay đổi chỉ `relay-agent/D167SkuBrowserExport.cs`, `D167SkuDirectExport.cs`, `D167SkuUi.cs`, `D167SkuCoordinator.cs`, `Program.cs`, Win64 CI, SKU test và docs/state. Không đổi cấu trúc database, không đổi thuật toán upsert/hide, không replay WMS mutation.
- Rủi ro: thay đổi buffer event chứa header nhạy cảm **trong RAM**; giới hạn số sự kiện và xử lý bằng allowlist, không persist, không log. Không thay đổi mạng / chuyển Wi-Fi đang được phê duyệt.
- **SOURCE CODE/CI READY:** source `9a0c5b4d8a8aa837deacef7cd21777836b356dcd`, PR #831: **33 SUCCESS, 0 FAILED, 11 event-inapplicable SKIPPED**, native Windows Agent build and actual `--d167-sku-cdp-replay-self-test` PASS, D167 schedule/Worker/HA and D172 regression PASS.
- **PRODUCTION RELEASE: NOT AUTHORIZED / NOT RELEASED**. Current signed Agent164 remains untouched. If Owner expressly approves Agent-only deployment, target version must be incremented monotonically (v165) and use new exact-source signed release gates; no Worker/Web/Android/Firestore/Gateway/D172/Stable mutation.
- **FIELD/OWNER PASS: PENDING**, no evidence from actual 05:00 Agent logs or live WMS export; cannot claim today's SKU was updated.

## Owner bổ sung UI & lệnh phát hành (03/11/2026)
- 40% khu thao tác trên / 60% danh sách phiên dưới thay thế 30/70 cũ.
- Màn hình lớn 3 cột; màn hình vừa 2 cột và cuộn dọc; rất hẹp 1 cột; sidebar cũng điều chỉnh độ rộng, không cưỡng bức khung trên >=1180px hoặc cửa sổ >=720px trên màn hình 720p.
- Owner phê duyệt Agent165 Production **có cổng CI + ký OTA riêng**, không dùng lại E123; Worker/DO/Web/Android/Firestore/Gateway/D172/Stable giữ nguyên.
- CODE/CI/RELEASE/FIELD/OWNER phải ghi nhận riêng; code-only không phải phát hành, chưa có bằng chứng FIELD 1280x720 thực.

## Nguồn đã kiểm thử và khóa CI (03/11/2026)
- Agent165 source: `695f9adf1b230ab2f251e8c8e940d967c58fbc35`; 37 GitHub checks SUCCESS, 0 FAILED, 11 event-inapplicable SKIPPED, bao gồm native Win64/SKU CDP replay, Agent schedule/HA, D172 isolation, authority và continuity.
- Chính xác source trên được gắn trong `ops/d173-e125-agent165-release-authorization.json`. Chỉ merge commit giữ source ancestor; không squash làm mất SHA. Release OTA chưa được xác nhận ở bước này.
- D172 vẫn PENDING/HOLD, Worker/Web/Android/Firestore/Gateway/Stable không phát hành trong E125.

## Technical Release PASS — Agent v165 (03/11/2026)

- Source exact CI: `695f9adf1b230ab2f251e8c8e940d967c58fbc35`; 37 SUCCESS, 0 FAILED, 11 SKIPPED.
- PR [#831](https://github.com/tamnv2/supra-inventory/pull/831) merge commit `72a18a2749f104d5608fd2d0b62118757fa219d8` (không squash, giữ source ancestry).
- Windows Agent signed OTA GitHub Actions [run #41555653528](https://github.com/tamnv2/supra-inventory/actions/runs/41555653528) **SUCCESS**.
- Release [relay-agent-v165](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v165) và [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel): cùng EXE SHA256 `f5c57a36f379963f21402f21bc5ed6eaf372f7d9c894fea990bd39f91b11b773`; có checksum và agent-latest.json cập nhật.
- Production Worker và Firestore Rules workflows được **SKIPPED**; không triển khai Web, Android, Gateway, D172, Stable hoặc resource mới.
- Phân biệt: CODE PASS; CI PASS; RELEASE TECH PASS; **FIELD PASS=PENDING** (máy 1920×1080/1280×720 và WMS FULL SKU thực chưa kiểm); **OWNER PASS=PENDING**. D172 tiếp tục PENDING/HOLD.
