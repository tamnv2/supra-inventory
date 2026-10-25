# D173-E027 — Tiếp tục Đợt 1 sau lỗi phát hành Windows (25/10/2026)

## Chứng cứ đã kiểm tra trên GitHub

- PR #729 merge commit `c4b2c92b79f7f49d820e7eef77b5a71d314d2811`, marker `D173-E026_PHASE1_RELEASE:` và SHA nguồn phê duyệt cũ `4435c45c439f71a094a0d8b3f8ad3e210e2fb6c6`.
- **Worker**: run [40149895432](https://github.com/tamnv2/supra-inventory/actions/runs/40149895432) SUCCESS. Đây là pipeline release thành công, FIELD/Owner chưa xác nhận; runtime health/source cần readback cùng SHA.
- **Agent v141**: run [40149895386](https://github.com/tamnv2/supra-inventory/actions/runs/40149895386) FAILED tại `D167 Owner release authorization for agent`: lệnh Python lồng đọc `android/release-notes.json` tiếng Việt bằng cp1252 mặc định của Windows và ném `UnicodeDecodeError`. Chưa build/ký Agent v141.
- **Android vc118**: run [40149895411](https://github.com/tamnv2/supra-inventory/actions/runs/40149895411) FAILED tại chốt `D173 require exact Agent v141 before signed Android vc118`; không có quyền bỏ qua thứ tự Agent trước APK. Signed APK chưa có.
- Hai run `.github/workflows/d173-email-sender-guard.yml` báo failure không có job, cần phân loại kiểm tra riêng; tuyệt đối không suy ra Gmail/Cloudflare sender đã thay đổi do lỗi hiển thị này.

## Phạm vi sửa và cách tiếp tục

- PR [#731](https://github.com/tamnv2/supra-inventory/pull/731) chỉ thay cách đọc các file cấu hình ở `tools/d173_phase1_release_gate.py` thành UTF-8 tường minh, test hồi quy và nhận diện receipt riêng ở ba workflow Worker / Windows Agent / Android để tự chạy lại theo protected main push.
- **Không** sửa `service/src/**`, `relay-agent/**` nghiệp vụ, `android/app/**`, OBPP/D172, Firebase Rules, Google Apps Script, tên Worker, SQLite, Stable, mail, nguồn xác thực hay dữ liệu người dùng.
- Cổng Owner và source SHA vẫn phải kiểm tra thật, không sửa giả version hoặc bỏ skip guard. Các workflow nguồn chạy lại đầy đủ gồm CI tĩnh TypeScript, Android, Windows Agent, D172 regression, authority + continuity.
- Sau `CI PASS` trên head mới: cập nhật receipt E026 đúng SHA nguồn đã kiểm thử (không tự dùng pin 4435c45 cho mã mới), ghim evidence run mới, không đánh dấu FIELD/OWNER PASS; protected merge chỉ dùng marker E026 để 3 workflow nhận đúng phạm vi.
- Nếu Worker mới đã phát hành, xác minh /health source commit mới, storage bindings, official host; sau đó Agent signed v141 `relay-agent-v141`, rồi signed vc118 `beta-vc118` + kênh OTA. Bất cứ khâu nào sai thì dừng khâu sau và sửa ở chính D173. D172 tiếp tục PENDING/HOLD, Stable OWNER-GATED.
- Đợt 2 vẫn HOLD tới ít nhất ba ngày hoạt động có đủ log/usage trên cùng version và cửa sổ thời gian. FIELD pass chờ Owner thao tác trên thiết bị thật.
