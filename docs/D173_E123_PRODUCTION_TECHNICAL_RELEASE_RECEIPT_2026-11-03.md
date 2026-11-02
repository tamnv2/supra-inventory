# D173-E123 — Production technical release receipt (03/11/2026 VN)

## Owner authorization and source identity
- Owner authorized production Worker/Web + bounded Firebase Rules + signed Windows Agent164 + Android vc124, in that order, through `docs/D173_E123_OWNER_PRODUCTION_SCOPE_2026-11-03.md` and `ops/d173-e123-release-authorization.json`.
- Source PR: [#828](https://github.com/tamnv2/supra-inventory/pull/828), **merged**, merge commit `aa1aac2fef476d4e3e67529801364be81097795f`.
- Source ancestor `6e80ea8a5401703b78129e0859de96be325e40ca`: 47 required GitHub checks SUCCESS, 0 FAILED, 14 event-inapplicable SKIPPED.
- Post-source docs/state-only head `10b374217c59004d1ee787fdf22f757c7b3e4fa1`: 46 SUCCESS, 0 FAILED, 14 SKIPPED. No executable source delta after tested ancestor.

## Live production receipts
| Component | Source / run | Verified outcome |
|---|---|---|
| Worker/DO/Web on `inventory.supra.cc.cd` | [Run 41539846650](https://github.com/tamnv2/supra-inventory/actions/runs/41539846650) | SUCCESS, official `/health` exact source and SQLite schema/storage readback PASS, auth/Web/Worker checks PASS |
| Existing bounded Firestore Rules (`DEFERRED` VPS CAS only) | [Run 41539846660](https://github.com/tamnv2/supra-inventory/actions/runs/41539846660) | SUCCESS, Rules release readback PASS, no new Firestore project/database |
| Signed Windows Agent v164 | [Run 41539846604](https://github.com/tamnv2/supra-inventory/actions/runs/41539846604), [release](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v164) | SUCCESS, signed prerelease tag points to exact release commit; EXE SHA-256 `eee710d83e67240199c6239d6c50668bf556f9da28d3e412a6dcfc4e396d95a8` |
| Signed Android vc124 | [Run 41539846648](https://github.com/tamnv2/supra-inventory/actions/runs/41539846648), [release](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc124) | SUCCESS, `beta-vc124` points to exact release commit; APK SHA-256 `ba21af7b5f0e03abebcde028e2760afa003d94dd4eb11689eb0506acbee03034` |
| Shared OTA/download channel | [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel) | Current EXE and APK asset SHA-256 equal their respective v164 and vc124 release assets; both manifests `agent-latest.json` / `pda-latest.json` published |

## Isolated non-release job
- [Gateway workflow 41539846624](https://github.com/tamnv2/supra-inventory/actions/runs/41539846624) **FAILED** at its inherited D167 gateway deployment authorization step. It was triggered because E123 edited `.github/workflows/verify-apps.yml`. E123 explicitly **does not authorize Gateway source/provider mutation**, so the gate correctly denied unrelated deploy; existing Gateway was not updated. This failure is **not** a Worker/Web/Firestore/Agent/Android release failure. Do not bypass or broaden Gateway authority.

## Meaning and next evidence
- `CODE PASS = true`; `CI PASS = true`; `PRODUCTION TECHNICAL RELEASE PASS = true` **for the four approved components**. The release was **not** installed or tested on the real PDA/Agent fleet by these GitHub workflows.
- `FIELD PASS = false`, `OWNER BUSINESS PASS = false`: verify live Picker 14:00/22:00 server-enforced logout/T-15 notice and re-login, Web presence, Agent roster/decision sync, ACK/HA/WMS behavior, actual same-shift cloud usage and latency before Owner acceptance.
- SQL `RECENT_ACK_TOTALS` was optimized and passed source SQL parity; lower billed DO Rows Read/Requests **is not yet proven** by matched live usage.
- D172 OBPP1291 remains independent `PENDING/HOLD`; Stable remains `OWNER-GATED`; Gateway and other out-of-scope provider assets unchanged.
