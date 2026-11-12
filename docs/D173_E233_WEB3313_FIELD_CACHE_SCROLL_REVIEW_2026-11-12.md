# D173-E233 — Web 3.3.13 FIELD: tải chậm, hai vùng cuộn và SKU cuối bị che (12/11/2026)

## Báo lỗi Owner
Owner gửi hai ảnh sau phát hành Web 3.3.13, yêu cầu phân tích:
1. Tải danh sách chậm; đặt vấn đề tải một lần rồi lưu cache trên máy để tìm nhanh hơn.
2. Không muốn thanh cuộn dọc của toàn bộ vùng nội dung bên phải; chỉ danh sách SKU được cuộn.
3. Dòng SKU cuối cùng bị che/cắt khi xuống cuối.

Ảnh FIELD là bằng chứng trực quan (không đính kèm vào repo công khai vì có dữ liệu nhân sự/SKU). Trạng thái: **FIELD NOT PASS**, chưa có lệnh phát hành 3.3.14 trong yêu cầu này; **REVIEW ONLY**, không thay đổi runtime/API/Provider.

## Nguồn đã đối chiếu
- Chính thức Web 3.3.13: main `99da97d69490f68818a5a1e49c566a0c5e12141b` (PR957 code merge `69542d49` và PR958 receipt merge), deploy [43227915003](https://github.com/tamnv2/supra-inventory/actions/runs/43227915003) TECH PASS nhưng FIELD/OWNER vẫn chờ, theo `docs/D173_E232_WEB3313_PRODUCTION_RELEASE_RECEIPT_2026-11-12.md`.
- `web/src/operational-app.ts#loadReporterRecentSnapshot`: gọi `getReporterRecent(RECENT_PAGE_SIZE=200, offset,...)` **tuần tự**, đến hết `total`; dedupe theo batch hoặc batch+picker, thử lại một lần nếu tổng số/dòng không đồng nhất. 383 kết quả cần ít nhất 2 trang, nhưng độ trễ mạng/CPU thực tế **chưa đo**.
- `loadOperationsSnapshot` luôn gọi `loadReporterRecentSnapshot` khi vào kết quả; `loadSection` lại gọi `loadOperations` trên mỗi lượt vào tab. `recentRows` chỉ có **một** bộ dữ liệu, cùng khóa `recentLoadedViewKey=recentFilter|recentFrom|recentTo`; **chưa có cache RAM theo nhiều tab+ngày**. Truy cập lại một tab vừa xem vẫn có thể thực hiện toàn bộ API lần nữa. `filterOperationalSkuRows` đã tìm bằng DOM/RAM, không gửi API theo phím sau khi dữ liệu nạp đủ.
- `patchActiveSection()` gán lại `main.innerHTML=mainMarkup()` khi có render/realtime, đồng thời đo `dom_nodes` và `html_chars`. Cần tách latency fetch/parse/render trước khi khẳng định phần nào chiếm thời gian.
- `web/src/legacy-transplant/web-fast-ui.css` đặt desktop `body[data-role=ADMIN] .content` `height:100%` + `overflow-y:auto`. `web/src/legacy-transplant/web-professional-v2.css` ép `.content.main` `padding-bottom:max(72px,...)` và scroll padding; `web/src/d173-tabler.css` đặt `.ops-business-workspace .table-wrap` `max-height:calc(100dvh - 190px)`, bên trong `.ops-route` còn thanh tab và wrapper. **Xác định nguyên nhân code-level hai container scroll độc lập**; bảng tính chiều cao theo toàn viewport, không theo diện tích còn lại. Ảnh FIELD xác nhận scrollbar vùng chính bên phải đồng thời danh sách cũng scroll.
- `renderResults` dùng `visible=recentRows` và `visible.map` toàn bộ khi loaded; không có `slice()` giới hạn cuối bảng. Ảnh cho thấy **cắt hiển thị** ở cạnh dưới, chưa có bằng chứng mất bản ghi cơ sở dữ liệu. Vị trí Footer `.app-footer` có `position:fixed; bottom:5px`, có thể che hàng cuối nếu không có padding đúng container. Không tuyên bố root cause duy nhất trước đo geometry với viewport.
- Canonical E221 chốt **không lưu dữ liệu nghiệp vụ trong localStorage/IndexedDB**, chỉ RAM phiên để tránh lưu trữ nhạy cảm trên thiết bị chung, trong khi bỏ phân trang hiển thị đã được Owner chấp nhận; lệnh mới đề cập cache máy cần phân biệt RAM vs lưu bền vững, không tự bật persistent storage.

## Phương án đề xuất — CHƯA triển khai
**Hiệu năng:** cache **RAM theo (user ID, effective role, day, status/tab, session generation)**, có `complete` + `stream epoch/realtime seq` và invalidation. Tab từng tải đủ → hiển thị ngay từ RAM, chuyển tab không GET lại nếu valid; realtime event cập nhật các dòng liên quan hoặc đánh dấu tab chưa mở dirty. Nếu event gap/reconnect/chuyển quyền/đăng xuất/đổi ngày/cache thiếu → invalidate có giới hạn và tải authoritative. Giữ `total`/dedupe guard và không hiển thị dữ liệu thiếu như đầy đủ. Không phát request theo ký tự. Cache phiên **không tồn tại sau F5** là đánh đổi có chủ ý; persistent IndexedDB/localStorage cần quyết định riêng về security/TTL/permission/retention và chưa được duyệt.

**UI:** tại desktop chỉ scope `main[data-active-section=operations|overdue|results]` và descendant `.ops-business-workspace`, khóa `overflow-y` của **main** trong khi dùng flex/grid `min-height:0`, `overflow:hidden` cho workspace/panel; bảng `.table-wrap` (hoặc `.fast-list` trong tab đang xử lý) `flex:1; min-height:0; overflow-y:auto;` thay vì `max-height:calc(100dvh - 190px)`. Không dùng cùng tính toán cho desktop/mobile; không che toolbar, footer và sticky header. Không sửa CSS global cho dashboard/users.

**Dòng cuối:** xác minh `scrollHeight-clientHeight`, `getBoundingClientRect` hàng cuối, footer/viewport, thanh tab cố định, zoom/DPI và cả theme. Yêu cầu cuộn đến cuối phải thấy đầy đủ cả ô đầu và ô thao tác, không bị mép/OS taskbar hoặc footer che. Không đưa ra kết luận đã mất dữ liệu.

## Tiêu chí PASS
1. Màn hình desktop 1366×768, 1600×900, 1920×1080; Chrome Edge, zoom 100/125/150, light/dark, 5 tab: **chỉ cuộn vùng danh sách**, thanh tab/ngày/tìm SKU đứng yên; không xuất hiện thanh cuộn dọc lớn của vùng chính.
2. Test dữ liệu 0/1/200/201/383/1000 dòng: hàng cuối và header/cột/thao tác đều thấy được; số lượng bản ghi không đổi trước/sau, không che dòng bởi footer.
3. Chuyển tab A→B→A trong một phiên: dùng RAM nếu complete+fresh, **0 API reload khi quay lại A**; nhập SKU tối thiểu 3 chữ số phản hồi local **0 API per key**; tải lần đầu giữ pagination 200, dedupe, session guard và khả năng phát hiện thiếu.
4. Realtime mutate/withdraw/correction, disconnect/reconnect/event gap, day change, logout, root effective-role change: cache không leak giữa quyền/tài khoản, không mất thứ tự, không hiển thị stale như authoritative.
5. Đo trước/sau thời gian Network+parse/DOM paint, GET count, Rows Read/DO Requests cùng cùng dataset, bản ghi; không khẳng định tăng tốc hay giảm usage nếu chưa có số đo.
6. D172 independent regression và scoped Web build/test exact SHA bắt buộc trước PR merge/Owner-gated Production. **CODE/CI/RELEASE/FIELD/OWNER PASS** riêng; D172 PENDING/HOLD và Stable OWNER-GATED.

## Kết luận và ranh giới
Đã xác minh **lỗi hai lớp cuộn từ CSS** và **thiết kế tải lại dữ liệu khi đổi tab**; riêng tỷ trọng thời gian API/DOM và khả năng thiếu dòng thực tế **chưa đo**. Đây là intake/đề xuất, **chưa có quyền lưu dữ liệu nghiệp vụ bền vững lên máy**, chưa phát hành Production mới, không thay Web 3.3.13 đã phát hành.

## Cập nhật Owner và thực thi E234 (sau bản phân tích)
Owner ngày 12/11/2026 ban hành lệnh mới: **“Triển khai cập nhật sửa lỗi.”** Lệnh này **thay thế kết luận review-only** về code/triển khai ở trên, nhưng không cấp quyền lưu persistent business data. Nguồn quyết định mới, cách sửa Web3.3.14, kiểm thử và trạng thái: `docs/D173_E234_WEB3314_OWNER_DEPLOY_2026-11-12.md`; PR #959. Các khẳng định FIELD NOT PASS của Web3.3.13 vẫn có hiệu lực đến khi có FIELD receipt mới.
