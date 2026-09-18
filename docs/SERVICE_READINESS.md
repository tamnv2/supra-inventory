# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `F01_F14_F19_F20_F21_F22_F23_AUTOMATED_RUNTIME_RELEASE_PASS__PHYSICAL_OWNER_ACCEPTANCE_PENDING`
- SQLite schema: `5`
- Web: `DIRECT_LEGACY_PRESENTATION_TRANSPLANT_IN_PROGRESS__OWNER_UI_ACCEPTANCE_PENDING`
- Android: `DIRECT_LEGACY_NATIVE_XML_PRESENTATION_TRANSPLANT_IN_PROGRESS__OWNER_UI_ACCEPTANCE_PENDING`
- Latest signed Beta APK: `beta-vc42`
- Operational V2 runtime: `4/4`.

## Current UI source candidate

D057 direct presentation transplant is in progress on `ui/direct-legacy-presentation-transplant`.

Source work currently includes:
- old Web base/presentation styles copied under `web/src/legacy-transplant/`;
- Web shell restored to the prior `.app-shell` / full-width topbar / grouped left sidebar / workspace composition;
- dashboard and live processing surfaces use the prior `v5-*` and `fast-*` presentation systems;
- old Android native layouts for login/main/Picker/Invent/Admin/row/overlay transplanted;
- old Android drawables, color palette and widget presentation transplanted;
- current Android controllers are being bound to those transplanted XML IDs instead of reconstructing the accepted shell programmatically.

No automated build/deploy/release result for this candidate is claimed yet. Previous release evidence remains historical only.

## Next action

Run protected authority/state/UI guards plus Web production and Android build gates. Repair until technical PASS, then deploy/release strictly as a UI review candidate. Explicit Owner screen-by-screen UI/layout acceptance remains required before business-logic rebuild resumes.
