# D173-E212 — Agent193: bố cục 70/30, thoát chung và cột ổn định (12/11/2026)

## Lệnh Owner và phạm vi
Owner đánh giá Agent192 cơ bản đạt yêu cầu nhưng yêu cầu chỉnh riêng 5 điểm giao diện. **Cho phép chỉnh CODE; không có lệnh phát hành Agent193 Production mới.** D173 Agent WinForms only, từ main `d06d1342706a77d8afb9b43b4dd7c02e77694053`; signed Agent192 giữ nguyên tại `relay-agent-v192`. D172 độc lập PENDING/HOLD; Stable OWNER-GATED.

1. Trong vùng trên, khối Agent+PickList 70%, Tài nguyên Desktop 30%. Giữ vùng trên/danh sách phiên 40/60, khối Agent/PickList 65/35.
2. Khi đăng nhập, thay hai nút Đăng xuất / Tắt Agent bằng một **Thoát Agent**, mở đúng hai lựa chọn **Đăng xuất User Agent** và **Tắt chương trình Agent**. Gọi lại OTP/password guard và protected-exit sẵn có, không thay đổi hậu quả của hai hành động. Khi chưa đăng nhập, giữ lối Tắt Agent sẵn có.
3. **Làm mới phân loại mạng** nằm cùng hàng hành động Agent (cho phép các hàng tiếp theo nếu thực sự không đủ chiều rộng HD/DPI); dòng thông tin mạng để dưới.
4. Thanh lọc phiên ở trái; **Làm mới / Dừng gọi / Liên hệ / Kích tất cả** ở phải, trên cùng một hàng. Nếu vật lý thiếu chiều rộng, cuộn ngang riêng thanh điều khiển, không chồng/cắt nút hay bỏ kiểm soát RBAC.
5. Bảng phiên hoạt động sử dụng ngân sách độ rộng cột theo schema, viewport, DPI; **không đo nội dung live mỗi refresh**. Chỉ tính lại khi chiều rộng/DPI/các cột hiển thị/phông thay đổi; giá trị dài tiếp tục xem qua tooltip chi tiết hiện có.

## Phân tích ảnh hưởng và đánh đổi
- Agent WinForms: `D173E179OverviewNoScroll.cs`, `D119AgentFeatures.cs`, `Program.cs`, version/assembly 193; không sửa handler confirm, network probing, agent identity/HA, remote control, data source.
- Không tăng Fire/Cloudflare usage; thay đổi layout offline trong WinForms, không thêm request/timer.
- Quyền/RBAC và chứng thực trước đăng xuất/tắt phải giữ nguyên; menu chỉ là UI chọn thao tác.
- DPI 100/125/150%, HD/HD+: không thể luôn hiển thị trọn tất cả nút theo một hàng trên chiều rộng vật lý quá hẹp. Cho phép toolbar Agent tự xuống dòng và toolbar roster cuộn ngang có giới hạn, không cắt nội dung.
- Cột không thay đổi vì giá trị realtime mới dài/ngắn; giá trị vượt kích thước đã phân bổ hiện tooltip. Tính lại khi **hình học** thực sự thay đổi.

## Kiểm chứng / gate
- Test nguồn: `tests/d173-e207-agent192-overview-layout.test.mjs` được cập nhật đúng quyết định E212; kiểm chứng 70/30, 40/60, 65/35, menu protected, nút mạng, neo phải và không còn data-driven width.
- CI: `.github/workflows/d173-e212-agent193-code-only.yml`: authority, continuity, Agent UI test, độc lập D172, native Windows x64 build + startup/roster/HA safety smoke.
- **CODE/CI**: PASS tại source SHA `e34664a907b9a3431886566e1a2c3639b507b31b`, [Actions #43163281722](https://github.com/tamnv2/supra-inventory/actions/runs/43163281722), 9/9 UI test, 74/74 D172, guard, Windows x64 Agent193/Host14 native build + startup/roster/HA safety smoke. **RELEASE**: chưa duyệt, chưa phát hành v193; signed Agent192 không thay đổi. **FIELD/OWNER PASS**: chưa kiểm thử/duyệt cho v193.
- Nhánh: `fix/d173-e212-agent193-ui-stable-columns-20261112`; không merge main hoặc publish OTA khi chưa có lệnh riêng và exact release gate.

## Tính liên tục bootstrap
- E212 thay một bản receipt cũ trong `bootstrap_order`, giữ giới hạn tối đa 24 nguồn hiện hành; receipt lịch sử vẫn nằm tại `canonical_sources` để tra cứu khi cần.
