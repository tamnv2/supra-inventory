# D173-E229 — Web 3.3.12 Production TECHNICAL PASS receipt — 12/11/2026

## Owner scope và source
- Owner approved all eight Web-only layout fixes: tab parity, sidebar active in 5 subtabs, SKU search 206px, trim Picker withdrawal columns, auto/human Skip colors, title 20px, remove hamburger, sticky five tabs/date/SKU filter.
- PR [#955](https://github.com/tamnv2/supra-inventory/pull/955) protected 2-parent MERGED as main `8dc91e50a31c3f547b4e1b16819f492c5da1fa65`, message starts `D173-E227_WEB3312_PRODUCTION_RELEASE:`.
- Source runtime pin `d1e9fe91a025d01d02cfc90df676ee6241b4a52e`; final PR head `7687dcb269474dd75b31a605fc4322e2d2ac6e95`.
- Final PR head scoped CI **SUCCESS**: UI test/Web build + D172 regression + E227 preflight [43220496571](https://github.com/tamnv2/supra-inventory/actions/runs/43220496571), [Authority 43220496558](https://github.com/tamnv2/supra-inventory/actions/runs/43220496558), [State 43220496349](https://github.com/tamnv2/supra-inventory/actions/runs/43220496349), [D172 isolation 43220496452](https://github.com/tamnv2/supra-inventory/actions/runs/43220496452).
- Business API, Worker DO/SQL, D172, APK, Agent, Firebase, Gateway and Stable source unchanged.

## Production execution
- Official existing Worker `supra-inventory-beta` routes `inventory.supra.cc.cd`.
- [Deploy Beta Worker run #43220864308](https://github.com/tamnv2/supra-inventory/actions/runs/43220864308) `completed/success` for exact main SHA `8dc91e50a31c3f547b4e1b16819f492c5da1fa65`; gate `D173_E227_WEB3312_WORKER/WEB_PINNED_RELEASE_ALLOWED` and D172 business/Gateway unchanged PASS.
- Wrangler uploaded 3 new Web asset files and reused 4 files; reported deployed Worker version ID `d42062b6-2f9a-4203-b5ec-eec52339e79d` at deploy. D166 secret put later in workflow may create another Worker version, but exact source SHA verified again.
- Production `https://inventory.supra.cc.cd/health`: STATUS OK, exact main source commit, SQLite schema, Root secret/bindings PASS. After secret put Worker source/env PASS. Web shell, auth API, business capabilities, PDA registry, Google OAuth, private broker protection PASS.
- **CODE PASS; CI scoped PASS; RELEASE TECHNICAL PASS.** UI has not been manually inspected in a signed-in browser under actual HD/HD+/mobile/scrolling, so **FIELD PASS=false, OWNER PASS=false**.
- D172 **INDEPENDENT PENDING/HOLD**; Stable **OWNER-GATED**. This E229 document and state update is docs-only, never a second Worker release.
