# D173-E187 — Agent185 / Host14 signed OTA technical release (11/11/2026)

## Authority and scope
Owner 11/11/2026 instructed to fix ADMIN-PC WMS WebView2 white screen and publish Agent185. Scope strictly Agent185 / Host14 Windows; no Worker, Web, Android, Firebase Rules, D172 business assets, Stable, WMS business flow or provider usage change. FIELD/OWNER PASS remains separate.

## Source / CI and release recovery
- Original Agent185 Host14 source: PR [#911](https://github.com/tamnv2/supra-inventory/pull/911), merge `7ddecb85bc7d96dc3512ed6a0a07031715485a5d`; original CI 34 SUCCESS, 2 SKIPPED, 0 FAILED.
- First protected main action [42965200003](https://github.com/tamnv2/supra-inventory/actions/runs/42965200003) reported SUCCESS but only uploaded Host14; premature `return` skipped Agent185 tag/OTA. Distinct RELEASE FAIL despite green workflow.
- Corrective PR [#912](https://github.com/tamnv2/supra-inventory/pull/912), source SHA `8a9572c747c6580e3eaa695bc0a8701b27b38256` and final pin commit `288404c4cb3f0a3d4a636d07d959bda8db76c263`: **21/21 CI SUCCESS**, including Agent x64, Host14, E187 no-early-return regression and D172 isolation. Runtime source unchanged.
- Protected two-parent recovery merge `ca14deee4999f5f31066208c0baa957bec923de7` (E187 exact release marker). Main signed release workflow [42970510030](https://github.com/tamnv2/supra-inventory/actions/runs/42970510030): **SUCCESS**; log confirms `E187_HOST14_MANIFEST_READBACK_PASS` and `Updated stable Agent runtime channel inventory-channel -> relay-agent-v185`.

## Live GitHub Release and OTA readback
- Signed GitHub Release: [relay-agent-v185](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v185), PUBLISHED **2026-11-11 06:12:51 UTC**.
- Release EXE `Agent.Auto.Confirm.Pick.Pack.exe` size **8,903,680 bytes**, SHA-256 **`87b145e0adb2a820fbe59c6fdc4057430885348d4d3e087c4721172c62eacac2`**.
- `inventory-channel` EXE updated **06:12:54 UTC** with exactly the same size and SHA-256. Channel `agent-latest.json` updated **06:12:52 UTC**; workflow log explicitly attests tag `relay-agent-v185`.
- Host14 WebView2 x64 ZIP already on inventory-channel, size **321,797,691 bytes**, SHA-256 **`f7f758131e025eb367b4e97bda59d4bf7f5506fcc703bf862d000daf25d45af2`**; verified bundle reuse, manifest `host_build=14`, x64 readback successful.
- No Android APK or Web/Worker technical release was part of E187; no Stable/D172 mutation.

## Acceptance
**CODE PASS / Source CI PASS / Signed Agent185 Release PASS / OTA channel SHA match PASS / Host14 release PASS.**

**FIELD PENDING:** ADMIN-PC relogin WMS, physical WebView2 rendered content (not DOM READY only), tab/tray/unlock, manual Confirm, and VPS PRIMARY regression must be observed. **OWNER PASS PENDING** until explicit Owner acceptance. No assumption of installation on all devices.
