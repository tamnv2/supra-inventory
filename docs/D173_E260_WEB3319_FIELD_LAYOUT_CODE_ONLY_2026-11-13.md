# D173-E260 — Web3.3.19 FIELD UI repair, CODE ONLY (13/11/2026)

## Owner FIELD evidence and authorization
- Owner reports Web3.3.19 Production operational release OK, but five UI defects remain: navbar header partially hidden, the **Quá hạn** tab not vertically aligned, Dashboard excessive instructional text, font-size A± obscures bottom content, and inconsistent content top/left inset.
- Owner requests correction of these five items, **not** Web Production release/merge authorization. Scope is D173 Web presentation and existing source-only tests. Current Production Web3.3.19 remains untouched; no Agent, Android, API, Worker, database, Firebase, provider or D172 business resource changes.
- Current base: main `c4e6dca074cf0a73369c659a4e90e83f929b119f` after merged documentation PR973; Web3.3.19 original release main `4350481de726cd33746fc634b41ff053a4d557bd`, independent readback Actions `43408214463`. Current Draft code-only PR: [#974](https://github.com/tamnv2/supra-inventory/pull/974).

## Root-cause evidence and minimum source modifications
- **Verified source conflict:** legacy `web-fast-ui.css` enforces a `100vh` overflow-hidden desktop shell; Web font control uses `body.style.zoom` with base 1.05 and 70–140% levels. E252 makes header sticky inside a measured grid first row. Fixed-viewport shell and global zoom are a clipping risk. Proposed scoped fix: expose effective zoom as a CSS variable, compensate desktop shell height, and keep navbar in the already reserved grid row, removing its redundant sticky positioning. Physical Chromium FIELD result not yet verified.
- **Quá hạn:** set the toolbar tab label and its count `b` to vertically centered inline-flex without changing count logic.
- **Tổng quan:** place data timestamp in the right side of existing report tabs; eliminate Owner-disapproved explanatory text, repeated page title and notes. Preserve five KPI values, no-SLA unknown state, pending-SKU evidence, by-hour/day charts, region and recurrence data. Existing read-only/DO/realtime paths and quota cadence unchanged.
- **Cỡ chữ:** compensate desktop `100dvh` grid height for `body.zoom`; retain independent content/table scroll and bottom padding. Not a guarantee of physical UI PASS until cross-zoom device checks.
- **Spacing:** desktop 781+ page inset `4px 6px` matches original Report/Dashboard for all pages; preserve 24px bottom scroll reserve and mobile-specific inset.

## Exact-source code-only CI (verified)
- Source HEAD `5fb02be48d21317187383e5c0ea424a3f30e98d1` checked by [Actions run 43415335127](https://github.com/tamnv2/supra-inventory/actions/runs/43415335127): **SUCCESS**. Included D173-E260 + accepted Web UI regressions, Web TypeScript/Vite build, service test dependencies and independent D172 isolation/regression.
- Repo Authority Guard `43415335037`: SUCCESS; Project State Guard `43415334786`: SUCCESS; independent D173/D172 Business Isolation Guard `43415335354`: SUCCESS at the same source SHA.
- Global UI Design Guard `43415335385`: FAILURE, **global CI not PASS**. Source inspection verifies at least one obsolete expectation `web_d107_richer_reporting` (old dashboard tokens absent from `main` before E260). Other legacy global failures must be separately reconciled; no unrelated UI guard modification included in E260.
- This checkpoint updates docs and authority on a successor SHA without changing validated Web UI/Worker/D172 source. No merge or Production deploy performed.

## Regression and release gates
- Targeted `tests/d173-e260-web-ui-layout.test.mjs` and current `tests/d173-e252-web3318-overview.test.mjs` updated for superseded instructional text, plus existing D173 UI regression, Web TypeScript/Vite build, D172 isolation tests in new code-only workflow.
- Reproduce and verify on actual authenticated Web at 1280×720, 1366×768, 1600×900 and 1920×1080; 70/100/120/140% Web font and browser zoom 100/125/150%; scroll to bottom each workspace, confirm header and Quá hạn tab, both themes, no new request/DO trigger. These physical FIELD checks are pending.
- No new Web version number or deploy marker before explicit Owner release instruction and exact-source CI. CODE/CI/RELEASE/FIELD/OWNER must be reported separately. D172 PENDING/HOLD; Stable OWNER-GATED.
