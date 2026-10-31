# D173-E112 — Kiểm thử Báo hàng với mã Core thật trong vùng riêng

Ngày: 31/10/2026, Việt Nam.

## Mục tiêu
Owner yêu cầu bỏ LAB thuần mô phỏng để **chạy chính code nghiệp vụ đang phát hành trong môi trường kiểm thử cách ly**, giữ hệ thống vận hành trong ca không bị tác động.

## Thiết lập hiện có
- Draft [PR808](https://github.com/tamnv2/supra-inventory/pull/808), stacked trên PR807, không merge main.
- `tools/d173_e112_real_core_lab/worker.ts` **import trực tiếp `service/src/core.ts`** với class `LabRealCore extends InventoryCore`. Không copy logic tạo báo hàng hoặc resolve sang một implementation giả.
- `wrangler.toml` chỉ chạy `--local --ip 127.0.0.1 --port 9898`, SQLite riêng, không có biến định danh/tài khoản thật, không deploy Cloudflare, không FCM/WMS/Firebase, không D172 payload.
- Actor/SKU test-only trong schema SQLite thực được seed tại endpoint local. HTTP và WS dispatch nội bộ cùng `InventoryCore.fetch` thật, có kiểm tra role/session của Core.
- Đây mới là **real-source backend integration**. Không phải backend Production đã bật M2, không phải APK/Agent/Web đang phát hành được chạy trong lab, và chưa có remote cloud lab.

## Bằng chứng CI
- Run [41168245062](https://github.com/tamnv2/supra-inventory/actions/runs/41168245062): `D173_E112_REAL_CORE_TEST_PASS`, **12/12 PASS**. Tạo báo hàng trả HTTP 201, retry HTTP cùng request ID trả idempotent replay, Reporter resolve thành công, Picker đọc dữ liệu, deny Reporter tạo lệnh Picker, bootstrap schema thực, role/session và allowlist.
- Latency `report_ws_ms=10.4` ở GitHub-hosted local test, **không phải** p95 thiết bị hoặc Cloudflare thật.
- D172 boundary guard run [41168245068](https://github.com/tamnv2/supra-inventory/actions/runs/41168245068) PASS.

## Những gì còn thiếu
- Tích hợp M2 vào ingress/transport và cùng client Web, Android, Agent Production source với idempotency/cursor/nhận kết quả đúng phạm vi; build test variants native riêng.
- Test provider Cloudflare thật, hibernation, billed requests, Rows Read, cost trong chu kỳ thực; cần một tài nguyên **riêng biệt chưa được đăng ký** trong `ops/project-scope.json`. Không tự tạo Worker/DO mới trong account khi scope fail-closed.
- Firebase auth thật, agent<>PDA Firestore/RTDB, WMS/FCM/alarms, full D172 shared-runtime, 60 PDA thực, offline/reconnect, SQL NOMEM, E105 FIELD.
- Không được tuyên bố đạt 0 USD overage hoặc sẵn sàng Production; E111 9/24 release readiness FAIL vẫn là trạng thái gate.

**Quyết định:** Real Core local 12/12 PASS; Production M2 readiness FAIL/NOT PROVEN; không merge/deploy, không đổi tài nguyên live, D172 độc lập HOLD.
