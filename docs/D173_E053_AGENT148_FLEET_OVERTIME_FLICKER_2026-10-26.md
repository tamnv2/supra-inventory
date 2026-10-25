# D173-E053 — Agent v148: overtime layout authority and incremental roster (26/10/2026)

## Owner request
Owner confirmed v147 FIELD FAIL on VPS: overtime panel still covers the Agent fleet, and the roster flickers independently of the desktop sample selector. Owner explicitly approves repairing and releasing an Agent-only update.

## Root cause verified in live code and field logs
- `ApplyD173E038AgentToolbar` resets the Agent fleet to y=161 every timer/HA toolbar update while `ApplyAfterHoursAgentLayout` positions overtime panel y=163..251 and fleet y>=257. Conflicting owners reproduce overlap without any API failure.
- `ApplyD119AuthenticatedLayout` also assigns old fleet y=126, causing transient overlap on auth/resize.
- `UpdateAgentFleetGrid` and `RenderPickerOnlineSnapshot` called `Rows.Clear()` and recreated rows; `AutoResizeColumns` could be triggered on each resync. Live 26/10 logs show repeated `AGENT_SYNC apply` same version but do not expose paint-event counts.
- Desktop sample selector changes local resource sampling timers only, not roster repaint cadence.

## Implementation
- One layout authority: overtime-visible panel is always below two toolbar rows, and fleet is below overtime; toolbar never reverts fleet to y=161 while overtime visible. Bounds are set only when changed.
- Agent fleet rows updated in place when key/content stable; insert/remove only changed sessions, preserve scroll.
- Authenticated operational roster (Picker, Reporter, Agent) reconciled by stable key in place, preserving typed Row.Tag permission/action guards, multi-selection and scroll. Disabled/enabled action button cell styles restored when lock changes. Column sizing only when rows are structurally changed.
- Update signed Agent version monotonically 147 -> 148. No Android/Web/Worker/Firestore/D172 modifications.
- E052 structural regression guard made monotonic for Agent versions while keeping previous client telemetry unchanged; add E053 layout and no-clear checks.

## Risk / verification gates
- Run Windows Agent build/startup and Agent E053 static regression, D173 isolation and D172 cross-module guards, source continuity and version guard on exact PR source.
- Field matrix: overtime on/off, auth status refresh, PRIMARY/NEXT_A, 1/2/5/10s sample, roster changes, Picker multi-select and command RBAC, dark/light, 1000/1366/1600/1920 width, minimized/restored and 100–200% DPI.
- New code invokes no network service, no new timers/requests/Firestore reads-writes, DO SQL or log upload. Existing billing remains unchanged by E053 code; no measured provider billing claim.
- D172 always independent PENDING/HOLD. Stable OWNER-GATED. FIELD/OWNER PASS stays false until real Windows evidence.

## Release status
SOURCE CI PASS: 30/30 workflows on PR #751 head `bed8c2035ec68ec5771dff222ca968ab18e1fd02`, including Windows build and D172 isolation. Signed Agent148 tag / existing OTA channel / FIELD / OWNER remain separate and pending. Source-ready is not a release.
