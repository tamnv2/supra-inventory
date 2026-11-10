# D173-E182 — Agent180 FIELD FAIL: responsive layout + nội dung cột (10/11/2026)

## Owner FIELD evidence + approval
- Owner-provided native Agent180 screenshot: visible gaps between three upper operation panels; inconsistent status/text and action controls; redundant empty Agent grid; roster action strip and search spacing poor.
- Follow-up Owner screenshot: roster columns show excess room in some fields while *Hoạt động gần nhất*, client/version and status are truncated.
- Owner replied **“Ok chốt”** to repair design including: a single measured/coordinated geometry authority, upper 40% / lower 60%, no scrolling outside lower roster's vertical scrollbar; retain all existing Agent177 functions. **Additional explicit approval:** every roster column must auto-fit real displayed text, without wasting space in empty columns.
- This approves **Agent-only CODE repair**. No explicit additional signed OTA/main Production deployment command is inferred from “Ok chốt”; new-release gate and FIELD/OWNER acceptance remain separate.

## Implementation (same D173-E182 FIELD repair, no new Dxxx)
- `relay-agent/D173E179OverviewNoScroll.cs`: measure signed-in Agent title/relay/resource/controls from actual text, flow toolbar onto another row only if necessary, place network status and Agent fleet below measured content. Condense mini-Agent grid to observed rows. Use existing native four-tab responsive mode on short upper viewports. Size Web/PickList split from their real labels when 50/50 does not fit.
- `relay-agent/D119AgentFeatures.cs`: route Web layout through one responsive authority after legacy initialization, re-apply Agent coordinates after authentication redraw; derive roster filter widths from displayed label text; measure each roster visible column's header and a bounded cross-section of actual rows; distribute remaining space toward text-heavy fields, keep actions compact. Recompute after the actual last-session snapshot (including changes without row-count changes). Retain complete tooltip detail for clipped text at impossible narrow viewports.
- `relay-agent/Program.cs`: fit PickList status and grid inside its native compact card; do not use a fixed minimum grid height that pushes the status outside the upper 40%.
- Add/update targeted source guards. Native .NET 4.8 Windows CI and real Windows screenshots at 1280×720 / 1600×900 / 1920×1080 and 100% /125% /150% DPI remain mandatory before FIELD PASS.

## Invariants / no new work
- The lower roster remains vertically scrollable only. At extremely narrow widths not every full string can fit simultaneously; use native tooltips and double-click detail, **never** silently drop original row data or enable horizontal scrolling.
- Preserve 40%/60% overview and original list filters, selection, sort, role-gated Kick/Contact/Resolve actions and auto-saved preferences.
- No business mutations, new network polling, Cloudflare/Firebase usage, Worker/DO, Web/APK, WMS/CDP/Host13, HA/confirm, D172 or legacy Stable changes.
- D172 is independent PENDING/HOLD; Stable OWNER-GATED.

## Acceptance matrix (must be evidenced, not asserted)
| Case | Required |
|---|---|
| 0, 3, 40, 140 sessions; rapid live activity/role/filter updates | No overlapping header/toolbars; relevant columns distribute width by actual text |
| Long name/version/activity/status; narrow/large window | No excess-width action columns; full text through tooltip/detail when impossible to fit |
| Login/log out, network category change, overtime banner | Text remeasured, all controls accessible |
| Windows WorkingArea 1280/1600/1920, DPI 100/125/150%, dark/light, minimized/tray restore | Correct layout, zero cut-off actionable controls, only roster vertical scroll |
| PickList confirm and Agent RBAC/HA regression | Existing semantics unchanged, no new provider requests |

## Checkpoint
- Work branch: `fix/d173-e182-agent180-field-layout-autowidth-20261110`.
- **SOURCE:** implementation candidate prepared in guarded PR. **CI:** pending real run. **RELEASE:** NOT authorized by this follow-up. **FIELD:** Owner Agent180 FAIL; repaired candidate unverified. **OWNER PASS:** pending.
