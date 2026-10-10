# D167 — Agent test độc lập: một nút Đồng bộ SKU

Trạng thái: **CODE CANDIDATE / NO RELEASE / NO LIVE E2E PROOF**. Đây là mã thử nghiệm riêng trong `experiments/`, KHÔNG thay đổi hay phát hành `relay-agent/` chính. Không có WMS/browser profile cloning hoặc truy xuất DPAPI, token, cookie, chữ ký từ tiến trình đang chạy.

## Kiểm tra mã VBA tham khảo

Owner đã cung cấp `Export_VBA_10102026_203855.zip` riêng tư để phân tích, không commit vào repo. Trong mã VBA:
- `Mod_Supra_Download.bas` tạo HMAC-SHA256 và nonce mới cho request, dùng WinHTTP GET và đọc responseBody dạng binary.
- `Mod_CheckNewOrderStock_Status.bas` minh họa thao tác download binary, áp header theo phiên hợp lệ.
- `Mod_LicenseGate.bas` hỗ trợ nhiều đường kết nối proxy theo PAC, Windows settings và cấu hình Office.
- Không có bằng chứng thực tế rằng WMS API `exportBinStocks` đã trả HTTP 200 trong môi trường Agent v124. Mã VBA không phải giấy phép sao chép session hoặc token.

## Đã kiểm chứng trong source, không phải nhận định

- Service có route `POST /api/admin/skus/import` đi tới `/business/skus/import-v2`, hỗ trợ `dry_run`, `request_id`, `source_hash`, `confirm_name_changes` và tối đa 2.000 SKU/lô.
- Hiện `interactiveSessionError()` bác bỏ channel `AGENT` bằng `SESSION_UPGRADE_REQUIRED`. Test này có **candidate chưa triển khai** cho riêng import route: AGENT session generation=0, base/effective role trùng, ADMIN hoặc PICKPACK_ADMIN.
- Agent chính lưu Firebase refresh token trong tệp DPAPI CurrentUser, nhưng không cung cấp một public IPC interface giao việc xuất SKU. WMS Confirm browser chỉ dùng DevTools DOM, hiện có guard `session_extract=false`. D126 còn cấm lấy lại request-session material và gọi WMS API trực tiếp.
- Vì vậy một EXE thứ hai không thể an toàn lấy nguyên phiên của Agent chính mà không có thay đổi/ủy quyền giao tiếp thêm. Không dựng tính năng đọc bộ nhớ/DPAPI của app chính hay chiếm cổng DevTools.

## Hợp đồng thử nghiệm

App độc lập `D167-SKU-Sync-Test.exe` có một nút **ĐỒNG BỘ SKU**. Nút gửi đúng một command `SKU_EXPORT_IMPORT` với request_id lên Windows named pipe `Supra.Inventory.D167SkuTest`, nhận reply gồm status + downloaded + uploaded. Chỉ hiển thị thành công khi **cả hai** đã được xác nhận true.

**Hiện main Agent v124 chưa có broker named pipe này**. Bản test sẽ hiển thị **CHƯA KẾT NỐI**, không báo thành công giả, không tác động Web/WMS/Service. Windows CI self-test dùng fake broker và chỉ chứng minh giao diện/IPC, không chứng minh export/import.

### Để test thực tế một nút mà không lộ phiên

Cần Owner chấp thuận một phần giao tiếp tối thiểu ở Agent chính:
1. Một endpoint named pipe **bị hạn chế cùng Windows user và caller được xác thực**; không trả token/cookie/header/signed request.
2. Main Agent tự thực hiện GET read-only đã cho phép bằng đúng browser session của chính nó; không đụng DOM/confirm job đang xử lý, không dùng Network capture.
3. Phần xác thực Inventory Agent dùng trong quy trình nhập SKU; Worker chỉ chấp nhận route/import và role đã chốt; toàn bộ lưu lượng đều Beta.
4. Broker trả file/metadata và Server receipt có kiểm chứng, bao gồm số SKU/rows và kết quả import; không ghi log phiên.
5. Giữ nguyên preview/conflict/không xóa SKU vắng mặt, không cập nhật vị trí.

Nếu Owner tiếp tục yêu cầu **không sửa bất kỳ dòng nào ở Agent chính**, phải sử dụng một phiên WMS độc lập được cấp quyền trong Agent test thay vì lấy phiên ngầm của main. Hai điều kiện không thể đồng thời đảm bảo theo mã hiện hành.

## Gate

Branch → draft PR → Windows build + self-test + repo authority/continuity. **No merge, no Worker deploy, no release channel, no Stable, no real SKU import** ở giai đoạn code-only. Main Agent/Confirm và người dùng đang hoạt động không thay đổi.

Bằng chứng còn thiếu: E2E trên Windows Office, WMS signed GET 200, Excel parser với workbook gốc, route Firebase AGENT live 200, Service import receipt, kiểm tra Web SKU catalog, quan sát không ảnh hưởng Confirm và Usage.
