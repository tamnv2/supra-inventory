# D173-E185 — Agent184 / Web 3.3.6 / Worker Production technical release (11/11/2026)

## Approved scope
Owner authorized items 1–7 from Agent183 FIELD review; Reporter PDA automatic shift logout (item 8) is **backlog only**, no Android APK mutation or release. D172 remains independent **PENDING/HOLD**; no Stable, Firebase Rules or OBPP changes.

## Source and merge
- Source PR: https://github.com/tamnv2/supra-inventory/pull/908
- Exact tested source commit: `1066c15011251e32e0afed9645cadaa344eb1af6`
- Required source CI: 46 unique latest checks = 44 SUCCESS, 2 conditional SKIPPED, 0 FAILURE. Windows native build (42947593238), E185 Worker TypeScript / Web production build (42947593206), isolated D172 (42947593219), shared D172 isolation (42947593165): SUCCESS.
- Protected merge SHA: `e770727370ba3aafcbd9565a920f11572b332e49`
- Exact merge subject: `D173-E185_AGENT184_WEB336_WORKER_PRODUCTION_RELEASE: Agent184 Web3.3.6 Worker items1-7`

## Technical deployment
- Production Worker + Web: https://github.com/tamnv2/supra-inventory/actions/runs/42949993804 — **SUCCESS** (API/Web/auth/OAuth and health checks passed).
- Signed Agent184 release: https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v184 — **PUBLISHED**, GitHub Actions https://github.com/tamnv2/supra-inventory/actions/runs/42949993537 **SUCCESS**.
- Agent release published: 2026-11-11 03:04:29 UTC (10:04:29 ICT). 
- OTA `inventory-channel` updated: 2026-11-11 03:04:31 UTC; release log: `Updated stable Agent runtime channel inventory-channel -> relay-agent-v184`.
- SHA-256 Agent EXE on signed Release and `inventory-channel` identical: `09b9cafa550e8222f81806597cb46842b79cea257850aba70196ddf0b1a500e6`.
- OTA manifest `agent-latest.json` and executable updated at the same channel timestamp; no Android APK released.

## Distinct acceptance states
- **CODE / SOURCE CI / Worker-Web RELEASE / signed Agent184 OTA: PASS.**
- **FIELD: PENDING.** Real Windows painted WebView2, full DPI/layout and remote-kick scenarios have not been operator-observed/attested.
- **OWNER PASS: PENDING** until explicit acceptance.
- Other legacy/main-push checks for D170 compatibility, prohibited D172 signed APK and out-of-scope Firestore release may report failure and are **not** evidence those components were newly released; do not conflate the scoped production run PASS with all repository workflows PASS.
- D172 **PENDING/HOLD** independent; Reporter PDA shift logout remains backlog; Stable **OWNER-GATED**.
