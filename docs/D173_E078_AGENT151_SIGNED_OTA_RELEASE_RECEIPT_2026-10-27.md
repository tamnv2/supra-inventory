# D173-E078 — Agent151 signed OTA technical release receipt (27/10/2026)

## Verified release
- Owner E075 approved unified five-layout Cloudflare-first Usage dashboard plus nested vertical mouse-wheel scrolling and app-wide Light/AUTO/Dark selector. E076 explicitly ordered code/build/deployment of Agent-only v151.
- Native Windows .NET Framework 4.8 source tested and pinned at `05ddb6eb9aaf01df7f4b9a73d4c30274d4a2cf02`: **31/31 GitHub PR CI success, zero failed** including Windows Agent build/startup/native light+dark UI smoke, D172 isolation and source authority checks; later PR docs/authority commits did not touch protected runtime or release sources.
- Protected [PR #765](https://github.com/tamnv2/supra-inventory/pull/765) merged with `D173-E076_AGENT_ONLY_RELEASE:` message into main `e31facc674f584f9770dc00537eec826ccd86e30`.
- Agent-only [Verify Beta Relay Agent workflow run #40491744143](https://github.com/tamnv2/supra-inventory/actions/runs/40491744143) completed **SUCCESS**. Existing Worker release pipeline run #40491744160 was **SKIPPED by design**, not deployed. The unrelated Firestore Relay workflow run #40491744119 did not pass an authorization gate; no Firestore Rules rollout is claimed.
- [Signed dedicated release `relay-agent-v151`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v151), published 2026-10-27 10:53:55 UTC. `Agent.Auto.Confirm.Pick.Pack.exe`: **8,726,528 bytes**, GitHub release asset digest SHA256 `5a9e0a7b9325d6ef9f026c4c86d03f1b235c93c13eed8afe96c47042cb09b036`.
- Existing `inventory-channel` OTA release `Agent.Auto.Confirm.Pick.Pack.exe` asset: **8,726,528 bytes**, exactly matching SHA256 `5a9e0a7b9325d6ef9f026c4c86d03f1b235c93c13eed8afe96c47042cb09b036`; `agent-latest.json` updated 2026-10-27 10:53:57 UTC. Actual installed physical VPS fleet version remains unverified.

## Separated gates
| Gate | Status |
| --- | --- |
| Agent151 CODE | PASS |
| Exact source Windows/CI | PASS |
| Protected PR/main source merge | PASS |
| Signed Agent151 GitHub tag & OTA binary digest | RELEASE PASS |
| Native physical Windows desktop UI at multiple DPI, wheel and tab transitions | FIELD PENDING |
| Cloudflare provider-verified cycle boundaries, account allowance, billing forecast and full-period data | FIELD/SOURCE PENDING; per-cycle warnings N/A |
| Real WMS/Office/HA, history surface and Agent current active use | FIELD PENDING |
| Owner acceptance | OWNER PASS PENDING |
| D172 OBPP | Independent PENDING/HOLD |
| Historical Stable | OWNER-GATED |

## Scope and caveats
The 5 USD/month Cloudflare shared fixed subscription remains separate from included per-metric 50% internal planning targets, not a $2.50 bill cap. Cloudflare usage per-day comparison is a non-provider-hard daily reference; Cloudflare monthly/variable spend remains N/A when verified billing period and measured numerator are unavailable. Firebase Reads/Writes/Deletes display daily-only; no fabricated billing amounts or provider query additions. No worker, Firebase Rules, Web, Android, D172 business or historical Stable release was authorized by this Agent-only change.

## Next action
Owner verifies Agent v151 actually installed through OTA on VPS, all tabs and nested wheel/scroll edge cases at 100/125/150% DPI, Cloudflare/Firestore source timing and correct N/A, history PickList, Office/WMS/HA. Do not promote technical success to FIELD/OWNER PASS without evidence. Provider Cloudflare billing-cycle data access or API permission changes require separate review.
