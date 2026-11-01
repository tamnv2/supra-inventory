"""Validate E109 code-only authority; never grants release or calls a provider."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--reject-old-e055-release', action='store_true')
args = parser.parse_args()
approval = json.loads((ROOT / 'ops/d173-e109-code-authorization.json').read_text(encoding='utf-8'))
assert approval['status'] == 'OWNER_CODE_ONLY_APPROVED'
assert approval['code_permission'] is True and approval['stop_at'] == 'CODE_READY'
for key in ['merge_main_permission', 'deployment_permission', 'provider_write_permission',
            'ota_publication_permission', 'stable_permission', 'd172_business_changes']:
    assert approval[key] is False, key
journal = json.loads((ROOT / 'ops/change-continuity/D173.json').read_text(encoding='utf-8'))
assert journal['change_id'] == 'D173'
assert journal['deployment_gate'].startswith('E109_OWNER_CODE_ONLY_APPROVED')
entry = next(x for x in journal['entries'] if x['id'] == 'D173-E109')
assert entry['owner_approval'] is True and entry['kind'] == 'OWNER_COMMAND'
if args.reject_old_e055_release:
    result = subprocess.run([sys.executable, 'tools/d173_e055_worker_release_gate.py',
                             '--component', 'worker', '--preflight'], cwd=ROOT,
                            text=True, capture_output=True)
    assert result.returncode != 0, 'new source cannot inherit the old E055 release pin'
    assert 'D173_E055_WORKER_RELEASE_DENIED' in result.stderr
print('D173_E109_CODE_ONLY_BOUNDARY_PASS__OLD_RELEASE_GRANTS_NOT_REUSED')
