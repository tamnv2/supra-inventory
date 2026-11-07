# D173-E159 — Owner approves Agent172 consolidated implementation and protected release (07/11/2026)

## Latest Owner authorization
Owner explicitly says: **"Ok tiến hành chạy code và triển khai toàn bộ đề xuất, bao gồm cả vấn đề đề xuất xử lí nỗi web chạy nền"**. E159 supersedes E158's **code/release hold only for the exact approved E158 issues**. The Owner's E158 explicit rejection of the three unsolicited extra feature suggestions remains binding: **no new PickList tracking panel, uncertain-request operator screen, or additional feature scope**.

**Source:** signed Production Agent171 + Host13 x64; E157 technical release PASS, FIELD/OWNER pending. D172 OBPP independent PENDING/HOLD; historical Stable OWNER-GATED. E159 authorizes source/CI and safe protected signed Agent172 OTA after exact gates, not a blind main push or bypass of provider/field verification. Modifications to shared Firebase Rules/Worker if proven necessary require independent provider guards and D172 regression; this Agent-only candidate does not silently deploy them.

## Work items and evidence gates
| ID | In scope | Planned code behavior | Acceptance evidence |
|---|---|---|---|
| E159-01 (P0) | WebView2 background/restore/login | Keep one live Agent Host13/profile/CDP target while minimized, prevent scheduled D157 60m/2h F5, prevent OpenAgentBackground re-navigate on reconnect; preserve actual login-expiry action, input shield, WMS Confirm. | Native x64 build; 100x tray/restore, >2h hidden, unchanged Host PID/target, no scheduled Page.reload, WMS final click exactly once. Real WMS expiry separately prompts operator. |
| E159-02 | 5 Agents synchronized <=5m | PRIMARY presence reconcile and follower reporter roster each <=5m, reuse existing agent_sync Listener/outbox/CAS; actor/generation-safe merge; no extra N×N agent scans or overwriting authoritative decisions. | 5-Agent controlled test current activity/online/calls/role, offline-reconnect stale display and aged-session behavior, no data loss/duplicates. |
| E159-03 | Firebase quota within free/80% internal | Coalesce writes, skip no-change, maintain E150 global activity budget and shared HA heartbeat safety. Show per-source estimate; do not claim fixed quota without full project provider billable readback. | 24h billed Firestore reads <=40k/writes <=16k for equivalent load, including 40 PDA + other project usage and fanout; reconnect/peak-hour guard. |
| E159-04 | Corporate SSID | Exact `.Office@MSN` recognized, disable **only** operations needing unavailable public internet, including direct Agent OTA; do not disable WMS/Firestore/Agent↔PDA which work via Office/Google. | Office / Internet / UNKNOWN field checks; no corporate network bypass, no password or SSID logging. |
| E159-05 | VPS auto/manual PRIMARY | If VPS lost PRIMARY via automatic failover, return after verified ready+idle/CAS; if manual owner transfer, existing admin/tamnv2 confirmation remains required; defer if any WMS confirmation, manual input, SKU or passive browser probe in progress. | Manual/auto transition matrix, two agents and five agents, no double PRIMARY/ACK or spurious popup; inspect WebException on request, distinguish provider auth. |
| E159-06 | Picker last activity | Record server-created ingress and terminal outcome including bounded time-skew; current actor session generation and request ID, share via existing agent_sync bounded cache and durable outbox. Never show human activity from heartbeat. | Ingress/terminal/cross-follower display and clock skew, quota pacing, restart and role transfer. |
| E159-07 | Usage role | Existing UI+Worker permits only genuine `admin`, `tamnv2`, `vps`; keep exact RBAC, negative tests. | UI and backend 401/403 verification; no new Usage functionality. |
| E159-08 | Web Monitor role | Local Web status available to all authenticated Agent users; only authorized admin/tamnv2/vps may display or use ON/OFF. Local sanitized logs only; no new remote timer. | Four roles, multiple Agent sessions, protected input shield unchanged. |
| E159-09 | Firestore `PICKER_LOCK_LISTEN PermissionDenied` storm | Treat permanent reject with circuit breaker >=5m; verify Production Rule permission/query and current Firebase claims separately before changing live Rules. | Zero 2s repeat storms, denied metadata only, blocked lock source clearly marked unverified, negative-auth rules regression + D172 if Rules modified. |
| E159-10 | Reporter/Web/HA errors | Classify transient WebException, WebView2 Host 403/exit and HA lease slowdown; bounded retry/correct stale indicator; preserve one-WMS-confirm outcome. | Log causality by safe reason and request ID, actual backend readback before calling root cause fixed. |

## Source-supported P0 cause boundaries
- `MinimizeToTray/RestoreFromTray` do not directly call F5.
- `D157AgentFeatures.TickD157SessionHealth` **does** issue real `Page.reload` at PRIMARY >=60min / follower >=2h even while hidden; VPS and tamnv2 07/11 sanitized logs confirm.
- `SupraConfirmBrowser.OpenAgentBackground` previously called `NavigateConfirmNoLock` for an already alive host.
- `Host13 ProcessFailed` can close the browser; incident-specific Host crash and real WMS session expiry are NOT proven by available tray/server correlation. Keep distinct.
- Fix may preserve valid in-page WMS login state. Cannot guarantee indefinite authentication if the actual WMS server expires the session.

## Change/CI/release protection
- Branch: `feat/d173-e159-agent172-consolidated-fixes-20261107`. Only current Agent code, corresponding source tests/docs/state/gates. No D172 source edits. No new Fire/Cloudflare provider resources, no direct access to protected Stable.
- Source compile/CI + authenticated role checks + WMS/HA/PDA replay tests + D172 isolation must PASS before merging; the signed Agent172 channel requires exact source commit pin/receipt, **Host13 SHA256 unchanged**, Worker health and validated Firebase Rules reuse. Any live Rules change is a separately guarded provider deployment, not implied by this Agent-only release.
- **Status:** Owner **CODE + CONDITIONAL TECH RELEASE APPROVED**; implementation in progress. CI/RELEASE/FIELD/OWNER PASS not presumed. Prior E158 Draft PR860 documentation remains source evidence and is superseded for the hold only, not a merged Product change.
