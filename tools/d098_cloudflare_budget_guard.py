#!/usr/bin/env python3
"""D098 conservative Workers Paid budget guard for SUPRA Inventory.

The Owner reserved 65% of the shared Workers Paid included usage for other
projects. Inventory therefore fails this design guard if any modeled metric
exceeds 35% of the current included allowance.

The traffic reference is the existing D064 approved stress envelope:
1,000 successful shortage reports in <=10 minutes. For monthly budgeting we
conservatively model one full D064 envelope every day, plus 200 active clients
opening/recovering realtime sessions twice per day. This is a budgeting model,
not provider billing telemetry. If actual business volume grows beyond this
reference, update and rerun the guard before claiming quota acceptance.
"""

from __future__ import annotations

LIMITS = {
    "worker_requests": 10_000_000,
    "worker_cpu_ms": 30_000_000,
    "do_requests": 1_000_000,
    "do_duration_gb_s": 400_000,
    "sqlite_row_reads": 25_000_000_000,
    "sqlite_row_writes": 50_000_000,
    "sqlite_storage_bytes": 5 * 1024**3,
}

BUDGET_FRACTION = 0.35
DAYS = 30
REPORTS_PER_DAY = 1_000
ACTIVE_CLIENTS = 200
REALTIME_OPENS_PER_CLIENT_PER_DAY = 2

# Deliberately conservative accounting multipliers. Server->client WebSocket
# broadcasts are not multiplied by recipient count here because they are not
# billed as new Worker requests; reconnect/ticket overhead is modeled separately.
WORKER_REQUESTS_PER_REPORT = 8
WORKER_CPU_MS_PER_REQUEST = 20
DO_REQUESTS_PER_REPORT = 10
DO_DURATION_GB_S_PER_REPORT = 3
SQLITE_READS_PER_REPORT = 200
SQLITE_WRITES_PER_REPORT = 10

# D064 measured +2,572,288 bytes for 1,000 successful reports. Keep 60 days
# worth of that measured growth plus a 512 MiB fixed safety reserve.
D064_STORAGE_GROWTH_PER_1000 = 2_572_288
RETENTION_DAYS = 60
FIXED_STORAGE_RESERVE = 512 * 1024**2

monthly_reports = REPORTS_PER_DAY * DAYS
monthly_realtime_opens = ACTIVE_CLIENTS * REALTIME_OPENS_PER_CLIENT_PER_DAY * DAYS

usage = {
    "worker_requests": monthly_reports * WORKER_REQUESTS_PER_REPORT + monthly_realtime_opens * 2,
    "worker_cpu_ms": (monthly_reports * WORKER_REQUESTS_PER_REPORT + monthly_realtime_opens * 2)
    * WORKER_CPU_MS_PER_REQUEST,
    "do_requests": monthly_reports * DO_REQUESTS_PER_REPORT + monthly_realtime_opens,
    "do_duration_gb_s": monthly_reports * DO_DURATION_GB_S_PER_REPORT,
    "sqlite_row_reads": monthly_reports * SQLITE_READS_PER_REPORT,
    "sqlite_row_writes": monthly_reports * SQLITE_WRITES_PER_REPORT,
    "sqlite_storage_bytes": FIXED_STORAGE_RESERVE
    + D064_STORAGE_GROWTH_PER_1000 * (REPORTS_PER_DAY / 1_000) * RETENTION_DAYS,
}

failed: list[str] = []
print("D098 Cloudflare Inventory budget projection")
print(f"reference_reports_per_day={REPORTS_PER_DAY} active_clients={ACTIVE_CLIENTS} budget={BUDGET_FRACTION:.0%}")
for name, limit in LIMITS.items():
    value = usage[name]
    ratio = value / limit
    budget = limit * BUDGET_FRACTION
    print(f"{name}: usage={value:.0f} included={limit:.0f} ratio={ratio:.2%} budget35={budget:.0f}")
    if ratio > BUDGET_FRACTION:
        failed.append(f"{name}={ratio:.2%}")

if failed:
    raise SystemExit("D098_CLOUDFLARE_BUDGET_FAIL: " + ", ".join(failed))

print("D098_CLOUDFLARE_BUDGET_PASS")
