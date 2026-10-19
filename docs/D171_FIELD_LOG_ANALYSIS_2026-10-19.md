# D171-E011 — Hardware field log triage (2026-10-19, VN)

Status: **OWNER REPORTED FIELD FAIL; ANALYSIS ONLY; NO CODE OR LIVE DEPLOY APPROVAL**.

## Evidence scope
- Owner supplied two independent Windows Agent test JSONL exports, two network-probe JSONL exports and one Android test JSON log converted from a Bluetooth share HTML document. All three logs share one day-scoped isolated D171 session. An older 09:04 Windows log shows D171_AUTH_IDENTITY_MISMATCH but is a separate earlier attempt and not the cause of the 10:33 trial.
- Node aliases (no login, UID, network identifiers or secrets committed): A=Agent A; B=Agent B. Android hardware is an NLS-MT90, Android SDK 30; PDA network label NORMAL.
- Current main source reviewed: `tools/d169-peer-windows/PeerForm.cs`, `tools/d169-fieldkit-android/app/src/main/java/cd/cc/supra/inventory/beta/DiagHubActivity.kt`, `docs/D171_THREE_NODE_NETWORK_TEST_PLAN.md`.
- This document does **not** contain raw device logs, request IDs, authenticated tokens, operational data, SSIDs, IPs or passwords.

## Timeline (VN time, 19 Oct 2026)
| Time | Evidence |
| --- | --- |
| 10:33:34–10:33:49 | Both Windows Agents joined phase 0 NORMAL/NORMAL and each independently logged `PHASE ACK_PASS 9/9`. PDA phase 0 reported `both_agent_ack=9/9`. |
| 10:33:49–10:33:59 | Agent B auto-published phase 1 announcement while still NORMAL; PDA immediately ran phase 1 and got 9 ACKs from each Agent, finishing at **10:33:59**, before Agent A had actually changed to OFFICE. PDA's phase-1 PASS is therefore **not proof** of the intended A-OFFICE route. |
| 10:34:24–10:34:50 | Agent A entered OFFICE mode; A and B began intended phase 1 around 10:34:50. |
| 10:34:50–10:35:03 | Agent A's OFFICE network probes show authenticated exact Firestore reads/RTDB/Worker and token refresh failing on both tested routes, with socket host-not-found and connection-refused observations; DNS/TLS to some services remain reachable. A reported `ACTION FAILED stage=07_GUI_TEST_VA_CHO_ACK code=NETWORK_HTTP_FAILURE` at 10:35:03.894. Agent B, still NORMAL, independently reported `PHASE ACK_PASS 9/9` at 10:35:03.841. This mismatch was not propagated to a shared stage failure. |
| 10:35:35–10:35:48 | B changed to OFFICE and announced phase 2; A was still in phase 1 and OFFICE. PDA auto-started phase 2 at 10:35:48 without a proven same-phase three-device barrier. |
| 10:35:49–10:36:35 | PDA created nine simulated phase-2 requests and received **nine ACK events from B only; zero from A**; final PDA `both_agent_ack=0/9` counts requests acknowledged by BOTH Agents, rather than total individual ACKs. B remained blocked waiting for 2 Agent + 1 PDA READY. |
| 10:36–10:39 | A logged 714 `PHASE_MISMATCH_RETRY_LATER` events while retaining local phase 1; B observed `agent_ready=1,pda_ready=1` for phase 2, then `agent_ready=0,pda_ready=1` due to readiness freshness expiry. B logged `D171_THREE_PARTY_READY_TIMEOUT` at 10:39:07. |
| 10:40 | Subsequent retries still failed. A's `ObjectDisposedException` and B's `TaskCanceledException` were late secondary errors, not the first phase divergence. No evidence for phases 3 and 4 (human-labeled rounds 4/5 and 5/5). |

## Verified implementation faults / design shortcomings
1. **Premature PDA phase dispatch.** Android `startListeners()` calls `dispatchPhase()` when a single valid Agent message with a greater phase arrives. `dispatchPhase()` sends all nine messages and updates Picker READY before both Agent READY checks succeed. It does not gate on the expected A/B network readiness. This allowed phase-1 PDA PASS before the A-OFFICE transition, a false positive for network coverage.
2. **Per-device unsynchronized phase state.** Each Windows form locally increments `_phase` only after its own `TestPhase()` passes. A failure leaves the Agent on phase 1 while B proceeds to phase 2; no central abort/rollback/stop decision.
3. **Misleading PDA counter.** Android `passed=sent.count { agentAcknowledgers[request].size==2 }` is correctly a dual-ACK count, not a total Agent response count; the UI should additionally show `A 0/9, B 9/9` and why no dual-ACK was achieved.
4. **A network path failure and insufficient route proof.** A's OFFICE probes failed for exact authenticated data requests but other DNS/TLS/proxy probes reached their endpoints; the client occasionally logged Firestore HTTP 200 on OFFICE. This supports partial/intermittent endpoint or route failure, **not** proof that all Office transport is impossible, nor an attribution to corporate firewall rules alone. `NETWORK_READY OPERATOR_CONFIRMED_NOT_SSID_PROOF` is a human confirmation, not measured SSID or authenticated Firestore request/ACK guarantee.
5. **Mismatch and quota storm.** Agent A repeatedly retries future-phase messages in its 2-second watchdog without a shared pause/backoff. A's local counters end at ~1,470 GET and 98 writes; B at ~840 GET and 65 writes. These are local HTTP-operation counters, **not** provider-billed Firestore reads/writes.
6. **Nonaligned failure deadlines and recovery.** PDA's dual-ACK wait is 45 seconds whereas Windows `WaitForThreeReady()` polls up to 90×2 seconds. Failed Windows `AdvancePhase` retains phase; PDA's `dispatchedPhases` prevents automatic replay of a failed phase in the same app lifetime, with no global retry/resume authority.
7. **Prior resolved/separate errors.** Older 09:04 Agent log contains `D171_AUTH_IDENTITY_MISMATCH`; newer 10:33 joined and completed phase 0, so this earlier identity bug does not explain the current 0/9. PDA had one initial `D171_UNEXPECTED_APIEXCEPTION` at 10:31:59 and subsequently authenticated at 10:32:50; root cause of transient login failure is not established from sanitized log alone.

## Proposed repair scope (NOT IMPLEMENTATION AUTHORITY)
- Keep D171 isolated. Introduce a **single run/phase coordinator** in already-approved temporary diagnostic Firestore namespace: `run_id, phase_id, required A/B networks, participant readiness, network probe proof, RUNNING/FAILED/PAUSED/COMPLETE, deadline`; require exact phase/run and two distinct authenticated Agent identities before issuing PDA START. Do not let a synthetic PING auto-start a phase.
- Bind every synthetic request and immutable receipt to `run_id/phase_id`, peer identity and network-proof epoch. Assert both Agent receipts only **after** each Agent has completed an authenticated exact diagnostic Firestore route probe under the required network; surface A-ACK and B-ACK separately.
- On any terminal Agent/network failure, transition shared phase to PAUSED/FAILED and notify all devices promptly. Provide explicit bounded retry/resume from the failed stage without duplicate ACK/replay or deleting evidence. Align PDA/Agent deadlines, reconnect/backoff and authoritative phase control. Use bounded/paginated polling and avoid infinite mismatch retries.
- Distinguish Office route denial, proxy/config/DNS anomalies, token refresh issues and Firestore permission errors with sanitized error codes and paired diagnostic request-id tracing, without logging raw URLs/tokens/secret values. If authorized Office route to isolated Firestore is truly unavailable, report `OFFICE_ROUTE_UNREACHABLE`; do not mark a stage PASS, silently hop networks or use the production business path.
- Regression acceptance: same-process 5/5 normal/Office cross-matrix with no early-phase sends; no false PASS before both Agent READY + exact route evidence; intentional Agent A Office failure gracefully PAUSES entire test; successfully recovered run resumes without stale/duplicate ACK; browser-side synthetic emulator tests plus distinct Windows EXE/Android APK source/build CI; Owner real-field verification remains mandatory.
- Impact: only separate diagnostic Windows EXE, diagnostic Android APK, and the previously scoped temporary Firestore test documents/Rules compatibility. No production Worker, Agent OTA, Android signed release, WMS/PRIMARY, operational messages, Stable, D170 hostname/OAuth or new resources. Risk: shared-phase CAS/rules compatibility, additional scoped Firestore writes vs lower runaway polling; measure before/after local operations and billed quota separately. No deployment without Owner instruction.

## Gates
- D171 code / new EXE/APK for this field defect: **not yet implemented** in E011.
- D171 OWNER FIELD PASS: **false**; 5/5 matrix not completed.
- D170: **paused**, without Owner PASS. Accepted base D169 remains unchanged.
- Preserve original test data and logs until Owner confirms archiving. Never commit raw supplied logs to public repository.
