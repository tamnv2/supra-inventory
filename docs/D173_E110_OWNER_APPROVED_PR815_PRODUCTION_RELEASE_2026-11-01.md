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

## Kết quả thao tác trong lượt này

- Kiểm tra lại PR815 HEAD và exact-source CI: **CODE READY PASS**; PR vẫn Draft/chưa merge.
- Owner đã ra lệnh phát hành khi code chính xác. Tuy nhiên, pipeline hiện tại chưa có nhánh E110 trong `tools/d167_release_gate.py` / `.github/workflows/deploy-beta.yml` / `verify-apps.yml`.
- Công cụ GitHub chặn chỉnh sửa workflow phát hành được bảo vệ. Không tìm cách vượt rào bằng API Git data hoặc đường ghi thay thế.
- Đã **hoàn nguyên** sửa đổi tạm thời `tools/d167_release_gate.py` và xóa release gate chưa kiểm chứng.
- Khóa mọi quyền merge/deploy/OTA ở E110 receipt về false. Không merge PR815, không cập nhật Worker/Web, không xuất bản APK/OTA; Agent/D172/Firebase/Stable không đổi.
- Tiếp tục chỉ khi có đường cập nhật workflow an toàn được cấp quyền; sau đó thực hiện PR/CI release-gate, Worker health/source readback rồi mới APK vc122.

**STATUS: CODE READY PASS; RELEASE BLOCKED BEFORE MERGE; FIELD/OWNER PASS PENDING.**

## Technical release evidence after E110 guarded merge

The earlier **RELEASE BLOCKED** checkpoints record prior, subsequently resolved workflow-access conditions. Owner edited the two protected workflows; the current PR815 release was source-pinned and verified.

- Final source PR815 `2daafcc8...`: **39/39 PR workflows SUCCESS**, D172 regression PASS.
- Merge main `3135efaa98e0749247fd504995b095f1e6d467d2`, Owner release marker E110.
- Worker/Web release run `41325295079` **SUCCESS**, official health/storage/schema/auth/Web smoke PASS.
- Android signed `beta-vc122` release run `41325295010` **SUCCESS**, OTA `inventory-channel` updated.
- D172 separate HOLD, Agent162 unchanged, Firebase/Gateway provider deployment skipped, Stable untouched.
- Separate Email Sender Guard workflow run `41325293785` failed at workflow startup with no instantiated job; CI investigation pending, not a production mail failure.
- **FIELD and OWNER PASS are not established**; do not claim actual installed device version or achieved DO usage savings.

Canonical: `docs/D173_E110_PR815_PRODUCTION_TECHNICAL_RELEASE_RECEIPT_2026-11-01.md`.
