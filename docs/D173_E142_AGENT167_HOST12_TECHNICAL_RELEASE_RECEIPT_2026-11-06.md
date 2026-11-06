# D173-E142 — Agent167 + WebView2 Host12 technical release receipt (06/11/2026)

**Scope:** Evidence-only checkpoint for Owner-authorized E141 Agent Windows and owned x64 WebView2 Host. No new source code/provider mutation, no new deployment, no D172 or Stable change.

## Verifiable release evidence

| Gate | Result | Exact evidence |
|---|---|---|
| E141 implementation | Merged, no field claim | PR [#844](https://github.com/tamnv2/supra-inventory/pull/844); Agent167 / Host12 source in `main` |
| Worker-only release gate repair | Merged | PR [#846](https://github.com/tamnv2/supra-inventory/pull/846), main merge `3e64c51812c202cdce88646029594ceecc7d93af` |
| Registered Gateway + Firestore Rules reuse | Merged | PR [#847](https://github.com/tamnv2/supra-inventory/pull/847), main release commit `189603cbd5743890631e122db5ce8d68e54ff027` |
| PR847 exact source/native, authority, project state, D172 isolation | PASS (5 required checks) | E141 native/source [42213590140](https://github.com/tamnv2/supra-inventory/actions/runs/42213590140), Agent Windows [42213590084](https://github.com/tamnv2/supra-inventory/actions/runs/42213590084), Authority 42213589997, State 42213590175, D172 42213589990; approved source pin `1a32e65535f0749f74afcdcaec5692075f8faa3b` |
| Signed/checksummed artifact and OTA release | **TECHNICAL RELEASE PASS** | Main GitHub Actions [42214104090](https://github.com/tamnv2/supra-inventory/actions/runs/42214104090) completed SUCCESS. Source-gated D168 Worker health, D171 Gateway reuse, D169 Rules reuse, WebView2 Host bundle publishing and dedicated Agent prerelease publishing each SUCCESS |
| Worker + Firestore deployment on this release commit | SKIPPED intentionally | Main runs 42214104154 and 42214104142; unchanged source verified and official Worker `/health` with SQLite storage OK |
| FIELD on Windows VPS 2 vCPU / 4 GB and Owner acceptance | **PENDING** | No 24-hour trial / in-field Agent167+Host12 WMS/PickList/HA proof. No OWNER PASS claim |

### Published release

- Agent release: [`relay-agent-v167`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v167), published **2026-11-06 12:01 UTC**.
- Canonical Agent EXE asset `Agent.Auto.Confirm.Pick.Pack.exe`, 8,842,240 bytes; GitHub asset SHA-256 **`c8ebf64f762a962c36ba79411729debb5e5f60826d541d961ba6ac5fa46ccce1`**.
- `inventory-channel` Agent EXE has the **same GitHub SHA-256**, and `agent-latest.json` updated 2026-11-06 12:01 UTC. Publisher log confirms `inventory-channel -> relay-agent-v167`.
- Owned Fixed WebView2 runtime **157.0.4341.42 x64**, `host_build=12`, bundle 321,605,186 bytes; GitHub bundle SHA-256 **`b98298d2c22e1fc963e62dbccf55ca9e06716ca3b3dc0672f66bcde5cb6b6b6a`**, published in the SAME existing `inventory-channel` prior to Agent167.
- WebView2 Host12 is backward compatible with Agent166: physical input shield defaults ON only for Agent167 launching with `--protected-default`; no extra WMS profile or second browser.
- Public artifacts contain no inserted passwords, refresh tokens, cookies or private signing material in repository source. Monitor is opt-in, locally bound to enrolled VPS account + machine/Agent instance; sanitized Agent log bundler reused.

### Explicit non-changes and acceptance boundary

- No Web, Android/APK126, Worker, Firebase/RTDB Rules, Apps Script/Gateway, Functions, D172 (separate PENDING/HOLD), or Stable product change from E141/E142.
- Historical CI failures outside the E141 required release lane are **not** renamed to PASS/waived. The approved exact source, native/authority/D172 gates and main release job passed.
- Main release **does not mean the VPS has installed 167 or HOST12**. Device-side update, Web operator shield behavior, WMS confirmation parity, primary-return lease reliability and 24-hour longitudinal sampling require independent FIELD verification.
- Agent167 technical RELEASE PASS only; **FIELD=PENDING; OWNER PASS=PENDING**. Do not mark full E141 closed until Owner field confirms.

### Final main release log markers

```
E141_AGENT167_SIGNED_ONLY_RELEASE_GATE_PASS:1a32e65535f0
D173_E141_AGENT_ONLY_WORKER_UNCHANGED_HEALTH_PASS source=01af1c886e
D173_E141_EXISTING_GATEWAY_UNCHANGED_PASS__NO_DEPLOY
D173_E141_EXISTING_FIRESTORE_RULES_UNCHANGED_PASS__NO_DEPLOY
Published Agent-owned Fixed WebView2 157.0.4341.42 host_build=12 host_arch=x64 bundle size=321605186 sha256=b98298d2c22e1fc963e62dbccf55ca9e06716ca3b3dc0672f66bcde5cb6b6b6a
Updated stable Agent runtime channel inventory-channel -> relay-agent-v167
```

*The `inventory-channel` string is a legacy technical release name. It is NOT authorization to mutate protected historical Stable resources. No Owner field approval inferred from the name.*
