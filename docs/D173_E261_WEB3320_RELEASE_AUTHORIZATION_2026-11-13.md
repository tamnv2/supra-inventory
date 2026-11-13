# D173-E261 — Owner chốt hoàn thiện E260 và phát hành Web 3.3.20 (13/11/2026)

## Lệnh hiện hành và phiên bản
Owner: "Tiếp tục hoàn thiện done code và phát hành". Áp dụng đúng năm yêu cầu UI của D173-E260 cho Web3.3.20 (thay Web3.3.19), qua PR #974 cùng source/CI/merge có kiểm soát. Lệnh này cho phép code, sửa lỗi CI trong phạm vi đã chốt và phát hành Production Web tại hostname hiện hữu; **không phải xác nhận FIELD/OWNER PASS**. Main baseline tại lúc mở E260: `c4e6dca074cf0a73369c659a4e90e83f929b119f`.

## Phạm vi/ảnh hưởng và đánh đổi
- **Giao diện:** Header nằm trong hàng grid đã đo, không dùng sticky lặp; tab Quá hạn căn nội dung theo trục dọc; bỏ các dòng Owner không cần; thời điểm cập nhật nằm cùng hàng tab Tổng quan, căn phải; A+/A− điều chỉnh chiều cao layout theo tỷ lệ zoom; 4px trên / 6px trái thống nhất trên desktop.
- **Version:** Web/package 3.3.20; kiểm thử source hiện hành giữ 3.3.20, lịch sử E258 kiểm tra authorization 3.3.19 được giữ nguyên.
- **Worker/DB:** Build lại Web và đóng gói trên Worker Production đang đăng ký; không thay đổi một dòng `service/`, D172, schema, SQL, API, dữ liệu, Firebase, Agent/Android, Gateway, URL hay quota cadence. Kênh Stable riêng không đổi.
- **Rủi ro:** CSS `zoom`/viewport tại độ phân giải thấp vẫn cần kiểm tra Chromium thật; không gọi FIELD PASS trước khi xem thực tế. Global UI Design Guard có 8 bất biến lịch sử không tương thích với `main`/Agent không thuộc E260. Không sửa vòng ngoài để làm xanh giả; release dựa vào source-pinned scoped CI, Web/Worker TypeScript, D172/authority/isolation và gate bảo vệ riêng. Global CI không được gọi PASS.

## Release gate
- Bảo vệ nguồn: `tools/d173_e261_web3320_release_gate.py`, authorization `ops/d173-e261-web3320-release-authorization.json`; marker **`D173-E261_WEB3320_PRODUCTION_RELEASE:`**.
- `.github/workflows/deploy-beta.yml` cho phép duy nhất marker này sau exact two-parent protected PR merge và source CI pin. D146 giữ lịch sử 10 slot log Web, không dùng lịch cũ; gateway/D172 bất biến.
- Bắt buộc: E261/E260 UI tests + Web build + service typecheck + D172 regression/isolation + project authority + continuity + RBAC/safety nếu có yêu cầu liên quan; exact source tree/pin; protected merge only.
- Kiểm chứng sau deploy: GitHub Actions Deploy Beta Worker và official `/health` (HTTP200; `source_commit` bằng merge SHA; schema17/17, operational7/7, zero missing bindings), Web shell version 3.3.20, endpoint admin 401/403 khi chưa xác thực, không ảnh hưởng D172.
- FIELD: Web đã đăng nhập với màn hình HD/HD+, các mức A± 70/100/120/140%, browser zoom100/125/150%, theme sáng/tối, header/tab/scroll cuối của mọi mục. **FIELD và OWNER PASS chỉ sau xác nhận thực tế.**

## Trạng thái checkpoint
CODE/CI/RELEASE phải cập nhật bằng receipt chính xác sau kiểm thử; tài liệu này không tự chứng minh đã phát hành. D172 PENDING/HOLD độc lập; Stable OWNER-GATED.
