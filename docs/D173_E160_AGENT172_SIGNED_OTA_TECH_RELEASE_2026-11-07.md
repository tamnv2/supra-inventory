# D173-E160 — Agent172 signed OTA technical release receipt (07/11/2026 VN)

**Receipt PR:** https://github.com/tamnv2/supra-inventory/pull/862 (docs only).

**Scope:** read-only technical release receipt for Owner-approved D173-E159 Agent172 Windows. **No application code, no new provider deployment, no additional release, no field/Owner PASS.** D172 OBPP stays separately PENDING/HOLD. Stable remains OWNER-GATED.

## Verified source, protected merge and CI
- Production code PR: [#861](https://github.com/tamnv2/supra-inventory/pull/861), merged with **merge commit** `ef7441152842521e1704d32ee99777197dddcb24`, preserving audited source ancestry and explicit marker `D173-E159_AGENT172_ONLY_RELEASE:`.
- Source pin `f8ccbde4b5e50e61668c093df8082bd964f5a05b`: **39 SUCCESS, 14 SKIPPED, 0 FAILED** checks on exact source; rebuilt docs/authorization head `ef78bd00c9c1ee8b8ae8d70c9004fdbf0bbc5986` separately reverified **39 SUCCESS, 14 SKIPPED, 0 FAILED**.
- Native Windows Agent and Host build checks PASS; D172 isolated regression and historical Android operational guards PASS. Agent172 source build=172, assembly=0.172.0.0, Host reuse requirement Host13 x64.
- The guard `tools/d173_e159_agent172_release_gate.py` accepted the protected main source and Host13 pin. No direct push to main; only merged PR and protected GitHub Actions release.

## Signed Agent172 delivery verified from GitHub provider readback
- Agent release workflow: [Verify Beta Relay Agent #42367280622](https://github.com/tamnv2/supra-inventory/actions/runs/42367280622), **COMPLETED / SUCCESS**, target merge SHA `ef7441152842521e1704d32ee99777197dddcb24`.
- Signed Agent tag: [`relay-agent-v172`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v172), GitHub tag ref points **exactly to merge SHA**.
- Release asset `Agent.Auto.Confirm.Pick.Pack.exe`: **8,865,792 bytes**, GitHub asset digest `sha256:02b54f6a008e1aa2ce3181a5bbc16571ee19adb7e02883d9f48c59f9ee6e12cb`.
- `inventory-channel`: `Agent.Auto.Confirm.Pick.Pack.exe` has the **same exact SHA-256 and size**; `agent-latest.json` updated in release run (asset digest `sha256:2bad30013762715d22751a956e7ef16ed1acc5322ae34d900daa8b8e6cde7f20`). This establishes technical OTA channel publication. **No claim yet that each desktop applied the update.**
- Reused Agent-owned Fixed WebView2 Host13 x64 ZIP: existing channel asset unchanged SHA-256 `36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694`, 321,605,288 bytes; did not republish Host.
- Release `inventory-channel` tag is the runtime distribution channel; this is **not a Stable release**.

## Separated provider CI results and boundaries
- GitHub main push for this Agent-only merge also triggered historical all-project provider workflows, but their scope/authorization gates refused unrelated Worker and Firestore deployments. `Deploy Beta Worker` run 42367280745 and `Deploy Beta Firestore Relay` run 42367280618 returned **FAILURE at gate, before deployment**; `D170 Official Client Host Compatibility` run 42367280741 failed its legacy regression. **Do not label whole-repo CI green.**
- Agent172's own signed-release workflow 42367280622 **PASS**; this is distinct from unrelated forbidden-provider pipelines. No modified Worker, Web, Android, Firebase Rules, functions, Gateway, OBPP D172, or Stable source in PR861.
- No evidence of completed 5-Agent live 5m convergence, 40-PDA stress, free-tier billing under equivalent peak load, exact Office capability route on each PC, 100 minimize/restore actions, 2h hidden WMS session continuity, or field-authorized owner acceptance. These remain **FIELD / OWNER PENDING**, and provider usage targets are not guaranteed by a green Agent build.

## Closure boundary
**CODE: MERGED** · **CI: Agent source/native/D172 tests PASS** · **RELEASE: signed Agent172 OTA TECH PASS** · **FIELD: PENDING** · **OWNER PASS: PENDING**. Keep D172 independent HOLD and Stable OWNER-GATED. No new code or release authorized by this receipt itself.
