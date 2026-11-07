# D173-E162 — Agent173 signed OTA technical release receipt (07/11/2026 VN)

## Owner authority and scope
D173-E161 Owner approved implementing all proposed Agent172 VPS FIELD failures and protected Agent173 release. E162 records **observed technical results only** and has no new code, release or provider action. D172 OBPP independent PENDING/HOLD; Stable OWNER-GATED.

## Exact source and merged PR
- [PR #863](https://github.com/tamnv2/supra-inventory/pull/863) merged with two-parent **merge commit** `844f93bf36ecc30bb698b22ee0c7ac1306428e5d`, title `D173-E161_AGENT173_ONLY_RELEASE: protected Agent173 Host13 signed OTA`.
- Exact source CI pin `73470873fb6ebb623f783d711bc3728a8d189aaa`: **34 SUCCESS, 1 SKIPPED, 0 FAILED** before receipt/docs-only commits.
- Windows Agent native CI [Verify Beta Relay Agent #42386116995](https://github.com/tamnv2/supra-inventory/actions/runs/42386116995) PASS, E149 native/x64/D172 [#42386116919](https://github.com/tamnv2/supra-inventory/actions/runs/42386116919) PASS, D172 isolation [#42386116907](https://github.com/tamnv2/supra-inventory/actions/runs/42386116907) PASS. Host13 not rebuilt or republished.

## Signed OTA and provider readback
- Protected main push [Verify Beta Relay Agent #42386456621](https://github.com/tamnv2/supra-inventory/actions/runs/42386456621) **COMPLETED / SUCCESS**; `relay-agent` job SUCCESS, historical cross-platform step SKIPPED.
- Signed tag [relay-agent-v173](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v173) resolves **exactly** to merge commit `844f93bf36ecc30bb698b22ee0c7ac1306428e5d` by GitHub git/ref readback.
- `Agent.Auto.Confirm.Pick.Pack.exe`: **8,868,864 bytes**, release asset digest `sha256:babe03888682fc8fe8bd7edd3c2938f732bfb079c7d602165dfbadad31806ff0`.
- Existing [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel) asset `Agent.Auto.Confirm.Pick.Pack.exe` has **the identical SHA-256 and byte size**; `agent-latest.json` was updated with asset digest `sha256:0cc296be1448457277b70c5861b71607d3efcb1f8fa8361a7ffbab976eab9d18` at 22:29:41 VN. Technical OTA channel updated; not proof each installed PC has applied it.
- Existing Host13 x64 `Agent.WebView2.FixedRuntime.x64.zip` unchanged size **321,605,288 bytes**, SHA256 `36ba2f8184f8f6dc59b572147b08ca5c43fe5ebe3ff84a181d75b5fbd729c694`, asset updated 11:23 VN before Agent173 release.
- No Worker/Web/Android/Firebase Rules/Gateway/D172/Stable source changed. Unrelated main push **Deploy Beta Worker** and **Deploy Beta Firestore Relay** workflows FAILED at D167 Owner gate **before provider deployment**, as designed for isolated Agent release. Separate `D170 Official Client Host Compatibility` historical regression FAILED; **do not call whole-repository CI green**.

## FIELD/OWNER acceptance boundary
The previous Agent172 VPS log proved Host recreation after tray HIDE/RESTORE, but an Agent173 physical VPS observation is not yet available. Real Windows FIELD acceptance requires 100 hide/restore cycles preserving live Host PID/CDP target and no redundant navigation, >2h hidden, WMS actual session-expiry handling, multiple SFT3 card selection, exactly-once final click and safe uncertain readback, HA failover and representative PDA volume. Future live observations must be separately recorded.

**CODE: MERGED** · **CI: Agent source/native/D172 PASS** · **RELEASE: signed Agent173 TECH PASS** · **FIELD: PENDING** · **OWNER PASS: PENDING**. D172 PENDING/HOLD and Stable OWNER-GATED remain.
