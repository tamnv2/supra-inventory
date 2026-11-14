# D173-E270 — Web3.3.22 FIELD FAIL / Smart Lazy CSS review (14/11/2026)

## Owner FIELD — new evidence
- Owner provides nine authenticated screenshots of Web3.3.22 (Operations, Dashboard, Shift, SKU, Users, SLA, Logs, Tools, Reset), reports page geometry still inconsistent, and requests Smart Lazy simplification rather than accumulating CSS patches.
- This is a **new FIELD FAIL against Web3.3.22 UI consistency**, not a revocation of its verified technical release. No Owner PASS. Preserve the same D173 change; D172 independent HOLD.
- The screenshots show different page composition, nested panel/table scrolling, heading and toolbar positioning. Screenshots establish visual inconsistency as reported, but without live computed DOM/style they do **not** prove each individual CSS selector is the cause. Differences driven by page content alone are not defects.

## Fresh GitHub baseline
- Main at read: `d08526b9fb549e3b8413659437d2ff2ee08a7b5a`; PR979 and docs-only PR980 **MERGED** (not open); Web3.3.22 source release main `974f213ea99c5e33dd114146e83f12a035982744`; deploy run `43542070127` SUCCESS. FIELD/OWNER remains FAIL/PENDING.
- `web/src/operational-app.ts` imports Tabler core CSS plus **17 local CSS files**. Local imports have approximately **7,303 physical lines** and **1,392 occurrences of `!important`** (mechanical count, includes compact single-line CSS; not a count of proven bugs or removable rules).
- `web/src/legacy-transplant/web-unified-ui.css` retains `padding:20px 24px 48px!important` and heading/panel margins; `web/src/d173-tabler.css` has later route-scoped 6px gap, 4px/6px inset and `!important` overrides. `web/src/d173-overview.css` adds separate display rules. Thus there are multiple specificity authorities and a real risk of accumulated patches.
- E267 prior Chromium RED reproduced computed 12px inset where 6px expected; GREEN test and Web3.3.22 scoped CI passed for representative fixtures. This was **not** nine live authenticated routes at varied roles/zoom.

## Smart Lazy recommendation — proposal only, no code or release authorization inferred
- One existing central geometry authority (current `d173-tabler.css`), **no new CSS file**, no new blanket `!important` layer. Define/retain shared spacing/radius/card/tab tokens for same-purpose components. Preserve justified route-specific geometry and scroll, and do not force nine pages into identical content layouts.
- Baseline first: for each of nine pages measure computed inset, sibling gap, card padding/radius, tab/control height, overflowing containers at 1280/1366/1792/1920 and 100/125/150% zoom; light/dark, Web font sizes; distinguish design deviations from actual content differences. Record screenshots and selectors causing violations.
- Repair at the **earliest owning selector** when safe; remove only proven superseded/duplicate declarations from CSS actually imported; reduce specificity by ownership rather than adding overrides. Consolidate in small batches tied to RED/GREEN test. Never delete entire legacy CSS file just because it looks old: it may contain untested behavior.
- Re-measure before/after for every modified route and CSS layer count/important count, keep same layout behavior, roles, data, API, realtime, zoom, scroll, warning colors. Preserve D172 and Worker/API/SQLite/Firebase/Agent/Android/Gateway/Stable. No extra provider requests expected for CSS-only work, not an observed billing claim.
- Browser DOM fixtures must use the actual import order and representative live templates; authenticated FIELD on all nine pages still required. Regression protects business logic, responsiveness, double scroll, hidden buttons and no horizontal clipping. A green CI does not imply FIELD/Owner PASS.
- Impact assessment: accepted D171 limited Owner base unchanged; current D173 Web UI still affected. Risk medium for selector cascade, role-specific zoom/HD layout, high if removing historical CSS wholesale. Safer approach is evidence-driven incremental deletion, **not** full UI rewrite.

## Status / next gate
`FIELD_FAIL_3322`; analysis and impact review complete. **CODE NOT STARTED**, CI for new change NOT RUN, **NO NEW RELEASE**. Implementation only after exact scope/impact review and Owner authorization under repo change-control; current Owner message expresses the objective, not a separate versioned release approval. Create a new code-only branch from updated main on approval and test 9 real routes before gated release.
