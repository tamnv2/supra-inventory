# D173-E059 — VPS Usage dashboard owner review: numeric KPI + chart (2026-10-27)

## Authority and gate
Owner requests **mock visual design only**, not Agent code or release. Owner confirms **DO SQL Storage is periodic Billing-only**. All 36 metric statuses are sourced from E057/E058 read-only provider probes. No new credential was supplied or permission mutation authorized for Cloudflare Email Analytics. Do not code Agent, deploy Worker, or touch D172.

## UI requirements (Owner 2026-10-27)
- One **VPS Agent** scope only, without usage visibility or background collection on other Agent instances.
- Each supported metric displays an exact numeric value **when the provider returns it**, correct unit, window, provider coverage, and measured timestamp. Graph alone is not acceptable.
- Table/card fields: **rolling 24h**, **today (Asia/Ho_Chi_Minh)**, **provider billing-cycle-to-date** when authoritative, **included limit**, **used % / remaining** when denominators exist, **billable usage/cost** only from provider-authoritative billing, **last fetch** and **last source point**. If unsupported or delayed, display `N/A` or `STALE`, never fabricated zero.
- Graph time presets: 24h / 7d / 30d; comparison and chart should not confuse monthly accounting totals with 24h operations. Show explicit period and account vs resource scope.
- Initial factual metric classifications: **31 direct scoped/filtered provider datapoint PASS** (E057's 30 plus E058 Agent log Cloud Run), **3 Cloud Run PROJECT-WIDE-only verified alternatives** (not equivalent to picker-alert per-service data), **1 DO SQL Storage Billing periodic only**, **1 Cloudflare Emails Sent pending Zone Analytics Read**.
- **DO SQL Storage OWNER APPROVED PERIODIC**: use bounded existing provider Billing readback; DO NOT query InventoryCore per five minutes just to create a chart. Label account-level quantity, unit, time window and provider lag; chart granularity is N/A.
- Cloudflare Emails Sent currently **HOLD**. Query `viewer.zones.emailSendingAdaptiveGroups`, Zone ID of `supra.cc.cd`; request a **separate least-privilege Zone > Analytics > Read token** scoped only to the zone. Do not reuse an Email Send token, paste a secret into chat, commit or expose in Agent. No token provisioning may occur without Owner action; requester will configure via Cloudflare UI and GitHub beta Environment secret before separate read-only probe.
- Values in the illustrative UI are **FAKE SAMPLE VALUES**. UI concept is not field proof or implementation approval.
- Refresh minimum target: every five minutes **where provider supports it**. Display provider-specific point latency. Local-only VPS cache/history, no new Firestore/DO operations.
- Security and isolation: exact authorized VPS instance identity and Owner login, no secrets embedded in EXE, preserve HA/ACK/WMS and independent D172 PENDING/HOLD.

## Release boundary
**SPEC/MOCK REVIEW ONLY.** Agent CODE=false, CI=false, RELEASE=false, FIELD=false, OWNER_PASS=false. E057/E058 API verification remains a separate completed technical proof, and no merge/deployment is authorized by the design approval.
