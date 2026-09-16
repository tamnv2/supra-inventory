# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Do not import assumptions, credentials, resources, or business rules from Pick Pack 1291, Pickface Damage, SupraCore, VHDCHY, or any other project.

## Authority

1. Current explicit Owner command in the active conversation.
2. `ops/project-state.json` for current implementation/progress/next-action state.
3. `docs/OWNER_DECISIONS.md` for durable Owner-approved rules and unresolved decisions.
4. `ops/resource-registry.json` for canonical resource identifiers and live environment status.
5. Live source, recent commits and CI/deploy evidence for implementation truth.
6. `docs/handovers/HANDOVER_CURRENT.md` as a generated/derived readable view only.
7. Older handovers/chat memory as historical evidence only.

If a current Owner command conflicts with the repo, follow the Owner command and update the canonical state/decision files in the same workstream. If repo sources conflict with each other in a way that could change behavior or target resources, stop the mutation and resolve that conflict before continuing.

## Cross-chat continuity protocol

Manual end-of-session handover creation is not required.

Every new session must bootstrap, in order:

1. `AGENTS.md`
2. `ops/project-state.json`
3. `docs/OWNER_DECISIONS.md`
4. `ops/resource-registry.json`
5. `docs/handovers/HANDOVER_CURRENT.md`
6. recent commits and the live source relevant to the requested task

Maintenance rules:

- Any meaningful application/service/runtime progress must update `ops/project-state.json` in the same change set.
- Any new or changed Owner-approved requirement must update `docs/OWNER_DECISIONS.md`; superseded decisions are marked, not silently erased.
- Any resource ID/environment/service-status change must update `ops/resource-registry.json`.
- `docs/handovers/HANDOVER_CURRENT.md` is only a readable derived view; never require the Owner to manually recreate it.
- ChatGPT Project/Memory may help retrieve context but must not override canonical repo state because conversational memory can omit or lag technical details.

## Stable guard

Stable is owner-gated. Do not deploy, publish, promote, attach a public route, create real-user data, activate Stable OAuth refresh tokens, or enable Stable for users unless the Owner explicitly commands that action.

## Secret guard

Never commit, log, paste into issues, or store in repository files:

- Google service-account JSON/private keys
- Google OAuth client secrets or refresh tokens
- Cloudflare API tokens
- APK signing keystores or passwords
- root/admin passwords
- session/access tokens
- private API keys

Public identifiers such as project IDs, Firebase App IDs, package IDs, Worker names, hostnames, Drive folder IDs, and OAuth redirect URIs may be recorded in the registry.

## Change rules

- Prefer small, reversible changes.
- Keep Beta and Stable resources isolated.
- Do not copy Beta runtime data into Stable.
- Verify target project/environment before mutating cloud resources.
- Do not broaden IAM, OAuth scopes, or organization policies without a documented need.
- Do not weaken the organization-wide service-account-key restriction; only the existing Inventory project exceptions are allowed.
- Keep UI realtime; avoid reload-based state reset.
- Do not implement location/bin inventory management: this project is SKU + product name oriented.
- Do not reopen Office-network fallback/provider research unless the Owner explicitly reopens that requirement.
- For finite deploy/build/test jobs: trigger, poll, inspect logs, repair within scope, rerun and continue until terminal PASS or an Owner-only blocker/hard tool limit.
