#!/usr/bin/env python3
"""D173-E064 source-level regression for Agent History/Usage change.

Structural safety checks; exact net48 WinForms build runs separately on Windows CI.
All checks are read-only and require no provider credentials.
"""
from pathlib import Path
import re
import json

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
assert version in ("151", "152", "153", "154", "155","156","157","158","159","160","161","162","163","164","165","166","167","168","169","170","171","172","173","174","175","176","177","178","179","180","180"), "New Agent code requires scoped Owner evidence"
if version == "180":
    receipt180 = json.loads(source("ops/d173-e182-agent180-release-authorization.json"))
    state180 = json.loads(source("ops/project-state.json"))["d173_e182_agent180_layout_network"]
    assert receipt180["owner_code_approved"] is True and receipt180["owner_protected_release_approved"] is True
    assert receipt180["owner_approval_reference"] == "OWNER_20261110_AGENT180_LAYOUT_RESTORE177_WRAPPED_TEXT_FOUR_NETWORK_CAPABILITIES_SIGNED_RELEASE"
    assert receipt180["agent_target_version"] == 180 and state180["target_version"] == 180
    assert receipt180["approved_components"] == ["agent"] and receipt180["host_build"] == 13
    assert not any(receipt180[x] for x in ("d172_mutation","stable_mutation",
                                          "service_mutation","web_mutation","android_mutation",
                                          "worker_mutation","firestore_mutation","host_mutation",
                                          "confirm_business_mutation"))
    print("D173_E182_AGENT180_NO_CONFIRM_MUTATION_OWNER_GUARD_PASS")
if version == "179":
    receipt179 = json.loads(source("ops/d173-e181-agent179-release-authorization.json"))
    state179 = json.loads(source("ops/project-state.json"))["d173_e181_agent179_overview"]
    assert receipt179["owner_approval_reference"] == "OWNER_20261110_AGENT179_40_60_RESTORE177_WEB_ONLINE_OFFLINE_SIGNED_RELEASE"
    assert receipt179["owner_code_approved"] is True and receipt179["owner_protected_release_approved"] is True
    assert receipt179["agent_target_version"] == 179 and state179["target_version"] == 179
    assert receipt179["approved_components"] == ["agent"] and receipt179["host_build"] == 13
    assert not any(receipt179[x] for x in ("d172_mutation","stable_mutation",
                                          "service_mutation","web_mutation",
                                          "android_mutation","worker_mutation",
                                          "firestore_mutation"))
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
    print("D173_E181_AGENT179_OWNER_SCOPE_READONLY_GUARD_PASS")
if version == "178":
    receipt178 = json.loads(source("ops/d173-e179-agent178-release-authorization.json"))
    state178 = json.loads(source("ops/project-state.json"))["d173_e179_agent178_overview"]
    assert receipt178["owner_code_approved"] and receipt178["owner_protected_release_approved"]
    assert receipt178["agent_target_version"] == 178 and state178["target_version"] == 178
    assert receipt178["approved_components"] == ["agent"]
    assert receipt178["d172_mutation"] is False and receipt178["stable_mutation"] is False
    assert all(receipt178[x] is False for x in
               ("worker_mutation","web_mutation","android_mutation","service_mutation","firestore_mutation"))
    print("D173_E179_AGENT178_HISTORY_READONLY_OWNER_GUARD_PASS")
if version == "177":
    receipt = json.loads(source("ops/d173-e175-release-authorization.json"))
    checkpoint = json.loads(source("ops/change-continuity/D173.json"))
    assert checkpoint["last_checkpoint"]["id"] == "D173-E175" and checkpoint["pr"] == 889
    assert receipt["owner_approval_reference"] == "OWNER_20261110_D173_E175_ALL_UNIFIED_BAO_HANG_PRODUCTION"
    assert receipt["owner_approved_code"] and receipt["owner_approved_deploy"]
    assert receipt["agent_target_version"] == 177 and receipt["no_stable"] and receipt["d172_pending_hold"]
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
    print("E175_AGENT177_HISTORY_USAGE_EXACT_OWNER_SCOPE_PASS")
if version == "176":
    import json
    state = json.loads(source("ops/project-state.json"))["d173_e174_focus_logging_launcher"]
    receipt = json.loads(source("ops/d173-e174-agent176-release-authorization.json"))
    assert state["id"] == "D173-E174" and state["agent"]["version"] == 176
    assert state["scope"]["agent"].startswith("AGENT176_FOCUS_ONLY")
    assert state["d172"] == "PENDING_HOLD_UNCHANGED"
    assert receipt["owner_approval_reference"] == "OWNER_20261109_AGENT_FOCUS_FIX_SIGNED_RELEASE"
    assert receipt["agent_target_version"] == 176 and receipt["host_build"] == 13
    assert receipt["service_mutation"] is False and receipt["android_mutation"] is False
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    print("E174_AGENT176_HISTORY_USAGE_OWNER_SCOPE_PASS")
if version == "175":
    import json
    state = json.loads(source("ops/project-state.json"))["d173_e170_production_diagnostics"]
    receipt = json.loads(source("ops/d173-e170-release-authorization.json"))
    assert state["id"] == "D173-E170" and state["agent_target_version"] == 175
    assert state["owner_production_release_approved"] is True
    assert receipt["change_id"] == "D173-E170" and receipt["owner_protected_release_approved"] is True
    assert receipt["agent_target_version"] == 175 and receipt["host_build"] == 13
    assert receipt["firebase_rules_mutation"] is False and receipt["android_mutation"] is False
    print("E170_AGENT175_HISTORY_USAGE_SCOPE_PASS")
if version == "174":
    state = json.loads(source("ops/project-state.json"))["d173_e165"]
    receipt = json.loads(source("ops/d173-e165-agent174-release-authorization.json"))
    assert state["id"] == "D173-E165" and state["agent_target_version"] == 174
    assert state["host_build"] == 13 and state["owner_pass"] is False
    assert receipt["agent_target_version"] == 174 and receipt["host_build"] == 13
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["log_protocol_approved"] is True
    assert receipt["service_mutation"] is True and receipt["web_mutation"] is True and receipt["android_mutation"] is True
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
if version == "173":
    state = json.loads(source("ops/project-state.json"))["d173_e161"]
    receipt = json.loads(source("ops/d173-e161-agent173-release-authorization.json"))
    assert state["id"] == "D173-E161" and state["agent_target_version"] == 173
    assert state["host_build"] == 13 and state["owner_pass"] is False
    assert state["d172"] == "INDEPENDENT_PENDING_HOLD" and state["stable"] == "OWNER_GATED"
    assert receipt["owner_approval_reference"] == "OWNER_20261107_E161_AGENT173_TRAY_CDP_CONFIRM_FIX"
    assert receipt["agent_target_version"] == 173 and receipt["host_build"] == 13
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
if version == "172":
    import json
    state = json.loads(source("ops/project-state.json"))["d173_e159"]
    receipt = json.loads(source("ops/d173-e159-agent172-release-authorization.json"))
    assert state["id"] == "D173-E159" and state["target_agent_version"] == 172
    assert state["existing_host_build"] == 13 and state["owner_pass"] is False
    assert state["d172"] == "PENDING_HOLD_ISOLATED" and state["stable"] == "OWNER_GATED"
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["agent_target_version"] == 172 and receipt["host_build"] == 13
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
if version == "171":
    # E152 explicitly requested Agent170 field repair, not a new signed
    # release. Keep Agent170/Host13 E150 gates exact for the old version.
    import json
    code_state = json.loads(source("ops/project-state.json"))["d173_e152"]
    assert code_state["id"] == "D173-E152" and code_state["pr"] == 857
    assert code_state["owner_code_request"] is True
    assert code_state["candidate_agent_version"] == 171 and code_state["host_reuse"] == 13
    assert code_state["owner_release_approved"] is False and code_state["owner_pass"] is False
    assert code_state["stable"] == "OWNER_GATED" and code_state["d172"] == "INDEPENDENT_PENDING_HOLD"
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
if version == "170":
    # E150 Agent170 may only inherit structural Usage guards after its OWN
    # Owner-approved Agent-only receipt. Historical Agent169/Host12 checks
    # remain exact for their immutable versions.
    import json
    approval = json.loads(source("ops/d173-e150-agent170-release-authorization.json"))
    e150 = json.loads(source("ops/project-state.json"))["d173_e150"]
    assert e150["owner_code_approved"] is True and e150["owner_release_approved"] is True
    assert e150["d172"] == "INDEPENDENT_PENDING_HOLD" and e150["stable"] == "OWNER_GATED"
    assert approval["agent_target_version"] == 170 and approval["host_build"] == 13
    assert approval["owner_protected_release_approved"] is True
    assert approval["stable_mutation"] is False and approval["d172_mutation"] is False
    assert "RequiredHostBuild = 13;" in source("relay-agent/AgentBrowserBundle.cs")
if version == "169":
    import json
    candidate = json.loads(source("ops/project-state.json"))["d173_e148"]
    assert candidate["owner_approved"] is True and candidate["id"] == "D173-E148"
    assert candidate["pr"] == 853 and candidate["owner_pass"] is False
    assert candidate["stable"] == "OWNER_GATED" and candidate["d172"] == "INDEPENDENT_PENDING_HOLD"
    assert candidate["agent169_release"] == "PENDING"
    assert "RequiredHostBuild = 12;" in source("relay-agent/AgentBrowserBundle.cs")
if version == "168":
    import json
    code_state = json.loads(source("ops/project-state.json"))["d173_e143"]
    assert code_state["candidate_agent_version"] == 168 and code_state["pr"] == 849
    assert code_state["owner_code_request"] is True and code_state["release"] == "NONE"
    assert code_state["owner_pass"] is False and code_state["stable"] == "OWNER_GATED"
    assert code_state["d172"] == "PENDING_HOLD_UNCHANGED"
if version == "166":
    import json
    approval = json.loads(source("ops/d173-e140-release-authorization.json"))
    assert approval["change_id"] == "D173" and approval["checkpoint_id"] == "D173-E140"
    assert approval["pr"] == 843 and approval["agent_target_version"] == 166
    assert approval["owner_source_approval"] is True and approval["owner_gated_release"] is True
    assert approval["source_ci_verified"] in (True, False) and approval["production_release_verified"] is False
    if approval["source_ci_verified"] is True:
        assert approval["source_ci_success"] >= 40 and approval["source_ci_failed"] == 0
        assert len(approval["source_ci_sha"]) == 40
    assert approval["d172_business_mutation"] is False and approval["stable_deployment_permission"] is False
if version == "165":
    import json
    approval = json.loads(source("ops/d173-e125-agent165-release-authorization.json"))
    assert approval["checkpoint"] == "D173-E125"
    assert approval["approved_components"] == ["agent"]
    assert approval["agent_target_version"] == 165
    assert approval["worker_mutation"] is False and approval["stable_deploy_permission"] is False
if version == "164":
    import json
    e123 = json.loads(source("ops/d173-e123-release-authorization.json"))
    assert e123["checkpoint_id"] == "D173-E123"
    assert e123["owner_approval_reference"] == "OWNER_20261103_D173_ALL_APPROVED_PRODUCTION_PICKER_SHIFT_T15_SQL_AGENT_WEB"
    assert e123["agent_target_version"] == 164
    assert e123["desktop_agent_signed_ota_permission"] is True
    assert e123["stable_deployment_permission"] is False
    assert "D173-E123_OWNER_PRODUCTION_RELEASE:" in source("tools/d173_e123_release_gate.py")
if version == "163":
    receipt = source("ops/d173-e111-release-authorization.json")
    assert "OWNER_20261102_REPORTER_SKU_05_OVERTIME_2145_CODE_AND_PROTECTED_RELEASE" in receipt
    assert "D173-E111_REPORTER_SKU_OVERTIME_RELEASE:" in source("tools/d173_e111_release_gate.py")
if version == "160":
    receipt = source("ops/d173-e100-agent160-release-authorization.json")
    assert "OWNER_20261030_D173_E100_AGENT160_ROSTER_UTC_VERSION_SIGNED_OTA" in receipt
    assert "D173-E100_AGENT160_ONLY_RELEASE:" in source("tools/d173_e100_agent160_release_gate.py")
    assert "D173E100RosterSelfTest" in source("relay-agent/D119AgentFeatures.cs")
if version == "157":
    receipt = source("ops/d173-e095-agent157-release-authorization.json")
    assert "OWNER_20261028_AGENT157_ALL_E095_REQUIREMENTS_SIGNED_OTA" in receipt
    assert "D173-E095_AGENT157_ONLY_RELEASE:" in source("tools/d173_e095_agent157_release_gate.py")
    assert "E095FirestoreShiftUsed" in source("relay-agent/D173E089UsageCards.cs")
if version == "156":
    receipt = source("ops/d173-e093-release-authorization.json")
    assert "OWNER_20261028_P1_CONFIRM_USAGE_AGENT_WORKER_NO_APK" in receipt
    assert "D173-E093_AGENT156_WORKER_RELEASE:" in source("tools/d173_e093_release_gate.py")
if version == "155":
    receipt = source("ops/d173-e090-release-authorization.json")
    assert "OWNER_20261028_AGENT155_ALL_EIGHT_ITEMS_RELEASE" in receipt
    assert "D173-E090_AGENT155_RELEASE:" in source("tools/d173_e090_release_gate.py")
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
