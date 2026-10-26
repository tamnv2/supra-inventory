#!/usr/bin/env python3
"""D173-E055: SQL equivalence fixture and bounded usage instrumentation guards.

A source fixture is not a Cloudflare billing benchmark; provider FIELD proof is separate.
"""
from pathlib import Path
import re
import sqlite3

root = Path(__file__).resolve().parents[1]
src = (root / "service/src/operational-v2-core.ts").read_text(encoding="utf-8")
route = (root / "service/src/d167-route-usage.ts").read_text(encoding="utf-8")
metrics = (root / "service/src/d173-persistent-usage.ts").read_text(encoding="utf-8")
recent = src[src.index("function reporterRecent("):src.index("function reporterBatchTickets(")]
picker = src[src.index("function pickerReports("):src.index("function pendingResults(")]

assert 'WITH page_ids AS MATERIALIZED (' in recent
page = recent[recent.index('WITH page_ids AS MATERIALIZED ('):recent.index('SELECT b.batch_id, b.sku')]
assert 'LIMIT ? OFFSET ?' in page and 'ORDER BY COALESCE(b.resolved_at, b.updated_at)' in page
assert 'FROM page_ids page' in recent and 'JOIN report_batches b ON b.batch_id = page.batch_id' in recent
assert recent.count('d166MeasuredSqlRows<SqlRow>(state, "RECENT_RESULTS_COUNT"') == 0
assert 'd166MeasuredSqlRows<SqlRow>(state, "RECENT_STATUS_TOTALS"' in recent
assert 'total: status === "HAS_STOCK"' in recent
assert 'WITH recent_batches AS MATERIALIZED (' in recent
assert 'ack_by_batch AS MATERIALIZED (' in recent
assert 'JOIN recent_batches b ON b.batch_id = a.batch_id AND b.version = a.batch_version' in recent

# The old picker view executed five latest-ACK lookups with the same keys.
# The replacement performs one indexed lookup and joins its columns.
view = picker[picker.index('d166MeasuredSqlRows<SqlRow>(state, "PICKER_REPORTS_PAGE"'):]
assert view.count("SELECT latest.result_event_id") == 1
assert "a.received_at AS received_at" in view
assert "a.displayed_at AS displayed_at" in view
assert "a.acknowledged_at AS acknowledged_at" in view
assert "LEFT JOIN report_events e ON e.event_id = a.result_event_id" in view
assert 'idx_result_ack_batch_target_created' in src
assert metrics.count("recordD173PersistedMetric(") >= 1
for marker in ('"REPORTER_COUNTERS"', '"REPORTER_BATCH_TICKETS"', '"SLA_CONFIG"'):
    assert marker in route
assert route.count('recordD173PersistedMetric(state, "ROUTE"') == 1

db = sqlite3.connect(":memory:")
db.executescript("""
CREATE TABLE report_batches(batch_id TEXT PRIMARY KEY, status TEXT, first_report_at TEXT,
 version INTEGER, resolved_at TEXT, updated_at TEXT);
CREATE TABLE batch_summaries(batch_id TEXT PRIMARY KEY, ack_target_count INTEGER,
 acknowledged_count INTEGER);
CREATE TABLE result_acknowledgements(result_event_id TEXT, batch_id TEXT,
 batch_version INTEGER, target_user_id TEXT, created_at TEXT,
 received_at TEXT, displayed_at TEXT, acknowledged_at TEXT,
 PRIMARY KEY(result_event_id,target_user_id));
""")
batches = [
    ("b1","HAS_STOCK","2026-10-26T05:00:00Z",2,"2026-10-26T06:00:00Z","2026-10-26T06:00:00Z"),
    ("b2","SKIP_ALLOWED","2026-10-26T07:00:00Z",1,"2026-10-26T08:00:00Z","2026-10-26T08:00:00Z"),
    ("b3","CLOSED","2026-10-26T09:00:00Z",1,"2026-10-26T10:00:00Z","2026-10-26T10:00:00Z"),
    ("b4","PENDING","2026-10-26T09:00:00Z",1,None,"2026-10-26T10:00:00Z"),
    ("b5","HAS_STOCK","2026-10-24T05:00:00Z",1,"2026-10-24T06:00:00Z","2026-10-24T06:00:00Z"),
]
db.executemany("INSERT INTO report_batches VALUES(?,?,?,?,?,?)", batches)
db.executemany("INSERT INTO batch_summaries VALUES(?,?,?)",
               [("b1",2,1),("b2",None,None),("b3",0,0)])
db.executemany("INSERT INTO result_acknowledgements VALUES(?,?,?,?,?,?,?,?)", [
    ("r1","b1",2,"p1","2026-10-26T06:00:00Z",None,"yes",None),
    ("r1","b1",2,"p2","2026-10-26T06:00:00Z",None,"yes","yes"),
    ("r0","b1",1,"p1","2026-10-25T06:00:00Z",None,"yes","yes"),
    ("r2","b2",1,"p3","2026-10-26T08:00:00Z",None,None,None),
    ("r3","b5",1,"p3","2026-10-24T06:00:00Z",None,"yes",None),
])

scope = "b.status IN ('HAS_STOCK','SKIP_ALLOWED','CLOSED') AND b.first_report_at >= ? AND b.first_report_at < ?"
bounds = ("2026-10-26T00:00:00Z","2026-10-27T00:00:00Z")
# Baseline from E054 (old SQL with 3 per-batch correlated count operations).
old = f"""
SELECT COALESCE(SUM(COALESCE(s.ack_target_count,
 (SELECT COUNT(DISTINCT a.target_user_id) FROM result_acknowledgements a
  WHERE a.batch_id=b.batch_id AND a.batch_version=b.version))),0),
 COALESCE(SUM(COALESCE(s.acknowledged_count,
 (SELECT COUNT(DISTINCT a.target_user_id) FROM result_acknowledgements a
  WHERE a.batch_id=b.batch_id AND a.batch_version=b.version AND a.acknowledged_at IS NOT NULL))),0),
 COALESCE(SUM((SELECT COUNT(DISTINCT a.target_user_id) FROM result_acknowledgements a
  WHERE a.batch_id=b.batch_id AND a.batch_version=b.version
   AND (a.displayed_at IS NOT NULL OR a.acknowledged_at IS NOT NULL))),0)
FROM report_batches b LEFT JOIN batch_summaries s ON s.batch_id=b.batch_id
WHERE {scope}
"""
new = f"""
WITH recent_batches AS MATERIALIZED (
 SELECT b.batch_id, b.version FROM report_batches b WHERE {scope}
), ack_by_batch AS MATERIALIZED (
 SELECT a.batch_id,a.batch_version,
 COUNT(DISTINCT a.target_user_id) AS target_count,
 COUNT(DISTINCT CASE WHEN a.acknowledged_at IS NOT NULL THEN a.target_user_id END) AS acknowledged_count,
 COUNT(DISTINCT CASE WHEN a.displayed_at IS NOT NULL OR a.acknowledged_at IS NOT NULL THEN a.target_user_id END) AS displayed_count
 FROM result_acknowledgements a
 JOIN recent_batches b ON b.batch_id=a.batch_id AND b.version=a.batch_version
 GROUP BY a.batch_id,a.batch_version
)
SELECT COALESCE(SUM(COALESCE(s.ack_target_count,a.target_count,0)),0),
 COALESCE(SUM(COALESCE(s.acknowledged_count,a.acknowledged_count,0)),0),
 COALESCE(SUM(COALESCE(a.displayed_count,0)),0)
FROM recent_batches b
LEFT JOIN batch_summaries s ON s.batch_id=b.batch_id
LEFT JOIN ack_by_batch a ON a.batch_id=b.batch_id AND a.batch_version=b.version
"""
for window in [bounds, ("2026-10-24T00:00:00Z","2026-10-27T00:00:00Z"),
               ("2026-10-29T00:00:00Z","2026-10-30T00:00:00Z")]:
    old_row = db.execute(old,window).fetchone()
    new_row = db.execute(new,window).fetchone()
    assert old_row == new_row, (window,old_row,new_row)

# Exactly the same ordered page IDs, including equal-date tie-breaks and empty offsets.
for offset in (0,1,3,20):
    base = db.execute(f"""
      SELECT b.batch_id FROM report_batches b WHERE {scope}
      ORDER BY COALESCE(b.resolved_at,b.updated_at) DESC,b.batch_id DESC
      LIMIT ? OFFSET ?
    """,(*bounds,2,offset)).fetchall()
    page = db.execute(f"""
      WITH page_ids AS MATERIALIZED (
        SELECT b.batch_id FROM report_batches b WHERE {scope}
        ORDER BY COALESCE(b.resolved_at,b.updated_at) DESC,b.batch_id DESC LIMIT ? OFFSET ?
      )
      SELECT b.batch_id FROM page_ids p JOIN report_batches b ON b.batch_id=p.batch_id
      ORDER BY COALESCE(b.resolved_at,b.updated_at) DESC,b.batch_id DESC
    """,(*bounds,2,offset)).fetchall()
    assert base==page, (offset,base,page)

print("D173_E055_SQL_EQUIVALENCE_PASS__ACK_VERSION_FILTER__PAGINATION__NO_EXTRA_TELEMETRY_CALLS")
