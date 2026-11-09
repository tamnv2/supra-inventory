# D172-E059 — OBPP v10 HTTP 500 Worker-only technical release receipt (09/11/2026)

## Owner authorization / isolation

- Owner explicitly approved continuing the scoped Worker-only hotfix: "Anh đồng ý phê duyệt, tiến hành xử lí cho anh".
- Only existing data-bearing `supra-inventory-beta` Worker / InventoryCore is authorized. The deployed corrective code adds `obpp_record_changes` and `obpp_records_page_idx` to the existing schema-readiness fast-path required objects, allowing the existing idempotent OBPP initializer to run for pre-v10 databases. No new Worker, new provider, Stable promotion, signed APK, Web UI, Agent, Inventory Android, Firebase Rules or Sheet business edit.
- Source-review pin `c4380eb1eeebb09e767b0d0ba66444fec834ce9c`, baseline main `4a7d84d41ded6d6fba14b3f0320efe9350c5f1e3`, Owner receipt `ops/d172-release-authorization.json#e059_obpp_v10_http500_worker_hotfix`.

## Required PR CI

- [D172 isolated Backend 42636191488](https://github.com/tamnv2/supra-inventory/actions/runs/42636191488) — SUCCESS.
- [D173 shared E086 / D172 42636191906](https://github.com/tamnv2/supra-inventory/actions/runs/42636191906) — SUCCESS.
- [D173 shared E123 / D172 42636191355](https://github.com/tamnv2/supra-inventory/actions/runs/42636191355) — SUCCESS.
- [Repo Authority 42636191598](https://github.com/tamnv2/supra-inventory/actions/runs/42636191598) — SUCCESS.
- [Project State 42636191143](https://github.com/tamnv2/supra-inventory/actions/runs/42636191143) — SUCCESS.
- Legacy D173-only E149 immutable-D172 guard failed when examining an explicitly D172-owned change; this does not pass the D173-only isolation gate and is not represented as all CI green.

## Protected merge and runtime receipt

| Stage | Evidence |
|---|---|
| Source PR | [#881](https://github.com/tamnv2/supra-inventory/pull/881), merge commit with exact `D172-E059_WORKER_ONLY:` prefix |
| Protected main merge | `e5592d2ec3c091dcfc167963dd39ed5cf310922b` |
| Worker Production deploy | [run 42636864170](https://github.com/tamnv2/supra-inventory/actions/runs/42636864170), job 129227215730, completed SUCCESS |
| Scoped release gate | `D172_E059_OWNER_PINNED_WORKER_ONLY_OBPP_SCHEMA_REPAIR_PASS c4380eb1eeeb` |
| Shared D146 source | `D146 source contract PASS` |
| Cloudflare live Worker | Deploy step SUCCESS, Worker health/Root secret/SQLite step SUCCESS, dual-host `D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS` |
| Signed OBPP OTA | [run 42636864371](https://github.com/tamnv2/supra-inventory/actions/runs/42636864371) SKIPPED by Worker-only marker; `obpp1291-v10` remains the latest release, no v11 |

## Acceptance boundary

**CODE, scoped CI and Worker technical RELEASE PASS. Authenticated OBPP /records, /records/changes on a legitimate PDA v10 and end-to-end local Cloud history sync are NOT independently field-verified.** Generic /health can prove the Worker source/SQLite is healthy without proving a valid account's records load successfully. Do not record FIELD PASS or Owner PASS until actual PDA evidence.

No production synthetic record or Sheet write was performed in this check. The additive schema guard must not be rolled back by dropping the change journal. D172 stays **PENDING/HOLD** until separate explicit Owner closure; D173 and Stable remain independent.
