# D169 — Direct-to-direct isolated multi-network diagnostic design (Owner correction, 2026-10-17)

## Decision / why V5 is inadequate
V5 fieldkit Android sends `RelayPocClient.sendProbe` through production `relay_poc_jobs`; V5 EXE reads endpoint reachability and mirrors the real Agent log. **The two diagnostic apps never exchange their own authenticated messages**, so V5 cannot prove peer Agent↔PDA, Agent↔Agent, network-switch and simulated PRIMARY handover as requested by Owner. Do not claim V5 completes this requirement.

## Target peer topology
```text
PDA diagnostic Picker ─┐
                       ├── isolated Firestore Beta test messages + receipts ── Test Agent A (Windows)
                       │                                                 └── Test Agent B (Windows)
All-NORMAL agent group: optional RTDB test transport, only when every peer has proven access.
Mixed NORMAL/OFFICE: Firestore via Windows system proxy is the common carrier.
```
This is logical end-to-end peer-to-peer messaging via shared cloud transport, **not direct LAN TCP**; cross Office/normal networks have no proven direct routable network. It must use actual auth and carrier in both test clients. Neither tool may claim production PRIMARY or mutate live WMS/Picklist, session-control, call/chat/kick collections or actual operations.

## New test channel required / gate
Current `firebase/firestore.rules` permits PDA create only a **real business** job `relay_poc_jobs` with source `ANDROID_CONFIRM_V1`. `relay_poc_coordination/{docId}` is Agent-only. RTDB Office was 403. No authenticated PDA↔diagnostic EXE writable/readable, isolated and approved canary namespace exists yet. **Fail closed**: do not reuse those production paths as test bus or claim readiness.

Propose a distinct namespace in the existing registered Beta Firestore database (e.g. `d169_diag_sessions`) with restrictive Rules, Owner-approved resource registry/scope update, explicit non-production TTL, session membership, server-timestamp age, bounded per-session operation sizes/count, and a cleanup strategy. Stage code+rules+registry as a PR and validate emulator/rules; **no direct Beta Rules deployment or merge without explicit Owner impact approval and authority+continuity PASS**. No Stable resources. Do not log tokens, passwords, exact Wi-Fi identifiers or production Picklist numbers.

## Required real test protocol
- EXE Agent A/B and Android APK use existing app-owned login forms: Agent via Admin/Pick Pack Admin established Firebase claim validation; PDA via Picker Worker login and Firebase custom token. No user-entered Web API key: inject public Firebase config in CI like production, never commit secret.
- Create random high-entropy `test_session_id`; each node has unique `node_id`, `network_epoch`, expected role, auth identity and generation. Test session is owned by operator and joined by Picker through an authorized handshake.
- Messages are immutable: unique `request_id`, sender, intended receiver, business-like test type (PICKLIST_SIM, CALL_SIM, CHAT_SIM, KICK_SIM, PING, HELLO, RETRY, HANDOFF_PROPOSAL), bounded redacted test payload, expiry; **no real WMS action**. Only an authorized receiver writes independent RECEIVED, PROCESSED, ACK receipt with monotonic/local and server timestamps, error class, transport, generation and processing delay. Sender reads the same ID's receipts and never marks HTTP 200 as business success.
- Simulated PRIMARY is a separate per-session generation/lease with CAS/transaction/fencing and acknowledgements. Agent B competes only inside test collection. Never affects production primary.
- Network change events: PC_A/PC_B capture network epoch, Windows default/system proxy route; dedupe and resume same request across transition; do not send duplicate terminal ACK. PDA remains NORMAL. Determine common available transport across **all live eligible Agents**, not only current PRIMARY SSID.
- Test matrix: PDA↔A NORMAL; PDA↔A OFFICE; A↔B NORMAL/NORMAL, OFFICE/OFFICE, NORMAL/OFFICE, OFFICE/NORMAL; A/B switches while leader and standby; A offline, delayed ACK, duplicated request, token expiry/refresh, reconnect, complete packet loss, eventual recovery and change-of-generation split-brain guard. Distinguish channel PASS, message ACK PASS, failover PASS and simulated-business PASS.
- Compare protocol under Firestore Listen + REST fallback and optional RTDB on all-normal only; collect connection setup, p50/p95, send→server, server→receiver, processing, receiver→sender, retry count, duplicate count, ttl expiry, listener state and billed operation counts.
- Logs: each EXE writes network + peer event JSONL + summarized JSON to Windows Desktop, isolated from production Agent. APK persists encrypted-or-private local bounded event log, uses the existing **authorized** /api/logs/upload→Drive path only when accepted by backend; check `archive_status=DRIVE_SYNCED`; preserve local export if deferred. The existing Worker log schema/role must be validated for the distinct app package and diagnostic reason before use.

## Material trade-offs / impact before approval
- Secure isolated Firestore Rules changes are needed for both Picker and Agent write/read. Incorrect Rules could widen access or break production; thus sandbox/emulator plus CI, minimal namespace allowlist, tests for unauthorized actors, bounds and TTL, rollback and explicit Owner approve for Beta deployment.
- Real server FCM delivery for diagnostic package needs a separately registered token/Function path. `FCM accepted` cannot certify actual PDA visibility. No push permission or service change is assumed.
- Full synthetic protocol proves physical network + carrier + test leader algorithm; **it does not prove WMS browser confirms or production auth/generation semantics**. Preserve a distinct strictly controlled production integration run after simulated suite, with authorized test Picklist only.
- A test APK/EXE is not "complete" until the isolated namespace has been authorized/deployed and end-to-end field logs from multiple peer devices exist.

## Status
`D169_OWNER_CORRECTION_DIRECT_PAIR_SPEC_DONE__TEST_CANARY_RESOURCE_PENDING__NO_NEW_PAIR_BINARIES__NO_FIELD_PASS__STABLE_UNTOUCHED`.

## V7 — Owner rejects V6 manual matching; approves scripted isolated peer suite

After existing Agent Admin and PDA Picker authentication, both clients derive the same VN-date ephemeral test-session key, auto-join the test-only namespace, and run a scripted typed synthetic-message matrix with a single Test button. An authenticated Agent first creates the session; the Picker waits for it. No 32-character SID entry, API key entry or real WMS/production Agent writes. Multiple Agent instances under the same ADMIN UID use unique per-process node IDs, and receipts are uniquely attributed to the receiver node.

The operator changes NORMAL/OFFICE Wi-Fi only when prompted and confirms in the app. The scripts contain four PDA-Agent and four Agent-Agent network phases. Test-phase-mismatch messages are not ACKed as a different scenario. Simulated leader election uses node-ID heartbeat/lease expiry, generation and Firestore conditional writes; it never claims production HA or WMS mutations. Label manual network selection as operator-confirmed, not measured SSID. Failure to reach Office or Firebase remains a measured failure, not an assumed pass.

Owner-provided account selection is private runtime context; the public repository contains no specific employee login IDs, passwords, tokens or raw user data. Re-authenticating the designated Picker may replace that account's existing active mobile session; use the intended test account on non-production hardware. All test data remains in the already approved Beta temporary namespace; no new cloud service is authorized. Field proof requires actual pair logs, receipt latency, network switches and authenticated Beta Rules deployment readback. Delete data and remove Rules only after the Owner confirms the test evidence is safely archived.
