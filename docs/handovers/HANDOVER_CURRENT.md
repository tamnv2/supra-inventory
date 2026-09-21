# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc58`
- Current released Agent: `relay-agent-v19`
- Beta: `D095_FIRESTORE_JOB_VISIBILITY_SOURCE_READY__CURRENT_RELEASE_V19_VC58_FIELD_FAIL__TARGET_V20_NEXT_SIGNED_BETA__OA016_AFTER_RELEASE__OA013_BLOCKED`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D095_PENDING_PRESERVATION_SOURCE_READY__CURRENT_RELEASE_BETA_VC58_FIELD_FAIL__NEXT_SIGNED_RELEASE_PENDING`
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

## D092 release-state refresh — 2026-09-21

- SQLite schema: `8`.
- Web status: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`.
- Android status: `D092_SIGNED_BETA_VC56_CONFIRMATION_RELEASED__D089_OWNER_ACCEPTED_UI_BASELINE`.
- Latest signed Beta APK: `beta-vc56`.
- Windows Agent: `relay-agent-v17`.
- D092 technical/runtime/release: PASS; OA013 Owner real Picklist confirmation: PENDING.
- Stable: OWNER-GATED / untouched.

## D093 current repair checkpoint — 2026-09-21

- D091 authenticated PDA → Firestore → Office Agent → Firestore → PDA field PASS remains the carrier-selection authority.
- D092 released `relay-agent-v17` / `beta-vc56` exposed a field regression: Firestore coordination/relay could fail after network transition while Agent online state could remain misleading.
- D093 preserves Firestore and repairs the regression: current Windows proxy per Firestore request, safe-read transient retry, truthful `Online 0 / FIRESTORE OFFLINE`, bounded 10-second leadership grace, and Android 30-second PENDING claim grace with 120-second total wait.
- PR #111 is merged and released as `relay-agent-v18` + `beta-vc57`; OA014 is READY_FOR_OWNER_FIELD_TEST. OA013 real Picklist confirmation remains blocked until OA014 PASS.
- Stable remains OWNER-GATED and untouched.

## D093 release-state refresh — 2026-09-21

- Main: `377159ed6722eede6b7716c9c83066b863a4e805`; PR #111 merged.
- Main Authority / State / Beta Worker / UI / Agent / Android workflows all PASS.
- Released Agent: `relay-agent-v18`, SHA-256 `96e2cde601f41908e1af10492a4bd8b9e8a47a905ce464d33d4917038838acb7`.
- Released signed APK: `beta-vc57`, SHA-256 `f655844b1222787938cacf169ca2f158630ab536b0a9c252f19f56d60cc3ce19`.
- Next action: OA014 physical Firestore PDA-Agent regression re-test. OA013 remains blocked until OA014 PASS.
- Stable remains OWNER-GATED and untouched.

## D094 current repair checkpoint — 2026-09-21

- Owner field log from released v18 confirms saved ADMIN DPAPI session/Firebase refresh and WMS restore work, while no PDA request reached Agent claim/ACK.
- Manual Firestore probe could return HTTP 200 while the D093 helper intermittently used DIRECT and failed DNS/connect; D094 restores the D091-proven default Windows proxy path first, with fresh-system proxy only as a bounded safe-read retry.
- Agent v19 source adds persistent-login UX completion: authenticated login controls dim/disable, explicit Logout clears the saved application session, next login replaces identity, and Overview shows Agent verification state.
- Confirmation receive uses a direct `PENDING + ANDROID_CONFIRM_V1` Firestore query with bounded newest-first fallback instead of an arbitrary first collection page.
- PDA source shows the short request ID after CREATE so Agent `pending-found → claim → ACK` can be correlated.
- Current released artifacts remain `relay-agent-v18` + `beta-vc57` until D094 merges/releases.
- Next field gate is OA015 after release. OA013 real WMS confirmation remains blocked. Stable remains OWNER-GATED.

## D095 current repair checkpoint — 2026-09-21

- Owner physical test of `relay-agent-v19` + `beta-vc58` failed for Xác nhận đơn even though PDA Firestore CREATE succeeded repeatedly.
- Root cause is confirmed: D094 parsed Firestore JSON arrays with `as ArrayList`; `JavaScriptSerializer` returns an enumerable/object array, so valid query/list results could be interpreted as zero documents. D091 field-PASS code used `IEnumerable`.
- A second field failure deleted a still-PENDING Android job at 30 seconds while Agent Firestore connectivity recovered later. D095 keeps PENDING alive through the 120-second bounded window; 30 seconds is notice-only.
- Agent v20 source refreshes the Windows default proxy on network-address change and gives safe Firestore reads three bounded default/fresh/default route attempts. Firestore never uses the WMS corporate fallback proxy.
- Product paths are explicitly separate: Báo hàng = PDA normal Internet → Worker/InventoryCore; Xác nhận đơn = PDA normal Internet → Firestore → ACTIVE Agent (normal Internet or Office) → Firestore ACK → PDA.
- Current released artifacts remain `relay-agent-v19` + `beta-vc58` and are **field FAIL for confirmation relay**. D095 targets `relay-agent-v20` + next signed Beta.
- OA015 is superseded by OA016. OA013 real WMS confirmation remains blocked until OA016 PASS.
- Stable remains OWNER-GATED and untouched.
