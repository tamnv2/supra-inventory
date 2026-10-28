# D173-E092 — Agent155 signed OTA technical RELEASE PASS (28/10/2026)

## Owner authorization and exact source
Owner explicitly approved all eight Agent155 UI/log/resource/session fixes and signed EXE release under D173-E090 on 2026-10-28. No additional Owner permission to Worker, Firebase Rules, Web, Android, WMS, D172 OBPP, or historical Stable.
- Initial Agent source PR [#781](https://github.com/tamnv2/supra-inventory/pull/781) merged at `bffdad20307b6943c06c88d407d5bdeaa731c12c`. Exact source `e60c0ec54f2bda3de787a43e9ea804107755f85b` had **33/33 PR workflow PASS**, including Windows x64 build/startup smoke and D172 negative isolation tests.
- First push run [40627901339](https://github.com/tamnv2/supra-inventory/actions/runs/40627901339) FAILED at obsolete D168 same-SHA Worker prerequisite, **before publishing v155**. Shared Worker and Firestore release jobs refused unauthorized Agent-only deploy; production business system not modified.
- Release recovery PR [#782](https://github.com/tamnv2/supra-inventory/pull/782) pins scoped source `4a19bed7a667a4b5fd6aa19e8e11f825d6909315` with **23/23 PR CI PASS**, then protected merge `16a30cf0f82a9bdae4b5dfef16cad960105e537f` with exact E090 Agent155 release marker. Existing Production Worker `/health` is the bounded dependency, no fictitious same-SHA Worker deploy; `Deploy Beta Worker` push run **40628795901 skipped**, `Deploy Beta Firestore Relay` push run **40628795790 skipped**.

## Signed Agent155 release evidence
- Protected signed Agent workflow [40628795802](https://github.com/tamnv2/supra-inventory/actions/runs/40628795802) **SUCCESS** (including Windows build/host/startup/signed publish + WebView2 fixed runtime package).
- Immutable version tag [relay-agent-v155](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v155) points to exact main merge `16a30cf0f82a9bdae4b5dfef16cad960105e537f`.
- Canonical Windows EXE `Agent.Auto.Confirm.Pick.Pack.exe`: **8,766,976 bytes**, SHA-256 `b5a3dc6f264fe8a7deb0a38b9801137c68b7c8c9f2b0792170ad647aeb0cd933`.
- Existing GitHub [inventory-channel](https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel) EXE asset has **identical byte size and GitHub SHA-256 digest**. Dedicated prerelease and channel both have checksum assets.
- Existing signed [relay-agent-v154](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v154) retained as rollback, separate Android channels untouched. Do not claim that a particular Windows machine installed v155 automatically.

## Approved eight-item output
1. Native provider/metric/Desktop vector icons, no remote font/image dependency.
2. Missing-source N/A cards dim, valid counts visible without fabricated target.
3. Global support log action for exact authenticated `admin`, `tamnv2`, `vps` with single-flight status. Worker RBAC unchanged; API accepted does not mean every client uploaded a log successfully.
4. Vietnamese professional sidebar/tab labels.
5. Desktop resource local refresh defaults to 1 second; 1/2/5/10 second options; no extra cloud polling.
6. Task Manager-style Desktop summary on Overview, separate Performance tab retired.
7. Session table displays channel/login/last-seen/contact/WMS fields from existing RAM snapshots only.
8. Overview height 50% system operational cards / 50% active sessions, preserves independent scroll and action permissions.

## Final technical and field gates
- **CODE PASS, SOURCE CI PASS, SIGNED AGENT155 OTA TECHNICAL RELEASE PASS.**
- **FIELD PENDING / OWNER PASS PENDING**: real installed VPS / Windows Agent display 100/125/150% DPI, live `vps` log action & per-device upload receipts, no flicker on 1 second monitoring, roster 50/50/historical headers, WMS/PRIMARY/standby/Office real operation.
- **D172 independent PENDING/HOLD**; historical Stable remains **OWNER-GATED**.
- Worker Service-independent log export by the D161 global request **not verified**; avoid claiming whole-system delivery from successful HTTP acceptance. No new secrets committed in public repo.

Release receipt is documentation/state only: NO new provider mutation, EXE, Worker, Firebase, Web, Android or D172 release from this receipt.
