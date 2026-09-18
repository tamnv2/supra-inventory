# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`.

- Project: `supra-inventory`
- Web: `D057_DIRECT_LEGACY_PRESENTATION_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `VC43_D057_DIRECT_LEGACY_NATIVE_XML_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc43`
- Runtime source: `fa677463b898768a60013861220fce6e6192999e`

## D057 direct presentation transplant

PR #31 merged to main at `fa677463`.

Web presentation now uses:
- transplanted prior base/fast/dashboard/warehouse/ops presentation styles;
- full-width topbar and health chips;
- grouped left sidebar for management roles;
- old workspace density and master/detail processing composition;
- old dashboard/reporting presentation language.

Android/PDA presentation now uses:
- transplanted `activity_login.xml`, `activity_main.xml`, `view_picker.xml`, `view_invent.xml`, `view_admin.xml`, `row_issue.xml`, `overlay_alert.xml`;
- transplanted drawables, colors and widget styles;
- current controllers bound to those native resources.

No legacy backend/provider/auth/storage/database/credential code was imported.

## Automated evidence

- Repo Authority Guard: PASS.
- Project State Guard: PASS.
- UI Design Guard run `35309444877`: PASS.
- Deploy Beta run `35309444859`: PASS.
- Verify Beta Android run `35309444931`: PASS.
- Web production/runtime gate: PASS.
- Signed release: `beta-vc43`.
- APK SHA-256: `37dbc5e64cd144bbcb9dcb3787d7b65a3486907746822d95a8e902e52f9a27d8`.
- APK size: `9283170` bytes.

Automated PASS is technical eligibility only. Owner UI/layout acceptance remains pending.

## Next action

Review the deployed Web and signed `beta-vc43` screen-by-screen against the prior running product. Repair only remaining presentation mismatches. Resume business logic/scenario rebuild only after explicit Owner UI acceptance.
