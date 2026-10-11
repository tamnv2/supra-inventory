# D167 — CODE ONLY Implementation Checkpoint (2026-10-11)

**Authority:** Owner explicitly instructed continued D167 coding to CODE READY, **excluding D05 (PRIMARY automatic daily SKU) and D07 (LTA/Shelving historical area)** as separately pending. PR [#555](https://github.com/tamnv2/supra-inventory/pull/555), branch `d167-code-only-20261011`. This document records a source candidate; **not CODE READY until final head all applicable CI PASS** and not a Beta deploy/Owner field PASS.

## Implementation / contract evidence

| Owner scope | Implementation source | Before-release regression/evidence | Status |
|---|---|---|---|
| D01 Web direct/Excel Picker entry; no Sheet-source writes | `web/src/hr-excel.ts`, `hr-web-panel.ts`, `operational-app.ts`, `service/src/user-management-{api,core}.ts`, `hr-event-sync.ts` | Required 3 fields, role collisions, duplicate/conflicting names/contractor, preview/apply stale-plan, unchanged existing Picker capability, absent rows no-delete; stale/racing Web preview fenced by request sequence | CODE CANDIDATE; real credentialed E2E deferred |
| D02 default later meal slots | `service/src/meal-break-core.ts`, `sla-automation.ts` | 10:55/17:55 prompt, 11:00/18:00 *independent* default alarm, chosen interval precedent; only auto-skip time pauses | CODE CANDIDATE |
| D03 03:00 all day-N PENDING closure | `service/src/d167-overdue-core.ts`, `sla-automation.ts` | non-overdue and overdue group close, `SYSTEM_DAY_END`, result event, both Picker groups notified, accurate nonnegative queue/overdue deltas; closing before stale reminders/normal timeout | CODE CANDIDATE |
| D04 independent VN-day batch and Picker ticket | `service/src/core.ts`, `business-core.ts` | SQLite VN-date migration fixture, old unique-index retirement, two consecutive-day reports accepted, same-day duplicates rejected | CODE CANDIDATE; physical Durable Object migration untested |
| D06 SKU import conflict safety | Existing import semantics preserved; Agent automatic import not in current scope | No automatic SKU rename/delete from this PR | PRESERVED; D05 Agent decision postponed |
| D08 low-cost forensic data | Existing bounded event/audit hooks and user-triggered Usage ZIP, no new PDA/Agent polling | No Launcher change, no scheduled logging interval; two meal-cutoff alarms/day maximum added to uphold business rule, **actual provider billing not measured** | SOURCE GUARD / FIELD PENDING |
| D09–D10 two-stage release | `tools/d167_release_gate.py`, `ops/d167-release-authorization.json`, applicable `.github/workflows/*` | PR receipt denies deployment; release permits explicit Owner authorization reference, exact approved source SHA and component scope. Push-main only; manual dispatch denied; source changes after approval fail closed. Workflow-only changes no longer trigger unrelated automatic releases. | CODE CANDIDATE / CI PENDING |
| D05, D07 | No new Agent WMS automatic export or LTA/Shelving schema/reporting | Outside this PR by explicit Owner instruction | PENDING, not counted as failed CODE READY scope |

## Regression matrix / high-risk boundaries

- **Business:** normal/error/duplicate/concurrent HR rows and role conflicts; VN midnight N/N+1, 03:00 waiting/overdue, no double-resolution, manual-result precedence; meal selected/default/lost-prompt. `tools/d167_day_boundary_regression.py` and `tools/web_operational_regression.py` are repeatable source + SQLite fixtures.
- **Service & UI:** Web build and Worker/InventoryCore TypeScript typecheck under PR verifier; separate Repo Authority / Project State continuity / UI design guard.
- **Coupled clients:** run existing Android compile/APP regression, Windows Agent build/HA/WMS regression as PR checks; Android/PDA notification acknowledgement and real Windows WMS timing require Owner field testing after a separately approved Beta release.
- **Security & resources:** no data/user upload to public repository; Beta existing Inventory resources only; main `push` no longer sufficient without scoped Owner receipt; Stable OWNER-GATED; Launcher excluded. No schema/cloud mutation is authorized in CODE ONLY.
- **Usage:** do not infer Provider Billing/Firestore/DO savings from CI, local counters or the absence of new polling. Quantitative before/after per provider, realtime/ACK/HA latency, mixed-client versions and battery can be established only after approved release.
- **Rollback:** current Beta vc105/Agent v125/Web remains unchanged by PR #555. On later deployment, protect legacy HR data and day-batch SQLite migration; rolling back source alone is unsafe if day-scoped duplicate records have already been written. Require rollout readback and forward-compatible schema or a verified backup/repair plan before execution.

## Exit criteria
1. Final exact PR-head applicable workflows terminal PASS (cancelled superseded heads are not PASS).
2. Source/version/CI references in `ops/project-state.json` reconciled and required authority/continuity PASS.
3. Mark PR Ready for review / `CODE_READY_ALL_APPLICABLE_PREDEPLOY_CHECKS_PASS` only after #1–2. Do **not** merge PR or touch Beta/Stable, APK, EXE, service, Gateway, update channel or WMS until separate Owner `duyệt triển khai`.
