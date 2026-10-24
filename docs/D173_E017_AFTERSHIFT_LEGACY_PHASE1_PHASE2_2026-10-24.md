# D173-E017 — Sunset sau ca 24/10/2026, Đợt 1 và Đợt 2

**Lệnh Owner ngày 24/10:** xử lý legacy an toàn trước, sau đó Đợt 1 (A + C + log cho nhóm B), Đợt 2 chỉ xử lý sau vài ngày vận hành có dữ liệu mới. Không suy diễn CODE PASS thành CI/RELEASE/FIELD/OWNER PASS.

## 1. Phân loại legacy — nguồn được kiểm tra sau 23:00 VN

- Baseline v140 Agent, vc117 Báo hàng, Web 3.1.2, D172 OBPP v8; D172 PENDING/HOLD, Stable OWNER-GATED.
- Worker Production hiện tại tên kỹ thuật supra-inventory-beta, gồm hai custom host inventory.supra.cc.cd và inventory-beta.supra.cc.cd; InventoryCore SQLite và Firebase beta-named đang thực sự phục vụ mô hình. **Không xóa/đổi tên/migrate các resource này.**
- v140/vc117 gọi official API/OTA; Web dùng same-origin; D172 dùng official-host API và OTA GitHub riêng. Giữ signer/packageId, current signed tag và manifest/channel.
- PR708 code-only có thay đổi hai workflow đọc official host, nhưng các workflow/OAuth test cũ vẫn dùng host beta. Chưa có đủ readback Cloudflare binding + OAuth/Drive/Gmail field và D172 shared-negative proofs, vì vậy **không tháo hostname cũ và không tuyên bố PROVIDER DELETE DONE**.
- Unsupported old Agent/APK không cần giữ auto-update, nhưng khách hàng mới và D172 vẫn phải PASS; đây không phải quyền xóa vật lý Worker/DO/Firebase/Stable.

**Cổng tháo old hostname**: source inventory and runtime request cohorts (sanitized) → official OAuth/Drive/Gmail/WS/OTA/WMS/Office/HA/D172 regression → provider Cloudflare domain/route proof → rollback reattach same Worker → exact-head authority + continuity + isolation CI + Owner release gate → detach. Nếu thiếu bước nào, giữ binding và ghi BLOCKED. Không dùng GET /health như pure read khi có nguy cơ Firebase credential migration.

## 2. Đợt 1 — A + C + telemetry B

- PR713 → PR714 → PR715 → PR717 (stacked; chưa merge vào main). Phải tuần tự xác nhận base/current and exact-head CI, không vượt cổng release.
- A1: tải APK có %, bytes, MiB/s, unknown-size fallback; tách downloaded, SHA/signer verified, installer handoff và installed. Test ngắt mạng, APK sai, rollback.
- A2: tái phát chỉ tính khi phiên trước resolved và báo mới cùng ngày Việt Nam; giữ lịch sử, test 00:00/03:00, projection/export.
- C: Reporter online chỉ xem trong Agent; không Kick/Contact/Call/bulk-action/Pickers count/WMS wake. Nguồn socket role đúng, network Office không truy cập Worker thì fail-closed.
- Log B: Reporter badge/refresh/stale/count/revision/seq/UI frame/scroll anchor; Android FCM received→displayed và lifecycle; WS reconnect reason; Agent PRIMARY/standby RTDB/Office/lease/ACK; Worker SQL D166 queryId/rowsRead/latency per execution; Web client vs server-only logs; OTA error phases. Dùng counter allowlist RAM giới hạn + gửi cùng bundle sẵn có 13:15/21:15, báo lost/overflow/coverage. Không thêm ping, cron, network request chỉ để log; không chứa cá nhân/token/SKU/URL query/raw payload.
- Trước phát hành: exact source + Android/.NET/TypeScript + D172 negative-auth/SQLite regression + authorized current OTA/Worker/Agent signer + field and rollback receipt. Đảm bảo trải nghiệm, realtime/ACK/HA không kém baseline.

## 3. Đợt 2 — HOLD

Chỉ bắt đầu khi Đợt 1 RELEASE PASS và có ít nhất ba ngày làm việc thực tế với log và provider usage đầy đủ: Reporter, Picker, Agent PRIMARY/standby, Web client, Worker/DO và Firebase trên cùng cửa sổ thời gian và version. Nếu coverage thiếu phải tiếp tục thu thập, không tự sửa logic B. Đối chiếu SQL rows per query, DO Requests, reconnect/disconnect, UI flicker/anchor, overlay visibility, ACK end-to-end và p50/p95/p99; chuẩn hóa theo business load/Agent-hours. Chỉ chuyển logic sau root cause + regression có bằng chứng.

**Trạng thái tại checkpoint:** LEGACY_SOURCE_AUDIT_PASS__PROVIDER_DETACH_BLOCKED; PHASE1_EXISTING_CANDIDATE_PR717__CI_NOT_ALL_PASS__NO_RELEASE; PHASE2_PENDING_FIELD_EVIDENCE. D172 độc lập PENDING/HOLD; Stable OWNER-GATED; không provider mutation bởi PR docs-only.
