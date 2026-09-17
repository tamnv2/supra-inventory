# REALTIME_NOTIFICATIONS — Canonical synchronization and notification rules

Status: **CANONICAL PRODUCT SPEC**.

## Authority

Business state is authoritative in Worker + `InventoryCore` SQLite. Realtime channels notify/invalidate; they do not become a second transaction store.

## Foreground realtime

- WebSocket is the foreground channel for Web and Android/PDA.
- Authentication uses a short-lived one-time ticket issued only after authenticated session validation.
- InventoryCore uses hibernatable WebSocket handling and tags by role/user/client.
- Business transaction commits first; broadcast failure must not roll back a successful business mutation.
- Reconnect always re-fetches authoritative server state.
- Full-page reload is not synchronization logic.

## Background FCM

- FCM HTTP v1 is background best-effort delivery.
- Device registration is authenticated.
- Resolution/correction notifications target affected Picker users; new reports target Reporter/Admin/Root as implemented.
- Report withdrawal intentionally does not need noisy FCM delivery under the current design.
- FCM failure does not change business transaction success.

## Acceptance state

Technical registration/delivery foundation is deployed. Physical logged-in PDA delivery remains field acceptance until Owner/device evidence is recorded in project state.
