# D172-E060 — OBPP end-to-end delete Worker-only technical release, 09/11/2026

## Owner approval

Owner explicitly instructed and approved complete deletion flow on current signed OBPP v10: local PDA → authoritative InventoryCore Service → Google Sheet, plus Worker Production deployment. Authorization ref `OWNER_20261109_D172_E060_END_TO_END_DELETE_FIX_APPROVAL`; receipt `ops/d172-release-authorization.json#e060_obpp_sheet_delete_mirror_release`; reviewed source pin `a226645f4b29ded2f0f0e8b4f2ed1800ef395e68`.

## Actual incident and evidence (no synthetic writes)

- Owner: OBPP v10 authenticated Cloud history GET works after E059; deleting a 100-record batch removed local history but the Google business rows remained.
- The registered private Sheet identity was verified by matching its SHA-256 ID digest against the D172-only fingerprint in `service/src/obpp1291-sheets.ts`. All observations were strictly read-only; no real ID or private Sheet locator is stored in this public repository.
- At 21:42:22 VN, 100 `DELETE` events were recorded in `Nhật ký thao tác`; 100 corresponding business IDs remained initially in `Ghi nhận Rớt`. At ~22:05 VN 38 had disappeared and 62 remained, proving slow asynchronous mirror drain.
- A **second read-only live check before the E060 Worker release** proved the **same 100/100 deleted business IDs had fully disappeared** from `Ghi nhận Rớt`, with `DELETE` audit entries preserved. This is evidence the *old* mirror eventually converged and E060 targets the excessive delay. **Do not attribute this pre-release 100/100 convergence to the E060 code.**
- No authenticating Core credential or Owner PDA field was available to independently query post-release fresh /records and execute a new delete. Do not mark new-release end-to-end FIELD PASS from this evidence alone.

## Reviewed scoped corrective code

- `service/src/obpp1291-core.ts`: order durable `RECORD_DELETE` / `LOCATION_DELETE` outbox items before delayed `AUDIT` records. Keep audit persistence unchanged.
- `service/src/obpp1291-sheets.ts`: group up to 10 same-kind deletes into one physical row-ordered (bottom-up) Google Sheets batchUpdate, constrained to D172 business ranges A:K or A:E. Re-read the physical business index and verify all targeted IDs absent before Core ACK; uncertain Google errors are released/retried and a safe class code logged without IDs or row content.
- `tests/d172-e014-obpp-sheet-contract.test.mjs`: mock actual 80 tombstones mixed with 80 audit events, confirms only 8 Google write requests for 80 deletions (10 each), next audits retained, Google 429 retry, duplicate tombstone idempotency and auxiliary-column invariants.
- Existing signed OBPP v10 already removes its local cache **only after authoritative Core ACK**. Do not introduce false offline/local-only business delete. Core hard-delete and its durable Google tombstone remain transactionally linked.
- No signed OBPP v11, no Firebase Rules, no D173 business Web/Agent/Android, no new Cloudflare resources, no Stable mutation and no direct manual Google Sheet write.

## CI and Production release evidence

| Check | GitHub evidence | Status |
|---|---|---|
| D172 Backend exact PR HEAD | https://github.com/tamnv2/supra-inventory/actions/runs/42644276059 | PASS |
| Shared D173 E123 / D172 safety | https://github.com/tamnv2/supra-inventory/actions/runs/42644276108 | PASS |
| Repo Authority Guard | https://github.com/tamnv2/supra-inventory/actions/runs/42644276100 | PASS |
| Project State Guard | https://github.com/tamnv2/supra-inventory/actions/runs/42644276128 | PASS |
| Owner-scoped PR | https://github.com/tamnv2/supra-inventory/pull/883 | MERGED |
| Protected main source | `07da381aba617644d90df1f72651fc2bd5876b68` | MERGED |
| Exact-source gate log | `D172_E060_OWNER_PINNED_WORKER_ONLY_END_TO_END_DELETE_PASS a226645f4b29` | PASS |
| Existing Worker Production | https://github.com/tamnv2/supra-inventory/actions/runs/42644816525 (job `129255117805`) | SUCCESS |
| Existing Worker health/SQLite + dual host | same run, `D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS`; D146 source PASS | PASS |
| Signed D172 OBPP OTA workflow | https://github.com/tamnv2/supra-inventory/actions/runs/42644816471 | SKIPPED BY WORKER-ONLY MARKER, v10 retained |

## Outstanding FIELD gate

Technically **CODE PASS, scoped CI PASS, Worker RELEASE PASS**. Current D172 E060 behavior has not yet been observed on a *new, post-release deletion* from a legitimate signed v10 PDA, followed by authenticated Core GET and read-only registered private Google business-ID absence. That evidence is required before FIELD PASS. Owner PASS remains false until explicit approval. D172 stays **PENDING/HOLD** independent of Báo hàng D173 and separate Stable Worker.
