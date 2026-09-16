# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. Do not use this file as the primary source of truth and do not ask the Owner to recreate it manually. Canonical state lives in `ops/project-state.json`, Owner decisions in `docs/OWNER_DECISIONS.md`, and resource identifiers in `ops/resource-registry.json`. Always fresh-read live repo/CI before mutation.

## Current project status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Canonical repo: `tamnv2/supra-inventory`, branch `main`, Public.
- Beta Web: role-based Reporter/Admin/Root operations UI deployed PASS.
- Beta Android: role-based Picker/Reporter/Admin/Root operational UI with local SKU catalog cache; signed OTA `beta-vc24` PASS.
- SKU Excel: 10k–50k row chunked preview/confirm/import deployed PASS.
- Business API / SQLite schema v3: deployed PASS.
- Realtime: WebSocket one-time-ticket + presence + selective invalidation server source is the current CI/deploy frontier.
- Stable: config-only, Owner-gated, not live.

## Current build frontier

1. Deploy/smoke WebSocket realtime server protocol.
2. Wire foreground realtime into Web and Android clients.
3. FCM device registration and background delivery.
4. User management + HR provisioning/sync lifecycle.
5. Archive/retention executor.
6. Reporting/export.
7. Load/resilience/quota tests.
8. Owner business acceptance.

## Non-negotiable guards

- Stable stays untouched unless Owner explicitly commands release/provision/promotion.
- Worker + InventoryCore SQLite is transaction authority.
- Realtime notifications are best-effort invalidations after transaction commit; reconnect always resyncs authoritative state.
- No secrets in repo/chat/logs.
- No Office-network fallback research unless Owner reopens it.
- No location/bin inventory scope.

No manual end-of-session handover is required.
