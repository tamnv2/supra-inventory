# D173-E268 — Phát hành Web3.3.22 sửa lỗi khoảng cách FIELD (14/11/2026)

## Phạm vi Owner phê duyệt
Owner gửi 9 ảnh Web3.3.21, báo lỗi không đồng nhất khoảng cách toàn Web; yêu cầu tìm nguyên nhân, sửa code và **triển khai** nếu phạm vi rõ. Lệnh mới cho phép CODE và Production release **Web D173 UI** đúng phạm vi này. Không cho phép thay Worker nghiệp vụ, Auth, DO/SQLite, Firebase, Agent/Android, Gateway, D172 OBPP hoặc Stable.
- Base main mới nhất tại thời điểm sửa: `6f74a954e49da65582946df6bff0b2a29f6e6ab1` (main docs-only E266 sau Web3.3.21 run43430031505 SUCCESS).
- Mã CSS E267 nhánh PR979 đã kiểm thử Chromium RED/GREEN. Source Web3.3.22 gate commit `1e778186e586b0607d8d31c27f550f1057877f88`. Production vẫn Web3.3.21 cho tới khi merge guarded PR.
- Nguyên nhân từ mã và Chromium: E264 chỉ thống nhất grid gap/radius; margin/padding cũ tồn tại; selector E237 specificity cao hơn rule mới, RED đo inset12px thay vì 6px. Sửa scoped tại d173-tabler.css; không thay đổi TS nghiệp vụ.

## DoD và rủi ro
- Dùng chuẩn compact: page inset 4px 6px 24px; khoảng cách khối 6px; panel title 6px, Shift/Users card padding 8px 10px; giữ chiều cao, scroll Ops/Report, trạng thái cảnh báo và các giới hạn zoom.
- Kiểm thử phải gồm source UI regressions, TypeScript/Vite Web build, Chromium computed-style/boundingRect theo 1280/1366/1792/1920, D172 isolation/regression, Repo Authority/Continuity, release gate preflight.
- **Đánh đổi:** tăng độ ưu tiên CSS scoped để khử override cũ có thể tác động HD/HD+/role/font; không được tự coi browser fixture là FIELD PASS. Production phải so sánh 9 trang thật 100/125/150% zoom, sáng/tối và cỡ chữ 70/100/120/140%, kiểm tra không che text/button và cuộn cuối.
- Protected two-parent merge marker `D173-E268_WEB3322_PRODUCTION_RELEASE:`, pin source + CI. Deploy dùng Worker/Web assets hiện hữu, source backend không đổi, exact health/status/SQLite/401/auth smoke và D172 isolation. Không khẳng định tiêu tốn usage được đo hay FIELD/OWNER PASS.
- D172 độc lập PENDING/HOLD, Stable OWNER-GATED.

## Trạng thái tại checkpoint
Owner code+release approved; Web3.3.22 source pin `1e778186e586b0607d8d31c27f550f1057877f88`; scoped CI/pin và Production release **chưa xác minh**. Không phải phát hành đã hoàn tất.
