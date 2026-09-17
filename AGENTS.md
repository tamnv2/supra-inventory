# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Never import assumptions, credentials, resources, business rules or memories from another project.

## Mandatory bootstrap gate before mutation

Read `ops/authority-manifest.json`, then consume its `bootstrap_order` in order. At minimum this includes:
1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ops/project-scope.json`
4. `ops/project-state.json`
5. `docs/OWNER_DECISIONS.md`
6. all relevant `docs/specs/*`
7. `docs/OPERATING_PROTOCOL.md`
8. `ops/resource-registry.json`
9. recent commits/CI and relevant live source

Do not mutate first and “reconstruct context later”. If canonical files conflict on behavior or target resource, fail closed and reconcile.

## Authority

1. Current explicit Owner command.
2. Canonical GitHub context/scope/state/decision/spec/operating/resource files.
3. Current source + recent CI/deploy/runtime evidence.
4. Generated views.
5. Chat memory/old handovers only as retrieval aids.

GitHub is the durable project memory; chat is the control surface.

## Project resource scope

`ops/project-scope.json` is authoritative for provider/resource identity. Use exact listed ID when present; otherwise canonical name and `id_source`. An unlisted resource is outside scope and must not be mutated until reconciled and Owner-approved.

Stable resources are OWNER-GATED even when listed.

## Durable product knowledge

All Owner-approved forms, design rules, workflows, business logic and scenarios must be persisted in `docs/OWNER_DECISIONS.md` plus affected `docs/specs/*` in the same workstream. Never leave a durable approved rule only in chat.

Superseded decisions are marked, not silently removed.

## Live work-state rule

Meaningful work updates `ops/project-state.json` in the same workstream. It must distinguish technical PASS, runtime PASS, device/field PASS and Owner business acceptance. “Continue” means fresh-read project state before acting.

Resource changes update both `ops/project-scope.json` and `ops/resource-registry.json` where applicable.

## Automation-first rule

Follow `docs/OPERATING_PROTOCOL.md`. For finite work: trigger → poll → inspect failure → repair in scope → rerun until terminal PASS or a real Owner-only blocker/hard tool limit.

If Owner action is unavoidable, use the shortest official UI path, batch permissions/setup, avoid local installs/CLI when a connected/web path exists, and automatically recheck afterward.

## Stable guard

No Stable deploy/provision/public traffic/real-user bootstrap/OAuth refresh activation/promotion/release without explicit current Owner authorization.

## Public-repo security

Never commit/log/paste secret values: private keys/service-account JSON, OAuth client secrets/refresh tokens, Cloudflare tokens, signing material/passwords, root/admin passwords, session/access tokens, private API keys.

Use secret *names/references* only. For new operational metadata, minimize public exposure and prefer aliases/runtime variables when reproducible automation does not require the exact value. Exact IDs already in public Git history are classified in `project-scope`; deleting them from HEAD does not make them secret again.

## Product guards

- Beta/Stable isolated; no Beta runtime data copied into Stable by default.
- Worker + InventoryCore SQLite is transaction authority.
- UI is realtime; reload is not synchronization logic.
- No location/bin/pickface or stock-quantity inventory scope.
- No new offline primary/direct-to-Sheet transaction path unless Owner approves.
- Office-network fallback research stays closed unless Owner reopens it.
