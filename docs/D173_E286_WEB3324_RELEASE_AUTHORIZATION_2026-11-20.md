# D173-E286 — Owner duyệt đưa Inventory Web UI mẫu lên Production (20/11/2026)

## Lệnh Owner và phạm vi
Owner yêu cầu trực tiếp: “thôi, tiến hành chuyển lên production web thực tế để anh test trực tiếp đi”, thay cho giai đoạn CODE ONLY trước đó. Quyền mới giới hạn **UI/UX của Web Inventory D173** và đóng gói asset Web trên **Worker Production hiện hữu `supra-inventory-beta` đang phục vụ `inventory.supra.cc.cd`**, không tạo hoặc đổi tài nguyên Cloudflare.

- Mẫu: bản Inventory static preview đã duyệt, mã triển khai trên [PR #991](https://github.com/tamnv2/supra-inventory/pull/991), tham khảo PickPack PR#2 theo quyền **chỉ đọc**.
- Phiên bản mục tiêu: Web **3.3.24**. Main base nguyên trạng trước thay đổi: `df7ae65b78005f093862ee944e71a2d757b3c49f`.
- Cho phép chỉnh chỉ Web frontend presentation, CI/authorization/docs/state cần thiết để phát hành. Giữ nguyên Firebase Auth, RBAC, business API, WebSocket, Cloudflare Worker/DO/SQLite nghiệp vụ, Agent, Android, Gateway, các tài nguyên D172 và Stable.
- D172 luôn PENDING/HOLD độc lập. Stable Worker tuyệt đối OWNER-GATED; **không triển khai riêng Stable**.

## Cửa kiểm soát
1. PR#991 phải có bản thay đổi trong allowlist riêng E286; khóa `source_code_sha` và `source_ci_sha`, so sánh đúng base, chặn source drift.
2. Trước phát hành yêu cầu **5 workflow SUCCESS đúng bản source**: E283 Chromium/Web build/D172; E123 Worker/SQLite/API/D172; Repo Authority; Project State/Continuity; D172 business isolation. Global CI có các legacy workflow lỗi lịch sử nên không được gọi full PASS; các lỗi phát sinh thực sự ảnh hưởng Web phải sửa.
3. PR hợp nhất main qua **protected two-parent merge** có marker `D173-E286_WEB3324_PRODUCTION_RELEASE:`. Không push main trực tiếp, không bỏ qua branch protections.
4. Existing `.github/workflows/deploy-beta.yml` gate phải xác nhận E286 worker+web, khác các quyền phiên bản cũ. Sau khi deploy: xác minh source SHA, Web/Worker CI, health/storage/SQLite, API auth routing, D172 và chính URL Production; không in hoặc commit secret.
5. Production **RELEASE TECH PASS** chỉ sau workflow SUCCESS + readback. **FIELD và OWNER PASS là false** cho tới khi Owner kiểm tra các màn hình/role và xác nhận. Có rủi ro UI layout hiển thị khác browser fixtures; giữ khả năng rollback theo quy trình repo.

## Đánh đổi được chấp thuận
Triển khai trực tiếp Production trước FIELD nghiệm thu có thể phát sinh lỗi trình bày/điều khiển cho người đang sử dụng, tuy nhiên Owner chủ động yêu cầu kiểm thử trực tiếp. Vì vậy giới hạn frontend-only, khóa phiên bản, không xóa dữ liệu/đổi dịch vụ API; release phải fail-closed nếu guard hoặc nguồn không đúng. Không coi 22 ảnh synthetic Chromium là UAT.

## Bằng chứng hiện hành tại thời điểm lệnh
- Web 3.3.23 Production technical PASS: E273 workflow 43548451337; FIELD/OWNER pending.
- D173-E285 PR#991 nguồn candidate 3.3.23 đã có 22 screenshot Chromium và scoped CI E283/E123/D172/Authority/State PASS tại e2652e9581baa641d2bcdf034e6e65dc9cd63293.
- E286 Web3.3.24 source pin được ghi trong `ops/d173-e286-web3324-release-authorization.json`; CI và release của Web3.3.24 chưa được xác nhận khi tạo tài liệu.
