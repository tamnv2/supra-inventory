# D173-E183 — Agent183: thống nhất bố cục và WebView2 trắng màn hình (11/11/2026)

## Owner evidence / authorization
Owner báo Agent182 FIELD FAIL: khoảng cách/viền ba cột trên và các nút không đồng đều dù layout phân theo %; Web Agent báo READY nhưng thực tế trắng, không thao tác được kể cả khi bỏ bảo vệ. Owner yêu cầu sửa **hai lỗi** và phát hành cập nhật trong cùng D173, không mở D172.

## Căn cứ
Ảnh Agent182 cho thấy card margins không đồng nhất. ADMIN-PC log 05:53:15–05:54:16 ngày 11/11: WebView2 CDP `READY_EMPTY ready=1 loaded=1 hydrated=1 dom=1`, `embedded_tab=ATTACHED` 05:53:38 và `WEB_SHIELD state=UNLOCKED command_ack=true` 05:53:45. Đây là chứng cứ DOM, ghim cửa sổ, ACK điều khiển; **không phải bằng chứng khung hình đã vẽ**. Chưa chứng minh được nguyên nhân compositor cuối cùng.

## Sửa giới hạn
1. Các card phía trên dùng chung 4px outer margin; web/picklist dưới 50/50 có seam 3px + 3px. Web toolbar/status có khoảng cách tính lại nhất quán. Không đổi 40/60, 34/33/33 hay lịch sử, RBAC.
2. Khi mở tab Web hoặc sau mở khóa, Agent gửi một yêu cầu WM_SIZE (height-1 rồi height gốc) + RedrawWindow tới **chính HWND Host13 đã xác thực**, một lần theo hành động UI; không reload/navigate WMS, không tạo WebView mới, không đụng profile/session, không phát sinh request nhà cung cấp.
3. Đổi nhãn DOM READY thành *Trang đã tải (chưa xác minh hiển thị)*, không gắn nhầm với FIELD visual PASS; log nêu rõ `paint_proof=UNVERIFIED`. Không tự nhận lỗi trắng đã sửa triệt để trước khi test thực tế.

## Acceptance
- Windows 1280×720/1600×900/1920×1080, DPI 100/125/150, sáng/tối: các viền/gap đều, không che nút.
- Agent Web tab hiển thị WMS thực, thao tác sau mở khóa; không trắng sau mở tab/khôi phục tray. Nếu vẫn trắng phải giữ FIELD FAIL, thu log.
- Không thay đổi WMS Confirm, Firebase/Cloudflare, Web, Android, Host13, D172, Stable. Source CI exact SHA + signed v183 OTA + channel checksum trước khi gọi technical RELEASE PASS; Owner FIELD/OWNER PASS độc lập.

**Status ban đầu:** CODE candidate; CI/RELEASE/FIELD/OWNER chưa được xác nhận khi tạo PR.
