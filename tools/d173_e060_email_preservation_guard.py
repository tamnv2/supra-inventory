#!/usr/bin/env python3
"""D173-E060 strict non-mutation of existing mail/auth Worker source."""
from pathlib import Path
import subprocess

# Compare with accepted pre-E060 main: origin/main contains the E060 route
# after PR756 merge, and would falsely reject the intended isolated addition.
BASE_SHA = "be667eb7b54040423df74289902a5a3b4824a59a"
def old(path):
    return subprocess.check_output(["git","show",BASE_SHA+":"+path],text=True)
root=Path(__file__).resolve().parents[1]
protected=(
  "service/src/google-mail.ts",
  "service/src/system-reset.ts",
  "service/wrangler.beta.toml",
  "ops/d173-email-release-authorization.json",
  "ops/d173-email-sender-activation-authorization.json",
  "service/src/obpp1291-core.ts",
)
# E111 and subsequent signed Agent releases must compare protected resources to the
# currently accepted main merge-base, not an E060 pre-release SHA which has
# intentionally evolved in authorized intervening releases. No protected
# email/D172/Worker-index bytes may be changed by this candidate.
version = int((root / "relay-agent/VERSION").read_text().strip())
if version >= 150:
    accepted = subprocess.check_output(
        ["git", "merge-base", "origin/main", "HEAD"], text=True).strip()
    for path in protected + ("service/src/index.ts",):
        accepted_file = subprocess.check_output(
            ["git", "show", accepted + ":" + path], text=True)
        assert (root / path).read_text() == accepted_file, "PROTECTED_CURRENT_MAIN_CHANGED:" + path
    print("D173_E060_CURRENT_MAIN_EMAIL_D172_INDEX_IMMUTABLE_PASS")
    raise SystemExit(0)

for path in protected:
    assert (root/path).read_text()==old(path), "PROTECTED_EMAIL_OR_D172_CHANGED:"+path
current=(root/"service/src/index.ts").read_text()
baseline=old("service/src/index.ts")
current=current.replace('import { collectVpsUsage } from "./d173-vps-usage";\n',"",1)
current=current.replace('  D173_CF_EMAIL_ANALYTICS_READ?: string;\n  D173_CF_ZONE_ID?: string;\n',"",1)
mark="      // D173-E096 exact named privileged logins, read-only usage monitoring."
next_route='      if (request.method === "POST" && url.pathname === "/api/agent/d166/usage") {'
assert current.count(mark)==1 and current.count(next_route)==1
start=current.index(mark)
stop=current.index(next_route,start)
block=current[start:stop]
for required in (
    'GET" && url.pathname === "/api/agent/vps-usage"',
    'requireAgentUser(request, env, ["ADMIN", "PICKPACK_ADMIN"])',
    '!["vps", "admin", "tamnv2"].includes(String(operator.employee_code || "").trim().toLowerCase())',
    'collectVpsUsage(env,window)',
):
    assert required in block, required
assert "sendProjectEmail" not in block
assert "coreStub(" not in block
current=current[:start]+current[stop:]
assert current==baseline, "WORKER_INDEX_CHANGED_OUTSIDE_NEW_VPS_READONLY_ROUTE"
print("D173_E060_EXISTING_MAIL_AND_D172_BYTE_EXACT_READONLY_ROUTE_PASS")
