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
