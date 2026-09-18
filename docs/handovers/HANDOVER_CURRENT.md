# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and its complete `bootstrap_order` before any mutation. Canonical authority remains `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, the affected specs, project scope/resource registry and current source/CI. This file exists to make a new chat resume quickly without asking Owner to retell project history.

## 1. Exact current point

Canonical current markers:
- SQLite schema: `6`
- Latest Beta APK: `beta-vc45`
- Web: `D064_DETAILED_SYSTEM_STATUS_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`

The project is in **UI-first review**, not business-logic rebuild.

- Active visual baseline: **D057 — direct legacy presentation transplant**. Active Web review refinements: **D058 shell + D059 header + D060 Root-role/theme + D061 dark/sidebar/realtime cleanup + D062 final Web QA/IA + D063 consolidated operations/logs/reporting/people review**.
- D064 detailed `Trạng thái hệ thống` is deployed on Beta and technically PASS. Controlled Beta load test run `35376099693` also PASS: 1,000/1,000 real Picker reports, 100 existing Pickers, 400 existing SKUs in 525.423 seconds, no errors; temporary load-test gate verified closed. Post-test sidebar analysis is now documented in `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md` and awaits Owner decision before any navigation rebuild. Stable is unchanged.
- Owner has **not yet given UI/layout acceptance** for the current candidate.
- Technical build/deploy/release PASS must never be interpreted as Owner UI PASS.
- D064 system-status and controlled load-test implementation are complete. The only D064 product-design gate now is Owner review/refinement of the proposed navigation IA.
- Do **not** change the left-navigation grouping until the Owner approves/refines `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md`.

Current review targets:
- Web: `https://inventory-beta.supra.cc.cd/`
- Android signed review release (broader visual review pending): `beta-vc45`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc45/supra-inventory-beta.apk`
- Web runtime source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`
- Android beta-vc45 source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`
- Current Web runtime implementation source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`

## 2. Minimal command for the next chat

Owner can start the next chat with only:

> **Review D064 navigation IA proposal**

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

The Owner's next-chat instruction **`Review D064 navigation IA proposal`** is sufficient to resume from this point; any Web screenshot or UI review text supplied with it becomes the immediate work item.


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
