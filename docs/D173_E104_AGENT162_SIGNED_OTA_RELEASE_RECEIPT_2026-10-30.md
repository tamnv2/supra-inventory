# D173-E104 — Agent162 signed OTA technical release receipt (30/10/2026)

## Verified release evidence
- Owner-approved same D173-E103 repair from installed Agent161 FIELD FAIL; do not create a new independent change. Scope: native Agent RAM-only activity for Picker PickList and local Agent actions, no new provider operation.
- Source PR [#801](https://github.com/tamnv2/supra-inventory/pull/801) merged with protected release marker `D173-E104_AGENT162_ONLY_RELEASE:` into main commit `d7dab62bf482b8a080eb75c8e18ba328e287a7fe`.
- Exact reviewed executable source `1fb5b27e99601791afdbf94bfdfa810331aa1a80`: 36 GitHub check runs SUCCESS, 0 FAILED, 11 conditionally SKIPPED. Post-authorization PR commit `1bcb3033e3816c5bbd784bb20897debe1b67df1e`: 36 SUCCESS, 0 FAILED, 11 SKIPPED, with no protected executable source drift.
- Main native Windows `Verify Beta Relay Agent` [run 41026054477](https://github.com/tamnv2/supra-inventory/actions/runs/41026054477) SUCCESS. D173-E104 signed scope/source/Owner gates, official Worker health/SQLite, unchanged Gateway/Firestore rules and native Windows build/startup regressions passed.
- `Deploy Beta Worker` run 41026054395 and `Deploy Beta Firestore Relay` run 41026054305 both SKIPPED: **no Worker, Firestore, service, Web, Android, D172, Gateway or Stable runtime deployment**.
- GitHub prerelease [relay-agent-v162](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v162) published 2026-10-30 08:25:09 UTC; tag points to exact main `d7dab62bf482b8a080eb75c8e18ba328e287a7fe`.
- Canonical Agent EXE `Agent.Auto.Confirm.Pick.Pack.exe`: 8,801,792 bytes, GitHub asset SHA-256 `846ccd8f89c04424850c3608ff8fe729973be075103017190dddd1d5badfda14`.
- `inventory-channel` canonical Agent EXE updated 2026-10-30 08:25:12 UTC with the **same size and SHA-256** as tag release. The `.sha256` assets likewise match their tag/channel GitHub metadata digest `67d39c70ddd5771eb430a4e6e0ceb6488d2387fb8e8f055b49d65422135eeb26`. `agent-latest.json` was updated 2026-10-30 08:25:11 UTC. GitHub metadata and run prove channel publication; installed-device update is not asserted.

## Lifecycle
- **CODE PASS / CI PASS / RELEASE PASS** (signed tag, artifact/channel digest, production health at release).
- **FIELD PENDING**: no proof yet that a real Windows Agent upgraded and that Office/WMS/PickList/HA activity behavior passed field retest.
- **OWNER PASS PENDING**: never infer from this receipt.
- D172 OBPP1291 remains independent `PENDING/HOLD`. Historical Stable is `OWNER-GATED`. E097 SQLite NOMEM root cause is **not** declared solved by a healthy Agent-only release probe.
- If FIELD FAIL, repair in the same D173-E103/E104 scope with source/CI/pinned release guard; do not silently move to another change ID.

Evidence: PR #801; main commit d7dab62; GitHub Actions runs 41026054477, 41026054395, 41026054305; GitHub releases `relay-agent-v162` and `inventory-channel`.
