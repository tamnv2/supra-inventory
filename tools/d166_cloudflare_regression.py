#!/usr/bin/env python3
"""D166 Agent Usage least privilege + no new polling/regression contract."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding="utf-8")
worker=read("service/src/index.ts")
core=read("service/src/core.ts")
module=read("service/src/d166-cloudflare-usage.ts")
gateway=read("ops/apps-script/agent-log-gateway/Code.gs")
deploy=read(".github/workflows/deploy-beta.yml")
agent=read("relay-agent/D166UsageExport.cs")
for v in ("POST", "/api/agent/d166/usage",
          "D166_BETA_ONLY","collectD166Cf(env,start,end)"):
    assert v in worker, "missing worker guard "+v
if 'authorizedAgentRead(request, env, "usage-diagnostics")' in worker:
    bridge=worker.split("async function authorizedAgentRead(",1)[1].split("async function constantTimeEqual(",1)[0]
    for v in ("readBearerToken(request)", "verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID)",
              '"x-supra-auth-uid": identity.uid', '"x-supra-session-channel": identity.sessionChannel'):
        assert v in bridge, "missing verified Agent bridge guard "+v
    authorized=core.split('url.pathname === "/authorized/agent/read"',1)[1].split('url.pathname === "/authorized/operational/reporter/snapshot"',1)[0]
    for v in ('this.getUserByFirebaseUid(uid)', 'user.status !== "ACTIVE"', 'channel !== "" && channel !== "AGENT"',
              'Number(user.firebase_agent_ready || 0) !== 1', 'user.base_role !== user.role',
              '["ADMIN", "PICKPACK_ADMIN"].includes(user.role)', 'operation === "usage-diagnostics"',
              '["admin", "tamnv2"].includes(String(user.employee_code || "").trim().toLowerCase())',
              'error: "D166_PRIVILEGED_AGENT_REQUIRED"'):
        assert v in authorized, "missing live Core Agent guard "+v
    assert authorized.index('user.status !== "ACTIVE"') < authorized.index('operation === "usage-diagnostics"')
else:
    assert "requireAgentUser(request,env" in worker and '["admin","tamnv2"]' in worker, "missing legacy Agent guards"
for v in ("workersInvocationsAdaptive(", 'scriptName:"', "SHARED_ACCOUNT_UNATTRIBUTABLE",
          "NAMESPACE_NOT_CANONICALLY_SCOPED", "billable-usage", "MAX_HOURS = 25"):
    assert v in module, "missing provider safeguard "+v
assert "D166_CF_READ_TOKEN" in module and "D166_CF_READ_TOKEN" not in gateway
assert "provision_d166_cloudflare" not in gateway
assert "D166_CF_READ_TOKEN" not in agent
assert "collectD166Cloudflare_(start, end, idToken)" in gateway
assert "/api/agent/d166/usage" in gateway
for v in ("D166_CF_READ_TOKEN", "wrangler@4 secret put", "wrangler.beta.toml",
          "D166_READONLY_CLOUDFLARE_TOKEN_ACTIVE_PASS"):
    assert v in deploy, "missing secure deploy guard "+v
assert "get_firestore_usage" in gateway and "upload_agent_log" in gateway
assert "manual_dashboard_links.txt" in agent and "checksums.sha256" in agent
assert "NAMESPACE_NOT_CANONICALLY_SCOPED" in module
print("D166_WORKER_GATEWAY_READONLY_SECURITY_CONTRACT=PASS")
