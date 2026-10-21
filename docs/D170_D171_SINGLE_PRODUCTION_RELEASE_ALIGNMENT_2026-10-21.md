# D170 + D171 — Một Production, hai hạng mục CODE ONLY, một bộ phát hành

**Owner quyết định 21/10/2026 — CODE/CI ONLY cho mọi thay đổi mới trong ca.** Đây là chính sách chuẩn cho tất cả các yêu cầu bổ sung liên quan đến D170 và bộ Android vc115 / Agent v140 / Web 3.1.2. Không lấy CI PASS thay cho quyền triển khai. Không merge PR ứng viên vào `main` vì `main` có workflow tự triển khai.

## 1. Mốc Production bất biến trong ca

| Bề mặt | Phiên bản đang phục vụ | Ứng viên tiếp tục phát triển |
|---|---|---|
| Android PDA | Signed **vc114** | **vc115** — chưa phát hành |
| Windows Agent | **v139** | **v140** — chưa phát hành |
| Web | **3.1.1** | **3.1.2** — chưa phát hành |
| Worker/API | Một Worker dữ liệu hiện hữu `supra-inventory-beta` cùng `InventoryCore` SQLite | Cùng Worker, không phân nhánh database |
| URL chính | `https://inventory.supra.cc.cd` | Giữ nguyên một URL công khai |
| OAuth | D170 Phase3B PR657 đã merge, Worker run 39505589708 PASS; Owner xác nhận Google OAuth thành công, đã lưu refresh secret vào Worker | Drive/Gmail thực tế và trạng thái secret sau cập nhật chưa có readback độc lập |

**Không được phép trong ca:** merge vào `main`, deploy Worker/Web/Android/Agent/Gateway/Rules, phát hành APK/EXE, đổi update manifest/minimum-version, cấp quyền môi trường khác, di chuyển/xóa Worker/Durable Object/Firebase, xóa DNS/legacy hostname, reset dữ liệu, hoặc deploy Worker Stable cũ. Các bản cũ tiếp tục hoạt động. Mọi code sửa trên nhánh/PR CODE ONLY, CI chỉ đọc hoặc build ứng viên (không upload làm bản chính thức).

## 2. Một mô hình chính thức, không còn Beta→Stable đối với người dùng

- Mô hình dữ liệu/nghiệp vụ duy nhất chính là **Worker dữ liệu đang chạy** và Firebase/InventoryCore hiện hữu. Không tạo hệ Beta để test rồi chép sang Stable; không tạo database thứ hai, không copy dữ liệu.
- Tên sản phẩm và UI: **SUPRA Inventory**, **1291 Báo hàng**; một đường `inventory.supra.cc.cd`; trang Web/Admin/Reporter/Picker, Agent UI, icon/notification/login/update/download/QR/pháp lý **không có chữ Beta/Stable như tên chế độ hoặc lựa chọn môi trường**.
- Kiểm thử tách khỏi Production bằng branch/PR, CI emulator/mocks và nguồn dữ liệu thử nghiệm cô lập, **không** bằng cách tạo thêm Production. Test không xác nhận thực địa, và mã ứng viên không được tự đưa vào người dùng.
- Không đổi các ID kỹ thuật có ràng buộc với chữ ký/OTA/dữ liệu: Android `cd.cc.supra.inventory.beta`, `beta-vcN` GitHub release tag, Firebase project, `APP_ENV=beta`, tên Worker `supra-inventory-beta`, GitHub Environment `beta`, legacy routing nội bộ, historical guard. Đây là khóa tương thích, không phải hai chế độ người dùng.
- Worker `supra-inventory-stable` cũ **OWNER-GATED**, không đồng nhất với Worker đang chạy và tuyệt đối không sử dụng để triển khai thay thế. `inventory-beta.supra.cc.cd` chỉ giữ tương thích OTA/cài đặt cũ, không quảng bá cho người dùng; chỉ tháo sau chứng cứ toàn bộ fleet đã chuyển và Owner duyệt riêng.

## 3. Hai workstream phải dùng cùng contract và cùng candidate

**D170:** hoàn thiện loại bỏ các nhãn/lựa chọn Beta–Stable ở bề mặt người dùng và bỏ quy trình promote/copy data trong thiết kế/phát hành tương lai; bảo toàn định danh kỹ thuật, OAuth official callback và mọi guard; cập nhật spec/release documents tương ứng.

**D171:** liên tục bổ sung/sửa lỗi App vc115, Agent v140, Web 3.1.2 trong **cùng PR #656 Draft CODE ONLY**; mọi thay đổi ảnh hưởng Agent/PDA/Web/Worker phải kèm test tương thích, decision/spec/state/continuity. D171 giữ Firestore requestId, 20/35s PDA ACK, generation-CAS, một WMS PRIMARY executor, cùng đường Office/Internet đã được chốt, cùng phiên bản API/endpoint, log 13:15/21:15 VN và Drive receipt trước khi xóa log. Không được ghi đè cơ chế OAuth same-origin/state-csrf đã phát hành tại D170.

**Ràng buộc mã nguồn:** PR656 vẫn ở base cũ; đã đồng bộ chính xác kiểm tra callback-origin từ `main` vào `service/src/index.ts` để ngăn xóa lớp bảo vệ khi tích hợp. **Chưa được kết luận hoàn tất rebase/toàn bộ xung đột** giữa PR656 và `main` sau D170. Trước CODE DONE phải có compare/rebase có kiểm soát trên nền mới, nhất là `service/src/index.ts`, D170 receipt, OAuth, CI/release guards, project-scope, state, nhật ký và các tests.

## 4. Mốc DONE CODE và RELEASE khác nhau

**DONE CODE (không cần Owner hết ca):** tính năng D170 + D171 và yêu cầu tiếp theo đã được implement, review xung đột, đối chiếu code/main mới, Android build, Windows compile, Web build, service typecheck, OAuth/one-Worker identity, RBAC, log, Office transport, ACK/HA/rollback, CI authority/continuity + product PASS **trên exact head**. Được build APK/EXE làm artifact kiểm tra cách ly, tuyệt đối không ký/phát hành vào kênh OTA Production.

**RELEASE (chỉ sau Owner ra lệnh triển khai mới, sau ca):** đánh giá tác động/budget/Drive/Gmail/Office, chốt exact SHA/versions/manifest, backup không ghi đè dữ liệu nghiệp vụ, quyền phát hành main rõ từng component, canary Agent dự phòng → VPS PRIMARY → Android signed vc115 → Web 3.1.2 cùng Worker, xác nhận mixed-version (v139↔vc115; v140↔vc114; v140↔vc115), WMS ACK, log, Google Drive/Gmail, rollback. Các bước canary có thể tuần tự về thời gian nhưng phải cùng **một kiến trúc và bộ nguồn phiên bản**; không có Beta→Stable promotion. Nếu bất kỳ bước FAIL, giữ hoặc quay về bộ 114/139/3.1.1 mà không reset SQLite/Firestore.

**Trạng thái xác minh:** D170 OAuth người dùng thấy thành công và Owner đã cập nhật refresh secret, nhưng Drive/Gmail và installed fleet FIELD PASS chưa đủ. Source CI không chứng minh runtime Office/WMS hoặc chi phí quota; không tự suy ra D170/D171 Owner PASS. Accepted base D169 không tự tăng. 

## 5. Quy tắc khi có lệnh mới trong ca

1. Cập nhật nhánh CODE ONLY và cùng lúc decision/spec/state/owner-actions/continuity đúng change set.
2. Kiểm thử/đọc CI thực tế; không dùng result commit cũ để kết luận head mới.
3. Không tự merge/deploy, dù tất cả job xanh. Chỉ báo **CODE DONE / CODE PENDING** và nội dung còn chặn.
4. Khi Owner chốt `triển khai cập nhật` sau ca, kiểm tra lại source/main/CI/quyền rồi mới xây dựng release receipt cho chính xác phạm vi; không tái dùng quyền D170 OAuth Worker đã cấp một lần.

## 6. D171-E049 — CODE ONLY repair after Cloudflare A–D source staging

- D171 test `tests/d171-single-production-freeze.test.mjs` validates the historical E046 Owner gate by ID rather than incorrectly requiring it to be the latest checkpoint.
- Removed the remaining user-visible `Stable` in the Web system-reset explanatory text. Preserve internal `stable_download_path` API fields and old signed tags; do not blindly rename identifiers.
- Staged Google Apps Script Gateway source points all its existing Worker business URLs at `https://inventory.supra.cc.cd` (same authoritative Worker), not the legacy hostname; **not deployed**. The old hostname must remain reachable for old App/Agent updater clients.
- D171 PR-only safety CI now includes `service/src/**` and a strict Worker TypeScript typecheck for A/B/C/D, plus the original HA/ACK/log/release tests. The D170 compatibility CI retains both the v115/v140/Web3.1.2 parity test and the deployed OAuth-origin tests once the mainline Phase3B protected receipt is reconciled. No CI outcome is claimed without an exact-head run.
- Main D170 Phase3B source/receipt and PR #656 still diverge. Do not modify the protected Worker deployment receipt, Worker config, Stable resources or any Provider live setting on this PR. Before CODE DONE reconcile the protected main baseline, run exact-head CI and review all Client/OAuth/FCM/realtime/usage regressions.
- Production remains Android vc114, Agent v139, Web 3.1.1. Neither source commits nor test artifacts permit main merge/OTA/Web/Worker/Gateway deployment in the shift.


## 7. D171-E052 — One-Production public PDA filename without breaking installed OTA (CODE ONLY)

Audit of the D170 user-visible Beta-removal requirement found a residual filename exposure: the Web's `/downloads/pda/latest` path redirects to GitHub channel asset `supra-inventory-beta.apk`. Its name can be seen by a normal operator saving the APK even though the Web card no longer displays Beta.

Proposed/staged fix on the same Draft PR: publish the same signed APK bytes under a second public asset `1291-Bao-Hang.apk` in the **existing** `inventory-channel` release; add a lightweight redirect route `/downloads/pda/public` and use it for Web 3.1.2 QR, download button and copy link. The original `supra-inventory-beta.apk`, `beta-vc` tag, signer, `/downloads/pda/latest`, checksum and machine-readable manifest channel remain exactly in place for installed vc114/vc115 OTA compatibility. The public friendly asset is verified byte-identical using `cmp` in the signed-release publication workflow. No separate Worker/DO/database/provider, no Worker-side APK proxy/bandwidth, no migrated security identity or new release service.

**Release order precondition:** The new signed public alias must exist and be verified before enabling Web 3.1.2 QR/button/copy links; do not publish Web early. The legacy updater path must stay reachable throughout the mixed fleet. PR CODE ONLY CI can check source contract/build but cannot prove a GitHub release asset was actually published; verify during separately authorized post-shift staged rollout. Until then live vc114/Agent139/Web3.1.1 are untouched.

## 8. D171-E054 — Owner duyệt P0 và E/H, vẫn một bộ phát hành CODE ONLY

Owner 21/10/2026 duyệt bổ sung: Agent v140 lấy tuổi PickList theo Firestore-created timestamp, Android vc115 cách ly kết quả `RECEIVED` có lỗi 404 vĩnh viễn theo user, E giảm retry vô ích và H gộp các lượt đọc counters đồng thời trên Web 3.1.2. Bộ tối ưu DO A–D giữ nguyên; F (WebSocket ACK) và G (D1 projection) không nằm trong release này.

D170 không mở rộng tài nguyên, vẫn một Worker/InventoryCore và Google OAuth/domain/OTA nhất quán. Mọi thay đổi ở PR #656 Draft; chưa được merge/triển khai. Đánh giá CI và log thực địa trước khi Owner ra lệnh phát hành riêng, và rollback nguyên vẹn về vc114/v139/Web3.1.1 nếu canary không đạt.
