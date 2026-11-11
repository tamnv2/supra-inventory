# D173-E186 — Repo-first bootstrap, state freshness and cleanup (11/11/2026)

## Owner scope
- Replace ChatGPT Project instructions with the Owner-supplied coding discipline, response style, repo-first verification and sanitized durable checkpoint rules. Project Settings instructions require Owner paste; GitHub cannot modify ChatGPT Project Settings.
- Priority 1: minimize obligatory bootstrap, make a concise evidence-pinned working snapshot, fail closed on stale release pointers, and persist a D173 continuity checkpoint.
- Priority 2: reconcile current top-level state and resource registry with verifiable latest releases.
- Priority 3: remove proven duplicate execution from authority CI, keep historical docs/tests/workflows until usage and dependencies are verified.
- No application code, provider action, database migration, public runtime, signing, UI, Android, D172-specific assets or Stable release in this PR.

## Verified baseline before implementation
- GitHub main SHA `a00ba55b15748edd4393a15092c0c786b30b294e`; merged D173-E185 source PR #908.
- E185 receipt: `docs/D173_E185_AGENT184_SIGNED_OTA_RELEASE_RECEIPT_2026-11-11.md`. Worker/Web 3.3.6 run 42949993804 SUCCESS; signed Agent184 run 42949993537 SUCCESS, release `relay-agent-v184`. FIELD/OWNER pending.
- Android `beta-vc128` release 10/11/2026; GitHub release asset SHA256 `9c470aa283915ea5758d8c9c984f9664f7f837b210766ad61255918b87674a12`, release source `82071f87380635de44ee337c385599b66c7c8bbd`. No claim that all physical PDAs run vc128.
- D172 signed OBPP v12 is separate and PENDING/HOLD. No D172 source or release mutation.

## Risk and controls
- Accepted runtime base: **no impact**; governance and docs-only updates, plus read-only CI guard.
- CI change: preserve job names and all independent guards; remove verified duplicate executions only.
- The new compact context is a **derived index**. Actual GitHub PR status, source/CI, release receipts and canonical state take precedence if contradictory.
- Preserve history in Git, existing journal and docs. No deletion of unproven-dead source/test or workflow.
- GitHub PR must pass authority, project-state and D172 isolation checks before considering a merge. Owner FIELD/OWNER PASS not inferred from source CI.

## Acceptance checklist
1. Project instructions prepared as copy/paste text; no claim to have modified ChatGPT Settings.
2. Bootstrap list limited to live essentials; historical source paths still accessible by targeted lookup.
3. Snapshot and project-state and registry agree on latest evidenced Agent/Web/Android releases.
4. E186 decision and checkpoint exist in the D173 journal, new PR resolved on GitHub.
5. Existing authority/continuity/secret guards pass; no runtime/Stable/D172 changes.
