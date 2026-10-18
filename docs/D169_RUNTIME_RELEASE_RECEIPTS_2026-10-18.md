# D169-E050 — Beta release receipts (18/10/2026)

**Status: LIVE BETA RELEASE PIPELINE PASS; Owner field PASS NOT CLAIMED.** Only the existing scoped Beta was deployed. D170 dual-network physical Agent↔Agent↔PDA field test is queued until D169 explicit Owner PASS. Stable remains owner-gated/unchanged.

## Tested and merged GitHub source

- D169 PR #615: https://github.com/tamnv2/supra-inventory/pull/615 — merged to main `c90e521d1c77b681455b32ffc33a69e7ecaa187e`.
- Full integrated source candidate `66180079056f931d643b77cc07aab6c2f61fc592`: 20/20 PR workflows PASS. Only release/continuity/docs changed after that SHA; `ops/d169-release-authorization.json` locks the protected source.
- Main post-merge GitHub Actions: 13/13 PASS at exact commit `c90e521d1c77b681455b32ffc33a69e7ecaa187e`.

## Deployment proofs

| Component | Run / verified receipt | Scope |
| --- | --- | --- |
| Beta Worker | [Deploy Beta Worker run 39102893789](https://github.com/tamnv2/supra-inventory/actions/runs/39102893789), SUCCESS | Existing Worker exact source/health gate, no new business/provider |
| Beta Firestore Rules | [Deploy Beta Firestore Relay run 39102893849](https://github.com/tamnv2/supra-inventory/actions/runs/39102893849), SUCCESS | Existing scoped Rules published by Rules Management API and readback |
| Agent v136 EXE | [Verify Beta Relay Agent run 39102893810](https://github.com/tamnv2/supra-inventory/actions/runs/39102893810), SUCCESS; [relay-agent-v136 release](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v136) | Published official prerelease EXE/checksum + inventory-channel agent-latest.json |
| Android Beta vc111 | [Verify Beta Android run 39102893786](https://github.com/tamnv2/supra-inventory/actions/runs/39102893786), SUCCESS; [beta-vc111 release](https://github.com/tamnv2/supra-inventory/releases/tag/beta-vc111) | Signed release APK/checksum + inventory-channel pda-latest.json |

Evidence: GitHub release assets list and channel `inventory-channel` checked on 2026-10-18. Agent EXE SHA-256 `768daa782ba2381d6aca2c2c34a695b06edbea8364a4807873d3325b19aea843`. Android vc111 APK SHA-256 `084fb6dee825fa067e30f75b99bc6cca9379396c77d8de445e80b738616868df`. Fixed WebView2 browser runtime zip and channel manifest also published.

**Boundaries:** Source/CI/release proof does NOT establish installed versions on actual VPS/local Agent/PDA, real WMS mutation, actual two-network failover ≤15s, on-device ACK, Firebase provider billed savings or Owner physical acceptance. Do not claim these passed or open D170 until Owner says D169 PASS. Previously published v135 and vc110 remain available for client rollback. No Stable mutation, new provider, new secrets or external resources.


## D169-E055 — VPS OTP-only Beta delivery receipts (2026-10-18)

**Outcome: scoped BETA RUNTIME / INITIAL ISSUE PASS. This is not an Owner field login PASS.** PR #617 merged to main commit `9fafc562eb03595279ff9d356ac3af360f8bbfdc` after exact protected source `9ae124c7c1ac76352197a5fe975df7525deb0732` 23/23 source checks PASS and full final PR head 23/23 PASS. Main actions 14/14 SUCCESS; Stable and Android remain unchanged.

| Component / event | Verified Actions or GitHub evidence | Status |
|---|---|---|
| Beta Worker | [Deploy Beta Worker run 39109138996](https://github.com/tamnv2/supra-inventory/actions/runs/39109138996) | SUCCESS; health exact merged source and auth guards PASS |
| Existing Beta Agent Operations Gateway | [Deploy Beta Agent Operations Gateway run 39109139019](https://github.com/tamnv2/supra-inventory/actions/runs/39109139019) | SUCCESS; existing Apps Script deployment updated and readback PASS |
| Windows Agent v137 | [Verify Beta Relay Agent run 39109138955](https://github.com/tamnv2/supra-inventory/actions/runs/39109138955) · [relay-agent-v137 prerelease](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v137) | SUCCESS; EXE/SHA-256 release + inventory-channel distribution updated, WebView2 bundle PASS |
| First VPS OTP issue | Worker run 39109138996, E054 named workflow step, 2026-10-18 07:50:49 UTC (14:50:49 VN) | `D169_VPS_FIRST_OTP_ACCEPTED_FOR_DELIVERY` — HTTP 202, not the 409 already-pending path |
| Firestore Rules | Explicit baseline equality check in Agent run 39109138955 | PASS; previous E046 deployed Rules unchanged; no redeploy |

**Scope and semantics:** OTP issue ran through existing scoped Worker email transport to symbolic `PROJECT_ADMIN_EMAIL` without displaying any OTP code or secrets in CI. HTTP 202 confirms the application accepted issuing the code for an existing ACTIVE, eligible VPS operator account; it **does not prove final Gmail inbox delivery**. This separate code is one-use and remains pending until consumed. Exact VPS login via newly installed Agent v137, next-code email, replay denial, Office transport and WMS session remain **OWNER FIELD PENDING**. If the email is not visible, Owner checks project mailbox/Spam; never post the OTP/code or unredacted mailbox evidence to GitHub/chat. The E054 merge trigger is one-off, and another routine docs merge must not repeat provisioning. D170 remains queued behind explicit D169 Owner PASS.


## D169-E060 — VPS account-first Agent v138 Beta runtime release (18/10/2026)

**Technical release PASS, Owner field PASS PENDING.** Owner E057 approved scoped existing Beta Worker / Firestore Rules / Windows Agent v138. PR #618 merged main `7b5993b136dfe9a6a1b1c2449bedbc8144567657` after v138 business source `4f03222afe0a36e4c3247fcdf587390f4365e1e4` had 20/20 source workflows PASS. Release dependency repair PR #619 merged main `4077f86560ca6d3c189d9d5c102c17bf93812b81` after workflow source `80e14c39a3f25d8660e63574b33caac73d920e22` had 16/16 and final PR head had 17/17 CI PASS. Final main commit: 13/13 Actions SUCCESS, including scope/authority checks.

| Component | Auditable release receipt | Result |
|---|---|---|
| Existing Beta Worker same-commit provenance | [Run 39119373089](https://github.com/tamnv2/supra-inventory/actions/runs/39119373089) | SUCCESS; Agent check `D168_WORKER_FIRST_AGENT_RELEASE_GATE_PASS` |
| Beta Firestore Rules, scoped v138 authorization | [Run 39119373107](https://github.com/tamnv2/supra-inventory/actions/runs/39119373107) | SUCCESS; Agent check `D169_FIRESTORE_RULES_FIRST_AGENT_RELEASE_GATE_PASS` |
| Windows Agent v138 | [Run 39119373112](https://github.com/tamnv2/supra-inventory/actions/runs/39119373112) · [v138 signed-style EXE + SHA-256 prerelease](https://github.com/tamnv2/supra-inventory/releases/tag/relay-agent-v138) | SUCCESS; executable and checksum assets present; WebView2 browser bundle PASS; `inventory-channel` updated to `relay-agent-v138` |
| Android unchanged | [Run 39119373113](https://github.com/tamnv2/supra-inventory/actions/runs/39119373113) | SUCCESS; no new Android version authorized or released under E057 |
| Authority, continuity and remaining main CI | [Main E059 commit 4077f865](https://github.com/tamnv2/supra-inventory/commit/4077f86560ca6d3c189d9d5c102c17bf93812b81) | 13/13 SUCCESS; Stable untouched |

GitHub release metadata shows v138 prerelease published 2026-10-18 10:30 UTC (17:30 VN), canonical EXE and `.sha256` assets. Inventory channel `agent-latest.json` / `Agent.Auto.Confirm.Pick.Pack.exe` were updated at 10:30 UTC, with corresponding Agent job evidence `Updated stable Agent runtime channel inventory-channel -> relay-agent-v138`. **Channel wording does not confer Stable deployment permission**: this is the existing Beta Agent distributor; Stable remains OWNER-GATED.

**Remaining Owner field validation:** actual installation/login using one-time code of existing `VPS` account, WMS page/session readiness, automatic return from auto-selected PRIMARY, protected manual choice and 15-minute request delivered to exact online `admin` and/or `tamnv2` Agent sessions (including Office fallback), one YES safe handoff, NO/timeout no handoff, dual-YES CAS, no interrupted Picklist/duplicate ACK or unacceptable Firestore Usage. v137 remains rollback; no OTP reissue occurred from E059 merge. A Web-only admin session is **not** claimed to receive Agent desktop notifications. D170 physical two-network testing remains separately queued; no Owner PASS asserted.
