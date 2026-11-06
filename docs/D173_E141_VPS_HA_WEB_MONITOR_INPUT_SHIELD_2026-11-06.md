# D173-E141 — VPS HA lease, WebView2 monitoring and protected visible browser (06/11/2026)

**Status:** TECHNICAL_FINDING / OWNER_REQUIREMENT_INTAKE / IMPACT_REVIEW. **CODE NOT STARTED.** No CI, Provider, Agent, WebView2 bundle or FIELD/OWNER PASS from this document. D172 independent PENDING/HOLD; legacy Stable OWNER-GATED.

## 1. Owner requirement

1. Determine why the authenticated VPS loses PRIMARY while the WMS Web remains usable and Internet appears functional, then propose a safe root-cause repair.
2. Add a configurable, VPS-only, around-the-clock WMS Web health/activity/incident monitor. OFF/ON control; include sanitized Web monitor records within the **existing Agent log-upload bundle** on manual, scheduled and authorized support-log submissions. NEVER log password, token, session, cookie or sensitive WMS payload.
3. Replace the WMS browser show/hide behavior with a persistently visible Agent-owned WebView2 view and a default-protected **view-only interaction shield**. The operator can see Web, but cannot click/type/scroll/drag while protected. The Agent's existing CDP/DOM automation must remain functional; authorized unlock restores interaction.

This is a design/impact review checkpoint under the repo process, **not permission to silently change Production**.

## 2. Verified source and field evidence

**Base:** signed Agent166 + Android vc126 from PR #843, merged as main `01af1c886e94c1a42fd00bb20802d4260c985cd1` on 06/11 VN. Source: `relay-agent/{FirestoreAgentLeaderCoordinator,FirestoreVpsReclaim,FirestoreConfirmationTransport,Program,SupraConfirmBrowser,D157AgentFeatures,AgentLogUploadBridge}.cs`, `relay-agent-webview2-host/Program.cs`; read-only VPS and standby Agent logs for 06/11 from existing scoped Google Drive log folders. Do not store raw logs or personal identifiers in the public repo.

- 10:51:36 VPS began one confirm job; 10:51:57 standby logged `COMMON_LEASE_EXPIRED`; 10:51:58 standby CAS takeover logged `ACTIVE_FAILOVER_LEASE` with threshold 15s; 10:52:05 VPS had `FAILED_PRECONDITION`; 10:52:06 VPS observed demotion to NEXT_A. VPS confirmation batch took 29.377s. This proves **lease expiry and failover**, NOT that the WMS session stopped working, nor exactly whether the stall was CPU, network, Firestore, thread contention or scheduling.
- 11:03:09 targeted handoff made VPS PRIMARY (`D157_HANDOFF_ALREADY_PRIMARY`); 11:03:25 standby again logged lease-expired CAS takeover. VPS local role was not refreshed to NEXT_B until 12:01:14. Local role and Firestore authority can diverge; the separate generation/ingress fence blocked mutations, which must be preserved.
- VPS locally estimated `PRIMARY_LEASE_WRITE` counts: 10:00 hour **301**, 11:00 hour **1**; no corresponding standby `D169_VPS_READY` writes after initial early-shift startup in the inspected aggregate. These counts are Agent estimates, NOT billable provider metrics. Strong suspicion: the coordinator's heartbeat/role-refresh/ready-publisher lifecycle was stalled, blocked or no longer scheduled. The precise internal wait/exception requires new stage timing.
- Source heartbeat cadence `PrimaryLeaseHeartbeatMs=10000`; standby expiry `StandbyTakeoverAgeMs=15000`; `WritePrimaryLease` performs synchronous Firestore REST PATCH with 5s timeout and up to two attempts, within the same coordinator loop as role refresh, presence and other tasks. Only ~5s spare between a normal 10s heartbeat and the standby suspect threshold.
- VPS reclaim is conditional: VPS identity/role, fresh `vps_ready`, 30s stable ready, safe no-inflight handoff; a current manually pinned PRIMARY requires Owner consent before yielding. This is intended policy, not proof that 06/11 was a manual-hold incident. After takeover the missing VPS-ready projection/role-loop telemetry prevents root-cause finality.
- Web health checker currently executes real `Page.reload` at 60m without PRIMARY proof or 2h for standby after an idle fence. It is not only passive monitoring. Some `RELOAD_PASS` events immediately showed `picklist_codes=0`, therefore a valid WMS login, confirm-route readiness and data hydration must be distinct states.
- 06/11 VPS log shows 21,396 `PICKER_LOCK_LISTEN` connected/reconnect lines in one ~7h sample, dominated by `grpc=PermissionDenied`; verify deployed Rules and backoff separately. Do not attribute every connection to billed reads without provider evidence.
- Owner screenshot: virtual machine with **2 vCPU, 4 GB RAM**; observed CPU up to about 73%, memory ~2.3–2.5 GB (57–62%). A screenshot does not identify the CPU-consuming process or prove an OOM/stall.

## 3. HA root-repair proposal — no speculative timeout bump

1. **Instrument first, no additional Firestore timers:** local monotonic `Stopwatch` stamps on coordinator-loop enter/exit, task alive/wake/cancel, role-read duration/status, lease write start/ACK/fail, lease-age at standby decision, generation hash/prefix, `vps_ready` write and expiry, token refresh, role transitions and safe-handoff rejection reasons. Record an explicit `HA_LOOP_STALLED` marker if the local coordinator heartbeat is late; separate UI `PRIMARY` display from canonical fenced business role.
2. **Isolate critical lease renewal scheduling** from WMS/CDP lock, long business ACK, UI dispatch, fleet scans and support log upload while preserving one authorized coordinator and one generation-scoped lease. No parallel same-generation lease writers, no unconditional retries, no new resource. Bound Firestore calls, instrument p95/p99 and monitor last successful renew. Preserve current business mutation fence (negative stale-generation proof must block final click).
3. Standby must demand fresh authoritative generation/lease evidence before CAS promotion; when Internet RTDB is available it may contribute **corroboration**, but Office mode cannot depend on RTDB. Evaluate 10s/15s with real 2-vCPU stress; never simply extend expiry or double Firestore heartbeat frequency without documented failover-latency and daily write impact.
4. On lease loss or coordinator stall, move local business path to fail-closed `SUSPECT` until authority reconciles; do not continue work just because the WMS UI remains open. Restore a stopped coordinator with a single-instance guard and role readback, **never** force local PRIMARY.
5. For VPS auto-return, publish a fresh bounded VPS-ready projection when in standby, and log `AUTO_RETURN_BLOCKED` as a finite enum: stale ready, manual holder/Owner consent, active batch, role generation CAS conflict, WMS unready, provider error or schedule. Auto-return only after failover-created PRIMARY, fresh WMS/lease and safe idle; intentional manual Owner hold is preserved unless separately changed.

**Minimum regression:** 2-vCPU contention; Firestore PATCH 5–30s stalled; 10s lease, 15s expiry; duplicate NEXT_A; late ACK after handoff; manual Owner takeover vs automatic failover; VPS-ready publication after demotion; no writes from stale generation; Office/Internet transitions; 05:00 SKU-only lease; agent restarts; signed Agent166 baseline parity; no unnecessary reads/writes.

## 4. VPS-only Web diagnostic design

**Authorization/identity:** enable only for the existing authenticated `vps` Agent account with eligible Agent role and its owned WebView2 host. Do not enable on other Agents or Android/Web/Worker. VPS setting persists locally (opt-in or ON-by-owner after approval), with explicit ON/OFF state; when OFF, no Web monitor subscription/sampling. No new cloud provider endpoint, project, collection or account.

**Safe event schema (allowlist only):** `utc_ms`, `monotonic_ms`, `component`, `event_code`, `phase`, `success`, numeric `elapsed_ms`, `epoch`, `generation_short`, `role`, `wms_state`, `page_loaded`, `login_marker`, `confirm_route`, `dom_ready`, `hydrated`, `picklist_count`, `checkbox_count`, network outcome category, status code/bucket, last lease ACK age, process PID alias, CPU percent / working-set MB. Never copy free-form exception messages or raw URLs.

**Capture** Browser host init/navigation/ready/reload/route changes, hidden/visible, owned WebView2 active child transitions, process failures, CDP disconnect/reconnect, command stage success/error/duration, WMS data/count changes, 429/403/5xx *counts*, Agent/manual Confirm result reason, HA transitions, webpage user-input shield enable/disable/blocked-input count, and local RDP/display/window-state transitions when supported. WMS page URL only as safe allowlisted **route class**; never query, fragment, code, payload or headers.

**Safe observability constraints:** NO password, text entered into fields, clipboard, tokens, cookies, WMS HTML/DOM body, screenshots, screen recording, session storage, raw HTTP bodies, personal identifiers, full PickList or PDF/Excel report data. Prefer enumeration/aggregates to denylist regexes. Existing WebView2 host currently writes `ex.Message` to a temp file during host failure; replace this with allowlisted type/status only when implementing the feature.

**Resource bounds:** event-driven transition logging; aggregate stable health at ~60s only when ON; 5s local-only sampling for at most 1min around an incident if benchmark allows; bounded ring buffer and rolled local JSONL (proposed 5×4 MB files, maximum 20MB, 7-day ceiling). Never enumerate all open Windows/processes, collect network packets, or send periodic cloud logs. Benchmark process CPU and memory against VPS 2vCPU/4GB instead of claiming unmeasured overhead.

**Bundling:** extend existing `AgentDiagnostics.BuildUploadSnapshot` and `AgentLogUploadBridge.SealFromCheckpoint` to attach `WEB_MONITOR` lines for the **same [since,until) checkpoint** within the existing Agent upload payload; no second provider upload/job/listener. Persist pending locally on failures; prune only after verified accepted archive/Drive receipt. Avoid 4M-char truncation silently discarding critical incident lines: preserve bounded monitor tail, event counts and overflow marker, compare against Agent section cap.

## 5. Always-visible, click-protected WMS browser design

**Existing architecture:** the Agent owns a separate x64 WebView2 host process (`relay-agent-webview2-host/Program.cs`), with one existing authenticated WebView2 environment/profile and popup child views; `SupraConfirmBrowser.TryEmbedAgentWindow` may reparent the owned host HWND into the Agent Web tab. Existing code hides the browser on tab switches and on READY. Merely renaming Show/Hide is insufficient.

**Target:** keep the SAME owned WebView2 host and authenticated session visibly rendered; remove automatic hide/show and use a protected/unprotected toggle. The shield must attach to the **actual host's active WebView2 child** after popups and to the correct content rectangle when detached/embedded/resized or DPI/RDP changes. No second browser, page reload or separate WMS login is allowed.

**Shield ON (safe default):** host-owned native input interceptor/overlay above the WebView2 content, visually transparent or nearly transparent and never configured click-through (`WS_EX_TRANSPARENT` must NOT be enabled); swallow local mouse click, double-click, wheel, drag, touch and keyboard/focus navigation, including accelerator keys. Agent's existing trusted programmatic CDP/DOM automation remains available independent of the OS input surface. Explicit protected/read-only indicator outside the webpage. On failure to establish the shield, block local input or report LOCK_UNVERIFIED, never falsely claim protected.

**Shield OFF:** authenticated Agent operator only, preferably reusing existing `VerifyCurrentAgentPasswordForBrowserAction` before unlocking. WMS login can then be performed manually and protected mode re-enabled without reloading/navigation or losing session. Agent automation continues in both modes. Do not trust a CSS/JavaScript-only pointer-events overlay; it cannot guarantee keyboard/user-input isolation and may modify WMS semantics.

**Limit:** this is an operator-input guard, **not** a security boundary against a Windows administrator, devtools or another privileged process. Never describe it as anti-tamper protection. Visible browser windows can still be minimized/occluded by Windows/RDP; do not promise display persistence across every disconnected desktop session without real Windows Server testing.

**Release impact:** source in `relay-agent` **and** the separately signed/versioned owned x64 WebView2 host/browser bundle; existing WebView2 environment/profile must survive in-place update. No Worker, Android, D172 business routes or WMS API changes. Test all RDP/dpi/resize, active-child popup, lock/unlock, focus, mouse wheel, F5, Ctrl+R, keyboard and touch; tests must show Agent's programmatic confirm success in protected mode and no human input. Native x64 CI plus physical VPS field proof required.

## 6. State and gate

- **Evidence:** HA failover after stale lease is proven; exact cause of the lease-loop interruption is **not** conclusively established without new local stage telemetry. CPU screenshot is only capacity context.
- **Proposal:** separate risk review for HA source, local VPS diagnostics and host input shield; then Code-only branch + exact CI, real Windows 2vCPU/4GB test, separately gated signed Agent/host release and measured FIELD results.
- **CODE / CI / RELEASE / FIELD / OWNER PASS for E141:** NOT STARTED / NOT RUN / NOT RELEASED / NOT TESTED / PENDING.
- **D172** independent PENDING/HOLD; **Stable** OWNER-GATED, no new cloud resources or secrets.
