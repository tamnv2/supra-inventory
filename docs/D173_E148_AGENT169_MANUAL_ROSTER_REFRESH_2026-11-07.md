# D173-E148 — Nút Làm mới dữ liệu, Agent169 (07/11/2026)

## Lệnh Owner
Owner yêu cầu bổ sung nút **Làm mới dữ liệu** ở **ngay trước nút Kết thúc gọi 60s** trên **cùng hàng** trong danh sách phiên hoạt động; bấm nút phải đọc dữ liệu thật **ngay**, không chờ nhịp 5/10/15 phút. Sau khi cập nhật phải kiểm thử và triển khai phát hành. Đây là phần mở rộng trong **D173 / Agent169 / PR #853**, không phải D172 độc lập, không đổi APK hay Web, không tự cho phép phát hành Stable.

## Nghiệp vụ
- Nút chỉ dùng khi đã đăng nhập Agent. Nằm trong thanh công cụ cuộn ngang `D173RosterToolbar`, sau các nút lọc và cột kỹ thuật, trước Kết thúc gọi 60s / Liên hệ nhóm / Kích toàn bộ user. Bố cục co giãn và các quyền riêng của những nút cũ được bảo toàn.
- Khi nhấn, chạy **một lượt đọc có chủ đích** không chờ chu kỳ: (1) `agent_sync` hiện có: danh sách phiên tổng hợp, khóa/gọi, counters và trạng thái đồng bộ; (2) `picker_presence_projection/current`: phiên Android Picker có căn cứ LOGIN/LOGOUT; (3) Worker `/api/agent/d173/reporter-online`: Web và PDA Reporter theo authority phiên đăng nhập hiện có; (4) `relay_poc_agents` heartbeat + role coordination: danh sách Agent và PRIMARY/NEXT_A/NEXT_B/hibernated.
- Dữ liệu được áp dụng theo thứ tự `agent_sync` trước, sau đó Picker LOGIN/LOGOUT trực tiếp và Agent fleet đọc mới được ưu tiên. Picker manual-read giữ tombstone chống hồi sinh phiên cũ nhưng **không re-publish Firestore agent_sync chỉ vì yêu cầu này**. Không chuyển PRIMARY, sửa WMS/PickList, đóng phiên hay ép logout.
- Nút bị khóa khi truy vấn đang chạy, đồng thời chặn bấm lặp trong **10 giây** kể từ lượt trước. Không mở timer/poll/service mới, không hủy lịch chạy tự động. Sau khi xong, hiển thị **4/4 nguồn** khi đủ hoặc **N/4, có lỗi** khi thiếu; nếu nguồn Web/Reporter lỗi thì không tiếp tục trình bày danh sách cũ như online.
- Dữ liệu của một phiên đăng nhập cũ bị loại bỏ khi logout/relogin trong lúc đang tải; lỗi riêng từng nguồn không che lỗi nguồn khác. Log chỉ có trạng thái/đếm/loại lỗi, không chứa token, ID cá nhân hoặc thông tin nhạy cảm.
- Mỗi thao tác thủ công sẽ tiêu thụ **một số lần đọc Firestore/Worker thực tế**; không thể tuyên bố không phát sinh usage. Không thay đổi polling thông thường; không tự động tải lặp ngoài thao tác người dùng.

## Code và hồi quy
- `relay-agent/D119AgentFeatures.cs`: thứ tự toolbar, responsive layout, hiển thị theo quyền đăng nhập và direct Picker read-only.
- `relay-agent/D173E148ManualRosterRefresh.cs`: điều phối một lượt làm mới bốn nguồn.
- `relay-agent/FirestoreAgentLeaderCoordinator.cs`: truy vấn read-only role/heartbeat của Agent, không đổi HA election/lease.
- `tests/d173-e148-manual-roster-refresh.test.mjs`: thứ tự nút, 4 nguồn thực, bỏ 5/10m throttle, đúng quyền, chống stale session, không phát tán write; native build/WinForms UI smoke, E143/E146 và D172 business isolation bắt buộc.
- Không đổi APK, Web, Firebase Rules, Worker endpoints khác, tài nguyên mới hoặc D172 OBPP. E146 còn nguồn Worker cutoff; release Worker và Agent169 phải dựa trên source-pin và CI riêng; D172 độc lập PENDING/HOLD.
- Trạng thái tại checkpoint: **CODE candidate** trong PR #853, CI/RELEASE/FIELD/OWNER chưa được xác nhận. Không ghi nhận DONE trước khi có bằng chứng chính xác.

## Nghiệm thu CI mã nguồn (07/11/2026)
- PR #853, SHA chính xác: `4f744e78f938832a625812d2f2b464033efc987d`.
- GitHub Actions: **42 SUCCESS, 2 SKIPPED, 0 FAILURE**; toàn bộ 44 workflow đã hoàn thành.
- Native Windows Agent/Host12 và nguồn E146/E148: run **42320994585** SUCCESS (native + source-contract).
- Worker/D172: runs **42320994898**, **42320994771**, **42320994876** SUCCESS; Repo Authority **42320994837** và Project State **42320994854** SUCCESS.
- Không có bằng chứng phát hành tại bước này. Worker/Agent169 OTA **PENDING**; FIELD/OWNER **PENDING**, D172 độc lập **HOLD**, Stable **OWNER-GATED**.
