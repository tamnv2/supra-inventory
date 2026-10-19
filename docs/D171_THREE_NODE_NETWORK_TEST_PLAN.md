# D171 — Isolated three-node network diagnostic field suite

Status: **Owner-authorized D171 priority override; D170 PAUSED without Owner PASS.**

The accepted code/business base remains **D169 limited Owner PASS**. D170 Worker/Android/Agent technical releases already made stay installed and remain unaccepted; this priority change does **not** cancel the outstanding D170 OAuth/fleet/legacy-domain work or authorize altering it. This is a *single explicit scheduling exception* to the serial Owner-PASS sequencing rule, approved by the Owner on 2026-10-19. Further exceptions are not implied.

## Required physical topology and procedure

- Windows EXE Agent A: dedicated authenticated operator with real Agent permission.
- Windows EXE Agent B: a different dedicated authenticated operator with real Agent permission.
- Android APK Picker: designated authenticated Picker on normal Internet **for the entire suite**.
- Each participant presses **Start test** exactly once; test session is created/joined using private auth identity with a random unique session nonce. Do not publish operator account names, passwords, tokens, raw device identifiers, or SSIDs in this public repo.
- All 3 participants must be online, authenticated, role-valid and READY before the first scenario runs. Shared coordinator controls the global phase/generation and test barriers, not three independent local counters.
- The EXE for the specific Agent that must change networks displays the named role/node, required **NORMAL** or **OFFICE** network, while other participants stay put. Request operator acknowledgement; verify network route/proxy/reachability before unlock. Never automatically bypass corporate network policy or force Wi-Fi changes.
- PDA stays NORMAL. Scenario order: A/B=NORMAL/NORMAL → OFFICE/NORMAL → NORMAL/OFFICE → OFFICE/OFFICE → NORMAL/NORMAL. Test both directions for synthetic PING/PICKLIST, contact/call/chat/kick simulations and independent immutable ACK echo, retry/reconnect, duplicate suppression, terminal timeout, simulated fenced leader takeover.
- Never write any production `relay_poc_jobs`, real leader, WMS, Picker business reports, calls/chats/kicks, or Stable resources. A transport success alone is not a peer ACK PASS.
- Test-only transport uses the **existing scoped Firebase project/default Firestore** with a separate `d169_diag_sessions` *temporary collection* after new scope/rules review; no new Firebase project/database. Prepare role-restricted test Rules and emulator denied-claim checks, current main Rules parity, accurate field evidence and readback.
- Export sanitized local Windows JSONL and Android private log. Do not delete the session before Owner confirms result logs have been archived. Cleanup requires exact session deletion and reviewed Rules retirement.
- Measurement: per-phase role/auth/network route evidence, send/receive/ACK timestamps, RTT p50/p95, drops, retries, duplicate receipts, leader fencing, bounded read/write counts and uncertainty on provider-billed usage.
- CI requirements: project authority + continuity, Windows self-contained build, Android APK test build, Firebase Rules emulator with unauthorized actor denial, multi-participant phase barrier and phase mismatch regression. A CI PASS is not hardware FIELD PASS.

## Independence & rollout guard

D171 test artifacts are independent, not replacements for existing production Agent/PDA. The existing D169 Draft PR #612 is reachability-only; PR #613 V7 is a source reference, **not deployment-ready**, because it contains PDA Office phases and locally drifting phase counters. Review/port only necessary test files against current main with surgical changes. Main code/Rules and production workflows are protected. Release only after current scope and source/CI checks pass. D170 remains suspended, owner_pass=false.

