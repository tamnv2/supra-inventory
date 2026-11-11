# D173-E188 — Khôi phục phát hành Agent186 OTA (11/11/2026)

## Sự thật đã kiểm chứng
- Owner: "Chưa phát hành agent 186? Xử lí done cho anh." Đây là lệnh xử lý tiếp để hoàn tất phát hành Agent186 đã duyệt, **không** mở phạm vi nghiệp vụ mới.
- Source PR #914 **MERGED** vào main commit `6de3aed4465563a9818652afe03ee1203efd4188`, subject `D173-E188_AGENT186_ONLY_RELEASE:`. Build/logic Agent186 có source PR CI 39 SUCCESS + 15 conditionally SKIPPED + 0 FAIL tại source SHA `61c056edba95597ce76a2fd6978c615958060754`. Pin lưu trong `ops/d173-e188-agent186-release-authorization.json`.
- GitHub Actions `verify-relay-agent.yml` run **43014322209 FAILED trước khi tạo job** (API run_jobs trả `total_count=0`), nên không build hoặc publish. Nguyên nhân cú pháp/dispatch chính xác **CHƯA XÁC MINH**, không tự suy diễn.
- API `GET releases/tags/relay-agent-v186` = **404**; `inventory-channel` `agent-latest.json` và EXE thực tế đang ở v185, SHA256 `87b145e0adb2a820fbe59c6fdc4057430885348d4d3e087c4721172c62eacac2`. Host14 fixed ZIP chính xác `f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`.
- Branch xử lý: `fix/d173-e188-agent186-ota-recovery-20261111` từ main `6de3aed4`, **không push main trực tiếp**.

## Phương án kỹ thuật tối thiểu
1. Tạo workflow release Agent186 phục hồi **riêng**, tách khỏi workflow legacy 4.283 dòng đang không khởi động. Chỉ chạy trên push protected merge vào `main`, chính xác subject `D173-E188_AGENT186_OTA_RECOVERY:`. PR chạy kiểm tra source/gate, không phát hành.
2. Gate `tools/d173_e188_agent186_ota_recovery_gate.py` kiểm `source_sha`, Owner approval, GitHub two-parent merge, accepted main, diff cho phép và xác nhận **không thay đổi một byte** ở `relay-agent/`, Host14, D172, Worker/Web/Android/Firebase/Stable và các nguồn dịch vụ so với source đã CI.
3. Runner Windows x64 build Host14 + Agent186 từ cùng source, smoke offline, tạo checksum. Đối chiếu Host14 existing manifest và asset SHA256, **không upload lại 320MB Host14**.
4. Phát hành chính xác tag `relay-agent-v186`, kiểm tag tree/EXE/SHA rồi cập nhật *chỉ* ba assets Agent của `inventory-channel`; cập nhật manifest sau EXE và checksum. Download lại và đối chiếu bản tag, EXE, manifest, SHA256. Không gọi Provider Cloudflare/Firebase/WMS mới.
5. Release chỉ PASS khi GitHub Release + OTA channel đọc lại đúng `v186`, source và hash; không đồng nhất với FIELD PASS. FIELD kiểm thực tế ba máy vẫn phải thực hiện riêng.

## Điều kiện và tồn đọng
- PR recovery CI gate phải PASS, merge đúng Owner release marker; GitHub Actions thực chạy trên main và phát hành chính xác asset.
- **CODE:** Agent186 source đã merge và đóng băng, recovery chỉ CI/docs/ops.
- **CI / RELEASE:** chờ bằng chứng của workflow recovery; không ghi DONE trước khi thấy tag và OTA SHA.
- **FIELD / OWNER PASS:** false, chưa xác minh WebView2 v186 có hiện hình và 4 lỗi thật sự hết trên cả ba Agent.
- D172 = PENDING/HOLD độc lập; Stable = OWNER-GATED, không thay đổi.
