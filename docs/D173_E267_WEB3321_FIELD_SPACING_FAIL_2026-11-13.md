# D173-E267 — Web3.3.21 FIELD FAIL: khoảng cách giữa các trang không đồng nhất (13/11/2026)

## Owner FIELD, ảnh và phạm vi
- Owner phản hồi rõ: **“3.3.21 đâu có đồng nhất giao diện khoảng cách đâu?”**, kèm 4 ảnh chụp thực tế lúc 20:24 ngày 13/11/2026: Xử lý báo hàng, Ca vận hành, Tổng quan & báo cáo, Nhân sự & tài khoản. Đây là **FIELD FAIL đối với yêu cầu đồng nhất khoảng cách**, không được ghi OWNER PASS dù release kỹ thuật Web3.3.21 #43430031505 SUCCESS.
- Tập trung sửa đúng spacing / padding ở D173 Web; giữ nguyên kết quả xử lý, dữ liệu, RBAC, API, realtime, biểu đồ và cấu trúc cuộn riêng của Operations/Report. Không chạm D172, Worker service, Agent, Android, Fire, hạ tầng hoặc Stable.
- Lệnh Owner E265 chỉ cho phép phát hành **Web3.3.21 exact SHA** đã thực hiện. E267 **CODE ONLY**, không tự đổi version, merge hay deploy bản mới khi chưa có lệnh Owner tiếp theo.

## Nguyên nhân đã xác minh trong main Web3.3.21
- `web/src/legacy-transplant/web-unified-ui.css` giữ `.business-page-head` `min-height:42px;margin-bottom:14px!important` và `.ops-panel-title` `margin-bottom:12px!important`; lớp E264 chỉ đổi gap và radius cho một số nhóm selector, không sửa những margin này.
- `d167-web-ux-recovery.css`: `.users-mode-tabs` margin-bottom 12px, `.users-top-grid` margin-bottom 10px (!important); `d167-web-compact-accounts.css`: `.shift-history-panel` margin-top 12px / padding 14×16px. Chúng cộng dồn với gap.
- `renderShiftOperations()` đặt `gap:14px` trực tiếp cho 2 thẻ nghỉ; `renderD167MealStatusCard` sử dụng `gap:12px; margin-top:14px` trong form. E264 không xử lý form/heading/panel nội bộ.
- `body[data-role="ADMIN"] .content` và `.content.main` từ `web-unified-ui.css` có padding mặc định `20px 24px 48px!important`; selector desktop E260 `.d173-tabler-shell > .d173-page-content` không chắc thắng theo specificity khi có role; sửa selector rooted `body .d173-tabler-shell > .d173-page-content` để áp dụng cùng inset 4px×6px trên desktop.
- Mấu chốt: **CI E264 chỉ xác nhận selector/tokens và build**, chưa có kiểm tra geometry thực tế trong browser. Kết luận hoàn tất UI toàn Web từ các test đó là không có căn cứ.

## Sửa mã tối thiểu
- `web/src/d173-tabler.css` sau E264: xác lập inset desktop có specificity đủ thắng; chuẩn hóa chiều dọc các root `ops-route` của SKU, Users, Shift/Tools, SLA, Logs, Reset, System, Account bằng *flex column gap 6px* và xóa margin các child cấp đầu để không cộng dồn 6 + 10/12/14px. Giảm khoảng thừa heading, panel title, thẻ nghỉ, button form và panel padding tại Users & Shift.
- Không đổi root `.ops-business-workspace`, `.report-workspace` hoặc `overflow`/height của các danh sách cuộn cố định. Layout Reports/Overview giữ gap6px đã có từ E264; E267 xử lý chính các routes chưa được normalize.
- Không sửa TypeScript nghiệp vụ hoặc các file CSS legacy lưu lịch sử; không tăng version trong PR code-only.

## DoD/Gate
1. Test RED/Green `tests/d173-e267-web-field-spacing.test.mjs`: kiểm tra thật các giá trị legacy gây FIELD FAIL, selector mới cover routes, margin/padding mới áp dụng và business source không đổi.
2. Bổ sung `tests/d173-e267-browser-geometry.test.mjs` chạy Chromium, nạp cùng thứ tự CSS import của `operational-app.ts`, dựng DOM representative theo chính các class production. Đo `getComputedStyle` + `getBoundingClientRect` ở 1280/1366/1792/1920px: page inset6px, khoảng cách stack6px, panel padding8×10, form gap/margin6px; không tràn ngang.
3. Web TypeScript/Vite build + E230/E237/E242/E252/E260/E264 regression + D172 isolation và source regression + Authority/Continuity gate.
4. Chromium fixture **không thay thế** FIELD authenticated 9 trang thật, dark/light, font/zoom, HD/HD+ và dữ liệu thực. FIELD/OWNER PASS vẫn FALSE tới khi có xác nhận độc lập.
5. Chỉ phát hành version mới nếu Owner phê duyệt cụ thể và qua exact-source guarded release; chưa có lệnh đó trong lượt này.

Trạng thái lúc tạo: **Web3.3.21 Production đang chạy, FIELD UI FAIL, E267 SOURCE CANDIDATE / CI PENDING / NO RELEASE**, D172 PENDING/HOLD.
