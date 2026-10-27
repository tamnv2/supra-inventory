# D173-E072 — Agent150-only signed OTA: isolate unchanged Gateway and Firestore Rules (27/10/2026)

## Current technical deployment state
- E069 approved Agent150-only release; main merged PR759 `facfc3c7923ca5b019dda2219265cb8b85c8b45e`. E071 UTF-8 release gate recovery PR760 merged as `7a12a88b9ce6ed2f722ad65c3341c33be5a1ab96` with CI 29/29 applicable success.
- E071 production push `Verify Beta Relay Agent` [run 40462035770](https://github.com/tamnv2/supra-inventory/actions/runs/40462035770) passed the D167 Owner/E069 exact source gate, Windows Agent150 build and D168 existing Worker gate but entered D171 `Gateway deployment same SHA` loop. The loop can wait up to 120×10s because the Agent-only release intentionally does not deploy an unchanged Gateway. A second obsolete same-SHA Firestore Rules wait exists in D169.
- These conditions are not evidence of modified Gateway or Firestore Rules: accepted baseline `a22efb480039005789f998e862275fef2e7d0789`; `ops/apps-script/`, `firebase/` and `firebase.json` are unchanged by E069–E072. D172 independent business source and Stable are untouched.

## Source-scoped recovery
- Modify **only** `.github/workflows/verify-relay-agent.yml` release steps for the exact E069 signed Agent150 merge marker. Run `python3 tools/d173_e069_agent_release_gate.py --component agent` (must PASS exact tested source ancestry, Owner signature, guarded Worker note, no D172/Stable or other source mutation) and then run zero-diff against accepted Gateway / Firestore paths; only then bypass the historical same-SHA deployment wait.
- D171: Git `diff --quiet a22efb.. HEAD -- ops/apps-script/` must be clean.
- D169: Git `diff --quiet a22efb.. HEAD -- firebase/ firebase.json` must be clean.
- Any changed source or failed release gate must stop signed Agent publication. Do not disable checks globally, alter old release paths, or deploy Worker/Gateway/Firestore Rules.
- `tools/d173_e072_agent_only_gate_test.py` checks these two release branch contracts and early-exit ordering in PR Windows CI. A comment-only `relay-agent/D173E069ApprovedUsageUi.cs` change forces full native build and regression replay without modifying business logic.

## Acceptance criteria
- PR #761 exact protected source CI incl. Windows E072 check, native Agent150 compile, D172 regression and authority guard all PASS, with >=29 successful applicable checks and 0 failed. Only then update `ops/d173-e069-agent-release-authorization.json` SHA to exact tested E072 source, same change set authority/state/continuity, protected merge with `D173-E069_AGENT_ONLY_RELEASE:` marker.
- GitHub push run must PASS D167/E069 source gate, D168 existing Worker health, D171 unchanged Gateway, D169 unchanged Rules, Windows net48 build and signed tag `relay-agent-v150`; OTA manifest and EXE sha256 must match and existing v149 rollback kept.
- FIELD and OWNER PASS remain pending real installed Agent150 VPS usage source values, PickList History and WMS/Office/HA tests. Offline native WinForms 1376×900 Light/Dark does not prove physical DPI/field.
- D172 permanently independent `PENDING/HOLD`; historical Stable always OWNER-GATED.

## Exact CI source pass (27/10/2026)

- Exact protected source pin `926947875efb4976064ee32e81997f1b6a0375fb`: 40 check records, **29 SUCCESS, 11 SKIPPED, zero FAILURE**. Agent Windows run [40462890897](https://github.com/tamnv2/supra-inventory/actions/runs/40462890897) SUCCESS (E071 UTF8 guard, E072 D171/D169 source-isolation check, WinForms build/startup/native Light-Dark source smoke). Independent Linux strict UTF8 check, D172 isolation, authority and state also PASS.
- `ops/d173-e069-agent-release-authorization.json` now repins the exact E072 source and repeats E069 Owner-approved Agent-only scope. No additional protected source changes permitted after this pin without rechecking.
- **CODE/CI PASS, SIGNED RELEASE pending** final docs-only CI, protected PR #761 merge with E069 Agent-only marker and verifiable v150 tag + OTA channel SHA256. The earlier E071 push run is still a failed/blocking attempt and must not be treated as release; installed FIELD/OWNER remain PENDING.

## E072 exact-source CI receipt (27/10/2026)

- PR #761 exact tested SHA `926947875efb4976064ee32e81997f1b6a0375fb`: **40 checks, 29 SUCCESS, 11 SKIPPED, 0 FAILED**.
- Windows [Verify Beta Relay Agent run 40462890897](https://github.com/tamnv2/supra-inventory/actions/runs/40462890897): SUCCESS, including native Agent150 build/startup and E072 scoped Gateway/Firestore negative branch contract; D172 isolation and VPS-only read-only regression also passed.
- `ops/d173-e069-agent-release-authorization.json` now pins exact above SHA, 29 successful CI and zero failed, `field_pass=false`, `owner_field_pass=false`.
- Pending: protected PR merge with already Owner-approved Agent150-only marker; verify **signed tag, EXE SHA256 and inventory-channel manifest** separately. No Worker/Gateway/Firestore/Android/D172 deployment is authorized. D172 independent HOLD.
