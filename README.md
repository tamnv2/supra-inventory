# SUPRA Inventory — Báo hàng

Canonical GitHub repository: `tamnv2/supra-inventory`.

## Production identity

- Official user-facing service: `https://inventory.supra.cc.cd`.
- The live service retains the **technical** Worker name `supra-inventory-beta` and existing InventoryCore/SQLite/Firebase identity. Technical names do **not** imply a Beta-to-Stable promotion flow.
- The **separate historical Stable** Worker/environment remains `OWNER-GATED`, not a deployment target without a fresh explicit Owner command.
- Never infer the current APK/Agent/Web version from this README. Use the evidence-pinned `ops/current-context.json`, then **verify against GitHub Releases, actual PRs, CI/deploy runs and source receipts**. Physical FIELD/OWNER acceptance remains separate from technical release.

## Repo-first navigation

1. `ops/authority-manifest.json` — **first read**, current minimal bootstrap and authoritative source pointers.
2. `docs/AI_WORKING_CONTRACT.md` — coding discipline, response style, GitHub checkpoint/readback and D172 isolation.
3. `ops/current-context.json` — compact **derived** working/runtime index; if stale, defer to live GitHub evidence and reconcile canonical state.
4. `ops/project-scope.json` — allowlisted resources, unknown scope fails closed.
5. `ops/project-state.json` and `ops/change-continuity/D173.json` — canonical work state and durable discussion checkpoints.
6. `docs/OWNER_DECISIONS.md`, `docs/specs/`, `docs/OPERATING_PROTOCOL.md` — Owner decisions, relevant specifications and release policies.

Read historical documents only for the relevant question, not as current release or task authority.

## Repository layout

- `service/` — Cloudflare Worker and shared InventoryCore SQLite Durable Object.
- `web/` — web frontend.
- `android/` — native Android/PDA app.
- `relay-agent/`, `relay-agent-webview2-host/` — Windows Agent and its runtime host.
- `obpp1291/` — **D172 independent** OB × PP1291 app.
- `ops/` — scope, state, continuity journal, resource registry and evidence.
- `docs/` — specifications, acceptance and historical receipts.
- `tests/`, `tools/`, `.github/workflows/` — source, regression, security and protected release checks.

## D172 and security boundary

D172 remains `PENDING/HOLD` pending explicit Owner closure. D172 and D173+ do not mutate each other's business code, data, releases, PRs or journals. Only registered Firebase Auth/user identity and Cloudflare infrastructure are shared; shared-source changes need both-module regression and Owner-scoped approval.

The repository is public. Never commit or log credentials, signing material, secrets, tokens or personally identifiable operational data.
