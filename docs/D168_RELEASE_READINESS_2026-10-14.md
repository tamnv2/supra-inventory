# D168 — kiểm tra tiến độ và chặn phát hành chưa đủ điều kiện (2026-10-14)

## Căn cứ trực tiếp

- Accepted base: **D167 Owner PASS giới hạn Beta đã triển khai**, `main`.
- Working change: **D168**, Draft PR **#591**. Head đã kiểm tra trước sửa: `e22dcf96f87b721eaf31bc2e0294e17b3ff2adfb`.
- Trước sửa, PR HEAD có các workflow PR Authority, Continuity, Web/Service, Agent, Android và SKU source-contract kết luận `success`. Đây là **SOURCE CI**, không phải phát hành: job Agent `Publish dedicated Agent prerelease` và Android `Publish signed Beta auto-update release` đều `skipped`.
- Owner đã duyệt phạm vi D168-E018: **chạy code + kiểm thử + triển khai Beta khi đủ gate**, không có Stable; lưu tại `docs/D168_OWNER_APPROVAL_2026-10-14.md` và continuity E018.
- Kiểm tra code cho thấy `D168NetworkRoute.cs` mới có `ApprovedProfile`, `ConnectSavedProfile`, `ProbeWorker`, nhưng **không có nơi gọi các hàm này từ điều phối SKU hay giao diện Agent**. `D167SkuServiceClient.Send` đã bỏ Google Apps Script, sử dụng **Worker trực tiếp**. Khi Office không tới Worker, scheduler không đọc được `schedule` và không `reserve` được; FULL 05h không thể được bảo đảm trên Office. Worker capability probe chưa phải đường chuyển mạng thực tế.

## Tình trạng từng yêu cầu — không suy từ source ra FIELD PASS

| D168 | Chứng cứ source trên PR #591 | Thiếu trước khi phát hành |
| --- | --- | --- |
| REQ-001 sao chép SKU | Picker/Reporter Kotlin có handler clipboard | Kiểm đủ mọi trạng thái trên thiết bị |
| REQ-002 tên và giờ người xử lý | Các overlay/notification và API provenance đã bổ sung | Đúng actor, giờ VN, kết quả sửa và đường ACK |
| REQ-003 phiên bản App Picker | Android -> Firestore projection -> Agent grid có trường `app_version` | Đối chiếu bản cài thực tế trên PDA/đường login |
| REQ-004 Picker online | Có tombstone, session generation, delta/shared projection | Logout/kick song song, stale resurrection, định mức reads |
| REQ-005 tab SKU/shared job | Các sửa ở `D167SkuUi`, Agent sync | Chứng minh mọi máy nhận trạng thái FULL/DELTA bền vững, không thêm hot writes |
| REQ-006 tự khởi động | `UserStartupRegistration` + checkbox cài đặt | Startup thật với user chuẩn, tắt không đăng ký lại |
| REQ-007 liên hệ nhóm | `D168GroupPickerContact` per-Picker gửi qua Firestore | Gửi nhiều/all, chặn tài khoản logout/kick, giới hạn số lượng/quota/ACK |
| REQ-008 upload log | `AgentLogUploadBridge` đã có điều chỉnh | Drive receipt, timeout/retry, giữ bundle chờ |
| REQ-009 SKU 19h | Coordinator thay cooldown 15 phút theo ngày/slot | Không lặp storm sau WMS-ready/HA, durable DONE |
| REQ-010 Office/Internet | Helper chuyển WLAN + endpoint capability đã thêm | **P0: helper chưa được wire; 60s permission/15m postpone/handoff/restore chưa chứng minh** |
| REQ-011 không Google SKU | Agent trực tiếp Worker; Core job grant độc lập HA | **P0: Office không Worker -> không reserve; grant expiry/multi-Agent/CAS/FULL solo/rollback cần E2E** |

## Thay đổi trong lượt kiểm tra này

1. Sửa `relay-agent/D119AgentFeatures.cs`: giữ **tập** Picker `UserId` được chọn khi bảng realtime render lại, thay vì chỉ giữ một dòng; xoá selection mặc định khi không có lựa chọn trước đó.
2. Thêm hai source regressions vào `tests/d167-three-slot-sku.test.mjs`: kiểm tra selection nhiều Picker, và **release guard** bắt buộc Active Agent gọi hàm chuyển mạng + kiểm tra Worker; guard phải fail nếu helper vẫn không được tích hợp.
3. D168 được phê duyệt source + Beta nhưng **không hạ gate** để phát hành bản code còn khuyết. Tạm giữ Draft PR #591, không merge, không push main, không cập nhật Agent/Android/Web/Worker và không chạm Stable.

## Requirement → contract → kiểm thử → chứng cứ còn thiếu

- **05h FULL solo PRIMARY:** Service chứng thực PRIMARY khi `reserve`; job grant độc lập được giới hạn actor/instance/generation và có TTL. Kiểm thử offline-network, Office chặn Cloudflare, switch an toàn khi không standby, active Picklist không bị gián đoạn, logout/HA transition, 05h VN và `DONE` fingerprint. Không có máy thật nên FIELD PASS đang thiếu.
- **Wi-Fi routing:** chọn **chỉ saved/Owner-approved profile**; DNS/HTTP401/403/quota không được coi là lý do tự đổi mạng; `60s` cho phép chuyển tuyến **chỉ khi idle**, không là duyệt thao tác đặc quyền. Ghi trạng thái không lộ SSID, khôi phục route ban đầu dù lỗi, không lưu credential hoặc vượt proxy của công ty.
- **Realtime/ACK:** Firestore Auth/lease/call/confirm terminal ACK giữ nguyên; Picker kick chỉ sau xác thực Worker và tiếp tục tín hiệu đẩy tới PDA. Kiểm concurrency và session tombstone.
- **Usage:** đo trước/sau bằng đơn vị từng provider, số request Worker, Firestore document reads/writes/listeners, Apps Script `d167_sku_sync=0`, thời gian FULL/DONE, Confirm latency/ACK. Không tuyên bố tiết kiệm khi chưa có số.
- **Release:** bổ sung test chuyên biệt D168 với failure/HA network matrix; PR exact-head Authority + Continuity + Agent + Android + Worker + regressions PASS; xác nhận runtime Beta bằng receipt; update Agent theo rollout có kiểm soát; cuối cùng Owner nghiệm thu riêng. Stable OWNER-GATED.

**Kết luận:** PR #591 là code D168 đang làm, chưa phải bản sẵn sàng phát hành. Bước kế tiếp bắt buộc là tích hợp an toàn Worker/WLAN vào job và sửa test cho PASS, sau đó mới xem xét release Beta đúng lệnh Owner E018.

## 2026-10-14 — Kiểm tra nhầm Ready và tiếp tục sửa code

- Owner ấn nhầm **Ready for review**; PR #591 đã được đưa về **Draft**, không merge và không có D168 release receipt. Các workflow PR đặt GitHub Environment beta có thể tạo lịch sử deployment `Active` nhưng kiểm tra run cho thấy Firestore `MUTATE=false`, RTDB `DEPLOY_RULES=false`, Agent/Android chỉ upload build artifact, bỏ qua các bước official release.
- D168-REQ-006: sửa `UserStartupRegistration.SetEnabled` để xác minh thực tế `HKCU Run`, hoàn nguyên thiết lập nếu Windows từ chối đăng ký; bổ sung static regression.
- D168 SKU manual: sửa trường hợp việc cập nhật vượt qua 00:00 VN và gặp lỗi. `Abort` phải hủy lease của **ngày bắt đầu** thay vì hôm sau; thêm static regression để ngăn lỗi.
- Các source fix này chưa chứng minh P0 OFFICE→Worker, 05h FULL, physical WLAN/Confirm/ACK hay tiết kiệm Usage. Release guard không được bỏ cho tới khi luồng chuyển mạng thật được tích hợp và E2E kiểm chứng.
- Một chỉnh sửa thêm để siết phiên được chọn trong gửi liên hệ nhóm bị công cụ từ chối và không được đưa vào PR. Không được giả là đã xử lý.

## D168-E023 — Agent v131 field-probe candidate / release boundary

**Supersedes earlier source-only diagnosis that the WLAN helper was not wired.** The current D168 PR now connects `D168NetworkRoute.OpenWorkerSession` to manual/automatic SKU and contains a dedicated one-click **“Thử kết nối Worker”** button in Agent Settings. It makes a read-only authenticated Worker capability request; if needed it prompts for previously saved/selected Wi-Fi, checks the Worker, and verifies restoration of the original Wi-Fi. Logs distinguish `DIRECT` versus `SWITCHED_AND_RESTORED`; a direct connection must **not** be called a passed switching test.

Further changes: v131 version markers; manual and 05h AUTO SKU Office XLSX export-before-switch; no WMS export when no approved fallback; exact Picker session selection; terminal-only SKU DONE snapshots merged into existing Firebase `agent_sync` on CAS; D168 release receipt defaults to code-only denial and requires exact-head authority/continuity, CI and physical FIELD_PASS, never inherited from D167. No new external provider resource was registered.

**Still not FIELD PASS:** Windows standard-user Wi-Fi switching, Office WMS XLSX and standalone PRIMARY FULL, intact live Picklist/ACK and HA, actual Core DONE/fingerprint, signed APK rollout, observed provider metering and successful return to original network. The button does not mutate WMS and cannot replace an end-to-end SKU transaction test. Installation or execution on the company's PC is not available through GitHub connector; one local field check is an actual Owner/device-only boundary. Until evidence is returned, retain Draft/no merge/no Beta install for this D168 candidate. Stable remains excluded.


## D168-E029 — Owner cho phép phát hành đồng bộ Beta để nghiệm thu tại hiện trường (14/10)

**Mốc Owner:** Anh xác nhận coi như đạt điều kiện kiểm thử chuyển Wi-Fi, hoàn nguyên mạng và PickList trước phát hành, yêu cầu triển khai toàn bộ mô hình Beta để tự nghiệm thu. Đây là chấp nhận rủi ro khi phát hành thử (OWNER_PREDEPLOY_FIELD_WAIVER), **không phải chứng cứ thiết bị FIELD_PASS**. Giữ D168 Owner PASS=false, physical_field_verified=false, Stable owner-gated.

**Khắc phục lệch phiên bản Agent/Worker (D168-E028):** Agent v131 gọi API /api/agent/d168/network-capability mà D167 Worker trên main chưa có. PR591 chứa cả API lẫn Agent v131; khi triển khai cả bộ phải cho Worker+InventoryCore+Web Beta PASS đúng SOURCE_COMMIT trước, rồi mới xuất bản Agent/Android; nếu Worker fail, kênh Client không được cập nhật. Các workflow Agent/Android hiện có bước chờ GitHub Worker deploy exact SHA; workflow Agent mới chặn cập nhật trước Worker, Android kéo dài thời gian chờ.

**Phát hành theo điều kiện thật:** code/package CI và Authority+Continuity của chính HEAD phải PASS; receipt chỉ cấp Worker, Android, Agent trên tài nguyên Beta đã đăng ký, mã nguồn đã chốt; dùng chế độ Owner chấp nhận field trial đặc thù, không giả field pass. Sau merge, kiểm chứng runtime Worker source, Agent v131 release/channel, signed Android Beta/channel. Nếu lỗi cần đánh dấu RELEASE_FAIL/PARTIAL chứ không suy đoán hoàn thành.

**Nghiệm thu trực tiếp sau phát hành:** Agent trên một PC thực và PDA thử: Wi-Fi Office/saved Internet + khôi phục, DAILY FULL trước ca kể cả solo PRIMARY, một Picklist Confirm/ACK, trạng thái Picker online/kick, liên hệ nhóm, nhật ký/Usage, bảo đảm không gián đoạn nghiệp vụ; các lỗi được giữ trong D168 cho tới Owner PASS.
