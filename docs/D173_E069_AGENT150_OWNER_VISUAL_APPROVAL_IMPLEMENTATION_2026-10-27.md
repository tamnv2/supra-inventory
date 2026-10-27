# D173-E069 — Owner đã duyệt giao diện sáng/tối · Agent150 code & release gate (27/10/2026)

## Owner approval
Owner explicitly approves the dual-theme D173-E068 screenshot/HTML contract and orders **code plus deployment** (27 Oct 2026 12:12 VN). This supersedes E068 visual-review HOLD for implementation and authorizes **Agent-only signed v150 release after exact-source CI, native UI regression evidence and D172 isolation**. No Web, Android, Firebase, new Worker or Stable scope. Production Agent v149 stays active until release receipt verifies v150 tag+OTA+checksum.

## Native implementation
- Agent v150 usage view rebuilt as native WinForms in `relay-agent/D173E069ApprovedUsageUi.cs`: one identical light/dark control tree with 5 KPI / 4 Cloudflare target cards / 4 analysis cards / 3 forecasts / detail grid with horizontal scroll, search, scope/status filters and 24h/7d/30d + billing unavailable label.
- Source-derived Firestore day totals, quota percentages, historical DO Rows Read bars explicitly marked **23/10 ~731M** and **26/10 ~645M** (not current), extra API metrics with N/A fallback, forecast status, channel-only VPS login. No mockup USD consumption, no assumed Google $10 budget, no fake 824/950 counts.
- Dark/light palette recolored after global theme traversal. Native graphs use actual daily target axis and date labels, not old individually normalized relative curve. No new provider data polling outside existing VPS-only endpoint.
- E064 repair remains: History tab surface self-heal, keyed incremental row reconciliation without same-day full Rows.Clear(), malformed JSONL line skip, sanitized errors.
- Shift forecast `D173ApprovedShiftForecast`: real UTC->GMT+7 buckets, separate 00:00–06:00 baseload from 06:00–22:00 operational shift; require at least 12 points, >=40min span, <=90min gap, >=1h elapsed; N/A if incomplete. Future estimate is provisional pace-based and may be volatile. Provider does not yet return **verified billing cycle start/end**, so end-of-billing and attributed USD forecasts stay **N/A**, not invented. Local VPS 24h/30d snapshot cache and daily archive remain.
- Cloudflare 5 USD base is a shared fixed subscription; 50% of individually verified included quota is internal planning, not the price 2.50 USD actually consumed. Account-wide usage is not Inventory-only numerator; Firestore quotas are separate.

## Validation gate
1. Windows net48 Agent source build and startup smoke; E069 structural guard + E064 history regression, E060 VPS-only read-only guard, secret guard, D172 independent regression and main authority.
2. Native WinForms 1600×1000 Light/Dark screenshot and visual geometry comparison to approved HTML/png. **CI green alone is not native visual FIELD PASS.** If native visual deviates materially, require source correction before signing release; do not label OWNER PASS without Owner field acceptance.
3. Agent-only release must be through protected branch → PR → pinned source receipt → Owner-approved v150 Agent-only release marker, protected main merge → signed tag + existing OTA channel SHA256 match. Worker release is excluded; Agent149 rollback must remain available.
4. D172 business remains independent PENDING/HOLD. Shared Worker code cannot be deployed under this v150 scope.

Status at creation: CODE STAGED PR759, CI/visual/pin/release receipts must be independently verified before claiming completion.
## E070 — CI recovery, native screenshot and exact source pin (27/10/2026)

- Existing PR #759 Agent150 native code failed Windows compile with `CS0103` (`_d173ApprovedKpi` missing); repaired reference to the existing `_d173VpsKpiLabels`. The build failure was real; old CI green was not reused.
- Original Windows runner screenshot of maximized Agent content was only 822×648 because its virtual display is limited; native 1600×1000 shell cannot be inferred from a CI runner. New smoke captures the **actual WinForms Usage controls** as a 1376×900 offscreen content viewport and restores original Dock/Bounds/selected tab. This is NOT an installed Agent field screenshot and DOES NOT verify 125–150% physical Windows DPI.
- Native Light/Dark source screenshot visual review found and repaired white nested-layout backgrounds in Dark. Current content capture has 5 KPI, 4 Cloudflare target cards, 4 analysis panels, 3 forecast cards, 9-column scrolling table. The offline, logged-out screenshot correctly displays N/A instead of fabricated metrics; actual VPS session values require FIELD.
- Tested protected source SHA `3a5255c267981c22cbd7b597852430b4b12666f2`: **44 checks = 33 success, 11 skipped, 0 failed**; Windows Agent net48 compile/startup, independent D172 guard, Worker read-only and VPS RBAC checks green. `Verify Beta Relay Agent` run https://github.com/tamnv2/supra-inventory/actions/runs/40458881933 native Light/Dark screenshot gate SUCCESS; artifact `d173-e069-agent150-native-light-dark` id `12714020272` (1376×900, both variants).
- `ops/d173-e069-agent-release-authorization.json` pins that exact tested source; following docs-only receipt changes are not new protected Agent/Worker/workflow source. **CODE/CI PASS. RELEASE pending until protected merge and signed OTA tag/channel digest; FIELD/OWNER PENDING.** Stable OWNER-GATED; D172 independent PENDING/HOLD. User-approved Agent-only scope remains unchanged.
