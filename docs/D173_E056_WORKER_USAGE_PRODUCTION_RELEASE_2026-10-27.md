# D173-E056 — E055 usage Worker production release receipt (27/10/2026)

## Technical evidence
- Scope: one official Production Worker `supra-inventory-beta`, hostname `inventory.supra.cc.cd`, InventoryCore SQLite. Existing technical beta identifier; historical separate Stable OWNER-GATED.
- Owner ordered Group 1 code optimization then Group 2 source-based usage diagnosis in the same D173.
- Source PR #753 merged protected main commit `36a87805d66e9356915b47303ac7fa2597697b09` with `D173-E055_EXISTING_WORKER_RELEASE:` marker; final PR head `80f4e0e4bbd8ccb81e030027193ad9ef8380083f` had 24/24 GitHub PR workflows SUCCESS.
- Source-pinned receipt `ops/d173-e055-worker-release-authorization.json`: tested source `fa6405f97e6d431703e68534cfdce89da5f0875c`, D172 independent regression and SQL/TypeScript tests passed.
- Worker GitHub Actions release https://github.com/tamnv2/supra-inventory/actions/runs/40370323444: **SUCCESS**. Job `121738996010`: `D173_E055_EXISTING_WORKER_RELEASE_PASS`, `D173_E055_EXISTING_GATEWAY_UNCHANGED_PASS`, uploaded/deployed registered Worker, checked official `/health`: HTTP200 status=ok, source_commit exactly `36a87805d66e9356915b47303ac7fa2597697b09`, SQLite schema 17/17, operational_v2 7/7, missing binding 0, auth/storage healthy; OAuth start checks pass.
- The parallel `Deploy Beta Firestore Relay` was **Owner-denied** by D167 release gate; no Firestore rules/provider mutation is claimed. No Agent, Android, WMS, D172, or Stable release.

## Code in Production
1. `RECENT_RESULTS_PAGE` pages batch IDs before expensive detail; `RECENT_ACK_TOTALS` groups ACK by batch/version; `RECENT_RESULTS_COUNT` redundant measured query eliminated; `PICKER_REPORTS_PAGE` uses one latest ACK lookup.
2. Former uninstrumented SQLite full-scan `realtimeStreamMetadata` combined MIN+MAX converted to two scalar indexed probes. In-memory local SQL fixture before 6.231 ms / after 0.011 ms per sample with identical metadata. This is **local** proof and NOT Cloudflare field latency or savings.
3. `OTHER_OPERATIONAL` split into fixed `REPORTER_COUNTERS`, `REPORTER_BATCH_TICKETS`, `SLA_CONFIG` using existing E049 instrumentation; no extra telemetry writes/timers.
4. E049 lossless per-operation persistent counters are retained. Redundant per-request SQL count removal saves its corresponding telemetry write; the remainder of ~62,399/day estimated UPSERT executions has **not** been safely eliminated; no fabricated lossless batching claim.

## Outstanding evidence and state
- **CODE PASS; CI PASS; RELEASE PASS. FIELD PENDING; OWNER PASS PENDING; BILLING SAVINGS NOT VERIFIED.**
- User-provided 26/10 Data Studio SQL shows 7.5138M measured Rows Read vs ~645M account/provider daily Rows Read; large unattributed remainder is **unproven**, cannot be assigned completely to fixed realtime SQL before same-window billing readback.
- Need compare after release 24h matched conditions: billed DO Rows Read/Written, Requests, Compute Duration, error rate and realtime latency; test Reporter/Pickers, WMS HA/ACK and independent D172 functionality. No additional blanket logs or expensive per-event writes.
- D172 independently **PENDING/HOLD**, do not close or combine into D173. This is docs-only status receipt; no second Worker deployment triggered.
