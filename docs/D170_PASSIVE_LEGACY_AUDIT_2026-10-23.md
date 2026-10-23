# D170 — Kiểm tra thụ động trong ca và phân loại thành phần legacy (23/10/2026)

**Owner decision:** chỉ kiểm tra nguồn GitHub/cấu hình/CI và chứng cứ có sẵn khi hệ thống đang vận hành. Không thay đổi DNS, route, Worker, Firebase, Google OAuth, Agent, Android, người dùng, dữ liệu hay production. Không tạo giao dịch thử và không quét tải; kết luận này không phải kiểm thử sâu sau ca.

## Bằng chứng đã đọc (không thêm traffic nghiệp vụ)

- `service/wrangler.beta.toml`: hai custom domain `inventory.supra.cc.cd` và `inventory-beta.supra.cc.cd` cùng Worker kỹ thuật `supra-inventory-beta`; production dùng InventoryCore SQLite và Firebase đang hoạt động. Đây là **một** Production, không phải hai nguồn dữ liệu.
- D170 PR #657, Worker run 39505589708: official/legacy host source + storage health và OAuth origin guard kỹ thuật PASS tại mốc release; Owner đã báo Google OAuth callback thành công. **Chưa xác nhận lại sau khi lưu refresh secret bằng giao dịch Drive/Gmail thật.**
- D171 PR #656, release main e08fa2a (GitHub workflow 13/13): Web 3.1.2, Agent v140, signed Android vc115; các hotfix tiếp theo và `beta-vc117` đã phát hành. `inventory-channel` vẫn chứa `pda-latest.json`, `supra-inventory-beta.apk` lẫn alias `1291-Bao-Hang.apk`; Agent channel có EXE, manifest và fixed WebView2 runtime. Không có bằng chứng tất cả PDA/PC đã nâng lên bản mới.
- `docs/D170_PHASE3_CLIENT_MIGRATION_AND_SUNSET_2026-10-19.md`: signed Android vc113/Agent v138 trở về trước có URL API/OTA cũ và không tin cậy manifest redirect sang domain mới. **301/302 không thay thế được việc giữ domain cũ**.
- `ops/project-scope.json`: Worker Stable cũ `supra-inventory-stable` là OWNER-GATED; official host đã gắn với Worker dữ liệu đang dùng; không được suy từ tên key `host-stable` rằng official domain đang là Stable Worker.

## Phân loại kết quả

| Nhóm | Kết luận trong ca | Hành động |
| --- | --- | --- |
| Các nhãn Beta/Stable, lựa chọn môi trường, nội dung hiển thị/dấu vết UX cũ không còn dùng | Có thể **đề xuất** dọn sau kiểm tra source+screen; chưa có danh mục đường dẫn đã chứng minh không được tham chiếu | Lập danh sách chính xác dưới D173; PR code riêng, không sửa trong ca |
| Quy trình promote Beta→Stable đã lỗi thời trong mô hình Production duy nhất | Có thể **đề xuất** bỏ quy trình user-facing; kiểm tra workflow/receipt, rollback và tag legacy trước khi xóa code | Chỉ archive/retire các workflow đã chứng minh không chạy; không xóa release history |
| Host `inventory-beta.supra.cc.cd`, route cũ, OAuth callback cũ | **BẮT BUỘC GIỮ** khi chưa có chứng cứ toàn bộ fleet và OAuth không còn phụ thuộc | Chờ thống kê hoạt động không nhạy cảm trong 14–30 ngày, tính cả thiết bị dự phòng lâu không bật; hậu ca xác minh sâu |
| `supra-inventory-beta` Worker, InventoryCore SQLite, Firebase project/Auth/Firestore/RTDB và secret names | **BẮT BUỘC GIỮ** vì thực sự là Production; xóa là gây hỏng hệ thống | Không đổi tên, không migrate/xóa |
| Android `cd.cc.supra.inventory.beta`, keystore/signer, `beta-vc*`, `inventory-channel`, SHA/manifest cũ, Agent signed update paths | **BẮT BUỘC GIỮ** để không chặn nâng cấp OTA tại thiết bị cũ | Chỉ nghiên cứu sau ca; không xóa tag/assets |
| `supra-inventory-stable` Worker và Firebase Stable riêng (OWNER-GATED) | Chưa được chứng minh hoàn toàn không dùng bởi công việc/historical rollback; không phải Production hiện tại | Giữ nguyên, muốn xóa phải có lệnh xóa tài nguyên cụ thể và kiểm chứng quyền/scope |
| OBPP D172 APK v8, private Sheet, `/api/obpp1291/*`, Core `obpp_*` | Bắt buộc giữ; D172 đang HOLD riêng và chia sẻ process Worker | Cấm đụng khi dọn legacy của D170/D173 |

## Sau ca / D173: điều kiện quyết định

1. Dùng log/access/OTA **có sẵn**, không bí mật, để đối chiếu old-host calls theo client version + cohort, không sao chép UID/IP/QR/DO vào public repo. Không có request vài ngày không chứng minh tất cả thiết bị cũ đã nghỉ.
2. Kiểm tra thật trên một số **thiết bị không trực tiếp xử lý đơn**, với quyền Owner, hành vi OTA vc cũ/Agent cũ, đăng nhập, log Gmail/Drive, WebSocket, WMS/ACK/HA; chỉ sau ca và qua một phê duyệt tách biệt nếu phát sinh bất cứ provider mutation nào.
3. Trước khi tháo old domain: đủ chứng cứ fleet, OAuth, updater và rollback reattach **cùng Worker**; PR exact source+CI+scope+release receipt Owner. Không đụng SQLite dữ liệu, Firebase, signer, D172 hay legacy Stable.
4. Ghi rõ sau ca `FIELD_VERIFIED` từng chủ đề; không nâng kết luận GitHub read-only thành chứng nhận xóa được hết.

**Kết luận hiện tại:** D170 đạt nghiệm thu giới hạn việc chuyển mô hình sang **một Production**, nhưng **không có tài nguyên hạ tầng legacy nào được phép xóa trong ca**. Quyền xóa phải được xét lại riêng dưới D173 sau kiểm thử sâu và một quyết định cụ thể.

## 23/10/2026 — D173-E004 thay đổi chính sách tương thích phiên bản cũ

**Quyết định mới nhất của Owner supersedes đoạn “BẮT BUỘC GIỮ legacy host chỉ vì fleet cũ” trong audit trước.** Baseline chính thức: Agent **v140**, APK Báo hàng **vc117**, Web **3.1.2**; Owner đã nâng các thành phần này. Không còn điều kiện bảo toàn auto-update/redirect của Agent v138/Android vc113 hoặc các bản thấp hơn. Máy chưa cập nhật sẽ tự tải/cài thủ công bản được hỗ trợ; không coi sự cố của updater cũ là blocker xóa route legacy.

**Phân loại phải làm lại tối 24/10:** `inventory-beta.supra.cc.cd` = **ứng viên tháo** (không còn buộc giữ chỉ vì bản cũ), **CHƯA ĐƯỢC XÓA**; phải xác minh source/runtime/API/WebSockets/update manifest/Google OAuth của Agent140/vc117/Web3.1.2, cron/gateway/Google log và D172 v8 không gọi host đó. Mọi asset `inventory-channel`, `beta-vc117`, `relay-agent-v140`, Android package/signer và physical Worker tên `supra-inventory-beta`, InventoryCore, Firebase active ID, DO/SQLite vẫn có thể là **phụ thuộc của bản mới** và không được rename/delete chỉ vì chữ beta. Legacy Stable worker OWNER-GATED phải có Owner consent riêng nếu muốn xóa. Giai đoạn đánh giá không phụ thuộc yêu cầu thống kê 14–30 ngày toàn bộ máy *phiên bản cũ* nữa; tập kiểm tra đủ là hợp đồng của ba phiên bản đang hỗ trợ + hệ thống chia sẻ OBPP.

Lịch tiếp tục: **24/10/2026 23:00 VN**, sau khi người dùng hoàn thành công việc ngày thứ Bảy; không làm đêm 23/10. Xử lý source/clean workflow chỉ qua PR/CI và rollback. Xóa binding/DNS/Worker/Firebase, triển khai làm gián đoạn Production hoặc D172 cần bằng chứng và lệnh riêng; đây không phải bằng chứng đã xóa.
