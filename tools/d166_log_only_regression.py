from pathlib import Path

root=Path('relay-agent')
agent_build = int((root/'VERSION').read_text().strip())
assert agent_build >= 123, 'D166 v123 diagnostics must remain present in later Agent releases'
assert f'AgentBuild = {agent_build}' in (root/'AgentConfig.cs').read_text()
assert 'SnapshotUsageAudit()' in (root/'FirestoreQuotaGuard.cs').read_text()
assert 'FirestoreQuotaGuard.SnapshotUsageAudit()' in (root/'AgentLogUploadBridge.cs').read_text()
assert 'FirestoreQuotaGuard.RecordOutcome(' in (root/'FirestoreHttpTransport.cs').read_text()
assert 'd166UsageAudit()' in Path('web/src/runtime-logger.ts').read_text()
assert 'D166UsageAudit.recordApi(' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/InventoryApi.kt').read_text()
assert 'd166_usage_audit' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/MainActivity.kt').read_text()
assert 'D166UsageAudit.snapshot(journal)' in Path('android/app/src/main/java/cd/cc/supra/inventory/beta/AndroidSupportLogResponder.kt').read_text()
print('D166 logging guard PASS')
