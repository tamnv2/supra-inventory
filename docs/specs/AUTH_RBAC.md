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

## D086 — encrypted WMS session and protected Agent exit

- D086 overrides the earlier RAM-only persistence wording for the **captured WMS request-session snapshot only**. The Agent may store that snapshot locally as a Windows DPAPI `CurrentUser` encrypted file on the authorized workstation so startup can validate/reuse it without browser recapture.
- Company WMS username/password are still never entered into or stored by the Agent. The encrypted file contains only the already-authorized request-session material required by the approved read-only HY1 calls.
- The encrypted WMS session file is local-only and must never be copied to GitHub, RTDB, logs, support artifacts, overlay settings or Android.
- SUPRA Inventory application authority is unchanged: the Agent still requires a real immutable `base_role=ADMIN` + effective `ADMIN`.
- A graceful Agent shutdown requires the currently authenticated ADMIN's locally protected password verifier. The verifier is salted/derived and itself DPAPI-protected; plaintext password storage/logging is forbidden.
- Runtime watchdog/autostart changes process persistence only and grant no extra application/WMS privilege.

## D088 — persistent single interactive Web/Android session and independent Agent authority

- One application account has exactly one **interactive** session generation across Web and Android/PDA. A successful new Web or Android login increments the server-authoritative `session_generation`; every older Web/Android token for that account becomes invalid with `SESSION_REPLACED`.
- Web and Android persist the current refreshable application session locally so reopening the same browser/app does not require another login while that session remains current. Passwords are never persisted by this mechanism.
- Session validity is enforced on normal authenticated API calls and refresh, not by a high-frequency background polling loop. Existing realtime connections are requested to close when a new interactive session is activated; API generation checking remains authoritative.
- Existing pre-D088 tokens without the new session claims fail closed as `SESSION_UPGRADE_REQUIRED` and require one login after deployment.
- Password change increments the interactive session generation and invalidates older Web/Android sessions.
- The Windows Agent uses an explicit `AGENT` auth channel and is **not** subject to the one-interactive-session generation. This is required to preserve D085 multi-Agent HA. Agent login still requires immutable base role ADMIN and effective ADMIN.
- D088 closes open decision O002 for the current Beta product: Web + Android share one interactive session per account; real ADMIN Agents remain a separate multi-Agent operational channel.

## D094 — Agent saved-session replacement semantics

- Real-base ADMIN remains the only valid Windows Agent application identity.
- Agent persistence stores a Firebase refreshable session under DPAPI CurrentUser; it does not store the plaintext ADMIN password.
- Startup refresh/revalidation must still prove effective role `ADMIN`, immutable base role `ADMIN`, correct Firebase project audience and application user claim before the stored session is accepted.
- Logout removes the persisted Agent application session and stops relay leadership/listening for that identity.
- A later successful ADMIN login replaces the persisted identity/session with the new account.
- Agent session persistence remains independent from the single interactive Web/Android session generation and independent from the separate company WMS browser authority.


## D098 — Firebase credential authority and independent client session slots

D098 supersedes D088's single shared Web/Android session-generation model.

- Firebase Authentication is credential authority; InventoryCore remains business/RBAC authority.
- One logical user has one stable Firebase UID and may concurrently hold at most one session in each channel: `WEB`, `ANDROID`, `AGENT`.
- Same-channel second login returns `SESSION_ACTIVE_OTHER_DEVICE`; only an explicit force/continue action replaces that same channel. Every authenticated business API validates the channel generation so an old token cannot continue after replacement.
- Role/client matrix:
  - PICKER: ANDROID only.
  - REPORTER: ANDROID + WEB.
  - ROOT: ANDROID + WEB.
  - ADMIN: ANDROID + WEB + AGENT.
- AGENT requires immutable/base role ADMIN and effective ADMIN. ROOT effective-role simulation is not Agent authority.
- Web/App login may continue to accept MNV/username as product UX while Firebase verifies the resolved identity/password. Existing PBKDF2-SHA256 password material is migration input only; new credential verification authority is Firebase.
- Firebase UID is stable. Password change, disable or session replacement invalidates the proper channel/credential state without UID rotation.
- ROOT/ADMIN recovery email is stored as business identity metadata and synchronized to Firebase Auth. Password reset requests are enumeration-safe and send only when user + registered email match.
- PICKER Web access is server-denied even if a client is modified. REPORTER/ROOT Agent access is denied by Firestore Rules/claims and Agent-side claim checks.
- Agent refresh tokens may remain DPAPI CurrentUser protected locally; plaintext passwords/tokens must never be persisted or logged.


## D099 — Firebase Email/Password provider is a runtime prerequisite

- D098 Firebase credential authority is valid only when the Beta/Stable environment's Email/Password provider is explicitly enabled and password-required.
- Deployment acceptance must read provider config from Identity Toolkit. Beta main may repair the in-scope Beta config automatically; Stable remains OWNER-GATED.
- A synthetic ephemeral user must prove the exact PBKDF2-SHA256/100000 import contract can sign in before runtime auth is called PASS. The synthetic account is deleted in the same test.
- Web/App resolve username/MNV to the authoritative Firebase identity through Inventory Worker and may perform a one-time migration repair only when the same plaintext password verifies against the canonical InventoryCore PBKDF2 hash.
- Agent does not call Worker for login. Agent therefore accepts the registered ADMIN email + password directly against Firebase. This preserves Office-network independence and avoids an unauthenticated username→email directory.
- Passwords, password hashes, salts, ID tokens, refresh tokens and service-account material remain prohibited from logs/repo.


## D100 — shared-UID username authentication and destructive ROOT authority

- Web/App continue username/MNV login through the Worker resolution layer.
- Agent accepts ADMIN username/MNV + password. The Agent derives the same deterministic synthetic Firebase alias email as the service; users never type or need to know this alias.
- One logical user has exactly one Firebase UID across Web/App/Agent. The Firebase password identifier is deterministic from role + username/MNV; the registered real email is recovery/OTP metadata only. Firestore Agent authorization remains real base/effective ADMIN only.
- ADMIN password/status changes update the same Firebase identity used by Web/App/Agent. `firebase_agent_ready` is readiness metadata for direct username Agent login, not a second Firebase user.
- Only `base_role=ROOT` **and** current effective `role=ROOT` may use System Reset APIs.
- ROOT System Reset requires current ROOT password + emailed 6-digit OTP before execution.
- ROOT/ADMIN self-service password recovery uses a hashed, single-use project token sent to the registered real email; the token expires after 15 minutes and the resulting password update applies to the same Firebase UID.
- Reset must never delete/disable/rotate ROOT identity, ROOT password, ROOT recovery email or ROOT Firebase UID.

## D106 managed credential commit contract

For Web-managed ADMIN/REPORTER creation and password updates:

1. InventoryCore derives/stores the existing PBKDF2 material.
2. The service provisions or updates the same deterministic Firebase UID/alias.
3. While the submitted plaintext exists only in request memory, the service writes that password natively with Identity Toolkit.
4. The service performs a direct signInWithPassword against the deterministic Firebase alias and verifies localId equals the expected UID.
5. Only after step 4 may Firebase password readiness be marked; ADMIN Agent readiness is marked only after the same proof.
6. A create that fails after the InventoryCore row was inserted must compensate by removing the external UID first and then using the guarded internal create-rollback route. Rollback is refused after Firebase readiness is committed.
7. Secrets/passwords/tokens/hashes/salts are never emitted in logs or public responses.

This closes the partial-create state where the Web reported failure but an account remained in InventoryCore, and closes the readiness gap where Web password reset returned success while direct Agent Firebase password login still failed.

## D109 management audit visibility

- `Nhật ký → Lịch sử thao tác` remains an Admin/Root management surface under the existing Web navigation/RBAC.
- The stored management-audit projection includes actions performed by REPORTER, ADMIN and ROOT. Picker actions are deliberately excluded from this view.
- Recording an actor role/display name does not grant new permissions; authorization continues to use the existing effective/base-role rules.
- Audit output never returns credentials, passwords, tokens, cookies, signing material or other secret fields.

## D110 Android role restriction

D110 narrows the D098 Android client matrix without changing Web or Agent authority:

- PICKER: ANDROID only.
- REPORTER: ANDROID + WEB.
- ADMIN: WEB + AGENT; **ANDROID denied**.
- ROOT: WEB; **ANDROID denied**.
- Android denial is enforced server-side from immutable/base role, so ROOT role simulation cannot bypass it and a modified/stale App cannot obtain or refresh an Android ADMIN/ROOT business session.
- Existing same-channel session replacement rules, Firebase UID/credential authority, Web roles and real-base ADMIN Agent requirements remain unchanged.

## D116 — Picker-only bulk account selection

- Bulk enable/disable/delete selection is semantically limited to accounts whose role is PICKER.
- ROOT is never bulk-selectable or normally manageable. ADMIN/REPORTER rows are not represented by Picker bulk checkboxes and cannot become selected through **Chọn tất cả Picker**.
- In all-Picker mode, an operator may deselect/reselect individual Picker rows. The client sends the exception set and the server removes those IDs from the PICKER target set before mutation.
- Server authority remains role-based: even malformed/non-Picker IDs cannot widen the target beyond the existing role=PICKER server filter.
- Existing actor hierarchy remains unchanged: ROOT may manage ADMIN/REPORTER/PICKER where already authorized; ADMIN may manage REPORTER/PICKER; normal APIs cannot manage ROOT.

## D119 — Quản trị Invent / Quản trị Pick Pack and Android capability boundary

- Existing internal `ADMIN` is retained and its user-facing label becomes **Quản trị Invent**.
- New internal role `PICKPACK_ADMIN` is **Quản trị Pick Pack**.
- `PICKPACK_ADMIN` is additive and least-privilege: Picker personnel lifecycle, SKU catalog/import operations, read-only shortage/reporting/history/export and explicitly granted Picker-contact capability only.
- `PICKPACK_ADMIN` cannot resolve shortage results, correct Báo hàng outcomes, modify SLA/timeout/auto-skip policy, use system reset or manage ADMIN/ROOT authority.
- D119 supersedes D110 only for real-base `ADMIN`: ADMIN may hold an ANDROID session but Android business capability is restricted to Reporter-equivalent operations. ROOT and PICKPACK_ADMIN remain Android-denied.
- Windows Agent is an explicit channel exception: real-base `ADMIN` **or** real-base `PICKPACK_ADMIN` may authenticate as an Agent operator. Both may use the existing guarded PickList lookup/confirmation flow; both may use D119 Agent SKU synchronization/update. `PICKPACK_ADMIN` Agent permission does not authorize any Báo hàng resolve/correct/SLA mutation API.
- Picker-presence projections expose only bounded operational identity/status metadata; FCM tokens and credentials are not readable by Agent clients.
