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
