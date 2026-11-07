# D172-E055 — Signed OBPP v9 technical release receipt (07/11/2026)

## Scope and authorization

- Owner said **"Triển khai apk đi"** on 07/11/2026, in D172 independent dropped-goods app thread. This authorizes D172-E053 Worker Core support and separate signed OBPP Android, not Inventory Web/Android/Agent, Firebase Rules, Stable or new provider.
- Candidate PR [#852](https://github.com/tamnv2/supra-inventory/pull/852), scoped release authorization `ops/d172-release-authorization.json#e053_duplicate_confirm_history_release`; reviewed source pin `7062c1189032e54177ffbca4f773ce76e8fb636b`. Protected merge title `D172-E053_RELEASE:`.
- Protected GitHub merge commit: `4b8654421b1a73e1a39f87c504bdc144e268f6f5`. D172 remains `PENDING/HOLD`; no inferred FIELD/Owner acceptance.

## Exact release evidence

| Stage | Verified receipt |
|---|---|
| E053 source tests | D172 Backend [42315219029](https://github.com/tamnv2/supra-inventory/actions/runs/42315219029) SUCCESS; D172 Android code-only [42315219006](https://github.com/tamnv2/supra-inventory/actions/runs/42315219006) SUCCESS; shared D173 E123 regression [42315218994](https://github.com/tamnv2/supra-inventory/actions/runs/42315218994) SUCCESS; Project State [42315219070](https://github.com/tamnv2/supra-inventory/actions/runs/42315219070) SUCCESS; Repo Authority [42315219092](https://github.com/tamnv2/supra-inventory/actions/runs/42315219092) SUCCESS |
| Existing Worker release | [run 42315908520](https://github.com/tamnv2/supra-inventory/actions/runs/42315908520), job 128228314679, completed SUCCESS: source/Owner gate, Cloudflare Worker+Web assets/SQLite deployment, official/legacy mapping, /health SHA/schema, scoped auth and OAuth probes |
| OBPP standalone signed release | [run 42315908336](https://github.com/tamnv2/supra-inventory/actions/runs/42315908336), job 128228313943, completed SUCCESS: Owner release gate, exact merged Worker /health SHA and OBPP status `READY + SCOPED_CONNECTED`, negative unregistered login 401, existing keystore validation, signed Gradle test+APK, isolated GitHub Release + mutable OTA manifest |
| GitHub signed tag | [obpp1291-v9](https://github.com/tamnv2/supra-inventory/releases/tag/obpp1291-v9), release asset `obpp1291.apk`, published 2026-11-07T00:06:39Z, target main SHA `4b8654421b1a73e1a39f87c504bdc144e268f6f5` |
| APK asset digest | 6,158,400 bytes; SHA256 `440e1cb2fe4662f211dab33a8a54688193267e72a1b526a69427c9e022e2afbd`; GitHub release asset content digest readback |
| Mutable OTA channel | `obpp1291-latest` asset `obpp1291-latest.json`, metadata updated 2026-11-07T00:06:40Z, 274 bytes, SHA256 `93cd032bbc1f7abf9e8f6902bc722ef4b1b9ba85c2c087d6e936bb45043ed6a4`; signed workflow publish step SUCCESS. Payload independently downloaded from OTA endpoint: **NOT VERIFIED** |

## Known CI context

The optional historical `D173 E109 DO optimization code only` workflow run [42315218957](https://github.com/tamnv2/supra-inventory/actions/runs/42315218957) FAILED in `tools/d173_e097_release_gate.py --component worker --preflight` because `BUSINESS_OR_D172_DRIFT`. This is the expected *D173 immutable D172* gate when a D172 PR intentionally changes isolated OBPP source, not a missing D172/backend test. Do not record "all CI green". The protected PR merge was accepted, and required D172, shared D173 E123, authority/state source checks passed.

## Remaining field checks

- Confirm OTA manifest actual JSON payload and source SHA/sha256 on device; confirm MT90/DT50 update v8→v9 with existing signer and package.
- Legitimate user tests: normal DO, duplicate DO → `Bỏ qua` no write / `Xác nhận` inserts distinct record, Google Sheet A:K mirror and audit, History search by MCH/DO/vị trí with keyboard and no extra requests beyond debounce; no synthetic production records.
- FIELD PASS = false; OWNER PASS = false until explicitly attested. D172 stays PENDING/HOLD independently of D173; Stable OWNER-GATED.
