# D173-E040 — Agent v144 signed release recovery (25/10/2026)

## Failure evidence
- Owner selected Agent sample 2 and explicitly requested code+deployment, PR740 source 29/29 PASS and merged protected main `afc4159b7ea635a1e7e5a71ba19922cd6cd400f6`.
- Post-merge Agent run [40196172375](https://github.com/tamnv2/supra-inventory/actions/runs/40196172375) FAILED in `D168 require matching Beta Worker before publishing Agent`. The Worker [40196172463](https://github.com/tamnv2/supra-inventory/actions/runs/40196172463) and Firestore [40196172399](https://github.com/tamnv2/supra-inventory/actions/runs/40196172399) were correctly Owner-gated and denied deployment for this Agent-only change. No v144 signed RELEASE PASS.

## Scoped recovery
- Fix only `.github/workflows/verify-relay-agent.yml` in PR741. Exempt historical same-source Worker/Gateway redeploy requirement **only** on exact `D173-E038_AGENT_ONLY_RELEASE:` main marker.
- Must still independently verify `tools/d173_e038_agent_release_gate.py --component agent`, unchanged `service/`, `web/`, `android/`, `functions/`, `firebase/`, `firebase.json`, `ops/apps-script/`, `obpp1291/` against the pinned pre-E038 Production baseline, plus live health from existing official Worker. D169 unchanged Firestore rules gate remains enforced.
- Worker, Firebase, Gateway, Android, D172, old Stable and service secrets must NOT deploy. Signed Agent v144+SHA256/OTA only after 29/29 CI or all current PR runs green and new exact source pin receipt.
- CODE/CI/RELEASE/FIELD/OWNER distinction applies; FIELD/OWNER pending; D172 independent PENDING/HOLD.

## D173-E041 verified source pin
- Exact E040 workflow source SHA `c1cb980c12121330b582311a867e593773c5b214`, **20/20 PR workflow runs SUCCESS**, Agent Windows runner `40196628814`. All previously released Agent v144 compiled and startup tested from E039 remains unchanged; no shared runtime edits.
- New Agent-only Owner source receipt pinned in `ops/d173-e038-agent-release-authorization.json`; now awaiting protected merge + signed Agent v144 and OTA SHA256. Not FIELD/OWNER PASS.
