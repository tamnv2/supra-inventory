# D173-E150 — Agent170 + Host13 signed OTA technical release receipt (2026-11-07 VN)

## Owner approval and boundaries
- Owner explicitly requested fix/release Agent170 after field failures on Agent169: no separate WMS window, restore Agent+Web tab on session expiry, share "Hoạt động cuối" across PRIMARY/followers and refresh, durable handoff, Fire under the Owner ceiling of **40,000 reads / 16,000 writes per provider quota day**.
- Existing D173 scope only: relay-agent Windows client, owned WebView2 Host x64, existing scoped Firestore `relay_poc_coordination/agent_sync` document.
- **No** Web, Android/PDA, Cloudflare Worker, Firebase Rules, Agent Gateway, D172 OBPP mutation, Stable release, or new provider resources.

## Exact source CI
- PR: https://github.com/tamnv2/supra-inventory/pull/855 — merged onto protected `main`.
- Verified protected source CI pin: `6a8f9c41b78baaf5e9a8c1f1f8c049f13701f6c3`.
- 39 workflows completed: **38 success, 1 skipped** (E140 out-of-scope), **0 failed**.
- E149 Agent170 WinForms native + Host13 compile + E103/E148/Browser and D172 regressions: https://github.com/tamnv2/supra-inventory/actions/runs/42337511634 (success).
- Main protected release commit: `19ad1fd5785ad1cef6f6891543d70439139c3c19`; `git log` release marker `D173-E150_AGENT170_ONLY_RELEASE:` verified by the signed Agent gate.

## GitHub production channel readback
- Release workflow: https://github.com/tamnv2/supra-inventory/actions/runs/42338034268 — **SUCCESS**.
- Tag: `relay-agent-v170` -> exact main release commit `19ad1fd5785ad1cef6f6891543d70439139c3c19`.
- Release: https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v170.
- Published Agent EXE SHA-256: `0307a961626ccc9e1bfba5dd8e2a08185db591c7db13c06f5c204730fd62749d`.
- Asset `Agent.Auto.Confirm.Pick.Pack.exe` was 8,863,232 bytes; the immutable tag release and mutable `inventory-channel` alias both report the **same** SHA-256. Companion .sha256 assets published.
- `inventory-channel/agent-latest.json` was updated 2026-11-07 04:23:25 UTC; channel EXE updated 04:23:26 UTC. Run log states `Updated stable Agent runtime channel inventory-channel -> relay-agent-v170`. This is **the official Agent distribution channel**, not permission for separately protected Stable deployment.
- Host13 WebView2 Fixed Runtime: package version `157.0.4341.42`, x64, size **321,605,288 bytes**, SHA-256 `36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694`.
- Host13 channel browser manifest and ZIP were refreshed 2026-11-07 04:23 UTC. Release workflow reports `Published Agent-owned Fixed WebView2 ... host_build=13 host_arch=x64` and `E150_PUBLISHED_HOST13_VERIFIED_BEFORE_AGENT170`.
- Beta Worker `deploy-beta` and Firebase Rules `deploy-beta-firestore` were **SKIPPED**, as required for Agent-only. Worker/SQLite existing health passed; Gateway and Rules re-used unchanged. D172 remains independently PENDING/HOLD.

## Functionality implemented, not field-verified
- Host13 starts off desktop without standalone taskbar window; Agent embeds it in Web tab; expired WMS session restores Agent and protected tab entry flow.
- `agent_sync` listener fans out bounded latest-activity snapshots (64 actor keys), CAS merging terminal/generation ordering; manual refresh reads the same shared source directly.
- Local atomic outbox/retry persists latest activity if temporary disconnect/process restart; irrecoverable local disk loss cannot be rebuilt, so a universal "no missed event" statement would be false.
- Optional activity patches capped at **1,500 shared/day by Firestore Pacific quota-day counter**; 10-Agent planning bound ~15k extra reads and 1.5k extra writes/day. Existing baseline is Owner conservative 20k reads/10k writes; **this estimate is not a provider-side hard cap** on whole-project read/write usage, and does not prove the global 80% limit in operation. Reconnect, peak activity and other users still consume the shared free tier.
- Firestore screenshot last seven days: 117k reads / 65k writes / 6.9k deletes and 61k Rules-denied operations; denial spike needs separate attribution and cannot be assumed billed.
- Windows multi-Agent live tests (real login expiry, 100× hide/restore/Host restart, simultaneous PRIMARY changes and provider usage monitoring after rollout) **FIELD PENDING**; Owner has not accepted those checks, **OWNER PASS PENDING**.

## Gate classification
- **CODE PASS**, **CI PASS**, **RELEASE PASS** verified by exact source, signed OTA tag, channel SHA, Host13 manifest/package and release workflow.
- **FIELD PENDING**, **OWNER PASS PENDING**. No production/field metrics invented. Any new bugs must be repaired under a new scoped Agent update; protected Stable and D172 remain unchanged.
