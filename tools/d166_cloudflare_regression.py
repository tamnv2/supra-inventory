#!/usr/bin/env python3
"""D166 Agent Usage least privilege + no new polling/regression contract."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding="utf-8")
worker=read("service/src/index.ts")
module=read("service/src/d166-cloudflare-usage.ts")
gateway=read("ops/apps-script/agent-log-gateway/Code.gs")
deploy=read(".github/workflows/deploy-beta.yml")
agent=read("relay-agent/D166UsageExport.cs")
for v in ("POST", "/api/agent/d166/usage", "requireAgentUser(request,env", '["admin","tamnv2"]',
          "D166_BETA_ONLY","collectD166Cf(env,start,end)"):
    assert v in worker, "missing worker guard "+v
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
