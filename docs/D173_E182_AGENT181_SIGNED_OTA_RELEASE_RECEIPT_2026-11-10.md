# D173-E182 — Agent181 signed OTA technical release receipt — 10/11/2026

## Owner directive
Owner explicitly requested complete Agent181 production deployment after repeated Agent180 FIELD failures. This receipt is **technical RELEASE evidence**, not FIELD/OWNER acceptance.

## Verified exact source and release
- Approved repair: measured responsive 40/60 Agent WinForms overview; session roster columns auto-sized to actual text; action widths compact; preserve all confirm/HA/RBAC/network behaviors and no provider requests.
- PR #904 **merged** as protected 2-parent merge SHA `86866cd53dc8bab730682f9ba708983c35f61432`, commit subject `D173-E182_AGENT181_ONLY_RELEASE: signed Agent181 measured layout and session columns`.
- Source CI `5e2bd9a70838312925b736064422c72cece6ede4`: **37 SUCCESS, 1 SKIPPED, 0 FAILED**; native net48/x64 Agent, UI regression, D172 business isolation, quota and authority checks PASS. Pinned in `ops/d173-e182-agent181-release-authorization.json`.
- Signed/release GitHub Actions run [42839603327](https://github.com/tamnv2/supra-inventory/actions/runs/42839603327): **COMPLETED / SUCCESS**; release job `relay-agent` PASS.
- GitHub release [relay-agent-v181](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v181): tag resolves to exact protected merge SHA `86866cd53dc8bab730682f9ba708983c35f61432`. No overwrite of Agent180.
- Signed EXE asset `Agent.Auto.Confirm.Pick.Pack.exe`, size **8,895,488 bytes**, GitHub SHA256 `dfc0a30f01eb7a4d831c6cee7bb9dcde774b8dff1eb7226760a6d9a82a195828`.
- Existing `inventory-channel` OTA alias EXE updated **2026-11-10 15:01:40 UTC**, exact **same SHA256 and size** as v181 release. `agent-latest.json` updated **2026-11-10 15:01:39 UTC**. Signed job log: `Updated stable Agent runtime channel inventory-channel -> relay-agent-v181`.
- Host13 shared fixed WebView2 bundle retained unmodified. Worker, Web, Android APK, Firebase/Firestore Rules, Cloudflare and D172 business not deployed. D172 independent **PENDING/HOLD**; Stable **OWNER-GATED**.

## Main push ancillary workflows
For the Agent181 merge, several unrelated legacy workflows launched because their `paths:` filters included shared workflow files. Worker and Firestore deployment jobs failed **at their Owner release gates**; D172 APK release was similarly denied before any APK signing/upload. Their failures do not count as a successful provider deploy. This receipt asserts *no completed unrelated deployment*, not that every global workflow succeeded. A malformed no-provider skip expression in `.github/workflows/deploy-beta.yml` and `deploy-beta-firestore.yml` was identified; separate guarded CI-only remediation is needed without modifying protected D172 behavior. Do not silently classify these jobs as PASS.

## Acceptance/status
| Gate | Status |
|---|---|
| CODE | PASS |
| SOURCE CI | PASS, 37/38 successful with 1 conditional skipped |
| PROTECTED MERGE | PASS, PR #904 |
| SIGNED RELEASE TAG | PASS, v181 |
| OTA channel EXE + checksum | PASS, v181 |
| Worker/Web/Android/D172 mutation | NONE; unrelated gates DENIED |
| FIELD visual validation on actual WinForms workstation | PENDING |
| OWNER PASS | PENDING — Owner has not reviewed Agent181 UI |

Field acceptance must inspect correct spacing, adaptive positioning, session column widths and scroll behavior on the real operating Windows machine. Do not confuse official release with confirmed FIELD visual quality.
