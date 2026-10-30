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
