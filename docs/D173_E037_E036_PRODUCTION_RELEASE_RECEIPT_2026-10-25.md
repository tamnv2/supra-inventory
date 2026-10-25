# D173-E037 — Biên nhận phát hành kỹ thuật E036 (25/10/2026)

## Phạm vi và nguồn chính xác
- Owner đã phê duyệt **toàn bộ 9 hạng mục giao diện Web/Agent và thông báo Android** trong D173-E036. E037 là **docs/state receipt only**, không đổi mã nguồn, workflow, schema, quyền, provider hay kênh cập nhật.
- PR [#738](https://github.com/tamnv2/supra-inventory/pull/738) merge bằng **merge commit** `6866eb93bab97147bc3967789ab5d1583a68a9f9`, subject `D173-E036_UI_RELEASE:`.
- Exact source pin `2193ed58f7ad078240a88f5a9f8a059918d5bc6b`: 32/32 GitHub PR workflows thành công. Sau pin chỉ thay đổi `ops/authority-manifest.json`, `ops/change-continuity/D173.json`, `ops/d173-e036-ui-release-authorization.json`, `ops/project-state.json`; **không thay protected source/workflow**.
- Worker `supra-inventory-beta`, hostname chính `inventory.supra.cc.cd`, `InventoryCore` giữ nguyên. D172 OBPP và Old Stable không được cấp phép/không sửa nghiệp vụ hoặc kênh OTA.

## Biên nhận release (đọc trực tiếp Actions, tag, Assets)
| Thành phần | Chứng cứ | Kết luận |
| --- | --- | --- |
| Web 3.3.0 + Worker chính | [Run 40182469499](https://github.com/tamnv2/supra-inventory/actions/runs/40182469499), `completed/success` theo chính xác merge SHA | **RELEASE TECHNICAL PASS** |
| Agent v143 | [Run 40182469529](https://github.com/tamnv2/supra-inventory/actions/runs/40182469529), `completed/success`; [relay-agent-v143](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v143) cùng immutable tag SHA `6866eb93...`, EXE 8,675,840 bytes và sidecar SHA256, `inventory-channel/agent-latest.json` và EXE+SHA cập nhật ngày 25/10 09:54 UTC | **RELEASE TECHNICAL PASS** |
| Android vc120 (signed APK + OTA) | [Run 40182469584](https://github.com/tamnv2/supra-inventory/actions/runs/40182469584), `completed/success`; [beta-vc120](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc120) immutable tag `6866eb93...`, APK 20,072,986 bytes và sidecar SHA256; `inventory-channel/pda-latest.json`, `1291-Bao-Hang.apk`, signed APK và SHA cập nhật 09:55 UTC | **RELEASE TECHNICAL PASS** |
| D172 independent regression | PR #738 nguồn có D172 business isolation guard trong 32/32 PASS, source diff không thay `obpp1291/`, `firebase/` hoặc D172 OTA | **CODE/CI ISOLATION PASS, FIELD PENDING** |
| Legacy Gateway | [Run 40182469512](https://github.com/tamnv2/supra-inventory/actions/runs/40182469512) **failure** tại `D167 Owner release authorization for gateway` vì ngoài phạm vi đã duyệt; không đến bước update provider | **FAIL-CLOSED, KHÔNG DEPLOY GATEWAY** |
| Firebase Rules | [Run 40182469580](https://github.com/tamnv2/supra-inventory/actions/runs/40182469580) **failure** tại `D167 Owner release authorization for firestore` vì ngoài phạm vi đã duyệt; không đến bước publish Rules | **FAIL-CLOSED, KHÔNG DEPLOY RULES** |

**Không được che giấu hai workflow failed**. Chúng phát sinh do legacy path-trigger chạy khi PR chứa file Agent/Android, nhưng authorization bảo vệ tài nguyên ngoài scope. Không tự sửa để cho phép deploy Gateway/Rules và không coi đây là release cần có của E036. Workflow Web/Agent/Android 3/3 thành công. Không tự nhận 16/16 post-merge checks PASS.

## Tình trạng nghiệm thu
- **CODE / PR CI:** PASS exact source 32/32.
- **RELEASE:** PASS kỹ thuật đủ 3 thành phần Web/Worker, signed Agent143, signed Android120 và OTA.
- **FIELD:** **PENDING** — chưa kiểm chứng thiết bị thật MT90/DT50, Win Agent Office Wi-Fi/HA/WMS, notification lúc màn hình khóa, overlay denied, mọi Web role/theme/viewports, Windows DPI 100–200%.
- **OWNER:** **PENDING** — Owner chưa nghiệm thu trực quan/nghiệp vụ bản mới.
- **D172:** **PENDING/HOLD** độc lập, không tự đóng; old Stable **OWNER-GATED**.
- **D173 Phase2:** HOLD chờ ít nhất 3 ngày hoạt động thật và log/usage có đối chiếu.

## Giới hạn xác minh và điểm chưa khép
- Chỉ có CI source/production workflow và release asset; **chưa có bằng chứng mọi trang và dialog Web/Agent đã được xem trực quan ở các vai trò/kích cỡ**, không gắn UI/FIELD/OWNER PASS.
- Bảng online mở rộng tận dụng phiên WS xác thực Inventory và fleet Agent; trên mạng Office có thể không truy cập Worker thì phiên Web/Android biểu diễn **unavailable**, không được tự suy diễn đang ONLINE hoặc kéo Firebase danh tính chung D172.
- Không tự thay đổi timer/polling, bảo mật, WMS confirm, nhận đơn, và không phát hành D172. Khi phát hiện lỗi thực tế, xử lý trên change set mới với exact source CI/release gate mới; không coi bản mới đã được người dùng cài chỉ dựa trên OTA.

## Bước kế tiếp cho người vận hành
Quan sát `inventory.supra.cc.cd` trên nhiều quyền và light/dark; chạy Agent v143 trên cửa sổ thường/narrow, WebView2, WMS, primary/standby và Office; Android vc120 trên MT90/DT50 với màn hình khóa, thông báo cùng SKU, và ACK. Ghi log thực tế, không chia sẻ token/password/session. Không có yêu cầu Owner thao tác Cloud/Firebase thủ công cho release E036.
