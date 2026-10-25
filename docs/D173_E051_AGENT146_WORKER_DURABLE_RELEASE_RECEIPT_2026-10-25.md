# D173-E051 — Agent146 signed OTA and Worker durable DO telemetry release receipts (25/10/2026)

## Release evidence — separate scopes
### Agent146 (D173-E047/E048)
- PR747 merged into main `c4bf717df6eb001e245030fd3e3f6e65f30ba20d`.
- Exact source `29025210e7293251e5e0a0e1b6897c4e2942a0ab` 29/29 PR CI PASS.
- GitHub Actions `40212953786` completed SUCCESS.
- Immutable release `relay-agent-v146` points to main `c4bf717d...`. EXE size **8,686,080 bytes**, SHA-256 `4e6267ddc521570024ecc1adf6472863c78ebe36433a95a9d8937369a63e3fa6`.
- Existing `inventory-channel` EXE size/digest match signed release, `agent-latest.json` updated 2026-10-25T16:44:06Z.
- No Agent-owned Worker, Firestore, Android, D172 or historical Stable provider change during scoped Agent-only release. **FIELD/OWNER PASS false.**

### Existing Production Worker/InventoryCore (D173-E049/E050)
- PR748 merged main `1fd1da4f4d8febe0a9c0d937f022527e74c02315` using exact Owner marker `D173-E049_EXISTING_WORKER_RELEASE:`.
- Exact measured source `b1495fca67658743b95035cf554b82ac0aa22efb` **28/28 PR CI PASS**, including service TypeScript, Worker guard, D172 business isolation, email/Auth preservation and E049 SQLite restart unit fixture.
- GitHub Actions `40215387098` Deploy Beta Worker **SUCCESS**. Existing Worker `supra-inventory-beta`, official `inventory.supra.cc.cd`, `InventoryCore` SQLite and original Firebase identity retained. Action verified same-source official health and SQLite.
- New `d173_usage_counters` additive aggregate telemetry table (not business schema), 35-day retention; each measured DO route + each of 15 D166 SQL groups emits an extra synchronous aggregate SQLite UPSERT. SQL read/write rows and elapsed latency are recorded for allowlisted groups only, no raw SQL, SKU/user/token/session/payload.
- Python SQLite test run `40214693727` confirmed counters persist after DB close/reopen; local mock single-row write average **1.441 ms**, not Cloudflare production latency/billing.
- D172 source and private tables/API/OTA unchanged; D172 **PENDING/HOLD**. Worker physical resource is shared so future changes still require cross-domain negative tests.
- **FIELD/OWNER PASS false**. Real production billed Rows Written/CPU/DO latency/metric data coverage and any real Windows Agent146 flicker/titlebar/WMS behavior still require time-matched field evidence. Do not mark complete from source or workflow green alone.

## State boundary and remaining checks
- **CODE PASS:** both isolated PRs merged, no source remainder in these scopes.
- **CI PASS:** Agent146 29/29; Worker E049 28/28.
- **RELEASE PASS:** Agent146 signed tag+OTA checksum; Worker existing core source-pinned provider release and official health success.
- **FIELD PASS:** NOT YET; need real Windows screenshot/video, WMS/PRIMARY/Office/tray and >=24h of matched Worker metric totals versus provider billed usage, no D172 operational failures.
- **OWNER PASS:** NOT GIVEN; follow the explicit Owner acceptance gate.
- This E051 PR is **docs/state only**, must not retrigger Worker/Agent/Android/Firestore or modify D172; retain v145 and previous Worker source for scoped rollback.
