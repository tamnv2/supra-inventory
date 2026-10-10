# D167 — Backlog chuyển tiếp từ D166 / chờ log và bằng chứng thực tế

**Ghi nhận Owner:** 10/10/2026 (Asia/Ho_Chi_Minh)  
**Phạm vi:** SUPRA Inventory Beta và những tương tác được phép bên trong `ops/project-scope.json`. Stable OWNER-GATED. Dòng Launcher liên quan đến Inventory chỉ điều tra phần backend/log thuộc repo này; APK Launcher thuộc repo khác không được tự thay đổi.
**Trạng thái D167:** `BACKLOG_OPEN__AWAIT_EVIDENCE_AND_OWNER_ANALYSIS__NO_CODE_OR_DEPLOY_APPROVAL`.
**Đóng D166:** `OWNER_PASS_RELEASE_UPDATE_NO_REPORTED_ERRORS_ONLY`. Owner báo **đợt cập nhật D166 chưa phát sinh lỗi được ghi nhận tại thời điểm chốt**. Đây là Owner PASS **phạm vi ổn định cập nhật**, không phải tuyên bố đã PASS tất cả tính năng, toàn bộ PDA/Agent cài phiên bản mới, báo cáo lịch sử, HA, hiệu quả Usage hoặc từng kịch bản hiện trường.

## 1. Chỉ đạo và quy tắc tiếp nhận

1. **Không coi tồn đọng là hoàn thành.** Những gì đã tích hợp và phát hành trong D166 được ghi là `RELEASED_TECHNICALLY__FIELD_EVIDENCE_PENDING`, không hạ cấp giả thành “chưa code”; tính năng chưa triển khai ghi `DEFERRED_ANALYSIS__NO_IMPLEMENTATION_APPROVAL`. Giữ mã hạng mục D166 làm provenance; D167 là workstream xử lý tiếp.
2. **Đợi log, Usage và bằng chứng thực tế** từ Owner theo ca/khung giờ rồi so sánh, phân tích nguyên nhân, đề xuất phương án và mức độ ưu tiên; không tự tạo nguyên nhân không được đo. Các mục thiết kế tương lai cũng ở trạng thái chờ phân tích, không ngầm cho phép chạy code.
3. Áp dụng chỉ đạo Owner mới nhất ngày 10/10: **tối ưu phân bổ công việc giữa các meter/dịch vụ thực sự có thể thay thế** để hạ chỉ số nóng và tận dụng dư địa dịch vụ ít dùng, không biến quota khác đơn vị thành một khoản cộng cơ học; giữ nguyên/better realtime, confirm speed, HA, ACK, độ ổn định, quyền và bảo mật.
4. Ngân sách: **Cloudflare Workers Paid $5/tháng cố định + dự phòng phát sinh thêm $5/tháng cho tất cả dịch vụ gộp**; Firebase Blaze ưu tiên hạn free. Drive đang free, có thể xét phương án lưu trữ 5 TB sau quyết định riêng; API quota vẫn phải tuân thủ. Tham chiếu `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`.
5. Luồng điều khiển: **phân tích → Owner cho “chạy code” → code/CI trên PR tới CODE READY, KHÔNG deploy → Owner duyệt triển khai → deploy/release/field-test → Owner nghiệm thu**. Chỉ khi Owner yêu cầu rõ “sửa code và triển khai” mới bỏ checkpoint CODE READY chờ lần hai. Nếu code-only phải đụng live tài nguyên thì báo lý do và xin duyệt ngoại lệ trước. **CI/CD gate mới hiện mới là chính sách, chưa được code hóa**.
6. **Không mở D168 / không tự động tối ưu/provision/xóa dữ liệu hay đụng Stable** khi D167 chưa được Owner nghiệm thu. Không gộp PASS của D166 với PASS từng tồn đọng D167.

## 2. Hiện trạng đã phát hành / điều kiện bằng chứng

Đã được chứng minh bằng CI/manifest (không suy luận số thiết bị cài đặt):
- D166 integration PR **#541**, Beta Worker/Web & Agent Operations Gateway deploy workflow PASS.
- APK ký số **`beta-vc104`**, manifest công khai giới hạn tối thiểu **104**; Agent **`relay-agent-v124`** được phát hành lên `inventory-channel`. Live manifest HTTP readback PASS.
- Tám nhóm nguồn tích hợp: cửa sổ sửa kết quả chung; Picker mới tự bật Báo hàng; RTDB SSE/HA safety; năm SQL cursor usage diagnostic; Android ACK HTTP categories; Web năm tab và badge; Drive Logs một authority/ngày; Android signed minimum-version gate.
- **Chưa chứng minh:** toàn bộ PDA vc104 / 6 Agent v124 đã cập nhật thực tế, không có lỗi sau nhiều ca hoặc tối ưu Usage giảm; điều này không làm thay đổi ý nghĩa **Owner PASS đợt cập nhật chưa ghi nhận lỗi**.

## 3. Danh sách D167 ưu tiên đánh giá sau khi có chứng cứ

| ID D167 | Vấn đề / mục tiêu chuyển từ D166 | Trạng thái hiện tại; bằng chứng còn thiếu | Phạm vi / hướng điều tra (không phải lệnh sửa) |
| --- | --- | --- | --- |
| **D167-USAGE-ROOT-CAUSE** | Firestore document reads/writes tăng, DO SQLite rows read và Worker/DO compute, tìm nguyên nhân thực rồi giảm chi phí/quota | **MEASUREMENT / ROOT CAUSE PENDING.** D166 chỉ thêm counters/query diagnostics, **không** chứng minh mức giảm. Baseline 06/08/09 và log mới chưa đủ đối chiếu bình đẳng | Provider actual 06–22h, normalized per 1,000 Picklists, PDA/Agent-hours, listener reattach, `QUERY_FRESH_ONLY` empty queries, Firestore API-vs-billable-doc reads, DO SQL query IDs/rows, read/write/CPU, retries và usage ZIP |
| **D167-CROSS-METER-OPTIMIZATION** | Phương án A nóng được giảm bằng B/C đang ít dùng (đúng nghiệp vụ) trong mức dự phòng tổng $5 | **NEW OWNER POLICY / ANALYSIS ONLY** | Sơ đồ chuyển tải thực, phạm vi free-tier theo provider, chi phí tổng, latency/HA/security, rollback; không lấy số đếm khác đơn vị cộng cơ học, không chuyển business authority sang Sheets |
| **D167-HA-LEADER** | Chuyển Agent PRIMARY rồi bị giành lại; Firestore stale lease, RTDB SSE, split network, tốc độ failover | **D166 safety source integrated; REAL FIELD INCOMPLETE** | Log PRIMARY/NEXT_A/NEXT_B với generation/CAS, WMS-readiness, RTDB liveness, partition/403, chủ động đổi chính, một chủ sở hữu xác nhận không trùng, kiểm tra không phá confirm đang chạy |
| **D167-ACK-CONFIRM-LATENCY** | Xác thực Android Picker ACK, phân loại HTTP 400/404/408/409/422, WMS confirm end-to-end nhanh/ổn định | **INSTRUMENTATION RELEASED; FLEET EVIDENCE PENDING** | Log riêng theo thành phần không lộ SKU/PL/nhân sự, P50/P90/P95/P99 so cùng tải, lỗi false retry, ACK đúng đối tượng, không WMS double-click; đo chênh lệch Agent confirm so baseline |
| **D167-USAGE-ZIP-EVIDENCE** | Button `Tải số liệu Usage để phân tích`: đủ dữ liệu 24h/ngày/ca, ZIP + ảnh bổ sung khi metric không truy cập được | **AGENT GATEWAY/RELEASE PRESENT; ON-DEVICE COMPLETE PROVIDER PROOF PENDING** | Thử thực địa máy phụ v124; đọc JSON/CSV/manifest/coverage, provider source age, `N/A` vs 0, phân biệt Cloudflare shared-account vs Inventory, billing vs sample; ảnh chụp Usage bổ sung |
| **D167-DRIVE-LOG-CANONICAL** | Web/Android/Agent lưu đúng một thư mục Logs/ngày Việt Nam, chống tạo trùng và không mất bundle | **INTEGRATED; LIVE MULTI-IDENTITY & HISTORICAL DUPLICATES PENDING** | Worker + Apps Script OAuth hai nguồn, nhiều Agent/PDA upload đồng thời, `bundle_id` idempotency, Drive readback trước local prune; kiểm kê thư mục trùng cũ, **không xóa/merge dữ liệu cũ trước Owner duyệt riêng** |
| **D167-LAUNCHER-LOG-SERVICE** | Phân tích không nhận log Launcher từ PDA, nguồn Drive folder/OAuth, dịch vụ nhận/buffer | **INVENTORY BETA BACKEND INVESTIGATION PENDING REAL PDA LOG** | Xác minh HTTP receive→SQLite pending→Drive synced, phiên bản Launcher và lịch gửi thực tế; Launcher APK/phiên bản thuộc repo riêng, không tự build/đổi scope |
| **D167-OTA-FLEET** | Cập nhật bắt buộc Android + Agent, đối chiếu cài đặt thực tế và an toàn ca | **SIGNED VC104/V124 RELEASED; INSTALLED COUNTS NOT VERIFIED** | MT90/DT50 thực tế, manifest floor 104, phiên cũ không có gate, máy phụ trước PRIMARY, không ngắt ACK/picklist; báo phiên bản từng nhóm bằng chứng đã khử định danh |
| **D167-WEB-TABS-HISTORY** | Web 5 tab chọn Hôm nay hoặc khoảng ngày, thống kê đúng cả lịch sử | **5 TABS SOURCE DEPLOYED; HISTORICAL OPEN-AS-OF NOT IMPLEMENTED** | Chốt timestamp phân loại từng tab, `Đang xử lý`/`Quá hạn` lịch sử theo as-of vs current, khôi phục trạng thái sự kiện nếu dữ liệu cho phép; lọc inclusive từ/đến, lazy/paginated, badge realtime và usage |
| **D167-RESULT-CORRECTION** | Một setting cho sửa `Đã có hàng`/`Cho phép Skip`, hết xx phút ẩn nút Web/Android | **CODE RELEASED; BUSINESS FIELD TEST PENDING** | Mốc first **result** publication, không nhầm first **shortage report** SLA, hết hạn, cập nhật setting, role/version guard, timeout skip, event/FCM và Picker ACK |
| **D167-NEW-PICKER-DEFAULT-ON** | Picker mới tạo tự bật báo thiếu, Picker hiện hữu giữ trạng thái trước đó | **SOURCE INTEGRATED; REAL HR/ACCOUNT FIELD VALIDATION PENDING** | Test HR new vs existing, retry, restore, bulk apply, tắt thủ công không bị re-enable, audit và đồng bộ Web/App |
| **D167-PRIVACY-OBSERVABILITY** | Bộ log đủ kiểm toán nhưng không nhạy cảm, đủ timestamp/correlation/dropped counts | **CROSS-CLIENT RAW FIELD NEGATIVE-SCAN PENDING** | Agent/Web/Android, lỗi/ACK/Usage, timezone VN vs provider, replay, log buffering và Drive send confirm; không tăng gửi log/polling |
| **D167-CI-CD-OWNER-GATE** | Code READY rồi Owner duyệt mới merge/deploy/release; cho phép chạy code+triển khai một lệnh | **POLICY MERGED #546; ENFORCEMENT CODE NOT IMPLEMENTED** | Chặn main-push/dispatch/rerun gây deploy/release vô ý, bảo đảm PR tests chỉ build, token/phê duyệt theo exact SHA + scope, automatic merge chỉ sau lệnh deploy; kiểm thử không thay đổi sản phẩm đang vận hành |
| **D167-AGENT-AUTO-SKU** | Tự tải `REPORT_BIN_INVENTORY` qua browser Supra riêng sau Agent chính ổn định, dùng service upload logic xác nhận conflict trực tiếp tại Agent | **DEFERRED / ANALYZE ONLY — NOT CODED OR DEPLOYED** | Source `D166-AGENT-AUTOMATIC-DAILY-SKU-BROWSER`, D126 manual-only conflict; login/session, 05:00, chỉ PRIMARY, UI Search/Export, file validation, idempotency/import và xác nhận trùng/đổi tên; không tự động hóa trước Owner duyệt |
| **D167-AS-OF-LOCATION-REPORT** | Phân nhóm LTA/Shelving và vị trí đúng tại ngày báo, báo cáo SKU/khu vực thiếu nhiều | **DEFERRED / ANALYZE ONLY — NOT IMPLEMENTED** | Source `D166-LOCATION-AS-OF-REPORT-ANALYTICS`; phải có nguồn lịch sử đáng tin, scope SKU+name hiện tại không cho phép tự mở rộng location/bin/pickface/WMS; Owner duyệt thiết kế và quyền trước code |

**Mốc cần rõ:** D166 phát hành code của tám mục tích hợp; D167 phải **kiểm định trước khi quyết định sửa tiếp**, không tái triển khai trùng hạng mục. Riêng hai ý tưởng Auto SKU và LTA/Shelving là **tạm hoãn toàn bộ phần code**, không phải D166 phát hành thiếu nghiệm thu.

## 4. Gói chứng cứ D167 chờ Owner cung cấp khi có sẵn

- **Logs** ngày vận hành, 06:00–22:00 Việt Nam; Agent đang chính và máy phụ, Web, Android, ZIP Usage thủ công, các mốc đổi PRIMARY/restart/gián đoạn, và giờ xảy ra lỗi cụ thể.
- **Provider measurements**: Firestore read/write/delete (nhận diện billable documents, không trộn API requests), RTDB, Cloudflare Worker/DO SQL rows/read/write/compute và account-level billing, Drive/Apps Script, các ảnh service chưa export được, phiên bản runtime quan sát được.
- **Hoạt động thực tế**: số Agent/PDA online theo thời gian, số Picklist gửi/xác nhận/ACK, số SKU báo/trạng thái, phát hành/cài đặt, các đợt nghỉ ca và reload; mẫu đối chiếu đủ điều kiện để so per 1,000 business transactions và per active-hour.
- **Không đòi Owner thao tác ngay**: chờ dữ liệu được Owner gửi; không tự dựng thống kê, không gọi provider polling thường xuyên, không thay đổi service khi thu thập.

## 5. Gate D167

`BACKLOG OPEN` **không đồng nghĩa `CODE APPROVED`**. Sau khi có bằng chứng, AI thực hiện so sánh, tách nguyên nhân chứng minh vs nghi ngờ, lập phương án thay đổi, tác động component/nguồn lực/privacy/quota/rollback, ưu tiên theo mức rủi ro và hỏi Owner quyết định mục nào làm. Lệnh `chạy code` chỉ mở code PR đến CODE READY, chưa deploy; lệnh kết hợp `chạy code và triển khai` cho phép tự làm cả hai sau tất cả CI PASS trong phạm vi được chốt. Những vấn đề không được chốt giữ nguyên backlog D167. Stable luôn Owner-gated.

## 6. Nguồn canonical & đối chiếu

- `docs/D166_APPROVED_BACKLOG.md` — hạng mục và eight-candidate integration, PR #541.
- `docs/D166_USAGE_AUDIT_2026-10-06_08.md`, `docs/D166_USAGE_EVIDENCE_EXPORT_PROPOSAL.md`, `docs/D166_LAUNCHER_LOG_SERVICE_DIAGNOSTICS.md`.
- `docs/specs/OBSERVABILITY_LOGGING.md`, `docs/specs/REPORTING_DASHBOARD.md`, `docs/specs/ACCEPTANCE_TESTING.md`.
- `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`, `docs/OPERATING_PROTOCOL.md`, `docs/OWNER_DECISIONS.md`, `ops/project-state.json` và `ops/owner-actions.json`.
- D166 release proof: `docs/OWNER_DECISIONS.md` 2026-10-10, public manifest readback and GitHub main history.

**Mọi phát hiện D167 cập nhật chính backlog/decision/spec/state trong cùng nhánh change; không thay đổi resource/provider/app trong lần mở backlog này.**

## 2026-10-10 — Isolated one-button SKU test candidate

Owner limits Phase 0 to real WMS SKU+name export and direct Inventory Service import. No location/Shelving/LTA, daily automation or normal Agent release. Draft PR #549 prepares a standalone Windows one-button IPC requester and a narrow Beta Service AGENT import-auth code change; neither is deployed. Main Agent currently lacks the IPC broker. Consequently the test can verify local IPC only, and no WMS download or Service commit has been demonstrated. An approved minimal bridge or a separately authenticated WMS test session remains necessary for truthful field E2E.


## 2026-10-10 — Owner approves Option 2: independent LIVE-capable SKU test EXE

Supersedes the earlier D167 IPC-only experiment: implement the standalone EXE with **own isolated Edge Supra login + own Beta Firebase WEB login**, then one-click HMAC-signed exportBinStocks GET, XLSX SKU/name extraction, Service import preview/apply in ≤1,000 SKU chunks, readback confirmation. The EXE has no dependency on the existing main Agent session or an Agent broker. The branch reverted the unnecessary AGENT-channel Worker auth candidate. No Service/Worker deployment or Agent release required. Workbook-derived LTA/Shelving locations, automatic daily runs and reporting dashboards remain DEFERRED.

Evidence: Windows CI artifact and offline tests expected; live WMS export HTTP 200 and Beta Service writes need explicit field test. Current status CODE-ONLY, NO MAIN MERGE/DEPLOY, FIELD E2E NOT RUN.

## 2026-10-10 — Owner field screenshot: standalone SKU import E2E PASS, limited evidence

Owner supplied a test-window screenshot of the independent D167 application following real Supra/Inventory login. Observed log at 21:46 local workstation time:

- `File hợp lệ: 2492 SKU khác nhau`.
- `preview 3 lô` and `PREVIEW PASS: 3 lô; mới=5; khác tên=0`.
- `Service đã commit lô 1/3`, `2/3`, `3/3` with no rejected chunks.
- `ĐỐI SOÁT PASS: 3 SKU mẫu trùng mã/tên đã gửi`.
- `DONE - ĐÃ GHI THẬT VÀO INVENTORY BETA: tổng=2492; mới=5; đổi tên=0; không đổi=2487. Không thay đổi vị trí.`

**Assessment**: one-click **standalone Beta SKU+name upload field workflow PASS by provided UI log**. This is stronger than earlier CI-only evidence: 2,492 SKU seen, 5 inserted, 2,487 unchanged, 3/3 acknowledged committed, 3 sampled SKU/names read back successfully. Screenshot is application-generated evidence; no separate direct service/database log inspection and **not an exhaustive 2,492-SKU readback**. It does not prove a scheduled unattended daily run, location snapshots or Confirm Picklist regression acceptance.

**Owner PASS governance**: screenshot proves the narrow field test success, but is not an explicit Owner declaration accepting **all** D167 backlog requirements. D167 remains open, draft PR remains unmerged, Stable unchanged, no automatic integration or deployment authorized.

**Canonical scope exception pending**: `ops/project-scope.json` still declares `supra-api-d080.allowed_stock_export = FORBIDDEN_D126`. Owner has since approved D167's isolated read-only test, which has produced evidence, but the guard has not been reconciled. Before a permanent/main Agent scheduled sync or any broader WMS API use, record a narrowly defined Owner-approved stock-export exception in scope and corresponding SKU/AUTH specs, without relaxing D126 production Confirm Picklist browser-only protection.

## 2026-10-10 — Additional D167 proposals A–F: Owner approval boundary

**A–D: Owner explicitly approved the proposed plan, NOT yet code/deploy.**
- **D167-A-WEB-RESULT-DATE-UX (APPROVED_DESIGN):** Remove duplicate lower result-status filter buttons beneath the top HAS_STOCK/SKIP_ALLOWED/CLOSED tabs; place presets Today/Yesterday/7-day/30-day and from/to/apply in a single responsive toolbar row. Preserve one status authority, existing bounded paged read model and correction controls.
- **D167-B-HR-SETTLE (APPROVED_DESIGN):** Google Drive Watch notifications currently trigger immediate `processHrSnapshot`, and partial 3-column entry can produce `INVALID_ROWS/HARD_BLOCK`; `hr-sync.ts` currently checks missing employee code/name but not missing contractor. Propose event coalescing + bounded stability/debounce for partial user edits, do not auto-apply incomplete rows, retain last valid snapshot, validate employee_code/display_name/contractor_name (subject to Owner confirming contractor nonblank for every row), distinguish short `WAITING_FOR_COMPLETION` from genuine persistent invalid source; protect duplicates/source corruption and DO quota. Illustrative settle 30 seconds, bounded persistent warning 2 minutes; not yet live-configured.
- **D167-C-LOG-DATE-RANGE (APPROVED_DESIGN):** Replace 30/60/90 day UI controls with VN calendar start/end. Audit log uses SQL date index and existing pagination; Web/Android runtime logs use DO buffer indexed by source and received_at. No unbounded historical fetch or claim of >90-day retention. Existing audit/runtime buffer prune at 90 days; historical Drive archival requires separate accessible read scope/design. Manual range apply only, not polling.
- **D167-D-LAST-LOGIN (APPROVED_DESIGN):** Show last successful login date/time and channel in managed-account list. Existing Web/Android `*_session_started_at` are active-session fields cleared at logout, not true durable last login. Proposed indexed/durable `last_login_at`/channel or equivalent; one write per confirmed login event, never per refresh/heartbeat; account list adds fields to same bounded API. AGENT channel requires authorized identity path to be verified; no bulk Firebase reads.
 
**E–F: New Owner requests for detailed analysis/proposal, not a code approval.**
- **D167-E-MEAL-PAUSE (PROPOSAL_ONLY):** At 10:55 VN, Reporter MUST select one lunch interval 11:00–11:30 or 11:30–12:00; at 17:55 VN select 18:00–18:30 or 18:30–19:00. One service-authoritative first valid confirmation/day/meal via atomic CAS, broadcast realtime dismissal to all Reporter clients; pending choice persists for offline/newly connected client. Only AUTO-SKIP elapsed SLA minutes pause inside selected meal; Picker reporting and manual Reporter outcomes continue. Preserve distinct FIRST_REPORT/PER_PICKER deadlines and explicit correction window unchanged. Ex: 10-minute timeout, lunch 11:30–12:00: reported 11:25=>12:05; 11:35/11:55=>12:10. Consider fail-closed no-confirmation hold over whole candidate hour with admin escalation (requires Owner approval because it can delay automatic skip beyond 30 minutes). Reconcile old/new deadlines and next DO Alarm atomically; no per-device timer writes.
- **D167-F-OVERDUE-REMINDED-DAY-CLOSE (PROPOSAL_ONLY):** PER_PICKER overdue is only picker-granted skip: SKU batch stays PENDING. Persist first_overdue_at for the batch/episode, never reset on later Picker joining. If not human-resolved, once-only serious reminder at +30 min, second at +60 min, suppressed/cancelled by terminal outcome. Show persistent actionable reporter notification, grouped FCM best-effort, no 30-minute polling. At exactly 03:00 VN on day N+1 close eligible still-PENDING batch whose *first-report VN business day* is N and has an overdue Picker. Mark batch SKIP_ALLOWED with `SYSTEM_DAY_END` separate from `SYSTEM_TIMEOUT`, audit + result event/snapshot + appropriate Picker notifications; don't duplicate preexisting ticket timeout result/ACK. If any OPEN non-overdue tickets belong to the same overdue batch, owner-proposed close-out resolves them too (explicit stronger-than-PER_PICKER rule). No override of human HAS_STOCK/manual SKIP/withdrawn; conditional transaction and idempotency with alarm catch-up. Reporting uses day of `first_report_at` for business grouping while preserving real `resolved_at` 03:00 N+1. Current Web result tabs filter `COALESCE(resolved_at,updated_at)`, inconsistent with current detailed reporting's `first_report_at` predicate; resolve consistently before field release. A still-PENDING N batch may absorb N+1 reports of same SKU under current `business-core.ts`; design date-isolated handling without duplicate OPEN picker tickets before rollout.
- **Evidence/risks:** `service/src/sla-automation.ts` is authoritative for deadline and alarm (not Web clocks); `operational-v2-core.ts` provides first overdue as MIN ticket time; `business-core.ts` currently reuses PENDING SKU independent of day; `reporterRecent` currently filters by resolution time; meal pause / 03:00 may alter user-facing Skip timing and require regression tests for cross-midnight, HA, correction, realtime/FCM/ACK and quota.
- **Controls:** no code mutation for E/F before Owner selects final fallback policy and approves code. Existing D167 code-only vs deploy separation continues; Stable OWNER-GATED, no new unregistered resources.
