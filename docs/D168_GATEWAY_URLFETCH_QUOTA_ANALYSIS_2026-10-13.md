# D168 — Vì sao Google Apps Script Gateway báo lỗi UrlFetch ngày 13/10/2026?

**Status:** READ-ONLY TECHNICAL FINDING / HYPOTHESIS TRIAGE; no Agent/Gateway/Worker source changes or deploy authorized. See D168-REQ-008, D168-REQ-009 and accepted D167 v130 source.

## Google officially documented limits (checked 2026-10-13)
- `URL Fetch calls`: **20,000/day** for consumer Google accounts, **100,000/day** for Workspace accounts; **per executing user**, resets 24 hours after first request, not necessarily at midnight VN. Verify which type owns this deployed Web App; do not assume 100k.
- Script max runtime 6 min/execution, concurrent 30 executions/user (1000/script); additional Properties, Drive and trigger quotas separate.
- App Script `UrlFetchApp.fetchAll([...])` sends N network requests; operational estimate counts N URL Fetch units rather than one call. No official remaining UrlFetch counter is available through the current connected tooling.
- Source: https://developers.google.com/apps-script/guides/services/quotas and https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app .
- Scope `ops/project-scope.json`: registered Beta Agent Operations Gateway `execute_as=OWNER`, Web App executes as deploying user. Thus all operations of this Gateway share the script executing user's URL Fetch budget; other scripts using the same executing account may also consume that user's quota.

## Per-action source cost (normal complete path, NOT measured provider counts)
From `ops/apps-script/agent-log-gateway/Code.gs`:
- Ordinary Firebase Agent login is direct and does **not** use Gateway.
- Protected Gateway action `d167_sku_sync`: one `validateIdToken_` POST to IdentityToolkit plus one `proxyD167SkuRequest_` to Worker = **2 URL Fetch calls** per ordinary successful Gateway request (schedule/status/claim/stage/preview/publish). An exception at the validation step prevents second call.
- `upload_agent_log`: one token validation fetch plus possibly one `resolveDailyLogFolder_` fetch to Worker on daily folder cache miss = **1–2 calls**; `DriveApp` file operations consume distinct quota.
- `get_firestore_usage`: one auth validation fetch, then on 15-min shared cache miss `fetchMetrics_` submits **13 Monitoring requests** by `UrlFetchApp.fetchAll`, meaning about **14 URL Fetch requests**; on hit = **1**. Ideal once per 15 minutes ≈96 cache rebuilds/day ×13 = **1,248 Monitoring requests/day**, plus one authentication fetch for each individual refresh invocation.
- `get_usage_export`: one auth validation, multiple Monitoring requests, a Drive about read and one Worker D166 Usage read; this is a **manual** request, not part of 15-min automatic cache.
- Special privileged Agent OTP operations proxy Worker directly and are not subject to token lookup when pre-auth; account policy/permission controls remain separate.
- Failed uploads or quota exhaustion can end the request before all expected outbound fetches; never multiply all Agent DEFER log lines by two and claim that exact quota was spent.

## Evidence timeline and confidence
- D168 sanitized local log analysis: **27 `D160 USAGE refresh=DEFER`** with `urlfetch` daily excessive-use error appear from **around 14:00 VN 13/10/2026** on PRIMARY. This is strong evidence that the shared Google script executing identity had exhausted a UrlFetch limitation **by that observation**, but does not provide the Google-exact first threshold crossing or script/account consumption breakdown.
- Affected PRIMARY then shows **948 `D167_SKU sync=DEFER`** from **16:49 to 19:52** (most `UNKNOWN`), with a proven `OnPrimaryOrWmsReady` readiness trigger bypassing the intended 15-minute local cooldown about every 11s; second Agent has 161 similar errors from 15:20–15:51. **Important chronological guard:** these observed post-14:00 retries alone cannot explain why the UrlFetch daily error had already begun by 14:00. They exacerbate load and disruption; some never reached Gateway.
- Two separate Agent log upload traces have 22 and 20 `DEFER` errors respectively, mainly timeout/keep-alive, while same machines show working Google authentication/Firestore. These are **not all proven UrlFetch quota failures**. Source Agent uses 10s HTTP deadline versus Apps Script gateway `waitLock(15000)`.
- Available evidence does not include Apps Script My Executions/Google Cloud Logging exact per-action totals, API quota consumed by other scripts executing under the same user, first UrlFetch call time in 24h window, or accurate provider remaining quota. Therefore **root-cause allocation is NOT VERIFIED**. Do not claim Agent SKU alone used 20k, or that Office Wi-Fi uniquely caused quota failure.
- Illustrative upper-path estimate: 948 successful 2-fetch requests would equal 1,896 UrlFetch; these events were failure logs and largely occurred AFTER the around-14:00 quota error; this figure is NOT actual usage. Rough ideal 1,248 Monitoring batch fetch/day likewise is design arithmetic, not observed consumption.

## Next safe verification (read-only)
1. Apps Script dashboard for scoped **SUPRA Inventory Beta Agent Operations Gateway** > **Executions**, filter 13 Oct 2026 and Failed/Timed out; compare earliest `urlfetch` exception, action types/call duration/successes. Current tools cannot query the Owner's Apps Script execution dashboard; physical source evidence is missing.
2. If the project is attached to the standard Google Cloud project, review Cloud Logging and Monitoring API requests for the same time range, without exposing tokens, usernames, raw request bodies or personal data. Count per action only where existing anonymized logs allow; avoid new 1-event-per-write telemetry.
3. Check whether registered other scripts under the *same executing identity* share the account quota, and whether 24h quota-reset window overlaps preceding-day traffic. Do not access/change out-of-scope projects.
4. Obtain the D167 Service actual `FULL / DELTA_12 / DELTA_19` durable receipt, compare to Agent action logs and Gateway executions; never infer DONE from retry markers.

## Proposed correction for later Owner approval
- **P0:** D167 SKU one-shot scheduler must honor the 15-minute backoff through *all* browser readiness and HA event paths; terminate repeated calls on quota exhaustion with bounded, truthful UI and no false DONE. Preserve PRIMARY/generation CAS and WMS confirm priority.
- **P0:** Agent support-log transport: single-flight, justified read/write deadlines > possible lock wait, bounded retries and confirmed Drive ack before local deletion; distinguish timeout vs quota from gateway.
- **P1:** continue shared 15-minute Usage cache, coalesce refreshes, avoid redundant per-Agent reads. Evaluate one fewer duplicate token verification for **strict Worker-forward-only** methods only after Worker re-auth/security review, not by weakening privileged Drive actions.
- **P1:** measure old and new UrlFetch, Cloudflare requests/CPU/DO meters, Drive storage/operations, Firestore operations, latency and HA; direct Worker requests only when legitimately Internet/PDA-reachable and not switching critical PRIMARY away from Office.
- No additional provider listeners or per-event log writes to measure quota.

**Boundary:** This is an analysis proposal under existing D168; it is not Owner code approval and does not authorize Beta or Stable release.
