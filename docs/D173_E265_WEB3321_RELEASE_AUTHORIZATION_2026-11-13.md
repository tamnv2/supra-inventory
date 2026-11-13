# D173-E265 — Owner phê duyệt hoàn thiện và phát hành Web3.3.21 (13/11/2026)

## Mệnh lệnh và cơ sở
Owner: “hoàn thiện code và triển khai phát hành”, nối tiếp yêu cầu D173-E264 đồng nhất khoảng cách/bo viền/tab toàn Web theo 9 ảnh Web3.3.20. **Cho phép hoàn tất code, kiểm thử, merge PR #977 và phát hành Production Web3.3.21 trong đúng phạm vi UI D173**, sau khi đáp ứng exact-source CI, bảo vệ D172 và release gate. Lệnh này không cho phép đổi Worker nghiệp vụ, Auth, database, Agent/Android, Firebase, Stable, tài nguyên mới hay nghiệp vụ D172.

- Production baseline: Web3.3.20, Worker `supra-inventory-beta` tại hostname chính thức `inventory.supra.cc.cd`; release main SHA `a2ef3f4013760a457cc4ede58b084616c08ab029`, deploy run `43422924760` SUCCESS. Main trước PR977: `d61292cf9053ca70c1a35c2a4a7b0ca179ec73a2`.
- PR #977: `fix/d173-e264-web-global-ui-rhythm-20261113` code scope tối thiểu. E264 source-geometry `web/src/d173-tabler.css`: 6px gap, 5px card, 4px panel/control, padding KPI 8×10, 35px tab; không đổi nội dung và luồng cuộn.
- Phát hành Web dùng cùng Worker/Cloudflare hiện hữu để thay static Web assets; Worker service source bất biến và D172 độc lập `PENDING/HOLD`. Chi phí/usage request bổ sung bằng không theo đường đọc/ghi nghiệp vụ; riêng một lần deploy không phải một tác vụ phát sinh request khách hàng.

## Gói phát hành và các gate
- Tăng Web version `3.3.20 → 3.3.21` ở `web/src/web-version.ts`, `web/package.json`. Không tăng Agent/Android.
- CI chuyên biệt: E265 Owner/source assertions, E264 geometry regression, E260/E252/E237/E230/E242 UI, Web typecheck/Vite build, D172 independent regression, repo authority/continuity + D173 E123 code/isolation gate. Các kiểm thử lưu phiên bản Web cũ được điều chỉnh **chỉ tại điểm kiểm tra phiên bản**; các assertions nghiệp vụ giữ nguyên.
- `tools/d173_e265_web3321_release_gate.py` đọc authorization cụ thể `ops/d173-e265-web3321-release-authorization.json`; chỉ cho phép các tệp hiện diện trong PR, chặn source protected, yêu cầu base main exact, pin code+CI SHA, hai-parent protected merge và tên commit `D173-E265_WEB3321_PRODUCTION_RELEASE:`.
- `.github/workflows/deploy-beta.yml` chỉ thêm đúng ba điểm điều hướng marker/gate; giữ thông số Firebase, DO, D166 post-secret bounded retry và smoke health cùng luồng cũ.
- Existing global legacy CI có tests lỗi do giả định lịch sử; không được nói GLOBAL PASS trừ khi thực sự success. Các gate riêng được pin phải PASS; lỗi do thay đổi mới phải sửa trong scope trước merge.

## PASS và rollback
- SOURCE/CODE: exact CI pin và test/bundle PASS. CI/authority/continuity/D172: PASS sau nguồn đã cập nhật. RELEASE: protected merge + deploy-beta run SUCCESS, `GET /health` exact source SHA, schema, bindings, unauth 401, web shell and OAuth RBAC smoke PASS.
- FIELD: test 9 trang đăng nhập thực tế HD/HD+, dark/light, zoom 70–140% và cuộn cuối. **Không xác nhận** FIELD hoặc Owner PASS nếu chưa có bằng chứng thật. Không nhầm CI với nghiệm thu.
- Khi deploy fail, trước hết sửa trong D173-E265 bằng PR/CI/release gate mới và cùng bảo vệ D172; không rollback data/SQLite, không dùng direct main push, không phát hành Stable. D172 vẫn HOLD độc lập.

## Evidence slots
- Owner scope: lời phê duyệt trong lượt hội thoại hiện hành; checkpoint D173-E265.
- SOURCE SHA / CI run IDs / main protected merge SHA / Production Deploy run ID và kỹ thuật readback: ghi sau khi xác minh, không tự suy đoán.
