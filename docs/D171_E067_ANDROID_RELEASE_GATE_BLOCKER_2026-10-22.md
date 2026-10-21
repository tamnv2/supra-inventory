# D171-E067 — Partial Production release and Android-only gate failure (2026-10-22 VN)

## Verified technical receipts

- Owner authorized integrated D170/D171 release E062, E064 retained original Agent Wi-Fi priority.
- PR #656 merged by GitHub protected non-squash commit `1fab2e2a8140ea42f81324bf6c8f1f091c97c5ba`; final PR head `feb31ad884d7e32a25c2e442400f776024a8f722` had 27/27 workflow successes, including authority/continuity.
- Main GitHub Actions push: existing Google Agent Operations Gateway PASS run `39665052753`, Worker/Web/InventoryCore PASS run `39665052508`, scoped Firestore Rules PASS run `39665052450`, Agent v140 PASS run `39665052455`; v140 GitHub prerelease and SHA256 assets published. Worker run verified official and compatibility host point to same source/storage.
- **Android vc115 NOT RELEASED.** Android run `39665052492` built signed candidate/uploaded ephemeral CI artifact, then failed in `D169-E061 verified prior Beta runtime compatibility for Android-only release`; log says `E061 runtime source differs from deployed E060 baseline; release refused`. No `beta-vc115` release exists at this checkpoint.
- Production is temporarily mixed: new Worker/Web/Gateway and published Agent v140; Android public OTA still vc114. Physical WMS/Office/Drive/Gmail/usage and fleet install FIELD PASS remain unverified.

## Diagnosis

`.github/workflows/verify-apps.yml` step D169-E061 unconditionally reads the **historical D169 Android-only** receipt even when the approved D171 unified release receipt is active; the old comparison to E060 necessarily rejects the intentional Worker/Agent changes. This is a **release orchestration contract error**, not an Android source compile failure.

A follow-up workflow-only commit changes the main SHA, so the existing subsequent D171 Android step's strict `relay-agent-v140` tag == latest SHA check must also be replaced with stronger appropriate proof: unchanged `relay-agent/` and `relay-agent-webview2-host/` trees compared with published v140 tag **and** successful same-commit Agent verification workflow. The pinned `c8f58ce79f0ac4d59cdf547649e3f3a412e6d073` Firestore Rules source equality and Worker same-commit gate remain mandatory.

## Scoped repair, authorized under existing D171 (not a new Dxxx)

1. In the existing D169-E061 workflow step, detect the exact Owner-approved D171 code scope first, revalidate the existing `tools/d167_release_gate.py --component android` authorization, and skip ONLY the obsolete D169-only baseline; preserve D169 logic for its own receipt.
2. In the D171 Agent-before-Android step, keep pinned Firebase Rules parity and require published v140 source subtree parity plus successful same-commit `verify-relay-agent.yml` Actions run before publishing vc115. Fail closed on mismatch/unavailable status.
3. Add a targeted test covering D171 versus D169 guard precedence, source identity, and current-main dependency.
4. Apply changes via branch → PR → exact-head source CI + authority + continuity → non-squash merge → same-source Gateway/Worker/Agent gates → signed vc115 release → both old/new channel assets + checksum and public download → live/physical Owner field tests. **No Stable deployment or new provider resource.**

## Repair implementation and current release gate

The standard connected GitHub `update_file` action subsequently succeeded on the same reviewed branch PR #660, with the full workflow source and no safety check bypass.

- Historic D169-E061 runs only for its own receipt; D171 authorized release receipt is validated independently by `tools/d167_release_gate.py --component android`.
- D171 Android follows current SHA Worker check and pinned accepted Firebase Rules parity; published v140 Agent and WebView2 source trees must equal the active main candidate, and same-commit Agent GitHub CI must succeed.
- Existing Gateway workflow triggers on `verify-apps.yml` modifications, preserving same-commit Gateway→Worker→Agent ordering and readback.
- Static regression added to `tests/d170-d171-release-parity.test.mjs`.
- Canonical D171 journal and project state updated in this PR. No D170/Stable resources altered by PR-only work.

**Next:** PR CI/authority/continuity exact HEAD PASS, protected non-squash merge, monitor verified scoped release stages, signed vc115 publication and public/legacy channel assets. Hardware/Drive/Gmail/Cloudflare billed savings remain separate FIELD PASS gates.
