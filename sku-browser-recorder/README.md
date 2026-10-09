# D166 SKU Recorder — standalone Windows diagnostic POC

Status: **Owner-approved implementation scope, not field PASS**. This is a separate Windows x64 EXE; it does not modify Agent binaries, Provider bindings, Firebase/Cloudflare business requests, HA, ACK, or Stable.

## What this tool actually does

- Requires the Agent WebView2 Fixed browser to be **running on the same Windows user and computer**. Reads only the local process launch metadata to identify the already-active WebView2 runtime, user-data folder and compatible browser arguments; it does not inspect profile contents or extract browser credentials.
- Creates a separate visible window/control sharing the **existing WebView2 environment/profile**, where the website decides whether login remains valid. A new login may be required by Supra/Inventory.
- The operator manually visits Supra and Inventory Beta; uses normal web buttons to synchronize/export SKU, download a file, select the file and import it through the existing Inventory Beta UI. The recorder does **not** execute any of these operations automatically.
- Records safe timestamps in Vietnam time, UI actions **only from an approved alias allowlist**, sanitized navigation path fingerprints, download start/completed/failed with size/type, file selected for upload with size/type, popup and runtime failures.
- Does **not** capture typed text, cookies, bearer/session tokens, HTTP headers/requests/bodies, file names/paths, raw SKU or Picklist IDs, full URLs/query strings, free-form page text, downloaded file content, or the contents of file selections.
- On button **Xuất log ZIP**, creates \`SUPRA_SKU_Recorder_<run>.zip\` on Desktop containing JSONL and a manifest. No provider upload and no additional per-event writes to remote services.
- Download completion proves **local file download**, not that the Inventory service committed/imported the SKU. UI import clicks/selected file are **unverified intent** until later server evidence is available.

## Technical design and limitations

- WebView2 sharing requires compatible environment options and can fail with a profile/process-state error. The tool then **fails closed**; it does not copy the profile, fetch cookies or create a different login path.
- Joining an already-running browser process is not complete isolation: an Agent Confirm WebView2 can see additional WMS tabs at DevTools page-target discovery on reconnect. There is an existing first-match-by-host behavior in \`relay-agent/SupraConfirmBrowser.cs\`. **For this POC, never run on the active PRIMARY or while picklist confirmation is operational. Start only on a physically separate standby Agent in a maintenance/test window.** The standalone recorder source itself leaves Agent untouched; no guarantee is made that shared-process browser errors cannot affect Agent.
- The recorder closes when the tracked Agent WebView2 host exits. Do not treat the app as a replacement Agent browser.
- Navigation is limited to registered \`wms-supra.winmart.vn\`, \`auth-supra.winmart.vn\` and \`inventory-beta.supra.cc.cd\` main-frame and popup hosts. Third-party redirects may be blocked; additional hosts require explicit authority reconciliation, not wildcard allowlisting.
- POC is restricted to **manual diagnosis**. It is not daily SKU automation, WMS scraping, batch upload, login automation, background schedule, automated service sync or a new business transaction authority.
- Test on standby and confirm real WMS login, navigation/popup, manual download and manual Inventory Beta file-import event flow. If the website requires an out-of-scope host, stop and record an error; do not bypass.

## Acceptance and use

1. Agent WebView2 Fixed opens on a standby laptop; manually start the separate \`SUPRA.SKU.Recorder.exe\`.
2. Check that existing session can be used as normal; if prompted, login directly on authorized webpage, not through Agent inspection.
3. Click **Mở Supra**, perform SKU sync/export/download manually, then click **Inventory Beta**, choose the file and upload through the normal authorized Web UI.
4. Click **Xuất log ZIP**, review that it contains only safe aliases, timestamps, bytes and outcomes; send the ZIP for analysis.
5. Repeat failure cases: missing browser, duplicate Agent hosts, different browser runtime/profile options, WMS popup login, download canceled, file-change, host terminated.
6. Before any PRIMARY testing, verify Agent Confirm target selection and picklist/ACK/failover parity separately and obtain Owner field PASS. Stable remains untouched.

**CI**: \`.github/workflows/d166-sku-recorder.yml\` performs source privacy guard and \`dotnet publish\` as a self-contained single-file Windows EXE. A GitHub Actions artifact is generated on passing CI; a distinct prerelease asset is generated only from merged main changes. No claim of real-browser field PASS from compilation.
