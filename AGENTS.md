# ACTIVE OWNER FREEZE — D171-E046 (2026-10-21) — supersedes historical Beta/Stable deploy language

- Owner confirms **LIVE** signed Android vc114 + Windows Agent v139 + Web 3.1.1 stable in shift. **NO main merge, Production Worker/Web/App/Agent/Firestore/Gateway deployment, auto OTA, version-floor changes or provider data mutation during the shift.** Work only in **Draft PR #656 CODE ONLY**; exact post-shift Owner command required for release.
- **Single user-facing Production:** `inventory.supra.cc.cd`, current data-bearing formerly Beta-named Worker + InventoryCore/SQLite + existing Firebase. **NO Beta→Stable promotion/copy flow; NO public Beta/Stable environment selector.** Preserve technical beta IDs used by signed app/update tags/Firebase/Worker/Google and the legacy host for old-client compatibility. Old separate Stable Worker OWNER-GATED and never automatic release target.
- **Unified code candidate:** D170 single-Production UX and D171 Android vc115 / Agent v140 / Web 3.1.2 must share actual Worker OAuth callback origin/CSRF guard, API/Firestore authority, WMS/PDA ACK/HA, online/offline Office route, 13:15/21:15 logging receipts. D170 official OAuth Worker PR657 has already deployed (main f548677, CI run 39505589708); Owner observed Google OAuth success and reports updating secret (D170-E029). **Do not repeat OAuth/token setup.** Drive/Gmail physical proof remains pending. PR656 is behind main and must be reconciled before CODE DONE; it **must never overwrite D170 OAuth guard**.
- Owner will continue requesting code work on the candidate. Record each requirement/decision/spec/state/continuity in the same guarded Draft PR. Source CI PASS ≠ deployment authorization. Do not auto promote accepted base D169 or mark D170/D171 Owner PASS. No task starts main merge/production deploy until an explicit new Owner approval **after shift**.
- Canonical details: `docs/D170_D171_SINGLE_PRODUCTION_RELEASE_ALIGNMENT_2026-10-21.md`, `ops/change-continuity/D171.json#D171-E046`, `ops/owner-actions.json#OA106`.

# D171 Owner priority exception (2026-10-19)

The Owner explicitly directs D171 isolated two-Agent/one-PDA network testing **before** D170 acceptance, with D170 **PAUSED, owner_pass=false**. This is one exact exception to serial sequencing, not D170 PASS and not a general concurrency policy. Accepted base remains D169 limited Owner PASS. D171 alone is active; no changes to D170 production Worker, official/legacy hosts, OAuth, signed APK/Agent channels, WMS/PRIMARY or Stable as a consequence of this test. The diagnostic project uses a scoped temporary Firestore namespace, secure Rules emulator, and separately built Windows/Android test clients; only the Owner's authenticated real-field test may establish FIELD PASS. Follow `docs/D171_THREE_NODE_NETWORK_TEST_PLAN.md` and `ops/change-continuity/D171.json`. Older D170-first text is historical for this one priority override.

# D170 live cutover status (2026-10-19)

Phase1 Worker and signed Android vc113 are released. Phase2 official `inventory.supra.cc.cd` and legacy `inventory-beta.supra.cc.cd` now map to the **same existing** `supra-inventory-beta` Worker and InventoryCore SQLite: main `d6833675`, Worker CI run `39154128973` PASS, both hostnames `/health` source/storage PASS. Technical Beta resource names and old host are retained for client compatibility. Do not treat earlier D170 DESIGN ONLY / hostname-not-cut-over sections below as current runtime status. D170 Phase3 public-client links, OAuth, release-pipeline consolidation, physical FIELD_PASS and OWNER_PASS remain pending. D171 queued; old Stable Worker remains separately gated.

# AGENTS.md — SUPRA Inventory

## D170 Owner decision — single official Production (DESIGN ONLY)

Owner on 2026-10-18 accepted D169 code/release at limited scope and opened D170 as the sole active design change. Intended one official system at `inventory.supra.cc.cd`, user-visible Android `1291 Báo hàng`, with no operational Beta→Stable release promotion. **Current infrastructure is NOT yet cut over:** preserve existing Beta-tagged Worker/InventoryCore SQLite/Firebase resources, Android package/signature and legacy update channel; do not deploy the old Stable Worker or rename/migrate data just to remove technical Beta IDs. Current Beta/Stable guards below remain effective until a source-reviewed, Owner-authorized D170 cutover actually succeeds. Isolated PDA-Agent-Agent network diagnostics are D171 QUEUED only (#612/#613 Draft). Use `docs/D170_SINGLE_PRODUCTION_CUTOVER_PLAN.md`, the active D170 journal and current resource scope. No CODE/DEPLOY/OWNER PASS is inferred from the design record.


This repository belongs only to `SUPRA Inventory — Báo hàng` (`supra-inventory`). Never import assumptions, credentials, resources, business rules or architecture from another project. The prior Báo hàng 1291 product may be consulted only as the Owner-approved business/UX reference described by canonical decisions; its legacy resources/backend are never project authority.

## Mandatory bootstrap gate before mutation

Read `ops/authority-manifest.json`, then consume its `bootstrap_order` in order. At minimum this includes:
1. `AGENTS.md`
2. `docs/PROJECT_CONTEXT.md`
3. `ops/project-scope.json`
4. `ops/project-state.json`
5. `docs/OWNER_DECISIONS.md`
6. all relevant `docs/specs/*`
7. `docs/OPERATING_PROTOCOL.md`
8. `ops/resource-registry.json`
9. recent commits/CI and relevant live source

Do not mutate first and “reconstruct context later”. If canonical files conflict on behavior or target resource, fail closed and reconcile.

## Authority

1. Current explicit Owner command.
2. Canonical GitHub context/scope/state/decision/spec/operating/resource files.
3. Current source + recent CI/deploy/runtime evidence.
4. Generated views.
5. Chat memory/old handovers only as retrieval aids.

GitHub is the durable project memory; chat is the control surface.

## Project resource scope

`ops/project-scope.json` is authoritative for provider/resource identity. Use exact listed ID when present; otherwise canonical name and `id_source`. An unlisted resource is outside scope and must not be mutated until reconciled and Owner-approved.

Stable resources are OWNER-GATED even when listed.

## Durable product knowledge

All Owner-approved forms, design rules, workflows, business logic and scenarios must be persisted in `docs/OWNER_DECISIONS.md` plus affected `docs/specs/*` in the same workstream. Never leave a durable approved rule only in chat.

Superseded decisions are marked, not silently removed.

## Live work-state rule

Meaningful work updates `ops/project-state.json` in the same workstream. It must distinguish technical PASS, runtime PASS, device/field PASS and Owner business acceptance. “Continue” means fresh-read project state before acting.

Resource changes update both `ops/project-scope.json` and `ops/resource-registry.json` where applicable.

## Serial Owner-PASS change gate

The accepted project base is the latest change explicitly confirmed **PASS by the Owner** in canonical state. Technical/CI/runtime/release PASS alone does not promote a change to the accepted base.

Only one project change may be open at a time. While the current change lacks explicit Owner PASS:
- do not create or process a new `Dxxx` change ID;
- do not start an unrelated feature/fix/removal workstream;
- do not use a technically completed candidate as the next stable base.

If the Owner reports NOT PASS / FAIL, continue diagnosis and repair under the **same change ID** until the Owner explicitly records PASS. Acceptance-record updates and repairs that belong to the same change remain allowed.

Before implementing any requested add/change/remove that may affect the accepted base, first present: whether the base is affected, exactly which components are affected, regression/risk/resource/quota/security impact, and the recommended safest implementation. Implementation starts only after explicit Owner approval of that proposal.

When Owner PASS is received, record it in canonical decision/state/Owner-action continuity under the same change before opening the next change. A request for new project mutation while the gate is blocked must fail closed and identify the blocking change.

## Automation-first rule

Follow `docs/OPERATING_PROTOCOL.md`. For finite work: trigger → poll → inspect failure → repair in scope → rerun until terminal PASS or a real Owner-only blocker/hard tool limit.

If Owner action is unavoidable, use the shortest official UI path, batch permissions/setup, avoid local installs/CLI when a connected/web path exists, and automatically recheck afterward.

## Stable guard

No Stable deploy/provision/public traffic/real-user bootstrap/OAuth refresh activation/promotion/release without explicit current Owner authorization.

## Public-repo security

Never commit/log/paste secret values: private keys/service-account JSON, OAuth client secrets/refresh tokens, Cloudflare tokens, signing material/passwords, root/admin passwords, session/access tokens, private API keys.

Use secret *names/references* only. For new operational metadata, minimize public exposure and prefer aliases/runtime variables when reproducible automation does not require the exact value. Exact IDs already in public Git history are classified in `project-scope`; deleting them from HEAD does not make them secret again.

## Product guards

- Beta/Stable isolated; no Beta runtime data copied into Stable by default.
- Worker + InventoryCore SQLite is transaction authority.
- UI is realtime; reload is not synchronization logic.
- No location/bin/pickface or stock-quantity inventory scope.
- **No offline business mode.** Do not add offline report creation, durable offline mutation outbox, fake offline success, direct-to-Sheet fallback or any alternate offline transaction path. This is closed by Owner decision D043, not an open future option.
- Office-network fallback research stays closed for Báo hàng/offline transactions. D073 is the explicit bounded exception: Beta may test an online Google/Firebase relay only for the new Picker `Xác nhận lấy hàng` capability; it is not a fallback path for Báo hàng and the POC must not mutate WMS.

## D167 mandatory repo-first, whole-model and usage-aware reasoning gate (Owner 2026-10-11)

Applies **before any analysis, proposal, edit, deletion, addition, optimization or acceptance claim**, including chat-only recommendations; this is a reasoning and review rule, not deployment approval.

1. **Read current canonical GitHub, not chat memory.** Bootstrap `ops/authority-manifest.json` and every declared item in order. Inspect the actual relevant live source, API/event contracts, recent commits, PR checks, deployment/version evidence, and unresolved Owner decisions. Cite paths + commit/CI evidence and distinguish code state from installed/field/billing proof. If repo access fails, say so and stop short of a repo-authoritative conclusion; never fill gaps by guessing.
2. **Analyze as one coupled model.** Map each direct and indirect impact across Windows Agent/PRIMARY-standby/WMS UI, Android PDA Picker+Reporter/ACK, Web/HR, Worker+InventoryCore DO SQLite, Apps Script Gateway, Firebase Auth/Firestore/RTDB/FCM, Drive/Sheets, update manifests/CI, and Beta/Stable resource boundaries. For each affected contract consider state owner, identity/role, timestamp/sequence, failure/retry/idempotency, realtime/delta/resync, HA generation, migration, logs, privacy, security and rollback. Mark unaffected components with a reason; avoid speculative standalone UI fixes that break end-to-end behavior.
3. **Optimize usage subject to hard operational constraints.** Compare at least (a) no-change/measure, (b) direct hot-path improvement, and (c) safe cross-meter workload redistribution when technically equivalent. Check actual provider billing/free allowances, shared-account scope, request/document reads/writes, SQL rows, CPU, network, logs, cache and client energy; **metrics with different units cannot be literally pooled**. Choose the lowest total verified-cost/usage design *among* options preserving or improving realtime freshness, ACK, confirm latency, HA, availability, correctness, user experience and security. Do not reduce critical quality to meet a soft quota. An unproven saving must remain a hypothesis.
4. **Prevent fix-and-regress loops.** Before any source modification produce a requirement→component→contract→test→evidence matrix covering normal, error, concurrent, offline-network (without offline business), reconnection, day boundary and version-mismatch cases. Run smallest relevant tests plus shared API/realtime/HA/ACK/permission regressions. A changed provider operation must have before/after cost and latency estimates, comparable-shift measurement plan, guardrail and reversible rollout. Never invent passing physical tests or measured usage savings.
5. **Serial approval unchanged.** This governance addition belongs to existing D167 only. It authorizes neither executable code nor Beta/Stable deployment, WMS automation, new provider resources, nor D167 Owner PASS; preserve branch→PR→authority/continuity CI→gated promotion.

Canonical extended checklist and status reconciliation: `docs/D167_SYSTEM_REVIEW_2026-10-11.md`.

## Repo-backed discussion checkpoints and exact Dxxx resume (Owner 2026-10-12)

**MUST** read GitHub before every substantive Dxxx analysis, proposal, answer, code, review or resume—not just before mutation. Start at `main:ops/authority-manifest.json`, consume its complete declared `bootstrap_order` in order. Use the main state to discover the currently open Dxxx Draft PR; read that PR's **fresh HEAD** and its own `ops/authority-manifest.json`, full bootstrap, `ops/change-continuity/Dxxx.json`, source and current CI. The accepted base lives on `main`; the unmerged PR is the **working discussion/code state**, not released authority. Do not use AI memory or stale handover in preference to either.

For `tiếp tục Dxxx`, first report the verified snapshot: Owner-approved decisions; open/unapproved discussions; completed source/CI work and exact evidence; ongoing tasks; failed/blockers; next authorized step; code/release/Owner-PASS gates. A superseded proposal stays traceable and must never be silently treated as Owner-approved.

**Every substantive exchange must produce a GitHub discussion checkpoint BEFORE claiming it has been retained:** new question requiring analysis, proposed option, Owner approval/refusal, change of scope, technical evidence, CI result, unresolved item, next action. Append a sanitized entry to the current Dxxx working journal and read back its commit; adjust Owner decision/spec/state/action files **only as required for their proper authority layer**. A true read-only/no-new-information answer needs no duplicate commit. Do not commit raw chat or secrets to this public repo; on unavailable GitHub write, report `CHECKPOINT_NOT_SAVED` truthfully, never pretend that AI memory is GitHub.

D167 latest Owner directive 2026-10-12 is **CODE PASS ONLY** for Draft PR #559: no merge to main, no Beta/Stable deploy, no Agent/Android releases/channels/OTA, no active WMS/SKU runtime mutation until a **new explicit Owner deployment approval**. Historical PR #555 Beta release remains unchanged. Detailed procedure: `docs/CHANGE_CONTINUITY_PROTOCOL.md`.


## Active D167 Owner command clarification — 2026-10-13

Latest Owner decision `D167-E046` in `ops/change-continuity/D167.json` and `docs/OWNER_DECISIONS.md` **supersedes** historical statements above that direct MAIN-tab WMS auth is still required or that PR #559 remains CODE PASS ONLY. Beta Agent v129 and its Worker P0 were previously technically released. The Owner now **cancels** the unimplemented MAIN-tab direct SKU-auth task and accepts the already-used separate same-profile WebView2 source. Other non-SKU Agent faults are deferred to the separate active D167 discussion; Usage awaits logs; Launcher work is outside this repo until separately reconciled.

Operational commands: `chạy code` = finish all agreed source/CI and STOP/report at CODE READY with zero live updates; later `duyệt triển khai` releases only PASS-code approved scope. `chạy code và triển khai` or `triển khai luôn` = complete code/CI **and** deploy scoped Beta in one uninterrupted authorized workflow after required checks, with no second midway Owner signoff. This policy checkpoint alone is **not** a software-deployment instruction; branch/PR, scope/security gates and separately gated Stable remain mandatory.


## Current open D168 (Owner 2026-10-13; supersedes historical D167-active instructions)

Owner confirmed **D167 PASS limited to Beta as deployed with no errors presently reported**, recorded in PR #581 and canonical Owner decision/state. The accepted project base is now D167; current serial change is **D168**. Earlier sections containing D167 current/Draft PR #559, #580 or CODE_ONLY boundaries are historical change-specific checkpoints, never active project status. Always bootstrap the **current** `ops/authority-manifest.json` and its full order, including `ops/change-continuity/D168.json`, then current source/CI/PR. New D168 purpose is sanitized issue/log intake, repo-based analysis, Owner-approved proposals and future approved work only; **no D168 code/deploy permission follows from opening the change**. Stable remains OWNER-GATED. Keep separate CODE READY, Beta release, field/usage proof and Owner PASS; D167's limited approval does not assert unverified physical or provider billing tests. 


## Current D169 intake after limited D168 Owner PASS — 2026-10-14

Supersedes historical lines describing D168 as the current open change. Owner explicitly accepts D168 **only in the code/as-deployed scope, no further new issue observed at closeout**, and orders D169 as a record-only intake for later unified analysis. Accepted base is D168 within that limit; D168-E050 pre-existing mandatory-update and oversized Android Agent chat overlay defects remain open and are carried to `docs/D169_BACKLOG.md`, not marked fixed. Canonical active pointers: `ops/authority-manifest.json`, `ops/project-state.json`, `ops/change-continuity/D169.json`, `docs/D169_BACKLOG.md`. A D169 report is NOT code, release, Beta, Stable, domain or provider authorization. Preserve serial Owner-pass, explicit design approval, usage-aware whole-model audit, and Stable guard.

## Supplemental coding discipline — Owner-provided CLAUDE.md (2026-10-18)

This is a repository-wide engineering protocol for all present and future changes in `tamnv2/supra-inventory`, integrating the Owner-provided `CLAUDE.md` guidelines into existing governance. It is subordinate to the current Owner command, canonical scope/state/spec, the active change's Owner-PASS gate, security constraints, CI, and `docs/OPERATING_PROTOCOL.md`. It applies to all contributors, AI coding assistants and workstreams using this repository. It is **not** approval for product code, deployment, Stable, WMS authentication automation or resource changes.

1. **Think before coding.** Resolve the current GitHub bootstrap and relevant live source first. Record assumptions, meaningful alternatives, material ambiguity, user-visible tradeoffs, and the simplest safe approach. Ask the Owner only when an ambiguity genuinely blocks safe authorized execution; otherwise make a bounded, reversible decision and document it. Never invent a requirement or silently expand scope.
2. **Simplicity first.** Implement only the approved goal. Avoid speculative features, single-use abstractions, unnecessary flags/configuration, excess defensive branches for truly impossible states, and duplicated existing utilities. Do not omit safeguards for *possible* failures involving authentication, concurrency, idempotency, HA, retries, network transitions, realtime/ACK, privacy or financial usage.
3. **Surgical changes.** Modify only files and lines traceable to the approved requirement, using the existing style. Do not reformat, refactor or remove unrelated code. Remove imports/variables/functions made unused **by this change**; report pre-existing unrelated issues to the active Dxxx backlog rather than casually fixing them.
4. **Goal-driven execution.** Define observable success and failure criteria before editing. For a bug, first reproduce it in a targeted test when feasible; for validation, cover invalid input; for refactoring, prove before/after contract parity. Run smallest relevant checks plus shared authority/continuity, auth/permissions, API, realtime/ACK, HA and version/network regressions where affected. Distinguish SOURCE_TEST_PASS, CODE_READY, RELEASE_PASS, FIELD_PASS and OWNER_PASS; never claim unperformed device or usage tests.
5. **Compact execution plan.** For nontrivial changes, use steps of `action → verification evidence`; iterate automatically through bounded failures until the authorized technical gate passes or a real blocker is recorded. Reduce oversized solutions before submission; every changed line must have a traceable purpose. The existing requirement→component→contract→test→evidence matrix remains mandatory where applicable.

These guidelines improve implementation quality **within** existing governance; they do not replace serial change control, branch→PR→CI, Owner-only approvals, confidentiality or release restrictions.
