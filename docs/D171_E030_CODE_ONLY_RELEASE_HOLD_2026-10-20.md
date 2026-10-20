# D171-E030 — Agent two-mode code-only; Owner post-shift release gate

Date VN: 2026-10-20. Owner authorizes completing production-target source/CI **only**, and expressly withholds any Agent/PDA distribution, main merge, provider live mutation or official Worker change until a new explicit post-shift command. D170 paused/unaccepted, D169 accepted base, legacy Stable OWNER-GATED. Implementation Draft PR #656, isolated diagnostic PR #655 untouched.

## Locked design & impact
- VPS is preferred long-lived PRIMARY; already registered Firestore exact `relay_poc_jobs/{request_id}` and durable ACK remain the one source of truth to all 40 Internet-only PDA devices.
- Agent's existing Firestore REST HTTPS proxy-capable path is the universal fallback on Office/Internet; gRPC fast listener is optional acceleration on a reachable route; RTDB only existing optional HA heartbeat; no RTDB PickList bus and no new Google Function in this code change.
- Up to six Agents including VPS. Design load: 2,000 PickList, 200 Kick, 300 Call, 500 Chat/day, 20 PDA/5s bursts. Never enable fleet-wide high-frequency polling. Usage 90% eligible free tier target is unverified forecast, not guaranteed savings.
- Agent production baseline v139. Preserve Firestore generation-CAS, 10s lease/15s stale condition, WMS readiness and single WMS executor; requester-side 20s/35s wait and immutable request ID; manual-holder VPS return consent.
- Directly affected: `relay-agent/D168NetworkRoute.cs`, `relay-agent/Program.cs`, `relay-agent/FirestoreConfirmationTransport.cs`, targeted tests. Indirect regressions: Android vc114 exact ACK compatibility, Firestore Rules/Indexes unchanged, WMS mutation fencing, RTDB, Kick/Call/Chat, Agent OTA.
- Agent-only is preferred: Android vc114 already writes the same request ID and listens to the same terminal ACK. **No official APK source/version/signature change in this PR**. If compatible replay fails, stop and request new review; never silently force PDA updates.

## Code-only source changes
- Five-second network-classification cache with event invalidation; UNKNOWN fail-closed and optional RTDB eligibility unchanged. Do not treat the Windows Wi-Fi classification as PRIMARY authority.
- REST watchdog uses a single in-flight bounded HTTP query without blocking newly-received gRPC work. Result processing only on the existing serialized PRIMARY business loop, generation + authenticated user fenced; stale results dropped; no background WMS mutation or terminal ACK.
- Tests updated to verify actual new fail-closed marker and preserve exact protected production Firestore Rules against baseline, allowing only the previously deployed isolated D171 Rules block in diagnostic namespace.

## Acceptance and deferred release
- SOURCE CODE / CI PASS requires exact PR-head Windows build, auth/session/generation replay, mixed-version Android schema test, WMS UNCERTAIN (post-click) no-double-confirm replay, Office proxy outage, 20 PDA/5s replay and authority+continuity guards. A green isolated diagnostic build does **not** prove production FIELD PASS.
- **No merge into main; no releases, OTA manifests, Beta/Stable runtime, live Firebase Rules, new Functions, production Worker, WMS or official APK changes** until Owner posts `triển khai cập nhật` after shift. Stage deployment first to standby; verify authoritative roles and rollback; only then upgrade VPS. Owner may withhold release if metrics or canary are unsafe.
- D171 historical E023 23.4s simulated SLA miss remains in evidence even if E028 later 19.469s controlled simulation passed. Production failover and provider-billed usage still unverified.
- Test data `d169_diag_sessions`: Owner requests cleanup once evidence sufficient. Preserve sanitized evidence first and perform exact-session scoped readback/deletion with authorized Firebase provider access, including subcollections, not root project/database and not `relay_poc_jobs`. **No deletion has happened**. The Firebase integration was explicitly declined for this session; no provider write authority exists here. Do not publish raw private device/session logs.

## Safe future cleanup
Only after Owner archival verification and provider readback, enumerate the precise D171 session document IDs and their `members/messages/receipts` subcollection documents; export/check evidence, delete exact children then parents in reviewed batches, read back absent, and separately review removal of D171-only temporary Firestore Rules. Retain all unrelated Firestore production collections and historical audit. Deleting documents does not require or imply deleting the test code or the scoped security guard in this CODE ONLY change.
