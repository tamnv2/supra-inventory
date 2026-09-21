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
