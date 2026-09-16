# Security Boundaries

## Public repository policy

The repository is public. Public source must contain only code, documentation, and non-secret resource identifiers.

Never commit:

- service-account JSON/private keys
- OAuth client secrets
- OAuth refresh tokens
- Cloudflare API tokens
- Android signing keystores or passwords
- root/admin passwords
- session/access tokens
- private API keys

## Cloudflare secrets

Each environment stores its own runtime credentials in its own Worker.

Required secret/variable names:

- `GOOGLE_RUNTIME_SA_JSON` — Secret
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID` — Variable
- `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` — Secret
- `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` — Variable
- `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN` — Secret

Beta and Stable values must never be cross-used.

Wrangler configuration declares required secret names only; secret values remain only in Cloudflare.

## Durable Object / SQLite boundary

- Beta `InventoryCore` is provisioned with SQLite storage.
- Stable declares the same class/storage topology but is not provisioned until an Owner-authorized Stable deployment.
- Durable Object lifecycle changes use `wrangler deploy`; version-upload/gradual deployment is not used for class lifecycle changes.
- The Worker health endpoint may expose only status/schema version, never stored business data.

## HR source boundary

HR Sheet is configured by Admin/Root from the Web UI, not hard-coded in the repository.

- The system validates Google Sheet URL, exact tab name, and required `MNV` + `Họ tên` columns.
- Verified metadata is stored in `InventoryCore` SQLite.
- The public Worker must not expose an unauthenticated endpoint that can save/change HR source configuration.
- The source Sheet should grant only the minimum read access required to the environment-specific runtime identity.

## Google service-account key policy

Organization default remains protected by `iam.disableServiceAccountKeyCreation`.

Only the two SUPRA Inventory projects are exceptions through the existing tag condition. Do not disable the constraint organization-wide.

Runtime service accounts use narrowly scoped Firebase roles; do not broaden to Owner/Editor/Firebase Admin unless a concrete requirement is reviewed first.

## OAuth scope

Current Drive scope:

`https://www.googleapis.com/auth/drive.file`

Do not broaden to full Drive scopes unless a documented application requirement proves this insufficient.

## Cloudflare CI token

The current Beta compatibility deployment token is broader than the original per-Worker token because the original granular token returned Cloudflare API code `10000` for Worker APIs. Treat the compatibility token as a Beta-only CI credential.

Do not reuse it for Stable. Before Stable release, reassess whether Cloudflare granular Worker permissions can replace the broader compatibility token.

## Stable release boundary

Stable is not an automatic deployment target. Stable credentials, Durable Object provisioning, public routing, signing material, and release actions remain Owner-gated.

## Operational hygiene

- Verify target project/environment before cloud mutations.
- Rotate service-account keys and OAuth credentials when exposure is suspected.
- Do not log secrets or entire authorization payloads.
- Health endpoints may report only presence/absence of required bindings, never their values.
- Prefer least privilege and environment isolation.
