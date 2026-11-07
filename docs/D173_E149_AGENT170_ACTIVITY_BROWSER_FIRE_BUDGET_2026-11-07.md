# D173-E149 — Agent170: Web Agent, hoạt động gần nhất, Fire quota (07/11/2026)

## Owner instruction
1. Agent169 sometimes opens owned SUPRA WebView2 Host as independent window: require Agent tab only; WMS session expiry must restore Agent and the correct tab for operator login.
2. Follower Agents must see PRIMARY's latest Picker/Agent activities.
3. Manual refresh reads current PRIMARY-shared data.
4. PRIMARY switching must not drop or overwrite newer activity.
5. Analyze actual 7-day Fire usage and maximize sync speed with <=80% target. No change to WMS/Confirm outcome or APK/Web; D172 remains independent HOLD; Stable remains OWNER-GATED.

## Verified before-code
- GitHub PR853 merged; Agent169 released 07/11/2026. FIELD reports above remain FAIL, not released acceptance.
- Browser source Program.SizeEmbeddedWmsViewport returned unless selected tab; RefreshSupraBrowserStatus required old placeholder visible to re-embed; SupraConfirmBrowser.SetBrowserWindowsVisibleNoLock foregrounded a top-level unparented owned Host. Host12 own WinForms startup can momentarily create/show window before it is reparented.
- D173E103Activity was strictly local RAM, not in D134 shared snapshots. Existing agent_sync uses Firestore CAS updateTime, gRPC one listener for agent_sync + picker_presence. D173E148ManualRosterRefresh already reads exact 4 sources, including agent_sync, on button click.
- Google Drive Beta Logs folder shows daily Agent logs from 01/11 through 06/11, and the folder 07/11 was empty on investigation. D166_USAGE_AUDIT reports source=AGENT_ESTIMATE_NOT_BILLING and process restart clears counters. Those figures CANNOT prove 7-day provider billed reads/writes.
- Existing authenticated usage endpoints: Agent GET /api/agent/vps-usage?window=7d and Agent Operations Gateway action=get_usage_export. Access requires active authorized Firebase session, which this GitHub/Drive review cannot impersonate; no account credentials are read from source or repo secrets.

## Agent170 code-only candidate
- Remove old placeholder/selected-tab dependency from re-embedding, make Agent hide (not foreground) an unparented managed Host. Guard the source of protected WebView2 Host12 to start off-desktop without taskbar until Agent embeds its HWND; this requires a newly bundled/signed Host and cannot fix Host12 binaries already installed. On expired WMS login marker, restore Agent once; select existing Web Agent tab. If operator intentionally hid a password-protected tab, preserve password gate rather than expose it without authorization.
- Extend ONLY existing relay_poc_coordination/agent_sync with optional activity_json. Accepted Picker and Agent actions are CAS-merged, bounded to 220 latest actor entries, validated and delivered using EXISTING Firestore listener (no new document, listener or timer). New code reads activity via D173E148 manual exact load. PRIMARY business lease, ACK, WMS/Confirm, Picker/reporter status remain unchanged.
- Activity ordering: latest session generation wins; for same Picker request, terminal outcome replaces ingress; older timestamp cannot overwrite a newer event. Agent roster identity keyed by actual normalized login and instance. Fixed UI labels only; no token/password/WMS HTML added to Firestore.
- CAUTION: no durable offline event outbox or server acknowledgement has been implemented, so this code-only candidate does NOT yet guarantee losslessness if publisher is offline or process crashes before Firestore CAS. An initial Host12 WinForms startup flash before Agent embedding may also remain. These are explicit unresolved FIELD/technical gates, not claims of complete fix.

## Fire quota design and evidence gate
- Existing per-process D166 estimates are not billing. Provider actuals are required for the 7 complete days 31/10–06/11 (VN plus provider's own quota-day), with project id supra-inventory-beta, billed Firestore reads/writes/deletes, latency, peak hour, existing activity/event rates and Agent fleet size.
- The nominal Firestore reference 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day would imply Owner ceiling 40,000 reads, 16,000 writes and 16,000 deletes per day *if that quota tier applies to the project*. Never conflate Cloudflare quota with Fire.
- Rough upper bound per new accepted activity: 1 document write plus up to N follower listener document reads; N must come from actual connected listeners, including reconnects. At E accepted events/day incremental writes approximately E; incremental billed reads approximately E×N (not including retries/reconnects).
- Do not increase role heartbeat, polling, listener count or automatic refresh until 7-day provider readback confirms <=80% of EACH limiting family and the monthly $5 shared-cost requirement is preserved. Use event-driven delivery before increasing periodic polling. On threshold breach, skip optional acceleration only; never skip authoritative business ACK or conceal status.
- No new Fire provider resource or changed quota allocation; D172 independent PENDING/HOLD; Stable OWNER-GATED.

## Acceptance/test gates
1. Native .NET Framework x64 build with exact Agent170 version and signed artifact SHA after OWNER-GATED PR approval; static E149 and existing D169/E148 tests; native C# anti-stale unit coverage.
2. Two followers and PRIMARY: activities on all Agents show on listener; clicking manual refresh reads fresh shared snapshot even after reconnect; generation/terminal conflict and repeated failovers.
3. Windows minimize/restore and tab switch 100×, Host restart, WMS session expiry and return login; **no external Window visible**. If initial Host12 flash reproduced, Host13 must be changed and bundled in separate guarded step.
4. Agent↔Picker, WMS confirm once, HA/ACK and D172 regression on all shared changes.
5. 7-day Fire provider readback with change forecast; measured <=80% and no additional monthly bill under planned budget. No synthetic PASS.
6. CODE/CI/RELEASE/FIELD/OWNER PASS remain distinct; **this PR is CODE ONLY**, no release yet.
