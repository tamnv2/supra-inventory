# D173-E086 — Owner-approved Production Worker hibernation safety repair (2026-10-28)

## Authority and scope
Owner command: "Ok em sửa theo đề xuất và triển khai" following D173-E085 phase-1 report. The implementation boundary is existing Production Worker `supra-inventory-beta` and Durable Object `InventoryCore` hosted at `inventory.supra.cc.cd`; separate stable remains **OWNER-GATED**. D172 OBPP is **PENDING/HOLD independently**; shared-Worker source requires full D172 negative/auth/private-SQL/Sheet regression. No new data structures or account/provider bindings. Agent153 Usage continues separately and is left untouched.

### Evidence motivating change
D173-E085 read-only GraphQL comparable matched-hour comparison 2026-10-26 vs 2026-10-27:
- Provider DO SQL rows read 644,427,820 -> 131,187,849, ~79.6% lower, E055 effect plausible but not causal proof.
- DO requests 42,461 -> 56,359 (+32.7%), Workers requests 34,222 -> 46,140 (+34.8%): **no proven DO request amplification**.
- ClientDisconnected HTTP 847 -> 2093, concentrated 13:00–14:59 VN; this is not proof of a business error nor sufficient to change timeout/retry.
- Actual hibernation `scriptThrewException` 69 -> 27, while HTTP exceptions 3 -> 0. Missing `webSocketMessage` source is a concrete hibernation error candidate; provider stack still not verified.
- 19:00–20:59 VN DO duration spike is not attributable to a specific path yet. Duration per request at full matched window remained near flat; no blind hibernation/alarm redesign.

## Implementation — narrow P1 only
`service/src/core.ts` implements `webSocketMessage(ws,message)` for the existing Cloudflare Hibernation API. The existing inventory realtime contract is **server-to-client only**, confirmed Web client has no outbound application messages. Existing `state.acceptWebSocket` and `setWebSocketAutoResponse("ping","pong")` remain; benign unsolicited frames are ignored, and >2048 unit text/binary frames are closed with 1009. No parsing, payload logging, SQL, Firestore, timer, network, retry or acknowledgement mutation. Existing `webSocketClose` and `webSocketError` remain presence-neutral. No client or WMS changes.

Source fixture `tools/d173_e086_ws_regression.mjs` uses installed TypeScript compiler to execute the isolated handler on mocked sockets, exercising text/binary benign frames, too-large frames, already-closing sockets, forbidden side effects and server-push client contract.

## Explicit HOLD (no speculative repair)
- P2 HTTP client disconnect: require route/client correlation and proof of unnecessary cancellation before changing timeout, retry, scheduler, WebSocket reconnect or in-flight WMS transactions. In this scope source-only non-mutating review is allowed.
- P2 DO duration: need specific active wake-up/Alarm/WS cause, not merely account-level billable duration, before adjustment.
- P3 duplicate authenticated business DO hops: source shows potential `requireUser -> user lookup -> mutation`, but no route volume attribution; do not change RBAC/sessionGeneration or request count until measurable proof.
- E049 lossless durable SQLite telemetry and E055 SQL are unchanged.

## Release gates
Branch -> Draft PR -> exact TypeScript compilation, runtime frame fixture, E055 SQL fixture, E049 restart durability, D172 independent tests and D173 worker isolation -> source pinned Owner release receipt -> protected main merge with exact marker -> official Worker health/source schema/readback. Do not upgrade Web/Android/Agent, Firebase/RTDB, Gateway, Stable or D172. Rollback restores previous verified Worker source, preserving all SQLite tables.

Owner authorized scoped Production release contingent on passing gates; **CODE/CI/RELEASE/FIELD/OWNER statuses remain distinct**. Never infer hibernation exceptions have disappeared until actual provider 24h or safe A/B comparison. If source proves insufficient to reproduce, hold unverified P2/P3 instead of implementing guessed changes.
