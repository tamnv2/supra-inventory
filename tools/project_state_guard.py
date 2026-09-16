#!/usr/bin/env python3
"""Validate repo-native continuity state for SUPRA Inventory.

This guard intentionally contains no credentials and performs no cloud mutations.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "ops" / "project-state.json"
REGISTRY = ROOT / "ops" / "resource-registry.json"
DECISIONS = ROOT / "docs" / "OWNER_DECISIONS.md"
HANDOVER = ROOT / "docs" / "handovers" / "HANDOVER_CURRENT.md"
AGENTS = ROOT / "AGENTS.md"


def fail(message: str) -> None:
    print(f"PROJECT_STATE_GUARD_FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    if not path.exists():
        fail(f"missing {path.relative_to(ROOT)}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def main() -> None:
    state = load_json(STATE)
    registry = load_json(REGISTRY)

    for path in (DECISIONS, HANDOVER, AGENTS):
        if not path.exists():
            fail(f"missing {path.relative_to(ROOT)}")

    if state.get("project_key") != "supra-inventory":
        fail("project-state project_key mismatch")
    if state.get("repository") != "tamnv2/supra-inventory":
        fail("project-state repository mismatch")
    if registry.get("project", {}).get("key") != "supra-inventory":
        fail("resource-registry project key mismatch")
    if registry.get("project", {}).get("repository") != "tamnv2/supra-inventory":
        fail("resource-registry repository mismatch")

    beta_state = state.get("current_status", {}).get("beta")
    beta_registry = registry.get("environments", {}).get("beta", {}).get("status")
    if beta_state != beta_registry:
        fail(f"Beta status drift: state={beta_state!r} registry={beta_registry!r}")

    stable_state = state.get("current_status", {}).get("stable")
    stable_registry = registry.get("environments", {}).get("stable", {}).get("status")
    if stable_state != stable_registry:
        fail(f"Stable status drift: state={stable_state!r} registry={stable_registry!r}")
    if "OWNER_GATED" not in str(stable_state):
        fail("Stable guard missing from canonical state")

    schema_state = state.get("current_status", {}).get("sqlite_schema")
    schema_registry = registry.get("cloudflare", {}).get("beta_sqlite_schema_version")
    if schema_state != schema_registry:
        fail(f"SQLite schema drift: state={schema_state!r} registry={schema_registry!r}")

    policy = state.get("continuity_policy", {})
    if policy.get("manual_handover_required") is not False:
        fail("manual handover must remain disabled")
    if policy.get("meaningful_change_requires_state_update") is not True:
        fail("meaningful-change state update guard must remain enabled")
    if policy.get("owner_decision_requires_ledger_update") is not True:
        fail("Owner decision ledger guard must remain enabled")

    decisions_text = DECISIONS.read_text(encoding="utf-8")
    if "D020" not in decisions_text or "Manual end-of-chat handover" not in decisions_text:
        fail("Owner decision ledger is missing continuity decision D020")

    handover_text = HANDOVER.read_text(encoding="utf-8")
    if "GENERATED/DERIVED CONTINUITY VIEW" not in handover_text:
        fail("HANDOVER_CURRENT must remain a generated/derived view")
    if "No manual end-of-session handover is required" not in handover_text:
        fail("HANDOVER_CURRENT continuity contract missing")

    agents_text = AGENTS.read_text(encoding="utf-8")
    if "ops/project-state.json" not in agents_text:
        fail("AGENTS.md must bootstrap ops/project-state.json")
    if "docs/OWNER_DECISIONS.md" not in agents_text:
        fail("AGENTS.md must bootstrap docs/OWNER_DECISIONS.md")

    print("PROJECT_STATE_GUARD_PASS")


if __name__ == "__main__":
    main()
