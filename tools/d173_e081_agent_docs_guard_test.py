#!/usr/bin/env python3
"""D173-E081: docs/CI only merges never trigger a signed Agent release."""
from pathlib import Path
s=(Path(__file__).resolve().parents[1]/".github/workflows/verify-relay-agent.yml").read_text(encoding="utf-8")
assert "D173-E079_AGENT_ONLY_RELEASE:" in s
line=next(l for l in s.splitlines() if l.startswith("    if: ${{"))
assert "github.event_name == 'push'" in line
for prefix in ("docs(", "ci("):
    assert f"startsWith(github.event.head_commit.message, '{prefix}')" in line
assert "D170_PHASE3B_OAUTH_WORKER_ONLY:" in line
assert "D173 E079 Agent152 scoped source preflight" in s
assert "python tools/d173_e081_agent_docs_guard_test.py" in s
print("D173_E081_DOCS_CI_ONLY_SIGNED_AGENT_RELEASE_SKIP_GUARD_PASS")
