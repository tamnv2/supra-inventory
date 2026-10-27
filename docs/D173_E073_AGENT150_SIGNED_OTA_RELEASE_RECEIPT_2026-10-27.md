# D173-E073 — Agent150 GitHub release and OTA technical receipt (27/10/2026)

## Verified production distribution

- Owner explicitly approved Agent150-only implementation and deployment in D173-E069; D173-E070, E071 and E072 are repairs of that same release. D172 remains independent `PENDING/HOLD`; no inferred Owner FIELD PASS.
- Original Agent150 code and visual/history integration: [PR #759](https://github.com/tamnv2/supra-inventory/pull/759). Windows UTF-8 release guard recovery: [PR #760](https://github.com/tamnv2/supra-inventory/pull/760). Same-SHA legacy Gateway/Firestore dependency isolation: [PR #761](https://github.com/tamnv2/supra-inventory/pull/761).
- E072 exact tested source pin `926947875efb4976064ee32e81997f1b6a0375fb`: 40 checks = **29 SUCCESS, 11 SKIPPED, 0 FAILED**. Final PR761 head `b0b6d277a813bfda403a72c820cb762e34c03210`: 40 checks = **29 SUCCESS, 11 SKIPPED, 0 FAILED**. Windows source build/startup, E072 Gateway/Firestore isolation, VPS read-only, native Light/Dark usage view and D172 regression tested. Native 1376x900 offscreen test is not physical installed-window proof.
- Protected merge commit `3d4dccb6ba74849afd8dbaea229c81e92c37af78`, with Owner-approved `D173-E069_AGENT_ONLY_RELEASE:` release marker.
- Production distribution workflow [Verify Beta Relay Agent run #40463616125](https://github.com/tamnv2/supra-inventory/actions/runs/40463616125): **COMPLETED SUCCESS**, exact commit `3d4dccb6...`. Steps D167 Owner gate, D168 existing Worker health, D171 existing Gateway unchanged, D169 existing Firestore unchanged, Agent publish and WebView2 distribution all SUCCESS.
- [GitHub release relay-agent-v150](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v150) published at **2026-10-27 06:54:20 UTC / 13:54:20 GMT+7**. Git tag resolves to exact merged release commit `3d4dccb6ba74849afd8dbaea229c81e92c37af78`.
- The release EXE `Agent.Auto.Confirm.Pick.Pack.exe` and existing `inventory-channel` EXE report equal **8,723,968 bytes** and equal **SHA256 `57a5398935d84fec9d989a5212ffe6423ec1e4d6690f48ff2ffc73cfad5b5cca`** from GitHub release asset digests. Both SHA256 sidecar assets also have the same digest.
- Existing `inventory-channel` exposes `agent-latest.json` (size 628 bytes, asset digest `sha256:2c610fd8a5fa2c72fdbcd53c169d189831bf7ea889782808bdd8c5da02071e39`). Workflow logs confirm channel upload completed successfully. **Manifest content and actual client-side update uptake have not been independently field-read**, so do not present fleet installed state as confirmed.

## Explicit non-release scope / acceptance

- Agent-only binary/channel and unchanged existing WebView2 channel were used. Worker publish job **SKIPPED** (main run #40463616005). D173-E072 checks prove the existing Gateway and Firestore Rules source unchanged; no redeploy needed. A separate generic Firestore workflow failed its owner release guard before deploy, which is correct fail-closed behavior, not evidence of a new Rules deployment.
- No Web, Android, WMS, Worker business, Firebase Rule, D172 Sheet/app/backend, or historical Stable Worker mutation is approved by this Agent150 receipt. D172 lifecycle remains independent `PENDING/HOLD`; Stable remains `OWNER-GATED`.
- **CODE = PASS; SOURCE CI = PASS; AGENT150 RELEASE/OTA CHANNEL = PASS. FIELD = PENDING; OWNER PASS = PENDING.** Runtime checks still needed on an actually installed v150: correct VPS Usage provider-source values and N/A, Light/Dark and DPI, PickList History never blank, WMS/Office Confirm, PRIMARY/STANDBY/HA, online users, login and unchanged response times.
- Do not infer actual Cloudflare/Firebase cost savings from source-only CI. Cloudflare 50% allowance is project planning share of verified included account pools, not a billing invoice ceiling.
- Previously signed [Agent149 release](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v149) remains available as rollback evidence, not automatically rolled back.

## Evidence boundaries

GitHub tag, release asset digest, channel asset digest and successful workflow establish **technical publication and binary equality**. They do not establish installed fleet version, Authenticode identity, end-user acceptance or actual VPS field behavior.
