# D173-E082 — Agent152 release and docs-only CI guard closure (27/10/2026)

## Evidence of implemented technical release and CI repair

- D173-E079 Agent152 was authorized and released on main `993b0c0a39e8ec7a9add8ae3b0eb92fecab2b020`; Agent native source SHA `36b2dd2efcd71459cbc466b195c2d8d959680f3d` had **31/31 PR checks PASS**. Signed [release relay-agent-v152](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v152) in [Agent workflow #40509999568](https://github.com/tamnv2/supra-inventory/actions/runs/40509999568) completed SUCCESS. GitHub tag and existing `inventory-channel` EXE assets match exact SHA256 `eee0418df46dbedae1d928754f4ed2c8c5ab442d1498d7f1291a3f77130ed321`, **8,745,984 bytes**.
- E080 docs-only [PR #768](https://github.com/tamnv2/supra-inventory/pull/768) passed 17/17 PR checks and merged as `cf9ffa5c09c62b54711932c239cd100e95e3f5c1`. It unintentionally triggered an Agent release workflow because the signed-release receipt was a `push.paths` input. [Run #40511457820](https://github.com/tamnv2/supra-inventory/actions/runs/40511457820) failed at the **legitimate D167 Owner release authorization gate**, no EXE/OTA change.
- E081 fixed the Agent **release job** push guard without modifying the business Agent code or the released binary. [PR #769](https://github.com/tamnv2/supra-inventory/pull/769) protected merged to main `6e9d8026c23f3948eb59a1b3cabbbce11ad37449`, with Windows native Agent source build and `D173 E081 docs-only signed release skip regression` PASS and D172 isolation PASS. All relevant checks succeeded; the PR overall displayed 19 workflows SUCCESS, zero FAILURE, while two independent workflows were still reported in-progress even after their individual jobs passed.
- New [Agent workflow #40513565199](https://github.com/tamnv2/supra-inventory/actions/runs/40513565199) on exact E081 `ci(...` main merge was **SKIPPED**, proving no unwanted Agent rebuild or signed publication. The v152 tag/channel digest remained unchanged after the guard merge.
- Independent Worker/Firestore release flows may correctly fail their own D167 Owner authorization gates when a CI-only/docs-only main change offers no provider release permission. No Worker/Firebase/OBPP release is asserted. These are distinct from Agent152 signed OTA RELEASE PASS.

## Separated state

| Stage | Status |
| --- | --- |
| Agent152 CODE and 31/31 source CI | PASS |
| Agent152 protected main release, signed tag and matching OTA digest | PASS |
| D173-E081 docs/CI-only Agent publish guard | CODE / Windows CI / protected merge PASS, main Agent job SKIPPED |
| Installed VPS desktop v152, WMS confirmed-row and Android result | FIELD PENDING |
| Office WMS session / HA, actual DPI theme & Usage data | FIELD PENDING |
| Owner acceptance | OWNER PASS PENDING |
| D172 independent OBPP | PENDING/HOLD |
| Historical Stable | OWNER-GATED |

Technical release is complete. Physical fleet acceptance and provider-verified Cloudflare billing-cycle data still require separate evidence, not inferred from CI.
