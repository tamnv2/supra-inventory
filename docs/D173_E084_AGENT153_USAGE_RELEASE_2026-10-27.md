# D173-E084 — Agent153 Owner-approved Usage/History/Sidebar & release scope (27/10/2026)

## Authority
Owner explicitly approved build + deploy Agent153 after E083 read-only provider test and Owner confirmation of all prior UI fixes. Canonical E083 evidence is in PR #771, GitHub provider runs 40537936915 and 40538623436, with account/shared-provider scope, not exact Inventory invoice.
No changes to D172 lifecycle (PENDING/HOLD), Stable (OWNER-GATED), Android, Web, PDA, independent printer. Only the existing registered Beta Worker usage-only handler (no new business DO writes), VPS Agent UI, supporting docs/test/release CI may change.
Agent152 signed channel is rollback; v153 must use monotonic version and an Owner-pinned source/CI release, not the historic Agent152 release marker.

## Requirements and changes
- One VPS-only Usage dashboard, still refresh viewport on local :00/:05...; browser/WMS/HA/confirm unaffected. Worker stores only bounded in-memory isolate usage cache; no Firestore/RTDB/DO SQL billing instrumentation, no additional independent background timer.
- High-impact 5-minute sources: Firestore Reads/Writes/Deletes + Cloudflare DO/Workers grouped; GCP consumed API requests grouped only by equal `metric.type` and labeled `resource.labels.service`; fallback to legacy source calls on grouping provider failure; account label not Inventory namespace.
- All 36 upstream entries keep separate source status and configured `sync_minutes` with provider source timestamp `latest_at` and `last_success_at`. NO_DATA cached to avoid repeated wasted provider calls; stale display is explicit, no data is not valid 0.
- Gauge today latest point vs DELTA today sum; enforce unit bytes, status and quota scope; do not normalize shared account usage to Inventory billing. Real Cloudflare account subscription cycle is from subscription list, DO storage billed quantity from billable-usage read; billable usage does not imply a finalized invoice.
- On every card/detail metric title display "Sync N phút/lần"; the number is configured API polling frequency, not a claim of provider data freshness.
- Confirm history title and 38px sticky column header; no data clearing on tab navigation; DPI check.
- Retire optional D128 floating PickList overlay window/tray/settings; DO NOT remove live manual PickList grid and WMS confirm.
- Fixed sidebar bottom: existing theme LIGHT/AUTO/DARK, Windows user-run startup toggle, approved local Windows Wi-Fi profile dialog, existing Log send/open functionality; Settings navigation hidden but its internal legacy host remains compiled for recovery.
- Version bump relay-agent/VERSION/AgentConfig/assembly 153; no unverified older Agent/Android claims.

## Gates and deployment
CODE requires native Windows .NET Framework 4.8 compile/startup smoke, Worker TypeScript typecheck, unit/integration test, D172 independent regression when shared Worker changed, no-secret public repo scan, Repo Authority/Project State guards, exact feature source SHA pin and controlled merge.
RELEASE requires appropriate Worker owner gate + Agent153 protected Owner marker, signed GitHub tag `relay-agent-v153`, checksum in `inventory-channel`, and verify no unintended Worker/Firestore/RTDB deployment. Worker usage collector server code must be deployed first if v153 relies on `sync_minutes` fields; Agent must gracefully show fallback if out of sync.
FIELD: actual installed VPS Windows Agent UI, history header, 100/125/150% DPI, old custom PickList board absent, auth/WMS/PRIMARY/Standby/Office/manual PL confirmed, provider date and billing comparison. Physical FIELD and Owner PASS cannot be inferred from CI/release.

## Status
OWNER IMPLEMENTATION + DEPLOY REQUEST RECEIVED; SOURCE/CI/RELEASE/FIELD/OWNER_PASS remain separate and must be evidenced, not assumed.
