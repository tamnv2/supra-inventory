# D173-E241 — Web 3.3.15 Production technical release receipt (12/11/2026)

## Authorization and source
Owner expressly authorizes Web3.3.15 D173-E237 production release under D173-E239, for compact consistent UI, removal of duplicate headings, and sticky tab bars. No authorization for D172, Stable, Agent, Android, Worker business, Firebase or provider resources.

- [PR #961](https://github.com/tamnv2/supra-inventory/pull/961) MERGED protected with marker D173-E237_WEB3315_PRODUCTION_RELEASE:.
- Main release commit: 8cfd4b2427a02ba59cca68e0e0dc277b8a58d62f, parents 7d5b1856857483c7696b53a0eda1db4fbc9fad14 and a42890e7562d0588437015e8bc91277ef43586c6.
- Web code pin c3573285809281a2a77dc5acbc72e71ce43e5ee4. CI pin fded9f288911f83de03e64b32b4ea50e87dd2f00, no runtime/tests/workflow/guard drift after it.
- Source scoped CI [43258444616](https://github.com/tamnv2/supra-inventory/actions/runs/43258444616) SUCCESS (E237/E233/E230/E227 Web tests, TypeScript/Vite, D172 isolation, release preflight); authority [43258444669](https://github.com/tamnv2/supra-inventory/actions/runs/43258444669) SUCCESS; state [43258444850](https://github.com/tamnv2/supra-inventory/actions/runs/43258444850) SUCCESS.
- Final PR head scoped CI [43259474592](https://github.com/tamnv2/supra-inventory/actions/runs/43259474592), authority [43259474649](https://github.com/tamnv2/supra-inventory/actions/runs/43259474649) and state [43259474811](https://github.com/tamnv2/supra-inventory/actions/runs/43259474811) all SUCCESS. UI Design Guard [43259474233](https://github.com/tamnv2/supra-inventory/actions/runs/43259474233) FAILURE on three legacy Agent D137/D130 and Web D063 tests; no blanket full-suite PASS.

## Actual Production receipt
- [Deploy Beta Worker / official Production Web run 43259764849](https://github.com/tamnv2/supra-inventory/actions/runs/43259764849): completed SUCCESS, attempt 1, source SHA exactly 8cfd4b2427a02ba59cca68e0e0dc277b8a58d62f.
- Existing Worker supra-inventory-beta on https://inventory.supra.cc.cd. Version ID ef27d5d0-4902-4ee9-a710-06cd12c686a8. Wrangler uploaded 3 Web assets and reused 4; Web shell validation PASS.
- Official hostname /health HTTP 200 status=ok; source_commit matches the merge SHA; 0 missing bindings, storage OK, SQLite schema 17/17, operational schema 7/7, Agent migration failed/remaining 0/0.
- GitHub workflow steps for Worker deployment, existing Gateway reuse, D166 post-secret health, authorized Root/auth, business API/permissions, OAuth entry and Web shell all SUCCESS.
- D172 dedicated code/data unmodified, D172 independent isolation run PASS; no service business code, Agent, Android, Firebase, WMS, SQLite schema or Stable change. No new provider resources or SKU network requests.

## Acceptance boundary
CODE = PASS scoped; CI = PASS required Web/authority/state/D172 (legacy UI guard remains historical FAIL); Production RELEASE = PASS technical. FIELD physical authenticated browser UI/HD/HD+/light/dark/zoom = NOT VERIFIED; D173 overall OWNER PASS = PENDING. Do not infer FIELD/Owner acceptance from GitHub release or Web shell smoke alone.

Documentation-only receipt: separate PR must not redeploy runtime or overwrite exact release SHA.
