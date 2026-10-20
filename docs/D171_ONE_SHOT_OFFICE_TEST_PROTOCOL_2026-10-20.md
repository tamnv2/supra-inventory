# D171-E023 — One-shot Office field protocol and bounded architecture test (2026-10-20)

**STATUS:** Owner-approved diagnostic design / isolated test implementation only. No production Agent, Android, Worker, WMS, real PRIMARY, live Kick/Call/Chat, or Stable change. D170 paused; D169 accepted. D171 FIELD/OWNER PASS not inferred. Reference [D171-E022](D171_TWO_MODE_IMPLEMENTATION_SCENARIO_PLAN_2026-10-19.md).

## Identity and topology
- **Agent A** = authenticated `admin`, normal non-VPS Agent; can become simulated PRIMARY when VPS emulator is unavailable. **Agent B** = authenticated `tamnv2`, simulated long-lived VPS PRIMARY. **PDA** = authorized test Picker `100`, always NORMAL Internet.
- B is a *logical* VPS model, not the running VPS host. During five network-probe rounds B sometimes changes to OFFICE to validate transport compatibility; this does not model the VPS physical networking. An actual VPS network latency/availability claim needs authorized VPS-side evidence; never infer it from B.
- Preserve the exact three-account / 2 EXE + 1 APK test topology; 6 Agents/40 PDA exist **only as local simulation**. No production session, WMS, PRIMARY lease, `relay_poc_jobs`, Worker mutation, OTA or real contacts may be used.
- Reuse only the registered `d169_diag_sessions` namespace on existing scoped Firestore. Fail-closed on unknown resource; no new database, Firestore function, Rules or RTDB business route without separate scope and Owner approval.

## Preflight before the one remaining Office visit
1. Build both diagnostic clients from **one exact PR head SHA**, including independent Windows pairing/identity selftests, Android source contracts, Firestore Rules emulator unauthorized-claim checks and D171 28-scenario simulation. Require all matching CI PASS; obsolete artifacts are invalid.
2. On NORMAL and **without making a physical five-phase Firestore run**, validate install/start/login separately on both Windows and PDA; verify exact Firebase uid to Worker user binding, role scope, unchanged service production endpoints, valid saved network profiles, system proxy configuration, clocks and device connectivity.
3. Run the offline 5-round coordinator rehearsal and adversarial scenarios first: premature phase announcement, delayed ACK, phase mismatch, stale session, UID mismatch, wrong account, 401/403, network timeout, duplicate receipt, source-level budget exhaustion and reconnect. Every negative case must fail closed, and genuine PASS must require A 9/9, B 9/9 and dual 9/9.
4. Preserve sanitized local logs; do not delete past test session or alter Rules to make tests pass. Check current session-day collision and archive/approved cleanup before a **new** live run; never reuse stale run IDs.
5. Only then begin the single Office field attempt. The field UI must show the exact account that needs switching, the expected NORMAL/OFFICE mode and **authenticated Firestore route readback** after physical switching. Operator confirmation is not independent SSID proof. PDA never switches networks.

## Field sequence (A=admin; B=tamnv2)
| Phase | A | B | PDA | Completion barrier |
| --- | --- | --- | --- | --- |
| P0 | NORMAL | NORMAL | NORMAL | Both Agent ready; A 9/9, B 9/9, dual 9/9 |
| P1 | OFFICE | NORMAL | NORMAL | Same, after fresh A Office route proof |
| P2 | NORMAL | OFFICE | NORMAL | Same, after fresh B Office route proof |
| P3 | OFFICE | OFFICE | NORMAL | Same, after fresh A+B Office route proof |
| P4 | NORMAL | NORMAL | NORMAL | Same, after fresh restoration proof |

No advance after a failure or timeout; report precise failed node, role, phase, network and error code. Do not forge PASS or automatically fall through. An Office route that cannot perform authenticated Firestore read/write is **NOT PROVEN**, even if DNS/TLS works.

## Mandatory data capture
For every message: run ID, phase, request ID, network epoch, sanitized node alias, route (normal/direct/system-proxy), bearer-auth success, phase readiness, send/receive/ACK monotonic clock, p50/p95/p99 and min/max latency, retries, backoff, duplicate rejection, timeouts, HTTP status class and payload checksum. Record all three devices' **independent** counts and step-completion receipts. For synthetic WMS, record queue delay separately from network delivery and processing.
For leadership: incumbent, term/generation, lease age, WMS-ready simulation, CAS winner/loser, fencing, no-replay, UNKNOWN post-click behavior, manual-holder consent and VPS handback at safe boundary. Never mutate real WMS or coordination.
For usage: local HTTP attempts/response counts, delivered document-count estimates, write attempts, Firestore billed project metrics if authorized and available, index/Rules/listener uncertainty, RTDB downloaded bytes, Cloud Function/Gateway estimates separately; keep local counters **distinct from billed** provider usage.

## Physical test budget: fail closed, not a spending guarantee
- **Physical live run:** 5 × 9 synthetic PDA messages, bounded Agent peer messages; no stress fan-out, no real business mutations. Stop after 40 minutes, 550 HTTP read/query requests or 350 writes per Windows Agent, 250 writes on PDA, whichever occurs first. Use a bounded history query with maximum document results and listener lifetime/cleanup; no infinite 401/403, stale-phase or retry storm.
- These are **client-side operational caps**, not exact billable Firestore quota nor an account-wide charge ceiling. Quota safety also requires Firestore Rules scope, no test outside allowlist, auto stop on local budgets, fail-closed retries, no continuously polling idle test process, and review of shared project usage before the attempt.
- No real 40-PDA or 2,000-PickList load on production Firestore. Run 6-Agent/40-PDA/2,000 PickList/200 Kick/300 Call/500 Chat plus 20 PDA per 5 seconds **entirely in local emulator/simulator** and calculate usage scenarios; model test request profiles against small scoped physical samples. Do not call Worker/Functions/RTDB for synthetic load.
- Compare usage to **total** eligible project daily free tier budget; target headroom <=90% at observed + forecast operations (Firestore Standard reference 45k reads/18k writes). Unverified billed metrics must result in `BILLING_UNVERIFIED`, never a promise of <=90% or zero spend. Cloud budget alerts by themselves do not hard-cap costs.

## Required deterministic fault matrix
At minimum, cover D171 S01-S28: healthy VPS fast listener, listener down with REST watchdog, Office proxy-only REST, gRPC/RTDB 403, VPS crash, asymmetric partition, WMS not ready, simultaneous CAS, safe handback, manual holder consent, UNKNOWN post-click, duplicate/retry, PDA offline, network switch, in-flight switch deferral, proxy/auth failures, Office Worker side effect with unavailable Function (fail-closed), Function cold start/duplicates mock, Chat/Call offline, Kick/session revocation race, peak burst, operator events, 70/85/90/95 usage governor, freeze/day rollover, mixed-version rollback, SKU/log contention, stale ready/replay and shared-project billed usage.

## Decision report: required evidence / gates
- Separate `FIELD_PASS`, `OFFLINE_SIM_PASS`, `SOURCE_CI_PASS`, `BILLING_VERIFIED` and `OWNER_PASS`. These are never interchangeable.
- Report for VPS healthy, VPS unavailable with normal-Agent PRIMARY, VPS unavailable with Office-Agent PRIMARY: recommended transport, accepted/suspect routes, lease/refresh/retry/listener/watchdog intervals, p95/p99, duplicate/failover proof, forecast billable reads/writes and uncertainty margins.
- Proven unsafety (double-primary WMS, fake ACK, unsupported Office auth route, broad Rules, unbounded writes/queries) blocks any live field attempt. Unmeasured true Office route remains UNKNOWN; simulation cannot turn it into FIELD_PASS.
- Branch→Draft PR→CI authority/continuity/source checks→exact artifact SHA; release/test only under Owner-approved D171 isolated scope; never merge or deploy production as a side effect. After proof, present separate impact/security/quota review before any production change.

## E024 field-failure repair: separate HA SLA and physical-network barriers

The actual 2026-10-20 field visit provided physical A/B/PDA ACK evidence for rounds 1–3 and Office authenticated Firestore REST via System Proxy for both Office Agent roles; **rounds 4–5 remain unverified**. The primary test controller aborted at exactly 20s even though the opposite Agent CAS succeeded approximately 23.4s after lease renewal stopped. This is a **20s failover SLA MISS** plus a **test control-flow fault**, not a blanket Office transport failure.

Revised diagnostic procedure **does not extend the 20s target**. On expiry, log `SLA_MISS_20S_CONTINUE_OBSERVATION`; keep bounded observation to 45s and log late CAS versus no CAS separately. Complete the independent five-phase ACK path if physically available and safe. Even if all five network rounds complete, do not announce full technical/Owner PASS while HA SLA misses remain. Preserve all original evidence privately and avoid requesting an additional Office trial solely because the harness blocked rounds 4–5. See `docs/D171_E024_FIELD_FAILURE_ANALYSIS_2026-10-20.md`.
