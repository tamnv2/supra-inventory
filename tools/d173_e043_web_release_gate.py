#!/usr/bin/env python3
"""D173-E043: Web 3.3.1 visual rollback only; immutable source/Owner-gated Worker assets release."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "736ec32359a752d75aa1436be02296573d456bfc"
RECEIPT = ROOT / "ops/d173-e043-web-release-authorization.json"
MARKER = "D173-E043_WEB_ONLY_RELEASE:"
PROTECTED = (
    "service/", "web/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    ".github/workflows/", "tools/", "ops/project-scope.json",
    "ops/resource-registry.json", "ops/apps-script/",
)
ISOLATED = (
    "service/", "android/", "relay-agent/", "relay-agent-webview2-host/",
    "functions/", "firebase/", "firebase.json", "obpp1291/", "pda-management/",
    "ops/apps-script/", "ops/project-scope.json", "ops/resource-registry.json",
)
ALLOWED = {
    "web/src/operational-app.ts", "web/src/web-version.ts", "web/package.json",
    "tests/d167-web-ux-consistency.test.mjs",
    "tests/d170-d171-release-parity.test.mjs",
    "tests/d171-single-production-freeze.test.mjs",
    "tests/d171-log-delivery.test.mjs", "tests/d171-usage-hotpaths.test.mjs",
    "tests/d173-e032-ui-code-only.test.mjs", "tests/d173-e034-release-gate.test.mjs",
    "tests/d173-e036-unified-presentation.test.mjs",
    "tests/d173-e043-web-release.test.mjs",
    "docs/OWNER_DECISIONS.md", "docs/specs/UI_DESIGN_SYSTEM.md",
    "docs/specs/ACCEPTANCE_TESTING.md",
    "ops/authority-manifest.json", "ops/change-continuity/D173.json",
    "ops/project-state.json", "ops/d173-e043-web-release-authorization.json",
    ".github/workflows/deploy-beta.yml",
    ".github/workflows/d173-email-sender-guard.yml",
    "tools/d167_release_gate.py", "tools/d173_e043_web_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E043_WEB_RELEASE_DENIED: " + reason)

def git(*args):
    return subprocess.run(("git", *args), cwd=ROOT, capture_output=True, text=True, check=False)

def content_at(ref, path):
    p = git("show", ref + ":" + path)
    if p.returncode:
        deny("baseline unavailable: " + path)
    return p.stdout

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--component", required=True, choices=("worker",))
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    try:
        data = json.loads(RECEIPT.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        deny("missing/malformed exact-Owner receipt")
    if (data.get("change_id") != "D173" or data.get("checkpoint") != "D173-E043"
        or data.get("status") != "OWNER_EXPLICIT_DEPLOY_APPROVED"
        or data.get("owner_approval_reference") != "OWNER_20261025_WEB_330_VISUAL_REJECTION_AND_331_RELEASE_REQUEST"
        or data.get("approved_components") != ["worker"]
        or data.get("web_version") != "3.3.1"
        or data.get("production_host") != "inventory.supra.cc.cd"
        or data.get("existing_worker_name") != "supra-inventory-beta"
        or data.get("d172_lifecycle") != "PENDING_HOLD"
        or data.get("stable_deploy_permission") is not False):
        deny("Owner / registered Production scope mismatch")
    for key in (
        "agent_mutation", "android_mutation", "d172_business_mutation",
        "d172_ota_mutation", "firebase_rules_mutation", "gateway_mutation",
        "database_migration", "new_provider_resource", "field_pass", "owner_pass",
    ):
        if data.get(key) is not False:
            deny("unauthorized scope / inferred pass: " + key)
    pin = str(data.get("approved_source_sha") or "")
    if (not re.fullmatch(r"[0-9a-f]{40}", pin)
        or data.get("source_ci_sha") != pin
        or data.get("source_ci_verified") is not True
        or int(data.get("required_ci_success") or 0) < 26
        or data.get("required_ci_failed") != 0):
        deny("source CI verification absent or stale")
    if git("cat-file", "-e", pin + "^{commit}").returncode:
        deny("CI commit unavailable")
    if git("merge-base", "--is-ancestor", pin, "HEAD").returncode:
        deny("release does not descend from tested source")
    if git("diff", "--quiet", pin, "HEAD", "--", *PROTECTED).returncode:
        deny("source or workflow changed after exact CI pin")
    if git("merge-base", "--is-ancestor", BASE, "HEAD").returncode:
        deny("main production source lineage changed")
    if git("diff", "--quiet", BASE, "HEAD", "--", *ISOLATED).returncode:
        deny("Worker/Agent/Android/OBPP/shared runtime source drift")
    changed = git("diff", "--name-only", BASE, "HEAD")
    if changed.returncode:
        deny("cannot inspect change set")
    paths = set(changed.stdout.splitlines())
    if not paths or paths - ALLOWED:
        deny("outside Web-only authorized change set: " + repr(sorted(paths - ALLOWED)))
    app = (ROOT / "web/src/operational-app.ts").read_text(encoding="utf-8")
    previous = content_at(BASE, "web/src/operational-app.ts")
    line = 'import "./d173-e036-unified-design.css";' + chr(10)
    if previous.count(line) != 1 or app != previous.replace(line, ""):
        deny("Web business/DOM changed outside single presentation import")
    if 'import "./d173-tabler.css";' not in app:
        deny("prior Web 3.2 Tabler presentation missing")
    prev_package = json.loads(content_at(BASE, "web/package.json"))
    current_package = json.loads((ROOT / "web/package.json").read_text(encoding="utf-8"))
    if prev_package.get("version") != "3.3.0" or current_package.pop("version", None) != "3.3.1":
        deny("Web monotonic package version invalid")
    prev_package.pop("version")
    if current_package != prev_package:
        deny("unrelated Web dependency or build change")
    old_version = content_at(BASE, "web/src/web-version.ts")
    new_version = (ROOT / "web/src/web-version.ts").read_text(encoding="utf-8")
    if old_version.replace('WEB_VERSION = "3.3.0"', 'WEB_VERSION = "3.3.1"') != new_version:
        deny("non-monotonic Web version source change")
    config = (ROOT / "service/wrangler.beta.toml").read_text(encoding="utf-8")
    if ('name = "supra-inventory-beta"' not in config
        or 'pattern = "inventory.supra.cc.cd"' not in config
        or 'class_name = "InventoryCore"' not in config):
        deny("existing Worker/InventoryCore official Production identity changed")
    if args.preflight:
        print("D173_E043_WEB331_RELEASE_PREFLIGHT_PASS " + pin[:12])
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "push" or os.environ.get("GITHUB_REF") != "refs/heads/main":
        deny("not a protected main release")
    if not git("log", "-1", "--format=%s").stdout.strip().startswith(MARKER):
        deny("explicit release marker missing on protected main commit")
    print("D173_E043_WEB331_WORKER_ASSETS_RELEASE_APPROVED " + pin[:12])

if __name__ == "__main__":
    main()
