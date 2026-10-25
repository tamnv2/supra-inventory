# D172-E052 — CI hồi quy độc lập với release pin (25/10/2026)
Owner phê duyệt ngoại lệ hẹp chỉ sửa workflow `.github/workflows/d172-obpp1291-backend.yml`.

- Giữ đủ kiểm thử TypeScript, đăng nhập/session, bảo vệ RBAC, Sheet A:K/A:E/A:G, SQLite/Core, chống trùng và dữ liệu riêng D172 mỗi khi Worker chung D173 thay đổi.
- Không dùng SHA E048 của lần phát hành D172 đã qua để đánh giá PR D173; CI chỉ kiểm tra source/contract, không cấp phép Worker/APK deploy.
- Bảo toàn `tools/d172_release_gate.py` và các workflow thực hiện release `tools/d167_release_gate.py` và `release-obpp1291.yml`; không sửa receipt D172 hay signing.
- D172 vẫn PENDING/HOLD, không sửa logic nghiệp vụ/Sheet/OTA, FIELD/OWNER PASS=false. Production release D173 dùng gate và nguồn Owner duyệt riêng.
- Cần PR, authority/continuity PASS, test CI D172, sau merge đối chiếu PR D173 đang mở với nguồn main mới. Không tự phát hành bằng docs-only PR này.

Nguồn: Owner phê duyệt 25/10/2026; CI D172 backend E048 ghim cũ chạy trên D173 PR729 thất bại, nhưng kiểm thử D172 độc lập đã PASS.
