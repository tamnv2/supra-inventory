# D171-E063 — Kiểm tra cổng triển khai D170 + D171 (21/10/2026)

## Phạm vi và quyền

Owner đã duyệt phạm vi thống nhất: một Production inventory.supra.cc.cd, cùng Worker/InventoryCore SQLite/Firebase đang mang dữ liệu; App vc115, Agent v140, Web 3.1.2; Google Apps Script Agent Operations Gateway hiện có. Không bật Worker stable cũ, không tạo D1/DO mới, không xóa OTA/host cũ khi còn thiết bị chưa cập nhật. Quyền mới vps/admin/tamnv2 và sửa roster/ẩn Wi-Fi ưu tiên đã được triển khai **chỉ trên nhánh PR656**; quyền Owner triển khai là có điều kiện SOURCE+CI+đọc lại tài nguyên+rollback.

## Source review

- User privilege Worker `service/src/index.ts` yêu cầu role/base_role đã xác thực và account allowlist vps/admin/tamnv2 cho support-log và bulk revoke. Agent `D161AdminControl.cs`, `D161SupportLogControl.cs` cùng allowlist; mọi tài khoản khác bị từ chối.
- D161 bulk preview 0 đối chiếu số phiên server và loại tên stale local qua generation tombstone; thao tác thành công vẫn giữ generation mới khi người dùng đăng nhập lại.
- `D119AgentFeatures.cs` và `FirestoreAgentLeaderCoordinator.cs` cho VPS quyền manual-primary theo WMS-ready/CAS, nhưng `FirestoreVpsReclaim.IsOwner` vẫn riêng admin/tamnv2, không có tự phê duyệt.
- `Program.cs` ẩn block Wi-Fi ưu tiên ở Settings; advanced backup SKU configuration ở Chẩn đoán kỹ thuật. `D168NetworkRoute.cs` vẫn bắt buộc dùng danh sách saved-profile đã duyệt để mở Worker lúc Office không truy cập trực tiếp. Không thể xóa tầng fallback này chỉ vì Agent/PDA chuyển sang Firestore.

## Cổng CI đang chặn

- PR656 head `57001be20c6e60434bfbd3bc19b63e29ca6d8427`: GitHub Actions 26 SUCCESS / **1 FAILED**: D167 three-slot SKU pure contract run `39632411126`, job `119333877025`. 46/47 Node assertions PASS; test `tests/d167-three-slot-sku.test.mjs` khoảng dòng 526 yêu cầu UI cũ `InitializeD168WorkerWifiControls(networkCard)` dù Owner vừa yêu cầu ẩn mục Wi-Fi ưu tiên khỏi Connection settings. Cần cập nhật regression assertion để vừa xác thực không có UI priority tại Settings, vừa kiểm chứng SKU fallback vẫn tồn tại tại Diagnostics. Không tắt thử nghiệm vận hành SKU, không đưa nhãn cũ trở lại để đánh lừa test.
- GitHub write connector không chấp nhận bản cập nhật regression test này; thao tác bị chặn bởi kiểm tra an toàn tool. Không có quyền hợp lệ để khẳng định 27/27 PASS.

## Cổng release chưa được chuẩn bị tương thích

- `.github/workflows/deploy-beta.yml` hiện yêu cầu `ops/d170-release-authorization.json.code_scope == D170_OFFICIAL_OAUTH_CALLBACK_PHASE3B` hễ Worker cấu hình callback chính thức. Receipt đó chỉ duyệt OAuth Worker, **không cho phép** source Worker/Agent/Android/Gateway mới.
- Workflow `deploy-beta.yml` còn kiểm tra literal log lịch **21:45**, trong khi nguồn `web/src/runtime-logger.ts` phiên 3.1.2 có **13:15 và 21:15**. Nếu merge thẳng, Worker build/deploy sẽ FAIL; nghiêm cấm đưa literal cũ vào comment để lách kiểm thử.
- `tools/d167_release_gate.py` chỉ nhận change_id D167–D170, chưa có phạm vi D171 chuẩn được Owner phê duyệt. Cần mở rộng fail-closed, exact source SHA + approved components `gateway,worker,agent,android`, Web cùng Worker; giữ stable worker false.
- `deploy-beta-agent-gateway.yml`, `deploy-beta.yml`, `verify-relay-agent.yml`, `verify-apps.yml` chạy theo push cùng lúc, **không bảo đảm** Gateway deployed/readback trước Agent v140. Cần release tách giai đoạn: Gateway source/readback riêng, rồi Worker/Core, Agent standby, Agent VPS/PRIMARY, signed APK vc115 with verified dual public asset, Web 3.1.2; giữ được đường quay lại. Không tự merge PR656 một lần và hy vọng CI triển khai đúng thứ tự.
- Các workflow nằm trong thư mục được kiểm soát `.github/workflows`; cập nhật thông qua GitHub connector bị chặn trong phiên này, không được bypass bằng push main hay nâng quyền bất hợp lệ.

## Cổng nghiệm thu

Sau source CI và release gates PASS, kiểm tra danh sách sau Kick hết người (với login lại cạnh tranh), group CALL/CHAT trên VPS/Office, manual PRIMARY cas, old/new mixed fleet, WMS ACK & 12s fence, mới DISPLAYED vs legacy ACK, Firebase/Web realtime, Google Drive/Gmail thực tế, Worker DO Rows Read/Requests so 20–21/10 với 22/10 theo cùng giờ/tải. FIELD PASS và giảm billed usage chưa thể suy ra từ code.

**Kết luận hiện tại: CODE PENDING do regression test; RELEASE BLOCKED do workflow/receipt phụ thuộc cũ. Không thay đổi Production và không tự xác nhận Owner PASS.**
