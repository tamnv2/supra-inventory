#!/usr/bin/env python3
"""D173-E093: Agent156 WMS verification and source-backed 06h/day/cycle Usage."""
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def src(path):return (R/path).read_text(encoding="utf-8")
assert src("relay-agent/VERSION").strip()=="156"
assert "AgentBuild = 156;" in src("relay-agent/AgentConfig.cs")
assert "0.156.0.0" in src("relay-agent/SupraInventoryRelayAgent.csproj")
transport=src("relay-agent/FirestoreConfirmationTransport.cs")
pipeline=src("relay-agent/D160ConfirmPipeline.cs")
browser=src("relay-agent/SupraConfirmBrowserD160.cs")
assert 'GrpcTimestampMs(fields, "created_at")' in transport
assert 'FieldTimestampMs(fields, "created_at")' in transport
assert "work.CreatedAtMs" in pipeline and "work.ClientSentAtMs" not in pipeline
assert "VerifyExactAlreadyConfirmedReadOnly" in browser
assert "IssueConfirmReloadNowNoLock" in browser
assert "observed.Candidates.TryGetValue" in browser
assert "observed.UnselectableFragments.Contains" in browser
assert "observed.AlreadyConfirmedFragments.Contains" in browser
assert "targets.Count == 1" in pipeline
assert 'browser.Result = "ALREADY_CONFIRMED"' in pipeline
assert "MarkLocalConfirmed" in pipeline
assert "ReleaseSafeFailure(session, target.Guard.GuardId)" in pipeline
assert "D160_NO_ROW_INFERENCE" in pipeline
cards=src("relay-agent/D173E089UsageCards.cs")
usage=src("relay-agent/D173VpsUsage.cs")
worker=src("service/src/d173-vps-usage.ts")
route=src("service/src/index.ts")
for needle in ("E093CycleWindow","E093CycleUsed","CycleTargets",
               "CycleBarTrack","CycleBarFill","E089UpdateBars",
               "Pacific Standard Time","operationalDay.AddHours(6)"):
    assert needle in cards,needle
for needle in ('TryD173VpsUsageRefresh("cycle",false)',
               'D173VpsCachePath("cycle")','_d173VpsSnapshotCycle'):
    assert needle in usage,needle
assert 'if(window==="cycle")' in worker
assert 'BILLING_CYCLE_UNVERIFIED' in worker
assert 'window==="24h"?DAY_MS' in worker
assert '["24h","7d","30d","cycle"]' in route
assert "window=\"+Uri.EscapeDataString(window)" in usage
# The scoped change must not alter Android or D172 business sources.
print("D173_E093_AGENT156_WORKER_CYCLE_SOURCE_PASS")
