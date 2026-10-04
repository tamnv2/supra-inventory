# D161 — Owner-approved consolidated update backlog

Status: **TECHNICAL / RUNTIME / RELEASE PASS — READY FOR OWNER FIELD TEST**

Date: 2026-10-02  
Accepted runtime base: **D160 Owner PASS**  
Current Android field baseline: **beta-vc92**  
Stable: **OWNER-GATED / untouched**

## Governance

**Execution checkpoint 2026-10-04:** Owner issued the exact command `bắt đầu D161 tiến hành`. D161 implementation is authorized subject to the existing mandatory gates: Phase 0A must PASS before Safety/runtime mutation; Phase 0 Safety must PASS before feature-bearing backlog implementation. Stable remains OWNER-GATED and untouched.

This document is canonical durable project memory for D161.

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

The exact Owner start command was received on **2026-10-04**. D161 has completed **Phase 0A Permission & Provider Preflight PASS** and **Phase 0 Safety Baseline PASS**. Feature-bearing backlog implementation is now authorized under the same D161, while D160 behavior remains the rescue/accepted base until Owner field acceptance.

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
- Add a visible History column **User Agent xử lý**. It shows the authenticated Agent username that actually owns the terminal processing/ACK for that PickList request, for example `tamnv2`, `admin`, `dienhx`.
- Identity source priority is the terminal Agent session `LoginName`; fall back to `AppUserId` only when LoginName is unavailable. Do not display Firebase UID, machine name or Picker identity as this column.
- A pending local row may temporarily show the current processing Agent, but the terminal result must overwrite/converge to the Agent user that actually produced the final durable ACK.
- Carry this field inside the **existing durable ACK write** and the **existing compact `picker_history_json` piggyback** used by `agent_sync`. Adding the field must not create an extra Firestore document operation, read, write, listener, poll or history-only sync mutation.
- Fleet merge/local JSON/history persistence must retain the field so all active Agents converge on the same **User Agent xử lý** without a separate lookup.
- History sorting remains canonical by full `SentAtMs`; adding the column must not change the no-wave/batched rendering requirements above.

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

## 12. Agent bulk Picker session revocation and manual-only Agent update

Owner-approved target after source review.

### Bulk **Kích toàn bộ user**
Current source already supports per-row **Kích User** and a protected Agent-password verifier, but there is no bulk operation.

Approved behavior:
- Add one destructive action **Kích toàn bộ user** to the **Picker đang hoạt động trên PDA** card.
- Placement: card-level action in the upper-right header/tool area, visually separate from per-row actions and from the search field. It must look like a deliberate danger/admin action, not a normal row control.
- The action is visible only to the exact authenticated Agent login names **admin** and **tamnv2**. Backend/Worker authority must revalidate the exact authenticated login; UI hiding is not security.
- Scope is **all currently authenticated Picker/PDA Android sessions**, not Agent sessions, Web sessions, Reporter sessions or filtered search results.
- The active search/filter never narrows the bulk target. The warning states the authoritative target count before confirmation.
- Flow: click → destructive warning with current target count and consequence “toàn bộ Picker phải đăng nhập lại” → Continue/Cancel → require the current Agent password → execute only after local password verification succeeds.
- The entered Agent password is never logged, persisted, sent to Firestore/Worker or included in diagnostics.
- Do not implement this as an Agent-side loop that invokes the existing one-Picker kick pipeline N times.
- Use one idempotent server-authoritative bulk command/request id. InventoryCore/Worker invalidates the targeted Android session generations in a bounded server transaction/batch, closes affected realtime sessions/notification targets as applicable and returns a bounded summary.
- A best-effort Firebase/FCM signal may accelerate PDA logout, but **server session-generation invalidation is the authority**. A PDA that misses the signal must still fail its next authenticated request and be returned to login.
- Reuse existing Firebase/notification/session resources. Do not introduce high-frequency polling, a new business carrier or N per-Picker Agent provider writes merely to implement the bulk button.
- Individual per-row **Kích User** remains available and behavior-compatible.

### Agent update becomes manual-only
Current source checks Agent updates during startup and again every 30 minutes, while also exposing a manual **Kiểm tra cập nhật** button.

Approved target:
- Remove automatic Agent version checks from startup.
- Remove the 30-minute automatic update timer/cadence.
- Agent startup restores its saved Agent session/browser/runtime normally even when the update channel is unavailable.
- **Kiểm tra cập nhật** is the only normal Agent update entry point.
- Clicking it checks the trusted Agent manifest only after the user action.
- If current: show a concise “Đang dùng bản mới nhất”.
- If newer: show current → target version and a clear Yes/No confirmation. **Yes** downloads, verifies existing trusted-channel/checksum rules, starts the existing safe replace/restart installer; **No** makes no mutation.
- A manual update-check failure is diagnostic only and must not stop relay/PickList processing or expire an otherwise valid Agent session.
- Removing the timer must reduce or eliminate idle Agent update-channel traffic; no replacement poll/listener is introduced.

## 13. Android update discovery, login availability and best-effort install UX

Current-source defects confirmed:
- Android vc92 treats update-check failure as a login-blocking gate.
- The normal login screen constructs an update button in code but does not mount a visible update control in the login layout.
- Update failures are currently collapsed into a generic message, losing the failing stage.

### Update check must not be a normal login dependency
Approved target:
- Opening the login screen may perform **one bounded background version check**, but login availability must not depend on successful access to the release/update channel.
- Update-channel DNS/HTTP/manifest/temporary availability failure shows a non-blocking warning and leaves **ĐĂNG NHẬP** usable.
- A failure to verify the integrity/signature of the **currently installed APK itself** remains fail-closed.
- D161 introduces no mandatory minimum-version policy. A future force-update/minimum-supported-version rule requires explicit separate Owner authority.
- Update diagnostics preserve a sanitized failure stage instead of one generic catch, including at least: installed-signer, manifest-network/http, manifest-parse/channel validation, download, checksum, downloaded-APK package/version/signer validation, installer permission and installer launch.
- Pre-login update failures that cannot upload because there is no authenticated session are retained in a small bounded local diagnostic record and may be included in the next authenticated support snapshot; no secret/credential content.

### Professional login-screen update control
- Add a permanently visible, compact **Phiên bản & cập nhật** row below the login credential card and above the existing footer/credit.
- Left side: current build label, e.g. **Beta vc92**.
- Right side: outlined secondary action **Kiểm tra cập nhật**.
- The control must remain reachable without logging in and must not compete visually with the primary **ĐĂNG NHẬP** button.
- While checking, only the update action changes to a bounded loading/disabled state such as **Đang kiểm tra…**; the credential fields and Login button remain usable.
- This manual button is the recovery path when automatic login-screen discovery does not show an update prompt or when the previous check failed.
- Manual check and automatic login-screen check share one single-flight checker and the same trusted manifest rules; concurrent duplicate checks/downloads are forbidden.

### Login-screen automatic discovery
- If the bounded automatic check finds a newer trusted Beta release, show a clear update warning with **Cập nhật** / **Để sau**.
- **Để sau** keeps the login form available and creates no download.
- **Cập nhật** starts download/verification/install.
- If the automatic check finds current version, no intrusive dialog is shown.
- A failed automatic check does not repeatedly prompt or retry in a tight loop; the visible manual **Kiểm tra cập nhật** remains available.

### Manual check while logged in
- Keep the visible in-app version label clickable.
- Tap version → confirmation **Tìm kiếm bản cập nhật?** Yes/No.
- **No** cancels with no network request.
- **Yes** performs one version check.
- If current: show **Đang dùng bản mới nhất**.
- If a newer trusted release exists: download, verify and proceed to install automatically after that explicit Yes; no second “download?” confirmation is required.
- The same download/install single-flight guard applies whether update was initiated from login or from the authenticated app.

### Best-effort installation
- After the user has explicitly accepted an update, automate all safe steps available to the application: download, SHA-256 verification, package/version/signer validation, retain the pending APK, request the package-install permission when missing, and immediately resume/open the system installer after permission becomes available.
- On normal Android 11 sideloaded PDA operation, the target is **minimum user interaction**, not falsely claiming Play-style silent installation.
- Full unattended/silent install is **not a D161 requirement**. It may be reconsidered only through a later Owner-approved Device Owner/MDM/OEM-management workstream with explicit resource/security review.
- Do not add Google Play, an MDM provider, OEM-specific privileged API, device-owner enrollment or a new provider resource as part of this D161 item.

## 14. Additional implementation-impact boundary

These newly approved items remain **authority/backlog only** until the Owner gives a separate consolidated D161 implementation command.

Potential later implementation surfaces:
- Agent WinForms Picker card, Agent authentication guard, Agent updater/startup lifecycle;
- Worker/InventoryCore Android-session authority and bounded bulk revoke API;
- existing Firebase FCM/session-control signaling as best-effort acceleration;
- Android login layout/update state machine/update diagnostics/installer handoff;
- existing trusted GitHub inventory release channel and Beta Worker download endpoints;
- canonical tests/specs/state/resource metadata.

Expected effects:
- No additional idle polling/listener cadence.
- Agent update-channel background traffic decreases because startup/30-minute checks are removed.
- Android release-channel failure no longer creates an artificial business-login outage.
- Bulk kick is exceptional/manual and must use one bounded authoritative command rather than an N-request Agent loop.
- Stable remains OWNER-GATED and untouched.

## 15. Mandatory D161 Phase 0A Permission & Provider Preflight, Phase 0 Safety Baseline and Owner-triggered rescue

Status: **OWNER-APPROVED SAFETY/EXECUTION CONTRACT**. D161 implementation is still deferred until the Owner uses the explicit start command below.

### Phase 0A Permission & Provider Preflight

Status: **OWNER-APPROVED HARD GATE**. Phase 0A runs only after the exact D161 start command and before Safety release publication or any D161 business/runtime source mutation.

Purpose:
- prove every external permission, credential capability, release path and provider mutation class required by D161 before large implementation begins;
- fail closed at the beginning instead of discovering a missing grant, scope, signing secret or provider IAM permission after D161 runtime code has already changed;
- use existing canonical resources and the least privilege necessary; Stable remains untouched.

Mandatory rules:
- No D161 business/runtime source mutation may begin until Phase 0A is terminal PASS.
- Prefer read-only/no-op proofs. When a real write is the only reliable capability proof, use one bounded disposable Beta-only canary inside already scoped resources, verify it, and clean it up in the same Phase 0A run.
- Never print, commit, upload or persist secret values, refresh tokens, passwords, signing material, service-account private keys, Firebase tokens or WMS/session material.
- A failed capability is repaired and the **entire relevant Phase 0A matrix is rerun** before continuing.
- If a real Owner-only grant/consent is unavoidable, batch all known missing permissions into the shortest official Web-UI action, then automatically rerun Phase 0A. Do not begin backlog code while waiting for that grant.

Minimum preflight matrix:
- **GitHub:** repo branch/PR/merge and release-channel write authority required by the existing Agent/Android release workflows.
- **Cloudflare Beta:** existing deploy token active and sufficient for the current Worker/Web/Durable Object deployment path; no Stable probe or mutation.
- **Android Beta:** fixed signing material is present in the protected GitHub environment, the trusted signer fingerprint can be derived, and release-channel/version monotonicity can be resolved before publishing the later Safety APK.
- **Agent:** build plus trusted GitHub prerelease/runtime-channel publication path is available before the later Safety EXE is published.
- **Firebase/GCP:** existing Beta Auth, Firestore Rules, Functions/Eventarc/FCM and current session-control resources expose the permissions required by the selected D161 implementation; do not create a replacement provider merely to bypass a missing grant.
- **Apps Script / Agent operations gateway:** current clasp/Script API lifecycle and the existing Drive/Monitoring consent remain usable where D161 reuses that gateway.
- **Google OAuth/runtime access:** current Beta refresh-token path and scoped runtime service-account access required by D161 are valid; request no broader OAuth scope unless the minimum required path is proven impossible.
- **Logs daily-folder hard gate:** under existing scoped parent `Inventory/Beta/Logs`, prove the trusted archive layer can create/resolve one disposable child folder, upload/read back one sanitized tiny test object inside it, remove/trash the disposable probe, and verify cleanup. Client devices must not perform folder creation/listing.
- **HR Sheet read hard gate:** the currently configured/verified Beta HR source remains readable through the existing Google Sheets authority before watch setup.
- **HR Drive-watch hard gate:** prove the chosen least-privilege identity can resolve the verified HR file through Drive, create a bounded `files.watch` channel to the Beta Worker callback, receive the initial Google `sync` notification, replace/renew the channel without duplicate business processing, stop the superseded channel, and verify cleanup. The probe must not change HR business rows.
- **Global-log control:** prove the chosen existing Google/Firebase control plane can carry one bounded authenticated control request without introducing per-device acknowledgement writes or new polling.
- **Release/update dependencies:** current Android and Agent trusted manifests/assets/checksums are readable so Safety release numbering and later manual/advisory update flows cannot begin from an unknown channel state.

Phase 0A PASS is permission/capability proof only. It does not itself authorize D161 feature behavior, HR data application, global log collection from the fleet, bulk Picker revoke, schedule changes or Stable activity.

### Exact start command
The exact Owner command **`bắt đầu D161 tiến hành`** authorizes implementation of the complete then-current Owner-approved D161 backlog.

On that command the execution order is mandatory:
1. Fresh-bootstrap canonical GitHub authority.
2. Run and PASS **D161 Phase 0A Permission & Provider Preflight**. If any permission/capability fails, repair it under D161 and do not modify D161 business/runtime source.
3. After Phase 0A PASS, run and PASS **D161 Phase 0 Safety Baseline** before introducing D161 backlog behavior.
4. After Phase 0 PASS, continue automatically into the approved D161 backlog under the same D161 change; do not ask the Owner to reconfirm each backlog item already approved.
5. Branch → PR → authority/continuity/runtime gates → merge/release/deploy as applicable.
6. Present the technically/runtime/release-passed D161 candidate for Owner field testing.
7. D160 remains the accepted project base until explicit Owner acceptance of D161.

### Phase 0 goal
Phase 0 creates a recoverable, monotonic, field-installable snapshot of the last safe operating model **before D161 backlog behavior is introduced**.

The safety baseline is based on the accepted D160 runtime behavior and must preserve the current operational model. D161 authority-only documentation already present on `main` does not alter the runtime baseline.

### Phase 0 mandatory capture
Before D161 backlog runtime code begins, automation must capture and verify at least:
- exact Git source commit/ref and component tree identities for Service/Worker, Web, Android, Agent, Firebase rules/functions and other D161-affected source;
- current InventoryCore SQLite schema version and Operational V2 schema version;
- current Beta health/source markers and existing release-channel manifests;
- current accepted Agent and Android release identities, artifact hashes and sizes when available;
- Web production build identity/hash or equivalent reproducible source/build evidence;
- existing scoped provider/configuration **names/references only**, never secret values;
- current relevant Firestore/rules/functions/resource aliases and schedule/log transport identifiers from canonical scope/registry;
- a machine-readable D161 safety-baseline manifest committed to GitHub or attached to a GitHub release/artifact, containing no secret/session/WMS credential material.

### Monotonic safety releases before backlog implementation
Phase 0 must prepare and verify forward-installable safety releases:
- **Android:** publish the next monotonic Beta `versionCode` from the pre-D161 Android safety source/behavior. Example: vc92 baseline → safety vc93 if no intervening Android release exists.
- **Agent:** publish the next monotonic `relay-agent-vN` from the pre-D161 Agent safety source/behavior. Example: v97 baseline → safety v98 if no intervening Agent release exists.
- The exact numbers are resolved from the release channel at execution time; never hard-code the examples.
- Safety releases may contain only version/release-safety plumbing required for reliable recovery. They must not silently introduce D161 business behavior.
- The Owner field environment may remain on the safety release while D161 candidate releases advance monotonically above it.

### Web / Worker baseline
Web and Worker are deployed together through the current Cloudflare bundle, so Phase 0 must treat them separately for rescue semantics:
- preserve a reproducible **Safety Web** source/build snapshot;
- preserve the **Safety Service contract/behavior** source snapshot and schema markers;
- do not depend on a raw old Cloudflare deployment rollback as the primary rescue path;
- rescue Web may combine Safety Web behavior with the newest schema-compatible Service runtime.

### Schema and state safety rule
Until Owner D161 acceptance:
- D161 schema/data migrations must be additive and backward-compatible with the Safety Baseline wherever technically possible;
- do not drop/rename required Safety fields/tables, destructively rewrite history, or remove Safety API contracts before Owner acceptance;
- new fields/tables may remain present during rescue;
- rescue never blindly downgrades SQLite schema or deletes D161-created data merely to make version numbers match;
- if an implementation proposal cannot preserve a recoverable path for a destructive migration, fail closed and stop before that migration for a new Owner decision.

### Field acceptance
After D161 code/runtime/release gates PASS, the Owner tests the candidate.

When D161 is in the explicit field-test-ready state, the Owner phrase **`ghi nhận ok`** (or an explicit **D161 PASS**) is treated as D161 Owner field acceptance. Canonical decision/state continuity must then record D161 as the accepted base before any later change ID starts.

Technical/runtime/release PASS alone remains insufficient.

### Exact rescue command
If the Owner reports a severe D161 failure and gives the command **`quay lại bản backup ban đầu trước khi sửa code`**, stop further D161 feature rollout and execute the D161 rescue path under the **same D161 change ID**.

Rescue target: restore the safe pre-D161 operating behavior as quickly as possible without unsafe database downgrade.

Mandatory rescue behavior:
- preserve sanitized diagnostics/evidence needed to repair D161 later;
- **Web:** restore Safety Web behavior through a new deployment, using the current schema-compatible backend rather than blindly restoring an old all-in-one Cloudflare deployment;
- **Worker/InventoryCore:** forward-repair code/contracts toward Safety behavior while retaining compatible current schema/data; never blindly downgrade schema;
- **Agent:** publish a new monotonic Agent version greater than every failed D161 Agent build, using the Safety Agent behavior plus only compatibility/recovery shims required by current shared state;
- **Android:** publish a new monotonic Android `versionCode` greater than every failed D161 APK, using Safety Android behavior plus only compatibility/recovery shims required by current server state;
- update the existing trusted runtime channels to those rescue releases after checksum/signature verification;
- Firebase rules/functions/shared schedule/log support that D161 changed must be forward-deployed to Safety-compatible behavior without deleting current data;
- if a broken Android/Agent build cannot self-update, use the existing trusted manual installer/download path; Agent local `.bak` may be used as an emergency local aid but does not replace the canonical monotonic rescue release;
- Stable remains untouched/OWNER-GATED.

### Rescue completion gate
The rescue is complete only after:
- Web health/business shell/auth critical checks PASS;
- Worker health/schema/Operational V2 and critical API guards PASS;
- Agent safety release builds, starts, authenticates and performs bounded relay checks;
- Android safety release is signed, installable over the failed version, reaches login and passes critical login/session/report/confirmation smoke tests applicable to the Safety model;
- release-channel manifests point to the rescue versions and checksums match;
- canonical state records **D161_RESCUE_TO_SAFETY_BASELINE** while D160/Safety behavior remains the operational fallback;
- the Owner can resume normal safe operation before D161 repair continues.

A rescue does **not** create D162. Later diagnosis/repair remains D161 until the Owner explicitly accepts D161.

## 16. D160 v99/v100 PickList-confirm carry-forward and D160 closure

Status: **OWNER-APPROVED D161 BACKLOG / IMPLEMENTATION DEFERRED**.

The Owner closed D160 post-PASS testing on 2026-10-03. The trusted/accepted D160 runtime is **relay-agent-v97**. Manual-only relay-agent-v98/v99/v100 candidates remain historical evidence only; they are not promoted to `inventory-channel`, and no more D160 test build is authorized.

### Proven v99 behavior to inherit
- Same-row post-final marker fallback: when there is no authoritative fresh reject, `Xác nhận lấy lại hàng` on the exact target row may prove CONFIRMED only when every exact target satisfies the proof. Keep one final business click total.
- Presence-control `FAILED_PRECONDITION` caused by an update precondition is `SUPERSEDED`, not transport OFFLINE; do not arm HA refresh or retry the stale control snapshot.
- Successful terminal diagnostics remain in the complete local log but do not immediately create an error upload bundle.

### Safe v100 behavior to inherit
- Checkbox recovery stays pre-final, uses real Page.reload, preserves Search-before-F5/exact-row/foreign-selection guards, and may use the existing 4.5s soft wait plus an extension up to 3.5s. At the 4.5s soft boundary, the v100 field-tested extension gate is exact Confirm route + document/page loaded + navigation type `reload`; progress/hydration counters remain diagnostic evidence but are not silently promoted into a stricter extension prerequisite. The existing 12s mutation-start fence remains authoritative.
- Post-final observation is passive and one-click-only, up to 5.2s when the end-to-end budget permits. No Search, F5, provider retry or second Confirm click is permitted after the final click.
- Keep local redacted queue/handoff/browser-gate/search/mutation/terminal budget telemetry with zero new provider operation/cadence.
- Fast success exits immediately on authoritative evidence; do not intentionally delay a successful fast path to consume the full terminal budget.
- Persistent NOT_FOUND timeout tuning remains deferred pending stronger field evidence.

### Final recovery refinements approved from v100 field evidence
1. **Operational-ready after reload requires page-size=100.** A successful reload/barrier may continue self-healing after the request itself has failed closed, but before the browser is advertised ready for the next business request it must restore and verify 100 rows/page.
2. **Reset the D157 secondary 2h idle-reload clock after every successful reload.** Recovery/manual/scheduled successful reloads all reset the same last-successful-reload timestamp. A secondary idle F5 is allowed only when at least two hours have elapsed since that timestamp and the Agent is idle.

Safety boundary:
- A request past the existing mutation fence stays fail-closed even if hydration completes later.
- Late self-heal prepares only the next request; it never reopens mutation authority for the old request.
- Exact-match/ambiguity guards, one final business click, confirmation guard, no row-disappearance success inference, max-15 semantics, HA authority and provider cadence remain inherited unless another explicit D161 decision changes them.

### D161 Agent version lineage
- Official trusted runtime returns to **relay-agent-v97** when D160 closes.
- Active Agent source and its verify workflow are restored to the accepted v97 source identity (`4c3f0a4dffc94f66237d0958032fd27ac52fed29`) before D161 implementation; test-only v98/v99/v100 source is not the D161 starting baseline.
- Phase 0 publishes the next monotonic **Safety Agent** build S from accepted v97 behavior before any feature-bearing D161 Agent runtime. The first feature-bearing D161 Agent candidate must be strictly **greater than S**. If the trusted channel is still v97 at execution time with no intervening release, the expected lineage is Safety v98 → first D161 feature candidate v99 or later; exact numbers are always resolved from the live channel.
- Historical manual-only D160 test prereleases tagged v98/v99/v100 remain non-trusted evidence and must not be overwritten or silently promoted. Release publication must be collision-safe and must never reuse a historical test tag as a different artifact.
- This section does not start implementation. Exact start command remains **`bắt đầu D161 tiến hành`**, followed by Phase 0A PASS → Phase 0 PASS → D161 implementation.

## 17. D161 PickList confirm pipeline optimization and regression contract

Status: **OWNER-APPROVED D161 BACKLOG / IMPLEMENTATION DEFERRED**.

This section makes previously implicit D160 v97 behavior explicit and adds the additional confirm optimizations approved by the Owner after the v99/v100 review. D161 must start from the exact accepted v97 source and reapply the v99/v100 improvements without regressing these contracts.

### Immediate-scan FAST wave and per-request classification

- The first WMS pass is an **immediate local DOM scan** with no intentional wait to fill a batch.
- A request that is exact-row + selectable is classified FAST READY immediately.
- Missing/unselectable requests are deferred for bounded Search/recovery.
- Ambiguous/state-changed/unavailable requests are classified independently.
- One ambiguous request must never suppress Search/recovery for another missing/unselectable request in the same mixed batch.
- Max 15 remains a processing ceiling only. Never add an intentional batching delay to wait for more requests.

### Early terminal and ACK isolation

- FAST READY and other already-terminal outcomes must be persisted/ACKed before deferred checkbox/search/reload recovery.
- One slow or broken request may not hold the durable ACK of an unrelated ready request.
- Deferred requests use a shared bounded Search/recovery wave where possible; never introduce a per-request F5 loop.

### Dedupe and idempotency

Preserve and test all layers:

- listener + REST duplicate delivery dedupe within a cycle;
- duplicate request_id removal within a transport batch;
- requests that resolve to the same exact full PickList group to one WMS mutation target;
- recent terminal request suppression across cycles for the accepted bounded TTL;
- confirmation guard remains authoritative across retry/failover.

### Confirmation guard semantics

- Already-confirmed guard proof returns CONFIRMED without another WMS mutation.
- In-progress/uncertain guard blocks a new WMS mutation.
- Only a failure before the final business click is eligible for safe guard release.
- After the final click, uncertainty never releases the guard merely because success proof was not observed.
- Row disappearance/presence never reopens mutation authority and never proves success.

### Role/generation and mutation-deadline fencing

- Keep primary/generation verification before WMS mutation even if the request passed earlier queue/search checks.
- If role/generation changes after Search but before mutation, fail closed without WMS click.
- Keep the accepted 12-second mutation-start safety fence, but recheck the deadline close to the actual WMS mutation path instead of relying only on an early pipeline check.
- D161 should express request timing against one absolute end-to-end budget derived from the original client/request timestamp. Existing field-tested thresholds remain bounded inputs rather than independent timers that can accidentally exceed the PDA hard bound.
- Preserve the existing recovery-start reserve (current v97 contract uses the bounded early-recovery window) and the v100 terminal ceiling of 5.2s; do not use the larger passive wait to justify a late mutation.
- Normal target remains **5–10s end-to-end** and hard PDA target remains **≤20s**.

### WMS data readiness and health proof

- Zero/unhydrated table is technical unavailability, not true NOT_FOUND.
- WMS_DATA_UNAVAILABLE must not create a Picker NOT_FOUND strike.
- A responsive Confirm shell alone is not a WMS health proof.
- Reset/refresh WMS health proof only from a real hydrated/valid page proof, successful exact scan, successful reload barrier + hydration/page-size readiness, or successful business terminal evidence.
- Reload/recovery operational-ready still requires verified page-size=100.
- Every successful reload still resets the D157 secondary 2h reload clock.

### Schedule/control-plane versus WMS mutation readiness

D161 must separate:

1. shared business schedule authority;
2. Firestore/HA/control-plane availability;
3. WMS browser mutation readiness.

A transient WMS reload/not-ready state during an active schedule window must not by itself be represented as business SLEEP. Listener/HA coordination should remain alive where safe, while WMS mutation is blocked until ready. A bounded unhealthy PRIMARY may yield to a WMS-ready standby through the existing HA authority without parallel WMS mutation.

### Firestore/HA error classification

- Log HTTP + canonical Firestore status + operation + precondition/generation context.
- Expected stale/precondition outcomes must be classified as superseded/non-transport-health-impact where semantics prove that classification.
- Do not turn an expected stale CAS/precondition into transport OFFLINE or unnecessary HA recovery.

### Confirm critical-path telemetry

In addition to v100 queue/search/mutation/terminal timing, D161 must measure locally:

- rate-check and rate-clear/update duration;
- guard claim/read duration;
- primary/generation fence duration;
- checkbox select/verify duration;
- Confirm button wait;
- dialog-ready wait;
- final-click-to-first-proof;
- post-terminal cleanup duration;
- durable ACK duration/attempt count;
- total E2E and remaining budget at each safety gate.

No telemetry item may add a provider operation or WMS mutation.

### Measurement-first optimization candidates

These are approved for measurement and conditional optimization inside D161, but must not be changed blindly:

- If telemetry proves `WaitForD160CleanUi` materially delays PDA ACK, allow the authoritative terminal result to leave the ACK critical path earlier while marking browser cleanup as mandatory before the next mutation.
- If rate-limit read/clear is a material critical-path cost, optimize cache/batching/ordering without weakening anti-spam authority or correctness.

### Required regression and load fixtures

Add deterministic tests for:

- mixed batch READY + MISSING + AMBIGUOUS + UNSELECTABLE + STATE_CHANGED;
- duplicate request IDs;
- two requests resolving to one exact PickList;
- request near the mutation deadline;
- one deferred request while other requests must early-ACK;
- zero/unhydrated table;
- PRIMARY/generation change between Search and mutation;
- uncertain final click followed by retry;
- shared recovery with no per-request F5;
- batch up to 15 with no intentional batch-fill delay;
- burst model including **20 PDA / 5 seconds**.

Acceptance must show READY isolation, no false NOT_FOUND/strike, no duplicate WMS mutation, one final business click, normal 5–10s target where WMS/provider conditions permit, hard ≤20s bound, and no provider cadence increase.

### Explicitly unchanged unless later evidence reopens them

- no terminal wait above 5.2s;
- no second Confirm click;
- no row-disappearance success proof;
- no confirmation-guard loosening;
- no extra Firestore polling/listener cadence;
- no periodic WMS refresh increase;
- no persistent NOT_FOUND timeout tuning without new evidence;
- no parallel WMS mutation by multiple Agents.


## 18. D161 cross-platform Observability & Support Log v2

Status: **OWNER-APPROVED D161 BACKLOG / IMPLEMENTATION DEFERRED**.

Canonical detailed design: `docs/specs/OBSERVABILITY_LOGGING.md`.

D161 must redesign Web, Android and Agent logging around one structured schema and cross-platform trace model so future log review can reconstruct business flow, latency, retries, recovery, provider/HA state and evidence loss.

Required high-level behavior:

- common schema v2 with source/version/device/session/role/trace/stage/outcome/duration fields;
- request/trace correlation across Web/Android/Agent where one business ID already exists;
- monotonic per-journal sequence plus first/last sequence, dropped-event count and compacted-repeat count in every bundle;
- local-first recording with **zero provider write per event**;
- client + server double redaction and field allow-listing;
- no password/token/cookie/private-key/signing/session material, raw WMS session data, raw HTML/screenshots, HTTP bodies, query values or raw PickList code/suffix;
- Web gains bounded reload-surviving diagnostic incident context in addition to in-memory telemetry;
- Android keeps a bounded 1–2 MiB persistent support journal and records lifecycle/auth/permission/FCM/realtime/API/update/business/PickList stages without returning to four full periodic INFO uploads;
- Agent keeps complete local diagnostics but moves critical evidence to machine-parseable structured events, including full confirm critical-path stage timing and HA/WMS state;
- errors/crashes/incidents/logout/manual/global requests are event boundaries; immediate upload is fingerprint/debounce protected while local evidence/counters remain;
- daily Drive folders, Drive-confirmed local prune, global log collection authorization/TTL/jitter and no per-device ACK write remain inherited from section 8;
- one global log request ID must appear as trace_id in all responding Web/Android/Agent bundles;
- log failure must not become a business transport failure;
- no logging feature may increase WMS/Firestore/Google polling/listener cadence.

Section 8 remains authoritative for archive/prune/global-collection lifecycle except where this v2 schema/capture design explicitly extends it.



## 19. D161 integrity, convergence and evidence hardening — Owner-approved 2026-10-04

Status: **OWNER-APPROVED D161 BACKLOG / IMPLEMENTATION DEFERRED UNTIL THE EXISTING EXACT START GATE**.

These refinements were approved after the 2026-10-03 full-log review. They tighten already-approved D161 behavior; they do not create a new change ID, provider resource, polling cadence or Stable mutation.

### Agent release lineage must distinguish Safety from feature runtime
- Phase 0 Safety Agent is the next monotonic trusted build S derived from accepted pre-D161 behavior.
- The first feature-bearing D161 Agent build must be strictly greater than S.
- If accepted v97 is still current when Phase 0 runs and no intervening release exists, expected numbering is Safety v98 → D161 feature candidate v99+.
- Historical manual-only D160 v98/v99/v100 test releases remain immutable evidence only and are never silently promoted, overwritten or repurposed.
- The same monotonic principle applies to Android Safety versus feature candidates.

### HR source revision, stale-confirmation protection and atomic diff precedence
- Every observed authoritative HR Sheet snapshot used to produce an auto-apply or confirmation proposal carries a bounded source_revision or deterministic source_fingerprint.
- A Web confirmation proposal is valid only for that exact source revision/fingerprint. On confirmation, the trusted backend rereads or revalidates the current authoritative source; if the source changed, the old proposal is invalidated and a new diff/proposal is produced.
- Validate the complete observed snapshot before any mutation. One snapshot must never partially auto-apply a subset and later discover that another subset required confirmation or hard-block.
- Precedence for one snapshot is **HARD_BLOCK > CONFIRM_REQUIRED > AUTO**.
- Any hard-block condition yields zero HR business mutation for that snapshot.
- If any part requires confirmation, hold all changes from that same snapshot until the proposal is accepted and revalidated.
- Drive watch initial sync, channel renewal overlap and retry/recovery notifications are signals only; authoritative reread + revision/fingerprint dedupe determines whether business processing is needed.

### Reporting capability monotonic revision
- shortage_reporting_enabled authority must carry or reuse a server-authoritative monotonic revision/generation alongside the normalized boolean.
- Android persists (value, revision) and ignores an older revision after a newer authoritative state has been applied.
- Realtime remains the fast path and profile/login reconciliation remains the convergence path; no polling is added.
- Same-revision/different-value is a consistency anomaly: fail closed, retain evidence and require authoritative reconciliation rather than silently accepting either value.

### Cross-platform support-log archive idempotency
- Web, Android and Agent use an immutable logical bundle_id; boundary-triggered bundles also carry a stable logical boundary_id/slot identity where applicable.
- Upload retries are allowed, but trusted archive commit is idempotent by source + bundle identity, not by filename alone.
- Re-submitting an already archived bundle returns/converges to the same DRIVE_SYNCED durable result without creating another Drive object.
- Android logout/session boundaries, Web scheduled slots and Agent error/checkpoint boundaries must each be single-flight/idempotent for one logical event.
- Web scheduled checkpoints dedupe by logical slot such as source + device/session generation + business date + slot, so reload/re-entry cannot create a second archive merely because the filename timestamp differs.

### AgentSync same-version no-op
- If incoming agent_sync authoritative version equals the last applied version and there is no new local side-effect obligation, processing is a no-op for model rebuild, grid repaint and persistence.
- Listener/reconcile duplicate delivery may still be observed diagnostically but must not rebuild History/Picker presentation repeatedly.
- Same version with different authoritative payload content is a consistency anomaly and must be logged/handled explicitly rather than silently applied.
- This optimization adds no provider read/write/listener/poll cadence and must not delay PickList relay work.

### Canonical observability severity semantics
- Business success such as CONFIRMED is INFO/CONFIRMED evidence and must not itself trigger an immediate error bundle.
- Proven stale CAS/update-precondition outcomes are SUPERSEDED with transport-health impact NONE.
- Temporary updater DNS/timeout/HTTP/channel-unavailable failures are DEFER/WARN and non-blocking; they remain locally diagnosable without default immediate ERROR upload.
- Integrity/signer/hash mismatch, unsafe duplicate-mutation risk, confirmation-guard violation, crash/fatal and comparable safety failures remain ERROR/INCIDENT/FATAL as applicable.
- Short transient connectivity/reconnect incidents are fingerprinted/compacted; they must not create one Drive file per repeated line.

### PickList confirm trace completeness
- Once an Agent records/claims a PDA confirmation request, the structured trace must converge to one explicit terminal evidence class: ACKED_TERMINAL, SAFE_ABORT_PRE_MUTATION, UNCERTAIN_POST_MUTATION, HANDOFF, EXPIRED, or TRACE_GAP_DETECTED.
- TRACE_GAP_DETECTED is an observability failure marker only. It must never infer business success/failure, release a post-click confirmation guard or authorize another WMS click.
- Cross-component trace correlation continues to use the existing request identity and adds zero provider operation.

### Web persisted-journal session rotation
- Web reload-surviving incident context belongs to one authenticated session generation.
- Logout, account replacement or authoritative session-generation replacement rotates the journal generation.
- Prior evidence may be sealed/archived under its original session but must never be attributed to the next authenticated user.

### Overtime T-15 edge near the 05:00 cutoff
- When a newly created/extended authoritative overtime boundary is already within 15 minutes of its deadline, emit at most one immediate warning for that boundary rather than waiting for a T-15 instant that has already passed.
- The warning remains boundary-key idempotent across Agents; no periodic provider write/polling is added.
- The 05:00 hard cutoff remains authoritative and cannot be extended.


## 20. Phase 0 Safety execution checkpoint — PASS — 2026-10-04

- Final main evidence commit: `6702b0aabc807954d6427e7e3aa6442134cb95e3`.
- `D161 Phase 0 Safety Baseline` main run `37170577529`: PASS.
- UI Design Guard repair main run `37170513921`: PASS.
- Safety Android `beta-vc93` and Safety Agent `relay-agent-v101` are published and digest/channel verified; both preserve pre-D161 behavior.
- Phase 0A and Phase 0 are closed PASS. The complete already-approved D161 feature backlog may now proceed automatically through branch → PR → authority/continuity PASS → merge.
- D160 remains the accepted/rescue behavior until explicit D161 Owner field PASS. Stable remains OWNER-GATED and untouched.


## 21. D161 technical/runtime/release checkpoint — READY FOR OWNER FIELD TEST — 2026-10-04

- All current Owner-approved D161 implementation tranches A–E are merged: PRs #419, #420, #421, #422 and #423.
- Android field candidate: `beta-vc96`; Agent field candidate: `relay-agent-v104`.
- Beta Worker runtime PASS: main `e75b0a0a73543947840d2c3c599fa9efbf4220e5`, run `37191613243`, health HTTP 200, schema 17/17, Operational V2 5/5, missing bindings 0.
- D161 runtime-readiness proof PASS: run `37192056329`; candidate channels verified and production HR watch reported `APPLIED / AUTO` with future expiry.
- Final Agent Operations Gateway provider repair merged in PR #425; main `e128deba6567216ac28156c4148eb3183be99c9f`, provider run `37193309206` PASS including redeploy, gateway identity, authenticated Usage/Monitoring and D159-retired verification.
- D161 is now **READY_FOR_OWNER_FIELD_TEST** under OA096. This is not Owner PASS. D160 remains the accepted/rescue base until explicit D161 field acceptance. Stable remains OWNER-GATED and untouched.


## D161 Owner field repair — 2026-10-04

- Owner field test rejected the initial v104/vc96/Web Version 1 candidate on three repairable defects while keeping D161 as the active change ID.
- **Schedule:** outward business shift is 06:00–22:00; technical Replay is separately labelled 05:45–22:15; obsolete 22:30 copy is removed without changing the 22:15 runtime boundary.
- **HR:** HARD_BLOCK exposes bounded non-sensitive row/reason diagnostics and a one-shot recheck; HARD_BLOCK remains fail-closed. CONFIRM_REQUIRED uses explicit Yes/No, where No performs no mutation and keeps the proposal pending.
- **Agent Picker list:** after Agent login, active Picker observation is independent from WMS/Web Confirm readiness and the business-processing window. It reuses one Agent-sync gRPC stream targeting the existing `agent_sync` and authoritative `picker_presence_projection/current` documents, and stops on Agent logout; PickList mutation gates remain unchanged.
- Repair lineage target: Web Version 2, Agent v105, next monotonic Android Beta after vc96. Stable remains OWNER-GATED and untouched.

## 22. D161 fifth field repair — per-row Kích User without Android update — 2026-10-04

Status: **OWNER APPROVED / IMPLEMENTATION ACTIVE UNDER D161**.

Field observation: per-row Kích User could produce a locked overlay while Kích toàn bộ user did not. Root cause is the legacy single-revoke compatibility push encoded as `picker_command / CALL_SPECIALIST`, not beta-vc97 logout logic.

Approved repair:

- Android remains hard-locked at **beta-vc97**.
- Target Agent is **relay-agent-v109**.
- Per-row kick becomes one idempotent server-first command targeting exactly one Picker.
- InventoryCore generation revoke is authoritative and commits before client signaling.
- Worker reuses the existing `picker_session_controls` document to publish the authoritative generation after commit for immediate vc97 logout.
- Remove session-revoke specialist-overlay FCM semantics completely.
- Agent fleet removal consumes the authoritative generation returned by Worker.
- Bounded transient retry reuses the same command id.
- No new provider resource, collection, listener, query family, polling/heartbeat cadence or Stable change.

D160 relay-agent-v97 remains the accepted/rescue base until explicit D161 Owner PASS.

### D161 v109 fifth-field repair technical checkpoint — 2026-10-04

- Repair PR **#437** merged to main at `c5673b4e297f5c5ac150a1485d29443bf528fc0d`.
- Beta Worker deploy run **37214830211** PASS; runtime health is HTTP 200, source matches main, schema **17/17**, operational v2 **5/5**.
- Verify Beta Relay Agent run **37214830165** PASS and published **relay-agent-v109**.
- Release v109 EXE and inventory-channel EXE are byte-identical: size **7,289,344 bytes**, SHA-256 `89649c4d9a37fee536697600709b748b46eacd02c340b6a17692ea41d11f98dd`.
- Android remains **beta-vc97** unchanged; inventory-channel APK asset remains the same with SHA-256 `28626e6058695cf81797c5eb32362365e1408645002d3f0f6b4bdd20c0771e19`.
- Main UI/regression, authority and continuity gates PASS. Stable remains OWNER-GATED and untouched.
- D161 is **READY_FOR_OWNER_FIELD_RETEST**, not Owner PASS. D160 relay-agent-v97 remains the accepted/rescue base until explicit D161 Owner acceptance.



## Sixth field repair approved 2026-10-04 — Agent v110

Owner approved continuation under the existing D161 change after field testing Agent v109.

- Fix the outside-hours warning layout so the visible action set is laid out generically; **Gia hạn +1 giờ** must remain visible/clickable in the sleeping state and after resize.
- Decouple overtime extension and 05:00–05:45 early-start activation from Web Confirm/PickList readiness. These are shared schedule/control-plane actions.
- Distinguish an explicitly hydrated empty Confirm result from a broken/unhydrated session. Visible **Không tìm thấy kết quả phù hợp** + expected Confirm DOM is `READY_EMPTY` and user-facing as **Web Agent chưa có PickList**.
- Preserve fail-closed behavior for a blank/partial Confirm shell without the explicit empty-result marker.
- When a PDA request arrives from `READY_EMPTY`, run the existing Search/recovery/confirm path normally; do not terminal-fail only because idle state previously had zero PickLists.
- Preserve strict PRIMARY/generation + browser readiness mutation fence immediately before WMS mutation.
- Agent-only target: **relay-agent-v110**. Android beta-vc97, Worker, Web and Stable remain unchanged. No new provider resource/cadence.
