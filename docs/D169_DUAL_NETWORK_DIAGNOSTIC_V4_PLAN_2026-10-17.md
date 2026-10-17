# D169 — Isolated dual-network Agent/PDA diagnostic V4 (17/10/2026)

## Owner scope and controls
Owner asks for a **separate** Windows EXE and separate PDA APK, not an Agent or SUPRA Inventory Android update. Objective: acquire enough field evidence for NORMAL/Office and mixed-network Agent topologies, network switch and simulated PRIMARY handoff, without repeated narrowly scoped troubleshooting cycles.

**No production WMS, Picklist, Firebase HA owner, business mutation, existing Agent/PDA binary, Beta deployment or Stable resource is authorized to change from the diagnostic request.** Current D169 Owner FIELD PASS remains pending. New canary Rules or backend resources require a separate registered-scope authorization and a contract/security review.

## Received source-grounded V3 evidence
- NORMAL: authenticated Firestore REST 200 direct and proxy fallback, RTDB authenticated REST 200, RTDB SSE initial event reached.
- OFFICE: Firestore authenticated REST 200 through Windows system proxy but direct fails; RTDB REST/SSE fails HTTP 403 over proxy (origin of 403 not proven).
- Neither report proves Firestore native gRPC Listen, peer receipt/ACK, refresh token longevity, FCM delivery or failover.
- Owner gave real PDA device availability and asks to cover 2 Windows Agents operating on same and mixed WLANs.

## Separate diagnostic design
- Windows x64 test node: operator login, per-network authenticated read-only DNS/TLS/HTTPS/Firestore/RTDB/SSE/proxy probes, unique session ID and node role, sanitized JSON evidence, no new business collection writes.
- Android test node: separate package id `cd.cc.supra.diagnostic`, operator login, per-network authenticated read-only HTTPS/Firestore/RTDB/SSE, sanitized JSON export, unchanged existing installed SUPRA app.
- Field checklist: PDA NORMAL + PRIMARY NORMAL/OFFICE; Agent_A/Agent_B NORMAL/NORMAL, OFFICE/OFFICE, NORMAL/OFFICE, OFFICE/NORMAL; bidirectional network changes, candidate peer handoff, stale listener, auth expiry, request ACK late/duplicate, connection loss, delayed proxy update and FCM delivery.
- Record test session, actor, network epoch, proposed carrier, latency per phase, app events, exact final acknowledgement, candidate PRIMARY generation and cost units. Never log authentication material, private WLAN identifiers, raw bodies or employee data.
- Diagnostic endpoint must be an **isolated authorized canary namespace** with TTL, role/user fence, rate limits and explicit peer receipt if actual writes/ACK are later approved. Reusing `relay_poc_jobs` or `relay_poc_coordination` to fake a request/HA is prohibited.

## Current implementation evidence and blockers
- Standalone Go Windows amd64 V4 EXE was cross-compiled in the conversation container, but no Windows physical execution or privilege-specific Agent OTP verification occurred.
- Standalone Android Java/Gradle source and 16-scenario field matrix have been prepared as conversation artifacts. This repository branch currently contains partial isolated Gradle scaffolding only; **APK has not been built, signed or released** because uploading complete Java source through the connected GitHub action was blocked and no local Android SDK is present.
- Current V4 tools are **READONLY, BASELINE ONLY**, explicitly not a complete peer ACK/gRPC/FCM/HA pass suite.
- The test-plan branch is for continuity and review only; no merge/deploy until authority/continuity PASS and Owner authorization for a safe canary plan.

## Recommended next implementation phase (not automatically authorized)
1. Finish independently packaged Android diagnostic build and validate Android 11 install, output and upload.
2. Propose allowlisted Beta canary Rules with separate, minimal collection; require two-way peer ACK without touching production jobs, authority or WMS.
3. Implement real Firestore Listen observer, candidate common HA peer state (simulated), token refresh, FCM device delivery, and event-correlated A/B/C/PDA logs; test in both networks.
4. Compare after field runs: zero split brain, no fabricated success, terminal ACK latency and retries, auth expiry, provider quota, extra CPU and battery overhead. Only then propose production transport adaptation as a separate approved change under D169.

## Status
**PARTIAL_TOOLING_ONLY — no signed APK / no production end-to-end proof.** D169 remains open; Stable untouched.
