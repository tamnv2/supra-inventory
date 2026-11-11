# D173-E192 — Agent187: Owner 11/11/2026 Field repair / protected release

## Owner order
Owner reports on signed Agent186 that active-session **filter and action buttons intermittently overlap** (screenshot 1920px). Owner explicitly orders comprehensive repair together with previous login/Web/header failures and release **Agent187 until verifiably done**. D172 and Stable remain out of scope.

## Code findings and repair
1. `D119AgentFeatures.LayoutD173RosterToolbar`: a single dynamic region was used by five filter buttons and authorization actions; one/two-row selection depended on measured width and transient `Visible`, while controls could become visible later without guaranteed recalculation. Renders intermittent overlap after live counts, RDP resize and action visibility. Repair: filter tabs always row Y=1; authorized actions always row Y=36; hidden actions parked safely outside first row; recompute at resize, count and visibility transitions; preserve existing click handlers and role checks.
2. `Program.SetAgentAuthUi`: after a failed login, `_agentAuthStatus` remained visible when a later successful login changed the header, overlapping it. On success hide only the stale error notice. No auth/claim/provisioning mutation.
3. `E190` native Web Confirm: replace Host14 overlay with WebView2 WinForms control **owned by the Agent tab**; reuse profile, WMS CDP confirmation workflow, real popup and D167 guarded read-only SKU functionality. Log bounded renderer status, navigation category, UI DPI/size, in-memory sampled paint; do not assert field-visible until physical proof.
4. Ordinary Firebase account HTTP400: add safe `error.message`, role attempts, HTTP and elapsed diagnostics. Root cause is **not** presumed to be password; account provisioning state must be verified against real logs. No auto-provisioning or cross-D172 auth mutations.

## Technical constraints
- Release scope: Agent187 code, local log, Agent-only version, release metadata/workflow, canonical D173 state. **Worker/Web/Android/D172/WMS business/Stable unchanged**.
- E190 Chromium/WebView2 Fixed Runtime reused, no new engine assumption; no extra Cloudflare/Firebase usage for instrumentation; no secret/browser-session material in log or public GitHub.
- Before release: exact-source Windows native compile, separate Agent187 tab-row assertions, prior Confirm/SKU/auth/HA smoke checks, D172 isolation, readback signed EXE/manifest SHA. A tag and successful CI do **not** prove physical Field or Owner PASS.
- Release rollback: keep existing Agent186 artifact and browser fixed runtime package, only advance Agent channel once exact 187 EXE and tag digest verified. No automatic WMS confirm mutation retries when uncertain.
- Physical field gates after release: login normal account (incl. returned Firebase category), visible Web WMS login → genuine popup → confirm; three machines, resizes HD/HD+/RDP DPI 100/125/150, counts/status changes, PRIMARY/NEXT HA, multi-hour idle and manual controls. Do not mark FIELD/OWNER PASS without results.

## Evidence and status
Owner screenshot 11/11 Agent186 and exact source PR919. Agent187 code candidate on `feat/d173-e190-native-tab-browser-log-20261111`. E190 isolated source/native prior PASS SHA `92b387bc0df1e279481a808f67ea951725a3a394`, run `43028471737` (before latest E192 modification). Current Agent187 CI/release/field status must be rechecked live before declaring PASS.
