# SUPRA Inventory Relay Test Agent — D075

Purpose: prove the Beta transport path **any Picker PDA → shared Firebase Realtime Database queue → real ADMIN Windows Agent → ACK → originating Picker** before any real WMS automation is built.

## Safety

- Runs as a normal Windows user; Administrator rights are not required.
- The POC does **not** open, search, click or mutate WMS.
- Agent login accepts only a real application account whose effective role and base role are both `ADMIN`.
- PICKER, REPORTER and ROOT accounts are rejected by the Agent.
- The typed ADMIN password is used only for login and is never saved.
- The Firebase refresh token is stored locally with Windows DPAPI `CurrentUser`.
- No token/password/session material is committed to this public repository or written to diagnostic logs.

## D075 shared queue

- Picker requests use `relay_poc/jobs/{request_id}`; Picker and Agent no longer need the same Firebase UID.
- The request carries Picker identity for correlation.
- The first valid ADMIN Agent ACK wins. A later Agent cannot overwrite the ACK.
- ACK records:
  - ADMIN application user id
  - Windows machine name
  - persistent local `agent_instance_id`
  - current network/SSID
  - receive/ACK timestamps
- This metadata is the audit basis for the future real order-confirmation workflow.

## Field test

1. Publish the D075 `firebase/database.rules.json` to the Beta Realtime Database.
2. Run the latest Relay Agent on a network that can reach `inventory-beta.supra.cc.cd`.
3. Sign in with a real **ADMIN** account. Do not use a Picker account.
4. Switch the laptop to `.Office@MSN`.
5. Click **Kiểm tra Office**. PASS means Google token refresh + authenticated shared RTDB collection read are working.
6. Keep **Nghe relay** active; the Agent may be minimized to tray.
7. On any Picker PDA, open **Xác nhận đơn**, enter any five test digits and press **GỬI TEST**.
8. Expected: PDA shows the receiving laptop, ADMIN user, network and end-to-end milliseconds.

A successful D075 POC proves transport/audit identity only. It does not approve WMS automation or the final <5 second business SLA.

## Diagnostics

A sanitized local run log is written under:

`%LOCALAPPDATA%\SUPRA Inventory\RelayPoc\Logs\`

Use **Mở log** to open the current file. Logs may include app build, SSID, active IPv4 interfaces, gateway/DNS, system proxy, safe endpoint path, HTTP status/timing, Firebase project audience, hashed Firebase UID fingerprint, ADMIN application user, machine/Agent instance, reconnect state and ACK timing.

Logs must never contain the typed password, raw Picklist suffix, bearer/ID/refresh token, API key, cookie, private key or URL auth/query credential.

## Automatic update

- Dedicated update channel: GitHub prereleases tagged `relay-agent-vN`.
- The Agent checks at startup and every four hours.
- A newer binary is downloaded only from the canonical public repository and must match its published SHA-256 file.
- If the current EXE directory is writable, the Agent closes, replaces the portable EXE and relaunches automatically.
- If GitHub is unreachable (for example on a restricted network), relay operation continues on the current version and the next scheduled/startup check retries.
- Agent prereleases are deliberately separate from Android Beta releases so Android `/releases/latest` continues to point to `beta-vcN`.


## D077 Office proxy HTTP response repair — 2026-09-19

Field log shows `.PDA@MSN` RTDB GET PASS and `.Office@MSN` Firebase refresh PASS, followed by `ObjectDisposedException` before the real RTDB/proxy HTTP status could be surfaced. Source review found `ToRelayHttpException()` disposed `HttpWebResponse` and then read `StatusCode`. D077 captures status/response diagnostics before disposal, preserves sanitized error reporting, bumps the portable Agent to `relay-agent-v3`, and leaves D075 shared ADMIN relay plus D076 deployed Rules unchanged. No APK/WMS change.

Current relay marker: `D077_OFFICE_PROXY_HTTP_RESPONSE_DISPOSAL_REPAIR_IN_PROGRESS__D076_RULES_PASS__NO_WMS_MUTATION`.


## D078 Office transport probes

Office field evidence shows Firebase Secure Token is reachable while the Wincommerce proxy blocks the RTDB `*.firebasedatabase.app` endpoint. Agent v4 adds read-only diagnostics before any replacement relay is selected.

Buttons:

- **Auth** — refreshes the Firebase ADMIN session against `securetoken.googleapis.com`.
- **RTDB** — tests the current shared RTDB queue endpoint.
- **Firestore** — tests `firestore.googleapis.com` with the current Firebase ADMIN ID token.
- **Apps Script** — tests both the Apps Script web-app host and Apps Script API host without creating or changing a script.
- **Sheets** — tests the Sheets API host without mutating a spreadsheet.
- **Drive** — tests the Drive API host without mutating Drive.
- **TEST TẤT CẢ** — runs the full matrix and writes one `PROBE SUMMARY` line.

Probe results distinguish Google/API reachability from `PROXY_BLOCK`. Corporate block HTML is summarized to category/rule markers rather than logged as a Firebase Rules error. No probe creates Google resources, confirms orders, accesses WMS, or bypasses company filtering.


## D080 — Supra WMS read-only session/connectivity POC

Trong lúc bài test PDA ↔ Agent trên mạng Office tạm hoãn, Agent v5 kiểm tra riêng đường **Agent ↔ Supra WMS/API**.

- Không cần F12 / Copy as cURL cho luồng chuẩn.
- **Mở WMS + lấy phiên** mở một cửa sổ Microsoft Edge riêng do Agent quản lý trên loopback DevTools `127.0.0.1`. Người dùng chỉ đăng nhập WMS nếu phiên trình duyệt yêu cầu.
- Agent chỉ quan sát request đến `api-supra.winmart.vn` trong cửa sổ đó, lấy các header phiên cần thiết vào RAM và không ghi giá trị session/header vào log, file hay GitHub.
- Profile Edge riêng được dùng để WMS có thể giữ trạng thái đăng nhập theo cơ chế trình duyệt; Agent không đọc/giải mã profile Edge/Chrome chính của người dùng.
- **TEST SUPRA** kiểm tra WMS UI và một signed GET read-only tới `/sft3-hy1/api/v1/warehouse/zones`.
- Route thử theo thứ tự: Windows/system proxy → environment proxy → direct → corporate proxy fallback; không bypass/chọc qua corporate filtering.
- HTTP response thật như 401/403 được phân loại thành session/forbidden thay vì đổi route để che lỗi.
- Phiên API đã capture chỉ sống trong RAM của Agent. Nếu API trả session-expired, Agent tự mở lại Edge và thử capture mới một lần.
- D080 tuyệt đối chưa tra cứu Picklist, chưa xác nhận đơn và chưa gọi API mutation WMS.
- Stable không thay đổi.

## D081 — login wait, browser fallback, taskbar monitor

- Fixes the v5 first-login failure where a short `ReceiveAsync` cancellation could abort the DevTools WebSocket before the operator finished WMS login.
- Capture now waits against the whole login window (up to five minutes) instead of cancelling every five seconds.
- Browser order: Microsoft Edge → Google Chrome. Each uses an Agent-owned dedicated profile; neither means a clear error.
- WMS credentials stay on the official WMS browser page. Agent does not add or store WMS username/password.
- SUPRA Inventory ADMIN login stays inside the Agent over the existing HTTPS/Firebase path; the password box is cleared immediately and the persistent session remains DPAPI-protected.
- The system-tray icon now provides a local-only machine monitor for CPU %, CPU MHz and RAM used/total, refreshed about every two seconds. This consumes no project-provider quota.
- The tray status provider is intended to later project operational counters such as confirmed Picklists and online users.
- No WMS mutation and no Stable change.

## D082 — persistent overlay + read-only Picklist lookup

- Replaces hover-only machine visibility with a small topmost overlay showing local CPU %, current/approximate MHz and RAM used/total.
- Tray menu can show/hide the overlay, select opacity, unlock it for dragging and lock it again. Locked mode is click-through/no-activate so pointer input goes to the underlying application.
- Overlay position/opacity/visible/locked state is local non-secret configuration only.
- A valid HY1 WMS session disables `Mở WMS + lấy phiên` to prevent repeated login. A remote PDA request never auto-opens the WMS browser.
- The PDA five-digit request now triggers only the signed read-only `GET /sft3-hy1/api/v1/autopp/pickListConfirms`. Agent compares exact trailing five digits in recognized Picklist identity fields and returns `FOUND` / `NOT_FOUND` or an explicit fail-closed error.
- Unknown response schema is `SCHEMA_UNSUPPORTED`; Agent logs only bounded field names/classifications/timing for adaptation, not response values.
- The WMS confirm page is recorded only as a reference. No confirm/click and no WMS POST/PUT/PATCH/DELETE exists in D082.
- Existing Beta RTDB home relay stays unchanged; D078 Office transport remains pending.
- Stable is untouched.

## D083 — v8 startup fail-safe repair

- Repairs the v7 field regression where the EXE could terminate before showing any UI.
- Main Agent form now starts first; the persistent overlay is lazy-initialized only after the main form is shown.
- Overlay initialization/PInvoke/window-style failure is isolated: Agent continues without the overlay and records a sanitized local diagnostic.
- Removes overlay `RecreateHandle()` from the initial show/lock path.
- Adds top-level startup crash logging plus a visible error dialog for normal launches.
- CI now executes the built EXE with `--startup-smoke` and fails the Agent release if it cannot start and exit cleanly within 15 seconds.
- D082 read-only Picklist behavior is unchanged. No WMS mutation. Stable untouched.

## D084 — overlay settings + all-date PickListCode scan

- Adds an explicit `Cài đặt bảng nổi` dialog in the Agent and tray.
- Overlay settings: opacity and lock state. Unlocked overlay can be dragged; locked overlay applies Windows click-through so underlying applications receive mouse input.
- Overlay settings persist locally for the current Windows user.
- Picklist lookup no longer filters by date or PDA suffix in WMS: `FromDate`, `ToDate`, and `Content` are empty.
- Requests 100 records per page and continues paging until a match or truthful exhaustion.
- Only exact `PickListCode` is authoritative; expected value shape is `PL` + digits and the Agent compares exactly the final five digits with PDA input.
- Unsupported schema, malformed PickListCode values, or stalled pagination fail closed.
- Android relay wait is extended to 120 seconds to allow the all-date paged scan.
- WMS access remains signed read-only GET only. No confirmation or mutation.

## D085 — Agent v10 source candidate

D085 keeps the currently deployed Beta RTDB relay only as a temporary carrier; final PDA ↔ Agent transport selection remains pending D078 company-network evidence.

Agent v10 source adds:
- one sticky WMS-ready ACTIVE Agent with 3-second heartbeat and 10-second standby failover;
- pending/switching job takeover after failover;
- all-date D084 PickListCode preload into RAM, 10-second fresh-miss guard and single-flight refresh;
- account-scoped anti-spam: 3 final NOT_FOUND in 60s → 5m, then 30m, then 60m locks; 24h without a new lock resets escalation;
- WMS dedicated-browser-profile reuse on startup, with captured request/session values held only in RAM;
- per-user Windows auto-start through HKCU Run; no elevation required;
- Owner-proven v8 overlay interaction engine, while `Cài đặt bảng nổi` remains accessible on the main Agent window.

Standby Agents do not process WMS jobs. Remote PDA requests never open WMS login. WMS access remains signed GET-only; confirmation/mutation is not implemented or authorized.

## D087 — Agent v12 session-first professional shell

Agent v12 keeps D085 business/HA behavior and changes the Windows utility mechanics:

- startup reads a local DPAPI-`CurrentUser` encrypted WMS session file first, validates it read-only and preloads the all-date Picklist cache; valid state does not reopen the browser;
- an invalid/missing saved session is cleared before the local Agent-owned WMS browser is opened to reacquire an authorized session;
- successful preload/real refresh renews the encrypted session file; raw WMS session values never enter logs/GitHub/RTDB;
- main UI is split into `Tổng quan` and `Cài đặt`; ADMIN login, transport diagnostics, overlay settings and logs are under settings;
- locked overlay uses Windows extended click-through behavior so the application below receives pointer input;
- the title-bar close control is removed. Deliberate shutdown requires the current ADMIN's local protected password verifier;
- a low-CPU watchdog restarts the main Agent after an unexpected exit. This is best-effort user-mode persistence, not a claim that Task Manager cannot kill both processes;
- continuous 4-second SSID/`netsh` polling is removed; local status refresh is reduced while D085's required 3-second leader heartbeat/10-second failover remains.

WMS access is still signed read-only GET only. Transport selection is still pending D078 Office evidence. Stable remains untouched.



## D087 field changes

- Local logs are split into `pda-agent-audit-*.log` (user/device/Picklist/relay audit) and `technical-ai-*.log` (errors/lifecycle/network/runtime). Both pass the same secret redaction layer; passwords, tokens, cookies, WMS session/signature material and other credentials are forbidden.
- The main window has no close action but provides an explicit minimize-to-taskbar control. Protected tray shutdown remains unchanged.
- Overlay is retryable after transient initialization failure and renders two rows: local laptop metrics plus Agent status.
- Total online Agent count uses only minimal Beta RTDB presence (30s write, 60s read, 90s freshness). Per-machine APK/request and response counters are memory-only and are never globally synchronized.
- Transport remains the temporary RTDB carrier pending D078 physical Office evidence. WMS remains read-only; Stable is untouched.

## D088 — Agent v14 unified identity, tray lifecycle and editable overlay

Canonical Windows product/executable:
- **Agent Auto Confirm Pick Pack**
- **Agent Auto Confirm Pick Pack.exe**
- release channel: `relay-agent-v14`

D088 keeps all D085–D087 read-only/HA/security behavior and changes local presentation/runtime details:
- Agent login explicitly declares the `AGENT` auth channel; it remains real base-role ADMIN only and is intentionally independent from the one-interactive Web/Android session generation.
- Manual minimize hides the main window from the taskbar and leaves Agent in System Tray. Double-click/`Mở Agent` restores it.
- The common D088 icon motif is embedded into the executable and reused for tray identity.
- Locked overlay remains true click-through. When unlocked it can be dragged and resized from edges/corners.
- Overlay settings persist width, height, opacity, background color, text color, visibility, lock and position. Windows ColorDialog exposes the full color picker.
- GitHub normalizes spaces in release asset filenames to dots. The Windows assembly/product remains `Agent Auto Confirm Pick Pack.exe`; the release/updater asset contract is `Agent.Auto.Confirm.Pick.Pack.exe`. Transitional v13 exposed the mismatch before field acceptance, so v14 is the final D088 release target. The old `SUPRA-Inventory-Relay-Test.exe` asset remains a compatibility alias for pre-D088 clients.

Transport is still the current temporary Beta RTDB pending D078 evidence. WMS remains signed read-only GET-only; confirmation/mutation is not authorized. Stable remains untouched.

## D089 — Agent v15 field-review repair

Release target: `relay-agent-v15`.

- Windows identity uses the exact committed Owner-selected icon #4 asset; EXE, taskbar and System Tray derive from the same source image.
- Normal startup is single-instance per Windows user session. A duplicate EXE launch signals the existing process to restore/activate and exits without creating a second tray, overlay or worker.
- `Cài đặt bảng nổi` adds a master Overlay on/off switch and persisted granular checklists for Laptop CPU/RAM/Disk/network/Internet/GPU and Agent online/state/local APK/local responses/Supra readiness.
- Resize, opacity, full background/text colors and locked true click-through remain.
- D085 sticky Agent HA/cache/anti-spam, D086 DPAPI WMS file-first session/protected exit/watchdog and D087 split logs/bounded presence remain unchanged.
- D078 final transport remains pending. WMS remains signed GET-only. Stable remains OWNER-GATED.

## D091 — Firestore end-to-end Office field candidate

Agent v16 changes the confirmation relay **field-test carrier only** from RTDB to Cloud Firestore REST.

- The D091 listener polls `relay_poc_jobs` every 3 seconds while active.
- It authenticates with the restored real ADMIN Firebase ID token and Firestore Security Rules.
- A valid `ANDROID_D091 / PENDING` document receives an `ACK / TRANSPORT_ONLY` response containing bounded Agent identity/network metadata.
- This proves only PDA ↔ Firestore ↔ Office Agent ↔ Firestore ↔ PDA. It does not query or mutate WMS.
- No RTDB fallback is used for the D091 field PASS.
- D085 multi-Agent election/failover is intentionally deferred until this transport actually passes on Office; final Firestore HA must be redesigned to fit quota rather than writing a 3-second heartbeat per Agent.
- If the authenticated round trip is blocked on Office, the next candidate is Apps Script under D091/D090.
