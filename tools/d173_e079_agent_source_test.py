#!/usr/bin/env python3
"""D173-E079 source guards: native Agent-only confirm and Usage behavior."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def source(name): return (ROOT/name).read_text(encoding="utf-8")
scan=source("relay-agent/SupraConfirmBrowser.cs")
pipe=source("relay-agent/D160ConfirmPipeline.cs")
screen=source("relay-agent/D173E079UsageDashboard.cs")
usage=source("relay-agent/D173VpsUsage.cs")
theme=source("relay-agent/D173E036Theme.cs")
android=source("android/app/src/main/java/cd/cc/supra/inventory/beta/PickerController.kt")
assert 'AlreadyConfirmedFragments' in scan
assert "boxes.length === 1 && !boxReady" in scan
assert "row.querySelectorAll('button,a,[role=button]" in scan
assert "=== 'Xác nhận lấy lại hàng'" in scan
assert "alreadyConfirmed[term].includes(code)" in scan
s=scan.split("private string BuildScanScript(List<string> terms)",1)[1].split(
    "private static string BuildClickButtonScript",1)[0]
assert "box.click()" not in s and "confirm.click()" not in s
assert 'ALREADY_CONFIRMED", "BROWSER_DOM+SAME_ROW_RECLAIM_ACTION"' in pipe
assert 'recovered.AlreadyConfirmedFragments.Contains' in pipe
assert 'RecordD158ConfirmOutcome(string.Equals(outcome.Result, "CONFIRMED"' in pipe
assert 'string.Equals(outcome.Result, "ALREADY_CONFIRMED"' in pipe
assert '"ALREADY_CONFIRMED" ->' in android and 'SFT / SFT 3' in android
for item in ("cf_worker_requests","cf_do_requests","cf_do_rows_read","cf_worker_cpu",
    "cf_do_rows_written","firestore_reads","firestore_writes","firestore_deletes",
    "cloud_run_requests","rtdb_https_requests","drive_requests","sheets_requests"):
    assert item in screen, "Missing dedicated real-source metric "+item
assert 'ScrollBars=ScrollBars.Horizontal' in screen
assert "E079GrowGrid();" in usage and "E079RefreshMeters(latest);" in usage
assert 'D173VietnamNight()' in theme
assert 'return v.ToString("N0"' in usage
assert 'D173VpsPercent' in usage
print("D173_E079_AGENT152_CONFIRM_USAGE_SOURCE_PASS")
