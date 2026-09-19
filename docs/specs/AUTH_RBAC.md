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


## D075 — Relay Agent RBAC

- Relay Agent is an ADMIN workstation identity, not a Picker identity.
- Agent pairing/login requires both effective role and immutable base role to equal `ADMIN`; ROOT effective-role simulation does not qualify.
- Firebase custom tokens include `app_role`, `app_base_role`, and `app_user_id` for relay Rules.
- Shared relay Rules allow PICKER to create/read/delete only requests where `picker_uid == auth.uid`.
- Shared queue collection read and ACK mutation require `auth.token.app_role == 'ADMIN'` and `auth.token.app_base_role == 'ADMIN'`.
- ADMIN ACK metadata must identify `agent_admin_user_id == auth.token.app_user_id`.
- Passwords and Firebase credentials remain local/session-only and are never written to RTDB, logs, GitHub or update metadata.

## D080 — WMS POC identity and secret boundary

- WMS capture/probe controls are available only after the Windows Agent has restored/authenticated its existing real `base_role=ADMIN` application identity.
- The SUPRA Inventory ADMIN identity and the company's WMS browser login are separate authorities. The Agent must never synthesize, hard-code, commit or log a company WMS credential/session.
- Interactive WMS login is performed by the authorized user only when the dedicated browser session requires it.
- Captured `Authorization`, `Token`, `APISID`, `SID`, `SCID`, `USID` and related request-session values live only in process memory and are excluded from diagnostic output.
- D080 grants no WMS mutation permission and does not change application RBAC.

## D081 — Agent/WMS credential separation

- SUPRA Inventory ADMIN login inside the Agent remains the application's own authentication path: masked password input → HTTPS project backend → verified Firebase ADMIN claims → refresh token protected with Windows DPAPI.
- The ADMIN plaintext password is never persisted or logged; the UI password field is cleared immediately after the Agent copies it for the current HTTPS request. As with any desktop client, a fully compromised Windows user/process can still observe process memory; this is not represented as an absolute guarantee.
- Company WMS credentials are **not** entered into or stored by the Agent. WMS login remains interactive on the official `wms-supra.winmart.vn` browser page.
- The dedicated WMS browser uses its own profile directory; browser-managed login/cookies remain under Chromium/Windows user storage behavior. Agent only captures the allowlisted Supra API request headers required by D080 into process RAM and redacts them from diagnostics.
- DevTools remains bound to loopback `127.0.0.1` on a random ephemeral port while capture is active.

## D082 — Picklist lookup authorization boundary

- The relay workstation still requires a real SUPRA Inventory `base_role=ADMIN`; no new role receives WMS access.
- The company WMS session remains a separate, user-authorized browser session. Raw WMS credentials/session/header/signature values remain secret runtime material and are never persisted into RTDB, repo, diagnostics, overlay settings or Android.
- A valid HY1 session already in Agent RAM disables the manual `Mở WMS + lấy phiên` action. This prevents repeated login/browser capture while a usable session exists.
- A PDA relay request is not authorization to open a company login surface. Missing/expired WMS session returns a bounded session-required status; browser login must be initiated locally by the workstation operator.
- D082 grants only read access to the registered Picklist-list GET. It grants no confirmation/mutation authority.

## D085 — Agent HA and anti-spam authority

- Multiple machines may authenticate as real base-role ADMIN Agents, but only the WMS-ready Agent holding the active lease may process Picklist jobs.
- PICKER may read the bounded active-leader availability record so the PDA can decide whether a processing Agent exists; PICKER cannot write leadership.
- Only real base-role ADMIN Agents may write leader lease/heartbeat, persistent Picker rate-limit state, SWITCHING state and ACK metadata.
- Rate-limit identity is bound to the authenticated Picker job identity. Lock state is not trusted from the PDA and cannot be cleared by changing PDA.
- Windows user-mode auto-start grants no application privilege. Agent application access still requires D075 real ADMIN authority.
- WMS/browser credentials remain separate from application RBAC and are not persisted by the Agent as raw session/header material.

