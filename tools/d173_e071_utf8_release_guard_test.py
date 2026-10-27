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
if current.count(new) != 1 or current.replace(new, old) != source.stdout:
    raise SystemExit("D173_E071_WORKER_NONCOMMENT_CHANGE_DENIED")
release_gate = (ROOT / "tools/d173_e069_agent_release_gate.py").read_text(encoding="utf-8")
if 'encoding="utf-8"' not in release_gate:
    raise SystemExit("D173_E071_WINDOWS_ENCODING_GUARD_NOT_PRESENT")
print("D173_E071_WINDOWS_UTF8_EXACT_WORKER_COMMENT_GUARD_PASS")
