# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc55`
- Current released Agent: `relay-agent-v16`
- Beta: `D091_FIRESTORE_INFRA_RUNTIME_PASS__D089_OWNER_ACCEPTED_UI_BASELINE__SIGNED_BETA_VC55__AGENT_V16__PHYSICAL_OFFICE_E2E_PENDING`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D091_SIGNED_BETA_VC55_FIRESTORE_FIELD_CANDIDATE_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`
- D089: **OWNER ACCEPTED PASS**
- Stable: `OWNER_GATED`

## 2. Accepted D089 baseline

Owner confirmed on 2026-09-21 that the D089 result **đã đạt**. The following are accepted and must not be regressed unless a later explicit Owner requirement supersedes them:

1. Exact selected icon #4 is the shared Web / Android / Agent identity.
2. Web `Dịch vụ` and realtime `Đồng bộ` are independent statuses.
3. `HỆ THỐNG → Công cụ` is coherent in dark theme.
4. Agent Overlay supports master ON/OFF, granular Laptop/Agent metric selection, resize, colors, lock/click-through and local persistence.
5. Agent is single-instance per Windows user session; duplicate launch restores/activates the existing instance instead of creating another runtime.

`OA011` is closed PASS.

## 2A. D090 Office transport boundary

Owner confirmed on 2026-09-21 that Office should be treated as internal Supra plus selected Google services only. Sanitized field evidence: WMS UI/API read-only PASS, Firebase Auth PASS, RTDB corporate-proxy 403, and Google-hosted Firestore/Apps Script/Sheets/Drive endpoints reachable. Do not retest Cloudflare/Worker on Office. Firestore is the preferred next candidate from D078 but remains unselected until an authenticated Beta relay/HA/quota proof.

## 2B. D091 Firestore field candidate

D091 infrastructure is runtime PASS: Beta Firestore `(default)` exists in `asia-southeast1`, locked Security Rules are deployed through the Firebase Rules Management API, and the `cloud.firestore` release was read back successfully on main run `35548847740`. Field artifacts `relay-agent-v16` and signed `beta-vc55` are released. The remaining gate is one physical Office transport-only round trip with one Agent and `TRANSPORT_ONLY` ACK. It does not query/mutate WMS and does not yet implement final multi-Agent HA. Transport failure routes directly to Apps Script.

## 3. Released artifacts and evidence

D089 runtime:
- PR #99 merged at `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Release checkpoint PR #100 merged at `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`.
- Main Beta Worker/UI/Agent/Android/Authority/State gates all PASS.

Released artifacts:
- `relay-agent-v16`: canonical EXE `Agent.Auto.Confirm.Pick.Pack.exe`, SHA-256 `796ca102c4b240ae58094302ed690cc93d65f72f20e42cd526d734a8ca2f34b5`.
- `beta-vc55`: APK SHA-256 `e562f68c16fc2411ecd74d3a72e1650e01f5108a5fba65954d4532ae6bbd9818`.
- D091 Firestore infrastructure: main `cecf56079eba144188a0080bca8b1e78bcbfdd00`, run `35548847740` PASS with database readback plus Rules release readback.

## 4. Open boundaries

- D091 infrastructure and releases are PASS; one physical PDA → Firestore → Office Agent → Firestore → PDA field round trip remains. RTDB/Cloudflare Office retest stays closed.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.
- Do not alter Stable unless the Owner explicitly authorizes it.

## 5. Next action

D089 remains the accepted UI/runtime baseline. D091 Firestore infrastructure and field artifacts are ready; the next action is the Owner's one physical Office PDA ↔ Agent transport-only round trip using `relay-agent-v16` + `beta-vc55`.

On the next session:
1. read `ops/authority-manifest.json`;
2. read the complete declared `bootstrap_order`;
3. verify recent commits/CI and relevant live source;
4. execute the Owner's next explicit requirement from this D089 accepted baseline.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và xử lý yêu cầu mới.**

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.
