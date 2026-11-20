# D173-E288 — Web3.3.24 Production UI technical release receipt (20/11/2026)

## Owner authority and exact scope
Owner explicitly ordered the Inventory Web preview-style UI to be deployed to the real official Production site `inventory.supra.cc.cd` for direct visual testing. The target remained the **existing `supra-inventory-beta` Worker** bound to that hostname, not the separately OWNER-GATED Stable Worker. Scope: D173 frontend presentation and Web asset repack only. Authentication, RBAC, real business API/realtime, Worker/DO/SQLite source, Agent, Android, Gateway, Firebase, D172 and Stable remain unchanged.

## Source, gates and merge
- [PR #991](https://github.com/tamnv2/supra-inventory/pull/991): **MERGED** via protected two-parent merge commit `ac4b0512931cf7a72e231af0652dec9d21bbfeef`, parents `df7ae65b78005f093862ee944e71a2d757b3c49f` (base) and `cf4c13b1c3014d58383b398524c93f7d60faacf9` (CI-pinned PR head); exact marker `D173-E286_WEB3324_PRODUCTION_RELEASE:`.
- Web version in same main source `WEB_VERSION = "3.3.24"`, package `3.3.24`. Source lock `7fb26c151535403fdeba95bac1229459d9eaa9d7`, E286 release auth CI pin `eac9c860336dd6016dfec973a11d0f286692d35e`; post-pin commits docs/ops-only, no web/service/tests/tool/CI drift.
- **5/5 scoped source CI PASS** on final PR head: E283 UI/Chromium/Vite/D172 [44735415431](https://github.com/tamnv2/supra-inventory/actions/runs/44735415431); E123 Worker/SQLite/Auth/D172 [44735415047](https://github.com/tamnv2/supra-inventory/actions/runs/44735415047); Repo Authority [44735415844](https://github.com/tamnv2/supra-inventory/actions/runs/44735415844); Project State/Continuity [44735415489](https://github.com/tamnv2/supra-inventory/actions/runs/44735415489); D172 Business Isolation [44735415442](https://github.com/tamnv2/supra-inventory/actions/runs/44735415442). Global historical CI FAIL still reported separately, not declared PASS.

## Production technical evidence
- [Deploy Beta Worker run #44735679902](https://github.com/tamnv2/supra-inventory/actions/runs/44735679902) **SUCCESS, attempt 2**, exact protected main SHA `ac4b0512931cf7a72e231af0652dec9d21bbfeef`, job `136287494963`.
- Attempt 1 job `136286322897`: Worker + Web asset deployment, same-host routing, health/Root secret/SQLite PASS; stopped at D166 Worker read-only token *re-install* step with its own tool output suppressed. No secret values published. The same exact-source job was re-run once; attempt 2 completed successfully without changing application code, deployment gate or bypassing token checks.
- Attempt 2 release log: `D173_E286_WEB3324_RELEASE_AUTHORIZED:worker` and `D173_E286_EXISTING_WORKER_GATEWAY_D172_UNCHANGED__WEB_UI_ONLY`; source check `D170_OFFICIAL_AND_LEGACY_SAME_WORKER_SOURCE_PASS`.
- Production `GET https://inventory.supra.cc.cd/health`: HTTP 200, `status=ok`, env=`beta`, `source=ac4b0512931cf7a72e231af0652dec9d21bbfeef`, storage=true, SQLite schema=`17/17`, operational ready=`7/7`, Root secret/refresh configured, agent migration failed/remaining=0/0.
- Successful postrelease checks: D166 read-only token *name* readback and unauthenticated endpoint denial, Firebase auth route/Root bootstrap, authenticated business API guards, PDA registry, Web HTML shell, OAuth public pages and OAuth start, protected internal Agent Drive broker. These are technical smoke checks; they are **not** a human-in-the-browser authenticated 9-page Owner UAT.

## PASS boundaries
- CODE: **PASS scoped**. CI: **PASS scoped**, 5/5 required. RELEASE: **TECHNICAL PASS** at run #44735679902 attempt 2 exact SHA.
- FIELD: **PENDING** Owner directly inspect all Inventory pages and roles on `https://inventory.supra.cc.cd`, including CSS at HD/HD+, mobile if used, light/dark, actions/form/scroll/notifications.
- OWNER PASS: **FALSE/PENDING**, D173 not closed. D172 **INDEPENDENT PENDING/HOLD**; Stable **OWNER-GATED**.
- No new provider resource; existing Worker source/business unchanged. Live browser UI not captured by AI. The user-requested purpose of the rollout is Owner's actual field test.
