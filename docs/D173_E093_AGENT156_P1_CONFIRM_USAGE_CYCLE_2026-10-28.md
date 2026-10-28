# D173-E093 — Agent156 P1 Confirm + Usage ngày/chu kỳ (28/10/2026)

## Owner explicit authorization
Owner directs concurrent implementation and production release of (A) P1 PickList confirmation hardening and (B) Agent Usage 06:00/day/month progress. Scope: only Agent and existing Worker where technically required. **Android APK is excluded from both code and release.** Existing WMS browser UI, Firestore carrier, Picker ACK contract and stored results remain compatible with Android as released. No Web, Firebase Rules/data, Gateway, OBPP business sources, new resources or historical Stable.

## Confirm: evidence, risk and safeguards
- E088 historical forensic covers representative logs 14–28 Oct, not full fleet. Strong historical evidence: PDA client-clock 12/24h skew caused rapid REQUEST_EXPIRED on old installed binary; current D160ConfirmPipeline uses Firestore server created_at for 12s fences. Do not alter the 12s fence, Rules, Android, mutation routing or client epoch.
- 28 Oct VPS logs show first UNCERTAIN after final WMS click followed by repeated HTTP409 with no further WMS mutation. This is a legitimate idempotency guard; do not delete/release blindly or treat a generic error surface as negative transaction proof.
- E093: only after **one exact PickList** final click returns UNCERTAIN, perform one bounded WMS top-level reload and read-only SearchMany. Classify ALREADY_CONFIRMED only when exactly one matching code has an unready checkbox and the visible SAME-ROW "Xác nhận lấy lại hàng" action. Mark existing guard locally confirmed on positive proof. If timeout/ambiguous/no positive marker, retain UNCERTAIN and guard, require supervised reconciliation. No repeat business click, no additional Firestore/Worker traffic, no false CONFIRMED.
- This path is exception-only and may add WMS latency to UNCERTAIN cases; steady-state successful confirmations remain unchanged. Real WMS and 100/125/150% DPI FIELD remains pending.

## Usage: verified data periods and two native bars
- Agent v155 source already fetches 24h history at login and filters chart samples at 06:00 Vietnam; it **does not** start provider recording only on Agent login. Per-metric configured sync unchanged. Missing historical provider buckets must be shown as missing, never fabricated zeros.
- Agent156 adds independent day and cycle native progress bars. Daily numerator uses full provider day: Cloudflare local day 00:00-now; Firestore Pacific quota-day; shift chart is independent from quota day. Cloudflare daily denominator is a **planning reference** = 50% of verified included cycle allowance divided by actual cycle days. Firestore day is 50k/20k/20k per Pacific day. Provider gauges, unknown quota and non-comparable APIs have no invented percentage.
- Existing authenticated VPS-only Worker Usage route adds `window=cycle` read-only. Server validates `cycle_start/cycle_end` from existing Cloudflare subscription billing source and accepts only sane 28–32 day active cycles. It loads Cloudflare period buckets only; no GCP request, DO SQL writes or Firestore writes on this cycle read. Agent caches the cycle snapshot locally (once per day), preserves 24h provider sync, and calculates percent only with a complete daily bucket for every provider UTC date from cycle beginning to now. No missing-day->zero, rolling30d-as-cycle, partial UTC start-day allocation or invoice claims.
- Cloudflare usage is account-shared; 50% is internal planning target, **not** an independently enforceable Inventory quota or USD billing cap. No claimed real target when cycle/source/unit unverifiable.

## Required release gates — fail closed
1. Branch + Draft PR with owner decision/spec/continuity/state in same change; Agent156 version/source tests; TypeScript typecheck, Windows x64 compile/startup smoke, provider-cycle edge cases, WMS read-only positive/negative/timeout; D172 and Báo hàng shared Worker regression.
2. Source SHA pinned to complete required PR CI PASS; protected merge; existing Worker production updated before signed Agent156 OTA; readback /health and channel digest. No APK or Firebase release.
3. FIELD: confirm WMS actual, 06:00 provider history after startup later than shift start, month 28/29/30/31/32 day and partial missing bucket, Firestore Pacific day, Agent UI 100/125/150% DPI, real 20-PDA burst / HA / Office / ACK. Explicit separate Owner PASS required.
4. D172 remains independent PENDING/HOLD; historical Stable OWNER-GATED.

## Current work state
CODE IN PROGRESS on branch fix/d173-e093-p1-verify-usage-cycle-20261028. CI, RELEASE, FIELD, OWNER PASS must be evidenced independently and must not be inferred from this approval.

## Verified PR source CI receipt (28/10/2026)

- Exact source SHA: `716a0194ef52f1e3f2438b65fb19b75147110811` on PR #784. GitHub Checks: **40 SUCCESS, 11 SKIPPED, 0 FAIL** (51 total). Skips are non-applicable workflow jobs, not passed tests.
- Windows Agent156 x64 build, startup smoke, gRPC native smoke, sync self-test: [job 122645382515](https://github.com/tamnv2/supra-inventory/actions/runs/40636754512/job/122645382515).
- Worker TypeScript typecheck: [job 122645382914](https://github.com/tamnv2/supra-inventory/actions/runs/40636754434/job/122645382914).
- D172 shared Worker cross-regression (48 tests, 0 failures): [job 122645381231](https://github.com/tamnv2/supra-inventory/actions/runs/40636754109/job/122645381231).
- VPS Usage read-only/source isolation: [job 122645380652](https://github.com/tamnv2/supra-inventory/actions/runs/40636754122/job/122645380652).
- This is **SOURCE/CI technical PASS only**. Production Worker, signed Agent156 OTA, physical WMS/PDA FIELD and Owner acceptance are not yet verified; no Android APK or Stable deployment permitted.
