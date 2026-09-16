# Architecture Baseline

Status: **Beta backend infrastructure ready for Web/Android application build**. Stable configuration is prepared but remains Owner-gated and not live.

## Runtime topology

`Web / Android APK → Cloudflare Worker → InventoryCore Durable Object → SQLite`

Supporting services:

- Firebase Authentication for application identity/auth flows.
- Firebase Cloud Messaging for background notification delivery.
- Google Sheets as an Admin/Root-configured HR source.
- Google Drive / Sheets for batch backup and archive flows.
- GitHub as canonical public source repository.

## Environment isolation

### Beta

- GCP/Firebase project: `supra-inventory-beta`
- Worker: `supra-inventory-beta`
- Hostname: `inventory-beta.supra.cc.cd`
- Android package: `cd.cc.supra.inventory.beta`
- Durable Object: `InventoryCore`
- Storage: SQLite schema v1
- CI deploy + health + schema gate: PASS

### Stable

- GCP/Firebase project: `supra-inventory-stable`
- Worker: `supra-inventory-stable`
- Hostname: `inventory.supra.cc.cd`
- Android package: `cd.cc.supra.inventory`
- Durable Object/SQLite configuration mirrors Beta but is not provisioned until an explicit Owner-approved Stable deployment.
- Stable stays Owner-gated and not live until explicit acceptance/release.

## HR source model

There is no fixed HR Sheet resource in infrastructure.

Admin/Root will configure the source from the Web UI by entering:

1. Google Sheet URL.
2. Exact tab name.

The service validator checks:

- correct Google Sheets URL shape;
- runtime service-account read access;
- exact tab existence;
- required `MNV` and `Họ tên` columns (with normalized accepted equivalents).

Only verified metadata is stored in `InventoryCore` SQLite. No unauthenticated public setup endpoint is allowed.

## Business baseline

- Project focuses on SKU + product name; no bin/location inventory management.
- Roles: Picker, Reporter, Admin, Root.
- Picker signs in by employee code (MNV).
- Picker reports out-of-stock SKU.
- Reporter resolves with `Đã có hàng` or `Cho phép skip`.
- A `skip` result may be corrected to `Có hàng` within five minutes.
- Picker may withdraw an accidental report within 60 seconds if unresolved.
- Dedupe unresolved reports by picker + SKU.
- Multiple pickers reporting the same SKU are grouped into the same processing batch.
- Reporter priority: more affected pickers first; if equal, earlier first report first.
- UI is realtime and must not depend on full-page reload for state synchronization.
- WebSocket is the primary foreground realtime channel; FCM supports background delivery.
- Presence target is approximately 60 seconds or better.
- SKU master imports from Excel.
- Detailed service retention target is approximately 60 days, while unresolved pending items are retained beyond that boundary.
- Reporting must distinguish report ticket, processing batch, and event; do not infer whole-warehouse fill rate or OOS rate without valid denominators.

## SQLite schema v1 baseline

Prepared tables cover:

- app/runtime configuration;
- HR source configuration;
- users/RBAC data;
- SKU master;
- report tickets;
- processing batches;
- report events;
- FCM devices;
- presence sessions;
- archive checkpoints;
- audit logs.

A partial unique index enforces one unresolved/open report per Picker + SKU.

## Application build pending

These are application implementation tasks, not missing infrastructure services:

- Auth/RBAC implementation and Root bootstrap.
- Authenticated Admin/Root HR Sheet setup route + UI.
- WebSocket realtime protocol and presence handling.
- FCM registration/delivery flows.
- SKU Excel import flow.
- Report/resolve/correct/withdraw logic.
- Backup/archive execution logic.
- Reporting model and exports.
- Web and Android application source.
- Load/resilience tests.
- APK signing/release material.

See `docs/SERVICE_READINESS.md` and `ops/resource-registry.json` for canonical readiness state.
