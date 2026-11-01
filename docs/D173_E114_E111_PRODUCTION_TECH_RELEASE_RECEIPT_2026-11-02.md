# D173-E114 — D173-E111 Production technical release receipt (02/11/2026)

## Owner approval / boundary
Owner explicitly ordered E111 implementation and guarded production rollout. This receipt records verified source, CI, signed release and channel only. **Physical FIELD and Owner business acceptance remain PENDING.** D172 independent PENDING/HOLD; historical Stable OWNER-GATED.

## Exact source and tested PRs

- E111 functional PR: [#817](https://github.com/tamnv2/supra-inventory/pull/817), main merge `cb6b2d56feb1d4c4905ee784d40fc250b117e78a`, originally tested Android/Agent/Worker source.
- E111 Firestore Rules reuse recovery: [#818](https://github.com/tamnv2/supra-inventory/pull/818), main merge `0ae65f3fe35821634ca4226ced7a0b2d42e47aa2`. The legacy D169 same-SHA Rules requirement was invalid for unchanged Rules.
- E113 Gateway reuse and Android release-note path trigger: [#819](https://github.com/tamnv2/supra-inventory/pull/819), final main merge **`610537eed7906f7b3090dbff6363aef8721f5c6c`**.
- E113 reviewed source pin `f6915c2a5595473a0a5004605c78b6ee6d6c10b5`; PR #819 exact-head 28/28 PR workflow SUCCESS, with `ops/d173-e111-release-authorization.json` source_ci_verified=true, source_ci_failed=0. Only non-runtime CI release-gate/docs/notes changes follow this source pin.
- The existing push-only `.github/workflows/d173-email-sender-guard.yml` reports FAILED with zero instantiated jobs; this is a separate, previously observed workflow-definition/configuration issue, **not** an email sending/functional test failure or a reason to claim all push workflows green.

## Final technical RELEASE evidence

| Component | Run/result | Published identity |
| --- | --- | --- |
| Existing Worker/InventoryCore SQLite/Web assets | [41357629342](https://github.com/tamnv2/supra-inventory/actions/runs/41357629342): **SUCCESS** (official /health, source/storage, auth/SQLite and API checks) | `inventory.supra.cc.cd`, same existing Worker resource, main `610537ee` |
| Windows Agent | [41357629473](https://github.com/tamnv2/supra-inventory/actions/runs/41357629473): **SUCCESS** (native Windows tests, source-pinned Worker health, no Rules/Gateway change, signed EXE/channel, Fixed WebView2 bundle) | [relay-agent-v163](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v163), tag commit `610537ee`; `inventory-channel` Agent EXE, SHA256, `agent-latest.json` updated |
| Android Báo hàng | [41357629442](https://github.com/tamnv2/supra-inventory/actions/runs/41357629442): **SUCCESS** (release gate, signed APK, Worker source-pinned health, signed Agent163-first check) | [beta-vc123](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc123), tag commit `610537ee`; `inventory-channel` APK, SHA256, `pda-latest.json` updated |

Both signed tags resolve to the exact release commit `610537eed7906f7b3090dbff6363aef8721f5c6c`. Android channel manifests/assets updated 2026-11-02 VN; Agent assets updated earlier during the same release. Build + published OTA **does not prove any individual installed device received/accepted the update**.

## Source scope / D172

- Functional changes: Reporter realtime N−1 filtering, bounded GET hedge and lazy overdue cache; SKU effective-day 05:00 with verified manual FULL; Agent modeless overtime prompt 21:45 and hourly extension logic.
- No D172/OBPP business source change, no Firebase Rules or Agent operations Gateway mutation, no new Worker/resource, no WMS/Confirm contract change, no Stable deployment. Shared Worker D172 regression and CI isolation were covered before protected merge; D172 stays independent **PENDING/HOLD**.

## Outstanding FIELD / billing / Owner gates

1. Verify Agent163 native window prompt on the actual VPS: 21:45 modal-free YES/NO, 22:15 default OFF unless YES, 00:00 and hourly expiry, no confirm interruption and shared multi-Agent CAS.
2. Verify Android vc123 on real PDA: Reporter tabs/status, N−1 filtering, badge and lazy overdue list, realtime gap recovery, no duplicate HTTP burst. Verify operational SKU master across 00:00, 04:59 and 05:00 FULL/manual FULL.
3. Compare Cloudflare DO Requests and traffic with matched operational workload, plus latency, failure/fallback and queue/ACK SLA. No claim of reduced billing without provider evidence.
4. Investigate the push-only email workflow zero-job failure separately. Do not equate it with delivery failure.
5. Record physical FIELD and explicit Owner business PASS separately; do not automatically close D173 or D172.

**State:** CODE PASS; PR SOURCE CI PASS; RELEASE TECH PASS (Worker/Web, Agent163, Android vc123); FIELD PENDING; OWNER PASS PENDING; D172 PENDING/HOLD; Stable OWNER-GATED.
