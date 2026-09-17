# AUTH_RBAC — Canonical authentication and role authority

Status: **CANONICAL PRODUCT SPEC**.

## Roles and inheritance

- `PICKER`: operational report creator; sees own reports.
- `REPORTER`: processes unresolved batches.
- `ADMIN`: inherits Reporter operations and administers Reporter accounts, HR→Picker lifecycle, Master SKU, dashboard/reporting and permitted settings.
- `ROOT`: highest application role; inherits Admin/Reporter and creates/manages ADMIN.

The service is authoritative. Client-provided role is never trusted.

## Provisioning hierarchy

- ROOT → ADMIN.
- ADMIN → REPORTER.
- PICKER → HR Sheet by MNV through Preview → explicit Apply.
- Missing Picker row becomes `DISABLED`; historical tickets/events remain.
- ROOT cannot be managed through normal subordinate account-management APIs.

## Login/session foundation

`username/MNV + password → Worker verification → Firebase custom token/session exchange`.

Passwords/secrets are runtime-only. Repo contains no bootstrap password value. New/reset managed accounts initialize from the protected bootstrap secret according to the current Beta implementation; no forced immediate password change is required by current Owner decision.

## Reset/session semantics

Current implementation rotates identity/session authority when a managed password reset requires invalidating old sessions and disables registered FCM devices for that identity. Final simultaneous-device/session policy remains Owner-open.

## Stable hardening still open

Do not invent Stable Root MFA/recovery, final password KDF, rate limit or lockout policy. These remain explicit open decisions in `OWNER_DECISIONS.md`.
