# D173-E016 — Archify v3.2.0: phân tích kỹ thuật và áp dụng phương pháp vào SUPRA Inventory (24/10/2026)

**Trạng thái:** Owner yêu cầu nghiên cứu toàn diện Archify và vận dụng cho dự án. Đây là hồ sơ triển khai phương pháp, **docs/pilot candidate only**; chưa tích hợp Archify vào runtime hay tự nhận Archify CLI/Browser PASS. Không phát hành/merge tự động. D172 độc lập PENDING/HOLD, Stable OWNER-GATED.

## 1. Nguồn đánh giá đã cố định

- Upstream: https://github.com/tt-a1i/archify ; phiên bản phát hành `v3.2.0` ngày 19/10/2026, tag revision `e62275b6373fa63436e195635835c313ce028b21`.
- Release asset `archify.zip`, SHA256 upstream công bố `70e210265c59f24dcbdf2a502ff671104b5454e7ee7d3554aecd86bad32384f5`. Chưa tải/kiểm hash zip trên runner riêng, nên **KHÔNG** tuyên bố xác thực binary.
- Tài liệu đã đối chiếu: `archify/SKILL.md`, `archify/references/repository-authoring.md`, `archify/references/explainer-authoring.md`, `archify/references/delivery-contract.md`, `archify/references/viewer-runtime.md`, `README.md`, `package.json` tại tag v3.2.0.
- Project snapshot tác nghiệp để truy nguồn: `tamnv2/supra-inventory@bd7bf89b6ff94271585f9174b4c74e8a4b6b9f65` (D173 E015 stacked Draft). Accepted Production baseline và field state **phải đọc riêng từ main**; diagram snapshot không xác nhận production.
- Archify phát hành theo MIT; quy trình hoạt động qua skill + CLI trên Codex/Cursor/Claude Code/OpenCode. Không được suy là skill đã chạy ngay trong ChatGPT Desktop ở chế độ CHAT.

## 2. Năng lực thực sự có thể học theo

| Năng lực Archify | Cơ chế/điểm mạnh | Ranh giới độ tin cậy |
| --- | --- | --- |
| 10 loại sơ đồ | Architecture, Workflow, Sequence, Data Flow, Lifecycle, ERD, Class, Tree, Timeline, Waterfall; có schema riêng | Không tự suy trách nhiệm hoặc một API đang chạy khi thiếu call site |
| Repository-backed | Pin repo/commit; mỗi node chỉ rõ file và khoảng dòng; kiểm chứng byte ở revision đã chốt | Không dùng diff working tree để chứng minh commit cũ; không thay thế nguồn canonical |
| Native diagram + JSON source | Sơ đồ là view của dữ liệu cấu trúc có thể diff/review/tái sinh | HTML là sản phẩm diễn giải, không phải nguồn nghiệp vụ |
| Explainer 1 trang | Kết luận trước; panel theo câu hỏi; bảng, checklist, steps liên kết node | Cần dẫn chứng và chỉ định phạm vi, không dùng thay báo cáo usage định lượng |
| Viewer tương tác | Tìm node, focus, đường quan hệ, upstream/downstream theo cạnh được author, export HTML/PNG/SVG/PDF | Reachability không chứng minh blast radius, downtime, hay dependency runtime ngoài cạnh tác giả đã khai báo |
| CLI finalize | Validate schema → deliver → strict check → browser-check; báo receipt/quality/geometry; repair có giới hạn | PASS của Archify chỉ cho artifact, **không phải** CI/RELEASE/FIELD/OWNER PASS của SUPRA |
| Xuất bản độc lập | HTML có thể xem offline; theme, style, motion và liên kết đọc nguồn | Cần review CSP/JS và sanitization; không tự nhúng vào Production Web |

Nguồn đọc: https://github.com/tt-a1i/archify/blob/v3.2.0/archify/SKILL.md và các reference cùng tag.

## 3. Giá trị đối với SUPRA Inventory — ưu tiên theo lợi ích/rủi ro

### P0 — áp dụng ngay ở cấp phương pháp (không đổi runtime)

1. **Bản đồ hệ thống và ownership:** phân biệt Android Báo hàng, Web, Agent v140, Firebase Auth/Firestore, Cloudflare Worker/InventoryCore SQLite; vẽ D172 Android/OBPP namespaces riêng nhưng chung Worker/Core/Auth vật lý. Không vẽ mũi tên nghiệp vụ khi không có source evidence.
2. **Luồng request và trạng thái:** Sequence cho Picker → API → core → event → Web/Reporter/FCM; lifecycle cho claim/ACK và HA Agent. Mọi cạnh quan trọng cần dòng code; điểm không chứng minh được để `UNKNOWN/TO_VERIFY`.
3. **Release/change control:** Workflow từ Owner request → source/impact/cost/security review → branch/PR → authority+continuity+tests → explicit release gate → FIELD → OWNER; minh họa nhánh D172 riêng, không ghép tiến trình.
4. **Định dạng báo cáo AI:** mở đầu bằng kết luận, sau đó `Facts | Evidence | Unknowns | Risk | Alternatives | Proposed action | Gate`; bài toán nhiều bước có diagram, không thay sự thật bằng sơ đồ đẹp.
5. **Bản đồ log/usage:** gắn mỗi metrics với producer, provider và time window; không quy DO SQL rows read thành hiệu suất/khoản tiền nếu chưa khớp tải và cửa sổ đo.

### P1 — ứng dụng trực tiếp vào công việc D173 đang mở

| Bài toán | Kiểu sơ đồ/artefact | Tác dụng | Điều kiện |
| --- | --- | --- | --- |
| Badge Reporter nhấp nháy/sai, scroll reset | Sequence + lifecycle sự kiện snapshot/delta/seq | Nhận diện đường đọc sai và điều kiện tranh chấp | Phải có log vc117 và source, **không tuyên bố root cause khi thiếu evidence** |
| Picker FCM overlay | Lifecycle foreground/background/Doze, fallback | Chỉ rõ điều kiện có thể hiển thị và nơi thất bại OEM | Cần log thiết bị MT90/DT50 để FIELD xác nhận |
| Office/VPS/Agent HA/ACK | Sequence + timeline từ log thật | Tách reconnect/lease/fencing/ACK, điểm mất ổn định | Không tự điền thời gian hoặc coi topology là đo latency |
| Usage Cloudflare/Firebase | Dataflow + waterfall (nếu có trace) | Phân biệt DO compute, SQL rows, billed reads, RTDB/Firestore | Dùng snapshot cùng khung, không làm tăng polling |
| A/C ưu tiên, B sau log (E015) | Workflow chấp thuận + impact map | Chặn trộn code đã có căn cứ với giả thuyết B | Theo Owner E015, PR713/714/715 hiện Draft; không gộp sản phẩm tự động |
| D172 OBPP | Kiến trúc, namespace-boundary, ERD độc lập | Kiểm soát cross-regression khi chia sẻ Worker/Core/Auth | Không sửa tài nguyên/nguồn riêng D172, giữ PENDING/HOLD |

### P2 — thử nghiệm renderer thật sau khi có cổng

- Chạy CLI từ package **pin exact tag + hash**, trong runner/read-only workspace không chứa secret, dùng `ARCHIFY_UPDATE_CHECK_DISABLED=1`, không gọi API sản xuất; chuẩn bị nguồn JSON/Markdown trong repo.
- Chạy `finalize` kèm `--repo-root` đúng checkout revision, kiểm tra validate/deliver/check/browser-check; zero unresolved citation, zero secret, mọi chart có nguồn thời gian.
- Human visual review trên desktop, link/zoom/export, chính xác vai trò và chiều cạnh; chỉ khi toàn bộ PASS mới công bố artifact là **VERIFIED_DIAGRAM**, tuyệt đối không dùng thay business/code/runtime gates.
- Chỉ sau Owner chốt rõ phạm vi và trust review mới cân nhắc workflow CI cho **docs-only PR**, có pin dependency, kiểm hash và giới hạn quyền; không tự đưa HTML hoặc JS bên thứ ba vào `web/dist`, Worker Assets, OTA hay public endpoint.

## 4. Mẫu ứng dụng cụ thể đã tạo

`docs/architecture/SUPRA_ARCHIFY_PILOT.archify.md` là **nguồn Explainer ứng viên** theo cú pháp của Archify v3.2.0, có `@meta repo_revision`, `@source ... path/lines`, `@architecture`, `@workflow`, table và phạm vi. Phần kiến trúc chỉ trình bày thành phần/cạnh đã có căn cứ, không vẽ Reporter presence hiện chưa có authoritative source, không mượn D172 session của Inventory.

**Trạng thái:** `SOURCE_AUTHORED / ARCHIFY_FINALIZE_NOT_RUN / BROWSER_NOT_RUN / FIELD_NOT_CLAIMED`. Không đưa file candidate vào public Web, không coi các diagram là gốc truth.

## 5. Ma trận tác động trước triển khai

| Yếu tố | Docs-only E016 hiện tại | Nếu tích hợp/CI về sau |
| --- | --- | --- |
| Accepted base | Không đổi business/source/runtime; đọc source ở revision khóa | Phải lập impact review mới trước code |
| Android/Web/Agent/Worker | Không chỉnh, không build, không OTA, không Worker deploy | Không cấp mặc định quyền thay đổi |
| D172 | Chỉ mô tả ranh giới; không sửa D172 code/CI/OTA/Sheet | Regression cả D172 và Báo hàng cho tài nguyên chung |
| Bảo mật | Chỉ repo public và metadata không nhạy cảm | Pin/hash package, shell sandbox, review JS, zero secrets |
| Usage/quota | Không thêm Firebase/CF/WMS read/write/poll | Đo chi phí chạy CI và nguồn dữ liệu; cấm quét production |
| CI/Release/Field | Mới có doc candidate; chưa Archify test PASS | Archify gate riêng, KHÔNG thay authority/continuity + field gates |
| Stable | OWNER-GATED, không động tới | OWNER-GATED bất biến |

## 6. Quy chuẩn kiểm chứng và điều kiện chấp nhận

- Mỗi node/edge assertion ghi `SOURCE_PROVEN`, `DERIVED_FROM_CANONICAL`, `ILLUSTRATIVE` hoặc `UNKNOWN` cùng path/line/commit tương ứng.
- Không trình bày business flow duy nhất từ tài liệu có mốc thời gian cũ; nếu tài liệu Android/Agent còn ghi Beta lịch sử, đối chiếu `ops/project-state.json`, config/source hiện thời và release receipt.
- Sơ đồ phải duy trì D172 như nghiệp vụ riêng và trạng thái mở; chia sẻ infrastructure không cho phép liên thông bảng, quyền, APK, log hoặc acceptance.
- Mỗi bản sửa source ảnh hưởng cạnh của sơ đồ phải rà soát impact; diagram không tự động cập nhật và không được tự khẳng định vẫn đúng.
- Acceptance đầy đủ chỉ khi Owner duyệt phạm vi CI/renderer cụ thể, CLI/browser kiểm chứng thật, review trực quan, citation đúng và zero security finding; hiện tại chưa đủ các điều kiện này.

## 7. Trạng thái và bước tiếp theo

- **Đã làm:** nghiên cứu nguồn v3.2.0, đối chiếu authority D173/D172, chốt phạm vi pilot tài liệu, tạo nguồn sơ đồ truy vết source, lưu trong branch/PR docs-only.
- **Chưa làm:** chạy Archify CLI trong hệ thống có binary đã hash-verified, sinh HTML bằng engine Archify, kiểm thử browser/CI cho HTML, merge, Web integration, phát hành app hoặc runtime.
- **Đề xuất:** Owner review hồ sơ này. Sau đó triển khai đúng riêng một workflow docs-only sandbox có pin/review; ưu tiên phân tích lỗi thực tế E013–E015 mà không lấn sang sửa runtime đang chờ.
