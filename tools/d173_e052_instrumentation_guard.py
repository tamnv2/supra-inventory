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
# E181: 40/60 supersedes historical 50F; provider usage checks unchanged.
if read("relay-agent/VERSION").strip() in ("179", "180", "181", "182"):
    assert "new RowStyle(SizeType.Percent, 40F)" in program
    assert "new RowStyle(SizeType.Percent, 60F)" in program
else:
    assert "new RowStyle(SizeType.Percent, 50F)" in program
# E175 Owner-approved 60/40 Agent overview supersedes E052's historical
# 50/50 vertical split without changing the existing telemetry/no-network guard.
agent_version = read("relay-agent/VERSION").strip()
if agent_version in ("180", "181", "182"):
    import json
    auth = ("ops/d173-e182-agent182-release-authorization.json" if agent_version == "182"
            else ("ops/d173-e182-agent181-release-authorization.json" if agent_version == "181"
                  else "ops/d173-e182-agent180-release-authorization.json"))
    receipt = json.loads(read(auth))
    assert receipt["owner_code_approved"] is True and receipt["agent_target_version"] == int(agent_version)
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert receipt["confirm_business_mutation"] is False and receipt["no_new_provider_requests"] is True
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 44F));" in program
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 56F));" in program
    assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));") >= 2
    assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 60F));") >= 2
    assert "D173E159ApplyOfficeCapabilityUi()" in program
elif agent_version == "179":
    import json
    receipt = json.loads(read("ops/d173-e181-agent179-release-authorization.json"))
    assert receipt["owner_code_approved"] is True and receipt["agent_target_version"] == 179
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 44F));" in program
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 56F));" in program
    assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));") >= 2
    assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 60F));") >= 2
    assert "InstallD173E179NoScrollTop(" in program
elif agent_version == "178":
    import json
    receipt = json.loads(read("ops/d173-e179-agent178-release-authorization.json"))
    assert receipt["owner_code_approved"] is True and receipt["agent_target_version"] == 178
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 44F));" in program
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 56F));" in program
    assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));") >= 2
    assert "InstallD173E179NoScrollTop(" in program
elif agent_version == "177":
    import json
    receipt = json.loads(read("ops/d173-e175-release-authorization.json"))
    assert receipt["owner_approved_code"] and receipt["agent_target_version"] == 177
    assert receipt["d172_pending_hold"] and receipt["no_stable"]
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 44F));" in program
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 56F));" in program
    assert "overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 60F));" in program
    assert "overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 40F));" in program
else:
    assert "d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));" in program
    assert program.count("d173MiddleStack.RowStyles.Add(new RowStyle(SizeType.Percent, 50F));") == 2
assert "const int panelTop = 163;" in program
assert "const int panelHeight = 88;" in program
assert "SetD173BoundsIfChanged(actions[i], left, 48, width, 32);" in program
# E053: one layout owner must preserve the after-hours panel on all refresh paths.
assert "SetD173BoundsIfChanged(_agentFleetGrid," in program
assert "if (_afterHoursLayoutVisible == true && _afterHoursPanel.Visible)" in desktop
assert "ApplyAfterHoursAgentLayout(true);" in desktop
assert "SetD173BoundsIfChanged(_agentFleetGrid, 12, fleetTop" in desktop
assert not re.search(r"_agentFleetGrid\.SetBounds\(", desktop)
# The two presentation grids must not erase/recreate every row on a status update.
fleet = program.split("private void UpdateAgentFleetGrid(", 1)[1].split("private static void SetD173BoundsIfChanged", 1)[0]
roster = d119.split("private void RenderPickerOnlineSnapshot()", 1)[1].split("private void RenderFleetMetricStatus(", 1)[0]
assert "_agentFleetGrid.Rows.Clear()" not in fleet
assert "_pickerOnlineGrid.Rows.Clear()" not in roster
assert "row.Cells[cell].Value = values[cell]" in fleet
assert "UpsertD173RosterRow(nextRowIndex++" in roster
assert "if (_d173RosterStructureChanged)" in roster
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
# E052 invariants remain valid across monotonic Agent-only hotfix releases.
agent_version = read("relay-agent/VERSION").strip()
assert agent_version.isdigit() and int(agent_version) >= 147
assert f"AgentBuild = {agent_version};" in read("relay-agent/AgentConfig.cs")
assert f"<AssemblyVersion>0.{agent_version}.0.0</AssemblyVersion>" in read("relay-agent/SupraInventoryRelayAgent.csproj")
# E123 signed Web3.3.3 remains historical baseline; E167 explicitly approves
# Web3.3.4 for log changes. No arbitrary future version accepted.
current_web = read("web/src/web-version.ts")
if 'WEB_VERSION = "3.3.5"' in current_web:
    import json
    grant = json.loads(read("ops/d173-e175-release-authorization.json"))
    assert grant["owner_approved_code"] and grant["owner_approved_deploy"]
    assert grant["web_target_version"] == "3.3.5"
    assert grant["d172_pending_hold"] and grant["no_stable"]
elif 'WEB_VERSION = "3.3.4"' in current_web:
    import json
    grant = json.loads(read("ops/d173-e165-agent174-release-authorization.json"))
    assert grant["log_protocol_approved"] is True and grant["web_mutation"] is True
else:
    assert 'WEB_VERSION = "3.3.3"' in current_web
# Forbidden instrumentation: do not introduce per-event provider writes/timers.
assert "setInterval" not in android
assert "D166UsageAudit.recordApi" not in android
assert not re.search(r"fetch\s*\(", desktop)
print("D173-E052 zero-new-provider-operation diagnostic and Agent UI structural checks PASS")
