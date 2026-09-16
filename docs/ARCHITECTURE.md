# Architecture Baseline

Status: infrastructure bootstrap, implementation not yet started.

## Runtime topology

`Web / Android APK → Cloudflare Worker → Durable Objects + SQLite`

Supporting services:

- Firebase Authentication for application identity/auth flows.
- Firebase Cloud Messaging for background notification delivery.
- Google Sheets as controlled HR/source input where required.
- Google Drive / Sheets for batch backup and archive flows.
- GitHub as canonical public source repository.

## Environment isolation

### Beta

- GCP/Firebase project: `supra-inventory-beta`
- Worker: `supra-inventory-beta`
- Hostname: `inventory-beta.supra.cc.cd`
- Android package: `cd.cc.supra.inventory.beta`

### Stable

- GCP/Firebase project: `supra-inventory-stable`
- Worker: `supra-inventory-stable`
- Hostname: `inventory.supra.cc.cd`
- Android package: `cd.cc.supra.inventory`
- Stable stays owner-gated and not live until explicit acceptance/release.

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

## Pending design/build

- Durable Object classes/bindings and SQLite schema.
- Auth/RBAC implementation and Root bootstrap.
- HR Sheet schema/source binding.
- Web and Android application source.
- Backup/archive jobs.
- Reporting model.
- Load and resilience tests.
