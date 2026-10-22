# D171-E082 — Owner authorized immediate repair; single Production change plan

Date: 2026-10-22 Asia/Ho_Chi_Minh. Owner explicitly requests analysis, implementation and guarded deployment for D171 BL-01..BL-07 and usage improvements; prioritizes no-reply outbound email and genuine APK transfer progress. **This does not certify FIELD/OWNER PASS or authorize a new unregistered provider.**

## Canonical Production interpretation

D170 operates one official public service at inventory.supra.cc.cd. The same pre-existing Worker technical identifier, InventoryCore, Firebase project, APK package/signing, GitHub release identifiers and legacy inventory-beta hostname remain for safe migration/OTA continuity. Old 'stable' Worker and project resources are quarantined, not a second business environment. They are not certified fully deprovisioned, and the legacy hostname is not certified ready to remove. Do not present Beta/Stable labels or environment selectors to end-users, and never delete a backing resource merely to rename it.

## Evidence and source implementation started

- Android Inventory MainActivity now exposes a real byte-progress dialog for its authenticated existing signed APK update: percent if Content-Length is available, transferred MiB, measured MiB/s, explicit unknown-length fallback and separate SHA-256/signature verification. Version gating, certificate verification, manifest/tag, stable authenticated Picker session/ACK policy and trusted GitHub redirect chain remain unchanged. **Source only**, no signed vc118 release nor installed device PASS.
- Existing Gmail mail transport has an optional Cloudflare Email Service sender path, strictly restricted to `no-reply@supra.cc.cd` and protected by the `PROJECT_MAIL_SENDER` configuration and verified `EMAIL` binding. Without activation, the existing Gmail route remains for continuity. Once activated, a provider failure does **not** silently send using the personal sender. **Provider sender/domain not yet verified, no activation or verified outgoing OTP.**
- Source tests `tests/d171-e082-mail-update-progress.test.mjs` cover progress, checksum, signature and sender fail-closed.
- Existing project instrumentation already implements bounded, process-local SQL cursor `rowsRead`/`rowsWritten` by exact query id: `service/src/d166-sql-usage.ts`; per-route DO counts: `service/src/d167-route-usage.ts`. Diagnostic read at Core `/diagnostics/d167/usage`. **Reuse before adding any per-request network, polling, query or persistent log.** These are local estimates and reset on isolate restart, not billed provider usage.

## Recommended coherent backlog resolution

| BL | Source of truth & proposal | Risk / test |
|---|---|---|
| BL-01 mail | Cloudflare Email Service transactional sending from existing Worker; verify SPF/DKIM/DMARC and sender binding, then flip sender flag | test internal + external mailbox, bounce, throttle, provider outage, rollback; do not spoof From or leak OTP |
| BL-02 OTA | UI driven by actual streamed APK bytes, secure verify+installer phases, no new backend polling | network stalls, redirects, unknown length, partial file, signed compatibility, in-flight Picker |
| BL-03 list scroll | retain stable adapter/row anchor ID with bounded diff and no eager full snapshot | reorder/new batches while reading, background return |
| BL-04 Reporter badges | merge queue/overdue and recent counters at a single authoritative server snapshot seq/revision; apply only contiguous deltas, discard older GETs and resync on gap | race/replay/gap, reconnect, midnight VN, multiple Reporter, no flicker |
| BL-05 recurrence | previous resolved batch for SAME `business_day_vn` only, preserve history across days | calendar midnight, timezone, multiple same-SKU episodes |
| BL-06 session restore | nonblocking warm resume with immediate cached UI only for retained valid generation, asynchronous single-flight refresh; enforced revoke on server | cold-start, kick, Doze, background, auth/network failure |
| BL-07 shift cutoff | service-authoritative Picker session deadline 14:00/22:00 VN with next login required; no offline business and no local timers as enforcement | cutoff at exact time, network loss, restart, in-flight ACK, overtime, non-Picker roles |

## Usage/observability plan coupled to fixes

1. Read existing Core D166 SQL cursor and D167 route diagnostics in a bounded authorized interval; group by actual deployed main SHA, hour and source-specific route; D172 needs own scoped `OBPP` route attribution rather than guessing its portion of ~427M account/DO rows.
2. Record on existing scheduled Drive log only **on change/failure**: stream connection transition (network class, sanitized reason, reconnect attempt/backoff), lease-role generation (without raw uid), last good event sequence, fallback read count, retry suppression; Reporter seq + snapshot revision and claimed/authoritative two tab totals, overlay displayed/FCM stage, warm vs cold resume latency, OTA byte/phase/status; D172 outbox state/retry and provider status. Never log raw personal data, tokens, Wi-Fi SSIDs or QR payloads; no new Firestore listeners or provider polls.
3. P0 optimization candidates after SQL/Agent trace proof: repair repeated RTDB SSE timeout/reconnect and `D169_VPS_RECLAIM_READ` terminal failures; index or eliminate high-cost SQLite scans after `EXPLAIN QUERY PLAN`. Keep critical HA lease fallback under <=20s, idempotent Picklist ACK, realtime freshness, offline-denial and 2s maximum permissible overhead.
4. No literal quota transfer between DO Requests/Rows Read and D1/Workers/CPU/Firebase/RTDB. D1 only for nonauthoritative reporting after cost/latency and stale-data tests. D172 data remains independent despite sharing runtime.

## Release gate and residual block

Current branch is PR-only candidate. Full seven-backlog implementation is **not** represented by the OTA+email preparatory source files; the remaining BL-03..07 and usage changes have NOT been built/tested. Provider sender activation requires an actual registered Cloudflare Email Sending domain, account sending readiness, existing Worker `EMAIL` binding with permission, and no unauthorized resource drift. Only deploy from current protected main after authority+continuity/security+Android build+Worker typecheck+relevant HA/ACK/OTAs PASS. Preserve D172 isolated package/OBPP tables and old quarantined Stable resources; after release run production source/host readback, verified signed channel/APK, real devices, 24h billed usage and Owner field verification. Any missing gate = NO DEPLOY.
