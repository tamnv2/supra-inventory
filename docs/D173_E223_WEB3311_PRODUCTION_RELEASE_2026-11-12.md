# D173-E223 — Quyền phát hành Web 3.3.11 (12/11/2026)

Owner xác nhận Web 3.3.11 **chưa triển khai** và yêu cầu xử lý dứt điểm. Đây là lệnh **Production release** mới cho D173-E221, thay thế lệnh giữ code-only trước đó.

- PR #952, base main `da5f6948852777528ced565cf894b35364841ee0`, source pin `1cb83f32da0e8c1d4b3f56528e0d3cbdd17c8db0`.
- Năm source CI đã SUCCESS: Web/Worker + D172 43202503500; Worker/SQL/D172 43202503880; D172 isolation 43202503474; authority 43202503719; state 43202503313.
- Scope: Web 3.3.11 (bỏ phân trang; 1 ngày VN cho 3 tab kết quả; tìm SKU local, giữ realtime) và `service/src/core.ts` chỉ forwarding 3 tham số D173 hiện hữu. Không sửa DB schema, D172, Agent, APK, Firebase, Gateway hoặc Stable.
- Bắt buộc E223 preflight CI trên PR, merge 2-parent với marker `D173-E223_WEB3311_PRODUCTION_RELEASE:`, deploy existing Worker/Web trên `inventory.supra.cc.cd`, exact SHA /health, SQLite và Web shell/auth guards.
- Source CI/RELEASE/FIELD/OWNER PASS phải tách biệt; chưa có bằng chứng FIELD browser có đăng nhập và usage thật. D172 độc lập PENDING/HOLD; Stable OWNER-GATED.

**Checkpoint lúc cấp quyền:** Owner release approved, merge và technical release chưa xác minh.
