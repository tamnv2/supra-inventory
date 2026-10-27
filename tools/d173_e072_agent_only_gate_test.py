#!/usr/bin/env python3
"""Verify E069 Agent150-only release cannot regress to same-SHA Gateway/Rules loops."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
workflow = (root / ".github/workflows/verify-relay-agent.yml").read_text(encoding="utf-8")
baseline = "a22efb480039005789f998e862275fef2e7d0789"
for marker, scope, message in (
    ("D171 exact registered Gateway dependency before Agent publish", "ops/apps-script/", "D173_E072_EXISTING_GATEWAY_SOURCE_UNCHANGED_PASS"),
    ("D169 require matching Beta Firestore Rules before publishing Agent", "firebase/ firebase.json", "D173_E072_EXISTING_FIRESTORE_RULES_SOURCE_UNCHANGED_PASS"),
):
    heading = "      - name: " + marker
    if workflow.count(heading) != 1:
        raise SystemExit("D173_E072_RELEASE_GATE_HEADING_MISSING")
    step = workflow.split(heading, 1)[1].split("\n      - name:", 1)[0]
    branch = "if ((git log -1 --format=%s) -like 'D173-E069_AGENT_ONLY_RELEASE:*')"
    if (step.count(branch) != 1 or
        step.index(branch) > step.index("for ($attempt = 1; $attempt -le 120; $attempt++)") or
        "tools/d173_e069_agent_release_gate.py --component agent" not in step or
        f"git diff --quiet {baseline} HEAD -- {scope}" not in step or
        message not in step or
        "exit 0" not in step[step.index(branch):step.index("for ($attempt = 1; $attempt -le 120; $attempt++)")]):
        raise SystemExit("D173_E072_RELEASE_GATE_UNSAFE_OR_MISSING_" + marker.split()[0])
print("D173_E072_GATEWAY_FIRESTORE_SOURCE_PIN_EARLY_EXIT_PASS")
