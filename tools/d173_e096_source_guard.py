#!/usr/bin/env python3
"""D173-E096 offline source regression: exact Usage RBAC and UI safety invariants."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def source(path):
    return (root / path).read_text(encoding="utf-8")

agent = source("relay-agent/D173VpsUsage.cs")
worker = source("service/src/index.ts")
cards = source("relay-agent/D173E089UsageCards.cs")
resources = source("relay-agent/D173DesktopResources.cs")
program = source("relay-agent/Program.cs")
roster = source("relay-agent/D119AgentFeatures.cs")
state = source("docs/D173_E096_AGENT157_FIELD_USAGE_UI_CORRECTIONS_2026-10-28.md")

# Two independent gates: exact login list in WinForms and Firebase agent-session
# server RBAC in Worker; no arbitrary ADMIN or unauthenticated caller access.
for login in ('"vps"', '"admin"', '"tamnv2"'):
    assert login in agent and login in worker, login
assert 'operator.base_role !== operator.role' in worker
assert 'await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"])' in worker
assert '!["vps", "admin", "tamnv2"].includes' in worker
assert 'HasAgentSession' not in agent, "Usage uses own exact authenticated session"
assert 'session.IdToken' in agent
assert "TryD173VpsUsageBoundary()" in agent
assert 'TryD173VpsUsageRefresh("24h",false)' in agent

# Fixed shift coordinates derived from provider point timestamps; never fill
# unobserved 18:00–22:00 with interpolated/zero future usage.
assert "class E096ShiftSparkline : Control" in cards
assert "hour=6;hour<=22;hour+=8" in cards
assert "var x=left+(float)((item.Key-Start).TotalSeconds/total)*(right-left)" in cards
assert "MaxGapMinutes" in cards
assert "if(!valid)card.Spark.Points.Clear()" in cards
assert 'HH:mm:ss dd/MM/yyyy' in cards
assert 'received.AddHours(7)' in cards

# Show only the source time under the title, no AI/Owner commentary.
assert '_e089Header.Text="Giám sát mức sử dụng dịch vụ"' in cards
assert 'card.Id!="cf_emails_sent"' in cards
assert 'if(id=="cf_emails_sent")return 100d;' in cards
assert 'Mục tiêu 100/ngày' in cards
assert 'threshold.Value>=1d' in cards
assert 'threshold.Value>=0.85d' in cards
assert "family==0?Color.FromArgb" in cards
assert "E089Label(headings[group],14,true)" in cards

# Borderless startup is still maximized in Windows work area; no new timer.
assert program.count("FormBorderStyle = FormBorderStyle.None;") >= 2
assert "ApplyWorkingAreaMaximum();" in program
assert "MinimizeToTray()" in program and "RestoreFromTray()" in program
assert "_trayMonitorTimer.Interval = 1000;" in program
assert '_d173RefreshSelector.SelectedIndex = 0;' in resources
assert "seconds * 1000" in resources
assert "overviewLayout.RowStyles[0].Height = 30f;" in roster
assert "overviewLayout.RowStyles[1].Height = 70f;" in roster
assert "SetD173BoundsIfChanged(_autoSizeAgentColumnsButton, x, row, auto, 29)" in resources
assert "SetD173BoundsIfChanged(_d150PrimaryTakeoverButton," in resources
assert "_autoSizeAgentColumnsButton.Enabled = false;" in resources
assert "D172" in state and "NO_WORKER_DEPLOY" in state.replace(" ", "_").upper() or "Worker production deploy" in state

# Never publish privileged provider secrets or add provider calls in the Agent.
for secret in ("D166_CF_READ_TOKEN", "GOOGLE_RUNTIME_SA_JSON", "D173_CF_EMAIL_ANALYTICS_READ"):
    assert secret not in agent and secret not in cards and secret not in resources
print("D173_E096_EXACT_RBAC_USAGE_UI_SOURCE_PASS")
