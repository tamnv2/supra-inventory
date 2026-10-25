#!/usr/bin/env python3
"""D173-E052 structural regression: UI boundaries and cost-free client counters."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
read = lambda name: (root / name).read_text(encoding="utf-8")
program = read("relay-agent/Program.cs")
desktop = read("relay-agent/D173DesktopResources.cs")
d119 = read("relay-agent/D119AgentFeatures.cs")
theme = read("relay-agent/D173E036Theme.cs")
android = read("android/app/src/main/java/cd/cc/supra/inventory/beta/D166UsageAudit.kt")
api = read("android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt")
web = read("web/src/runtime-logger.ts")
assert "new RowStyle(SizeType.Percent, 50F)" in program
assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));" in program
assert program.count("d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));") == 2
assert "const int panelTop = 163;" in program
assert "const int panelHeight = 88;" in program
assert "actions[i].SetBounds(left, 48, width, 32);" in program
assert "_afterHoursStatus.AutoEllipsis = true;" in program
assert "if (authenticated && _afterHoursLayoutVisible == true)" in d119
assert "ApplyAfterHoursAgentLayout(true);" in d119
assert "D173BufferedCardPanel" in desktop and "new D173BufferedCardPanel" in program
assert "ControlStyles.Opaque" in desktop and "g.Clear(BackColor);" in desktop
assert "displayedNetworkScale" in desktop
assert "_d173ThemeClock.Tick += (sender, args) => ApplyD173AppWideTheme();" in theme
for family in ["REPORTER_QUEUE", "REPORTER_OVERDUE", "REPORTER_COUNTERS", "REPORTER_RECENT"]:
    assert family in android and family in web, family
assert "D166UsageAudit.recordApi(method, path, metricStatus" in api
assert "safeD173ApiFamily(route)" in web
assert "recordD171UsageEvent(normalized);" in web
assert "uploadRuntimeLog" in web
for name in ["relay-agent/VERSION", "relay-agent/AgentConfig.cs", "relay-agent/SupraInventoryRelayAgent.csproj"]:
    assert (root / name).exists()
assert read("relay-agent/VERSION").strip() == "147"
assert "AgentBuild = 147;" in read("relay-agent/AgentConfig.cs")
assert "<AssemblyVersion>0.147.0.0</AssemblyVersion>" in read("relay-agent/SupraInventoryRelayAgent.csproj")
assert 'WEB_VERSION = "3.3.2"' in read("web/src/web-version.ts")
# Forbidden instrumentation: do not introduce per-event provider writes/timers.
assert "setInterval" not in android
assert "D166UsageAudit.recordApi" not in android
assert not re.search(r"fetch\s*\(", desktop)
print("D173-E052 zero-new-provider-operation diagnostic and Agent UI structural checks PASS")
