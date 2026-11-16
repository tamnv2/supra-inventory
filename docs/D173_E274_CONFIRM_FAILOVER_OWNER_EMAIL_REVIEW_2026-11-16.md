# D173-E274 — Review-only: Confirm Web degraded HA failover and Owner incident email (2026-11-16)

## Authority / boundary

Owner reported field failure on 2026-11-16 and requested log-backed diagnosis and a remediation proposal, **not implementation or release authorization**. Accepted change base remains D171 limited; active change D173. Source base `main` SHA `910bbeb400eebcd499a356d392ae500e2320d885`. D172 business scope is independent PENDING/HOLD; Stable OWNER-GATED. This checkpoint contains no raw logs, employee identifiers, PickList numbers, personal details, credentials, or sensitive WMS payload.

## Verified evidence (read-only)

- Private Google Drive Agent VPS checkpoints/manual log dated 2026-11-16; latest VPS log sampled through ~17:15 VN; additional Admin workstation log sampled through ~17:16 VN. These are sampled append-only support extracts, not a comprehensive provider audit.
- VPS D157 day-summary checkpoint at 17:14:19 reports `received=600 confirmed=415 error=185`. **The 185 results include potentially mixed business/technical classes, not 185 verified infrastructure failures.**
- Latest VPS manual sample contains 83 technical-error `AUDIT AGENT_RESPONSE` records: 81 `WMS_DATA_UNAVAILABLE`, one `WMS_CONFIRM_ACTION_UNAVAILABLE`, one `WMS_CONFIRM_RESPONSE_MISSING`. These are sample counts, not full-day totals. Consecutive technical responses occurred ~16:15–17:10. An earlier ~16:08 VPS checkpoint also shows `WMS_CONFIRM_RESPONSE_MISSING` with no fresh terminal proof after a post-click ~5.2s wait.
- VPS periodically reported `E141 WEB_MONITOR state=READY_EMPTY ready=1 picklist_count=0 table_count=1` even as ongoing requests returned `WMS_DATA_UNAVAILABLE`. Empty table alone can be legitimate and is not unconditional failure evidence; the **combination** of actual failing searches and persistent READY_EMPTY merits confirmation-health classification.
- Failed VPS infrastructure outcomes were durably acknowledged (`FIRESTORE ACK PASS ... result=WMS_DATA_UNAVAILABLE`) under `role=PRIMARY`. Admin workstation logged `NEXT_A reason=STANDBY_SELECTED` at 17:08:38 with local Web monitor READY; no evidence in inspected log that it was promoted or executed business confirm during the VPS technical failures. Its UI readiness does **not** prove that WMS final-confirm action could succeed.
- `relay-agent/FirestoreAgentLeaderCoordinator.cs` has 15s expired-primary-lease takeover, Web-unready/confirmed-hard-failure handoff with role-generation CAS, readiness-filtered standby choice and in-flight mutation guard; it does not directly consume repeated technical `WMS_DATA_UNAVAILABLE` or post-click unknown outcomes to mark a PRIMARY functionally degraded.
- `relay-agent/D160ConfirmPipeline.cs`: if `HasReadyConfirmBrowser() == false` and a ready NEXT_A/NEXT_B is known, it can preserve pending request (`ShouldAck=false`). But the READY browser + zero PickList rows path returns terminal `WMS_DATA_UNAVAILABLE` and normal ACK. This explains why those requests did not become HA-recoverable despite a secondary Agent presence.
- `D160ConfirmPipeline.cs` safeguards post-click uncertainty with **read-only exact-row verification and no blind repeat click**. This must remain mandatory, including across HA generations; no claim that every missing success toast means WMS failed.
- `service/src/google-mail.ts` supports an existing project mail sender, and `service/src/index.ts` uses it for account recovery. No operational confirm/HA Owner-email incident pipeline was found in relevant inspected source or sampled Agent logs. Absence of log lines alone is not definitive proof of all possible external mail delivery.

## Proposed remediation (OWNER APPROVAL PENDING)

1. Add a **business-confirm health state** separate from Web DOM login/READY, derived from pre-click WMS data failures, recent completed outcome quality, session/readiness proof and local operation health. At the **first** proven pre-click WMS technical failure, avoid irreversible ACK and hold the bounded request while checking local page health and ready standby without replaying WMS mutations. For active pending work, a candidate functional-degradation trigger is 2 consecutive comparable failures within 5–10s with independent replacement-readiness proof (threshold subject to deterministic tests), with distinct transient, degraded and recovered states. A 30s sustained fault may trigger incident escalation, but must not delay takeover beyond the existing 20s normal / 35s maximum pending budget. A legitimately empty WMS queue must not alone mark a global outage.
2. For verified **pre-click** infrastructure unavailability, temporarily stop new WMS mutations and retain unacknowledged work through existing bounded PENDING/lease/ACK protocol for a ready replacement. Do not convert valid business NOT_FOUND/PICKLIST_NOT_READY/CONFIRM_REJECTED to infrastructure failures. Require direct passive or safe Web-readiness evidence from NEXT_A and existing Firestore role+generation CAS fencing, in-flight operation guard, single mutator, anti-flap cooldown and bounded fallback.
3. After a final click with an absent terminal response, classify as **UNCERTAIN**, perform existing exact-row read-only confirmation and preserve no-blind-replay semantics; do not re-execute a potentially successful click on a replacement Agent. Use explicit PDA guidance/manual adjudication when proof is unavailable. Respect pending TTL and requestId dedup; assess 12s mutation fence and 20/35s pending budgets before setting any takeover SLA.
4. **SUPERSEDED by E275 Owner scope narrowing:** email only when the current PRIMARY becomes functionally unable to confirm PickLists, either from independently confirmed WMS login/session requirement or from sustained operational WMS data/confirm unavailability even while still logged in. Reuse the existing Worker project-mail capability, not Agent SMTP. Exactly **one failure email per incident** to the owner-specified address held exclusively in private protected runtime configuration (no address value committed to the public repository); no routine mail for failover success, healthy recovery, ordinary Picker errors, single transient uncertain confirmation, or each retry. Create an incident key tied to primary service failure lifecycle, persist cross-agent dedupe, recover/rearm only after stability proof. Send only sanitized event code/time/safe diagnostic summary; cap provider retry and mail volume. Do not use private email in source/tests/CI logs.
5. Add deterministic failure reproductions and CI: READY_EMPTY + failed searches with healthy NEXT_A; false-positive legitimate empty table; unavailable or equally unhealthy standby; completed click but missing final response; racing generations/lease expiry; in-flight handoff; recover after session re-login; no duplicate mutation, no split brain, no unauthorized email; D172 business isolation/regression, provider usage delta and signed Agent/guarded Worker release gates. Provisional target: start safe pre-click failover within the **remaining bounded request lifetime** (normal 20s; maximum 35s; post-takeover/12s mutation fences require explicit timing tests); email can be delayed/debounced separately. Do not promise an unconditional switchover SLA before source tests and real FIELD proof.


## E275 focused Web-log reanalysis and Owner email decision (2026-11-16)

**Owner directive:** send only incident notification email when the current PRIMARY fails (Supra session expired, or session still present but business-confirm unusable), no spam; one recipient supplied in private conversation. The mailbox address is deliberately **not included in this public GitHub repo**. Recipient must be provisioned as a protected runtime variable/secret after authorization, never hardcoded or put in public PR/CI/log.

**Source-verified failure mechanics:**
- `SupraConfirmBrowser.cs:2584-2690` constructs Web `ready=true` when `domReady` AND (`picklistCodes>0` OR visible literal “no matching result” marker). `READY_EMPTY` with a visible empty-results indicator therefore sets `_supraBrowserReady=true`; this proves Web DOM/layout accessibility, **not successful business API/data availability**. Do not infer login expiration from `READY_EMPTY`.
- `Program.cs:4185-4199` sets `_d173E140WebUnavailable` only for login marker/browser hard failures. `READY_EMPTY` is not a hard failover trigger, so HA retains PRIMARY and sends lease heartbeats.
- `D160ConfirmPipeline.cs:111-114` invokes `SearchMany(terms, true, false, false)` for PDA. The final `false` disables the existing `SupraConfirmBrowser.cs:1079-1108` empty-table self-healing reload; another `false` disables checkbox recovery in the fast path. If a real search still sees zero PickList rows, `D160ConfirmPipeline.cs:290-300` assigns `WMS_DATA_UNAVAILABLE` and `FirestoreConfirmationTransport` later durably ACKs rather than retaining pending work, even when READY standby exists.
- WMS Web itself may be showing a *legitimate* empty-results message, misapplied filters, stale client data state, or a failed/stalled WMS data call. Source adapter deliberately uses CDP Page/Runtime only (`SupraConfirmBrowser.cs:74-75`), with no Network inspection; current support logs **do not prove which WMS internal HTTP request/backend failure, filter, or session-cookie condition originally emptied the table**. Do not assert a WMS server outage or forced logout without WMS-side provider/network evidence.

**Log-verified timeline (Vietnam local):**
- VPS 16:09:15 `CONFIRMED`; 16:09:22 final click and 16:09:27 terminal `WMS_CONFIRM_RESPONSE_MISSING` after ~5.3s with no fresh success/error surface; 16:09:27 real reload timeout at 5s, ultimately recovered as `READY_EMPTY` with zero rows by 16:09:41. This is an *uncertain post-click* result, not proof WMS did not confirm.
- After resumed successful confirmations through ~16:08–16:15, at 16:15:22 `FOREIGN_SELECTION` before final click led to another actual `Page.reload`, a 5.15s local verification timeout and by 16:15:35 `READY_EMPTY` with 0 PickList codes and row_count=1/header-only. First repeated `WMS_DATA_UNAVAILABLE` at 16:15:41; 81 such responses through 17:10:31 in the later bounded manual VPS log, despite `login=0`, `page_loaded=1`, `data_hydrated=1`, and the *same* sampled DOM fingerprint `0758ffe9350a`. The 0-row DOM persisted across repeated search UI clicks and page-size change to 100. The fingerprint is log diagnostic, not WMS raw data.
- The 59 `E141 WEB_MONITOR READY_EMPTY` samples are *observations*, not 59 independent faults; the 81 WMS_DATA_UNAVAILABLE records are *sampled request outcomes*, not full-day totals.
- Admin workstation Web monitor continued READY and nonzero PickList rows during that period; role transitioned to `NEXT_A` at 17:08:38 but no observed business-confirm takeover. This supports *VPS-specific broken browser data view or path*, not a fleet-wide WMS server outage (WMS backend health remains unverified).
- Operator-unlocked Web tab at 17:13:01; a `LOGIN_REQUIRED` marker appeared at 17:13:11 and cleared by 17:13:17, then a subsequent normal reload showed 10 PickList rows at 17:13:26; VPS confirmed again at 17:15:53. **This late, short-lived login marker does not establish an expired login during the 16:15–17:10 outage**, nor prove the operator reauthenticated; this causal link is unverified.

**Narrow incident-only mail proposal, pending Owner implementation authorization:**
1. Detect independent `PRIMARY_CONFIRM_UNAVAILABLE` incident when WMS login-required is persistent and independently confirmed OR when persistent *pre-click* WMS technical failure occurs with eligible PDA work (not any one empty table or a single uncertain final click). Use existing passive Web monitor/local event stream, no new frequent Cloud polling.
2. Send **one** email on transition `HEALTHY → CONFIRMED_FAILURE`, independent of whether standby later succeeds. Do not send per-PickList, per-error, per-standby transition, or routine recovery notice. Maintain one durable incident key and a sent/sending state in existing scoped Worker storage to dedupe across Agent restart/HA changes and retry. Re-arm only after stable recovered state (e.g. 5-minute healthy evidence, to validate in tests), preventing flapping spam.
3. Private recipient alias only, no Owner mailbox in GitHub. Use existing authorized project mail sending on current Worker; no new resources or credentials in Agent. Confirm one real field test email only after Owner code/release authorization. Email failure handling must not block confirm/HA processing.
4. Keep separate fast failover and email trigger budgets. Preserve `PENDING` recovery where pre-click is proven, generation CAS and no replay of uncertain post-click WMS mutation; any user-visible failover SLA depends on existing 12s mutation /20s normal /35s max request fences and testing.

**Status:** revised E274 proposal and deeper findings only; NO executable change, NO CI PASS claim, NO production release and NO test email.


## E276 Owner-requested incident email copy proposal (2026-11-16)

**Status:** PROPOSAL_ONLY, not yet approved as final copy; no Agent/Worker code or actual email. Public repository intentionally excludes the private recipient address.

**Suggested email subject:** `[SUPRA 1291] CẢNH BÁO: Agent chính không thể confirm PickList`

**Proposed plain-text email body:**

```text
CẢNH BÁO SỰ CỐ AGENT – SUPRA 1291

Hệ thống phát hiện Agent chính không thể thực hiện xác nhận PickList.

Thời gian: {dd/MM/yyyy HH:mm:ss}
Agent gặp lỗi: {Tên máy / Agent}
Nguyên nhân: {Phiên Supra hết hạn / Web không khả dụng dù phiên còn hiệu lực}
Chi tiết lỗi: {Mô tả ngắn gọn theo log đã xác minh}
Chuyển Agent dự phòng: {Đã chuyển / Chưa chuyển / Không có Agent khả dụng}

Ảnh hưởng: Chức năng confirm PickList trên Agent chính bị gián đoạn.
Mã sự cố: {Incident ID}

Email được gửi tự động khi phát hiện sự cố.
Các lỗi lặp lại trong cùng sự cố sẽ không gửi thêm email.
```

**Accuracy:** `Nguyên nhân` must be evidenced by the health classifier; otherwise display `Chưa xác định` rather than inventing an expired session or WMS server outage. Failover status must be derived from actual HA transitions. Single incident mail only; no recovery or per-request spam.

## Status

`DIAGNOSIS_SUPPORTED_BY_SAMPLED_LOGS_AND_SOURCE; ROOT_CAUSE_BOUNDARY_IDENTIFIED; FULL_DAY_BREAKDOWN_PENDING; CODE_NOT_CHANGED; CI_NOT_RUN; RELEASE_NOT_AUTHORIZED; FIELD_FAIL_OWNER_REPORTED; OWNER_APPROVAL_PENDING`.

No executable Agent/Worker/Web/Android changes, no provider config mutation and no email were sent under this review-only checkpoint.
