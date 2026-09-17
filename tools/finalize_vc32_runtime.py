#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = "beta-vc32"
RELEASE_NAME = "SUPRA Inventory Beta 0.2.0-beta.32"
SOURCE_COMMIT = "444f89d9ace5b5405f4f436b3be27869f16571e2"
APK_SHA256 = "4fc20b00397bf0af7f149aef5fd9d42e68ee6f3223f8e84efb4349075c654884"
APK_SIZE = 9168718
ANDROID_STATUS = "PRACTICAL_BALANCED_SIGNED_BETA_VC32_MANDATORY_UPDATE_GATE_PASS"
USER_STATUS = "EXPANDED_ROOT_ADMIN_PICKER_LIFECYCLE_FLEXIBLE_HR_DIRECT_PASSWORD_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS"


def load_json(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def write_json(path: str, value: dict) -> None:
    (ROOT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# Canonical project scope: record the secret reference used by current source without exposing its value.
scope = load_json("ops/project-scope.json")
refs = scope.setdefault("secret_references", [])
if not any(item.get("name") == "PICKER_DEFAULT_PASSWORD" for item in refs):
    refs.append({
        "name": "PICKER_DEFAULT_PASSWORD",
        "storage": "Cloudflare Worker secret",
        "value_in_repo": False,
    })
write_json("ops/project-scope.json", scope)

# Resource registry: record verified Beta runtime/release evidence.
registry = load_json("ops/resource-registry.json")
beta = registry["environments"]["beta"]
beta.update({
    "android_source_status": ANDROID_STATUS,
    "latest_signed_beta_release": RELEASE,
    "latest_signed_beta_release_name": RELEASE_NAME,
    "latest_signed_beta_apk_sha256": APK_SHA256,
    "latest_signed_beta_apk_size_bytes": APK_SIZE,
    "latest_signed_beta_release_source_commit": SOURCE_COMMIT,
    "auth_rbac_status": "EXPANDED_ROOT_ADMIN_REPORTER_PICKER_LIFECYCLE_WITH_LEGACY_PICKER_BOOTSTRAP_DEPLOYED_BUILD_PASS",
    "picker_default_password_secret": "PICKER_DEFAULT_PASSWORD",
    "legacy_picker_uninitialized_password_bootstrap": "DEPLOYED_BETA_PASS_PROTECTED_RUNTIME_DEFAULT_WITH_ROOT_BOOTSTRAP_FALLBACK",
})
completed = registry.setdefault("application_build_completed", [])
marker = "android_vc32_mandatory_update_gate_adaptive_icon_legacy_picker_bootstrap_pass"
if marker not in completed:
    completed.append(marker)
user_mgmt = registry.setdefault("user_management", {})
user_mgmt["source_status"] = "IMPLEMENTED_DEPLOYED_BUILD_PASS_WITH_LEGACY_PICKER_BOOTSTRAP"
user_mgmt["legacy_uninitialized_picker_password_bootstrap"] = "DEPLOYED_BETA_PASS_PROTECTED_RUNTIME_DEFAULT_WITH_ROOT_BOOTSTRAP_FALLBACK"
registry.setdefault("ui_design", {})["android"] = ANDROID_STATUS
write_json("ops/resource-registry.json", registry)

# Canonical live state: promote only evidence proven by PR CI + Beta deploy + signed release.
state = load_json("ops/project-state.json")
state["current_status"]["android"] = ANDROID_STATUS
state["current_status"]["latest_beta_apk"] = RELEASE
state["current_status"]["user_management"] = USER_STATUS
capability = (
    "Android Beta vc32 remediation: PR #6 authority/continuity/UI/build PASS; Beta Worker deploy + health/auth/business/Web/OAuth smoke PASS; "
    f"signed {RELEASE} versionCode 32 published from {SOURCE_COMMIT}, APK SHA-256 {APK_SHA256}, size {APK_SIZE} bytes; mandatory update login gate, adaptive launcher icon, narrow-screen cleanup and legacy Picker password bootstrap are technical runtime PASS"
)
if capability not in state["completed_capabilities"]:
    state["completed_capabilities"].append(capability)
state["pending_build"] = [
    item for item in state.get("pending_build", [])
    if not item.startswith("Android vc32 remediation is in progress")
]
state["field_pending"] = [
    "Owner physical-PDA verification of beta-vc32 login/update/UI/icon behavior remains field acceptance; technical runtime/release is PASS.",
    "Physical logged-in PDA FCM delivery remains field-pending.",
]
state["next_action"] = {
    "primary": "Owner field-test signed beta-vc32 on a physical PDA: confirm update gate/install flow, Picker login/default-password behavior, narrow-screen UI alignment, launcher icon and operational workflows; record numbered findings if any.",
    "method": "Use beta-vc32 as the current technical Beta baseline. Technical build/deploy/release is PASS; device/Owner business acceptance remains separate.",
    "stable_guard": "Do not activate Stable.",
}
state["workboard"]["in_progress"] = []
state["workboard"]["next"] = [
    "Owner field-test signed beta-vc32 on physical PDA and report numbered findings if any",
    "Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA",
    "Run isolated business-mutation load acceptance after Owner defines scale target/test boundary",
]
state["workboard"]["blocked_or_owner_field_dependent"] = [
    "Owner business/UI acceptance of beta-vc32 on physical PDA",
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
    "runtime_ui_baseline": "PRACTICAL_BALANCED",
    "verification_basis": "PR #6 authority + continuity + Practical Balanced source guard + Worker typecheck + Web production + Android debug PASS; main Beta Worker deploy/health/auth/business/Web/OAuth smoke PASS; signed Android beta-vc32 release publish PASS with monotonic 31→32 versionCode.",
}
write_json("ops/project-state.json", state)

# Acceptance frontier now reflects technical PASS while retaining device/Owner separation.
acceptance_path = ROOT / "docs/specs/ACCEPTANCE_TESTING.md"
acceptance = acceptance_path.read_text(encoding="utf-8")
old = (
    "The last deployed/signed baseline before the current change is `beta-vc31`, schema v5. The current Android-focused change addresses physical-device evidence from the Owner: narrow-screen login/header breakage, legacy Picker password initialization, mandatory latest-version login gating, adaptive launcher icon treatment and removal of non-operational UI prose. Until the current branch passes required CI, Beta deploy and signed APK publishing, those changes are **source/spec pending verification**, not runtime PASS."
)
new = (
    "The current technical Beta baseline is `beta-vc32`, schema v5. PR #6 passed authority, continuity, Practical Balanced source validation, Worker typecheck, Web production and Android debug gates; the merged main commit passed Beta Worker deploy/health/auth/business/Web/OAuth smoke and published the signed monotonic Android release `beta-vc32`. The narrow-screen login/header remediation, legacy Picker password initialization path, mandatory latest-version login gate, adaptive launcher icon treatment and removal of non-operational UI prose are therefore **technical runtime/release PASS**. Physical-device behavior and Owner business acceptance remain separate evidence levels."
)
if old not in acceptance:
    raise SystemExit("ACCEPTANCE_FRONTIER_ANCHOR_NOT_FOUND")
acceptance_path.write_text(acceptance.replace(old, new, 1), encoding="utf-8")

# Clarify that the shorter footer supersession applies only to Android/PDA.
decisions_path = ROOT / "docs/OWNER_DECISIONS.md"
decisions = decisions_path.read_text(encoding="utf-8")
decisions = decisions.replace(
    "- The exact old footer wording inside D036 is superseded by D040; the rest of D036 remains active.",
    "- The exact old footer wording inside D036 is superseded by D040 for Android/PDA only; Web retains its existing credit wording and the rest of D036 remains active.",
)
decisions_path.write_text(decisions, encoding="utf-8")

# Keep the spec index terminology aligned with the active visual authority.
index_path = ROOT / "docs/specs/README.md"
index = index_path.read_text(encoding="utf-8").replace(
    "`UI_DESIGN_SYSTEM.md` — Owner-selected Concept 3 design authority.",
    "`UI_DESIGN_SYSTEM.md` — Owner-selected Practical Balanced / Phương án 1 design authority.",
)
index_path.write_text(index, encoding="utf-8")

# Generated/derived continuity views are rewritten from the proven runtime markers.
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
- Beta Worker/Web deploy + health/auth/business/Web/OAuth smoke: PASS
- PR #6 authority + continuity + Practical Balanced source + Worker typecheck + Web production + Android debug: PASS
- Android signed monotonic release: vc31 → vc32 PASS

## Workboard

### In progress
- No automated implementation task remains for the Owner-requested vc32 remediation.

### Next / field acceptance
- Owner field-test signed `beta-vc32` on a physical PDA: update gate/install, Picker login/default-password behavior, narrow-screen layout, launcher icon and role workflows.
- Field-verify foreground realtime and background FCM delivery on a logged-in physical PDA.
- Run isolated business-mutation load acceptance after Owner defines scale target/test boundary.

### Blocked / Owner-field dependent
- Owner business/UI acceptance of `beta-vc32` on physical PDA.
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
- Beta Worker/Web deploy + health/auth/business/Web/OAuth smoke: PASS
- Android monotonic release: vc31 → vc32 PASS

## Remaining acceptance work

- Owner business/UI field acceptance of `beta-vc32` on physical PDA.
- Physical logged-in PDA realtime/FCM delivery verification.
- Isolated business-mutation load acceptance after Owner scale target is defined.

## Next action

Use signed `{RELEASE}` as the current technical Beta baseline for Owner physical-PDA testing. Stable remains gated.

Stable remains Owner-gated.
'''
(ROOT / "docs/SERVICE_READINESS.md").write_text(readiness, encoding="utf-8")

print("VC32_RUNTIME_EVIDENCE_FINALIZED")
