# D173-E105 — Agent162 Hoạt động gần nhất: Owner FIELD FAIL, source-level diagnosis (30/10/2026)

## Lifecycle and authorization
Owner reports that after updating to Agent162, previously agreed normal business activities still do not appear in `Hoạt động gần nhất`. Mark **FIELD FAIL**, **OWNER PASS false**. Agent162 CODE/CI/signed RELEASE remain independently technically PASS. This is a same-D173 E103/E104 correction investigation, **not a new Dxxx** and does not authorize new source change/deployment. D172 OBPP remains independent PENDING/HOLD; historical Stable OWNER-GATED.

## Verified code-level gaps (current main after PR801/PR802)
1. `service/src/read-model-core.ts` lines 502-540: authenticated Web and Android Reporter session SQL reads login/session only; each result explicitly sets `last_activity_at: loginAt` and `last_activity_type: LOGIN`. It never queries `report_events`, `audit_log`, or a real business-event timestamp. These rows *cannot* show subsequent user business actions on Agent162.
2. `relay-agent/D119AgentFeatures.cs` lines 1642-1648: Web/Reporter snapshots refresh on existing 5-minute PRIMARY / 10-minute standby schedule. Thus even a future SQL improvement would not be realtime without a separately reviewed already-existing delivery path or cadence adjustment.
3. `relay-agent/D173E103Activity.cs`: picker activity is a RAM-only dictionary on the local process with a per-user/session generation and replay fence. `D173PickerActivityText` falls back to `Đăng nhập` when no exact local event. It is neither persisted nor broadcast to the other Agents; process restart, a different PRIMARY/standby observing the grid, or missing/mismatched generation necessarily leaves no known event. `D173AgentActivityText` intentionally displays only the same `AgentInstanceId` / user identity; remote Agents display `Chưa ghi nhận thao tác`.
4. `relay-agent/FirestoreConfirmationTransport.cs` lines 449-450 and 678-685: only already observed Firestore PickList request ingress and durable terminal ACK call the picker activity handlers. Other Picker/Reporter business actions are not automatically covered. `RecordD173PickerActivity` rejects old/future-created, mismatched generation or tombstoned events. This is a safety boundary, but currently offers no provenance diagnostic or cross-agent fallback for a valid accepted action.
5. `relay-agent/D119AgentFeatures.cs` lines 2781-2789 renders `Đăng nhập` for Web/Reporter LOGIN projection, and lines 2705-2709 consume only the local Picker record. Agent native actions are selectively instrumented in Program/D119/D168; no proof of full agreed business-action coverage, including SKU. Release self-test `D173E103ActivitySelfTest` only exercises small in-memory acceptance cases, not physical multi-Agent/Picker+Web+Reporter E2E.

## Technical causal assessment
- **Proved design defect**: Web and Reporter business activity is not sourced at all; Agent162 cannot display it regardless of successful version installation.
- **Proved cross-agent/design limitation**: local RAM-only Picker/Agent actions cannot be a consistent multi-Agent activity view.
- **Possible Picker-specific omissions**: session-generation/tombstone/age filtering, request observed by a different Agent, missing event, local restart; device-specific cause is *not yet proved* without sanitized runtime evidence. Do not remove safety fences or infer activity from heartbeat, FCM, socket/polling, retry, timestamps of unrelated system jobs.
- **Source-vs-field distinction**: CI and signed OTA PASS were valid but insufficient acceptance gates; installed activity FIELD is FAIL by Owner report. No production provider mutation is authorized by this diagnosis.

## Proposal for explicit impact review, NOT APPROVED
- Keep `Agent / service` repair scope only; no new APK/Web/Firebase/OBPP features.
- Produce per-action coverage matrix: Picker LOGIN/request/durable ACK outcome, local Agent manual search/confirm/call/chat/kick/takeover/SKU, Reporter Android and Web/Admin genuine ticket/report actions. Count only confirmed user business actions with authenticated identity, session generation, source event and UTC timestamp.
- Local Picker: preserve existing event source + idempotent safety checks; assess piggyback of bounded last-event metadata on **already occurring** Firestore Agent sync publications if real confirmed events exist, to make a same-session shared fleet view without new request. Proof required: available write cadence, size/quota, no new writes, correct remote-Agent handoff; otherwise explicitly state data freshness limitation, not fake realtime.
- Web/Reporter: reuse existing authenticated roster GET with one bounded indexed SQL join/aggregate to recorded activity. This keeps DO request **count** unchanged but may increase D1/SQLite rows read / DO duration. Existing 5/10-minute polling fails strict realtime; investigate existing authenticated socket push path separately, measure extra provider operations before promising <5s.
- Add fixture E2E multi-Agent, PRIMARY takeover, login/gen/tombstone, Web/Reporter business events and rendered UI with source timestamp; tag CODE/CI/RELEASE/FIELD/OWNER independently.
- Before any service/Agent executable edit provide Owner impact review and explicit approval per `ops/authority-manifest.json`. D172 regression mandatory if shared Worker is edited.

## No secrets / PII
This document uses only public source path/line references and abstract operation categories. No raw employee, PickList, token, WMS session or live log payload is committed.

## E105 incident 16:10–16:15 VN — Agent162 PDA PickList ingress outage (read-only field-log investigation)

### Owner observation and boundaries
- Owner reports PDA PickList requests were not received/acted upon by Agent162 at **2026-10-30 16:10–16:15 Asia/Ho_Chi_Minh**, and receiving/processing resumed after 16:15.
- Scope is log/source investigation **only**. No new executable code, provider write, Firestore read, deployment, change in user data or test PickList; D172 stays independent PENDING/HOLD and Stable OWNER-GATED.
- Source: Google Drive Agent session/checkpoint/manual log bundles already uploaded, reviewed read-only; keep Drive IDs, full raw records, picker/user/device identifiers, IPs and tokens **out of this public repository**.

### Verified sanitized time series (all UTC+07:00)
| Time | Source-backed event |
|---|---|
| 16:09:40–16:09:43 | VPS acting PRIMARY observed one PDA request, WMS CONFIRMED, Firestore durable ACK PASS. Healthy immediate pre-incident reference. |
| **16:10:14** | VPS initiated auto-update v161 → v162 (install-started). |
| **16:10:15** | VPS HA logged `DEEP_HIBERNATE reason=STOPPED`; previous Firestore listeners cancelled/reconnected during shutdown. |
| 16:10:19–16:10:22 | VPS launched binary `0.162.0.0`, Firebase session refresh and Agent session claim PASS. Checkpoint ends at 16:10:22; **no corresponding post-start VPS confirm job/ACK log** found among uploaded files. |
| 16:12:57 | Another Agent reported `NEXT_B`, with PRIMARY held by a **third instance** and VPS as STANDBY. |
| 16:14:48 | A separate Agent reported `DEEP_HIBERNATE`, same third-instance PRIMARY and VPS STANDBY. This agent's browser initially logged HTTP403 for a bundle; this does not prove PRIMARY's WMS status. |
| **16:15:26–16:15:35** | Non-PRIMARY Agent completed **manual** browser-based WMS PickList confirmation. It is **not** evidence of PDA transport automatic confirmation or PRIMARY recovery. |
| 16:17:07–16:17:12 | Targeted HA handoff preflight and switching to the manual-confirm Agent PRIMARY succeeded; previous PRIMARY was the third instance, not VPS. |
| **16:17:24–16:17:26** | Now-PRIMARY Agent received a new PDA request via Firestore listener; server queue age about 227 ms; confirmed in WMS and durable ACK PASS. |
| 16:17:55–16:17:59 | Second new PDA request received and durably ACKed NOT_FOUND (business result, not transport loss). |
| 16:18:38 | This Agent became NEXT_A and observed VPS as new PRIMARY. VPS post-16:10 real-device ingress/ACK remains unproven in retrieved logs. |

### Source-backed expiry behavior and suspected failure mode
- `relay-agent/FirestoreConfirmationTransport.cs`: `MaxPendingAgeMs = 35000` (line 60); `ProcessPendingDocuments` skips requests older than 35s (around lines 448–458); REST `ReadPendingDocuments` queries only `PENDING` jobs with `created_at >= now − 35s` (around lines 723–759). Consequently **if** no eligible PRIMARY consumed a real PDA request during this interval, a request left pending for >35 seconds will not be picked up by a later fresh REST query; takeover minutes later is **not** a guaranteed replay. Do not conclude data deletion or specific job expiry without Firestore/PDA evidence.
- HA failover configuration visible in logs is `failover_ms=15000`, yet logs show a third instance nominally PRIMARY at 16:12 and 16:14, with only observed successful PDA ingress at 16:17 after explicit targeted handoff. **This is a suspected leadership/eligibility liveness gap**, not proof that the 15s failover mechanism itself failed: unobserved PRIMARY's runtime/log and source PDA request attempts are missing.
- During interval an alternative Agent could manually confirm WMS at 16:15, so evidence does **not** support claiming a global WMS outage.
- Current evidence excludes proving a global Firestore outage, missing PDA writes, or a particular request lost/expired. Auto-update coincides with outage, **causality remains conditional** until third-instance PRIMARY and PDA/Firestore request histories are correlated.

### Remaining for exact RCA (read-only, no credentials)
1. Locate sanitized 16:09–16:18 Agent log for the third-instance PRIMARY, with role/lease generation, `FIRESTORE CONFIRM` polling/listener, request ingress/stale-skip and ACK/error, WMS readiness, process restarts. Uploaded logs presently contain no identified sample for this instance and window.
2. Correlate PDA-origin submit success/error, server `created_at`, document status and durable ACK for affected 16:10–16:15 requests (only authorized metadata, never expose PickList/user IDs in public journal).
3. Compare HA lease owner/generation vs `CanPollBusiness`, `CanProcessJob`, standby readiness and auto-update timing. Evaluate bounded safe owner-handoff before an active PRIMARY self-update and measurable 15s failover, **proposal only**.
4. Validate what UI told PDA users for requests aged >35s. No automatic resubmit or mutation without duplicate-confirmation safety check and Owner-approved code scope.
5. Existing Agent162 signed CODE/CI/RELEASE PASS remains; **FIELD FAIL now includes this incident**. No remediation code, no new release and no Owner PASS.

