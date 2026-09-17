# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE_PRE_REBASELINE_RUNTIME__LEGACY_OPERATIONAL_V2_SOURCE_BUILD_PASS_PENDING_MERGE_DEPLOY_RELEASE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `LEGACY_OPERATIONAL_UI_V2_SOURCE_PRODUCTION_BUILD_PASS__LIVE_RUNTIME_STILL_PRE_REBASELINE`
- Android: `LEGACY_OPERATIONAL_UI_V2_DEBUG_BUILD_PASS__LIVE_SIGNED_BASELINE_STILL_VC35`
- Latest signed Beta APK: `beta-vc35`
- Realtime: `OPERATIONAL_V2_SEQ_DELTA_ACK_SOURCE_BUILD_PASS_PENDING_BETA_RUNTIME_VERIFICATION`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BASELINE__OPERATIONAL_V2_CORRELATION_SOURCE_BUILD_PASS_PENDING_RUNTIME`
- UI design guard: `LEGACY_OPERATIONAL_UI_V2_SOURCE_SERVICE_WEB_ANDROID_PASS`

## Source/build evidence

- PR: `#14` on `feat/legacy-operational-rebaseline-v1`.
- Legacy Operational UI V2 source invariants: PASS.
- Worker TypeScript typecheck: PASS.
- Web production build: PASS.
- Android debug build: PASS.
- Source/build evidence head before state refresh: `ab4c99eecf3e698f3f7b2270788e8be756c7ea18`.
- Runtime deployment and signed V2 release are still pending; source/build PASS must not be confused with live runtime PASS.

## Proven live runtime baseline

- Runtime source commit: `a00a23727f515d208726907e4abc672243815460`
- Signed release: `beta-vc35` / `SUPRA Inventory Beta 0.2.0-beta.35`
- APK SHA-256: `09dd3fe51d6df9979d03bc58985fdd3f583d30be4f71e1535e72ceb9888afb38`
- APK size: `9185074` bytes
- Runtime UI is still the pre-rebaseline vc35 baseline until PR #14 is merged, Beta is deployed and a new signed Beta release is verified.

## Workboard

### In progress
- Final authority/continuity/UI guards for PR #14 after canonical state/derived-view synchronization.

### Next
- Merge PR #14 only after required checks are PASS and branch protection permits merge.
- Deploy merged Legacy Operational V2 to Beta and run runtime smoke for health/auth/Web/realtime delta/ACK/SLA/recurrence.
- Produce and verify the next monotonic signed Beta APK release.

### Field acceptance pending
- Physical PDA layout and business-flow acceptance on the new signed Beta.
- Physical foreground/background FCM and explicit critical-result ACK acceptance.
- Isolated mutation-load acceptance after an Owner-defined workload boundary.

## Guards

- No offline business mode.
- Stable remains Owner-gated and untouched by this workstream.
- No secret values belong in this public repository.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `ops/authority-manifest.json` and its declared `bootstrap_order` before mutation.
