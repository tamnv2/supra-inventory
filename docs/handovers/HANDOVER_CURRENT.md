# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json`, not from this file alone.

## Current UI-first status

- D057 direct legacy presentation transplant is active.
- Web: `D057_DIRECT_LEGACY_PRESENTATION_BETA_RUNTIME_PASS__OWNER_UI_ACCEPTANCE_PENDING`.
- Android: `VC43_D057_DIRECT_LEGACY_NATIVE_XML_SIGNED_RUNTIME_GATE_PASS__OWNER_UI_ACCEPTANCE_PENDING`.
- Latest signed review APK: `beta-vc43`.
- Runtime source: `fa677463b898768a60013861220fce6e6192999e`.

## What changed

The prior product is no longer merely a design reference. Its presentation layer is the visual/layout source-of-truth.

Web now directly uses the prior presentation styles and shell structure: full-width topbar, status chips, grouped left sidebar, workspace density, dashboard and master/detail operational composition.

Android/PDA now inflates transplanted native XML/resource layouts instead of approximating the old UI with programmatic layout geometry.

Legacy backend/provider/auth/storage/database/credentials remain excluded.

## Evidence

- PR #31 merged at `fa677463`.
- UI Design Guard `35309444877`: PASS.
- Deploy Beta `35309444859`: PASS.
- Verify Beta Android `35309444931`: PASS.
- Signed release: `beta-vc43`.
- APK SHA-256: `37dbc5e64cd144bbcb9dcb3787d7b65a3486907746822d95a8e902e52f9a27d8`.

## Next

1. Owner reviews Web and APK screen-by-screen.
2. Fix only presentation mismatches.
3. Do not resume business-rule/scenario rebuild until explicit Owner UI acceptance.

## Continuity rule

No manual end-of-session handover is required. A new session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
