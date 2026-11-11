# D173-E188 — Agent186 GitHub Release + OTA technical receipt (11/11/2026)

## Xác minh trên GitHub sau phát hành
- Owner approved Agent186 code and release after the Agent185 three-machine field failure. The Owner then explicitly ordered completion when the Agent186 release was absent.
- Agent186 immutable source approved under PR #914, source CI SHA `61c056edba95597ce76a2fd6978c615958060754` (39 SUCCESS, 15 conditional SKIPPED, 0 FAIL). Production Agent/Host14 code changed **zero bytes** in release-recovery PRs #915 and #916.
- Recovery PR #915 source CI 17 SUCCESS +12 conditional SKIPPED; main merge `e5054bc3dcbc555edd493e2589741e1696460790`. Run `43018680679` failed before build due PowerShell read-only variable `$Host`, no release asset created.
- PR #916 fixes only PowerShell variable name, repins gated accepted base and records the failure; CI 17 SUCCESS +12 conditional SKIPPED +0 FAIL; protected two-parent merge at **`cbd534092fb496497638af972c962db1784db31e`**, subject `D173-E188_AGENT186_OTA_RECOVERY:`.
- **Technical release workflow:** [GitHub Actions run 43019682562](https://github.com/tamnv2/supra-inventory/actions/runs/43019682562), completed **SUCCESS**. Windows build and native self-tests, Host14 preflight and post-release EXE/SHA readback passed.
- **GitHub Release:** [`relay-agent-v186`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v186), published `2026-11-11T12:23:19Z` (19:23:19 VN); prerelease=true, draft=false, target `cbd534092fb496497638af972c962db1784db31e`.
- **Agent v186 canonical EXE:** `Agent.Auto.Confirm.Pick.Pack.exe`, size **8,905,216 bytes**, GitHub asset `sha256:89932a9f8b704d4814395db059fb6254c6dd9db0b2e3f764804fe7aa623a65c0`.
- **OTA channel:** [`inventory-channel`](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel), EXE digest = **same** `sha256:89932a9f8b704d4814395db059fb6254c6dd9db0b2e3f764804fe7aa623a65c0`; checksum asset digest identical to Release; `agent-latest.json` replaced at `2026-11-11T12:23:24Z`, its digest `sha256:871eddd26795944aebaadc8f093da8237159d133f251cc4dab20c6fd7d7a385c`. Workflow downloaded and verified manifest/tag, EXE/hash, file length, checksum readback.
- **WebView2 Host14:** existing channel ZIP `Agent.WebView2.FixedRuntime.x64.zip` digest unchanged `sha256:f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`; original updated timestamp remained `2026-11-11T05:24:38Z`. No 320MB republish and no Host binary mutation.

## Boundary, meaning of PASS
- **CODE PASS:** Agent186 source merged and unchanged. **CI (recovery) PASS:** exact scoped workflow and native Windows release run. **RELEASE PASS:** tag v186, EXE, SHA256 and OTA channel readback match.
- **FIELD NOT VERIFIED:** no evidence yet that any of the three operational Windows Agent clients have installed v186; cannot claim visible WebView2 tab, HD/HD+ truncation, five-action order and roster overlap resolved on physical machines without new field receipts.
- **OWNER PASS PENDING:** no explicit Owner validation of v186 FIELD evidence.
- **Other legacy workflows:** `verify-relay-agent.yml` and `verify-d171-agent-code-only.yml` had pre-job failures on main merge; recovery was isolated and succeeded, so do not claim every main workflow passed. Only E188 signed Agent186 technical publication is PASS.
- No Worker/Web/Android/Cloudflare/Firebase/WMS business/D172 code or provider mutation in PRs 915/916. D172 remains PENDING/HOLD; Stable stays OWNER-GATED.
