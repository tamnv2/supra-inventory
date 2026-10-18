## D170-E009 — Verified Cloudflare 409 binding conflict and narrow recovery (2026-10-19)

GitHub main release `00f2c7041e76b44c8871fa4916fc6b3b1f644b68` reached the Cloudflare custom-domain API but the direct non-destructive `PUT` returned **HTTP 409**. It did not change the existing Worker, Android app, Firebase, or database. Preflight showed the official hostname assigned exclusively to the superseded `supra-inventory-stable` Worker while the existing business datastore lives on `supra-inventory-beta`.

To complete the Owner-selected one-service model, the **only now-allowed detach** is the exact Cloudflare *Workers Custom Domain binding* for `inventory.supra.cc.cd` on the old Stable Worker. Before detach, verify account, current owner `supra-inventory-stable`, hostname, exact binding ID, registered zone and unchanged legacy hostname to `supra-inventory-beta`. On the confirmed 409 only, detach that binding by its returned ID; immediately attach the **same hostname** to the existing data-bearing Worker, with bounded retry, concurrent-owner fail-closed checks and best-effort reattachment of the original mapping if attach fails. **No Worker deletion, DNS-zone deletion, raw DNS-record deletion, Durable Object/SQLite/Firebase migration, Android package/signing change, or old-host retirement** is authorized. Brief official-host interruption is possible during binding transfer; original business hostname remains operational.

This is a superseding **route-binding-only exception** to D170-E008's `PUT only; no delete` assumption. Its exact-source Worker-only release still requires CI + authority/continuity PASS, protected authorization receipt, GitHub main merge and both hostnames' Worker-source/SQLite health readback. Provider HTTP 403 or unexpected 409 stays fail closed and would require Owner Cloudflare UI intervention, not a secret or token in a public repo. Do not mark the project DONE without official-host readback and subsequent visible-client/pipeline cleanup.

# D170 — Single Production cutover design (Owner direction 2026-10-18)

**STATUS: OWNER-SELECTED PRODUCT DIRECTION / IMPACT REVIEW; NOT CODE_READY, NOT DEPLOYED, NOT DATABASE MIGRATED.**
**Accepted base:** D169 limited Owner closeout (Agent v138 and Android vc112 technical release). **D171 is queued only** for isolated Office/Internet PDA ↔ Agent ↔ Agent diagnostics, with historical Draft PRs #612 and #613.

## 1. Intended state

One public, operational SUPRA Inventory service with **no Beta/Stable promotion pipeline**. Official web hostname is `https://inventory.supra.cc.cd`; official Android app title is **1291 Báo hàng**. User-facing pages, install/download links, release information, notifications, permission prompts, QR labels, Android launchers, and Agent UI must not show Beta or environment selection. Only one signed Android and Agent update channel publishes to users.

**Production by designation, not destructive provider migration:** the already-running `supra-inventory-beta` Worker, its existing `InventoryCore` Durable Object namespace/SQLite object identity, existing Firebase project/Auth/Firestore/RTDB/FCM, Google Drive/Sheets history, Android package `cd.cc.supra.inventory.beta` and installed signing certificate remain authoritative unless a separately proven safe migration is indispensable. Technical IDs, old release tags, key names and internal resource identifiers may retain `beta` for compatibility; do not unnecessarily copy/reset/rename databases.

**Legacy Stable resource:** the registered old Stable Worker/project/config are not the new service authority. First determine actual ownership and attachment of `inventory.supra.cc.cd`; do not deploy to or destroy old Stable, change its data, bind the hostname or delete resources before the verified cutover plan and explicit scoped runtime authorization.

## 2. Scope and change impact

Accepted base is affected: **yes**, principally external URLs, signed Android update flow, Windows Agent updater, web login/OAuth, Worker routes/assets, Firebase Auth authorized domains, CI/CD release selectors, public branding and production security posture. Business entities/SKU/role/picklist/ACK/SQLite schema should remain unchanged. No new provider, account, database, app package ID, signing key, WMS automation or extra poll/heartbeat is justified by branding.

Risk table:
- **P0 data isolation/split:** renaming Worker, DO namespace/class/object name or targeting an empty project can strand live SQLite. Preserve `INVENTORY_CORE` binding, `InventoryCore` class, object name and namespace; verify identical counts, event IDs, schema and history via READ-ONLY before/after.
- **P0 client update lockout:** existing signed PDA `vc112` validates `beta-vcN` release tag, APK versionName, trusted domain and signature. Keep backwards-compatible manifest/tag/download routes and monotonic versionCode until the installed legacy fleet passes the migration. Rename visible release names only when possible; do not flip package ID or signing key.
- **P0 HA/WMS:** existing Windows Agent v138 hardcodes old API host and original Firebase resource identities. Keep old domain/API live during transition and only switch new binaries after preserving Firestore fencing/generation, WMS idempotency, primary arbitration and ACK continuity. Do not change SSID routing or transport solely as part of cutover.
- **P1 OAuth/session:** add and verify new domain/callback allowlists before switching web; browser origin-local session state may require users to sign in again. Do not migrate Firebase identities, OAuth refresh tokens or expose credentials.
- **P1 dual-route ownership:** `inventory.supra.cc.cd` is registered for old Stable and may be attached. Confirm control-plane binding and absence of conflicting route before changing it; never allow two Workers to independently accept live writes.
- **P1 CI leak:** existing `deploy-beta.yml`, `verify-apps.yml`, release gate, Android/Agent guards, download manifests, Google callback, and `APP_ENV` checks are Beta-named. Convert policy without bypassing release authorization or activating debug/test endpoints in Production. Do not replace all literal strings blindly.
- **P1 visibility:** old installed apps may show 'Beta' until safely updated. Define verified cutover criteria for installed fleet; keep new end-user surfaces free of the label.
- **P2 cost:** no new Firebase/Cloudflare project or duplicated listeners; compare requests/CPU/DO and Firebase billable counters before and after.

## 3. Implementation tranches — mandatory ordered evidence

1. **Audit/backup (no runtime mutation).** Resolve current domain attachment, Worker script and DO namespace/object ID, Google OAuth redirect, Firebase authorized domains, CI Environment and all current deployment secrets by references only; list old/new clients and exact release artifact/signature. Obtain and validate provider-supported recoverable backups, non-destructive read-only snapshots and pre-cutover counts. Never commit private identifiers, credentials or staff data.
2. **Build compatibility bridge.** On a branch/PR, source-test preserving old API hostname and `/downloads/pda/manifest` / Agent update endpoints. Make the new public hostname, old hostname, OAuth/CORS and visible naming coexist, but **do not attach the actual domain or publish clients yet**. Keep established manifest tags and unsigned/update denial guards for old clients.
3. **Attach official hostname to the SAME Worker** only after exact source SHA, CI, scoped authorization, old Stable host conflict check, TLS health, OAuth authorized callback verification and live DO identity/read-only data comparison. Retain `inventory-beta.supra.cc.cd` as a legacy compatibility endpoint for existing devices and clients. Prefer one Worker with two hostnames over two Workers with database copies. Do not redirect legacy OTA manifest in a way rejected by old clients.
4. **Release safe clients.** Android `1291 Báo hàng`, existing applicationId/signing certificate with monotonically increasing versionCode; Agent current EXE updater identity and trusted channel retained. Update visible user-facing labels, permission prompts, notification titles, Web footer/downloads/QR, while keeping hidden compatibility metadata. Controlled installed-fleet readback must show no side-by-side duplicate app, no forced uninstall, no lost auth identity or ACK.
5. **Simplify pipeline and harden Production.** Exactly one guarded main→Production deployment target; retain branch→PR→CI→approved merge→verified release/rollback. Retire obsolete Beta→Stable promotion actions, Beta-only demo diagnostics, dual-host routing code and old Stable deployment targets only after actual live dependencies have been removed. Existing technical GitHub Environment `beta` may remain as secret container while official single-channel workflows are guarded and correctly named; do not relocate secret values into public repo or create unapproved resources.
6. **Field/operational acceptance and retirement.** Check Web Picker/Reporter/Admin, login/recovery/email, SKU and history, InventoryCore record continuity, RTDB/Firestore presence, Agent↔PDA Picklist/ACK and primary fencing, offline denial, update manifest compatibility and download SHA. Verify live current versions, provider Usage delta and lack of Beta labels on supported user-visible surfaces. Only then de-advertise old hostname; keep old host until all supported installed clients are migrated or a safe sunset protocol exists. Never reset active data for rollback.

## 4. Release/rollback gate

**CODE_READY ≠ DEPLOYED ≠ FIELD_PASS ≠ OWNER_PASS.**
No source merge that triggers live release before the verified domain ownership/data/OTA/CI/identity checks. Each release receipt must identify exact main SHA, old/new hostname health, same core object, row/record continuity, Auth sign-in, signed APK in-place upgrade, EXE update channel and rollback.
For a bad code or routing release, roll back code/routing while retaining transactional data written after cutover; restoring an old database snapshot over live transactions is prohibited without an independently approved reconciliation.

## 5. Scope exclusions and sequencing

- D170 is the only active change after D169. The Owner-approved goal permits preparing scope, source and tests after the formal preimplementation impact review, **not blanket authorization to mutate live domain, data, Firebase, release targets or Stable resources without cutover checks**.
- **D171 QUEUED, not active:** PRs #612/#613 and Office/Internet cross-network PDA-Agent-Agent tool/hardware matrix. Preserve diagnostic code and PR ancestry; check compatibility against the live v138 Rules/auth before any future merge/test. Testing may provide evidence for D170 without prematurely opening D171.
- D169 open field/Usage and unresolved presence/version/overlay observations retain their original evidence status. Limited D169 Owner closure is not retrospectively full field acceptance.
- Existing long-standing owner/CI/continuity security and resource-scope controls remain until the single Production release policy explicitly replaces runtime-specific Beta/Stable provisions with passing regression coverage.

## 6. OWNER testable completion criteria

- `https://inventory.supra.cc.cd` serves the same transaction records as the original live service, no second writable Worker/SQLite and no out-of-scope provisioning.
- Installed update converts existing `1291 Báo hàng Beta` in-place to `1291 Báo hàng`, app/version/notifications/download and Web/Agent UI no longer show Beta.
- Fresh Web, Android and Agent clients connect correctly; legacy clients can safely update through the legacy endpoint.
- No functional Beta→Stable promotion or parallel public production channel remains; old Stable resource is quarantined rather than silently deleted.
- CI+source/runtime/device/Owner receipts are accurately distinguished, and rollback procedure does not lose acknowledged business data.
