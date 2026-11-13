# D173-E262 — Web3.3.20 technical release recovery after D166 secret version propagation (13/11/2026)

## Confirmed evidence
- E261 Owner-approved PR #974 merged protected main SHA `099d01571399cf57615f6efbbf34f61c03d265ec`. Deploy Beta Worker Actions #43420957297 compiled Web, typechecked Worker, passed Owner exact-source gate and deployed Web/Worker with /health and SQLite checks PASS.
- Workflow **FAILED** only after existing D166 secret-put step published a second Worker version: the next *one-time* /health had HTTP200, environment=beta but source_commit did not yet equal SHA (no untrusted response body or secret is being committed).
- Independent **read-only** Actions #43421512675 / job131872400995 after propagation: official /health HTTP200 with `source_commit=099d01571399cf57615f6efbbf34f61c03d265ec`, status=ok, schema17/17, operational7/7, missing_bindings=0; Web shell HTTP200 and unauthenticated overview denied 401/403. This establishes **runtime source match**, not success of unfinished post-deploy checks.
- Original failure is therefore an *early readback false negative*, not proof of persistent source drift. The exact instant of convergence was not measured; do not claim a latency measurement.

## Narrow repair and risk
- Owner's existing explicit "Tiếp tục hoàn thiện done code và phát hành" authorizes completion of the failed E261 release, not feature/source/backend changes. E262 is technical recovery in the same D173 boundary.
- Change only `.github/workflows/deploy-beta.yml`: after existing D166 secret put, retry the same **strict** official health HTTP200 + beta + exact GITHUB_SHA guard every 5s for at most 30 attempts; 401 AUTH_REQUIRED on D166 usage remains mandatory; fail-closed if mismatch persists.
- Reuse Worker, Web 3.3.20, auth, schema and provider secrets exactly as registered. No changes to `web/`, `service/`, D172 OBPP, Android, Agent, Firebase, Gateway business handlers or Stable. A protected workflow-only merge will rebuild the exact same Web bytes under a new Worker source_commit/merge SHA.
- Exact recovery release marker `D173-E262_WEB3320_RECOVERY_RELEASE:`, gate `tools/d173_e262_web3320_recovery_gate.py`, authorization `ops/d173-e262-web3320-recovery-authorization.json` requiring no runtime source changes and CI evidence.

## Acceptance
- Source test asserts all 3 mandatory release guards and bounded strict readback; E262 CI preflight checks immutable Web/Worker/D172 source, Owner scope, read-only live Production status, plus Repo Authority and Project State/continuity.
- After protected merge: official Deploy Beta Worker workflow all required steps **SUCCESS**, /health exact new merge SHA and SQLite 17/17 + operational7/7, Web shell & RBAC, no D172 regression or new Provider resource.
- Technical RELEASE PASS separate from FIELD and Owner PASS. Global historical UI Design Guard unrelated failures are not hidden or counted as PASS. D172 remains PENDING/HOLD, Stable OWNER-GATED.

## Status
At documentation creation, E262 PR #975 is a **draft recovery candidate**. No second merge or Production release confirmed.

Checkpoint: PR #975 includes the E262 state/journal + Owner release recovery authority; scoped source and read-only runtime CI must PASS on the final PR head before merge. Exact E261 Production source already independently matched main SHA; this checkpoint is not a new deployment receipt.
