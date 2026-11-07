#!/usr/bin/env python3
"""D173 E146 exact Owner scope check; never grants deployment on its own."""
from pathlib import Path
import subprocess
import sys

APPROVED = {
    "relay-agent/D167SkuUi.cs",
    "relay-agent/D173E123WindowAudit.cs",
    "relay-agent/SupraConfirmBrowser.cs",
    "relay-agent/Program.cs",
    "relay-agent/AgentConfig.cs",
    "relay-agent/VERSION",
    "relay-agent/SupraInventoryRelayAgent.csproj",
    "service/src/core.ts",
    "service/src/index.ts",
    "service/src/d173-picker-shift-cron.ts",
    "tests/d169-agent-web-tab-canary.test.mjs",
    "tests/d173-e141-agent-ha-web-shield.test.mjs",
    "tests/d173-e143-agent168-roster-webview.test.mjs",
    "tests/d173-e146-agent169-picker-cutoff.test.mjs",
    "tests/d173-e146-agent-webview2-ghost-windows.test.mjs",
    ".github/workflows/d173-e141-agent-source.yml",
    "tools/d173_e146_source_guard.py",
    "tools/d173_e060_vps_usage_guard.py",
    "tools/d173_e097_startup_regression.mjs",
    ".github/workflows/d173-e127-source.yml",
    "docs/D173_E146_AGENT169_SKU_HELPERS_PICKER_SHIFT_2026-11-07.md",
    "docs/OWNER_DECISIONS.md",
    "docs/specs/AUTH_RBAC.md",
    "docs/specs/UI_DESIGN_SYSTEM.md",
    "ops/project-state.json",
    "ops/change-continuity/D173.json",
    "ops/authority-manifest.json",
}
try:
    base = subprocess.check_output(
        ["git", "merge-base", "origin/main", "HEAD"], text=True
    ).strip()
    changes = subprocess.check_output(
        ["git", "diff", "--name-only", base, "HEAD"], text=True
    ).splitlines()
except subprocess.CalledProcessError:
    print("E146 source ancestry unavailable; refusing to assert scope", file=sys.stderr)
    sys.exit(1)
unapproved = sorted(set(changes).difference(APPROVED))
if unapproved:
    print("E146 source scope violation: " + ", ".join(unapproved), file=sys.stderr)
    sys.exit(1)
required = {
    "relay-agent/D167SkuUi.cs",
    "relay-agent/D173E123WindowAudit.cs",
    "service/src/core.ts",
    "service/src/index.ts",
    "service/src/d173-picker-shift-cron.ts",
}
if not required.issubset(changes):
    print("E146 required source missing", file=sys.stderr)
    sys.exit(1)
windows = Path("relay-agent/D173E123WindowAudit.cs").read_text(encoding="utf-8")
cron = Path("service/src/d173-picker-shift-cron.ts").read_text(encoding="utf-8")
core = Path("service/src/core.ts").read_text(encoding="utf-8")
if any(m not in windows for m in ("pid != _ownPid", "WS_EX_TOOLWINDOW", "IsFrameworkHelper", "SetWinEventHook")):
    raise SystemExit("E146 OWN_PID_GDI_BROADCAST_WINDOW_GUARD_MISSING")
if any(m not in cron for m in ("hour !== 7 && hour !== 15", "minute > 30", "publishPickerSessionRevocation")):
    raise SystemExit("E146 PICKER_SHIFT_SCHEDULE_GUARD_MISSING")
if any(m not in core for m in ("d173PickerShiftIsExpired(row.android_session_started_at, nowMs)", "android_session_started_at IS ?", "transactionSync")):
    raise SystemExit("E146 SERVER_CAS_GUARD_MISSING")
print("D173_E146_SCOPE__NATIVE__PICKER_CUTOFF__D172_UNCHANGED_PASS")
