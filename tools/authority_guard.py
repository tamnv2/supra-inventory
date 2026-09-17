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
    if manifest.get("authority_model") != "REPO_NATIVE_V2": fail("authority model mismatch")
    for path in manifest.get("bootstrap_order", []):
        if path in {"recent_commits_and_ci", "relevant_live_source"}: continue
        p = ROOT / path
        if path.endswith("/"):
            if not p.is_dir(): fail(f"missing directory {path}")
        elif not p.exists(): fail(f"missing bootstrap source {path}")
    if state.get("state_model") != "REPO_NATIVE_CONTINUITY_V2": fail("project state model is not V2")
    if not isinstance(state.get("workboard"), dict): fail("workboard missing")
    cs = state.get("current_status", {})
    required_markers = [str(cs.get("sqlite_schema")), str(cs.get("latest_beta_apk")), str(cs.get("web")), str(cs.get("android"))]
    for derived in manifest.get("derived_views", []):
        text = (ROOT / derived).read_text(encoding="utf-8")
        for marker in required_markers:
            if marker and marker not in text: fail(f"stale derived view {derived}: missing {marker}")
    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    for marker in ("docs/PROJECT_CONTEXT.md", "ops/authority-manifest.json", "docs/specs/README.md"):
        if marker not in agents: fail(f"AGENTS bootstrap missing {marker}")
    decisions = (ROOT / "docs/OWNER_DECISIONS.md").read_text(encoding="utf-8")
    for did in ("D027", "D028", "D029", "D030", "D031"):
        if did not in decisions: fail(f"decision ledger missing {did}")
    print("AUTHORITY_GUARD_PASS")

if __name__ == "__main__": main()
