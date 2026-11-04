# D173-E140 — PDA ↔ Agent xác nhận PickList: lỗi UNCERTAIN, NOT_FOUND và usage Firestore

**Ngày ghi nhận:** 05/11/2026 (VN) · **Loại:** TECHNICAL_FINDING / đề xuất chưa được duyệt thực thi · **Repo:** `tamnv2/supra-inventory`.

**Mục đích của ID:** Người dùng ở phiên chat mới chỉ cần yêu cầu **"Đọc thông tin D173-E140 trong repo tamnv2/supra-inventory rồi tiếp tục"**. Phải đọc tài liệu này, journal `ops/change-continuity/D173.json`, `ops/project-state.json#d173_e140`, và mã nguồn/CI hiện hành. Tài liệu lưu cả **điều đã chứng minh, điều chưa chứng minh, phân tích mã nguồn, giải pháp và ranh giới triển khai**; không phải xác nhận code đã sửa.

## 1. Vấn đề thực địa do Owner báo

Picker nhập **3–4 số cuối PickList** trên PDA, gửi đến Agent PRIMARY. Một số PickList **thực sự tồn tại trong Supra SFT/SFT 3 và checkbox sẵn sàng** theo quan sát thủ công của Owner, nhưng PDA nhận **"Chưa xác định kết quả"** hoặc **"Không tìm thấy PickList"**. Bấm lại 2–3 lần vẫn lỗi; thao tác trên Agent cũng có thể bị lỗi; phải vào Web WMS thủ công xử lý.

**Phân biệt hai lớp lỗi:**
1. `CONFIRM_IN_PROGRESS_OR_UNCERTAIN` = Agent có thể đã bấm xác nhận WMS nhưng chưa đủ bằng chứng thành công; guard chống xác nhận trùng khóa các thao tác tiếp theo, kể cả Agent thủ công.
2. `NOT_FOUND` = Agent không tìm thấy mã trong **bảng DOM WMS đang nhìn thấy**, không chứng minh mã không tồn tại trên toàn bộ WMS; gây strike nhầm nếu kết quả tìm kiếm chưa phủ hết dữ liệu.

Không khẳng định mọi lỗi Owner gặp đều cùng một PickList hoặc một nguyên nhân: mã đuôi được **redact trong log**, chưa có đối chiếu chính xác mã WMS ở tình huống thủ công.

## 2. Bằng chứng đã đọc ngày 04/11/2026

**Nguồn:** Google Drive Beta logs ngày 04/11 `https://drive.google.com/drive/folders/1wae626wPdIv_1oeJ_41qWCRkhhln3187`; đối chiếu mẫu VPS 03/11 từ `https://drive.google.com/drive/folders/1fwR0_K3iK8dWBLfnVo70RdzZGmbxzOVi`.

Đã khử trùng theo **request ID** trên các đoạn log VPS có giao thoa. Trong **508 lượt trả kết quả** thu được (mẫu log được đọc, **không** khẳng định đủ toàn bộ máy/ca):
- `CONFIRMED`: **451**
- `NOT_FOUND`: **35**
- `CONFIRM_IN_PROGRESS_OR_UNCERTAIN`: **11**
- `CONFIRM_CONFLICT`: **6**
- `AMBIGUOUS_PICKLIST`: **2**
- `WMS_SESSION_REQUIRED`: **3**

Trong 11 UNCERTAIN: **4** lượt có bằng chứng `final_clicked=1` nhưng `NO_FRESH_TERMINAL_SURFACE`; **7** lượt bị confirmation guard chặn (HTTP 409), `mutation_waves=0`. Không tự xem 4 lần click là WMS thành công hay thất bại nếu không có bằng chứng nghiệp vụ.

**Chuỗi lỗi 11:34–11:36 (giờ VN, request ID chỉ ghi prefix đã được log rút gọn):**
- 11:34:47, `81398f2a`: WMS `FOUND`, đúng 1 candidate, checkbox ready; Agent `CONFIRM_STEP=CLICKED`, `final_clicked=1`. Khoảng 5,2 giây sau: `NO_FRESH_TERMINAL_SURFACE`, trả UNCERTAIN 11:34:59.
- 11:35:06, `e1c69099`; 11:35:10, `5b69cf75`; 11:35:19, `62c88c19`: cùng một Picker gửi các request mới; mỗi lần WMS vẫn `FOUND` và `ready=1`, Agent bị guard chặn `CONFIRM_IN_PROGRESS_OR_UNCERTAIN` HTTP 409, **không bấm WMS**.
- 11:35:29, `be9b25a1`: một Picker khác gặp post-final `NO_FRESH_TERMINAL_SURFACE`; 11:36:04, `6ff4b440`: cùng Picker này bị guard chặn.
- 07:25:39 / 07:25:50 / 07:26:08: một Picker khác lặp 3 yêu cầu, cả ba `FOUND`, `ready=1`, guard 409, **zero WMS mutation**.
- 09:25:10, `196cadf1`: một trường hợp `final_clicked=1`, chờ 5,2 giây không thấy kết quả rõ ràng, UNCERTAIN.

**Chuỗi lỗi tìm kiếm 21:28 (giờ VN):**
- 21:28:22, `c3f0b20c`: `NOT_FOUND`, `ui_search_click=1`, chỉ khoảng **11 PickList codes** trong bảng DOM, strike 1.
- 21:28:38, `7dc1a865`: cùng Picker lặp request, vẫn `NOT_FOUND`, strike 2.
- 21:28:46, một Picker khác `6b73b43f`: Agent `FOUND`, thực hiện confirm thành công. Điều này **không** chứng minh WMS đã tìm toàn bộ các PL bị báo NOT_FOUND.
- Không được suy luận rằng các request khác nhau chắc chắn cùng full PickList vì suffix/full code bị che trong log; các chuỗi lặp theo Picker là bằng chứng cần đối chiếu thêm.

**Agent confirm thủ công:** Chưa có log cụ thể `MANUAL_PICKLIST_CONFIRM` của lần Owner gặp lỗi trong các mẫu đã đọc. Khả năng cùng lỗi guard là **đã xác nhận bằng mã nguồn dùng chung guard**, chưa phải bằng chứng log đối chiếu một lần bấm thủ công cụ thể.

## 3. Logic thực tế hiện hành (đối chiếu source tại main SHA `be2902ea9238f41213050978c90593ba67a5f37a`)

- `android/app/src/main/java/cd/cc/supra/inventory/beta/RelayPocClient.kt`: mỗi lần tap `executeProbe` tạo **UUID mới** và tài liệu `relay_poc_jobs` với `status=PENDING` qua Firestore. PDA đợi Agent ACK. Không tái sử dụng kết quả request cũ khi cùng mã đang UNCERTAIN.
- `android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt`: nhận và hiện `CONFIRM_IN_PROGRESS_OR_UNCERTAIN` với lời nhắc không gửi lại, nhưng sau khi có kết quả vẫn có thể gửi yêu cầu mới; bảo vệ `relayRequestInFlight` chỉ ngăn click khi **đang chạy**, không ngăn gửi lại sau ACK UNCERTAIN.
- `relay-agent/FirestoreConfirmationTransport.cs`: Agent PRIMARY nhận `ANDROID_CONFIRM_V1` qua Firestore Listen / fallback query, lập work item, ACK trạng thái nghiệp vụ lại tài liệu.
- `relay-agent/SupraConfirmBrowser.cs` `SearchMany` + `BuildScanScript`: scan `tr,[role=row]` đang visible, tìm các `PL[0-9]+`, rồi `code.endsWith(term)`. Nếu không khớp thì **click nút `Tìm kiếm`** và scan DOM lại; trong nhánh đó code **không điền suffix vào input lọc thực sự của WMS**. Phạm vi chỉ là DOM đã render, có thể thiếu PickList ngoài phân trang/bộ lọc; hiện có ép page size 100 nhưng không bảo đảm toàn bộ dữ liệu trên WMS. Do đó có nguy cơ **false NOT_FOUND**.
- `relay-agent/D160ConfirmPipeline.cs` `D160ClassifyFastSearch`: không có candidate + bảng không rỗng -> `RecordNotFound` và ACK `NOT_FOUND`. Nếu bảng hoàn toàn rỗng mới trả `WMS_DATA_UNAVAILABLE`. Checkbox unavailable thì recovery riêng, có thể trả `CONFIRM_CONFLICT`.
- `relay-agent/FirestorePickerRateLimiter.cs`: 3 NOT_FOUND trong 60 giây -> khóa theo bậc 5/30/60 phút; false miss có thể khóa Picker oan.
- `relay-agent/FirestoreConfirmationGuard.cs`: guard bằng fingerprint SHA-256 của **full PickList code**, Firestore `relay_poc_confirm_guards`; tạo `CLAIMED` bằng PATCH `exists=false`. Khi guard tồn tại, đọc guard, chỉ xem `OriginalJobProvesConfirmed` nếu job gốc `status=ACK` và `lookup_status=CONFIRMED`; không đủ bằng chứng -> `InProgressOrUncertain`. Mục đích ngăn double-confirm WMS là đúng; thiếu quy trình reconciliation để gỡ trạng thái khó giải quyết, retention code 30 ngày không đồng nghĩa tự xóa đã được xác minh.
- `relay-agent/D160ConfirmPipeline.cs` `D160MutateReady`: guard không acquired -> `UNCERTAIN`, HTTP409, 0 click; sau WMS final click nếu không thấy success -> E093 reload/read-only exact same-row, chỉ `ALREADY_CONFIRMED` khi checkbox unavailable + action **"Xác nhận lấy lại hàng"** trên **cùng dòng duy nhất**. Nếu WMS đã thành công mà không hiển thị dấu hiệu này, guard sẽ tiếp tục khóa, đúng về chống trùng nhưng thiếu lối phục hồi giám sát.
- **Nguy cơ cần kiểm thử:** trong `D160MutateReady`, `catch(Exception)` bao quanh `ConfirmManyExact` tự đặt `FinalClicked=true` dù exception có thể xảy ra **trước** final click. Phải phân biệt bằng chứng trước/sau click thay vì đoán. Không tự release guard chỉ dựa vào catch.
- `relay-agent/Program.cs` `SearchManualPicklists` dùng chung DOM search; `ConfirmManualPicklists` dùng chính `_confirmationGuard.TryBegin`, nên guard đang UNCERTAIN chặn cả Agent thủ công. Đường thủ công hiện không có cùng E093 post-click read-only exact reconcile khi `ConfirmExact` trả UNCERTAIN.

**Lưu ý version:** repo phát hành tag `relay-agent-v165`, `beta-vc125`. Việc **từng thiết bị** đã cập nhật phiên bản nào phải kiểm tra telemetry/log riêng; không suy luận tất cả fleet đang dùng release mới nhất.

## 4. Vì sao guard vẫn tiêu tốn usage Firebase

Mỗi lần Picker gửi lại sau một ACK UNCERTAIN có thể tạo:
1. **Firestore Write**: PDA tạo PENDING doc request ID mới;
2. **Firestore Read/listener event/query**: Agent phát hiện công việc;
3. **Firestore guard ops**: kiểm tra claim (conditional PATCH attempted, GET khi conflict, đôi khi read job gốc);
4. **Firestore Write**: Agent ACK UNCERTAIN vào job;
5. Các trường hợp `NOT_FOUND` có thể thêm thao tác rate-limit Read/Write và khóa oan.

Guard chỉ **chống lặp mutation WMS**, **không chống lặp Firestore traffic**. Không có phép đo provider chính xác số read/write billed trên mỗi lần tap; không ghi tiết kiệm giả. Đây là phạm vi Firebase, **khác** mục tiêu Cloudflare DO Requests của phân tích E139.

## 5. Phương án tối ưu cần Owner duyệt khi sang phiên mới

**P0 — Chẩn đoán ít tốn usage:** đặt stage/cause-safe telemetry cho mỗi request (truncated request id, fingerprint guard không chứa full PL, WMS page epoch, tableCount, filterApplied, searchSettled, uniqueMatch, checkbox state, click-stage, reconciliation proof, guard outcome); tận dụng log Agent hiện có, không mở thêm poll, không log tên Picker/ID cá nhân/mã PL/token.

**P1 — Tìm đúng 3–4 số trên WMS:** thao tác bộ lọc tìm kiếm **chính thức trong Web UI WMS**, xác nhận bộ lọc đã áp dụng, hydration/settle, trang dữ liệu và nhiều candidates; scan/đối chiếu full PL đúng một dòng và checkbox trước mutation. Chỉ trả `NOT_FOUND` và tính strike khi phạm vi tìm kiếm đủ tin cậy; không có proof -> `WMS_DATA_UNAVAILABLE`/`LOOKUP_ERROR` hoặc trạng thái chờ an toàn. Không dùng API WMS không được cấp phép hoặc lấy cookie/token.

**P2 — Guard lifecycle + reconciliation:** tách `CLAIMED`, `PRE_FINAL`, `FINAL_CLICK_SENT`, `CONFIRMED`, `UNCERTAIN`, `RECONCILE_REQUIRED` (tên stage là đề xuất, không phải hiện đã code). Release/retry chỉ nếu **chứng minh chưa hề có final click**; sau final click unknown bắt buộc read-only official WMS proof, nếu vẫn mơ hồ phải giữ guard. Thêm workflow Supervisor/Agent xem, đối chiếu, khôi phục guard có kiểm toán; không cho phép "bỏ guard và click lại" thiếu positive proof. Kiểm thử exception pre-final; thống nhất logic manual và PDA.

**P3 — Chặn lặp Firestore ở PDA:** mỗi thao tác đã gửi/ACK UNCERTAIN phải giữ request context và trạng thái cũ thay vì lập PENDING doc mới do người dùng nhấn lại. Do 3–4 số có thể trùng với nhiều full PL, **không dedupe vĩnh viễn theo suffix**; chỉ khóa/tái sử dụng trong đúng request/session hoặc **full PL đã xác minh**, có generation/cursor và đường thoát khi kết quả terminal/reconcile. Giữ kết nối HA, auth revocation, realtime và kết quả ACK.

**Nghiệm thu bắt buộc:** mô phỏng 3 số/4 số trùng, >100 PickList/phân trang, DOM rỗng/chưa hydrate, checkbox ready/disabled, bấm final có/không có success surface, refresh WMS, lỗi/catch trước và sau click, nhiều PDA cùng PL, failover PRIMARY/standby, Agent manual, 12s mutation fence, rate-limiter strike, idempotency; không phát sinh double-confirm, sai ALREADY_CONFIRMED, tăng traffic bất thường, giảm tốc độ hoặc phá E123. Nếu chạm shared Worker/Auth/Rules phải chạy D172 + Báo hàng regression.

## 6. Ranh giới, open evidence, resume checklist

- **Đã xác minh:** PDA→Firestore→Agent→Firestore ACK hoạt động trong các ca lỗi; chính Agent quyết định NOT_FOUND/UNCERTAIN; WMS result click không rõ tạo guard-block cascade; cùng guard chặn manual code path.
- **Chưa xác minh:** chính xác full PL của yêu cầu Owner gặp (đã redact); trạng thái WMS cuối cùng của 4 lần final click UNCERTAIN; root cause WMS missing success UI (mạng/WMS DOM/router tùy case); bản đã cài ở từng Agent/PDA; log của lần bấm Agent thủ công; hiệu quả usage sau fix.
- **Quyết định chưa được Owner phê duyệt:** mọi chỉnh sửa logic, xóa/migrate/giải phóng guard thực tế, phát hành Agent/APK/Worker, thay Firebase Rules.
- **Mốc hiệu lực:** chỉ **ANALYSIS/DOCS saved**. **CODE=NOT_STARTED, CI_FOR_RUNTIME=NOT_RUN, RELEASE=NONE, FIELD=NOT_TESTED, OWNER_PASS=PENDING**. Stable OWNER-GATED. D172 độc lập **PENDING/HOLD**, không tác động nguồn OBPP.
- **Cách tiếp tục:** đọc hồ sơ này + `ops/change-continuity/D173.json` entry `D173-E140` + `ops/project-state.json#d173_e140`, kiểm tra PR nhánh; đọc mã nguồn Production mới nhất và log sự cố mới trước khi đề xuất patch. Làm theo Branch → PR → exact CI/Owner gate khi Owner duyệt. Không mặc định triển khai từ việc lưu kết quả phân tích.

**Lệnh ở phiên mới:** `Đọc thông tin D173-E140 trong repo tamnv2/supra-inventory và tiếp tục xử lý lỗi xác nhận PickList PDA ↔ Agent.`
