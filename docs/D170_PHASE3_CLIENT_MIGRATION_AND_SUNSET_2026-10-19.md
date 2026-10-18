# D170 Phase3 — Single official hostname, client migration and old-host sunset (2026-10-19)

**Owner command:** Remove the user-facing and ultimately the Cloudflare Custom Domain `inventory-beta.supra.cc.cd`; use only `inventory.supra.cc.cd`. Owner explicitly permits Web, signed Android and Windows Agent updates. This belongs to active D170, not a new Dxxx.

## Verified accepted runtime
- Official and legacy hostnames serve the **same existing Worker and InventoryCore SQLite**: main `d6833675`, GitHub Worker run `39154128973`, both `/health` source/storage checks passed.
- Technical Cloudflare Worker, Firebase, Android `applicationId`/signer and update tag names must remain unchanged. The old Stable Worker is not the authoritative service.
- Android vc113 and Windows Agent v138 currently embed the legacy hostname for their API and **own trusted updater bootstrap**. Both reject unapproved redirect origins. Therefore removing the old hostname before they update would strand installed clients.

## Impact, contracts and tests
| Requirement | Components | Invariants/risks | Evidence gate |
| --- | --- | --- | --- |
| Official HTTPS API and release URLs | Android build config / signed APK vc114 | Monotonic versionCode; existing package, signer and `beta-vcN` tag accepted; in-place update and old-manifest reachability | Android CI, exact signer/manifest SHA and installed-vc field check |
| Official HTTPS API and updater URLs | Agent v139 config/updater, browser bundle | No WMS confirmation/Firestore/HA transport change; validator checks exact configured host; old v138 can still fetch upgrade | Agent .NET CI; protected release and `inventory-channel`; PRIMARY/standby field check |
| Single Web frontend and Worker | Existing Worker + InventoryCore SQLite | Same transaction authority, same origin API/WebSocket; old host remains compatible in interim; no second DB or duplicated polling | Dual host/source/storage/health and auth API CI |
| Google Drive/Gmail OAuth callback | Worker route + protected Google OAuth configuration | State cookie must be minted on Google-registered callback origin; old endpoint needed until Google registration+runtime variable updated; no tokens in repo | Both host start/callback security tests; provider authorized redirect evidence; real OAuth Owner sign-in |
| Single official release | GitHub protected workflows and release gate | No unrestricted deployment; GitHub technical `beta` Environment may retain secret names; explicitly no Stable deploy | Branch→PR→authority/continuity/product PASS→guarded main release receipts |
| Retire old host | Cloudflare Custom Domain + Worker routes, DNS/OAuth/client fleet | **P0** older Android/Agent cannot self-update after old host removal; verify install and OAuth convergence first; no database damage | Fleet migrated or explicit Owner acceptance of affected stale clients + no-old-host dependency proof; exact scoped provider delete and rollback |

## Strategy and decisions
1. **Approved source/release tranche (Phase3A):** New Android and Agent binaries use official hostname for both business API and trusted update manifests; signed app identity and release channels unchanged. Google OAuth start selects only the fixed configured callback hostname and preserves CSRF state and current legacy callback until the Google Cloud OAuth client is updated. No old-host deletion in Phase3A. Run normal/denied/redirect/mismatch/HA/ACK tests.
2. **OAuth/provider tranche (Phase3B):** Register `https://inventory.supra.cc.cd/api/oauth/google/callback` in existing Google OAuth client, preserve the old callback during validation, then change only existing protected `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` variable to the official URL. Never expose Client Secret/refresh tokens. Cloudflare Worker re-deploy and verify official-origin OAuth, then confirm no callback uses old host. If account write tools are unavailable, Owner performs the shortest Google Cloud Console change; this is a real Owner-only blocker.
3. **Fleet transition:** Old domain remains reachable while **all supported installed** PDA/Agent clients upgrade from old signed channels. Publish and verify official-host APK and EXE and browser bundle update; prove real device/API/OTA and Web auth/notifications/Worker SQL history. No invisible install or field PASS invented.
4. **Final sunset (Phase3C):** Only after verified fleet+OAuth no-longer-dependent, remove legacy hostname from Worker `wrangler` config and the exact registered Cloudflare Workers Custom Domain binding (not DNS zone, Worker or DO), verify official only. Guard rollback reattachment with the same Worker; never roll back SQLite transactions.

## Negative cases
- Old Android updater does **not** trust redirected manifests; 301/302 from old to new is not a safe removal strategy.
- Old Agent updater similarly hardcodes legacy hostname, even if the browser/Web UI already uses official hostname.
- An unregistered Google OAuth redirect causes `redirect_uri_mismatch`; switching early would break refresh grant.
- Office network reachability, Firestore WMS ACK and PRIMARY failover are independent of Cloudflare domain identity; maintain old protection until physical tests.
- No new Worker, Firebase project, Durable Object class, namespace, SQLite database, signer or package ID; no cost saving is assumed from changing the hostname.

## Phase3A release status
**SOURCE IN PROGRESS, NOT RELEASED** until passing source CI, exact reviewed D170 Phase3 authorization, merge and main Worker/Agent/Android release. Phase3B/C and FIELD/OWNER PASS remain blocked by real OAuth and fleet evidence.
