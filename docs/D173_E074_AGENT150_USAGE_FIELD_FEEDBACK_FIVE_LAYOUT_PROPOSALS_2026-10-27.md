# D173-E074 — Agent150 FIELD FAIL Usage & 5 native-buildable mockup proposals (2026-10-27)

## Owner report
- Signed Agent150 exists, but current VPS Usage screen is not accepted in field: prioritize Cloudflare over Firestore; fix source-backed quota, forecast and alert accuracy. Current visible monthly/shift forecasts are mostly N/A.
- Move one app-wide 3-position theme switch to the bottom of the Agent sidebar: LEFT=LIGHT, CENTER=AUTO (Windows theme), RIGHT=DARK. Remove duplicated theme toggles from Usage and Settings. Applies across all tabs.
- Requested **five distinct screen layouts for Owner selection**. Do not treat any sample, logic redesign or new release as Owner approved merely because requested for preview.
- v150 CODE/CI/signed release = PASS per E073; this new report means Usage visual/forecast FIELD is not PASS and OWNER PASS is pending. D172 independent PENDING/HOLD.

## Verified source diagnosis
- `relay-agent/D173E069ApprovedUsageUi.cs` adds an `Sáng / Tối` button directly to the Usage header (lines ~93–106), and leads with five KPI cards where only the first is Cloudflare base and three are Firestore Reads/Writes/Deletes.
- It shows four hardcoded 50%-target quota cards (Workers Requests 5M, DO Compute Requests 500K, DO SQLite Rows Read 12.5B, Workers CPU 15M ms) but the **used-in-cycle** subtitles are N/A, and three forecasts follow missing-provider fallback. Top risk counter presently follows Firestore 0/3 in the physical image rather than Cloudflare 0/4.
- E069 explicitly says monthly billing start/end were unverified; daily shift forecast requires >=12 hourly-ish samples, >=40-minute span, <=90-minute gap, >=1 hour elapsed. Missing provider evidence must never silently become zero.
- Cloudflare public official docs warn that GraphQL Analytics datasets are NOT billable invoice metrics: https://developers.cloudflare.com/analytics/graphql-api/ . Billing Billable Usage dashboards match billing: https://developers.cloudflare.com/billing/manage/billable-usage/ . Billing Usage API v2 is Alpha/Restricted, not guaranteed available: https://developers.cloudflare.com/api/resources/billing/subresources/usage/methods/get_account_usage_v2/ .
- Two historical DO Rows Read snapshots (~731M/24h 23 Oct, ~645M/24h 26 Oct) are not current billing-cycle usage. Firestore image sample 27 Oct Reads 11,028 Writes 6,153 Deletes 1,058 should remain labeled as separate Google quotas. Do not invent Cloudflare used-to-date or costs.

## Preview designs (not selected)
1. **Cloudflare overview:** 5 USD shared base; four quota cards; dated DO 24h history + alerts; Firestore secondary strip.
2. **Quota 2x2:** four large Cloudflare quota panels with source/forecast status; right-side provider coverage + thresholds; Firestore below.
3. **Billing/forecast:** base fee vs variable overage vs period forecast, source-gating steps, historical-rate *hypothetical* scenario clearly not real forecast, four quota cards.
4. **Shift timeline:** 00–06 baseload, 06–14/14–22 operations timeline, insufficient-sample warning, dated DO history and alerts.
5. **Analyst table:** Cloudflare-first metric/target/used/forecast/status DataGridView with source audit panel and separate Firebase table.

UI shell maps to native .NET Framework 4.8 WinForms: TableLayoutPanel, Panel, Label, FlowLayoutPanel, DataGridView, GDI+ owner-drawn charts. Shared sidebar 3-position switch maps to owner-drawn Panel/RadioButton (or TrackBar positions 0/1/2) with one shared theme state LIGHT/AUTO/DARK, Windows change subscription and safe dispose. No extra provider polling or Worker/Firestore writes for cosmetics.

## Proposed alert/forecast repair, subject to Owner choice + gated implementation
- Separate `ANALYTICS_ACTUAL`, `BILLING_VERIFIED`, `ESTIMATE_PROVISIONAL`, and `MISSING/STALE/ERROR`; expose last sample, provider, account/project scope, quota units and validity.
- Cloudflare primary 70/85/95/100% of **internal 50% target** after verifying each provider included quota and consumed same-cycle numerator. Alert actual use separately from forecast risk; unknown means unknown, never OK.
- Daily by 00–06 baseload and 06–14 / 14–22 shifts; provisional historical fallback only if matching data exist and with explicit lower-confidence label. Billing-month estimates only after provider-valid cycle and source coverage; billable costs only with billing-rated data/rates and tax/FX context.
- Preserve existing VPS-only authenticated read-only collection cadence. Any new Cloudflare Billing read access requires token/permission review without placing secrets in repo. Do not assume alpha restricted API works. Shared Worker code needs D172 and Báo hàng regression and explicit release approval.

## Review artifacts / gates
Five 1600x900 browser-rendered offline HTML/CSS screenshots (Light), one Dark screenshot, and one offline switchable five-layout HTML prototype were prepared in this ChatGPT exchange; **they are NOT native WinForms screenshots and NOT committed as image binaries here**. Their numeric labels use only owner image plus repo source/historical examples; no Cloudflare current invented values. Owner should choose 1–5 (or combine sections), then authorize native implementation. Do not merge/deploy Usage redesign or represent FIELD/OWNER PASS before native Windows 100/125/150% DPI, every tab light/auto/dark, provider source, alert tests, Office/WMS/HA and rollback proof.

## D173-E075 — Owner-approved single layout + wheel scrolling (2026-10-27)

Owner explicitly **approves one harmonious combination of all five draft Usage layouts**, with no duplicate panels and sufficient actionable information. This is a selection of implementation design, NOT FIELD PASS for Agent150 or release authorization. Keep all unrelated tabs and all WMS/HA/Office behavior intact.

### User-visible structure

- Global Agent sidebar: permanently anchored navigation and 3-position `SÁNG | AUTO | TỐI` theme selector at bottom (AUTO follows Windows appearance), consistent for every tab/dialog. Remove redundant Usage and Settings theme buttons.
- Usage header: title, provider source timestamp and compact `24 giờ / 7 ngày / 30 ngày / Chu kỳ billing` range switch; no AI↔Owner instructions, caveat essays, review/proposal wording or redundant guidance shown in runtime.
- Cloudflare first: USD5 fixed shared subscription clearly distinguished from variable billable usage; summary actual vs provisional forecast; four main verified Cloudflare metric cards Workers Requests, DO Compute Requests, DO SQL Rows Read, Workers CPU, with additional verified paid quota meters in detail table, no fabricated values.
- Each Cloudflare metric has two **separate** alert evaluations: **day in Vietnam** vs day reference `verified 50%-allocated 30-day target / 30`; **verified billing-cycle interval** vs 50% included corresponding metric allowance. A day reference is NOT the provider's own daily billing quota. A selectable 30d history is NOT the actual billing interval unless the verified cycle dates coincide.
- Daily and cycle actual alerts: actual usage / applicable target ×100. Forecast alerts: forecast at day/cycle end / same target ×100, visually distinct from actual. Thresholds: <70% normal; >=70% watch; >=85% high; >=95% critical; >=100% over target (not automatically provider overage). Never color a missing/stale metric as normal/zero.
- Firebase/Firestore separate subordinate strip/table: daily Reads, Writes, Deletes, verified source daily allowances, daily actual/forecast alerts. No Firebase monthly forecast or Cloudflare 50% budget applied to Firebase.
- Time-series charts: daily and verified billing-cycle consumption with source coverage; dated historical DO Rows Read samples remain separately labeled as historical reference, never implied current.
- One consolidated detail table with provider/source, metric, period, observed, target, percentage, projected, warning level, source freshness; filter/search and export only when existing code supports it. No duplicated summary values in another main-grid/alert pane.
- **Any currency billable overage/variable forecast stays N/A until billed units, billing-cycle facts and tariff provenance are verified.** The illustrative rendered image amounts (e.g. $1.72, $3.11, 48.32M, 9.12M etc.) are NOT real provider evidence and must not be used in source or presentation.

### Nested mouse-wheel acceptance rules

1. Outer **entire content viewport** of Usage scrolls vertically with mouse wheel and the scrollbar only when content exceeds available space; the left Agent sidebar remains fixed and independently scrolls if its navigation overflows.
2. Every card/panel with overflowing text, lists, logs, alerts or multirow content gets its own bounded vertical scroll area and **wheel scrolls locally when the pointer is over that card**. Cards with no overflow do not steal scroll and have no pointless scrollbar.
3. `DataGridView` tables scroll independently on hover (vertical wheel; horizontal scrollbar/trackpad/Shift+wheel when content wider). Keep headers, selected row and values readable; avoid recreating table or losing scroll offset on refresh.
4. **Nested edge handoff:** scroll inner control until start/end, then let the parent Usage viewport scroll; moving pointer outside inner container scrolls the outer viewport. A chart does not accidentally zoom on wheel; dropdown wheels must not silently change an unexpanded filter selection.
5. On provider refresh, theme switch, range/filter change and repaint, keep scroll positions where content still exists; no flicker, overlapping cards, accidental scrollbar loops or truncated content.
6. Validate native Windows WinForms on 1366×768, 1600×900 and 1920×1080 at 100%, 125%, 150% DPI; test wheel over outer background, each card, each grid, bottom/edge transitions and horizontal overflow in Light/AUTO/Dark. Native CI + real VPS FIELD evidence are separate.

### Implementation and release gates

Scope: Agent-only WinForms UI/theming/scroll logic and read-only usage projection/alert code. No extra provider polling, Cloudflare/Firestore writes, Firebase Rules/Worker/WMS changes, D172 business source or OTA mutation without separate source-pinned release authorization. Exact provider metric/allowance/cycle correctness and source coverage must be tested before claiming cloud billing projections. Build/CI/FIELD/OWNER remain separate; signed v150 currently SOURCE/CI/RELEASE PASS but Usage FIELD FAIL per Owner. Owner approval here is **design and code-scope approval**, not permission to mark a new release PASS.
