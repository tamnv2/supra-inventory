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

## E171 technical release recovery — 08/11/2026

Protected PR #873 merged main `e3958d3258ca3ed09a602a1fe1fbbe1050dbd4a3` under original E170 Owner-approved Production marker. Worker deployment run [42481347461](https://github.com/tamnv2/supra-inventory/actions/runs/42481347461) SUCCESS, official /health HTTP200 source exactly `e3958d3258ca3ed09a602a1fe1fbbe1050dbd4a3`, SQLite schema 17/17, missing bindings 0. Existing 05:30 read-only usage workflow run [42481347481](https://github.com/tamnv2/supra-inventory/actions/runs/42481347481) SUCCESS, but *provider data collection success does not prove complete device log correlation*.

Signed Agent175 release run [42481347446](https://github.com/tamnv2/supra-inventory/actions/runs/42481347446) FAILED at Owner gate on Windows before build: Python 3.12 `UnicodeDecodeError: 'charmap' codec can't decode byte 0x90` while reading UTF-8 Agent source through locale-default `Path.read_text()`. Agent175 tag/OTA NOT RELEASED; Agent174 remains previous published tag. Run #42481347522 (Firestore Rules) correctly failed historical D167 Owner gate because E170 forbids provider Rules mutation and is **not** a scope requirement. Historical D170 compatibility gate #42481347458 failed unrelated old fixture, not proof that E170 Worker is unhealthy.

E171 PR #874 is limited to explicit UTF-8 decoding of the existing E170 Owner Agent/Worker release gate plus a contract regression, with continuity/receipt updates. Existing Owner's E170 Worker+Agent175 release authorization is reused; no new feature or Provider authorization. The original E170 source-CI pin remains valid for unchanged business runtime, but a *new exact-source CI pin for the UTF-8 gate* is required before an E171 protected merge. No release claim until actual new GitHub Actions Worker same-source health and signed Agent175 OTA success; FIELD/Owner/causal attribution remain pending.

## E171 exact-source CI evidence — 08/11/2026

- Recovery source SHA `22e433cb0b8300ed079b9181c791975ae6cba443`: **21 SUCCESS, 0 FAILURE**, including Windows Agent native compile, UTF-8 release-gate contract, authority/continuity, 05:30 source safety.
- Original E170 code SHA `5f2a467963aa859d25c3277bc58e1f5b39389165`: **45 SUCCESS, 0 FAILURE, 2 SKIPPED**, preserving earlier Worker/SQL/HA/business full CI.
- Strict dual-pin E170 release gate allows only `tools/d173_e170_release_gate.py` and `tests/d173-e170-daily-evidence.test.mjs` to change in protected source after original pin. It also checks no runtime source change since already-deployed main `e3958d3258ca3ed09a602a1fe1fbbe1050dbd4a3`; the E171 pin must be ancestor and no protected source can change after it.
- **Status:** release remains PENDING until actual new Worker health and signed Agent175 OTA/channel receipts. FIELD and log coverage remain UNVERIFIED.

## E172 exact-commit recovery — 08/11/2026

- E171 PR #874 merged using squash as main `2cc0cbb93a57f38ed72c986dd8a3188edb847a96` despite **21/21** source checks. The squash changed commit ancestry and the strict E170 Agent release gate correctly DENIED `RECOVERY_CI_PIN_NOT_ANCESTOR`, run [42484797982](https://github.com/tamnv2/supra-inventory/actions/runs/42484797982). No Agent175 tag was published.
- The E171 protected main diff had no Worker deploy trigger; old Worker main `e3958d3` remained healthy but not same-SHA as newest main. Do not bypass same-source Health/OTA guard.
- E172 PR #875 changes only the Worker release workflow **paths** to include existing E170 authorized release receipt and gate, plus the strict E170 recovery allowlist/test. A fresh release must **merge (two parents), not squash**, preserving the exact tested PR head SHA as ancestor.
- Expected: new protected main E170 marker triggers existing Worker deploy and Agent175 signed OTA independently; Agent175 must wait for same-SHA Worker official /health. No Android/Web change, Rules deployment or business behavior change.
- Exact CI/source and actual release receipts must be appended after verified runs. Status until then: **E170 WORKER PASS on old main; E172 CODE/CI/RELEASE PENDING; Agent175 not released, field/causal coverage unverified**.
