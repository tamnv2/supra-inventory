# D173-E123 — Production technical release receipt (03/11/2026 VN)

## Exact source and protected merge

- Owner-approved D173-E123 source PR [#828](https://github.com/tamnv2/supra-inventory/pull/828) merged using **merge commit** (not squash) with protected marker `D173-E123_OWNER_PRODUCTION_RELEASE:`.
- Main/production source SHA: `aa1aac2fef476d4e3e67529801364be81097795f`; reviewed executable source ancestor `6e80ea8a5401703b78129e0859de96be325e40ca`.
- Latest docs/journal correction head `10b374217c59004d1ee787fdf22f757c7b3e4fa1`: 46 SUCCESS, 0 FAILED, 14 skipped event-inapplicable checks. Source-only reviewed commit: 47 SUCCESS, 0 FAILED, 14 skipped. After that executable service/web/android/relay-agent/firebase trees were unchanged.
- Same existing Production Worker/DO/SQLite and Web on `inventory.supra.cc.cd`. No Stable, OBPP/D172 standalone, Gateway, new provider resources or database recreation in approved release.

## Exact main release workflows — independently verified GitHub SUCCESS

| Component | Main workflow | Result |
| --- | --- | --- |
| Worker/Web/InventoryCore DO | [Deploy Beta Worker #41539846650](https://github.com/tamnv2/supra-inventory/actions/runs/41539846650) | **SUCCESS**, source-guard, deploy, official `/health` + SQLite schema 17 / storage, auth and shell smoke success |
| Existing Firestore Rules narrowly permitting owner-authorized VPS `DEFERRED` | [Deploy Beta Firestore Relay #41539846660](https://github.com/tamnv2/supra-inventory/actions/runs/41539846660) | **SUCCESS**, exact E123 Rules gate + Rules Management API deploy |
| Signed Agent v164, same registered `inventory-channel` | [Verify Beta Relay Agent #41539846604](https://github.com/tamnv2/supra-inventory/actions/runs/41539846604) | **SUCCESS**, Worker/Rules dependency proof and signed [relay-agent-v164](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v164) EXE/checksum assets published |
| Signed Android vc124, same existing update channel | [Verify Beta Android #41539846648](https://github.com/tamnv2/supra-inventory/actions/runs/41539846648) | **SUCCESS**, Agent164 dependency proof and signed [beta-vc124](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc124) APK/checksum assets published |

Agent v164 tag ref matches `aa1aac2fef476d4e3e67529801364be81097795f`; Android vc124 target commit matches that SHA. The client release assets were published, but installed versions on physical Windows/PDA and fleet OTA uptake were **not physically verified**.

## CI-only correction for unrelated Gateway workflow

The E123 merge's unrelated [Gateway main workflow #41539846624](https://github.com/tamnv2/supra-inventory/actions/runs/41539846624) ran because `.github/workflows/verify-apps.yml` is a legacy Gateway trigger. Its Gateway **deploy job FAILED at the existing D167 Owner release gate**, **before** CLI setup, Apps Script push or deployment; no Gateway mutation occurred. This is appropriate fail-closed behavior, not a failure of the four E123 authorized release jobs.

The follow-up docs/CI-only PR corrects the Gateway job `if` to explicitly skip the E123 production marker and the docs/CI receipt marker; it makes **no change to Gateway business source, registered script or provider**. The historic workflow failure cannot be retroactively converted to SUCCESS and must remain visible in the evidence.

## Acceptance boundaries

- **D173-E123 CODE / SOURCE CI / Production RELEASE TECH: PASS**, exact protected source/merge/run receipts above.
- **FIELD: PENDING** (real Agent/PDA installation, 14:00/22:00 server-enforced Picker cutoff, T-15 warning, overtime re-login, cross-Agent CAS convergence, WMS ACK/HA, Web presence).
- **BILLING/USAGE: PENDING** comparison of equivalent logical workloads and p50/p95/p99; no assertion yet that DO Requests or Rows Read achieved a numeric saving.
- **D173 overall OWNER PASS: PENDING** and requires Owner's explicit actual-field acceptance. D172 independent PENDING/HOLD; historical Stable OWNER-GATED.
