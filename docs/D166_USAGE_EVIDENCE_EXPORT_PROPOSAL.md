# D166 — Agent on-demand Usage evidence ZIP: research and impact proposal

**Status: OPEN FOR ANALYSIS / OWNER IMPLEMENTATION APPROVAL PENDING.** On 2026-10-08 Owner explicitly confirmed `GOV-QUOTA-20261008 PASS` and requested opening D166, **first for research, cost assessment and proposal**, not code/release/provider mutation. Accepted runtime base: D165 Agent v120, Android vc102, Beta Web/Worker/RTDB. Inventory Stable remains OWNER-GATED. The proposed button text is **“Tải số liệu Usage để phân tích”** on restricted Agent **Thông tin Usage**.

## 1. Current implementation verified from source

- `relay-agent/D160Usage.cs` already displays provider-derived Usage and 24 hourly points, fetches `action=get_firestore_usage` via existing HTTPS Apps Script Agent Operations Gateway, requires valid Agent Firebase session, and refreshes at `:00/:15/:30/:45`.
- `ops/apps-script/agent-log-gateway/Code.gs` uses `CacheService`, lock and 15-minute TTL. A cache miss executes **13 Cloud Monitoring timeSeries.list metric groups** for Firestore read/write/delete, connections/listeners/rules/storage, FCM/IdentityToolkit/SecureToken API requests, and one Cloud Run service requests/instances/billable-time. Current code returns an aggregated usage snapshot, not all raw provider series, and does not collect Cloudflare, Firebase RTDB, Drive/Sheets consumption, GitHub or actual billing dollars.
- D160 Monitoring fetch is read-only: it does not issue Firestore document read/write/delete operations. **Cloud Monitoring API reads and Apps Script URL Fetch executions are not free of resource quota or automatically free of monetary charges beyond entitlement.** Retain existing caller identity check and allowlist for exact permitted Agent login `admin` and `tamnv2`; no new client-facing provider credentials.
- Existing D161 support-log collection/upload is separate. Do **not** trigger support-log requests, duplicate logs or WMS business traffic from the Usage export button.

## 2. Owner choice and evidence windows

- One user-initiated button; no background execution, timer, startup hook, automatically mailed file, scheduled ZIP, or user-disk scan.
- Select **Hôm nay (00:00 VN → thời điểm bấm)** or **24 giờ gần nhất**. For end-of-shift analysis, propose a **Ca 06:00–22:00 VN** preset only if Owner approves adding a third choice. Every provider section must record exact inclusive/exclusive UTC interval, Vietnam-local display, provider billing/quota reset, query time, latest datapoint and partial-day status. Never promise every provider exposes the same 24h granularity.
- For Google Firestore daily free tier, show both selected analysis window and **America/Los_Angeles** provider quota day. Cloudflare monthly billing and Google Cloud monthly cost belong to separate MTD windows, not invented daily metrics.
- Capturing 24h immediately after midnight VN is different from an operational shift; document this explicitly.

## 3. Evidence matrix — scoped Inventory Beta only

| Source | Evidence to include | Method, implementation constraint | Limitation |
|---|---|---|---|
| Firestore | hourly reads/writes/deletes, listeners/connections, rules allow/deny/error, storage | Reuse cached D160 Google Cloud Monitoring source and existing authorized Gateway | Monitoring lag, availability gaps; monitoring counts may not equal the billing invoice |
| Firebase RTDB | sent bytes (prefer billed-relevant `network/sent_bytes_count`), payload/protocol bytes, connections/storage where available | **New read-only Monitoring metric queries** from existing scoped Beta project, contingent on metric availability, permitted identity and separate implementation approval | RTDB bytes approximations differ by metric; never claim exact dollar cost without invoice |
| Firebase Auth/FCM | API request counts, error classes and timeline if exposed | Reuse `serviceruntime.googleapis.com/api/request_count`; no user/account list | Requests ≠ MAU fees or messages successfully delivered |
| Cloud Run Functions/Logging | request statuses, billable execution metrics and optional sanitised volume totals | Existing Monitoring for current service; add registered Beta services only after metric validation | Running cost depends on SKU, region, free tier and credits; do not fetch raw Cloud Logs by default |
| Cloudflare Workers/DO | Worker invocations/errors/CPU and DO namespace request/duration/SQLite where GraphQL metric is available | GraphQL Analytics through **existing authorized server-side bridge only**, if least-privilege token can be provisioned in scope with separate Owner approval; NEVER put account API token in Agent or ZIP | Shared account contains other projects; strict exact Worker/namespace filters, dataset availability/retention/sampling, and no cross-project dump |
| Google Drive storage | Consumer account total/Drive usage, known scoped Beta folder item count and metadata only if justified | Existing OAuth only with scope readback; use `drive.about.get` fields with existing allowed OAuth scope; no reading/downloading operational files | Quota is account-level, not per project; a current storage snapshot is **not** 24h consumption; avoid Drive folder scan |
| Google Sheets / Drive API | Requests, responses/errors where service runtime metrics exist; no spreadsheet rows | Monitoring consumed_api by verified project and service; optional read-only provider quota metadata | Per-minute quota is not reconstructible from one total without adequate sampling/granularity; scope may be per user/project |
| Apps Script | Gateway cache hit/miss, bounded execution count/error if existing metrics, 13-monitoring-query baseline | Local summary counters or existing service project telemetry when available, no new background write | Consumer quotas per executing user, not a universal daily usage API |
| GitHub Free | Agent update-check quota incident counts from sanitized existing logs if present; optional API rate-limit status without creating credential | Prefer existing local telemetry; no PAT/token in EXE or ZIP | GitHub account usage by all repos is outside Inventory scope; no global complete 24h accounting |
| Google Cloud billing | **Actual USD spent / SKU** only if authoritative billing CSV or read-only eligible existing export exists | Preferred manual Cloud Billing Reports CSV appended to ZIP by Owner; do **not** create BigQuery billing export in phase 1 | Billing lag and separate billing access; do not invent spend from metric counts |
| Other project providers (D1/R2/KV/Queues, other free accounts) | `NOT_IN_SCOPED_RUNTIME` / `NOT_CONFIGURED` | Report unsupported without probing unregistered resources | Inventory repo cannot use/update other projects' accounts or services |

Never label a zero on missing/unavailable/provider-delayed data: use `N/A` + failure reason.

## 4. Official cost / quota findings (checked 2026-10-08)

1. **Google Cloud Monitoring read API** (October 2, 2025 onward): first **1 million time series returned per Billing Account per month** included; thereafter **USD 0.50 per 1 million time series returned**, with minimum billable one series for eligible read query. Google Cloud console Monitoring API reads are separately exempt under documented conditions. **Charge is per returned series, NOT per 24 hourly points and NOT just per HTTP call.** Existing Gateway executes 13 metric queries on 15-minute cache miss; additions must count actual returned series and pagination, not guess. https://cloud.google.com/products/observability/pricing
2. **Google Apps Script Free/consumer**: URL Fetch **20,000/day**, six minutes maximum per execution, shared executing-user budget. Monitoring collection may use multiple UrlFetch calls on a cache miss. A one-off read-only export is unlikely to be material relative to these quotas but cannot claim zero calls. https://developers.google.com/apps-script/guides/services/quotas
3. **Cloudflare Analytics GraphQL**: documented default **300 GraphQL queries per 5 minutes**, plus general API limits and per-dataset time/field availability. These are rate limits, not evidence of a per-query charge; avoid claiming zero account/provider cost until exact dataset and contractual entitlements are verified. https://developers.cloudflare.com/analytics/graphql-api/limits/
4. **Google Sheets API / Drive API**: standard operations currently published as available without additional cost; documented quota and **future excess-quota charges planned later in 2026**, so avoid treating this as permanently unmetered. Drive `about.get` can return `storageQuota` by existing authorized scope. https://developers.google.com/workspace/sheets/api/limits and https://developers.google.com/workspace/drive/api/guides/limits
5. **Cloud Logging**: log storage/ingestion can be billable; Google lists no additional query-analysis charge on standard Cloud Logging buckets, but broad log reads add API/quota/network/security surface. Prefer existing sanitized Agent support logs separately; do not fetch raw logs for this button. https://cloud.google.com/products/observability/pricing
6. **Google Cloud Billing BigQuery export** requires new BigQuery storage/query resources and can incur cost and latency; **not authorized**. Google Cloud Billing Reports supports manual CSV download now. https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-setup and https://docs.cloud.google.com/billing/docs/how-to/reports
7. **GitHub public unauthenticated REST** 60 calls/hour/IP; authenticated rate generally 5,000/hour/account, but provisioning a client PAT for Usage download is not justified or authorized. https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

**Illustrative Monitoring cost math only:** if a complete export results in 500 chargeable time series returned, 30 exports yield 15,000 time series across a month, before counting existing clients. If the Billing Account remains within its 1,000,000 included time-series pool, Monitoring read API charge for this is USD 0. If the allowance has already been exhausted, incremental charge for 15,000 returned series at USD 0.50 / 1,000,000 is USD 0.0075. Actual workload cannot be determined until measured; this excludes other services and extra requests.

## 5. Recommended phased design — not approved for implementation

**Phase A: Recommended initial version, on-demand, low cost**
- Add button **“Tải số liệu Usage để phân tích”** in Agent Usage. Require same exact login allowlist, current authenticated session and fresh auth check; remain absent/disabled for unauthorized users. Debounce clicks, one run at a time, 15-minute snapshot/cache reuse where still accurate.
- Export **existing provider-authoritative D160 cache** first. Optional Google RTDB Monitoring query enrichment only after field-level metrics and rights are verified. Allow section-by-section `N/A` without failing the entire export.
- Save with Windows SaveFileDialog pointing by default to **real Desktop (may be OneDrive-redirection)**, filename `SUPRA_Inventory_Usage_YYYYMMDD_HHMM_VN.zip`; atomic temp write/rename; no upload to Drive/Worker/GitHub; no automatic email; no Desktop-only hardcoded path.
- ZIP with `manifest.json` (schema, app/version, utc and VN range, endpoint aliases, time-series/query coverage, latency, data provenance, provider reset), `summary.json`, `usage_hourly.csv`, `providers/*.json` (sanitized aggregated data), `collection_status.json`, `README.txt` and SHA-256 checksums. Preserve missing metric reasons, source timestamps and full data quality flags; avoid huge raw Cloud Monitoring time series if unnecessary.
- Prioritize 00:00 VN→now and 24h rolling. If User wants after-shift, capture at >=22:00 or choose fixed 06:00–22:00 and mark partial interval if collected early.
- Only local ZIP generation and provider read; avoid new scheduled tasks, Firestore writes, storage, background polling, and raw private logs. Target an aggregate **tens-to-hundreds-of-KB** ZIP as design goal, not a verified outcome.

**Phase B: Conditional authorized extensions**
- Add Beta RTDB Monitoring bytes/storage; exact Cloudflare Worker + DO GraphQL data through server-side least-privilege bridge, subject to test rights and no cross-project data.
- Optionally Drive `about.get` for *current* storage, and Sheets/Drive API consumed-service telemetry when exposed. No manual raw file downloads and no new OAuth scope silently.
- Provider API secret must be held in authorized server-side secret store and **never** in Agent, logs, public GitHub repository, or export bundle. Office network historically blocks direct Cloudflare and relies on allowed Google-hosted gateway. New gateway deployment/revision is a provider/runtime change **requiring separate explicit Owner approval**.
- Maintain 15-minute gateway cache for shared Usage unless Owner approves separate on-demand snapshot TTL; no new continuous traffic.
- Billing actual dollars: optional **Owner manually adds CSV** exported from Cloud Billing Reports into the ZIP; absence must be marked `MANUAL_BILLING_CSV_REQUIRED`.

**Phase C: Post-shift D166 analysis separate from feature rollout**
- Correlate Usage hourly deltas with the separately collected Agent/Android/Web logs, especially 06:00–22:00 and reported 17:00–19:00 spikes. Investigate RTDB SSE HTTP403/timeouts, role-flap, Firestore fallback and latency. Do not claim root cause from aggregate Usage ZIP alone.

## 6. Impact, regression/security/quota review before code

- **Accepted base:** D165 Beta runtime is unaffected by this proposal. Implementation could affect Agent UI threading, token handling and existing Apps Script Gateway. Never block WMS page, PRIMARY heartbeat/failover, ongoing confirmation, ACK or Picker realtime.
- **Affected components if approved:** Agent `D160Usage.cs` UI and local ZIP serializer; optionally `Code.gs` existing Beta Agent Operations Gateway and existing scoped monitoring access; tests/spec/state. Cloudflare analytics bridge and new secret is a distinct **Owner-gated sub-scope** and may require resource scope reconciliation before mutation.
- **Main security threats:** Account-wide metrics from other projects, access tokens in ZIP, cross-project billing leakage, public repository, unauthorized normal Agent login, gateway access bypass; fail closed with allowlist and least-privilege server-side access.
- **Quota risks:** More Monitoring returned series, Apps Script URLFetch, Cloudflare GraphQL rate limits, throttling, timeout, partial output, cache stampede, Cloudflare requests if new Worker proxies used. Never imply one request is zero provider operations.
- **Accuracy risks:** sampled Cloudflare data, Monitoring lag, GA/RTDB metrics differing from billable bytes, partial latest hour, Google quota day differs from Vietnam day, projected cost ≠ billed cost.
- **Tests:** independent UI/background cancellation; on-demand-only operation; identity login/logout switch; token sanitizer; ZIP schema/content checks and checksum; replay same snapshot with no extra provider reads; no per-PDA/provider writes; retry/backoff; unreachable provider `N/A`; 24h/VN/provider-day DST windows; known D165 Agent confirm + HA + ACK regression. No changes to Android, Beta Worker, Stable or unrelated services.

## 7. Decision requested from Owner

**Recommended first approval:** Phase A only — local ZIP from existing D160 provider snapshot + explicit 24-hour and VN-today windows + per-section freshness/coverage manifest, while leaving other providers `N/A / manual`. This is a meaningful automation improvement with near-zero incremental Monitoring calls when cached. Then submit sample ZIP for validation before expanding API scope.

**Separate later approvals:** Beta RTDB Monitoring source enrichment, Cloudflare account token/server-side bridge, Google Drive/Sheets scopes, actual Cloud Billing import, deployment/update Agent version, and billing alert settings. Do not infer these from permission to open D166. Owner has authorized analysis/opening only; no implementation has begun.
