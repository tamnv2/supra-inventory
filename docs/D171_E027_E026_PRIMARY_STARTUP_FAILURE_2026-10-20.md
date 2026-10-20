# D171-E027 — Why E026 failed before HA3 and the bounded diagnostic repair (20 Oct 2026)

**Status:** E026 physical field failure reproduced and triaged from two owner-submitted Agent JSONL logs, two network-probe JSONL logs and one PDA HTML log. **NO FIELD HA3 PASS, NO round 4 or round 5 field measurement, NO production mutation or Owner PASS.**

## Source-backed timeline (VN UTC+7, identifiers omitted)

| Vietnam time | Observed client event | Outcome |
| --- | --- | --- |
| 10:43:51.2 | `tamnv2` on Office performs Firestore CAS generation 1→2, becomes simulated VPS PRIMARY | Successful, HTTPS read/write through Office proxy |
| 10:44:07.95 | `admin` on NORMAL finds generation 2 lease expired and performs CAS 2→3, **prematurely steals PRIMARY** | Unexpected; no HA3 test armed |
| 10:45:10–10:45:11 | Both EXEs fail `D171_SIM_VPS_NOT_PRIMARY` during `D171_XAC_MINH_VPS_MO_PHONG_LA_PRIMARY`, stop listeners | Failed before HA3 bidirectional exercise |
| 10:44:27 | PDA independently records two test HA3 probes acknowledged by A and B (2/2 each) | Limited diagnostic link SUCCESS; **not** HA3 PASS |

Before the premature takeover, actual `HA3_POLL_SCHEDULE` on Office showed intervals 16.563s, 17.687s, 17.282s, 17.031s, 17.047s; Windows NORMAL showed around 16.6–16.9s. The lease was created/renewed for **16 seconds**. Sample `lease_remaining_ms` was negative by ~2.0s before Office B took its initial turn and ~0.7s before A reclaimed. This directly explains how A can see B expired between B heartbeats. This is a **test-controller startup defect / timer inconsistency**, not evidence that Firestore Office authentication or Agent/PDA route failed.

The Office network probe separately returned authenticated Firestore exact-path HTTP 200 via Windows System Proxy. RTDB REST/SSE via proxy returned 403; direct routes were not demonstrated. PDA was NORMAL and completed limited dual ACK; no production gRPC/RTDB, provider quota or WMS claim is justified.

## Repaired isolated E027 behavior

1. **Startup safety fence:** after B claims initial generation 2, A must **never** preempt B solely because of a small lease overrun before the controlled HA3 test starts. A logs `HA3_STARTUP_GUARD SUPPRESS_PREMATURE_A_TAKEOVER` if B lease expires during readiness.
2. **Explicit authenticated start:** once both agents pass the scoped HA3 READY barrier and 2 probe ACK, B verifies it is still the simulated PRIMARY and deliberately pauses lease renewal. It writes `D171-HA3-PAUSE-B` as an allowlisted PING message in the existing diagnostic Firestore collection. A verifies sender role before enabling its first takeover. No extra Rules, Firebase project or cloud resource.
3. **Heartbeat/sample cadence:** diagnostic HA3 **4-second scheduler threshold and 4-second Poll loop** (previously 16-second scheduler / 8-second loop). Lease TTL remains 16s; keep **20-second failover SLA** unchanged and measure actual latency, not a manipulated PASS. Link rounds 4/5 retain 8-second polling to reduce consumption. Local 550 read/query/350 writes per Agent, PDA 250 writes, 40-minute deadline remain.
4. **Evidence:** record B role, generation, lease remaining, CAS attempt/commit/fencing, signed wait/pause events, sampled CPU/RAM, Firestore GET/PATCH latency. B→A and A→B are measured independently; any SLA MISS/NO_TAKEOVER remains FAIL. Never rerun E023 link 1–3 9/9 as new proof.
5. **Remaining field route:** HA3 only (A NORMAL, B OFFICE, PDA NORMAL), then round 4/5 (both OFFICE) and round 5/5 (both NORMAL), PDA unchanged NORMAL. Client UI E027 and Android versionCode 999927 use a **fresh common pairing seed**; do not mix E026 or E025.

## Release gate and constraints

E027 must prove source contract, Android and Windows compilation, offline replay, authority and continuity at one exact PR head. No Owner live retest should be requested while any check fails; no public repository secret/session/RAW logs. Previous E023 link rounds 1–3 remain PHYSICAL LINK PASS, historical HA3 remains SLA FAIL. New HA3, rounds 4 and 5 are FIELD PENDING. Do not alter production VPS, WMS, real relay lease, Worker, Firestore Rules, Stable or D170. The PR stays Draft until permitted process and explicit Owner acceptance.
