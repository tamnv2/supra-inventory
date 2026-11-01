# D173-E110 — Owner cho phép phát hành PR815 (01/11/2026)

Owner yêu cầu kiểm tra PR815 CODE READY và, khi xác nhận đúng, triển khai Production.
GitHub source PR815 **40 SUCCESS, 0 FAILED**, code SHA `6f1692bbb349dca3dad982368d8631727a7ed523`. Đây là quyền **triển khai có điều kiện**, không phải Owner FIELD PASS hay cam kết giảm hóa đơn.

- Worker/InventoryCore và Web trên **Worker hiện có** `supra-inventory-beta`, hostname `inventory.supra.cc.cd`; **không đổi tên/binding/migrate/drop SQLite**.
- Sau exact-main Worker health + source SHA + schema/operational/safety PASS, phát hành APK **vc122** ký bằng signing key hiện hữu và cập nhật OTA qua `inventory-channel`.
- Không thay Agent v162, D172/OBPP, Firebase Rules, Gateway, chức năng WMS, Stable hoặc tài nguyên dự án khác.
- Chỉ dùng code E109 đã kiểm thử; các thay đổi E110 chỉ là gate release và release-notes.
- Bảo đảm source pin, hồi quy D172, CI; `D173_COMMAND_TRANSPORT_DISABLED=1` chỉ là phương án WS rollback cho Worker hiện tại, không tự ý ghi provider trước khi cần.
- Trước nghiệm thu, đo RTT p50/p95/p99, ACK, reconnect, failover, HTTP fallback, SQL rows/writes/duration và DO requests theo operation cùng ca; nếu không đạt baseline, dừng mở rộng/rollback theo quy trình.
- Biên bản kết quả thực tế sẽ cập nhật sau run, **không tự ghi RELEASE/FIELD/OWNER PASS**.

Owner approval reference: `OWNER_20261101_PR815_CODE_VERIFIED_DEPLOY_PRODUCTION`.
Receipt: `ops/d173-e110-release-authorization.json`.
