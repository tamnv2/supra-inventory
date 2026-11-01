# D173-E114 — Agent163 + Android vc123 Production technical release receipt (02/11/2026 VN)

## Source and authority

- Owner expressly requested E111 protected deployment, then reaffirmed: “Phát hành agent 163 và app 123.”
- The tested E111 source was delivered via PR #817 (Worker/Web), PR #818 (Firestore reuse guard), and PR #819 (unchanged Gateway reuse + vc123 release trigger), all within D173. No new feature scope or D172 business changes.
- Exact production merge source: `610537eed7906f7b3090dbff6363aef8721f5c6c`, merge message `D173-E111_REPORTER_SKU_OVERTIME_RELEASE:`; owner-scoped source gate remained mandatory. PR819 source workflows were 28 SUCCESS; the separately misconfigured push-only email sender guard creates a zero-job failure and is not evidence of email delivery failure.
- Worker/Web production run [41357629342](https://github.com/tamnv2/supra-inventory/actions/runs/41357629342) **SUCCESS**: existing Worker/InventoryCore+official Web; never claim field checks from CI.
- Signed Agent163 workflow [41357629473](https://github.com/tamnv2/supra-inventory/actions/runs/41357629473) **SUCCESS**. Checks included unchanged Firestore/Gateway reuse guards, same-source Worker health, Windows build and Agent schedule self-test, GitHub Release [relay-agent-v163](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v163) and `inventory-channel` EXE/manifest publication.
- Signed Android vc123 workflow [41357629442](https://github.com/tamnv2/supra-inventory/actions/runs/41357629442) **SUCCESS**: Android signed build, Worker same-SHA health + Agent163 tag/workflow gate, GitHub Release [beta-vc123](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc123), channel APK/checksum and `pda-latest.json`.

## Artifact readback

- Both release tag commit refs point to `610537eed7906f7b3090dbff6363aef8721f5c6c`.
- `relay-agent-v163` EXE SHA256 and `inventory-channel` EXE SHA256 coincide: `b3846607b300bb7a9cdada4aff3d896deba434b32db8c9cfb8fcdfa9ea62ccbe`.
- `beta-vc123` APK SHA256 and `inventory-channel` APK SHA256 coincide: `bbae738a632cdfc60b73743824113a0c361887d6caece60cceecc654db8b7243`.
- The release-channel `agent-latest.json` and `pda-latest.json` assets were replaced in the corresponding successful releases. Existing technical beta names are preserved for signed client compatibility.

## Boundaries and open acceptance

- **CODE/PR CI:** PASS for E111 source and follow-up release guards. **RELEASE TECH:** PASS for Worker/Web, signed Agent163 and signed Android vc123. **FIELD:** PENDING: physical Windows/PDA installations, 21:45/22:15/00:00 prompt operation, 00:00–05:00 SKU continuity, Reporter live view and measured DO requests are not proven by source CI. **OWNER BUSINESS PASS:** PENDING.
- **D172:** independent PENDING/HOLD. No D172 source, standalone APK, Sheets, Firebase Rules or registered Gateway modified. Historical Stable remains OWNER-GATED.
- Email sender guard push workflow failure with zero jobs is a separate CI configuration investigation, not a service failure or a license to change mail-provider configuration.
- No provider writes or new deployments are performed by this receipt. Next step: Owner on-device field observation and source-matched billing/realtime evidence; do not claim physical device auto-install solely from channel publication.
