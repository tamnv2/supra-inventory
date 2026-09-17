# SUPRA Inventory — quota & resilience guard

Checked against official provider documentation on 2026-09-17. This is a conservative design envelope, not proof of the account's billing entitlement and not an Owner-approved traffic forecast. The project must not auto-upgrade a plan.

## Official reference envelope

- Cloudflare Workers Free: 100,000 requests/day, 10 ms CPU per HTTP invocation. Source: https://developers.cloudflare.com/workers/platform/limits/
- SQLite Durable Objects on Workers Free: 100,000 requests/day, 13,000 GB-s/day, 5,000,000 rows read/day, 100,000 rows written/day, 5 GB total SQL data. Source: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare confirms each index row update adds a row written; indexes are still recommended for read-heavy filters when their saved scans justify the write cost. Source: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Google Sheets API: 300 reads/min/project + 300 writes/min/project, 60/min/user/project; batch request counts as one request; Google recommends payloads around 2 MB or less. Source: https://developers.google.com/workspace/sheets/api/limits
- FCM HTTP v1 default downstream quota is 600,000 messages/min/project; Android per-device maximum is 240/min and 5,000/hour. FCM is no-cost. Sources: https://firebase.google.com/docs/cloud-messaging/throttling-and-quotas and https://firebase.google.com/pricing

## Guards applied

1. Dashboard/report date filters use dedicated timestamp indexes instead of repeated unbounded table scans.
2. SKU catalog metadata is materialized in one row, so catalog-version checks no longer `COUNT/MAX` scan the entire master on every PDA sync.
3. PDA catalog sync is delta-first using `(updated_at, sku)` pagination. Full 50k catalog download is only bootstrap/fallback.
4. A 50,000-SKU full bootstrap is 50,000 catalog rows per device. At the Free 5M rows-read envelope, 100 fresh full bootstraps in one day alone could consume the entire row-read allowance. This is why version changes must not trigger full reloads.
5. No rapid HTTP polling is introduced. WebSocket invalidation remains foreground realtime; FCM remains background notification; dashboard refresh is explicit/realtime-driven.
6. Archive uses batched Sheets writes and checkpointed fixed ranges rather than per-event Sheets writes.
7. Live resilience probes are read-only: health/schema/auth guards and bounded burst tests. Business mutation stress must use an isolated test workload so Beta operational records are not polluted.

## Residual risk

A genuinely fresh fleet bootstrap can still be expensive because each device has no local catalog yet. The exact PDA concurrency/daily report volume is not canonical in the current repo, so this document does not claim production-capacity PASS from an invented workload. Measure real usage and account entitlement before Stable release.
