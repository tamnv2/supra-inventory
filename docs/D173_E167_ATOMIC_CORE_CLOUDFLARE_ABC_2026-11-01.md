# D173-E167 — Kết quả xây dựng và kiểm thử Core V2 atomic audience, 01/11/2026 (Asia/Ho_Chi_Minh)

## Trạng thái
**LAB SOURCE/LOCAL PASS; ISOLATED CLOUDFLARE A/B/C PASS; PRODUCTION NO-GO; FIELD/FINANCIAL/OWNER PASS chưa có.**

- Branch: `poc/d173-e167-atomic-audience-core-lab-20261101`; Draft PR #812, base PR #811.
- Cloud exact tested source: `cabbb3266559498b105378ee14a3e3fda4ac4a28` (đo trước tối ưu kiểm quyền thêm ở `b6b467fabe370f42da7b26d3b6537b4147c9fd07`).
- Cloud test run: [41226099194](https://github.com/tamnv2/supra-inventory/actions/runs/41226099194), SUCCESS; provider readback sau 180s. Local tests at same source [41226020385](https://github.com/tamnv2/supra-inventory/actions/runs/41226020385): 92/92 PASS (bao gồm deliberate SQL fault/rollback); E112 Core regression and D172 isolation PASS. Subsequent filter-first auth fix has independent offline PASS [41226328326](https://github.com/tamnv2/supra-inventory/actions/runs/41226328326), E112 [41226328361](https://github.com/tamnv2/supra-inventory/actions/runs/41226328361), D172 isolation [41226328279](https://github.com/tamnv2/supra-inventory/actions/runs/41226328279).
- Runtime tested: real `service/src/core.ts` + original business transaction and trigger `report_events → realtime_events`; a LAB-only `AFTER INSERT ON realtime_events` trigger persists recipient references in the SAME SQLite transaction. No post-commit event sidecar. Not a patched production Worker release.
- Variants: A current Core HTTP writes + **synthetically assumed** three GET refresh calls after each of 20 distinct picker reports. B same Core HTTP writes and atomic audience push/patch, without redundant refresh. C same logic B, commands via hibernatable WS. Three isolated DO IDs selected from strict runner case ID, no prior receipt collision.
- Network: 20 synthetic independent Picker identities in a concurrent burst. No real Firebase/Android/WMS/FCM/overlay integration, no real Oct 27 per-second action trace. Only REPORT operation and queue/picker-result read subset tested. Source parity checks match final 20 business batches, idempotency, delivered 20/20 Reporter pushes and precise 1/1 each Picker for B/C, durable replay and fault rollback.
- Producer uses test Worker `supra-inventory-m2-lab`/DO `LabRealCore`, same shared Cloudflare account and billable allowance, no prod binding/routes/custom domain/cron. D172 independent PENDING/HOLD. No Production deploy or OTA.

## A/B/C Cloudflare results (actual observed test-only objects)

| Cloudflare meter | A `…a4023ed0` | B `…d775ba2d` | C `…07690e63` |
|---|---:|---:|---:|
| 20 write burst total ms (GitHub runner → Worker) | 470.79 | 487.83 | 266.28 |
| Write p95 ms | 458.90 | 481.21 | 265.15 |
| DO raw HTTP invocations | 83 | 48 | 28 |
| DO raw hibernation invocations | 0 | 21 | 41 |
| SQL Rows Read | 6,880 | 5,021 | 5,050 |
| SQL Rows Written | 1,920 | 1,796 | 1,796 |
| Provider duration field | 0.356488448 | 0.086029056 | 0.058576 |

- C vs A: raw HTTP -66.3%, SQL reads -26.6%, writes -6.5%, write p95 -42.2% in THIS workload only. B vs A: raw HTTP -42.2%, SQL reads -27.0%, writes -6.5%, write p95 **+4.9% (slower)**. One run, fixed order A→B→C; no repeated/counterbalanced p95.
- Do **not** use 20:1 WS request billing discount to extrapolate from raw hibernation counts (B 21, C 41). Compute Requests billable remains **UNVERIFIED**: Cloudflare invocation count and provider SQL/duration fields are not a billable invoice. Connection/upgrade/FCM/log/Worker CPU and whole-account meter costs must be counted.
- A 60 GETs are scenario assumptions; no proof each real Android/Web request after 27-Oct actions followed these three GETs. Baseline 27/10 raw DO HTTP 54,055 and SQL Rows Read 133,115,948 may include D172/shared loads and are not causally directly comparable.
- New audience index is transaction-atomic but **not a complete production-ready access/read model**. E167 Lab reporter and Picker mapping relies on synthetic `LAB-P...` identities; current production recipient rules/capabilities, historical/withdrawing recipients, correction, 03:00, FCM, SQL retention and mixed versions are not covered. Must design equivalent production-grade audience refs and auth/recovery.
- E167 performance follow-up switched recipient filtering before role/session SQL read for unrelated sockets. This safer cost reduction was CI-local PASS after cloud meter; **not part of the measured Cloud SHA**. No second metered workload run without distinct approval/budget gate.

## Decision
- Prototype direction viable, with a demonstrated **subset** improvement and atomic event reference on real Core SQL.
- **NO Production replacement approval.** Need full event types (create/group/withdraw/resolve/correct/auto-skip/DISPLAYED/ACK), full semantic DB/screen/overlay/permissions/retention parity, source-built Web/APK/Agent test clients and actual physical PDA/WMS/Office/FCM/HA, 60 principal stress and failover <20s, repeat A/B/C on equal 27-Oct logical action/fault sequence with provider billable usage incl. full monthly account budget and D172 shared regression. Production release must remain Owner-gated.
