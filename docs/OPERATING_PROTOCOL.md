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
