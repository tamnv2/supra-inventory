# D173-E239 — Owner duyệt phát hành Web 3.3.15 (12/11/2026)

## Lệnh Owner mới
Owner yêu cầu **“phát hành đi. yêu cầu là chạy code và triển khai done mới hoàn thành.”** Áp dụng riêng ba thay đổi Web D173-E237 đã có trên Draft PR #961: đồng nhất spacing/viền/màu, bỏ tiêu đề trùng mục, ghim tab phụ. Owner cấp quyền **CODE, guarded merge và Production deploy** theo điều kiện CI; không cho phép Stable, D172, nghiệp vụ Cloudflare Worker/DO/SQLite, Agent, APK, Firebase hoặc tạo provider mới.

## Bằng chứng trước release
- Main accepted trước thay đổi: `7d5b1856857483c7696b53a0eda1db4fbc9fad14`.
- Web 3.3.14 Production run `43238438595` attempt 2 SUCCESS, nhưng không đồng nghĩa D173 Owner PASS toàn bộ.
- Source Web3.3.15 khóa tại `c3573285809281a2a77dc5acbc72e71ce43e5ee4` (PR #961).
- Exact-source CI trước lúc có release gate: Web build + E237/E233/E230/E227 regression + D172 isolation run `43257062539` SUCCESS; Repo Authority `43257062268` SUCCESS; Project State `43257062536` SUCCESS.
- UI Design Guard còn ba assertion cũ (Agent D137/D130, Web D063); đã thấy giống bản main/PR trước, không tự sửa ngoài phạm vi. Đây không phải full-suite PASS.

## Quy trình và giới hạn
1. Thêm `ops/d173-e237-web3315-release-authorization.json` với Owner scope, `tools/d173_e237_web3315_release_gate.py`, nhánh release marker `D173-E237_WEB3315_PRODUCTION_RELEASE:` vào `.github/workflows/deploy-beta.yml`.
2. Gate chỉ chấp nhận đúng commit source pin, đúng danh sách thay đổi, không đổi byte Web sau pin, không đụng các đường dẫn D172/Worker/Agent/Android/Firebase, hai parent protected merge từ accepted base đúng, sự kiện push main, và receipt CI exact-source không còn code/workflow drift.
3. CI scoped mới phải PASS Web build, hồi quy Web, D172 isolation, Repo Authority và Project State. Lưu SHA và run IDs vào auth sau khi thành công; rerun sau ghi receipt; PR phải được merge bằng đúng marker, không push main thủ công.
4. Deploy existing Worker/Web trên `inventory.supra.cc.cd`, kiểm tra /health exact merge SHA, SQLite/API/Windows/Android không thay đổi, Web shell/version. Không khẳng định FIELD/OWNER PASS nếu chưa test trình duyệt trực tiếp.

**Trạng thái khi tạo tài liệu:** Owner RELEASE APPROVED nhưng SOURCE CI sau thêm gate còn đang chạy; no deploy until verified.
