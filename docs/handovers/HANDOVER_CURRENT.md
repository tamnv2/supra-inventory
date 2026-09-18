# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and its complete `bootstrap_order` before any mutation. Canonical authority remains `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, the affected specs, project scope/resource registry and current source/CI. This file exists to make a new chat resume quickly without asking Owner to retell project history.

## 1. Exact current point

Canonical current markers:
- SQLite schema: `5`
- Latest Beta APK: `beta-vc43`
- Web: `D057_DIRECT_LEGACY_PRESENTATION_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC43_D057_DIRECT_LEGACY_NATIVE_XML_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`

The project is in **UI-first review**, not business-logic rebuild.

- Active design decision: **D057 — direct legacy presentation transplant**.
- Owner is **currently reviewing the actual Web + Android/PDA UI** produced by D057.
- Owner has **not yet given UI/layout acceptance** for the current candidate.
- Technical build/deploy/release PASS must never be interpreted as Owner UI PASS.
- Until explicit Owner UI acceptance, work is limited to **UI/layout/presentation mismatch repair**.
- Do **not** resume rebuilding/wiring the remaining logic, scenarios or business workflows yet.

Current review targets:
- Web: `https://inventory-beta.supra.cc.cd/`
- Android signed review release: `beta-vc43`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc43/supra-inventory-beta.apk`
- Runtime/UI implementation source: `fa677463b898768a60013861220fce6e6192999e`
- Current canonical main after runtime continuity: `11d056f4dd970eb1e3bf435628c997844f9314e6`

## 2. Minimal command for the next chat

Owner can start the next chat with only:

> **Tiếp tục review UI D057**

Then attach/send the current screenshot or concise review feedback, for example:
- `Web Tổng quan: chưa OK, sidebar rộng quá`
- `APK Picker: OK`
- `Reporter: button khác giao diện cũ`

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
- permission/test strip where applicable;
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
- role-test strip where applicable;
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

## 8. Owner review status at chat handoff

Status: **IN PROGRESS**.

Owner is reviewing the rebuilt D057 UI at the time this handoff is being written.

No screen in the current vc43 candidate should be marked Owner-approved unless the Owner explicitly says it is OK.

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

The Owner's next-chat instruction **`Tiếp tục review UI D057`** is sufficient to resume from this point; any screenshot or UI review text supplied with it becomes the immediate work item.
