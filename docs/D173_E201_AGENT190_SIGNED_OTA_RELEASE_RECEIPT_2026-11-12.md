# D173-E201 — Agent190 signed OTA technical release receipt (2026-11-12)

## Owner authority and isolation
- Owner explicitly approved deployment of the Agent189 FIELD repair on 12/11/2026. Approved scope is **D173 Agent-only**, signed official `inventory-channel` OTA; not Worker/Core, Web, Android, Firebase, D172 business/data, Stable, or Host runtime.
- The Agent190 candidate is the limited D173-E199 source repair from PR [#929](https://github.com/tamnv2/supra-inventory/pull/929). **Remote Agent Kích Agent HTTP400 remains unresolved**; no claim that all eight FIELD defects have passed.
- D172 stays independent **PENDING/HOLD**. Stable stays **OWNER-GATED**.

## Source and CI — confirmed in GitHub
- Accepted pre-merge main: `05135deb99b017738b453158c632c4fb53912675`.
- Exact Agent source pin: `18c3c0cc2367937c8649250a4e5d4f34d3df2ec0`. Version and assembly are **190**, Host14 remains required.
- PR929 protected two-parent merge: `a92d7a30007493ba31f82da3c1e608b87c69491c`; branch was merged with release marker `D173-E199_AGENT190_ONLY_RELEASE:`.
- Agent190 source tests, independent D172 regression and Windows x64 native build/smoke: [43084943520](https://github.com/tamnv2/supra-inventory/actions/runs/43084943520) SUCCESS.
- Repo Authority [43084943227](https://github.com/tamnv2/supra-inventory/actions/runs/43084943227) SUCCESS; Project State/Continuity [43084943320](https://github.com/tamnv2/supra-inventory/actions/runs/43084943320) SUCCESS; D172 isolation [43084943332](https://github.com/tamnv2/supra-inventory/actions/runs/43084943332) SUCCESS.
- Shared Worker/Web/Android/Firebase/D172/Stable source and deployments unchanged.

## Signed release and exact OTA readback
- Protected main release: [43086165497](https://github.com/tamnv2/supra-inventory/actions/runs/43086165497), job `agent190-ota` SUCCESS. Log contains `D173_E199_AGENT190_PIN_SCOPE_PASS`, `E199_AGENT190_OWNER_PIN_AND_OTA_BASELINE_PASS` and `E199_AGENT190_TECHNICAL_OTA_SHA_PASS`.
- GitHub tag: [relay-agent-v190](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v190), published 2026-11-11 19:21:19 UTC; tag target = above protected main merge SHA.
- Release EXE asset ID `736674980`, size **8,923,648 bytes**, SHA-256 **`9cc585d951ff48272b8ae5f96c8c7311e2c9ad04701825696d7e00fef1bc0819`**.
- `inventory-channel` EXE asset ID `736675204`, **same 8,923,648 bytes and SHA256**. `agent-latest.json` ID `736675356`, updated 2026-11-11 19:21:24 UTC. Workflow downloaded release and channel EXE/sha/manifest, confirmed tag, bytes and SHA256.
- Browser Host14 `agent-browser-latest.json` asset ID `734255099` unchanged, signed Host14 zip SHA256 `f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`; no Host upload or browser profile sharing change.

## Unresolved FIELD evidence / PASS boundaries
- VPS and ADMIN-PC Agent189 logs both show `D173_E196_AGENT_REMOTE_ISSUE result=FAILED http=400 action=EXIT_AGENT error_code=INVALID_AGENT_CONTROL`. Agent190 adds **local input-category validation only**; it does **not** change Worker/Core auth/command contract, and successful dispatch/claim/execution is **not verified**.
- Xoá phiên Web profile: bounded retry now in released Agent190 but actual locked-profile success needs device testing.
- Layout/text/filter colors/toasts/lag: source/native CI PASS, **physical FIELD not verified**. Host14 paint callback limitation remains; no inference Web visual PASS.
- **CODE PASS; SOURCE/NATIVE/D172 CI PASS; SIGNED OTA RELEASE PASS; FIELD FAIL/PENDING; OWNER PASS PENDING.** No extra provider billing or new Worker request path introduced by this release.
