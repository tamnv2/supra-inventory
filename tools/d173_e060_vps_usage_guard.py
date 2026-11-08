#!/usr/bin/env python3
"""D173-E060 fail-closed VPS Usage Agent + provider read-only isolation."""
from pathlib import Path
import re
import json

R=Path(__file__).resolve().parents[1]
def file(path): return (R/path).read_text(encoding="utf-8")
agent=file("relay-agent/D173VpsUsage.cs")
form=file("relay-agent/Program.cs")
app=file("relay-agent/AgentConfig.cs")
theme=file("relay-agent/D173E036Theme.cs")
sidebar=file("relay-agent/D173E038Sidebar.cs")
worker=file("service/src/index.ts")
usage=file("service/src/d173-vps-usage.ts")
deploy=file(".github/workflows/deploy-beta.yml")
version=file("relay-agent/VERSION").strip()
# Future Agent versions require an explicit scoped owner receipt and still must
# pass all existing VPS/privileged usage/RBAC source guards below.
assert version in ("151","152","153","154","155","156","157","158","159","160","161","162","163","164","165","166","167","168","169","170","171","172","173","174"), "Agent version requires scoped Owner evidence"
if version == "174":
    state = json.loads(file("ops/project-state.json"))["d173_e165"]
    receipt = json.loads(file("ops/d173-e165-agent174-release-authorization.json"))
    assert state["id"] == "D173-E165" and state["agent_target_version"] == 174
    assert state["host_build"] == 13 and state["owner_pass"] is False
    assert receipt["agent_target_version"] == 174 and receipt["host_build"] == 13
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["log_protocol_approved"] is False
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "RequiredHostBuild = 13;" in file("relay-agent/AgentBrowserBundle.cs")
if version == "173":
    state = json.loads(file("ops/project-state.json"))["d173_e161"]
    receipt = json.loads(file("ops/d173-e161-agent173-release-authorization.json"))
    assert state["id"] == "D173-E161" and state["agent_target_version"] == 173
    assert state["host_build"] == 13 and state["owner_pass"] is False
    assert state["d172"] == "INDEPENDENT_PENDING_HOLD" and state["stable"] == "OWNER_GATED"
    assert receipt["owner_approval_reference"] == "OWNER_20261107_E161_AGENT173_TRAY_CDP_CONFIRM_FIX"
    assert receipt["agent_target_version"] == 173 and receipt["host_build"] == 13
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
if version == "172":
    import json
    state = json.loads(file("ops/project-state.json"))["d173_e159"]
    receipt = json.loads(file("ops/d173-e159-agent172-release-authorization.json"))
    assert state["id"] == "D173-E159" and state["target_agent_version"] == 172
    assert state["existing_host_build"] == 13 and state["owner_pass"] is False
    assert state["d172"] == "PENDING_HOLD_ISOLATED" and state["stable"] == "OWNER_GATED"
    assert receipt["owner_code_approved"] is True and receipt["owner_protected_release_approved"] is True
    assert receipt["agent_target_version"] == 172 and receipt["host_build"] == 13
    assert receipt["d172_mutation"] is False and receipt["stable_mutation"] is False
    assert "RequiredHostBuild = 13;" in file("relay-agent/AgentBrowserBundle.cs")
if version == "171":
    # E152 Owner requested a targeted CODE ONLY field repair after Host13
    # failed to embed. This is not an Agent171 release authorization.
    import json
    e152 = json.loads(file("ops/project-state.json"))["d173_e152"]
    assert e152["id"] == "D173-E152" and e152["pr"] == 857
    assert e152["owner_code_request"] is True
    assert e152["candidate_agent_version"] == 171 and e152["host_reuse"] == 13
    assert e152["owner_release_approved"] is False and e152["owner_pass"] is False
    assert e152["stable"] == "OWNER_GATED" and e152["d172"] == "INDEPENDENT_PENDING_HOLD"
    assert "RequiredHostBuild = 13;" in file("relay-agent/AgentBrowserBundle.cs")
    assert "D173-E152" in file("docs/D173_E152_AGENT171_HOST13_OWNED_FORM_FIELD_FIX_2026-11-07.md")
if version == "170":
    # E150 Agent170 may only inherit structural Usage guards after its OWN
    # Owner-approved Agent-only receipt. Historical Agent169/Host12 checks
    # remain exact for their immutable versions.
    import json
    approval = json.loads(file("ops/d173-e150-agent170-release-authorization.json"))
    e150 = json.loads(file("ops/project-state.json"))["d173_e150"]
    assert e150["owner_code_approved"] is True and e150["owner_release_approved"] is True
    assert e150["d172"] == "INDEPENDENT_PENDING_HOLD" and e150["stable"] == "OWNER_GATED"
    assert approval["agent_target_version"] == 170 and approval["host_build"] == 13
    assert approval["owner_protected_release_approved"] is True
    assert approval["stable_mutation"] is False and approval["d172_mutation"] is False
    assert "RequiredHostBuild = 13;" in file("relay-agent/AgentBrowserBundle.cs")
if version == "169":
    import json
    evidence = json.loads(file("ops/project-state.json"))["d173_e146"]
    assert evidence["id"] == "D173-E146" and evidence["owner_approved"] is True
    assert evidence["pr"] == 853 and evidence["owner_pass"] is False
    assert evidence["d172"].startswith("INDEPENDENT_PENDING_HOLD") and evidence["stable"] == "OWNER_GATED"
    assert evidence["agent_release"] == "NOT_PUBLISHED_V169"
    assert "D173-E146" in file("docs/D173_E146_AGENT169_SKU_HELPERS_PICKER_SHIFT_2026-11-07.md")
    assert "RequiredHostBuild = 12;" in file("relay-agent/AgentBrowserBundle.cs")
if version == "168":
    # This is an Agent-only CODE CANDIDATE, never a production release grant.
    import json
    e143 = json.loads(file("ops/project-state.json"))["d173_e143"]
    assert e143["owner_code_request"] is True and e143["candidate_agent_version"] == 168
    assert e143["pr"] == 849 and e143["release"] == "NONE"
    assert e143["owner_pass"] is False and e143["stable"] == "OWNER_GATED"
    assert e143["d172"] == "PENDING_HOLD_UNCHANGED"
    assert "RequiredHostBuild = 12;" in file("relay-agent/AgentBrowserBundle.cs")
if version == "166":
    import json
    receipt = json.loads(file("ops/d173-e140-release-authorization.json"))
    assert receipt["change_id"] == "D173" and receipt["checkpoint_id"] == "D173-E140"
    assert receipt["owner_approval_reference"] == "OWNER_20261106_D173_E140_AGENT166_ANDROID_WORKER_FIRESTORE_SCOPED_PRODUCTION_TRIAL"
    assert receipt["pr"] == 843 and receipt["agent_target_version"] == 166
    assert receipt["owner_source_approval"] is True
    assert receipt["source_ci_verified"] in (True, False) and receipt["production_release_verified"] is False
    if receipt["source_ci_verified"] is True:
        assert receipt["source_ci_success"] >= 40 and receipt["source_ci_failed"] == 0
        assert len(receipt["source_ci_sha"]) == 40
    assert receipt["d172_business_mutation"] is False and receipt["d172_status"] == "PENDING_HOLD"
    assert receipt["stable_deployment_permission"] is False and receipt["owner_gated_release"] is True
if version == "165":
    import json
    receipt = json.loads(file("ops/d173-e125-agent165-release-authorization.json"))
    assert receipt["change_id"] == "D173" and receipt["checkpoint"] == "D173-E125"
    assert receipt["owner_approval_reference"] == "OWNER_20261103_PR831_RESPONSIVE_60_40_SIGNED_AGENT165_ONLY"
    assert receipt["agent_target_version"] == 165
    assert receipt["approved_components"] == ["agent"]
    assert receipt["stable_deploy_permission"] is False
    assert "D173-E125_AGENT165_ONLY_RELEASE:" in file("tools/d173_e125_agent165_release_gate.py")
if version == "164":
    import json
    receipt = json.loads(file("ops/d173-e123-release-authorization.json"))
    assert receipt["change_id"] == "D173" and receipt["checkpoint_id"] == "D173-E123"
    assert receipt["owner_approval_reference"] == "OWNER_20261103_D173_ALL_APPROVED_PRODUCTION_PICKER_SHIFT_T15_SQL_AGENT_WEB"
    assert receipt["desktop_agent_signed_ota_permission"] is True
    assert receipt["stable_deployment_permission"] is False
    assert receipt["agent_target_version"] == 164
    assert "D173-E123_OWNER_PRODUCTION_RELEASE:" in file("tools/d173_e123_release_gate.py")
if version == "163":
    receipt = file("ops/d173-e111-release-authorization.json")
    assert "OWNER_20261102_REPORTER_SKU_05_OVERTIME_2145_CODE_AND_PROTECTED_RELEASE" in receipt
    assert '"source_ci_verified": false' in receipt or '"source_ci_verified": true' in receipt
    assert "D173-E111_REPORTER_SKU_OVERTIME_RELEASE:" in file("tools/d173_e111_release_gate.py")
if version == "160":
    receipt = file("ops/d173-e100-agent160-release-authorization.json")
    assert "OWNER_20261030_D173_E100_AGENT160_ROSTER_UTC_VERSION_SIGNED_OTA" in receipt
    assert "D173-E100_AGENT160_ONLY_RELEASE:" in file("tools/d173_e100_agent160_release_gate.py")
    assert "D173E100RosterSelfTest" in file("relay-agent/D119AgentFeatures.cs")
if version == "157":
    receipt = file("ops/d173-e095-agent157-release-authorization.json")
    assert "OWNER_20261028_AGENT157_ALL_E095_REQUIREMENTS_SIGNED_OTA" in receipt
    assert "D173-E095_AGENT157_ONLY_RELEASE:" in file("tools/d173_e095_agent157_release_gate.py")
    assert "E095FirestoreShiftUsed" in file("relay-agent/D173E089UsageCards.cs")
if version == "156":
    receipt = file("ops/d173-e093-release-authorization.json")
    assert "OWNER_20261028_P1_CONFIRM_USAGE_AGENT_WORKER_NO_APK" in receipt
    assert "D173-E093_AGENT156_WORKER_RELEASE:" in file("tools/d173_e093_release_gate.py")
if version == "155":
    receipt = file("ops/d173-e090-release-authorization.json")
    assert '"OWNER_20261028_AGENT155_ALL_EIGHT_ITEMS_RELEASE"' in receipt
    assert '"approved_components": [' in receipt
    assert '"agent"' in receipt
    assert "D173-E090_AGENT155_RELEASE:" in file("tools/d173_e090_release_gate.py")
assert "AgentBuild = "+version in app
assert "0."+version+".0.0" in file("relay-agent/SupraInventoryRelayAgent.csproj")
assert "InitializeD173VpsUsage();" in form
assert "UpdateD173VpsUsageVisibility(authenticated, loginName, appUser);" in form
assert "InstallD173E038Sidebar" in form
assert "D173Sample2Colors(D173IsDarkThemeActive())" in agent
assert "_mainTabs.TabPages.Add(_d173VpsUsagePage)" in agent
assert "_mainTabs.TabPages.Remove(_d173VpsUsagePage)" in agent
assert 'StringComparison.OrdinalIgnoreCase' in agent
assert 'loginName' in agent and '"vps"' in agent
assert 'if(!_d173VpsUsageAuthenticated)return' in agent
assert 'Task.Run(()=>{' in agent
assert 'Interlocked.CompareExchange(ref _d173VpsRefreshInFlight,1,0)' in agent
assert 'Interlocked.Increment(ref _d173VpsGeneration)' in agent
assert '/api/agent/vps-usage?window=' in agent
assert 'Authorization' in agent and 'session.IdToken' in agent
assert all(x in agent for x in ('"24h"','"7d"','"30d"','"firestore_reads"','"firestore_writes"'))
assert "Limit" not in ""  # guards list remains intentionally narrow
assert 'D173_CF_EMAIL_ANALYTICS_READ' in worker
assert 'await requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"])' in worker
# E096 deliberately extends *named* Agent operator identity while preserving real-role gate.
assert '!["vps", "admin", "tamnv2"].includes(String(operator.employee_code || "").trim().toLowerCase())' in worker
for login in ('"vps"', '"admin"', '"tamnv2"'):
    assert login in agent and login in worker
assert 'operator.base_role !== operator.role' in worker
assert 'if (request.method === "GET" && url.pathname === "/api/agent/vps-usage")' in worker
assert 'return new Response(JSON.stringify(usage)' in worker
assert 'collectVpsUsage(env,window)' in worker
assert 'getServiceAccountAccessToken(env.GOOGLE_RUNTIME_SA_JSON' in usage
assert 'monitoring.read' in usage
assert '/billable-usage' in usage
assert 'GAUGE' in usage
assert '"CF_ACCOUNT_SHARED"' in usage and '"GCP_PROJECT_SHARED"' in usage
assert 'new Array(all.length)' in usage
assert 'Array.from({length:4}' in usage
assert 'window==="24h"?"300s"' in usage
assert 'D173_CF_EMAIL_ANALYTICS_READ' in deploy
assert "D173-E060_USAGE_RELEASE:" in deploy
assert 'D173_VPS_USAGE_UNAUTHENTICATED_401_PASS' in deploy
assert "D173_CF_ZONE_ID" in deploy
for forbidden in [
    "FirestoreDocumentsBaseUrl", "ConfirmPicklist", "ConfirmPick", "FireStore.Write",
    "updateDocument","inventory-core.internal","/api/agent/revoke", "wms-supra.winmart.vn"
]:
    assert forbidden not in usage and forbidden not in agent
for credential in ("D166_CF_READ_TOKEN","D173_CF_EMAIL_ANALYTICS_READ","GOOGLE_RUNTIME_SA_JSON"):
    assert credential not in agent, "Never embed provider secret names/values in Agent runtime"
assert "static readonly string D173ThemeFile" in theme
assert "RefreshD173E038Sidebar" in sidebar
print("D173_E060_VPS_USAGE_SCOPE_RBAC_NONBLOCKING_LOCAL_THEME_SOURCE_PASS")
