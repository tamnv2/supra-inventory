# D173-E028 — Sửa cổng ký Android vc118 theo Git tag Agent v141 (25/10/2026)

## Chứng cứ runtime, không giả DONE

- D173-E027 protected main `d73879ed38948026219a9b022929b10aa33af402` sau PR731. Source CI cuối: 22/22 PR workflows SUCCESS, không tính 0-job historical email push failure.
- Existing Worker release run [40152324267](https://github.com/tamnv2/supra-inventory/actions/runs/40152324267) SUCCESS (health / storage / official Worker gate). Agent signed v141 [40152324299](https://github.com/tamnv2/supra-inventory/actions/runs/40152324299) SUCCESS và GitHub Release `relay-agent-v141` có EXE và SHA256.
- GitHub releases/tags/relay-agent-v141 có `target_commitish: main` vì lệnh tạo release không có `--target`; Git immutable `refs/tags/relay-agent-v141` lại trỏ đúng commit `d73879ed...`. Trường release metadata chứa tên nhánh là bình thường, không chứng minh Git tag sai.
- D173 Android workflow cũ run [40152324251](https://github.com/tamnv2/supra-inventory/actions/runs/40152324251) so sánh chuỗi `main` với `GITHUB_SHA`, luôn false. Đây là lỗi cổng phát hành, không phải APK app lỗi; Android vc118 chưa ký/publish. Không được thay bằng bỏ kiểm tra Agent.

## Phạm vi khắc phục PR #732

- Lấy tag qua GitHub `/git/ref/tags/relay-agent-v141`, bắt buộc `object.type=commit` và SHA 40 hex. Git tag commit phải là ancestor của release HEAD, `relay-agent` tree SHA tại tag phải đúng bằng tree tại HEAD, cùng workflow Agent mới nhất trên HEAD phải `completed/success`. Nếu tag lỗi, nguồn Agent thay đổi hoặc workflow không PASS: chặn OTA.
- Giữ cổng D173-E026 Owner scope, source SHA, original signed release, Worker health, D172 isolation; không sửa `relay-agent/**`, `android/app/**`, Worker business, Firebase/Google, D172 hay Stable. Không có quyền tái ký / đổi D172.
- Chỉ sau PR732 exact CI PASS mới pin lại receipt D173 E026 vào mã nguồn đã test; bảo vệ `main` + release marker; signed Android vc118 phát hành qua cùng signer và OTA; verify tag + SHA256 asset + `inventory-channel` manifest + official host. FIELD / OWNER PASS vẫn phải do thiết bị và Owner xác nhận.
- Workflow Android cũ có thể tiếp tục chạy tới ngưỡng timeout ở điều kiện sai; nó không thể tự được coi PASS. Không sửa lách pipeline cũ hoặc làm giả các dữ liệu release.

Đợt 2 vẫn HOLD tối thiểu ba ngày thực tế có log/usage cùng phiên bản.
