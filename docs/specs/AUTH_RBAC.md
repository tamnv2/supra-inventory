# AUTH_RBAC — Canonical authentication and role authority

Status: **CANONICAL PRODUCT SPEC**.

## Roles and inheritance

- `PICKER`: operational report creator; sees own reports.
- `REPORTER`: processes unresolved batches.
- `ADMIN`: inherits Reporter operations and administers Reporter accounts, Picker lifecycle, HR source, Master SKU, dashboard/reporting and permitted settings.
- `ROOT`: highest application role; inherits **all ADMIN + REPORTER capabilities** and additionally manages both ADMIN and REPORTER accounts plus all Picker lifecycle controls. ROOT is protected from normal subordinate management flows.

The service is authoritative. Client-provided role is never trusted.


## Root effective-role test mode

Only the immutable application identity whose base role is `ROOT` may switch its temporary effective role for acceptance testing.

- Allowed effective roles: `ROOT`, `ADMIN`, `REPORTER`, `PICKER`.
- The base role remains `ROOT`; it is not rewritten to a subordinate role.
- Normal API authorization, realtime projection/tickets and role-target FCM routing use the **effective role**. A downgrade is therefore a real permission downgrade, not a client-side visual simulation.
- Existing realtime sockets for ROOT are closed when the effective role changes so a connection created under a higher role cannot keep higher-role projection.
- The Root-only role-switch route authorizes against immutable `base_role=ROOT`, so ROOT can restore `ROOT` even while its effective role is lower.
- No ADMIN/REPORTER/PICKER account may access the role-switch route.
- Web shows the selector only when `base_role=ROOT`. Android reads the server-authoritative effective role on resume and rerenders the role surface when it changes.
- The selected effective role persists server-side across Web/Android sessions until ROOT changes it again.


## Provisioning hierarchy

- ROOT may create/manage `ADMIN` and `REPORTER`.
- ADMIN may create/manage `REPORTER`.
- PICKER is provisioned from configured HR Sheet data by Mã nhân viên through Preview → explicit Apply.
- Admin/Root may independently manage Picker lifecycle after import: single, multiple selection, or all Picker accounts can be opened, disabled, or deleted.
- Changing HR source does **not** automatically delete/disable Picker accounts absent from the new source.
- Existing disabled Picker remains disabled during later HR sync until Admin/Root explicitly reopens it.
- Historical ticket/event data remains independent from Picker account deletion.
- ROOT cannot be managed through normal account-management APIs.

## HR source mapping

Admin/Root configures:
- Google Sheet URL;
- exact tab name;
- exact/normalized source column name used as `Mã nhân viên`;
- exact/normalized source column name used as `Họ và tên`.

Product logic must not require the literal headers `MNV` or `Họ tên`.

## Login/session foundation

`username/Mã nhân viên + password → Worker verification → Firebase custom token/session exchange`.

Passwords/secrets are runtime-only. Repo contains no password value.

## Password policy in current Beta behavior

- New ADMIN/REPORTER account creation requires the authorized manager to set an explicit password.
- Managed password maintenance is **direct password change**, not “reset to default”.
- Manager-set password changes rotate session/Firebase identity authority and disable prior notification/session presence for the target.
- Newly provisioned PICKER accounts use the protected Picker default-password runtime secret defined by Owner; its plaintext value must never be committed/logged.
- Legacy PICKER accounts that already exist but have no password hash/salt lazily initialize from the same protected Picker default at first successful password attempt, so they do not remain permanently blocked by `PASSWORD_NOT_INITIALIZED`.
- The legacy fallback may use the protected Root bootstrap secret only when the dedicated Picker default binding is absent in Beta; no plaintext password is stored in source.
- Existing authenticated users may change their own password through the normal account flow.

## Stable hardening still open

Do not invent Stable Root MFA/recovery, final password KDF, rate limit or lockout policy. These remain explicit open decisions in `OWNER_DECISIONS.md`.
## Realtime cursor authorization

Realtime sequence numbers are global infrastructure metadata, not proof that a user is authorized to view every event occupying those numbers. Delta scanning may advance `cursor_seq` across rows excluded by RBAC while returning only the role/user-projected events authorized for the authenticated principal.

Picker clients must not infer, request or receive another Picker's event payload merely to make sequence numbers contiguous. Reporter/Admin/Root projections continue to follow their approved inherited capabilities. A resync never weakens normal RBAC; authoritative reconcile reads remain authenticated role-specific endpoints.
