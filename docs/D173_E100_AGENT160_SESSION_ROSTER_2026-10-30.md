# D173-E100 — Agent160 session roster, UTC and stable version (Owner 30/10/2026)

## Owner approval and boundaries
Owner explicitly approved code plus signed Agent update for the 29/10 Agent159 roster review. Agent-only first: native WinForms roster and local incoming-session metadata reconciliation. Preserve all Worker/DO, Web, Android, Firebase Rules, Gateway, WMS/HA and confirmation flows. D172 independent PENDING/HOLD, legacy Stable OWNER-GATED. Do not use E097 Worker incident to bypass Production health or release guard. No new provider endpoints, timers, polling, heartbeat, writes, secrets or user identifiers.

## Verified input and problem
- `service/src/core.ts`: `android_session_started_at=CURRENT_TIMESTAMP` produces timezone-less SQLite UTC. Agent's former `DateTimeOffset.TryParse(raw)` may interpret that string as local Windows time; UTC+7 conversion then gives a wrong display.
- `service/src/notifications-core.ts`: `fcm_devices.last_seen_at` is FCM registration timestamp, not PDA heartbeat. `app_version` may be blank. Therefore remove generic "Ghi nhận gần nhất" from the default UI, do not claim PDA physical online. `device_seen_at` remains internal historical FCM metadata only.
- `relay-agent/FirestoreAgentSync.cs`: agent_sync copies `app_version` but omits `device_seen_at`; `relay-agent/D119AgentFeatures.cs` merges direct authenticated session projection, agent_sync and one-shot PICKLIST fallback. Empty same-generation metadata must not erase known version; a newer generation must not reuse the prior APK version.
- Web/App rows are sampled from authenticated Worker WebSocket every 5 minutes PRIMARY or 10 minutes standby, not per-second online proof. Agent HA heartbeat is a separate source.

## Source implementation
- Interpret timezone-less SQLite timestamps as UTC with `DateTimeStyles.AssumeUniversal`, preserve explicit ISO8601 offsets, display `dd/MM HH:mm` in UTC+7.
- Keep non-empty verified APK metadata only within exactly the same `UserId + SessionGeneration`; replacement/new session clears inherited metadata; real LOGIN remains authoritative over delayed PICKLIST.
- Native compact grouped roster default: Personnel, Version/Channel, Vietnam time, Source-backed status; technical metadata optional. Existing named action columns remain physically present and preserve role-based command handlers.
- Local four-way filter All/PDA/Web-App/Agent, three source-backed count labels, existing text search, incremental row updates and multi-selection preservation. Source timestamps/roles are labeled honestly. No new server paths or background clock.
- Existing WMS and Agent controls remain untouched; retain responsive layout, theme parity, native executable and source regression.
- Agent159 is rollback/reference; v160 signed OTA only after exact-source PR CI PASS, protected approval-specific release guard, Windows build+startup+native `--e100-roster-self-test`, source pin, publish/tag/channel SHA verification and healthy official update endpoint.

## Acceptance & release state
SOURCE CODE CANDIDATE; PR/source CI unverified; signed OTA NOT RELEASED; real Windows FIELD and Owner PASS pending. Production Worker E097 SQLITE_NOMEM health incident remains an independent blocker to claiming update-host readiness; never invent health status or release success.

## Exact source CI receipt (30/10)
- Source: `94db94ce1003c16cd2198aef6dd33ead8830d69f`, PR #797, 33/33 CI SUCCESS. Windows net48 native build/startup and `--e100-roster-self-test` PASS (run `40992118315`), shared D172 isolation PASS (run `40992118168`), E097 SQLite regression PASS. Authorization `ops/d173-e100-agent160-release-authorization.json` pinned. This is CODE/CI PASS only. `/health` and SQLite Production after E097 failure not yet independently verified, so signing, OTA, real RDP FIELD and Owner PASS remain pending.

### Final native layout correction and authoritative source pin
- Source `29e8a903fbb738c481b9e1dca12d79decae1087c`: 33/33 PR CI SUCCESS, including native Windows build+startup+`--e100-roster-self-test` (run `40992749845`), D172 regression and unchanged Worker. Corrected grouped column `DisplayIndex` and multiline autosizing; this source supersedes earlier `94db94ce...` CI receipt. `ops/d173-e100-agent160-release-authorization.json` pins this exact source; production release/field/Owner pending, E097 Worker health unverified.
