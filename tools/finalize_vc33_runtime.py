#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = "beta-vc33"
RELEASE_NAME = "SUPRA Inventory Beta 0.2.0-beta.33"
SOURCE_COMMIT = "21cc34e82c229fc686801e8f00476438555f89cb"
APK_SHA256 = "192c39ee66e68795af147a8ab4f0b8164207fe41e93ad445e75c0c63045adda5"
APK_SIZE = 9168694
ANDROID_STATUS = "PRACTICAL_BALANCED_SIGNED_BETA_VC33_NATIVE_UI_FAIL_CLOSED_UPDATE_GATE_PASS"
USER_STATUS = "EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS"


def load_json(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write_json(path: str, value: dict) -> None:
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# Canonical live state.
state = load_json("ops/project-state.json")
state["current_status"]["android"] = ANDROID_STATUS
state["current_status"]["latest_beta_apk"] = RELEASE
state["current_status"]["user_management"] = USER_STATUS
capability = (
    "Android Beta vc33 native remediation: PR #8 authority/continuity/Practical Balanced source/Worker typecheck/Web production/Android debug PASS; "
    f"merged source {SOURCE_COMMIT}; post-merge authority/continuity/UI build guards PASS; signed {RELEASE} versionCode 33 published, "
    f"APK SHA-256 {APK_SHA256}, size {APK_SIZE} bytes; native narrow-screen UI, direct operational labels/footer, adaptive launcher icon, "
    "single fail-closed latest-version login gate, APK download/SHA-256 verification/installer handoff, and removal of Application-level post-layout UI rewriting are technical release PASS"
)
if capability not in state["completed_capabilities"]:
    state["completed_capabilities"].append(capability)
state["pending_build"] = [
    item for item in state.get("pending_build", [])
    if not item.startswith("Android vc33 native UI/update-gate remediation")
]
state["field_pending"] = [
    "Owner physical-PDA verification of signed beta-vc33 remains required for field/UI acceptance: update gate/install handoff, Picker login/default-password behavior, narrow-screen layout, launcher icon and role workflows.",
    "Physical logged-in PDA FCM delivery remains field-pending.",
]
state["next_action"] = {
    "primary": "Owner field-test signed beta-vc33 on a physical PDA: confirm update gate/install handoff, Picker login/default-password behavior, narrow-screen UI alignment, launcher icon and operational role workflows; report numbered findings if any.",
    "method": "Use beta-vc33 as the current technical Beta baseline. Source/build/sign/release gates are PASS; physical-device and Owner business acceptance remain separate evidence levels.",
    "stable_guard": "Do not activate Stable.",
}
state["workboard"]["in_progress"] = []
state["workboard"]["next"] = [
    "Owner field-test signed beta-vc33 on physical PDA and report numbered findings if any",
    "Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA",
    "Run isolated business-mutation load acceptance after Owner defines scale target/test boundary",
]
state["workboard"]["blocked_or_owner_field_dependent"] = [
    "Owner business/UI acceptance of beta-vc33 on physical PDA",
    "Physical PDA FCM delivery acceptance",
    "Isolated mutation load acceptance requires an Owner workload target/test boundary",
]
state["workboard"]["last_runtime_evidence"] = {
    "schema": 5,
    "signed_beta_release": RELEASE,
    "signed_beta_release_name": RELEASE_NAME,
    "signed_beta_apk_sha256": APK_SHA256,
    "signed_beta_apk_size_bytes": APK_SIZE,
    "runtime_source_commit": SOURCE_COMMIT,
    "runtime_ui_baseline": "PRACTICAL_BALANCED_NATIVE_ANDROID",
    "verification_basis": "PR #8 authority + continuity + Practical Balanced source guard + Worker typecheck + Web production + Android debug PASS; post-merge main authority + continuity + Practical Balanced/Android debug PASS; signed Android beta-vc33 release publish PASS with monotonic 32→33 versionCode. Android-only change required no Worker runtime mutation.",
}
write_json("ops/project-state.json", state)

# Resource registry runtime/release evidence. Stable is intentionally untouched.
registry = load_json("ops/resource-registry.json")
beta = registry["environments"]["beta"]
beta.update({
    "android_source_status": ANDROID_STATUS,
    "latest_signed_beta_release": RELEASE,
    "latest_signed_beta_release_name": RELEASE_NAME,
    "latest_signed_beta_apk_sha256": APK_SHA256,
    "latest_signed_beta_apk_size_bytes": APK_SIZE,
    "latest_signed_beta_release_source_commit": SOURCE_COMMIT,
})
completed = registry.setdefault("application_build_completed", [])
marker = "android_vc33_native_ui_fail_closed_update_gate_signed_release_pass"
if marker not in completed:
    completed.append(marker)
registry.setdefault("ui_design", {})["android"] = ANDROID_STATUS
write_json("ops/resource-registry.json", registry)

# Acceptance frontier: robustly replace only the current-baseline paragraph.
acceptance_path = ROOT / "docs/specs/ACCEPTANCE_TESTING.md"
acceptance = acceptance_path.read_text(encoding="utf-8")
replacement = (
    "The current technical Beta baseline is `beta-vc33`, schema v5. PR #8 passed authority, continuity, Practical Balanced source validation, Worker typecheck, Web production and Android debug gates. After merge, main again passed authority, continuity and Practical Balanced/Android debug gates, and published the signed monotonic Android release `beta-vc33` from source `21cc34e82c229fc686801e8f00476438555f89cb`. The native narrow-screen header/footer/labels, adaptive full-brand launcher icon, removal of Application-level post-layout UI rewriting, and single fail-closed latest-version login gate with automatic APK download, SHA-256 verification and Android installer handoff are therefore **technical source/build/sign/release PASS**. This Android-only change did not require a Worker runtime mutation. Physical-device behavior and Owner business acceptance remain separate evidence levels."
)
pattern = re.compile(r"The current technical Beta baseline is `beta-vc\d+`, schema v5\..*?Physical-device behavior and Owner business acceptance remain separate evidence levels\.", re.S)
updated, count = pattern.subn(replacement, acceptance, count=1)
if count != 1:
    raise SystemExit(f"ACCEPTANCE_FRONTIER_REPLACE_COUNT={count}")
acceptance_path.write_text(updated, encoding="utf-8")

# Generated continuity/readiness views must carry exact current-state markers.
handover = f'''# HANDOVER_CURRENT — SUPRA Inventory

> GENERATED/DERIVED CONTINUITY VIEW. **Never bootstrap from this file alone.** Canonical context/state/decisions/specs/resources live in the files listed by `ops/authority-manifest.json`. CI must fail if key status markers here drift from `ops/project-state.json`.

## Current status

- Project: `SUPRA Inventory — Báo hàng` (`supra-inventory`).
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `{ANDROID_STATUS}`
- Latest signed Beta APK: `{RELEASE}`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `{USER_STATUS}`
- Admin dashboard/reporting: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `{SOURCE_COMMIT}`
- Signed release: `{RELEASE}` / `{RELEASE_NAME}`
- APK SHA-256: `{APK_SHA256}`
- APK size: `{APK_SIZE}` bytes
- PR #8 authority + continuity + Practical Balanced source + Worker typecheck + Web production + Android debug: PASS
- Post-merge main authority + continuity + Practical Balanced/Android debug: PASS
- Android signed monotonic release: vc32 → vc33 PASS
- Android-only change: no Worker runtime mutation required.

## Workboard

### In progress
- No automated implementation task remains for the Owner-requested APK remediation.

### Next / field acceptance
- Owner field-test signed `beta-vc33` on a physical PDA: update gate/install handoff, Picker login/default-password behavior, narrow-screen layout, launcher icon and role workflows.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of `beta-vc33` on physical PDA.
- Physical PDA FCM delivery acceptance.
- Isolated mutation load acceptance requires an Owner workload target/test boundary.

## Continuity rule

No manual end-of-session handover is required. A new AI session must bootstrap from `AGENTS.md` and `ops/authority-manifest.json`, then read canonical files before mutation.
'''
(ROOT / "docs/handovers/HANDOVER_CURRENT.md").write_text(handover, encoding="utf-8")

readiness = f'''# SERVICE_READINESS — Derived current view

> DERIVED VIEW. Canonical live status is `ops/project-state.json`; resource identity is `ops/resource-registry.json`. CI must fail if key markers below drift from canonical state.

- Project: `supra-inventory`
- Beta: `ROLE_BASED_WEB_ANDROID_LIVE`
- Stable: `CONFIG_READY_OWNER_GATED_NOT_LIVE`
- SQLite schema: `5`
- Web: `PRACTICAL_BALANCED_CANONICAL_SOURCE_BETA_DEPLOY_SMOKE_PASS`
- Android: `{ANDROID_STATUS}`
- Latest signed Beta APK: `{RELEASE}`
- Realtime: `WEBSOCKET_SERVER_WEB_ANDROID_CLIENT_DEPLOYED_SIGNED_PASS`
- FCM: `DEVICE_REGISTRATION_AND_BACKGROUND_DELIVERY_DEPLOYED_BUILD_PASS_FIELD_DELIVERY_PENDING`
- User management: `{USER_STATUS}`
- Archive: `IDEMPOTENT_SHEET_ARCHIVE_AND_SAFE_60D_RETENTION_BETA_DEPLOY_PASS`
- Admin dashboard: `OPERATIONAL_DASHBOARD_AND_REPORTING_BETA_DEPLOY_PASS`
- Quota/resilience: `INDEXED_REPORTING_DELTA_CATALOG_NONDESTRUCTIVE_BURST_PASS`
- UI design guard: `PRACTICAL_BALANCED_CANONICAL_SOURCE_GUARD_PASS`

## Runtime evidence

- Runtime source commit: `{SOURCE_COMMIT}`
- Signed Android release: `{RELEASE}` (`{RELEASE_NAME}`)
- APK SHA-256: `{APK_SHA256}`
- APK size: `{APK_SIZE}` bytes
- PR #8 authority + continuity + Practical Balanced source + Worker typecheck + Web production + Android debug: PASS
- Post-merge main authority + continuity + Practical Balanced/Android debug: PASS
- Android monotonic release: vc32 → vc33 PASS
- Android-only change: no Worker runtime mutation required.

## Remaining acceptance work

- Owner business/UI field acceptance of `beta-vc33` on physical PDA.
- Physical logged-in PDA realtime/FCM delivery verification.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Use signed `{RELEASE}` as the current technical Beta baseline for Owner physical-PDA testing. Stable remains gated.

Stable remains Owner-gated.
'''
(ROOT / "docs/SERVICE_READINESS.md").write_text(readiness, encoding="utf-8")

print("VC33_RUNTIME_EVIDENCE_FINALIZED")
