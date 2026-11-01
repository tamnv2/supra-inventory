#!/usr/bin/env python3
"""E109 CODE ONLY: permit exact reviewed routing edits, preserve all other mail/auth bytes."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = "f15b9675b7de33194dbb43980fd5934ee09958fc"

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def old(path):
    return subprocess.check_output(["git", "show", BASE + ":" + path], cwd=ROOT, text=True, encoding="utf-8")

def region(text, start, end):
    assert text.count(start) == 1, "EXPECTED_UNIQUE_SOURCE_REGION:" + start
    begin = text.index(start)
    finish = text.index(end, begin) if end else len(text)
    return begin, finish, text[begin:finish]

def unchanged(path):
    before = subprocess.check_output(["git", "show", BASE + ":" + path], cwd=ROOT)
    current = (ROOT / path).read_bytes()
    try:
        return current.decode("utf-8").replace("\r\n", "\n") == before.decode("utf-8").replace("\r\n", "\n")
    except UnicodeDecodeError:
        return current == before

def verify():
    auth = json.loads(read("ops/d173-e109-code-authorization.json"))
    assert auth["checkpoint_id"] == "D173-E109" and auth["code_permission"] is True
    assert auth["stop_at"] == "CODE_READY"
    for field in ("merge_main_permission", "deployment_permission", "provider_write_permission",
                  "ota_publication_permission", "stable_permission", "d172_business_changes"):
        assert auth[field] is False, "E109_CODE_ONLY_BOUNDARY:" + field
    assert json.loads(read("ops/production-analysis-base-20261101.json"))["worker"]["source_sha"] == BASE
    protected = ["service/src/google-mail.ts", "service/src/system-reset.ts", "service/src/privileged-auth.ts",
                 "service/src/firebase-auth-admin.ts", "service/src/notification-api.ts",
                 "ops/d173-email-release-authorization.json", "ops/d173-email-sender-activation-authorization.json",
                 "ops/project-scope.json", "ops/resource-registry.json", "service/wrangler.stable.toml"]
    for path in protected:
        assert read(path) == old(path), "E109_PROTECTED_MAIL_AUTH_RESOURCE_DRIFT:" + path
    for path in subprocess.check_output(["git", "ls-tree", "-r", "--name-only", BASE, "service/src", "obpp1291", "firebase"], cwd=ROOT, text=True).splitlines():
        if path.startswith(("obpp1291/", "firebase/", "service/src/obpp1291-")):
            assert unchanged(path), "E109_D172_FIREBASE_DRIFT:" + path

    # Hash only the independently reviewed new routing regions, then restore
    # their baseline equivalents. Full remaining index bytes must be identical:
    # login/OTP/OAuth/session/OBPP routes cannot slip into a generic exception.
    regions = [
        ("async function authorizedAgentRead(", "async function constantTimeEqual(", "f5fba0d53331e0324728a5d877f355ecfe105b8b250cfdf8df29fb325e13f36c", True),
        ('      if (request.method === "GET" && url.pathname === "/health/routine") {', '      if (request.method === "GET" && url.pathname === "/health") {', "4bb8d76a59aa8d5074e44a38a71a59b72dfb0d325da85d8ad8447f6d7e956eaf", True),
        ('      if (url.pathname.startsWith("/api/agent/d167/skus/")) {', '      if (request.method === "POST" && url.pathname === "/api/agent/reauth") {', "765341f2f07163f780025dedb4314faada409a20930c407f240572db4bda10d7", False),
        ('      if (request.method === "POST" && url.pathname === "/api/agent/d166/usage") {', '      if (request.method === "GET" && url.pathname === "/api/agent/log-day-folder") {', "9599790b7d487a7bdf0f6ccc2ea1625698c648fd101e7c68ae2b47f1585a7a45", False),
        ('      if (request.method === "GET" && url.pathname === "/api/agent/d173/reporter-online") {', '      const readResponse = await handleReadApi(request, env);', "5f23edea283736260af6ece8263b8a59b95506b6ba7f299e5226af02cb66fe9a", False),
        ("async function checkCore(", "async function getUserByUsername(", "cec23d66547bebd24922d465866651cd3c5cdbee6208da650fa70ecd161add3a", False),
        ("  async scheduled(", None, "075f7e8409a73174ba17df9e17dc916286535a63d06768fd4787ac1811413f50", False),
    ]
    current, baseline = read("service/src/index.ts"), old("service/src/index.ts")
    for start, end, expected, added in regions:
        begin, finish, value = region(current, start, end)
        assert hashlib.sha256(value.encode()).hexdigest() == expected, "E109_ROUTING_REGION_CHANGED:" + start
        replacement = "" if added else region(baseline, start, end)[2]
        current = current[:begin] + replacement + current[finish:]
    substitutions = [
        ('import { runD173ScheduledMaintenance } from "./d173-background-worker";\n', ""),
        ('import { listRuntimeLogs, readRuntimeLog, uploadRuntimeLog,', 'import { listRuntimeLogs, readRuntimeLog, retryBufferedRuntimeLogArchives, uploadRuntimeLog,'),
        ('  processHrSnapshot,\n  readHrEventState,', '  processHrSnapshot,\n  retryIncompleteHrSnapshotIfDue,\n  readHrEventState,'),
    ]
    for after, before in substitutions:
        assert current.count(after) == 1, "E109_EXPECTED_IMPORT_DIFF_MISSING"
        current = current.replace(after, before, 1)
    assert current == baseline, "E109_INDEX_CHANGED_OUTSIDE_EXACT_APPROVED_ROUTING"

    # The only public JWT verifier edit exposes its already verified expiration.
    current = read("service/src/auth.ts")
    for addition in ('  // Verified JWT expiry (seconds), used only to bind negotiated command sockets.\n  expiresAt?: number;\n',
                     '    expiresAt: Number(claims.exp),\n'):
        assert current.count(addition) == 1, "E109_EXPECTED_VERIFIED_EXPIRY_DIFF_MISSING"
        current = current.replace(addition, "", 1)
    assert current == old("service/src/auth.ts"), "E109_JWT_SIGNATURE_SESSION_GUARD_CHANGED"
    asset_diff = '# Only public Vite bundles bypass the Worker. All APIs, health, OAuth,\n# downloads, HTML and legal pages retain their existing Worker routing.\nrun_worker_first = ["/*", "!/assets/*"]'
    config = read("service/wrangler.beta.toml")
    assert config.count(asset_diff) == 1
    assert config.replace(asset_diff, "run_worker_first = true", 1) == old("service/wrangler.beta.toml"), "E109_BINDING_SENDER_RESOURCE_CONFIG_DRIFT"
    print("D173_E109_CODE_ONLY_EXACT_ROUTING__MAIL_AUTH_D172_AND_RESOURCES_PRESERVED_PASS")

if __name__ == "__main__":
    verify()
    if "--self-test" in sys.argv:
        original_read = read
        def reject_change(path, transform):
            before = original_read(path)
            altered = transform(before)
            assert altered != before, "NEGATIVE_FIXTURE_DID_NOT_CHANGE_SOURCE"
            def injected(candidate):
                return altered if candidate == path else original_read(candidate)
            globals()["read"] = injected
            try:
                try:
                    verify()
                except AssertionError:
                    return
                raise RuntimeError("PRESERVATION_GUARD_ACCEPTED_NEGATIVE_FIXTURE:" + path)
            finally:
                globals()["read"] = original_read
        reject_change("service/src/index.ts", lambda text: text.replace('if (!user || user.status !== "ACTIVE")', 'if (!user)', 1))
        reject_change("service/src/auth.ts", lambda text: text.replace('if (!verified) throw', 'if (false) throw', 1))
        reject_change("service/wrangler.beta.toml", lambda text: text.replace('PROJECT_MAIL_SENDER = "no-reply@supra.cc.cd"', 'PROJECT_MAIL_SENDER = "changed@example.invalid"', 1))
        reject_change("ops/d173-e109-code-authorization.json", lambda text: text.replace('"deployment_permission": false', '"deployment_permission": true', 1))
        print("D173_E109_MAIL_GUARD_NEGATIVE_AUTH_SENDER_AND_RELEASE_BOUNDARY_PASS")
