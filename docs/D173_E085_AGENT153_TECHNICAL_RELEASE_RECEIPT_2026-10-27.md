# D173-E085 — Agent153 + VPS Usage Worker, technical release receipt (27/10/2026)

## Owner-authorized scope and pinned code
- Owner requested Agent153 build/deploy continuing D173-E084. Protected PR #772 merged into `main` as `2e8bcb47333fe48235551137d4808386c16330ec`, with exact Owner release commit marker `D173-E084_USAGE_AGENT153_RELEASE:`.
- Verified source SHA `9cb3c55d2daa17e128eef2ef2500696396adfc8c` had **32/32 SUCCESS, 0 FAILURE**, and final docs/authorization PR head `2cb36f1f4e97d16c4f11e0c64485cb21a67de2f8` had 32/32 SUCCESS, 0 FAILURE; after source pin only `ops/project-state.json`, `ops/change-continuity/D173.json`, and `ops/d173-e084-release-authorization.json` changed.
- Windows Agent native startup/theme/build, Worker TS typecheck, D172 business isolation and version/security guards PASS. This is SOURCE/CI PASS only and does not prove installed VPS FIELD.

## Worker Beta release and health proof
- GitHub Actions `Deploy Beta Worker` run https://github.com/tamnv2/supra-inventory/actions/runs/40547597405 **SUCCESS**.
- Exact registered Worker `supra-inventory-beta` deployed; Actions health readback HTTP 200, `environment=beta`, `status=ok`, `source_commit=2e8bcb47333fe48235551137d4808386c16330ec`, SQLite `schema=17/17`, Root secret present and configuration refresh enabled. Worker source changes exclusively in read-only VPS Usage collector; no Firestore/RTDB/DO SQL business schema mutation.
- The separate `Deploy Beta Firestore Relay` push job 40547597316 **FAILED at owner release gate** with `component outside the explicitly approved release scope`. It therefore did **not deploy Firestore Rules**. This expected fail-closed is NOT a passed CI run and is NOT evidence of a runtime defect or of modified Rules. Historical Stable remains gated.

## Signed Agent153 distribution proof
- GitHub Actions `Verify Beta Relay Agent` run https://github.com/tamnv2/supra-inventory/actions/runs/40547597397 **SUCCESS** on main. It verified same-SHA Worker live before publishing Agent.
- Immutable GitHub release `relay-agent-v153`: https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v153 ; tag ref resolves exact `2e8bcb47333fe48235551137d4808386c16330ec`.
- `Agent.Auto.Confirm.Pick.Pack.exe`: **8,751,104 bytes**, GitHub asset SHA256 **`636638b7e0d4993ad16875f6359ec1d3429ca5cf33b4904085cfe5a8a1fc3d0e`**.
- Existing `inventory-channel`: https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel updated `agent-latest.json` and EXE, EXE size/SHA256 **exactly matches tag**. Existing signed v152 remains as rollback.
- No automatic claim of Windows VPS fleet update, installed UX success, WMS/PRIMARY failover, network switching, physical DPI or owner operational acceptance.

## E084 functional scope
VPS Usage header per-metric Sync interval and isolate cache, grouped Cloudflare/Google Monitoring source with safe fallbacks, gauge correct and Workers subscription cycle; History Confirm header/columns restored; optional D128 floating PickList board removed without removing manual PL confirmation; left-bottom startup, saved Wi-Fi profile dialog, logs with explicit confirmation. No Android/Web changes in this release.

## Gates
- **CODE PASS / CI PASS / WORKER TECHNICAL RELEASE PASS / AGENT SIGNED OTA TECHNICAL RELEASE PASS**.
- **FIELD PENDING / OWNER PASS PENDING**: only Owner can confirm installed VPS, WMS real confirm, Office/network, PRIMARY/Standby, 100/125/150% DPI, Theme and actual usage/billing.
- **D172 PENDING/HOLD independent**, no closure or combined version; **Stable OWNER-GATED**.
