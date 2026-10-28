#!/usr/bin/env python3
"""E071: fail-closed Windows UTF-8 Git show and exact approved Worker note regression."""
from pathlib import Path
from d173_e069_agent_release_gate import BASE, ROOT, git

f = "service/src/d173-vps-usage.ts"
source = git("show", BASE + ":" + f)
if source.returncode != 0 or not source.stdout:
    raise SystemExit("D173_E071_UTF8_GIT_SHOW_FAILED")
current = (ROOT / f).read_text(encoding="utf-8")
new = "50% Inventory is an internal planning allocation of included Cloudflare pools; not a USD charge cap."
old = "30% Inventory is an internal planning allocation only."
version=(ROOT/"relay-agent/VERSION").read_text(encoding="utf-8").strip()
if int(version)>=153:
    # E071's source equality was an immutable Agent150-only release contract.
    # E084 separately authorizes the VPS read-only Worker collector and its
    # source/CI/D172 regression; never use E071 to block or authorize v153.
    receipt=(ROOT/"docs/D173_E084_AGENT153_USAGE_RELEASE_2026-10-27.md")
    guard=(ROOT/"tools/d173_e084_agent153_source_test.py")
    if not receipt.is_file() or not guard.is_file() or "groupedCloudflare" not in current:
        raise SystemExit("D173_E084_SCOPED_WORKER_SOURCE_GUARD_MISSING")
else:
    if current.count(new) != 1 or current.replace(new, old) != source.stdout:
        raise SystemExit("D173_E071_WORKER_NONCOMMENT_CHANGE_DENIED")
release_gate = (ROOT / "tools/d173_e069_agent_release_gate.py").read_text(encoding="utf-8")
if 'encoding="utf-8"' not in release_gate:
    raise SystemExit("D173_E071_WINDOWS_ENCODING_GUARD_NOT_PRESENT")
print("D173_E071_WINDOWS_UTF8_EXACT_WORKER_COMMENT_GUARD_PASS")
