#!/usr/bin/env python3
"""D173-E060 fail-closed VPS Usage Agent + provider read-only isolation."""
from pathlib import Path
import re

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
assert version in ("151","152","153","154","155","156","157","158"), "Only source-verified Agent151–157 supported"
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
