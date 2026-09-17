# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Do not import assumptions, credentials, resources, business rules or memories from Pick Pack 1291, Pickface Damage, SupraCore, VHDCHY, or any other project.

## Mandatory bootstrap before project mutation

Read, in order:
1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ops/project-state.json`
4. `docs/OWNER_DECISIONS.md`
5. `docs/specs/README.md` and the relevant spec files
6. `ops/resource-registry.json`
7. recent commits/CI evidence and the live source relevant to the requested task

`ops/authority-manifest.json` defines the machine-readable authority map. Generated/derived views such as `docs/handovers/HANDOVER_CURRENT.md` and `docs/SERVICE_READINESS.md` are convenience views only.

## Authority

1. Current explicit Owner command in the active conversation.
2. Repo canonical context/state/decision/spec/resource files listed above.
3. Current implementation source + recent commits + CI/deploy evidence.
4. Generated views.
5. Chat memory / old handovers only as historical retrieval aids.

If a current Owner command changes a durable rule, update the repo authority in the same workstream. If canonical sources conflict in a way that could change behavior or target resources, fail closed and reconcile before mutation.

## Repo-as-project-memory rule

GitHub is the durable project memory. Chat is the control surface, not the canonical source of truth.

- Do not rely on remembered chat details when the repo can answer the question.
- New Owner-approved forms, workflows, UI rules, scenarios and scope changes must be captured in `docs/OWNER_DECISIONS.md` plus the relevant `docs/specs/*` file.
- Superseded decisions are marked; they are not silently deleted.
- Meaningful implementation progress must update `ops/project-state.json` in the same change set.
- Resource changes must update `ops/resource-registry.json`.
- Manual end-of-chat handover creation is not required.

## Work-state rule

`ops/project-state.json` must always expose current status, completed capability, pending/field work, current workboard and next action. A session that receives “continue” must fresh-read it before acting.

Technical CI PASS is not Owner business acceptance. Physical PDA/field acceptance stays explicitly separate.

## Automation-first rule

Maximize safe automation. For finite jobs: trigger → poll → inspect failure → repair within scope → rerun until terminal PASS or a real Owner-only blocker/hard tool limit.

If Owner action is genuinely required:
- first verify it cannot be done through available connected tools/CI;
- provide the shortest safe official UI path;
- batch permissions/setup so Owner does it once where possible;
- avoid requiring local software installation, terminal commands or local scripts unless there is no practical web/connected-tool alternative;
- after Owner action, immediately recheck automatically.

## Stable guard

Stable is Owner-gated. Do not deploy, provision, publish, route traffic, create real-user data, activate Stable OAuth refresh tokens, promote Beta, or release Stable without explicit current Owner authorization.

## Public-repo security guard

Never commit/log/paste secret values: service-account JSON/private keys, OAuth client secrets/refresh tokens, Cloudflare tokens, signing keystores/passwords, root/admin passwords, session/access tokens, or private API keys.

For new operational identifiers, minimize public exposure. Prefer logical aliases and GitHub/Cloudflare runtime variables where practical. Exact non-secret identifiers may only be public when needed for reproducible automation and after considering exposure. Never move a secret into a normal Actions variable; GitHub variables are for non-sensitive configuration.

Existing historical public identifiers are not made private merely by deleting them from the latest commit. Do not claim otherwise.

## Change guards

- Keep Beta and Stable isolated.
- Verify target environment/resource before cloud mutation.
- Do not broaden IAM/OAuth scopes without documented need.
- Do not weaken organization-wide service-account-key policy.
- Keep UI realtime; reload is not synchronization logic.
- Do not add location/bin/stock-quantity inventory scope.
- Do not reopen Office fallback research unless Owner reopens it.
