# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and its complete `bootstrap_order` before any mutation. Canonical authority remains `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, the affected specs, project scope/resource registry and current source/CI. This file exists to make a new chat resume quickly without asking Owner to retell project history.

## 1. Exact current point

Canonical current markers:
- SQLite schema: `6`
- Latest Beta APK: `beta-vc45`
- Web: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`
- Android: `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`

The project is in **UI-first review**, not business-logic rebuild.

- Active visual baseline: **D057 — direct legacy presentation transplant**. Active Web review refinements: **D058 shell + D059 header + D060 Root-role/theme + D061 dark/sidebar/realtime cleanup + D062 final Web QA/IA + D063 consolidated operations/logs/reporting/people review**.
- D064 detailed `Trạng thái hệ thống` is deployed on Beta and technically PASS. Controlled Beta load test run `35376099693` also PASS: 1,000/1,000 real Picker reports, 100 existing Pickers, 400 existing SKUs in 525.423 seconds, no errors; temporary load-test gate verified closed. D066 three-group navigation is merged and deployed on Beta. PR #50 guards PASS; main UI Design Guard run `35407227884` PASS; Beta deploy run `35407227911` PASS. Owner accepted D066 as the current Web navigation baseline. D067 items 1–8 and 10 are Owner-accepted/frozen. D068 item 9 and requirements 11–15 remain the active Web review scope; the clean-log-copy follow-up is deployed and technically PASS on Beta. Stable is unchanged.
- Owner has **not yet given UI/layout acceptance** for the current candidate.
- Technical build/deploy/release PASS must never be interpreted as Owner UI PASS.
- D064 system-status and controlled load-test implementation are complete. D066 now carries the approved three-group Web navigation implementation.
- The exact D066 left-navigation grouping is Owner-approved. Do not expand beyond the approved 3-group / max-5-child constraint without a new Owner decision.

Current review targets:
- Web: `https://inventory-beta.supra.cc.cd/`
- Android signed review release (broader visual review pending): `beta-vc45`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc45/supra-inventory-beta.apk`
- Web runtime source: `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- Android beta-vc45 source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`
- Current Web runtime implementation source: `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`

## 2. Minimal command for the next chat

Owner can start the next chat with only:

> **Kiểm tra live D070 và test 3 mốc cảnh báo / quá hạn / tự động skip**

Then attach/send the current screenshot or concise review feedback, for example:
- `Web Tổng quan: chưa OK, sidebar rộng quá`
- `Web Danh mục SKU: form còn lệch`
- `Web Xử lý báo thiếu: button chưa đúng`

The AI must **bootstrap GitHub first**, then continue from this review state. Do not ask Owner to repeat prior project requirements already present in the repo.

## 3. Why D057 exists

Earlier UI candidates tried to **reinterpret/rebuild the old look** instead of transplanting the actual presentation layer. They compiled and passed CI but were visually wrong.

Not accepted as UI baselines:
- PR #27 / `beta-vc41`: partial legacy visual port.
- PR #29 / `beta-vc42`: additional navigation/header parity repair.
- Owner review showed these were still the wrong implementation approach.

The key failure was treating the old product as inspiration and rebuilding the UI with the new shell. Owner then explicitly required:
- finish the complete UI first;
- use the old Web/APK as the actual visual/layout source;
- only after UI approval rebuild/wire the agreed business logic.

D044 was superseded. D057 is now authoritative.

## 4. Visual/layout source-of-truth

Read-only legacy source:
- Repository: `tam95supra-source/bao-hang-1291`
- Reference main commit: `8713f487386fa39c9225b180b2b8448d4a7e2b2d`
- This repository is **visual/presentation reference only**.

Owner-provided screenshots of the running old product are also visual authority. The old Web shown by Owner has the following recognizable shell:
- centered login card with `1291` brand block and concise login fields;
- after login, **full-width topbar**, not a small floating header;
- product identity/status chips at top-left;
- user identity/actions at top-right;
- the role-test strip is removed under D058 until Owner explicitly reintroduces an appropriate test surface;
- Admin/Root uses a **grouped left sidebar** and a large workspace to the right;
- content density is operational and compact, not large empty whitespace;
- dashboard/queue/cards/tables use the old product's spacing and hierarchy;
- role pages remain visually part of one coherent application shell.

Do not infer a new layout from these principles. Read the old source and preserve its presentation structure directly.

## 5. D057 implementation rule

**Presentation may be transplanted. Legacy backend may not.**

Allowed:
- DOM/layout hierarchy;
- CSS presentation modules;
- native Android XML layouts;
- drawables/colors/styles/themes;
- row/overlay presentation resources;
- presentation density/spacing/hierarchy/responsive behavior.

Forbidden:
- old backend/provider code;
- old auth/session architecture;
- old databases/storage;
- credentials/secrets/tokens/keys;
- out-of-scope inventory fields/resources.

Current SUPRA Inventory service/API/database architecture remains authoritative.

## 6. What has already been implemented under D057

### Web direct transplant

PR #31 directly transplanted old presentation styles into:
- `web/src/legacy-transplant/style.css`
- `web/src/legacy-transplant/web-fast-ui.css`
- `web/src/legacy-transplant/workflow-dashboard-v5.css`
- `web/src/legacy-transplant/warehouse-ui-v2.css`
- `web/src/legacy-transplant/ops-console.css`
- `web/src/legacy-transplant/workflow-v3-overrides.css`
- `web/src/legacy-transplant/workflow-v4-ux.css`

Current Web shell was changed to use the old presentation structure:
- full-width topbar;
- health/status chips;
- no role-test strip under D058;
- grouped left sidebar for Admin/Root;
- old workspace composition;
- old dashboard visual language;
- old master/detail operational queue presentation;
- legacy-style management/reporting surfaces.

Current implementation entry:
- `web/src/operational-app.ts`

The old backend JS was **not** imported.

### Android/PDA direct transplant

Native legacy presentation resources transplanted into current Android project:
- `activity_login.xml`
- `activity_main.xml`
- `view_picker.xml`
- `view_invent.xml`
- `view_admin.xml`
- `row_issue.xml`
- `overlay_alert.xml`
- legacy button/card/input/overlay drawables;
- legacy colors;
- legacy widget styles/themes.

Current app now **inflates/binds these native resources** instead of approximating the old UI with programmatic `LinearLayout` construction where a legacy XML screen exists.

Important current bindings:
- `MainActivity.kt` inflates legacy activity/role layouts.
- Picker controller binds to transplanted Picker XML.
- Reporter controller uses transplanted Invent/row presentation.
- Critical Picker result uses transplanted alert/overlay presentation.

## 7. Technical evidence already completed

D057 implementation:
- PR #31: `ui: directly transplant legacy Web and Android presentation`
- Merge/runtime source: `fa677463b898768a60013861220fce6e6192999e`

Automated checks on that source:
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard: PASS.
- Operational V2 regression: PASS.
- Realtime cursor regression: PASS.
- Web operational regression: PASS.
- Android operational regression: PASS.
- Support diagnostics regression: PASS.
- Worker typecheck: PASS.
- Web production build: PASS.
- Android debug build: PASS.

Runtime/release:
- Deploy Beta run: `35309444859` — PASS.
- UI Design Guard run: `35309444877` — PASS.
- Verify Beta Android run: `35309444931` — PASS.
- Signed release: `beta-vc43`.
- APK size: `9283170` bytes.
- APK SHA-256: `37dbc5e64cd144bbcb9dcb3787d7b65a3486907746822d95a8e902e52f9a27d8`.

Continuity:
- PR #32 recorded vc43 runtime/release evidence.
- Current main after PR #32: `11d056f4dd970eb1e3bf435628c997844f9314e6`.

These facts prove technical eligibility for review only.


### D063 source candidate — consolidated operations, logs, reporting, presence and people UI

Owner requirements are recorded as D063. The Beta Drive folder `Inventory/Beta/Logs` exists and is registered in project scope/resource state. Source work adds sanitized Web/Android scheduled/error/manual log upload, online-user counts derived from active authenticated realtime sockets, max-three-child sidebar grouping, merged `Vận hành báo hàng` and `Tổng quan & báo cáo` workspaces, a redesigned `Nhân sự & tài khoản` surface, plain-Vietnamese reporting copy and additional dark-theme coverage. D062 remains the deployed Web runtime until D063 passes branch/PR guards and merge/deploy. Latest signed Android review release remains beta-vc45 until the D063 signed build pipeline completes. Stable is untouched.

### D062 runtime PASS — final Web QA and canonical navigation

D062 preserves already-correct D061 work and closes only the remaining gaps: canonical five-area Admin/Root navigation using existing routes, operational queue as default landing, direct access to results/HR/account surfaces, and dark-theme coverage for expanded/transient legacy surfaces. PR #42 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`; Beta deploy run `35347188833` PASS including health/schema, auth/business guards, Web shell and Google OAuth smoke. Android beta-vc45 and Stable are unchanged. Owner UI acceptance remains pending.

### D061 runtime PASS — dark/sidebar/realtime cleanup

Owner review requirements now captured in D061:
- dark theme is coherent across currently reachable operational, management, reporting and system surfaces; no white table/workspace islands or near-invisible light-theme labels;
- Admin/Root sidebar group headings are larger/stronger and group/business entries use inline monochrome SVG icons with no external dependency;
- redundant category eyebrow + page-title copy and nonessential repeated explanations are removed;
- generic `Làm mới`/refresh controls are removed from realtime-backed operations/results/Picker/user views; semantic filters/export/support diagnostics remain;
- Android beta-vc45 and Stable are unchanged.

Runtime evidence: PR #40 merged at `967365bffa8d518e8ad85d802b14753bc5f4fa1d`; Repo Authority Guard PASS; Project State Guard PASS; UI Design Guard run `35334240734` PASS; Beta deploy run `35334240991` PASS including health/schema, auth/business guards, Web shell and Google OAuth smoke. Owner UI acceptance remains pending. Stable and Android beta-vc45 were not changed by D061.

### D060 runtime PASS — Root effective role + theme

D060 is deployed on Beta and technically eligible for Owner review:

- company line is larger/stronger; `Website nghiệp vụ Inventory 1291` is secondary/smaller;
- header identity is display name + mapped permission only; username/user id and literal Tên/User/Quyền labels are removed;
- redundant Dashboard date/update/`Mở xử lý báo thiếu` head metadata is removed;
- immutable base ROOT gets `Kiểm tra quyền` selector for ROOT / ADMIN / REPORTER / PICKER;
- the selected value is server-authoritative effective permission: normal HTTP RBAC, realtime projection and role-target FCM use the effective role;
- existing Root realtime sockets close on role change to prevent higher-role projection from surviving;
- base ROOT recovery path remains available so ROOT can select ROOT again;
- Web clears role-scoped state, reroutes to the selected role landing surface and reconnects realtime;
- Web theme selector persists `Tự động / Sáng / Tối`; Auto is dark 18:00–05:59 Asia/Ho_Chi_Minh and light 06:00–17:59;
- dark mode covers actual shell/content/cards/tables/forms/dialogs/diagnostics/footer;
- Android beta-vc45 refreshes `/api/auth/me` on resume and rerenders if the server effective role changed. Broader Android visual review remains pending.

Technical evidence:
- PR #38 merged: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`.
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35326095346`: PASS.
- Beta deploy run `35326095378`: PASS, including SQLite schema 6 health, auth/business guards, Web shell and Google OAuth smoke.
- Verify Beta Android run `35326095361`: PASS.
- Signed release: `beta-vc45`.
- APK size: `9283170` bytes.
- APK SHA-256: `c2ee4740ebee30fcdfc0ae8dcda44f7d5116dbefe8fbaed035a885e3d98ca5fb`.
- Owner Web/role/theme acceptance: **PENDING**.
- Stable: untouched / OWNER-GATED.

### D059 Web header/identity refinement

Owner feedback after D058 refined the product header without changing Android:
- corporate identity now shows `CÔNG TY CỔ PHẦN THE SUPRA - DC HƯNG YÊN` and `Website nghiệp vụ Inventory 1291`;
- old status chips are replaced by `Service: Cloudflare ON/OFF | Cập nhật: HH:mm MM/DD/YYYY`;
- the update timestamp represents the latest authoritative information received by this Web client, including realtime business events, not a ticking local clock;
- top-right identity shows Tên / User / Quyền plus Đăng xuất only; topbar Đổi mật khẩu is removed;
- role labels are Quản trị hệ thống / Người báo hàng / Người lấy hàng;
- Admin/Root left navigation is fully left-aligned;
- Web uses a clean local/system Segoe UI Variable/Aptos/Segoe UI/Roboto/Noto Sans stack.

Technical evidence:
- PR #36 merged to main: `b93175cfc62ff4504d6e28b9379b09ba4e61f809`.
- PR Repo Authority Guard: PASS.
- PR Project State Guard: PASS.
- PR UI Design Guard run `35321914326`: PASS.
- Beta deploy run `35322055302`: PASS.
- Main push Repo Authority Guard / Project State Guard / UI Design Guard: PASS.
- Beta health/business-auth/Web-shell/Google-OAuth smoke checks: PASS.
- Owner Web UI acceptance: **PENDING**.

### D058 Web Owner-review repair

Owner feedback after D057 exposed a Web shell bug and explicit Web refinements. PR #34:
- removed the inherited logged-in `shell` class that centered grid children and caused the topbar/workspace to render like a narrow centered card;
- removed `Kiểm thử giao diện + quyền server`;
- removed the Owner-rejected AI/implementation-style explanatory copy;
- pins the desktop topbar and Admin/Root sidebar while the central workspace scrolls;
- removes page-level centered `max-width` dead space for the main dashboard/report workspace;
- fixes the small product credit at bottom-right;
- leaves Android/APK unchanged.

Technical evidence:
- PR #34 merged to main: `d848546d429dba60bb88e6f9686e83b05c730994`.
- PR Repo Authority Guard: PASS.
- PR Project State Guard: PASS.
- PR UI Design Guard run `35313797934`: PASS.
- Beta deploy run `35313918056`: PASS.
- Beta health/business-auth/Web-shell/Google-OAuth smoke checks: PASS.
- Owner Web UI acceptance: **PENDING**.


## 8. Owner review status at chat handoff

Status: **IN PROGRESS**.

D063 is under source/build verification; after Beta deploy, Owner will review the consolidated Web candidate. Android/PDA broader visual review remains pending separately.

No D060 Web/theme/role-test surface or beta-vc45 Android surface should be marked Owner-approved unless the Owner explicitly says it is OK.

The next session must accept feedback in the Owner's normal format, e.g.:
- `1 OK`
- `2 chưa OK`
- screenshot + description
- a short sentence naming the screen/problem.

Do not require a formal test report.

## 9. Screen-by-screen review scope

### Web

Review at minimum:
1. Login.
2. Topbar / status chips / user actions.
3. Admin/Root grouped left sidebar.
4. Tổng quan hôm nay/dashboard.
5. Xử lý báo thiếu / Reporter operational queue.
6. Result/recent-result views.
7. Danh mục / Master SKU.
8. HR source / nhân sự source configuration.
9. Tài khoản & Picker / account management.
10. SLA/business-time settings.
11. Báo cáo vận hành / detailed reporting.
12. System/service/diagnostics/log/version surfaces.
13. Responsive behavior at narrower widths.

### Android/PDA

Review at minimum:
1. Login.
2. Shared header/identity/tools.
3. Picker SKU search/select/report flow presentation.
4. Picker today/history row presentation.
5. Reporter/Invent queue.
6. Reporter row/card/detail/actions.
7. Skip confirmation visual.
8. Critical final result overlay.
9. Admin/Root native view/launcher.
10. Narrow PDA sizing, scroll behavior, alignment and touch targets.

## 10. How to process each new UI review item

For every rejected/changed screen:

1. Fresh-read canonical project state.
2. Identify the exact current implementation file.
3. Compare against:
   - `tam95supra-source/bao-hang-1291@8713f487386fa39c9225b180b2b8448d4a7e2b2d`;
   - D057;
   - Owner's current screenshot/feedback.
4. Repair **presentation only** unless Owner explicitly changes scope.
5. Do not replace the old structure with a newly invented design.
6. Update canonical project state for meaningful work.
7. Branch → PR → required guards/builds → merge.
8. Follow runtime/release to terminal PASS when client source changes.
9. Present the next Web/APK review candidate.
10. Do not call it UI PASS until Owner explicitly accepts it.

## 11. What must NOT happen in the next session

Until explicit Owner UI acceptance:
- do not resume business-logic rebuild;
- do not reinterpret the legacy visual language;
- do not replace transplanted Android XML with approximate programmatic layouts;
- do not switch Admin/Root Web back to a horizontal-tab-only shell;
- do not treat CI/build/deploy success as visual acceptance;
- do not ask Owner to explain old requirements already canonical in GitHub;
- do not import legacy backend/provider/auth/storage/database resources;
- do not commit secrets or sensitive runtime material;
- do not push directly to main.

## 12. Business work intentionally deferred

The canonical business requirements are already preserved in:
- `docs/OWNER_DECISIONS.md`
- `docs/specs/ROLE_WORKFLOWS.md`
- `docs/specs/AUTH_RBAC.md`
- `docs/specs/FORMS.md`
- `docs/specs/SKU_MASTER.md`
- `docs/specs/REALTIME_NOTIFICATIONS.md`
- `docs/specs/DATA_LIFECYCLE.md`
- `docs/specs/REPORTING_DASHBOARD.md`

After Owner UI acceptance, those specifications become the implementation authority for rebuilding/wiring business behavior into the accepted shell.

Do not ask Owner to restate them.

## 13. Current canonical state pointers

Always bootstrap:
1. `ops/authority-manifest.json`
2. full declared `bootstrap_order`
3. recent commits/CI
4. relevant live source

Useful current files:
- work state: `ops/project-state.json`
- Owner decisions: `docs/OWNER_DECISIONS.md`
- UI authority: `docs/specs/UI_DESIGN_SYSTEM.md`
- UI acceptance levels: `docs/specs/ACCEPTANCE_TESTING.md`
- runtime/resource status: `ops/resource-registry.json`
- readiness view: `docs/SERVICE_READINESS.md`

## 14. Continuity rule

No manual end-of-session handover is required. A new session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.

The Owner's next-chat instruction **`Chốt D065 menu 3 nhóm`** is sufficient to resume from this point; any Web screenshot or UI review text supplied with it becomes the immediate work item.


## D063 runtime PASS — 2026-09-19

PR #44 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`. Repo Authority, Project State and UI Design guards PASS. Deploy Beta run `35371181168` PASS including health/schema, auth/business guards, Web shell and Google OAuth start; `LOGS_FOLDER_ID` is bound to `Inventory/Beta/Logs`. Signed Android release `beta-vc45` published from the same source; Verify Beta Android run `35371181163` PASS, APK SHA-256 `fd9882d08d0aca288114595f79e1f2447141c4fb8ed32cf5750dd001a9c58c61`. Authenticated end-to-end Web/Android log upload still requires field verification with a real signed-in client. Stable remains untouched.

### D064 active workstream — detailed system status + controlled Beta load test

D064 source adds live InventoryCore storage/table/business/realtime metrics, cached Google Drive storage/folder usage, current GitHub Beta release data, clear reference limits without billing-plan inference, and a redesigned professional system-status console with 60-second core refresh / five-minute provider cache. A Beta-only GitHub Actions workload will temporarily enable a masked random load-test gate, create real Firebase-authenticated sessions for 100 existing active Pickers, submit 1,000 normal `/api/picker/reports` requests across about 400 existing SKUs over at most 10 minutes, persist a bounded before/after aggregate, and always disable the gate. Test records remain normal Beta data for Owner inspection. After measured evidence, AI analyzes/proposes the next sidebar IA but does not implement it until Owner approval.


## D064 measured load evidence — PASS

- GitHub Actions run: `35376099693`
- Test ID: `d064-20260918174507-c9c3822f`
- 1,000 / 1,000 successful normal Picker reports
- 100 existing active Picker identities
- 400 existing Master SKU covered
- Duration: 525.423 seconds
- Average response: 250.34 ms
- P50: 235.95 ms
- P95: 348.72 ms
- Max: 625.64 ms
- Error count: 0
- SQLite delta: +2,572,288 bytes
- Row delta: +400 report batches, +1,000 report tickets, +1,000 report events, +1,000 realtime events, +1,000 audit rows
- Temporary Beta load-test gate: verified closed
- Test rows remain ordinary Beta data for Owner inspection; Stable untouched.

Post-test IA proposal: `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md`. It is proposal-only until Owner approval.


## D065 three-group navigation proposal — pending Owner exact composition approval

Owner refined the post-load IA requirement: Admin/Root Web left navigation must use exactly **3 large groups**, with at most **5 visible children per group**.

Current proposal:
- **VẬN HÀNH** → `Xử lý báo hàng`, `Tổng quan & báo cáo`
- **QUẢN LÝ** → `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`
- **HỆ THỐNG** → `Trạng thái hệ thống`, `Nhật ký`

Consolidation:
- `Kết quả gần đây` stays inside `Xử lý báo hàng`;
- `Nguồn nhân sự` + Picker sync move inside `Nhân sự & tài khoản`;
- personal `Tài khoản & mật khẩu` moves to pinned identity/user control;
- Reporter shows only its VẬN HÀNH projection; Picker Web keeps its single operational workflow;
- Android/PDA unchanged; Stable untouched.

Proposal detail: `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md`.
Do not implement the sidebar until Owner approves/refines the exact composition.


## D066 three-group navigation — Beta runtime PASS

Owner approved the exact D065 proposal and authorized Beta Web implementation.

Approved Admin/Root pinned-left navigation:
- **VẬN HÀNH** → `Xử lý báo hàng`, `Tổng quan & báo cáo`
- **QUẢN LÝ** → `Danh mục SKU`, `Nhân sự & tài khoản`, `Thời gian xử lý`
- **HỆ THỐNG** → `Trạng thái hệ thống`, `Nhật ký`

Implementation details:
- `Kết quả gần đây` stays as an internal tab of `Xử lý báo hàng`.
- `Nguồn nhân sự` and `Đồng bộ Picker` are internal tabs/sections of `Nhân sự & tài khoản`.
- personal account/password access is removed from the business sidebar and moved to the pinned top identity controls.
- Reporter shows only its permitted VẬN HÀNH projection.
- Picker Web keeps its single `Báo thiếu hàng` workspace.
- Android/PDA unchanged. Stable untouched and OWNER-GATED.

Current source marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.
Next action: Owner field-tests D070 on deployed Beta Web and Android beta-vc46; technical/runtime PASS is complete.

## D066 runtime evidence — clean handoff

Technical/runtime work for the approved three-group Web navigation is complete.

- Implementation PR: **#50**
- Main source: `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- PR Repo Authority Guard: **PASS** (`35407099582`)
- PR Project State Guard: **PASS** (`35407099580`)
- PR UI Design Guard: **PASS** (`35407099550`)
- Main UI Design Guard: **PASS** (`35407227884`)
- Beta deploy: **PASS** (`35407227911`)
- Runtime smoke in deploy: health/schema, auth/business guards, Web shell and Google OAuth start all PASS
- Stable: **untouched / OWNER-GATED**
- Android/PDA: **unchanged**

Deployed Admin/Root sidebar:
- **VẬN HÀNH** → Xử lý báo hàng; Tổng quan & báo cáo
- **QUẢN LÝ** → Danh mục SKU; Nhân sự & tài khoản; Thời gian xử lý
- **HỆ THỐNG** → Trạng thái hệ thống; Nhật ký

Internal consolidation:
- Kết quả gần đây remains inside Xử lý báo hàng.
- Nguồn nhân sự + Đồng bộ Picker are inside Nhân sự & tài khoản.
- Personal account/password access is in the pinned top identity controls, not the business sidebar.
- Reporter and Picker keep role-specific projections.

**Next chat command:** `Kiểm tra live D066 và tiếp tục từ NEXT_ACTION`.

No manual end-of-session handover is required; bootstrap from `ops/authority-manifest.json`.


## D067 active refinement — 2026-09-19

Owner accepted D066 as the current Web baseline and requested 10 bounded refinements: text zoom; clickable complete pending/warning/overdue lists; latest-report detail; responsive one-row-per-Picker detail; scroll preservation; optional 5-second Skip guard; HAS_STOCK confirmation; Web-log de-duplication; clean end-user copy; and removal of the 200-row pending-queue truncation. Source marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. Stable remains OWNER-GATED.


## D067 runtime PASS — 2026-09-19

PR #52 merged at `c2249ceea9fbb9570c3855fc2a0a421b251e3328`. Repo Authority Guard `35411796234`, Project State Guard `35411796230`, UI Design Guard `35411796208` and Beta deploy `35411796215` all PASS. UI Guard includes Worker typecheck, Web production build and Android debug build; deploy verifies health/schema, auth/business guards, Web shell and Google OAuth start. Current source marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. Next step is Owner testing of the exact 10 requested D067 items; freeze each item once marked OK. Stable remains OWNER-GATED.


## D068 active Web refinement — 2026-09-19

Owner accepted and froze D067 items 1–8 and 10. D068 reopens only item 9 and adds requirements 11–15: full user-facing copy cleanup, bottom-left max-five 5-second translucent toasts, clear active backgrounds, interaction-delay repair, larger VẬN HÀNH / QUẢN LÝ / HỆ THỐNG headings, and same-page Back/Forward history. Latest Web log at 09:20 ICT showed realtime connected, service reachable, browser RTT about 50 ms, 10 Mbps reported downlink and JS heap under 3 MB; source inspection identified route rendering waiting for data load and selected-SKU full-list rerender as actionable UI delay causes. D068 is now merged and Beta runtime PASS. Source marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. Android unchanged; Stable OWNER-GATED.

Next command: `Kiểm tra live D068 và test mục 9, 11-15`.


## D068 runtime PASS — 2026-09-19

PR #54 merged at `ba8579a157763288ff0cc3cca885e65e593917be`. Repo Authority Guard `35416184056`, Project State Guard `35416184002`, UI Design Guard `35416184004` and Beta deploy `35416184023` all PASS. Deploy verified health/schema, auth/business guards, Web shell and Google OAuth start. Current marker: `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`. D067 items 1–8 and 10 remain frozen; Owner now tests only item 9 and requirements 11–15. Stable remains OWNER-GATED.


## D068 clean-log-copy runtime PASS — 2026-09-19

PR #56 merged at `656fb8d24b44e7adb087aabb6a8a02691b278d43`. Repo Authority Guard `35417472683`, Project State Guard `35417472778`, UI Design Guard `35417472752` and Beta deploy `35417472735` all PASS. Normal Nhật ký UI now shows a structured operational summary instead of raw runtime-log filenames/JSON. Owner review remains limited to D067 item 9 and D068 requirements 11–15; D067 items 1–8 and 10 remain frozen. Stable untouched.


## D069 active Web candidate — 2026-09-19

Owner accepted the complete D068 Web baseline. D069 Beta-Web scope implements rich redacted diagnostic logging, native Excel `.xlsx` reporting export, one final unified visual layer across Web including a rebuilt `Thời gian xử lý` layout, and client responsiveness work that avoids unnecessary full-shell rebuilds and records API/render/realtime/long-task timings. Enhanced pending-SKU alert behavior remains proposal-only until Owner approval. Android unchanged; Stable OWNER-GATED.


## D069 Beta runtime PASS — 2026-09-19

PR #58 merged at `fbd2e5c84ec2c401c784d5921b82aa6689bed2ee`. Main Repo Authority Guard `35419150651`, Project State Guard `35419150563`, UI Design Guard `35419150637` and Beta deploy `35419150648` all PASS. Deployed scope: rich redacted Web diagnostics, native Excel `.xlsx` export, unified Web presentation including `Thời gian xử lý`, and scoped-render/off-screen-paint responsiveness work. D068 is fully Owner-accepted/frozen. D069 item 3 pending-SKU alert behavior is proposal-only and not implemented. Stable untouched.


## D070 approved three-stage timing candidate — 2026-09-19

Owner approved the enhanced alert policy with three entered minute thresholds constrained as `warning < escalation < auto_skip`, an auto-Skip enable/disable switch and `FIRST_REPORT` / `PER_PICKER` timing modes. D050 no-auto-Skip is superseded. Current source candidate `D070_THREE_STAGE_SLA_AUTO_SKIP_BETA_RUNTIME_PASS__OWNER_FIELD_ACCEPTANCE_PENDING` implements InventoryCore Durable Object alarms, idempotent warning/escalation events, optional `SKIP_ALLOWED / SYSTEM_TIMEOUT`, exact Picker ACK targeting, grouped role alerts, Web/Android timeout surfaces, non-retroactive activation and fail-safe disable/mode-change cancellation. No extension feature is included. Stable untouched/OWNER-GATED.

D070 Android source marker: `D070_TIMEOUT_ALERT_PROJECTION_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`. Android changes are limited to timeout/deadline/result-source projection and background-alert labels; signed Beta release verification remains pending. Stable untouched.


## D070 Beta technical/runtime PASS — 2026-09-19

PR #60 merged at `3f3506a0f185d5e1a0f22ba6a908b161bae6dd6e`. Main Repo Authority Guard `35426339784`, Project State Guard `35426339862`, UI Design Guard `35426339800` and Beta deploy `35426339796` all PASS. Live health reports SQLite schema `7/7` and Operational V2 schema `5/5`; auth/business API, Web shell and Google OAuth smoke are PASS. Signed Android `beta-vc46` was published by Verify Beta Android run `35426339846` after the matching Beta runtime gate passed; APK SHA256 is `875b5bd32f22f77fbe7453020d38c60d587a97720bd14cecdae89d202e39287e`.

D070 deployed behavior: three entered thresholds with strict `warning < escalation < auto_skip`; automatic Skip ON/OFF; `FIRST_REPORT` and `PER_PICKER` timing; Durable Object alarm authority; `SKIP_ALLOWED / SYSTEM_TIMEOUT`; exact Picker result/ACK targeting; grouped Reporter/Admin/Root alerts; existing 5-minute Skip→Có hàng correction; no extension feature; D007 queue ordering unchanged; activation is non-retroactive. Technical/runtime PASS is complete. Owner live timing/device/background-FCM acceptance is still required. Stable remains untouched/OWNER-GATED.


Current Android marker: `D070_TIMEOUT_ALERT_PROJECTION_SIGNED_BETA_VC46_RUNTIME_GATE_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.


## D071 Web immediate-response/density candidate — 2026-09-19

Owner accepted the preceding Web review points and requested four Beta-Web refinements. Current source marker: `D071_WEB_IMMEDIATE_RESPONSE_DENSITY_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`.

- normalize every Web checkbox to one compact fixed size;
- raise the Web typography baseline by about 5%, with that new baseline displayed as logical `100%` in the existing text-size control;
- compress Overview/Detailed-report date selection into one inline date/preset group instead of a large extra row;
- Reporter final `Có hàng` / `Bỏ qua` confirmation closes immediately, shows a per-batch in-progress state, waits for authoritative service success before showing success toast, removes the old synchronous post-mutation `loadOperations()` chain, and coalesces concurrent complete-queue refreshes.

Support logs show no browser long tasks or memory pressure. The observed 1–3 second delay is dominated by roughly 0.8–0.9 second resolve POSTs followed by complete queue/recent refresh/realtime reconcile work; section DOM render itself is only tens of milliseconds. Android/PDA is unchanged. Stable remains untouched/OWNER-GATED.

Next command after runtime PASS: `Kiểm tra live D071 và review 4 mục Web mới`.


## D071 deploy blocker / D070 alarm runtime repair — 2026-09-19

D071 Web source merged at `f5c6287bdc0a2fa28c4de68116e910c3300b2255`; PR and main authority/state/UI/regression guards PASS. Beta deploy run `35429735327` built and deployed successfully on two attempts, but both attempts failed the live health gate: `HTTP 503 degraded`, all required bindings present, `storage.ok=false`, schema `0/0`, Operational V2 `0/0`. D071 changed no service source, so D071 runtime PASS is **not** declared.

Source investigation found a D070 alarm scheduling defect: if an alarm first sees a batch after escalation is already due, ESCALATED can be recorded while WARNING remains unrecorded. The scheduler then continues to see the old WARNING deadline in the past and can re-arm every 250 ms indefinitely. Current repair marker: `D070_ALARM_RUNTIME_AVAILABILITY_REPAIR_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`. The repair consumes a missed warning without emitting a late warning, bounds catch-up to 50 rows/category, enforces at least one second between catch-up alarms, schedules authoritative next work before notification delivery, and prevents downstream realtime/FCM delivery failure from throwing/retrying already-committed alarm work. D070 business semantics remain unchanged. Android beta-vc46 unchanged. Stable untouched/OWNER-GATED.

Current Web marker: `D071_WEB_SOURCE_MERGED__BETA_HEALTH_BLOCKED_BY_D070_STORAGE_UNAVAILABLE`.
Current Android marker: `D070_TIMEOUT_ALERT_PROJECTION_SIGNED_BETA_VC46_RUNTIME_GATE_PASS__OWNER_FIELD_ACCEPTANCE_PENDING`.

Next action: repair guards → merge → Beta deploy → require health/storage/schema/auth/business/Web/OAuth PASS → record D071 runtime continuity → Owner reviews the four D071 Web items.


## D070 runtime repair + D072 quota guard — 2026-09-19

Current source marker: `D070_ALARM_REPAIR_D072_SYSTEM_STATUS_QUOTA_GUARD_SOURCE_IMPLEMENTED__PR_GUARDS_PENDING`.

- D070 repair prevents an already-past warning deadline from continuously re-arming after escalation, bounds alarm catch-up, schedules the next authoritative alarm before downstream delivery, and prevents realtime/FCM failure from retrying committed alarm work.
- D072 removes `Trạng thái hệ thống` from normal Web navigation/routing, removes its manual/60-second monitoring calls, disables `GET /api/admin/system-status` before metric collection, and keeps Beta load-test snapshots core-only without Google Drive/GitHub provider reads.
- D071 Web source remains merged and will be runtime-reviewed only after Beta health recovers.
- Stable remains untouched/OWNER-GATED.

Next action: guards → PR → merge → Beta deploy → health/schema/auth/business/Web/OAuth PASS → record runtime continuity.


Current Web marker: `D071_WEB_SOURCE_MERGED__D072_SYSTEM_STATUS_EXCLUDED_SOURCE_IMPLEMENTED__BETA_RUNTIME_REPAIR_PENDING`.


## D070 repair + D071/D072 Beta runtime PASS — 2026-09-19

Runtime source: `ca5ab13a3f52722b595ce7a713afa95891a8b002` (PR #63).

Main Repo Authority Guard `35439017807`, Project State Guard `35439017780`, UI Design Guard `35439017789` and Beta deploy `35439017752` all PASS. Beta health passed on the first probe: HTTP 200, storage ready, SQLite schema `7/7`, Operational V2 `5/5`; auth/Root bootstrap, business API/auth guards, Web shell and Google OAuth start also PASS.

Current Web marker: `D071_IMMEDIATE_RESPONSE_DENSITY_D072_SYSTEM_STATUS_QUOTA_GUARD_BETA_RUNTIME_PASS__OWNER_REVIEW_PENDING`. D071 is live for Owner review: uniform checkboxes, logical 100% at the new ~5% larger baseline, compact date controls, and immediate Reporter Có hàng/Skip pending feedback without synchronous full-queue reload. D072 is live: normal `Trạng thái hệ thống` navigation/routing/manual/60-second polling is removed, the normal admin system-status endpoint is quota-guard disabled, and the gated Beta load-test snapshot is core-only without Google Drive/GitHub provider reads. `HỆ THỐNG` exposes only `Nhật ký`.

Android remains signed `beta-vc46` and unchanged by PR #63. Stable remains untouched/OWNER-GATED.


## D073 Picker-to-Agent relay POC build/release PASS — 2026-09-19

Source merged in PR #65 at `f7c596f60eac626989a58ea40492417006ee61b1`.

PR Authority/Continuity/UI/Windows Agent gates PASS. Main Authority/Continuity/UI, Beta deploy `35442854000`, Verify Beta Android `35442853998`, and Verify Beta Relay Agent `35442853985` PASS. Signed Android release is `beta-vc47` with APK SHA-256 `8e2fc11e09940db061edf4c23b5973ec2be9300b2ddfc4835bcef1d3af74c439`; portable normal-user Windows Agent EXE SHA-256 is `1b51c33d53a53a0fb8b7c6a9c4f4305f7c042bbd2c97e91b082144587c7bdd73`.

D073 remains a transport-only Beta POC: Picker sends exactly five test digits through Firebase RTDB and the Windows Agent returns ACK/diagnostic timing. There is no WMS lookup or mutation. `OA002` remains OPEN: create the scoped Beta RTDB in Singapore locked mode, publish `firebase/database.rules.json`, then field-test PDA → relay → laptop on Office → ACK/RTT. Stable remains OWNER-GATED and untouched.

Current Android marker: `D073_RELAY_POC_SIGNED_BETA_VC47_BUILD_PASS__D070_FIELD_ACCEPTANCE_PENDING`.


## D074 relay field repair — 2026-09-19

First Office field test reached Firebase but authenticated RTDB read/SSE returned HTTP 403. D074 classifies this as auth/Rules/path rather than generic network failure. Android and Windows now derive the relay path from Firebase ID-token `sub`; the Windows Agent gains persistent sanitized local diagnostics and explicit RTDB 403 classification. Picker is being split into bottom-pinned **Báo hết hàng / Xác nhận đơn** panels with denser controls and reliable exact-five-digit input/send. No WMS mutation exists in this phase; Stable remains OWNER-GATED.

Current Android marker: `D074_PICKER_SPLIT_TABS_RELAY_INPUT_AUTH_REPAIR_IN_PROGRESS__LATEST_SIGNED_BETA_VC47`.


## D074 build/release PASS — 2026-09-19

D074 repair is merged in PR #67 at `7464c3c3a89db00e657021bcec960c1e5ea53fd8`. PR Authority/Continuity/UI/Agent gates PASS. Main Repo Authority `35445108970`, Project State `35445108844`, UI Design `35445108860`, Beta deploy `35445109008`, Verify Beta Android `35445108881`, and Verify Beta Relay Agent `35445108964` all PASS.

Signed Android release: `beta-vc48` (`SUPRA Inventory Beta 0.2.0-beta.48`), APK size `9317178` bytes. Windows Agent artifact: run `35445108964`, artifact `10584778212`, ZIP SHA-256 `72d51fc4c6ab6e77d1d5cb9c0ba124a52eddd0fad929c24ac727fadea0f51628`.

Implemented: RTDB path from Firebase ID-token `sub` on Android and Agent; explicit RTDB 403/Rules classification; persistent sanitized local Agent diagnostics; Picker bottom-pinned **Báo hết hàng / Xác nhận đơn** tabs; denser Picker UI; exact-five-digit input with enabled send and IME Done support. D074 still performs no WMS lookup/mutation.

Next action is physical Owner field test of beta-vc48 + rebuilt Agent on `.Office@MSN`. If Office check still returns 403, use **Mở log** and provide the sanitized log for analysis. Stable remains OWNER-GATED.


Current Android marker: `D074_PICKER_SPLIT_TABS_RELAY_UID_AUTH_DIAGNOSTICS_SIGNED_BETA_VC48_BUILD_PASS__OWNER_FIELD_RETEST_PENDING`.
