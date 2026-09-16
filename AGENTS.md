# AGENTS.md — SUPRA Inventory

This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Do not import assumptions, credentials, resources, or business rules from Pick Pack 1291, Pickface Damage, SupraCore, VHDCHY, or any other project.

## Authority

1. Current Owner command in the active conversation.
2. `docs/handovers/HANDOVER_CURRENT.md` when present and newer.
3. `ops/resource-registry.json` for canonical resource identifiers.
4. Other project documentation.

If authority conflicts, stop mutation and resolve the conflict before continuing.

## Stable guard

Stable is owner-gated. Do not deploy, publish, promote, attach a public route, create real-user data, or enable Stable for users unless the Owner explicitly commands that action.

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
