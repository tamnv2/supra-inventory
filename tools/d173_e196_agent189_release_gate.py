#!/usr/bin/env python3
"""D173-E196 Agent189: exact Owner scope and protected Agent-only release."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "a8ff7fa267702655558ffcb1acd53b159ff1f2a6"
SOURCE = "eb5a6be9447f9c26a19f5222c04f9d63fe6746bf"
MARKER = "D173-E196_AGENT189_ONLY_RELEASE:"
AUTH = "ops/d173-e196-agent189-release-authorization.json"
ALLOWED = {
    ".github/workflows/d173-e196-agent-code-only.yml",
    ".github/workflows/d173-e196-agent189-release.yml",
    "docs/D173_E196_AGENT_WEB_SESSION_DIAG_PERFORMANCE_2026-11-11.md",
    "docs/OWNER_DECISIONS.md",
    "ops/change-continuity/D173.json",
    "ops/project-state.json",
    "ops/resource-registry.json",
    "tools/authority_guard.py",
    "ops/authority-manifest.json",
    "ops/current-context.json",
    "ops/d173-e196-agent189-release-authorization.json",
    "relay-agent-webview2-host/Program.cs",
    "relay-agent/D119AgentFeatures.cs",
    "relay-agent/D157AgentFeatures.cs",
    "relay-agent/D167SkuCoordinator.cs",
    "relay-agent/D173E141VpsWebMonitor.cs",
    "relay-agent/D173E196BrowserSession.cs",
    "relay-agent/D173E196WebVisualProbe.cs",
    "relay-agent/Program.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/AgentConfig.cs",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "relay-agent/VERSION",
    "tests/d173-e196-agent-web-session.test.mjs",
    "tools/d173_e196_agent189_release_gate.py",
}

def deny(reason):
    raise SystemExit("D173_E196_AGENT189_DENIED:" + reason)

def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if p.returncode:
        deny("GIT_" + args[0] + ":" + p.stderr[-140:].strip())
    return p.stdout.strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preflight", action="store_true")
    args = parser.parse_args()
    auth = json.loads((ROOT / AUTH).read_text(encoding="utf-8"))
    expected = {
        "project": "supra-inventory",
        "change": "D173-E196",
        "owner_release_approved": True,
        "component": "agent",
        "target_version": 189,
        "source_main_sha": BASE,
        "source_pin": SOURCE,
        "existing_host_build": 14,
        "host_runtime_release": False,
        "worker_release": False,
        "web_release": False,
        "android_release": False,
        "d172_mutation": False,
        "stable_mutation": False,
        "new_provider_resources": False,
        "release_marker": MARKER,
        "field_pass": False,
        "owner_pass": False,
    }
    for key, value in expected.items():
        if auth.get(key) != value:
            deny("AUTH_" + key)
    if (ROOT / "relay-agent/VERSION").read_text(encoding="utf-8").strip() != "189":
        deny("VERSION")
    if "AgentBuild = 189;" not in (ROOT / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8"):
        deny("AGENT_BUILD")
    if "<AssemblyVersion>0.189.0.0</AssemblyVersion>" not in (ROOT / "relay-agent/SupraInventoryRelayAgent.csproj").read_text(encoding="utf-8"):
        deny("ASSEMBLY")
    if "RequiredHostBuild = 14;" not in (ROOT / "relay-agent/AgentBrowserBundle.cs").read_text(encoding="utf-8"):
        deny("HOST14_BASELINE")
    git("merge-base", "--is-ancestor", SOURCE, "HEAD")
    git("merge-base", "--is-ancestor", BASE, "HEAD")
    if git("rev-parse", SOURCE + ":relay-agent") != git("rev-parse", "HEAD:relay-agent"):
        deny("AGENT_SOURCE_PIN_DRIFT")
    diff = set(git("diff", "--name-only", BASE, "HEAD").splitlines())
    extra = sorted(diff - ALLOWED)
    if not diff or extra:
        deny("OUT_OF_SCOPE:" + ",".join(extra))
    # Exact metadata correction only; no resource identity or provider changes.
    prior = json.loads(git("show", BASE + ":ops/resource-registry.json"))
    current = json.loads((ROOT / "ops/resource-registry.json").read_text(encoding="utf-8"))
    expected_agent = "relay-agent-v188__D173_E195_SIGNED_RELEASE_PASS__FIELD_OWNER_PENDING"
    if current.get("environments", {}).get("beta", {}).get("relay_agent_release") != expected_agent:
        deny("AGENT188_RESOURCE_REGISTRY_PIN")
    prior["environments"]["beta"]["relay_agent_release"] = expected_agent
    if prior != current:
        deny("RESOURCE_REGISTRY_UNRELATED_CHANGE")
    proof = json.loads((ROOT / "ops/project-state.json").read_text(encoding="utf-8")).get("d173_e195_agent188", {}).get("release_evidence", {})
    if (proof.get("tag") != "relay-agent-v188" or
            proof.get("exe_sha256") != "822a705fe1d099fd6ffec81558acd124c9c0410ec1da2b39a01cd78595551126" or
            proof.get("run_id") != 43044971567):
        deny("AGENT188_RELEASE_EVIDENCE")
    if args.preflight:
        if git("merge-base", "origin/main", "HEAD") != BASE:
            deny("MAIN_ADVANCED_REBASE_REQUIRED")
    else:
        parents = git("rev-list", "--parents", "-n", "1", "HEAD").split()
        if len(parents) != 3 or parents[1] != BASE:
            deny("PROTECTED_TWO_PARENT_MERGE_REQUIRED")
        if not git("log", "-1", "--format=%s").startswith(MARKER):
            deny("RELEASE_MARKER")
    print("D173_E196_AGENT189_PIN_SCOPE_PASS")

if __name__ == "__main__":
    main()
