# D173-E196 — Agent Web session reset, visual diagnostics, remote command receipt, UI label and bounded performance

Date: 2026-11-11. Owner requested Agent-only source changes, not an explicit Production release or Stable promotion. Working branch: `fix/d173-e196-agent-web-session-diagnostics-20261111`, based on current `main` at creation. Signed Agent188 remains the deployed reference; FIELD Web blank is a known failure.

## Owner scope

1. Place a **Xoá phiên** button in the same Agent Web toolbar row as **Bảo vệ Web** / **Giám sát Web**, with a destructive confirmation dialog. Reset **only the Agent-owned WebView2 WMS browser profile**, then reopen WMS login in the embedded Agent tab. Never delete Firebase/Agent session, HA identity, runtime binary, other data under ConfirmBrowser or any desktop Chrome/Edge profile.
2. Add privacy-safe in-field diagnostics to distinguish actual blank pixels from DOM/CDP-ready flags, effective tab visibility, parent HWND, viewport/DPI and skipped/redraw attempts. Avoid sensitive URLs/screenshots, cookies, credentials, file uploads or new provider requests.
3. Standardize UI label to **Chọn Agent chính**; preserve primary-election authority and CAS.
4. Investigate failed **Kích Agent** end-to-end. Existing UI sends `/api/agent/remote-control/issue`, Worker stores short-lived Core command and publishes to Firestore `agent_sync.remote_agent_commands_json`, Agent listener invokes `/claim` before logout/exit. No successful physical kick receipt exists in reviewed VPS/Admin logs. Do not claim a causal fix without a reproduced failure and server/receiver evidence; at minimum add bounded, non-sensitive stage and error-category logging.
5. Improve long-running Agent UI performance **only at measured hot paths**; no speculative global refactor or business behavior changes. Baseline: v188 native source CI 43044129004, in-field visual failure; runtime UI frame-time and resource deltas unmeasured.

## Guards

- A browser reset must be rejected while an automatic/manual Confirm, SKU operation, session validation, storage migration, or other user-sensitive WMS task is in flight. Suspend new Confirm work before stopping Host; reject if a task enters during transition.
- Do not remove a profile while its Host process remains alive or if its location is a reparse point. Delete only exact `AgentBrowserStorage.CurrentRoot/webview2-fixed-profile`, with confirmation and an additional current-Agent authentication proof if required by existing control conventions. Do not touch the shared Firebase business user or runtime bundle.
- All visual diagnostics are local, bounded and non-reversible (e.g., pixel class counts only), no images/personal information in public repo/log.
- No Worker/Web/Android/Firebase/D172/Stable source changes or provider deployment; Agent + owned Host diagnostic source if the release gate later explicitly includes it.
- Before status becomes CODE PASS require regression reproduction + source/static tests, Windows x64 native build, affected-role/Confirm guard tests, D172 isolation. CI/RELEASE/FIELD/OWNER remain separate.

## Status

Owner requirement and code-only planning recorded. Deployment authorization not inferred; no Production OTA, Worker, D172 or Stable action. FIELD/OWNER PASS false.

## Owner production direction — 12/11/2026 (supersedes code-only release hold)

Owner now explicitly orders **test, finish code and deploy** this E196 Agent scope. Current live protected PR is #926. Earlier E196 exact SHA `914c11cdd25af580e3b73787250631168ecde94e`, GitHub Actions run `43063848369`, has source and Windows-native SUCCESS; these results do **not** cover new version pin/release workflow commits.

- Owner-authorized candidate: **Agent189-only signed OTA** after new PR-native/authority/D172 CI PASS, protected merge with `D173-E196_AGENT189_ONLY_RELEASE:`, tag/OTA checksum readback. Source pin `eb5a6be9447f9c26a19f5222c04f9d63fe6746bf`.
- **Host14 remains published and unchanged** for compatibility with deployed Agent188; E196 Host callback code is source/native tested but not deployed to the Host14 channel. It must be treated as `HOST_STATUS_NOT_IMPLEMENTED` in field, not as paint proof. A Host15 repackaging without a compatible OTA transition would risk breaking installed Agent188.
- No Worker, Web, Android, Firebase, D172, Stable or provider mutation. WMS browser reset still requires explicit confirmation, Agent password and idle fences.
- Existing signed `relay-agent-v188` must remain immutable for rollback. Production status **NOT RELEASED** until GitHub tag, inventory-channel EXE+manifest SHA and Host14 manifest are read back. Manual three-Agent visual/Confirm/remote-kick tests and Owner PASS remain PENDING.
- This instruction is an **Agent-only staged release** of existing approved E196 behavior; neither the Web white-screen root cause nor physical remote kick is claimed fixed by source CI.
