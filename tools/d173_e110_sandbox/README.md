# D173-E110 — M2 Client Lab (chỉ thử nghiệm)

## Chính sách cô lập

- Đây là **bộ mô phỏng nghiệp vụ và kết nối**, không phải bản sao hoàn chỉnh của Web/APK/Agent đang phát hành.
- Tất cả dữ liệu SQLite, tài khoản và SKU đều là fixture. **Không Firebase/Auth, WMS, Cloudflare Production, D172, FCM thật, Drive/Logs, tài nguyên khác**.
- Wrangler **chỉ chạy local**, nghe ở 127.0.0.1:9897, không khai báo tên miền, route hay token provider; không dùng Wrangler deploy.
- App Android có package khác production: \`com.supra.m2lab.pda\`; APK debug dành cho Android emulator hoặc thiết bị test với \`adb reverse tcp:9897 tcp:9897\` (thiết bị thật cần đổi kết nối loopback từ 10.0.2.2 sang 127.0.0.1 trên nhánh riêng; tuyệt đối không dùng URL Production).
- EXE test Windows tên \`SUPRA_M2_LAB_AGENT.exe\`; chỉ kết nối 127.0.0.1:9897.
- Không nhập tài khoản nhân sự thật, SKU thật hoặc mã PickList thật. Không chạy trên thiết bị đang làm việc trong ca.
- Mặc định trống; có thể xoá dữ liệu tạm Wrangler trong folder được chọn khi kết thúc kiểm thử.

## Phạm vi được mô phỏng

Picker: REPORT, withdraw 60 giây, đọc kết quả và ACK. Reporter: queue/snapshot, resolve HAS_STOCK/SKIP_ALLOWED, correct SKIP sau 5 phút và CAS. Agent: cloud SKU_SYNC, CHAT, CALL_CV, usage model. Web dùng WS hai chiều và HTTP fallback cùng request ID; PDA/Agent native riêng cho kiểm thử kết nối. Core SQLite test-only.

**Không bao gồm:** Agent↔PDA Firestore, xác nhận WMS/HA, FCM/overlay Android thật, OTP, lịch đồng bộ SKU thực, relay logs, toàn bộ nghiệp vụ Web quản trị. Đây là stub cho những chức năng cloud Agent, không phải bản nhúng toàn bộ Agent163.

## Cách chạy trên máy test

Tại repository clone đúng PR nhánh E110, chuẩn bị Node 22+ và chạy:

\`\`\`sh
npm install --prefix service --no-audit --no-fund
node service/node_modules/wrangler/bin/wrangler.js dev --config tools/d173_e110_sandbox/wrangler.toml --local --ip 127.0.0.1 --port 9897
\`\`\`

Mở \`http://127.0.0.1:9897\` trên máy test. Dùng bản Agent EXE từ artifact của GitHub Actions. Dùng APK trên Android emulator cùng máy (địa chỉ 10.0.2.2 được Android emulator map về loopback máy host).

Trong Web, chuyển giữa \`PDA Picker 01\`, \`PDA Picker 02\`, \`Web Reporter\`, \`Agent Cloud\` để kiểm thử; có thể dùng nhiều tab/phần mềm cùng lúc.

\`node tools/d173_e110_sandbox/test-lab.mjs\` thực hiện automated local smoke. CI build APK và Agent EXE riêng, **không ký release / không OTA / không deploy**.

## Acceptance và giới hạn

Unit/CI hoặc phiên mô phỏng thành công chỉ chứng minh **lab hoạt động**. Không khẳng định published source parity, SLA <5s / failover <20s, hay chi phí cloud 0 USD. Với Cloudflare thật, cần đo request/rows/duration/cost provider cùng chu kỳ, sau phê duyệt canary tách biệt.

**Quy tắc phát hành:** D173 POC CODE/CI có thể PASS, mọi Production/Provider/FIELD/OWNER PASS phải xét riêng; D172 độc lập PENDING/HOLD.
