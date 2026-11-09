# D172-E060 — OBPP v10: Core deletes committed, Google Sheet deletion mirror backlog (09/11/2026)

## Owner FIELD FAIL and grounded live read-only evidence

Owner reports that signed OBPP v10 can hydrate Cloud history after E059 but selected-row deletion is reflected only on the PDA, while the Service/Google Sheet appear unchanged.

On the precisely registered D172 private Sheet (verified by SHA-256 identity, never publish its ID), read-only inspection at ~21:52–21:54 ICT established:

- `Ghi nhận Rớt` A:K still contained **173 business IDs**.
- `Nhật ký thao tác` A:G contained **80 unique `DELETE` audit refs timestamped 09/11/2026 21:42:22**, and all 80 refs remained in the business tab. A later read showed at least 94 matching `DELETE` audit refs from the same timestamp still present on the business tab.
- No real Sheet rows were written, deleted or modified by this audit. No user identifiers, record IDs, credentials or private Sheet ID are stored here.
- D172 `hardDelete` commits the record's removal, a tombstone, `AUDIT` event and `RECORD_DELETE` outbox intent in one SQLite `transactionSync`. Persisted `DELETE` audit entries arriving at Google are strong evidence the Core deletion path committed. Direct authenticated Core readback is still pending; do **not** claim independent FIELD PASS.
- The failure is observed at **Sheet mirror convergence**, not the E059 GET schema-readiness hotfix. Status at inspection time: **FIELD FAIL**.

## Source-verified usage/latency cause and unknown

- Existing `/obpp1291/outbox/claim` ordered all `AUDIT` and `RECORD_DELETE` writes by `created_at,event_key`. The same delete request produces **both** events; same-timestamp `AUDIT:` events sort before `RECORD_DELETE:` IDs, allowing large audit batches to consume the first claims and delaying business removal.
- A drain handles **up to 30 events** per invocation, so 100 deletes + 100 audits require at least **seven** successful invocations; on the regular five-minute cron, convergence can take tens of minutes even without errors.
- Existing Sheet deletion did one `deleteRange` Google write per row and re-read the physical business index for each, multiplying read/write requests and timeouts at 80–100 IDs.
- The precise HTTP response/status for pending individual `deleteRange` operations was **not available** in the read-only evidence; Google 4xx/429/protection is **not confirmed**. A real failure after optimization must surface a sanitized code, not guess.

## Scoped CODE-ONLY corrective candidate

1. Claim `RECORD_DELETE` then `LOCATION_DELETE` tombstones ahead of `AUDIT`, preserving all audit entries in the durable queue and not touching Inventory/D173 business.
2. Coalesce up to 10 same-kind deletes into **one Google Sheets `:batchUpdate` request**. Plan physical row ranges from the approved read index and apply bottom-up; limit writes strictly to `Ghi nhận Rớt` A:K or `Vị trí` A:E. Never use `deleteDimension`, never touch auxiliary columns or other tabs.
3. Re-index/verify that selected IDs are absent before acknowledging their durable tombstones. If Google fails, release/retry the group (including uncertain ACK); absent rows are idempotent no-op. Record a sanitized error code and item kind only, never IDs, content or credentials.
4. Retain the asynchronous audit trail, Core authoritative hard-delete semantics, local history, operation idempotency and current signed OBPP v10. No new provider, no Google Sheet data mutation under this code-only PR.
5. Run existing behavioral Sheet mocks plus new 80-delete batch, 429 retry, exact business-range/auxiliary isolation; D172 Backend + D173 shared regression + authority/continuity before requesting Owner-scoped Worker release.

No new Owner release approval is inferred from the earlier **E059 schema hotfix Worker-only** receipt. CODE/CI/RELEASE/FIELD/OWNER remain separate. D172 remains **PENDING/HOLD**.

## Follow-up READ-ONLY Sheet convergence, 22:05 ICT

An independent read-only recheck at ~22:05 ICT found **100 `DELETE` audit refs** from the 21:42:22 transaction and **135 business IDs** still in `Ghi nhận Rớt`, down from 173. Exactly **38 out of the 100 deleted IDs had disappeared from the Sheet** while **62 remained**. This confirms the existing Production asynchronous mirror can process deletion intents after a long queue delay; it does **not** prove a permanent Google API rejection. The proposed E060 priority + batching reduces this queue delay, not an invented Google 400/permission root cause.

Code-only candidate source CI on `03d8788e1497052611e0d4e1bb936d51cc9dbeb1`: D172 backend [42640980397](https://github.com/tamnv2/supra-inventory/actions/runs/42640980397) SUCCESS, shared D173 E123/D172 [42640980571](https://github.com/tamnv2/supra-inventory/actions/runs/42640980571) SUCCESS, Repo Authority [42640980353](https://github.com/tamnv2/supra-inventory/actions/runs/42640980353) SUCCESS, Project State [42640980358](https://github.com/tamnv2/supra-inventory/actions/runs/42640980358) SUCCESS. D173 E149/E109 historical D173-only release/isolation checks refuse D172 source as designed; they are not E060 release grants. No Production deployment under PR #883.
