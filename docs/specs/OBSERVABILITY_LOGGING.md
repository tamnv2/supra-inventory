## D173-E049 — Persistent aggregate telemetry (25/10/2026)

D166 SQL Cursor 15 allowlisted query_id và D167 method/route-family/ALARM được persist trong cùng SQLite InventoryCore theo bucket giờ, retention 35 ngày, snapshot mặc định 36 giờ, không mất khi isolate restart nếu storage ghi thành công. Ghi 1 SQLite upsert cho mỗi event đã đo; trả metric về chi phí tăng thêm, phân biệt DO-observed và Cloudflare billed Worker total, nêu coverage/fallback persistence failures. Không ghi raw SQL, tham số, URL query, thông tin cá nhân, payload, session hay bí mật. Trường hợp persistence lỗi không ảnh hưởng nghiệp vụ nhưng phải báo degraded, không đánh dấu log đầy đủ. Worker chỉ deploy sau source+CI+quota/perf+D172 negative tests.

## D173-E047 — Agent fallback count; Worker/DO durable diagnostics chưa thực thi (25/10/2026)

Agent146 bổ sung `NEXT_A_FIRESTORE_FALLBACK` có nguyên nhân `RTDB_NOT_FRESH` hoặc `OFFICE_NO_RTDB` bằng đúng bộ đếm cục bộ HA đã tồn tại, chỉ đếm tại đường rẽ thật sự gọi kiểm tra lease Firestore; RTDB vẫn lưu timeout, mã lỗi, retry và recovered duration. Không thêm polling/provider request. Worker D166 SQL Cursor / D167 route counters hiện chỉ trong RAM nên mất qua isolate restart: chưa đáp ứng yêu cầu bền vững. Khi bổ sung lưu bền vững bắt buộc dùng tài nguyên có trong scope, giới hạn mẫu, bảo đảm không log payload/SQL raw/phiên; đo thêm Rows Written, latency và bảo vệ D172 chung DO. Không suy diễn log in-memory là đã ghi bền vững.

## D173-E022 — Log Đợt 1 trước phân tích Đợt 2

Reporter lưu counter bounded và 32 frame gần nhất (báo số frame bị đẩy ra), sequence/revision, snapshot stale, badge, scroll anchor và Overdue success/error; Agent ghi elapsed_ms và trạng thái PASS/UNAVAILABLE/DISCARDED_SESSION_CHANGED của Reporter roster. Không ghi SKU/tài khoản/token/phiên; không thêm request hay timer chỉ để log; gửi theo lịch hiện hành. Đợt 2 chỉ phân tích khi đã có ít nhất 3 ngày vận hành thật cùng version và usage Cloudflare/Firestore/Agent/Web/Android, báo coverage/overflow trước kết luận.

## D173-E017 — Log chẩn đoán cho Đợt 1, Đợt 2 sau field (Owner 24/10/2026)

- Giữ nguyên các mốc gửi log 13:15 và 21:15 giờ Việt Nam, thêm gửi theo yêu cầu/hết phiên như hiện hành. Không thêm timer, polling, DO/Firebase read/write chỉ để đo. Log gửi tới Drive phải có receipt trước khi prune; tránh snapshot server-only bị hiểu nhầm có log trình duyệt.
- Reporter vc117-derived: counter bounded cho REFRESH_APPLIED/STALE/ERROR, realtime seq/revision, badge, snapshot mismatch, scroll anchor retained/missing; frame count/seq/revision tối đa 32 mẫu, báo omitted/overflow/restart, không lưu SKU, tên, token hoặc payload.
- Android Picker: ghi các giai đoạn FCM received, attached, actually displayed, suppression reason và app warm/cold resume; không tự đánh dấu displayed từ việc nhận message. Ghi log tiến trình OTA theo các pha downloaded/sha/signer/installer và lý do thất bại, không bao giờ đưa signed payload vào log.
- Agent: phân tách PRIMARY/standby, Office/Internet, RTDB observer timeout và fallback/lease, WMS commit và ACK terminal; Reporter presence snapshot nguồn socket hợp lệ, độ trễ/phân loại lỗi 401/403/network trong allowlist. Không đưa Reporter vào count hoặc quyền hành động Picker.
- Worker/DO: sử dụng D166 SQL Cursor hiện hữu (15 query_id) với số lần, rowsRead/rowsWritten, latency/coverage/reset, không tạo SQL scan hoặc cron đo mới. Khi đối chiếu Cloudflare 24h/cycle, chỉ tổng hợp cùng cửa sổ và workload; DO namespace bao gồm tài nguyên vật lý dùng chung D172.
- Web: phân biệt server checkpoint no-browser-session và browser local errors khi trình duyệt kết nối trở lại; giới hạn route family/status, loại bỏ URL query/user IDs/IP và secrets.
- Acceptance: chỉ coi log đủ để xử lý B khi có tối thiểu ba ngày làm việc sau Đợt 1 với coverage và overflow minh bạch, matched provider usage, Reporter/Picker/Agent/Worker/Firebase cùng version và thời gian. Nếu log thiếu, giữ B HOLD, bổ sung tối thiểu chứ không tự sửa SQL/realtime/HA.

Release gate và aftershift legacy guard: docs/D173_E017_AFTERSHIFT_LEGACY_PHASE1_PHASE2_2026-10-24.md. Đợt 1 PR713→714→715→717 chưa được đồng nhất với field PASS; D172 giữ riêng PENDING/HOLD; Stable OWNER-GATED.

## D171-E039 — Client/Worker two-slot diagnostic log SOURCE contract

Owner approves CODE ONLY (20 Oct 2026), using existing D171 PR656 and registered provider resources; no runtime/provider deploy before separate Owner command.

| Component | Source implementation | Caveat/retry/receipt |
| --- | --- | --- |
| Agent v140 candidate | `AgentLogUploadBridge.DueSlot` + local minute due guard | 13:15/21:15 VN start, deterministic 0–15m jitter by instance, local pending bundles, 15m bounded repeat, `GOOGLE_APPS_SCRIPT` result is Drive-confirmed; Firestore fallback STAGED never prunes source until `DRIVE_SYNCED` |
| Android vc115 candidate | `D171DailyLogWorker` + `AndroidSupportLogResponder.sendDaily` | WorkManager renews 2 one-time slots with network constraint and 15m minimum backoff, Doze inexact; immutable per-slot journal snapshot to prevent Core bundle conflicts; up to 2 old logout/kick bundles flushed per scheduled boundary, delete only on Drive receipt |
| Browser Web 3.1.2 candidate | `runtime-logger.ts` | 13:15/21:15 VN slot, deterministic 0–15m spread, 15m retry bounded, immutable sealed payload in localStorage, clear only after `DRIVE_SYNCED`; browser closed cannot execute client upload |
| Worker server Web | `service/src/index.ts` existing `*/5` cron | 06:15/14:15 UTC (13:15/21:15 VN) small `SERVER_ONLY_NO_BROWSER_SESSION` checkpoint through existing runtime-log Core/Drive archive path even without browsers; five-minute retry archive stays. Does not make missing private browser logs materialize |
| Agent Office critical control | `D161AdminControl` and existing `ops/apps-script/agent-log-gateway/Code.gs` | Existing HTTPS Google fallback only on Worker network exception; Firebase role validation then Worker authoritative execution; no fallback on HTTP 401/403; new script revision not published |

Source DIAG logging events do not equal provider billed reads/writes and cannot be used alone for final usage cost. Shared Firebase/Cloudflare billing, cron and storage attribution require Owner screenshots and same-window archived logs. Support-log fan-out to offline/force-stopped agents cannot be guaranteed before devices reconnect; no fabricated delivery receipt. Preserve default D168 error/callback local logging and existing production version until Owner authorizes controlled publish.


## D171-E038 — Hai mốc log 13:15/21:15 VN, nhắc usage 21:30, forensic liên kết đa thiết bị

### Mục tiêu và nguyên tắc

Owner chốt hai mốc 13:15 và 21:15 theo Asia/Ho_Chi_Minh, log Android lúc user đăng xuất hoặc bị Kick, Agent gửi hai mốc, Web gửi phần máy chủ hai mốc kể cả không ai đang mở trang, và global Owner/Agent support request fanout không nghẽn. Nền tảng khi offline/đóng hẳn không thể bảo đảm gửi đúng phút: trạng thái phải rõ ràng, dữ liệu phải được lưu bền vững và gửi bù khi tiến trình có khả năng chạy. Log phải là lớp quan sát; không sửa nghiệp vụ PickList/ACK (20/35s, một request_id, generation CAS), WMS, HA 10s/15s, InventoryCore shortage authority hay SKU network switching.

### Hợp đồng log v3, trên các resource sẵn có

- Envelope allowlisted: `schema_version`, `source` (ANDROID / AGENT / WEB_SERVER / WEB_CLIENT), `software_version`, `day_vn`, `slot_vn` (1315 / 2115 / FORCED_LOGOUT / MANUAL_LOGOUT / GLOBAL_SUPPORT / CATCHUP), `bundle_id` stable, `trace_id` opaque, `sequence_first`, `sequence_last`, `captured_start_utc`, `captured_end_utc`, `provider_class` counters, `error_classes`, `retries`, `coverage`, `dropped_counts`, `archive_state`. Do not include raw user names, tokens, IP/SSID, WMS sessions/headers, actual SKU/PL, raw debug payload, screenshot, trace content. Source-local versions can coexist only with explicit backwards compatibility.
- Device/session scopes enforce currently authorized identity; ordinary Kick session revocation must not be undone. D163 one-generation Android Picker `INFO/session_end_logout` grace is the only presently approved exception and must not expand to arbitrary log commands.
- Local durable queue (encrypted/private storage when supported) stores sanitized sealed immutable bundle, stable ID and source cutoff; reload survives reboot/process kill. A server-side staging ACCEPTED response is not `DRIVE_SYNCED`. For Google Apps Script upload, use receipt with file id/archive id verified; for Worker/Firestore fallback, receive asynchronous authenticated `DRIVE_SYNCED` ack, and prune only files/event sequences through that exact receipt cutoff. Retain any newer log/event.
- Two daily logical sealed slots. Foreground client or Windows process schedules near 13:15 and 21:15 VN. For Android work in Doze and OS background throttling, schedule opportunistically and record `attempted_at`, `late_ms`; don't grant exact-alarm/battery exemption solely for logs. Worker existing 5-minute cron can seal WEB_SERVER event summary at matching 06:15 UTC/14:15 UTC with date-slot idempotency and no new cron resource. Web JS CLIENT journals cannot upload while browser completely shut, so retain and flush on later valid session; never mislabel the server snapshot as browser-device log.
- For each slot, stagger client attempts by bounded deterministic jitter (default 0–15 minutes from slot), keep no more than one in-flight upload per client. On eligible transport failure retain immutable bundle, retry after >=15 minutes for bounded rounds, then retain for next slot, login/foreground/network recovery. Never retry HTTP 401/403 endlessly or re-login automatically with stored password; distinguish auth invalid from network transport. A globally issued support request may use existing targeted FCM/Firestore active-session notification with 0–180s initial scatter and shared server-side command TTL/receipt; hard-offline and closed browser yield DEFERRED not fictitious SUCCESS.
- Use canonical existing InventoryCore/Worker Drive folder authority; archive filename/dedup based on logical VN log day, not provider screenshot capture date; no folder creation by Android/Agent. Dynamic batch size and device-level rate guards prevent hundreds of synchronous uploads. Keep 15m *eligible* retries bounded instead of endless attempts.
- Observe cost of logging itself: provider total HTTP/Worker/DO writes, Google Drive calls, cached archive retry, Firestore staging bytes/receipts, FCM count and per-client battery/network data. Track timeout/error/409/idempotent restore, pending age and archive lag. Goal zero new Firestore/RTDB write per event, max two routine bundles per active device/day excluding authorized manual/critical/logout catch-up. Actual billed counts need provider screenshots, never local extrapolation without confidence.

### Daily analysis protocol

At 21:30 VN ChatGPT reminder to Owner is already scheduled independent of app release. Owner supplies images of Firebase/Google Cloud and Cloudflare dashboard with project/account/service, metric units, complete time range. Compare screenshots with existing Google Drive `Inventory/Beta/Logs` archives of same timestamp and software version. Firestore free quota resets midnight Pacific time and screenshots 21:30 VN are PROVISIONAL; correct for Pacific billing day versus VN shift, provider ingestion delay and final after-midnight events. Report matrix: `provider`, `metric`, `actual`, `change_vs_baseline`, `app/agent/web covered_count`, `missing logs`, `suspected_hotspot`, `proof/confidence`, `performance/HA-risk`, `owner_decision`, `next_test`. Store only sanitized aggregated comparative reports, citations to private Drive artifacts by opaque locator when allowed, version+commit, no screenshots/raw logs/secrets in PUBLIC GitHub. Use branch→PR→authority+continuity PASS→Owner gate. No auto-optimization based on one day's noisy screenshot.

### Acceptance/release

- Matrix: 13:15/21:15 in background Agent tray, Android foreground/background/Doze/terminated, Web open/closed, Worker cron, Office proxy failure, Internet recovery, accidental reboot, revoked/kicked Picker, role switch, 0–500 devices simultaneous spread, Drive first-hop success but final receipt delayed, Google quota failure, duplicate retries and logout during ACK.
- For all slots assert no ACK delay regression, no duplicate WMS Confirm, no primary/failover mutation, no UI lock, no unbounded Firestore/Worker polling, no record loss before receipt, no double prune, no raw secrets, no 401/403 bypass, no unlimited local storage, and cost under verified budget targets.
- Cross-version: Agent v139/v140, Android vc114/vc115, Web 3.1.1/next 3.1.2, Worker current/proposed; verify compatibility while staged rolling release.
- A complete server+client refactor is *NOT IMPLEMENTED* by E038. Source/CI and release gates separate. Existing log source v140/vc115 and 3.1.1 telemetry had 22/22 CI; that does not prove new 13:15/21:15 scheduler.

### Office non-SKU audit boundary

Log features must NOT be used as an unauthenticated Office↔Worker data proxy. Existing Google Apps Script Agent Operations Gateway handles privileged OTP operations in source, Worker remains final authority; Kick-all Worker API currently direct only. Office Firestore REST via Windows system proxy proven for exact-doc only. Call/Chat Firestore writes have a source path but real PDA delivery not proven. Candidate shared Google HTTP relay (Apps Script reuse with quota/backoff or new narrowly registered Cloud Run function in existing project) must be scoped, authorized, preflight tested on Office proxy, idempotent and RBAC-safe before coding/deployment. SKU remains Internet-only via previously approved safe changeover. Function registration, IAM, deployment, cost and live bridge are NOT approved merely by this log scheduling decision.


## D171-E037 — Daily manual provider screenshots matched to archived logs; Web 3.1.2 gate

Operational workflow approved 20 Oct 2026: Owner supplies official Firebase/GCP and Cloudflare screenshots on each requested observation day. AI reads *available* scoped Google Drive Web/Android/Agent log bundles for the matching date/time window, optionally reads authorized provider-specific source metadata already cached, and writes a manual daily RCA summary. No autonomous screenshots, hourly provider fetch, reminder or scheduled task. Report input completeness (provider/project, source, time window and timezone, screenshot metric units, code version, log archive coverage, shared resource scope). Treat missing archives as missing evidence rather than zero events. Agent 21:45 local checkpoint may be LOCAL_PENDING; Web cannot upload at 21:45 while browser is closed; Android no four-times-daily INFO upload; app/agent/web RAM counters may reset on restart. Always normalize Firestore's daily Pacific-time reset separately from the VN operating day and the Cloudflare graph's displayed timezone. Compare like-for-like complete windows before calculating percentages.

Forensics output contract: observed provider billed usage by dimension (Firestore reads/writes/deletes; RTDB if eligible; Cloudflare Worker requests/CPU/errors, per-DO namespace requests/duration/SQL/storage; Google usage when explicitly within scoped resources), source-local observed client operation/callback estimates, daily and 7-day trend once data exists, measured denominator (PDA PickList, Picker shortage, Kick, Call, Chat) if evidenced, retry/reconnect/poll/failover/cron categories, root-cause confidence (PROVEN / SUPPORTED / UNKNOWN), and cost/performance-safe candidate optimizations. Do not impute per-route Cloudflare DO billing from local SQL cursor sample or per-SDK-listener billing from callbacks. Distinguish shared-account provider charges and service/provider limits, and avoid double-counting client retry vs provider operation.

Owner's suggested next Web release label is **3.1.2** instead of reusing already-deployed **3.1.1**. E035 telemetry-only Web source still has version 3.1.1. Before any actual Web 3.1.2 release, change and verify all authoritative version fields with Web CI, release source SHA and gated deployment; this E037 note does not authorize code mutation, Worker deployment, Android/Agent OTA or production change.

Agent Office completeness remains an independent business workstream. D171 E035 instrumentation does not implement the Google Function/Worker bridge for Office-initiated Kick or privileged login, and has no physical end-to-end Office WMS/Call/Chat proof. No SKU business logic change.


## D171-E035 — Thu thập log/usage App, Web, Agent, không gia tăng provider traffic (20/10/2026)

Owner confirms the historical Office operational target in D168-E016/E017 and D171-E018/E022 and orders enhanced App/Web/Agent usage/error logging. Implement CODE ONLY on existing D171 PR #656. Do not change the selected Firestore one-job/one-ACK protocol, Agent PRIMARY CAS/WMS, Worker/InventoryCore business authority, SKU transport, existing auto-upload policy or provider resources. Office Worker-dependant Kick/OTP end-to-end remains unproven; logs shall separate action requested, transport available, backend-authoritative receipt and PDA delivery rather than mark a transport HTTP success as business PASS.

The logging scope is diagnostic-first; no new network requests, per-event paid writes, polling, background upload, listeners, cloud functions or new storage schemas. Existing authorized error/manual/21:45/global support log boundaries are reused.

- Android: D166UsageAudit local allowlisted, hourly SDK/transport callback buckets for Firebase Auth custom sign-in, two Picker call/session/chat document listeners, PickList create/uncertain/retry, exact-job ACK listener/ACK/timeout, one-shot recovery read and Cloudflare WebSocket reconnect. Captured callbacks are NOT billable Firestore document read counts. Limit unique bucket keys, count dropped buckets, redact identities and exclude exact PL/SKU.
- Web: cumulative per-process, per-hour counters built only from existing API/realtime/performance events (not merely last 420 events), fixed category+safe-name allowlist, bounded 180 buckets and evicted bucket count. Append to existing log snapshot; do not persist per event or change upload cadence. Web reload resets counters, existing retained journal remains source of recent event detail.
- Agent: reuse local FirestoreQuotaGuard REST count and outcome timing; add gRPC PENDING/HANDOFF/AGENT_SYNC OPEN/CONNECTED/DOCUMENT/RECONNECT/FAILED lifecycle counts into the existing sealed Agent log snapshot. Document callbacks are NOT billed reads, and the counter intentionally cannot see hidden SDK/Rules/index reads. Preserve 10s lease, 15s suspect/failover, single WMS executor and REST watchdog cadence.
- Service evidence remains current D166/D167 Worker/InventoryCore allowlisted route and SQL process-local samples. Cloudflare Workers billable usage and Firebase/GCP provider time series are external verification, not synthesized by client log. Shared-account billable usage must not be labeled Inventory-only; unavailable DO namespace attribution is explicitly UNKNOWN.

**Acceptance matrix (no invented PASS):**

| Requirement | Contract | Test/evidence |
|---|---|---|
| Android callback coverage | No extra Firestore job/listener/read, exactly one durable request/ACK | Signed vc115 CI + Android source contracts + real-device field logs pending |
| Agent listener coverage | gRPC callbacks counted locally, HA/REST/WMS untouched | Windows build/HA mixed-version regression; 10s lease and fencing verified in source; production Office gRPC pending |
| Web event counters | No extra fetch/WebSocket or background upload | Web TypeScript build, telemetry and redaction test; post-reload loss clearly indicated |
| Bounded privacy | Fixed labels, no raw URL/query identifiers, secrets, WMS data or user-input payload | Static redaction and log-size reviews |
| Cost correctness | Client counters never represented as Firebase/Cloudflare billable totals | Per-provider same-shift dashboard/time series + scope reconciliation; PENDING |
| Performance and recoverability | No hot-path I/O, changes fail open for diagnostics but business fail-safe as before | CI replay 6 Agent/40 PDA, fault/restart and real-device measurement pending |

This milestone is code instrumentation, not proof of FULL end-to-end root-cause coverage, complete bill allocation or Office full-workflow PASS. Release and stable gates unchanged.

## D171-E012 — Giảm đọc chẩn đoán (19/10/2026)

Không quét lại toàn bộ messages/receipts ngày qua mỗi lần polling; client thử dùng Firestore query theo `created_at` và cửa sổ chồng lấn ngắn, giữ dedupe request-id. Hiển thị bộ đếm local GET/query và dừng có lý do khi quá trần chẩn đoán; số operation phía client KHÔNG phải số document read được tính phí. Giữ log chi tiết 5 vòng, hai Agent A/B và network route, tránh lặp hàng trăm log phase mismatch.

## D171 — Log chẩn đoán đa thiết bị, không chứa dữ liệu nghiệp vụ (19/10/2026)

Mỗi EXE ghi JSONL riêng tại máy Windows và PDA ghi private log/cho phép chia sẻ an toàn; gắn test session, request_id, phase, network_epoch, vai trò, thời gian gửi/nhận, phản hồi ACK, timeout, retry, replica identity dạng ẩn danh. Tuyệt đối không ghi username đã đăng nhập, SSID/IP thực, passwords, Firebase token, WMS session, private device key, real Picklist hoặc dữ liệu Picker. Phân biệt `SERVER_ACCEPTED_NOT_ACK`, `ACK_PASS`, `ACK_TIMEOUT`, `NETWORK_OPERATOR_CONFIRMED` và `NETWORK_MEASURED`. Một mạng được operator xác nhận chưa phải bằng chứng tự động SSID đổi. Không tự xóa test session trước bước chấp thuận log archive, không ghi log sang collection nghiệp vụ. Ước lượng Firestore read/write theo lớp API và chỉ coi provider billing số đo khi có biên nhận thực.

# OBSERVABILITY & SUPPORT LOGGING — D161

Status: **OWNER-APPROVED D161 REQUIREMENTS / IMPLEMENTATION ACTIVE — PHASE 0A PASS / PHASE 0 SAFETY PASS**.

This specification defines the D161 observability and support-log model for **Web, Android/PDA and Windows Agent**. It extends the existing D161 unified support-log lifecycle. Where this document adds capture/schema/correlation requirements, it is authoritative for D161. Existing daily Drive archive, Drive-confirmed pruning, global log collection, Beta resource scope and Stable guard remain in force unless explicitly superseded here.

The exact Owner command `bắt đầu D161 tiến hành` was received on 2026-10-04. Phase 0A and Phase 0 Safety are PASS; feature-bearing D161 implementation is active. D160 behavior remains the rescue/accepted base until explicit Owner field acceptance.

## 1. Goals

D161 logging must make it possible to reconstruct, with bounded uncertainty:

- what the user/client attempted;
- which version/build/device/session handled it;
- which server/provider path was used;
- every major stage and latency contribution;
- retries, dedupe, recovery and fail-closed decisions;
- realtime/connectivity/HA/schedule transitions;
- business outcome and durable acknowledgement;
- whether evidence was dropped, compacted, still local, buffered server-side or archived to Drive.

The design is for diagnosis, performance optimization, usage analysis and regression detection. It must not become a new business transport, polling loop or provider-write stream.

## 2. Non-goals

Logging must not:

- create offline business behavior or an offline mutation outbox;
- add per-event Firestore/Drive/Google writes;
- add provider polling/listener cadence;
- capture raw secrets/session material;
- capture raw HTML, screenshots, clipboard contents or full HTTP request/response bodies;
- change business outcome solely because logging failed.

## 3. Common event envelope — schema v2

Every platform should emit the same logical envelope, using only fields meaningful to that event:

- `schema_version=2`
- `event_id`: local unique ID for the event.
- `sequence`: monotonically increasing sequence within the current process/journal generation.
- `generated_at_utc`: client event time in UTC.
- `monotonic_ms`: elapsed monotonic time since current process/app start where available.
- `received_at_utc`: trusted server/archive receive time when the event/bundle reaches server infrastructure.
- `source`: `WEB | ANDROID | AGENT`.
- `environment`: `BETA` for D161 implementation unless later authority changes it.
- `app_version` / `build`: Web Version, Android vc/build, or Agent runtime version/build.
- `device_instance_id`: stable application-generated identifier or existing Agent instance identifier; never a hardware serial.
- `device_label`: bounded non-secret operational label when useful.
- `process_id` or process generation where useful; no OS user credential.
- `session_generation`: application session generation when already available.
- `role`: PICKER/REPORTER/ADMIN/ROOT or Agent authenticated role when applicable.
- `actor_id`: application user ID / employee code only when operationally required; never password, display-name contact data or authentication credential. Pre-login typed username is not logged as input content.
- `trace_id`: cross-component business/support correlation ID.
- `span_id` and optional `parent_span_id`: local stage correlation when useful.
- `component`: stable component name.
- `category`: lifecycle/auth/network/api/realtime/ui/business/confirm/wms/ha/schedule/update/logging/performance/storage/etc.
- `event_name`: stable machine-readable event.
- `phase`: optional stable phase/stage.
- `outcome`: PASS/FAIL/DEFER/SUPERSEDED/UNCERTAIN/CONFIRMED/etc.
- `duration_ms`: stage duration when measured.
- `attempt`: retry/attempt number when relevant.
- `provider` and `operation`: safe provider/operation names, never auth headers or secrets.
- `metrics`: bounded numeric counters/timings.
- `data`: bounded allow-listed structured detail.
- `message`: optional sanitized human-readable summary.

Storage-level severity may remain compatible with the existing INFO/ERROR path. Richer classification such as warning/fatal/incident is carried in category/outcome/importance fields rather than forcing an unsafe destructive schema migration.

## 4. Correlation rules

### 4.1 Business trace IDs

Use an already-existing business/request identity whenever available; do not create provider operations just to obtain one.

- PickList confirmation: Firestore `request_id` is the end-to-end trace key from Android → Firestore transport → Agent → ACK → Android.
- Shortage report/resolution: use the authoritative report/event identity.
- Global support-log collection: use the global `request_id`.
- Update/install: one local update operation ID per explicit check/download/install flow.
- Login/logout/session restore: one local session operation ID.

### 4.2 Sequence and gap detection

Every persisted journal maintains a monotonic sequence. Every bundle records:

- `first_sequence`
- `last_sequence`
- `event_count`
- `dropped_event_count`
- `compacted_repeat_count`

If a bounded journal must evict low-priority data, it emits/retains a `LOG_BUFFER_DROP` summary so analysis can distinguish “no event happened” from “evidence was lost due to capacity”.

### 4.3 Clock handling

Cross-device analysis must never rely on wall-clock timestamps alone.

- Keep client UTC time.
- Keep monotonic elapsed time for stage duration.
- Keep trusted server/archive `received_at_utc`.
- Reuse an already-known server offset/version when a component has one; do not add a network call solely for clock synchronization.
- Logs should record `clock_offset_ms` only when derived from an existing trusted exchange.

## 5. Security, privacy and redaction

Logging is allow-list first and regex-redaction second. Client and trusted server/archive layers both sanitize.

Never record:

- passwords or password field contents;
- Authorization/Bearer headers;
- Firebase/Google/WMS access, ID, refresh or session tokens;
- cookies or browser session material;
- OAuth client secrets, API keys, private keys, service-account JSON;
- Android signing/keystore material or Windows signing material;
- raw company-WMS session/request headers;
- raw HTML/DOM dumps, screenshots, clipboard contents;
- raw HTTP request/response bodies by default;
- full PickList codes or PickList suffixes;
- raw query parameter values;
- Wi-Fi SSID/BSSID, MAC address or local/public IP address;
- arbitrary text typed into form inputs.

Additional rules:

- PickList values are represented by request_id and/or a one-way bounded fingerprint, never the raw PL value.
- URL logging uses route/path plus query-key names only; query values are excluded.
- Exception stacks are permitted only after path/session/secret sanitization. Local OS user-home names should be stripped.
- Web DOM telemetry records semantic control identity/action, not field values.
- Android device information is limited to model/OS/app/runtime capability needed for diagnosis; no hardware serial/IMEI.
- No secret or sensitive runtime payload may be committed to the public repository.

## 6. Capture policy: preserve useful evidence without provider spam

### 6.1 Local-first journal

Web, Android and Agent collect structured evidence locally/in memory first. Recording an event itself causes **zero provider write**.

Business/auth/error/confirm/recovery events are never sampled away. Noisy UI/performance repetitions may be compacted using:

- stable fingerprint;
- first occurrence time;
- last occurrence time;
- repeat count;
- bounded sample of durations.

Immediate upload suppression affects only upload frequency; it must not silently erase the local incident history.

### 6.2 Upload/seal boundaries

Use existing channels and bounded triggers:

- crash/fatal error: immediate best-effort seal/upload;
- significant error/incident: immediate best-effort, fingerprint/debounce protected;
- PickList `UNCERTAIN`, unexpected `CONFLICT`, recovery timeout or HA safety anomaly: incident boundary eligible for immediate bundle;
- logout/session end: final session bundle;
- manual support request: immediate bundle;
- global support-log request: unsynced evidence + current snapshot;
- Agent: existing dirty/size checkpoint plus 21:45 boundary;
- Android: no return to four full periodic INFO uploads; keep local journal and use logout/error/crash/manual/global plus one bounded end-of-day safety checkpoint when authenticated and unsynced useful evidence exists;
- Web: keep bounded scheduled support checkpoints plus error/manual/global collection; new persistent incident journal may survive reload.

No new polling loop is authorized.

## 7. Bundle envelope and Drive archive

Each uploaded bundle contains:

- schema version;
- bundle ID;
- source/platform;
- kind: `error | crash | incident | session | checkpoint | manual | global`;
- device/instance identifier;
- app/build version;
- first/last generated time;
- first/last sequence;
- event count;
- dropped/compacted counters;
- content hash;
- events and current bounded snapshot.

Archive rules remain:

- parent: existing scoped `Inventory/Beta/Logs`;
- trusted archive layer resolves `YYYY-MM-DD` using actual archive date in `Asia/Ho_Chi_Minh`;
- clients never independently list/create daily folders;
- duplicate detection stays inside the resolved day folder;
- Android/Agent local evidence is pruned only after positive `DRIVE_SYNCED` confirmation;
- intermediate Worker/Core/Firestore acceptance is not prune authority.

Recommended file pattern is collision-safe and analysis-friendly, for example:
`<kind>_<source>_<device-alias>_<yyyyMMdd_HHmmss>_<bundle-short-id>.jsonl`
or an equivalent JSON bundle where current compatibility requires it.

The exact extension may stay platform-compatible, but the inner event schema must be v2 and machine-parseable.

## 8. Web observability

Web must preserve the current runtime-logger strengths and extend them with cross-platform correlation and reload-surviving incident context.

Capture at minimum:

### Lifecycle/session/auth
- logger initialized;
- Web version/build;
- page start/visibility/background/foreground;
- login start/result without credential values;
- restored session result;
- token/session refresh result and duration;
- role/session-generation changes;
- logout start/stage/result;
- session invalidation/replacement reason.

### API
For every business API call:
- safe route name/path;
- method;
- trace/request ID when available;
- start/end;
- HTTP status;
- duration;
- retry number/retry reason;
- request/response byte counts when cheaply available;
- error class/code;
- no headers/body/query values.

### Realtime
- websocket/connect status;
- reconnect reason/count;
- subscription/scope version;
- last event age/lag;
- gap/dedupe/resync decisions;
- server version/event identity where already present;
- time from server event to UI apply.

### UI/business
- semantic click/submit/change action name, never typed values;
- navigation/section changes;
- date preset chosen and resulting authoritative date range;
- report/resolution/SKIP correction actions and result;
- HR-sync workflow decisions/threshold path;
- permissions/settings changes;
- render duration for major tables/cards/dialogs;
- count of rows/entities rendered, not full table contents.

### Performance
- navigation/paint timings;
- long tasks;
- slow API/resource paths using safe URL summaries;
- viewport/basic browser capability;
- JS memory when supported;
- DOM/table row counts;
- application state summary counts/statuses, not secret/raw business payload dumps.

### Persistence
D161 permits a bounded diagnostics-only Web journal that survives reload/crash (for example IndexedDB or equivalent bounded storage). Target size is roughly 0.5–1 MiB, implementation may choose the smallest reliable bound. This does **not** create offline business mode.

The existing one-error pending slot must not remain the only reload-surviving evidence; multiple unsent incidents need bounded FIFO preservation.

## 9. Android/PDA observability

Android keeps a bounded persistent journal, target order of magnitude **1–2 MiB**, with crash-safe append/rotation and sequence/gap metadata.

Capture at minimum:

### App lifecycle and device runtime
- process/app start, resume, pause/background, stop;
- app versionCode/versionName;
- Android version, device model, screen class;
- process uptime and bounded memory snapshot at significant boundaries;
- app restart/previous unclean exit;
- network type/state transitions without SSID/IP/MAC.

### Login/session/role
- login start/result and latency;
- restore-session start/result;
- token/session refresh and generation;
- role/capability reconciliation;
- shortage-reporting permission/capability state changes;
- logout confirmation/start/network-cleanup stages/local completion;
- forced logout/session revoke reason.

### Required Android permissions/readiness
- notification permission status;
- overlay permission;
- DND access;
- battery-optimization/Doze-relevant state when it affects alert delivery;
- permission test result and duration;
- notification/full-screen/overlay fallback chosen.

### API/realtime/FCM
- safe API route/method/status/duration/retry;
- realtime connect/reconnect/last-event-age;
- FCM receive type/message class, app foreground/background state, processing latency;
- notification/overlay display attempt/result;
- acknowledgement/drain result;
- no notification payload body beyond allow-listed IDs/status.

### Business flows
- SKU cache sync start/result/count/version/duration;
- shortage report start/result;
- reporter resolve/skip/correction;
- picker withdraw;
- schedule apply/reconcile/source/version;
- update-check/download/verify/install stages;
- UI render/action timing for major screens.

### PickList confirmation
Android must log the end-to-end request timeline using the same Firestore `request_id` as trace ID:

- button/action accepted;
- local validation result;
- request create start/pass/uncertain/recovery;
- Firestore auth/token repair stages;
- listener opened/error/reconnected;
- ACK first observed;
- final-read fallback if used;
- decoded terminal outcome;
- total RTT/E2E;
- timeout/fallback guidance;
- retry attempt and whether it reused the same request ID;
- no raw PickList suffix/code.

## 10. Windows Agent observability

Agent keeps the accepted complete local diagnostic stream, but D161 should make the canonical event lines structured/machine-parseable while retaining concise human-readable messages.

### Agent lifecycle/runtime
- process start/version/build/machine alias/instance ID;
- login/session restore/refresh/logout;
- browser/runtime/profile readiness;
- CPU/RAM/process/browser health snapshots at significant boundaries, not a high-frequency provider stream;
- update manual-check/download/verify/replace stages;
- log pending/seal/upload/Drive confirmation state.

### Firestore/transport/realtime
- listener open/connect/reconnect/close;
- REST fallback query start/end;
- safe-read attempt/route/classification;
- pending payload count;
- listener-vs-REST dedupe;
- transport online/offline;
- auth refresh/recovery;
- canonical Firestore error code, HTTP code and operation;
- quota-guard decision;
- provider-operation counters at existing checkpoints.

### HA/role
- role/generation before and after refresh;
- lease/primary/standby transition reason;
- handoff start/result;
- generation fence result;
- transport-health impact classification;
- stale/precondition/superseded classification;
- WMS readiness separately from schedule/control-plane state.

### WMS/browser
No raw HTML or PickList values. Capture:

- page epoch;
- canonical route state;
- navigation type;
- reload issued/reason/elapsed;
- reload soft barrier/extension/hard timeout;
- DOM ready;
- data hydrated;
- page size;
- visible row count;
- PickList-code count;
- checkbox count/disabled count;
- dialog count;
- success/error terminal-surface counts;
- browser reconnect state;
- last successful reload age;
- D157 health/reload clock state.

### PickList confirmation critical path

For every batch/wave, capture:

1. **QUEUE/HANDOFF**
   - jobs received;
   - max created/client age;
   - listener/REST source;
   - local handoff duration.

2. **BROWSER GATE**
   - operational-ready result;
   - request-age remaining budget;
   - handler pre-search duration.

3. **IMMEDIATE SCAN / CLASSIFICATION**
   - READY/MISSING/AMBIGUOUS/UNSELECTABLE/STATE_CHANGED/UNAVAILABLE counts;
   - no raw PL;
   - per-request classification correlated by request_id.

4. **FAST WAVE**
   - targets, dedupe/group count;
   - time to mutation preparation;
   - early terminal/ACK count.

5. **DEFERRED SEARCH/RECOVERY**
   - Search click count;
   - search duration;
   - DOM changed/stable;
   - one shared deferred recovery classification;
   - reload reason/timing;
   - post-reload hydration/page-size result.

6. **RATE LIMIT**
   - check duration;
   - clear/update duration;
   - strike/lock decision without credential data.

7. **CONFIRMATION GUARD**
   - claim/read duration;
   - acquired/already-confirmed/in-progress/uncertain;
   - guard release only for safe pre-final failure;
   - provider error classification.

8. **PRIMARY/GENERATION FENCE**
   - role/generation before mutation;
   - verification duration;
   - pass/block reason.

9. **MUTATION BUDGET**
   - max request age;
   - remaining E2E budget;
   - whether recovery/final mutation is still allowed;
   - 12-second mutation safety fence decision.

10. **WMS MUTATION**
    - target count;
    - exact-row count;
    - checkbox select duration/verification result;
    - foreign/stale/prechecked classification;
    - confirm-button wait duration;
    - dialog-ready duration;
    - one final business click timestamp.

11. **TERMINAL PROOF**
    - wait budget;
    - elapsed;
    - sample count;
    - first-signal latency;
    - fresh success/error surface counts;
    - same/mutated baseline terminal counts;
    - confirmed-marker target count;
    - final proof source: `FRESH_SUCCESS_SURFACE | ROW_CONFIRMED_MARKER | FRESH_ERROR | NO_PROOF`;
    - no row-disappearance success inference.

12. **POST TERMINAL CLEANUP**
    - clean-UI wait duration;
    - dirty state;
    - whether cleanup is on or off the critical ACK path.

13. **DURABLE ACK**
    - ACK start/end duration;
    - attempt count;
    - conditional-lost/recovered status;
    - durable result.

14. **TOTAL**
    - end-to-end total;
    - queue age;
    - batch duration;
    - result;
    - whether any evidence gap/drop occurred.

This stage breakdown is required so future optimization can identify whether latency belongs to queueing, rate-limit, WMS search, guard, HA fence, WMS dialog/terminal, cleanup or ACK.

## 11. D161 PickList optimization contract to protect with logging

Observability must explicitly prove these Owner-approved requirements:

- immediate DOM scan separates FAST READY from unresolved requests before slow Search/recovery;
- one ambiguous request never suppresses Search/recovery for a different missing/unselectable request;
- READY/other terminal outcomes receive early durable ACK before deferred recovery;
- unresolved requests share bounded recovery; no per-request F5 loop;
- max 15 is a ceiling, never an intentional “wait until batch fills” delay;
- duplicate listener/REST/batch deliveries do not cause duplicate WMS mutation;
- requests resolving to the same full PickList are grouped to one mutation target;
- recent terminal request dedupe remains effective;
- zero/unhydrated WMS data is `WMS_DATA_UNAVAILABLE`, never true NOT_FOUND/strike;
- WMS health proof requires a real hydrated/valid proof, not merely a responsive shell;
- multiple deadline gates preserve the 12-second mutation fence close to real WMS mutation;
- terminal observation remains passive and one-click-only;
- confirmed-marker proof and no-row-inference rules remain;
- schedule/control-plane state is distinguishable from temporary WMS mutation readiness;
- normal target remains 5–10 seconds E2E and hard PDA bound remains 20 seconds.

## 12. Upload backpressure and anti-spam

- Repeated identical incidents are fingerprinted.
- Local journals keep bounded evidence/counters even when immediate uploads are suppressed.
- Bundle suppression records `repeat_count`, first/last occurrence and the reason upload was suppressed.
- ERROR/business/confirm safety evidence has priority over low-value INFO/UI metrics when a journal is full.
- A failed older pending bundle blocks destructive prune of later evidence where ordering matters.
- Upload housekeeping cannot recursively trigger another upload boundary.

## 13. Global support-log collection

Existing D161 authority remains:

- only exact authenticated Agent logins `admin` and `tamnv2` expose the command;
- the Agent command is presented on the visible Settings Logs card and must not be hosted only on a detached page;
- backend revalidates authorization;
- one request has request_id, issued time, TTL and dedupe;
- only currently authenticated Web/Android/Agent clients respond;
- responders send unsynced evidence plus a current snapshot;
- Android/Agent use bounded jitter to avoid fleet burst;
- no per-device Firestore ACK write;
- Drive/archive arrival plus local diagnostics prove completion.

D161 v2 adds that every responder stamps the global request ID into the bundle `trace_id`, making one collection queryable across platforms.

## 14. Acceptance requirements

D161 must provide automated/fixture proof for:

- secret/redaction corpus: every banned credential/session/PL pattern is removed on client and server/archive layers;
- sequence/gap/drop accounting;
- Web reload retains bounded incident context;
- Android crash/restart retains bounded pre-crash context;
- Agent complete stream remains available locally if upload fails;
- intermediate buffer acceptance does not prune Android/Agent local evidence;
- Drive-synced confirmation permits prune;
- duplicate incidents do not cause one Drive file per repeated line;
- global collection correlates Web/Android/Agent by one request_id without per-device ACK writes;
- no logging feature increases Firestore/Google/WMS polling/listener cadence;
- business requests continue when logging is unavailable except where an existing mandatory safety/audit rule explicitly says otherwise;
- mixed-batch PickList fixtures and burst fixtures expose stage timings needed to verify the confirm contract.

## 15. Resource boundary

This design reuses existing scoped Beta resources and existing log archive/control paths. It authorizes **no new provider resource now**.

If D161 implementation proves that an additional persistent Firebase/Google/Cloudflare resource is unavoidable, stop that resource mutation, reconcile `ops/project-scope.json` and `ops/resource-registry.json`, perform impact/security/quota review and obtain Owner authority before provisioning.

Stable remains OWNER-GATED.


## 16. D161 integrity hardening approved 2026-10-04

### 16.1 Cross-platform archive idempotency
- Every sealable bundle has an immutable bundle_id.
- A logical boundary that can be re-entered (logout/session end, scheduled slot, Agent checkpoint/error boundary, global request) also carries a stable boundary_id or slot key.
- Trusted archive commit dedupes by logical bundle identity, not filename. Retry of an already archived bundle must converge to the existing durable object and DRIVE_SYNCED result without creating a duplicate Drive object.
- Web scheduled support checkpoints use a logical slot key rather than timestamped filename equality, so reload/re-entry cannot archive the same slot twice.
- Client-side single-flight is still required; server/archive idempotency is the final duplicate barrier.

### 16.2 Canonical severity/outcome semantics
- CONFIRMED and other expected business-success terminals are INFO/business evidence and do not create an immediate error bundle.
- Proven stale CAS/update-precondition conflicts are SUPERSEDED and do not degrade transport health.
- Temporary updater DNS/timeout/HTTP/channel-unavailable outcomes are DEFER/WARN; they remain locally recorded/compacted and do not by themselves create an immediate ERROR archive.
- Signer/hash/integrity mismatch, duplicate-mutation safety risk, confirmation-guard violation, post-click unsafe state, crash/fatal and comparable safety failures retain ERROR/INCIDENT/FATAL treatment.
- Repeated connectivity incidents are fingerprinted and compacted with first/last/repeat counters.

### 16.3 Confirm trace completeness
Once Agent has accepted/claimed a PickList request, its structured trace must converge to one explicit end class: ACKED_TERMINAL, SAFE_ABORT_PRE_MUTATION, UNCERTAIN_POST_MUTATION, HANDOFF, EXPIRED, or TRACE_GAP_DETECTED.

TRACE_GAP_DETECTED means evidence is incomplete. It never proves a business result, never releases a post-final confirmation guard and never authorizes a second WMS mutation.

### 16.4 Web journal session-generation isolation
Reload-surviving Web incident context is scoped to one authenticated session generation. Logout, account replacement or authoritative session-generation replacement rotates the journal. Old evidence may be archived under its original session identity but cannot be attached to the next user.

## D161 field-retest diagnostic completeness — WMS-not-ready and Agent control failures

For a PDA confirmation request observed by an authenticated Agent, local History and structured diagnostics must never remain blank merely because Web Confirm is not ready. The request trace records ingress and converges to the explicit pre-mutation terminal **WMS_SESSION_REQUIRED / WEB_CONFIRM_NOT_READY**, rendered to operators as **Web Agent chưa sẵn sàng**. Other known pre-mutation failures use bounded human-readable reasons rather than an empty result.

Agent bulk-revoke and Usage failures must preserve a bounded non-sensitive error code/class sufficient to distinguish authentication/session-contract failure from provider/network failure. Secrets, tokens and raw PickList values remain excluded. These diagnostics create no per-event provider write.



## D162 — usage telemetry policy

D162 measures comparable-load efficiency rather than raw daily totals. Required evidence is:
- external HTTP request count versus Durable Object request count;
- Durable Object storage rows read;
- Firestore reads/writes;
- Reporter queue/recent request counts;
- Agent listener payload versus REST watchdog/fallback reads;
- p50/p90 latency and transport/reconnect failures.

Repeated expected 4xx classes must be aggregated by route/status/error code when additional telemetry is added. D162 must not create a per-request provider log write or a new heartbeat solely for measurement.

## D163 — forced Picker logout final-log continuity

- A server-authoritative **Kích User** invalidates the Android Picker session immediately; business/realtime authority is never delayed to wait for logging.
- Android `beta-vc97` already routes the revoke signal through the normal logout pipeline and emits the existing `INFO / session_end_logout` bundle.
- The Worker may accept that final bundle after revoke only when all of these are true:
  - Firebase identity is an Android session;
  - the account base role is PICKER;
  - the token generation is exactly one less than the current authoritative Android generation;
  - source is `ANDROID`, severity is `INFO`, and reason is exactly `session_end_logout`;
  - the request is the runtime-log upload route.
- This exception never applies to business APIs, other log reasons, older generations, non-Picker roles, Web or Agent sessions.
- The accepted bundle follows the existing sanitization, InventoryCore-first persistence, logical boundary/bundle idempotency and archive retry rules. No new polling, heartbeat or provider write cadence is introduced.

## D165 log archive and noise controls

Status: implementation complete on the D165 Beta change set; automated technical validation PASS. Field/usage acceptance remains Owner-gated.

All Báo hàng Android/Web/Agent archive bundles must resolve to one canonical `YYYY-MM-DD` child under the scoped Beta Logs parent using Asia/Ho_Chi_Minh.

D165 requires:
- shared canonical folder identity across Worker and Agent Apps Script paths;
- race-safe find/create;
- `bundle_id` idempotency before Drive artifact creation;
- duplicate filename/content does not create a second archive artifact;
- Kích User persists the Android sanitized final session-end bundle locally before session cleanup and retries only through existing bounded delivery mechanisms;
- expected `SUPERSEDED` optimistic-concurrency losses with no health impact are aggregated diagnostics, not one ERROR archive per occurrence.

No password, token, WMS session material or other sensitive value may enter logs.

D165 does not add a logging heartbeat or per-event provider write cadence.

### D165 RTDB HA field-repair diagnostics (08/10)

The existing Agent local journal may record transition-only RTDB observer/write failure and recovery with a bounded non-sensitive `HTTP_<status>` or `NETWORK_<WebExceptionStatus>` failure class. Do not log request URLs, URL query parameters, ID tokens, Firebase credential content, passwords or payloads. Repeated RTDB SSE failures must not emit a new HA-coordinator wake every retry. No extra Firebase/Firestore request, listener, heartbeat, log upload or provider write may be introduced for this diagnostic. Evaluate usage by comparable active-PDA/confirmation intervals and component-specific fallbacks; PR/CI evidence does not prove billed-read reduction.

### 2026-10-08 — Accepted D165 log and instrumentation baseline / prospective D166 post-shift analysis

Owner has accepted D165 as deployed with Agent `v120` and current Android/Web logs. This **does not mean** existing RTDB SSE, Firestore fallback and unexpected PRIMARY role changes have passed reliability or quota analysis. For future D166, first ingest Owner-supplied Agent/Android/Web logs and hourly Firebase/Cloudflare usage after 22:00 Vietnam time, align records by **event timestamps** across the 06:00–22:00 shift (not archive upload time), correlate handoffs, RTDB failures, Firestore role/lease checks, active PDA and PickList volume, and classify verified causes versus hypotheses. Do not add polling, upload schedules, request logging or new telemetry providers without approved D166 impact/resource review. D166 is not opened by this D165 PASS-only continuity update.

### 2026-10-08 — SUPRA Shared Quota Governance (documentation-only)

Owner-approved alert policy: independently track each genuinely shared provider metric and Google Cloud USD 10/month **soft** budget, with 30/30/30/10 accounting and 70/85/95% warnings plus 100% escalation. Reports show project attribution, provider quota/billing-cycle clock, local Vietnam rendering, usage slope/forecast, source, and last-known freshness. On missing or delayed data show unavailable rather than zero. Deduplicate alerts and avoid new provider polling, log storms, scheduled per-client reads or background writes. Central reserve use and paid overruns require Owner decision. Do **not** cut critical logs, Picker notification ACK, Picklist confirmations, HA, or realtime as an automatic quota action. This is a policy specification, not authorization to add dashboards, alerts, probes, provider billing resources or runtime code. See `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`.

### 2026-10-08 — D166 Usage ZIP proposal gate (NOT IMPLEMENTED)

Owner requested research first on an Agent-only on-demand local Usage ZIP export for AI review. Existing support-log upload remains a separate explicit button and is not triggered by Usage export. Candidate ZIP must carry source/provenance, exact UTC/VN selected window, provider quota resets, freshness, partial/missing reason, and sanitized aggregates only — never secrets, WMS session state, employee/Picker identifiers or raw log dumps. No new regular polling, provider write, GitHub key, Cloudflare credential, Apps Script deployment or other service access is authorized. See `docs/D166_USAGE_EVIDENCE_EXPORT_PROPOSAL.md` before seeking implementation approval.

### D166 — Owner-approved on-demand Usage ZIP scope (2026-10-08)

The earlier proposal-only limitation is superseded by explicit Owner authorization to implement combined phases A+B and enable phase C evidence correlation. Agent Usage export is **manual click-only** and isolated from D165 WMS/HA/ACK traffic. The existing Beta Apps Script Gateway may read Google Monitoring aggregates for scoped Firestore, RTDB network bytes, Firebase Auth/FCM, Cloud Run and Sheets/Drive API, plus one Drive `about.get` storage snapshot. No Firestore document writes/reads, provider token embedded in EXE, recurring export, cloud storage upload, mass Drive scan or WMS-session collection is authorized. Cloudflare and Billing without independently verified low-cost authorized API use **dashboard links and manual screenshots**. Every ZIP must label N/A, missing series, delayed metrics, local-vs-provider quota-day and invoice-vs-usage distinction. Provider requests and local ZIP creation shall not block the confirm pipeline. The manually collected Agent/Web/Android logs are a separate source for D166 phase C analysis.

### D166 Cloudflare read-only evidence candidate — pending secure credential provisioning

The manual Agent Usage ZIP v122 candidate can include exact scoped `supra-inventory-beta` Workers Analytics, account-labeled Durable Object aggregate trends, and account-level Cloudflare Billable Usage records, when an authorized server-side token is configured. No new monitoring timer, business Firestore document traffic, Worker route or DO mutation; no fallback secrets in EXE. Source provenance, sampled/truncated/late data, provider-day versus VN day and mixed-account attribution are mandatory. No raw account/namespace metadata, credentials or billing payment data are exported. Account DO measurements cannot be attributed to Inventory. The Owner-created GitHub secret alone does not populate Apps Script Script Properties; API wiring is blocked pending verified secure provisioning and no production readiness is implied.

### D166 Worker-Beta Cloudflare Usage bridge (Owner approved)

Only manual D166 ZIP generation calls existing Apps Script Gateway, which forwards the Firebase ID token to a single new Beta Worker POST `/api/agent/d166/usage`. Worker checks project environment, live Agent credentials/roles/exact privileged login and time window before any Cloudflare upstream request. The Cloudflare read-only token exists only in GitHub Beta Environment until GitHub Actions installs it as **Worker runtime secret**; no new Apps Script properties. Worker API calls are bounded to an hourly-filtered single GraphQL query and one account billing query per explicit action (not a scheduled monitor). The exact Worker `supra-inventory-beta` is the only attributable script; DO account aggregate is blocked without InventoryCore namespace; billing remains shared account and is separated in ZIP. Never expose token, source account identifiers, payment data or unscoped project resources. Preserve existing D160 15-minute tab cache independently, HA/WMS/ACK, Firebase/RTDB, no new automatic polling or provider write. Missing/truncated/delayed sections are not zero. Runtime and Owner field PASS required before broader rollout.

### D166 Cloudflare Usage bridge verified deployment receipt

The scoped Beta Worker + existing Apps Script Gateway CI/deploy is technically PASS (Worker run `37816448917`; Gateway run `37815507761`; Agent v122 run `37815507718`). One prior unauthorized probe returned HTTP 404, repaired under D166 with post-secret source/env readback and bounded 10×5s auth retry, now `401 AUTH_REQUIRED`. Cloudflare token preflight and Worker secret name readback passed; **this is not proof of real privileged Analytics/Billing fetch**, which requires Agent field ZIP with per-section status and freshness. Keep DO namespace fail-closed, account Billing unattributed, no automatic polling, no secret logging/ZIP.

### D166 v122 on-demand ZIP field repair — 2026-10-09

On three manual clicks Agent reported `D166_PROVIDER_NOT_READY` while Gateway produced no usable JSON for ZIP. The Gateway D166 hourly Cloudflare aggregation references the missing `d166CloudflareNumber_` parser; restore it without altering the existing monitoring cadence, picklist confirm, business writes or Cloudflare polling volume. Null/missing, nonnumeric, negative and nonfinite metric values remain null (not zero); actual valid zero must remain zero. If Cloudflare returns 403/429/unavailable, complete the available provider ZIP with explicit status instead of treating the whole export as failed. CI must execute the actual Apps Script D166 export using mocked Cloudflare success and provider failure, preserving checksum/local-only Agent ZIP implementation. Owner field ZIP retry required; no field PASS yet.


### D166 Owner-approved zero-extra-call forensic audit (Agent v123, Android, Web; 09/10/2026)

**Scope:** new log fields and their local-only aggregation, with no service/HA business mutation. See `docs/D166_USAGE_AUDIT_2026-10-06_08.md`. v122 is the Owner-selected next Agent baseline. v123 must inherit its WMS/Firestore/RTDB behavior exactly. Existing versioned App/Web logging surfaces may gain bounded data only.

**Agent:** use existing `FirestoreQuotaGuard.Record` local estimates by method/component and VN hour; track REST attempts/elapsed/outcome in RAM after each existing attempt, never log a request/response body, URL with IDs, API secrets or token. `D166_USAGE_AUDIT` is a bounded header in the current Agent sealed log, with local process/partial-day source labeling, not provider billing. If source counters overflow, emit explicit overflow count. Do not conflate `Listen` callback delivery, REST operations and billed document reads.

**Android:** count existing HTTP attempt/status/elapsed by allowlisted route family in RAM (0 extra network/storage operation); report bounded journal window, sequence and dropped event count in existing local/manual/global-support bundle. Keep valid JSON on 16KB fallback instead of truncating serialized text; never upgrade from support-error into business crash. Counters reset on process restart; label partial uptime.

**Web:** aggregate already captured API/realtime/status/long task metrics only when the existing support bundle is constructed; preserve existing event listener and scheduled-log cadence. Do not retain new raw payload/headers/URL parameters. Never put credential/private/account numbers in public GitHub.

**Verification:** Agent/WMS/HA/ACK fields unchanged; compile & feature guards PASS; Android debug/release compile, Web typecheck and existing regressions PASS; no new import of provider SDK or periodic task; prove manual/scheduled upload counts unchanged; record median/P95 local CPU/heap/battery impact via representative field testing, and check bundle byte overhead bounded. Strictly zero new *provider requests and document operations*; a new field necessarily adds bounded payload bytes. Report N/A/unknown when billed Firestore Read attribution cannot be inferred from local estimates. Preserve Beta only, Stable OWNER-GATED.

**Provider drill-down needed before ANY fix:** Agent per-component Firestore GET/RunQuery/listener initial/relisten/lease poll/ACK and RTDB fallback, with hourly PDA-hours and Picklist throughput, compare provider Firestore 06/08/09 daily billable readings and GCP API method. User-facing bug/behavior changes are not authorized by this log-only scope.


## D166 — Duplicate daily Logs folders: source investigation and safe repair backlog (09/10/2026)

Status: **Owner requirement recorded, analysis/risk only. No code or provider mutation approved.** The D165 one-folder-per-Vietnam-day specification remains authoritative and field duplicate reports mean it is not yet proven operationally.

- Inspect both known folder creators: Worker `service/src/runtime-logs.ts#resolveRuntimeLogDailyFolder` and Apps Script `ops/apps-script/agent-log-gateway/Code.gs#resolveDailyLogFolder_`; their LIST→CREATE→re-LIST convergence, local 6-hour caches and script-only lock are not cross-system atomic guarantees. The exact real-world duplicate trigger must be established with provider folder IDs, parent IDs, timestamps, creator actor, source logs and deployed revisions before claiming root cause.
- Verify all archive entrypoints (Agent direct Gateway and fallback drain; Android/Web Worker), timezone midnight, delayed retry and distinct `BETA_LOG_FOLDER_ID` vs `LOGS_FOLDER_ID` scope consistency. Follow the existing canonical Beta Logs parent; no new folder/root in another project.
- Repair design must ensure a single authoritative daily folder ID and safe race/idempotent behavior across both writers, while keeping bounded Drive API operations and archived `bundle_id` semantics. Do not return `DRIVE_SYNCED` on intermediate staging or prune local evidence prematurely.
- Historical duplicates: audit and stage a non-destructive merge plan with file ID/hash/bundle identity before any move/delete. No automatic trash of pre-existing populated folder; Owner approval is required for cleanup.
- Add tests for cross-path simultaneous first upload, errors/races, 00:00 VN, cache expiration, network retries, Drive readback, no loss/duplication and no additional scheduled polling or impact to Picklist/ACK.

Reference: `docs/D166_APPROVED_BACKLOG.md` / `D166-LOG-FOLDER-DUPLICATE`. Stable Owner-gated.


### D166 Launcher on-demand buffer diagnostics (09/10/2026)

- A **ROOT real base-role** can explicitly inspect the existing last-seven-day Launcher runtime-log buffer through Beta Web Nhật ký / Log Android. Worker/InventoryCore return only counts of received / Drive-synced / pending / pending-with-error, first/last timestamp and sanitized error **classes** from at most 30 recent failed archive records; no raw log content, filenames, DeviceKeys, Drive file IDs, employee identifiers or OAuth credentials.
- Each user click additionally performs one metadata GET against the **already-configured** Launcher Drive folder using the **Worker's existing Drive OAuth refresh token**, reporting safe permission/status categories only. The OAuth check confirms folder metadata access/capability, not actual file archival.
- Do not auto-query on Web navigation, tab change, refresh or a recurring timer. Existing Web/Android/Agent realtime, support-log cadence, retention, transfer and archive paths remain unchanged. No new provider resources, no Drive mutations.
- Launcher logical date matching in server initial archive and queued retry is corrected to parse `YYYY-MM-DD`, not to silently interpret it as last-event date. Separate D166 duplicate folder write-race backlog remains owner-gated and unchanged.
- See `docs/D166_LAUNCHER_LOG_SERVICE_DIAGNOSTICS.md`. Field PASS requires owner-authenticated response, cause classification, actual Drive file creation/visibility and PDA `DRIVE_SYNCED` confirmation; CI is not runtime proof.


### D166 SQL Usage instrumentation — initial diagnostic candidate

Measure only three suspected DO SELECT hot paths via already-executed cursor counters. Save bounded aggregated per-hour metrics in DO isolate memory, not SQL/Firestore/R2/RTDB; no extra timers or reads/writes. Label measurements `ISOLATE_PROCESS_LOCAL_RESTART_RESETS__ESTIMATE_NOT_BILLING`. Existing authorized on-demand system metrics returns `d166_sql_diagnostics` with only query ID, 24–36h buckets, execution count, rows-read, rows-written, max and simple elapsed ms. Never collect query arguments, SQL result rows, SKU, PL, personnel, tokens, device IDs or raw errors. Do not mistake these partial counters for total Cloudflare DO account billing. Verify nonzero provider reports match relative trend only; expand coverage after safe sampling demonstrates hotspots.


### D166 integrated observability contract — staged Beta candidate, 2026-10-10

Integration PR #541 composes the initial three-query SQL instrumentation with the additional allowlisted `RECENT_STATUS_TOTALS` and `RECENT_ACK_TOTALS` queries (five total; measured existing cursors only). `d166_sql_diagnostics` returns bounded in-isolate hourly aggregates, execution count, cursor rowsRead/rowsWritten and elapsed sample measures: **PROCESS_LOCAL / RESTART_RESETS / ESTIMATE_NOT_BILLING**, not provider-authoritative billing, costs or claims of reduction. Reject SQL bind values/result rows and identifiable arguments. The approved Android ACK telemetry separates known HTTP 400/404/408/409/422 and whitelisted business error code families in bounded RAM, reports dropped/sampled counts, and never logs response text, SKU/PL or user/device identifiers.

The runtime-log path should converge through one InventoryCore/Worker canonical Vietnam-day folder authority; the existing Agent Apps Script transport may request the ID only via authenticated Beta Worker endpoint and must not independently list/create another folder. Web/Android use the same authority. Drive upload success and remote file confirmation remain preconditions before local log deletion. A principal access mismatch is an explicit partial failure with local retry—not an excuse to create duplicate dated folders. Historical duplicate folders are preserved pending separate Owner audit.

This is a branch-only technical candidate, not field proof that source captures are sanitized end-to-end. Before D166 Owner PASS, perform raw-export negative-PII scans across Agent/Web/Android, record bounded coverage gaps and upload results under existing log cadence only; no extra scheduled provider reads, no per-event remote writes and no added Android wakeups. After live quota sampling, decide DO/Firestore optimization with evidence under the same D166 gate. Stable OWNER-GATED.


### D167 — Owner-authorized code-only targeted attribution (10/10)

Continue D166 audit streams; do not create new scheduled request, heartbeat, Firebase listener, Firestore/RTDB read/write or per-event provider logging. Agent local bounded `d167_ha_events` counters add RTDB SSE/heartbeat error class, liveness freshness, PRIMARY lease fallback and takeover probe result to existing sealed audit. No tokens, URLs, WMS state, Picker/PL, raw provider response or trace identifiers are added.

InventoryCore D166 in-RAM SQL cursor samples expand from 5 to 15 allowlisted read queries, with executions/rowsRead/rowsWritten/latency and explicit restart/reset limitations. New DO ingress route diagnostics use *fixed family labels* only. Both snapshots are provided by the existing privileged Beta Worker/Gateway into the **Owner-clicked** Agent Usage ZIP via one extra read-only DO request per click, with no SQL at the diagnostic endpoint, no added timer or provider account analytics query. This source reports process-local estimates, not complete billable 24h rows; missing instance samples and provider Billing must be labeled unknown rather than zero.

The Gateway now groups hourly Monitoring by a valid provider interval start when available and otherwise the previous end-minus-1ms fallback; exports `NO_DATA` counts and warnings separately from failures. Partial/misaligned provider buckets are explicitly labeled and must be tested with synthetic 59:59/00:00 boundary fixtures. The D167 code-ready branch stays unmerged/undeployed until Owner approval.

## 2026-10-11 — Cross-provider diagnosis-first optimization guard

Every quota/performance proposal must use current Agent/Web/Android/Worker/DO/Firestore/RTDB/Drive source traces and a comparable-shift provider meter ledger, not merely local `D166_USAGE_AUDIT` or `d167_ha_events` counters. New SQL 15-ID and DO route samples and v125 manual ZIP are process-local estimates; total provider charge must come from actual matching provider billing/time-series, marking failed/no-data/missing as unknown. Assess no-change, direct hot-path optimization, and equivalent safe cross-meter reassignment, including local CPU, API/query cost and log bytes; never weaken realtime/HA/ACK/latency/security to meet a soft metric. Diagnose differences across all coupled clients, with bounded privacy-safe trace correlation and no new monitoring timer/provider writes. Detailed matrix: `docs/D167_SYSTEM_REVIEW_2026-10-11.md`.

## 2026-10-11 — D167 D08 limits for next release

Log enhancements are restricted to bounded counters on existing Web/Android/Agent/Service events (HR Excel validation/conflict, meal choice/default, 03:00 batch closure, day-boundary duplicate, PRIMARY SKU job and area history). Maintain local caps, event coalescing, first/last/overflow and sanitized identities. No new scheduled log, remote per-event telemetry write, Android wakeup, periodic provider collection or Launcher code. Usage ZIP/screenshots remain user-triggered. Benchmark CPU, network, battery and billable usage before/after while preserving realtime, ACK, HA and confirm speed. See docs/D167_OWNER_DECISIONS_D01_D10_2026-10-11.md.


## D167 2026-10-12 — Minimal-usage manual SKU tab
The Agent SKU tab consumes the existing per-slot Service schedule and durable receipts plus local workbook memory. No new interval/heartbeat, WMS API query, Firebase listener/document, per-SKU provider query, Android wake or periodic upload for UI. On demand status read is one existing Gateway->Worker->InventoryCore request chain; a manually authorized FULL/DELTA uses existing export, bounded 500-SKU stage chunks, fingerprint no-op path, transactional receipt readback and current HA verification. Track distinct per-manual-run request/read/write/cpu/Confirm latency when comparing representative shifts; 5 uploads/2500 SKU or 10/5000 before ancillary requests are code-derived, not measured billing savings. Log only bounded category, slot, counts and timestamps, never password/OTP, WMS headers/session/stock rows.


## D167 2026-10-13 — Agent v128 SKU diagnostic without secret leakage

Manual/automatic SKU export logs bounded stages through existing local support-log collector only: AUTHORIZE_BEGIN/DONE, WMS_EXPORT_BEGIN/DONE, SIDE_OPEN/TARGET_DISCOVERY/CDP_CONNECT/NETWORK_ENABLE/RELOAD/AUTH_OBSERVE, DIRECT_GET, XLSX_PARSE, SERVICE_UPLOAD_BEGIN and durable DONE. Failure includes only exception type and allowlisted fixed `D167_[A-Z0-9_]*` error code; other messages map to `UNKNOWN`. Read-only WMS API HTTP failures expose **numeric HTTP status only**, not provider response body, URI query, header/token/cookie, signature, employee/SKU row or personal data. No extra Firebase listeners/provider reads, scheduled jobs, WMS API requests or remote telemetry compared with v127. Successful CI is not real main-browser session API verification.

## D167 Agent v128 Beta — chẩn đoán luồng SKU theo chặng

Owner 2026-10-13 duyệt thử nghiệm Agent v128 với WebView2 phụ ẩn đã có sẵn trong cùng browser environment/profile và yêu cầu log đủ để tìm điểm lỗi trước khi nghiệm thu. `D167SkuCoordinator` ghi log sự kiện cục bộ (không có timer/log upload mới) gồm: `manual=STAGE`, `manual=TRACE export_stage`, `manual=FAILED phase/error_type/error_code/elapsed_ms`, `slot=INITIAL_05|DELTA_12|DELTA_19 export_stage/elapsed_ms`, `SERVICE_UPLOAD_BEGIN` và `DONE` chỉ sau khi có Service receipt. Mốc `export_stage` của từng callback là **đã bắt đầu bước**, không mặc nhiên chứng minh bước đó đã hoàn tất; mã lỗi cuối cùng phải được đọc cùng giai đoạn trước đó.

Tuyệt đối không ghi giá trị WMS auth headers, cookie/token/session, credential, URL có query, response body hoặc nội dung SKU trong log. Không làm thay đổi hành vi WMS Confirm, quyền PRIMARY, HA/lease, lịch ba slot, FULL/DELTA hoặc realtime/PDA. Phát hành bản Beta diagnostic chỉ chứng minh channel/build; WMS export và cập nhật thực tế vẫn FIELD_PENDING. Nếu lỗi ở bước xác thực, không sử dụng cách trích xuất/phát lại bí mật để vượt chặn bảo mật.

## D167 2026-10-13 — P0 Agent v129/Worker reason-coded HA and Vietnamese UI

Trên đường gửi mutation SKU hiện có, Agent chỉ khi làm việc mới cập nhật Firestore lease đang hợp lệ với generation, tối đa một lần mỗi 20 giây; Worker đọc lại chính hai tài liệu roles+lease hiện có và trả `NOT_CURRENT_FIREBASE_PRIMARY_<REASON>` với REASON thuộc mã hệ thống cố định (`FIRESTORE_LEASE_STALE`, `FIRESTORE_ROLES_MISMATCH`, `FIRESTORE_LEASE_MISMATCH`, `FIRESTORE_ROLES_READ_FAILED`, `FIRESTORE_LEASE_READ_FAILED`, `INVALID_IDENTITY`, `VERIFIER_CONFIG_MISSING`, `FIRESTORE_VERIFIER_UNAVAILABLE`). Không ghi giá trị hồ sơ Firebase hoặc secret. Luồng Apps Script proxy giữ nguyên `error` hiện tại, Agent chuyển nội dung lỗi sang tiếng Việt tại UI; mã tiếng Anh chỉ phục vụ hỗ trợ nội bộ.

Tên người cập nhật lấy trực tiếp từ phiên Worker-verified, lưu 1 lần ở biên nhận Service cho mỗi lượt DONE. Biên nhận cũ không có tên thì hiển thị `—`, không suy đoán hoặc phát sinh truy vấn riêng. Các dòng tiến độ chỉ là callback nội bộ trên máy, không tạo thêm provider op, timer, realtime listener, WebView2 reload hay upload log riêng. Bản sửa P0 không bao gồm lỗi Confirm/PDA/Windows session đang chờ log đầy đủ.

## D167 Agent-only network/HA incident logging — 2026-10-13

Owner-approved Beta Windows Agent-only non-SKU maintenance v130; no Server/Web/Android/RTDB/Firestore service change. Local Agent incident logs classify sanitized network DNS, timeout, connectivity and HTTP 401/403 codes without credential, bearer/URL/body leakage; coalesce repeated same-component failures while reporting start/recovery durations and counts. Preserve existing error-upload fingerprint limits, pending bundles until Drive acknowledgement, role generation/candidate fencing and WMS Confirm idempotent ACK. RTDB observer tracks flap count/downtime but retains 1-second retry and lease fallback. Auxiliary WMS session health checks skip stale login/logout and manual-operation state. Picker bulk-revoke preview HTTP403 remains a server denial: no retry beyond existing 401 token-refresh and no session removal. The changes create no extra network calls, listener, retry, Firestore read/write, or service deployment. Acceptance: source/CI tests plus field logs and successful one-at-a-time manual Agent update; no automatic deployment claims without release receipt.


## D168 Owner decision — Retire Agent Usage UI and Usage ZIP only (2026-10-13)

**FUTURE IMPLEMENTATION; D167 Beta as deployed unchanged.** Owner directs complete removal from **new Agent builds** of D160 "Thông tin Usage" tab, 15-minute `get_firestore_usage` Cloud Monitoring refresh/timer, manual refresh, and D166 `get_usage_export`/ZIP Usage export UI. Owner will provide screenshots from existing provider dashboards when usage forensics is required. This does **not** remove native provider dashboards, Firestore diagnostics, local operational history, categorized Agent/PDA/Web errors, Crash support logging, Drive archival uploads, Drive-confirmed local log pruning, or Agent support-log manual export. Keep old Gateway endpoints temporarily backward-compatible for installed older Agent versions unless separately approved for retirement. Existing CI tests asserting old Usage must be re-scoped during later code implementation, retaining no-regression WMS/HA/business logging checks.

For proposed WLAN-switching SKU jobs, emit one sanitized state-transition breadcrumb via existing Agent local support-log pipeline per meaningful event: job intent/slot, WMS export valid, original WLAN category, Cloudflare connectivity test status, operator-deferred/60s-consent, safe-idle/handoff, switch attempt/status, stage/Worker DONE receipt, rollback/restoration and reason-coded failure. Never log Wi-Fi passwords/profiles, sensitive SSID identifiers into GitHub public repo, WMS tokens, XLSX row contents or device secrets. Coalesce retries; do not add per-second remote calls or provider writes. No runtime mutation or deployment authorized by this documentation.


## D168 2026-10-14 — Network/usage diagnostic source findings, future implementation only

Agent Internet-task capability checks must use bounded read-only HTTPS when that task actually starts, never periodically. The existing Worker GET /health is NOT suitable as a cheap reachability probe: service/src/index.ts invokes Core checks and Agent auth migration in that route. A valid Worker-origin 401/403 is an authorization issue, whereas corporate proxy 403/timeout is a route failure; log only sanitized reason codes, no token/cookie, raw SSID or sensitive output. Reuse existing validated business GET or an Owner-approved tiny read-only Worker response. Cache by network epoch and single-flight identical probes.
Preserve end-to-end PDA ACK/HA evidence and the Drive-confirmed log lifecycle even as Agent D160 Usage and D166 ZIP retire. No extra provider polls, no separate ACK-success audit write. Source evidence: docs/D168_FIRESTORE_CLOUDFLARE_USAGE_ACK_2026-10-14.md, D168-E017.

## D168 — Owner-approved local-first logs (2026-10-14)

All three surfaces (Agent, Web, Android Picker/Reporter) record bounded, sanitized error stage/code, HA and realtime status, ACK/correlation, SKU FULL/DELTA receipts and retry suppression, provider usage estimates, device CPU/performance samples where already available. Do not add periodic provider fetches, new Firestore listeners or high-rate instrumentation. Do not send raw Wi-Fi SSIDs, credentials, WMS auth material or sensitive report content; local estimates are not billed provider usage.

Delivery events only: PDA logout or Agent kick, authenticated Agent once per Vietnam-local day at 21:45, authenticated active Web once per Vietnam-local day at 21:45. Crash/error logging remains local and cannot itself trigger upload; Agent manually Send Log and authorized global support request remain available. Global request uses a spread of up to 180 seconds within request TTL; no per-Picker delivery/read receipt. Avoid retry timers: failed bundles wait locally until a subsequent authorized delivery event, retaining stable idempotency identifiers.

Deletion requires archive_status DRIVE_SYNCED or equivalent authenticated Drive receipt. Keep unsent envelopes on local storage when authorization/network is down. Web off/suspended cannot honor exact time; keep journal until reopened at a valid send event. Forced PDA kick may revoke API token before upload and must preserve pending data for a later authenticated same-user session. Never delete on a generic HTTP 200 or response DEFERRED. Batch upload with bounded payloads and rate limits; no operations that could block WMS PickList Confirm.

PR592 source work is not runtime proof or full deployment; Owner Field PASS pending. Stable remains gated.


### D171-E040 — Agent staged receipt retry (PR-only, 2026-10-20)

If a scheduled Agent bundle is only staged to the existing Firestore log fallback, retain its original sealed local payload until a verified Drive receipt. Continue eligible **local 15-minute bounded retry** within the active 13:15/21:15 slot rather than starving the archive until the next slot; do not use staging success as archive success, and do not prune source files. No extra provider listener, per-event write, new resource or unauthorized Office bypass. CI/source does not establish actual Drive/Office field delivery or release approval.

## D171-E071 — Android overlay journal

Ghi stage FCM_RECEIVED, OVERLAY_ENQUEUED, OVERLAY_ATTACHED, RESULT_DRAW_CONFIRMED, RESULT_DISMISSED, SERVICE_START_FAILED, OVERLAY_FAILED, FALLBACK_POSTED, FALLBACK_FAILED theo owner/session đã xác thực. Chỉ ghi event type, event ID băm và class lỗi; không token/SKU/tên/nội dung. OVERLAY_ATTACHED không đồng nghĩa DISPLAYED; check attached/shown trước receipt. Dùng journal hiện hữu, bounded 160 sự kiện/700KiB; không thêm poll/Firestore write. Lỗi telemetry không chặn nghiệp vụ. So sánh sau bản vc116 với baseline 20–21/10.

## D171-E074 — vc117 suppression and bounded stale snapshot trace

FCM Result suppression now records sanitized FCM_SUPPRESSED reason: NO_PICKER_SESSION / ALREADY_DISMISSED_OR_COMPLETED / FOREGROUND_DIALOG_OWNS_RESULT / BACKGROUND_PRESENTATION_CLAIM_BUSY. MODE_RESULT Service refusal records OVERLAY_REJECTED with PERMISSION_REVOKED / PICKER_SESSION_UNAVAILABLE / RESULT_EXPIRED; permission-race fallback emits FALLBACK_POSTED or FALLBACK_FAILED. These remain in the existing local bounded diagnostic journal. Never log clear-text SKU, user UID, token, full message body or device serial in public proof. Displayed receipts require actual attached+shown view; notification fallback never fabricates DISPLAYED. Reporter realtimeRevision stale snapshot fence and at most one retry per overlapping refresh prevent older counters from rewinding recent deltas; measure request rate in field, not by assumption.
