#!/usr/bin/env python3
"""D173-E084 bounded source contracts; no credentials, provider calls, data writes."""
from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[1]
def src(p):return (R/p).read_text(encoding="utf-8")
worker=src("service/src/d173-vps-usage.ts")
agent=src("relay-agent/D173VpsUsage.cs")
card=src("relay-agent/D173E079UsageDashboard.cs")
history=src("relay-agent/D160UiHistory.cs")
side=src("relay-agent/D173E038Sidebar.cs")
theme=src("relay-agent/D173E036Theme.cs")
main=src("relay-agent/Program.cs")
overlay=src("relay-agent/D119AgentFeatures.cs")
assert src("relay-agent/VERSION").strip()=="153"
assert "AgentBuild = 153;" in src("relay-agent/AgentConfig.cs")
assert "0.153.0.0" in src("relay-agent/SupraInventoryRelayAgent.csproj")
for term in ("groupedCloudflare","groupedConsumedApis","sync_minutes",
    "last_success_at","d173UsageCache","billingPeriodCache","cycle_start","cycle_end",
    "accountTag","resource.labels.service","NO_DATA"):
    assert term in worker,term
assert 'new Map<string,{expires:number;entry:UsageEntry}>()' in worker
assert 'Array.from({length:4}' in worker
assert '"api:fcm.googleapis.com"' in worker
assert '"cf_do_requests"' in worker and '"cf_worker_cpu"' in worker
assert 'return x&&x.expires>Date.now()' in worker
assert "cf_d1_storage" in agent and "D173UsageIsGauge" in agent
assert 'D173ConfiguredSyncMinutes' in agent and '" · Sync "' in agent
assert 'meter.Caption.Text=' in card
assert 'ColumnHeadersVisible = true' in history
assert 'ColumnHeadersHeight = 38' in history
assert '"Lịch sử Picker xác nhận PickList"' in history
assert 'if(ReferenceEquals(page,_connectionPage))continue;' in side
assert 'D173QuickUtilities' in theme and 'ConfigureD168WorkerWifiProfiles()' in theme
assert 'UserStartupRegistration.SetEnabled(enabled)' in theme
assert '_d160SendLogs.PerformClick()' in theme and '_d160OpenLogs.PerformClick()' in theme
assert 'private void InitializeD128Overlay()\n        {\n            // E084:' in overlay
assert 'InitializeD128OverlaySettingsSurface();\n            EnsureD128OverlayTrayMenu();\n            TryInitializeD128Overlay("startup");' not in overlay
assert 'd173MiddleStack.Controls.Add(directCard, 0, 1);' in main
assert 'ConfirmManyExact' in src("relay-agent/SupraConfirmBrowser.cs")
assert 'D160_12S_MUTATION_FENCE' in src("relay-agent/D160ConfirmPipeline.cs")
decision=src("docs/D173_E084_AGENT153_USAGE_RELEASE_2026-10-27.md")
assert 'OWNER' in decision and 'D172' in decision
print("D173_E084_AGENT153_SOURCE_SCOPE_AND_UI_PASS")
