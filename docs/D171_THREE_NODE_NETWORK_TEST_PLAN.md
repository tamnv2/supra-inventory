## D171-E012 — Operator procedure for the repaired standalone kit (19 Oct 2026)

1. Start with Agent A (`admin`) and Agent B (`tamnv2`) on NORMAL and one Picker PDA (`100`) on NORMAL. Each user signs in on the respective dedicated test client and presses Start **once**. Do not manually operate network changes on the PDA.
2. Agent EXE logs prove authenticated Firestore access before publishing its own READY. PDA observes both authenticated Agent member records and required network labels for the **same phase** before sending any 9-message batch. A single phase-announcement message cannot start a round.
3. The required sequence is A/B: (0) NORMAL/NORMAL, (1) OFFICE/NORMAL, (2) NORMAL/OFFICE, (3) OFFICE/OFFICE, (4) NORMAL/NORMAL. After a round, Agent A/B must each successfully ACK 9 peer/PDA synthetic messages and each emit a phase-complete marker; no Agent advances on only its own success.
4. Only the EXE for the Agent whose required network changes asks the operator to switch Wi-Fi, with its signed-in account/role and required NORMAL/OFFICE target. An unchanged Agent proceeds automatically but does not send phase tests until all three READY. Operator-confirmed network label is NOT independent SSID attestation: the new authenticated Firestore GET is the separately measured route proof.
5. Android should show independent Agent A and Agent B ACK counts and dual-ACK count. If Office connectivity fails, no PASS/automatic phase advancement. Return sanitized stage/code and local JSONL; do not retry past the failed stage by repeatedly clicking switch. Restart requires a verified fresh run boundary to prevent today's session history from masquerading as a new test.
6. Windows low-usage rule: 8-second listener with Firestore `created_at` query window, only recent documents, no per-document extra GET, bounded query result and hard local HTTP read cap. Android snapshot listeners exclude older entries. These are **engineering controls**, not externally verified provider billing savings.
7. Only current-matching source-head CI for Windows EXE, Android APK, Rules emulator, authority and continuity constitutes test-artifact CODE PASS. Physical 5/5 and Office↔Office/peer-to-peer behavior remain unverified until Owner's field trial; no real WMS/PRIMARY/Picklist mutations.

# D171 — Isolated three-node network diagnostic field suite

Status: **Owner-authorized D171 priority override; D170 PAUSED without Owner PASS.**

The accepted code/business base remains **D169 limited Owner PASS**. D170 Worker/Android/Agent technical releases already made stay installed and remain unaccepted; this priority change does **not** cancel the outstanding D170 OAuth/fleet/legacy-domain work or authorize altering it. This is a *single explicit scheduling exception* to the serial Owner-PASS sequencing rule, approved by the Owner on 2026-10-19. Further exceptions are not implied.

## Required physical topology and procedure

- Windows EXE Agent A: dedicated authenticated operator with real Agent permission.
- Windows EXE Agent B: a different dedicated authenticated operator with real Agent permission.
- Android APK Picker: designated authenticated Picker on normal Internet **for the entire suite**.
- Each participant presses **Start test** exactly once; test session is auto-paired from the Vietnam business date plus authenticated Firebase identity (no manual SID entry); the date-scoped locator is deterministic and therefore MUST NOT be treated as a secret. Its security relies on Firebase Rules, short TTL, exactly paired Picker and independent Agent role proof. Do not publish operator account names, passwords, tokens, raw device identifiers, or SSIDs in this public repo.
- All 3 participants must be online, authenticated, role-valid and READY before the first scenario runs. Reusing the same VN-day test locator across retries can preserve old test events; a fresh rerun requires explicit run-boundary verification or Owner-approved archived-session cleanup. The two Agent instances must publish matching phase readiness to their own role-bound Firestore member documents before test requests are emitted. The PDA automatically follows the first authenticated new-phase Agent request; only the Agent EXEs request operator network switches. Full hardware synchronization is not a CI-only claim.
- The EXE for the specific Agent that must change networks displays the named role/node, required **NORMAL** or **OFFICE** network, while other participants stay put. Request operator acknowledgement; verify network route/proxy/reachability before unlock. Never automatically bypass corporate network policy or force Wi-Fi changes.
- PDA stays NORMAL. Scenario order: A/B=NORMAL/NORMAL → OFFICE/NORMAL → NORMAL/OFFICE → OFFICE/OFFICE → NORMAL/NORMAL. Test both directions for synthetic PING/PICKLIST, contact/call/chat/kick simulations and independent immutable ACK echo, retry/reconnect, duplicate suppression, terminal timeout, simulated fenced leader takeover.
- Never write any production `relay_poc_jobs`, real leader, WMS, Picker business reports, calls/chats/kicks, or Stable resources. A transport success alone is not a peer ACK PASS.
- Test-only transport uses the **existing scoped Firebase project/default Firestore** with a separate `d169_diag_sessions` *temporary collection* after new scope/rules review; no new Firebase project/database. Prepare role-restricted test Rules and emulator denied-claim checks, current main Rules parity, accurate field evidence and readback.
- Export sanitized local Windows JSONL and Android private log. Do not delete the session before Owner confirms result logs have been archived. Cleanup requires exact session deletion and reviewed Rules retirement.
- Measurement: per-phase role/auth/network route evidence, send/receive/ACK timestamps, RTT p50/p95, drops, retries, duplicate receipts, leader fencing, bounded read/write counts and uncertainty on provider-billed usage.
- CI requirements: project authority + continuity, Windows self-contained build, Android APK test build, Firebase Rules emulator with unauthorized actor denial, multi-participant phase barrier and phase mismatch regression. A CI PASS is not hardware FIELD PASS.

## Independence & rollout guard

D171 test artifacts are independent, not replacements for existing production Agent/PDA. The existing D169 Draft PR #612 is reachability-only; PR #613 V7 is a source reference, **not deployment-ready**, because it contains PDA Office phases and locally drifting phase counters. Review/port only necessary test files against current main with surgical changes. Main code/Rules and production workflows are protected. Release only after current scope and source/CI checks pass. D170 remains suspended, owner_pass=false.

