# D171-E068 — Safe rerun of signed vc115 release after source-change gate

## Verified history

- Owner-approved D170+D171 unified release E062/E064, retaining original Wi-Fi priority and single InventoryCore SQLite. Source PR656 initially merged as main `1fab2e2a...`; production Gateway, Worker/Web, Firebase Rules and Agent v140 runs succeeded, but old signed PDA vc114 remained.
- PR660 corrected stale D169-E061 Android-only check, pinned Rules v140 parity and Gateway/Rules same-sha workflow triggers. Exact-head `349ac6ac756af207b02f641538be595bdb0cde08` had 16/16 workflow PASS, Authority+Continuity PASS and signed APK candidate verification. Protected non-squash merge main `e4c7dbba08d59fdc6f315ffe0f7992c606e5a817`.
- Main E067 release attempts were safely rejected by `tools/d167_release_gate.py`, not by build, because the D171 release authorization remained pinned to original `b38750de...` and executable workflow contents now differ. Runs: Gateway `39669352409`, Worker `39669352479`, Firestore `39669353015`, Android `39669352333`. No vc115 channel publication or new Service/Firebase deployment resulted from these denied runs.

## Repair design

- Preserve the existing real `tools/d167_release_gate.py` `git diff --name-only <approved_source_sha> HEAD -- PROTECTED` gate unchanged: it must reject *any* protected change after the approved source snapshot.
- Add `ops/d171-release-authorization.json` to **push** triggers of the five existing in-scope workflows only: registered Gateway, Worker/Web, Firestore identical Rules, Agent v140, signed Android vc115. An approved receipt-only main merge then schedules all scopes with one commit SHA. Each workflow still independently validates exact Owner authorization and provider/live contract.
- Freeze the exact protected code snapshot SHA **after** the workflow trigger edits; run code tests, Authority/Continuity and full PR CI; set `approved_source_sha` to that verified ancestor only, without modifying protected files afterwards. Re-run CI on the final receipt commit, merge through protected PR non-squash and keep the source commit in history.
- Stage boundaries remain Gateway live readback → Worker/Web/InventoryCore same SHA → identical Firebase Rules readback → Agent v140 existing binaries/source parity → signed Android vc115 new and legacy channel assets. No Agent/WMS mutation, service migration, Stable deployment, secret exposure or Beta-to-Stable data copy.
- Accept **technical release PASS** only from actual GitHub release assets, SHA and service health. Real Office/WMS/PDA overlay/ACK, Drive/Gmail and provider billing tests remain FIELD pending until independently proven.

## Acceptance checks

PR-only: exact-head Actions, authority, continuity, signed Android candidate, integrated test `tests/d170-d171-release-parity.test.mjs`. Runtime: same SHA stages must succeed; `beta-vc115` prerelease + `inventory-channel` manifest and signed APK+sha256 published, public `1291-Bao-Hang.apk` equals old technical asset, two host /health bind same Worker/SQLite. If a provider or release stage fails, no fabricated full PASS; diagnose and repair under D171.
