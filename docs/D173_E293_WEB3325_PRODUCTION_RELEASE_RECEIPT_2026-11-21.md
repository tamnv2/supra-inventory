# D173-E293 — Web 3.3.25 Production technical release receipt (21/11/2026)

## Owner authority and scope
Owner directed **actual implementation and Production release** of Inventory Web rebuilt using tested PickPack management UI source. Approved D173-only Web frontend presentation on the existing Cloudflare Worker `supra-inventory-beta` for official hostname `inventory.supra.cc.cd`. No replacement provider, Firebase/Auth/Worker business/data change, Agent/Android release, D172 resources or OWNER-GATED Stable change. Prior Web3.3.24 Owner FIELD FAIL is superseded as *deployed version*, not as evidence of Owner UI acceptance.

## Exact UI source, code and CI
- PickPack reference, read-only: `tamnv2/pickpack` [PR #2](https://github.com/tamnv2/pickpack/pull/2) head `c9a7730b4307aa085e48e0198e859a3419d1c33e`. Original tested `prototype/assets/styles.css` Git blob `f35a20e456355dbf6d7e065b856a6760cd355234` copied directly to Inventory `web/src/pickpack-office.css` (plus attribution comment), actual `sidebar/topbar/login` rebuilt and Inventory-specific presentation added. Mock PickPack business code, accounts, browser-local business state not imported.
- [Inventory PR #993](https://github.com/tamnv2/supra-inventory/pull/993) **MERGED** through protected two-parent commit `b566f53286692d6d8bf2d8a64823c03c319ff745`. Parents: `9125244e64458b10ccbffec1744418b63b3423bd` and `3f6566d38b67caafb90c74b00b96f5c5ea372168`. Exact authorized release marker: `D173-E291_WEB3325_PRODUCTION_RELEASE:`.
- Web3.3.25 source and CI pins `c4490a2d0fd467e91d173b34b6366b0d075536e1`. Four scoped CI workflows **SUCCESS**: E291 real Vite/Web browser build, 6/6 tests & independent D172 isolation/regressions [#44893357382](https://github.com/tamnv2/supra-inventory/actions/runs/44893357382); Repo Authority [#44893357601](https://github.com/tamnv2/supra-inventory/actions/runs/44893357601); Project State [#44893357551](https://github.com/tamnv2/supra-inventory/actions/runs/44893357551); D173/D172 Business Isolation [#44893357536](https://github.com/tamnv2/supra-inventory/actions/runs/44893357536). Historic global UI Design Guard expects removed legacy styles and still FAIL; **no global CI PASS claim**.
- Protected release authorization: `ops/d173-e291-web3325-release-authorization.json`, exact-source gate `tools/d173_e291_web3325_release_gate.py`. Scoped real-app Chromium CI used isolated API mocks and tested ROOT/REPORTER/PICKER, 390/1280/1366/1920px, light/dark, navigation across 9 page groups, opening/canceling actual resolve and skip modals; this does not prove authenticated field UI on Production.

## Live Production technical release evidence
- [Worker/Web release workflow #44893780330](https://github.com/tamnv2/supra-inventory/actions/runs/44893780330), attempt **1**, event `push` on protected `main` SHA `b566f53286692d6d8bf2d8a64823c03c319ff745`: **COMPLETED / SUCCESS**, job `136814981694` all steps successful.
- Owner release gate logged `D173_E291_WEB3325_RELEASE_AUTHORIZED:worker` and `:web`; strict shared-module guard logged `D173_E291_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY`.
- Same Cloudflare Worker/official host readback `D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS`; new Web assets uploaded as `/assets/index-CBZvNz-w.css` and `/assets/index-C30JYbsR.js`.
- **Live Worker health readback from GitHub Actions** `https://inventory.supra.cc.cd/health`: HTTP **200**, `status=ok`, `env=beta` (technical Worker identifier), `source=b566f53286692d6d8bf2d8a64823c03c319ff745` **matches expected**, persistent storage true, SQLite schema **17/17**, operational ready **7/7**, refresh and Root secret configured, Agent schema migration missing **0/0**.
- Post-release guarded smoke **PASS**: D166 read-only secret *name* and source/environment check, unauthenticated deny; Firebase Auth API route/Root bootstrap, business API capabilities and access guards, PDA registry, Web HTML shell, public OAuth disclosures and OAuth start, protected Agent Drive broker. No secret values were exposed.

## PASS boundaries and next field gate
- CODE: **PASS scoped** for source Web3.3.25.
- CI: **PASS scoped 4/4** with build + 6/6 browser/source tests + D172; other historical/global CI not globally PASS.
- RELEASE: **PASS TECHNICAL**, official Production Web3.3.25 on existing Worker, exact SHA/source health verified by release workflow.
- FIELD: **PENDING** Owner authenticated review of actual Production UI, roles, all pages, light/dark, mobile/HD, SKU actions, modal/scroll/realtime.
- OWNER PASS: **FALSE/PENDING**; D173 open. D172 separate **PENDING/HOLD**, Stable **OWNER-GATED**. No additional deploy authorized by this docs-only receipt.
