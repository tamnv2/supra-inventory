#!/usr/bin/env python3
"""D173-E113 source authority, runtime isolation and scope guard."""
from pathlib import Path
import json
repo=Path(__file__).resolve().parents[2]
root=repo/"tools/d173_e113_cloud_lab"
content=(root/"wrangler.toml").read_text()
assert 'name = "supra-inventory-m2-lab"' in content
assert 'main = "./cloud-worker.ts"' in content
assert 'class_name = "LabRealCore"' in content
assert 'storage = "sqlite"' in content
assert "workers_dev = true" in content
for word in ('[[routes]]','custom_domain = true','[triggers]','GOOGLE_RUNTIME_SA_JSON','CF_API_TOKEN','inventory.supra.cc.cd','supra-inventory-beta','supra-inventory-stable'):
    assert word not in content, ("forbidden remote config",word)
c=(root/"cloud-worker.ts").read_text()
assert 'from "../d173_e112_real_core_lab/worker"' in c
assert "M2_LAB_GATE_KEY" in c and "M2_LAB_EXPIRES_AT" in c
assert 'new Response(result.body' in c
for word in ("https://inventory.supra.cc.cd","wrangler deploy","FIREBASE_WEB_API_KEY","private_key"):
    assert word not in c
scope=json.loads((repo/"ops/project-scope.json").read_text())
resource={r["key"]:r for r in scope["resources"]}
assert resource["d173-m2-test-worker"]["name"]=="supra-inventory-m2-lab"
assert resource["d173-m2-test-do"]["name"]=="LabRealCore"
assert resource["d173-m2-test-do"]["environment"]=="test"
print("D173_E113_CLOUD_LAB_SOURCE_SCOPE_GUARD_PASS")
