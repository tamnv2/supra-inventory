#!/usr/bin/env python3
"""D166 guarded on-demand Inventory Beta Usage export contract."""
from pathlib import Path
r=Path(__file__).resolve().parents[1]
def source(path):
    return (r/path).read_text(encoding="utf-8")
agent=source("relay-agent/D166UsageExport.cs")
gateway=source("ops/apps-script/agent-log-gateway/Code.gs")
usage=source("relay-agent/D160Usage.cs")
version=source("relay-agent/VERSION").strip()
config=source("relay-agent/AgentConfig.cs")
assert version == "121" and "AgentBuild = 121;" in config
for token in (
    "Tải số liệu Usage để phân tích", "get_usage_export",
    "D160UsageAllowedForCurrentSession", "D166_SESSION_CHANGED",
    "ZipArchive", "usage_hourly.csv", "manifest.json", "summary.json",
    "providers/monitoring.json", "collection_status.json",
    "manual_dashboard_links.txt", "checksums.sha256",
):
    assert token in agent, f"missing D166 Agent guard: {token}"
assert "InitializeD166UsageExportUi(header)" in usage
for token in (
    "collectD166UsageExport_", "validateIdToken_(idToken)",
    "firebasedatabase.googleapis.com/network/sent_bytes_count",
    "sheets.googleapis.com", "drive.googleapis.com",
    "BILLING_NOT_AVAILABLE_USE_OWNER_SCREENSHOT",
    "google_drive_account", "monitoring_queries_per_click",
    "firestore_document_operations_added: 0",
):
    assert token in gateway, f"missing scoped Gateway contract: {token}"
assert "CLOUDFLARE_ANALYTICS_TOKEN" not in (agent+gateway)
assert "BrowserCookies" not in agent and "WmsToken" not in agent
assert 'const CACHE_TTL_SECONDS = 15 * 60;' in gateway
assert "new Date(now.getTime() - DAY_MS)" in gateway
print("D166_USAGE_ZIP_STATIC_GUARD=PASS")
