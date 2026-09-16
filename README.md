# SUPRA Inventory — Báo hàng

Canonical repository for project `supra-inventory`.

## Environments

- Beta: `supra-inventory-beta` → `inventory-beta.supra.cc.cd`
- Stable: `supra-inventory-stable` → `inventory.supra.cc.cd`

Stable is **not live** and must not be deployed, promoted, or opened to real users without an explicit Owner command.

## Architecture baseline

- Web + native Android APK
- Cloudflare Workers backend
- Durable Objects + SQLite planned for realtime/state
- Firebase Authentication + Firebase Cloud Messaging
- Google Drive / Google Sheets for controlled HR source and archive/backup flows
- GitHub public repository; secrets are never stored in source

## Repository layout

- `service/` — Cloudflare Worker service
- `web/` — web client (bootstrap pending)
- `android/` — Android app (bootstrap pending)
- `docs/` — architecture, security, handover and operational documentation
- `ops/` — machine-readable resource registry and operational state
- `.github/workflows/` — CI/CD; Beta may deploy automatically, Stable stays owner-gated

## Security

Never commit service-account JSON keys, OAuth client secrets, refresh tokens, Cloudflare API tokens, signing keystores/passwords, root credentials, session tokens, or private API keys.

See `docs/SECURITY_BOUNDARIES.md` and `ops/resource-registry.json`.
