# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Bootstrap from `ops/authority-manifest.json` and read its complete `bootstrap_order` before any analysis or mutation.

## 1. Current canonical markers

- Project: `supra-inventory`
- SQLite schema: `8`
- Latest signed Beta APK: `beta-vc54`
- Current released Agent: `relay-agent-v15`
- Beta: `D089_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC54__AGENT_V15__READY_FOR_NEW_REQUIREMENTS`
- Web: `D089_OWNER_ACCEPTED_PASS__SERVICE_REALTIME_SEPARATED__TOOLS_DARK_APPROVED_ICON`
- Android: `D089_OWNER_ACCEPTED_PASS__SIGNED_BETA_VC54__APPROVED_ICON__TRANSPORT_SELECTION_PENDING`
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

## 3. Released artifacts and evidence

D089 runtime:
- PR #99 merged at `c1f368b29c2e0874ec6f5dfc0ac693d0291c7cee`.
- Release checkpoint PR #100 merged at `a01ae7abcd52090b421f3016f1e4a80fcd58dad6`.
- Main Beta Worker/UI/Agent/Android/Authority/State gates all PASS.

Released artifacts:
- `relay-agent-v15`: canonical EXE `Agent.Auto.Confirm.Pick.Pack.exe`, SHA-256 `94f82fc377057c5bbb1d80bbf0830f523bdf16108b40898ce63bb041624b9e9a`.
- `beta-vc54`: APK SHA-256 `eeb95c489bf7dbfa455b323633bfe28685674f57f6ba76facd4c04e3b0958c2c`.

## 4. Open boundaries

- D090 Office evidence is complete: do not test Cloudflare/Worker further on Office; RTDB is proxy-blocked; replacement research is Google-hosted only, with Firestore preferred but not yet selected. Current RTDB is temporary outside Office.
- WMS remains signed GET-only; confirmation/mutation is not authorized.
- Stable remains OWNER-GATED.
- Do not alter Stable unless the Owner explicitly authorizes it.

## 5. Next action

There is no remaining D089 implementation or field-retest task. D090 also closes the old Office probe checkpoint; no repeat Cloudflare Office test is required.

On the next session:
1. read `ops/authority-manifest.json`;
2. read the complete declared `bootstrap_order`;
3. verify recent commits/CI and relevant live source;
4. execute the Owner's next explicit requirement from this D089 accepted baseline.

## 6. Resume command

> **Tiếp tục supra-inventory. Đọc canonical state trên GitHub và xử lý yêu cầu mới.**

No manual end-of-session handover is required. GitHub canonical state remains the continuity authority.
