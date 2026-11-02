# D173-E115 — Owner-approved backlog and PR cleanup (02/11/2026)

## Authority and limits
Owner explicitly approved the full cleanup proposal on 02/11/2026, including closure of the 19 then-open PRs without merging their stale source, and recorded the decisions below. This document is an **owner decision/administrative cleanup only**, not an application code change, production deployment, field test or a new Dxxx workstream.
- Canonical repository: `tamnv2/supra-inventory`; production technical release: D173-E114, Agent163, signed Android vc123 and same-source Worker/Web.
- **No** Worker/DO, Web, APK, Agent, Firestore, WMS, Cloudflare provider, signing channel, data migration, Stable release, secrets, or D172 business change.
- Historic release receipts must be retained. Existing binaries, SQL schemas and app function remain unchanged.
- D172 (OBPP1291) is **independent, PENDING/HOLD** until its own explicit Owner closure. Do not rewrite its release/field results.

## Owner-cancelled work: not an open backlog
1. Agent «Hoạt động gần nhất» (Agent last activity; E105/PR803)
2. Slow PDA session resume (historical D171-BL-06)
3. 30/10 Agent PickList ingress incident follow-up
4. Web background Presence candidate PR814 — main already contains a visibility check; do not import unapproved extra single-flight delta
5. 36 Cloudflare/Firebase provider-metric probe PR755
6. Five-minute Usage probe / consolidated metrics PR771
7. DO diagnostic phase-2 probe PR773
8. Old bundled DO/Agent-PDA optimization draft PR794. **This cancellation does not cancel the separate 02/11 DO-request anomaly investigation**; also preserve only the independent Agent↔PDA analysis scope below.

Cancellation means **stop tracking and do not implement old PR candidate code**. Do not roll back already-released behaviors. Historic evidence stays available in GitHub history; it is not an instruction to re-open.

## Analysis only — retained
1. PDA Picker server-authoritative logout at 14:00/22:00 VN. No CODE/CI/RELEASE approved.
2. Agent↔PDA confirmation integrity, HA/ACK/retry/WMS reliability. New analysis must re-baseline on latest released source; E099's eighteen historical proposals are *not* automatically approved to code or deploy.

## Ten prior operational issue groups — OWNER PASS
Owner explicitly confirmed **PASS by Owner attestation** for the ten groups listed in the 02/11 status review:
1. Reporter pending/overdue badge/count/flicker
2. Picker overlay outside app/background
3. Reporter SKU/name and state-edit presentation
4. Web/PDA tab/filter/scroll preservation under realtime
5. Recurrence/VN date boundaries
6. Agent PickList HA/recovery verification group
7. Agent Usage N/A/source/forecast presentation
8. SQLite_NOMEM / HTTP 500 historical incident follow-up
9. No-reply transactional email operational verification group
10. Gmail/Drive OAuth end-to-end group

**Acceptance classification:** OWNER_ATTESTED_PASS for the historic reported items, not synthetic technical/provider/device evidence, not a blanket D173 OWNER PASS, not a guarantee against future regressions. Reopen only on a new Owner-reported fault.

## Mail: functional attestation is not CI completion
Owner additionally stated no-reply mail is OK/PASS. Record as an **Owner functional attestation** without inferring exact four-template delivery test scope from that statement.
`.github/workflows/d173-email-sender-guard.yml` still reports a **zero-job failure on push** (e.g. run 41358423418). That workflow checks source constraints, email transport mocks, typecheck and D172 isolation; a zero-job error does **not** execute those checks and cannot become CI PASS from a mail field attestation.
CI repair: **separate, scoped, owner-gated change**; verify GitHub YAML/actionlint, create real job and record green result. Do not modify sender configuration or send real OTP to fix CI.

## Nineteen PRs approved to close without merge (state as of 02/11)
| PR | Disposition | Why not merge into current main |
| --- | --- | --- |
| 821 | CLOSE_SUPERSEDED | E114 signed Agent163/APK123 production receipt already exists on main |
| 814 | CLOSE_CANCELLED | visibility check already on main; Owner rejects remaining Web candidate |
| 803 | CLOSE_CANCELLED | last-activity docs-only investigation withdrawn |
| 794 | CLOSE_CANCELLED | bundled historic DO/Agent-PDA proposals not a release candidate; new analysis separately scoped |
| 773 | CLOSE_CANCELLED | read-only DO phase 2 diagnostic withdrawn |
| 771 | CLOSE_CANCELLED | old Usage 5-min prototype withdrawn |
| 755 | CLOSE_CANCELLED | 36-metric provider probe withdrawn |
| 749 | CLOSE_SUPERSEDED | Agent146 historic technical receipt, current Agent163 |
| 735 | CLOSE_SUPERSEDED | old E030 YAML diagnosis, active zero-job workflow issue persists separately |
| 726 | CLOSE_SUPERSEDED | stale D173 phase-1 A+C+log B code candidate; phase 1 later released |
| 721 | CLOSE_SUPERSEDED_D172 | E048 independent D172 Sheet writer already technically released; D172 remains HOLD |
| 720 | CLOSE_SUPERSEDED | stale phase 1 pre-release candidate |
| 717 | CLOSE_SUPERSEDED | old Reporter roster/telemetry candidate; source updated by subsequent release |
| 716 | CLOSE_UNUSED | optional Archify research prototype not used for operational runtime |
| 715 | CLOSE_SUPERSEDED | Reporter read-only online code exists in main |
| 714 | CLOSE_SUPERSEDED | Reporter diagnostic test/code subsequently integrated |
| 713 | CLOSE_DUPLICATE | 20–23/10 usage-daily evidence already on main |
| 708 | CLOSE_SUPERSEDED | historical official-domain control-plane candidate, new releases/guards exist |
| 666 | CLOSE_SUPERSEDED_D172 | obsolete signing-secret-name PR; never merge old signing workflow over currently published OBPP; retain D172 HOLD |

Close PRs with explicit non-merge resolution. Deleting old head branches is **not** part of this first administrative pass: first verify refs needed by signing releases, receipts and current workflows. Delete only owner-approved, proven-unreferenced branches in a later isolated cleanup. Keep audit/history evidence and signed release/tag artifacts.

## State and safety criteria
- All 19 PRs CLOSED with `merged=false`; no code from these PRs enters main.
- Latest release must remain E114 Agent163 / Android vc123 / Worker-Web; no binaries or provider configuration changed.
- Owner attested the ten historic issues; D173 as a whole is not automatically OWNER PASS.
- Mail guard CI remains FAILED/REPAIR_PENDING until a real CI run succeeds; operational no-reply attestation is separate.
- D172 remains PENDING/HOLD independent; Stable remains OWNER-GATED.
- All state, continuity and derived handover changes must land on an owner-scoped docs-only PR with GitHub CI checks, not by direct main edit.
