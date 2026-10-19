# D171-E021 — Đính chính rà soát kiến trúc theo quyết định Owner ngày 19/10/2026

> **BẢN RÀ SOÁT LẠI, KHÔNG PHẢI LỆNH CODE / DEPLOY.** Bản E020 trước đã lẫn kết quả code D169/v139 với hướng đích mới của D171 và tự chọn Firestore làm giải pháp cuối. E021 chỉnh cách phân loại. D169 chỉ là hiện trạng để đánh giá độ lệch; D170 đang PAUSED, D171 là phạm vi hiện hành. Mọi nội dung triển khai mới phải có Owner scope/impact approval riêng.

## 1. Đã chốt trong D171 — kiến trúc mong muốn

Quyết định trực tiếp được lưu trong `ops/change-continuity/D171.json#D171-E018`:

1. VPS là PRIMARY ưu tiên và thường hoạt động lâu dài, sử dụng **đường truyền PDA ↔ VPS chuyên biệt**, mục đích là nhanh, ổn định, tiết kiệm usage; chưa chốt đường này bắt buộc thuộc Firebase RTDB hay Firestore gRPC hay tên giao thức cụ thể.
2. Agent ↔ Agent dùng **một đường dịch vụ phối hợp chung**, tương thích Office và Internet; không yêu cầu người dùng chuyển giao thức thủ công mỗi khi Wi-Fi thay đổi.
3. Khi VPS thật sự không sẵn sàng, một Agent đủ điều kiện ở Office **hoặc** Internet được nhận PRIMARY an toàn. Lúc này **PDA ↔ Agent đang thay** và **Agent ↔ Agent** dùng cùng đường dịch vụ đa mạng — không bắt PDA đổi cơ sở dữ liệu/tự phát lại lệnh.
4. Khi VPS trở lại, phục hồi chế độ ưu tiên VPS bằng bàn giao an toàn, không cắt ngang WMS in-flight; PRIMARY được admin/tamnv2 chỉ định thủ công cần xin phép như quy định đang có.
5. Mục tiêu 15s phát hiện/đánh giá failover khi đường điều phối còn sống, một quyền PRIMARY qua generation/CAS, request_id/ACK bảo toàn và ngăn xác nhận WMS trùng là **ràng buộc an toàn**, không phải lý do để quay về nguyên trạng D169.

**Quyết định về hành vi KHÔNG đồng nghĩa đã duyệt Firestore REST/gRPC, RTDB hay Cloud Functions làm triển khai cuối cùng.** Firestore REST + gRPC đề xuất ở E018/E019 là một cách thực hiện trong phạm vi hiện có, **không phải công nghệ Owner khóa độc quyền**.

## 2. Các quyết định D171 bổ sung trong trao đổi của Owner chưa được phản ánh đầy đủ tại main E018–E019

Qua rà soát lại ngữ cảnh hội thoại 19/10, và Owner yêu cầu trong phiên hiện tại phải khôi phục **các quyết định D171 đã chốt**, đây là **đầu vào thiết kế cần đưa vào vòng rà soát/reconciliation trước khi sửa production**:

| Chỉ tiêu / ràng buộc Owner | Giá trị |
| --- | --- |
| PDA | **40 thiết bị** |
| PickList | **2.000/ngày** |
| Kích user (Kick) | **200/ngày** |
| Gọi chuyên viên | **300/ngày** |
| Chat | **500/ngày** |
| Đồng bộ thông tin Agent thông thường | **10 phút/lần**; không kéo dài lease/ACK realtime lên 10 phút |
| Dữ liệu lịch sử trung gian | **Tối đa 5 phút** theo trao đổi; phân biệt với retention/ACK business authority trước code |
| Usage | **Mục tiêu ≤90% định mức miễn phí thích hợp**; chấp nhận dùng thêm realtime khi đảm bảo mục tiêu và chất lượng |
| SKU | **Giữ nguyên nghiệp vụ/cadence hiện hành**, không gộp nâng cấp SKU vào transport |

Các thông số này **thay thế tải minh họa 1.200 PickList/ngày** trong phép tính E019 cho công tác thiết kế tiếp theo. E019 vẫn là bài tính tình huống cũ, không được biến thành sizing chuẩn cuối.

Bổ sung hướng Owner xác nhận trong hội thoại: các tài khoản đặc biệt được phép xác thực từ Office theo cơ chế OTP/mật khẩu khẩn cấp tương ứng hiện có; sử dụng dịch vụ Google/Gateway **thực sự khả dụng trên Office** để kích hoạt xử lý Web/Cloud khi Agent không thể trực tiếp đến Cloudflare, thay vì bắt nhân viên chờ đổi mạng. **Không suy diễn cấp đường HHmm cho tài khoản VPS**, vì policy VPS OTP-only được Owner chốt riêng; không đưa token/secret vào repo.

Đã thảo luận khả năng **Cloud Functions** như một thành phần backend/Gateway; chưa có phê duyệt định danh tài nguyên, source SHA, Rules, ngân sách hoặc quyền triển khai Function mới trong D171 E018/E019. Không bác bỏ trước phương án này chỉ vì mô hình D169 không dùng nó, nhưng cũng không được tuyên bố Function mới đã hoạt động trên Office nếu thiếu probe thật và scope approval.

## 3. Đánh giá khả thi theo hai chế độ mục tiêu, không áp nguyên D169

| Yêu cầu đích D171 | Khả thi kỹ thuật | Thiếu chứng cứ / ràng buộc |
| --- | --- | --- |
| Đường PDA↔VPS nhanh riêng | **Có**, kênh sự kiện riêng có thể mang tín hiệu đánh thức, lưu công việc và ACK có authority duy nhất | Chưa chốt công nghệ; RTDB hiện được phép HA-liveness **không phải** business; cần scope/Rules & chống trùng nếu chọn RTDB business |
| Agent↔Agent cùng dịch vụ từ Office/Internet | **Có điều kiện**, Firestore REST qua Windows System Proxy đã có field read HTTP200 | Production Office gRPC/Call/Kick/Chat, latency, Auth Function endpoint chưa được chứng minh bằng test |
| VPS hỏng, Agent thay dùng chung PDA+Agent | **Có điều kiện**, nếu cùng durable job ID/ACK, generation/fencing, WMS ready và route Office | Cần kiểm tra burst/partition/Failover; không tuyên bố 15s tuyệt đối |
| VPS trở lại chế độ riêng | **Có**, giới hạn bằng CAS, drain in-flight và consent holder thủ công | Cần test race, stale presence, timeout khi trả quyền |
| 40 PDA/2k jobs/1k lệnh liên hệ/quota ≤90% | **Chưa thể kết luận chi phí**, cần đo mix traffic & provider bill | D171 E019 1.200 job/day chỉ minh họa, không thay phép tính tải mới; quota Firestore chia theo project/database |
| Xác thực 3 tài khoản đặc biệt ở Office, Google→Cloud | **Có thể** tái sử dụng ủy quyền/Google Gateway trong mô hình server-side; không tự bypass HTTP401/403 | Cần test OTP/Gateway/Function trên Office và RBAC, không dùng raw secret hoặc Office firewall bypass |

### Quyết định công nghệ **CHƯA** được chốt
- VPS fast path là dedicated **Firestore gRPC**, **RTDB signaling hợp lệ**, hay dịch vụ khác: chưa khóa.
- Đường chung Agent↔Agent và fallback PDA↔Agent là **Firestore REST-only**, **Firestore + Functions relay**, hay giải pháp hỗn hợp an toàn: chưa khóa.
- Chưa phê duyệt mở RTDB business message/ACK, Cloud Function mới, thay Firestore Rules, hay thay kênh APK/Agent chính thức.

## 4. Đề xuất thực hiện đúng thứ tự D171

**Bước A — Chốt hợp đồng nghiệp vụ và lựa chọn kiến trúc theo E018.** Dựng bảng so sánh 3 phương án đáp ứng cùng yêu cầu hai chế độ: (1) Firestore existing fast VPS + common REST; (2) Fast VPS signal riêng + common Firebase/Google relay; (3) server-side Google Function/Gateway cho những sự kiện Office phải kích Cloud/Worker. Phân biệt *signal* với durable job/ACK. Không tráo một phương án kỹ thuật thành quyết định Owner.

**Bước B — Tính sizing theo tải Owner thực chốt.** 40 PDA, 2.000 job/ngày, 200 Kick, 300 gọi, 500 Chat, Agent metadata 10 phút, cửa sổ lịch sử 5 phút và quota mục tiêu ≤90%; đo throughput burst, p50/p95 ACK, billed Firestore Reads/Writes, RTDB downloads, Function invocations/CPU, Worker usage, OTP/Gateway. Không dùng local HTTP GET làm số billed read.

**Bước C — D171 standalone test đúng 5 vòng** A/B = NORMAL/NORMAL, OFFICE/NORMAL, NORMAL/OFFICE, OFFICE/OFFICE, NORMAL/NORMAL, PDA NORMAL; đủ 3 READY, có bằng chứng xác thực route, ACK A/B/kép, đúng phase, không PASS giả. Thêm probe production-equivalent cho đúng endpoint gRPC, REST, Function/Gateway nếu được phép; không đưa production WMS hay PRIMARY vào test isolated hiện tại.

**Bước D — Chốt công nghệ, scope, bảo mật và ngân sách theo số đo rồi trình Owner duyệt code.** Nếu chọn RTDB business/Function mới, bắt buộc sửa project-scope/resource-registry/Rules/decision/spec/state cùng PR và xin quyền resource trước. Giữ fail-closed khi Office route không được chứng minh.

**Bước E — Branch → PR → tests/CI → được Owner duyệt deploy → Beta canary → FIELD/OWNER PASS.** D170 paused; Stable owner-gated. Không tự sửa D169 nguồn sản xuất hoặc cam kết release chỉ vì bản phân tích hoàn thành.

## 5. Bản ghi kiểm chứng
- D171 E018 Owner decision: `docs/OWNER_DECISIONS.md`, `docs/specs/REALTIME_NOTIFICATIONS.md`, `ops/change-continuity/D171.json`.
- E019: mô phỏng 1.200 jobs, 6 Agent, chưa đo billing thật.
- E020: bản phân tích đã **vội chọn** Firestore implementation; **E021 sửa lại phân loại, không đánh dấu Owner duyệt code**.
- Đầu vào workload/Office approval có trong trao đổi Owner 19/10, nhưng chưa có decision/spec chính thức trên `main`; chỉ hợp nhất canonical sau Owner/scope review. Không đưa thông tin từ repo khác hoặc secret vào nguồn public.
