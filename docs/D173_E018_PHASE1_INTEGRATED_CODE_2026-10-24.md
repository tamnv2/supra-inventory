# D173-E018 — Phase 1 integrated candidate, after E017 Owner sunset gate (24/10/2026)

Source integration from D173 PRs #713/#714/#715/#717 at exact branch content, rebased as a **new source tree** on main after D173-E017 PR719. Original branches/PRs are preserved as audit evidence and not treated as merged/releases.

## Owner-approved scope and current execution

- A: Android APK stream download with progress (%/bytes/MiB/s), signer/hash/installer separate, unknown-length safe fallback; VN same-day recurrence SQL trigger and projection-only filtering that leaves history untouched.
- C: Reporter online readonly Agent rows with role-specific API backed by existing WebSocket attachments. Reporter never enters Picker notification/call/contact/kick/group/relay counts; Office Worker outage is fail-closed.
- B logs: RAM-bounded Reporter counters and last 32 frames, update stage/revision/seq, stale-snapshot discard, overdue lazy-page success/error and frame-overflow count. Existing support/scheduled log delivery only, no new provider request/timer for diagnostics.
- Preserves user-supplied 24/10 aftershift D173-E017 legacy source-gate: old hostname still attached until Cloudflare control-plane / Google OAuth+Drive/Gmail / D172 runtime+rollback proof. Production Worker/Core/Firebase currently beta-named remain intact, Stable OWNER-GATED, D172 PENDING/HOLD.
- Reviewer must verify 5/10-minute Reporter roster reconciliation does not misrepresent stale presence as current; verify actual cost (1 Worker request + 1–2 DO reads per request). If insufficient, fix same E018 before release.

## Required testing and acceptance

1. Android Kotlin build, unit/static E013/E016/E018; verify OTA progress, unknown length, SHA/signature, interrupt/resume, install/result correctness. Only signed current package/channel.
2. Agent .NET build and role-negative UI/backend tests; Reporter selection cannot escalate to Picker bulk actions; no extra WMS/picklist wake. Office/normal network and stale/expired sessions.
3. Service TypeScript compile; roles 401/403; recurrence VN midnight / 03:00 and history; socket role/source; Worker/D172 dedicated OBPP negative auth/API/SQLite regression.
4. Repo Authority Guard, Project State Guard, D172 isolation, CODE+CI exact HEAD; distinguish unrelated old E005 email/D172 release-source gates from actual failure without weakening them. Main merge cannot launch unrelated Worker deploy by accident.
5. Signed app/Agent/Worker release requires pinned SHA, release authorization, rollback, actual postrelease health and Owner approval; no automated beta/stable promotion.
6. After release, acquire >=3 active workdays matched Android/Agent/Web/SQL/Firebase/Billing logs with coverage/overflow and quota before any Phase2 SQL/realtime/HA/Reporter bug behavioral fix.

**State at code creation:** CODE CANDIDATE only; not CODE PASS, CI PASS, RELEASE PASS, FIELD PASS or OWNER PASS. Old-host provider detach remains BLOCKED.

- Bổ sung nguồn Agent: ghi thời gian (ms, capped 60s) của lần đồng bộ Reporter hiện có, phân biệt PASS / UNAVAILABLE / DISCARDED_SESSION_CHANGED, chỉ phân loại exception type, không lưu danh tính hay token; không thay nhịp 5/10 phút, không tạo request/timer mới. Source relay-agent/D119AgentFeatures.cs, kiểm thử tests/d173-e016-a-c-logging.test.mjs.
