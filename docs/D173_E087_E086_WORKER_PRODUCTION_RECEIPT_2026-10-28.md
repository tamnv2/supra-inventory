# D173-E087 — E086 Production Worker read-only source receipt (28/10/2026)

## Owner scope
Owner explicitly authorized the D173 Stage2 evidence-backed scoped Worker fix and deployment. Only P1: Cloudflare Hibernation `InventoryCore.webSocketMessage` handling unsolicited application frames without exceptions or business mutations. P2 HTTP disconnect/Duration and P3 DO auth double-hop remain HOLD absent route-level root-cause data. No changes to installed Agent153/Android/Web/WMS, Firebase/RTDB/Google Gateway, D172 OBPP business data, SQL schema, Stable or provider resources.

## Verified CODE / CI / merge / live Production
- PR [#775](https://github.com/tamnv2/supra-inventory/pull/775) protected main **MERGED** at exact main source **`50014b1c28f1ae32a5015206c3db8ca2cc41132d`** via Owner release marker `D173-E086_HIBERNATION_WORKER_RELEASE:`.
- Exact code source pin **`39a12576bc06e72e2b05341025789b45af644b1e`** has **29/29 PR GitHub workflow SUCCESS**, 0 FAIL; after receipt pin commit `8602a934bf09d76e32b16c3931a8d9454c7741c9` rechecked **29/29 SUCCESS**, 0 FAIL. Required E086 frame-handler JS executable fixture, service TypeScript, E055 SQL behavioral equivalence, E049 SQLite restart durability, D172 independent auth/private SQL/Sheets, D167 Android ACK and Agent HA checks and security guard all PASS.
- Separate **read-only official production test** [Actions #40600485399](https://github.com/tamnv2/supra-inventory/actions/runs/40600485399), PR [#776](https://github.com/tamnv2/supra-inventory/pull/776): **SUCCESS** at **2026-10-28 06:12:26 VN**. From GitHub-hosted runner GET `https://inventory.supra.cc.cd/health`: HTTP200, `status=ok`, `environment=beta`, `source_commit=50014b1c28f1ae32a5015206c3db8ca2cc41132d` exact match, storage healthy, missing bindings 0. Probe never uses provider auth/Worker secret or runs deployment.
- The Worker identity is technically named `supra-inventory-beta` despite official Production hostname `inventory.supra.cc.cd`. Historical separately-registered Stable remains OWNER-GATED.

## Implementation
`service/src/core.ts`: hibernation `webSocketMessage(ws:WebSocket,message:string|ArrayBuffer)` accepts unexpected bounded client app frames without business side effects, SQL read/write, timers, outbound HTTP or ACK modification. Oversize input safely closes 1009; failed close is contained. Existing `state.acceptWebSocket` + auto `ping/pong` and attachment, roles, realtime delta, presence, primary/standby are unchanged.

## Status separation / TODO
- **CODE PASS / CI PASS / protected main MERGE PASS / official Worker Production source+storage HEALTH PASS**.
- **FIELD PENDING**: installed Web/Android realtime, Office WMS/Agent HA/ACK under actual load and 24-hour post-release Cloudflare Hibernation Errors/Duration must be compared to baseline. This read-only probe does **not** prove exception count is now zero or establish Root Cause at provider stack level.
- **OWNER PASS PENDING**: no automatic owner acceptance inferred from technical success.
- **D172 PENDING/HOLD independent**, no lifecycle merge/closure. **Stable OWNER-GATED**.
- **P2/P3 HOLD**. No ad hoc HTTP timeouts, unproven double-hop removal, E049 lossy aggregate rewrites or new polling.
- Rollback if production FIELD defect: restore preceding Worker source/version without dropping any SQLite/OBPP tables; preserve owner-gated scope.
