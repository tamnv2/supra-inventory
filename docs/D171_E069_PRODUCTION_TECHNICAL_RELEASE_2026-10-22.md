# D171-E069 — D170 + D171 single-Production TECHNICAL RELEASE PASS (2026-10-22 VN)

## Authority and exact source

- Owner-approved release boundary: D171 E062 (single Production) amended E064 (retain original Agent Wi-Fi priority). No separate Stable Worker, second InventoryCore, database migration, data copy, or retirement of legacy Android update resources.
- Initial unified source PR #656 merged `1fab2e2a8140ea42f81324bf6c8f1f091c97c5ba`. D171 E067 safe Android release-gate fix PR #660 merged `e4c7dbba08d59fdc6f315ffe0f7992c606e5a817`, 16/16 exact-head CI PASS. D171 E068 Owner-release-receipt repin PR #661 merged `e08fa2a8e6899857db06b466390966e2b9f022e6`, 18/18 exact-head CI PASS with authority/continuity, no protected source delta after pinned `5f953e2ff6d1c2406f25c2984f57eddc4537e5b3`.
- Existing `tools/d167_release_gate.py` strict protected diff guard remains unchanged and the E068 scoped receipt pins the current tested protected source. All supported release actions used branch→PR→non-squash merge; no direct main push.

## Latest exact-main release proofs

All **13/13** GitHub Actions workflows associated with main SHA `e08fa2a8e6899857db06b466390966e2b9f022e6` ended `completed/success`, with zero failed or pending.

| Stage | GitHub Actions run | Verified outcome |
| --- | --- | --- |
| Existing Google Agent Operations Gateway | `39671472137` | PASS, same-source existing deployment |
| Worker / Web 3.1.2 / InventoryCore | `39671472402` | PASS, scoped Worker deployment with health, official + legacy hostname bound to identical source and SQLite |
| Existing Firestore Rules | `39671472157` | PASS, pinned unchanged approved Rules source and readback |
| Windows Agent v140 | `39671472035` | PASS, published/reused signed-source-compatible `relay-agent-v140` and Agent channel |
| Signed Android vc115 | `39671471797` | PASS, published `beta-vc115`, refreshed PDA channel and public alias |
| Other CI checks | Eight additional workflows on same main SHA | PASS; total 13/13 |

### Android distribution

- Release: `https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc115`
- Exact release target main: `e08fa2a8e6899857db06b466390966e2b9f022e6`
- Distribution channel: `https://github.com/tamnv2/supra-inventory/releases/tag/inventory-channel`
- `beta-vc115/supra-inventory-beta.apk`, `inventory-channel/supra-inventory-beta.apk`, and `inventory-channel/1291-Bao-Hang.apk` all report **20,055,450 bytes**, same `sha256:ff8b1c87548f85b0b586d16373e9865c47febb16889f17ca8c1e5452a1d638bc` from GitHub Release asset metadata. The checksum companion and `pda-latest.json` were updated with that published channel.
- Technical Beta package/tag/old host deliberately preserved for existing vc114 signed update compatibility; no separate Beta-vs-Stable user-facing application.
- Agent channel updated `agent-latest.json` and EXE/SHA256; v140 release: `https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v140`.

## Acceptance boundaries

`TECHNICAL_RELEASE_PASS = true`; **do not fabricate FIELD_PASS or OWNER_PASS**. Signed APK on GitHub/OTA channel does not prove it is installed on every PDA. The following require device/runtime or provider evidence:

1. Real PDA vc114→vc115 install and authenticated Picker/Reporter operation, no per-click server ACK; DISPLAYED only after overlay mounted and local dismiss under offline/kicked process state.
2. Real Agent v139→v140 installed on VPS and field PCs; Office/normal networking, WMS confirm, PRIMARY/standby handoff, bulk Kick roster cleanup, protected VPS/admin/tamnv2 parity, existing SKU Wi-Fi priority, group contact.
3. Google Drive archive and Gmail OTP real transaction after official OAuth; scheduled logs 13:15/21:15 VN and measured billed Cloudflare/Firebase usage, especially Durable Objects requests. Do not claim billed saving without provider metrics.
4. No old-host retirement until active fleet confirms safe compatibility; old Stable Worker remains OWNER-GATED.

This release closes **technical code/CI/GitHub distribution/deploy**, not total Owner business acceptance. Any field defect must be repaired under D171, not marked PASS.
