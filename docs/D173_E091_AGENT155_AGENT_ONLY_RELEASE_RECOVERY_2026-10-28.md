# D173-E091 — Agent155 signed OTA release recovery, Agent-only (28/10/2026)

## Evidence and cause
- Owner explicitly authorized all eight Agent155 UI/log/resources changes and signed release under D173-E090. PR781 protected merged main `bffdad20307b6943c06c88d407d5bdeaa731c12c`, exact source CI 33/33 PASS at `e60c0ec54f2bda3de787a43e9ea804107755f85b`, Windows compile/startup PASS.
- Original protected Agent workflow [40627901339](https://github.com/tamnv2/supra-inventory/actions/runs/40627901339) FAILED before **Publish dedicated Agent prerelease** at the legacy `D168 require matching Beta Worker before publishing Agent` step, because the unrelated Worker release 40627901297 was correctly fail-closed on Agent-only changes; Firestore release 40627901450 was also correctly denied. Neither Worker nor Firestore was deployed; NO signed v155 tag or inventory-channel update may be claimed on the failed run.
- Current Production Worker is already deployed and remains the established data authority. Its `/health` rather than a fictitious same-SHA Worker deploy is the appropriate read-only dependency for **Agent-only** v155.
- This recovery does NOT authorize any Worker/Firebase/Android/Web/OBPP production modification; D172 independent PENDING/HOLD, historical Stable OWNER-GATED.

## Exact recovery
1. In existing `.github/workflows/verify-relay-agent.yml` D168 Worker-first step, before the historical same-SHA check, exact main release marker `D173-E090_AGENT155_RELEASE:` calls current strict E090 Owner/CI source gate, verifies unchanged Worker/Web/Android/Firebase/D172/Gateway business source from approved E090 baseline, and probes the existing registered Worker `https://inventory.supra.cc.cd/health` for `status=ok`, `environment=beta`. Return early only for that exact marker and verified health, preserving Worker-first requirements for other deployments.
2. Existing Worker and Firestore workflows add only the same exact release marker to their preexisting Agent-only no-deployment job-skip list. No Worker, Firestore, secrets, domain, database or client mutation.
3. Updated E090 source allowed list covers these two protected workflow skips. Reset prior CI pin and capture fresh CI before protected main merge. No new Agent source edits, version remains 155. Signed immutable `relay-agent-v155` and matching `inventory-channel` SHA are the technical RELEASE acceptance criteria.

## Explicit gates
- Windows x64 compile/startup smoke and native Usage/History/Log tests; D172 cross-module isolation, Worker/Firestore/Email source unchanged.
- 33/33 or all relevant required PR CI, pinned source SHA, matching Owner receipt before release; signed workflow must show successful dedicated v155 prerelease + EXE/channel digest equality.
- Installed VPS/desktop 100/125/150% DPI, live log receipts and WMS/HA FIELD and Owner acceptance remain separate PENDING; technical release is not FIELD/OWNER PASS.

Status: RECOVERY CODE CANDIDATE, CI and signed release PENDING.
