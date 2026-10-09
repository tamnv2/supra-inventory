# D166 — Launcher logs: InventoryCore buffer and Drive OAuth diagnostic (2026-10-09)

## Evidence and uncertainty
- Launcher 0.3.25 is reported by the Beta PDA registry for 49 of 51 devices. Registration in Sheets is not proof that a scheduled log POST reached InventoryCore.
- The existing PDA Management Drive destination was empty in the owner-account Drive inspection. This does **not** prove whether uploads stopped at the PDA, Worker ingress, InventoryCore buffer, or Drive archive.
- The configured destination is the existing scoped Launcher folder under the existing Beta Inventory Logs tree. **No folders are created, moved, deleted or reconfigured by this change.**
- Direct Cloudflare InventoryCore read and Worker Google OAuth folder-access check could not be performed from the assistant's current external connectors. Live outcome stays **UNVERIFIED** until an authenticated ROOT checks the deployed Beta Web.

## Owner-authorized approach
The owner approved investigation and a safe fix of Launcher log delivery without fleet rollout. This D166 change adds an explicit manual, ROOT-only diagnostic panel on Beta Web **Nhật ký → Log Android → Kiểm tra service**.

### Data collected on a single click
1. An aggregate 7-day query against **existing InventoryCore SQLite runtime_log_buffer** counts Launcher bundles received, Drive-synced, pending and failed. Only timestamps and sanitized categorical recent Drive errors (max 30 records) return; **never device identifiers, payloads, tokens, log filenames or Drive file IDs**.
2. A one-off Worker Google OAuth token refresh and Drive `files.get` metadata request for the **existing** Launcher folder. The returned result is `ACCESSIBLE_WRITABLE`, `ACCESSIBLE_WRITE_NOT_CONFIRMED`, `DRIVE_FOLDER_HTTP_<status>`, `GOOGLE_OAUTH_UNAVAILABLE`, etc. No folder list, creation, write, retry loop or new timer.
3. The already-intended Launcher logical Vietnam date validation in initial archive and delayed buffer drain is corrected to `/^\d{4}-\d{2}-\d{2}$/`; this does not change the repository's separate D166 duplicate-day-folder root-cause work.

### Interpretations (do not claim field root cause without evidence)
- `received=0`: server buffer has not recorded a Launcher log within 7 days; investigate registered DeviceKey, PDA schedules/network and ingress.
- `received>0,pending_drive>0`: Core has logs; classify OAuth/folder vs transient Drive errors from sampled failure classes.
- `drive_folder_check=DRIVE_FOLDER_HTTP_403/404`: OAuth cannot access configured folder; requires owner-controlled grant/folder authorization correction, **not** a mass PDA update.
- `received>0,drive_synced>0` but folder empty: investigate actual destination, identity and date children before any delete/move/release.
- `ACCESSIBLE_WRITABLE` confirms metadata visibility and folder add capability, not successful multipart archive.
- Only a real Drive artifact and corresponding Core `DRIVE_SYNCED` and actual PDA receipt close the end-to-end field gate.

## Risk, scope and rollback
- Scope: Beta Inventory Worker, InventoryCore and Beta Web ROOT log view. Launcher APK, Agent, WMS, Firestore/RTDB, update targeting and Stable unchanged.
- Quota: one bounded Core SQL aggregate + max 30 recent errors + one OAuth token refresh + one Drive metadata GET **per explicit click**; no background polling, no new writes.
- Privacy: log filenames, raw IDs, serialized log contents and OAuth error messages are not returned to browser.
- Rollback: revert the D166 backend/Web commit(s); existing Core data and Drive files unchanged.
- Release gate: GitHub CI + Beta deploy technically PASS before owner Web click; no claim of ROOT field PASS without owner-authenticated runtime evidence.


## 09/10/2026 — Owner approved remote OAuth folder repair

- ROOT runtime evidence at 17:49 VN: last-seven-day Launcher buffer received=0, Drive worker OAuth check for old manually-created `PDA Management` folder returned HTTP 404.
- Two separate faults: no Launcher POST persisted into InventoryCore, and the previous Drive folder is inaccessible to the Worker OAuth client.
- The Launcher v0.3.25 manifest does not explicitly declare `android.permission.ACCESS_NETWORK_STATE`, yet preflight calls `ConnectivityManager.getActiveNetwork()` and catches a thrown permission exception as `networkUsable=false`. APK-side repair requires an Android APK update and user/device management intervention; changing backend alone cannot grant this permission to an already-installed APK.
- Owner approved remote Worker-side repair with a new OAuth-created Drive folder; leave the old folder and all earlier data untouched. The existing Beta 5-minute cron performs bounded one-time provisioning; a single SQLite authority/lease records the canonical folder ID; archived files and pending retries select it. Before adopting the folder Worker writes a clearly tagged `_SERVICE_ARCHIVE_CHECK.json` and independently reads it back. This is **not an actual PDA log**.
- ROOT read-only Web diagnostic reports the managed folder status and verified link; full end-to-end status is pending an actual PDA Launcher POST, InventoryCore acknowledgement and real Launcher file in Drive. No new automatic PDA push/install capability is claimed.

## 09/10/2026 — Remote-only pre-21:45 observation

Owner requests another remote-only attempt, no Launcher v0.3.26 rollout before the 21:15–21:45 scheduled window, then will report actual data after 22:00.

- Audited v0.3.25: Launcher `networkUsable()` returns false when Android throws for missing `ACCESS_NETWORK_STATE` in AndroidManifest, blocking the log POST before service. A Worker fix cannot add Android runtime/install permissions; this is a probable client blocker, not a demonstrated device stack trace.
- OAuth repair has a **real** Drive folder and a separately labelled `_SERVICE_ARCHIVE_CHECK.json` file; this proves service→Drive only, not PDA→service. The old folder is preserved.
- Add an ingress POST response counter in existing InventoryCore SQLite, partitioned by Vietnam date and HTTP status with no device identifiers or request content. One small increment occurs only if a real POST reaches the Launcher route; GET/manual ROOT checks perform only a bounded aggregate read. This is a temporary diagnostic tradeoff during the incident; do not add polling to PDA.
- Web ROOT `Nhật ký → Log Android → Kiểm tra service` reports both *HTTP POST attempts* and *valid buffered logs*, with a monitoring start time. The counter starts with this deployment, and **does not measure historical attempts**.
- Interpret 0 POST after the 21:45 window as no requests observed **at this route after deployment**, not proof that PDA was online or that a different route/Cloudflare edge never saw traffic.
- If HTTP POST > 0 but buffered = 0, prioritize rejection HTTP statuses and registration/header/body. If 200/202 > 0 but zero Launcher buffered entries, investigate buffer query filename filters and archiving.
- Owner will report at/after 22:00. Any v0.3.26 signed release is separately gated by owner choosing ALL/MODEL/DEVICE and Android installation; v0.3.26 should be full root-cause-fixed rather than an experimental fleet rollout.
