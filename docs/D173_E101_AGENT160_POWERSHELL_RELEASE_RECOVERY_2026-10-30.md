# D173-E101 — Agent160 signed release PowerShell packaging recovery (30/10/2026)

## Approval and failure proof
Owner confirms the operating Inventory model healthy and explicitly requests Agent160 release. PR #797 main SHA `747fddd00138495cc2165686b57e8029a906608a` passed build, source-pin, live official Worker health and SQLite readiness; GitHub main-push run `40993558567` failed **only at** `Publish dedicated Agent prerelease`, parsing the `--prerelease` line as a PowerShell unary operator. This follows `--notes $agentNotes` missing the PowerShell backtick continuation. Signed tag `relay-agent-v160` and inventory-channel v160 were absent at diagnosis, so **RELEASE FAIL**.

## Correction
- Add trailing PowerShell continuation backtick after `--notes $agentNotes` in `.github/workflows/verify-relay-agent.yml`, without changing Agent runtime.
- On the dedicated release-recovery PR, parse the exact publish block using the Windows PowerShell AST parser. This prevents a structurally valid YAML file with an invalid `pwsh` block from silently passing PR CI.
- Maintain the same explicit E100 Agent160 Owner-only gate, signed tag, official health and source/D172 safeguards. No new Worker/DO, Web, Android, Gateway, Firebase, shared SQLite, WMS/HA or Stable mutation.
- Re-pin E100 authorized `approved_source_sha` to the exact recovery PR CI-approved protected source **after CI**. Do not reuse prior E100 source pin for a changed workflow.
- Protected merge must carry `D173-E100_AGENT160_ONLY_RELEASE:` marker so the existing Agent-only release gate runs and same-SHA Worker/Firestore deployment stays skipped.
- Verify tag `relay-agent-v160`, EXE and .sha256 artifact, `inventory-channel` EXE and `agent-latest.json`, matching SHA256 and source. FIELD installation and Owner acceptance remain distinct.

## Lifecycle
D172 PENDING/HOLD independent. Old Worker incident E097 history is retained; actual production health verification from run 40993558567 passed. No claims about field installation before VPS check.

### Dual source-verification gate
Only release-packaging YAML is repaired; gate code and receipt are updated solely to enforce the new source and preserve the old immutable Agent160 runtime. The original Agent160 code source `29e8a903fbb738c481b9e1dca12d79decae1087c` has 33/33 CI and is checked unchanged across `relay-agent/`. The new exact recovery source must complete its own applicable PR workflow CI (>=20 successful, zero failure) and real Windows PowerShell AST verification, then the receipt must pin that SHA. Production Worker /health+SQLite, standalone D172 and Stable protections remain enforced. Neither original baseline proof nor Owner's statement substitutes for a signed artifact and channel digest receipt.

### Code and CI verification (30/10)
- E101 exact recovery source `86c5c66656a23bb54c71478a3195db876f56dbce` PR #798: 21/21 applicable CI PASS; the real PowerShell Agent publish run block AST parser PASS (run `40995626088`).
- Original Agent160 runtime source `29e8a903fbb738c481b9e1dca12d79decae1087c`: native x64 net48, startup, UTC same-session, D172 regression and 33/33 CI PASS.
- Owner receipt pins both proofs, verifies unchanged Agent runtime and retains all no-Worker/no-Firebase/no-D172 release guards. SOURCE/CI PASS only; technical signed OTA and field acceptance still separate.
