# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Web: `DIRECT_LEGACY_PRESENTATION_TRANSPLANT_IN_PROGRESS__OWNER_UI_ACCEPTANCE_PENDING`.
- Android: `DIRECT_LEGACY_NATIVE_XML_PRESENTATION_TRANSPLANT_IN_PROGRESS__OWNER_UI_ACCEPTANCE_PENDING`.
- Latest previously signed Beta APK: `beta-vc42`; it is not the accepted visual baseline.
- D057 is the active UI implementation method.

## D057 source-of-truth

- Prior running UI screenshots supplied by Owner.
- Read-only UI source: `tam95supra-source/bao-hang-1291`.
- Presentation structure/resources may be transplanted.
- Legacy backend/provider/auth/storage/database/credentials remain forbidden.

## Work in progress

- Web: old topbar/status/test-strip/sidebar/workspace presentation and old dashboard/queue CSS systems are being transplanted directly.
- Android/PDA: old native XML layouts, drawables, colors and widget styles are transplanted; MainActivity/Picker/Reporter bind to those resources.
- UI guard is being rewritten so technical build success cannot be mislabeled as Owner UI acceptance.

## Next

1. Complete source binding for Web/APK presentation.
2. Run authority/state/UI guards, Web production build and Android build.
3. Repair technical failures to terminal PASS.
4. Deploy/release only as a UI review candidate.
5. Obtain explicit Owner screen-by-screen acceptance.
6. Only after that gate, resume canonical business logic/scenario wiring.

## Continuity rule

A new session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
