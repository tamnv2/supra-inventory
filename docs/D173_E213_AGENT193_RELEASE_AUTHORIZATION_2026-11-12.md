# D173-E213 — Lệnh Owner phát hành Agent193 có bảo vệ, 12/11/2026

## Owner authorization
Owner vừa yêu cầu **"phát hành agent đã sửa lỗi đi"** sau khi được báo bản Agent193 sửa 5 mục ở D173-E212 đã CODE/CI PASS và chưa phát hành. Đây là **lệnh merge và phát hành signed Agent193 vào kênh OTA hiện hữu**, không phải Owner FIELD PASS cho tất cả hạng mục D173.

- Phạm vi: 5 chỉnh sửa WinForms Agent193 đã chốt trong `docs/D173_E212_AGENT193_UI_STABILITY_2026-11-12.md`, cộng sửa lỗi nhất quán `AgentConfig.AgentBuild` (v192→193) để bản phát hành nhận đúng build.
- Accepted main tại lúc mở PR: `d06d1342706a77d8afb9b43b4dd7c02e77694053`; [PR #945](https://github.com/tamnv2/supra-inventory/pull/945), nhánh `fix/d173-e212-agent193-ui-stable-columns-20261112`. Runtime tree pin `5125b4750daf2a2b53f160ed979a2a279b296d18`.
- Production Agent hiện tại: signed `relay-agent-v192`, EXE sha256 `38dbabe22ef470e90dff8fa2012d65115da230fed17d0d637d8fa3000c725675`. Browser Host14 giữ sha256 `f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`.
- Chỉ được tạo `relay-agent-v193` và cập nhật **riêng** Agent EXE, checksum và `agent-latest.json` trên `inventory-channel` khi checks PASS, không đụng Host14, Web, Worker, APK, Firebase, D172, Stable, DB hay provider billing.
- Regressions bắt buộc: mã nguồn UI, OTP/password logout & protected exit, quyền menu, 70/30 + 40/60 + 65/35, cột không flicker, roster toolbar, version 193, D172 độc lập 74 kiểm thử, Windows native x64 build/startup/roster/HA smoke.
- Chính sách phát hành: Owner đã duyệt **merge + signed OTA** khi CI PASS. Không được merge trực tiếp main nếu gate chưa đạt; GitHub protected two-parent merge có commit title prefix `D173-E213_AGENT193_ONLY_RELEASE:`. Gate `tools/d173_e213_agent193_release_gate.py`, workflow `.github/workflows/d173-e213-agent193-release.yml`; phải đối chiếu release tag/EXE/manifest/channel SHA thực tế sau khi workflow kết thúc.
- FIELD/OWNER PASS bản mới: **PENDING** cho đến khi kiểm tra trên máy thật HD/HD+, DPI 100/125/150%, toàn bộ 5 nút, menu 2 hành động được bảo vệ, giám sát realtime, cập nhật và khởi động nền.
- Nếu CI, release hoặc channel mismatch: báo lỗi và xử lý trong phạm vi; tuyệt đối không báo "DONE" khi chưa đạt bằng chứng kỹ thuật. D172 riêng biệt PENDING/HOLD, Stable OWNER-GATED.

## Source/CI/release receipt
E213 đã hoàn tất: [PR945 merged](https://github.com/tamnv2/supra-inventory/pull/945) `4775ace79a072241ae8832d32b4781f6efefb93a`; [source CI #43166575729](https://github.com/tamnv2/supra-inventory/actions/runs/43166575729) PASS 10/10 Agent UI + 74/74 D172 và Windows-native; [signed OTA #43166939885](https://github.com/tamnv2/supra-inventory/actions/runs/43166939885) SUCCESS; tag `relay-agent-v193` và `inventory-channel` cùng EXE SHA-256 `39ae9282bb56acbaee7b14a6e4b5e5748df50df12bd13f9e88ba4d8d6fec42ac`. FIELD/OWNER PASS chưa xác nhận. Xem receipt `docs/D173_E214_AGENT193_SIGNED_OTA_RELEASE_RECEIPT_2026-11-12.md` (docs-only PR948). Không lưu thông tin cá nhân hoặc log thực tế trong repo public.
