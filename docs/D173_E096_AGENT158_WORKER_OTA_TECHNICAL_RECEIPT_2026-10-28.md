# D173-E096 — Agent158 + Worker Usage Technical Release Receipt (28/10/2026)

## Source and Owner
Owner expressly approved the full Agent158 signed OTA and existing Worker read-only Usage RBAC for exact named vps/admin/tamnv2. PR #788 source 37608e5e1ad8e4f8e7f11741af8dc90dae292755 passed 37/37 source CI, merge 38d8e9d603bbee465d030f8dd1878bc49fbfd238. First Worker production deployment run 40688119778 SUCCESS. First Agent OTA was blocked by an obsolete same-SHA Gateway wait. The out-of-scope Firestore deployment was correctly denied.

Recovery PR #789 changed only release workflows/source gating to check unchanged registered Gateway and Firebase Rules without redeployment. Recovery source 820f7c79d62048677d9da0c04ec48e9a0079293f passed 21/21 CI, including native Windows Agent158 build/startup, Worker Usage TypeScript, D172 isolated regression, authority/continuity and Email preservation. Protected merge release SHA 6824de94ac99183f8a3d4bd2120bc729ed8f7638 with D173-E096_AGENT158_WORKER_RELEASE marker and preserved pin ancestry.

## Production evidence
- Existing Worker release run: https://github.com/tamnv2/supra-inventory/actions/runs/40689962637 — SUCCESS. Log reports Owner/source E096 gate PASS, unchanged Gateway/Firebase/D172 PASS, official https://inventory.supra.cc.cd/health PASS.
- Signed Agent158 release run: https://github.com/tamnv2/supra-inventory/actions/runs/40689962557 — SUCCESS. Log reports same-SHA Worker first PASS, existing Gateway PASS, Firestore Rules unchanged PASS, native Windows build and runtime package PASS.
- Dedicated release: https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v158 — published 2026-10-28T12:44:23Z; canonical Agent.Auto.Confirm.Pick.Pack.exe and .sha256 release assets present; EXE 8,783,360 bytes.
- Runtime distribution channel: https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel — agent-latest.json, canonical EXE and .sha256 assets updated at 12:44 UTC. CI log confirms inventory-channel -> relay-agent-v158.
- Firestore Rules deploy job was intentionally skipped on scoped production recovery commit. No Firebase Rules/Gateway/Android/OBPP source change was made.

## Phase separation
CODE PASS; CI PASS; RELEASE TECHNICAL PASS. FIELD PENDING (installed Agent desktops, UI verification, and actual Email zone values not physically reviewed). OWNER PASS PENDING. D172 independent PENDING/HOLD. Stable OWNER-GATED untouched. Do not equate published signed OTA with completed installation on every active desktop.

## Verification boundary
GitHub release assets and checksums were verified by successful publishing workflow. This receipt does not claim an independent download-and-hash validation or a live physical-device FIELD test.
