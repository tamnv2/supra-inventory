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
print('D166 logging guard PASS')
