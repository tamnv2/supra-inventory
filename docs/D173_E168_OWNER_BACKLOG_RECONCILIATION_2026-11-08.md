# D173-E168 — Owner backlog reconciliation, 08/11/2026 (Asia/Ho_Chi_Minh)

## Purpose
Owner explicitly rejects the recurrence of previously cancelled or accepted tasks in the *current D173 backlog*. Prior issue intake and historical release records remain immutable evidence; their older PENDING wording is **superseded** by this later Owner decision. This checkpoint does not approve new application source, new shared resources, Stable release or D172 closure.

## Owner decisions — exclude from OPEN backlog
- **D173-E117, Agent decision convergence**: Owner attests PASS; do not request new rollout or investigation absent a newly reported regression.
- **D173-E119, extra .NET/GDI+ taskbar windows**: Owner CANCELLATION/REMOVE. Historical records and any previously shipped code remain historical; no follow-up task.
- **D173-E120, PDA Picker/Reporter separation proposal**: Owner CANCELLATION/REMOVE. The actual requirement is role classification in Agent, already implemented according to Owner. Do not propose two APK packages or revive the discarded architectural comparison.
- **D173-E126 Reporter vc125 badges/count/overdue**: Owner attests FIELD/BUSINESS PASS. Historical signed OTA receipt remains separate from Owner attestation.
- **Agent↔PDA ACK/HA/retry/double-confirm reliability group**: Owner attests PASS. Do not reopen general reliability analysis; any newer exact WMS fault requires a new concrete failure record.
- **D173-E161 Agent173 WebView2/tray/CDP/WMS/5-agent group**: Owner attests PASS for that historical group. **E165 is a NEW owner-reported hide/restore web reload regression**; its unshipped Agent174 fix must be tracked strictly under E165, not by re-opening E161.
- E115 Owner-cancelled historical work and the ten accepted groups remain excluded, no stale PR resurrected.

## Open D173 backlog at this decision
1. **Cloudflare DO Rows Read / DO Request anomalies** — ANALYSIS_PENDING: root cause and accounted workload attribution not verified. Account-wide observations are not the Inventory-only invoice.
2. **Firebase Firestore PermissionDenied/listener reconnect and RTDB HA timeout** — ANALYSIS_PENDING; no unsupported root-cause claim.
3. **D173-E121 Web Online/Offline** — PENDING_DEPLOYMENT per Owner direction, still no Production receipt.
4. **D173-E109 P1–P4 DO optimisation** — CODE_READY from historical source CI, not a Production release; separate original code-only authorisation does NOT authorise silent Worker/Web/Android deployment. Must be verified against current source before any new release approval.
5. **D173-E165/E167 approved new Production scope** — Agent174 tray host preservation; Agent Usage 00–24 and sync 06–24; GitHub daily 05:30 for 05:00→05:00 VN; Agent/Android/Web logs at 01/03/05/.../23 with Service/Drive staging. **PR #868 is open and latest exact-head CI currently FAIL; no merge, signed OTA or live Worker/Web receipt.** Full 05:30 Drive log-to-code evidence correlation remains UNVERIFIED; partial/missing must be labelled.
6. **Other specifically Owner-approved distinct unshipped changes, if any**, are tracked by their own change/release receipts; never infer an old generic backlog from historical CI/field `pending`.

## Reporting filter
Only list entries with active status after this Owner decision. Never infer "PENDING" from an older doc or from a historic release receipt when the Owner has since supplied PASS/CANCELLED. Separate CODE / CI / RELEASE / FIELD / OWNER attestation accurately. D172 independent PENDING/HOLD; stable OWNER-GATED.

## Production truth at checkpoint
PR #868 is still unmerged. Its examined commit `d8fd7598e4d4370bbf4e5c5e65be8a9024c72c90` had 39 successful, 6 failed and 2 skipped CI runs. This is evidence from this exact SHA only and MUST NOT be reused as the result of subsequent amended commits. New CI and release must be verified independently.
