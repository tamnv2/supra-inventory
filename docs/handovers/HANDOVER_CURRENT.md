# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Do not use this file as the primary source of truth and do not ask the Owner to recreate it manually. Canonical state lives in `ops/project-state.json`, Owner decisions in `docs/OWNER_DECISIONS.md`, and resource identifiers in `ops/resource-registry.json`. Always fresh-read live repo/CI before mutation.

## Bootstrap order for every new chat/agent session

1. Read `AGENTS.md`.
2. Read `ops/project-state.json`.
3. Read `docs/OWNER_DECISIONS.md`.
4. Read `ops/resource-registry.json`.
5. Read recent commits and the live source relevant to the requested task.
6. Treat the latest explicit Owner command as highest authority.

No manual end-of-session handover is required.

## Current project status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Canonical repo: `tamnv2/supra-inventory`, branch `main`, Public.
- Beta: `BUSINESS_API_AND_ADMIN_SKU_FOUNDATION_LIVE`.
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`.
- Beta SQLite schema: v3.
- Business API: implemented and deployed in Beta.
- Web: live build/smoke PASS; Admin SKU Excel import/monitoring foundation implemented.
- Android: Beta build PASS; fixed signing + signed OTA release foundation present.
- Network: PDA runtime supported; Office network unsupported by Owner decision; do not reopen fallback research without Owner command.

## Completed core foundation

- Cloudflare Worker/custom domain + `InventoryCore` SQLite.
- GCP/Firebase Beta/Stable resources and runtime service accounts.
- Beta Google Drive OAuth/runtime secrets.
- Server-authoritative auth/RBAC + Root bootstrap/password-change foundation.
- Flexible authenticated HR Sheet configuration and validation.
- Beta signed APK/OTA foundation.
- SKU bulk import/search backend.
- Picker create/list/withdraw; Picker+SKU dedupe; same-SKU batch grouping.
- Reporter priority queue; resolve HAS_STOCK/SKIP_ALLOWED; 5-minute correction.
- Ticket/batch/event/audit recording and Admin monitoring backend.
- Web Admin SKU Excel import foundation, including identical duplicate merge and conflicting-name blocking.

## Current build frontier

1. WebSocket realtime protocol + presence.
2. FCM device registration/delivery.
3. User management + HR provisioning/sync lifecycle.
4. Android Picker report UI.
5. Android Reporter queue/resolve/correct UI.
6. Archive/retention executor.
7. Reporting/export.
8. Load/resilience/quota tests.
9. Owner business acceptance.

## Stable guard

Without explicit Owner command, do not:

- deploy/provision Stable for first live use;
- attach public traffic;
- create real-user Stable data;
- activate Stable Drive refresh token;
- release/promote Stable APK/web/service;
- copy Beta runtime data to Stable.

## Open decisions

Do not invent answers for open items. See `docs/OWNER_DECISIONS.md`, section **Open decisions**.

## Execution rule

For finite CI/deploy/test work: trigger → poll → read logs → repair within scope → rerun → poll until terminal PASS or a real Owner-only blocker/hard tool limit.
