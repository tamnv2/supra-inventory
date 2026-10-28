#!/usr/bin/env python3
"""D173-E090 Agent155: 8 Owner-approved read-only/native UI changes."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def src(path): return (R/path).read_text(encoding="utf-8")
assert src("relay-agent/VERSION").strip()=="155"
assert "AgentBuild = 155;" in src("relay-agent/AgentConfig.cs")
assert "0.155.0.0" in src("relay-agent/SupraInventoryRelayAgent.csproj")
program=src("relay-agent/Program.cs")
assert "Math.Max(1180, d173TopViewport.ClientSize.Width)" in program
assert program.count("overviewLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50F))") >= 2
resources=src("relay-agent/D173DesktopResources.cs")
assert "_d173RefreshSelector.SelectedIndex = 0;" in resources
assert "_trayMonitorTimer.Interval = 1000;" in resources
assert "InitializeD173PerformancePage();" not in resources
assert "D173ResourceGlyph" in resources and "SetD173MetricText" in resources
roster=src("relay-agent/D119AgentFeatures.cs")
for field in ("SessionChannel","SessionLoginAt","SessionLastSeen","ContactState",
              "picker.LoginAt","picker.DeviceSeenAt","E090LocalSessionTime"):
    assert field in roster,field
usage=src("relay-agent/D173E089UsageCards.cs")
for field in ("D173E090UsageGlyph","noSource","metric.Icon.ForeColor",
              "card.Shell.Tag=\"NO_DATA\""):
    assert field in usage,field
sidebar=src("relay-agent/D173E038Sidebar.cs")
for title in ("Tổng quan vận hành","Đồng bộ danh mục SKU",
              "Trình duyệt xác nhận PickList","Giám sát mức sử dụng dịch vụ"):
    assert title in sidebar,title
assert "SizeType.Absolute, 225F" in sidebar
hist=src("relay-agent/D160UiHistory.cs")
assert 'new TabPage("Lịch sử xác nhận PickList")' in hist
logs=src("relay-agent/D161SupportLogControl.cs")
theme=src("relay-agent/D173E036Theme.cs")
auth=src("relay-agent/D161AdminControl.cs")
service=src("service/src/index.ts")
assert "Yêu cầu log đang xử lý" in theme and "requestAllLogs.Enabled=requestAllLogs.Visible" in theme
assert "Một yêu cầu log đang thực hiện" in logs
assert "Đã tiếp nhận không đồng nghĩa tất cả thiết bị" in logs
for login in ('"admin"','"tamnv2"','"vps"'):
    assert login in auth and login in service
assert "/api/agent/support-log-request" in service
# No new provider/telemetry polling from the v155 native changes.
assert "_d173VpsUsageClock.Interval = 30_000;" in src("relay-agent/D173VpsUsage.cs")
assert "WindowState == FormWindowState.Minimized" in resources
print("D173_E090_AGENT155_SOURCE_TEST_PASS")
