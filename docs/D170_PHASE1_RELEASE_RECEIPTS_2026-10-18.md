# D170 E006 — Phase 1 official branding release receipts (2026-10-18)

Status: **SOURCE, WORKER and SIGNED ANDROID RELEASE PASS**. Not an Owner field PASS. Not the official-hostname cutover.

- Recovery PR #627 merged to main commit `cf6d52364175b30046559e8b9e09f18a64442098` after protected source 16/16 CI PASS; PR #626 originally 21/21 code CI PASS but partial runtime release was blocked by an obsolete Beta legal-page guard and D169-only APK baseline gate, fixed by #627.
- Main-push Actions Worker run **39142688905** and Android run **39142688909** completed SUCCESS; Agent and Firestore main-push runs **39142688925** and **39142688914** were SKIPPED on the deliberately limited component scope. Other main-push checks successful.
- GitHub Release tag `beta-vc113` (historical updater-compatible technical tag) published for exact main source SHA with public release title **1291 Báo hàng vc113**. Existing GitHub `inventory-channel` assets `pda-latest.json`, signed `supra-inventory-beta.apk`, and checksum were updated, as confirmed by API; filename/tag remain technical because signed vc112 verifies them.
- Worker remains `supra-inventory-beta` (same `InventoryCore` Durable Object and Firebase identities) and its existing `inventory-beta.supra.cc.cd` route remains alive. No database copy or old Stable deployment was performed.
- Cloudflare read-only custom-domain preflight run 39139673256 previously confirmed the target `inventory.supra.cc.cd` is still attached to the OLD `supra-inventory-stable` service; phase 2 must transfer the Custom Domain only to the **existing** data-bearing Worker.
- Client installation / fleet real-device acceptance and Agent/WMS/Office HA validation remain unverified. No false FIELD PASS.

See `ops/change-continuity/D170.json` and `docs/D170_SINGLE_PRODUCTION_CUTOVER_PLAN.md`.
