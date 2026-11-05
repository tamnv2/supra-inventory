#!/usr/bin/env python3
"""E140: exact accepted-main-to-proposed Firestore delta; not deployment authority."""
import subprocess
from pathlib import Path

def read_main(path: str) -> str:
    return subprocess.check_output(["git","show","origin/main:"+path],text=True)
def require(condition, code: str):
    if not condition:
        raise SystemExit("D173_E140_RULES_DELTA_FAIL:" + code)

accepted = read_main("firebase/firestore.rules")
current = Path("firebase/firestore.rules").read_text(encoding="utf-8")
replacements = [
    ("    function isPicker() {\n      return request.auth != null\n        && request.auth.token.app_role == 'PICKER'\n        && request.auth.token.app_user_id != null;\n    }\n\n", "    // A signed Firebase Picker token expires at the authoritative Worker\n    // shift cutoff even if the PDA is off, offline or cannot post logout.\n    // Old Picker tokens without the cutoff fail closed at the next Rules check.\n    function pickerShiftStillValid() {\n      return request.auth != null\n        && request.auth.token.app_session_channel == 'ANDROID'\n        && request.auth.token.picker_shift_logout_at_ms is int\n        && request.auth.token.picker_shift_logout_at_ms > request.time.toMillis();\n    }\n\n    function isPicker() {\n      return request.auth != null\n        && request.auth.token.app_role == 'PICKER'\n        && request.auth.token.app_user_id != null\n        && pickerShiftStillValid();\n    }\n\n"),
    ("    match /relay_poc_rate_limits/{pickerKey} {\n      allow get, create, update, delete: if isAgentOperator();\n      allow list: if false;\n    }\n\n", "    match /relay_poc_rate_limits/{pickerKey} {\n      // E140: Picker may subscribe to its OWN locked state only, via an\n      // exact document GET. No Picker collection queries or writes.\n      allow get: if isAgentOperator() || (\n        isPicker()\n        && resource.data.picker_uid == request.auth.uid\n        && resource.data.picker_user_id == request.auth.token.app_user_id\n      );\n      // Only authenticated Agent operators may subscribe to fleet locks.\n      allow list: if isAgentOperator();\n      allow create, update, delete: if isAgentOperator();\n    }\n\n"),
    ("            && request.resource.data.resolved_by_agent_id == resource.data.sender_agent_id\n", "            && request.resource.data.resolved_by_agent_id is string\n            && request.resource.data.resolved_by_agent_id.size() >= 8\n            && request.resource.data.resolved_by_agent_id.size() <= 160\n")
    ("    function isAndroidScheduleReader() {\n      return request.auth != null\n        && request.auth.token.app_session_channel == 'ANDROID'\n        && request.auth.token.app_user_id != null\n        && request.auth.token.app_role in ['PICKER', 'REPORTER', 'ADMIN'];\n    }", "    function isAndroidScheduleReader() {\n      return request.auth != null\n        && request.auth.token.app_session_channel == 'ANDROID'\n        && request.auth.token.app_user_id != null\n        && request.auth.token.app_role in ['PICKER', 'REPORTER', 'ADMIN']\n        // E140: schedule GET is not a back door for expired Picker sessions.\n        && (request.auth.token.app_role != 'PICKER' || pickerShiftStillValid());\n    }")
]
expected = accepted
for index,(before,after) in enumerate(replacements):
    require(expected.count(before)==1, "MAIN_ANCHOR_"+str(index))
    expected = expected.replace(before, after, 1)
require(expected==current, "UNAUTHORIZED_FIRESTORE_CHANGE")
for path in ("firebase.json","firebase/firestore.indexes.json"):
    require(read_main(path)==Path(path).read_text(encoding="utf-8"),"OTHER_FIREBASE_CHANGED_"+path)
# No D172/OBPP collection, auth scope, role claim, production deployment, or
# hidden rule changes are accepted by the byte-exact transformation above.
print("D173_E140_EXACT_SHARED_RULES_DELTA_PASS__D172_RULES_UNCHANGED")
