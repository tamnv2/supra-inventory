## D171 single Owner-authorized scheduling exception — 2026-10-19

The current explicit Owner command pauses D170 without Owner PASS and prioritizes D171 diagnostic-only test artifacts. Keep D169 as the last Owner-accepted base; D170 production technical releases remain unaccepted but untouched. D171 is the sole actively edited change; D170 is paused and must be resumed for remaining OAuth/fleet/domain field gates afterwards. Only this exact exception supersedes the normal no-next-change-until-Owner-PASS scheduling rule; it grants no automatic exception to any later change. Use active D171 journal in the manifest/bootstrap. Preserve all branch→PR→CI, security, resource-scope and Stable safeguards.

# Repo-first discussion and Dxxx continuation protocol

**Authority class:** process policy for SUPRA Inventory only. **Owner instruction:** 2026-10-12, within still-open D167. This file does not grant implementation/release/Stable access. Public repo: no secrets, staff personal data, source Excel rows, device IDs or WMS session material.

## Why this exists

The earlier repo-first bootstrap preserved accepted decisions and runtime state but did not guarantee that an unfinished **discussion, candidate, counterproposal, technical finding, rejection, or next action** would survive a fresh chat. A new chat may also bootstrap `main` while the latest approved CODE-ONLY work exists solely in an **unmerged Draft PR**. This protocol closes those two continuity gaps with an append-only working ledger and an explicit accepted-vs-working authority split.

## Mandatory retrieval before a substantive Dxxx answer, including `tiếp tục Dxxx`

1. **Always fresh-read GitHub**: fetch `ops/authority-manifest.json` from `main`, consume its full `bootstrap_order` in declared order, including current Owner decisions, resource scope, work state, relevant source/CI and active-release evidence. Do not treat AI memory or prior chat handover as authority. If GitHub is unavailable, say **REPO_NOT_VERIFIED** and avoid decisions, CODE PASS, deploy claims and mutation based on guesses.
2. Determine current Dxxx, accepted base, and **unmerged working PR** from `ops/project-state.json`, `ops/owner-actions.json` and current GitHub open-PR metadata. Resolve an exact branch and HEAD SHA. If an Owner asks `tiếp tục D167`, inspect the current D167 PR/branch even if its latest changes do not exist on `main`. If the requested Dxxx is not current, retrieve its recorded closed/paused snapshot without opening a new change behind the Owner-PASS gate.
3. Fetch the **working-ref** `ops/authority-manifest.json` and consume its bootstrap order as well. Read `ops/change-continuity/Dxxx.json` at the same working HEAD SHA (if the file is missing, explicitly report the missing ledger; do not fabricate its contents). Check pending Owner commands, discussions, proposal states, blockers, test evidence, follow-up and intended no-deploy boundary. Inspect recent PR commit history / CI and actual relevant source to reconcile any stale field in the journal.
4. Present a **compact verified resume snapshot** before working: `Đã chốt | Đã xử lý và chứng cứ | Đang làm | Chưa chốt | Bị chặn | Bước tiếp theo | Ranh giới triển khai`. Use exact file/commit/PR evidence, separate `SOURCE_TEST_PASS`, `CODE_READY`, `RELEASE_PASS`, `FIELD_PASS` and `OWNER_PASS`. Old decisions remain traceable as `SUPERSEDED`. Never turn a proposal into Owner approval.
5. At any conflict: the **latest explicit Owner directive** has first priority; `main` is the accepted base, and an authorized active Draft branch records only its own **working** continuation. Branch state cannot silently redefine accepted runtime, expand resource scope or authorize merge/deploy. Halt on unresolved scope/security/approval conflict; record it.
6. Before each substantial Dxxx reply **when new content has been introduced**, persist its sanitized, complete semantic checkpoint via a GitHub commit on the Dxxx working branch (or other authorized change branch), then read back the resulting SHA/file. Include a pointer to the newest checkpoint in `ops/project-state.json` when the required status/next action changes. Do not answer `đã lưu` without a confirmed commit/readback.
7. If a turn is genuinely read-only and changes no decision, candidate, finding, blocker or task state, no duplicate commit is necessary. But substantive technical conclusions, new alternatives, rejections, corrections, test results, Owner commands and unfinished investigations **must** be written; not only accepted decisions. If there are too many linked threads, retain their individual IDs and full semantic context rather than a lossy one-paragraph recap.
8. GitHub cannot guarantee autonomous write access in every ChatGPT execution context. If repo write is unavailable, disclose **CHECKPOINT_NOT_SAVED**, provide the proposed short checkpoint in the reply, and **do not** misrepresent it as durable. Ask for access only when tool access genuinely cannot be restored; never fall back to pretending memory is synchronized.

## Durable two-layer record

| Authority layer | Canonical location | Meaning |
| --- | --- | --- |
| Accepted base / current release | `main` `ops/project-state.json`, `docs/OWNER_DECISIONS.md`, specs, real CI/deploy evidence | What Owner has accepted and what is actually released |
| Active Dxxx working memory | Open PR working HEAD; `ops/change-continuity/Dxxx.json`, current branch decisions/spec/state, PR/CI/code | Discussion/implementation progress not yet released, including rejected and open options |

**Required journal fields:**
- `change_id`, `source_repo`, `working_branch`, `pr`, `accepted_base`, `last_checkpoint`, `deployment_gate`.
- `entries[]` with unique immutable `id`, `date_vn`, `topic`, `kind` (`OWNER_COMMAND`, `DISCUSSION`, `PROPOSAL`, `DECISION`, `TECHNICAL_FINDING`, `TEST`, `BLOCKER`, `STATUS`), `status`, `owner_approval`, `facts`, `alternatives`, `open_questions`, `next_action`, `evidence` and `supersedes` where applicable. Omit empty optional arrays, not unverified constraints.
- `resume` state with explicitly separated `approved`, `implemented`, `in_progress`, `pending_approval`, `blocked`, `next_actions` and `release_boundary`. Do not mark GitHub CI PASS as field PASS.
- Append new entry when the subject changes or a decision/status shifts; **never overwrite history to pretend a disagreement never occurred**. Mark old entry as superseded via a new entry referencing its ID. Avoid redundant duplicate entries for no-op queries.

**Checkpoint write transaction (all on same working branch / PR):**
- Relevant Owner decision -> `docs/OWNER_DECISIONS.md` + affected spec/operating policy **and** journal entry.
- Proposal or unapproved discussion -> journal `PROPOSED`/`DISCUSSING`, **not** canonical Owner-approved spec.
- Code/CI/field evidence -> journal `TECHNICAL_FINDING`/`TEST`, working `ops/project-state.json` when state changes, link PR/head/run.
- Owner-only action -> `ops/owner-actions.json` when genuinely necessary, with no premature Owner PASS.
- Resource identity changes -> `ops/project-scope.json` + `ops/resource-registry.json` only on explicit Owner authorization.
- Verify JSON schema/CI and readback. On write conflict, refetch latest branch HEAD, merge **semantic entries**, not last-writer-wins overwrite. Never force-push, commit secrets, push main directly or merge unapproved runtime work.

## D167 resume example and current release gate

`Tiếp tục D167` => bootstrap `main` => discover **Draft PR #559** from active state/Open PR => fetch exact working HEAD => read `ops/change-continuity/D167.json` plus working decisions/spec/state/code/CI => print verified resume summary => carry out only already-authorized **CODE PASS** tasks. **STOP before merge, Beta/Stable deploy, Agent/Android release, OTA, WMS runtime automation or SKU catalog mutation** until a **new explicit Owner deploy decision**. Previously deployed PR #555 is a historical release fact, not an authorization to deploy PR #559.

## Confidentiality and practical limits

Store a faithful **technical/decision summary**, not raw chat transcripts, credentials, private files, emails, names, company-sensitive SKU/bin details or customer/employee data. Where private evidence exists, store only a non-sensitive evidence descriptor and verification status, not content. Repo is public. GitHub per-turn writes consume API/CI budget and create commits: minimize duplicate no-op writes, never omit new material information. Automated full chat-history ingestion cannot be guaranteed solely by repository instructions; the assistant must actually perform and verify each checkpoint using available GitHub tools.

## Verification

`tools/change_continuity_guard.py` enforces journal structure, current Dxxx pointer, latest release boundary, and repo-first manifest discovery on CI. Passing that guard proves **structural consistency**, not that every spoken sentence was captured, nor runtime/field correctness.

## Supersession 2026-10-12 — New Owner D167 full CODE READY Beta release

Latest Owner explicitly authorized only the registered Beta rollout of PR #559's CODE READY source following current-main integration and passing exact PR CI; the earlier CODE PASS ONLY instruction is superseded for this scope. Stable remains separately Owner-gated. The release receipt, continuity journal and state must agree. Never mark field/Owner D167 PASS from CI or GitHub channel publication.


## Current Owner clarification 2026-10-13 (overrides stale #559-only resume example)

D167-E046: MAIN-tab direct WMS credential-source work cancelled; existing same-profile hidden WebView2 child accepted. Other Agent problems remain under separate Draft PR #574/other discussion; Usage waits for logs; Launcher is separately managed. The repository contains the latest approved command semantics: `chạy code` runs full approved code/CI only, stops at CODE READY and reports; `duyệt triển khai` releases only the prepared approved scope; `chạy code và triển khai` / `triển khai luôn` completes code and immediately releases approved Beta after mandatory checks without a second midway approval. The old #559 CODE PASS-only example and earlier main-WMS-tab exploration are historical, not currently active requirements. D167 Owner PASS and Stable release remain separate.


## D168 activation after D167 limited Owner PASS (2026-10-13)

Historical D167 resume examples and the PR #559 CODE-READY-only hold above were superseded by later Owner-approved Beta releases and D167 PR #581 limited-as-deployed signoff. The **active** Dxxx is now `D168`, and the working journal is `ops/change-continuity/D168.json`. For `tiếp tục D168`, bootstrap the latest main manifest, full order, current PR HEAD and D168 journal; distinguish approved decisions, pending analysis, source/CI, release evidence and Owner field proof. Each newly introduced log result/request/proposal/decision requires sanitized repo checkpoint; log intake alone authorizes no Beta or Stable rollout. The accepted base is D167 Owner limited PASS, never retroactively upgraded to full physical/quota verification.


## D169 transition from Owner's limited D168 code PASS (2026-10-14)

The Owner explicitly limits D168 acceptance to code/as-deployed behavior with no further new reported issues at the time and opens D169 to collect new problems before a unified analysis. This supersedes the D168-active example above, **not** the serial-gate, repo-first, secret-redaction or no-deploy requirements. D168-E050 known defects stay uncorrected and cross-referenced. Current journal `ops/change-continuity/D169.json` is intake-only: new evidence and user discussions must be checkpointed on the current D169 branch; no automatic source fix or release follows from opening the change. Technical/pass/release/physical field and Owner scopes remain distinct; Stable is Owner-gated.


## D172-E018 — Owner-approved D172/D173 scheduling boundary (2026-10-22)

D172 is an independent, temporary dropped-goods app sharing ONLY existing Cloud identity/Worker/InventoryCore infrastructure with Inventory. Keep D172 open until the Owner explicitly closes it, even if D170/D171 have been closed. The Owner instructs that a **new, separately approved D173** may begin after D170 AND D171 are explicitly closed/settled by Owner, notwithstanding D172 pending. Do not infer D170/D171 accepted PASS from technical CI, and do not automatically open D173. D173 must use its own discussion/branch/PR/spec/state and must not modify D172 app, OBPP API/tables, sheet writer, records or open PR merely because it shares the physical Worker. This is an exact Owner scheduling exception, not general permission for additional parallel Dxxx work. Existing D172 owner-approved isolated role and mirror integration remains subject to model-wide auth impact review and source/release gates before mutation; Stable always OWNER-GATED.

## D170-E030 / D171-E084 / D172-E045 — Owner limited closure and independently held OBPP (23/10/2026)

Owner explicitly accepts D170 only for single public Production cutover and D171 only for published new model; D171's known vc117 FIELD FAIL and all unresolved log/usage/Office/ACK work (since 20 Oct) remain **OPEN_NOT_FIXED** with original provenance in `docs/D173_CARRYOVER_FROM_D170_D171_2026-10-23.md`. Never convert limited acceptance into full device/cloud field PASS. D170 legacy host and technical beta-named Production IDs are still live/compatibility-sensitive; shift audit is read-only, deeper tests and retirement separately gated after shift.

D172 is Owner-directed `PENDING/HOLD` isolated business workstream, without Owner field acceptance; its Worker/InventoryCore/Firebase physical sharing never grants D173 permission to touch OBPP Android/API/Core tables/Sheet or signing channel. Only D172-specific future approvals may change OBPP code. Future D173 can start **only after protected main records both limited D170 and limited D171 closeout** and a new D173 Owner-requested separate journal/PR/authority bootstrap. No automatic release, old-host deletion or cross-project provider writes. Preserve Stable OWNER-GATED.
