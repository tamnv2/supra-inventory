# D173-E081 — Protect Agent signed release from docs/CI-only main commits (27/10/2026)

## Observed defect after v152 technical release

- D173-E079 source pinned `36b2dd2efcd71459cbc466b195c2d8d959680f3d`, 31/31 PR checks PASS. PR767 merged to `993b0c0a39e8ec7a9add8ae3b0eb92fecab2b020`; run40509999568 SUCCESS; signed `relay-agent-v152` and inventory-channel EXE match SHA256 `eee0418df46dbedae1d928754f4ed2c8c5ab442d1498d7f1291a3f77130ed321`.
- Docs-only PR768 source checks 17/17 PASS and merged to `cf9ffa5c09c62b54711932c239cd100e95e3f5c1`.
- This documentation merge touched an E079 **release authorization receipt** included in `Verify Beta Relay Agent` push path filters. The workflow reran despite no Agent source changes; main run40511457820 failed specifically at the legitimate `D167 Owner release authorization for agent` step (no release marker). **It did not build/publish another Agent binary or change OTA channel.** A failed fail-closed release gate on a docs-only commit does not invalidate the successful v152 release.

## Scoped repair

- The existing Agent workflow job now skips push commits titled `docs(...` or `ci(...`. Explicit Agent-only release markers `D173-E079_AGENT_ONLY_RELEASE:`, and all existing primary release paths remain unaffected. PR builds are still validated.
- Historical E076 Agent151 **source pin PR-only** preflight is limited to the original PR765 branch `docs/d173-e074-agent150-usage-field-feedback-20261027`, rather than rejecting every future feature PR after v151 changes protected source. Main release E076 gate remains unchanged and fail-closed.
- Regression test `tools/d173_e081_agent_docs_guard_test.py` must run in Windows Agent PR and verify the protected positive/negative trigger policy.
- No source changes in `relay-agent/`, Worker, Android, Firebase/Rules, D172 OBPP, WMS, Github release binaries, OTA assets, or any provider. No new signed release. Stable OWNER-GATED; D172 independent PENDING/HOLD.

## Gates

- CODE/CI source adjustment only. **PR checks required before protected merge.**
- On main with the `ci(D173-E081):` docs/CI guard merge title, Agent release job should be **SKIPPED**; do not claim a v153 release.
- v152 existing CODE/CI/RELEASE PASS retained. FIELD and OWNER still PENDING.
