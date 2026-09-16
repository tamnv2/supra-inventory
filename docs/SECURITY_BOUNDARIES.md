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

Required secret/variable names currently provisioned:

- `GOOGLE_RUNTIME_SA_JSON` — Secret
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID` — Variable
- `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` — Secret
- `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` — Variable

Beta and Stable values must never be cross-used.

## Google service-account key policy

Organization default remains protected by `iam.disableServiceAccountKeyCreation`.

Only the two SUPRA Inventory projects are exceptions through the existing tag condition. Do not disable the constraint organization-wide.

Runtime service accounts use narrowly scoped Firebase roles; do not broaden to Owner/Editor/Firebase Admin unless a concrete requirement is reviewed first.

## OAuth scope

Current Drive scope:

`https://www.googleapis.com/auth/drive.file`

Do not broaden to full Drive scopes unless a documented application requirement proves this insufficient.

## Stable release boundary

Stable is not an automatic deployment target. Stable credentials, signing material, and release actions remain owner-gated.

## Operational hygiene

- Verify target project/environment before cloud mutations.
- Rotate service-account keys and OAuth credentials when exposure is suspected.
- Do not log secrets or entire authorization payloads.
- Health endpoints may report only presence/absence of required bindings, never their values.
- Prefer least privilege and environment isolation.
