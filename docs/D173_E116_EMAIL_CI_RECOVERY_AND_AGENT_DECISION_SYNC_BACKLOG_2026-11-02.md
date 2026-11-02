# D173-E116 — Owner-approved email CI repair + Agent fleet decision sync backlog (02/11/2026)

## Scope, evidence and production impact
Owner instruction: If the failed email CI workflow can be repaired without affecting live Production, fix it now. Also **record** a new requirement: after any Agent confirms overtime, end of shift, VPS takeover as PRIMARY, or VPS takeover deferral for 15 minutes, all other Agents must receive and apply that decision promptly; no stale duplicate confirmation dialog on another machine.

Approved E116 change is limited to:
- CI workflow `.github/workflows/d173-email-sender-guard.yml`, its static regression test and non-executable D173 documentation/authority.
- NO changes to `service/`, `web/`, `android/`, `relay-agent/`, `obpp1291/`, Firebase Rules, deploy/release workflows, provider configuration, mail sender, credentials or actual mail.
- NO new GitHub secrets/provider tokens/real OTP, NO runtime deployment, NO Stable changes, NO D172 business changes. Signed Agent163 and Android vc123 plus E114 Worker/Web remain published and intact.

### E116 email guard CI
The original workflow was a 435-line, many-historical-PR case analysis. GitHub Actions repeatedly reported **failure with 0 jobs** on main, including run 41432025279. This is GitHub Actions workflow-loading/validation, not evidence that transactional email delivery failed. Previous E030 route-indent fix did not eliminate later 0-job errors.

Repair principle: retire historical branch-specific E005/E010/E030/E109 candidate diff trees from this CURRENT CI workflow (historic guard scripts remain in Git); retain current source tests for four existing mail templates, mocked Gmail/Cloudflare transport, Worker TypeScript typecheck, and independent D172 regression. CI job runs with `contents: read` and neither deployment token nor `environment`. Add `pull_request`, `push` (main, path-limited) and `workflow_dispatch` so a PR and the merged workflow can establish an actual successful job. This is only CI test orchestration, **not** email sender change.

**Passing gate:** workflow source parsed by GitHub, real `source-only` job created and SUCCESS on PR; push workflow succeeds on main; other mandatory PR source/authority/state/D172 checks green. Owner no-reply service functional PASS is already recorded but **is not** the CI PASS. No delivery probes outside mocks.

## New independent D173 backlog: fleet-wide instant decision convergence (ANALYSIS ONLY)
**STATUS: PENDING_ANALYSIS, NOT CODE_APPROVED, NO RELEASE.**

### Reproduced requirement (Owner)
For a fleet of concurrently running Windows Agents:
1. One Agent selects **continue overtime**, **end shift/no overtime**, or an existing **manual shift/schedule override**: other Agents must promptly display the SAME accepted operating window and stop showing a locally stale overtime confirmation prompt.
2. Owner/admin on one Agent selects **VPS takes PRIMARY** or **wait/defer VPS PRIMARY takeover by 15 minutes**: all other Agents must promptly converge to the authoritative choice, update PRIMARY/standby presentation, and dismiss/suppress an obsolete VPS-reclaim dialog.
3. Agent opening/reconnecting after a decision must load the correct latest accepted decision and never re-prompt for that same schedule boundary/reclaim request.
4. Concurrent contradictory clicks must be resolved by **the already-existing server-authoritative Firestore CAS**, not client-local first-click claims; a losing click cannot overwrite a winning decision or re-open notification. When connectivity is lost, show unconfirmed/stale until authoritative state reconciles.
5. A window already displayed on another machine must close or become non-actionable when its decision has been accepted elsewhere; the UI must perform its update without blocking ongoing PickList confirm/WMS. Date/expiry/generation keys must prevent a previous shift or previous reclaim request from suppressing a genuinely NEW prompt.
6. Preserve PRIMARY lease/failover business authority, manual VPS permission checks, current 21:45/22:15/00:00/05:00 schedule rules, and 15-minute VPS defer semantics. Avoid repeated writes/polls and unnecessary Firestore usage.

### Source baseline (read-only inspection)
- `relay-agent/AgentBusinessSchedule.cs`: 21:45 confirmation, 22:15 scheduled stop, hourly extensions to 05:00, shared schedule key.
- `relay-agent/FirestoreAgentLeaderCoordinator.cs`: existing `FirestoreRoleSnapshot` carries schedule key/decision/boundary, CAS `PublishScheduleDecision`, PRIMARY/standby lease. Must examine how every listener/snapshot and UI prompt consumes updated state.
- `relay-agent/FirestoreVpsReclaim.cs`: separate `vps_reclaim` request with 15-minute cadence and approval CAS; must analyze its **cross-machine UI notification lifecycle** separately from ordinary schedule decisions.
- `relay-agent/FirestoreAgentSync.cs`: existing authenticated `agent_sync` snapshot/listener and RAM cache; investigate reuse vs role coordination listener, without adding blind polling.

### Suggested analysis and tests (not implementation)
- Draw the actual producer→shared CAS→listener→UI propagation path for each of four decision types; identify where the change does not reach other Agents or a dialog remains open after snapshot update.
- Simulate 2–6 Agents including VPS, primary, standby and deep hibernate, two simultaneous answers, disconnected/reconnected machines and stale generations. Verify exactly one authoritative outcome per decision key.
- Reuse existing Firestore listening/role projection and in-memory coalescing when possible. Measure existing read/write costs and delta traffic before proposing new publication channels or increased cadence. Do not promise a specific cross-machine latency without field traces.
- Test no duplicate prompts on other machines, no false dismissal of a newer request, no confirmation latency/HA degradation, no D172 regressions on shared infrastructure.
- Implementation and any Agent v164+ signed release require a **separate exact-scope Owner review/approval** after source-backed analysis.

## Status contracts
- E116 CODE/CI possible now, EMAIL SERVICE runtime unchanged; NO PRODUCTION DEPLOY.
- Fleet decision sync is only a documented pending analysis.
- E115 cancelled backlog and ten Owner-attested historic PASS groups are not reopened.
- D172 remains independent PENDING/HOLD and Stable OWNER-GATED. No cross-module executable mutation.
