# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`.

- Project: `supra-inventory`
- Web: `D067_WEB_UX_BETA_RUNTIME_PASS__OWNER_10_ITEM_ACCEPTANCE_PENDING`
- Android: `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed review APK: `beta-vc45`
- Web runtime source: `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- Android beta-vc45 source: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`
- Owner UI review: **D066 ACCEPTED; D067 runtime PASS; 10-item Owner test pending**

## D057 baseline + D058/D059/D060/D061/D062/D063/D064 refinements

Visual authority:
- old UI repository: `tam95supra-source/bao-hang-1291`
- pinned reference commit: `8713f487386fa39c9225b180b2b8448d4a7e2b2d`
- Owner-provided old running-product screenshots
- D057 in `docs/OWNER_DECISIONS.md`
- D058 Web shell refinement in `docs/OWNER_DECISIONS.md`
- D059 Web header/identity refinement in `docs/OWNER_DECISIONS.md`
- D060 Root-role/theme refinement in `docs/OWNER_DECISIONS.md`
- D061 dark/sidebar/realtime cleanup in `docs/OWNER_DECISIONS.md`
- D062 final Web QA/canonical navigation in `docs/OWNER_DECISIONS.md`
- D063 consolidated operations/logs/reporting/presence/people refinement in `docs/OWNER_DECISIONS.md`
- D064 detailed system status + controlled Beta load test + post-test IA review in `docs/OWNER_DECISIONS.md`

Current review endpoints:
- Web: `https://inventory-beta.supra.cc.cd/`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc45/supra-inventory-beta.apk`

D064 detailed system status is deployed on Beta and technically PASS. Controlled Beta load test run `35376099693` PASS with 1,000/1,000 real Picker reports across 100 existing Pickers and 400 existing SKUs in 525.423 seconds, no errors; temporary gate verified closed. Navigation IA was approved by Owner as D066 and is deployed on Beta; PR #50 guards PASS, main UI Design Guard `35407227884` PASS, Beta deploy `35407227911` PASS.

Android/PDA presentation includes transplanted old native activity/login/Picker/Invent/Admin/row/overlay XML plus drawables/colors/styles, with current controllers bound to those resources.

Legacy backend/provider/auth/storage/database/credential code remains excluded.

## Automated evidence

- PR #31 merged at `fa677463`.
- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35309444877`: PASS.
- Deploy Beta run `35309444859`: PASS.
- Verify Beta Android run `35309444931`: PASS.
- Signed release: `beta-vc43`.
- APK SHA-256: `37dbc5e64cd144bbcb9dcb3787d7b65a3486907746822d95a8e902e52f9a27d8`.
- APK size: `9283170` bytes.
- Runtime continuity PR #32 merged; main currently contains vc43 runtime evidence.
- D058 Web review repair PR #34 merged at `d848546d429dba60bb88e6f9686e83b05c730994`.
- D058 PR UI Design Guard run `35313797934`: PASS.
- D058 Beta deploy run `35313918056`: PASS, including health/business-auth/Web-shell/Google-OAuth smoke checks.
- D059 Web header/identity PR #36 merged at `b93175cfc62ff4504d6e28b9379b09ba4e61f809`.
- D059 PR UI Design Guard run `35321914326`: PASS.
- D059 Beta deploy run `35322055302`: PASS, including health/business-auth/Web-shell/Google-OAuth smoke checks.
- D059 main push Repo Authority Guard, Project State Guard and UI Design Guard: PASS.

Automated PASS is technical eligibility only. It is not Owner UI acceptance.

## D063 source candidate

`D067_WEB_UX_BETA_RUNTIME_PASS__OWNER_10_ITEM_ACCEPTANCE_PENDING` is the active Web source candidate; Android source marker is `VC45_D063_RUNTIME_LOGS_PLAIN_VIETNAMESE_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`. `Inventory/Beta/Logs` is created and registered. D062/beta-vc45 remain the deployed/signed runtime references until D063 CI, merge, Beta deploy and signed Android release complete. Stable remains untouched.

## D062 runtime PASS

`D062_WEB_FINAL_QA_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING` is deployed on Beta. PR #42 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`; Deploy Beta run `35347188833` PASS. Scope: canonical five-area Admin/Root navigation over existing approved modules, operational-first landing, hidden-route access repair, and remaining dark transient-surface coverage. Android beta-vc45 and Stable remain unchanged. Owner UI acceptance remains pending.

## D061 runtime PASS

Web-only Owner review refinement:
- dark theme parity across all reachable operational/management/reporting/system surfaces;
- larger sidebar section headings plus inline monochrome icons;
- duplicate category/title and nonessential explanatory copy removed;
- generic `Làm mới` controls removed from realtime-backed operational/results/Picker/user views;
- D060 Root effective-role/theme semantics preserved;
- Android beta-vc45 and Stable unchanged.

Evidence: PR #40 merged at `967365bffa8d518e8ad85d802b14753bc5f4fa1d`; Repo Authority Guard PASS; Project State Guard PASS; UI Design Guard run `35334240734` PASS; Deploy Beta run `35334240991` PASS including health/schema, auth/business guards, Web shell and Google OAuth smoke. Owner UI acceptance remains pending.

## D060 runtime PASS

D060 is deployed on Beta:
- immutable base ROOT may select effective ROOT/ADMIN/REPORTER/PICKER from Web;
- normal HTTP RBAC, realtime projection and role-target FCM honor the effective role;
- Root realtime sockets are revoked on role change;
- Web identity/header/Dashboard head follows current Owner review;
- Web theme supports persisted Auto/Light/Dark; Auto uses Asia/Ho_Chi_Minh dark 18:00–05:59;
- SQLite schema is 6;
- Android beta-vc45 refreshes effective role from `/api/auth/me` on resume.

Evidence:
- PR #38 merge: `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`.
- Deploy Beta run `35326095378`: PASS.
- UI Design Guard run `35326095346`: PASS.
- Verify Beta Android run `35326095361`: PASS.
- Signed release: `beta-vc45`.
- APK SHA-256: `c2ee4740ebee30fcdfc0ae8dcda44f7d5116dbefe8fbaed035a885e3d98ca5fb`.
- APK size: `9283170` bytes.
- Stable untouched.

Automated PASS is technical eligibility only. Owner UI/theme/role-test acceptance remains pending.

## Current work frontier

D064 runtime/load work is complete and D066 navigation is Owner-accepted. D067 is merged and Beta runtime PASS; next action is Owner testing of the exact 10 requested items.

For each Owner-rejected screen:
- compare current render to the pinned old source + current Owner feedback;
- fix presentation only;
- branch → PR → guards/build → merge → runtime/release;
- provide the next UI review candidate.

Do not resume business logic/scenario rebuild until explicit Owner UI acceptance.

## Next-chat resume command

`Kiểm tra live D067 và test 10 mục`

A screenshot or concise UI review note may be appended; no project-history restatement is required.


## D063 runtime PASS — 2026-09-19

PR #44 merged at `3481f94c2c4ef3dc37fd8f8dfcdbd48ee2b61982`. Repo Authority, Project State and UI Design guards PASS. Deploy Beta run `35371181168` PASS including health/schema, auth/business guards, Web shell and Google OAuth start; `LOGS_FOLDER_ID` is bound to `Inventory/Beta/Logs`. Signed Android release `beta-vc45` published from the same source; Verify Beta Android run `35371181163` PASS, APK SHA-256 `fd9882d08d0aca288114595f79e1f2447141c4fb8ed32cf5750dd001a9c58c61`. Authenticated end-to-end Web/Android log upload still requires field verification with a real signed-in client. Stable remains untouched.


## D064 active workstream

Source candidate rebuilds `Trạng thái hệ thống` as a detailed provider/usage/capacity console and adds a guarded Beta-only real-Picker load-test workflow. Core metrics refresh at most every 60 seconds while visible; Google Drive/GitHub reads are cached five minutes. The load test targets 1,000 successful normal Picker reports across 100 existing active Pickers and about 400 existing SKUs within <=600 seconds. Stable is untouched. Navigation grouping is not changed by D064; a measured post-test proposal is required first.


## D064 runtime/load PASS

- Detailed all-service system-status console: Beta deploy PASS.
- Load-test run `35376099693`: 1,000/1,000 reports, 100 existing Pickers, 400 existing SKUs, 525.423s, no errors.
- Response timing: avg 250.34ms; P50 235.95ms; P95 348.72ms; max 625.64ms.
- SQLite growth: +2,572,288 bytes; +400 batches; +1,000 tickets; +1,000 report events; +1,000 realtime events; +1,000 audit rows.
- Temporary Beta load-test gate verified closed.
- Post-test navigation proposal is stored at `docs/proposals/D064_NAVIGATION_IA_PROPOSAL.md`; implementation is Owner-gated.
- Stable untouched.


## D065 navigation proposal

Owner constraint: exactly 3 Admin/Root large navigation groups, maximum 5 visible children per group. Proposed composition is VẬN HÀNH (2), QUẢN LÝ (3), HỆ THỐNG (2). Exact composition remains Owner-gated before implementation. Personal account/password action moves out of the business sidebar. Android/PDA and Stable are unchanged.


## D066 Beta runtime PASS

Owner-approved Web navigation is now source-implemented:
- VẬN HÀNH (2): Xử lý báo hàng; Tổng quan & báo cáo
- QUẢN LÝ (3): Danh mục SKU; Nhân sự & tài khoản; Thời gian xử lý
- HỆ THỐNG (2): Trạng thái hệ thống; Nhật ký
- personal account/password moved to pinned identity controls
- HR source + Picker sync moved under the Nhân sự & tài khoản workspace
- Reporter/Picker projections remain role-specific
- Android/PDA unchanged; Stable untouched

Current Web marker: `D067_WEB_UX_BETA_RUNTIME_PASS__OWNER_10_ITEM_ACCEPTANCE_PENDING`.

D066 runtime evidence:
- PR #50 merged at `2e12e6d4e94b195e3b505b3f2abe9822ca91632c`
- PR Repo Authority / Project State / UI Design guards: PASS
- Main UI Design Guard run `35407227884`: PASS
- Beta deploy run `35407227911`: PASS
- Stable untouched; Android/PDA unchanged
- Owner visual acceptance remains pending


## D067 source candidate — 2026-09-19

`D067_WEB_UX_BETA_RUNTIME_PASS__OWNER_10_ITEM_ACCEPTANCE_PENDING` preserves the accepted D066 navigation while implementing the 10 requested Web UX corrections. PR guards and Beta runtime verification are still pending. Android and Stable are unchanged.


## D067 runtime PASS — 2026-09-19

PR #52 merged at `c2249ceea9fbb9570c3855fc2a0a421b251e3328`. Repo Authority Guard `35411796234`, Project State Guard `35411796230`, UI Design Guard `35411796208` and Beta deploy `35411796215` all PASS. Current Web marker: `D067_WEB_UX_BETA_RUNTIME_PASS__OWNER_10_ITEM_ACCEPTANCE_PENDING`. Stable is untouched and OWNER-GATED.
