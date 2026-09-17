#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def fail(msg: str) -> None:
    print(f"AUTHORITY_GUARD_FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

def load_json(path: str) -> dict:
    p = ROOT / path
    if not p.exists(): fail(f"missing {path}")
    try: return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc: fail(f"invalid JSON {path}: {exc}")

def main() -> None:
    manifest = load_json("ops/authority-manifest.json")
    state = load_json("ops/project-state.json")
    scope = load_json("ops/project-scope.json")
    if manifest.get("authority_model") != "REPO_NATIVE_COMPLETE": fail("authority model mismatch")
    if state.get("state_model") != "REPO_NATIVE_CONTINUITY_COMPLETE": fail("project state model mismatch")
    keys = {manifest.get("project_key"), state.get("project_key"), scope.get("project_key")}
    if keys != {"supra-inventory"}: fail(f"project key mismatch: {keys}")
    repo = scope.get("repository", {})
    if str(repo.get("id")) != "1372407002" or repo.get("name") != "tamnv2/supra-inventory": fail("repository scope mismatch")
    for path in manifest.get("bootstrap_order", []):
        if path in {"recent_commits_and_ci", "relevant_live_source"}: continue
        p = ROOT / path
        if path.endswith("/"):
            if not p.is_dir(): fail(f"missing directory {path}")
        elif not p.exists(): fail(f"missing bootstrap source {path}")
    specs = manifest.get("canonical_sources", {}).get("product_specs", [])
    if len(specs) < 9: fail("full spec coverage missing")
    spec_index = (ROOT / "docs/specs/README.md").read_text(encoding="utf-8")
    for path in specs:
        if not (ROOT / path).exists(): fail(f"missing canonical spec {path}")
        if Path(path).name not in spec_index: fail(f"spec index missing {path}")
    resources = scope.get("resources", [])
    if not resources: fail("project scope resources empty")
    seen = set()
    for r in resources:
        key = r.get("key")
        if not key or key in seen: fail(f"invalid/duplicate resource key {key}")
        seen.add(key)
        if not r.get("id") and not r.get("name"): fail(f"resource lacks id/name: {key}")
        if "secret_value" in r: fail(f"secret value field forbidden: {key}")
    for s in scope.get("secret_references", []):
        if s.get("value_in_repo") is not False: fail(f"secret reference must assert value_in_repo=false: {s.get('name')}")
    setup = state.get("authority_setup", {})
    if setup.get("status") != "PASS_COMPLETE": fail("authority setup not complete")
    for n in range(1, 6):
        if "PASS" not in str(next((v for k,v in setup.items() if k.startswith(f"requirement_{n}_")), "")): fail(f"requirement {n} not PASS")
    if not isinstance(state.get("workboard"), dict): fail("workboard missing")
    cs = state.get("current_status", {})
    markers = [str(cs.get("sqlite_schema")), str(cs.get("latest_beta_apk")), str(cs.get("web")), str(cs.get("android"))]
    for derived in manifest.get("derived_views", []):
        text = (ROOT / derived).read_text(encoding="utf-8")
        for marker in markers:
            if marker and marker not in text: fail(f"stale derived view {derived}: missing {marker}")
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("ops/project-scope.json","docs/PROJECT_CONTEXT.md","ops/authority-manifest.json","docs/OPERATING_PROTOCOL.md"):
        if marker not in agents: fail(f"AGENTS bootstrap missing {marker}")
    decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
    for did in ("D027","D028","D029","D030","D031","D032"):
        if did not in decisions: fail(f"decision ledger missing {did}")
    print("AUTHORITY_GUARD_PASS")

if __name__ == "__main__": main()
