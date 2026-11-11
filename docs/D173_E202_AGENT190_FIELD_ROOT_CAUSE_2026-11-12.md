# D173-E202 — Agent190 FIELD defects: remote Agent identity, 1Hz text flicker, stale Picker roster

Date (VN): 2026-11-12. **Analysis / proposal only — no Owner permission inferred to modify Worker, Agent, Firebase or deploy.** D172 independent PENDING/HOLD; Stable OWNER-GATED. Accepted source main at investigation `5c208ca63d18d1ca8586ac71a6bca5dd285a26b9`; signed Agent190 v190 Host14 technical RELEASE PASS, FIELD FAIL, OWNER PASS pending.

## Inputs (private logs read in Drive; no raw identifiers copied to public repo)

- VPS: `manual_agent_VPS_20261112_022809_*.log`, `checkpoint_agent_VPS_20261112_022647_*.log`, `session_agent_VPS_20261112_022638_*.log`.
- ADMIN-PC: `manual_agent_ADMIN-PC_20261112_022816_*.log`, `checkpoint_agent_ADMIN-PC_20261112_022331_*.log`, `session_agent_ADMIN-PC_20261112_022322_*.log`.
- Screenshot Owner shows Agent190 user-facing UI, two v189 fleet rows and old Picker sessions; UI artwork is not independent login authority.
- Reviewed exact live source: `relay-agent/D119AgentFeatures.cs`, `relay-agent/D161AdminControl.cs`, `relay-agent/FirestorePickerPresence.cs`, `relay-agent/FirestoreAgentLeaderCoordinator.cs`, `relay-agent/Program.cs`, `relay-agent/D173DesktopResources.cs`, `relay-agent/D173E179OverviewNoScroll.cs`, `relay-agent/D173E148ManualRosterRefresh.cs`, `service/src/index.ts`, `service/src/core.ts`.

## 1. Agent remote-kick: verified failure stage

- ADMIN-PC 02:25:51 action pressed, 02:25:52 `LOGOUT_USER` chosen, 02:25:55 operator submitted proof; local check `D173_E199_AGENT_REMOTE_INPUT result=DENIED target_valid=true user_valid=false action_valid=true`.
- **FACT:** `AgentPresenceView.AdminUserId` is not valid under the API target login regex when command is issued; the denial happens in Agent before any Worker request, proof validation, command issue or target claim. It is incorrect to claim a new HTTP400 from this attempt.
- `FirestoreAgentLeaderCoordinator.MaintainPresence` currently publishes `agent_admin_user_id = AgentDisplayUsername(session)`; `QueryFreshPresence` reads it back into `AdminUserId`; D119 roster shows blank as a dash, but enables Agent Kick solely from actor role, target Agent ID and not-self checks. `IssueE185RemoteAgentCommand` validates `AdminUserId` later (after proof dialog).
- `service/src/index.ts` validates target ID/login/action and uses a one-time proof; `service/src/core.ts` stores user + target ID/generation-fenced record and the authenticated claim compares `target_agent_user_id` to the target's privileged login.
- **Not yet proven:** Whether target login value was empty, a non-permitted character (e.g. login email), or a stale/unpopulated presence field. No raw account ID or credential should be added to diagnostics.
- **Proposed fix:** Source one canonical privileged login from the authenticated target session; normalize consistently at publication/read/claim and enforce valid known roles; refresh the presence field only on meaningful identity/role changes via existing cadence. Keep RBAC, current-password/OTP proof and one-time claim exactly intact. Hide/disable Kick Agent on a target row lacking a verified valid target login instead of asking for proof then rejecting. Add local **boolean-only** producer/reader/issue/claim stage telemetry for tracing. Do not relax Worker regex/proof or forge target user. No Worker edit needed if canonical field matches existing server contract; otherwise explicit separate shared-scope impact review required.
- PASS: at least two permitted target accounts demonstrate `ISSUE dispatched` + matching `CLAIM authorized` + exactly-once result of each `LOGOUT_USER` / `EXIT_AGENT`; invalid/missing user denied before proof; no cross-target effects.

## 2. Visible text flicker: repeated UI work still in v190

- `Program._trayMonitorTimer.Interval=1000` -> `UpdateTrayMonitor` -> `ApplyTrayMonitor` calls `ApplyD128ResourceMetrics`, `ApplyD173DesktopMetrics`, `UpdateAgentFleetGrid`, `UpdateD129AgentHeader` and `UpdateD129SupraUi` every second.
- Separate `_afterHoursTimer.Interval=1000` -> `CheckAfterHoursSchedule`, `RefreshBrowserBundleUi`, `RefreshD130ResourceClock`. In the screenshot's **sleep/overtime** state, `CheckAfterHoursSchedule` calls `ApplyAfterHoursAgentLayout(true)` every second; the layout path calls `D173E182FitAgentHeader` while visible even without state changes.
- E199 reduced one `TextChanged` layout path based on wrapped line count, **not** these separate schedule/resource update paths. The log does not contain per-control paint counts or frame times; direct repaint attribution is an evidence-supported hypothesis, not measured FIELD PASS. `D173_E196_ROSTER_PERF` values 0–7 ms do not support blaming large roster rendering.
- **Proposed fix:** Keep metrics sampling + displayed clock at 1s and same speed. Track state/geometry signatures; update only changed labels, never reflow headers/agent fleet/overtime panel unless width, visibility or row structure changes; prevent competing 1Hz timer callbacks from painting unchanged header/button regions; use existing WinForms buffers and do not alter Agent HA business cadence.
- PASS: 60s visible test on VPS and ADMIN-PC with 1s metrics, no heading/button flicker and unchanged geometry reflow count zero after initial settle; resource numbers still update and controls remain clickable; compare UI paint metrics before/after.

## 3. Stale Picker rows: authority split and local-only reconciliation

- ADMIN-PC 02:23:33 `DIRECT_PRESENCE_LISTEN count=10`; `agent_sync` also contained `pickers=10`.
- 02:26:03 `GET /api/agent/picker-session/revoke-all-preview` yielded `authenticated_picker_android_sessions=0` (evidenced by `BULK_PREVIEW_ZERO_RECONCILE` path). Agent locally fenced ten generations and removed them (`remaining=0 provider_op=false`). This was **not** a server revocation operation.
- 02:26:26 same Agent `D173_E148_REFRESH success=4 failed=0` and UI still `count=0` after applying local fences. This does not prove remote presence projection itself had been purged.
- Separately VPS restarted at 02:26:54, its fresh `DIRECT_PRESENCE_LISTEN` and `agent_sync` both supplied 10 old Picker sessions. No local tombstones survived across machines/restart.
- **FACT:** `FirestorePickerPresenceClient.Load/ParseGrpcDocument` treats schema4 projection `status=PDA_READY` as displayable without a live effective auth-session join. Server preview uses a separate authenticated-session authority; after zero it is currently only a local memory cleanup in `D161AdminControl.BeginD161BulkPickerRevoke`. The two sources can diverge and mislead on startup.
- **Proposed durable correction:** Align write/update/expiry/revoke of `picker_presence_projection` with the actual authenticated Picker session state and generation, propagating only exact login/logout/revoke deltas through the existing Firestore listener and `agent_sync`. Never revive a generation once server-authoritatively closed; retain later generation re-login. Do not treat inactivity alone as a logout or add 1s server polling. The UI should distinguish `PDA session actually logged in` from historic PickList activity. Fallback Agent-only display guards can reduce confusion but do **not** replace repairing shared projection authority.
- **Scope guard:** Projection/session update may touch a registered shared Worker/Core or Firebase path. Verify exact endpoint ownership and mutation effects, obtain explicit Owner authorization for shared infrastructure scope if required, test D172 isolation + D173 both modules. No current mutation authorization inferred.
- PASS: zero active authenticated Picker sessions -> new VPS/ADMIN-PC both show zero immediately after current login/logout event, without pressing bulk revoke; 2 live sessions then 1 revoked leaves exactly 1 on both Agents; delayed old-generation projection/sync cannot resurrect it; new-generation re-login does show; no unbounded new Cloudflare/Firebase usage.

## Gate and action
- Request received is **analyse cause and approach**, not approval to implement/deploy. This change records evidence only.
- CODE: NO NEW FIX; CI/RELEASE: Agent190 previously PASS, not a cure claim; FIELD: FAIL; OWNER PASS: PENDING.
- Do not upload raw logs, staff names, user IDs, token values or private row data to public repository.

## Owner implementation / Agent-only release order (2026-11-12)
- Owner explicitly requested **chạy code và triển khai Agent đã sửa lỗi** after this analysis. This authorizes D173 **Agent-only** code and signed OTA after source/native, authority, D172 isolation and exact SHA release gates. It does **not** authorize changing shared Worker/Core/Firebase picker-session projection, D172, Stable, Web or Android.
- Agent191 candidate source pin `673a1277ddc1592a4764b2bc57a1da7d3d482a9a`, based on main `5c208ca63d18d1ca8586ac71a6bca5dd285a26b9`, Host14 retained, previous signed Agent190 immutable. Authorization `ops/d173-e202-agent191-release-authorization.json`.
- **Remote control**: derive privileged target login from authenticated target identity where available; prohibit command button/proof prompt if target privileged login is absent or invalid; preserve existing Worker validation, proof, server one-time claim and target-generation fence. Correct real remote execution still requires paired-device FIELD proof.
- **Text flicker**: preserve 1-second resource/schedule sampling and local timers; skip unchanged after-hours geometry / header / fleet layout calculations. Paint/60-second FIELD test pending.
- **Picker stale presence**: no fake Agent-only zero result. The authenticated session and durable Firestore projection diverge across machines; shared authority repair requires explicit separate impact approval and D172/D173 regressions. This remains **open**, not fixed by Agent191.
- Agent191 source tests: `tests/d173-e202-agent191-field-regression.test.mjs`; protected CI/release: `.github/workflows/d173-e202-agent191-release.yml`, `tools/d173_e202_agent191_release_gate.py`. No new polling or service usage path.
- Until live workflow results and published OTA tag/channel hash are verified: **CODE CANDIDATE, CI PENDING, RELEASE NOT PASS, FIELD FAIL, OWNER PASS PENDING**. Signed Agent190 remains current production.
