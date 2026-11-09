# D172-E061 — Signed OBPP v11 technical release receipt, 09/11/2026

## Exact Owner scope / unchanged systems
Owner-approved independent Android-only repair: successful login navigation and correct pending-OTP 409 message. No change to D172/Inventory Worker business handlers, shared Firebase credentials/rules, private Sheet, Web/Agent/Inventory Android, app package or signer; D172 remains PENDING/HOLD.

## CODE and PR evidence
- [PR #885](https://github.com/tamnv2/supra-inventory/pull/885), protected main squash `7fc185409411b0fea3d0bee2008eacb95ebe4c37`. Source review pin `234247c31020dbd6751c6966d565da604b509eb5` in original PR history. D172 Android [42660184873](https://github.com/tamnv2/supra-inventory/actions/runs/42660184873), D172 Backend [42660184924](https://github.com/tamnv2/supra-inventory/actions/runs/42660184924), Repo Authority [42660184951](https://github.com/tamnv2/supra-inventory/actions/runs/42660184951), Project State [42660184988](https://github.com/tamnv2/supra-inventory/actions/runs/42660184988), UI Design [42660184811](https://github.com/tamnv2/supra-inventory/actions/runs/42660184811): **PASS**.
- Historical D173 E149 Agent-only guard rejected unrelated D172-scoped PR path as designed; it was not bypassed or changed. GitHub protected merge permitted under relevant D172 technical gates.
- Initial signed v11 attempt [42660795259](https://github.com/tamnv2/supra-inventory/actions/runs/42660795259): **FAILED**, because exact reviewed PR source pin was not ancestor of squash main. No signed APK published by that attempt.
- [PR #886](https://github.com/tamnv2/supra-inventory/pull/886), release-gate recovery only, protected main squash `1a94fe7ddb2efba27cfddc8cbea562a94e74b553`. Fetches immutable original PR #885 head, confirms pinned source ancestry, checks protected path diff and existing Worker source, preserves binary and D173 isolation. Recovery source-pin preflight [42662219084](https://github.com/tamnv2/supra-inventory/actions/runs/42662219084), D172 Backend [42662219291](https://github.com/tamnv2/supra-inventory/actions/runs/42662219291), UI Design [42662219362](https://github.com/tamnv2/supra-inventory/actions/runs/42662219362), Repo Authority [42662219505](https://github.com/tamnv2/supra-inventory/actions/runs/42662219505), Project State [42662219169](https://github.com/tamnv2/supra-inventory/actions/runs/42662219169): **PASS**.

## Signed APK + OTA
- Protected main GitHub Actions [run 42662532323](https://github.com/tamnv2/supra-inventory/actions/runs/42662532323), release job `129317542157`: **COMPLETED SUCCESS**.
- Gate logs: `D172_E061_OWNER_PINNED_ANDROID_ONLY_LOGIN_OTP_PASS 234247c31020` and `D172_E010_EXACT_WORKER_HEALTH_AND_LOGIN_NEGATIVE_PROBE_PASS`. Actual existing Production Worker source is pinned to prior E060 `07da381aba617644d90df1f72651fc2bd5876b68`, without redeploy. Scoped status READY/Sheet connected and negative login HTTP401 checked at release.
- Signed APK release: [obpp1291-v11](https://github.com/tamnv2/supra-inventory/releases/tag/obpp1291-v11), package `cd.cc.supra.obpp1291`, versionCode 11, versionName `1.0.11`, source commit `1a94fe7ddb2efba27cfddc8cbea562a94e74b553`, `obpp1291.apk` 6,175,212 bytes. Same existing GitHub signer variables; no public signing material.
- [OTA channel obpp1291-latest](https://github.com/tamnv2/supra-inventory/releases/tag/obpp1291-latest): `obpp1291-latest.json` overwritten 2026-11-09 17:15:06 UTC (confirmed GitHub asset metadata), points to signed v11 by signed workflow. Exact app checksum is present in the OTA manifest but not copied into public documentation without direct readback.

## PASS distinctions
| Gate | Status |
|---|---|
| CODE, D172 Android/Backend, Authority, State, UI CI | PASS |
| Protected main merge, signed Android build, GitHub Release, OTA asset | PASS |
| Existing Worker exact source and public negative login readiness | PASS |
| Real OWNER PDA login with valid OTP / ordinary account, immediate UI navigation and no stale draft | **NOT YET VERIFIED (FIELD PENDING)** |
| D172 Owner acceptance/closure | **FALSE; PENDING/HOLD** |

No actual account password, OTP, private Sheet ID, person data or Android signer material has been written into the public repo.
