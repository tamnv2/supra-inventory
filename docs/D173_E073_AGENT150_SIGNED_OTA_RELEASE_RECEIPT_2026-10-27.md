# D173-E073 — Agent150 signed OTA RELEASE receipt (27/10/2026)

## Release verification
- Owner E069 approved exact native Light/Dark Agent150 VPS Usage and signed Agent-only deployment. E071 fixed Windows UTF-8 release gate; E072 fixed obsolete D171 Gateway / D169 Firestore same-SHA waits only when Owner pin and zero-diff proof both PASS. All protected PR merges preserved source ancestry and marker `D173-E069_AGENT_ONLY_RELEASE:`.
- [PR #761](https://github.com/tamnv2/supra-inventory/pull/761) merged to main `3d4dccb6ba74849afd8dbaea229c81e92c37af78`. E072 exact-source pinned `926947875efb4976064ee32e81997f1b6a0375fb`: **29 successful PR checks, 11 skipped, 0 failures**, including Windows E072 zero-diff Gateway/Rules guard, net48 startup, native Light/Dark source smoke, Windows E071 strict UTF-8, Linux source guard and D172 cross-module isolation.
- Main [Verify Beta Relay Agent run 40463616125](https://github.com/tamnv2/supra-inventory/actions/runs/40463616125) ended **SUCCESS**. D167/E069 owner source gate PASS, D168 existing Worker health PASS, D171 unchanged Gateway PASS, D169 unchanged Firestore Rules PASS, Agent Windows build SUCCESS, dedicated prerelease publish SUCCESS, existing channel update SUCCESS, Agent-owned WebView2 browser bundle publish SUCCESS.
- GitHub immutable signed release tag [relay-agent-v150](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v150), published 2026-10-27 06:54:20 UTC (13:54:20 VN). Signed `Agent.Auto.Confirm.Pick.Pack.exe` size **8,723,968 bytes**, SHA256 `57a5398935d84fec9d989a5212ffe6423ec1e4d6690f48ff2ffc73cfad5b5cca`. Existing `inventory-channel` release updated `agent-latest.json`, matching signed EXE name/size/digest exactly, same published time window. The v149 signed release remains available for rollback.
- [Deploy Beta Worker run 40463616005](https://github.com/tamnv2/supra-inventory/actions/runs/40463616005) **SKIPPED as designed**: this release made no Worker runtime deployment. Historical [Deploy Beta Firestore Relay run 40463616181](https://github.com/tamnv2/supra-inventory/actions/runs/40463616181) failed at its **D167 Owner authorization** because E069 did not authorize deploying Firestore Rules; no Rules rollout claim. This unrelated noisy workflow result does not negate the passing Agent-only signed OTA release, and may be reviewed separately without loosening provider authorization.

## Separate gates — DO NOT collapse statuses
- **CODE: PASS** (Agent v150, VPS-only read-only Usage, real source-backed N/A and internal 50% Cloudflare quota planning, History PickList blank self-heal, theme/window regression).
- **CI: PASS** (exact source and main Agent Windows release pipeline).
- **RELEASE: PASS** (signed v150 + OTA channel digest match + WebView2 bundle).
- **FIELD: PENDING**, until Owner tests installed Agent150 on actual VPS, provider source/forecast, History PickList transitions/reconnect, Office/WMS/primary-standby and real light/dark DPI. Native CI capture was a 1376×900 WinForms content viewport; not full installed physical screen.
- **OWNER PASS: PENDING**, explicitly not inferred from Owner's earlier approval to deploy.
- **D172: PENDING/HOLD INDEPENDENT** (not closed, no D172 business/source mutation); **Stable: OWNER-GATED**. Web/Android/Firebase/Worker/Gateway not newly deployed.

## Remaining operational verification
Install or let the existing signed Agent OTA update to v150. Confirm Help/About version, VPS Usage read-only values and source freshness, PickList History no blank tab, WMS connectivity / HA / Agent primary switch, 125%/150% Windows DPI Light/Dark and telemetry log. Report FIELD/OWNER separately. Do not state measured Cloudflare cost savings merely from target 50% allocation.
