# D173-E173 — E170 diagnostic Production TECHNICAL RELEASE receipt (08/11/2026)

## Authority / immutable source
- Owner approves E170 Worker and signed Agent175 Production diagnostics, reusing existing provider resources. No Android/Web UI/Firebase Rules deployment or business/HA change authorized.
- E170 feature PR [#873](https://github.com/tamnv2/supra-inventory/pull/873), E171 Windows UTF-8 release-gate recovery PR [#874](https://github.com/tamnv2/supra-inventory/pull/874), E172 Worker/Agent same-SHA protected trigger recovery PR [#875](https://github.com/tamnv2/supra-inventory/pull/875).
- Protected main release SHA: `1bc53cfee8bfc554e04e6b7d7d4bdc4d90cc0bb1` (PR #875 merged using merge commit, preserving exact CI ancestry).
- Original E170 full source CI pinned `5f2a467963aa859d25c3277bc58e1f5b39389165`: 45 SUCCESS, 0 FAILURE, 2 SKIPPED. E172 protected recovery source pinned `2f1269984ce6b99b5ba236dfce2c45f21c6e0c2c`: 26 SUCCESS, 0 FAILURE. Final PR #875 HEAD `49bc5fccf16a3c09ced4abf7bce8ce5aa781df45`: 26 SUCCESS, 0 FAILURE; post-pin changed only docs/state/authorization, no protected runtime/CI source.
- `tools/d173_e170_release_gate.py` passed on Worker and Agent on exact new main. Old E097/E126 authorization not reused, field/Owner PASS not inferred.

## Production receipts
### Worker / InventoryCore / official Web host
- [Deploy Beta Worker run 42486181624](https://github.com/tamnv2/supra-inventory/actions/runs/42486181624): **SUCCESS**.
- Official `https://inventory.supra.cc.cd/health`: HTTP **200** `status=ok`; `source_commit=1bc53cfee8bfc554e04e6b7d7d4bdc4d90cc0bb1`; `missing_bindings=0`; `storage.ok=true`; SQLite `17/17`; operational `7/7`; agent auth migration `0/0`. Source and health identical after Worker deployment.
- Existing HMAC-only `DAILY_EVIDENCE` endpoint, bounded route/SQL aggregate, Web/Android staged/Drive receipt summary and Owner-scoped Drive Agent sample are in Worker source from E170. Absence of a negative provider response in release CI is **not** a measured 24h coverage result.

### Signed Windows Agent175
- [Verify Beta Relay Agent run 42486181621](https://github.com/tamnv2/supra-inventory/actions/runs/42486181621): **SUCCESS**, strict Owner E170 source gate PASS, same-source Worker readback before signed publish.
- [Signed release `relay-agent-v175`](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v175) published 2026-11-08 13:43:43 UTC, `Agent.Auto.Confirm.Pick.Pack.exe` and matching `.sha256` available.
- Existing `inventory-channel` release contains `Agent.Auto.Confirm.Pick.Pack.exe`, `.sha256` and `agent-latest.json`; workflow output explicitly confirms channel updated to `relay-agent-v175`. Agent-owned WebView2 Host13 source unchanged.
- This is **technical OTA publication**, not proof any VPS has installed Agent175 or emitted new `D173_E169` error telemetry in an actual incident.

### Usage reporting
- [D173 Daily Read-Only Usage 05h30 VN run 42486181674](https://github.com/tamnv2/supra-inventory/actions/runs/42486181674): **SUCCESS** on release commit. Scheduled 05:30 read-only Provider-to-Service analysis exists; a push-triggered run for an earlier completed window is not sufficient to prove post-13:43 UTC device log coverage.
- WEB/ANDROID/Agent Drive evidence intentionally reports `PARTIAL`, `UNATTRIBUTED` or `UNVERIFIED` where device logs are missing, late, invisible to scoped OAuth, or provider metrics have not materialized. **Never mark these as 0 or 100%**.

## Acceptance matrix
| Gate | Status | Evidence |
|---|---|---|
| Code and exact CI | PASS | E170 45+E172 26 checks, no failures |
| Worker/InventoryCore official Production | TECHNICAL PASS | run 42486181624 + exact /health |
| Agent175 signed OTA/channel | TECHNICAL PASS | run 42486181621 + tag and channel |
| Android and Web UI update | NOT REQUIRED | unchanged vc127 / Web3.3.4 UI |
| Agent175 physical Windows installation and live diagnostic event | FIELD UNVERIFIED | no installed-device receipt |
| Scheduled 05:30 real joined log coverage over a completed post-release window | FIELD UNVERIFIED | await actual report and Drive files |
| Causal attribution of Cloudflare DO spikes/Rows Read, Firestore PermissionDenied and RTDB HA | ANALYSIS PENDING | requires matched Provider/Service/device window and actual Firebase Rules/claims query evidence |
| Owner FIELD acceptance | PENDING | not inferred from CI or release |

### Next concrete evidence
- First completed postrelease operating window and 05:30 run: confirm Worker source provenance, provider usage statuses, InventoryCore route/query buckets and Web/Android/Agent Drive coverage; include exact missing-source count and delayed bundles.
- Verify Agent175 on real VPS and error-only Firestore/RTDB/HA logs. Check Rules readback and permission class without emitting token/UID/PL.
- Collect representative 2–3 postrelease working days to discriminate workload spikes, retries/fallback and true causal root cause. Never automatically claim 0 fee or full causal proof.
