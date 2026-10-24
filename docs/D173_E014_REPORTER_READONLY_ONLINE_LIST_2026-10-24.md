# D173-E014 — Hiển thị Reporter online trên Agent, chỉ đọc (Owner 24/10/2026)

**Trạng thái:** Owner bổ sung yêu cầu chức năng, **CHỜ THIẾT KẾ/PHÊ DUYỆT CODE VÀ RELEASE RIÊNG**. Chưa có bản code triển khai Reporter online. Nhánh/PR E014 docs-only kế tiếp E013 code-only; tất cả vẫn D173 OPEN. D172 độc lập PENDING/HOLD, Stable OWNER-GATED.

## Yêu cầu nghiệp vụ nguyên văn theo ý Owner
- Bổ sung **Reporter đang online** vào **danh sách online trong Windows Agent** đang hiển thị Picker.
- Chỉ hiển thị thông tin cơ bản; **Reporter không được nhận tác vụ Kích User, Liên hệ, Gọi về hoặc Kết thúc cuộc gọi** từ danh sách này.
- Không làm thay đổi hành vi/tác vụ của Picker đã có, kể cả liên hệ nhóm và kích toàn bộ **Picker**.
- Reporter offline không được giả là online; không hiển thị tất cả tài khoản có role Reporter nếu chưa có chứng cứ phiên hiện hành.

## Chứng cứ kỹ thuật source hiện có
- `relay-agent/D119AgentFeatures.cs`: `_pickerOnlineGrid`, `_pickerOnlineSnapshot` dùng `PickerPresenceView`; các cột `KickUser`, `CallSpecialist`, `ResolveContact` là nút hành động trong bảng; `UpdatePickerOnlineGrid` còn dùng số lượng Picker để đánh thức đường xử lý PickList. Không được cộng Reporter vào `_activePdaCountForRelay`.
- `relay-agent/FirestorePickerPresence.cs`: nguồn Picker `schema_version=4`, `presence_source=ANDROID_SESSION_AUTHORITY`, lọc `PDA_READY`, không bao hàm role Reporter; chèn Reporter vào bản ghi/projection Picker là sai hợp đồng.
- `relay-agent/D168GroupPickerContact.cs`: chọn recipient từ `_pickerOnlineSnapshot` và từ `row.Tag as PickerPresenceView`, nên phải có kiểm soát type/role cả lúc tạo danh sách và **ngay trước khi gửi**. Bulk revoke `D161AdminControl.cs` là **Picker-only**; phải giữ thế.
- `docs/specs/ROLE_WORKFLOWS.md` xác định liveness Picker bằng session hợp lệ và presence authority; không được đoán online từ thông tin danh bạ.
- Có thể tận dụng hệ thống session/lifecycle hiện hữu để tạo nguồn Reporter, **nhưng source hiện tại chưa chứng minh kênh Reporter live cụ thể có thể đọc hoàn toàn không thêm provider read**; bước code phải kiểm tra trước. Không được ghi trạng thái READY khi chưa có xác nhận.

## Đề xuất thiết kế ít usage nhất

1. **Hiển thị cùng bảng, phân biệt vai trò:** cột `Vai trò` = Picker/Reporter, tối thiểu mã nhân viên, họ tên, vai trò, trạng thái online, phiên bản app nếu đã có; thông tin nhà thầu và kênh Android/Web chỉ khi quyền và dữ liệu hiện hữu cho phép. Không hiển thị UID, token, device ID, email riêng hay nội dung báo hàng.
2. **Mô hình phân biệt kiểu:** `OnlineUserView` có role/source/session state; bảng có loại `REPORTER_READ_ONLY`, mọi cột hành động của Reporter phải rỗng hoặc `—` không thể click. Bộ xử lý nút tác vụ fail-closed theo loại và role; backend Picker command/revoke cũng xác thực quyền + role để không thể điều khiển Reporter bằng cách giả hàng.
3. **Liveness:** chỉ đưa Reporter vào khi có phiên đăng nhập và tín hiệu active được server xác thực trong dữ liệu hiện hữu; login cũ/kick/session thay thế/logout/phần kết nối mất lâu phải đưa khỏi danh sách theo authority. Không dùng nhãn `online` từ danh sách tài khoản chung. Android/Web nếu có cùng người thì hiển thị một mục có kênh phân biệt hoặc thống nhất theo quyết định UX, không tăng phép đếm Picker.
4. **Không tăng tần suất lấy dữ liệu**: tái dùng dòng presence/session sự kiện sẵn có và buffer/snapshot local, không tạo per-Reporter heartbeat/poll, không thêm listener Firebase riêng nếu chưa đánh giá cost và approval. Nếu hiện tại không có signal Reporter đáng tin cậy, fail closed, chờ thiết kế source thay vì tự mở đọc mỗi vài giây.
5. **Tối ưu UX:** tìm kiếm chung theo MNV/họ tên, vẫn giữ vị trí cuộn, lựa chọn Picker hợp lệ trong liên hệ nhóm; nhóm Reporter không vào danh sách nhận. Có phân loại số đếm `Picker: N | Reporter: M`; `N` tiếp tục là số PDA phục vụ Confirm/WMS.

## Contract/acceptance phải đạt trước release Agent >v140

- Đăng nhập 2 Reporter Android/1 Web và 2 Picker; danh sách chỉ có phiên online được xác minh, role hiển thị đúng; logout/relogin/kick từ nơi khác loại mục cũ, không để trùng/stale. Nếu chưa triển khai Web liveness, giữ Web test là **pending** và không quảng cáo hỗ trợ Web.
- Bấm/phím tắt/đổi vùng chọn/nhấp đúp/context menu trên Reporter không tạo lệnh Kick/Contact/Call/Resolve; kiểm thử gọi API giả Reporter trực tiếp bị 403/role rejection.
- Liên hệ nhóm chọn cả Picker và Reporter chỉ gửi cho Picker; Bulk Kick All chỉ tác động Picker; không làm sai `_activePdaCountForRelay` hay transport wake.
- Không làm thay đổi throughput PickList, Firebase ACK/primary, Web Confirm, Reporter app, D172 auth/roles; không tăng network timer/Firestore provider operation ngoài phép đo đã chứng minh và Owner phê duyệt.
- Build Agent v140-derived candidate, role/permission negative-path, offline/reconnect, large roster/scroll test, CI authority/continuity D172 isolation PASS. Signed EXE/OTA sau Owner release gate, FIELD và OWNER PASS tách riêng.

## Quyết định còn cần Owner chốt

- **Đề xuất mặc định:** hiển thị Reporter đang online trên Android và trên Web **nếu cả hai có tín hiệu server-authoritative sẵn có, không phát sinh polling**; mỗi Reporter chỉ một hàng, cột `Kênh` nếu có nhiều phiên.
- Nếu việc xác định Web online đòi truy vấn bổ sung làm tăng usage, báo riêng bằng chứng/tần suất/cost rồi xin duyệt trước, không tự mở rộng.
- E014 hiện **là backlog đã tiếp nhận**, chưa phải bản sửa hoàn thành. Xem các hạng mục khác tại `docs/D173_E013_WEEKLY_USAGE_BACKLOG_AND_TELEMETRY_2026-10-23.md`.
