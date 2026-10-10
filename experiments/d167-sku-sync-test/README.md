# D167 — Standalone SKU Sync Test (Windows x64, Beta only)

**Status: code compiled / Windows CI offline tests; real Office WMS + Inventory end-to-end not yet field-proven.**

This EXE is **completely separate from Relay Agent v124**. It does not read the Agent's session, DPAPI files, process memory, WMS profile, or browser DevTools. The existing Confirm Picklist workflow, primary/standby lease, Firestore and PDA app remain unchanged. No existing service needs an update for the default login mode.

## Owner field test

1. Download the `D167-SKU-Sync-Test-Windows-x64-NOT-DEPLOYED` artifact from the successful GitHub Actions run on draft PR #549. Extract it, open `D167-SKU-Sync-Test.exe` on the authorized Windows workstation (requires .NET Framework 4.8 and Microsoft Edge).
2. Click **1. MỞ & ĐĂNG NHẬP SUPRA**, log in to the company's legitimate WMS page **in the separate Edge window**. Leave it open. No Supra password is entered or saved by the EXE.
3. Enter Inventory username and password (including current one-time credential for privileged accounts, where applicable), and click **2. ĐĂNG NHẬP INVENTORY**. This uses the existing Beta Service `/api/auth/login` **WEB channel** and receives a real Firebase ID token **in the test process only**. It does not use the main Agent's Firebase identity. An existing Web session on another device can cause `WEB_SESSION_CONFLICT`; it will not be replaced without explicitly selecting the checkbox. Do not select it if other Web work must remain active.
4. Click **3. ĐỒNG BỘ SKU**. The EXE will: extract allowlisted API request headers from its own browser traffic into RAM; create a per-request HMAC signature/nonce (per the provided VBA's algorithm), GET the sanctioned HY1 `exportBinStocks` endpoint, validate and save XLSX on Desktop, parse only `SKU` and `Tên sản phẩm`, preview every chunk of 1,000 SKU, then POST actual chunks to the current `/api/admin/skus/import` Beta Service route.
5. If server reports existing-name conflicts, the tester asks for direct approval using the **current Service contract** before any mutation. Otherwise it applies automatically. The test then reads back representative SKU/name pairs from `GET /api/skus` and prints `DONE` only if each chunk has a terminal imported receipt and readback agrees.

## Limits and evidence

- A Beta upload is **a real business data write**, even from an independent EXE. No stable endpoint, position, LTA/Shelving, stock quantity, or schedule is changed.
- WMS API export may be blocked by corporate proxy, session headers or vendor request changes. The EXE shows a specific safe status code and will not claim success in that case.
- The transient browser traffic observer only records a strict allowlist of HTTPS API request headers from `api-supra.winmart.vn`. It does not write, display or emit WMS secrets. Browser cookies follow Chromium's separate local profile security.
- Real WMS HTTP 200, returned XLSX, real Inventory Service import and subsequent catalog readback **cannot be proved by CI**. They require Owner field test using the authorized logged-in WMS/Inventory accounts.
- Firebase WEB login may conflict with an existing Web session. This test never forces session takeover without the owner's explicit checkbox.
- Field acceptance must also confirm zero disruption to primary/standby Confirm Picklist. Keep Agent v124 as-is.
- The provided VBA is reference material only. Never put VBA configuration, raw customer catalog or sensitive session/header values into the public repository.

## Code and build

- Project: `experiments/d167-sku-sync-test/D167SkuSyncTest.csproj`, .NET Framework 4.8 Windows Forms x64.
- GitHub Actions: `.github/workflows/verify-d167-sku-sync-test.yml`.
- Offline `--self-test`: test parsing Unicode, leading-zero SKU, dedupe and conflicting names using synthetic XLSX, **no live provider calls**.
- PR #549: draft and not merged. Builds upload the independent EXE as a GitHub Actions artifact. No update to Agent's release manifest or Beta Worker deployment is part of this code-only checkpoint.
