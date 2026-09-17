# Architecture — SUPRA Inventory

Status: **CANONICAL STRUCTURAL SPEC**. Current version/build/readiness numbers belong in `ops/project-state.json`, not here.

## Topology

`Web / Android PDA → Cloudflare Worker → InventoryCore Durable Object → SQLite`

Supporting systems:
- Firebase Authentication: identity/session exchange.
- FCM: background best-effort notification.
- Google Sheets: configurable HR source.
- Google Drive/Sheets: batched archive/supporting exports.
- GitHub: source, durable Owner decisions/specs/work state, CI/deploy evidence.

## Authority boundaries

- Business transaction authority: Worker + InventoryCore SQLite.
- Client state is not authoritative; reconnect/resume must resync from API.
- Foreground realtime: WebSocket invalidation/resync.
- Background: FCM notification; delivery failure must not fail a committed business mutation.
- Google Sheets is not a competing transaction store.

## Data model semantics

Keep separate:
- report ticket: one Picker's report;
- processing batch: grouped work for a SKU;
- lifecycle/audit event: state-change history.

Open dedupe: Picker + SKU. Multiple Pickers may share one batch while retaining individual tickets.

## Environment isolation

Beta and Stable have separate project/application/runtime identities. Stable remains Owner-gated. Do not copy Beta runtime data into Stable.

## Security boundary

Secrets stay in runtime secret stores / GitHub secrets, never source. Public operational metadata should be minimized. Read `docs/SECURITY_BOUNDARIES.md` and `ops/resource-registry.json`.

## Current implementation status

Do not maintain a duplicate checklist here. Read `ops/project-state.json` and current CI/deploy evidence.
