# Security Boundaries

## Public repository policy

The repository is public. Store code, durable non-secret project knowledge and only the operational metadata needed for reproducible work.

Never commit:
- service-account JSON/private keys;
- OAuth client secrets or refresh tokens;
- Cloudflare API tokens;
- Android signing keystores/passwords;
- root/admin passwords;
- session/access tokens;
- private API keys.

GitHub Actions **variables are for non-sensitive configuration**. Sensitive values belong in secrets/runtime secret stores. GitHub secret scanning/push protection helps detect supported credentials, but ordinary resource IDs such as Drive/Sheet IDs may not be treated as secrets; therefore exposure minimization is still required.

## Operational identifier policy

For new resources:
1. Publicly store logical resource name/alias and environment.
2. Prefer GitHub/Cloudflare runtime variables for exact operational IDs when automation can consume them without exposing them in source.
3. Publicly record an exact non-secret ID only when it is required for reproducible automation and the exposure is acceptable.
4. Never record access tokens/credential values, even if convenient.

Legacy exact IDs already committed to public Git history remain historical public metadata. Removing them from HEAD alone does not erase history. Any future privacy hardening must be treated as a deliberate migration, not cosmetic redaction.

## Cloudflare/runtime secrets

Environment credentials stay environment-specific. Beta and Stable values must never be cross-used. Wrangler/source declares secret names only; values remain in runtime secret stores.

## Durable Object / SQLite boundary

- Beta `InventoryCore` is the current operational store.
- Stable is Owner-gated until explicit release/provision command.
- Health endpoints may expose status/schema/binding presence only, not secrets or business data.

## HR boundary

Admin/Root configures HR source through authenticated UI. Backend validates URL, exact tab and required MNV + Họ tên columns before save. Minimum read access is preferred.

## IAM/OAuth

- Keep organization-wide service-account-key restrictions; only documented project exceptions are allowed.
- Do not broaden runtime IAM roles without reviewed need.
- Current Google Drive scope remains `drive.file` unless a documented requirement proves it insufficient.

## CI/deploy

- Environment secrets are consumed only by jobs that need them.
- Do not print authorization payloads or credential values.
- Prefer least privilege and environment isolation.
- Stable deploy remains Owner-gated.


## Public information classification

- **SECRET VALUE** — never in repo/history: private keys, SA JSON, refresh/client secrets, API tokens, signing secrets, passwords, session/access tokens.
- **SECRET REFERENCE** — allowed: secret/variable name and storage location only.
- **PUBLIC IDENTIFIER** — project/app/package/worker/hostname identifiers needed for reproducible automation may be recorded.
- **OPERATIONAL METADATA** — Drive/Sheet/folder IDs are not credentials, but minimize new public exposure. Existing values already in Git history are classified in `ops/project-scope.json`; do not claim HEAD deletion makes them private.
- **BUSINESS SPEC/DESIGN** — public by repo policy unless Owner explicitly changes repository visibility.
- **PERSONAL/REAL OPERATIONAL DATA** — do not commit HR/business production datasets or PII to the public repo.

`ops/project-scope.json` records identifier classification without storing any secret value.
