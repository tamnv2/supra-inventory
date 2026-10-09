from pathlib import Path

root=Path('relay-agent')
assert (root/'VERSION').read_text().strip()=='123'
assert 'AgentBuild = 123' in (root/'AgentConfig.cs').read_text()
assert 'SnapshotUsageAudit()' in (root/'FirestoreQuotaGuard.cs').read_text()
assert 'FirestoreQuotaGuard.SnapshotUsageAudit()' in (root/'AgentLogUploadBridge.cs').read_text()
assert 'FirestoreQuotaGuard.RecordOutcome(' in (root/'FirestoreHttpTransport.cs').read_text()
assert 'd166UsageAudit()' in Path('web/src/runtime-logger.ts').read_text()
assert 'D166UsageAudit.recordApi(' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt').read_text()
assert 'd166_usage_audit' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt').read_text()
assert 'D166UsageAudit.snapshot(journal)' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt').read_text()
android_audit = Path('android/app/src/main/java/cd/cc/supra/inventory/beta/D166UsageAudit.kt').read_text()
for marker in (
    'status == 400 -> "BAD_REQUEST_400"',
    'status == 404 -> "NOT_FOUND_404"',
    'status == 409 -> "CONFLICT_409"',
    'status == 422 -> "UNPROCESSABLE_422"',
    'http_dropped_metric_attempts',
    'RAM_PER_ATTEMPT_NOT_PROVIDER_BILLING',
    'MAX_API_KEYS = 180',
):
    assert marker in android_audit, ("D166 HTTP usage detail marker missing", marker)
assert 'employee_code' not in android_audit and 'picker_user_id' not in android_audit
print('D166 logging guard PASS')
