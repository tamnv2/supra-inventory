# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Web: `D057_DIRECT_LEGACY_PRESENTATION_SOURCE_BUILD_PASS__DEPLOY_OWNER_UI_REVIEW_PENDING`.
- Android: `D057_DIRECT_LEGACY_NATIVE_XML_SOURCE_BUILD_PASS__SIGNED_RELEASE_OWNER_UI_REVIEW_PENDING`.
- Latest previously signed Beta APK: `beta-vc42`; it is not the accepted visual baseline.
- D057 direct legacy presentation transplant is the active UI implementation method.

## D057 source-of-truth

- Prior running UI screenshots supplied by Owner.
- Read-only UI source: `tam95supra-source/bao-hang-1291`.
- Presentation structure/resources may be transplanted.
- Legacy backend/provider/auth/storage/database/credentials remain forbidden.

## Current source/build evidence

PR #31 source head `7e9c9f5b999cea37a12844deaf4ea861b29bec33`:
- Authority and Project State guards: PASS.
- UI Design Guard run `35308615737`: PASS.
- Web production build: PASS.
- Android debug build: PASS.
- Existing operational/realtime/support regressions: PASS.

The candidate now uses the prior Web shell/sidebar/dashboard/operations presentation and prior Android native login/main/Picker/Invent/Admin/row/overlay resources. Reporter rows use the transplanted row layout and Picker critical results use the transplanted full-screen result overlay.

## Next

1. Merge PR #31 after the final continuity check set passes.
2. Deploy Web and publish signed Android candidate through matching runtime/release gates.
3. Record exact release/runtime evidence.
4. Review Web and APK screen-by-screen.
5. Fix only remaining presentation mismatches until explicit Owner UI acceptance.
6. Only after the UI gate passes, resume canonical business logic/scenario wiring.

## Continuity rule

No manual end-of-session handover is required. A new session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
