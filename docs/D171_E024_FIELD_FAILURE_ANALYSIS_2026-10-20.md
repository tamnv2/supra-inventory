# D171-E024 — Field failure analysis and isolated kit repair (2026-10-20)

**Status: FIELD PARTIAL PASS (network rounds 1–3 only), HA SLA MISS, NO Owner PASS.** Scope: existing D171 test clients and registered diagnostic namespace, not production. The following aggregates are derived from Owner-supplied local JSONL logs (2 Agent, 2 probe files, 1 PDA HTML). **Do not publish raw logs or any Firebase identifiers, session IDs, secrets, passwords, device IDs, IPs or user payloads.**

## Actual three-device Office visit: observed results

| Round | Agent A (admin) | Agent B (tamnv2 simulated VPS) | PDA | Physical evidence |
| --- | --- | --- | --- | --- |
| 1 | Normal | Normal | Normal | 9/9 Agent A messages+peer/PDA and 9/9 B messages+peer/PDA; PDA independently counts A=9/9, B=9/9 |
| 2 | Office | Normal | Normal | Same 9/9 dual ACK; A Office's authenticated Firestore REST path succeeds through System Proxy |
| 3 | Normal | Office | Normal | Same 9/9 dual ACK; B Office's authenticated Firestore REST path succeeds through System Proxy; A simulated PRIMARY 20s watchdog failed; B observed later takeover |
| 4 | Office | Office | Normal | NOT TESTED |
| 5 | Normal | Normal | Normal | NOT TESTED |

No 5/5 FIELD PASS. The only remaining Office opportunity has already been consumed for this attempt; do not request additional on-site switching simply to repair the diagnostic harness.

### What the actual network probe showed

Both Office Agent probes had: authenticated token refresh over proxy HTTP 200; **Firestore exact roles and agent_sync via System Proxy HTTP 200**; Firestore HTTP/2 over System Proxy negotiated HTTP/2 200 (this is *not* a real gRPC Listen subscription). Firestore/RTDB direct routes were unavailable on Office. **RTDB authenticated read and SSE via Office System Proxy returned HTTP 403, classification unverified**. Inventory Worker direct and proxy attempts failed during Office. In contrast, the normal-network probes returned HTTP 200 on authenticated Firestore REST, RTDB read+SSE and Inventory Worker.

The Office test clients nevertheless exchanged real scoped synthetic Firestore messages and ACKs with PDA via HTTP(S), with the PDA affirming dual 9/9 in both mixed-network rounds. Treat Office Firestore REST via System Proxy as **physically supported for diagnostic scope**; do not extend this into WMS-ready, provider quota proof, production failover proof, Cloud Function access, RTDB usability, or normal-network VPS gRPC latency.

Latency caveat: the test EXE uses *8-second interval Firestore recent-query polling*, not the proposed VPS gRPC listener. Observed diagnostic PDA ACK distributions do **not** qualify as the latency of production VPS/Firestore gRPC.

### Root cause proven by synchronized logs

- Round 2: simulated tamnv2 PRIMARY pauses renewal at ~02:05:01.894 UTC; admin Agent acquires generation 3 at ~02:05:21.511 UTC; originating Agent sees it after **19,594 ms** and marks PASS.
- Round 3: admin Agent pauses renewal at ~02:06:31.774 UTC with generation 3. It checks at most 20 seconds, records `D171_SIMULATED_FAILOVER_NOT_CONFIRMED` at ~02:06:52.736 UTC, and terminates its listener.
- But tamnv2 Agent **actually acquires generation 4 at ~02:06:55.143 UTC**, approximately **23.4 seconds** after admin's pause, *after the test prematurely stopped*. The other Agent then waits for a peer phase-completion receipt that cannot arrive; it reports `NETWORK_TIMEOUT` around 02:07:59.639 UTC.
- The real observed failover is **outside the 20s diagnostic target** and must be recorded `HA_SLA_MISS`; however, stopping the 5-phase network test on this HA metric is a **test-controller defect**, not proof that Office transport is unusable.
- Likely contributor: a 16-second lease, 8-second periodic leader probing, the time remaining in a lease when suspension starts, HTTP latency and the fixed 20-second watchdog. The logs substantiate late takeover and polling cadence, but not the exact `lease_until` value at failure; do not assert a more precise cause without the field value.

### Bounded code repair on existing draft PR

1. Retain **20 seconds as FAILOVER SLA**; never widen the target to make a failed sample appear PASS.
2. When 20s expires, record `SLA_MISS_20S_CONTINUE_OBSERVATION` and keep a **45s maximum observation period**. If successor CAS arrives after 20s, log `LATE_TAKEOVER_OUTSIDE_20S_SLA`, never PASS. If no CAS after 45s, log `NO_TAKEOVER_WITHIN_45S_HA_FAIL_NETWORK_CONTINUES`.
3. Preserve independent 5/5 transport phase barriers, recorded A 9/9/B 9/9/PDA dual 9/9, and diagnostic send/ACK. Keep session, authorization and production safety gates unchanged. Even five transport rounds do not promote failed HA or Owner acceptance.
4. Final GUI must disclose HA misses/no-takeover count, separate from five-phase network completion.
5. Source contract CI checks the nonblocking HA classification; Windows EXE must compile, APK from exactly the same git SHA must compile, scope/continuity guards must PASS before publishing an E024 diagnostic candidate. Do not publish production artifacts or merge PR without Owner instruction.

### Implications for architectural selection

- Office Agent candidate: prefer **authenticated Firestore HTTPS REST with System Proxy**, based on real Office read/write/ACK proof. Do not prefer RTDB 403, Office-direct internet or Office Worker direct.
- Normal-network VPS candidate: Firestore gRPC Listen remains a **proposal**, not proven end-to-end by these probes; the HTTP/2 handshake only shows preflight negotiability.
- Set failover target ≤20 seconds as *unmet in one observed sample*. Compare lease+poll+retry configurations using offline replay and bounded scoped canary before any production implementation. A 16s lease plus 8s polling appears too close to a fixed 20s deadline under observed timing, but do not choose a new production interval until measurements and cost/headroom analysis.
- Provider billing, real 40-PDA capacity, production WMS exactly-once behavior and VPS physical gRPC are not demonstrated by this visit.

**Operational state:** D171 not FIELD PASS, D170 paused, D169 accepted, Stable OWNER-GATED. Production VPS remains unchanged. Preserve original field logs privately.