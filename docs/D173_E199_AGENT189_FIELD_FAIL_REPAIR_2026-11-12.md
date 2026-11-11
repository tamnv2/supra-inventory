# D173-E199 — Agent189 FIELD FAIL · targeted repair (2026-11-12)

## Authority & boundaries
- Base: `main@05135deb99b017738b453158c632c4fb53912675`; D173 Agent only, independent of D172.
- Review branch: `fix/d173-e199-agent189-field-regressions-20261112`; draft PR [#929](https://github.com/tamnv2/supra-inventory/pull/929).
- Agent189 signed OTA release exists, but FIELD PASS and OWNER PASS remain unverified; no release, merge or stable authorization is implied by this repair.
- Do not change Worker, D172, Web, APK, Firebase, shared data, any credential, or production infrastructure under this change.

## Owner deployment instruction (2026-11-12)

Owner explicitly approved executing the scoped Agent repair and protected signed Agent190 OTA flow after review. Authorization: `ops/d173-e199-agent190-release-authorization.json`, source pin `18c3c0cc2367937c8649250a4e5d4f34d3df2ec0`, prior tag `relay-agent-v189`, Host14 unchanged. Release is allowed only with exact source/native CI, independent D172 guard, protected two-parent PR merge and OTA SHA readback; it is **not** approval to mutate shared Worker/Core or claim all eight defects FIELD PASS. Remote Agent HTTP400 remains a tracked incomplete finding.

## New Owner FIELD findings (not historical PASS)
1. Agent panel text flickers in cadence with local Desktop resource sampling.
2. Remote **Kích Agent** fails on VPS and ADMIN-PC.
3. Session-summary filters (Tất cả, Agent, Web, Picker, Reporter) should have clearly differentiated backgrounds in both themes.
4. Compact primary-selection button must say **Chọn Agent chính**, never **Chuyển chính**.
5. Some newly displayed dialog/button text appears black in dark theme.
6. Session action results must be visible at bottom-right of the session list; expire after **5s**, show max **5**, drop oldest when overflowing.
7. **Xoá phiên** sometimes reports repeated failures.
8. UI lags/stutters compared with earlier build.

## Evidence and constraints
- Real Drive logs `manual_agent_VPS_20261112_010759_*.log` and `manual_agent_ADMIN-PC_20261112_010726_*.log` both show `D173_E196_AGENT_REMOTE_ISSUE result=FAILED http=400 action=EXIT_AGENT error_code=INVALID_AGENT_CONTROL`. There is **no** successful dispatch or claim proof.
- Current Worker source validates target Agent ID, target login and action prior to password proof. The log lacks exact rejected field attribution; changing server validation or target identity without proof is prohibited.
- VPS `manual_agent_VPS_20261112_010420_*.log` records `UnauthorizedAccessException` during Web profile reset; ADMIN-PC `checkpoint_agent_ADMIN-PC_20261112_010317_*.log` records `IOException`. Both later reopen. Hypothesis: released WebView2/host profile handles; not verified as exclusive root cause.
- Current header listens to live status `TextChanged` and recomputes layout; this is a plausible UI-thread jitter cause, not a measured frame-time attribution.
- Prior `D173_E196_ROSTER_PERF` samples were 1–4 ms for 4–14 rows; they do not prove the roster is the source of lag.
- Agent189 keeps signed Host14; newer host-side paint callback remains unavailable. No claim that white-tab defect was resolved.

## Draft code (PR #929)
- Stable compact primary-action caption; session-only filter colors; dark-aware remote action dialog.
- Limit status-triggered Agent header relayout to actual wrapped-height changes while retaining existing local resource cadence.
- Local-only toast surface with five-second expiry, five entries maximum, newest appended and oldest evicted, anchored to roster bottom-right; existing action completion messages remain authoritative.
- Web session reset retries only the same verified Agent-owned WMS profile with a hard six-attempt cap after Host stop; no process-wide kills or deletion outside owned profile.
- Validate remote Agent ID/user/action client-side against the published Worker contract and emit boolean-only reasons to local logs; **does not fix** the unknown underlying server mismatch or bypass authentication.
- Scope regressions in `tests/d173-e199-agent189-field-regression.test.mjs`.

## PASS criteria (not inferred from source-only CI)
1. Windows native build, startup smoke, and scope/D172 guard PASS.
2. FIELD on VPS and ADMIN-PC: title/filter contrast; no black modal text, 1s resource data without text flicker or sluggishness; notifications correctly stacked/expired/evicted.
3. **Kích Agent** requires exact target, valid operator proof and acknowledged one-time execution of both independent actions. `HTTP 400` remains FAIL until root cause is demonstrated and fixed safely in a separately approved shared scope if necessary.
4. **Xoá phiên** succeeds or fails closed without deleting other data, including repeated attempts with a locked WMS profile.
5. Web paint verified by real visible-pixel evidence on the devices; `READY` / `DOM_READY` alone is not FIELD PASS.
6. OWNER PASS separate; no automatic merge/OTA/stable release.

## Current checkpoint
- CODE: Agent190 candidate pinned; CI: verify live PR #929 source/native and release gate before merge.
- RELEASE: Owner approved Agent190 **conditional on exact protected gate**; until release run + tag/channel readback, Agent189 remains current.
- FIELD: FAIL/PENDING; OWNER PASS: PENDING.
