# SUPRA Inventory — Sơ đồ nguồn và cổng thay đổi {#supra-archify-pilot}

SUPRA Inventory có một Worker Production và một InventoryCore SQLite chung, nhưng nghiệp vụ Báo hàng và D172 OBPP phải được biểu diễn như hai phạm vi kiểm soát độc lập.[](source:worker)[](source:core)[](source:obpp-core)

- D173 phụ trách Báo hàng, còn D172 OBPP vẫn PENDING/HOLD.[](source:d172-readme)
- Sơ đồ phản ánh mã nguồn tại một commit, không suy ra uptime, latencies, số lượt đọc hay FIELD PASS.
- Mọi sửa mã nguồn cần CI theo authority, Owner quyết định triển khai riêng.
- Bản này mới là candidate; chưa có receipt từ Archify CLI/browser.

@answer scope="Tài liệu nghiên cứu D173-E016; repository snapshot đã khóa; không áp dụng thay đổi runtime; giả thuyết lỗi E013-E015 chưa xác minh."
@meta repo_url=https://github.com/tamnv2/supra-inventory repo_revision=bd7bf89b6ff94271585f9174b4c74e8a4b6b9f65 style=clean
@source worker title="Existing Worker routes + InventoryCore DO binding" path=service/wrangler.beta.toml lines=1:34
@source worker-auth title="Worker entry imports auth and business endpoints" path=service/src/index.ts lines=1:16
@source core title="InventoryCore service handlers, including D172 isolation" path=service/src/core.ts lines=1:16
@source web title="Web imports operational application" path=web/src/main.ts lines=1:1
@source web-api title="Web realtime client identifies API origin" path=web/src/realtime-client.ts lines=1:22
@source android title="Android entry readme describes Worker/Firebase realtime path; historical Beta wording" path=android/README.md lines=1:14
@source agent title="Windows Agent Firestore confirmation transport" path=relay-agent/FirestoreConfirmationTransport.cs lines=12:47
@source firestore title="Firestore picker role and session control rules" path=firebase/firestore.rules lines=1:18
@source d172-readme title="D172 standalone APK boundary and independent session" path=obpp1291/README.md lines=1:17
@source obpp-core title="D172 separate core schema and allowed roles" path=service/src/obpp1291-core.ts lines=1:4
@source d173-plan title="Current D173 working plan" path=docs/D173_WORKPLAN_2026-10-23.md lines=1:28

## Hệ thống gồm những thành phần nào? {#system}

@architecture id=supra-runtime title="Chia sẻ hạ tầng, không chia sẻ nghiệp vụ"
| android | Android Báo hàng | frontend | source:android |
| web | Web Báo hàng | frontend | source:web |
| agent | Windows Agent | backend | source:agent |
| obpp | Android Nhận hàng rớt D172 | frontend | source:d172-readme |
| worker | Cloudflare Worker Production | backend | source:worker |
| core | InventoryCore SQLite | database | source:core |
| firebase | Firebase Auth và Firestore | cloud | source:firestore |
| android > worker | Inventory API |
| web > worker | Inventory API |
| worker > core | Core binding | emphasis |
| worker > firebase | Auth integration | security |
| android > firebase | Firebase session |
| agent > firebase | Confirm jobs |
| obpp > worker | OBPP API riêng | security |

D172 không được ghi vào bảng shortage hoặc dùng chung vòng đời APK/OTA với Báo hàng.[](source:obpp-core) Các mũi tên nêu quan hệ được chứng minh ở mức kiến trúc/cấu hình; không khẳng định thời điểm hay tần suất request.

## Khi sửa dự án cần đi qua những cổng nào? {#release-gates}

@workflow id=change-control title="Quy trình branch/PR/CI/Owner gate"
| owner | Owner nêu yêu cầu | external |
| evidence | Đối chiếu source và log | backend |
| impact | Kiểm tra phạm vi, quyền và quota | security |
| draft | Branch và Draft PR | backend |
| ci | Authority, continuity và hồi quy | backend |
| approval | Owner duyệt triển khai? | external |
| release | Release có receipt | backend |
| field | Field test riêng | backend |
| acceptance | Owner PASS khi xác nhận | external |
| owner > evidence | |
| evidence > impact | |
| impact > draft | |
| draft > ci | |
| ci > approval | source/CI PASS |
| approval > release | Có phê duyệt | emphasis |
| release > field | RELEASE PASS |
| field > acceptance | FIELD evidence |

Đường chưa được Owner phê duyệt dừng trước phát hành; biểu đồ **không** có nghĩa mọi yêu cầu trong D173 đã được phê duyệt. D172 có branch, test, release gate và nghiệm thu độc lập.[](source:d173-plan)

## Áp dụng vào các lỗi hiện tại ra sao? {#investigations}

| Hạng mục | Bằng chứng bắt buộc trước khi kết luận | Sơ đồ nên dùng |
| --- | --- | --- |
| Reporter badge nhấp nháy | Log vc117, server snapshot, seq và delta cùng thời điểm | Sequence + Lifecycle |
| Picker FCM overlay | Log thiết bị, foreground/background, quyền OEM | Lifecycle |
| Agent OFFICE/VPS HA và ACK | Exact trace request_id, lease/fencing, WMS ACK thực | Sequence + Timeline |
| DO SQL Rows Read/Firestore usage | Đồng khung bill provider, SQL query_id, khối lượng nghiệp vụ | Dataflow + Waterfall khi có spans |
| Reporter online chỉ xem | Source liveness có thẩm quyền và negative-action RBAC | Architecture + Workflow |
| D172 shared Worker | Source entrypoint/Core/OBPP + regression D172 và Báo hàng | Architecture + ERD độc lập |

Dữ liệu bảng này là **đề cương kiểm chứng**; chưa chứng minh root cause hoặc tiết kiệm chi phí.

## Điều kiện nào để công bố sơ đồ? {#verification}

- [ ] Kiểm SHA256 package Archify v3.2.0 trên môi trường có quyền chạy.
- [ ] Render từ source pin và kiểm tra từng node, cạnh, link nguồn.
- [ ] Chạy finalize với schema, check, browser-check thực tế.
- [ ] Kiểm tra không có secrets, thông tin người dùng, WMS session hay OTP.
- [ ] Owner duyệt phạm vi tài liệu nếu muốn nhúng vào báo cáo chính thức.
- [ ] Không nhúng JavaScript từ công cụ bên thứ ba vào Web/Worker Production.

@callout level=warning title="Chỉ là candidate"
| ARCHIFY_FINALIZE_NOT_RUN, BROWSER_NOT_RUN, CI_NOT_RUN. Tất cả số liệu thời gian/usage chưa được dùng trong sơ đồ. |
