# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`.

- Project: `supra-inventory`
- Web: `D058_WEB_DESKTOP_SHELL_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC43_D057_DIRECT_LEGACY_NATIVE_XML_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed review APK: `beta-vc43`
- Web runtime source: `d848546d429dba60bb88e6f9686e83b05c730994`
- Android beta-vc43 source: `fa677463b898768a60013861220fce6e6192999e`
- Owner UI review: **IN PROGRESS — no final UI acceptance yet**

## D057 baseline + D058 Web Owner-review refinement

Visual authority:
- old UI repository: `tam95supra-source/bao-hang-1291`
- pinned reference commit: `8713f487386fa39c9225b180b2b8448d4a7e2b2d`
- Owner-provided old running-product screenshots
- D057 in `docs/OWNER_DECISIONS.md`
- D058 Web review refinement in `docs/OWNER_DECISIONS.md`

Current review endpoints:
- Web: `https://inventory-beta.supra.cc.cd/`
- APK: `https://github.com/tamnv2/supra-inventory/releases/download/beta-vc43/supra-inventory-beta.apk`

Web presentation uses the D057 transplanted modules plus D058 Owner-reviewed desktop behavior: no role-test strip, no rejected implementation prose, pinned topbar + Admin/Root sidebar, central-workspace scrolling, full remaining workspace width and fixed bottom-right product credit.

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

Automated PASS is technical eligibility only. It is not Owner UI acceptance.

## Current work frontier

Owner is actively reviewing the deployed D058 Web UI. Android/APK review is pending separately.

For each Owner-rejected screen:
- compare current render to the pinned old source + current Owner feedback;
- fix presentation only;
- branch → PR → guards/build → merge → runtime/release;
- provide the next UI review candidate.

Do not resume business logic/scenario rebuild until explicit Owner UI acceptance.

## Next-chat resume command

`Tiếp tục review UI D058`

A screenshot or concise UI review note may be appended; no project-history restatement is required.
