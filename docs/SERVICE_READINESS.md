# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`.

- Project: `supra-inventory`
- Web: `D062_WEB_FINAL_QA_SOURCE_BUILD_PENDING_RUNTIME`
- Android: `VC44_D060_EFFECTIVE_ROLE_REFRESH_SIGNED_RUNTIME_GATE_PASS__BROADER_OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed review APK: `beta-vc44`
- Web runtime source: `967365bffa8d518e8ad85d802b14753bc5f4fa1d`
- Android beta-vc44 source: `765be7baa90e6645a592cc5137324c85fb793009`
- Owner UI review: **IN PROGRESS — no final UI acceptance yet**

## D057 baseline + D058/D059/D060/D061/D062 Web refinements

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

Current review endpoints:
- Web: `https://inventory-beta.supra.cc.cd/`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc44/supra-inventory-beta.apk`

Web presentation uses the D057 transplanted modules plus D058/D059/D060/D061 refinements. D061 is deployed: coherent dark surfaces, stronger icon-led sidebar groups, reduced duplicate page copy and removal of generic refresh actions from realtime-backed views.

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

## D062 source candidate

`D062_WEB_FINAL_QA_SOURCE_BUILD_PENDING_RUNTIME` is the active source candidate. It does not replace the deployed D061 runtime evidence until the branch/PR guards and Beta deploy finish. Scope: canonical five-area Admin/Root navigation over existing approved modules, operational-first landing, hidden-route access repair, and remaining dark transient-surface coverage. Android beta-vc44 and Stable remain unchanged.

## D061 runtime PASS

Web-only Owner review refinement:
- dark theme parity across all reachable operational/management/reporting/system surfaces;
- larger sidebar section headings plus inline monochrome icons;
- duplicate category/title and nonessential explanatory copy removed;
- generic `Làm mới` controls removed from realtime-backed operational/results/Picker/user views;
- D060 Root effective-role/theme semantics preserved;
- Android beta-vc44 and Stable unchanged.

Evidence: PR #40 merged at `967365bffa8d518e8ad85d802b14753bc5f4fa1d`; Repo Authority Guard PASS; Project State Guard PASS; UI Design Guard run `35334240734` PASS; Deploy Beta run `35334240991` PASS including health/schema, auth/business guards, Web shell and Google OAuth smoke. Owner UI acceptance remains pending.

## D060 runtime PASS

D060 is deployed on Beta:
- immutable base ROOT may select effective ROOT/ADMIN/REPORTER/PICKER from Web;
- normal HTTP RBAC, realtime projection and role-target FCM honor the effective role;
- Root realtime sockets are revoked on role change;
- Web identity/header/Dashboard head follows current Owner review;
- Web theme supports persisted Auto/Light/Dark; Auto uses Asia/Ho_Chi_Minh dark 18:00–05:59;
- SQLite schema is 6;
- Android beta-vc44 refreshes effective role from `/api/auth/me` on resume.

Evidence:
- PR #38 merge: `765be7baa90e6645a592cc5137324c85fb793009`.
- Deploy Beta run `35326095378`: PASS.
- UI Design Guard run `35326095346`: PASS.
- Verify Beta Android run `35326095361`: PASS.
- Signed release: `beta-vc44`.
- APK SHA-256: `c2ee4740ebee30fcdfc0ae8dcda44f7d5116dbefe8fbaed035a885e3d98ca5fb`.
- APK size: `9283170` bytes.
- Stable untouched.

Automated PASS is technical eligibility only. Owner UI/theme/role-test acceptance remains pending.

## Current work frontier

Owner is reviewing the deployed D061 Web candidate. Android broader visual review remains pending separately.

For each Owner-rejected screen:
- compare current render to the pinned old source + current Owner feedback;
- fix presentation only;
- branch → PR → guards/build → merge → runtime/release;
- provide the next UI review candidate.

Do not resume business logic/scenario rebuild until explicit Owner UI acceptance.

## Next-chat resume command

`Tiếp tục review UI D062`

A screenshot or concise UI review note may be appended; no project-history restatement is required.
