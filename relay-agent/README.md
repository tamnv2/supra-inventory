# SUPRA Inventory Relay Test Agent — D073

Purpose: prove the Beta transport path **PDA → Firebase Realtime Database → Windows laptop → ACK → PDA** before any real WMS automation is built.

## Safety

- Runs as a normal Windows user; Administrator rights are not required.
- The POC does **not** open, search, click or mutate WMS.
- The password is used only for initial application login and is never saved.
- The Firebase refresh token is stored locally with Windows DPAPI `CurrentUser`.
- No token/password/session material is committed to this public repository.

## Field test

1. Create/publish the scoped Beta RTDB and repository Rules first.
2. On a network that reaches the Beta Worker, run the EXE and enter the same Beta Picker account used by the test PDA. Click **Ghép Agent**.
3. Switch the laptop to `.Office@MSN`.
4. Click **Kiểm tra Office**. PASS means the Agent can refresh its Firebase session directly through Google and open the RTDB stream.
5. Keep **Nghe relay** active; the Agent may be minimized to tray.
6. On the signed Beta APK, Picker → **Xác nhận lấy hàng**, enter any five test digits and press **GỬI TEST**.
7. Expected: Agent logs the request and returns ACK; APK shows laptop name, laptop SSID and end-to-end milliseconds.

A successful D073 POC proves transport only. It does not approve WMS automation or the final <5 second business SLA.


## D074 field diagnostics

The Agent now separates network transport from RTDB authorization:

- `Google refresh PASS` proves the Office network can reach Google Secure Token.
- `OFFICE PASS / Google + RTDB` proves authenticated RTDB read access.
- `RTDB 403 / Rules` means HTTPS reached Firebase but Firebase Rules/auth/path denied access; this is not reported as a generic network failure.
- The RTDB path is derived from Firebase ID-token `sub`, never from the application username/user_id.

A sanitized local run log is written under:

`%LOCALAPPDATA%\SUPRA Inventory\RelayPoc\Logs\`

Use **Mở log** to open the current file. The log records runtime version, SSID, active IPv4 interfaces, gateway/DNS, system proxy, safe endpoint path, HTTP status/timing, Firebase project audience, hashed UID fingerprint, reconnect state and ACK timing. It must never contain the typed password, raw Picklist suffix, bearer/ID/refresh token, API key, cookie, private key or URL auth/query credential.
