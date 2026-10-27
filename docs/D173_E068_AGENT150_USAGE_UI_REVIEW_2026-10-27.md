# D173-E068 — Agent150 VPS Usage · Review thiết kế sáng/tối (27/10/2026)

**OWNER APPROVED: forecast design principles from E067. UI mockups await explicit Owner visual PASS.**
**No application build, merge, OTA, Worker release or Agent150 Production release is authorized by this checkpoint.** Agent149 remains production; D172 independent PENDING/HOLD; Stable OWNER-GATED.

## Authority for screenshot data (not mockup illustrative numbers)
- Owner actual Agent149 VPS Usage screenshot captured 2026-10-27 03:46 UTC = 10:46 GMT+7: Firestore Reads today 5,625 / total displayed 18,175 / daily reference 50,000 = 11.25% (~11.3%); Writes today 2,967 / total 9,626 / daily 20,000 = 14.835% (~14.8%); Deletes today 1,023 / total 1,107 / daily 20,000 = 5.115% (~5.1%).
- Source screenshot additionally shows Firestore Connections 61; Listeners 113; Rules 58,216; Storage 74.81 MB; Sheets API 53; Drive API 218; Cloud Run Requests (shared project) 13,546; RTDB API Hits 548; RTDB HTTPS Requests 620; RTDB Connections 2. Those displayed totals are not assumed daily or invoice cycle totals.
- Prior measured analyses: DO SQL Rows Read roughly **731 million/24h 2026-10-23** and **645 million/24h 2026-10-26**; separate historical 24h samples, never describe as 27 Oct real-time series.
- Do not use static mockup figures USD0.42 / USD3.20 / 824 Emails / 950 Sheets or fabricate daily Drive/Sheets/API target.
- Cloudflare subscription USD5/month base for shared account; Inventory internal planning allocation **50% of verified included account-wide pools**. Nominal USD2.50 is NOT actual spend, invoice cap or attributable Worker billing. Missing per-cycle used totals => N/A.
- Target examples used in proposal, subject to live-provider plan/scope verification before release: Workers Requests 5M (of 10M), DO Requests 500K (of 1M), DO Rows Read 12.5B (of 25B), Workers CPU 15M ms (of 30M ms). Provider denominators, unit, aggregation and billing cycle must be verified individually.

## Explicit Owner logic acceptance on 2026-10-27
Owner accepts E067 proposal in principle: daily forecast = actual consumption so far + expected remaining usage by shift profiles, **separate 00:00–06:00 baseload** (03:00 close and 05:00 SKU updates) from operational 06:00–22:00; month forecast uses **verified billing cycle start/end**, per-day aggregate local snapshots, completeness/stale checks; distinguish account shared vs Inventory-attributed metrics; forecast each comparable limit and variable overage USD only when actual billable metric/pricing verified. Thresholds 70/85/95/100% of actual applicable target; unknown => N/A, never zero. This is approval of the business logic for design, **not approval of the images/UI nor release**.

## UI design-to-WinForms contract for Owner review
Source-controlled review assets are supplied in this conversation as:
- SUPRA_Agent150_Usage_Review.html (offline, interactive theme/range/filter/logic; SHA256 2fa42fd7efaa746083ce112f51ded26bd3f56eea621de65b3654e6943a92a14a)
- SUPRA_Agent150_Usage_light.png (SHA256 fb0eb49ea15f3f8bb516db011df590419c6a57e06b44387e20b36ea55a4f4796)
- SUPRA_Agent150_Usage_dark.png (SHA256 1b2d68a182db62e1d616b0506d156d8bc85aaec7fc3a638a87d493c3f3804d15)
- SUPRA_Agent150_Usage_Design_Contract.md (SHA256 5b0861234a18558475ff949f39fb2bf0dd8d7a49a43e9c9f92dd1c0e5c7d29cf)

**These conversation artifacts are not yet committed binaries to GitHub**. The full downloadable artifact provides detailed native-component mapping and precise layout coordinates. It is a Chromium HTML visual reference, **NOT a deployed WinForms screenshot**.

At 1600x1000 (100% DPI) both light/dark layouts were rendered and their component bounding boxes asserted exactly equal: sidebar (0,0,184,1000); header (204,20,1376,53); 5 KPI (204,147,1376,109); 4 Cloudflare quota targets (204,292,1376,88); 4 actual-data visual panels (204,416,1376,219); 3 forecast cards (204,671,1376,70); scrollable metrics table (204,790,1376,175). Test of 16 source rows, search, scope filters, date-range switch and forecast logic modal PASS.

The UI in native WinForms .NET Framework 4.8 must preserve those components, their order, their ground-truth labels and N/A state, positions/spacing/theme dimensions, numeric axis/ticks and responsive scrolling. If WinForms cannot match a component, document exception and obtain Owner re-review **before release**, not replace with a different simpler mockup. Native WinForms 1600x1000/100%-125%-150% DPI light/dark screenshots required in PR gate. Intermittent History blank tab requires reproducible Windows field/regression proof; CI smoke alone is insufficient.

## Gate
Current Agent150 PR #759 remains DRAFT; no merge/release. User visual approval required before implementing design. CI CODE/RELEASE/FIELD/OWNER statuses tracked independently.
