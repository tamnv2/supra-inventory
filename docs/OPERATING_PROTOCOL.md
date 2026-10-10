# OPERATING_PROTOCOL — Automation-first project operation

Status: **CANONICAL OPERATING POLICY**.

## Default execution ladder

For every task use the highest safe automation level available:
1. connected first-party/project tool or API;
2. repository automation / GitHub Actions / existing CI;
3. official provider web UI only when human consent, account ownership, CAPTCHA/2FA or unsupported admin action makes Owner interaction necessary;
4. local install/terminal/script only as a last resort when there is no practical connected-tool/web path.

## Finite work

Do not stop after triggering a build/deploy/test. Continue:
`trigger → poll → inspect failure → repair within approved scope → rerun → terminal PASS`.
Stop only for a real Owner-only permission/consent step, requirement conflict, safety boundary or hard tool limit.

## Owner manual action format

When Owner action is unavoidable, instructions must:
- identify the exact provider/project/resource from `ops/project-scope.json`;
- use the shortest official UI path;
- state exactly what to click/type and what not to expose;
- batch related permissions/setup into one pass where possible;
- include the expected success state;
- avoid asking Owner to install software or run local CLI when a web route exists;
- automatically recheck immediately after Owner reports completion.

## Context before action

Before mutation, fresh-read the canonical GitHub authority according to `ops/authority-manifest.json`. Do not use chat memory as an execution source when the repo has newer state.

## D147 serial Owner-PASS change sequencing

D147 refines D119 process control without changing runtime behavior.

1. The accepted base is the latest change explicitly confirmed **PASS by the Owner** in canonical state.
2. Exactly one project change ID may be active. Do not create/process the next `Dxxx` or an unrelated mutation while the current change lacks Owner PASS.
3. Technical, CI, runtime or release PASS is evidence for the current change only; none of them substitutes for Owner acceptance.
4. If Owner says NOT PASS / FAIL, diagnose and repair under the same change ID. Do not escape a failed acceptance by opening a new change ID.
5. Before source/runtime/config mutation that may affect the accepted base, present a pre-implementation review covering: base impact yes/no, affected components, regression risk, quota/resource/security implications and recommended safest approach. Wait for explicit Owner approval before mutation.
6. After Owner PASS, update canonical decision/state/Owner-action continuity under that same change so GitHub reflects the new accepted base. Only then may a later change ID start.
7. While blocked, analysis needed to repair/accept the same change is allowed; unrelated project mutation is not.

## Stable

Stable actions are never inferred from a Beta request. Stable provisioning/deploy/release always requires explicit current Owner authorization.

## Beta RTDB Rules automation

D076 makes Beta Realtime Database Rules a CI-managed resource. Rules changes follow branch → PR read-only validation → authority/continuity PASS → merge → main-only REST PUT to the scoped Beta RTDB `/.settings/rules.json` endpoint → readback verification. The credential source is GitHub Environment `beta` secret `FIREBASE_RULES_SA_JSON_BETA`; its value and short-lived OAuth token are never durable project data. Stable RTDB deployment is not included and remains OWNER-GATED.


## Workstream continuation routing

D079 defines explicit repo-native routing for parallel workstreams:

- Exact Owner phrase `tiếp tục build xác nhận lấy lại hàng` routes to the paused D078 confirmation/relay workstream. Fresh-bootstrap canonical GitHub state first, then resume from `relay-agent-v4` field-probe checkpoint without asking the Owner to recap prior work.
- Báo hàng Web/APK is the default active workstream after D079. A new session that asks to continue/build Báo hàng must resume current Web/Android canonical state and must not automatically execute D078 relay work.
- A workstream label is not a persistent Git branch. Implementation always creates a fresh short-lived branch from current `main`, then follows branch → PR → authority/continuity PASS → merge.
- Paused workstreams remain fully recorded in `ops/project-state.json`; switching active workstream never deletes their checkpoint/evidence.

## D080 Agent-to-Supra test sequencing

The Owner has resumed the confirmation workstream but is temporarily away from the company Office network. D080 therefore changes only the immediate test order:

- keep D078 PDA ↔ Agent `.Office@MSN` transport matrix checkpointed;
- build/test Agent ↔ Supra WMS/API read-only connectivity now;
- never interpret D080 success as proof that the Office relay transport works;
- after Owner returns to company, resume the D078 `TEST TẤT CẢ` field matrix in addition to the D080 WMS evidence;
- real Picklist lookup/confirmation/mutation requires a later explicit Owner decision after both transport sides have evidence.

Every D080 implementation still follows fresh-main branch → PR → authority/continuity/Agent guards → merge → prerelease.

## D082 home-test sequencing

While Owner is away from company:
- keep the already implemented Internet/RTDB PDA ↔ Agent relay unchanged;
- test only PDA five-digit request → Agent read-only WMS Picklist-list GET → bounded result ACK;
- do not provision or swap transport providers for Office/LAN;
- a remote PDA request must not open a WMS login/browser window; local workstation operator establishes/refreshes WMS session explicitly;
- confirmation page/API is reference-only and no WMS mutation is permitted.

When Owner returns to company, D078 Office transport discovery resumes separately; do not infer it from a successful D082 home test.

## D091 transport-candidate progression

For the Picker PDA ↔ Windows Agent confirmation workstream, transport candidates are tested sequentially with real authenticated round trips rather than host-only probes.

1. Build/provision the selected candidate on a branch and keep Stable untouched.
2. Pass source/build/security/release gates.
3. Run one physical Office end-to-end field test with no hidden fallback to another carrier.
4. Only after transport PASS, implement and validate the D085 HA/failover/quota model for that carrier.
5. If the authenticated carrier itself fails on Office, record the sanitized evidence and move to the next approved Google-hosted candidate without re-testing providers already closed by D090.

D091 candidate order starts with Firestore, then Apps Script if Firestore transport fails. WMS mutation is outside this procedure.

## D092 confirmation execution boundary

After Owner-confirmed D091 physical Office Firestore E2E PASS, the confirmation workstream uses Firestore as the selected Beta PDA ↔ Agent carrier. D092 may execute only the bounded WMS `confirmSkipItem` mutation recorded in D092 and project scope.

Execution order is fail-closed: authenticated request → sticky ACTIVE Agent → conditional job claim → D085 anti-spam → D084 lookup/cache → unique full PickListCode resolution → cross-Agent confirmation guard → bounded WMS POST → ACK. No step may reconstruct/guess a full PickListCode from five digits or replay an uncertain mutation outcome.

Only final truthful NOT_FOUND affects the Picker strike counter. Any session/network/schema/permission/transport/confirmation uncertainty returns an error without counting as wrong input. Stable remains OWNER-GATED.


## D098 shared Cloudflare account budget

The Workers Paid account is shared with other Owner projects. SUPRA Inventory must not assume the whole $5 included allowance is available.

- **HISTORICAL, SUPERSEDED 2026-10-08 / 2026-10-10:** original D098 Inventory 35% and 65% reserved for others. Current verified genuinely shared-pool allocation is 30% Inventory / 30% Pick Pack / 30% verified third project / 10% central reserve; see `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`.
- Individual provider meters still use real technical quotas and pricing. This does **not** prevent redesigning workloads to exploit genuinely underused, compatible service/metric families under the newer 2026-10-10 Owner instruction.
- Hibernatable realtime, event-driven invalidation, bounded reconnect and delta recovery are preferred over polling.
- A new feature that materially increases Worker/DO/SQLite usage must include a bounded projection/test before technical PASS.
- Paid-plan availability does not authorize unbounded monitoring/provider polling.
- Firestore quota is tracked separately and remains a later optimization workstream after D098 identity/realtime acceptance.


## D099 Firebase Auth configuration gate

A release that depends on Firebase password sign-in must not infer provider readiness from user migration or general health. CI/deploy must:
- read `signIn.email.enabled` and `signIn.email.passwordRequired`;
- repair only the in-scope Beta project automatically when authorized;
- read back the configured state;
- execute an ephemeral password-import/sign-in/cleanup probe;
- fail release on any non-idempotent configuration/probe error.

Stable Firebase Auth configuration remains OWNER-GATED.

## D105 current PickList suffix contract

- Current Beta Android confirmation requests use exactly four trailing digits. During beta-vc62 → beta-vc63 rollout only, Firestore/Agent may accept legacy five-digit jobs from already-installed clients.
- Exact full PickList resolution must compare the suffix length actually supplied and still require exactly one full PickListCode before the existing guarded WMS mutation.
- Agent manual specialist search uses 3–4 digit terms only.
- This does not change D104 batching, D097 HA/polling, D096 fail-closed mutation semantics or Stable OWNER-GATED state.



## D114 PickList suffix contract supersession

D114 supersedes only the D105 fixed four/five-digit carrier-length rule. New Beta PDA jobs and Agent manual lookups use exact trailing numeric suffixes of 3–20 digits. PDA submits one term; Agent manual may submit up to 10 comma-separated terms. Ambiguous PDA resolution returns candidates without mutation and a user-selected candidate is re-resolved through the existing confirmation guard before WMS mutation. D097/D104 HA, batching, idempotency, quota and fail-closed mutation rules remain authoritative.


## D129 Firestore cost/quota operating rule

For the Beta PDA↔Agent confirmation path:

- Preserve the accepted D117 latency/failover envelope unless a later Owner decision explicitly trades latency for lower quota.
- Remove accidental amplification before changing provider/cadence: no stale PENDING list fallback, no UI-driven presence polling, no UI-driven schedule polling and no unchanged fleet-metrics checkpoint writes.
- Firestore request accounting is local diagnostics only. Reference warning thresholds are 70/85/95% of 50k reads/day and 20k writes/day; they are conservative reference values, not an entitlement assertion and not a hard runtime shutdown threshold.
- CI must reject reintroduction of the Sep 25–26 fleet-metrics storm, broad stale queue reads, a new periodic Picker-presence loop, or a parallel schedule-read loop.
- A Firestore realtime-listener alternative for PRIMARY may be implemented only as a separate bounded Beta/Office POC. Do not replace the field-proven REST path until company-network proxy/stream stability, reconnect behavior and read consumption are measured.
- Stable remains OWNER-GATED.


## D130 relay reliability operating rule

- Treat FIRESTORE transport=OFFLINE followed by loss of later confirmation-poll activity as a transport-loop defect, not an operator restart procedure.
- Agent must self-recover confirmation transport with bounded retries/supervision; do not instruct normal operators to stop/start relay as the steady-state recovery path.
- Android confirmation diagnostics distinguish create attempt, same-id create recovery, CREATE PASS, ACK and terminal timeout without logging PickList values or credentials.
- Android realtime diagnostics may log sanitized connected/fail/handshake-timeout state only; never log realtime tickets, tokens or session material.
- Keep Stable OWNER-GATED and do not add a second provider/heartbeat to mask Firestore or WebSocket failures.


## D131 Firestore no-cost operating discipline

- Treat Firestore quota as a shared project budget. D131 soft targets are lower than provider no-cost limits and are enforced before optional UI/fleet refresh.
- Quota-day counters use America/Los_Angeles because Firestore no-cost daily quotas reset on the provider day, not Vietnam midnight.
- Protected operations are PRIMARY business query, generation/lease fencing and terminal ACK. When soft ceilings approach, first reduce deep-hibernator fleet refresh, optional diagnostics and cleanup.
- Do not use Firestore TTL for D131 relay retention. Bounded cleanup must stop before read/delete soft ceilings.
- A quota-saving optimization may not create a second confirmation provider, weaken single-PRIMARY fencing, or hide an over-budget condition.


## D131 review-first continuation routing

Exact Owner phrase **`bắt đầu tối ưu lại mô hình`** routes to the D131 design-review checkpoint.

1. Fresh-bootstrap `ops/authority-manifest.json` and its complete `bootstrap_order`.
2. Do not mutate runtime/source implementation.
3. Present the complete D131 planned behavior and resource/cadence changes from canonical authority.
4. End with a maximum-envelope usage model and current provider-limit comparison, including assumptions and headroom.
5. If Owner edits logic, update/review the design and recalculate usage.
6. Start code only after a subsequent explicit Owner approval such as **OK / đồng ý chạy code**.
7. Implementation must use a new short-lived branch from then-current `main`; never continue implementation directly on the design-record branch.
8. Stable remains OWNER-GATED.

## D134 compact fleet and quota operating rule

- Support at most 10 Agent entries in the D134 operational fleet model.
- Every authenticated Agent may keep one listener on the single compact `relay_poc_coordination/agent_sync` document so Call/Kick changes reach Replay/deep-hibernate Agents without business-queue polling.
- Only PRIMARY performs full fleet reconciliation, no faster than every 5 minutes in steady state. Window focus/restore does not force a provider read.
- Received/confirmed/error remain durable in `relay_poc_coordination/daily_<business_day>`; D134 removes per-job exact counter reads and surfaces them through the compact five-minute reconciliation.
- Firestore internal soft read target is 45,000/day. Call/Kick event reads and the bounded kicked-generation rule lookup are included in the shared budget.
- Picker online/offline state must not be inferred from heartbeat silence or socket close/error. Explicit Android session state is authority; valid PickList identity is fallback.
- A local URI/parser/state-machine defect is an application fault and must not be labeled Firestore offline. Transport-offline is reserved for actual network/provider failures.
- No new provider resource and no Stable mutation are authorized.

## D137 Confirm readiness refresh rule

A managed browser reaching the canonical Confirm URL must not publish READY from the first loaded document. The Agent performs exactly one normal top-level reload for that first arrival and requires a stable post-reload READY DOM before enabling Confirm-dependent work. This is a local browser action only: it does not add Firestore/Worker/provider polling and must not enable DevTools Network or expose session material. If the post-reload page is login, Dashboard, partial, or wrong, fail closed through the existing bounded recovery path. Stable remains OWNER-GATED.

## D137 v79 final-route hydration rule

Do not treat the first appearance of the Confirm URL as a safe reload point. The final Confirm document must remain on the same canonical route for 3 seconds before the one normal reload is issued, then remain post-reload READY for 1.2 seconds before Confirm-dependent work is enabled. If the first real search proves the table contains zero PickList codes, one local browser reload/search retry is allowed as a bounded self-heal. It must not loop and must not add Firestore/Worker/provider operations. Stable remains OWNER-GATED.

## D140 Firestore Agent-sync storm prevention rule

D140 supersedes only the D134 rule that allowed every authenticated Agent to keep the compact `agent_sync` listener.

- Compact realtime listeners are limited to the HA trio: PRIMARY, NEXT_A and NEXT_B. DEEP_HIBERNATE must not keep that listener.
- Firestore streaming calls must include the database routing metadata required by the raw gRPC streaming client: `google-cloud-resource-prefix` and `x-goog-request-params`.
- A stream is not considered connected merely because the client wrote an AddTarget request. Retry state may reset only after Firestore returns a valid response.
- Permanent/configuration/quota status codes must open a bounded circuit for at least five minutes. Transient failures use exponential retry from at least 2 seconds up to at least 60 seconds.
- Logs must include sanitized gRPC status detail, accepted-response state, retry delay and circuit state, but never tokens/session secrets.
- PRIMARY reconciliation remains no faster than five minutes in steady state; forced reconciliation is rate-limited to at least one minute.
- Unchanged normalized `agent_sync` business state must skip PATCH.
- Android/PDA transport semantics are unchanged; no APK release is required solely for this hotfix.
- Stable remains OWNER-GATED and untouched.

## D149 unified operating-schedule quota rule

- Schedule authority remains the existing Agent Firestore CAS model; first accepted decision per scheduled boundary wins.
- Normal replay is deterministic 06:00–22:00. Default sleep at 22:00 is **write-free**.
- 21:30 and later HH:30 prompts are UI/time calculations only; they do not perform provider reads. A provider write occurs only after an explicit accepted decision.
- Overtime cannot pass 05:00. 05:00–06:00 early start is explicit and shared; 06:00 normal start is deterministic/write-free.
- Sleeping **Điều chỉnh tăng ca** is one explicit bounded CAS/state update and never starts a timer-driven write loop.
- No Cloud Function trigger may be attached to `relay_poc_coordination/roles`, generation leases or `agent_sync`.
- No new persistent schedule listener is allowed on Android, Web or deep-hibernate Agents. Reuse existing HA mechanisms only where already authorized.
- Android missed-state recovery is one-shot: Worker path first; one exact Firestore current-state GET only during Worker outage with a still-valid Firebase session.
- Duplicate FCM/function deliveries are handled by schedule version/idempotency and may not recursively write the triggering document.
- D140 retry/circuit/no-op-write protections remain mandatory. Any implementation that introduces an unbounded retry, reconnect or fan-out loop fails D149.
- Stable remains OWNER-GATED and untouched.

## D152 PickList recovery operating rule

D152 uses a fast-path / exception-recovery split. Normal exact-row confirmation must not pay the reload cost. A unique row with an unavailable checkbox may use the existing one Search retry and, only if still unselectable, one bounded normal page reload/recheck. After a Confirm dialog has been accepted, all further D152 recovery is verify-only; no retry path may click Confirm again. Existing uncertain guards stay closed to mutation and may only perform one bounded read-only exact-row verification. State changes during recovery must not be converted into NOT_FOUND strikes. Recovery is local WMS browser UI work and must not add Firestore/provider polling, listeners or write cadence. Stable remains OWNER-GATED.

## D161 start / field-acceptance / rescue routing

These exact commands route the active D161 workstream and do not create a new change ID.

### `bắt đầu D161 tiến hành`
1. Fresh-bootstrap the complete canonical authority.
2. Mark D161 implementation as authorized.
3. Execute **Phase 0A Permission & Provider Preflight** first. No D161 business/runtime source mutation or Safety release publication is allowed before Phase 0A PASS.
4. Phase 0A must prove the selected Beta capabilities needed by D161, including GitHub/release paths, Cloudflare deploy, Android signing, Agent release, Firebase/Firestore/Functions/FCM, Apps Script/Monitoring, Google OAuth/runtime access, current HR Sheet read, HR Drive `files.watch` callback/replace/stop, Logs daily-folder create/upload/readback/cleanup and the chosen global-log control plane.
5. Use read-only/no-op capability checks when possible. Any necessary write proof must be a bounded disposable Beta-only canary inside existing scoped resources and must be cleaned up in the same preflight. Stable is forbidden.
6. If Phase 0A fails, repair the missing capability under D161 and rerun the relevant/full preflight. If an Owner-only grant is unavoidable, batch all known missing grants into the shortest official Web-UI action before asking the Owner.
7. After Phase 0A PASS, execute **Phase 0 Safety Baseline** and do not introduce D161 backlog behavior before the Phase 0 gate is PASS.
8. Capture and verify the safety manifest plus forward-installable Android/Agent safety releases and Web/Service reproducible baseline.
9. If Phase 0 fails, repair Phase 0 under D161 until terminal PASS; do not continue into backlog implementation.
10. After Phase 0 PASS, continue automatically through the complete then-current Owner-approved D161 backlog using fresh short-lived implementation branches/PRs as needed.
11. Continue finite build/deploy/test loops to terminal technical/runtime/release PASS or a real Owner-only blocker.
12. Present the field-test-ready candidate. D160 remains the accepted base until Owner field acceptance.

### `ghi nhận ok` while D161 is field-test-ready
Treat this phrase as D161 Owner field acceptance only when canonical state says D161 is explicitly waiting for Owner field test. Record Owner PASS/accepted-base continuity before opening any later change.

Outside that exact D161 field-test-ready state, do not infer acceptance merely from the generic phrase.

### `quay lại bản backup ban đầu trước khi sửa code`
1. Freeze further D161 feature rollout.
2. Preserve bounded/redacted evidence.
3. Execute the canonical D161 Safety rescue, not a new Dxxx.
4. Restore safe behavior via new forward deployments/releases: Safety Web + current schema-compatible backend; monotonic Agent/Android rescue versions; compatible Firebase/rules/functions state.
5. Do not blindly downgrade SQLite schema, erase D161-created data, overwrite release history or restore secret/config values from public GitHub.
6. Continue rescue automation until the critical safe-operation acceptance matrix is PASS.
7. Record `D161_RESCUE_TO_SAFETY_BASELINE` continuity. D161 remains the active repair change until later Owner acceptance.

### Safety-release monotonicity
- Android rescue `versionCode` must be strictly greater than every already-published D161 Android build.
- Agent rescue `relay-agent-vN` must be strictly greater than every already-published D161 Agent build.
- A rescue release may reuse Safety behavior/source logic but is a new signed/checksummed release; it is not a version-number downgrade.
- Web/Worker rescue is a new deployment from a known Safety-compatible source composition, not an assumption that provider rollback of an old bundle is safe.


## D160 post-PASS diagnostic candidate routing
Owner-approved diagnostic work on 2026-10-03 is a bounded continuation of D160, not D161 implementation.
- Accepted runtime remains relay-agent-v97 until explicit Owner field PASS of a diagnostic candidate.
- A diagnostic candidate may use the next monotonic Agent version and a dedicated prerelease/artifact, but must never update `inventory-channel`.
- Only logging/telemetry and the minimum CI/release fencing needed to keep the diagnostic candidate manual-only are authorized.
- D160 v97 business behavior, Android beta-vc92, Web/backend/provider cadence and Stable remain unchanged.
- After candidate publication, stop at Owner field/log collection. A field failure is repaired under the same D160 diagnostic continuation; a field PASS must reconcile accepted-artifact metadata before any D161 implementation can start.


## D160 post-PASS optimization test candidate routing — v99
The Owner-approved v99 test remains a bounded continuation of D160.
- relay-agent-v97 remains accepted and trusted; v99 is manual-install only and cannot mutate `inventory-channel`.
- v98 diagnostic evidence is input to v99 but neither v98 nor v99 becomes accepted merely by technical/release PASS.
- v99 may change only the three approved evidence-backed repair points: same-row confirmed-marker fallback, presence FAILED_PRECONDITION supersession classification, and successful-terminal error-upload suppression.
- Search-before-F5, FOREIGN_SELECTION reload safety, 12-second mutation fence and all other D160 v97 safety/business invariants stay unchanged.
- After v99 publication, stop at Owner field run/log collection. End-of-shift analysis determines whether repairs are kept, adjusted or rejected; D161 remains unchanged until a later explicit Owner decision.


## D160 post-PASS optimization test candidate routing — v100
Owner approval on 2026-10-03 keeps the v99-proven optimizations frozen and authorizes a narrower manual-only v100 test under D160.
- relay-agent-v97 remains accepted/trusted; v100 must not mutate inventory-channel.
- v100 scope is limited to adaptive pre-final reload waiting, passive terminal observation budget and local queue/latency telemetry.
- Adaptive reload extension is bounded and pre-final only; the 12-second mutation fence remains authoritative.
- Post-final observation remains read-only/passive with one final business click total.
- No provider cadence/resource change, Android/Web/backend change, Stable action or D161 implementation is allowed.
- After technical/release PASS, stop at Owner field run/log collection. Any repair remains D160/v100 continuation until Owner decides otherwise.

## D160 post-PASS test closure and D161 handoff — 2026-10-03

Owner closed D160 v98/v99/v100 manual testing. Do not create any further D160 diagnostic/optimization Agent candidate.

- Accepted/trusted runtime is relay-agent-v97 and `inventory-channel` remains v97.
- OA094 is closed by Owner decision; v100 is not promoted.
- Evidence-backed v99/v100 confirmation behavior plus the two final reload refinements are now D161 backlog authority.
- Current workstream is D161 requirements/safety preparation only. Do not execute Phase 0A, Phase 0, source mutation, build, release or provider mutation until the exact command **`bắt đầu D161 tiến hành`** is received.
- The first official D161 Agent runtime version is v98. Historical D160 test prerelease tags v98/v99/v100 remain evidence-only and may not be silently overwritten/promoted; publication must use a collision-safe release identity.
- Stable remains OWNER-GATED.

## D161 confirm/observability authority addendum — 2026-10-03

Owner-approved requirements now include the extended PickList confirm pipeline contract and cross-platform Observability/Support Log v2 in `docs/D161_APPROVED_BACKLOG.md` and `docs/specs/OBSERVABILITY_LOGGING.md`.

This is authority capture only. Do not implement runtime/source/provider changes until the exact D161 start command. After start, Phase 0A and Phase 0 Safety remain mandatory before implementation.

Observability implementation must reuse existing scoped Beta resources where possible, add zero provider write per local event, add no polling/listener cadence, and reconcile project scope before any unavoidable new persistent resource. Stable remains OWNER-GATED.


## 2026-10-08 — Shared Quota Governance authority-only approval and execution boundary

Owner approved the 30/30/30/10 allocation across **verified shared provider pools**; Cloudflare Workers Paid USD 5/month, Google Cloud/Firebase Blaze USD 10/month **soft budget** and Google/GitHub Free stay unchanged. Inventory's external mutation rights remain restricted to `ops/project-scope.json`; other projects remain out of scope. Existing Stable resources remain OWNER-GATED and Beta is the future Inventory development target. Quota alerts must use provider-authoritative cached/read-only measurements and warn at 70/85/95% with no automatic hard cutoff. Accounting entries and alerts are proposals; enabling Google/Cloudflare Billing alert delivery, automation, payments, new projects, runtime guards or service plans requires a new impact review and separate explicit approval. The 10% reserve requires Owner allocation approval. The current authority-only PR must pass GitHub Repo Authority/Project State continuity/secret gates before merge. Preserve D165 deployed baseline and defer separate D166 HA/usage implementation pending real shift logs and Owner scope approval.


## 2026-10-10 — D166 Owner instruction precedence, cross-metric usage optimization and corrected budget

**Current explicit Owner-confirmed direction; supersedes conflicting earlier instructions on the same subject/scope.** Preserve superseded rules as historical evidence but remove their active normative effect. A newer AI suggestion, unapproved draft or incomplete technical release is **not** an Owner decision. An explicit Owner correction takes precedence over older D-number text; record decision + affected spec/state in the same authorized D166 workstream. This rule cannot bypass project-scope, secret handling, Stable gating, D166 serial Owner PASS or the separate Owner approval required for runtime/provider changes.

- **Actively analyze cross-metric workload rebalancing**: when one metric A is constrained and B/C have underused legitimate free headroom, assess moving actual processing/data flow from A to B/C while preserving **identical business outcomes and at least equivalent speed, realtime, HA, safety, ACK and audit quality**. Do not interpret illustrative A/B/C count redistribution as conversion of provider quota units or equivalent cost. Measure different units and tariffs independently, report alternatives, comparable before/after evidence and rollback, then obtain Owner authorization before code/provider mutation.
- **Budget**: Cloudflare Workers Paid base USD 5/month is the only subscription currently reported paid. Firebase/Google Cloud Blaze should stay inside its actual free allowance wherever possible. The combined contingency for **all incremental provider usage charges** (including Cloudflare overages, if any) is **USD 5/month total**, not per-service or per-project; internal planning total **USD 10/month**. Provider invoices can exceed this without an enforceable cap. Prior Google Cloud USD 10/month soft allocation and USD 15 combined target are **SUPERSEDED**. No automatic paid upgrade, billable activation, service shutdown or exception spending.
- **Drive**: currently free; Owner may separately authorize a Google AI Pro/Gemini Pro 5 TB storage entitlement if needed. Do not assume subscribed today, and distinguish storage from Drive/Sheets API calls and rate limits.
- **Unchanged**: 30/30/30/10 only for verified shared account-level quota fairness, provider-specific metrics/quotas, 70/85/95/100 soft alerts, scoped resource boundary, Beta/Stable rules and no loss of real-time service quality. Never conflate financial reserve with shared usage allocation.

Canonical detail and active supersession ledger: `docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md`. D166 remains open for actual usage evidence and Owner field PASS; this documentation change does not release software.


## 2026-10-10 — Owner-confirmed two-gate code preparation and live deployment protocol

**Status:** newest explicit Owner directive; supersedes any older blanket rule or CI assumption that merging or successful code validation automatically authorizes Web/Service/Android/Agent/provider deployment. Applies to future SUPRA Inventory change execution and to unfinished D166 work where applicable, without retroactively undoing an already deployed release. This section records Owner intent; existing auto-deploy workflows must be separately refactored/validated before claiming technical enforcement. No Stable authorization is implied.

### A. Default sequence: analyze → Owner code approval → CODE READY → Owner deploy approval → field acceptance

1. **Analyze/propose only.** Gather problems, reproduce or inspect evidence, bootstrap repository authority, follow the latest explicit Owner instructions on identical subject/scope, analyze impacts on Web, Android, Service, Windows Agent, external providers, accuracy, realtime, latency, HA, costs and security, and recommend a complete approach. Do not change live behavior or start code implementation unless the Owner instructs `chạy code` or explicitly authorizes the proposed implementation.
2. **Code-only authorization** (e.g., `chạy code`, `tiến hành code`, `sửa code` without deployment instruction): complete all agreed source/spec/test changes in a **non-deployed, PR-only candidate**; run required CI, build Android/Agent binaries as internal CI artifacts where supported, verify source/security/regressions, and repair until all executable mandatory pre-release checks PASS. Do **not** merge runtime-affecting candidate code into `main` while any main push may automatically trigger live Beta deploy, signed-release publication, Apps Script Gateway update, Firebase Rules/Functions update or version-channel promotion. Do not change current Web/Service/Agent/PDA clients, provider configuration, database schema in live resources, secrets, minimum-version gates or auto-update targets at this phase.
3. **CODE READY checkpoint:** report candidate branch/PR/commit/version/artifacts, affected components, test matrix with PASS/FAIL/SKIP, known gaps, actual vs predicted Usage and costs, security/regression risks, rollout scope, migration/rollback plan, and precisely which post-deploy/physical-device tests cannot be run in advance. Only call this `CODE_READY_ALL_APPLICABLE_PREDEPLOY_CHECKS_PASS` when the applicable checks actually pass; never claim 100% bug-free or field PASS from build/CI. Wait at this checkpoint for Owner's explicit go-live authorization.
4. **Deployment authorization** (e.g., `duyệt triển khai`, `triển khai cập nhật` for the exact candidate): fresh-check branch SHA, CI, repo scope and approvals; merge/promote through the approved gate, then automatically deploy/release ONLY the Owner-approved scoped Beta Web/Worker/Apps Script/Android/Agent/provider targets. Publish signed APK/EXE/channel or mandatory-update floor only when included in Owner-approved scope. Verify actual runtime, health, versions, HA/ACK, logs, quota and rollback. Owner deployment authorization is **not** Owner business acceptance/PASS.
5. **Field acceptance:** report observed device/install counts, end-to-end real operations, regression and quota evidence, and await explicit Owner PASS. If NOT PASS, continue repair under the **same Dxxx** through the same code-ready/deployment gates. No D167 while D166 remains Owner field-pending.

### B. Exceptional co-development and live-mutation dependency

If a required implementation/test genuinely cannot be completed without mutating an existing live Service/Web/Android/Agent/provider resource during the code-only phase, first report the exact technical blocker, why mocks/CI artifact or isolated tests are insufficient, affected resource IDs, side effects on current operations, cost/usage, privacy/security/rollback and proposed bounded order. **Only after Owner explicitly authorizes that exception** may the minimal scoped live mutation occur. Silence, generic `chạy code`, CI PASS or old auto-deploy convention is not exception approval. Stable remains separately OWNER-GATED.

### C. Explicit combined command: code and deploy in one authorization

When the Owner explicitly says `sửa code và triển khai`, `chạy code và cập nhật` or equivalent, one explicit authorization covers the described code and scoped Beta rollout. Execute analyze/implement/test/repair until predeploy gates PASS, then automatically merge/promote/deploy/release/verify **without stopping for a separate CODE READY Owner acknowledgement**. Mandatory build/security/CI gates, scoped resource limits, operational safety, stable guard and real-field Owner PASS remain intact. If newly discovered risk or required external permission falls outside that initial approval, report and request specific authorization before expanding scope.

### D. Auto-merge safety policy (critical due to live main-push workflows)

- Branch → PR → authority + continuity + relevant checks always; no direct push to main.
- **Never auto-merge a runtime/provider/release-affecting PR merely because CI passed.** Existing main-push workflows deploy Beta Worker/Web, Apps Script Gateway, Firebase rules/functions and publish Android/Agent update-channel assets, so merge is currently a *live-change action* for such PRs.
- Documentation-only PRs may use ordinary auto-merge after mandatory checks if they cannot trigger live changes. A code PR must remain unmerged until the Owner deployment instruction; only then should the host-controlled promotion or guarded main-merge occur.
- Implementation task to make this protocol enforceable: separate pure PR build/test from Owner-authorized promotion; add fail-closed approval token/evidence tied to exact candidate SHA, allowed resources and release scope to every actual deployment/publication path (including manual dispatch, reruns and all main-push triggers), prevent release-channel changes without an Owner gate, and retain CI observability/rollback. This enforcement requires its own technical PR/CI and explicit code-change authorization; documenting it alone does **not** secure existing workflows.

**Precedence:** newer Owner-confirmed instructions on the same subject/scope override older release sequencing guidance. This workflow does not relax usage/realtime/HA/ACK, public-repo secrets, `ops/project-scope.json`, Owner field PASS or Stable approval requirements. See `docs/OWNER_DECISIONS.md` and `docs/specs/ACCEPTANCE_TESTING.md`.


## 2026-10-10 — Scoped Owner PASS closes D166 and moves unresolved acceptance to D167

Owner explicitly records **D166 PASS for the update having no newly reported errors**, not complete field/feature/usage acceptance. This is a **limited accepted release checkpoint** and supersedes any preceding text within D166 that prohibited opening D167 until *every* remaining item received field PASS. D166 is closed at that specific Owner-confirmed scope; none of its unresolved tests is treated as `PASS` or discarded. All unresolved requirements/field evidence and postponed analysis are carried with original provenance into `docs/D167_BACKLOG.md`. D167 is **backlog/evidence analysis only**, awaiting Owner-supplied logs/provider usage data and later specific decisions on code or deployment.

Continue to enforce the latest Owner two-gate protocol: analysis→explicit `chạy code` for PR-only build/test→CODE READY hold→separate Owner deploy approval→real-field checks; an explicit `chạy code và triển khai` combines code and deploy authorization. No runtime/provider/Stable changes or forced OTA are justified by this policy-only transition. Preserve authoritative version/build manifests vs actual installed fleet evidence, no-secret/public scope and quotas. The accepted base D166 is annotated `OWNER_PASS_RELEASE_UPDATE_NO_REPORTED_ERRORS_ONLY`; D167 acceptance remains separate.
