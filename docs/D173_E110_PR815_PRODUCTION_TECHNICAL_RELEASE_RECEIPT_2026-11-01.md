# D173-E110 — PR815 Production technical release receipt (01/11/2026)

## Authority and source

- Owner explicitly approved releasing PR815 after CODE READY confirmation; scoped authority `ops/d173-e110-release-authorization.json`, no Stable provider/resource changes.
- Tested E109 executable SHA: `6f1692bbb349dca3dad982368d8631727a7ed523`. Release preparation changed only source guards, GitHub workflows, tests, APK notes, docs/state; tested Service/Web/Android executable trees remained unchanged.
- Final PR815 candidate: `2daafcc8c575533636d4033025650eddb387eaa7`, **39/39 PR workflows SUCCESS** (including D172 regression, Android debug/build, D171 and authority).
- [PR815](https://github.com/tamnv2/supra-inventory/pull/815) merged by **merge commit**, not squash, preserving exact tested ancestry: `3135efaa98e0749247fd504995b095f1e6d467d2`. Merge marker `D173-E110_DO_OPTIMIZATION_RELEASE:` triggered the exact authorized release branch.

## Production technical result

| Component | Evidence | Technical result |
| --- | --- | --- |
| Existing Worker / InventoryCore SQLite / Web assets | [main Worker run 41325295079](https://github.com/tamnv2/supra-inventory/actions/runs/41325295079) | **SUCCESS**: deployed existing `supra-inventory-beta` for official `inventory.supra.cc.cd`, same merged source; `/health`, Root secret, storage/schema version 17, operational schema version 7, Web shell, auth and OAuth smoke steps SUCCESS |
| Signed Báo hàng Android | [main Android run 41325295010](https://github.com/tamnv2/supra-inventory/actions/runs/41325295010) | **SUCCESS**: signed build, [`beta-vc122`](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc122) published, release target exact merged SHA; `inventory-channel` APK, SHA-256 and `pda-latest.json` replaced on 01/11 at 16:16:34 UTC |
| Existing Agent | Agent release workflow | **SKIPPED BY DESIGN**; Agent v162 source/tag and channel assets were not republished |
| Firestore rules | Firebase Firestore release workflow | **SKIPPED BY DESIGN**; no Rules update |
| Agent operations Gateway | Gateway workflow | Source verification SUCCESS; provider deploy step SKIPPED |
| D172 / OBPP | PR source regression | Independent tests PASS; no D172 business code, APK or Sheets mutation; **PENDING/HOLD** |
| Historical Stable | Scope/guard | **NO DEPLOY**, still OWNER-GATED |

## Non-blocking but outstanding CI signal

[GitHub run 41325293785](https://github.com/tamnv2/supra-inventory/actions/runs/41325293785) is a failure for `.github/workflows/d173-email-sender-guard.yml` on main push, with **zero jobs instantiated**. It is distinct from the successful Worker/APK release runs and does not establish an Email delivery failure. Treat as **CI WORKFLOW CONFIG INVESTIGATION PENDING**, not overall main push CI pass; do not infer sender functional PASS. Any workflow repair requires an independently scoped source/CI change.

## Acceptance remains open

- **CODE:** PASS. **PR CI:** PASS (39/39 before merge). **RELEASE technical:** PASS for Worker/Web and signed vc122/OTA.
- **FIELD:** not yet proven on live PDA fleet, actual session/realtime, p50/p95/p99 or 1,000-operation matched workload. Do not claim all installed clients updated.
- **COST:** reduction in DO billing and unchanged latency/availability remain unmeasured in production. Do not infer monthly savings.
- **OWNER PASS:** not recorded, D173 remains open. D172 remains independently PENDING/HOLD.
- **Rollback:** if observed instability, prioritize scoped disable of negotiated command WS using existing `D173_COMMAND_TRANSPORT_DISABLED` support or guarded rollback to verified pre-release Worker `f15b9675b7de33194dbb43980fd5934ee09958fc`; do not touch SQLite/D172 or silently revert signed client identity. Rollback requires explicit incident review and resource/source verification.

All evidence is release metadata and CI; no unverified physical field statement is made.
