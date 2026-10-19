#!/usr/bin/env python3
"""Source-level D171 field-kit invariants; APK compilation remains a separate CI gate."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
win = (root / "tools/d169-peer-windows/PeerForm.cs").read_text(encoding="utf-8")
pda = (root / "tools/d169-fieldkit-android/app/src/main/java/cd/cc/supra/inventory/beta/DiagHubActivity.kt").read_text(encoding="utf-8")
rules = (root / "firebase/firestore.rules").read_text(encoding="utf-8")

checks = {
    "separate_scoped_firestore": 'd169_diag_sessions' in win and 'd169_diag_sessions' in pda,
    "five_phases": win.count("PDA NORMAL / A ") == 5 and pda.count("PDA NORMAL / A ") == 5,
    "windows_404_expected_wait": 'ExpectedDiscovery404(res.StatusCode,notFoundOkay)' in win,
    "agent_a_root_authority": '_agentLabel=="A"' in win and "D171_WAIT_ADMIN_A_START_TIMEOUT" in win,
    "android_waits_for_owner_agent": "D171_WAIT_FOR_AGENT_A_START_TIMEOUT" in pda,
    "3_member_same_phase": 'GetString(item,"ready_phase")==_phase.ToString()' in win,
    "pda_always_normal": 'networkField.isEnabled=false' in pda and '"ready_network" to "NORMAL"' in pda,
    "phase_announce_before_ready": 'await AnnouncePhaseToPicker();' in win,
    "immutable_ack_mandatory": "D171_PHASE_ACK_INCOMPLETE" in win,
    "android_safe_error_code": 'private fun safeFailure(e:Throwable)' in pda,
    "rules_unchanged_scoped": 'match /d169_diag_sessions/{sid}' in rules,
    "no_business_queue_calls": '"/relay_poc_jobs/"' not in win and 'collection("relay_poc_jobs")' not in pda,
}
bad = [key for key, ok in checks.items() if not ok]
if bad:
    raise SystemExit("D171_TEST_CLIENT_CONTRACT_FAIL: " + ",".join(bad))
print("D171_TEST_CLIENT_CONTRACT_PASS:", len(checks), "source contracts; physical networking not inferred")
