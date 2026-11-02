# D173-E123 — Owner-approved production package (03/11/2026 VN)

## Owner decision / authority
Owner expressly approves CODE, CI repair within the approved scope, and gated Production Worker/Web + signed Agent + signed Android deployment. Continue finite repairs to real CI/release failures; never infer a pass before evidence. This is still D173, not a new Dxxx. Stable is OWNER-GATED; D172 OBPP1291 remains independent PENDING/HOLD. No D172 business changes; shared Worker/auth demands independent D172 regression. No new Cloudflare resource, Firebase Rules, offline transaction mode or database recreation.

## Final shift rule — overrides D149's shift-close keep-login policy for Picker only
- The authoritative InventoryCore Android Picker session start timestamp (UTC SQLite CURRENT_TIMESTAMP) fixes one deadline per login.
- Login before **10:00 Vietnam** -> automatic logout at **14:00 same day**.
- Login from **10:00 through 21:59:59 Vietnam** -> automatic logout at **22:00 same day**.
- Login at or after **22:00** is a **new overtime login**, never immediately killed by the elapsed 22:00 boundary; the next 22:00 is its expiration. Existing overtime/operating-window business gates still apply; overtime is not created by logging in.
- 15 minutes before deadline, show a small nonmodal top-right warning like the existing SKU warning, with short text. At deadline logout automatically, no confirmation, no cancellation. Picker may login again after automatic logout if currently authorized operating window permits business actions.
- Server rejects expired Picker interactive session on Worker and InventoryCore authorized paths even when the Activity is suspended/offline; new login gets new generation. Reporter/Admin/Web/Agent/OBPP are excluded. No new cloud polling. Already committed business results must never be replayed; WMS uncertain outcome remains protected. Offline business creation remains forbidden.
- Client clock is display/scheduling only; use the server login time and server clock offset. A delayed/background Android UI reconciles on resume, but never claims client-side timing alone is server enforcement.

## Approved additional scope and safety
1. Optimize InventoryCore `RECENT_ACK_TOTALS` (dominant observed SQL read hot path, 183311629/213051618 measured rows), recent/result and Picker page/count only where actual fixture parity proves no count/version/filter/paging discrepancy. Measure DO Requests and SQL rows/read-write against comparable source/volume; do not reimplement already-shipped E109/E110 P1–P4 as brand-new optimizations.
2. Review remaining redundant HTTP/WS hedges, same-ID fallback, post-mutation refresh, bounded reconnect, background notification/maintenance and health. Preserve accepted ACK/HA/WMS/real-time functionality and billing attribution; no synthetic savings claims.
3. E117: one Firestore CAS decision for overtime/shift/VPS PRIMARY/15m deferral; cross-Agent observation closes obsolete prompts and updates PRIMARY/standby. Preserve manual-holder/handoff safety, current technical business time windows, and no blind polling.
4. Agent↔PDA: retain server-created timestamps, 12s gate, single WMS mutation, verify-only after UNCERTAIN, transaction-idempotent ACK; add sanitized event details only for gaps not yet observable. No automatic WMS final-click replay.
5. E120 clarification supersedes original E120 backlog: **split PDA Picker and PDA Reporter filters only in the Agent session roster**, never two APKs or new Firebase apps. Reporter read-only; Picker action RBAC unchanged. Existing Agent sync and Reporter projections only, no new cloud calls.
6. E121: Web Presence uses current WebSocket evidence, explicitly distinguishes connected from historical login/unknown; no extra requests, heartbeat or Firestore writes. Do not claim human activity solely from a socket.
7. E119: only record diagnostic own-PID native-window class/owner/style and sampled lifecycle. No hiding Windows from other processes, no title/tokens in logs; fix UI only after cause established.

## Release gates
- Source exact-head CI must pass TypeScript, native Win64 Agent build/startup, Android debug/JVM/signature safety, SQL parity, Picker cutoff boundary tests, supported transport/ACK/WMS/HA, auth and security, and D172 isolation.
- Required branches/PR + docs/state/owner decision in same D173 change set; preserve source pin in merge ancestry. Worker/Web first, Agent signed OTA second, Android signed APK/manifest third. Verify official Worker /health source+storage, tags/channel hashes and scoped releases. Do not deploy Stable, D172 standalone, Firestore Rules, Gateway or unrelated provider resources.
- FIELD/BILLING/OWNER PASS separately require live device and normalized usage verification. If a step fails, repair same E123 branch/PR and rerun; never label a failed release DONE.
- Preserve current production E122 Worker/Web + Agent163 + Android vc123 until release gates pass. No forced data migration.

## Current status
CODE IN PROGRESS on E123 branch; CI/production not yet asserted. The current draft must not be merged/published before end-to-end checks confirm every approved component and the release authorization is pinned.
