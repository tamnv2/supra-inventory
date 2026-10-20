# D170 + D171 — Một Production, đồng nhất phát hành

**21/10/2026; SOURCE ONLY. Two Draft PRs, no release / merge / provider mutation.**

| Bề mặt | Đang phục vụ | Ứng viên chưa phát hành | Điều kiện |
|---|---|---|---|
| Web + Worker | Web 3.1.1, Worker `supra-inventory-beta` với InventoryCore SQLite duy nhất | Web 3.1.2; Worker vẫn cùng ID/dữ liệu | D170 PR657 OAuth Worker phải release/field PASS trước D171 PR656 |
| PDA Android | Signed vc114 | vc115 | Domain `inventory.supra.cc.cd`, nguyên applicationId/signer/tag `beta-vcN`, thử OTA tại chỗ |
| Windows Agent | v139 | v140 | Cùng domain chính, Firestore requestId + PRIMARY CAS/WMS executor, thử standby trước VPS |
| OAuth | Callback cũ còn hoạt động | Official callback mới từ PR657 | Owner đã lưu URI; Google code/CSRF, Drive/Gmail thực tế chưa chứng minh |
| Nhật ký | Model hiện vận hành | 13:15/21:15 VN + retry + Drive receipt | D171 E039/E040, Web không tự có client logs khi không mở trình duyệt |

**Một Production** dùng `inventory.supra.cc.cd`, cùng Worker hiện tại, InventoryCore/SQLite và Firebase. `inventory-beta.supra.cc.cd` chỉ là đường tương thích tạm cho thiết bị cũ; không thể xóa trước khi fleet đã nâng cấp và OAuth hoàn chỉnh. Các tên `beta` trong applicationId, versionName, GitHub release tag, Firebase project và APP_ENV là ràng buộc kỹ thuật tương thích/guard, không phải chế độ lựa chọn môi trường trước người dùng. Không tạo database mới, không đổi signing, không mở hoặc triển khai Worker Stable cũ.

**Thứ tự bắt buộc:** (1) D170 PR657 CODE/CI PASS; (2) Owner release approval dành riêng cho chuyển OAuth chính thức, Worker deploy và real Google/Drive/Gmail readback; (3) giữ legacy host và xác minh thiết bị cũ cập nhật; (4) cập nhật PR656 trên main mới, chạy lại CI Windows/Android/Web/HA/ACK/log; (5) Owner chốt phát hành mới và canary theo standby→VPS→Android→Web, với rollback; (6) sau khi không còn client cũ, mới xin duyệt đóng legacy host. PR656 không được tự mang cấu hình Worker OAuth do CODE ONLY provider guard.

**Điểm chưa đạt:** Google provider readback, Google OAuth field, current fleet version inventory, Office/WMS + ACK full hardware pass, billed usage, Owner business acceptance. CI xanh không thay thế các bằng chứng đó.
