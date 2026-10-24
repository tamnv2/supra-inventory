# D173-E009 — Kiểm tra sâu Beta/Stable legacy, 22:15 ngày 23/10/2026 (VN)

**Phạm vi Owner mới nhất:** Owner đổi lịch từ 23:00 ngày 24/10 sang **22:15 ngày 23/10/2026**. Đây là lần kiểm tra và chuẩn bị thay đổi có giới hạn, **không phải** lệnh xóa Custom Domain, Worker, Firebase, Stable, secret, Google OAuth, dữ liệu, hay phát hành runtime có nguy cơ gián đoạn. E009 tách riêng E008 Cloudflare Email quota/canary đang mở. Mọi phát hành tiếp theo phải có source CI, authority/continuity, D172 regression và Owner release receipt đúng phạm vi.

## Authority và bằng chứng nguồn

- Canonical: `ops/authority-manifest.json` → toàn bộ `bootstrap_order`; D170/D171 chỉ OWNER PASS **giới hạn** qua PR699; D173 mở, D172 **PENDING/HOLD** độc lập. Stable `OWNER-GATED`.
- Main baseline khi bắt đầu: `c099feadd1defd6dd6eaf52e880e707d7a9846c0` (23/10/2026). PR707 (D173-E008 Email quota) đang mở: **không merge/rebase/đổi source của PR707 trong E009**.
- Owner xác nhận bộ duy nhất bắt buộc tương thích: **Agent v140, Android Báo hàng vc117, Web 3.1.2**; thiết bị cũ tự cài thủ công. Đây là lời xác nhận hiện trường của Owner, không phải danh sách cài đặt được quét trên mọi thiết bị.
- GitHub Releases readback: `relay-agent-v140` (21/10), `beta-vc117` (22/10), `inventory-channel` có APK alias `1291-Bao-Hang.apk`, `pda-latest.json`, `agent-latest.json`; D172 `obpp1291-v8` và `obpp1291-latest` là kênh riêng. Không xóa tag, signer, package ID hoặc manifest đang dùng.
- Chưa có Cloudflare provider custom-domain readback mới, live Cloudflare API quyền mutation, nội dung JSON release asset được xác minh trong phiên này, hoặc device FIELD PASS. Không biến static source proof thành live field proof.

## Ma trận phụ thuộc và kết luận

| Thành phần | Bằng chứng nguồn | Kết luận E009 |
| --- | --- | --- |
| Android vc117 API/OTA | `android/app/build.gradle.kts`: `API_BASE_URL=https://inventory.supra.cc.cd`, `UPDATE_RELEASE_API=/downloads/pda/manifest` trên host chính; `MainActivity.kt` kiểm tag `beta-vcN` và APK signer | **Giữ** package `cd.cc.supra.inventory.beta`, signer, tag `beta-vc117`, manifest/channel. Không có hardcode old-host trong config APK hiện hành. |
| Agent v140 API/OTA | `relay-agent/AgentConfig.cs`: `ApiBaseUrl=https://inventory.supra.cc.cd`, Agent/browser updater cùng base; `AgentUpdater.cs` kiểm host và GitHub CDN | **Giữ** `relay-agent-v140`, channel, Firebase/RTDB/Firestore project kỹ thuật beta. Agent hiện hành không cần hostname cũ trong config nguồn. |
| Web 3.1.2 | `web/src/api.ts` dùng same-origin khi `VITE_API_BASE_URL` rỗng; `web/src/realtime-client.ts` dùng `window.location.origin`; `deploy-beta.yml` build `VITE_API_BASE_URL: ""` | **Giữ** same-origin API/WebSocket. Cần kiểm tra asset đã deploy qua official host, không suy từ source rằng mọi cache/tab cũ đã chuyển. |
| D172 OBPP v8 | `obpp1291/android/app/build.gradle.kts` default API host chính; `ObppUpdateManager.kt` lấy `obpp1291-latest.json` từ GitHub; `service/src/index.ts` route `/api/obpp1291/*` | **Giữ** D172 API, `obpp_*` SQLite, Sheet, APK/signature/OTA riêng, Firebase shared auth; **không sửa D172**. Không thấy old-host default trong nguồn v8, nhưng chưa có FIELD PASS. |
| Worker Production | `service/wrangler.beta.toml`: Worker `supra-inventory-beta`, `INVENTORY_CORE`/SQLite, cả hai hostname `inventory.supra.cc.cd` và `inventory-beta.supra.cc.cd` | **Giữ Worker, DO/SQLite và host chính**. Old host là **ứng viên tháo, chưa tháo**. Tên `beta` là định danh kỹ thuật sống. |
| Firebase / môi trường | Android, Agent, Web và `service/wrangler.beta.toml` dùng `supra-inventory-beta`, `APP_ENV=beta`; Worker `service/src/index.ts` có một số guard `APP_ENV === beta` | **Giữ nguyên** project ID, RTDB/Firestore/Auth/FCM, `APP_ENV` cho đến khi chứng minh logic guard không đổi. Không đổi tên project hoặc di chuyển dữ liệu. |
| OAuth/Gmail/Drive | `service/wrangler.beta.toml` callback `https://inventory.supra.cc.cd/api/oauth/google/callback`; `service/src/index.ts` trustedHosts vẫn gồm host cũ để redirect OAuth start; E008 email sender đang xử lý riêng | Callback chính thức **giữ**. Bridge host cũ chỉ bỏ sau kiểm tra redirect/provider + rollback; không thử OTP/Drive mutation trong E009. |
| Legacy Stable Worker | `service/wrangler.stable.toml` có `supra-inventory-stable` và route trùng host chính trong **file config không triển khai** | **OWNER-GATED**, tuyệt đối không chạy wrangler stable, không xóa/rename khi chưa có provider proof và lệnh riêng. |
| Tên `stable_download_path` | `service/src/app-tools.ts`, `web/src/operational-app.ts` | Là trường API/path tải public **không phải** đường deploy Stable Worker. Không xóa/đổi máy móc vì có chữ stable. |

## Chướng ngại thực tế khiến không thể xóa old hostname ngay

1. **Release pipeline còn phụ thuộc hostname cũ qua biến `BETA_HOSTNAME`**: `.github/workflows/deploy-beta.yml` dùng biến đó ở nhiều health, login negative-auth, capabilities, OAuth, log và download probes; `.github/workflows/verify-relay-agent.yml` dùng trong Worker-first Agent release gate. Nếu biến vẫn trỏ host cũ mà tháo trước, lần cập nhật Production tiếp theo có thể FAIL dù host chính còn khỏe.
2. **Guard lịch sử vẫn bắt buộc dual-host**: `tests/d170-official-client-hosts.test.mjs`, `tests/d170-domain-cutover.test.mjs`, `tests/d170-d171-release-parity.test.mjs` và `tools/d170_domain_cutover.sh` xác nhận old-host. `.github/workflows/d170-domain-preflight.yml` cũng kiểm host cũ; `verify-d166-postrelease-channel.yml` và một số D161 workflow lịch sử dùng `BETA_HOSTNAME`. Không được xóa host rồi bỏ qua test đỏ; phải phân biệt current release gate và historical probe, sửa/retire có lý do và kiểm thử.
3. **OAuth start còn trusted old-host** tại `service/src/index.ts` (callback chỉ trên official origin). Không được thay đổi chung Worker auth/route khi chưa chạy regression D172 và xác minh Google redirect URI.
4. **GET `/health` không thuần đọc**: `service/src/index.ts` hiện gọi `migrateActiveAdminFirebaseCredentials(env)` trong health khi Core và Google runtime service account sẵn sàng. Vì vậy E009 **không chủ động gọi /health hoặc kích hoạt workflow provider probe**; lần kiểm tra này dùng source/CI và release metadata, tránh tạo side effect người dùng. Đề xuất tách một health-read-only contract sau một review riêng.
5. Chưa có readback Cloudflare Workers Domains hiện tại, Web asset/manifest tại host chính, D172 thực địa, Gmail/Drive sau OAuth và phương án reattach old custom domain đã thử. Thiếu bằng chứng này thì **không đạt FIELD/RELEASE PASS cho tháo host**.

## Thay đổi SOURCE ONLY đã chuẩn bị trong Draft PR E009

- `.github/workflows/deploy-beta.yml`: đổi các bước health/readiness của release từ `vars.BETA_HOSTNAME` sang `PRODUCTION_HOSTNAME: inventory.supra.cc.cd`; vẫn giữ tên Worker, đường deploy `wrangler.beta.toml`, dual-host D170 guard lịch sử và các probe nghiệp vụ hiện hữu. **Không deploy**.
- `.github/workflows/verify-relay-agent.yml`: Worker-first Agent release health gate dùng official hostname. **Không build/phát hành EXE trong PR**.
- `tests/legacy-sunset-d173.test.mjs` + `.github/workflows/d173-legacy-sunset-readiness.yml`: source-only CI xác minh official host, signed OTA, Firebase kỹ thuật, D172 độc lập, old-host vẫn được giữ trước cổng tháo, chạy D170 + D172 regressions. Không đọc provider hay tạo dữ liệu nghiệp vụ.
- Các cập nhật quyết định/state/continuity/docs E009 thuộc cùng branch. Không sửa `service/src/*`, `service/wrangler.*`, `android/*`, `obpp1291/*`, `firebase/*`, DNS hoặc Cloud resources.

**Tác động:** đây là thay đổi hành vi health gate của workflow release, không phải đổi runtime API. Dù source-only trong PR, **merge vào main sẽ kích hoạt một số workflow release tự động**, vì vậy PR phải giữ Draft/chưa merge cho đến khi CI và Owner phê duyệt release scope cụ thể. E008 PR707 không được bị ảnh hưởng.

## Lộ trình xử lý tiếp theo (không tự động vượt cổng)

**A — CODE/CI:** Chạy exact-head Repo Authority, Project State, continuity, D173/D172 isolation, D170 official/legacy guard, new source-only test và các release workflow code-only. Nếu có CI FAIL thì sửa ngay trong E009 branch, không bỏ guard. D173-E009 CODE PASS không đồng nghĩa Worker/Agent/Android/Field PASS.

**B — Official-host release-gate activation:** Sau CI PASS và Owner release approval riêng, merge guarded PR, bảo đảm mọi read-only health/download/OAuth release probe thiết yếu sử dụng host chính. Xác nhận workflow/manifest cùng source; tuyệt đối không đổi Worker/SQLite/Android signer/D172. Nếu merge kích hoạt deploy tự động ngoài phạm vi, phải có release plan chặn hoặc tách workflow để không tạo tác động ngoài ý muốn.

**C — Old-host detach:** Chỉ sau provider readback, official-host real release/field proof, D172 regression, OAuth/Gmail/Drive proof và rollback rehearsal: lập **PR + Owner authorization riêng** cho việc gỡ `inventory-beta.supra.cc.cd` khỏi `wrangler.beta.toml` và Cloudflare Custom Domain binding. Không dùng `tools/d170_domain_cutover.sh` (script cutover D170 cũ, không phải sunset). Không đụng Worker Stable, Firebase, DO hoặc dữ liệu.

**D — Retire historical guards/labels:** Chuyển các test/workflow dual-host D170, D161/D166 legacy probe sang archive hoặc chỉ giữ fixture lịch sử; không xóa test an toàn auth, OTA, source SHA. Chỉ sau khi các gate Production mới đã PASS.

## Rollback và tiêu chuẩn nghiệm thu

- Trước provider mutation: nếu PR E009 CI lỗi, sửa/revert branch, `main`/Production không đổi; host cũ vẫn gắn Worker hiện tại.
- Sau kích hoạt CI official-host: nếu Worker/Agent gate lỗi, revert đúng workflow commit bằng PR được bảo vệ, không đổi service data; chỉ mở lại bước deploy khi CI và source health hợp lệ.
- Sau detach host (chưa được phép): khôi phục Custom Domain `inventory-beta.supra.cc.cd` **trên chính Worker `supra-inventory-beta`**, hoàn nguyên `wrangler.beta.toml` qua PR, xác nhận host chính và D172 vẫn hoạt động. Không migrate hoặc rollback SQLite/Firebase vì không có data change.
- Acceptance tối thiểu: Agent140, vc117, Web3.1.2, D172 v8, official OAuth/Drive/Gmail, signed OTA/manual download, Worker source/DO/SQLite, critical realtime/ACK/HA, CI, logs và rollback có bằng chứng. Chỉ Owner có thể ghi FIELD/OWNER PASS; D172 vẫn PENDING/HOLD.

**E009 kết luận:** Old hostname **chưa an toàn để tháo** vì còn dependency của CI/release và thiếu provider/field proof. Đã chuẩn bị Phase A source-only trên branch/PR để gỡ dependency release trước; không tự tuyên bố hoàn thành dọn Beta/Stable hay xóa tài nguyên.

## 24/10 hậu ca — GET-only mapping gate, không tháo resource khi thiếu runtime proof

Owner yêu cầu hoàn tất cleanup legacy trước Đợt 1 và chỉ làm Đợt 2 sau log mới. E017 đã ghi trên main PR719 (squash c668165), phân loại physical Worker/InventoryCore SQLite/Firebase/Android signer/channel là tài nguyên Production **phải giữ**. Host inventory-beta.supra.cc.cd còn trong source OAuth/CI và cấu hình Cloudflare, chưa đủ chứng cứ xóa; giữ FAIL-CLOSED. PR708 bổ sung workflow GET-only d173-e009-domain-control-plane-readonly.yml để xác minh cả hai custom host cùng trỏ Worker thực tế; không có PUT/POST/DELETE, không in token/account/payload. Kể cả khi GET PASS, đó **không** phải OA uth/Drive/Gmail/D172 field PASS, chưa cho phép domain detach. Mọi DNS, custom domain, service, Durable Objects, Firebase, Stable provider mutation vẫn BLOCKED.

Tài liệu D173-E017 trên main là thẩm quyền mới hơn các mốc lịch trong tài liệu E009 này. Mọi thao tác kế tiếp phải dựa đúng main E017 và PR720 phase1 candidate, không merge bản branch cũ vào main một cách gây mất quyết định/sender no-reply E010/E011.

## D173-E009 — Provider GET-only after-shift receipt (25/10/2026 00:28 VN)

Read-only GitHub Actions run 40116263302 executed via audit-branch push (not Production/main deploy). Cloudflare account Workers Domains API HTTP 200 and success=true; exactly one official hostname inventory.supra.cc.cd and one compatibility inventory-beta.supra.cc.cd, both mapped to existing supra-inventory-beta Worker. Returned raw control-plane JSON was not committed/logged, only PASS markers. Evidence: D173_E009_PROVIDER_GET_PASS__BOTH_HOSTS_SAME_PRODUCTION_WORKER__LEGACY_DETACH_NOT_AUTHORIZED, NO_RESOURCE_MUTATION__D172_PENDING_HOLD__STABLE_OWNER_GATED.

**Gate classification:** CONTROL_PLANE_GET_PASS (not FIELD/OAuth/Drive/Gmail/OBPP-proof). Old-host detach remains BLOCKED; do not claim provider cleanup or merge unsafe workflow rewrites. This run did not exercise /health (which may have migration side effects), send emails, use authenticated accounts, alter route or Worker, or probe D172.
