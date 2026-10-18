# D169-E050 — Beta release receipts (18/10/2026)

**Status: LIVE BETA RELEASE PIPELINE PASS; Owner field PASS NOT CLAIMED.** Only the existing scoped Beta was deployed. D170 dual-network physical Agent↔Agent↔PDA field test is queued until D169 explicit Owner PASS. Stable remains owner-gated/unchanged.

## Tested and merged GitHub source

- D169 PR #615: https://github.com/tamnv2/supra-inventory/pull/615 — merged to main `c90e521d1c77b681455b32ffc33a69e7ecaa187e`.
- Full integrated source candidate `66180079056f931d643b77cc07aab6c2f61fc592`: 20/20 PR workflows PASS. Only release/continuity/docs changed after that SHA; `ops/d169-release-authorization.json` locks the protected source.
- Main post-merge GitHub Actions: 13/13 PASS at exact commit `c90e521d1c77b681455b32ffc33a69e7ecaa187e`.

## Deployment proofs

| Component | Run / verified receipt | Scope |
| --- | --- | --- |
| Beta Worker | [Deploy Beta Worker run 39102893789](https://github.com/tamnv2/supra-inventory/actions/runs/39102893789), SUCCESS | Existing Worker exact source/health gate, no new business/provider |
| Beta Firestore Rules | [Deploy Beta Firestore Relay run 39102893849](https://github.com/tamnv2/supra-inventory/actions/runs/39102893849), SUCCESS | Existing scoped Rules published by Rules Management API and readback |
| Agent v136 EXE | [Verify Beta Relay Agent run 39102893810](https://github.com/tamnv2/supra-inventory/actions/runs/39102893810), SUCCESS; [relay-agent-v136 release](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v136) | Published official prerelease EXE/checksum + inventory-channel agent-latest.json |
| Android Beta vc111 | [Verify Beta Android run 39102893786](https://github.com/tamnv2/supra-inventory/actions/runs/39102893786), SUCCESS; [beta-vc111 release](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc111) | Signed release APK/checksum + inventory-channel pda-latest.json |

Evidence: GitHub release assets list and channel `inventory-channel` checked on 2026-10-18. Agent EXE SHA-256 `768daa782ba2381d6aca2c2c34a695b06edbea8364a4807873d3325b19aea843`. Android vc111 APK SHA-256 `084fb6dee825fa067e30f75b99bc6cca9379396c77d8de445e80b738616868df`. Fixed WebView2 browser runtime zip and channel manifest also published.

**Boundaries:** Source/CI/release proof does NOT establish installed versions on actual VPS/local Agent/PDA, real WMS mutation, actual two-network failover ≤15s, on-device ACK, Firebase provider billed savings or Owner physical acceptance. Do not claim these passed or open D170 until Owner says D169 PASS. Previously published v135 and vc110 remain available for client rollback. No Stable mutation, new provider, new secrets or external resources.
