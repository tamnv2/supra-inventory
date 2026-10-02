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
