# D161 — Owner-approved consolidated update backlog

Status: **OWNER-APPROVED REQUIREMENTS / IMPLEMENTATION DEFERRED**

Date: 2026-10-02  
Accepted runtime base: **D160 Owner PASS**  
Current Android field baseline: **beta-vc92**  
Stable: **OWNER-GATED / untouched**

## Governance

This document is canonical durable project memory for the D161 collection phase.

- The Owner has approved the requirements below.
- Approval here does **not** authorize implementation, build, release, deploy, provider mutation, or Stable change.
- Continue collecting additional Owner-approved defects/refinements under **the same D161**.
- Before implementation, present one consolidated scope to the Owner. The Owner may choose all or selected items.
- Implementation begins only after a separate explicit Owner command to proceed.
- Until then, D160 remains the accepted runtime base.
- Chat memory is non-canonical and must not be required to reconstruct these requirements.

## 1. Picker shortage-reporting capability contract repair

Root issue: the service/SQLite capability may be represented as numeric 0/1 while Android vc92 reads a boolean contract. The repair must make server authority explicit and keep client parsing defensive.

Approved target:
- Normalize `shortage_reporting_enabled` at external Service/Worker boundaries to JSON boolean `true/false`, including login/profile responses and any shared public-user projection.
- Android parser accepts boolean true/false, numeric 1/0, strings "true"/"false" and "1"/"0"; missing/null/unknown remains fail-closed.
- Explicit login and profile reconciliation persist the authoritative capability.
- Stateful reporting capability recovery must converge to the newest authoritative state; do not let an older OFF dominate a newer ON through unordered scope aggregation.
- Direct realtime capability updates remain a fast path, but authoritative profile reconciliation is the convergence path after missed/recovery conditions without polling.
- D156 one-time reporting-default-off migration history must not be erasable by normal runtime-settings reset. Structural migration metadata must be preserved separately from mutable runtime settings.
- Regression coverage must include login, logout/login, reconnect, missed realtime, ON→OFF, OFF→ON, malformed/mixed contract representations, HR sync invariants and runtime reset behavior.

## 2. Web version authority

Approved target:
- The current accepted Web presentation is named **Version 1**.
- Header copy: **Website nghiệp vụ Inventory | Version 1**.
- Every release that changes Web source increments the visible Web version monotonically.
- Backend/Agent/Android-only releases do not increment Web version when Web source is unchanged.
- One canonical Web-version value feeds visible UI and diagnostics.
- Web runtime logs include `web_version`.

## 3. Web date preset convergence

Approved target:
- Date presets must update both authoritative query state and visible `Từ/Đến` inputs on all applicable Web surfaces.
- Example on 2026-10-02: 7 ngày = 2026-09-26 through 2026-10-02 inclusive.
- Generic UI context restoration must not overwrite controlled date-range state after the user selects a preset.
- Subsequent **Xem/Áp dụng** must submit the same range currently shown to the user.
- Apply the shared repair across dashboard/report/result date-range surfaces; do not force unrelated retention-window controls into the same model.

## 4. Realtime HR Google Sheet synchronization without Apps Script

Approved architecture:
- Event-driven near-realtime source path: verified Google Sheet → Google Drive file change watch → Beta Worker HTTPS endpoint → Google Sheets API read → validated diff → InventoryCore.
- No Apps Script, no Firestore polling, no requirement for the Web UI to remain open.
- A changed visible URL that still refers to the same verified spreadsheet/tab identity must not unnecessarily break the source.
- Watch/channel renewal is automatic and bounded.
- Before actual provider mutation, implementation must reconcile any required Drive API/watch permission/resource representation with `ops/project-scope.json` and `ops/resource-registry.json`; D161 authority capture itself creates no provider resource.

Approved diff policy:
- Exactly **1 new Picker** in one observed authoritative snapshot: validate then auto-apply.
- **More than 1 new Picker** in one observed snapshot: do not auto-apply; create a pending HR batch and surface a realtime Web confirmation with the proposed employees.
- One existing Picker name/contractor change: auto-apply and audit.
- 2–10 existing Picker information changes: auto-apply and audit.
- More than 10 existing Picker information changes **or** more than 10% of the source population changed: require Web confirmation.
- Picker missing from the Sheet: do not automatically disable or delete the existing account.
- Duplicate employee code, invalid/missing required headers/tab, unreadable source, lost access, unexpectedly empty source after previously non-empty state, or source row loss greater than 20%: hard-block the cycle and retain current authoritative users.
- A hard-block condition is not presented as a destructive "confirm anyway" operation.
- New Picker default reporting permission remains OFF unless a later Owner decision changes it.
- Existing Picker reporting permission is not reset by HR sync.

Operational/usage policy:
- Change notifications are signals only; Worker rereads authoritative Sheet data and computes the diff.
- Coalesce duplicate provider notifications with a short bounded debounce; do not add periodic high-frequency polling.
- If multiple human edits occur before one source snapshot is read, policy is based on the observed snapshot diff, not an attempt to guess keyboard paste vs manual typing.

## 5. Android Reporter SKIP_ALLOWED → HAS_STOCK correction UX/authority

Field evidence on vc92 showed normal Reporter connectivity and successful ordinary HAS_STOCK/SKIP_ALLOWED mutations while correction remained hidden behind row-tap behavior. The approved repair removes that hidden/silent client gate.

Approved target:
- Server remains the sole authority for whether correction is allowed.
- Reporter recent projection supplies enough authoritative timing state for clients, including correction deadline/allowed state and server time or equivalent remaining-time basis.
- Android tab **Cho phép skip** shows an explicit action while correction is available:
  **Sửa thành Đã có hàng · MM:SS**
- Countdown is local presentation derived from server-authoritative timing. It performs **no network request per tick**.
- Use one shared local ticker for the visible Reporter screen, not one timer/request per row.
- Stop the presentation ticker when the tab/activity is not visible; recompute from authoritative basis on resume/re-render.
- At expiration the correction button disappears; do not leave a stale enabled/disabled action occupying the row.
- Final POST correction revalidates the deadline on the server. A boundary race returns a clear expired message, not silent no-op.
- Web correction visibility must converge on the same server authority rather than independently deciding business eligibility from browser clock.
- Android diagnostic logs record correction available/tapped/confirmed/success/blocked/error plus bounded non-sensitive timing fields sufficient to diagnose server-vs-device timing.
- No polling, no new Firestore/Firebase cadence, and no provider operation is introduced by the countdown.

## 6. Web authenticated footer cleanup

Approved target:
- In the authenticated business shell footer, show only:
  **Phát triển hệ thống · tamnv2 | Pick Pack 1291**
- Remove authenticated-footer links **Giới thiệu / Quyền riêng tư / Điều khoản**.
- Keep public routes `/about`, `/privacy`, `/terms` available for Google/OAuth/legal verification.
- Public login/password-recovery legal links may remain; this requirement removes only the redundant authenticated business-shell footer links.

## 7. Implementation gate

No D161 source/build/deploy work is authorized yet.

When the Owner requests a consolidated update:
1. Bootstrap GitHub authority.
2. Read this D161 backlog plus canonical decisions/specs/state.
3. Present the complete approved backlog and dependencies/risks.
4. Let the Owner select all or a subset.
5. Only after explicit implementation approval, continue under D161 using branch → PR → authority/continuity PASS → merge.
6. Stable remains OWNER-GATED.

## 8. Unified support-log lifecycle and operator-triggered system collection

Owner-approved target after 2026-10-02 runtime/log review:

### Android logout UX and duplicate protection
- After the user confirms logout, Android immediately replaces the interactive surface with a blocking progress state such as **Đang đăng xuất…** so the existing network cleanup is visible instead of appearing frozen.
- Logout is single-flight. While one logout pipeline is active, later logout triggers are ignored until the first pipeline reaches a terminal local state.
- Network cleanup remains off the UI thread. A failed network step must not discard a pending support-log bundle.
- The session-end log is classified as a session/logout log, not as a scheduled log.

### Daily Drive log folders
- Existing scoped parent remains `Inventory/Beta/Logs`.
- Runtime archives are stored under a server-resolved child folder named `YYYY-MM-DD`.
- The child date is the **actual Drive archive date in Asia/Ho_Chi_Minh**, not the client device clock and not necessarily the original event date.
- A delayed bundle keeps its original generated timestamp in metadata/file naming but is archived into the day it actually reaches Drive.
- Daily-folder resolution is centralized in the trusted archive layer and cached by date; individual clients must not independently list/create folders.
- Duplicate-file lookup must run inside the resolved daily folder.

### Strict Drive-confirmed local pruning
- Android and Agent may delete/prune local support evidence **only after positive Drive synchronization confirmation**.
- Worker/core acceptance, local buffering, Firestore staging or any other intermediate acceptance is not sufficient to delete the only local copy.
- Agent's normal Google Apps Script gateway path retains the existing Drive-confirmed prune behavior. Any Firestore fallback path must keep the local bundle until Drive confirmation is known.
- Android keeps pending session/error/crash/manual/global-request bundles until the server reports `DRIVE_SYNCED`; status reconciliation is bounded/batched and must not poll Drive continuously.
- Web is excluded from local-file pruning because its durable support copy is server-side.

### Normal capture/upload policy
- Web: keep bounded in-memory telemetry, immediate fingerprinted/debounced error delivery, the existing scheduled support checkpoints, and a bounded pending-error queue so a later error does not silently overwrite the only unsent earlier error.
- Android: keep a bounded local support journal (target order of magnitude 1–2 MiB, implementation may choose the smallest safe bound), immediate error/crash delivery when possible, logout final snapshot, one end-of-day safety checkpoint when unsynced useful evidence exists, recovery on later authenticated start/resume, and no return to four full periodic Android INFO uploads.
- Agent: keep the local complete diagnostic stream, pending sealed bundles, error/crash delivery, bounded dirty/size checkpoints and 21:45 safety boundary. Overtime boundary events remain eligible support boundaries.
- Normal error paths use fingerprint/debounce/incident suppression so repeated network faults are represented without one Drive file per repeated line.
- Agent boundary sealing must be idempotent by boundary/event key. Log-upload housekeeping lines must not recursively create a new small checkpoint for the same boundary.
- Existing support-log redaction remains mandatory.

### Agent-only global collection command
- Only the exact authenticated Agent login names **admin** and **tamnv2** may see **Yêu cầu toàn bộ log hệ thống Báo hàng & xác nhận đơn** in **Cài đặt**.
- The UI first shows a clear Yes/No warning. No cancels with zero provider mutation; Yes creates one bounded global support-log request.
- Backend/server authority must revalidate the exact allowed login; hiding the button is not an authorization boundary.
- The request has a unique `request_id`, issued time, short expiry/TTL and per-client dedupe.
- Only currently authenticated Web, Android and Agent sessions respond. A running but logged-out client is ignored. A client that authenticates after the request expires does not replay the request.
- Each responder sends **unsynced local evidence plus one current support snapshot**; already Drive-synced history is not re-uploaded.
- Android/Agent responders use bounded jitter (target 0–30 seconds for large fleets) so one operator action does not create a synchronized upload burst.
- The Office-network initiating Agent must be able to originate the control through the existing Google/Firebase control plane; implementation must not require direct Office-to-Cloudflare reachability.
- Reuse existing realtime/listener channels where safe and do not introduce client polling. If an additional exact Firebase server trigger/resource is unavoidable for Web/Android fanout, reconcile it with project scope/resource registry before provider mutation.
- The request itself must not create per-device Firestore acknowledgement writes. Drive arrival and local client diagnostics are the evidence path.

## 9. Agent History/Usage UI responsiveness and canonical sorting

Current-source cause is confirmed:
- History builds a newest-first model, then inserts every row at index 0; this reverses the visible order, shifts existing rows repeatedly and causes repeated DataGridView work.
- Fleet-history merge may clear the whole grid and rebuild it row-by-row.
- Usage clears the hourly grid, adds rows one by one while columns are auto-filled, and updates many labels directly on the UI thread, producing visible progressive repaint.

Owner-approved target:
- Loading **Lịch sử Picker xác nhận PickList** and **Thông tin Usage** must be an atomic/batched presentation: no visible row-by-row or label-by-label "wave".
- File/network/JSON preparation runs off the UI thread. The UI thread receives one prepared presentation snapshot and commits it in one bounded render transaction.
- History must not use repeated `Rows.Insert(0)` or an O(n²) scan/shift path for a full rebuild. Use a virtualized/bound data model or equivalent batched grid strategy suitable for a full operating-day history.
- Incremental history updates should invalidate/update only the affected row when practical; fleet reconciliation must not clear/repaint the entire grid for one unchanged or single-row update.
- Usage network fetch remains asynchronous. Hidden Usage UI should not repaint metric-by-metric; store the completed snapshot then apply it atomically when visible.
- Do not add provider requests, Firestore reads/writes, listeners or polling to solve UI rendering performance.
- When the History tab is entered, canonical sort is always **Thời gian mới nhất → cũ nhất**.
- A user may temporarily sort another column while staying on the History tab. After leaving the tab and later returning, manual sort state is discarded and canonical newest→oldest is restored.
- The canonical sort key is the full `SentAtMs` value, not the formatted `HH:mm:ss` string.
- Tab switching, scrolling and Agent relay processing must remain responsive while History/Usage data is prepared.

## 10. D161 shared relay sleep/overtime UX

This Owner command supersedes D154 **only where the following end-of-day/overtime behavior conflicts**. D154's 05:45 normal start, 05:00 overtime cutoff, shared Agent/Firestore schedule authority, Worker/FCM propagation, early-start model and no-polling architecture remain inherited unless a later D161 decision changes them.

### Normal-end transition
- Canonical normal replay end becomes **22:15 Asia/Ho_Chi_Minh**. At 22:15, when no active shared overtime override exists, relay state is immediately **SLEEP**; do not ask for a pre-end "continue/stop" decision.
- This replaces the prior D154 22:30 normal end and 30-minute pre-boundary confirmation model.
- Because schedule state is shared authority, implementation must update the authoritative schedule contract consistently across Agent, Function/Worker enforcement and Android/Web consumers; Agent UI must never claim SLEEP while the shared backend still treats the normal window as active.

### Sleeping/no-extension presentation
- If an authenticated Agent remains open at/after 22:15 with no active overtime override, show a prominent **red background / white text** status panel:
  **Relay đang ngủ · không có gia hạn hiện hành. Xác nhận tăng ca thêm 1 giờ để hoạt động tiếp.**
- The action is explicit **Gia hạn +1 giờ**.
- On the first transition into this state for a boundary, an Agent minimized to tray may restore/foreground once so the operator notices it; do not refocus the window every one-second UI tick.
- If no operator acts, relay remains asleep with zero periodic provider mutation.

### Extension semantics
- From SLEEP/no override, **Gia hạn +1 giờ** sets `override_until = min(now + 1 hour, 05:00 cutoff)`.
- While an override is active, **Gia hạn +1 giờ** adds one hour to the current authoritative `override_until`, capped at 05:00.
- Keep an explicit **Kết thúc tăng ca** / cancel action to terminate the current override immediately using the shared schedule authority.
- Active-overtime UI shows the exact shared end time and makes clear that Android/Web use the same state.

### Fifteen-minute expiry warning
- Exactly 15 minutes before the current authoritative `override_until`, show one prominent warning for that boundary:
  **Agent sẽ quay lại trạng thái ngủ đông lúc HH:mm. Gia hạn tăng ca thêm 1 giờ?**
- Actions are **Gia hạn +1 giờ** and **Không gia hạn**.
- **Gia hạn +1 giờ** extends from the current authoritative end time.
- **Không gia hạn** records/dedupes the no-extension decision for that boundary so the fleet does not repeatedly prompt, but relay continues until the already-authoritative end.
- If no action is taken, there is no implicit extension. At `override_until` the existing override expires automatically, relay returns to SLEEP, and the UI falls back to the red no-extension panel with **Gia hạn +1 giờ** available again.
- Warning logic is relative to the current authoritative end time, so it remains correct for an end such as 01:30: warning at 01:15, sleep at 01:30 unless extended.
- A changed shared end time invalidates the previous local warning key and schedules the next T-15 warning from the new end.

### HA, quota and reliability constraints
- Use the existing shared schedule CAS/coordination authority; simultaneous actions from multiple Agents must converge to one authoritative result.
- The one-second Agent timer is presentation/local-deadline logic only and must not add Firestore reads/writes/listeners.
- Provider writes occur only on explicit extension/cancel/no-extension actions or existing schedule-authority transitions required to publish the shared state.
- At the 05:00 cutoff, overtime may not extend further. Existing 05:00–05:45 early-start behavior remains separately governed.
- Overtime support-log boundaries follow the D161 idempotent log rule so one operator action cannot create multiple near-identical checkpoint files.

## 11. D161 implementation-impact boundary for the newly approved items

No source/build/release/deploy/provider mutation is authorized by this authority update.

If/when the Owner later authorizes implementation, the newly approved scope may affect:
- Android Beta logout/support-journal lifecycle;
- Web support-log buffering and global-request response;
- Worker/InventoryCore runtime-log archive/status APIs;
- existing Google Drive Logs archive path and Agent Google Apps Script gateway;
- Agent History/Usage WinForms presentation;
- Agent shared schedule UI/state machine plus the existing schedule propagation/enforcement path;
- canonical tests/specs/authority.

Expected normal-runtime impact after a correct implementation:
- UI rendering work decreases substantially; relay/confirmation transport cadence does not increase.
- Normal logging provider traffic should decrease or remain bounded; the global support-log request is intentionally exceptional and operator-triggered.
- Schedule UI adds no polling. Explicit overtime actions retain low-frequency shared-state writes only.
- Stable remains OWNER-GATED and untouched.

### Business shift display versus Replay technical window
- **Ca bình thường / ca nghiệp vụ hiển thị cho người dùng luôn là 06:00–22:00 Asia/Ho_Chi_Minh.**
- The D161 Replay technical guard remains **05:45–22:15**: 15 minutes early before the business shift and 15 minutes late after the business shift. These margins are operational/technical protection and must not redefine the human-facing business shift.
- Web `Ca vận hành`, summaries, reports, labels and other outward business copy must not present 05:45–22:15 as “ca bình thường”.
- If a technical/diagnostic surface needs to expose the Replay guard, it must use an explicit label such as **Cửa sổ kỹ thuật Replay: 05:45–22:15**, visually separate from **Ca bình thường: 06:00–22:00**.
- Overtime logic remains anchored to the Replay technical end at 22:15 exactly as already approved in D161. Business-facing shift statistics/grouping continue to use the established 06:00–22:00 shift definition unless an independent Owner decision changes reporting semantics.
