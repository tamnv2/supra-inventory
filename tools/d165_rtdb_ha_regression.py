#!/usr/bin/env python3
"""D165 Beta HA safety guard: role parity, scoped RTDB access, bounded fallback wake."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rules = json.loads((root / "firebase/database.rules.json").read_text(encoding="utf-8"))["rules"]
coordination = rules["relay_poc"]["coordination"]
ha = coordination["ha_liveness"]
for action in (".read", ".write"):
    expression = ha[action]
    assert "auth != null" in expression, (action, "missing authentication")
    assert "auth.token.app_session_channel == 'AGENT'" in expression, (action, "agent only")
    for role in ("ADMIN", "PICKPACK_ADMIN"):
        assert (
            f"auth.token.app_role == '{role}'" in expression
            and f"auth.token.app_base_role == '{role}'" in expression
        ), (action, role)
    assert "|| true" not in expression and "auth != null" in expression
assert rules[".read"] is False and rules[".write"] is False
assert rules["relay_poc"]["rate_limits"]  # no broad access to unrelated RTDB paths
assert "newData.child('agent_admin_user_id').val() == auth.token.app_user_id" in ha[".validate"]
assert "newData.child('generation').isString()" in ha[".validate"]
agent = (root / "relay-agent/RtdbHaLiveness.cs").read_text(encoding="utf-8")
catch = agent.split("RTDB HA realtime observer unavailable; Firestore lease fallback armed", 1)[1]
signal = catch.split("if (token.WaitHandle.WaitOne(1000)) return;", 1)[0]
assert "_lastStreamHealthy = false" in signal
assert "try { _updated(); } catch { }" in signal
assert signal.index("_lastStreamHealthy = false") < signal.index("try { _updated(); } catch { }")
assert 'reason=" + SafeFailureCode(ex)' in agent
assert "return \"HTTP_\" + (int)response.StatusCode" in agent
assert "idToken" not in agent.split("private static string SafeFailureCode(", 1)[1].split("private static long NowMs()", 1)[0]
config = (root / "relay-agent/AgentConfig.cs").read_text(encoding="utf-8")
version = (root / "relay-agent/VERSION").read_text(encoding="utf-8").strip()
assert version == "120" and "internal const int AgentBuild = 120;" in config
program = (root / "relay-agent/Program.cs").read_text(encoding="utf-8")
assert "// D161: Agent update is manual-only" in program
assert "_updateTimer.Stop();" in program
assert "Close();" in program  # updater still restarts on explicit install
transport = (root / "relay-agent/FirestoreConfirmationTransport.cs").read_text(encoding="utf-8")
assert "internal const long MaxPendingAgeMs = 20000L;" in transport
assert "VerifyPrimaryForBusinessIngress" in transport
assert "VerifyPrimaryBeforeMutation" in (root / "relay-agent/FirestoreAgentLeaderCoordinator.cs").read_text(encoding="utf-8")
print("D165 RTDB HA role parity, bounded observer wake, Agent v120 manual-update guard PASS")
