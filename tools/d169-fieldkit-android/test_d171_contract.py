#!/usr/bin/env python3
"""Source-level D171 field-kit invariants; APK compilation remains a separate CI gate."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
win = (root / "tools/d169-peer-windows/PeerForm.cs").read_text(encoding="utf-8")
pda = (root / "tools/d169-fieldkit-android/app/src/main/java/cd/cc/supra/inventory/beta/DiagHubActivity.kt").read_text(encoding="utf-8")
rules = (root / "firebase/firestore.rules").read_text(encoding="utf-8")
gradle = (root / "tools/d169-fieldkit-android/app/build.gradle.kts").read_text(encoding="utf-8")

checks = {
    "e025_resume_only_remaining_two_phases":
        "private const int ResumeStartPhase=3" in win and
        "private int _phase=ResumeStartPhase" in win and
        "_phase=ResumeStartPhase+1" in win and
        "private val resumeStartPhase=3" in pda and
        "private var phase=resumeStartPhase" in pda and
        "lastPassedPhase=resumeStartPhase-1" in pda and
        '"ready_phase" to resumeStartPhase' in pda,
    "e025_old_proof_stays_external_no_fake_pass":
        "ONLY_REMAINING_PHASES_4_5_FINISHED__EARLIER_THREE_EXTERNAL_LOGS_ONLY" in win and
        "HISTORICAL_EVIDENCE_ONLY_NOT_NEW_PASS" in pda and
        "E023 phase3 HA SLA FAIL" in pda and "historical_ha_sla_miss=true" in win,
    "e025_fresh_daily_pairing_salt_both_clients":
        "SUPRA-D171-E025-RESUME-P4-P5-V9|" in win and
        "SUPRA-D171-E025-RESUME-P4-P5-V9|" in pda and
        "SUPRA-D171-E024-AUTO-PAIR-V8|" not in win and
        "SUPRA-D171-E024-AUTO-PAIR-V8|" not in pda,
    "e025_android_upgrade": 'versionCode = 999925' in gradle and
        'versionName = "D171-DIAG-E025"' in gradle,
    "separate_scoped_firestore": 'd169_diag_sessions' in win and 'd169_diag_sessions' in pda,
    "five_phases": win.count("PDA NORMAL / A ") == 5 and pda.count("PDA NORMAL / A ") == 5,
    "windows_404_expected_wait": 'ExpectedDiscovery404(res.StatusCode,notFoundOkay)' in win,
    "agent_a_root_authority": '_agentLabel=="A"' in win and "D171_WAIT_ADMIN_A_START_TIMEOUT" in win,
    "android_waits_for_owner_agent": "D171_WAIT_FOR_AGENT_A_START_TIMEOUT" in pda,
    "3_member_same_phase": 'GetString(item,"ready_phase")==_phase.ToString()' in win,
    "pda_always_normal": 'networkField.isEnabled=false' in pda and '"ready_network" to "NORMAL"' in pda,
    "phase_announce_before_ready": 'await AnnouncePhaseToPicker();' in win,
    "immutable_ack_mandatory": "D171_PHASE_ACK_INCOMPLETE" in win,
    "phase_advance_requires_other_agent_pass": "WaitForPeerPhaseCompletion()" in win and "D171_PEER_PHASE_COMPLETE_TIMEOUT" in win,
    "no_repeated_history_read": '":runQuery"' in win and "GREATER_THAN_OR_EQUAL" in win and "D171_QUERY_WINDOW_OVERFLOW_STOP" in win,
    "local_http_read_cap": "D171_READ_BUDGET_STOP" in win,
    "agent_network_route_gate": "VerifyDiagnosticRoute()" in win and "NETWORK_MEASURED" in win,
    "pda_waits_exact_network_ready": "waitForBothAgentReady(root,newPhase)" in pda and "D171_TWO_AGENT_SAME_PHASE_READY_TIMEOUT" in pda,
    "pda_prevents_early_phase": "D171_PREVIOUS_ROUND_NOT_FINISHED" in pda,
    "pda_history_filtered": 'whereGreaterThanOrEqualTo("created_at",since)' in pda,
    "distinct_ack_counters": 'PDA_AGENT_ACK_SPLIT' in pda,
    "android_safe_error_code": 'private fun safeFailure(e:Throwable)' in pda,
    "rules_unchanged_scoped": 'match /d169_diag_sessions/{sid}' in rules,
    "no_production_log_upload": "uploadRuntimeLog(" not in pda and "private fun upload()" not in pda,
    "pda_write_and_time_caps": "private fun safeTestWrite()" in pda and
        "maxTestWrites = 250" in pda and "testDurationMs = 40L*60L*1000L" in pda and
        "postDelayed({stopAtDeadline()}" in pda and pda.count("safeTestWrite()") >= 7,
    "defer_early_phase_before_dispatch": "pendingNextPhase" in pda and
        'journal.event("PDA_PHASE_GATE","DEFER_PREVIOUS_ROUND"' in pda and
        "if(!dispatchedPhases.add(newPhase))return" in pda,
    "simulated_vps_return_after_network_restored": "VerifySimulatedVpsReturn()" in win and "D171_SIM_VPS_RETURN_TIMEOUT" in win,
    "vps_simulated_prefers_tamnv2": "VerifyInitialVpsPrimary()" in win and "_awaitInitialVpsClaim" in win and "D171_SIM_VPS_NOT_PRIMARY" in win,
    "failure_repair_office_transport_independent_of_ha_sla":
        "LATE_TAKEOVER_OUTSIDE_20S_SLA" in win and
        "SLA_MISS_20S_CONTINUE_OBSERVATION" in win and
        "NO_TAKEOVER_WITHIN_45S_HA_FAIL_NETWORK_CONTINUES" in win and
        "FIVE_NETWORK_PHASES_FINISHED_HA_NOT_PASS" in win and
        "D171_SIMULATED_FAILOVER_NOT_CONFIRMED" not in win and
        "while(Environment.TickCount64-started<45000)" in win,
    "windows_read_write_deadline": "MaxOneShotReadCalls = 550" in win and
        "MaxOneShotWriteCalls = 350" in win and "MaxOneShotDuration = TimeSpan.FromMinutes(40)" in win,
    "no_business_queue_calls": '"/relay_poc_jobs/"' not in win and 'collection("relay_poc_jobs")' not in pda,
}
bad = [key for key, ok in checks.items() if not ok]
if bad:
    raise SystemExit("D171_TEST_CLIENT_CONTRACT_FAIL: " + ",".join(bad))
print("D171_TEST_CLIENT_CONTRACT_PASS:", len(checks), "source contracts; physical networking not inferred")
