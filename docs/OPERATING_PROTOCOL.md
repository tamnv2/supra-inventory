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

- Inventory design ceiling is **35% of each relevant included usage metric** at the approved max-load envelope.
- 65% is reserved for other projects.
- The ceiling is evaluated per metric; averaging metrics is forbidden.
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

## D152 PickList recovery rule

For the Beta Agent PickList confirmation path, normal ready rows must remain on the direct fast path. Recovery is strictly bounded: one existing Search retry, then at most one Confirm-page reload only when a unique matched row remains checkbox-unselectable. A row that existed before this recovery must not become a user NOT_FOUND strike merely because it disappears during reload.

After the confirmation dialog is accepted, no code path may send the confirmation mutation again. A terminal timeout may perform one read-only Search verification. An existing uncertain confirmation guard may also perform verify-only browser work, but never another mutation. Only trusted row-removal/terminal evidence may recover CONFIRMED; otherwise remain fail-closed. These recovery actions add no periodic provider cadence, WMS API/session extraction or Stable mutation.
