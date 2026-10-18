# D170-E021 — Agent v139 technical release receipt (2026-10-19 VN)

**Scope:** Existing SUPRA Inventory Worker and Agent Auto Confirm Pick Pack only. This is not Owner field acceptance or full D170 completion.

- PR #634 fixed a stale D169 Firestore Rules baseline, passed 16/16 CI, merged at `30cfdb9`.
- PR #635 corrected the exact approved executable-source SHA, passed 13/13 CI, merged at `4ecf0f9`.
- PR #636 registered the protected D170 receipt as a trigger for the existing Agent workflow, passed 15/15 CI, merged main `1896867bda12cbc570148fcf24ecd0050f224d08`.
- Worker GitHub Actions `39173024218` **SUCCESS**, same existing Worker, domain health/source and InventoryCore SQLite guards passed.
- Agent GitHub Actions `39173024161` **SUCCESS**, Agent source build v139, Firestore/WMS unchanged gate, same-source Worker requirement, tagged release publisher, and Agent WebView2 bundle steps all passed.
- GitHub Release [relay-agent-v139](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v139) exists with canonical `Agent.Auto.Confirm.Pick.Pack.exe` (7,447,552 bytes), companion `.sha256`, and support release assets.
- Publication logs affirm `Updated stable Agent runtime channel inventory-channel -> relay-agent-v139`. The `inventory-channel` release has updated `agent-latest.json`, `Agent.Auto.Confirm.Pick.Pack.exe`, and `.sha256` (2026-10-19 VN).
- Android latest remains signed vc114. The old `inventory-beta.supra.cc.cd` remains live to preserve old Agent v138 updater and Google OAuth redirect until the separate Phase3 sunset field evidence.
- **Not claimed:** on-device update success for all Windows Agents, PRIMARY/standby physical WMS ACK field PASS, Google OAuth callback conversion, complete D170 Owner PASS. No new database/Worker resource, Firebase Rules or Android update is deployed in v139 recovery.

This source-backed release receipt updates canonical D170 state after successful publication and must not cause new deployment.
