# SUPRA Inventory — Báo hàng

Canonical repository for project `supra-inventory`.

## Environments

- Beta: `supra-inventory-beta` → `inventory-beta.supra.cc.cd`
- Stable: `supra-inventory-stable` → `inventory.supra.cc.cd`

Stable is **not live** and must not be deployed, promoted, provisioned for real traffic, or opened to real users without an explicit Owner command.

## Current readiness

Beta backend infrastructure is ready for Web/Android application build:

- Cloudflare Worker + custom domain: PASS
- `InventoryCore` Durable Object: provisioned
- SQLite schema v1: PASS
- Google runtime credential: configured in Cloudflare secret storage
- Google Drive OAuth + refresh token: configured for Beta
- Firebase Android/Web apps: registered
- CI: typecheck + deploy + runtime binding + SQLite schema + OAuth start checks
- HR Sheet: intentionally configured later by Admin/Root from the Web UI; validator is already prepared

Stable has matching source/config but remains Owner-gated and is not deployed.

## Architecture baseline

- Web + native Android APK
- Cloudflare Workers backend
- Durable Objects + SQLite for realtime/state
- Firebase Authentication + Firebase Cloud Messaging
- Google Drive / Google Sheets for controlled HR source and archive/backup flows
- GitHub public repository; secrets are never stored in source

## Repository layout

- `service/` — Cloudflare Worker service and `InventoryCore` SQLite Durable Object
- `web/` — web client (application build pending)
- `android/` — Android app (application build pending)
- `docs/` — architecture, security, readiness and operational documentation
- `ops/` — machine-readable resource registry and operational state
- `.github/workflows/` — CI/CD; Beta deploys automatically, Stable stays Owner-gated

## Security

Never commit service-account JSON keys, OAuth client secrets, refresh tokens, Cloudflare API tokens, signing keystores/passwords, root credentials, session tokens, or private API keys.

See `docs/SERVICE_READINESS.md`, `docs/SECURITY_BOUNDARIES.md`, and `ops/resource-registry.json`.
