# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `LEGACY_OPERATIONAL_V2_MAIN_50879EEF_DEPLOY_UPLOAD_PASS_BUSINESS_SMOKE_FAIL__F01_FIX_IN_PROGRESS`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_DEPLOYED_50879EEF__WEB_SMOKE_SKIPPED_AFTER_BUSINESS_FAILURE`
- Android: `LEGACY_OPERATIONAL_UI_V2_SIGNED_BETA_VC36_RELEASED__RUNTIME_ELIGIBILITY_GATE_FIX_IN_PROGRESS`
- Latest signed Beta APK: `beta-vc36`
- Realtime: `OPERATIONAL_V2_SEQ_DELTA_ACK_DEPLOYED_50879EEF__AUTHENTICATED_RUNTIME_SMOKE_PENDING_AFTER_F01`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Evidence

- Main source baseline: `50879eef1abbd1c17bed4c4e3f37fe2ee56849ad` from merged PR #14.
- Deploy run `35252261078`: deploy + health + auth probes PASS; business smoke FAIL on `OPERATIONAL_V2_NOT_READY`; Web/OAuth smoke skipped.
- Signed Android run `35252260928`: PASS, release `beta-vc36` from the same source commit.
- Automated runtime and signed-release gates must remain separate; vc36 publication did not prove runtime smoke PASS.

## F01 remediation in progress

- Operational V2 extension migration/readiness becomes idempotent and no longer runs DDL on every business/realtime request.
- Unauthenticated/forbidden calls are rejected before readiness probing.
- Health/CI require Operational V2 extension readiness.
- Future Android signed release publication waits for a successful matching Beta deploy workflow.

## Next action

Complete `fix/beta-runtime-continuity` through protected PR and terminal Beta runtime PASS, then continue F02–F07. Physical PDA/UI/FCM/ACK acceptance remains separate. Stable remains Owner-gated.
