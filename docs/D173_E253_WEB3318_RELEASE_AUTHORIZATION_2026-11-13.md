# D173-E253 — Owner 13/11/2026: sửa header và phát hành Tổng quan Web3.3.18

## Owner directive
- Owner reports intermittently top half of Website header disappearing; attached screenshot is field observation. Source hypothesis: header has CSS position relative in Web3.3.17 and can scroll out of viewport. Not yet physical DOM root-cause proof.
- Owner explicitly approves implement and release the reviewed Inventory Overview redesign in Tổng quan & báo cáo, plus header repair. Empty numbered item 3 carries no requirement.
- Scope: D173 Web only plus read-only consolidated InventoryCore DO API in registered Production Worker supra-inventory-beta. No new SQL schema/provider/resource, no Agent/Android/Firebase/D172/Stable mutation.

## Source/implementation plan
- Base after PR969: main 4ecb4cfebbddac1fc90f4aa29f2cd89e17f42a33; Web Production 3.3.17, runtime d8aa54cf / run43362731384 SUCCESS. FIELD/Owner not inferred.
- Web 3.3.18: operational-app.ts, d173-overview.css, api.ts, web-version.ts, package.json. Header sticky and non-clipping; operational KPI, SLA, 7-day daily trend and selected single-day hourly trend, area-as-of history, result-source split, recurring/top SKUs, five latest results.
- Distinguish ticket counts from batch counts; never subtract two trend series to claim backlog. Unconfigured SLA is unavailable, not zero; repeated SKU is a symptom, not physical root cause.
- One read-only /api/admin/overview route on APP_ENV=beta, authenticated WEB ADMIN/PICKPACK_ADMIN/ROOT; Core invokes existing dashboard, insights, D167 area summary read handlers inside one DO call; other API consumers unchanged. D167 optional failure returns null and UI labels missing data. No additional per-hour 7-day fanout.
- Source query warning: D167 as-of area queries include correlated subqueries, so fewer DO calls does NOT establish fewer SQL Rows Read. Baseline performance/Billing comparison necessary before claiming savings.
- D172 independent SQL/API/role regression required for shared Worker/Core; no Stable access.
- Owner approved protected code merge and Worker/Web3.3.18 Production release only after source CI, D172 and exact-source guard PASS. No Production write on this docs branch until protected merge. CODE/CI/RELEASE/FIELD/OWNER independent.

## PASS
- Role/auth negative including Android; from/to 7-day and 1-day semantics; pending live independent from date; honest SLA nulls; ticket-vs-batch; timezone/date; multi-Picker; recurrence; responsive 1280x720 / 1920x1080 light/dark; no header clipping; CSS confined Web.
- Exact-source source CI Web build + Worker typecheck + independent D172 tests, protected two-parent merge, Production actions and /health SHA verification. FIELD owner sign-off is separate.
