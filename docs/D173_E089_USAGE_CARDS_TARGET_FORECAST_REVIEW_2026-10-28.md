# D173-E089 — VPS Usage cards: Owner-approved UI and per-metric target/forecast design (28/10/2026)

## Status and boundaries
- **OWNER-APPROVED DESIGN ONLY**: remove 24h/7d/30d buttons, default fixed rolling 24h chart, display configured sync in each card title, replace detailed table entirely with useful metric cards with a 24h chart, a day-target progress bar, inline alerts, visible day and cycle/month target where semantically valid. Arrange Cloudflare first, Firebase next, Google/Other; adaptive 4/3/2 cards per row. No runtime/source changes approved by this record.
- **TARGET / FORECAST ALGORITHMS BELOW = PROPOSAL FOR OWNER REVIEW, NOT OWNER-APPROVED CODE**. No repository source, production Worker/Agent, provider, Firebase, D172 or Stable changes. No assertion that all 36 have provider-known targets or that actual target/billed amounts are available.
- Same change D173 only. D172 independent PENDING/HOLD, historical Stable OWNER-GATED. Work only by branch -> Draft PR -> canonical decision/spec/state same change set. No merge/deploy without separate Owner approval and required gates.

## Definitions: this is essential to avoid false alerting
- UI time-series graph: rolling latest 24 hours; **day actual**: provider samples aligned to local calendar day Asia/Ho_Chi_Minh for Cloudflare/operational reporting; **Firestore quota day**: America/Los_Angeles midnight reset, including DST, never treated as a Vietnamese-day quota. Show BOTH when they differ.
- Cloudflare **monthly quota/reference** = 50% of source-verified *included paid plan allowance* of the specific meter over the verified Workers subscription interval `[cycle_start,cycle_end)`. 50% is **internal budget**, not a provider limit and not a USD 2.50 cap. **Day planning reference** = internal cycle target / exact number of civil days in that actual billing cycle; label *target quy hoạch ngày*, not provider daily quota. No fixed 30-day divisor. DO metrics often represent shared account; Worker requests/CPU may be Worker-filtered, so never assert the DO account numerator is Inventory-only consumption. If scope/unit or subscription mismatch, no target/progress alert.
- Month-to-date = complete nonoverlapping provider per-day/hour buckets from first verified cycle boundary to now (including 31-day cycles and any out-of-window archive day), never a rolling-30d sum mislabeled billing cycle. Unknown/missing days -> incomplete/unknown; do not substitute zeros. Billing charge from official billed cost+unit+same entity and subscription period only, separate from usage budgets.
- Firestore Standard (default) provider allowance: reads 50k, writes 20k, deletes 20k **per Pacific quota-day**, not per month. Monthly value (if card shows it) is **nontransferable planning reference** = per-day threshold × number of quota days in calendar month; not an actual monthly quota nor monthly 70% alarm. Source quota is not a guarantee that all metric values equal invoice quantities.
- Storage and connections are GAUGES: use latest valid source point (and optionally peak/trend) but never SUM snapshots. Storage quota is capacity (e.g. Firestore default free database 1 GiB) and DO SQL Storage uses provider GB-month *time-integrated* billing, not direct current bytes. No fake day consumption target.
- Counter metrics are DELTA/CUMULATIVE based on authoritative source type: bucket increments summed for one period after dedup, never adding overlapping snapshots or counters already accumulated by service.
- Forecast **day** = actual day-to-now + expected remaining 5/15/60m blocks using verified same-hour profiles and early/background (00–06), business shift (06–22), late (22–24) independently. Do not extrapolate 06–22 traffic to 24 hours. Fail closed to "Chưa đủ mẫu" if <12 sufficiently distributed samples, serious gaps/staleness or mismatched source scope/units. **Month/billing-cycle** = actual cycle-to-date + forecast remaining civil days from comparable verified daily historical profiles; do not conflate monthly calendar with subscription billing. No usable history/coverage -> no projection. Forecast is provisional, independently labeled vs actual.
- Alert independently for day/cycle actual and forecast at 70/85/95/100% of valid, same-scope target. Bar caps at 100% visual width, printed % continues >100; no OK status on missing/stale/invalid data. No progress bar when no applicable verified target. Every title shows source configured refresh cadence, plus last fetched_at, last provider point, freshness and source/scope unit, not a claim that provider sampled every cycle.
- UI may display "Target tháng: Không áp dụng" or "Chưa xác minh" when no true target; Owner request is to show the label, not fabricate values. Card text must clearly distinguish *quota*, *quy hoạch*, *tham chiếu*, *dung lượng*.

## Per-metric proposed display/calculation matrix
Columns: metric ID | target day | target month / cycle | expected/projection | card decision/notes.
- `cf_do_requests` | 0.5 × verified 1M per cycle ÷ actual cycle days | 500k/cycle planning | delta/day + cycle forecast | MAIN, account-shared, sync 5m.
- `cf_do_duration` | 0.5 × 400k GB-s ÷ actual cycle days | 200k GB-s/cycle | delta/day + cycle | MAIN, verify provider unit GB-s, sync 10m proposed.
- `cf_do_rows_read` | 0.5 × 25B ÷ actual cycle days | 12.5B rows/cycle | delta/day + cycle | MAIN, account-shared, sync 5m.
- `cf_do_rows_written` | 0.5 × 50M ÷ actual cycle days | 25M rows/cycle | delta/day + cycle | MAIN, account-shared, sync 5m.
- `cf_worker_requests` | 0.5 × 10M ÷ actual cycle days | 5M req/cycle planning | delta/day + cycle | MAIN, Worker-filtered vs account limit, sync 5m.
- `cf_worker_cpu` | 0.5 × 30M ms ÷ actual cycle days | 15M ms/cycle planning | delta/day + cycle | MAIN, source microseconds conversion verified, sync 10m.
- `cf_d1_rows_read` | none unless D1 actually linked and scope confirmed | none until then | optional trend only | HIDE, no D1 runtime binding found.
- `cf_d1_storage` | none | none until D1 binding/identity proven | storage gauge | HIDE, no D1 runtime binding found.
- `cf_emails_sent` | only if provider zone-specific authorized limit verified | only if plan or zone monthly included budget verified | count/day and optional month, no % if not | DETAILS, sender transnational use, sync 60m.
- `cf_do_sql_storage` | not applicable | 0.5 × included 5 GB-month/cycle **only** when billable unit and cycle matched | billing period measured quantity; capacity separately | DETAILS after `UNVERIFIED_UNIT` resolved, sync 1440m.
- `firestore_reads` | 50,000/provider Pacific day | monthly planning = 50k × count Pacific quota-days, never bankable | Pacific day count/forecast; VN 24h graph | MAIN, sync 15m.
- `firestore_writes` | 20,000/provider Pacific day | planning 20k × quota-days | Pacific day counter/forecast | MAIN, sync 15m.
- `firestore_deletes` | 20,000/provider Pacific day | planning 20k × quota-days | Pacific day counter/forecast | MAIN, sync 15m.
- `firestore_connections` | none | none | current and peak connection gauge, no summed forecast | DETAILS, sync 60m.
- `firestore_listeners` | none | none | current and peak gauge | DETAILS, sync 60m.
- `firestore_rules` | only provider metric-specific verified limit | same condition | raw count only if otherwise | DETAILS, sync 60m.
- `firestore_storage` | no daily limit | 1 GiB free DB **capacity**, not month consumable | latest size / delta trend, optional future size | DETAILS, sync 6h.
- `fcm_requests` | only provider project-specific verified quota | only validated quota or planning from real daily baseline | count/day, trend forecast if sampled | DETAILS, sync 60m.
- `auth_identity_requests` | only verified Google API rate/daily quota and scope | no universal quota | count/day and trend only without target | MAIN/DETAILS, sync 30m.
- `auth_secure_requests` | only verified per-project metric quota | no universal quota | count/day and trend | DETAILS, sync 30m.
- `sheets_requests` | only API quota for actual method/project/window (often per-minute, not day) | no transferable monthly quota | count/day trends only | DETAILS, sync 60m.
- `drive_requests` | only actual API quota with same scope/window | no transferable monthly quota | count/day trends only | DETAILS, sync 60m.
- `cloud_run_requests` | none absent actual shared GCP billable quota | none absent billing-scope reconciliation | count day / trend only | DETAILS, project shared, sync 60m.
- `cloud_run_instances` | no per-day request target | verified max capacity only if service identified | latest instances gauge, no sum | HIDE, project shared, sync 60m.
- `cloud_run_billable_time` | no universal free monthly target | only actual GCP billing SKU+allowance source | seconds/day, monthly total if same entity | DETAILS, project shared, sync 60m.
- `cloud_run_agent_log_requests` | not verified | not verified | only if scoped 24h data, else absent | HIDE pending sample, sync on-demand/60m.
- `rtdb_api_hits` | none absent provider documented same-scope limit | none | count-day/24h | MAIN, sync 30m.
- `rtdb_https_requests` | none absent documented limit | none | count-day/24h | MAIN, sync 30m.
- `rtdb_connections` | none | verified concurrent max only if provider exposed (not quota-day) | latest/max gauge | DETAILS, sync 60m.
- `rtdb_monthly_sent` | **no until billing downloads-equivalence verified**; thereafter internal reference free 10GiB ÷ actual Firebase billing period days | **conditional 10GiB/month free-download allowance** for relevant Blaze DB if billed-download unit/metric match | month data volume + projected remainder if comparable | MAIN, show status unverified until linked, sync 6h.
- `rtdb_monthly_sent_limit` | invalid | INVALID until raw unit+sentinel verified | none | HIDE: displayed 8,589,934,592 GB indicates malformed unit/sentinel.
- `rtdb_sent_bytes` | none unless exact billed download mapping verified | none by default | byte delta/day and month | DETAILS, sync 60m.
- `rtdb_payload_bytes` | none | none | payload delta/day and trend | DETAILS, sync 60m.
- `rtdb_protocol_bytes` | none | none | protocol-inclusive delta/day | DETAILS, sync 60m.
- `rtdb_storage_bytes` | no daily budget | provider's verified 1GiB free *capacity* if same DB | gauge + storage trend | DETAILS, sync 24h.
- `rtdb_rules` | none absent verified published quota | none | count-day only | DETAILS, sync 60m.

## Acceptance review and no-code boundary
- NEED Owner review: which monthly fields are **true included quota**, **planning reference**, **capacity**, or **not applicable**; whether monthly Firestore reference should be visibly labeled instead of blank; whether RTDB Monthly Sent matches billed downloaded bytes; actual Cloudflare subscription cycle and per-meter plan units.
- Propose provider read-only verification first. Tests: Pacific DST and VN midnight, 28/29/30/31-day period, sampling delayed, empty series, 64-bit limit sentinel, no double-count on snapshot/cache, counter-vs-gauge, shared account versus Worker, risk actual vs forecast >100, billing units/GB-month, isolated D172 regression if future Worker code changes.
- No Provider writes, extra clients, timers, WMS, APK/Web changes or Production update from this design. Agent153 remains released but FIELD FAIL for separately reported UI issues; D172 HOLD.
