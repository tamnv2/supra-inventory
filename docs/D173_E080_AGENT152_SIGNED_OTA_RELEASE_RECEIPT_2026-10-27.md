# D173-E080 — Agent152 signed OTA technical release receipt (27/10/2026)

## Verified source and protected release

- Owner D173-E079 approved Agent-only native Cloudflare/Firebase/Google Usage dashboard, sidebar/service icons, per-metric percentage display, full-height scrollable detail table, Vietnam AUTO light 06:00–17:59 / dark 18:00–05:59 and read-only proof of a previously confirmed exact WMS PickList. No new WMS click or Android business/schema mutation.
- PR [#767](https://github.com/tamnv2/supra-inventory/pull/767) pinned exact native Agent152 source SHA `36b2dd2efcd71459cbc466b195c2d8d959680f3d` with **31/31 PR CI success**, zero failed, including Windows net48 build/startup, native light/dark smoke, source checks, isolated D172 regression. Subsequent docs/authority pin commits did not alter protected source bytes.
- Protected PR #767 was merged into `main` SHA `993b0c0a39e8ec7a9add8ae3b0eb92fecab2b020` using `D173-E079_AGENT_ONLY_RELEASE:` marker.
- [Verify Beta Relay Agent run #40509999568](https://github.com/tamnv2/supra-inventory/actions/runs/40509999568) completed **SUCCESS** on the same main commit, including separate Owner E079 source pin checks, existing Worker/Gateway/Rules unchanged gates and packaged Windows binary.
- [Dedicated signed Agent v152 release](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v152) published 2026-10-27 13:14:42 UTC. Immutable Git ref `refs/tags/relay-agent-v152` resolves to exact protected main merge commit `993b0c0a39e8ec7a9add8ae3b0eb92fecab2b020`.
- GitHub release EXE `Agent.Auto.Confirm.Pick.Pack.exe`: **8,745,984 bytes** and SHA256 `eee0418df46dbedae1d928754f4ed2c8c5ab442d1498d7f1291a3f77130ed321`.
- Existing `inventory-channel` OTA EXE: **8,745,984 bytes** and exact matching SHA256 `eee0418df46dbedae1d928754f4ed2c8c5ab442d1498d7f1291a3f77130ed321`; `agent-latest.json` asset was updated. Successful physical auto-update on installed VPS is not verified.
- Main Worker deployment workflow run #40509999391 was **SKIPPED as designed**. Separate Firestore Relay workflow run #40509999703 failed its **D167 Owner release authorization** step; this is a release gate stop, **not** a permitted Firebase Rules rollout or evidence that all main CI jobs are green. Neither is an Agent152 technical release failure.

## Gate distinctions

| Gate | Verified result |
| --- | --- |
| Agent152 source CODE | PASS |
| Exact source/CI (31 workflows), native WinForms no-login Light/Dark tests, D172 isolation | PASS |
| Protected PR/merge on main | PASS |
| Signed Agent v152 Git tag, EXE and OTA exact SHA256 | RELEASE PASS |
| Worker/Web/Android/Firebase/Gateway/provider deploy | NOT RELEASED / SKIPPED / GATED |
| Real WMS same-row confirmation correctness & Android ACK UI at site | FIELD PENDING |
| VPS actual installed version, Usage UI and mouse-wheel at DPI 100/125/150%, theme AUTO timing | FIELD PENDING |
| WMS session, Office network, HA primary/standby no regression | FIELD PENDING |
| Cloudflare provider-verified billing-cycle start/end, shared-account actual usage, invoice | SOURCE/FIELD PENDING, keep N/A |
| Owner acceptance | OWNER PASS PENDING |
| D172 OBPP | PENDING/HOLD independent; no closure authorized |
| Historical Stable | OWNER-GATED |

## Invariants and next field checks

- Existing Android PickerController already maps `ALREADY_CONFIRMED` to success with guidance returning to SFT / SFT 3. Confirming the unique same-row WMS marker in a real session still requires field evidence; never infer it from unit/source/native smoke.
- Billing usage metric proportions are compared with internal **50% of each verified included Cloudflare quota**, not a $2.50 cap. The shared fixed $5/month Cloudflare plan is not attributable solely to Inventory; unknown billing period, source coverage, limits and variable charges remain N/A.
- No extra Firestore/provider polling or WMS mutation was added, and D172 physical shared-resource safety passed CI but remains independent HOLD.
- Owner tests v152 actually installed through signed OTA, VPS tab layout/scroll/theme, confirm previously-confirmed PickList on WMS, Android UI, plus unaffected Office/HA operations. Only after explicit field verification may FIELD/OWNER statuses be changed.
