#!/usr/bin/env python3
"""D173-E089 Agent154 native Usage/History/Log source checks (no mock provider)."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def get(x):return (R/x).read_text(encoding="utf-8")
assert get("relay-agent/VERSION").strip()=="154"
assert "AgentBuild = 154;" in get("relay-agent/AgentConfig.cs")
assert "0.154.0.0" in get("relay-agent/SupraInventoryRelayAgent.csproj")
cards=get("relay-agent/D173E089UsageCards.cs")
usage=get("relay-agent/D173VpsUsage.cs")
hist=get("relay-agent/D160UiHistory.cs")
theme=get("relay-agent/D173E036Theme.cs")
worker=get("service/src/d173-vps-usage.ts")
for needle in ("FlowLayoutPanel","E079NativeSparkline","E089Render()",
 "E089Forecast","E089End","SharedRelayOverrideUntilMs",
 "06:00","22:00","TimeZoneInfo","Pacific Standard Time","SourceTime",
 "E089Severity","E089ApplyTheme"):
 assert needle in cards,needle
assert "InitializeD173E089UsageCards();" in usage
assert "E089Render();" in usage
assert "BeginD161GlobalSupportLogRequest()" in theme
assert "IsD161PrivilegedAgentLogin(snapshot)" in theme
assert "Yêu cầu log toàn hệ thống" in theme
assert "TableLayoutPanel" in hist and "root.Controls.Add(_d160HistoryGrid, 0, 2)" in hist
assert "ColumnHeadersVisible = true" in hist and "ColumnHeadersHeight = 38" in hist
assert "function syncMinutes(id:string):number" in worker
assert "d173-vps-usage" not in theme
release=get(".github/workflows/verify-relay-agent.yml")
assert "Agent v$version: Usage" not in release
assert "Agent v${version}: Usage" in release
assert "D173-E089_AGENT154_RELEASE:" in get("tools/d173_e089_release_gate.py")
assert "D173-E089_AGENT154_RELEASE:" in get("tools/d167_release_gate.py")
assert "D173_E089_EXISTING_GATEWAY" in get(".github/workflows/verify-relay-agent.yml")
print("D173_E089_AGENT154_SOURCE_SCOPE_UI_LOG_HISTORY_PASS")
