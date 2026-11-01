#!/usr/bin/env python3
"""Allow the exact E109 public-asset source diff, never deployment authority."""
import argparse
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONFIG = "service/wrangler.beta.toml"
ANCHOR = "run_worker_first = true\n"
ASSET_ROUTING = (
    "# Only public Vite bundles bypass the Worker. All APIs, health, OAuth,\n"
    "# downloads, HTML and legal pages retain their existing Worker routing.\n"
    'run_worker_first = ["/*", "!/assets/*"]\n'
)


def validate(approval: dict, previous: str, candidate: str, changed: list[str]) -> None:
    assert approval.get("schema_version") == 1 and approval.get("project_key") == "supra-inventory"
    assert approval.get("change_id") == "D173" and approval.get("checkpoint_id") == "D173-E109"
    assert approval.get("status") == "OWNER_CODE_ONLY_APPROVED"
    assert approval.get("scope") == "E108_P1_P4_FULL_CODE_AND_OFFLINE_SOURCE_BUILD_REGRESSION"
    assert approval.get("code_permission") is True and approval.get("stop_at") == "CODE_READY"
    assert approval.get("approved_components") == ["service", "web", "android", "tests", "docs"]
    for permission in ("merge_main_permission", "deployment_permission", "provider_write_permission",
                       "ota_publication_permission", "stable_permission", "d172_business_changes"):
        assert approval.get(permission) is False, f"E109 is code-only: {permission} must remain false"
    assert approval.get("production_base") == "ops/production-analysis-base-20261101.json"
    assert previous.count(ANCHOR) == 1, "Reconcile/review current-main asset routing before changing this exception"
    assert candidate == previous.replace(ANCHOR, ASSET_ROUTING, 1), "Only the reviewed public-asset routing source change is allowed"
    forbidden = [path for path in changed if (
        path.startswith(("firebase/", "obpp1291/", "service/src/obpp1291-", ".github/workflows/deploy-stable"))
        or path in ("firebase.json", "service/wrangler.stable.toml", ".github/workflows/deploy-beta-firestore.yml",
                    "ops/project-scope.json", "ops/resource-registry.json")
        or (path.startswith("service/wrangler") and path != CONFIG)
    )]
    assert not forbidden, "E109 source exception cannot change provider/Stable/D172 scope: " + ", ".join(forbidden)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", default="origin/main")
    args = parser.parse_args()
    approval = json.loads((ROOT / "ops/d173-e109-code-authorization.json").read_text(encoding="utf-8"))
    previous = subprocess.check_output(["git", "show", args.base_ref + ":" + CONFIG], cwd=ROOT, text=True, encoding="utf-8")
    candidate = (ROOT / CONFIG).read_text(encoding="utf-8")
    changed = subprocess.check_output(["git", "diff", "--name-only", args.base_ref + "...HEAD"], cwd=ROOT,
                                      text=True, encoding="utf-8").splitlines()
    validate(approval, previous, candidate, changed)
    print("D173_E109_EXACT_PUBLIC_ASSET_CODE_SCOPE_PASS__NO_MERGE_DEPLOY_PROVIDER_OTA_STABLE_PERMISSION")


if __name__ == "__main__":
    main()
