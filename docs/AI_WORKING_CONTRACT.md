# AI working contract — SUPRA Inventory

> Owner-authorized D173-E186 process only; **does not grant application release, cross-module mutation or Stable access**. GitHub main is the accepted source, and a verified open PR is working-only.

## Mandatory bootstrap for every project session / substantive project answer
1. Read current `main:ops/authority-manifest.json` through the GitHub connector, then its **current** `bootstrap_order`. Large historical ledgers may be read by targeted fields/ranges, not blindly copied into model context. Read compact `ops/current-context.json` as a derived navigation aid, **never** as proof replacing GitHub metadata.
2. Resolve change ID, accepted base, relevant Owner command, working PR **live state** (OPEN/MERGED/CLOSED), source HEAD SHA, current CI, release tag and exact receipt. A PR number saved in JSON is only a pointer; query GitHub instead of assuming it is still open. Check source and logs relevant to the actual question.
3. Reconcile contradictory/stale `ops/project-state.json`, `ops/resource-registry.json`, journal `resume`, `README`, `AGENTS` headings and derived handovers against newest evidence. Stale fields must not generate an answer, release approval or mutation. On material conflict: resolve by evidence within scope or report `REPO_NOT_VERIFIED`/BLOCKED.
4. The newest explicit Owner directive outranks historical decisions. Chat memory is a retrieval hint, never an execution source. Historical docs, superseded decisions and archives are read on demand only.
5. Before continuing, form a compact verified state: active task, approved vs proposed, current source/release, CODE/CI/RELEASE/FIELD/OWNER, blockers, exact next allowed step. Keep response focused on the asked matter rather than dumping all seven headings every time.

## Durable session checkpoints
- For every substantive **new** Owner instruction, accepted/rejected option, test result, new finding, bug, blocker or remaining work, write a **sanitized semantic checkpoint** to the correct `ops/change-continuity/Dxxx.json` in the authorized branch/PR, and to state/spec/decision ledger when those actually change.
- Checkpoint must separate confirmed evidence, assumption, unapproved proposal, Owner decision and next action; include exact PR/SHA/CI/release evidence; don't overwrite prior conflicting history. No duplicate writes for read-only/no-new-information turns.
- Commit, then **read back** and verify. If the GitHub write cannot occur: output `CHECKPOINT_NOT_SAVED`, not an invented durable memory. Never persist raw chat, personnel/customer data, logs carrying identifiers or secrets in public GitHub.

## Think before code; simplicity; surgical scope
- Clarify assumptions/interpretations that could change behavior, permission, or security. Describe tradeoffs and a simpler approach when it exists; challenge incorrect premises.
- Make the smallest change that solves the verified problem. Do not invent features/configuration/abstractions; do not refactor working neighboring code or unrelated formatting. Match existing style; delete only new dead imports caused by your own change.
- Define measurable acceptance conditions: bug → reproducing failing test → repair → PASS; refactor → regression before/after. Complete authorized CI/repair loops rather than stopping at the first failure.
- On task completion, reply in natural, concise, professional Vietnamese, centered on **result, evidence and remaining blocker**. No greetings, repetition of closed/cancelled/PASS issues, unrelated suggestions or speculative DONE.

## Absolute separation: D172 vs Báo hàng
- D172 = independent OB × PP1291 app, always `PENDING/HOLD` until explicit Owner closure. That does **not** bar separately authorized work/release.
- D172 and D173+ have separate business logic, operational data, app source, PR/CI, release, acceptance and journals. No automatic cross-edit, cross-delete, migration, release or change-ID renaming.
- Only shared registered **Firebase Auth/user identity and Cloudflare infrastructure** (including currently shared Worker/InventoryCore boundary). Sharing infrastructure grants no cross-business access or right to change another module.
- Any authorized change to shared code, auth, route, schema or data transport requires both modules' isolation and regression tests; no silent release coupling.

## Scope and gates
- Exact project resource scope: `ops/project-scope.json`. Unknown resource → fail closed. Stable always OWNER-GATED. Never assume prior Owner approval applies to another release.
- Branch from fresh `main` → isolated minimal changes → tests/guards → state/spec/decision/checkpoint in same changeset → PR/CI → authorized merge/release. No direct push to main.
- Distinguish CODE, CI, RELEASE, FIELD and Owner PASS by evidence. No secrets, credentials, tokens, private key, raw personal records or sensitive WMS data in repo.
- Maximize connected automation; request Owner Web UI action only for a genuinely unavailable permission/capability.
