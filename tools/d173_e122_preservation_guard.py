#!/usr/bin/env python3
"""D173-E122 exact-source preservation: only one new aggregate read route."""
from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)
baseline = git("merge-base", "origin/main", "HEAD").strip()
def unchanged(path):
    before = git("show", baseline + ":" + path).replace("\r\n", "\n")
    after = (ROOT / path).read_text(encoding="utf-8").replace("\r\n", "\n")
    assert before == after, "E122_PROTECTED_SOURCE_CHANGED:" + path
for path in (
    "service/src/google-mail.ts", "service/src/system-reset.ts",
    "service/src/privileged-auth.ts", "service/src/firebase-auth-admin.ts",
    "service/src/notification-api.ts", "service/src/auth.ts",
    "service/wrangler.beta.toml", "service/wrangler.stable.toml",
    "ops/d173-email-release-authorization.json",
    "ops/d173-email-sender-activation-authorization.json",
    "ops/project-scope.json", "ops/resource-registry.json",
):
    unchanged(path)
original = git("show", baseline + ":service/src/index.ts").replace("\r\n", "\n")
source = (ROOT / "service/src/index.ts").read_text(encoding="utf-8").replace("\r\n", "\n")
addition = 'import { verifyD173SqlAuditSignature, D173_SQL_AUDIT_PATH } from "./d173-sql-audit-auth";\n'
assert source.count(addition) == 1, "E122_IMPORT_WRONG"
source = source.replace(addition, "", 1)
start = "      // D173: short-lived signed service-to-service read, limited to aggregate query IDs.\n"
stop = '      if (request.method === "POST" && url.pathname === "/api/internal/d161/hr-drive-watch") {'
assert source.count(start) == 1 and source.count(stop) == 1, "E122_ROUTE_BOUNDARY_MISSING"
a = source.index(start)
b = source.index(stop, a)
route = source[a:b]
for mark in (
    'url.pathname === D173_SQL_AUDIT_PATH',
    'env.APP_ENV !== "beta"',
    'verifyD173SqlAuditSignature(request, env.D166_CF_READ_TOKEN)',
    'return json({ error: "D173_SQL_AUDIT_FORBIDDEN" }, 403)',
    'inventory-core.internal/diagnostics/d167/usage',
    '"cache-control": "no-store"',
):
    assert mark in route, "E122_ROUTE_GUARD_MISSING:" + mark
for forbidden in ("sendProjectEmail", "sendFcm", "admin/load-test", "user-management", "UPDATE ", "DELETE "):
    assert forbidden not in route, "E122_ROUTE_SCOPE_FORBIDDEN:" + forbidden
source = source[:a] + source[b:]
assert source == original, "E122_INDEX_CHANGED_OUTSIDE_EXACT_READ_ONLY_ROUTE"
for path in git("ls-tree", "-r", "--name-only", baseline, "service/src", "obpp1291", "firebase").splitlines():
    if path.startswith(("obpp1291/", "firebase/", "service/src/obpp1291-")):
        unchanged(path)
print("D173_E122_EXACT_SQL_AGGREGATE_ROUTE_EMAIL_AUTH_D172_IMMUTABILITY_PASS")
