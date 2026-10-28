#!/usr/bin/env python3
"""D173-E064 source-level regression for Agent History/Usage change.

Structural safety checks; exact net48 WinForms build runs separately on Windows CI.
All checks are read-only and require no provider credentials.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")

history = source("relay-agent/D160UiHistory.cs")
usage = source("relay-agent/D173VpsUsage.cs")
approved = source("relay-agent/D173E069ApprovedUsageUi.cs")
worker = source("service/src/d173-vps-usage.ts")
guard = source("tools/d173_e060_vps_usage_guard.py")
governance = source("docs/SUPRA_SHARED_QUOTA_GOVERNANCE.md")
assert "D173-E064" in governance and "50%" in governance
version = source("relay-agent/VERSION").strip()
assert version in ("151", "152", "153"), "Only approved Agent versions"
assert "AgentBuild = " + version in source("relay-agent/AgentConfig.cs")
assert "0." + version + ".0.0" in source("relay-agent/SupraInventoryRelayAgent.csproj")
assert 'version=file("relay-agent/VERSION").strip()' in guard

# No same-day full-grid wipe: rebuild only at real day transitions; incremental by ID.
reset = history.split("internal void ResetD160HistoryForBusinessDay", 1)[1].split(
    "private void RenderD160HistorySnapshot", 1)[0]
assert "if (_d160HistoryUiReady && changedDay)" in reset
render = history.split("private void RenderD160HistorySnapshot", 1)[1].split(
    "private void RenderD160HistoryRow", 1)[0]
assert "Rows.Clear()" not in render
assert "Rows.Add(prepared[i])" in render
assert "Rows.Remove(existing)" in render
assert "D161RestoreCanonicalHistorySort()" in render
assert "ShowD160HistorySurface" in history
assert "surface_error=" in history
assert "local_invalid_records=" in history
assert "local_read_error=" in history

# VPS-only path / refreshed 24h query; cache 30d at most daily without new ticker.
assert '"vps"' in usage and "_d173VpsUsageAuthenticated" in usage
assert "_d173VpsUsageClock.Interval = 30_000" in usage
assert 'TryD173VpsUsageRefresh("24h",false)' in usage
assert "D173VpsNeedsCycleRefresh()" in usage
assert 'TotalHours>=24' in usage
assert "usage-vps-cycle-" in usage
assert "session.IdToken" in usage and "File.WriteAllText(tmp" in usage
assert "D173VpsCycleTarget" in usage and "accountIncluded*0.50" in usage
assert "Cloudflare — quota, tiêu thụ ngày và chu kỳ billing" in approved
assert "D173ApprovedShiftForecast" in usage
assert "midnight+shift+" in usage
assert "if(observed.Count<12" in usage
assert "D173VpsMonthForecast" in usage
assert "D173VpsArchivedFirstDay" in usage and "if(elapsed>=30d && !dayOne.HasValue)return null" in usage
for threshold in ("percent>=100", "percent>=95", "percent>=85", "percent>=70"):
    assert threshold in usage, threshold
assert "_d173VpsKpiLabels = new Label[5]" in usage
assert "_d173VpsDailyLabels = new Label[4]" in usage
assert all(item in approved for item in ('"dayForecast"', '"status"', '"source"'))
assert "D173E069UsageGraphic" in approved and "Mode=i" in approved
assert "D173ApprovedHistoricalBars" not in approved
assert "ScrollBars.Both" in approved and "AutoSizeColumnsMode.None" in approved
assert "ApplyD173ApprovedUsageTheme" in approved

# Never claim Cloudflare plan base fee is variable usage cost or Google has "$10 quota".
assert "0.42" not in usage and "3.20" not in usage
assert "30% chung" not in usage and "30% Inventory" not in worker
assert "50% Inventory" in worker
for secret in ("D166_CF_READ_TOKEN", "D173_CF_EMAIL_ANALYTICS_READ", "GOOGLE_RUNTIME_SA_JSON"):
    assert secret not in usage, secret
assert 'GET /api/agent/vps-usage' not in history
print("D173_E064_HISTORY_RECOVERY_50PCT_TARGET_DAY_MONTH_FORECAST_SOURCE_PASS")

# D173-E075 must retain source-backed quota denominators, nested mouse-wheel
# handling and one global theme selector without weakening E064 history guards.
scroll = source("relay-agent/D173E075UsageScroll.cs")
theme = source("relay-agent/D173E036Theme.cs")
sidebar = source("relay-agent/D173E038Sidebar.cs")
assert "IMessageFilter" in scroll and "PreFilterMessage" in scroll
assert "AutoScrollPosition" in scroll and "ScrollGrid" in scroll
assert "_d173ApprovedViewport" in approved and "AutoScroll=true" in approved
assert "_d173ApprovedQuotaInfo" in approved and "cf_do_rows_read" in usage
assert "D173AttachSidebarTheme" in sidebar and "D173GlobalTheme3Way" in theme
assert "D173WindowsAppsDark()" in theme
if version in ("152","153"):
    grouped = source("relay-agent/D173E079UsageDashboard.cs")
    # E089 replaces the old detail table with Owner-approved native WinForms
    # source-backed metric cards. Do not weaken older D064 history/HA guards.
    if "InitializeD173E089UsageCards();" in usage:
        e089 = source("relay-agent/D173E089UsageCards.cs")
        assert "InitializeD173E089UsageCards()" in e089
        assert "E089Render()" in e089 and "E089Forecast" in e089
        assert "SharedRelayOverrideUntilMs" in e089
        assert "BeginD161GlobalSupportLogRequest()" in theme
        assert 'root.Controls.Add(_d160HistoryGrid, 0, 2);' in history
    else:
        assert "InitializeD173E079UsageUi();" in usage
    assert "E079RefreshMeters(latest);" in usage
    assert "ScrollBars=ScrollBars.Horizontal" in grouped
    assert "E079NativeSparkline" in grouped
    assert "D173VietnamNight()" in theme and '(_d173ThemeChoice == "AUTO" && D173VietnamNight())' in theme
assert 'Text="Sáng / Tối"' not in approved
