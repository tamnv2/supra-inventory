# D173-E281 — Agent194 signed OTA Production technical release receipt

## Verified outcome — 2026-11-16

- D173-E278 Owner-authorized Agent194 bounded Web Confirm recovery/HA and existing Worker single incident alert. No business source changes to D172, Web UI, Android, WMS or Stable; Browser Host14 unchanged.
- Source code signed Worker/Agent release merged on protected main `9ff6560959a14b24a9128b7fdd2e57a5009f1017` (source PR #984, OTA workflow recovery PR #985, same-SHA Worker trigger recovery PR #986).
- Scoped source/native WinForms + Host14 Windows CI PASS on PR986: run `43873176691` at reviewed head `98e341b4567c56bc6faad89ba16d59deb9e4e02c`; exact code source pin `bb360d8671f3e549c0a6352aee82be99efc7687c`. Authority/continuity and D172 isolation PASS.
- Existing Worker Production run `43873539040` SUCCESS on main exact `9ff6560959a14b24a9128b7fdd2e57a5009f1017`.
- Protected Agent194 release run `43873539169` SUCCESS on the identical main SHA; source gate and same-SHA Worker gate PASS, native build and smoke PASS.
- GitHub release `relay-agent-v194` published `2026-11-16T13:14:00Z` targeting exact main `9ff6560959a14b24a9128b7fdd2e57a5009f1017`; EXE asset and SHA-256 companion present.
- Signed EXE SHA-256 from OTA job readback: `4b7ad70a096d08fa7bebfefa009a4eacd7d1be3f04ca1e9b4acbea4b5ad2beed`.
- Existing `inventory-channel` asset list shows new `agent-latest.json`, `Agent.Auto.Confirm.Pick.Pack.exe` and checksum all updated on 2026-11-16T13:14Z; the job downloaded each again, checked EXE checksum, checksum companion, manifest tag `relay-agent-v194`, manifest SHA and emitted `D173_E278_AGENT194_OTA_TECH_PASS`.
- Existing `agent-browser-latest.json` and Host14 assets remain at 2026-11-11 timestamps, Android APK remains at 2026-11-10 timestamps. No separate D172 release.

## Scope boundaries / acceptance
- **CODE PASS / scoped CI PASS / Worker Production technical PASS / Agent194 signed OTA technical PASS.**
- **FIELD PASS PENDING**: real VPS multi-Agent failover, bounded Web Confirm recovery, actual Owner incident mail receipt, and on-device startup/OTA still require live observation.
- **OWNER PASS PENDING**: Owner has authorized code/Production release but has not accepted field operation.
- **D172 PENDING/HOLD** independent; Stable OWNER-GATED.
- Initial Agent194 OTA attempt `43868015344` failed due PowerShell reserved `$Host` assignment and was repaired by PR #985. The second attempt from PR #985 `43871239718` lacked a same-SHA Worker push run because the workflow path was absent from `deploy-beta.yml` push filters; PR #986 corrected this and a reproducing source test. Neither failed attempt is treated as release PASS.

## GitHub evidence
- https://github.com/tamnv2/supra-inventory/pull/984
- https://github.com/tamnv2/supra-inventory/pull/985
- https://github.com/tamnv2/supra-inventory/pull/986
- https://github.com/tamnv2/supra-inventory/actions/runs/43873539040
- https://github.com/tamnv2/supra-inventory/actions/runs/43873539169
- https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v194

This receipt updates docs, current-state/registry metadata and a read-only authority proof for Agent194. It does not change Worker/Agent runtime code or request another Production deploy; FIELD/OWNER PASS is not claimed.
