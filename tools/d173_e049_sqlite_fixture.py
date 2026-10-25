#!/usr/bin/env python3
"""Exercise E049's exact SQL schema/upsert against SQLite across reopen."""
from pathlib import Path
import re
import sqlite3
import tempfile
import time

source = Path("service/src/d173-persistent-usage.ts").read_text(encoding="utf-8")
schema = re.search(r"(CREATE TABLE IF NOT EXISTS d173_usage_counters \([\s\S]*?\n    \))", source)
upsert = re.search(
    r"(INSERT INTO d173_usage_counters \([\s\S]*?"
    r"unavailable_cursor_samples = unavailable_cursor_samples \+ excluded\.unavailable_cursor_samples)",
    source)
assert schema and upsert, "expected SQLite source contract missing"

hour = "2026-10-25T16:00:00Z"
with tempfile.TemporaryDirectory() as work:
    path = str(Path(work) / "restart-persistent.sqlite")
    db = sqlite3.connect(path)
    db.execute(schema.group(1))
    db.commit()
    def record(kind, metric, method, read, write, latency, unavailable=0):
        db.execute(upsert.group(1), (hour, kind, metric, method, read, write,
                                    read, write, latency, latency, unavailable))
        db.commit()
    record("SQL", "REPORTER_QUEUE_PAGE", "", 23, 0, 12)
    record("SQL", "REPORTER_QUEUE_PAGE", "", 42, 1, 21)
    record("ROUTE", "REPORTER_QUEUE", "GET", 0, 0, 38)
    record("ROUTE", "REPORTER_QUEUE", "GET", 0, 0, 11)
    db.close()  # simulates DO isolate and in-memory state being discarded
    db = sqlite3.connect(path)
    sql = db.execute(
        "SELECT executions,rows_read,rows_written,max_rows_read,"
        "max_rows_written,latency_ms,max_latency_ms FROM d173_usage_counters "
        "WHERE metric_kind='SQL' AND metric_id='REPORTER_QUEUE_PAGE'").fetchone()
    route = db.execute(
        "SELECT executions,latency_ms,max_latency_ms FROM d173_usage_counters "
        "WHERE metric_kind='ROUTE' AND metric_id='REPORTER_QUEUE'").fetchone()
    assert sql == (2, 65, 1, 42, 1, 33, 21), sql
    assert route == (2, 49, 38), route
    try:
        db.execute(upsert.group(1), (hour, "ROUTE", "INVALID", "GET", 0, 0, 0, 0, 0, 0, 0))
    except sqlite3.Error:
        raise AssertionError("E049 upsert SQL malformed")
    # Reject invalid kind at SQLite schema guard.
    try:
        db.execute(upsert.group(1), (hour, "OTHER", "OTHER", "GET", 0, 0, 0, 0, 0, 0, 0))
        raise AssertionError("schema accepted unknown metric kind")
    except sqlite3.IntegrityError:
        pass
    count = db.execute("SELECT COUNT(*) FROM d173_usage_counters").fetchone()[0]
    assert count == 3, count

    start = time.perf_counter()
    for i in range(300):
        record("ROUTE", "REPORTER_QUEUE", "GET", 0, 0, i % 20)
    ms = (time.perf_counter() - start) * 1000 / 300
    print(f"D173_E049_SQLITE_RESTART_DURABILITY_PASS mock_single_row_write_mean_ms={ms:.3f} (local fixture, not Cloudflare latency)")
    db.close()
