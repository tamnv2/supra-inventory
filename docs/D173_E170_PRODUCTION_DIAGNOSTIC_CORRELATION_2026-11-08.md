# D173-E170 — Owner authorizes complete diagnostic collection / Production (08/11/2026)

## Owner decision
Owner explicitly requested: "Triển khai bổ sung đi, cần cập nhật production thì ok. Hãy thực sự xử lí để có thể có đầy đủ thông tin phân tích." This extends CODE-only E169 with a bounded, Owner-approved **Production release** for existing Worker/InventoryCore diagnostic reads, GitHub 05:30 analysis, and separately signed Agent175 error telemetry. Only Worker and Agent binary are eligible for new release. No Android APK change, Web UI change, Firebase Rules/provider resource mutation, business/HA/Confirm changes, external log exfiltration, or Stable change.

## Concrete implemented data path
1. Existing D173 SQL audit HMAC endpoint `GET /api/internal/d173/sql-evidence?mode=DAILY_EVIDENCE&day=YYYY-MM-DD` reuses the fixed, existing `D166_CF_READ_TOKEN` HMAC, timestamps <=90 seconds skew. It accepts only 35-day-or-newer complete VN business-day windows (05:00 to next 05:00).
2. Existing InventoryCore SQL table `d173_usage_counters` is read once on 05:30 report, returning fixed route/query hourly aggregates only, capped 2400 rows. No hourly DO polling or new business event SQL write.
3. Existing `runtime_log_buffer` is read once per 05:30 daily report for WEB/ANDROID staged vs Drive-receipt/late counts, split by `generated_at` hour, not `received_at`; no identifiers/content returned.
4. Existing scoped Drive OAuth lists at most 3 existing VN day folders under the registered log root, at most 5 pages/folder and 24 Agent logs for a bounded sample of error/HA classifications. Names/file IDs/UIDs/tokens/raw logs stay inside the Worker runtime. Apps Script-created Agent files may **not** be visible to the Worker OAuth client; if so the report explicitly says `PARTIAL` / `UNVERIFIED`, and the Owner connector manual read does not prove the production Worker can read them.
5. Existing 05:30 GitHub collector sends exactly one additional signed GET, joins 36 existing Provider metrics vs scoped Service/Drive evidence for *the same completed window*, and saves anonymized JSON/Markdown dated artifacts. DO billed values are Cloudflare account-shared, not equal to InventoryCore route counters. No synthetic 100% coverage or root-cause PASS.
6. Agent175 adds error-only firestore/RTDB/HA clocks/claim presence logging to existing delivery schedule without any extra listener, polling, heartbeat or provider charge. Agent174 installed units must upgrade before logs can contain new E169 codes.

## Safety limits / open evidence
- New daily evidence collection is once per report, **not** additional periodic polling, new Provider resource or storage table. It may consume one Worker request + a bounded DO/Drive read once daily, and therefore is low usage, **not literally zero**.
- Only sanitized aggregate/enum data may leave existing Drive/Worker. Per-source missingness tracked with statuses.
- Reports cannot prove the cause of Firestore PermissionDenied without comparing actually deployed Rules and authenticated claim/query evaluation.
- New code cannot retroactively reveal the cause of events before its Agent/Worker deployment; 3 representative post-deploy days preferred for operational causal conclusion.
- Release requires strict E170 receipt, exact pinned CI, TypeScript, SQL parity, native Agent175, existing shared Worker business regression and GitHub protected branch. Production Worker same-SHA health must pass before Agent175 signed OTA. Native Host13 unchanged. Android remains vc127 and Web UI remains 3.3.4.
- Stages recorded independently: SOURCE / CI / RELEASE / FIELD / OWNER / CAUSAL_EVIDENCE. Never infer later stages automatically.

## Release decision
APPROVED_PRODUCTION: existing Beta/official-host Worker and signed Agent175. At initial staging: PR #873 Draft, CI/release pending. Final proof to be appended only from actual GitHub Actions runs, health readback and provider evidence.

## Exact source CI evidence — 08/11/2026

- PR #873 source SHA: `5f2a467963aa859d25c3277bc58e1f5b39389165`.
- All current-head GitHub Actions complete: **45 SUCCESS, 0 FAILURE, 2 SKIPPED** (non-applicable), including native Windows Agent, daily usage Python/Node tests, Worker typecheck and SQL/HA functional parity.
- Owner release receipt now pins this SHA and passes strict E170 source gates. Production deployment still separately pending protected merge and provider health.
