# D173-E054 — Agent148 signed OTA technical release receipt (26/10/2026)

## Exact scope and source
- Owner directed Agent147 field repair (overtime overlap, Agent/online-roster flicker). Implemented via PR [#751](https://github.com/tamnv2/supra-inventory/pull/751), merged with approved title `D173-E053_AGENT_ONLY_RELEASE:` to main `e726f5be41c6ca240be194a01e4ef1ef8d9d0b81`.
- Source pin `bed8c2035ec68ec5771dff222ca968ab18e1fd02`: 30/30 source PR CI SUCCESS. Final source+receipt PR head `f60a6cffd8cbf47efd03c793666bf493acd137cf`: 30/30 CI SUCCESS.
- Agent Windows signed workflow [run 40243512599](https://github.com/tamnv2/supra-inventory/actions/runs/40243512599) completed SUCCESS at merge SHA `e726f5be`.
- Signed [release relay-agent-v148](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v148) published (UTC 2026-10-25 23:12:16; VN 2026-10-26 06:12:16).
- Existing `inventory-channel` Agent EXE and `agent-latest.json` replaced 2026-10-26 06:12 VN. Workflow explicitly logs `Updated stable Agent runtime channel inventory-channel -> relay-agent-v148` (the channel name is a distribution label, not permission to deploy historical Stable Worker).
- GitHub verified release asset `Agent.Auto.Confirm.Pick.Pack.exe` is **8,687,616 bytes**, SHA-256 `8fa3524edc7ecf0a4f6199d113119e16e3746b7a424fce6c4c8f40c0d28c264b`. The `inventory-channel` EXE asset reports identical SHA-256.
- Agent runtime build remains v148, browser bundle 156.0.4314.42 reused, no new WebView2 bundle release.
- Only Agent/runtime distribution changed; Worker/DO, Web, Android, Firestore, Gateway, D172 app/backend/Sheet, and historical Stable Worker are out of mutation scope.

## Acceptance boundaries
- `CODE = PASS`, `SOURCE CI = 30/30 PASS`, `SIGNED RELEASE + OTA CHANNEL = PASS`.
- `FIELD = PENDING`: no remote Windows visual inspection; must confirm overtime ON/OFF/PRIMARY/NEXT_A, 1/2/5/10s resource selector, stable Agent/Picker/Reporter rows, action permissions, Dark/Light and window resizing on the installed v148.
- `OWNER PASS = PENDING`; successful CI and channel availability do not mean installed fleet upgraded or visible flicker physically resolved.
- `USAGE = NO NEW CALLS BY CODE`, not proof of provider billing savings; E049 existing SQLite UPSERT cost remains.
- `D172 = PENDING/HOLD` independent, not closed.

## Rollback
If a physical regression is confirmed, use the previously signed v147 release/channel through a separately Owner-gated Agent-only rollback; no Worker/Data/Android/D172 rollback.
