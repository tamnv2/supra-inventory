# D169: Agent–PDA two-network read-only connectivity probe — 16 October 2026

**Authority:** D169 research/evidence, NOT a provider migration, account provisioning, Agent/Android release, Owner final PASS, or Stable authorization.

## Evidence and coverage

Owner supplied one ZIP containing two locally generated reports from the same Windows x64 probe v1.0.0, each 42 public targets × 2 rounds. Sanitized summaries only; never commit raw reports, client IP, SSID, device/user identifiers, credentials or company proxy details.

- Internet-capable network: 15:48:41–15:48:51 Vietnam local time; 84/84 DNS OK, 84/84 direct TCP OK. Classification 76 REACHABLE_HTTP_UNAUTHENTICATED, 4 REACHABLE_AUTH_REQUIRED, 4 TLS_OK_BUT_HTTPS_UNCONFIRMED (MQTT test ports).
- Corporate network: 15:49:10–15:50:13; 84/84 DNS OK, 10/84 direct TCP and HTTP responses (8 unauthenticated host probes, 2 auth-required), 74/84 direct TCP FAILED (54 TIMEOUT, 20 net.OpError). Success and failure results reproduce in both rounds by endpoint.
- Corporate direct HTTPS responders are **only five Google-hosted public API hosts**: Firebase Identity Toolkit, Firebase Installations, Firebase Secure Token (404 to root probe path), Google Drive API (401 expected without credentials), and Google Sheets API (400/404). A 401/403/404 demonstrates an HTTPS response, not authorization, functionality or realtime availability.
- Corporate direct TCP probes FAIL 2/2 for Firestore API, existing Beta RTDB endpoint, existing Beta Cloudflare Worker /health, FCM HTTP v1, Google Pub/Sub, Apps Script entry/redirect, Google Cloud Run/Storage, Ably REST + WSS, Pusher REST + WSS, Supabase, Appwrite, PubNub, MQTT/EMQX, AWS, Azure and other third-party candidates.
- On the Internet-capable network, Ably and Pusher WSS edge probes both received 101 Upgrade in both rounds; MQTT TLS handshakes passed on both MQTT-only target ports, but no authenticated MQTT publish/subscribe proof.
- Probe environment-proxy flag is false on both reports. **v1 does not follow native Windows PAC/WinINET proxy choices** for raw DNS/TCP/TLS, and HTTPS only considers environment proxy. Real Agent code `relay-agent/FirestoreHttpTransport.cs` applies `WebRequest.DefaultWebProxy` and `WebRequest.GetSystemWebProxy()` with default Windows credentials on bounded safe-read retries; `RtdbHaLiveness.cs` also uses a WebRequest Windows-proxy path. Hence v1 direct failure must NOT overrule prior live Office Firestore observations: an authenticated Office Agent may reach a service through Windows corporate proxy even though raw direct TCP fails. This is the leading reason to develop a *proxy-aware* Stage 2 tester, **not** proof that any specific proxy succeeds.
- No network-layer route, proxy rule, TLS-intercept policy, exact tenant URL, WebSocket HTTP CONNECT tunnel, authenticated streaming subscription, publish, durable ACK, field failover time, Android background notification, response-to-command receipt, or provider-billed usage is measured by this ZIP. Labels identify human-selected test profiles but do not capture and validate SSID or network policy. Do not classify provider hosts as intrinsically blocked with certainty.
- Evidence checksum of supplied ZIP (SHA-256): `6d437d7b7d8e284d7aaf7b2cecf95dbe4406668d5760a504380632002f3a4f68`; the raw ZIP remains in Owner's private uploaded conversation, not the public repository.

## Usage/free-tier relevance (not a price/compatibility guarantee)

Official provider pages checked 2026-10-16:
- Firestore Standard eligible free database: 50k document reads/day, 20k writes/day; shared by every consumer of this database; listener updates may bill reads.
- Google Pub/Sub Basic: first 10 GiB/month Message Delivery Basic throughput across billing account; 1KiB minimum per request and extra ancillary data transfer/retention/storage. Corporate **direct endpoint failed**; proxy path is unverified.
- Ably Free: 6M publish+delivery messages/month, 200 concurrent connections/channels; appropriate for proof-of-concept, best-effort SLO. Corporate direct REST and WSS both failed.
- Pusher Sandbox: 200k messages/day, 100 concurrent connections; corporate direct WSS/REST failed.
- Supabase Free realtime: 2M messages/month, 200 peak concurrent connections plus separate data/egress limits; corporate provider host probes failed and were not tenant realtime endpoint tests.
- PubNub Free: 200 monthly active users **or** 1M transactions/month, whichever limit is reached first; testing keyset is not a production authorization.
- These differ by billed unit and capability; do NOT translate one message into one Firestore document read, or infer monthly quota from reachability.

Illustrative *not billable forecast*: one 10-second heartbeat source emits 5,760 publishes/16h or 8,640 publishes/24h, equating to 172,800 or 259,200/month respectively at 30 days. An Ably-like 1 publisher + 10 receivers would involve approximately 1,900,800 or 2,851,200 message units/month **for this one stream alone** before reconnects, HA transitions, job/contact traffic or any other service-specific billing. Multiple independently publishing agents or more listeners multiply traffic. This illustrates why eliminating useless queries and global fan-out is safer than assuming a 6M tier is unlimited. Actual fleet size, receipts, message fan-out and field meter are not known.

## Impact and recommended next stage

| Flow | Field finding | Gate for choosing a replacement |
| --- | --- | --- |
| PDA→Agent PickList and terminal ACK | Current Firestore design, v1 direct Office failures conflict with established proxy-aware code path | Keep durable same-ID job, 12s admission, ~20s ACK semantics, WMS fences and one terminal ACK until an authenticated cross-network substitute is field proven |
| PRIMARY/NEXT_A HA | Office RTDB raw direct failure; Firestore common transport still needs proxy verification | Coordinate common RTDB or exact Firestore lease listener per responsible peer, 15s suspicion SLO, CAS/generation and anti-split-brain; no permanent two-way heartbeat |
| Call/chat/presence | Firebase paths remain baseline; 3rd-party direct edges fail Office | Preserve per-picker targeting, FCM background wake, anti-spam, dedupe, one authority, no added fleet fan-out |
| Kick/Worker revoke | Office direct Worker health failed | Do not claim kick works through Firestore alone; server Core revoke authority + receipt required, bridge only after approval |
| All components | No authenticated tenant traffic or bill proof in diagnostic | Compare provider billing/free caps on matched fleet-hour and business-event counts before migration |

**Recommended sequence**:
1. Preserve deployed Firebase/Worker; first triage proven unused legacy Firestore query, duplicate HA read/retry and redundant status fan-out under later explicit Owner implementation approval.
2. Build/field-test **diagnostic only**, with native Windows proxy default/system selection and no leakage of proxy host/credentials. For each previously failed endpoint report DIRECT vs DEFAULT_PROXY vs SYSTEM_PROXY (avoid credentials/URLs containing secrets), HTTP status/latency, and optional WSS upgrade through explicitly allowed proxy tunnel. No bypasses of corporate filtering or new authentication.
3. Use existing Agent sanctioned diagnostics to prove whether authenticated Firestore exact document listener/REST and RTDB stream work while in Office, with network-change and 401/403 origin distinctions. Separate token/rules errors from TCP/TLS/proxy denials.
4. Only if a candidate is Office+Internet reachable under approved security policy, propose one specific registered *test* tenant/client, controlled authenticated two-way publish/subscribe, durable ACK receipt/ordering, disconnect/reconnect/failover, p50/p95 latency, exact quota and security checks before adding any resource to `ops/project-scope.json`.
5. Continue `D169` PR #606 as Draft/UNMERGED under code-only gate. No Agent EXE or Android APK release, provider change, WMS mutation or Stable access from this evidence alone.

Relevant canonical sources: `docs/D169_AGENT_PDA_ADAPTIVE_MODEL_2026-10-16.md`, `docs/D169_USAGE_NETWORK_ANALYSIS_2026-10-16.md`, `relay-agent/FirestoreHttpTransport.cs`, `relay-agent/RtdbHaLiveness.cs`, `ops/change-continuity/D169.json`.
Provider reference URLs: https://firebase.google.com/docs/firestore/pricing ; https://cloud.google.com/pubsub/pricing ; https://ably.com/docs/platform/pricing/free ; https://pusher.com/channels/pricing/ ; https://supabase.com/docs/guides/realtime/pricing ; https://www.pubnub.com/docs/pricing/overview .
