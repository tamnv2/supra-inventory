# D173-E035 — Biên nhận phát hành Production UI E032/E034 (25/10/2026)

**Phạm vi Owner phê duyệt:** D173-E032 A+B+C+D, giữ dữ liệu/phiên/kênh cập nhật hiện hữu. E034 pin nguồn; E035 chỉ ghi nhận kết quả kỹ thuật sau phát hành. Không phát hành mới, không thay đổi provider do riêng E035.

## Nguồn và chứng cứ

- PR [#736](https://github.com/tamnv2/supra-inventory/pull/736) merge qua lịch sử (không squash) vào Production commit `029c2c2cf0802d798a79f91eef70d84b8dd734a3`; subject `D173-E034_UI_RELEASE:`. E034 pin ứng viên mã `8309113a06dd89ed090b2a09a20d29c678d44934`, 34/34 CI PR PASS; cập nhật receipt/doc sau pin không thay đổi protected code/workflows.
- **Worker/Web official Production**: [run 40171737896](https://github.com/tamnv2/supra-inventory/actions/runs/40171737896) `completed/success`, Owner release gate, Worker `supra-inventory-beta`, hostname chính `inventory.supra.cc.cd`, InventoryCore SQLite, health/source/binding/schema, Web shell và OAuth start success. Giao diện Web 3.2.0 dùng Tabler.
- **Agent Windows v142**: [run 40171737898](https://github.com/tamnv2/supra-inventory/actions/runs/40171737898) `completed/success`, Worker source/health, Gateway/Firestore Rules preserved, Windows build, publish [relay-agent-v142](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v142), EXE `Agent.Auto.Confirm.Pick.Pack.exe` 8,666,624 bytes, SHA256 sidecar và WebView2 fixed bundle đã công bố.
- **Android vc119 signed + OTA**: [run 40171737922](https://github.com/tamnv2/supra-inventory/actions/runs/40171737922) `completed/success`, kiểm tra bắt buộc Worker và immutable Agent142 Git tag/tree + cùng-source Agent workflow success, bước `Publish signed Beta auto-update release` PASS. [beta-vc119](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc119) có `supra-inventory-beta.apk` 20,072,990 bytes + SHA256; `inventory-channel` chứa `pda-latest.json`, `1291-Bao-Hang.apk`, canonical APK/SHA; app ID và signer hiện hữu được giữ.
- Cả `refs/tags/relay-agent-v142` và `refs/tags/beta-vc119` là immutable commit refs trỏ `029c2c2c...`. `target_commitish=main` trên Agent Release chỉ là metadata, không thay thế kiểm chứng immutable Git tag.
- **Firebase Rules không deploy**: workflow [40171737873](https://github.com/tamnv2/supra-inventory/actions/runs/40171737873) `skipped`. Gateway workflow [40171737996](https://github.com/tamnv2/supra-inventory/actions/runs/40171737996) overall success, nhưng provider-deploy job `skipped` (chỉ source-check success). Không migration/tạo provider resource mới.

## Phân biệt cổng

| Gate | Trạng thái |
|---|---|
| CODE/CI | **PASS**, E034 34/34 PR workflows exact source |
| Production Worker/Web | **RELEASE PASS** run 40171737896 |
| Agent v142 signed/channels | **RELEASE PASS** run 40171737898 |
| Android vc119 signed/OTA channel | **RELEASE PASS** run 40171737922 |
| FIELD (thiết bị và đăng nhập thật) | **PENDING**, chưa có chứng cứ thực địa |
| OWNER PASS cuối | **PENDING**, không suy từ CI/RELEASE |
| D172 OBPP riêng | **PENDING/HOLD** vĩnh viễn tới khi Owner ra lệnh đóng |
| D173 Đợt 2 | **HOLD**, tối thiểu 3 ngày hoạt động thật cùng phiên bản và log/usage đủ coverage |
| Stable lịch sử | **OWNER-GATED**, không deploy |

## Nghiệm thu thực tế còn lại

Owner dùng một Agent đang v141 kiểm tra auto-update v142, bố cục cửa sổ hẹp/đủ rộng, login/Supra/WMS WebView2, PickList/HA/ACK và Reporter online chỉ xem + phiên bản. Trên PDA MT90/DT50 từ vc118 kiểm tra OTA vc119, bốn badge Reporter, popup Picker không che nút, thông báo ACK/DND, vai trò, realtime và lịch sử. Web 3.2.0 xác minh menu Tabler responsive theo vai trò. Thu log/usage đúng 3 ngày hoạt động thực tế; nếu phát hiện lỗi thì sửa trong D173 với cổng CI/release mới. Không tự động coi cài đặt thiết bị đã thành công chỉ vì OTA manifest có bản mới.
