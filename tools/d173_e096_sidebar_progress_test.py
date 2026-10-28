#!/usr/bin/env python3
"""D173-E096 WinForms sidebar/version + usage progress visual regression.

Source assertions complement the real Windows net48 build/startup smoke.
They do NOT substitute for native RDP light/dark FIELD acceptance.
"""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
usage = (root / "relay-agent/D173E089UsageCards.cs").read_text(encoding="utf-8")
theme = (root / "relay-agent/D173E036Theme.cs").read_text(encoding="utf-8")

required_usage = {
    "day semantic fill restored after global theme":
        "metric.BarFill.BackColor=E089RiskColor(metric.DayRatio);",
    "month semantic fill restored after global theme":
        "metric.CycleBarFill.BackColor=E089RiskColor(metric.CycleRatio);",
    "day/mth width recalculated":
        "E089UpdateBars(metric,metric.DayRatio,metric.CycleRatio);",
    "day null target hatching":
        "E089PaintMissingTarget(card,true,args)",
    "month null target hatching":
        "E089PaintMissingTarget(card,false,args)",
    "target only when verified":
        "if(!targetKnown||actualKnown)return;",
    "never fake missing ratio":
        "card.CycleBarFill.Width=cycle.HasValue?",
    "red 95 percent":
        "if(ratio.Value>=0.95)return Color.FromArgb(228,82,92);",
    "amber 70 percent":
        "if(ratio.Value>=0.7)return Color.FromArgb(230,160,58);",
    "track repaint on update":
        "card.CycleBarTrack.Invalidate();",
}
required_theme = {
    "persistent displayed installed build":
        'Text="Agent v"+AgentConfig.AgentBuild,',
    "sidebar version label":
        'Name="D173SidebarAgentVersion",',
    "theme retains version readability":
        'label.Name == "D173SidebarAgentVersion" ?',
    "native theme after recursive pass":
        "E089ApplyTheme(dark);",
}

for description, needle in required_usage.items():
    assert needle in usage, f"Usage visual regression: {description}"
for description, needle in required_theme.items():
    assert needle in theme, f"Sidebar regression: {description}"

# Ensure the recolor occurs after recursive theme only in the explicit card-theme pass.
apply_theme = usage.split("private void E089ApplyTheme(bool dark)", 1)[1]
assert apply_theme.index("metric.BarTrack.BackColor") < apply_theme.index(
    "metric.BarFill.BackColor=E089RiskColor(metric.DayRatio);"
), "Theme must restore semantic progress colors after the neutral tracks"

print("D173-E096 sidebar/progress source regression PASS")
