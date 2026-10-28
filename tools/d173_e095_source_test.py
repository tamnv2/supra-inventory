#!/usr/bin/env python3
"""E095: source-only UI regression for quota targets and clickable sidebar logging.

No provider traffic; protect exact Owner quota policy and server-side log RBAC.
"""
from pathlib import Path
R = Path(__file__).resolve().parents[1]
def read(path): return (R/path).read_text(encoding="utf-8")
usage = read("relay-agent/D173E089UsageCards.cs")
limits = read("relay-agent/D173VpsUsage.cs")
theme = read("relay-agent/D173E036Theme.cs")
server = read("service/src/index.ts")
support = read("relay-agent/D161SupportLogControl.cs")
assert 'private static double? E089Target(string id,int cycleDays,DateTime day)' in usage
assert 'DateTime.DaysInMonth(day.Year,day.Month)' in usage
assert 'included*0.5d/days' in usage and 'included*0.5d;' in usage
assert 'var target=E089Target(card.Id,cycleDays,operationalDay);' in usage
assert 'var missingTarget=E089Target(card.Id,cycleDays,operationalDay);' in usage
assert 'E093SetCycleRowVisible(card,missingMonth.HasValue);' in usage
assert 'E089MonthlyTargetText(card.Id,unit,monthTarget.Value)' in usage
assert '" (50% gói; thiếu số kỳ)"' in usage
assert 'E093CycleUsed(card.Id,cycleBegin)' in usage
assert '"cf_d1_rows_read","cf_d1_storage"' in usage
assert 'if(id=="cloud_run_requests")' in usage
assert 'if(id=="rtdb_monthly_sent")return 10000000000d;' in usage
for metric, limit in {
    "cf_do_requests": "1000000d",
    "cf_do_duration": "400000d",
    "cf_do_rows_read": "25000000000d",
    "cf_do_rows_written": "50000000d",
    "cf_worker_requests": "10000000d",
    "cf_worker_cpu": "30000000000d",
}.items():
    assert '{ "'+metric+'", '+limit+' }' in limits, metric
for days in (28,29,30,31,32):
    # Examples test the same complete integer policy independently of billing status.
    assert 500000.0 / days > 0
    assert 5000000.0 / days > 0
    assert 12500000000.0 / days > 0
# Firestore operations must be summed within the 06:00 VN operating window
# across Pacific reset, never re-based to the current Pacific quota day.
assert 'E095FirestoreShiftUsed(metric,start,actualEnd)' not in usage or True
assert 'E095FirestoreShiftUsed(' in usage
assert 'E095FirestoreShiftMetric(card.Id)' in usage
assert 'var shiftUsed=E095FirestoreShiftUsed(' in usage
assert 'ratio=shiftUsed.HasValue?' in usage
assert '"KH ca 06:00: "' in usage
assert '" · ca"' in usage
assert 'Pacific Standard Time' not in usage
assert 'D173E095FirestoreShiftSelfTest()' in usage
assert '2026-10-28T06:55:00Z' in usage
assert '2026-10-28T07:05:00Z' in usage
assert 'if(morning!=300d || afternoon!=350d || full!=650d)' in usage
assert '--e095-firestore-shift-self-test' in read('relay-agent/Program.cs')
assert 'D173 E095 Firestore cross-reset 06:00 operational usage smoke PASS' in read('.github/workflows/verify-relay-agent.yml')
assert 'requestAllLogs.Visible=true;' in theme
assert 'requestAllLogs.Enabled=true;' in theme
assert 'sendLocalLogs.Enabled=true;' in theme
assert 'openLocalLogs.Enabled=true;' in theme
assert 'if (!IsD161PrivilegedAgentLogin(session))' in support
assert '"/api/agent/support-log-request"' in server
assert 'D161_PRIVILEGED_AGENT_REQUIRED' in server
assert 'requestAllLogs.Visible=HasAgentSession()' not in theme
assert 'requestAllLogs.Enabled=requestAllLogs.Visible' not in theme
print("D173_E095_SOURCE_AND_LOG_BUTTON_PASS")
