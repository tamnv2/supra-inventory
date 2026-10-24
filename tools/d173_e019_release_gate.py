#!/usr/bin/env python3
"""D173-E019 exact-main receipt for one old custom-domain detach, no Worker deploy."""
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
def fail(reason):
    raise SystemExit("D173_E019_RELEASE_DENIED: " + reason)

def git(*args):
    return subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)

if os.getenv("GITHUB_EVENT_NAME") != "push" or os.getenv("GITHUB_REF") != "refs/heads/main":
    fail("only a protected main push")
try:
    receipt = json.loads((root / "ops/d173-e019-host-detach-authorization.json").read_text())
    scope = json.loads((root / "ops/project-scope.json").read_text())
except (OSError, ValueError):
    fail("missing or invalid canonical receipt/scope")
required = {
    "change_id": "D173",
    "decision_id": "D173-E019",
    "status": "OWNER_EXPLICIT_DEPLOY_APPROVED",
    "approved_components": ["host-beta"],
    "existing_worker": "supra-inventory-beta",
    "legacy_hostname": "inventory-beta.supra.cc.cd",
    "official_hostname": "inventory.supra.cc.cd",
    "keep_worker": True,
    "keep_durable_object_sqlite": True,
    "keep_firebase": True,
    "keep_d172_pending_hold": True,
    "stable_deploy_permission": False,
    "worker_script_deploy_permission": False,
    "dns_zone_delete_permission": False,
}
for key, expected in required.items():
    if receipt.get(key) != expected:
        fail("receipt scope mismatch: " + key)
if receipt.get("owner_approval_reference") != "OWNER_20261025_D173_AFTERSHIFT_LEGACY_HOST_ONLY_THEN_PHASE1":
    fail("Owner approval not pinned to this decision")
pin = receipt.get("approved_source_sha", "")
if not re.fullmatch(r"[0-9a-f]{40}", pin):
    fail("invalid source SHA")
if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
    fail("approved source is not ancestor of this commit")
allowed = {
    "ops/d173-e019-host-detach-authorization.json",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "ops/authority-manifest.json",
    "docs/OWNER_DECISIONS.md",
    "docs/D173_E019_LEGACY_SUNSET_2026-10-25.md",
}
changes = set(git("diff", "--name-only", pin, "HEAD").stdout.splitlines())
if not changes or "ops/d173-e019-host-detach-authorization.json" not in changes or not changes <= allowed:
    fail("post-approval source changes exceed receipt-only paths")
wrangler = (root / "service/wrangler.beta.toml").read_text()
if ('name = "supra-inventory-beta"' not in wrangler or
        'pattern = "inventory.supra.cc.cd"' not in wrangler or
        'pattern = "inventory-beta.supra.cc.cd"' in wrangler or
        'class_name = "InventoryCore"' not in wrangler):
    fail("existing Worker or DO / routes source invariants changed")
hosts = [x for x in scope.get("resources", []) if x.get("key") in ("host-beta", "host-stable", "worker-beta")]
if len(hosts) != 3 or any(x.get("current_binding_key") != "worker-beta" for x in hosts if x.get("kind") == "hostname"):
    fail("registered resource binding not verified")
print("D173_E019_EXACT_MAIN_OWNER_RECEIPT_AND_ONE_HOST_SCOPE_PASS__D172_HOLD")
