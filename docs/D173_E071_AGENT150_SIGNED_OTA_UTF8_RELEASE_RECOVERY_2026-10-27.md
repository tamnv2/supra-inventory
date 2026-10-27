# D173-E071 — Agent150 signed OTA release recovery: Windows UTF-8 gate (27/10/2026)

## Verified failure after Owner-approved E069 main merge
- PR #759 merged on main as `facfc3c7923ca5b019dda2219265cb8b85c8b45e` with approved `D173-E069_AGENT_ONLY_RELEASE:` marker. Existing premerge source pin `3a5255c267981c22cbd7b597852430b4b12666f2` and final PR head `771e87cf0271c90d1adc435d9c95d50b305797ec` both had 33/33 applicable CI SUCCESS, zero FAILED.
- The signed Agent workflow [40460131551](https://github.com/tamnv2/supra-inventory/actions/runs/40460131551) **FAILED before EXE build/release**, at D167 owner-release gate. No Agent150 tag/OTA was published by this run. Production Agent149 remains last verified signed release.
- `tools/d173_e069_agent_release_gate.py` uses Python `subprocess.run(text=True)` with Windows default cp1252. `git show a22efb:service/src/d173-vps-usage.ts` emitted UTF-8 bytes of source containing Vietnamese; the subprocess background reader raised `UnicodeDecodeError`, returning unusable baseline text. The subsequently emitted `WORKER_NOT_COMMENT_EXACT` was a **false mismatch caused by decoding**, not an authorized reason to weaken the Worker isolation check.
- Independent exact content comparison confirmed only one allowed Cloudflare account-wide explanatory string changed `30% Inventory is an internal planning allocation only.` → `50% Inventory is an internal planning allocation of included Cloudflare pools; not a USD charge cap.`; reverting that string yields byte-for-byte identical UTF-8 source. Worker runtime does not need redeployment.

## Scope-limited repair
- `tools/d173_e069_agent_release_gate.py`: force `encoding='utf-8'` when reading git stdout/stderr; preserve strict compare and fail-closed semantics, approved baseline, non-D172 guards, source ancestry, Worker/Stable restrictions.
- `tools/d173_e071_utf8_release_guard_test.py`: executable regression on real Windows PR runner; verify UTF-8 `git show`, exactly one allowed Worker note, complete equality after reversing the explanatory text, and explicit encoding in release gate. Logs only PASS/FAIL, no credential data.
- `.github/workflows/verify-relay-agent.yml`: trigger Windows CI when the release-gate script changes, run UTF-8 regression *before* build, with original CI/security and native Light/Dark screenshot checks intact.
- Owner E069 had already explicitly approved **Agent150-only signed release**; this E071 repair is continuation of the failed E069 release. Do NOT redeploy Worker, Web, Android, Firebase, WMS, D172 or historical Stable.

## Release acceptance boundaries
- CODE: E071 branch/PR; CI: must PASS on exact-source commit, with Windows UTF-8 guard and D172 regression verified; source authorization pin update on same PR **only after test evidence**.
- RELEASE: protected PR merge commit titled `D173-E069_AGENT_ONLY_RELEASE:` must preserve the tested source SHA ancestor and exact Worker comment guard; verify signed `relay-agent-v150`, existing `inventory-channel` binary digest and OTA manifest match.
- FIELD/OWNER: pending physical installed Agent150 VBA source/Usage values, history blank resolution, Office/WMS/HA, real DPI/theme. Source-native offscreen 1376×900 does not establish full physical desktop field PASS.
- D172 remains independent `PENDING/HOLD`, Stable remains `OWNER-GATED`.

## Exact-source CI result (27/10/2026)

- Tested protected source `a8df86540a9295ac3709b5500867303d0c1e0e65` with **40 GitHub checks: 29 SUCCESS, 11 SKIPPED, 0 FAILED**. Windows `Verify Beta Relay Agent` workflow run [40461316564](https://github.com/tamnv2/supra-inventory/actions/runs/40461316564) has both native compile/light-dark/startup and E071 UTF-8 Worker negative test PASS; independent Linux E071 job PASS. D172 isolation, VPS-only read-only guard and authority/continuity tests PASS.
- E071 keeps the D173-E069 approved source content and Worker/Firestore/Web/Android/D172 unchanged except an in-scope Agent source comment triggering full CI; Windows git-show explicit UTF-8, independent regression script and release workflow test-only additions are the release fix.
- Updated `ops/d173-e069-agent-release-authorization.json` to pin the above tested source with `source_ci_verified=true`, 29 successful required checks, no failures, Windows startup/native theme/D172 booleans true. Follow-up changes within this PR must remain docs/authority-only or require a new exact-source pin.
- **CODE/CI PASS; SIGNED RELEASE PENDING** pending E071 protected merge/replay with E069 Agent-only marker and verified v150 signed tag, channel digest. FIELD/OWNER PENDING. 1376×900 CI native control tree screenshot is not full physical VPS display proof.
