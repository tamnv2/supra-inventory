# D168 — Office/PDA routing, shared Firestore usage, and Picklist success ACK
Date VN: 2026-10-14. Decision capture / technical analysis ONLY. No code, deployment, runtime/WLAN mutation, Stable Owner-gated.
References: D168-E016 and docs/D168_AGENT_SKU_JOB_WIFI_ROUTING_OWNER_2026-10-13.md.

## Newly accepted Owner constraints
- Keep Firebase Auth/Firestore for critical dual-network flows: Agent login/token refresh, Picklist confirm request and terminal ACK, Picker online presence, Agent fleet/PRIMARY/standby shared state, inter-Agent SKU job status; live PDA delivery and HA remain operational on Office and ordinary Internet where proven.
- Optional, delay-tolerant Agent operations can use the registered Inventory Worker directly, with managed approved saved Wi-Fi switching on demand. Retain Firebase/FCM signalling when Android requires it, even when Worker is command authority. Reuse existing paths instead of rewriting for savings not proven.
- On click of an Internet-requiring action, do a bounded actual Worker reachability check and show a modeless topmost prompt if not reachable. Skip defers or cancels the requested operation as appropriate; agree authorizes switching when safe; no interaction for 60 seconds authorizes NETWORK SELECTION ONLY once idle and safe. It never authorizes kicking a user, changing privileged settings, overriding OTP/role/double confirmation, bypassing Windows IT policy, or interrupting live Picklist or sole PRIMARY.
- Continue the prior requirement: WMS read-only XLSX export before switching network; valid SKU job admission survives HA PRIMARY change, Worker authoritative DONE, no duplicate job; one sanitized shared state update per transition, not per SKU chunk.
- Drop Agent Usage UI, quarter-hour monitoring and Usage ZIP from future version, preserving operational/history/error logs and Drive ACK for retention. Owner may supply cloud dashboard screenshots.

## How Office detects direct Worker block
An Office-only Agent may attempt ONE small read-only HTTPS call through its actual configured proxy/adapter when an action needs Cloudflare. If it succeeds with expected service identity, route is usable. DNS failure, timeout, unexpected corporate proxy response/captive portal means the route is not proven. An authenticated Worker-generated 401/403 means reachable but unauthorized; switching Wi-Fi is not the fix. SSID helps choose a candidate, not proof of Cloudflare reachability.
Coalesce identical action-triggered probes (single-flight), cache by network/profile/proxy change epoch with short TTL, avoid periodic ping. Prefer reusing an existing business read-only request (e.g. SKU schedule for actual work) rather than an additional probe, and do a final validation after switching. Probe success does not prove a later POST was committed; business receipt is authoritative.
**Discovery:** service/src/index.ts GET /health calls checkCore, launcher-folder Core read, and migrateActiveAdminFirebaseCredentials; this is NOT a cheap side-effect-free network probe. DO NOT use /health for automatic reachability checks. A dedicated tiny read-only capability endpoint would require later Owner code approval.

## Source-verified Picklist transport and answer to success-only suppression
- Android RelayPocClient.kt creates one relay_poc_jobs UUID document with status PENDING (one document write), starts a listener on that exact document, waits for ACK, then uses a bounded one-time Source.SERVER read if ACK was not observed before the roughly 20-second timeout.
- Agent FirestoreConfirmationTransport.cs TryAck commits the SAME document as ACK, storing lookup_status CONFIRMED/ALREADY_CONFIRMED or typed failure and metadata. Terminal ACK currently takes ONE Firestore job-document write. Daily counters are reconciled separately in a bounded aggregate checkpoint rather than an extra write per result.
- PDA PickerController.kt resets the input, reenables UI, clears candidate entries and displays success after receiving CONFIRMED ACK. Without successful ACK, PDA waits, server fallback still sees PENDING, reports unknown state and may submit another request after WMS actually confirmed. That compromises latency, correctness, retry, guard and operator audit.
- There is NO evidence in the inspected Picklist-confirm source of a separate second Firestore success write or FCM success push. Hiding local success UI would save zero document operations. Dropping the ONLY success ACK might avoid one terminal document write plus one listener read on a successful request, but carries severe failure and repeat-confirm risk. **Recommendation: retain durable ACK success AND failure; simplify UI/payload only as desired. No Owner code approval or acceptance to drop the success ACK is inferred from the Owner asking for evaluation.**
- Compact metadata can save bytes but not Firestore document write count. A separate duplicate success push, if found in another component, can be removed without eliminating terminal ACK. Preserve unique request ID, idempotency, CAS, accurate terminal reason, Worker-visible audit and daily counters.
- Official Firestore billing: https://firebase.google.com/docs/firestore/pricing — per-document writes; per-listener reads on document update; reconnect can induce full re-query. No measured operations/day or provider-delta from actual D168 field A/B is yet proven.

## One vehicle for compatible workloads; not one document for everything
Current relay-agent/FirestoreAgentSync.cs stores pickers_json, calls_json, kicks_json, fleet_json, counters and picker_history_json in an existing shared agent_sync document. Already does RAM snapshot reuse, updateTime CAS, SKIP_NO_CHANGE and history piggyback on counter change. Reuse the **existing listener**, no new Firestore heartbeat, and piggyback only compatible same-cadence low-rate status/revisions for SKU upon RESERVED/RUNNING/DONE/FAILED if existing schema and rule limit permit.
However, writing a shared document causes updates/read events on ALL watching Agents: one new shared-doc write may cause an update read on each listener, and payload/retry contention increases when unrelated hot data is bundled. Avoid new every-second writes for SKU, UI, network probes or log progress. Keep hot, latency-critical Picklist request/ACK and HA lease isolated from cold batching. If splitting proves cheaper, derive event families based on **authority, recipients, latency, cadence** rather than one giant document.
- Hot: direct per-request Firestore PENDING->ACK, HA leadership/generation/WMS. No intentional latency.
- Warm: event-only Picker login/logout/version, Agent fleet role changes, SKU job status revisions, compatible shared snapshot/diff; no periodic rewrite on empty no-change.
- Control: single/all Picker revoke with Worker authority then existing Firebase Android session signal; call-home/chat target + TTL + ACK via Firebase/FCM when immediate PDA notice needed. Verify exact PDA receipt and global 60-second lock; do not conflate network-switch consent with revoke consent.
- Cold: daily counters/history piggyback, local diagnosis, uploaded sanitized log ZIP/bundles on network-available events and Drive receipt, no Google Cloud Monitoring Agent polling.
- Every write: owner single-writer/fence or CAS, dedup event id + revision; every read: reuse listener snapshot, bounded reconnect reconcile, no extra per-tab refresh if same snapshot already received.

## Operation route matrix
| Operation | Default network/provider | Switch eligible? | Risk |
| --- | --- | --- | --- |
| Firebase session login/token refresh | Google Firebase Auth, dual network | No | Critical |
| Picklist request, WMS confirm, durable terminal ACK | Firestore + Office WMS | No | Critical latency/HA |
| Online Picker projection, Agent fleet role, HA, SKU job small shared state | Existing Firestore channel | No | Critical shared correctness |
| Automatic/manual SKU | Office WMS read first; then authenticated direct Worker on Internet | Yes, after safe job admission and HA guard | Cannot double publish |
| Single or bulk Picker Kick | **Already direct Worker** for authoritative revoke; Firestore/PDA receives logout signal | Yes, after existing 1x/2x business confirmation | Don't kick stale new session |
| Active call home / chat / resolve | Existing Firestore/FCM; optional future Worker request API | Potentially | Keep full-screen notification and 60s lock |
| Agent self update / manually requested noncritical data | Internet Worker | Yes | Only idle/allowed |
| Support/error logs | Local then existing Drive verified storage; Worker direct path conditional | Potentially | Never prune before Drive receipt |
| Agent Usage UI and ZIP | Removed from future new Agent | N/A | Old gateway endpoint temporarily for older Agent compatibility |

## Validation prerequisites (NO CODE)
1. Check real Office and PDA TLS/proxy route with existing single read-only service call; classify Worker 401 vs proxy 403; avoid /health.
2. Standard Windows user access to approved saved Wi-Fi profile, source WMS on Office, safety of single PRIMARY failover and 60s idle prompt; no unknown external network profile.
3. End-to-end Picklist PENDING->CONFIRMED ACK at current SLA in both networks and under HA switch, packet loss/ack loss/20-second timeout; document exact reads/writes before and after.
4. Measure existing agent_sync change frequency/number of listeners/payload and CAS retries; choose split only with actual benefits, never sacrifice latency.
5. Cross-agent SKU job grant + DONE/fingerprint/lease expiry and takeover while original owner loses PRIMARY; no status projection can overrule Worker Core.
6. Compare Apps Script UrlFetch, Firestore reads/writes, Cloudflare Worker/DO writes/rows, client power and network time before and after; savings must be proven, not guessed.

Permission boundary: these are Owner-approved ROUTING PRINCIPLES and technical proposals. No command to run code, PR merge, Agent EXE build or Beta deploy. Stable always Owner-gated.
