# D173-E264 — Web3.3.20 FIELD: đồng nhất hình học giao diện toàn Web (CODE ONLY, 13/11/2026)

## Phản hồi Owner và nền đã xác minh
- Owner xác nhận Web3.3.20 đã phát hành ổn, nhưng qua 9 ảnh của 9 trang ghi nhận khoảng cách nội dung, bo viền, card, tab và các mục chưa đồng nhất. Đây là yêu cầu sửa FIELD UI mới trong **D173**, không phải Owner PASS toàn D173 hay lệnh phát hành phiên bản Web mới.
- Production Web3.3.20: protected main `a2ef3f4013760a457cc4ede58b084616c08ab029`, release run `43422924760` SUCCESS; main docs receipt tại thời điểm branch: `d61292cf9053ca70c1a35c2a4a7b0ca179ec73a2`. D172 độc lập PENDING/HOLD.
- Nguồn CSS thực tế: `web/src/operational-app.ts` import các tầng `styles.css`, `legacy-operational.css`, nhiều `legacy-transplant/*.css`, cuối cùng `d173-tabler.css` và `d173-overview.css`. E230 định dạng Operations radius 4–5px/gap 6px trong khi E237 ngoài Operations và Dashboard còn radius 4–7px/gap 6–10px; override có `!important` khác nhau. E260 chỉ thống nhất lề ngoài `4px 6px 24px`, không giải quyết các mức bên trong. Không tự coi `d173-e036-unified-design.css` đã được nạp ở runtime khi import không chứa file đó.

## Quy tắc đã được yêu cầu và phạm vi thực hiện
- Lấy mật độ **Xử lý báo hàng** làm chuẩn đã chốt E237: khoảng cách grid 6px, card radius 5px, khung/bảng/tab bar radius 4px, control radius 4px; thẻ KPI chính padding 8px×10px; tab cao tối thiểu 35px và căn giữa nội dung/badge.
- Áp dụng thống nhất tại lớp `d173-tabler-shell` cho Tổng quan, Xử lý báo hàng, Ca vận hành, Danh mục SKU, Nhân sự, SLA, Nhật ký, Công cụ, Đặt lại hệ thống và các màn/chế độ con sử dụng các class trình bày chung. Không ép mọi loại bảng/card có cùng chiều cao; giữ density và luồng cuộn dành riêng cho trang Ops/Report.
- Chỉ sửa `web/src/d173-tabler.css` và thêm regression/CI; giữ Web release hiện tại 3.3.20 trên Production cho tới Owner deploy gate. Không đụng API, Worker, SQLite, Fire, Agent, Android, D172, bảng nghiệp vụ, dữ liệu, permissions hay lịch realtime.
- Không thay đổi status accent, màu xử lý, border-left cảnh báo, scrollbar, sticky tab, các ngưỡng zoom hoặc DOM nghiệp vụ. Không có request/Rows Read mới.

## Test và giới hạn bằng chứng
- Reproduction: trước sửa không tồn tại lớp geometry authority E264; các selector ở E230/E237/E252 đang có radius/gap khác nhau. Test mới `tests/d173-e264-web-global-ui-rhythm.test.mjs` bắt buộc có tokens và phủ các nhóm UI liên quan, bảo vệ quy tắc cuộn và nguồn nghiệp vụ.
- Scoped CI: test E264 + UI regressions E230/E237/E242/E252/E260, TypeScript/Vite build, D172 isolation/source tests. CI chỉ xác thực source; không được suy ra browser FIELD PASS.
- Owner FIELD cần xác minh cả 9 trang với 1280×720, 1366×768, 1600×900, 1920×1080, sáng/tối, zoom trình duyệt 100/125/150%, cỡ chữ Web 70/100/120/140%; tab, lề, không chồng/che text/button, cuộn hết nội dung. So sánh cùng số liệu, nghiệp vụ, realtime không đổi. Nếu fail, sửa tiếp chính E264.
- CODE: ứng viên source; CI: chờ workflow exact PR head; RELEASE: chưa được phép; FIELD/OWNER PASS: chưa có. Stable OWNER-GATED và D172 HOLD.

## Rủi ro và phương án kiểm soát
- Tác động: baseline D173 Web authenticated presentation; không đổi accepted base D171 và không làm thay đổi backend. Rủi ro là CSS specificity/override và thiếu không gian ở HD/HD+; không dùng selector toàn body, không ép max-height/grid template hoặc ẩn nội dung, kiểm soát bằng test source + field sau release.
- Mọi merge/push main có thể kích hoạt phát hành Web; PR phải giữ mở cho tới lệnh Owner phát hành rõ ràng theo chính xác candidate SHA.

## E264 source CI exact-code (13/11/2026)
- Source HEAD `56d2ce390bb19019f230be8185a765b1959f08a0`: [scoped E264 CI run 43427296326](https://github.com/tamnv2/supra-inventory/actions/runs/43427296326) **SUCCESS**: UI E264/E260/E252/E237/E230/E242 regressions (27/27), Web TypeScript/Vite build, service TypeScript test dependency, D172 source isolation + regression (50/50), code-only no deploy. The initial candidate run 43426925295 failed 4 D172 tests because workflow did not install existing service TypeScript dependency; corrected without altering D172 source.
- Same SHA [Authority Guard 43427296544](https://github.com/tamnv2/supra-inventory/actions/runs/43427296544), [Change Continuity 43427296397](https://github.com/tamnv2/supra-inventory/actions/runs/43427296397), [D173 E123 source SQL/Auth/D172 43427296290](https://github.com/tamnv2/supra-inventory/actions/runs/43427296290): **SUCCESS**.
- Historical repo-wide jobs still **FAIL** at this SHA (including legacy Agent overview assertions, superseded Web version and Tabler collapse assertions); global CI is **NOT PASS**. These checks are not silently changed as they do not test E264 geometry. Scope-limited CI PASS does not mean global validation or FIELD PASS.
- **CODE scoped PASS / CI scoped PASS / RELEASE NO CHANGE (Web3.3.20 live) / FIELD PENDING / OWNER PASS false.** PR977 remains Draft/unmerged, requires separate Owner release order.
